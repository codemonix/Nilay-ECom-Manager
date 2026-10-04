import type { SecurityEventType, SecuritySeverity, SystemLogLevel } from "../constants/logEnums";

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

/** On-disk size and document count of one log collection, shown on the admin Settings page. */
export interface LogCollectionSizeDTO {
  sizeBytes: number;
  documentCount: number;
}

/**
 * Sizes of the two log streams that have no automatic rotation (unlike
 * SystemLog, which is capped at 60 days / 50 MB -- see
 * apps/api/src/jobs/systemLogRetentionJob.ts and models/SystemLog.ts).
 */
export interface LogSizesDTO {
  userActivity: LogCollectionSizeDTO;
  shopfaTransactions: LogCollectionSizeDTO;
}

/** One security-relevant event -- see SecurityEventType and apps/api/src/services/securityEventService.ts. */
export interface SecurityEventDTO {
  id: string;
  type: SecurityEventType;
  severity: SecuritySeverity;
  /** The signed-in user who caused it, when known. */
  userId: string | null;
  userName: string | null;
  /** The account being targeted (e.g. the email typed on a failed login). */
  targetEmail: string | null;
  ip: string | null;
  userAgent: string | null;
  method: string | null;
  path: string | null;
  details: unknown;
  createdAt: string;
}

export interface SecurityEventListQuery {
  page?: number;
  pageSize?: number;
  type?: SecurityEventType;
  severity?: SecuritySeverity;
  search?: string;
  from?: string;
  to?: string;
}

/** An IP address or account the report flags, with why. */
export interface SecurityReportFlagDTO {
  kind: "ip" | "account" | "user";
  /** The IP, the targeted email, or the signed-in user's name. */
  subject: string;
  reason: "brute_force" | "credential_stuffing" | "targeted_account" | "privilege_probing" | "token_tampering";
  count: number;
  lastSeenAt: string;
}

export interface SecurityReportIpRowDTO {
  ip: string;
  total: number;
  failedLogins: number;
  distinctAccounts: number;
  lastSeenAt: string;
}

export interface SecurityReportAccountRowDTO {
  email: string;
  failedLogins: number;
  distinctIps: number;
  lastSeenAt: string;
}

/** Aggregated view of SecurityEvent over a date range, for the Logs page's Security tab. */
export interface SecurityReportDTO {
  from: string;
  to: string;
  total: number;
  bySeverity: Record<SecuritySeverity, number>;
  byType: Array<{ type: SecurityEventType; count: number }>;
  flags: SecurityReportFlagDTO[];
  topIps: SecurityReportIpRowDTO[];
  targetedAccounts: SecurityReportAccountRowDTO[];
}
