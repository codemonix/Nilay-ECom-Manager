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

export { MenuKey, MENU_KEY_VALUES, DEFAULT_PERMISSIONS_BY_ROLE, hasMenuAccess } from "./constants/accessEnums";

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

export type { LoginRequestDTO, AuthResponseDTO, ChangePasswordInputDTO } from "./types/auth";

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
