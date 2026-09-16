import { useEffect, useState } from "react";
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
import Collapse from "@mui/material/Collapse";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select, { type SelectChangeEvent } from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { useTranslation } from "react-i18next";
import { useLazyListPackingOrdersQuery, useSendPackedOrderMutation } from "../api/packingApi";
import { DEFAULT_PACKING_RANGE_DAYS, PACKING_RANGE_DAYS_VALUES, type PackingOrderDTO, type PackingRangeDays } from "../types";
import { PackingItemTile } from "../components/PackingItemTile";
import { useGetSettingsQuery } from "../../settings/api/settingsApi";
import { getApiErrorMessage } from "../../../utils/apiError";
import { formatDateTime } from "../../../utils/localeFormat";
import { useActiveLanguage } from "../../../i18n/useActiveLanguage";

/**
 * Packing: a mobile/tablet-first, one-order-at-a-time screen for warehouse
 * staff physically boxing orders that are "ارسال شده به سرویس پستی". Every
 * item is a large picture-only tile (see PackingItemTile) tapped to toggle
 * between unpacked (orange frame) and packed (green frame) for this
 * session -- unlike Order Precheck, nothing is persisted to the admin note,
 * so leaving and coming back to an order resets its tiles. Once every item
 * is packed, Send moves the order to "ارسال شده" and advances to the next
 * one. Live-API only, same as Order Precheck and Reporting's shortage
 * report.
 */
export function PackingPage() {
  const { t } = useTranslation("packing");
  const language = useActiveLanguage();
  const { data: settings } = useGetSettingsQuery();
  const isLiveApi = settings?.dataSource === DataSource.LIVE_API;

  const [days, setDays] = useState<PackingRangeDays>(DEFAULT_PACKING_RANGE_DAYS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [orders, setOrders] = useState<PackingOrderDTO[] | null>(null);
  const [rangeShown, setRangeShown] = useState<{ fromISO: string; toISO: string } | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [packedCodes, setPackedCodes] = useState<Set<string>>(new Set());
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccessMessage, setSendSuccessMessage] = useState<string | null>(null);

  const [fetchOrders, { isFetching, error }] = useLazyListPackingOrdersQuery();
  const [sendPackedOrder, { isLoading: isSending }] = useSendPackedOrderMutation();

  const loadOrders = async (selectedDays: PackingRangeDays) => {
    if (!isLiveApi) return;
    setSendError(null);
    setSendSuccessMessage(null);
    const result = await fetchOrders({ days: selectedDays }).unwrap().catch(() => null);
    setOrders(result?.orders ?? null);
    setRangeShown(result ? { fromISO: result.rangeFromISO, toISO: result.rangeToISO } : null);
    setCurrentIndex(0);
    setPackedCodes(new Set());
  };

  useEffect(() => {
    if (isLiveApi) void loadOrders(days);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLiveApi]);

  const handleDaysChange = (e: SelectChangeEvent<number>) => {
    setDays(Number(e.target.value) as PackingRangeDays);
  };

  const currentOrder = orders?.[currentIndex] ?? null;
  const totalQuantity = currentOrder ? currentOrder.items.reduce((sum, item) => sum + item.quantity, 0) : 0;
  const allPacked = currentOrder ? currentOrder.items.every((item) => packedCodes.has(item.productCode)) : false;

  const toggleItemPacked = (productCode: string) => {
    setPackedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(productCode)) next.delete(productCode);
      else next.add(productCode);
      return next;
    });
  };

  const goToIndex = (index: number) => {
    setCurrentIndex(index);
    setPackedCodes(new Set());
  };

  const handleSend = async () => {
    if (!currentOrder || !allPacked) return;
    const orderNumber = currentOrder.orderNumber;
    setSendError(null);
    setSendSuccessMessage(null);
    try {
      await sendPackedOrder({ orderNumber }).unwrap();
      setSendSuccessMessage(t("sendSuccess"));
      setOrders((prev) => (prev ? prev.filter((order) => order.orderNumber !== orderNumber) : prev));
      setPackedCodes(new Set());
      setCurrentIndex((idx) => Math.max(0, Math.min(idx, (orders?.length ?? 1) - 2)));
    } catch (err) {
      setSendError(getApiErrorMessage(err) ?? t("sendError"));
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
            <ListItemText primary={t("timeFrame")} secondary={t(`range.${days}`)} />
            {filterOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </ListItemButton>
          <Collapse in={filterOpen}>
            <Stack spacing={1.5} sx={{ pt: 1 }}>
              <FormControl size="small" sx={{ maxWidth: 260 }}>
                <InputLabel id="packing-range-label">{t("timeFrame")}</InputLabel>
                <Select
                  labelId="packing-range-label"
                  label={t("timeFrame")}
                  value={days}
                  onChange={handleDaysChange}
                  disabled={!isLiveApi}
                >
                  {PACKING_RANGE_DAYS_VALUES.map((value) => (
                    <MenuItem key={value} value={value}>
                      {t(`range.${value}`)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button
                variant="contained"
                onClick={() => {
                  setFilterOpen(false);
                  void loadOrders(days);
                }}
                disabled={!isLiveApi || isFetching}
                sx={{ alignSelf: "flex-start" }}
              >
                {t("apply")}
              </Button>
            </Stack>
          </Collapse>
        </CardContent>
      </Card>

      {rangeShown && !isFetching && (
        <Typography variant="caption" color="text.secondary">
          {t("rangeShown", {
            from: formatDateTime(rangeShown.fromISO, language),
            to: formatDateTime(rangeShown.toISO, language),
          })}
        </Typography>
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
      {sendSuccessMessage && !sendError && <Alert severity="success">{sendSuccessMessage}</Alert>}
      {sendError && <Alert severity="error">{sendError}</Alert>}

      {orders && orders.length === 0 && !isFetching && <Alert severity="info">{t("noOrders")}</Alert>}

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
                </Stack>
                <Chip label={t("progress", { current: currentIndex + 1, total: orders?.length ?? 0 })} />
              </Stack>
            </CardContent>
          </Card>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: 2,
            }}
          >
            {currentOrder.items.map((item) => (
              <PackingItemTile
                key={item.productCode}
                item={item}
                packed={packedCodes.has(item.productCode)}
                onToggle={() => toggleItemPacked(item.productCode)}
              />
            ))}
          </Box>

          {!allPacked && (
            <Typography variant="caption" color="text.secondary">
              {t("sendHint")}
            </Typography>
          )}

          {/*
            Sticky rather than plain end-of-page flow, same fix already
            applied to Order Precheck's action bar: an order with several
            item tiles can push these controls well below the fold on a
            phone, and this keeps them reachable while staying clear of
            MainLayout's fixed bottom navigation bar (64px + safe-area).
          */}
          <Stack
            direction="row"
            spacing={1.5}
            sx={{
              position: { xs: "sticky", md: "static" },
              bottom: { xs: "calc(64px + env(safe-area-inset-bottom) + 8px)", md: "auto" },
              zIndex: 1,
              bgcolor: "background.paper",
              borderRadius: "14px",
              boxShadow: { xs: 4, md: 0 },
              p: { xs: 1.5, md: 0 },
            }}
          >
            <Button fullWidth variant="outlined" disabled={currentIndex === 0} onClick={() => goToIndex(currentIndex - 1)}>
              {t("previous")}
            </Button>
            <Button
              fullWidth
              variant="contained"
              color="success"
              disabled={!allPacked || isSending}
              onClick={handleSend}
              startIcon={isSending ? <CircularProgress size={14} /> : undefined}
            >
              {t("sendWithTotal", { total: totalQuantity })}
            </Button>
            <Button
              fullWidth
              variant="outlined"
              disabled={!orders || currentIndex >= orders.length - 1}
              onClick={() => goToIndex(currentIndex + 1)}
            >
              {t("next")}
            </Button>
          </Stack>
        </>
      )}
    </Stack>
  );
}
