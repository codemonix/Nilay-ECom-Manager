import { describe, expect, it } from "vitest";
import request from "supertest";
import { StaffRole } from "@complaint-system/shared";
import { createApp } from "../src/app";
import { createAuthenticatedUser } from "./testUtils";

const app = createApp();

describe("Shopfa product search (Match & Register's 'search by name' flow)", () => {
  it("rejects requests from a role without the purchasing permission", async () => {
    const { authHeader } = await createAuthenticatedUser(StaffRole.CUSTOMER_SERVICE);
    const res = await request(app).get("/api/shopfa/products/search").query({ q: "gold" }).set("Authorization", authHeader);
    expect(res.status).toBe(403);
  });

  it("rejects a too-short query", async () => {
    const { authHeader } = await createAuthenticatedUser(StaffRole.PURCHASING);
    const res = await request(app).get("/api/shopfa/products/search").query({ q: "a" }).set("Authorization", authHeader);
    expect(res.status).toBe(422);
  });

  it("returns matching products with image, price, and available quantity", async () => {
    const { authHeader } = await createAuthenticatedUser(StaffRole.PURCHASING);
    const res = await request(app).get("/api/shopfa/products/search").query({ q: "Gold" }).set("Authorization", authHeader);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    const first = res.body.data[0];
    expect(first).toMatchObject({
      productCode: expect.any(String),
      title: expect.stringContaining("Gold"),
    });
    expect(typeof first.availableQuantity).toBe("number");
  });

  it("returns an empty list for a query with no matches", async () => {
    const { authHeader } = await createAuthenticatedUser(StaffRole.PURCHASING);
    const res = await request(app)
      .get("/api/shopfa/products/search")
      .query({ q: "zzzzzzznomatch" })
      .set("Authorization", authHeader);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});
