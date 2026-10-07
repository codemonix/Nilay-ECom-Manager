import { Router } from "express";
import { ReportKey } from "@complaint-system/shared";
import * as reportingController from "../controllers/reportingController";
import { requireReportAccess } from "../middleware/authenticate";
import { validate } from "../middleware/validate";
import {
  categoryTrendsQuerySchema,
  customerReportQuerySchema,
  itemSalesQuerySchema,
  orderActivitiesParamSchema,
  orderAuditReportQuerySchema,
  orderHistoryReportQuerySchema,
  productSearchQuerySchema,
  shortageReportQuerySchema,
} from "../validators/reportingValidators";

// Mounted behind requireAnyReportAccess (routes/index.ts); each report then
// narrows access to its own ReportKey so an admin can grant them separately.
export const reportingRoutes = Router();

reportingRoutes.get(
  "/shortage",
  requireReportAccess(ReportKey.SHORTAGE),
  validate(shortageReportQuerySchema, "query"),
  reportingController.getShortageReport,
);

reportingRoutes.get(
  "/customer",
  requireReportAccess(ReportKey.CUSTOMER),
  validate(customerReportQuerySchema, "query"),
  reportingController.getCustomerReport,
);

reportingRoutes.get(
  "/item-sales",
  requireReportAccess(ReportKey.ITEM_SALES),
  validate(itemSalesQuerySchema, "query"),
  reportingController.getItemSalesReport,
);
reportingRoutes.get(
  "/item-sales/categories",
  requireReportAccess(ReportKey.ITEM_SALES),
  reportingController.listCategories,
);
reportingRoutes.get(
  "/item-sales/products",
  requireReportAccess(ReportKey.ITEM_SALES),
  validate(productSearchQuerySchema, "query"),
  reportingController.searchProducts,
);

reportingRoutes.get(
  "/category-trends",
  requireReportAccess(ReportKey.CATEGORY_TRENDS),
  validate(categoryTrendsQuerySchema, "query"),
  reportingController.getCategoryTrends,
);

reportingRoutes.get(
  "/order-history",
  requireReportAccess(ReportKey.ORDER_HISTORY),
  validate(orderHistoryReportQuerySchema, "query"),
  reportingController.getOrderHistoryReport,
);

// Loaded per order as its card is opened: one Shopfa call each, too slow to do for a whole result list.
reportingRoutes.get(
  "/order-history/:orderNumber/activities",
  requireReportAccess(ReportKey.ORDER_HISTORY),
  validate(orderActivitiesParamSchema, "params"),
  reportingController.getOrderActivities,
);

reportingRoutes.get(
  "/order-audit",
  requireReportAccess(ReportKey.ORDER_AUDIT),
  validate(orderAuditReportQuerySchema, "query"),
  reportingController.getOrderAuditReport,
);

// Opened from links inside several reports, so any report permission suffices.
reportingRoutes.get("/orders/:orderNumber", reportingController.getOrderDetails);
