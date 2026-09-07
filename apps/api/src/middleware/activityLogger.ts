import type { NextFunction, Request, Response } from "express";
import * as userActivityLogService from "../services/userActivityLogService";

/**
 * Records one UserActivityLog entry per authenticated request -- the "all
 * users activity" log independent of requestLogger's console output and of
 * ShopfaTransactionLog/SystemLog. Registered after authenticate() so
 * req.currentUser is populated for signed-in requests; anonymous requests
 * (login, health) are not recorded. Recording happens on "finish" (fire and
 * forget) so it never delays the response.
 */
export function activityLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  res.on("finish", () => {
    const user = req.currentUser;
    if (!user) return;
    void userActivityLogService.record({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - start,
      ip: req.ip ?? null,
    });
  });
  next();
}
