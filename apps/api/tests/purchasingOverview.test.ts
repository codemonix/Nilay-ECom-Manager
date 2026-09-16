import { describe, expect, it } from "vitest";
import request from "supertest";
import { StaffRole } from "@complaint-system/shared";
import { createApp } from "../src/app";
import { createAuthenticatedUser } from "./testUtils";

const app = createApp();

describe("Purchasing overview", () => {
  it("aggregates package counts by status and pending-work totals", async () => {
    const { authHeader } = await createAuthenticatedUser(StaffRole.PURCHASING);

    const draftRes = await request(app).post("/api/packages").set("Authorization", authHeader).send({});
    const packageId = draftRes.body.data.id;
    await request(app)
      .post(`/api/packages/${packageId}/items`)
      .set("Authorization", authHeader)
      .field("quantity", "1")
      .field("unitPrice", "100000")
      .attach("photo", Buffer.from("fake-image-bytes"), { filename: "item.jpg", contentType: "image/jpeg" });

    const overviewRes = await request(app).get("/api/purchasing/overview").set("Authorization", authHeader);
    expect(overviewRes.status).toBe(200);
    expect(overviewRes.body.data.countsByStatus.draft).toBeGreaterThanOrEqual(1);
    expect(overviewRes.body.data.itemsPendingMatch).toBeGreaterThanOrEqual(1);
    expect(overviewRes.body.data.itemsPendingInventoryDecision).toBe(0);
    expect(Array.isArray(overviewRes.body.data.recentEvents)).toBe(true);
  });

  it("rejects requests from a role without the purchasing permission", async () => {
    const { authHeader } = await createAuthenticatedUser(StaffRole.CUSTOMER_SERVICE);
    const res = await request(app).get("/api/purchasing/overview").set("Authorization", authHeader);
    expect(res.status).toBe(403);
  });
});
