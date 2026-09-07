import { describe, expect, it } from "vitest";
import request from "supertest";
import { StaffRole } from "@complaint-system/shared";
import { createApp } from "../src/app";
import { UserModel } from "../src/models/User";
import { hashPassword } from "../src/utils/password";
import { createAuthenticatedUser } from "./testUtils";

const app = createApp();

async function createLoginableUser(
  overrides: Partial<{ role: (typeof StaffRole)[keyof typeof StaffRole]; active: boolean; password: string }> = {},
) {
  const password = overrides.password ?? "Passw0rd!";
  const passwordHash = await hashPassword(password);
  const user = await UserModel.create({
    name: "Login User",
    email: `login-${Date.now()}-${Math.random().toString(36).slice(2)}@shopfa.internal`,
    passwordHash,
    role: overrides.role ?? StaffRole.CUSTOMER_SERVICE,
    active: overrides.active ?? true,
  });
  return { user, password };
}

describe("POST /api/auth/login", () => {
  it("returns a token and the user profile for correct credentials", async () => {
    const { user, password } = await createLoginableUser();

    const res = await request(app).post("/api/auth/login").send({ email: user.email, password });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.token).toBe("string");
    expect(res.body.data.user).toMatchObject({ id: String(user._id), email: user.email, role: user.role });
    expect(res.body.data.user.passwordHash).toBeUndefined();
  });

  it("rejects an incorrect password", async () => {
    const { user } = await createLoginableUser();
    const res = await request(app).post("/api/auth/login").send({ email: user.email, password: "wrong-password" });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("rejects a login for a deactivated user", async () => {
    const { user, password } = await createLoginableUser({ active: false });
    const res = await request(app).post("/api/auth/login").send({ email: user.email, password });
    expect(res.status).toBe(401);
  });

  it("rejects an unknown email", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "nobody@shopfa.internal", password: "whatever" });
    expect(res.status).toBe(401);
  });
});

describe("GET /api/auth/me", () => {
  it("returns the authenticated user's profile", async () => {
    const { user, authHeader } = await createAuthenticatedUser();
    const res = await request(app).get("/api/auth/me").set("Authorization", authHeader);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(String(user._id));
  });

  it("rejects a request with no token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("rejects a request with a malformed token", async () => {
    const res = await request(app).get("/api/auth/me").set("Authorization", "Bearer not-a-real-token");
    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/change-password", () => {
  it("changes the current user's password when the current password is correct", async () => {
    const { user, authHeader } = await createAuthenticatedUser();
    const res = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", authHeader)
      .send({ currentPassword: "Passw0rd!", newPassword: "NewPassw0rd!" });
    expect(res.status).toBe(200);

    const loginRes = await request(app).post("/api/auth/login").send({ email: user.email, password: "NewPassw0rd!" });
    expect(loginRes.status).toBe(200);
  });

  it("rejects when the current password is wrong", async () => {
    const { authHeader } = await createAuthenticatedUser();
    const res = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", authHeader)
      .send({ currentPassword: "wrong", newPassword: "NewPassw0rd!" });
    expect(res.status).toBe(401);
  });
});

describe("User management (admin only)", () => {
  it("lets an admin create a new staff user", async () => {
    const { authHeader } = await createAuthenticatedUser(StaffRole.ADMIN);
    const res = await request(app)
      .post("/api/users")
      .set("Authorization", authHeader)
      .send({ name: "New Hire", email: "new.hire@shopfa.internal", password: "Passw0rd!", role: StaffRole.WAREHOUSE });

    expect(res.status).toBe(201);
    expect(res.body.data.email).toBe("new.hire@shopfa.internal");
    expect(res.body.data.role).toBe(StaffRole.WAREHOUSE);
  });

  it("rejects creating a user with a duplicate email", async () => {
    const { authHeader } = await createAuthenticatedUser(StaffRole.ADMIN);
    const { user: existing } = await createLoginableUser();
    const res = await request(app)
      .post("/api/users")
      .set("Authorization", authHeader)
      .send({ name: "Dup", email: existing.email, password: "Passw0rd!", role: StaffRole.WAREHOUSE });
    expect(res.status).toBe(409);
  });

  it("rejects non-admins from creating users", async () => {
    const { authHeader } = await createAuthenticatedUser(StaffRole.CUSTOMER_SERVICE);
    const res = await request(app)
      .post("/api/users")
      .set("Authorization", authHeader)
      .send({ name: "New Hire", email: "blocked@shopfa.internal", password: "Passw0rd!", role: StaffRole.WAREHOUSE });
    expect(res.status).toBe(403);
  });

  it("lets an admin deactivate a user and change their role", async () => {
    const { authHeader } = await createAuthenticatedUser(StaffRole.ADMIN);
    const { user: target } = await createLoginableUser();

    const res = await request(app)
      .patch(`/api/users/${target._id}`)
      .set("Authorization", authHeader)
      .send({ active: false, role: StaffRole.MANAGER });

    expect(res.status).toBe(200);
    expect(res.body.data.active).toBe(false);
    expect(res.body.data.role).toBe(StaffRole.MANAGER);
  });

  it("lets an admin reset another user's password", async () => {
    const { authHeader } = await createAuthenticatedUser(StaffRole.ADMIN);
    const { user: target } = await createLoginableUser();

    const resetRes = await request(app)
      .post(`/api/users/${target._id}/reset-password`)
      .set("Authorization", authHeader)
      .send({ newPassword: "BrandNewPass1!" });
    expect(resetRes.status).toBe(200);

    const loginRes = await request(app).post("/api/auth/login").send({ email: target.email, password: "BrandNewPass1!" });
    expect(loginRes.status).toBe(200);
  });

  it("lets an admin list every user including inactive ones", async () => {
    const { authHeader } = await createAuthenticatedUser(StaffRole.ADMIN);
    await createLoginableUser({ active: false });

    const res = await request(app).get("/api/users/all").set("Authorization", authHeader);
    expect(res.status).toBe(200);
    expect(res.body.data.some((u: { active: boolean }) => u.active === false)).toBe(true);
  });

  it("rejects non-admins from listing every user", async () => {
    const { authHeader } = await createAuthenticatedUser(StaffRole.CUSTOMER_SERVICE);
    const res = await request(app).get("/api/users/all").set("Authorization", authHeader);
    expect(res.status).toBe(403);
  });
});
