import fs from "fs";
import path from "path";
import crypto from "crypto";
import multer from "multer";
import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { ApiError } from "../utils/ApiError";
import { getMaxImageUploadBytes } from "../services/settingsService";

const uploadRoot = path.resolve(process.cwd(), env.UPLOAD_DIR);
if (!fs.existsSync(uploadRoot)) {
  fs.mkdirSync(uploadRoot, { recursive: true });
}

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadRoot),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`;
    cb(null, safeName);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: env.MAX_UPLOAD_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(ApiError.badRequest(`Unsupported file type: ${file.mimetype}`));
      return;
    }
    cb(null, true);
  },
});

function uploadedFiles(req: Request): Express.Multer.File[] {
  if (req.file) return [req.file];
  if (Array.isArray(req.files)) return req.files;
  return req.files ? Object.values(req.files).flat() : [];
}

/**
 * Runs after `upload`: rejects the request (413) when any image is larger
 * than the admin-configured Settings.maxImageUploadSizeMB, deleting every
 * file the request stored. The browser compresses images to fit before
 * uploading (see the web app's imageCompression.ts), so this only catches
 * uploads that skipped that. PDFs are left to `upload`'s MAX_UPLOAD_SIZE_MB.
 */
export async function enforceImageSizeLimit(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const files = uploadedFiles(req);
    const images = files.filter((file) => file.mimetype.startsWith("image/"));
    if (images.length === 0) return next();
    const maxBytes = await getMaxImageUploadBytes();
    const oversized = images.find((file) => file.size > maxBytes);
    if (!oversized) return next();

    await Promise.all(files.map((file) => fs.promises.unlink(file.path).catch(() => undefined)));
    const maxMB = maxBytes / (1024 * 1024);
    const sizeMB = oversized.size / (1024 * 1024);
    logger.warn("Upload rejected: image exceeds the configured size limit", {
      path: req.path,
      fileSizeMB: Number(sizeMB.toFixed(2)),
      limitMB: Number(maxMB.toFixed(2)),
    });
    next(
      new ApiError(
        413,
        "FILE_TOO_LARGE",
        `Image is ${sizeMB.toFixed(1)} MB; the limit is ${Number(maxMB.toFixed(2))} MB (Settings -> Image uploads)`,
      ),
    );
  } catch (err) {
    next(err);
  }
}

export const UPLOAD_ROOT = uploadRoot;

const XLSX_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
]);
const MAX_IMPORT_FILE_SIZE_MB = 25;

/**
 * Separate from `upload` above: order-import files are parsed in memory and
 * never written to disk (there's nothing to serve back), and the mime
 * allowlist is xlsx-specific rather than the image/PDF list case
 * attachments use.
 */
export const uploadOrdersFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMPORT_FILE_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const looksLikeXlsx =
      XLSX_MIME_TYPES.has(file.mimetype) || file.originalname.toLowerCase().endsWith(".xlsx");
    if (!looksLikeXlsx) {
      cb(ApiError.badRequest(`Unsupported file type for order import: ${file.mimetype}`));
      return;
    }
    cb(null, true);
  },
});
