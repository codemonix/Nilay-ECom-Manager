import fs from "fs/promises";
import path from "path";
import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { AttachmentSubjectType, CaseEventType, CaseStatus, DataSource, StaffRole } from "@complaint-system/shared";
import { SettingsModel } from "../src/models/Settings";
import { UserModel } from "../src/models/User";
import { CaseModel } from "../src/models/Case";
import { CaseEventModel } from "../src/models/CaseEvent";
import { AttachmentModel } from "../src/models/Attachment";
import { ImportedOrderModel } from "../src/models/ImportedOrder";
import { CounterModel } from "../src/models/Counter";
import { UPLOAD_ROOT } from "../src/middleware/upload";
import { createDataBackup, createSettingsBackup, restoreDataBackup, restoreSettingsBackup } from "../src/services/backupService";

function comparable(backup: Awaited<ReturnType<typeof createDataBackup>>) {
  const { createdAt: _createdAt, ...withoutTimestamp } = backup;
  return withoutTimestamp;
}

describe("backup and restore", () => {
  it("restores settings independently of operational data", async () => {
    await SettingsModel.create({ _id: "app", dataSource: DataSource.LIVE_API });
    await UserModel.create({ name: "Unaffected", email: "unaffected@example.com", passwordHash: "hash", role: StaffRole.ADMIN });

    const settingsBackup = await createSettingsBackup();
    await SettingsModel.deleteMany({});
    await restoreSettingsBackup(settingsBackup);

    expect((await SettingsModel.findById("app").lean())?.dataSource).toBe(DataSource.LIVE_API);
    expect(await UserModel.countDocuments()).toBe(1);
  });

  it("round-trips every system-data collection, ids, dates, and attachment bytes", async () => {
    const userId = new Types.ObjectId();
    const caseId = new Types.ObjectId();
    const eventId = new Types.ObjectId();
    const attachmentId = new Types.ObjectId();
    const orderId = new Types.ObjectId();
    const attachmentFilename = `backup-test-${Date.now()}.txt`;
    const attachmentContent = Buffer.from("backup attachment content");

    await UserModel.create({ _id: userId, name: "Backup User", email: "backup@example.com", passwordHash: "hash", role: StaffRole.ADMIN, active: true });
    await CaseModel.create({
      _id: caseId,
      caseNumber: "C-20260903-0001",
      customer: { externalCustomerId: "customer-1", name: "Customer One", email: "customer@example.com" },
      subject: "Backup case",
      description: "Round trip",
      category: "order",
      priority: "high",
      status: CaseStatus.OPEN,
      source: "phone",
      assignedTo: userId,
      createdBy: userId,
      lastActivityAt: new Date("2026-09-03T10:00:00.000Z"),
    });
    await CaseEventModel.create({ _id: eventId, caseId, type: CaseEventType.CREATED, actorId: userId, body: "Created" });
    await fs.mkdir(UPLOAD_ROOT, { recursive: true });
    await fs.writeFile(path.join(UPLOAD_ROOT, attachmentFilename), attachmentContent);
    await AttachmentModel.create({ _id: attachmentId, subjectType: AttachmentSubjectType.CASE, subjectId: caseId, originalFilename: "proof.txt", storedFilename: attachmentFilename, mimeType: "text/plain", size: attachmentContent.length, path: attachmentFilename, uploadedBy: userId });
    await ImportedOrderModel.create({
      _id: orderId,
      externalOrderId: "order-1",
      status: "paid",
      purchaseDate: new Date("2026-09-01T00:00:00.000Z"),
      shippingCost: 0,
      buyer: { externalBuyerId: "buyer-1", firstName: "Buyer", lastName: "One" },
      items: [{ productCode: "p-1", title: "Item", quantity: 1, unitPrice: 10, amount: 10 }],
      itemsTotal: 10,
      totalAmount: 10,
    });
    await CounterModel.create({ _id: "case-20260903", seq: 1 });

    const original = await createDataBackup();
    await Promise.all([
      UserModel.deleteMany({}),
      CaseModel.deleteMany({}),
      CaseEventModel.deleteMany({}),
      AttachmentModel.deleteMany({}),
      ImportedOrderModel.deleteMany({}),
      CounterModel.deleteMany({}),
    ]);
    await restoreDataBackup(original);
    const restored = await createDataBackup();

    expect(comparable(restored)).toEqual(comparable(original));
    expect(await CaseEventModel.exists({ caseId, actorId: userId })).toBeTruthy();
    expect(await AttachmentModel.exists({ _id: attachmentId, subjectType: AttachmentSubjectType.CASE, subjectId: caseId })).toBeTruthy();
    expect(await fs.readFile(path.join(UPLOAD_ROOT, attachmentFilename))).toEqual(attachmentContent);
  });

  it("rejects a corrupt attachment before changing existing data", async () => {
    await UserModel.create({ name: "Keep", email: "keep@example.com", passwordHash: "hash", role: StaffRole.ADMIN });
    const backup = await createDataBackup();
    backup.files = { "missing.bin": { $binary: Buffer.from("data").toString("base64"), sha256: "wrong" } };

    await expect(restoreDataBackup(backup)).rejects.toThrow("checksum mismatch");
    expect(await UserModel.countDocuments()).toBe(1);
  });
});
