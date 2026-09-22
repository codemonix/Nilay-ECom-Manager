import { useState } from "react";
import { DataSource } from "@complaint-system/shared";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Chip from "@mui/material/Chip";
import Avatar from "@mui/material/Avatar";
import Tooltip from "@mui/material/Tooltip";
import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import FormGroup from "@mui/material/FormGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select, { type SelectChangeEvent } from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableBody from "@mui/material/TableBody";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";
import { useLazyGetShortageReportQuery } from "../api/reportingApi";
import {
  DEFAULT_SHORTAGE_REPORT_RANGE_DAYS,
  DEFAULT_SHORTAGE_REPORT_STATUS_CODES,
  SHOPFA_ORDER_STATUS_OPTIONS,
  SHORTAGE_REPORT_RANGE_DAYS_VALUES,
  type ShortageReportItemDTO,
  type ShortageReportRangeDays,
} from "../types";
import { useGetSettingsQuery } from "../../settings/api/settingsApi";
import { getApiErrorMessage } from "../../../utils/apiError";
import { formatDateTime } from "../../../utils/localeFormat";
import { useActiveLanguage } from "../../../i18n/useActiveLanguage";

const ITEM_TABLE_COLUMN_COUNT = 7;

/** A thumbnail that shows a larger preview of the same image on hover -- no separate lookup, just a bigger `<img>` with the same `src` inside the tooltip. */
function ItemThumbnail({ imageUrl, title }: { imageUrl: string | null; title: string }) {
  if (!imageUrl) return <Avatar variant="rounded" sx={{ width: 48, height: 48 }} />;

  return (
    <Tooltip
      title={
        <Box
          component="img"
          src={imageUrl}
          alt={title}
          sx={{ width: 240, height: 240, objectFit: "contain", display: "block", borderRadius: 1 }}
        />
      }
      slotProps={{ tooltip: { sx: { backgroundColor: "transparent", p: 0, boxShadow: 4 } } }}
      placement="right"
    >
      <Avatar variant="rounded" src={imageUrl} sx={{ width: 48, height: 48, cursor: "zoom-in" }} />
    </Tooltip>
  );
}

function ShortageItemRow({ item, language }: { item: ShortageReportItemDTO; language: ReturnType<typeof useActiveLanguage> }) {
  const { t } = useTranslation("reporting", { keyPrefix: "shortage" });
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <TableRow hover>
        <TableCell>
          <ItemThumbnail imageUrl={item.imageUrl} title={item.title} />
        </TableCell>
        <TableCell>
          <Stack spacing={0.25}>
            <Typography variant="body2">{item.title}</Typography>
            <Typography variant="caption" color="text.secondary">
              {item.productId}
              {item.variantId ? ` · ${item.variantId}` : ""}
            </Typography>
          </Stack>
        </TableCell>
        <TableCell align="right">
          <Chip size="small" color="warning" label={item.affectedOrderCount} />
        </TableCell>
        <TableCell align="right">{item.totalShortageQuantity}</TableCell>
        <TableCell>{item.oldestPaymentDateISO ? formatDateTime(item.oldestPaymentDateISO, language) : "—"}</TableCell>
        <TableCell>{item.newestPaymentDateISO ? formatDateTime(item.newestPaymentDateISO, language) : "—"}</TableCell>
        <TableCell align="center">
          <IconButton size="small" onClick={() => setExpanded((prev) => !prev)}>
            {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
          </IconButton>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={ITEM_TABLE_COLUMN_COUNT} sx={{ py: 0, borderBottom: expanded ? undefined : "none" }}>
          <Collapse in={expanded} timeout="auto" unmountOnExit>
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ py: 1.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>
                {t("orderNumbers")}:
              </Typography>
              {item.orderNumbers.map((orderNumber) => (
                <Chip
                  key={orderNumber}
                  size="small"
                  variant="outlined"
                  label={orderNumber}
                  component={RouterLink}
                  to={`/reporting/orders/${encodeURIComponent(orderNumber)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  clickable
                />
              ))}
            </Stack>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

/**
 * Reporting's shortage report: scans every order in the selected Shopfa
 * statuses (default "پردازش انبار") and reads its admin note ("یادداشت
 * مدیر") for a shortage signal -- see ShortageReportResultDTO for the
 * exact business rule (no "مورد"/"موارد" mention means the whole order
 * counts, otherwise the referenced item rows are resolved). Live-API only
 * -- the admin note field and Shopfa's status codes don't exist for
 * imported order data.
 */
export function ShortageReportPage() {
  const { t } = useTranslation("reporting", { keyPrefix: "shortage" });
  const language = useActiveLanguage();
  const [selectedCodes, setSelectedCodes] = useState<number[]>(DEFAULT_SHORTAGE_REPORT_STATUS_CODES);
  const [days, setDays] = useState<ShortageReportRangeDays>(DEFAULT_SHORTAGE_REPORT_RANGE_DAYS);
  const [unresolvedDialogOpen, setUnresolvedDialogOpen] = useState(false);

  const { data: settings } = useGetSettingsQuery();
  const isLiveApi = settings?.dataSource === DataSource.LIVE_API;

  const [runReport, { data: result, isFetching, error }] = useLazyGetShortageReportQuery();

  const toggleCode = (code: number) => {
    setSelectedCodes((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  };

  const handleGenerate = () => {
    if (selectedCodes.length === 0 || !isLiveApi) return;
    setUnresolvedDialogOpen(false);
    void runReport({ statusCodes: selectedCodes, days });
  };

  const handleDaysChange = (e: SelectChangeEvent<number>) => {
    setDays(Number(e.target.value) as ShortageReportRangeDays);
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
          <Stack spacing={2}>
            <FormControl size="small" sx={{ maxWidth: 260 }}>
              <InputLabel id="shortage-report-range-label">{t("timeFrame")}</InputLabel>
              <Select
                labelId="shortage-report-range-label"
                label={t("timeFrame")}
                value={days}
                onChange={handleDaysChange}
                disabled={!isLiveApi}
              >
                {SHORTAGE_REPORT_RANGE_DAYS_VALUES.map((value) => (
                  <MenuItem key={value} value={value}>
                    {t(`range.${value}`)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Stack spacing={1}>
              <Typography variant="subtitle2">{t("statuses")}</Typography>
              <FormGroup row>
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
            </Stack>

            <Button
              variant="contained"
              onClick={handleGenerate}
              disabled={!isLiveApi || selectedCodes.length === 0 || isFetching}
              startIcon={isFetching ? <CircularProgress size={14} /> : undefined}
              sx={{ alignSelf: "flex-start" }}
            >
              {t("generate")}
            </Button>

            {isFetching && (
              <Alert severity="info" icon={<CircularProgress size={16} />}>
                {t("loading")}
              </Alert>
            )}

            {error && <Alert severity="error">{getApiErrorMessage(error) ?? t("generateError")}</Alert>}

            {result && !isFetching && (
              <Stack spacing={2}>
                <Typography variant="caption" color="text.secondary">
                  {t("rangeShown", {
                    from: formatDateTime(result.rangeFromISO, language),
                    to: formatDateTime(result.rangeToISO, language),
                  })}
                </Typography>

                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip variant="outlined" label={t("ordersScanned", { count: result.totalOrdersScanned })} />
                  <Chip variant="outlined" label={t("wholeOrderShortage", { count: result.wholeOrderShortageOrderCount })} />
                  {result.unresolvedNotes.length > 0 && (
                    <Chip
                      color="warning"
                      label={t("unresolvedNotes", { count: result.unresolvedNotes.length })}
                      onClick={() => setUnresolvedDialogOpen(true)}
                    />
                  )}
                  <Typography variant="caption" color="text.secondary" sx={{ alignSelf: "center" }}>
                    {t("generatedAt", { time: formatDateTime(result.generatedAtISO, language) })}
                  </Typography>
                </Stack>

                {result.items.length === 0 ? (
                  <Alert severity="success">{t("noShortages")}</Alert>
                ) : (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell />
                          <TableCell>{t("itemColumn")}</TableCell>
                          <TableCell align="right">{t("affectedOrdersColumn")}</TableCell>
                          <TableCell align="right">{t("totalQuantityColumn")}</TableCell>
                          <TableCell>{t("oldestPaymentColumn")}</TableCell>
                          <TableCell>{t("newestPaymentColumn")}</TableCell>
                          <TableCell />
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {result.items.map((item) => (
                          <ShortageItemRow key={`${item.productId}::${item.variantId ?? ""}`} item={item} language={language} />
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Stack>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Dialog open={unresolvedDialogOpen} onClose={() => setUnresolvedDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t("unresolvedDialogTitle")}</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ pt: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              {t("unresolvedDialogDescription")}
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t("unresolvedOrderColumn")}</TableCell>
                    <TableCell>{t("unresolvedNoteColumn")}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {result?.unresolvedNotes.map((entry) => (
                    <TableRow key={entry.orderNumber}>
                      <TableCell>
                        <Link
                          component={RouterLink}
                          to={`/reporting/orders/${encodeURIComponent(entry.orderNumber)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {entry.orderNumber}
                        </Link>
                      </TableCell>
                      <TableCell>{entry.note}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUnresolvedDialogOpen(false)}>{t("close")}</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
