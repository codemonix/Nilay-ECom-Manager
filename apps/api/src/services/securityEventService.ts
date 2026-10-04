import type { Request } from "express";
import {
  SECURITY_EVENT_SEVERITY,
  SECURITY_SEVERITY_VALUES,
  SecuritySeverity,
  type SecurityEventType,
  type SecurityReportDTO,
  type SecurityReportFlagDTO,
} from "@complaint-system/shared";
import { securityEventRepository } from "../repositories/securityEventRepository";
import { serializeSecurityEvent } from "../utils/serializers";
import { logger } from "../config/logger";
import { redactor } from "../config/redactor";
import type { ListSecurityEventsQuery, SecurityReportQuery } from "../validators/logValidators";

/** Report thresholds: at or above these counts within the report's date range, a subject is flagged. */
export const SECURITY_REPORT_THRESHOLDS = {
  /** Failed logins from one IP. */
  bruteForce: 10,
  /** Distinct accounts one IP failed to log into. */
  credentialStuffing: 3,
  /** Failed logins against one account, from any IP. */
  targetedAccount: 5,
  /** 403s hit by one signed-in user (probing pages they weren't granted). */
  privilegeProbing: 5,
} as const;

const DEFAULT_REPORT_DAYS = 7;
const REPORT_TABLE_ROWS = 10;
/** How many IPs to aggregate when looking for flags -- larger than the displayed table so an IP just outside the top 10 still gets flagged. */
const FLAG_SCAN_IPS = 500;
const MAX_USER_AGENT_LENGTH = 300;

export interface SecurityEventInput {
  userId?: string | null;
  userName?: string | null;
  targetEmail?: string | null;
  details?: Record<string, unknown>;
}

/**
 * Records one security event, pulling the client IP/user agent/request line
 * (and the signed-in user, if any) from `req`. Fire-and-forget like
 * userActivityLogService.record: never throws, so a logging failure can't
 * turn into a failed login or a 500 on the request being recorded.
 */
export function record(req: Request, type: SecurityEventType, input: SecurityEventInput = {}): void {
  const severity = SECURITY_EVENT_SEVERITY[type];
  const data = {
    type,
    severity,
    userId: input.userId ?? req.currentUser?.id ?? null,
    userName: input.userName ?? req.currentUser?.name ?? null,
    targetEmail: input.targetEmail?.trim().toLowerCase() || null,
    ip: req.ip ?? null,
    userAgent: req.header("user-agent")?.slice(0, MAX_USER_AGENT_LENGTH) ?? null,
    method: req.method,
    path: redactor.scrubString(req.originalUrl),
    details: input.details ? redactor.redact(input.details) : null,
  };
  if (severity === SecuritySeverity.HIGH) {
    logger.warn(`Security event: ${type}`, { ip: data.ip, userId: data.userId, targetEmail: data.targetEmail, path: data.path });
  }
  securityEventRepository.create(data).catch((err) => {
    logger.error("Failed to record security event", { err, type });
  });
}

export async function listSecurityEvents(query: ListSecurityEventsQuery) {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const { items, total } = await securityEventRepository.list({
    page,
    pageSize,
    type: query.type,
    severity: query.severity,
    search: query.search,
    from: query.from,
    to: query.to,
  });
  return {
    items: items.map(serializeSecurityEvent),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function buildSecurityReport(query: SecurityReportQuery): Promise<SecurityReportDTO> {
  const to = query.to ?? new Date();
  const from = query.from ?? new Date(to.getTime() - DEFAULT_REPORT_DAYS * 24 * 60 * 60 * 1000);

  const [byType, bySeverityRows, ipRows, accountRows, deniedRows] = await Promise.all([
    securityEventRepository.countBy("type", from, to),
    securityEventRepository.countBy("severity", from, to),
    securityEventRepository.aggregateByIp(from, to, FLAG_SCAN_IPS),
    securityEventRepository.aggregateTargetedAccounts(from, to, FLAG_SCAN_IPS),
    securityEventRepository.aggregateAccessDeniedByUser(from, to, SECURITY_REPORT_THRESHOLDS.privilegeProbing),
  ]);

  const bySeverity = Object.fromEntries(SECURITY_SEVERITY_VALUES.map((s) => [s, 0])) as SecurityReportDTO["bySeverity"];
  for (const row of bySeverityRows) bySeverity[row.key as SecuritySeverity] = row.count;

  const flags: SecurityReportFlagDTO[] = [];
  for (const row of ipRows) {
    const lastSeenAt = row.lastSeenAt.toISOString();
    if (row.failedLogins >= SECURITY_REPORT_THRESHOLDS.bruteForce) {
      flags.push({ kind: "ip", subject: row.ip, reason: "brute_force", count: row.failedLogins, lastSeenAt });
    }
    if (row.distinctAccounts >= SECURITY_REPORT_THRESHOLDS.credentialStuffing) {
      flags.push({ kind: "ip", subject: row.ip, reason: "credential_stuffing", count: row.distinctAccounts, lastSeenAt });
    }
    if (row.tokenAbuse > 0) {
      flags.push({ kind: "ip", subject: row.ip, reason: "token_tampering", count: row.tokenAbuse, lastSeenAt });
    }
  }
  for (const row of accountRows) {
    if (row.failedLogins >= SECURITY_REPORT_THRESHOLDS.targetedAccount) {
      flags.push({
        kind: "account",
        subject: row.email,
        reason: "targeted_account",
        count: row.failedLogins,
        lastSeenAt: row.lastSeenAt.toISOString(),
      });
    }
  }
  for (const row of deniedRows) {
    flags.push({
      kind: "user",
      subject: row.userName,
      reason: "privilege_probing",
      count: row.count,
      lastSeenAt: row.lastSeenAt.toISOString(),
    });
  }
  flags.sort((a, b) => b.count - a.count);

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    total: byType.reduce((sum, row) => sum + row.count, 0),
    bySeverity,
    byType: byType.map((row) => ({ type: row.key as SecurityEventType, count: row.count })),
    flags,
    topIps: ipRows.slice(0, REPORT_TABLE_ROWS).map((row) => ({
      ip: row.ip,
      total: row.total,
      failedLogins: row.failedLogins,
      distinctAccounts: row.distinctAccounts,
      lastSeenAt: row.lastSeenAt.toISOString(),
    })),
    targetedAccounts: accountRows.slice(0, REPORT_TABLE_ROWS).map((row) => ({
      email: row.email,
      failedLogins: row.failedLogins,
      distinctIps: row.distinctIps,
      lastSeenAt: row.lastSeenAt.toISOString(),
    })),
  };
}
