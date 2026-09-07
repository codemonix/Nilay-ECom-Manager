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
