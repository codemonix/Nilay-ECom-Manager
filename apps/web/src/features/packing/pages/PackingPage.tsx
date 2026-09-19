import { useEffect, useRef, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
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
import Divider from "@mui/material/Divider";
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
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import HistoryIcon from "@mui/icons-material/History";
import { useTranslation } from "react-i18next";
import { useLazyListPackingOrdersQuery, useSendPackedOrderMutation } from "../api/packingApi";
import { DEFAULT_PACKING_RANGE_DAYS, PACKING_RANGE_DAYS_VALUES, type PackingOrderDTO, type PackingRangeDays } from "../types";
import { PackingItemTile } from "../components/PackingItemTile";
import { ConfirmSendDialog } from "../components/ConfirmSendDialog";
import { CameraCaptureDialog } from "../../../components/CameraCaptureDialog";
import { FixedActionBar } from "../../../components/FixedActionBar";
import { useGetSettingsQuery } from "../../settings/api/settingsApi";
import { getApiErrorMessage } from "../../../utils/apiError";
import { formatDateTime } from "../../../utils/localeFormat";
import { useActiveLanguage } from "../../../i18n/useActiveLanguage";

const hasCameraApi = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

/**
 * Packing: a mobile/tablet-first, one-order-at-a-time screen for warehouse
 * staff physically boxing orders that are "ارسال شده به سرویس پستی". Every
 * item is a large picture-only tile (see PackingItemTile) tapped to toggle
 * between unpacked (orange frame) and packed (green frame) for this
 * session -- unlike Order Precheck, nothing is persisted to the admin note,
 * so leaving and coming back to an order resets its tiles. Once every item
 * is packed, Send moves the order to "ارسال شده" and advances to the next
 * one. A confirmation photo can be taken any time before sending (the
 * camera button below the order header); if Send is tapped without one,
 * ConfirmSendDialog offers to take it right there or send anyway. Every
 * send is also recorded locally (packingService.markOrderPacked) so its
 * history and photo can be browsed later, since Shopfa itself keeps none
 * -- see PackingHistoryPage. Live-API only, same as Order Precheck and
 * Reporting's shortage report.
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

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [cameraDialogOpen, setCameraDialogOpen] = useState(false);
  const [confirmSendDialogOpen, setConfirmSendDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fetchOrders, { isFetching, error }] = useLazyListPackingOrdersQuery();
  const [sendPackedOrder, { isLoading: isSending }] = useSendPackedOrderMutation();

  const clearPhoto = () => {
    setPhotoFile(null);
    setPhotoPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  };

  const loadOrders = async (selectedDays: PackingRangeDays) => {
    if (!isLiveApi) return;
    setSendError(null);
    setSendSuccessMessage(null);
    const result = await fetchOrders({ days: selectedDays }).unwrap().catch(() => null);
    setOrders(result?.orders ?? null);
    setRangeShown(result ? { fromISO: result.rangeFromISO, toISO: result.rangeToISO } : null);
    setCurrentIndex(0);
    setPackedCodes(new Set());
    clearPhoto();
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
    clearPhoto();
  };

  const openCameraCapture = () => {
    if (hasCameraApi) {
      setCameraDialogOpen(true);
    } else {
      fileInputRef.current?.click();
    }
  };

  const applyPhoto = (file: File) => {
    setPhotoFile(file);
    setPhotoPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  };

  const handlePhotoCaptured = (file: File) => {
    applyPhoto(file);
    setCameraDialogOpen(false);
  };

  const handleFilePickerChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) applyPhoto(file);
    event.target.value = "";
  };

  const useFilePickerFallback = () => {
    setCameraDialogOpen(false);
    fileInputRef.current?.click();
  };

  const performSend = async () => {
    if (!currentOrder) return;
    const orderNumber = currentOrder.orderNumber;
    setSendError(null);
    setSendSuccessMessage(null);
    try {
      await sendPackedOrder({
        orderNumber,
        externalOrderId: currentOrder.externalOrderId,
        buyerName: currentOrder.buyerName,
        items: currentOrder.items.map((item) => ({
          productCode: item.productCode,
          title: item.title,
          quantity: item.quantity,
        })),
        photo: photoFile ?? undefined,
      }).unwrap();
      setSendSuccessMessage(t("sendSuccess"));
      setConfirmSendDialogOpen(false);
      setOrders((prev) => (prev ? prev.filter((order) => order.orderNumber !== orderNumber) : prev));
      setPackedCodes(new Set());
      clearPhoto();
      setCurrentIndex((idx) => Math.max(0, Math.min(idx, (orders?.length ?? 1) - 2)));
    } catch (err) {
      setSendError(getApiErrorMessage(err) ?? t("sendError"));
    }
  };

  const handleSendClick = () => {
    if (!currentOrder || !allPacked) return;
    if (photoFile) {
      void performSend();
    } else {
      setConfirmSendDialogOpen(true);
    }
  };

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={1}>
        <Stack spacing={0.5}>
          <Typography variant="h1">{t("title")}</Typography>
        </Stack>
        <Button component={RouterLink} to="/packing/history" startIcon={<HistoryIcon />} size="small">
          {t("historyLink")}
        </Button>
      </Stack>

      {!isLiveApi && <Alert severity="warning">{t("liveApiRequired")}</Alert>}

      <Card variant="outlined" sx={{ borderRadius: "14px" }}>
        <CardContent sx={{ py: 1.25, "&:last-child": { pb: 1.25 } }}>
          <ListItemButton
            dense
            onClick={() => setFilterOpen((prev) => !prev)}
            sx={{ borderRadius: "10px", px: 0.5, py: 0.25 }}
          >
            <ListItemText
              primary={`${t("timeFrame")}: ${t(`range.${days}`)}`}
              secondary={
                rangeShown && !isFetching
                  ? t("rangeShown", {
                      from: formatDateTime(rangeShown.fromISO, language),
                      to: formatDateTime(rangeShown.toISO, language),
                    })
                  : undefined
              }
              slotProps={{ primary: { variant: "body2", fontWeight: 600 }, secondary: { variant: "caption" } }}
              sx={{ my: 0 }}
            />
            {filterOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </ListItemButton>
          <Collapse in={filterOpen}>
            <Stack spacing={1.5} sx={{ pt: 1.5 }}>
              <Typography variant="body2" color="text.secondary">
                {t("description")}
              </Typography>
              <FormControl fullWidth>
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
                size="large"
                fullWidth
                onClick={() => {
                  setFilterOpen(false);
                  void loadOrders(days);
                }}
                disabled={!isLiveApi || isFetching}
              >
                {t("apply")}
              </Button>
            </Stack>
          </Collapse>
          {currentOrder && (
            <>
              <Divider sx={{ my: 1 }} />
              <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                <Stack spacing={0} sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle1" noWrap>
                    {currentOrder.buyerName || t("guestBuyer")}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {t("orderNumberLabel")}: {currentOrder.orderNumber}
                    {currentOrder.orderDateISO ? ` · ${formatDateTime(currentOrder.orderDateISO, language)}` : ""}
                  </Typography>
                </Stack>
                <Chip size="small" label={t("progress", { current: currentIndex + 1, total: orders?.length ?? 0 })} />
              </Stack>
              
            </>
          )}
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

      {error && <Alert severity="error">{getApiErrorMessage(error) ?? t("loadError")}</Alert>}
      {sendSuccessMessage && !sendError && <Alert severity="success">{sendSuccessMessage}</Alert>}
      {sendError && <Alert severity="error">{sendError}</Alert>}

      {orders && orders.length === 0 && !isFetching && <Alert severity="info">{t("noOrders")}</Alert>}

      {currentOrder && (
        <>
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

          <Card variant="outlined" sx={{ borderRadius: "14px" }}>
            <CardContent sx={{ py: 1, "&:last-child": { pb: 1 } }}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box
                  onClick={openCameraCapture}
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: "10px",
                    overflow: "hidden",
                    bgcolor: "action.hover",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    cursor: "pointer",
                  }}
                >
                  {photoPreviewUrl ? (
                    <Box
                      component="img"
                      src={photoPreviewUrl}
                      alt={t("photoAlt")}
                      sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <PhotoCameraIcon color="action" />
                  )}
                </Box>
                <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
                  {t("photoSectionTitle")}
                </Typography>
                <Button variant="outlined" size="small" startIcon={<PhotoCameraIcon />} onClick={openCameraCapture}>
                  {photoFile ? t("retakePhoto") : t("takePhoto")}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  hidden
                  accept="image/*"
                  capture="environment"
                  onChange={handleFilePickerChange}
                />
              </Stack>
            </CardContent>
          </Card>

          {!allPacked && (
            <Typography variant="caption" color="text.secondary">
              {t("sendHint")}
            </Typography>
          )}
          <FixedActionBar>
            <Button fullWidth variant="outlined" disabled={currentIndex === 0} onClick={() => goToIndex(currentIndex - 1)}>
              {t("previous")}
            </Button>
            <Button
              fullWidth
              variant="contained"
              color="success"
              disabled={!allPacked || isSending}
              onClick={handleSendClick}
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
          </FixedActionBar>
        </>
      )}

      <CameraCaptureDialog
        open={cameraDialogOpen}
        onClose={() => setCameraDialogOpen(false)}
        onCapture={handlePhotoCaptured}
        onUseFilePicker={useFilePickerFallback}
        fileNamePrefix="packing-photo"
      />

      <ConfirmSendDialog
        open={confirmSendDialogOpen}
        photoPreviewUrl={photoPreviewUrl}
        isSending={isSending}
        onCancel={() => setConfirmSendDialogOpen(false)}
        onTakePicture={openCameraCapture}
        onConfirm={() => void performSend()}
      />
    </Stack>
  );
}
