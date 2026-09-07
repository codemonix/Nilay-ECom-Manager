import mongoose from "mongoose";
import {
  CaseEventType,
  CasePriority,
  CaseStatus,
  type CaseCategory,
  type CaseContactPoint,
  type CaseSource,
} from "@complaint-system/shared";
import { caseRepository } from "../repositories/caseRepository";
import { caseEventRepository } from "../repositories/caseEventRepository";
import { userRepository } from "../repositories/userRepository";
import type { CaseDocument } from "../models/Case";
import type { CaseEventDocument } from "../models/CaseEvent";
import { ApiError } from "../utils/ApiError";
import { isTransactionsUnsupportedError } from "../utils/transactions";
import { assertValidStatusTransition } from "./statusTransitionService";
import { generateCaseNumber } from "./caseNumberService";
import type {
  CreateCaseInput,
  ListCasesQuery,
} from "../validators/caseValidators";

export interface Actor {
  id: string;
  name: string;
}

/**
 * Re-populates assignedTo/createdBy after a save. Mongoose replaces a
 * populated ref with a bare ObjectId as soon as the field is reassigned
 * (e.g. caseDoc.assignedTo = someId), so every mutation path must
 * re-populate before the document is serialized for the API response.
 */
async function populateCaseRefs(caseDoc: CaseDocument): Promise<CaseDocument> {
  await caseDoc.populate([
    { path: "assignedTo", select: "name email role" },
    { path: "createdBy", select: "name email role" },
  ]);
  return caseDoc;
}

type MutateResult = {
  eventType: CaseEventType;
  body?: string | null;
  data?: Record<string, unknown> | null;
};

/**
 * Applies a mutation to a Case and records the corresponding CaseEvent as a
 * single logical operation. Uses a MongoDB transaction when the connected
 * server supports it (replica set / mongos). On a standalone development
 * server -- which does not support multi-document transactions -- it falls
 * back to sequential writes and manually compensates (reverts the case
 * fields) if the event write fails, so a Case can never end up with a
 * change that has no matching event. See docs/database.md for details.
 */
async function applyCaseMutationWithEvent(
  caseId: string,
  actor: Actor | undefined,
  mutate: (caseDoc: CaseDocument) => MutateResult,
): Promise<{ case: CaseDocument; event: CaseEventDocument }> {
  const session = await mongoose.startSession();
  try {
    try {
      let out: { case: CaseDocument; event: CaseEventDocument } | undefined;
      await session.withTransaction(async () => {
        const caseDoc = await caseRepository.findById(caseId, session);
        if (!caseDoc) throw ApiError.notFound("Case not found");
        const { eventType, body, data } = mutate(caseDoc);
        caseDoc.lastActivityAt = new Date();
        await caseRepository.save(caseDoc, session);
        const event = await caseEventRepository.create(
          { caseId, type: eventType, actorId: actor?.id ?? null, body: body ?? null, data: data ?? null },
          session,
        );
        await populateCaseRefs(caseDoc);
        out = { case: caseDoc, event };
      });
      return out!;
    } catch (err) {
      if (!isTransactionsUnsupportedError(err)) throw err;

      const caseDoc = await caseRepository.findById(caseId);
      if (!caseDoc) throw ApiError.notFound("Case not found");
      const before = caseDoc.toObject();
      const { eventType, body, data } = mutate(caseDoc);
      caseDoc.lastActivityAt = new Date();
      await caseRepository.save(caseDoc);
      try {
        const event = await caseEventRepository.create({
          caseId,
          type: eventType,
          actorId: actor?.id ?? null,
          body: body ?? null,
          data: data ?? null,
        });
        await populateCaseRefs(caseDoc);
        return { case: caseDoc, event };
      } catch (eventErr) {
        caseDoc.set(before);
        caseDoc.isNew = false;
        await caseRepository.save(caseDoc);
        throw eventErr;
      }
    }
  } finally {
    await session.endSession();
  }
}

export async function createCase(
  input: CreateCaseInput,
  actor: Actor | undefined,
): Promise<{ case: CaseDocument; event: CaseEventDocument }> {
  const caseNumber = await generateCaseNumber();

  const relatedOrders = input.relatedOrder ? [input.relatedOrder] : [];
  const relatedItems = input.relatedItem ? [input.relatedItem] : [];

  const baseData = {
    caseNumber,
    customer: {
      externalCustomerId: input.customer.externalCustomerId,
      name: input.customer.name,
      phone: input.customer.phone,
      email: input.customer.email || undefined,
    },
    subject: input.subject,
    description: input.description,
    category: input.category as CaseCategory,
    priority: input.priority as CasePriority,
    status: CaseStatus.OPEN,
    source: input.source as CaseSource,
    contactPoint: (input.contactPoint as CaseContactPoint | undefined) ?? null,
    assignedTo: input.assignedTo ?? null,
    relatedOrders,
    relatedItems,
    tags: input.tags ?? [],
    createdBy: actor?.id ?? null,
    lastActivityAt: new Date(),
  };

  const session = await mongoose.startSession();
  try {
    try {
      let out: { case: CaseDocument; event: CaseEventDocument } | undefined;
      await session.withTransaction(async () => {
        const caseDoc = await caseRepository.create(baseData, session);
        const event = await caseEventRepository.create(
          {
            caseId: String(caseDoc._id),
            type: CaseEventType.CREATED,
            actorId: actor?.id ?? null,
            body: `Case created: ${input.subject}`,
            data: { category: input.category, priority: input.priority, source: input.source },
          },
          session,
        );
        await populateCaseRefs(caseDoc);
        out = { case: caseDoc, event };
      });
      return out!;
    } catch (err) {
      if (!isTransactionsUnsupportedError(err)) throw err;

      const caseDoc = await caseRepository.create(baseData);
      try {
        const event = await caseEventRepository.create({
          caseId: String(caseDoc._id),
          type: CaseEventType.CREATED,
          actorId: actor?.id ?? null,
          body: `Case created: ${input.subject}`,
          data: { category: input.category, priority: input.priority, source: input.source },
        });
        await populateCaseRefs(caseDoc);
        return { case: caseDoc, event };
      } catch (eventErr) {
        // Compensate: never leave a case without its initial "created" event.
        await caseDoc.deleteOne();
        throw eventErr;
      }
    }
  } finally {
    await session.endSession();
  }
}

export async function getCaseById(id: string): Promise<CaseDocument> {
  const caseDoc = await caseRepository.findById(id);
  if (!caseDoc) throw ApiError.notFound("Case not found");
  return caseDoc;
}

export async function listCases(query: ListCasesQuery) {
  const { items, total } = await caseRepository.list(query);
  return {
    items,
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

export async function getTimeline(caseId: string): Promise<CaseEventDocument[]> {
  await getCaseById(caseId);
  return caseEventRepository.findByCaseId(caseId);
}

export async function changeStatus(
  caseId: string,
  targetStatus: CaseStatus,
  reason: string | undefined,
  actor: Actor | undefined,
) {
  return applyCaseMutationWithEvent(caseId, actor, (caseDoc) => {
    const from = caseDoc.status as CaseStatus;
    assertValidStatusTransition(from, targetStatus);

    caseDoc.status = targetStatus;

    if (targetStatus === CaseStatus.RESOLVED) {
      caseDoc.resolvedAt = new Date();
    } else if (targetStatus === CaseStatus.CLOSED) {
      caseDoc.closedAt = new Date();
    } else if (targetStatus === CaseStatus.OPEN) {
      caseDoc.resolvedAt = null;
      caseDoc.closedAt = null;
    }

    let eventType: CaseEventType = CaseEventType.STATUS_CHANGED;
    if (targetStatus === CaseStatus.RESOLVED) eventType = CaseEventType.RESOLVED;
    else if (targetStatus === CaseStatus.CLOSED) eventType = CaseEventType.CLOSED;
    else if (
      targetStatus === CaseStatus.OPEN &&
      (from === CaseStatus.RESOLVED || from === CaseStatus.CLOSED)
    ) {
      eventType = CaseEventType.REOPENED;
    }

    return {
      eventType,
      body: reason ?? null,
      data: { from, to: targetStatus },
    };
  });
}

export async function changePriority(caseId: string, priority: CasePriority, actor: Actor | undefined) {
  return applyCaseMutationWithEvent(caseId, actor, (caseDoc) => {
    const from = caseDoc.priority as CasePriority;
    caseDoc.priority = priority;
    return {
      eventType: CaseEventType.PRIORITY_CHANGED,
      data: { from, to: priority },
    };
  });
}

export async function changeContactPoint(
  caseId: string,
  contactPoint: CaseContactPoint,
  actor: Actor | undefined,
) {
  return applyCaseMutationWithEvent(caseId, actor, (caseDoc) => {
    const from = caseDoc.contactPoint ?? null;
    caseDoc.contactPoint = contactPoint as unknown as typeof caseDoc.contactPoint;
    return {
      eventType: CaseEventType.CONTACT_POINT_CHANGED,
      data: { from, to: contactPoint },
    };
  });
}

export async function assignCase(caseId: string, assignedTo: string | null, actor: Actor | undefined) {
  const [fromUser, toUser] = await Promise.all([
    (async () => {
      const caseDoc = await caseRepository.findById(caseId);
      return caseDoc?.assignedTo ? userRepository.findById(String((caseDoc.assignedTo as { _id: unknown })._id)) : null;
    })(),
    assignedTo ? userRepository.findById(assignedTo) : Promise.resolve(null),
  ]);

  return applyCaseMutationWithEvent(caseId, actor, (caseDoc) => {
    caseDoc.assignedTo = assignedTo as unknown as typeof caseDoc.assignedTo;
    return {
      eventType: CaseEventType.ASSIGNMENT_CHANGED,
      data: {
        fromUserId: fromUser ? String(fromUser._id) : null,
        fromUserName: fromUser?.name ?? null,
        toUserId: toUser ? String(toUser._id) : null,
        toUserName: toUser?.name ?? null,
      },
    };
  });
}

export async function addNote(
  caseId: string,
  body: string,
  visibility: "internal" | "customer",
  actor: Actor | undefined,
) {
  return applyCaseMutationWithEvent(caseId, actor, () => ({
    eventType: visibility === "customer" ? CaseEventType.CUSTOMER_MESSAGE : CaseEventType.INTERNAL_NOTE,
    body,
  }));
}

export async function linkOrder(
  caseId: string,
  order: { externalOrderId: string; orderNumber: string },
  actor: Actor | undefined,
) {
  return applyCaseMutationWithEvent(caseId, actor, (caseDoc) => {
    const exists = caseDoc.relatedOrders.some((o) => o.externalOrderId === order.externalOrderId);
    if (!exists) caseDoc.relatedOrders.push(order);
    return { eventType: CaseEventType.ORDER_LINKED, data: { ...order } };
  });
}

export async function linkItem(
  caseId: string,
  item: { externalItemId: string; sku: string; title: string },
  actor: Actor | undefined,
) {
  return applyCaseMutationWithEvent(caseId, actor, (caseDoc) => {
    const exists = caseDoc.relatedItems.some((i) => i.externalItemId === item.externalItemId);
    if (!exists) caseDoc.relatedItems.push(item);
    return { eventType: CaseEventType.ITEM_LINKED, data: { ...item } };
  });
}

export async function addTag(caseId: string, tag: string, actor: Actor | undefined) {
  return applyCaseMutationWithEvent(caseId, actor, (caseDoc) => {
    const normalized = tag.trim();
    if (!caseDoc.tags.includes(normalized)) caseDoc.tags.push(normalized);
    return { eventType: CaseEventType.TAG_ADDED, data: { tag: normalized } };
  });
}

export async function removeTag(caseId: string, tag: string, actor: Actor | undefined) {
  return applyCaseMutationWithEvent(caseId, actor, (caseDoc) => {
    caseDoc.tags = caseDoc.tags.filter((t) => t !== tag) as typeof caseDoc.tags;
    return { eventType: CaseEventType.TAG_REMOVED, data: { tag } };
  });
}

/** Records an event and bumps lastActivityAt without otherwise mutating the case. Used by attachmentService. */
export async function recordEvent(
  caseId: string,
  eventType: CaseEventType,
  actor: Actor | undefined,
  body?: string | null,
  data?: Record<string, unknown> | null,
) {
  await getCaseById(caseId);
  return applyCaseMutationWithEvent(caseId, actor, () => ({ eventType, body, data }));
}
