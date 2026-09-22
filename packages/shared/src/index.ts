// Named (not `export *`) re-exports on purpose: this package compiles to
// CommonJS so it can be `require()`d by apps/api, but apps/web consumes it
// through Vite/Rollup's production build, whose static CJS-to-ESM analysis
// cannot see through a `__exportStar` re-export loop. Explicit named
// exports compile to statically analyzable `Object.defineProperty` getters
// instead, so both consumers resolve the same named imports correctly.

export {
  CaseStatus,
  CASE_STATUS_VALUES,
  CasePriority,
  CASE_PRIORITY_VALUES,
  CaseCategory,
  CASE_CATEGORY_VALUES,
  CaseSource,
  CASE_SOURCE_VALUES,
  CaseContactPlatform,
  CASE_CONTACT_PLATFORM_VALUES,
  CASE_CONTACT_PLATFORMS_REQUIRING_ID,
  CaseEventType,
  CASE_EVENT_TYPE_VALUES,
  StaffRole,
  STAFF_ROLE_VALUES,
  CASE_STATUS_TRANSITIONS,
  isValidStatusTransition,
} from "./constants/caseEnums";

export { DataSource, DATA_SOURCE_VALUES } from "./constants/settingsEnums";

export {
  MenuKey,
  MENU_KEY_VALUES,
  ReportKey,
  REPORT_KEY_VALUES,
  PERMISSION_KEY_VALUES,
  ASSIGNABLE_MENU_KEY_VALUES,
  DEFAULT_PERMISSIONS_BY_ROLE,
  hasMenuAccess,
  hasAdministrationAccess,
  hasOrdersMenuAccess,
  hasReportAccess,
  hasReportsMenuAccess,
} from "./constants/accessEnums";
export type { PermissionKey } from "./constants/accessEnums";

export {
  PackageStatus,
  PACKAGE_STATUS_VALUES,
  PACKAGE_STATUS_TRANSITIONS,
  isValidPackageStatusTransition,
  PackageEventType,
  PACKAGE_EVENT_TYPE_VALUES,
  AttachmentSubjectType,
  ATTACHMENT_SUBJECT_TYPE_VALUES,
} from "./constants/packageEnums";

export { SystemLogLevel, SYSTEM_LOG_LEVEL_VALUES, SYSTEM_LOG_LEVEL_SEVERITY } from "./constants/logEnums";

export type {
  CaseCustomerSnapshot,
  CaseRelatedOrder,
  CaseRelatedItem,
  CaseContactPoint,
  CaseDTO,
  CaseEventDTO,
  CaseListQuery,
} from "./types/case";

export type { CustomerSummaryDTO, CustomerSearchResultDTO, OrderSummaryDTO } from "./types/customer";

export type { UserDTO } from "./types/user";

export type {
  LoginRequestDTO,
  AuthResponseDTO,
  ChangePasswordInputDTO,
  UpdateQuickAccessMenuInputDTO,
} from "./types/auth";

export type { ApiSuccess, ApiFailure, ApiResponse, PaginatedResult } from "./types/api";

export type {
  AppSettingsDTO,
  LastImportSummaryDTO,
  ImportOrdersResultDTO,
  ShopfaConnectionTestResultDTO,
} from "./types/settings";

export type {
  ImportedOrderDTO,
  ImportedOrderItemDTO,
  ImportedOrderBuyerDTO,
  ImportedOrderListQuery,
} from "./types/order";

export type {
  SystemLogDTO,
  SystemLogListQuery,
  UserActivityLogDTO,
  UserActivityLogListQuery,
  ShopfaTransactionLogDTO,
  ShopfaTransactionLogListQuery,
  LogCollectionSizeDTO,
  LogSizesDTO,
} from "./types/log";

export type {
  PackageDTO,
  PackageItemDTO,
  PackageEventDTO,
  PackageListQuery,
  ReceiveItemPayload,
  MatchItemPayload,
  MatchPreviewDTO,
} from "./types/package";

export type {
  SoldItemSearchResultDTO,
  SoldQuantityStatusBreakdownDTO,
  SoldQuantityResultDTO,
  SoldQuantityRangeDays,
  TitleAsteriskCheckResultDTO,
  ToggleTitleAsteriskResultDTO,
  OrderAdminNoteDTO,
  UpdateOrderAdminNoteResultDTO,
} from "./types/devTools";

export type {
  ShopfaOrderStatusOption,
  ShortageReportItemDTO,
  UnresolvedShortageNoteDTO,
  ShortageReportResultDTO,
  ShortageReportRangeDays,
  ReportingOrderItemDTO,
  ReportingOrderDetailsDTO,
  CustomerReportOrderDTO,
  CustomerReportCustomerDTO,
  CustomerReportResultDTO,
  ItemSalesRowDTO,
  ItemSalesResultDTO,
  ItemSalesCategoryDTO,
  ItemSalesProductSearchResultDTO,
  CategoryTrendBucketDTO,
  CategoryTrendSeriesDTO,
  CategoryTrendResultDTO,
  CategoryTrendMonths,
} from "./types/reporting";
export {
  SHOPFA_ORDER_STATUS_OPTIONS,
  DEFAULT_SHORTAGE_REPORT_STATUS_CODES,
  SHORTAGE_REPORT_RANGE_DAYS_VALUES,
  DEFAULT_SHORTAGE_REPORT_RANGE_DAYS,
  SOLD_ORDER_STATUS_TITLES,
  CATEGORY_TREND_WINDOWS,
  CATEGORY_TREND_COLOR_SLOTS,
  DEFAULT_CATEGORY_TREND_MONTHS,
} from "./types/reporting";
export { SOLD_QUANTITY_RANGE_DAYS_VALUES } from "./types/devTools";

export type {
  OrderPrecheckItemDTO,
  OrderPrecheckOrderDTO,
  OrderPrecheckListResultDTO,
  SaveOrderPrecheckItemInput,
  SaveOrderPrecheckRequestDTO,
  SaveOrderPrecheckResultDTO,
  OrderPrecheckRelatedOrderDTO,
} from "./types/orderPrecheck";
export {
  ORDER_PRECHECK_DEFAULT_STATUS_CODES,
  ORDER_PRECHECK_ALL_AVAILABLE_STATUS_CODE,
  ORDER_PRECHECK_SOME_UNAVAILABLE_STATUS_CODE,
  ORDER_PRECHECK_ACCOUNTING_CONFIRMED_STATUS_CODE,
  ORDER_PRECHECK_CUSTOMER_PENDING_STATUS_CODES,
} from "./types/orderPrecheck";

export type {
  StatusOrderDTO,
  StatusOrderCountDTO,
  OrdersByStatusResultDTO,
  OrdersByStatusRangeDays,
} from "./types/ordersByStatus";
export { ORDERS_BY_STATUS_RANGE_DAYS_VALUES, DEFAULT_ORDERS_BY_STATUS_RANGE_DAYS } from "./types/ordersByStatus";

export type {
  PackingItemDTO,
  PackingOrderDTO,
  PackingListResultDTO,
  SendPackedOrderResultDTO,
  SendPackedOrdersResultDTO,
  PackingRangeDays,
  PackingRecordItemDTO,
  PackingPendingOrderDTO,
  PackingRecordDTO,
  PackingRecordListQuery,
} from "./types/packing";
export {
  PACKING_SOURCE_STATUS_CODE,
  PACKING_SENT_STATUS_CODE,
  PACKING_CUSTOMER_PENDING_STATUS_CODES,
  PACKING_RANGE_DAYS_VALUES,
  DEFAULT_PACKING_RANGE_DAYS,
} from "./types/packing";
