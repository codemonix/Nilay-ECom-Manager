import fs from "fs";
import path from "path";
import crypto from "crypto";
import multer from "multer";
import { env } from "../config/env";
import { ApiError } from "../utils/ApiError";

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
