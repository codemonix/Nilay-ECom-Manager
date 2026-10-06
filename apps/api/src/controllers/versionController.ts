import type { Request, Response } from "express";
import { versionInfo } from "../config/version";
import { sendSuccess } from "../utils/apiResponse";

export function getVersion(_req: Request, res: Response) {
  return sendSuccess(res, versionInfo);
}
