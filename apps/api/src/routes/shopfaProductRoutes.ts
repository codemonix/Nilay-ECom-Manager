import { Router } from "express";
import * as shopfaProductController from "../controllers/shopfaProductController";
import { validate } from "../middleware/validate";
import { searchShopfaProductsQuerySchema } from "../validators/shopfaProductValidators";

export const shopfaProductRoutes = Router();

shopfaProductRoutes.get(
  "/search",
  validate(searchShopfaProductsQuerySchema, "query"),
  shopfaProductController.searchProducts,
);
