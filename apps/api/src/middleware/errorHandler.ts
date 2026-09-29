import type { NextFunction, Request, Response } from "express";
import { MulterError } from "multer";
import { ZodError } from "zod";
import { ApiError } from "../utils/ApiError";
import { logger } from "../config/logger";

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    if (err.statusCode >= 500) {
      logger.error(err.message, { code: err.code, path: req.path, stack: err.stack });
    }
    return res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message, details: err.details },
    });
  }

  if (err instanceof MulterError) {
    const tooLarge = err.code === "LIMIT_FILE_SIZE";
    logger.warn("Upload rejected", { code: err.code, field: err.field, path: req.path });
    return res.status(tooLarge ? 413 : 400).json({
      success: false,
      error: {
        code: tooLarge ? "FILE_TOO_LARGE" : "UPLOAD_ERROR",
        message: tooLarge ? "The uploaded file is too large" : err.message,
      },
    });
  }

  if (err instanceof ZodError) {
    return res.status(422).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: err.flatten(),
      },
    });
  }

  const error = err instanceof Error ? err : new Error("Unknown error");
  logger.error(error.message, { path: req.path, stack: error.stack });

  return res.status(500).json({
    success: false,
    error: { code: "INTERNAL_ERROR", message: "Internal server error" },
  });
}
