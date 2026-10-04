import { useRef, useState } from "react";
import { DataSource, hasMenuAccess, MenuKey, ShopfaSyncStatus } from "@complaint-system/shared";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import Divider from "@mui/material/Divider";
import LinearProgress from "@mui/material/LinearProgress";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableBody from "@mui/material/TableBody";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import Skeleton from "@mui/material/Skeleton";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select, { type SelectChangeEvent } from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Box from "@mui/material/Box";
import SearchIcon from "@mui/icons-material/Search";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";
import {
  useGetOrderActivitiesQuery,
  useLazyGetOrderHistoryReportQuery,
  type GetOrderHistoryReportArgs,
} from "../api/reportingApi";
import {
  DEFAULT_ORDER_HISTORY_REPORT_RANGE_DAYS,
  ORDER_HISTORY_REPORT_MIN_QUERY_LENGTH,
  ORDER_HISTORY_REPORT_RANGE_DAYS_VALUES,
  SHOPFA_ORDER_STATUS_OPTIONS,
  type OrderHistoryCaseDTO,
  type OrderHistoryReportOrderDTO,
  type OrderHistoryReportRangeDays,
  type OrderHistoryReportResultDTO,
} from "../types";
import { useGetAppConfigQuery } from "../../settings/api/settingsApi";
import { useAppSelector } from "../../../app/hooks";
import { UpstreamErrorAlert } from "../../../components/UpstreamErrorAlert";
import { EmptyState } from "../../../components/EmptyState";
import { ItemPhoto } from "../../../components/ItemPhoto";
import { resolveUploadUrl } from "../../../utils/attachments";
import { getApiErrorMessage } from "../../../utils/apiError";
import { formatDateTime } from "../../../utils/localeFormat";
import { useActiveLanguage } from "../../../i18n/useActiveLanguage";

const PAGE_STEP = 50;
/** Up to this many orders (a typical search) open with their history already expanded. */
const AUTO_EXPAND_MAX_ORDERS = 5;
/** "ارسال شده": the status whose orders have the most recorded history (packing pictures, complaints). */
const DEFAULT_STATUS_CODE = 5;

type Mode = "status" | "search";

const SYNC_CHIP_COLOR = {
  [ShopfaSyncStatus.SYNCED]: "success",
  [ShopfaSyncStatus.PENDING_SYNC]: "warning",
  [ShopfaSyncStatus.FAILED]: "error",
} as const;

function SectionTitle({ children }: { children: string }) {
  return (
    <Typography variant="caption" color="text.secondary" fontWeight={600}>
      {children}
    </Typography>
  );
}

function PhotoRow({ urls, alt }: { urls: string[]; alt: string }) {
  if (urls.length === 0) return null;
  return (
    <Stack direction="row" gap={1} flexWrap="wrap">
      {urls.map((url) => (
        <ItemPhoto key={url} src={resolveUploadUrl(url)} alt={alt} size={72} />
      ))}
    </Stack>
  );
}

function CaseEntry({ caseItem, canOpenCases }: { caseItem: OrderHistoryCaseDTO; canOpenCases: boolean }) {
  const { t } = useTranslation("reporting", { keyPrefix: "orderHistory" });
  const { t: tCases } = useTranslation("complaints");
  const language = useActiveLanguage();
  return (
    <Stack spacing={0.5}>
      <Stack direction="row" gap={0.75} alignItems="center" flexWrap="wrap">
        {canOpenCases ? (
          <RouterLink to={`/cases/${caseItem.id}`} target="_blank" rel="noopener noreferrer">
            {caseItem.caseNumber}
          </RouterLink>
        ) : (
          <Typography variant="body2">{caseItem.caseNumber}</Typography>
        )}
        <Chip size="small" variant="outlined" label={tCases(`status.${caseItem.status}`)} />
        <Chip size="small" variant="outlined" label={tCases(`category.${caseItem.category}`)} />
        <Typography variant="caption" color="text.secondary">
          {formatDateTime(caseItem.createdAtISO, language)}
        </Typography>
      </Stack>
      <Typography variant="body2">{caseItem.subject}</Typography>
      <PhotoRow urls={caseItem.photoUrls} alt={t("casePhotoAlt")} />
    </Stack>
  );
}

/** Shopfa's own activity log for the order, as a table. Mounted (and so fetched: one Shopfa call) only once the user asks for it. */
function ShopfaActivitiesTable({ orderNumber }: { orderNumber: string }) {
  const { t } = useTranslation("reporting", { keyPrefix: "orderHistory" });
  const language = useActiveLanguage();
  const { data, isFetching, error, refetch } = useGetOrderActivitiesQuery(orderNumber);

  return (
    <Stack spacing={0.5}>
      {isFetching && !data && <Skeleton width="60%" />}
      {error && (
        <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
          <Typography variant="body2" color="error.main">
            {getApiErrorMessage(error) ?? t("activitiesError")}
          </Typography>
          <Button size="small" onClick={() => void refetch()} disabled={isFetching}>
            {t("retry")}
          </Button>
        </Stack>
      )}
      {data?.truncated && (
        <Typography variant="caption" color="text.secondary">
          {t("activitiesTruncated")}
        </Typography>
      )}
      {data && data.activities.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          {t("activitiesEmpty")}
        </Typography>
      )}
      {data && data.activities.length > 0 && (
        <TableContainer sx={{ maxHeight: 360 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>{t("activityDate")}</TableCell>
                <TableCell>{t("activityEvent")}</TableCell>
                <TableCell>{t("activityActor")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.activities.map((activity) => (
                <TableRow key={activity.id} hover>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>
                    {activity.atISO ? formatDateTime(activity.atISO, language) : "—"}
                  </TableCell>
                  {/* Shopfa's wording, always Persian whatever the UI language. */}
                  <TableCell dir="auto" sx={{ fontWeight: activity.statusTitle ? 600 : undefined }}>
                    {activity.event}
                  </TableCell>
                  <TableCell>{activity.actorName ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Stack>
  );
}

/**
 * The order's Shopfa activity log (the list its panel shows under "نمایش
 * فعالیت ها"), kept apart from what this system recorded and closed until
 * asked for.
 */
function ShopfaActivities({ orderNumber }: { orderNumber: string }) {
  const { t } = useTranslation("reporting", { keyPrefix: "orderHistory" });
  const [open, setOpen] = useState(false);

  return (
    <Stack spacing={0.5} alignItems="flex-start">
      <Button size="small" onClick={() => setOpen((value) => !value)} endIcon={open ? <ExpandLessIcon /> : <ExpandMoreIcon />}>
        {open ? t("hideActivities") : t("showActivities")}
      </Button>
      <Collapse in={open} timeout="auto" unmountOnExit sx={{ width: "100%" }}>
        <ShopfaActivitiesTable orderNumber={orderNumber} />
      </Collapse>
    </Stack>
  );
}

function OrderHistoryCard({
  order,
  defaultExpanded,
  canOpenCases,
}: {
  order: OrderHistoryReportOrderDTO;
  defaultExpanded: boolean;
  canOpenCases: boolean;
}) {
  const { t } = useTranslation("reporting", { keyPrefix: "orderHistory" });
  // Source and sync labels are the ones Packing already shows for the same records.
  const { t: tPacking } = useTranslation("packing");
  const language = useActiveLanguage();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const photoCount =
    order.packings.reduce((sum, packing) => sum + packing.photoUrls.length, 0) +
    order.cases.reduce((sum, caseItem) => sum + caseItem.photoUrls.length, 0);
  const hasHistory = order.statusChanges.length > 0 || order.packings.length > 0 || order.cases.length > 0;

  return (
    <Card variant="outlined" sx={{ borderRadius: "14px" }}>
      <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Stack spacing={0.75}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1} flexWrap="wrap">
            <Typography variant="subtitle1">{order.buyerName || t("guestBuyer")}</Typography>
            <Chip size="small" color="info" variant="outlined" label={order.statusTitle} />
          </Stack>
          <Typography variant="caption" color="text.secondary">
            {t("orderNumberLabel")}:{" "}
            <RouterLink to={`/reporting/orders/${encodeURIComponent(order.orderNumber)}`} target="_blank" rel="noopener noreferrer">
              {order.orderNumber}
            </RouterLink>
            {/* Phone numbers render exactly as stored -- see localeFormat.ts. */}
            {order.buyerMobile && (
              <>
                {" · "}
                <span dir="ltr">{order.buyerMobile}</span>
              </>
            )}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {[
              order.orderDateISO ? `${t("createdAt")}: ${formatDateTime(order.orderDateISO, language)}` : null,
              order.paymentDateISO ? `${t("paidAt")}: ${formatDateTime(order.paymentDateISO, language)}` : null,
              order.updatedAtISO ? `${t("updatedAt")}: ${formatDateTime(order.updatedAtISO, language)}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </Typography>
          <Stack direction="row" gap={0.75} flexWrap="wrap" alignItems="center">
            {order.shippingMethod && <Chip size="small" variant="outlined" label={order.shippingMethod} />}
            <Chip
              size="small"
              variant="outlined"
              label={t("itemsSummary", { items: order.itemCount, quantity: order.totalQuantity })}
            />
            <Chip
              size="small"
              variant={order.statusChanges.length > 0 ? "filled" : "outlined"}
              label={t("statusChangeCount", { count: order.statusChanges.length })}
            />
            <Chip
              size="small"
              variant={photoCount > 0 ? "filled" : "outlined"}
              label={t("photoCount", { count: photoCount })}
            />
            <Chip
              size="small"
              color={order.cases.length > 0 ? "warning" : "default"}
              variant={order.cases.length > 0 ? "filled" : "outlined"}
              label={t("caseCount", { count: order.cases.length })}
            />
            <Box sx={{ flexGrow: 1 }} />
            <Button
              size="small"
              onClick={() => setExpanded((open) => !open)}
              endIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            >
              {expanded ? t("hideHistory") : t("showHistory")}
            </Button>
          </Stack>

          <Collapse in={expanded} timeout="auto" unmountOnExit>
            <Stack spacing={1.25} divider={<Divider flexItem />} sx={{ pt: 0.5 }}>
              {!hasHistory && (
                <Typography variant="body2" color="text.secondary">
                  {t("noHistory")}
                </Typography>
              )}

              {order.statusChanges.length > 0 && (
                <Stack spacing={0.25}>
                  <SectionTitle>{t("statusChanges")}</SectionTitle>
                  {order.statusChanges.map((change) => (
                    <Typography key={`${change.changedAtISO}-${change.toStatusCode}`} variant="body2">
                      {formatDateTime(change.changedAtISO, language)} · {tPacking(`statusSource.${change.source}`)} →{" "}
                      {change.toStatusTitle}
                      {change.changedByName ? ` · ${change.changedByName}` : ""}
                    </Typography>
                  ))}
                </Stack>
              )}

              {order.packings.length > 0 && (
                <Stack spacing={1}>
                  <SectionTitle>{t("packings")}</SectionTitle>
                  {order.packings.map((packing) => (
                    <Stack key={packing.packingRecordId} spacing={0.5}>
                      <Stack direction="row" gap={0.75} alignItems="center" flexWrap="wrap">
                        <Typography variant="body2">
                          {t("sentAt")}: {formatDateTime(packing.sentAtISO, language)}
                          {packing.sentByName ? ` · ${t("sentBy")}: ${packing.sentByName}` : ""}
                        </Typography>
                        <Chip
                          size="small"
                          label={tPacking(`syncStatus.${packing.syncStatus}`)}
                          color={SYNC_CHIP_COLOR[packing.syncStatus]}
                        />
                      </Stack>
                      {packing.photoUrls.length > 0 ? (
                        <PhotoRow urls={packing.photoUrls} alt={t("packingPhotoAlt")} />
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          {t("noPackingPhoto")}
                        </Typography>
                      )}
                    </Stack>
                  ))}
                </Stack>
              )}

              {order.cases.length > 0 && (
                <Stack spacing={1}>
                  <SectionTitle>{t("cases")}</SectionTitle>
                  {order.cases.map((caseItem) => (
                    <CaseEntry key={caseItem.id} caseItem={caseItem} canOpenCases={canOpenCases} />
                  ))}
                </Stack>
              )}

              <ShopfaActivities orderNumber={order.orderNumber} />
            </Stack>
          </Collapse>
        </Stack>
      </CardContent>
    </Card>
  );
}

/**
 * Order History report: finds live Shopfa orders either by their current
 * status (within a last-updated time frame, like Status Check) or by a
 * search on phone number, order number or customer name, and shows what
 * this system recorded for each: the status changes it made from Order
 * Precheck/Packing, the packing passes with their pictures, and the cases
 * linked to the order (with their pictures). Shopfa's own activity log is a
 * separate table per order, loaded only when the user opens it. Live-API only.
 */
export function OrderHistoryReportPage() {
  const { t } = useTranslation("reporting", { keyPrefix: "orderHistory" });
  const language = useActiveLanguage();
  const { data: appConfig } = useGetAppConfigQuery();
  const isLiveApi = appConfig?.dataSource === DataSource.LIVE_API;
  const user = useAppSelector((state) => state.auth.user);
  const canOpenCases = Boolean(user && hasMenuAccess(user, MenuKey.CASES));

  const [mode, setMode] = useState<Mode>("search");
  const [statusCode, setStatusCode] = useState(DEFAULT_STATUS_CODE);
  const [days, setDays] = useState<OrderHistoryReportRangeDays>(DEFAULT_ORDER_HISTORY_REPORT_RANGE_DAYS);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<OrderHistoryReportResultDTO | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_STEP);
  /** What was last sent to the API, so Retry re-runs that request rather than unapplied inputs. */
  const appliedRef = useRef<GetOrderHistoryReportArgs | null>(null);

  const [fetchReport, { isFetching, error }] = useLazyGetOrderHistoryReportQuery();

  const trimmedQuery = query.trim();
  const canRun = isLiveApi && !isFetching && (mode === "status" || trimmedQuery.length >= ORDER_HISTORY_REPORT_MIN_QUERY_LENGTH);

  const run = async (args: GetOrderHistoryReportArgs) => {
    appliedRef.current = args;
    const data = await fetchReport(args).unwrap().catch(() => null);
    setResult(data);
    setVisibleCount(PAGE_STEP);
  };

  const submit = () => {
    if (!canRun) return;
    void run(mode === "status" ? { statusCode, days } : { query: trimmedQuery });
  };

  return (
    <Stack spacing={2}>
      <Stack spacing={0.5}>
        <Typography variant="h1">{t("title")}</Typography>
        <Typography variant="body2" color="text.secondary">
          {t("description")}
        </Typography>
      </Stack>

      {!isLiveApi && <Alert severity="warning">{t("liveApiRequired")}</Alert>}

      <Card variant="outlined" sx={{ borderRadius: "14px" }}>
        <CardContent>
          <Stack spacing={1.5}>
            <ToggleButtonGroup
              exclusive
              fullWidth
              size="small"
              color="primary"
              value={mode}
              onChange={(_event, value: Mode | null) => value && setMode(value)}
              disabled={!isLiveApi}
            >
              <ToggleButton value="search">{t("modeSearch")}</ToggleButton>
              <ToggleButton value="status">{t("modeStatus")}</ToggleButton>
            </ToggleButtonGroup>

            {mode === "search" ? (
              <TextField
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                }}
                label={t("searchLabel")}
                helperText={t("searchHelper", { count: ORDER_HISTORY_REPORT_MIN_QUERY_LENGTH })}
                fullWidth
                disabled={!isLiveApi}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    ),
                  },
                }}
              />
            ) : (
              <Stack direction={{ xs: "column", sm: "row" }} gap={1.5}>
                <FormControl fullWidth>
                  <InputLabel id="order-history-status-label">{t("status")}</InputLabel>
                  <Select
                    labelId="order-history-status-label"
                    label={t("status")}
                    value={statusCode}
                    onChange={(e: SelectChangeEvent<number>) => setStatusCode(Number(e.target.value))}
                    disabled={!isLiveApi}
                  >
                    {SHOPFA_ORDER_STATUS_OPTIONS.map((option) => (
                      <MenuItem key={option.code} value={option.code}>
                        {option.statusTitle}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl fullWidth>
                  <InputLabel id="order-history-range-label">{t("timeFrame")}</InputLabel>
                  <Select
                    labelId="order-history-range-label"
                    label={t("timeFrame")}
                    value={days}
                    onChange={(e: SelectChangeEvent<number>) => setDays(Number(e.target.value) as OrderHistoryReportRangeDays)}
                    disabled={!isLiveApi}
                  >
                    {ORDER_HISTORY_REPORT_RANGE_DAYS_VALUES.map((value) => (
                      <MenuItem key={value} value={value}>
                        {t(`range.${value}`)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>
            )}

            <Button variant="contained" size="large" onClick={submit} disabled={!canRun}>
              {t("generate")}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {isFetching && (
        <Box>
          <LinearProgress />
          <Typography variant="caption" color="text.secondary">
            {t("loading")}
          </Typography>
        </Box>
      )}

      {error && (
        <UpstreamErrorAlert
          error={error}
          fallbackMessage={t("generateError")}
          isRetrying={isFetching}
          onRetry={() => {
            if (appliedRef.current) void run(appliedRef.current);
          }}
        />
      )}

      {result && !isFetching && (
        <>
          <Typography variant="caption" color="text.secondary">
            {result.query !== null
              ? t("searchShown", { query: result.query, count: result.orders.length })
              : result.rangeFromISO && result.rangeToISO
                ? t("rangeShown", {
                    count: result.orders.length,
                    from: formatDateTime(result.rangeFromISO, language),
                    to: formatDateTime(result.rangeToISO, language),
                  })
                : t("rangeAll", { count: result.orders.length })}
          </Typography>

          {result.truncated && <Alert severity="info">{t("truncated")}</Alert>}

          {result.orders.length === 0 ? (
            <EmptyState message={result.query !== null ? t("noSearchMatches") : t("noOrders")} />
          ) : (
            <Stack spacing={1.5}>
              {result.orders.slice(0, visibleCount).map((order) => (
                <OrderHistoryCard
                  // The generation time is part of the key so a re-run resets each card's expanded state.
                  key={`${result.generatedAtISO}-${order.orderNumber}`}
                  order={order}
                  defaultExpanded={result.orders.length <= AUTO_EXPAND_MAX_ORDERS}
                  canOpenCases={canOpenCases}
                />
              ))}
              {result.orders.length > visibleCount && (
                <Button variant="outlined" onClick={() => setVisibleCount((count) => count + PAGE_STEP)}>
                  {t("showMore", { remaining: result.orders.length - visibleCount })}
                </Button>
              )}
            </Stack>
          )}
        </>
      )}
    </Stack>
  );
}
