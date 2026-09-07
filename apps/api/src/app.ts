import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import { env } from "./config/env";
import { apiRouter } from "./routes";
import { requestLogger } from "./middleware/requestLogger";
import { attachCurrentUser } from "./middleware/currentUser";
import { errorHandler } from "./middleware/errorHandler";
import { notFoundHandler } from "./middleware/notFound";
import { UPLOAD_ROOT } from "./middleware/upload";

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(requestLogger);
  app.use(attachCurrentUser);

  // Uploaded attachments are served statically so the frontend can preview
  // images directly from the case timeline (see docs/architecture.md for
  // the plan to swap this for S3/object storage later).
  app.use("/uploads", express.static(UPLOAD_ROOT));

  app.use("/api", apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export const uploadStaticRoot = path.resolve(UPLOAD_ROOT);
