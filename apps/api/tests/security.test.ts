import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";
import { describe, expect, it } from "vitest";
import request from "supertest";
import { SecurityEventType, SecuritySeverity, StaffRole } from "@complaint-system/shared";
import { createApp } from "../src/app";
import { UPLOAD_ROOT } from "../src/middleware/upload";
import { SecurityEventModel } from "../src/models/SecurityEvent";
import { LOGIN_THROTTLE_LIMITS } from "../src/services/loginThrottle";
import { SECURITY_REPORT_THRESHOLDS } from "../src/services/securityEventService";
import { createAuthenticatedUser, createTestUser } from "./testUtils";

const app = createApp();

/** Security events are recorded fire-and-forget, so give the insert a moment to land. */
async function waitForEvents(filter: Record<string, unknown>, count = 1) {
  for (let i = 0; i < 50; i += 1) {
    const events = await SecurityEventModel.find(filter).lean();
    if (events.length >= count) return events;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`Timed out waiting for ${count} security event(s) matching ${JSON.stringify(filter)}`);
}


describe("backup/restore endpoints", () => {
  it("are admin-only even for staff granted the Settings menu", async () => {
    const manager = await createAuthenticatedUser(StaffRole.MANAGER);
    for (const [method, url] of [
      ["get", "/api/settings/data-backup"],
      ["post", "/api/settings/data-restore"],
      ["get", "/api/settings/backup"],
      ["post", "/api/settings/restore"],
    ] as const) {
      const res = await request(app)[method](url).set("Authorization", manager.authHeader).send({});
      expect(res.status, url).toBe(403);
    }
    await waitForEvents({ type: SecurityEventType.ACCESS_DENIED, userId: manager.user._id }, 4);

    const admin = await createAuthenticatedUser(StaffRole.ADMIN);
    const res = await request(app).get("/api/settings/data-backup").set("Authorization", admin.authHeader);
    expect(res.status).toBe(200);
    const [event] = await waitForEvents({ type: SecurityEventType.DATA_BACKUP_DOWNLOADED });
    expect(event!.severity).toBe(SecuritySeverity.HIGH);
    expect(String(event!.userId)).toBe(String(admin.user._id));
  });
});

describe("uploads", () => {
  it("stores a file under the extension of its validated type, not the client's filename", async () => {
    const { authHeader } = await createAuthenticatedUser(StaffRole.PURCHASING);
    const draft = await request(app).post("/api/packages").set("Authorization", authHeader).send({});
    const res = await request(app)
      .post(`/api/packages/${draft.body.data.id}/attachments`)
      .set("Authorization", authHeader)
      .attach("file", Buffer.from("<script>alert(1)</script>"), { filename: "evil.html", contentType: "image/png" });
    expect(res.status).toBe(201);
    expect(res.body.data.storedFilename).toMatch(/\.png$/);
    fs.unlinkSync(path.join(UPLOAD_ROOT, res.body.data.storedFilename));
  });

  it("forces a download for stored files that aren't images or PDFs", async () => {
    const filename = `security-test-${Date.now()}.html`;
    fs.writeFileSync(path.join(UPLOAD_ROOT, filename), "<script>alert(1)</script>");
    try {
      const html = await request(app).get(`/uploads/${filename}`);
      expect(html.headers["content-disposition"]).toBe("attachment");
    } finally {
      fs.unlinkSync(path.join(UPLOAD_ROOT, filename));
    }
  });
});

describe("login throttling and failure logging", () => {
  it("records each failed login with its reason, without revealing it to the client", async () => {
    const user = await createTestUser(StaffRole.WAREHOUSE);
    const wrong = await request(app).post("/api/auth/login").send({ email: user.email, password: "wrong-password" });
    const unknown = await request(app).post("/api/auth/login").send({ email: "ghost@example.com", password: "x" });
    expect(wrong.body.error.message).toBe(unknown.body.error.message);

    const events = await waitForEvents({ type: SecurityEventType.LOGIN_FAILED }, 2);
    const reasons = events.map((e) => (e.details as { reason: string }).reason).sort();
    expect(reasons).toEqual(["unknown_account", "wrong_password"]);
    expect(events.find((e) => e.targetEmail === user.email)).toBeTruthy();
  });

  it("blocks an account after repeated failures from one IP, even with the right password", async () => {
    const user = await createTestUser(StaffRole.WAREHOUSE);
    for (let i = 0; i < LOGIN_THROTTLE_LIMITS.perAccount; i += 1) {
      await request(app).post("/api/auth/login").send({ email: user.email, password: "wrong-password" }).expect(401);
    }
    const res = await request(app).post("/api/auth/login").send({ email: user.email, password: "Passw0rd!" });
    expect(res.status).toBe(429);
    expect(Number(res.headers["retry-after"])).toBeGreaterThan(0);
    await waitForEvents({ type: SecurityEventType.LOGIN_THROTTLED, targetEmail: user.email });
  });

  it("blocks an IP that fails against many accounts", async () => {
    for (let i = 0; i < LOGIN_THROTTLE_LIMITS.perIp; i += 1) {
      await request(app).post("/api/auth/login").send({ email: `victim${i}@example.com`, password: "x" }).expect(401);
    }
    const res = await request(app).post("/api/auth/login").send({ email: "another@example.com", password: "x" });
    expect(res.status).toBe(429);
  });

  it("a successful login clears that account's failure count", async () => {
    const user = await createTestUser(StaffRole.WAREHOUSE);
    for (let round = 0; round < 2; round += 1) {
      for (let i = 0; i < LOGIN_THROTTLE_LIMITS.perAccount - 1; i += 1) {
        await request(app).post("/api/auth/login").send({ email: user.email, password: "wrong" }).expect(401);
      }
      await request(app).post("/api/auth/login").send({ email: user.email, password: "Passw0rd!" }).expect(200);
    }
  });
});

describe("token and permission events", () => {
  it("records a forged access token but not an expired one", async () => {
    const user = await createTestUser(StaffRole.ADMIN);
    const forged = jwt.sign({ sub: String(user._id), role: "admin" }, "not-the-real-secret");
    await request(app).get("/api/auth/me").set("Authorization", `Bearer ${forged}`).expect(401);
    const [event] = await waitForEvents({ type: SecurityEventType.INVALID_ACCESS_TOKEN });
    expect((event!.details as { reason: string }).reason).toMatch(/signature/);

    const expired = jwt.sign({ sub: String(user._id), role: "admin", exp: Math.floor(Date.now() / 1000) - 60 }, process.env.JWT_SECRET!);
    await request(app).get("/api/auth/me").set("Authorization", `Bearer ${expired}`).expect(401);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(await SecurityEventModel.countDocuments({ type: SecurityEventType.INVALID_ACCESS_TOKEN })).toBe(1);
  });

  it("records admin user changes with the actor and the target", async () => {
    const admin = await createAuthenticatedUser(StaffRole.ADMIN);
    const target = await createTestUser(StaffRole.WAREHOUSE);
    await request(app)
      .patch(`/api/users/${target._id}`)
      .set("Authorization", admin.authHeader)
      .send({ role: StaffRole.ADMIN })
      .expect(200);
    const [event] = await waitForEvents({ type: SecurityEventType.USER_UPDATED });
    expect(String(event!.userId)).toBe(String(admin.user._id));
    expect(event!.targetEmail).toBe(target.email);
    expect(event!.details).toMatchObject({ changes: { role: StaffRole.ADMIN } });
  });
});

describe("security report", () => {
  it("is available only with the Logs permission", async () => {
    const warehouse = await createAuthenticatedUser(StaffRole.WAREHOUSE);
    await request(app).get("/api/logs/security/report").set("Authorization", warehouse.authHeader).expect(403);
    await request(app).get("/api/logs/security").set("Authorization", warehouse.authHeader).expect(403);
  });

  it("flags brute force, credential stuffing, targeted accounts and privilege probing", async () => {
    const now = new Date();
    const failedLogin = (ip: string, email: string) => ({
      type: SecurityEventType.LOGIN_FAILED,
      severity: SecuritySeverity.MEDIUM,
      ip,
      targetEmail: email,
      createdAt: now,
    });
    const prober = await createTestUser(StaffRole.WAREHOUSE);
    await SecurityEventModel.insertMany([
      ...Array.from({ length: SECURITY_REPORT_THRESHOLDS.bruteForce }, () => failedLogin("10.0.0.1", "boss@example.com")),
      ...Array.from({ length: SECURITY_REPORT_THRESHOLDS.credentialStuffing }, (_, i) => failedLogin("10.0.0.2", `u${i}@example.com`)),
      failedLogin("10.0.0.3", "u0@example.com"),
      ...Array.from({ length: SECURITY_REPORT_THRESHOLDS.privilegeProbing }, () => ({
        type: SecurityEventType.ACCESS_DENIED,
        severity: SecuritySeverity.MEDIUM,
        userId: prober._id,
        userName: prober.name,
        ip: "10.0.0.4",
        createdAt: now,
      })),
    ]);

    const admin = await createAuthenticatedUser(StaffRole.ADMIN);
    const res = await request(app).get("/api/logs/security/report").set("Authorization", admin.authHeader).expect(200);
    const report = res.body.data;
    const flags = report.flags.map((f: { reason: string; subject: string }) => `${f.reason}:${f.subject}`);
    expect(flags).toEqual(
      expect.arrayContaining([
        "brute_force:10.0.0.1",
        "credential_stuffing:10.0.0.2",
        "targeted_account:boss@example.com",
        `privilege_probing:${prober.name}`,
      ]),
    );
    expect(flags).not.toContain("brute_force:10.0.0.3");
    expect(report.topIps[0]).toMatchObject({ ip: "10.0.0.1", failedLogins: SECURITY_REPORT_THRESHOLDS.bruteForce });
    expect(report.bySeverity.medium).toBeGreaterThanOrEqual(SECURITY_REPORT_THRESHOLDS.bruteForce);
  });

  it("excludes events outside the requested date range", async () => {
    await SecurityEventModel.create({
      type: SecurityEventType.LOGIN_FAILED,
      severity: SecuritySeverity.MEDIUM,
      ip: "10.9.9.9",
      targetEmail: "old@example.com",
      createdAt: new Date("2020-01-01"),
    });
    const admin = await createAuthenticatedUser(StaffRole.ADMIN);
    const res = await request(app).get("/api/logs/security/report").set("Authorization", admin.authHeader).expect(200);
    expect(res.body.data.topIps.find((row: { ip: string }) => row.ip === "10.9.9.9")).toBeUndefined();
  });
});
