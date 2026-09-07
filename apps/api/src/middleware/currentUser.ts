import type { NextFunction, Request, Response } from "express";
import { Types } from "mongoose";
import { asyncHandler } from "../utils/asyncHandler";
import { UserModel } from "../models/User";

/**
 * V1 has no real authentication yet (see docs/architecture.md). The web app
 * runs a lightweight "development user selector" and sends the chosen
 * staff member's id on every request via the x-user-id header. This
 * middleware resolves that header into req.currentUser so services/events
 * always have an actor, without coupling the rest of the app to a specific
 * auth mechanism -- swapping this middleware for real session/JWT auth
 * later does not require touching controllers or services.
 */
export const attachCurrentUser = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const headerId = req.header("x-user-id");
    if (headerId && Types.ObjectId.isValid(headerId)) {
      const user = await UserModel.findById(headerId).lean();
      if (user && user.active) {
        req.currentUser = { id: String(user._id), name: user.name, role: user.role };
      }
    }
    next();
  },
);
