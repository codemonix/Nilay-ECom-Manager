import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import { env } from "./config/env";
import { apiRouter } from "./routes";
import { requestLogger } from "./middleware/requestLogger";
import { authenticate } from "./middleware/authenticate";
import { activityLogger } from "./middleware/activityLogger";
import { errorHandler } from "./middleware/errorHandler";
import { notFoundHandler } from "./middleware/notFound";
import { UPLOAD_ROOT } from "./middleware/upload";

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: "100mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(requestLogger);
  app.use(authenticate);
  app.use(activityLogger);

  // Uploaded attachments are served statically so the frontend can preview
  // images directly from the case timeline (see docs/architecture.md for
  // the plan to swap this for S3/object storage later). The web app runs on
  // a different origin (port) than the API, so the default
  // Cross-Origin-Resource-Policy: same-origin set by helmet() above would
  // otherwise cause browsers to silently block <img> loads from /uploads.
  app.use(
    "/uploads",
    helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }),
    express.static(UPLOAD_ROOT),
  );

  app.use("/api", apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export const uploadStaticRoot = path.resolve(UPLOAD_ROOT);
