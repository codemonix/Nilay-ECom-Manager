import { Router } from "express";
import { getVersion } from "../controllers/versionController";

export const versionRoutes = Router();

versionRoutes.get("/", getVersion);
