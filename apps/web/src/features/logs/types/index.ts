import type {
  SecurityEventDTO,
  SecurityEventType,
  SecurityReportDTO,
  SecuritySeverity,
  ShopfaTransactionLogDTO,
  SystemLogDTO,
  SystemLogLevel,
  UserActivityLogDTO,
} from "@complaint-system/shared";

export type { SecurityEventDTO, SecurityReportDTO, SystemLogDTO, UserActivityLogDTO, ShopfaTransactionLogDTO };
export { SystemLogLevel } from "@complaint-system/shared";

export interface PagedListResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export type SystemLogListResult = PagedListResult<SystemLogDTO>;
export type UserActivityLogListResult = PagedListResult<UserActivityLogDTO>;
export type ShopfaTransactionLogListResult = PagedListResult<ShopfaTransactionLogDTO>;
export type SecurityEventListResult = PagedListResult<SecurityEventDTO>;

export interface ListSystemLogsParams {
  page: number;
  pageSize: number;
  level?: SystemLogLevel;
  search?: string;
}

export interface ListUserActivityLogsParams {
  page: number;
  pageSize: number;
  search?: string;
}

export interface ListShopfaTransactionLogsParams {
  page: number;
  pageSize: number;
  success?: boolean;
  search?: string;
}

export interface ListSecurityEventsParams {
  page: number;
  pageSize: number;
  type?: SecurityEventType;
  severity?: SecuritySeverity;
  search?: string;
  from?: string;
  to?: string;
}

export interface SecurityReportParams {
  from: string;
  to: string;
}
