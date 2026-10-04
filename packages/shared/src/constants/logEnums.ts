/**
 * Severity levels for internal system logs, admin-configurable from the
 * Settings page (see AppSettingsDTO.systemLogLevel / Settings.systemLogLevel).
 * These reuse winston's own built-in npm level names (see
 * apps/api/src/config/logger.ts) so the persisted setting can be assigned
 * straight to the running logger's `.level` with no translation layer --
 * "less severe" here always means "more verbose", matching winston's
 * convention of lower severity number = more detail printed.
 */
export const SystemLogLevel = {
  ERROR: "error",
  WARN: "warn",
  INFO: "info",
  HTTP: "http",
  DEBUG: "debug",
} as const;
export type SystemLogLevel = (typeof SystemLogLevel)[keyof typeof SystemLogLevel];
export const SYSTEM_LOG_LEVEL_VALUES = Object.values(SystemLogLevel);

/** Winston's npm level severities for the five levels above (lower = less verbose). Used to render an ordered level picker on the Settings page. */
export const SYSTEM_LOG_LEVEL_SEVERITY: Record<SystemLogLevel, number> = {
  [SystemLogLevel.ERROR]: 0,
  [SystemLogLevel.WARN]: 1,
  [SystemLogLevel.INFO]: 2,
  [SystemLogLevel.HTTP]: 3,
  [SystemLogLevel.DEBUG]: 5,
};

/**
 * Kinds of security-relevant event recorded in the SecurityEvent log (see
 * apps/api/src/services/securityEventService.ts). The first group are
 * attack signals (failed/blocked access); the second are legitimate but
 * high-impact admin actions, logged so a compromised admin account leaves
 * a trail.
 */
export const SecurityEventType = {
  LOGIN_FAILED: "login_failed",
  LOGIN_THROTTLED: "login_throttled",
  INVALID_ACCESS_TOKEN: "invalid_access_token",
  REFRESH_TOKEN_REUSE: "refresh_token_reuse",
  UNAUTHENTICATED_ACCESS: "unauthenticated_access",
  ACCESS_DENIED: "access_denied",
  PASSWORD_CHANGE_FAILED: "password_change_failed",

  USER_CREATED: "user_created",
  USER_UPDATED: "user_updated",
  USER_PASSWORD_RESET: "user_password_reset",
  SESSION_SETTINGS_CHANGED: "session_settings_changed",
  SETTINGS_BACKUP_DOWNLOADED: "settings_backup_downloaded",
  SETTINGS_RESTORED: "settings_restored",
  DATA_BACKUP_DOWNLOADED: "data_backup_downloaded",
  DATA_RESTORED: "data_restored",
} as const;
export type SecurityEventType = (typeof SecurityEventType)[keyof typeof SecurityEventType];
export const SECURITY_EVENT_TYPE_VALUES = Object.values(SecurityEventType);

export const SecuritySeverity = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
} as const;
export type SecuritySeverity = (typeof SecuritySeverity)[keyof typeof SecuritySeverity];
export const SECURITY_SEVERITY_VALUES = Object.values(SecuritySeverity);

/** Fixed severity per event type, so the report can rank without per-call judgement. */
export const SECURITY_EVENT_SEVERITY: Record<SecurityEventType, SecuritySeverity> = {
  [SecurityEventType.LOGIN_FAILED]: SecuritySeverity.MEDIUM,
  [SecurityEventType.LOGIN_THROTTLED]: SecuritySeverity.HIGH,
  [SecurityEventType.INVALID_ACCESS_TOKEN]: SecuritySeverity.HIGH,
  [SecurityEventType.REFRESH_TOKEN_REUSE]: SecuritySeverity.HIGH,
  [SecurityEventType.UNAUTHENTICATED_ACCESS]: SecuritySeverity.LOW,
  [SecurityEventType.ACCESS_DENIED]: SecuritySeverity.MEDIUM,
  [SecurityEventType.PASSWORD_CHANGE_FAILED]: SecuritySeverity.MEDIUM,
  [SecurityEventType.USER_CREATED]: SecuritySeverity.MEDIUM,
  [SecurityEventType.USER_UPDATED]: SecuritySeverity.MEDIUM,
  [SecurityEventType.USER_PASSWORD_RESET]: SecuritySeverity.MEDIUM,
  [SecurityEventType.SESSION_SETTINGS_CHANGED]: SecuritySeverity.MEDIUM,
  [SecurityEventType.SETTINGS_BACKUP_DOWNLOADED]: SecuritySeverity.LOW,
  [SecurityEventType.SETTINGS_RESTORED]: SecuritySeverity.HIGH,
  [SecurityEventType.DATA_BACKUP_DOWNLOADED]: SecuritySeverity.HIGH,
  [SecurityEventType.DATA_RESTORED]: SecuritySeverity.HIGH,
};
