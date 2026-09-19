import { useEffect, useMemo, useState } from "react";
import { DataSource } from "@complaint-system/shared";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import LinearProgress from "@mui/material/LinearProgress";
import Chip from "@mui/material/Chip";
import Box from "@mui/material/Box";
import FormGroup from "@mui/material/FormGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import Collapse from "@mui/material/Collapse";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import SearchIcon from "@mui/icons-material/Search";
import HistoryIcon from "@mui/icons-material/History";
import { useTranslation } from "react-i18next";
import { useLazyListOrderPrecheckOrdersQuery, useSaveOrderPrecheckMutation } from "../api/orderPrecheckApi";
import {
  ORDER_PRECHECK_DEFAULT_STATUS_CODES,
  SHOPFA_ORDER_STATUS_OPTIONS,
  type OrderPrecheckOrderDTO,
} from "../types";
import { OrderPrecheckItemCard } from "../components/OrderPrecheckItemCard";
import { FixedActionBar } from "../../../components/FixedActionBar";
import { useGetSettingsQuery } from "../../settings/api/settingsApi";
import { getApiErrorMessage } from "../../../utils/apiError";
import { formatDateTime } from "../../../utils/localeFormat";
import { useActiveLanguage } from "../../../i18n/useActiveLanguage";

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

/** Lets staff search with a Persian keyboard's digit glyphs and still match a (Latin-digit) order number. */
function normalizeDigits(value: string): string {
  return value.replace(/[۰-۹]/g, (digit) => String(PERSIAN_DIGITS.indexOf(digit)));
}

function matchesSearch(order: OrderPrecheckOrderDTO, query: string): boolean {
  if (!query) return true;
  return order.orderNumber.toLowerCase().includes(query) || (order.buyerName ?? "").toLowerCase().includes(query);
}

function statusTitle(code: number): string {
  return SHOPFA_ORDER_STATUS_OPTIONS.find((option) => option.code === code)?.statusTitle ?? String(code);
}

/**
 * Order Precheck: a mobile/tablet-first, one-order-at-a-time review screen
 * for warehouse staff. Orders in the selected Shopfa statuses (default
 * "پرداخت تائيد شده") are fetched once into a local working queue; marking
 * each item available/unavailable and saving either advances the order to
 * "ارسال شده به سرویس پستی" or bounces it to "پردازش انبار" (see
 * orderPrecheckService.saveOrderPrecheck on the API side). A saved order is
 * removed from the local queue immediately rather than re-fetching the
 * whole list, so Next/Previous stay snappy; use "Reload" to re-sync with
 * the server. The search box filters this same loaded queue by buyer name
 * or order number (client-side, not another Shopfa call) so staff can jump
 * straight to a specific order instead of paging through with Next/
 * Previous. Live-API only, same as Reporting's shortage report.
 */
export function OrderPrecheckPage() {
  const { t } = useTranslation("orderPrecheck");
  const language = useActiveLanguage();
  const { data: settings } = useGetSettingsQuery();
  const isLiveApi = settings?.dataSource === DataSource.LIVE_API;

  const [selectedCodes, setSelectedCodes] = useState<number[]>(ORDER_PRECHECK_DEFAULT_STATUS_CODES);
  const [filterOpen, setFilterOpen] = useState(false);
  const [orders, setOrders] = useState<OrderPrecheckOrderDTO[] | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  const [fetchOrders, { isFetching, error }] = useLazyListOrderPrecheckOrdersQuery();
  const [saveOrder, { isLoading: isSaving }] = useSaveOrderPrecheckMutation();

  const loadOrders = async (codes: number[]) => {
    if (!isLiveApi || codes.length === 0) return;
    setSaveError(null);
    setSaveSuccessMessage(null);
    setSearchQuery("");
    const result = await fetchOrders({ statusCodes: codes }).unwrap().catch(() => null);
    setOrders(result?.orders ?? null);
    setCurrentIndex(0);
  };

  useEffect(() => {
    if (isLiveApi) void loadOrders(selectedCodes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLiveApi]);

  const toggleCode = (code: number) => {
    setSelectedCodes((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  };

  const normalizedQuery = normalizeDigits(searchQuery.trim().toLowerCase());
  const visibleOrders = useMemo(
    () => (orders ?? []).filter((order) => matchesSearch(order, normalizedQuery)),
    [orders, normalizedQuery],
  );

  useEffect(() => {
    setCurrentIndex(0);
  }, [normalizedQuery]);

  const currentOrder = visibleOrders[currentIndex] ?? null;
  const allDecided = currentOrder ? currentOrder.items.every((item) => item.available !== null) : false;

  const setItemAvailability = (productCode: string, available: boolean) => {
    if (!currentOrder) return;
    const orderNumber = currentOrder.orderNumber;
    setOrders((prev) => {
      if (!prev) return prev;
      return prev.map((order) =>
        order.orderNumber === orderNumber
          ? {
              ...order,
              items: order.items.map((item) => (item.productCode === productCode ? { ...item, available } : item)),
            }
          : order,
      );
    });
  };

  const handleSave = async () => {
    if (!currentOrder || !allDecided) return;
    const orderNumber = currentOrder.orderNumber;
    setSaveError(null);
    setSaveSuccessMessage(null);
    try {
      const result = await saveOrder({
        orderNumber,
        items: currentOrder.items.map((item) => ({
          productCode: item.productCode,
          available: item.available as boolean,
        })),
      }).unwrap();
      setSaveSuccessMessage(
        result.unavailableProductCodes.length === 0
          ? t("saveSuccessAllAvailable")
          : t("saveSuccessSomeUnavailable"),
      );
      setOrders((prev) => (prev ? prev.filter((order) => order.orderNumber !== orderNumber) : prev));
      setCurrentIndex((idx) => Math.max(0, Math.min(idx, visibleOrders.length - 2)));
    } catch (err) {
      setSaveError(getApiErrorMessage(err) ?? t("saveError"));
    }
  };

  return (
    <Stack spacing={2}>
      <Typography variant="h1">{t("title")}</Typography>
      <Typography variant="body2" color="text.secondary">
        {t("description")}
      </Typography>

      {!isLiveApi && <Alert severity="warning">{t("liveApiRequired")}</Alert>}

      <Card variant="outlined" sx={{ borderRadius: "14px" }}>
        <CardContent>
          <ListItemButton onClick={() => setFilterOpen((prev) => !prev)} sx={{ borderRadius: "10px", px: 0 }}>
            <ListItemText primary={t("statuses")} secondary={selectedCodes.map(statusTitle).join("، ")} />
            {filterOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </ListItemButton>
          <Collapse in={filterOpen}>
            <Stack spacing={1.5} sx={{ pt: 1 }}>
              <FormGroup>
                {SHOPFA_ORDER_STATUS_OPTIONS.map((option) => (
                  <FormControlLabel
                    key={option.code}
                    control={
                      <Checkbox
                        size="small"
                        checked={selectedCodes.includes(option.code)}
                        onChange={() => toggleCode(option.code)}
                        disabled={!isLiveApi}
                      />
                    }
                    label={option.statusTitle}
                  />
                ))}
              </FormGroup>
              <Button
                variant="contained"
                onClick={() => {
                  setFilterOpen(false);
                  void loadOrders(selectedCodes);
                }}
                disabled={!isLiveApi || selectedCodes.length === 0 || isFetching}
                sx={{ alignSelf: "flex-start" }}
              >
                {t("apply")}
              </Button>
            </Stack>
          </Collapse>
        </CardContent>
      </Card>

      {orders && orders.length > 0 && (
        <TextField
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t("search")}
          size="small"
          fullWidth
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />
      )}

      {isFetching && (
        <Box>
          <LinearProgress />
          <Typography variant="caption" color="text.secondary">
            {t("loading")}
          </Typography>
        </Box>
      )}

      {error && <Alert severity="error">{getApiErrorMessage(error) ?? t("loadError")}</Alert>}
      {saveSuccessMessage && !saveError && <Alert severity="success">{saveSuccessMessage}</Alert>}
      {saveError && <Alert severity="error">{saveError}</Alert>}

      {orders && orders.length === 0 && !isFetching && <Alert severity="info">{t("noOrders")}</Alert>}
      {orders && orders.length > 0 && visibleOrders.length === 0 && (
        <Alert severity="info">{t("noSearchMatches")}</Alert>
      )}

      {currentOrder && (
        <>
          <Card sx={{ borderRadius: "14px" }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={1}>
                <Stack spacing={0.25}>
                  <Typography variant="subtitle1">{currentOrder.buyerName || t("guestBuyer")}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t("orderNumberLabel")}: {currentOrder.orderNumber}
                    {currentOrder.orderDateISO ? ` · ${formatDateTime(currentOrder.orderDateISO, language)}` : ""}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {currentOrder.statusTitle}
                  </Typography>
                </Stack>
                <Chip label={t("progress", { current: currentIndex + 1, total: visibleOrders.length })} />
              </Stack>
            </CardContent>
          </Card>

          {currentOrder.restoredFromPreviousPrecheck && (
            <Alert severity="info" icon={<HistoryIcon fontSize="small" />}>
              {t("restoredNotice")}
            </Alert>
          )}

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 2,
            }}
          >
            {currentOrder.items.map((item) => (
              <OrderPrecheckItemCard
                key={item.productCode}
                item={item}
                onChange={(available) => setItemAvailability(item.productCode, available)}
              />
            ))}
          </Box>

          {!allDecided && (
            <Typography variant="caption" color="text.secondary">
              {t("decideAllHint")}
            </Typography>
          )}
          <FixedActionBar>
            <Button
              fullWidth
              variant="outlined"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex((idx) => idx - 1)}
            >
              {t("previous")}
            </Button>
            <Button
              fullWidth
              variant="contained"
              disabled={!allDecided || isSaving}
              onClick={handleSave}
              startIcon={isSaving ? <CircularProgress size={14} /> : undefined}
            >
              {t("save")}
            </Button>
            <Button
              fullWidth
              variant="outlined"
              disabled={currentIndex >= visibleOrders.length - 1}
              onClick={() => setCurrentIndex((idx) => idx + 1)}
            >
              {t("next")}
            </Button>
          </FixedActionBar>
        </>
      )}
    </Stack>
  );
}
