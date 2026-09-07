import type { Request, Response } from "express";
import mongoose from "mongoose";

export function getHealth(_req: Request, res: Response) {
  res.status(200).json({
    success: true,
    data: {
      status: "ok",
      uptimeSeconds: process.uptime(),
      database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
      timestamp: new Date().toISOString(),
    },
  });
}
