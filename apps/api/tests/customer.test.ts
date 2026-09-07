import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";

const app = createApp();

describe("Customer summary (Shopfa mock integration)", () => {
  it("returns a customer's order count and total spent", async () => {
    const res = await request(app).get("/api/customers/cust_1004/summary");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.externalCustomerId).toBe("cust_1004");
    expect(res.body.data.ordersCount).toBeGreaterThan(0);
    expect(res.body.data.totalSpent).toBeGreaterThan(0);
    expect(res.body.data.averageOrderValue).toBeGreaterThan(0);
  });

  it("returns 404 for an unknown customer", async () => {
    const res = await request(app).get("/api/customers/does-not-exist/summary");
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it("searches customers by name", async () => {
    const res = await request(app).get("/api/customers/search").query({ q: "Ahmadi" });
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].name).toContain("Ahmadi");
  });
});
