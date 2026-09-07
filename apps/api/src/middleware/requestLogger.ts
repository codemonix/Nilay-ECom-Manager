import type { NextFunction, Request, Response } from "express";
import { logger } from "../config/logger";

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  res.on("finish", () => {
    const durationMs = Date.now() - start;
    const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "http";
    logger.log(level, `${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs}ms`);
  });
  next();
}
