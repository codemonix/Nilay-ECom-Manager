import { describe, expect, it } from "vitest";
import request from "supertest";
import { StaffRole } from "@complaint-system/shared";
import { createApp } from "../src/app";
import { createAuthenticatedUser } from "./testUtils";

const app = createApp();

/** Draft -> receive one item -> hand to shipping (in_progress), as the purchasing side would. */
async function createInProgressPackage() {
  const { authHeader: purchasingAuthHeader } = await createAuthenticatedUser(StaffRole.PURCHASING);
  const draftRes = await request(app).post("/api/packages").set("Authorization", purchasingAuthHeader).send({});
  const packageId = draftRes.body.data.id;
  const itemRes = await request(app)
    .post(`/api/packages/${packageId}/items`)
    .set("Authorization", purchasingAuthHeader)
    .field("quantity", "5")
    .field("unitPrice", "200000")
    .attach("photo", Buffer.from("fake-image-bytes"), { filename: "item.jpg", contentType: "image/jpeg" });
  const itemId = itemRes.body.data.items[0].id;
  await request(app)
    .post(`/api/packages/${packageId}/status`)
    .set("Authorization", purchasingAuthHeader)
    .send({ status: "in_progress" });
  return { packageId, itemId };
}

describe("Receiving module (destination-side confirmation)", () => {
  it("rejects requests from a role without the receiving permission", async () => {
    const { packageId } = await createInProgressPackage();
    const { authHeader: purchasingAuthHeader } = await createAuthenticatedUser(StaffRole.PURCHASING);
    const res = await request(app).get(`/api/receiving/${packageId}`).set("Authorization", purchasingAuthHeader);
    expect(res.status).toBe(403);
  });

  it("lists packages awaiting receipt for a warehouse (receiving) user", async () => {
    const { packageId } = await createInProgressPackage();
    const { authHeader } = await createAuthenticatedUser(StaffRole.WAREHOUSE);
    const res = await request(app).get("/api/receiving").query({ status: "in_progress" }).set("Authorization", authHeader);
    expect(res.status).toBe(200);
    expect(res.body.data.some((p: { id: string }) => p.id === packageId)).toBe(true);
  });

  it("records an itemized received quantity distinct from the originally purchased quantity", async () => {
    const { packageId, itemId } = await createInProgressPackage();
    const { authHeader } = await createAuthenticatedUser(StaffRole.WAREHOUSE);

    const res = await request(app)
      .patch(`/api/receiving/${packageId}/items/${itemId}/received-quantity`)
      .set("Authorization", authHeader)
      .send({ receivedQuantity: 3 });
    expect(res.status).toBe(200);
    const item = res.body.data.items.find((i: { id: string }) => i.id === itemId);
    expect(item.receivedQuantity).toBe(3);
    expect(item.quantity).toBe(5); // untouched
  });

  it("rejects recording a received quantity before the package has been handed to shipping", async () => {
    const { authHeader: purchasingAuthHeader } = await createAuthenticatedUser(StaffRole.PURCHASING);
    const draftRes = await request(app).post("/api/packages").set("Authorization", purchasingAuthHeader).send({});
    const packageId = draftRes.body.data.id;
    const itemRes = await request(app)
      .post(`/api/packages/${packageId}/items`)
      .set("Authorization", purchasingAuthHeader)
      .field("quantity", "1")
      .field("unitPrice", "1")
      .attach("photo", Buffer.from("x"), { filename: "x.jpg", contentType: "image/jpeg" });
    const itemId = itemRes.body.data.items[0].id;

    const { authHeader } = await createAuthenticatedUser(StaffRole.WAREHOUSE);
    const res = await request(app)
      .patch(`/api/receiving/${packageId}/items/${itemId}/received-quantity`)
      .set("Authorization", authHeader)
      .send({ receivedQuantity: 1 });
    expect(res.status).toBe(409);
  });

  it("confirms receipt, filling in any uncounted items to their expected quantity, and completes the package", async () => {
    const { packageId } = await createInProgressPackage();
    const { user, authHeader } = await createAuthenticatedUser(StaffRole.WAREHOUSE);

    const confirmRes = await request(app)
      .post(`/api/receiving/${packageId}/confirm-received`)
      .set("Authorization", authHeader)
      .send({ markAllComplete: true });
    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.data.status).toBe("completed");
    expect(confirmRes.body.data.receivedBy).toEqual({ id: String(user._id), name: user.name });
    expect(confirmRes.body.data.items[0].receivedQuantity).toBe(5);

    const eventsRes = await request(app).get(`/api/receiving/${packageId}/events`).set("Authorization", authHeader);
    const lastEvent = eventsRes.body.data.at(-1);
    expect(lastEvent.type).toBe("status_changed");
    expect(lastEvent.data).toEqual({ from: "in_progress", to: "completed" });
  });

  it("respects an itemized count entered before the bulk confirm", async () => {
    const { packageId, itemId } = await createInProgressPackage();
    const { authHeader } = await createAuthenticatedUser(StaffRole.WAREHOUSE);

    await request(app)
      .patch(`/api/receiving/${packageId}/items/${itemId}/received-quantity`)
      .set("Authorization", authHeader)
      .send({ receivedQuantity: 4 }); // one short of the purchased 5

    const confirmRes = await request(app)
      .post(`/api/receiving/${packageId}/confirm-received`)
      .set("Authorization", authHeader)
      .send({ markAllComplete: true });
    expect(confirmRes.body.data.items[0].receivedQuantity).toBe(4);
  });

  it("rejects confirming a package that is not awaiting receipt", async () => {
    const { authHeader: purchasingAuthHeader } = await createAuthenticatedUser(StaffRole.PURCHASING);
    const draftRes = await request(app).post("/api/packages").set("Authorization", purchasingAuthHeader).send({});
    const packageId = draftRes.body.data.id;

    const { authHeader } = await createAuthenticatedUser(StaffRole.WAREHOUSE);
    const res = await request(app)
      .post(`/api/receiving/${packageId}/confirm-received`)
      .set("Authorization", authHeader)
      .send({});
    expect(res.status).toBe(409);
  });
});
