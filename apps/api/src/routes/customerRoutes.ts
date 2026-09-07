import { Router } from "express";
import * as customerController from "../controllers/customerController";

export const customerRoutes = Router();

customerRoutes.get("/search", customerController.searchCustomers);
customerRoutes.get("/:externalCustomerId/summary", customerController.getCustomerSummary);

// Read-only order lookup against the live Shopfa client, used by case
// creation to link a real order instead of a hand-typed id. Registered
// before the imported-orders `/api/orders` resource's naming would suggest,
// but scoped separately here because it needs the CASES permission (same
// as customer search), not SETTINGS.
customerRoutes.get("/orders/search", customerController.searchOrders);
customerRoutes.get("/orders/:externalOrderId", customerController.getOrder);
