import { useEffect, useMemo, useRef, useState } from "react";
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
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import SearchIcon from "@mui/icons-material/Search";
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
import PhotoLibraryIcon from "@mui/icons-material/PhotoLibrary";
import HistoryIcon from "@mui/icons-material/History";
import { useTranslation } from "react-i18next";
import {
  useGetPackingCustomerOrdersQuery,
  useLazyListPackingOrdersQuery,
  useRetryPackingSyncMutation,
  useSendPackedOrdersMutation,
} from "../api/packingApi";
import {
  DEFAULT_PACKING_RANGE_DAYS,
  PACKING_RANGE_DAYS_VALUES,
  ShopfaSyncStatus,
  type PackingOrderDTO,
  type PackingRangeDays,
  type PackingSyncIssueDTO,
} from "../types";
import { decideMove, decideSave } from "../utils/packingFlow";
import { PackingItemTile } from "../components/PackingItemTile";
import { ConfirmSendDialog } from "../components/ConfirmSendDialog";
import { FinishCustomerDialog } from "../components/FinishCustomerDialog";
import CloseIcon from "@mui/icons-material/Close";
import { CameraCaptureDialog } from "../../../components/CameraCaptureDialog";
import { FixedActionBar } from "../../../components/FixedActionBar";
import { useGetAppConfigQuery } from "../../settings/api/settingsApi";
import { getApiErrorMessage, getApiErrorStatus } from "../../../utils/apiError";
import { usePrepareImageUpload } from "../../settings/hooks/usePrepareImageUpload";
import { UpstreamErrorAlert } from "../../../components/UpstreamErrorAlert";
import { formatDateTime } from "../../../utils/localeFormat";
import { matchesOrderSearch, normalizeSearchQuery } from "../../../utils/orderSearch";
import { useActiveLanguage } from "../../../i18n/useActiveLanguage";

interface GroupPhoto {
  id: string;
  file: File;
  url: string;
}

const hasCameraApi = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

/**
 * Packing: a mobile/tablet-first screen for warehouse staff physically
 * boxing orders that are "ارسال شده به سرویس پستی". Orders of one customer
 * are grouped and packed as one unit: every item is a large picture-only
 * tile (see PackingItemTile) tapped to toggle unpacked (orange) / packed
 * (green), and marks are kept across a customer's orders (nothing is
 * persisted to Shopfa until Send). The customer's final picture(s) -- one or
 * several, shared by all their orders -- are taken from the strip at the
 * bottom. Send is enabled once every item of every order of the customer is
 * green and saves the whole group ("ارسال شده" + a local history record per
 * order, see packingService.markOrdersPacked); without a picture it first
 * warns (ConfirmSendDialog, "Dialog A"). Moving to another customer while
 * the current one is fully green but has no picture warns too
 * (FinishCustomerDialog, "Dialog B") -- see utils/packingFlow for both rules
 * and docs/order-status-mchine.md. A save whose Shopfa push failed is
 * retried in the background; orders whose push gave up are listed here with
 * a Retry button. Live-API only, like Order Precheck and Reporting's
 * shortage report.
 */
export function PackingPage() {
  const { t } = useTranslation("packing");
  const language = useActiveLanguage();
  const { data: appConfig } = useGetAppConfigQuery();
  const prepareUpload = usePrepareImageUpload();
  const isLiveApi = appConfig?.dataSource === DataSource.LIVE_API;

  const [days, setDays] = useState<PackingRangeDays>(DEFAULT_PACKING_RANGE_DAYS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [orders, setOrders] = useState<PackingOrderDTO[] | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [failedSyncs, setFailedSyncs] = useState<PackingSyncIssueDTO[]>([]);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  /** Where a move blocked by Dialog B was headed, so Confirm can finish it. */
  const [pendingMoveIndex, setPendingMoveIndex] = useState<number | null>(null);
  const [rangeShown, setRangeShown] = useState<{ fromISO: string | null; toISO: string | null; total: number | null } | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  /** `${orderNumber}:${productCode}` of every item marked green -- kept across navigation so a customer's progress isn't lost when moving between their orders. */
  const [packedKeys, setPackedKeys] = useState<Set<string>>(new Set());
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccessMessage, setSendSuccessMessage] = useState<string | null>(null);

  /** Confirmation photos per customer group (a customer's orders share their photos); several per group. */
  const [photosByGroup, setPhotosByGroup] = useState<Record<string, GroupPhoto[]>>({});
  /** Photos still being compressed -- sending waits for them so none is left out. */
  const [compressingPhotos, setCompressingPhotos] = useState(0);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [cameraDialogOpen, setCameraDialogOpen] = useState(false);
  const [confirmSendDialogOpen, setConfirmSendDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  /** Separate input with no `capture` attribute, so it opens the plain system file/gallery picker instead of jumping straight to the camera. */
  const galleryInputRef = useRef<HTMLInputElement>(null);
  /** The time frame last sent to the API, so Retry re-runs that request rather than an unapplied dropdown change. */
  const appliedDaysRef = useRef<PackingRangeDays>(DEFAULT_PACKING_RANGE_DAYS);

  const [fetchOrders, { isFetching, error }] = useLazyListPackingOrdersQuery();
  const [sendPackedOrders, { isLoading: isSending }] = useSendPackedOrdersMutation();
  const [retryPackingSync, { isLoading: isRetryingSync }] = useRetryPackingSyncMutation();

  const revokePhotos = (photos: GroupPhoto[]) => photos.forEach((photo) => URL.revokeObjectURL(photo.url));

  const clearGroupPhotos = (groupKey: string) => {
    setPhotosByGroup((prev) => {
      revokePhotos(prev[groupKey] ?? []);
      const rest = { ...prev };
      delete rest[groupKey];
      return rest;
    });
  };

  const loadOrders = async (selectedDays: PackingRangeDays) => {
    if (!isLiveApi) return;
    appliedDaysRef.current = selectedDays;
    setSendError(null);
    setSendSuccessMessage(null);
    setSyncNotice(null);
    const result = await fetchOrders({ days: selectedDays }).unwrap().catch(() => null);
    setOrders(result?.orders ?? null);
    setFailedSyncs(result?.failedSyncs ?? []);
    setPendingSyncCount(result?.pendingSyncCount ?? 0);
    setRangeShown(
      result ? { fromISO: result.rangeFromISO, toISO: result.rangeToISO, total: result.statusTotal } : null,
    );
    setCurrentIndex(0);
    setPackedKeys(new Set());
    setPhotosByGroup((prev) => {
      Object.values(prev).forEach(revokePhotos);
      return {};
    });
  };

  useEffect(() => {
    if (isLiveApi) void loadOrders(days);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLiveApi]);

  const handleDaysChange = (e: SelectChangeEvent<number>) => {
    setDays(Number(e.target.value) as PackingRangeDays);
  };

  const normalizedQuery = normalizeSearchQuery(searchQuery);
  const visibleOrders = useMemo(
    () => (orders ?? []).filter((order) => matchesOrderSearch(order, normalizedQuery)),
    [orders, normalizedQuery],
  );
  useEffect(() => {
    setCurrentIndex(0);
  }, [normalizedQuery]);

  const currentOrder = visibleOrders[currentIndex] ?? null;

  // Orders of one customer are contiguous in the queue, so a customer's first order is wherever the group key changes.
  const customerStartIndexes = useMemo(
    () =>
      visibleOrders.flatMap((order, index) =>
        index === 0 || order.customerGroupKey !== visibleOrders[index - 1]?.customerGroupKey ? [index] : [],
      ),
    [visibleOrders],
  );
  const customerPosition = customerStartIndexes.filter((start) => start <= currentIndex).length - 1;
  const customerGroup = currentOrder
    ? (orders ?? []).filter((order) => order.customerGroupKey === currentOrder.customerGroupKey)
    : [];
  const shippingCounts = customerGroup.reduce<Record<string, number>>((acc, order) => {
    const method = order.shippingMethod ?? t("shippingUnknown");
    acc[method] = (acc[method] ?? 0) + 1;
    return acc;
  }, {});
  // Opening a customer group: look up the customer's orders in other statuses once per group (information only).
  const groupLeadOrderNumber = customerGroup[0]?.orderNumber ?? null;
  const { data: customerOrders, isError: otherOrdersLookupFailed } = useGetPackingCustomerOrdersQuery(
    { orderNumber: groupLeadOrderNumber ?? "" },
    { skip: !isLiveApi || !groupLeadOrderNumber },
  );
  const otherStatusOrders = customerOrders?.orderNumber === groupLeadOrderNumber ? customerOrders.otherStatusOrders : [];
  const otherStatusDetails = Object.entries(
    otherStatusOrders.reduce<Record<string, number>>((acc, order) => {
      acc[order.statusTitle] = (acc[order.statusTitle] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .map(([status, count]) => `${status} × ${count}`)
    .join("، ");
  const itemKey = (orderNumber: string, productCode: string) => `${orderNumber}:${productCode}`;
  const groupTotalQuantity = customerGroup.reduce(
    (sum, order) => sum + order.items.reduce((orderSum, item) => orderSum + item.quantity, 0),
    0,
  );
  /** Every item of every order of the current customer is green. */
  const groupComplete =
    customerGroup.length > 0 &&
    customerGroup.every((order) => order.items.every((item) => packedKeys.has(itemKey(order.orderNumber, item.productCode))));
  const currentGroupKey = currentOrder?.customerGroupKey ?? null;
  const groupPhotos = currentGroupKey ? (photosByGroup[currentGroupKey] ?? []) : [];

  const toggleItemPacked = (orderNumber: string, productCode: string) => {
    setPackedKeys((prev) => {
      const next = new Set(prev);
      const key = itemKey(orderNumber, productCode);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  /**
   * Every move between orders goes through here. Leaving a customer whose
   * items are all green but who has no picture yet opens Dialog B; nothing
   * is saved and no status changes either way.
   */
  const navigateTo = (index: number) => {
    const target = visibleOrders[index];
    const decision = decideMove({
      leavingGroup: !!currentOrder && !!target && target.customerGroupKey !== currentOrder.customerGroupKey,
      allItemsMarkedGreen: groupComplete,
      photoCount: groupPhotos.length,
    });
    if (decision === "warn_no_picture") {
      setPendingMoveIndex(index);
      return;
    }
    setCurrentIndex(index);
  };

  const goToCustomer = (offset: -1 | 1) => {
    const target = customerStartIndexes[customerPosition + offset];
    if (target !== undefined) navigateTo(target);
  };

  const openCameraCapture = () => {
    if (hasCameraApi) {
      setCameraDialogOpen(true);
    } else {
      fileInputRef.current?.click();
    }
  };

  /** Photos are compressed before they join the group (see usePrepareImageUpload), so a send never uploads raw camera files. */
  const applyPhoto = async (original: File) => {
    const groupKey = currentGroupKey;
    if (!groupKey) return;
    setPhotoError(null);
    setCompressingPhotos((count) => count + 1);
    try {
      const file = await prepareUpload(original);
      const photo: GroupPhoto = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, file, url: URL.createObjectURL(file) };
      setPhotosByGroup((prev) => ({ ...prev, [groupKey]: [...(prev[groupKey] ?? []), photo] }));
    } catch {
      setPhotoError(t("photoProcessError"));
    } finally {
      setCompressingPhotos((count) => count - 1);
    }
  };

  const removePhoto = (photoId: string) => {
    if (!currentGroupKey) return;
    setPhotosByGroup((prev) => {
      const list = prev[currentGroupKey] ?? [];
      revokePhotos(list.filter((photo) => photo.id === photoId));
      return { ...prev, [currentGroupKey]: list.filter((photo) => photo.id !== photoId) };
    });
  };

  const handlePhotoCaptured = (file: File) => {
    void applyPhoto(file);
    setCameraDialogOpen(false);
  };

  const handleFilePickerChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void applyPhoto(file);
    event.target.value = "";
  };

  const useFilePickerFallback = () => {
    setCameraDialogOpen(false);
    fileInputRef.current?.click();
  };

  const openGalleryPicker = () => {
    galleryInputRef.current?.click();
  };

  const performSend = async () => {
    if (!currentOrder || customerGroup.length === 0) return;
    const groupKey = currentOrder.customerGroupKey;
    const groupStart = customerStartIndexes[customerPosition] ?? 0;
    setSendError(null);
    setSendSuccessMessage(null);
    try {
      const result = await sendPackedOrders({
        orders: customerGroup.map((order) => ({
          orderNumber: order.orderNumber,
          externalOrderId: order.externalOrderId,
          buyerName: order.buyerName,
          items: order.items.map((item) => ({ productCode: item.productCode, title: item.title, quantity: item.quantity })),
        })),
        photos: groupPhotos.map((photo) => photo.file),
      }).unwrap();

      const sentNumbers = new Set(result.sent.map((order) => order.orderNumber));
      const notSynced = result.sent.filter((order) => order.syncStatus !== ShopfaSyncStatus.SYNCED);
      const gaveUp = notSynced.filter((order) => order.syncStatus === ShopfaSyncStatus.FAILED);
      setPendingSyncCount((count) => count + notSynced.length - gaveUp.length);
      setFailedSyncs((prev) => [
        ...prev,
        ...gaveUp.map((order) => ({
          packingRecordId: order.packingRecordId,
          orderNumber: order.orderNumber,
          buyerName: customerGroup.find((o) => o.orderNumber === order.orderNumber)?.buyerName ?? null,
          lastSyncError: null,
          sentAtISO: new Date().toISOString(),
        })),
      ]);
      setSyncNotice(
        notSynced.length > 0
          ? t("syncPendingNotice", { orders: notSynced.map((order) => order.orderNumber).join("، ") })
          : null,
      );
      const sentVisibleCount = visibleOrders.filter((order) => sentNumbers.has(order.orderNumber)).length;
      setOrders((prev) => (prev ? prev.filter((order) => !sentNumbers.has(order.orderNumber)) : prev));
      setPackedKeys((prev) => new Set([...prev].filter((key) => !sentNumbers.has(key.slice(0, key.indexOf(":"))))));
      setConfirmSendDialogOpen(false);
      if (result.sent.length > 0) setSendSuccessMessage(t("sendGroupSuccess", { count: result.sent.length }));
      if (result.failed.length === 0) clearGroupPhotos(groupKey);
      else setSendError(t("sendGroupError", { orders: result.failed.map((order) => order.orderNumber).join("، ") }));
      setCurrentIndex(Math.max(0, Math.min(groupStart, visibleOrders.length - sentVisibleCount - 1)));
    } catch (err) {
      const status = getApiErrorStatus(err);
      setSendError(
        status === 413
          ? t("sendErrorTooLarge")
          : (getApiErrorMessage(err) ?? (status !== undefined ? t("sendErrorWithStatus", { status }) : t("sendError"))),
      );
    }
  };

  const handleSendClick = () => {
    if (!groupComplete || compressingPhotos > 0) return;
    if (decideSave({ photoCount: groupPhotos.length }) === "send") {
      void performSend();
    } else {
      setConfirmSendDialogOpen(true);
    }
  };

  const handleRetrySync = async (packingRecordId: string) => {
    try {
      const result = await retryPackingSync({ packingRecordId }).unwrap();
      if (result.syncStatus === ShopfaSyncStatus.SYNCED) {
        setFailedSyncs((prev) => prev.filter((issue) => issue.packingRecordId !== packingRecordId));
      } else {
        setSendError(t("syncRetryFailed", { order: result.orderNumber }));
      }
    } catch (err) {
      setSendError(getApiErrorMessage(err) ?? t("syncRetryFailed", { order: "" }));
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
                  ? [
                      rangeShown.fromISO && rangeShown.toISO
                        ? t("rangeShown", {
                            from: formatDateTime(rangeShown.fromISO, language),
                            to: formatDateTime(rangeShown.toISO, language),
                          })
                        : t("rangeAll"),
                      rangeShown.total !== null ? t("ordersCount", { shown: orders?.length ?? 0, total: rangeShown.total }) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")
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
          {orders && orders.length > 0 && (
            <>
              <TextField
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("search")}
                fullWidth
                sx={{ mt: 1 }}
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
                  {t("searchResults", { count: visibleOrders.length })}
                </Typography>
              )}
            </>
          )}
          {currentOrder && (
            <>
              <Divider sx={{ my: 1 }} />
              <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                <Stack spacing={0} sx={{ minWidth: 0 }}>
                  <Stack direction="row" alignItems="center" spacing={0.5} sx={{ minWidth: 0 }}>
                    <Tooltip title={t("previousCustomer")}>
                      <span>
                        <IconButton
                          size="small"
                          aria-label={t("previousCustomer")}
                          disabled={customerPosition <= 0}
                          onClick={() => goToCustomer(-1)}
                        >
                          <ArrowUpwardIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title={t("nextCustomer")}>
                      <span>
                        <IconButton
                          size="small"
                          aria-label={t("nextCustomer")}
                          disabled={customerPosition >= customerStartIndexes.length - 1}
                          onClick={() => goToCustomer(1)}
                        >
                          <ArrowDownwardIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Typography variant="subtitle1" noWrap>
                      {currentOrder.buyerName || t("guestBuyer")}
                    </Typography>
                  </Stack>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {t("orderNumberLabel")}: {currentOrder.orderNumber}
                    {currentOrder.orderDateISO ? ` · ${formatDateTime(currentOrder.orderDateISO, language)}` : ""}
                    {currentOrder.buyerMobile ? ` · ${currentOrder.buyerMobile}` : ""}
                  </Typography>
                </Stack>
                <Stack alignItems="flex-end" spacing={0.5}>
                  <Chip size="small" label={t("progress", { current: currentIndex + 1, total: visibleOrders.length })} />
                  {customerGroup.length > 1 && (
                    <Chip
                      size="small"
                      color="info"
                      label={t("customerOrders", {
                        index: customerGroup.indexOf(currentOrder) + 1,
                        total: customerGroup.length,
                      })}
                    />
                  )}
                </Stack>
              </Stack>
              
              <Stack spacing={0.75} sx={{ mt: 1 }}>
                <Stack direction="row" gap={0.75} flexWrap="wrap" alignItems="center">
                  <Typography variant="caption" color="text.secondary">
                    {customerGroup.length > 1 ? t("shippingGroupLabel") : t("shippingLabel")}:
                  </Typography>
                  {Object.entries(shippingCounts).map(([method, count]) => (
                    <Chip
                      key={method}
                      size="small"
                      variant="outlined"
                      label={customerGroup.length > 1 ? `${method} × ${count}` : method}
                    />
                  ))}
                </Stack>
                {otherStatusOrders.length > 0 && (
                  <Alert severity="info" sx={{ py: 0 }}>
                    {t("otherStatusOrdersInfo", { count: otherStatusOrders.length, details: otherStatusDetails })}
                    <Typography variant="caption" component="div" color="text.secondary">
                      {otherStatusOrders.map((order) => `${order.orderNumber} (${order.statusTitle})`).join("، ")}
                    </Typography>
                  </Alert>
                )}
                {otherOrdersLookupFailed && (
                  <Typography variant="caption" color="warning.main">
                    {t("otherStatusOrdersLookupFailed")}
                  </Typography>
                )}
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

      {error && (
        <UpstreamErrorAlert
          error={error}
          fallbackMessage={t("loadError")}
          isRetrying={isFetching}
          onRetry={() => void loadOrders(appliedDaysRef.current)}
        />
      )}
      {sendSuccessMessage && !sendError && <Alert severity="success">{sendSuccessMessage}</Alert>}
      {syncNotice && <Alert severity="warning">{syncNotice}</Alert>}
      {pendingSyncCount > 0 && !syncNotice && (
        <Typography variant="caption" color="text.secondary">
          {t("syncPendingCount", { count: pendingSyncCount })}
        </Typography>
      )}
      {failedSyncs.length > 0 && (
        <Alert severity="error">
          <Typography variant="body2">{t("syncFailedTitle", { count: failedSyncs.length })}</Typography>
          <Stack spacing={0.5} sx={{ mt: 0.5 }}>
            {failedSyncs.map((issue) => (
              <Stack key={issue.packingRecordId} direction="row" alignItems="center" gap={1} flexWrap="wrap">
                <Typography variant="caption">
                  {issue.orderNumber}
                  {issue.buyerName ? ` · ${issue.buyerName}` : ""}
                </Typography>
                <Button size="small" disabled={isRetryingSync} onClick={() => void handleRetrySync(issue.packingRecordId)}>
                  {t("syncRetry")}
                </Button>
              </Stack>
            ))}
          </Stack>
        </Alert>
      )}
      {sendError && <Alert severity="error">{sendError}</Alert>}

      {orders && orders.length === 0 && !isFetching && <Alert severity="info">{t("noOrders")}</Alert>}
      {orders && orders.length > 0 && visibleOrders.length === 0 && (
        <Alert severity="info">{t("noSearchMatches")}</Alert>
      )}

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
                packed={packedKeys.has(itemKey(currentOrder.orderNumber, item.productCode))}
                onToggle={() => toggleItemPacked(currentOrder.orderNumber, item.productCode)}
              />
            ))}
          </Box>

          <Card variant="outlined" sx={{ borderRadius: "14px" }}>
            <CardContent sx={{ py: 1, "&:last-child": { pb: 1 } }}>
              <Stack spacing={1}>
                <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
                    {t("photoSectionTitle")}
                  </Typography>
                  <Button variant="outlined" size="small" startIcon={<PhotoCameraIcon />} onClick={openCameraCapture}>
                    {groupPhotos.length > 0 ? t("addPhoto") : t("takePhoto")}
                  </Button>
                  <Button variant="outlined" size="small" startIcon={<PhotoLibraryIcon />} onClick={openGalleryPicker}>
                    {t("uploadPhoto")}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    hidden
                    accept="image/*"
                    capture="environment"
                    onChange={handleFilePickerChange}
                  />
                  <input ref={galleryInputRef} type="file" hidden accept="image/*" onChange={handleFilePickerChange} />
                </Stack>
                {customerGroup.length > 1 && (
                  <Typography variant="caption" color="text.secondary">
                    {t("photosHint")}
                  </Typography>
                )}
                {photoError && (
                  <Alert severity="error" onClose={() => setPhotoError(null)}>
                    {photoError}
                  </Alert>
                )}
                {(groupPhotos.length > 0 || compressingPhotos > 0) && (
                  <Stack direction="row" gap={1} flexWrap="wrap">
                    {groupPhotos.map((photo) => (
                      <Box key={photo.id} sx={{ position: "relative", width: 64, height: 64 }}>
                        <Box
                          component="img"
                          src={photo.url}
                          alt={t("photoAlt")}
                          sx={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "10px", bgcolor: "action.hover" }}
                        />
                        <IconButton
                          size="small"
                          aria-label={t("removePhoto")}
                          onClick={() => removePhoto(photo.id)}
                          sx={{
                            position: "absolute",
                            top: -8,
                            insetInlineEnd: -8,
                            p: 0.25,
                            bgcolor: "background.paper",
                            boxShadow: 1,
                            "&:hover": { bgcolor: "background.paper" },
                          }}
                        >
                          <CloseIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Box>
                    ))}
                    {compressingPhotos > 0 && (
                      <Box
                        aria-label={t("photoProcessing")}
                        sx={{ width: 64, height: 64, borderRadius: "10px", bgcolor: "action.hover", display: "grid", placeItems: "center" }}
                      >
                        <CircularProgress size={20} />
                      </Box>
                    )}
                  </Stack>
                )}
              </Stack>
            </CardContent>
          </Card>

          {!groupComplete && (
            <Typography variant="caption" color="text.secondary">
              {customerGroup.length > 1 ? t("sendGroupHint") : t("sendHint")}
            </Typography>
          )}
          <FixedActionBar>
            <Button fullWidth variant="outlined" disabled={currentIndex === 0} onClick={() => navigateTo(currentIndex - 1)}>
              {t("previous")}
            </Button>
            <Button
              fullWidth
              variant="contained"
              color="success"
              disabled={!groupComplete || isSending || compressingPhotos > 0}
              onClick={handleSendClick}
              startIcon={isSending || compressingPhotos > 0 ? <CircularProgress size={14} /> : undefined}
            >
              {customerGroup.length > 1
                ? t("sendGroupWithTotal", { orders: customerGroup.length, total: groupTotalQuantity })
                : t("sendWithTotal", { total: groupTotalQuantity })}
            </Button>
            <Button
              fullWidth
              variant="outlined"
              disabled={currentIndex >= visibleOrders.length - 1}
              onClick={() => navigateTo(currentIndex + 1)}
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

      <FinishCustomerDialog
        open={pendingMoveIndex !== null}
        onTakePicture={() => {
          setPendingMoveIndex(null);
          openCameraCapture();
        }}
        onCancel={() => setPendingMoveIndex(null)}
        onConfirm={() => {
          if (pendingMoveIndex !== null) setCurrentIndex(pendingMoveIndex);
          setPendingMoveIndex(null);
        }}
      />

      <ConfirmSendDialog
        open={confirmSendDialogOpen}
        isSending={isSending}
        onCancel={() => setConfirmSendDialogOpen(false)}
        onTakePicture={() => {
          setConfirmSendDialogOpen(false);
          openCameraCapture();
        }}
        onConfirm={() => void performSend()}
      />
    </Stack>
  );
}
