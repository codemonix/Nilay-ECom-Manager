import type { SystemLogDTO, UserActivityLogDTO, ShopfaTransactionLogDTO, SystemLogLevel } from "@complaint-system/shared";

export type { SystemLogDTO, UserActivityLogDTO, ShopfaTransactionLogDTO };
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
