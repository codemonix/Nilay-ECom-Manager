import type { CaseCategory, CaseStatus } from "../constants/caseEnums";
import type { CaseDTO } from "./case";
import { OrderWorkflowStatus } from "./orderWorkflow";

/**
 * Cases raised straight from an order screen (Order Precheck, Packing,
 * Status Check). Opening one puts the order in "در حال پیگیری" and writes the
 * case number into its admin note; resolving the case later offers to move
 * the order on to one of CASE_RESOLVE_ORDER_STATUS_CODES. Live-API only,
 * like those screens.
 */

/** Shopfa order status "در حال پیگیری" (being followed up) -- see SHOPFA_ORDER_STATUS_OPTIONS. */
export const ORDER_FOLLOW_UP_STATUS_CODE = 16;

/** The statuses a linked order can be moved to when its case is resolved. Business rule set by the store owner (2026-10-07). */
export const CASE_RESOLVE_ORDER_STATUS_CODES: number[] = [
  OrderWorkflowStatus.SENT,
  OrderWorkflowStatus.PAYMENT_CONFIRMED,
  OrderWorkflowStatus.WAREHOUSE_PROCESSING,
  OrderWorkflowStatus.PAYMENT_DECLARED,
  OrderWorkflowStatus.ACCOUNTING_APPROVED,
];

export interface OrderCaseItemDTO {
  productCode: string;
  title: string;
  quantity: number;
}

/** What the "create case" dialog needs to know about an order before it is filled in. */
export interface OrderCaseContextDTO {
  orderNumber: string;
  buyerName: string | null;
  statusCode: number;
  statusTitle: string;
  items: OrderCaseItemDTO[];
  /** Cases already linked to this order that are not resolved/closed yet, newest first -- shown so staff don't open a duplicate. */
  openCases: { id: string; caseNumber: string; subject: string; status: CaseStatus }[];
}

export interface CreateOrderCaseRequestDTO {
  category: CaseCategory;
  /** Shown as the case's subject; the screen builds it from the chosen reason and the order number. */
  subject: string;
  description?: string;
  /** Product codes of the order's items the case is about; empty/omitted when it concerns the order as a whole. */
  productCodes?: string[];
}

export interface CreateOrderCaseResultDTO {
  case: CaseDTO;
  /** False when the case was created but Shopfa could not be updated (status "در حال پیگیری" + case number in the admin note) -- it must then be done by hand in the Shopfa panel. */
  orderSynced: boolean;
}

export interface ChangeCaseOrderStatusRequestDTO {
  orderNumber: string;
  /** One of CASE_RESOLVE_ORDER_STATUS_CODES. */
  statusCode: number;
}
