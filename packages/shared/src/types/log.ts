import type { SystemLogLevel } from "../constants/logEnums";

/** One internal system log line, persisted alongside the console output -- see config/mongoLogTransport.ts. */
export interface SystemLogDTO {
  id: string;
  level: SystemLogLevel;
  message: string;
  context: string | null;
  meta: unknown;
  createdAt: string;
}

export interface SystemLogListQuery {
  page?: number;
  pageSize?: number;
  level?: SystemLogLevel;
  search?: string;
  from?: string;
  to?: string;
}

/** One authenticated request captured by apps/api/src/middleware/activityLogger.ts -- the "all users activity" audit trail. */
export interface UserActivityLogDTO {
  id: string;
  userId: string | null;
  userName: string;
  userRole: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  ip: string | null;
  createdAt: string;
}

export interface UserActivityLogListQuery {
  page?: number;
  pageSize?: number;
  userId?: string;
  search?: string;
  from?: string;
  to?: string;
}

/** One outbound call to the live Shopfa HTTP API, captured by the axios interceptors in integrations/shopfa/shopfaClient.ts. */
export interface ShopfaTransactionLogDTO {
  id: string;
  method: string;
  endpoint: string;
  requestParams: unknown;
  statusCode: number | null;
  success: boolean;
  durationMs: number;
  errorMessage: string | null;
  createdAt: string;
}

export interface ShopfaTransactionLogListQuery {
  page?: number;
  pageSize?: number;
  success?: boolean;
  search?: string;
  from?: string;
  to?: string;
}
