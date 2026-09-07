import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { Types } from "mongoose";
import { SettingsModel } from "../models/Settings";
import { UserModel } from "../models/User";
import { CaseModel } from "../models/Case";
import { CaseEventModel } from "../models/CaseEvent";
import { AttachmentModel } from "../models/Attachment";
import { ImportedOrderModel } from "../models/ImportedOrder";
import { CounterModel } from "../models/Counter";
import { UPLOAD_ROOT } from "../middleware/upload";
import { ApiError } from "../utils/ApiError";

const BACKUP_VERSION = 1;
const DATA_COLLECTIONS = ["users", "cases", "caseEvents", "attachments", "importedOrders", "counters"] as const;
type DataCollection = (typeof DATA_COLLECTIONS)[number];
type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export interface BackupEnvelope {
  format: "nilay-ecom-backup";
  version: number;
  type: "settings" | "data";
  createdAt: { $date: string };
  settings?: JsonValue;
  collections?: Record<DataCollection, JsonValue[]>;
  files?: Record<string, { $binary: string; sha256: string }>;
}

type LeanQuery = { select: (fields: string) => LeanQuery; lean: () => { exec: () => Promise<unknown[]> } };

const models: Record<DataCollection, { find: () => LeanQuery; deleteMany: () => Promise<unknown>; insertMany: (docs: unknown[]) => Promise<unknown>; validate: (doc: unknown) => Promise<unknown> }> = {
  users: UserModel,
  cases: CaseModel,
  caseEvents: CaseEventModel,
  attachments: AttachmentModel,
  importedOrders: ImportedOrderModel,
  counters: CounterModel,
};

function encode(value: unknown): JsonValue {
  if (value instanceof Types.ObjectId) return { $oid: value.toHexString() };
  if (value instanceof Date) return { $date: value.toISOString() };
  if (Array.isArray(value)) return value.map(encode);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, encode(child)]));
  }
  if (value === undefined) return null;
  return value as JsonValue;
}

function decode(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(decode);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.$oid === "string" && Object.keys(record).length === 1) return new Types.ObjectId(record.$oid);
    if (typeof record.$date === "string" && Object.keys(record).length === 1) return new Date(record.$date);
    if (typeof record.$binary === "string" && typeof record.sha256 === "string") return record;
    return Object.fromEntries(Object.entries(record).map(([key, child]) => [key, decode(child)]));
  }
  return value;
}

function assertEnvelope(value: unknown, type: "settings" | "data"): asserts value is BackupEnvelope {
  if (!value || typeof value !== "object") throw ApiError.badRequest("Invalid backup payload");
  const envelope = value as Partial<BackupEnvelope>;
  if (envelope.format !== "nilay-ecom-backup" || envelope.version !== BACKUP_VERSION || envelope.type !== type) {
    throw ApiError.badRequest("Unsupported or invalid backup format");
  }
  if (type === "settings" && !envelope.settings) throw ApiError.badRequest("Settings backup is missing settings");
  if (type === "data" && (!envelope.collections || DATA_COLLECTIONS.some((name) => !Array.isArray(envelope.collections?.[name])))) {
    throw ApiError.badRequest("Data backup is missing collections");
  }
}

function validateDocuments(collections: Record<DataCollection, JsonValue[]>): void {
  for (const collection of DATA_COLLECTIONS) {
    const ids = new Set<string>();
    for (const document of collections[collection]) {
      if (!document || typeof document !== "object") throw ApiError.badRequest(`Invalid document in ${collection}`);
      const id = (document as Record<string, JsonValue>)._id;
      if (id && typeof id === "object" && "$oid" in id) {
        const oid = id.$oid;
        if (typeof oid !== "string" || !Types.ObjectId.isValid(oid) || ids.has(oid)) {
          throw ApiError.badRequest(`Invalid or duplicate document id in ${collection}`);
        }
        ids.add(oid);
      }
    }
  }
}

async function backupFiles(attachments: JsonValue[]): Promise<Record<string, { $binary: string; sha256: string }>> {
  const files: Record<string, { $binary: string; sha256: string }> = {};
  for (const attachment of attachments) {
    const record = attachment as Record<string, JsonValue>;
    const storedFilename = record.storedFilename;
    if (typeof storedFilename !== "string" || path.basename(storedFilename) !== storedFilename) {
      throw ApiError.badRequest("Attachment contains an unsafe filename");
    }
    try {
      const content = await fs.readFile(path.join(UPLOAD_ROOT, storedFilename));
      files[storedFilename] = { $binary: content.toString("base64"), sha256: crypto.createHash("sha256").update(content).digest("hex") };
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
      if (code === "ENOENT") throw ApiError.badRequest(`Attachment file is missing: ${storedFilename}`);
      throw error;
    }
  }
  return files;
}

export async function createSettingsBackup(): Promise<BackupEnvelope> {
  const settings = await SettingsModel.findById("app").lean();
  return { format: "nilay-ecom-backup", version: BACKUP_VERSION, type: "settings", createdAt: { $date: new Date().toISOString() }, settings: encode(settings ?? { _id: "app" }) };
}

export async function restoreSettingsBackup(payload: unknown): Promise<void> {
  assertEnvelope(payload, "settings");
  const settings = decode(payload.settings);
  if (!settings || typeof settings !== "object") throw ApiError.badRequest("Invalid settings document");
  if ((settings as Record<string, unknown>)._id !== "app") throw ApiError.badRequest("Settings backup must contain the app singleton");
  await new SettingsModel(settings).validate();
  await SettingsModel.deleteMany({});
  await SettingsModel.create(settings);
}

export async function createDataBackup(): Promise<BackupEnvelope> {
  const collections = {} as Record<DataCollection, JsonValue[]>;
  for (const collection of DATA_COLLECTIONS) {
    // `users.passwordHash` is excluded by default (schema `select: false`) so it
    // isn't accidentally returned from ordinary API responses; a full data
    // backup must still capture it so restoring doesn't leave every account
    // without a usable password hash.
    const query = collection === "users" ? models[collection].find().select("+passwordHash") : models[collection].find();
    collections[collection] = (await query.lean().exec()).map(encode);
  }
  return {
    format: "nilay-ecom-backup",
    version: BACKUP_VERSION,
    type: "data",
    createdAt: { $date: new Date().toISOString() },
    collections,
    files: await backupFiles(collections.attachments),
  };
}

export async function restoreDataBackup(payload: unknown): Promise<void> {
  assertEnvelope(payload, "data");
  const collections = payload.collections!;
  validateDocuments(collections);
  const decoded = Object.fromEntries(DATA_COLLECTIONS.map((name) => [name, collections[name].map(decode)])) as Record<DataCollection, unknown[]>;

  const files = payload.files ?? {};
  for (const [filename, file] of Object.entries(files)) {
    if (path.basename(filename) !== filename || !file || typeof file.$binary !== "string" || typeof file.sha256 !== "string") throw ApiError.badRequest("Invalid attachment backup");
    const content = Buffer.from(file.$binary, "base64");
    if (crypto.createHash("sha256").update(content).digest("hex") !== file.sha256) throw ApiError.badRequest(`Attachment checksum mismatch: ${filename}`);
  }

  for (const attachment of decoded.attachments) {
    const filename = (attachment as Record<string, unknown>).storedFilename;
    if (typeof filename !== "string" || !files[filename]) throw ApiError.badRequest(`Attachment file is missing from backup: ${String(filename)}`);
  }
  for (const collection of DATA_COLLECTIONS) {
    for (const document of decoded[collection]) await models[collection].validate(document);
  }

  for (const collection of DATA_COLLECTIONS) await models[collection].deleteMany();
  for (const collection of DATA_COLLECTIONS) if (decoded[collection].length) await models[collection].insertMany(decoded[collection]);
  await fs.mkdir(UPLOAD_ROOT, { recursive: true });
  for (const [filename, file] of Object.entries(files)) await fs.writeFile(path.join(UPLOAD_ROOT, filename), Buffer.from(file.$binary, "base64"));
}