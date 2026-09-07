import { Router } from "express";
import * as customerController from "../controllers/customerController";

export const customerRoutes = Router();

customerRoutes.get("/search", customerController.searchCustomers);
customerRoutes.get("/:externalCustomerId/summary", customerController.getCustomerSummary);
