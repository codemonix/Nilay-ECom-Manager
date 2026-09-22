import { useEffect, useMemo, useRef, useState } from "react";
import {
  DataSource,
  DEFAULT_ORDERS_BY_STATUS_RANGE_DAYS,
  ORDERS_BY_STATUS_RANGE_DAYS_VALUES,
  SHOPFA_ORDER_STATUS_OPTIONS,
  type OrdersByStatusRangeDays,
  type OrdersByStatusResultDTO,
} from "@complaint-system/shared";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import LinearProgress from "@mui/material/LinearProgress";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select, { type SelectChangeEvent } from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import Box from "@mui/material/Box";
import SearchIcon from "@mui/icons-material/Search";
import { useTranslation } from "react-i18next";
import { useLazyListOrdersByStatusQuery } from "../api/ordersByStatusApi";
import { useGetSettingsQuery } from "../../settings/api/settingsApi";
import { UpstreamErrorAlert } from "../../../components/UpstreamErrorAlert";
import { EmptyState } from "../../../components/EmptyState";
import { ItemPhoto } from "../../../components/ItemPhoto";
import { resolveUploadUrl } from "../../../utils/attachments";
import { formatDateTime } from "../../../utils/localeFormat";
import { matchesOrderSearch, normalizeSearchQuery } from "../../../utils/orderSearch";
import { useActiveLanguage } from "../../../i18n/useActiveLanguage";

const PAGE_STEP = 50;
/** "پردازش انبار" -- a sensible first look; staff pick whichever statuses they need. */
const DEFAULT_STATUS_CODES = [8];

/**
 * Status Check ("بررسی وضعیت"): a read-only view of live Shopfa orders in any
 * chosen statuses, showing what is going on RIGHT NOW. Its time frame is on
 * each order's LAST-UPDATED date (default: the last 7 days), newest activity
 * first -- unlike Precheck/Packing, whose windows are on creation date.
 * Orders sent from Packing show their final packing pictures. Filters are
 * applied with Load; the search box then narrows the loaded list by customer
 * name, phone number or order number. Live-API only.
 */
export function OrdersByStatusPage() {
  const { t } = useTranslation("ordersByStatus");
  const language = useActiveLanguage();
  const { data: settings } = useGetSettingsQuery();
  const isLiveApi = settings?.dataSource === DataSource.LIVE_API;

  const [selectedCodes, setSelectedCodes] = useState<number[]>(DEFAULT_STATUS_CODES);
  const [days, setDays] = useState<OrdersByStatusRangeDays>(DEFAULT_ORDERS_BY_STATUS_RANGE_DAYS);
  const [result, setResult] = useState<OrdersByStatusResultDTO | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_STEP);
  /** What was last sent to the API, so Retry re-runs that request rather than unapplied selections. */
  const appliedRef = useRef({ statusCodes: DEFAULT_STATUS_CODES, days: DEFAULT_ORDERS_BY_STATUS_RANGE_DAYS });

  const [fetchOrders, { isFetching, error }] = useLazyListOrdersByStatusQuery();

  const load = async (statusCodes: number[], selectedDays: OrdersByStatusRangeDays) => {
    if (!isLiveApi || statusCodes.length === 0) return;
    appliedRef.current = { statusCodes, days: selectedDays };
    const data = await fetchOrders({ statusCodes, days: selectedDays }).unwrap().catch(() => null);
    setResult(data);
    setVisibleCount(PAGE_STEP);
  };

  useEffect(() => {
    if (isLiveApi) void load(selectedCodes, days);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLiveApi]);

  const toggleCode = (code: number) =>
    setSelectedCodes((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));

  const normalizedQuery = normalizeSearchQuery(searchQuery);
  const matching = useMemo(
    () => (result?.orders ?? []).filter((order) => matchesOrderSearch({ ...order }, normalizedQuery)),
    [result, normalizedQuery],
  );

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
            <Typography variant="subtitle2">{t("statuses")}</Typography>
            <Stack direction="row" gap={1} flexWrap="wrap">
              {SHOPFA_ORDER_STATUS_OPTIONS.map((option) => (
                <Chip
                  key={option.code}
                  label={option.statusTitle}
                  color="primary"
                  variant={selectedCodes.includes(option.code) ? "filled" : "outlined"}
                  onClick={() => toggleCode(option.code)}
                  disabled={!isLiveApi}
                />
              ))}
            </Stack>
            <FormControl fullWidth>
              <InputLabel id="orders-by-status-range-label">{t("timeFrame")}</InputLabel>
              <Select
                labelId="orders-by-status-range-label"
                label={t("timeFrame")}
                value={days}
                onChange={(e: SelectChangeEvent<number>) => setDays(Number(e.target.value) as OrdersByStatusRangeDays)}
                disabled={!isLiveApi}
              >
                {ORDERS_BY_STATUS_RANGE_DAYS_VALUES.map((value) => (
                  <MenuItem key={value} value={value}>
                    {t(`range.${value}`)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              variant="contained"
              size="large"
              onClick={() => void load(selectedCodes, days)}
              disabled={!isLiveApi || selectedCodes.length === 0 || isFetching}
            >
              {t("load")}
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
          fallbackMessage={t("loadError")}
          isRetrying={isFetching}
          onRetry={() => void load(appliedRef.current.statusCodes, appliedRef.current.days)}
        />
      )}

      {result && !isFetching && (
        <>
          <Typography variant="caption" color="text.secondary">
            {result.rangeFromISO && result.rangeToISO
              ? t("rangeShown", {
                  from: formatDateTime(result.rangeFromISO, language),
                  to: formatDateTime(result.rangeToISO, language),
                })
              : t("rangeAll")}
          </Typography>

          <Stack direction="row" gap={1} flexWrap="wrap">
            {result.countsByStatus.map((entry) => (
              <Chip
                key={entry.statusCode}
                size="small"
                variant="outlined"
                color={entry.totalInStatus !== null && entry.totalInStatus > entry.count ? "warning" : "default"}
                label={
                  entry.totalInStatus !== null && entry.totalInStatus !== entry.count
                    ? t("countOfTotal", { title: entry.statusTitle, count: entry.count, total: entry.totalInStatus })
                    : `${entry.statusTitle}: ${entry.count}`
                }
              />
            ))}
          </Stack>

          <TextField
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setVisibleCount(PAGE_STEP);
            }}
            placeholder={t("search")}
            fullWidth
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
          {normalizedQuery && (
            <Typography variant="caption" color="text.secondary">
              {t("searchResults", { count: matching.length })}
            </Typography>
          )}

          {matching.length === 0 ? (
            <EmptyState message={result.orders.length === 0 ? t("noOrders") : t("noSearchMatches")} />
          ) : (
            <Stack spacing={1.5}>
              {matching.slice(0, visibleCount).map((order) => (
                <Card key={order.orderNumber} variant="outlined" sx={{ borderRadius: "14px" }}>
                  <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                    <Stack spacing={0.5}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1} flexWrap="wrap">
                        <Typography variant="subtitle1">{order.buyerName || t("guestBuyer")}</Typography>
                        <Chip size="small" color="info" variant="outlined" label={order.statusTitle} />
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        {t("orderNumberLabel")}: {order.orderNumber}
                        {order.buyerMobile ? ` · ${order.buyerMobile}` : ""}
                      </Typography>
                      {order.updatedAtISO && (
                        <Typography variant="caption" color="text.secondary" fontWeight={600}>
                          {t("updatedAt")}: {formatDateTime(order.updatedAtISO, language)}
                        </Typography>
                      )}
                      <Typography variant="caption" color="text.secondary">
                        {order.paymentDateISO
                          ? `${t("paidAt")}: ${formatDateTime(order.paymentDateISO, language)}`
                          : order.orderDateISO
                            ? `${t("createdAt")}: ${formatDateTime(order.orderDateISO, language)}`
                            : ""}
                      </Typography>
                      <Stack direction="row" gap={0.75} flexWrap="wrap">
                        <Chip size="small" variant="outlined" label={order.shippingMethod ?? t("shippingUnknown")} />
                        <Chip
                          size="small"
                          variant="outlined"
                          label={t("itemsSummary", { items: order.itemCount, quantity: order.totalQuantity })}
                        />
                      </Stack>
                      {order.packingPhotoUrls.length > 0 && (
                        <Stack spacing={0.5} sx={{ pt: 0.5 }}>
                          <Typography variant="caption" color="text.secondary">
                            {t("packingPhotos")}
                          </Typography>
                          <Stack direction="row" gap={1} flexWrap="wrap">
                            {order.packingPhotoUrls.map((url) => (
                              <ItemPhoto key={url} src={resolveUploadUrl(url)} alt={t("packingPhotos")} size={72} />
                            ))}
                          </Stack>
                        </Stack>
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              ))}
              {matching.length > visibleCount && (
                <Button variant="outlined" onClick={() => setVisibleCount((count) => count + PAGE_STEP)}>
                  {t("showMore", { remaining: matching.length - visibleCount })}
                </Button>
              )}
            </Stack>
          )}
        </>
      )}
    </Stack>
  );
}
