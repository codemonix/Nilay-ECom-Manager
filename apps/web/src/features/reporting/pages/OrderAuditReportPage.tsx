import { useState } from "react";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import LinearProgress from "@mui/material/LinearProgress";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableBody from "@mui/material/TableBody";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TablePagination from "@mui/material/TablePagination";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";
import { useLazyGetOrderAuditReportQuery, type GetOrderAuditReportArgs } from "../api/reportingApi";
import {
  DEFAULT_ORDER_AUDIT_REPORT_PAGE_SIZE,
  ORDER_AUDIT_EVENT_TYPE_VALUES,
  ORDER_AUDIT_REPORT_PAGE_SIZES,
  OrderAuditEventType,
  type OrderAuditEventDTO,
  type OrderAuditReportResultDTO,
} from "../types";
import { DateRangeFields } from "../components/DateRangeFields";
import { isValidDateRange, lastDaysRange, type DateRangeValue } from "../dateRange";
import { useListUsersQuery } from "../../users/api/usersApi";
import { UpstreamErrorAlert } from "../../../components/UpstreamErrorAlert";
import { EmptyState } from "../../../components/EmptyState";
import { ItemPhoto } from "../../../components/ItemPhoto";
import { resolveUploadUrl } from "../../../utils/attachments";
import { formatDateTime, formatNumber } from "../../../utils/localeFormat";
import { useActiveLanguage } from "../../../i18n/useActiveLanguage";

const DEFAULT_RANGE_DAYS = 7;

const TYPE_CHIP_COLOR = {
  [OrderAuditEventType.STATUS_CHANGED]: "info",
  [OrderAuditEventType.ORDER_PACKED]: "success",
  [OrderAuditEventType.PHOTOS_UPLOADED]: "secondary",
} as const;

/** The sentence describing one action, plus the pictures of an upload. */
function EventDetails({ event }: { event: OrderAuditEventDTO }) {
  const { t } = useTranslation("reporting", { keyPrefix: "orderAudit" });
  // Source and sync labels are the ones Packing already shows for the same records.
  const { t: tPacking } = useTranslation("packing");
  const language = useActiveLanguage();

  switch (event.type) {
    case OrderAuditEventType.STATUS_CHANGED:
      return (
        <Stack direction="row" gap={0.75} alignItems="center" flexWrap="wrap">
          <Typography variant="body2">
            {event.fromStatusTitle
              ? t("statusChanged", { from: event.fromStatusTitle, to: event.toStatusTitle })
              : t("statusChangedNoFrom", { to: event.toStatusTitle })}
          </Typography>
          <Chip size="small" variant="outlined" label={tPacking(`statusSource.${event.source}`)} />
        </Stack>
      );
    case OrderAuditEventType.ORDER_PACKED:
      return (
        <Stack direction="row" gap={0.75} alignItems="center" flexWrap="wrap">
          <Typography variant="body2">
            {event.buyerName ? t("orderPackedFor", { buyer: event.buyerName }) : t("orderPacked")}
          </Typography>
          <Chip size="small" variant="outlined" label={tPacking(`syncStatus.${event.syncStatus}`)} />
        </Stack>
      );
    case OrderAuditEventType.PHOTOS_UPLOADED:
      return (
        <Stack spacing={0.75}>
          <Typography variant="body2">
            {t("photosUploadedFor", {
              count: event.photoUrls.length,
              formatted: formatNumber(event.photoUrls.length, language),
            })}
          </Typography>
          <Stack direction="row" gap={1} flexWrap="wrap">
            {event.photoUrls.map((url) => (
              <ItemPhoto key={url} src={resolveUploadUrl(url)} alt={t("photoAlt")} size={56} />
            ))}
          </Stack>
        </Stack>
      );
  }
}

/**
 * Order Activity Log report: one newest-first list of what staff did to
 * orders in a period -- status changes from Order Precheck/Packing, packing
 * sends and picture uploads -- filterable by user, order number and kind of
 * action, with per-user totals for the whole period. Reads only what this
 * system recorded itself, so it needs no live Shopfa connection.
 */
export function OrderAuditReportPage() {
  const { t } = useTranslation("reporting", { keyPrefix: "orderAudit" });
  const { t: tCommon } = useTranslation("common");
  const language = useActiveLanguage();
  const { data: users } = useListUsersQuery();

  const [range, setRange] = useState<DateRangeValue>(() => lastDaysRange(DEFAULT_RANGE_DAYS));
  const [userId, setUserId] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [type, setType] = useState<OrderAuditEventType | "">("");
  const [result, setResult] = useState<OrderAuditReportResultDTO | null>(null);
  /** What was last sent to the API: paging and Retry re-run that request rather than unapplied inputs. */
  const [applied, setApplied] = useState<GetOrderAuditReportArgs | null>(null);

  const [fetchReport, { isFetching, error }] = useLazyGetOrderAuditReportQuery();

  const canRun = isValidDateRange(range) && !isFetching;

  const run = async (args: GetOrderAuditReportArgs) => {
    setApplied(args);
    const data = await fetchReport(args).unwrap().catch(() => null);
    setResult(data);
  };

  const submit = () => {
    if (!canRun) return;
    void run({
      ...range,
      userId: userId || undefined,
      orderNumber: orderNumber.trim() || undefined,
      type: type || undefined,
      page: 1,
      pageSize: applied?.pageSize ?? DEFAULT_ORDER_AUDIT_REPORT_PAGE_SIZE,
    });
  };

  return (
    <Stack spacing={2}>
      <Stack spacing={0.5}>
        <Typography variant="h1">{t("title")}</Typography>
        <Typography variant="body2" color="text.secondary">
          {t("description")}
        </Typography>
      </Stack>

      <Card variant="outlined" sx={{ borderRadius: "14px" }}>
        <CardContent>
          <Stack spacing={1.5}>
            <DateRangeFields value={range} onChange={setRange} />
            <Stack direction={{ xs: "column", sm: "row" }} gap={1.5}>
              <TextField
                select
                size="small"
                fullWidth
                label={t("user")}
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
              >
                <MenuItem value="">{t("allUsers")}</MenuItem>
                {(users ?? []).map((user) => (
                  <MenuItem key={user.id} value={user.id}>
                    {user.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                size="small"
                fullWidth
                label={t("action")}
                value={type}
                onChange={(e) => setType(e.target.value as OrderAuditEventType | "")}
                slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
              >
                <MenuItem value="">{t("allActions")}</MenuItem>
                {ORDER_AUDIT_EVENT_TYPE_VALUES.map((value) => (
                  <MenuItem key={value} value={value}>
                    {t(`type.${value}`)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                size="small"
                fullWidth
                label={t("orderNumber")}
                placeholder={t("orderNumberPlaceholder")}
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                }}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Stack>
            <Button variant="contained" size="large" onClick={submit} disabled={!canRun}>
              {t("generate")}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {isFetching && <LinearProgress />}

      {error && (
        <UpstreamErrorAlert
          error={error}
          fallbackMessage={t("generateError")}
          isRetrying={isFetching}
          onRetry={() => {
            if (applied) void run(applied);
          }}
        />
      )}

      {result && applied && (
        <>
          <Typography variant="caption" color="text.secondary">
            {t("rangeShown", {
              count: result.total,
              formatted: formatNumber(result.total, language),
              from: formatDateTime(result.rangeFromISO, language),
              to: formatDateTime(result.rangeToISO, language),
            })}
          </Typography>

          {result.total === 0 ? (
            <EmptyState message={t("empty")} />
          ) : (
            <>
              <Card variant="outlined" sx={{ borderRadius: "14px" }}>
                <CardContent>
                  <Stack spacing={1}>
                    <Typography variant="h2">{t("summaryTitle")}</Typography>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>{t("user")}</TableCell>
                            <TableCell align="right">{t("statusChanges")}</TableCell>
                            <TableCell align="right">{t("ordersPacked")}</TableCell>
                            <TableCell align="right">{t("photosUploaded")}</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {result.summary.map((row) => (
                            <TableRow key={row.actorId ?? `name:${row.actorName ?? ""}`} hover>
                              <TableCell>{row.actorName ?? t("unknownUser")}</TableCell>
                              <TableCell align="right">{formatNumber(row.statusChanges, language)}</TableCell>
                              <TableCell align="right">{formatNumber(row.ordersPacked, language)}</TableCell>
                              <TableCell align="right">{formatNumber(row.photosUploaded, language)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Stack>
                </CardContent>
              </Card>

              <Card variant="outlined" sx={{ borderRadius: "14px", opacity: isFetching ? 0.6 : 1 }}>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>{t("date")}</TableCell>
                        <TableCell>{t("user")}</TableCell>
                        <TableCell>{t("order")}</TableCell>
                        <TableCell>{t("action")}</TableCell>
                        <TableCell>{t("details")}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {result.events.map((event) => (
                        <TableRow key={event.id} hover sx={{ verticalAlign: "top" }}>
                          <TableCell sx={{ whiteSpace: "nowrap" }}>{formatDateTime(event.atISO, language)}</TableCell>
                          <TableCell sx={{ whiteSpace: "nowrap" }}>{event.actorName ?? t("unknownUser")}</TableCell>
                          <TableCell>
                            {event.orderNumber ? (
                              <RouterLink
                                to={`/reporting/orders/${encodeURIComponent(event.orderNumber)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {event.orderNumber}
                              </RouterLink>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell>
                            <Chip size="small" color={TYPE_CHIP_COLOR[event.type]} label={t(`type.${event.type}`)} />
                          </TableCell>
                          <TableCell sx={{ minWidth: 260 }}>
                            <EventDetails event={event} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                <TablePagination
                  component="div"
                  count={result.total}
                  page={result.page - 1}
                  rowsPerPage={result.pageSize}
                  rowsPerPageOptions={[...ORDER_AUDIT_REPORT_PAGE_SIZES]}
                  labelRowsPerPage={tCommon("pagination.rowsPerPage")}
                  onPageChange={(_e, newPage) => void run({ ...applied, page: newPage + 1 })}
                  onRowsPerPageChange={(e) => void run({ ...applied, page: 1, pageSize: Number(e.target.value) })}
                />
              </Card>
            </>
          )}
        </>
      )}
    </Stack>
  );
}
