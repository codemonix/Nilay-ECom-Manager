import { describe, expect, it } from "vitest";
import request from "supertest";
import { StaffRole } from "@complaint-system/shared";
import { createApp } from "../src/app";
import { createAuthenticatedUser } from "./testUtils";

const app = createApp();

describe("GET /api/version", () => {
  it("requires authentication", async () => {
    const res = await request(app).get("/api/version");
    expect(res.status).toBe(401);
  });

  it("reports the git-derived version to any signed-in user", async () => {
    const { token } = await createAuthenticatedUser(StaffRole.CUSTOMER_SERVICE);
    const res = await request(app).get("/api/version").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(res.body.data.commit).toMatch(/^[0-9a-f]{7,}$/);

    const health = await request(app).get("/api/health");
    expect(health.body.data.version).toBe(res.body.data.version);
  });
});
