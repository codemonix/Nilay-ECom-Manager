import { useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableBody from "@mui/material/TableBody";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TablePagination from "@mui/material/TablePagination";
import Chip from "@mui/material/Chip";
import Skeleton from "@mui/material/Skeleton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import {
  SECURITY_EVENT_TYPE_VALUES,
  SECURITY_SEVERITY_VALUES,
  SecuritySeverity,
  type SecurityEventType,
} from "@complaint-system/shared";
import { useGetSecurityReportQuery, useListSecurityEventsQuery } from "../api/logsApi";
import type { SecurityReportDTO } from "../types";
import { EmptyState } from "../../../components/EmptyState";
import { Ltr } from "../../../components/Ltr";
import { DateRangeFields } from "../../reporting/components/DateRangeFields";
import { isValidDateRange, lastDaysRange, type DateRangeValue } from "../../reporting/dateRange";
import { formatDateTime } from "../../../utils/localeFormat";
import { useActiveLanguage } from "../../../i18n/useActiveLanguage";

const DEFAULT_PAGE_SIZE = 20;

const SEVERITY_COLOR: Record<SecuritySeverity, "error" | "warning" | "default"> = {
  [SecuritySeverity.HIGH]: "error",
  [SecuritySeverity.MEDIUM]: "warning",
  [SecuritySeverity.LOW]: "default",
};

/** The date inputs are local calendar days; the API wants the instants bounding them (a bare "to" date would mean its midnight and drop that whole day). */
function toApiRange({ from, to }: DateRangeValue) {
  return { from: new Date(`${from}T00:00:00`).toISOString(), to: new Date(`${to}T23:59:59.999`).toISOString() };
}

function SectionTitle({ children }: { children: string }) {
  return (
    <Typography variant="subtitle2" sx={{ mt: 1 }}>
      {children}
    </Typography>
  );
}

function ReportSummary({ report }: { report: SecurityReportDTO }) {
  const { t } = useTranslation("logs");
  const language = useActiveLanguage();

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
        <Typography variant="body2" color="text.secondary">
          {t("resultsCount", { count: report.total })}
        </Typography>
        {SECURITY_SEVERITY_VALUES.map((severity) => (
          <Chip
            key={severity}
            size="small"
            variant="outlined"
            color={SEVERITY_COLOR[severity]}
            label={`${t(`security.severity.${severity}`)}: ${report.bySeverity[severity]}`}
          />
        ))}
      </Stack>

      <SectionTitle>{t("security.report.flagsTitle")}</SectionTitle>
      {report.flags.length === 0 ? (
        <Alert severity="success">{t("security.report.noFlags")}</Alert>
      ) : (
        <TableContainer sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t("security.report.columns.subject")}</TableCell>
                <TableCell>{t("security.report.columns.reason")}</TableCell>
                <TableCell align="right">{t("security.report.columns.count")}</TableCell>
                <TableCell>{t("security.report.columns.lastSeen")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {report.flags.map((flag) => (
                <TableRow key={`${flag.reason}:${flag.subject}`}>
                  <TableCell>
                    <Ltr>{flag.subject}</Ltr>
                  </TableCell>
                  <TableCell>
                    <Tooltip title={t(`security.report.reasonHelp.${flag.reason}`)}>
                      <Chip size="small" color="error" variant="outlined" label={t(`security.report.reasons.${flag.reason}`)} />
                    </Tooltip>
                  </TableCell>
                  <TableCell align="right">{flag.count}</TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>
                    <Ltr>{formatDateTime(flag.lastSeenAt, language)}</Ltr>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        <Stack spacing={1} sx={{ flex: 1, minWidth: 0 }}>
          <SectionTitle>{t("security.report.topIpsTitle")}</SectionTitle>
          {report.topIps.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              —
            </Typography>
          ) : (
            <TableContainer sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t("security.columns.ip")}</TableCell>
                    <TableCell align="right">{t("security.report.columns.events")}</TableCell>
                    <TableCell align="right">{t("security.report.columns.failedLogins")}</TableCell>
                    <TableCell align="right">{t("security.report.columns.accounts")}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {report.topIps.map((row) => (
                    <TableRow key={row.ip}>
                      <TableCell>
                        <Ltr>{row.ip}</Ltr>
                      </TableCell>
                      <TableCell align="right">{row.total}</TableCell>
                      <TableCell align="right">{row.failedLogins}</TableCell>
                      <TableCell align="right">{row.distinctAccounts}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Stack>

        <Stack spacing={1} sx={{ flex: 1, minWidth: 0 }}>
          <SectionTitle>{t("security.report.targetedTitle")}</SectionTitle>
          {report.targetedAccounts.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              —
            </Typography>
          ) : (
            <TableContainer sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t("security.columns.account")}</TableCell>
                    <TableCell align="right">{t("security.report.columns.failedLogins")}</TableCell>
                    <TableCell align="right">{t("security.report.columns.ips")}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {report.targetedAccounts.map((row) => (
                    <TableRow key={row.email}>
                      <TableCell>
                        <Ltr>{row.email}</Ltr>
                      </TableCell>
                      <TableCell align="right">{row.failedLogins}</TableCell>
                      <TableCell align="right">{row.distinctIps}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Stack>
      </Stack>

      {report.byType.length > 0 && (
        <>
          <SectionTitle>{t("security.report.byTypeTitle")}</SectionTitle>
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
            {report.byType.map((row) => (
              <Chip key={row.type} size="small" variant="outlined" label={`${t(`security.types.${row.type}`)}: ${row.count}`} />
            ))}
          </Stack>
        </>
      )}
    </Stack>
  );
}

/**
 * The Logs page's Security tab: a summary report of suspicious activity
 * over the chosen period (flagged IPs/accounts/users, top sources, counts
 * per event type) followed by the raw, filterable event list.
 */
export function SecurityLogsPanel() {
  const { t } = useTranslation(["logs", "common"]);
  const language = useActiveLanguage();
  const [range, setRange] = useState<DateRangeValue>(() => lastDaysRange(7));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [type, setType] = useState<SecurityEventType | "">("");
  const [severity, setSeverity] = useState<SecuritySeverity | "">("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const handle = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const validRange = isValidDateRange(range);
  const apiRange = useMemo(() => (validRange ? toApiRange(range) : null), [range, validRange]);

  const { data: report, isFetching: reportFetching } = useGetSecurityReportQuery(apiRange!, { skip: !apiRange });
  const { data, isFetching } = useListSecurityEventsQuery(
    {
      page,
      pageSize,
      type: type || undefined,
      severity: severity || undefined,
      search: search || undefined,
      ...apiRange,
    },
    { skip: !apiRange },
  );

  return (
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Stack spacing={1.5}>
          <Typography variant="h6">{t("logs:security.report.title")}</Typography>
          <DateRangeFields
            value={range}
            onChange={(value) => {
              setRange(value);
              setPage(1);
            }}
          />
          {reportFetching && !report && <Skeleton variant="rounded" height={120} />}
          {report && <ReportSummary report={report} />}
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Stack spacing={1.5}>
          <Typography variant="h6">{t("logs:security.eventsTitle")}</Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <TextField
              size="small"
              placeholder={t("logs:security.searchPlaceholder")}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              sx={{ minWidth: 240 }}
            />
            <TextField
              select
              size="small"
              value={type}
              onChange={(e) => {
                setType(e.target.value as SecurityEventType | "");
                setPage(1);
              }}
              sx={{ minWidth: 200 }}
              SelectProps={{ displayEmpty: true }}
            >
              <MenuItem value="">{t("logs:security.allTypes")}</MenuItem>
              {SECURITY_EVENT_TYPE_VALUES.map((value) => (
                <MenuItem key={value} value={value}>
                  {t(`logs:security.types.${value}`)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              value={severity}
              onChange={(e) => {
                setSeverity(e.target.value as SecuritySeverity | "");
                setPage(1);
              }}
              sx={{ minWidth: 160 }}
              SelectProps={{ displayEmpty: true }}
            >
              <MenuItem value="">{t("logs:security.allSeverities")}</MenuItem>
              {SECURITY_SEVERITY_VALUES.map((value) => (
                <MenuItem key={value} value={value}>
                  {t(`logs:security.severity.${value}`)}
                </MenuItem>
              ))}
            </TextField>
          </Stack>

          {data && (
            <Typography variant="body2" color="text.secondary">
              {t("logs:resultsCount", { count: data.total })}
            </Typography>
          )}

          {isFetching && !data && (
            <Stack spacing={1}>
              {[1, 2, 3].map((key) => (
                <Skeleton key={key} variant="rounded" height={40} />
              ))}
            </Stack>
          )}

          {data && data.items.length === 0 && <EmptyState message={t("logs:security.empty")} />}

          {data && data.items.length > 0 && (
            <TableContainer sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t("logs:security.columns.time")}</TableCell>
                    <TableCell>{t("logs:security.columns.event")}</TableCell>
                    <TableCell>{t("logs:security.columns.user")}</TableCell>
                    <TableCell>{t("logs:security.columns.account")}</TableCell>
                    <TableCell>{t("logs:security.columns.ip")}</TableCell>
                    <TableCell>{t("logs:security.columns.request")}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.items.map((event) => (
                    <TableRow key={event.id} hover>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>
                        <Ltr>{formatDateTime(event.createdAt, language)}</Ltr>
                      </TableCell>
                      <TableCell>
                        <Tooltip title={event.details ? JSON.stringify(event.details) : ""}>
                          <Chip
                            size="small"
                            variant="outlined"
                            color={SEVERITY_COLOR[event.severity]}
                            label={t(`logs:security.types.${event.type}`)}
                          />
                        </Tooltip>
                      </TableCell>
                      <TableCell>{event.userName ?? "—"}</TableCell>
                      <TableCell>
                        <Ltr>{event.targetEmail ?? "—"}</Ltr>
                      </TableCell>
                      <TableCell>
                        <Tooltip title={event.userAgent ?? ""}>
                          <span>
                            <Ltr>{event.ip ?? "—"}</Ltr>
                          </span>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Ltr>
                          {event.method} {event.path}
                        </Ltr>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {data && data.total > 0 && (
            <TablePagination
              component="div"
              count={data.total}
              page={data.page - 1}
              rowsPerPage={data.pageSize}
              rowsPerPageOptions={[10, 20, 50, 100]}
              labelRowsPerPage={t("pagination.rowsPerPage", { ns: "common" })}
              onPageChange={(_e, newPage) => setPage(newPage + 1)}
              onRowsPerPageChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            />
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}
