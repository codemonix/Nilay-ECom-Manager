import { describe, expect, it } from "vitest";
import request from "supertest";
import { StaffRole } from "@complaint-system/shared";
import { createApp } from "../src/app";
import { createAuthenticatedUser } from "./testUtils";

const app = createApp();

async function createDraftAsUser() {
  const { user, authHeader } = await createAuthenticatedUser(StaffRole.PURCHASING);
  const res = await request(app).post("/api/packages").set("Authorization", authHeader).send({});
  return { user, authHeader, res };
}

function attachPhoto(req: request.Test) {
  return req.attach("photo", Buffer.from("fake-image-bytes"), { filename: "item.jpg", contentType: "image/jpeg" });
}

async function receiveItem(
  authHeader: string,
  packageId: string,
  fields: { quantity?: number; unitPrice?: number; variantLabel?: string } = {},
) {
  const req = request(app)
    .post(`/api/packages/${packageId}/items`)
    .set("Authorization", authHeader)
    .field("quantity", String(fields.quantity ?? 2))
    .field("unitPrice", String(fields.unitPrice ?? 150_000));
  if (fields.variantLabel) req.field("variantLabel", fields.variantLabel);
  return attachPhoto(req);
}

describe("Package creation", () => {
  it("creates a draft package with a human-friendly package number and an initial 'created' event", async () => {
    const { res, authHeader } = await createDraftAsUser();

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.packageNumber).toMatch(/^PKG-\d{8}-\d{4}$/);
    expect(res.body.data.status).toBe("draft");

    const packageId = res.body.data.id;
    const eventsRes = await request(app).get(`/api/packages/${packageId}/events`).set("Authorization", authHeader);
    expect(eventsRes.status).toBe(200);
    expect(eventsRes.body.data).toHaveLength(1);
    expect(eventsRes.body.data[0].type).toBe("created");
  });

  it("rejects unauthenticated requests", async () => {
    const res = await request(app).post("/api/packages").send({});
    expect(res.status).toBe(401);
  });

  it("rejects requests from a role without the purchasing permission", async () => {
    const { authHeader } = await createAuthenticatedUser(StaffRole.CUSTOMER_SERVICE);
    const res = await request(app).post("/api/packages").set("Authorization", authHeader).send({});
    expect(res.status).toBe(403);
  });

  it("resolves (and creates) the single shared open draft via /open-draft", async () => {
    const { authHeader } = await createAuthenticatedUser(StaffRole.PURCHASING);
    const first = await request(app).get("/api/packages/open-draft").set("Authorization", authHeader);
    const second = await request(app).get("/api/packages/open-draft").set("Authorization", authHeader);
    expect(first.status).toBe(200);
    expect(second.body.data.id).toBe(first.body.data.id);
  });

  it("lists and filters packages by status", async () => {
    const { authHeader } = await createDraftAsUser();
    const listRes = await request(app)
      .get("/api/packages")
      .query({ status: "draft" })
      .set("Authorization", authHeader);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBeGreaterThan(0);
    expect(listRes.body.data.every((p: { status: string }) => p.status === "draft")).toBe(true);
    expect(listRes.body.meta).toMatchObject({ page: 1, pageSize: 20 });
  });
});

describe("Receiving items into a package (purchasing side)", () => {
  it("requires a photo to add an item", async () => {
    const { res, authHeader } = await createDraftAsUser();
    const packageId = res.body.data.id;
    const noPhotoRes = await request(app)
      .post(`/api/packages/${packageId}/items`)
      .set("Authorization", authHeader)
      .field("quantity", "1")
      .field("unitPrice", "100000");
    expect(noPhotoRes.status).toBe(400);
  });

  it("adds an item with a photo, storing it as a package-scoped attachment", async () => {
    const { res, authHeader } = await createDraftAsUser();
    const packageId = res.body.data.id;

    const itemRes = await receiveItem(authHeader, packageId);
    expect(itemRes.status).toBe(201);
    expect(itemRes.body.data.items).toHaveLength(1);
    const item = itemRes.body.data.items[0];
    expect(item.quantity).toBe(2);
    expect(item.unitPrice).toBe(150_000);
    expect(item.photoAttachmentId).toBeTruthy();

    const attachmentsRes = await request(app)
      .get(`/api/packages/${packageId}/attachments`)
      .set("Authorization", authHeader);
    expect(attachmentsRes.body.data).toHaveLength(1);
    expect(attachmentsRes.body.data[0].subjectType).toBe("package");
    expect(attachmentsRes.body.data[0].subjectId).toBe(packageId);
  });

  it("supports a variant label so e.g. ring/bangle sizes are logged as separate item rows", async () => {
    const { res, authHeader } = await createDraftAsUser();
    const packageId = res.body.data.id;
    const itemRes = await receiveItem(authHeader, packageId, { variantLabel: "Size 7" });
    expect(itemRes.body.data.items[0].variantLabel).toBe("Size 7");
  });

  it("rejects editing or removing an item once the package has left draft", async () => {
    const { res, authHeader } = await createDraftAsUser();
    const packageId = res.body.data.id;
    const itemRes = await receiveItem(authHeader, packageId);
    const itemId = itemRes.body.data.items[0].id;

    await request(app)
      .post(`/api/packages/${packageId}/status`)
      .set("Authorization", authHeader)
      .send({ status: "in_progress" });

    const updateRes = await request(app)
      .patch(`/api/packages/${packageId}/items/${itemId}`)
      .set("Authorization", authHeader)
      .send({ quantity: 5 });
    expect(updateRes.status).toBe(409);

    const addMoreRes = await request(app)
      .post(`/api/packages/${packageId}/items`)
      .set("Authorization", authHeader)
      .field("quantity", "1")
      .field("unitPrice", "1")
      .attach("photo", Buffer.from("x"), { filename: "x.jpg", contentType: "image/jpeg" });
    expect(addMoreRes.status).toBe(409);
  });
});

describe("Package status lifecycle (draft -> in_progress -> completed)", () => {
  it("moves draft to in_progress ('handed to the shipping company')", async () => {
    const { res, authHeader } = await createDraftAsUser();
    const packageId = res.body.data.id;
    const statusRes = await request(app)
      .post(`/api/packages/${packageId}/status`)
      .set("Authorization", authHeader)
      .send({ status: "in_progress" });
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.data.status).toBe("in_progress");
  });

  it("rejects an illegal direct jump from draft to completed", async () => {
    const { res, authHeader } = await createDraftAsUser();
    const packageId = res.body.data.id;
    const res2 = await request(app)
      .post(`/api/packages/${packageId}/status`)
      .set("Authorization", authHeader)
      .send({ status: "completed" });
    expect(res2.status).toBe(400);
  });

  it("rejects marking a package completed through the purchasing status endpoint even from in_progress", async () => {
    const { res, authHeader } = await createDraftAsUser();
    const packageId = res.body.data.id;
    await request(app).post(`/api/packages/${packageId}/status`).set("Authorization", authHeader).send({ status: "in_progress" });
    const res2 = await request(app)
      .post(`/api/packages/${packageId}/status`)
      .set("Authorization", authHeader)
      .send({ status: "completed" });
    expect(res2.status).toBe(400);
  });
});

describe("Match & Register (available at any package stage)", () => {
  it("previews a Shopfa code lookup without persisting anything", async () => {
    const { res, authHeader } = await createDraftAsUser();
    const packageId = res.body.data.id;
    const itemRes = await receiveItem(authHeader, packageId);
    const itemId = itemRes.body.data.items[0].id;

    const previewRes = await request(app)
      .post(`/api/packages/${packageId}/items/${itemId}/match/preview`)
      .set("Authorization", authHeader)
      .send({ productCode: "SHF-1000" });
    expect(previewRes.status).toBe(200);
    expect(previewRes.body.data.title).toBeTruthy();
    expect(previewRes.body.data.titleEndsWithAsterisk).toBe(false);
    expect(typeof previewRes.body.data.availableQuantity).toBe("number");

    const packageAfterPreview = await request(app).get(`/api/packages/${packageId}`).set("Authorization", authHeader);
    expect(packageAfterPreview.body.data.items[0].matchedAt).toBeNull();
  });

  it("detects a Shopfa title ending in '*'", async () => {
    const { res, authHeader } = await createDraftAsUser();
    const packageId = res.body.data.id;
    const itemRes = await receiveItem(authHeader, packageId);
    const itemId = itemRes.body.data.items[0].id;

    const previewRes = await request(app)
      .post(`/api/packages/${packageId}/items/${itemId}/match/preview`)
      .set("Authorization", authHeader)
      .send({ productCode: "SHF-STAR" });
    expect(previewRes.body.data.titleEndsWithAsterisk).toBe(true);
  });

  it("rejects previewing or confirming an unknown Shopfa product code", async () => {
    const { res, authHeader } = await createDraftAsUser();
    const packageId = res.body.data.id;
    const itemRes = await receiveItem(authHeader, packageId);
    const itemId = itemRes.body.data.items[0].id;

    const previewRes = await request(app)
      .post(`/api/packages/${packageId}/items/${itemId}/match/preview`)
      .set("Authorization", authHeader)
      .send({ productCode: "does-not-exist" });
    expect(previewRes.status).toBe(404);
  });

  it("confirms a match while still draft, recording the match and flagging it pending an inventory decision", async () => {
    const { res, authHeader } = await createDraftAsUser();
    const packageId = res.body.data.id;
    const itemRes = await receiveItem(authHeader, packageId);
    const itemId = itemRes.body.data.items[0].id;

    const matchRes = await request(app)
      .post(`/api/packages/${packageId}/items/${itemId}/match`)
      .set("Authorization", authHeader)
      .send({ productCode: "SHF-1000" });
    expect(matchRes.status).toBe(200);
    const item = matchRes.body.data.items[0];
    expect(item.productCode).toBe("SHF-1000");
    expect(item.matchedAt).toBeTruthy();
    expect(item.inventoryPending).toBe(true);
    // No stock is written anywhere yet -- the Inventory module (not built) owns that decision.
    expect(item.titleEndsWithAsterisk).toBe(false);
    // Shopfa's quantity at match time is captured so the UI can suggest the post-purchase count.
    expect(typeof item.matchedAvailableQuantity).toBe("number");
  });

  it("clears matchedAvailableQuantity on unmatch", async () => {
    const { res, authHeader } = await createDraftAsUser();
    const packageId = res.body.data.id;
    const itemRes = await receiveItem(authHeader, packageId);
    const itemId = itemRes.body.data.items[0].id;

    await request(app)
      .post(`/api/packages/${packageId}/items/${itemId}/match`)
      .set("Authorization", authHeader)
      .send({ productCode: "SHF-1000" });

    const unmatchRes = await request(app)
      .post(`/api/packages/${packageId}/items/${itemId}/unmatch`)
      .set("Authorization", authHeader);
    expect(unmatchRes.body.data.items[0].matchedAvailableQuantity).toBeNull();
  });

  it("still allows matching after the package has moved to in_progress or completed", async () => {
    const { res, authHeader } = await createDraftAsUser();
    const packageId = res.body.data.id;
    const itemRes = await receiveItem(authHeader, packageId);
    const itemId = itemRes.body.data.items[0].id;

    await request(app).post(`/api/packages/${packageId}/status`).set("Authorization", authHeader).send({ status: "in_progress" });
    const matchRes = await request(app)
      .post(`/api/packages/${packageId}/items/${itemId}/match`)
      .set("Authorization", authHeader)
      .send({ productCode: "SHF-1001" });
    expect(matchRes.status).toBe(200);

    const unmatchRes = await request(app)
      .post(`/api/packages/${packageId}/items/${itemId}/unmatch`)
      .set("Authorization", authHeader);
    expect(unmatchRes.status).toBe(200);
    expect(unmatchRes.body.data.items[0].matchedAt).toBeNull();
    expect(unmatchRes.body.data.items[0].inventoryPending).toBe(false);
  });
});
