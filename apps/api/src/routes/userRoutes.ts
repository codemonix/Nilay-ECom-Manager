import { Router } from "express";
import * as userController from "../controllers/userController";

export const userRoutes = Router();

userRoutes.get("/", userController.listUsers);
