import { describe, expect, it } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { StaffRole } from "@complaint-system/shared";
import { createApp } from "../src/app";
import { RefreshTokenModel } from "../src/models/RefreshToken";
import { createAuthenticatedUser, createTestUser } from "./testUtils";

const app = createApp();

/** Returns the `refresh_token=...` pair from a response's Set-Cookie, or undefined. */
function refreshCookie(res: request.Response): string | undefined {
  const setCookie = res.headers["set-cookie"] as unknown as string[] | undefined;
  const cookie = setCookie?.find((c) => c.startsWith("refresh_token="));
  return cookie?.split(";")[0];
}

async function login(role: (typeof StaffRole)[keyof typeof StaffRole] = StaffRole.CUSTOMER_SERVICE) {
  const user = await createTestUser(role);
  const res = await request(app).post("/api/auth/login").send({ email: user.email, password: "Passw0rd!" });
  expect(res.status).toBe(200);
  return { user, res, cookie: refreshCookie(res)!, token: res.body.data.token as string };
}

describe("refresh tokens", () => {
  it("login sets an httpOnly, SameSite=Strict refresh cookie scoped to /api/auth", async () => {
    const { res } = await login();
    const setCookie = (res.headers["set-cookie"] as unknown as string[]).find((c) => c.startsWith("refresh_token="))!;
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Strict/i);
    expect(setCookie).toMatch(/Path=\/api\/auth/i);
    expect(res.body.data.refreshToken).toBeUndefined();
    expect(await RefreshTokenModel.countDocuments()).toBe(1);
  });

  it("stores only a hash of the refresh token", async () => {
    const { cookie } = await login();
    const raw = decodeURIComponent(cookie.split("=")[1]);
    const stored = await RefreshTokenModel.findOne().lean();
    expect(stored!.tokenHash).not.toBe(raw);
  });

  it("uses the access token lifetime from settings", async () => {
    const admin = await createAuthenticatedUser(StaffRole.ADMIN);
    await request(app)
      .patch("/api/settings/session")
      .set("Authorization", admin.authHeader)
      .send({ accessTokenTtlMinutes: 5, refreshTokenTtlDays: 2 })
      .expect(200);

    const { token } = await login();
    const decoded = jwt.decode(token) as { iat: number; exp: number };
    expect(decoded.exp - decoded.iat).toBe(5 * 60);

    const stored = await RefreshTokenModel.findOne().sort({ createdAt: -1 }).lean();
    const ttlMs = stored!.expiresAt.getTime() - stored!.createdAt!.getTime();
    expect(Math.abs(ttlMs - 2 * 86_400_000)).toBeLessThan(5_000);
  });

  it("exchanges the refresh cookie for a new access token and rotates the cookie", async () => {
    const { user, cookie } = await login();
    const res = await request(app).post("/api/auth/refresh").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(typeof res.body.data.token).toBe("string");
    expect(res.body.data.user.id).toBe(String(user._id));
    const next = refreshCookie(res);
    expect(next).toBeDefined();
    expect(next).not.toBe(cookie);

    const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${res.body.data.token}`);
    expect(me.status).toBe(200);
  });

  it("rejects refresh without a cookie or with an unknown one", async () => {
    expect((await request(app).post("/api/auth/refresh")).status).toBe(401);
    expect((await request(app).post("/api/auth/refresh").set("Cookie", "refresh_token=bogus")).status).toBe(401);
  });

  it("rejects an expired refresh token", async () => {
    const { cookie } = await login();
    await RefreshTokenModel.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await request(app).post("/api/auth/refresh").set("Cookie", cookie)).status).toBe(401);
  });

  it("tolerates a concurrent reuse inside the grace window without rotating again", async () => {
    const { cookie } = await login();
    const first = await request(app).post("/api/auth/refresh").set("Cookie", cookie);
    expect(first.status).toBe(200);

    const second = await request(app).post("/api/auth/refresh").set("Cookie", cookie);
    expect(second.status).toBe(200);
    expect(refreshCookie(second)).toBeUndefined();
    // The rotated-in token from the first call is still valid.
    expect((await request(app).post("/api/auth/refresh").set("Cookie", refreshCookie(first)!)).status).toBe(200);
  });

  it("revokes every session of the user when a rotated token is reused after the grace window", async () => {
    const { cookie } = await login();
    const first = await request(app).post("/api/auth/refresh").set("Cookie", cookie);
    const rotatedCookie = refreshCookie(first)!;
    await RefreshTokenModel.updateMany({ replacedAt: { $ne: null } }, { $set: { replacedAt: new Date(Date.now() - 60_000) } });

    expect((await request(app).post("/api/auth/refresh").set("Cookie", cookie)).status).toBe(401);
    // The legitimate holder's newer token was revoked too.
    expect((await request(app).post("/api/auth/refresh").set("Cookie", rotatedCookie)).status).toBe(401);
  });

  it("logout revokes the refresh token and clears the cookie", async () => {
    const { cookie } = await login();
    const res = await request(app).post("/api/auth/logout").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(refreshCookie(res)).toBe("refresh_token=");
    expect((await request(app).post("/api/auth/refresh").set("Cookie", cookie)).status).toBe(401);
  });

  it("refuses to refresh for a deactivated user, and deactivation revokes sessions", async () => {
    const { user, cookie } = await login();
    const admin = await createAuthenticatedUser(StaffRole.ADMIN);
    await request(app)
      .patch(`/api/users/${user._id}`)
      .set("Authorization", admin.authHeader)
      .send({ active: false })
      .expect(200);
    expect(await RefreshTokenModel.countDocuments({ user: user._id, revokedAt: null })).toBe(0);
    expect((await request(app).post("/api/auth/refresh").set("Cookie", cookie)).status).toBe(401);
  });

  it("changing the password keeps the current session but signs out the others", async () => {
    const user = await createTestUser();
    const loginA = await request(app).post("/api/auth/login").send({ email: user.email, password: "Passw0rd!" });
    const loginB = await request(app).post("/api/auth/login").send({ email: user.email, password: "Passw0rd!" });
    const cookieA = refreshCookie(loginA)!;
    const cookieB = refreshCookie(loginB)!;

    await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${loginA.body.data.token}`)
      .set("Cookie", cookieA)
      .send({ currentPassword: "Passw0rd!", newPassword: "NewPassw0rd!" })
      .expect(200);

    expect((await request(app).post("/api/auth/refresh").set("Cookie", cookieA)).status).toBe(200);
    expect((await request(app).post("/api/auth/refresh").set("Cookie", cookieB)).status).toBe(401);
  });
});

describe("PATCH /api/settings/session", () => {
  it("lets an admin update the token lifetimes", async () => {
    const { authHeader } = await createAuthenticatedUser(StaffRole.ADMIN);
    const res = await request(app)
      .patch("/api/settings/session")
      .set("Authorization", authHeader)
      .send({ accessTokenTtlMinutes: 30, refreshTokenTtlDays: 14 });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ accessTokenTtlMinutes: 30, refreshTokenTtlDays: 14 });

    const get = await request(app).get("/api/settings").set("Authorization", authHeader);
    expect(get.body.data).toMatchObject({ accessTokenTtlMinutes: 30, refreshTokenTtlDays: 14 });
  });

  it("returns the defaults before anything is saved", async () => {
    const { authHeader } = await createAuthenticatedUser(StaffRole.ADMIN);
    const res = await request(app).get("/api/settings").set("Authorization", authHeader);
    expect(res.body.data).toMatchObject({ accessTokenTtlMinutes: 15, refreshTokenTtlDays: 30 });
  });

  it("rejects out-of-range values and a refresh lifetime not longer than the access lifetime", async () => {
    const { authHeader } = await createAuthenticatedUser(StaffRole.ADMIN);
    const send = (body: object) => request(app).patch("/api/settings/session").set("Authorization", authHeader).send(body);
    expect((await send({ accessTokenTtlMinutes: 0, refreshTokenTtlDays: 30 })).status).toBeGreaterThanOrEqual(400);
    expect((await send({ accessTokenTtlMinutes: 15, refreshTokenTtlDays: 1000 })).status).toBeGreaterThanOrEqual(400);
    expect((await send({ accessTokenTtlMinutes: 1440, refreshTokenTtlDays: 1 })).status).toBe(400);
  });

  it("is admin-only even for staff granted the Settings menu", async () => {
    const { user, authHeader } = await createAuthenticatedUser(StaffRole.CUSTOMER_SERVICE);
    user.permissions = [...(user.permissions ?? []), "settings"] as typeof user.permissions;
    await user.save();
    const res = await request(app)
      .patch("/api/settings/session")
      .set("Authorization", authHeader)
      .send({ accessTokenTtlMinutes: 30, refreshTokenTtlDays: 14 });
    expect(res.status).toBe(403);
  });
});
