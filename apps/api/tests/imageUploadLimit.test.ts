import fs from "fs";
import { describe, expect, it } from "vitest";
import request from "supertest";
import { StaffRole } from "@complaint-system/shared";
import { createApp } from "../src/app";
import { UPLOAD_ROOT } from "../src/middleware/upload";
import { createAuthenticatedUser } from "./testUtils";

const app = createApp();
const MB = 1024 * 1024;

function setLimit(authHeader: string, maxImageUploadSizeMB: number) {
  return request(app).patch("/api/settings/uploads").set("Authorization", authHeader).send({ maxImageUploadSizeMB });
}

async function createDraft(authHeader: string): Promise<string> {
  const res = await request(app).post("/api/packages").set("Authorization", authHeader).send({});
  return res.body.data.id as string;
}

function uploadAttachment(authHeader: string, packageId: string, bytes: number, filename: string, contentType: string) {
  return request(app)
    .post(`/api/packages/${packageId}/attachments`)
    .set("Authorization", authHeader)
    .attach("file", Buffer.alloc(bytes, 1), { filename, contentType });
}

describe("image upload size limit (Settings -> Image uploads)", () => {
  it("defaults to 2 MB and is exposed to every user through app-config", async () => {
    const { authHeader } = await createAuthenticatedUser(StaffRole.CUSTOMER_SERVICE);
    const res = await request(app).get("/api/app-config").set("Authorization", authHeader);
    expect(res.body.data.maxImageUploadSizeMB).toBe(2);
  });

  it("lets the limit be changed, and rejects out-of-range values", async () => {
    const { authHeader } = await createAuthenticatedUser(StaffRole.ADMIN);
    const res = await setLimit(authHeader, 1.5);
    expect(res.status).toBe(200);
    expect(res.body.data.maxImageUploadSizeMB).toBe(1.5);
    const config = await request(app).get("/api/app-config").set("Authorization", authHeader);
    expect(config.body.data.maxImageUploadSizeMB).toBe(1.5);

    expect((await setLimit(authHeader, 0.1)).status).toBeGreaterThanOrEqual(400);
    expect((await setLimit(authHeader, 50)).status).toBeGreaterThanOrEqual(400);
  });

  it("rejects an image over the limit with 413 and doesn't keep the file", async () => {
    const admin = await createAuthenticatedUser(StaffRole.ADMIN);
    await setLimit(admin.authHeader, 0.5).expect(200);
    const { authHeader } = await createAuthenticatedUser(StaffRole.PURCHASING);
    const packageId = await createDraft(authHeader);

    const filesBefore = fs.readdirSync(UPLOAD_ROOT).length;
    const res = await uploadAttachment(authHeader, packageId, 0.6 * MB, "big.jpg", "image/jpeg");
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe("FILE_TOO_LARGE");
    expect(fs.readdirSync(UPLOAD_ROOT).length).toBe(filesBefore);
  });

  it("accepts an image within the limit, and PDFs regardless of it", async () => {
    const admin = await createAuthenticatedUser(StaffRole.ADMIN);
    await setLimit(admin.authHeader, 0.5).expect(200);
    const { authHeader } = await createAuthenticatedUser(StaffRole.PURCHASING);
    const packageId = await createDraft(authHeader);

    expect((await uploadAttachment(authHeader, packageId, 0.4 * MB, "ok.jpg", "image/jpeg")).status).toBe(201);
    expect((await uploadAttachment(authHeader, packageId, 0.8 * MB, "doc.pdf", "application/pdf")).status).toBe(201);
  });
});
