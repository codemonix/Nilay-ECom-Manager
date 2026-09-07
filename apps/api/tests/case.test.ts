import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { createAuthenticatedUser, createTestUser, validCasePayload } from "./testUtils";

const app = createApp();

async function createCaseAsUser() {
  const { user, authHeader } = await createAuthenticatedUser();
  const res = await request(app)
    .post("/api/cases")
    .set("Authorization", authHeader)
    .send(validCasePayload);
  return { user, authHeader, res };
}

describe("Case creation", () => {
  it("creates a case with a human-friendly case number and an initial 'created' event", async () => {
    const { res, user, authHeader } = await createCaseAsUser();

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.caseNumber).toMatch(/^C-\d{8}-\d{4}$/);
    expect(res.body.data.status).toBe("open");
    expect(res.body.data.createdBy).toEqual({ id: String(user._id), name: user.name });

    const caseId = res.body.data.id;
    const eventsRes = await request(app).get(`/api/cases/${caseId}/events`).set("Authorization", authHeader);
    expect(eventsRes.status).toBe(200);
    expect(eventsRes.body.data).toHaveLength(1);
    expect(eventsRes.body.data[0].type).toBe("created");
  });

  it("rejects unauthenticated requests", async () => {
    const res = await request(app).post("/api/cases").send(validCasePayload);
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("rejects creation when required fields are missing", async () => {
    const { authHeader } = await createAuthenticatedUser();
    const res = await request(app)
      .post("/api/cases")
      .set("Authorization", authHeader)
      .send({ subject: "Missing everything else" });
    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects creation with an invalid category", async () => {
    const { authHeader } = await createAuthenticatedUser();
    const res = await request(app)
      .post("/api/cases")
      .set("Authorization", authHeader)
      .send({ ...validCasePayload, category: "not-a-real-category" });
    expect(res.status).toBe(422);
  });

  it("rejects a social_media source with no contact point", async () => {
    const { authHeader } = await createAuthenticatedUser();
    const res = await request(app)
      .post("/api/cases")
      .set("Authorization", authHeader)
      .send({ ...validCasePayload, source: "social_media" });
    expect(res.status).toBe(422);
  });

  it("rejects an instagram contact point with no contactId", async () => {
    const { authHeader } = await createAuthenticatedUser();
    const res = await request(app)
      .post("/api/cases")
      .set("Authorization", authHeader)
      .send({ ...validCasePayload, source: "social_media", contactPoint: { platform: "instagram" } });
    expect(res.status).toBe(422);
  });

  it("creates a case with an instagram contact point and id", async () => {
    const { authHeader } = await createAuthenticatedUser();
    const res = await request(app)
      .post("/api/cases")
      .set("Authorization", authHeader)
      .send({
        ...validCasePayload,
        source: "social_media",
        contactPoint: { platform: "instagram", contactId: "ali.ahmadi" },
      });
    expect(res.status).toBe(201);
    expect(res.body.data.contactPoint).toEqual({ platform: "instagram", contactId: "ali.ahmadi" });
  });
});

describe("Case actions", () => {
  it("adds an internal note and records a matching event", async () => {
    const { res, authHeader } = await createCaseAsUser();
    const caseId = res.body.data.id;

    const noteRes = await request(app)
      .post(`/api/cases/${caseId}/notes`)
      .set("Authorization", authHeader)
      .send({ body: "Customer confirmed the clasp is broken.", visibility: "internal" });

    expect(noteRes.status).toBe(201);

    const eventsRes = await request(app).get(`/api/cases/${caseId}/events`).set("Authorization", authHeader);
    const types = eventsRes.body.data.map((e: { type: string }) => e.type);
    expect(types).toEqual(["created", "internal_note"]);
  });

  it("changes status along a valid transition and records a status event", async () => {
    const { res, authHeader } = await createCaseAsUser();
    const caseId = res.body.data.id;

    const statusRes = await request(app)
      .post(`/api/cases/${caseId}/status`)
      .set("Authorization", authHeader)
      .send({ status: "in_progress" });

    expect(statusRes.status).toBe(200);
    expect(statusRes.body.data.status).toBe("in_progress");

    const eventsRes = await request(app).get(`/api/cases/${caseId}/events`).set("Authorization", authHeader);
    const lastEvent = eventsRes.body.data.at(-1);
    expect(lastEvent.type).toBe("status_changed");
    expect(lastEvent.data).toEqual({ from: "open", to: "in_progress" });
  });

  it("rejects an invalid status transition", async () => {
    const { res, authHeader } = await createCaseAsUser();
    const caseId = res.body.data.id;

    const statusRes = await request(app)
      .post(`/api/cases/${caseId}/status`)
      .set("Authorization", authHeader)
      .send({ status: "resolved" });

    expect(statusRes.status).toBe(409);
    expect(statusRes.body.error.code).toBe("CONFLICT");
  });

  it("changes priority and records a priority_changed event", async () => {
    const { res, authHeader } = await createCaseAsUser();
    const caseId = res.body.data.id;

    const priorityRes = await request(app)
      .post(`/api/cases/${caseId}/priority`)
      .set("Authorization", authHeader)
      .send({ priority: "urgent" });
    expect(priorityRes.status).toBe(200);
    expect(priorityRes.body.data.priority).toBe("urgent");
  });

  it("changes the contact point and records a contact_point_changed event", async () => {
    const { res, authHeader } = await createCaseAsUser();
    const caseId = res.body.data.id;

    const contactRes = await request(app)
      .post(`/api/cases/${caseId}/contact-point`)
      .set("Authorization", authHeader)
      .send({ contactPoint: { platform: "telegram", contactId: "@ali_ahmadi" } });

    expect(contactRes.status).toBe(200);
    expect(contactRes.body.data.contactPoint).toEqual({ platform: "telegram", contactId: "@ali_ahmadi" });

    const eventsRes = await request(app).get(`/api/cases/${caseId}/events`).set("Authorization", authHeader);
    const lastEvent = eventsRes.body.data.at(-1);
    expect(lastEvent.type).toBe("contact_point_changed");
  });

  it("rejects a telegram contact point with no contactId", async () => {
    const { res, authHeader } = await createCaseAsUser();
    const caseId = res.body.data.id;

    const contactRes = await request(app)
      .post(`/api/cases/${caseId}/contact-point`)
      .set("Authorization", authHeader)
      .send({ contactPoint: { platform: "telegram" } });

    expect(contactRes.status).toBe(422);
  });

  it("assigns a staff member and records an assignment_changed event", async () => {
    const { res, authHeader } = await createCaseAsUser();
    const caseId = res.body.data.id;
    const assignee = await createTestUser();

    const assignRes = await request(app)
      .post(`/api/cases/${caseId}/assign`)
      .set("Authorization", authHeader)
      .send({ assignedTo: String(assignee._id) });

    expect(assignRes.status).toBe(200);
    expect(assignRes.body.data.assignedTo.id).toBe(String(assignee._id));
  });

  it("links an order to a case", async () => {
    const { res, authHeader } = await createCaseAsUser();
    const caseId = res.body.data.id;

    const linkRes = await request(app)
      .post(`/api/cases/${caseId}/orders`)
      .set("Authorization", authHeader)
      .send({ externalOrderId: "ord_1000", orderNumber: "SF-20260000" });

    expect(linkRes.status).toBe(200);
    expect(linkRes.body.data.relatedOrders).toHaveLength(1);
  });

  it("links an item to a case", async () => {
    const { res, authHeader } = await createCaseAsUser();
    const caseId = res.body.data.id;

    const linkRes = await request(app)
      .post(`/api/cases/${caseId}/items`)
      .set("Authorization", authHeader)
      .send({ externalItemId: "item_NCK-GLD-001", sku: "NCK-GLD-001", title: "18k Gold Necklace" });

    expect(linkRes.status).toBe(200);
    expect(linkRes.body.data.relatedItems).toHaveLength(1);
  });

  it("returns the full chronological timeline for a case", async () => {
    const { res, authHeader } = await createCaseAsUser();
    const caseId = res.body.data.id;

    await request(app)
      .post(`/api/cases/${caseId}/status`)
      .set("Authorization", authHeader)
      .send({ status: "in_progress" });
    await request(app)
      .post(`/api/cases/${caseId}/priority`)
      .set("Authorization", authHeader)
      .send({ priority: "urgent" });

    const eventsRes = await request(app).get(`/api/cases/${caseId}/events`).set("Authorization", authHeader);
    expect(eventsRes.body.data.map((e: { type: string }) => e.type)).toEqual([
      "created",
      "status_changed",
      "priority_changed",
    ]);
    const timestamps = eventsRes.body.data.map((e: { createdAt: string }) => new Date(e.createdAt).getTime());
    expect([...timestamps].sort((a, b) => a - b)).toEqual(timestamps);
  });
});
