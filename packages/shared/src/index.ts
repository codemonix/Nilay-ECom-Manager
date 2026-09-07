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
  CaseEventType,
  CASE_EVENT_TYPE_VALUES,
  StaffRole,
  STAFF_ROLE_VALUES,
  CASE_STATUS_TRANSITIONS,
  isValidStatusTransition,
} from "./constants/caseEnums";

export type {
  CaseCustomerSnapshot,
  CaseRelatedOrder,
  CaseRelatedItem,
  CaseDTO,
  CaseEventDTO,
  CaseListQuery,
} from "./types/case";

export type { CustomerSummaryDTO, CustomerSearchResultDTO, OrderSummaryDTO } from "./types/customer";

export type { UserDTO } from "./types/user";

export type { ApiSuccess, ApiFailure, ApiResponse, PaginatedResult } from "./types/api";
