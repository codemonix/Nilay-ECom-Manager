import mongoose from "mongoose";
import { PackageEventType, PackageStatus } from "@complaint-system/shared";
import type { MatchPreviewDTO } from "@complaint-system/shared";
import { packageRepository } from "../repositories/packageRepository";
import { packageEventRepository } from "../repositories/packageEventRepository";
import { getShopfaClient } from "../integrations/shopfa";
import { shopfaTitleEndsWithAsterisk } from "../integrations/shopfa/shopfaTitle";
import type { PackageDocument, PackageItemSubdocument } from "../models/Package";
import type { PackageEventDocument } from "../models/PackageEvent";
import { ApiError } from "../utils/ApiError";
import { isTransactionsUnsupportedError } from "../utils/transactions";
import { assertValidPackageStatusTransition } from "./packageStatusTransitionService";
import { generatePackageNumber } from "./packageNumberService";
import type {
  ChangePackageStatusInput,
  CreateDraftPackageInput,
  ListPackagesQuery,
  MatchItemInput,
  ReceiveItemInput,
  UpdateItemInput,
} from "../validators/packageValidators";

export interface Actor {
  id: string;
  name: string;
}

type MutateResult = {
  eventType: PackageEventType;
  body?: string | null;
  data?: Record<string, unknown> | null;
};

/**
 * Re-populates createdBy/receivedBy after a save. Mongoose replaces a
 * populated ref with a bare ObjectId as soon as the field is reassigned
 * (e.g. packageDoc.receivedBy = someId), so every mutation path must
 * re-populate before the document is serialized for the API response.
 */
async function populatePackageRefs(packageDoc: PackageDocument): Promise<PackageDocument> {
  await packageDoc.populate([
    { path: "createdBy", select: "name email role" },
    { path: "receivedBy", select: "name email role" },
  ]);
  return packageDoc;
}

/**
 * Applies a mutation to a Package and records the corresponding PackageEvent
 * as a single logical operation -- mirrors caseService's
 * applyCaseMutationWithEvent (transaction when supported, manual
 * compensation fallback for a standalone Mongo server). See docs/database.md.
 */
async function applyPackageMutationWithEvent(
  packageId: string,
  actor: Actor | undefined,
  mutate: (packageDoc: PackageDocument) => MutateResult,
): Promise<{ package: PackageDocument; event: PackageEventDocument }> {
  const session = await mongoose.startSession();
  try {
    try {
      let out: { package: PackageDocument; event: PackageEventDocument } | undefined;
      await session.withTransaction(async () => {
        const packageDoc = await packageRepository.findById(packageId, session);
        if (!packageDoc) throw ApiError.notFound("Package not found");
        const { eventType, body, data } = mutate(packageDoc);
        packageDoc.lastActivityAt = new Date();
        await packageRepository.save(packageDoc, session);
        const event = await packageEventRepository.create(
          { packageId, type: eventType, actorId: actor?.id ?? null, body: body ?? null, data: data ?? null },
          session,
        );
        await populatePackageRefs(packageDoc);
        out = { package: packageDoc, event };
      });
      return out!;
    } catch (err) {
      if (!isTransactionsUnsupportedError(err)) throw err;

      const packageDoc = await packageRepository.findById(packageId);
      if (!packageDoc) throw ApiError.notFound("Package not found");
      const before = packageDoc.toObject();
      const { eventType, body, data } = mutate(packageDoc);
      packageDoc.lastActivityAt = new Date();
      await packageRepository.save(packageDoc);
      try {
        const event = await packageEventRepository.create({
          packageId,
          type: eventType,
          actorId: actor?.id ?? null,
          body: body ?? null,
          data: data ?? null,
        });
        await populatePackageRefs(packageDoc);
        return { package: packageDoc, event };
      } catch (eventErr) {
        packageDoc.set(before);
        packageDoc.isNew = false;
        await packageRepository.save(packageDoc);
        throw eventErr;
      }
    }
  } finally {
    await session.endSession();
  }
}

export async function createDraftPackage(
  input: CreateDraftPackageInput,
  actor: Actor | undefined,
): Promise<{ package: PackageDocument; event: PackageEventDocument }> {
  const packageNumber = await generatePackageNumber();
  const baseData = {
    packageNumber,
    supplierName: input.supplierName || null,
    createdBy: actor?.id ?? null,
    lastActivityAt: new Date(),
  };

  const session = await mongoose.startSession();
  try {
    try {
      let out: { package: PackageDocument; event: PackageEventDocument } | undefined;
      await session.withTransaction(async () => {
        const packageDoc = await packageRepository.create(baseData, session);
        const event = await packageEventRepository.create(
          {
            packageId: String(packageDoc._id),
            type: PackageEventType.CREATED,
            actorId: actor?.id ?? null,
            body: `Package created: ${packageNumber}`,
          },
          session,
        );
        await populatePackageRefs(packageDoc);
        out = { package: packageDoc, event };
      });
      return out!;
    } catch (err) {
      if (!isTransactionsUnsupportedError(err)) throw err;

      const packageDoc = await packageRepository.create(baseData);
      try {
        const event = await packageEventRepository.create({
          packageId: String(packageDoc._id),
          type: PackageEventType.CREATED,
          actorId: actor?.id ?? null,
          body: `Package created: ${packageNumber}`,
        });
        await populatePackageRefs(packageDoc);
        return { package: packageDoc, event };
      } catch (eventErr) {
        await packageDoc.deleteOne();
        throw eventErr;
      }
    }
  } finally {
    await session.endSession();
  }
}

/** Resolves the single shared open Draft package for the Receive Items flow, creating one if none exists. */
export async function getOrCreateOpenDraft(actor: Actor | undefined): Promise<PackageDocument> {
  const existing = await packageRepository.findOpenDraft();
  if (existing) return existing;
  const { package: created } = await createDraftPackage({}, actor);
  return created;
}

export async function getPackageById(id: string): Promise<PackageDocument> {
  const packageDoc = await packageRepository.findById(id);
  if (!packageDoc) throw ApiError.notFound("Package not found");
  return packageDoc;
}

export async function listPackages(query: ListPackagesQuery) {
  const { items, total } = await packageRepository.list(query);
  return {
    items,
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

export async function getEvents(packageId: string): Promise<PackageEventDocument[]> {
  await getPackageById(packageId);
  return packageEventRepository.findByPackageId(packageId);
}

function findItem(packageDoc: PackageDocument, itemId: string): PackageItemSubdocument {
  const item = packageDoc.items.id(itemId);
  if (!item) throw ApiError.notFound("Item not found on this package");
  return item;
}

/** Items can only be added/edited/removed while the package is still being assembled -- once handed to shipping (in_progress) its contents are physically sealed. */
function assertDraftEditable(packageDoc: PackageDocument): void {
  if (packageDoc.status !== PackageStatus.DRAFT) {
    throw ApiError.conflict(`Items can only be added, edited, or removed while the package is in draft (currently "${packageDoc.status}")`);
  }
}

export async function receiveItem(
  packageId: string,
  input: ReceiveItemInput,
  photoAttachmentId: string,
  actor: Actor | undefined,
) {
  return applyPackageMutationWithEvent(packageId, actor, (packageDoc) => {
    assertDraftEditable(packageDoc);
    packageDoc.items.push({
      photoAttachmentId,
      description: input.description ?? "",
      variantLabel: input.variantLabel ?? null,
      quantity: input.quantity,
      unitPrice: input.unitPrice,
      loggedAt: new Date(),
      loggedBy: actor?.id ?? null,
      notes: input.notes ?? null,
    } as unknown as PackageItemSubdocument);
    const item = packageDoc.items[packageDoc.items.length - 1]!;
    return {
      eventType: PackageEventType.ITEM_RECEIVED,
      data: { itemId: String(item._id), quantity: input.quantity, unitPrice: input.unitPrice },
    };
  });
}

export async function updateItem(
  packageId: string,
  itemId: string,
  input: UpdateItemInput,
  actor: Actor | undefined,
) {
  return applyPackageMutationWithEvent(packageId, actor, (packageDoc) => {
    assertDraftEditable(packageDoc);
    const item = findItem(packageDoc, itemId);
    if (input.description !== undefined) item.description = input.description;
    if (input.variantLabel !== undefined) item.variantLabel = input.variantLabel;
    if (input.quantity !== undefined) item.quantity = input.quantity;
    if (input.unitPrice !== undefined) item.unitPrice = input.unitPrice;
    if (input.notes !== undefined) item.notes = input.notes;
    return { eventType: PackageEventType.ITEM_UPDATED, data: { itemId } };
  });
}

export async function removeItem(packageId: string, itemId: string, actor: Actor | undefined) {
  return applyPackageMutationWithEvent(packageId, actor, (packageDoc) => {
    assertDraftEditable(packageDoc);
    const item = findItem(packageDoc, itemId);
    item.deleteOne();
    return { eventType: PackageEventType.ITEM_REMOVED, data: { itemId } };
  });
}

/**
 * Read-only lookup, no persistence -- lets the user visually confirm an item
 * is identical and correctly named before committing to the match (step 2-3
 * of the Match & Register workflow). Matching itself is not gated by package
 * status: it can happen while draft, in transit, or already received.
 */
export async function previewMatch(packageId: string, itemId: string, productCode: string): Promise<MatchPreviewDTO> {
  const packageDoc = await getPackageById(packageId);
  findItem(packageDoc, itemId); // 404s if the item doesn't exist on this package

  const client = await getShopfaClient();
  const lookup = await client.getProductByCode(productCode);
  if (!lookup) throw ApiError.notFound(`No Shopfa product found for code "${productCode}"`);

  return {
    shopfaProductId: lookup.shopfaProductId,
    productCode: lookup.productCode,
    title: lookup.title,
    sku: lookup.sku,
    price: lookup.price,
    imageUrl: lookup.imageUrl ?? null,
    titleEndsWithAsterisk: shopfaTitleEndsWithAsterisk(lookup.title),
    availableQuantity: lookup.availableQuantity,
  };
}

export async function matchItem(
  packageId: string,
  itemId: string,
  input: MatchItemInput,
  actor: Actor | undefined,
) {
  const client = await getShopfaClient();
  const lookup = await client.getProductByCode(input.productCode);
  if (!lookup) throw ApiError.notFound(`No Shopfa product found for code "${input.productCode}"`);

  return applyPackageMutationWithEvent(packageId, actor, (packageDoc) => {
    const item = findItem(packageDoc, itemId);
    item.productCode = lookup.productCode;
    item.shopfaProductId = lookup.shopfaProductId;
    item.sku = lookup.sku;
    item.matchedProductTitle = lookup.title;
    item.matchedProductImageUrl = lookup.imageUrl ?? null;
    item.matchedAvailableQuantity = lookup.availableQuantity;
    item.titleEndsWithAsterisk = shopfaTitleEndsWithAsterisk(lookup.title);
    // No inventory action happens here -- the Inventory module (not yet
    // built) will later decide whether to change Shopfa's stock level or
    // touch the "*" suffix. This just flags that a decision is owed.
    item.inventoryPending = true;
    item.matchedAt = new Date();
    item.matchedBy = actor?.id as unknown as PackageItemSubdocument["matchedBy"];
    return {
      eventType: PackageEventType.ITEM_MATCHED,
      data: { itemId, productCode: lookup.productCode, shopfaProductId: lookup.shopfaProductId },
    };
  });
}

export async function unmatchItem(packageId: string, itemId: string, actor: Actor | undefined) {
  return applyPackageMutationWithEvent(packageId, actor, (packageDoc) => {
    const item = findItem(packageDoc, itemId);
    item.productCode = null;
    item.shopfaProductId = null;
    item.sku = null;
    item.matchedProductTitle = null;
    item.matchedProductImageUrl = null;
    item.matchedAvailableQuantity = null;
    item.titleEndsWithAsterisk = false;
    item.inventoryPending = false;
    item.matchedAt = null;
    item.matchedBy = null;
    return { eventType: PackageEventType.ITEM_UNMATCHED, data: { itemId } };
  });
}

/**
 * The only status transition a purchasing user can trigger manually is
 * draft -> in_progress ("handed to the shipping company"). Moving to
 * completed is reserved for the separate Receiving module's
 * confirmReceived() below, which fires once the package is confirmed
 * received at its destination.
 */
export async function changeStatus(
  packageId: string,
  targetStatus: PackageStatus,
  reason: ChangePackageStatusInput["reason"],
  actor: Actor | undefined,
) {
  if (targetStatus === PackageStatus.COMPLETED) {
    throw ApiError.badRequest(
      "A package is marked completed by confirming receipt in the Receiving module, not from here",
    );
  }
  return applyPackageMutationWithEvent(packageId, actor, (packageDoc) => {
    const from = packageDoc.status as PackageStatus;
    assertValidPackageStatusTransition(from, targetStatus);
    packageDoc.status = targetStatus;
    return {
      eventType: PackageEventType.STATUS_CHANGED,
      body: reason ?? null,
      data: { from, to: targetStatus },
    };
  });
}

function assertAwaitingReceipt(packageDoc: PackageDocument): void {
  if (packageDoc.status !== PackageStatus.IN_PROGRESS) {
    throw ApiError.conflict(
      `Received quantities can only be recorded while a package is awaiting receipt (currently "${packageDoc.status}")`,
    );
  }
}

/** Records the actual count the receiving user counted for one item -- distinct from the originally purchased `quantity`. */
export async function updateReceivedQuantity(
  packageId: string,
  itemId: string,
  receivedQuantity: number,
  actor: Actor | undefined,
) {
  return applyPackageMutationWithEvent(packageId, actor, (packageDoc) => {
    assertAwaitingReceipt(packageDoc);
    const item = findItem(packageDoc, itemId);
    item.receivedQuantity = receivedQuantity;
    return { eventType: PackageEventType.RECEIVED_QUANTITY_UPDATED, data: { itemId, receivedQuantity } };
  });
}

/**
 * Confirms the package as received at its destination -- the only path
 * that can move a package to `completed`. When `markAllComplete` is set,
 * any item whose receivedQuantity hasn't been individually counted yet is
 * assumed fully received (matches its purchased quantity), for the
 * "confirm receiving them completely" fast path; itemized counts entered
 * beforehand via updateReceivedQuantity are left untouched either way.
 */
export async function confirmReceived(
  packageId: string,
  actor: Actor | undefined,
  options?: { markAllComplete?: boolean },
) {
  return applyPackageMutationWithEvent(packageId, actor, (packageDoc) => {
    const from = packageDoc.status as PackageStatus;
    assertValidPackageStatusTransition(from, PackageStatus.COMPLETED);
    if (options?.markAllComplete) {
      for (const item of packageDoc.items) {
        if (item.receivedQuantity === null || item.receivedQuantity === undefined) {
          item.receivedQuantity = item.quantity;
        }
      }
    }
    packageDoc.status = PackageStatus.COMPLETED;
    packageDoc.receivedAt = new Date();
    packageDoc.receivedBy = actor?.id as unknown as PackageDocument["receivedBy"];
    return {
      eventType: PackageEventType.STATUS_CHANGED,
      data: { from, to: PackageStatus.COMPLETED },
    };
  });
}

/** Records an event and bumps lastActivityAt without otherwise mutating the package. Used by attachmentService. */
export async function recordEvent(
  packageId: string,
  eventType: PackageEventType,
  actor: Actor | undefined,
  body?: string | null,
  data?: Record<string, unknown> | null,
) {
  await getPackageById(packageId);
  return applyPackageMutationWithEvent(packageId, actor, () => ({ eventType, body, data }));
}
