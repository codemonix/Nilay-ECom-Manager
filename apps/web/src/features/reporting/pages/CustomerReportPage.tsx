import { useState } from "react";
import { DataSource } from "@complaint-system/shared";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableBody from "@mui/material/TableBody";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";
import { useLazyGetCustomerReportQuery } from "../api/reportingApi";
import type { CustomerReportCustomerDTO, CustomerReportOrderDTO } from "../types";
import { DateRangeFields } from "../components/DateRangeFields";
import { isValidDateRange, lastDaysRange, type DateRangeValue } from "../dateRange";
import { useGetSettingsQuery } from "../../settings/api/settingsApi";
import { getApiErrorMessage } from "../../../utils/apiError";
import { formatDate, formatDateTime, formatNumber } from "../../../utils/localeFormat";
import { useActiveLanguage } from "../../../i18n/useActiveLanguage";

const MIN_QUERY_LENGTH = 3;
const ORDER_TABLE_COLUMN_COUNT = 6;

function OrderRow({ order }: { order: CustomerReportOrderDTO }) {
  const { t } = useTranslation("reporting", { keyPrefix: "customer" });
  const language = useActiveLanguage();
  const [expanded, setExpanded] = useState(false);
  const effectiveDate = order.paymentDateISO ?? order.orderDateISO;

  return (
    <>
      <TableRow hover sx={{ opacity: order.counted ? 1 : 0.65 }}>
        <TableCell>
          <RouterLink to={`/reporting/orders/${encodeURIComponent(order.orderNumber)}`} target="_blank" rel="noopener noreferrer">
            {order.orderNumber}
          </RouterLink>
        </TableCell>
        <TableCell>{effectiveDate ? formatDate(effectiveDate, language) : "—"}</TableCell>
        <TableCell>
          <Chip
            size="small"
            label={order.statusTitle}
            color={order.counted ? "success" : "default"}
            variant={order.counted ? "filled" : "outlined"}
            title={order.counted ? undefined : t("notCounted")}
          />
        </TableCell>
        <TableCell align="right">{formatNumber(order.itemCount, language)}</TableCell>
        <TableCell align="right">{formatNumber(order.totalAmount, language)}</TableCell>
        <TableCell align="center">
          <IconButton size="small" onClick={() => setExpanded((prev) => !prev)} aria-label={t("items")}>
            {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
          </IconButton>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={ORDER_TABLE_COLUMN_COUNT} sx={{ py: 0, borderBottom: expanded ? undefined : "none" }}>
          <Collapse in={expanded} timeout="auto" unmountOnExit>
            <Table size="small" sx={{ my: 1 }}>
              <TableHead>
                <TableRow>
                  <TableCell>{t("itemTitle")}</TableCell>
                  <TableCell align="right">{t("quantity")}</TableCell>
                  <TableCell align="right">{t("unitPrice")}</TableCell>
                  <TableCell align="right">{t("amount")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {order.items.map((item, index) => (
                  <TableRow key={`${item.productId}-${index}`}>
                    <TableCell>{item.title}</TableCell>
                    <TableCell align="right">{formatNumber(item.quantity, language)}</TableCell>
                    <TableCell align="right">{formatNumber(item.unitPrice, language)}</TableCell>
                    <TableCell align="right">{formatNumber(item.amount, language)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

function CustomerCard({ customer }: { customer: CustomerReportCustomerDTO }) {
  const { t } = useTranslation("reporting", { keyPrefix: "customer" });
  const language = useActiveLanguage();
  return (
    <Card variant="outlined" sx={{ borderRadius: "14px" }}>
      <CardContent>
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1} alignItems="baseline" flexWrap="wrap" useFlexGap>
            <Typography variant="h2">{customer.name || t("unnamed")}</Typography>
            {/* Phone numbers render exactly as stored, never through formatNumber -- see localeFormat.ts. */}
            {customer.mobile && (
              <Typography variant="body2" color="text.secondary" dir="ltr">
                {customer.mobile}
              </Typography>
            )}
          </Stack>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip size="small" color="primary" label={t("totalSpent", { amount: formatNumber(customer.totalSpent, language) })} />
            <Chip size="small" variant="outlined" label={t("soldOrders", { count: customer.soldOrderCount, formatted: formatNumber(customer.soldOrderCount, language) })} />
            <Chip size="small" variant="outlined" label={t("soldItems", { count: customer.soldItemCount, formatted: formatNumber(customer.soldItemCount, language) })} />
            <Chip size="small" variant="outlined" label={t("allOrders", { count: customer.orderCount, formatted: formatNumber(customer.orderCount, language) })} />
          </Stack>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t("orderNumber")}</TableCell>
                  <TableCell>{t("date")}</TableCell>
                  <TableCell>{t("status")}</TableCell>
                  <TableCell align="right">{t("itemCount")}</TableCell>
                  <TableCell align="right">{t("amount")}</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {customer.orders.map((order) => (
                  <OrderRow key={order.orderNumber} order={order} />
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Stack>
      </CardContent>
    </Card>
  );
}

/**
 * Reporting's customer report: search by name or mobile number, pick a
 * period, and see each matching customer's orders and spend. Only orders in
 * a sold status count toward the totals (others are listed dimmed) -- see
 * CustomerReportCustomerDTO. Live-API only.
 */
export function CustomerReportPage() {
  const { t } = useTranslation("reporting", { keyPrefix: "customer" });
  const language = useActiveLanguage();
  const [query, setQuery] = useState("");
  const [range, setRange] = useState<DateRangeValue>(() => lastDaysRange(90));

  const { data: settings } = useGetSettingsQuery();
  const isLiveApi = settings?.dataSource === DataSource.LIVE_API;
  const [runReport, { data: result, isFetching, error }] = useLazyGetCustomerReportQuery();

  const canGenerate = isLiveApi && query.trim().length >= MIN_QUERY_LENGTH && isValidDateRange(range) && !isFetching;
  const handleGenerate = () => {
    if (canGenerate) void runReport({ query: query.trim(), ...range });
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
          <Stack
            spacing={2}
            component="form"
            onSubmit={(e) => {
              e.preventDefault();
              handleGenerate();
            }}
          >
            <TextField
              size="small"
              label={t("searchLabel")}
              helperText={t("searchHelper", { count: MIN_QUERY_LENGTH })}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={!isLiveApi}
              sx={{ maxWidth: 420 }}
            />
            <DateRangeFields value={range} onChange={setRange} disabled={!isLiveApi} />
            <Button
              type="submit"
              variant="contained"
              disabled={!canGenerate}
              startIcon={isFetching ? <CircularProgress size={14} /> : undefined}
              sx={{ alignSelf: "flex-start" }}
            >
              {t("generate")}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {isFetching && (
        <Alert severity="info" icon={<CircularProgress size={16} />}>
          {t("loading")}
        </Alert>
      )}
      {error && !isFetching && <Alert severity="error">{getApiErrorMessage(error) ?? t("generateError")}</Alert>}

      {result && !isFetching && (
        <>
          <Typography variant="caption" color="text.secondary">
            {t("resultMeta", {
              from: formatDate(result.rangeFromISO, language),
              to: formatDate(result.rangeToISO, language),
              time: formatDateTime(result.generatedAtISO, language),
            })}
          </Typography>
          {result.truncated && <Alert severity="warning">{t("truncated")}</Alert>}
          {result.customers.length === 0 ? (
            <Alert severity="info">{t("noResults")}</Alert>
          ) : (
            result.customers.map((customer) => (
              <CustomerCard key={`${customer.mobile ?? ""}|${customer.name}`} customer={customer} />
            ))
          )}
        </>
      )}
    </Stack>
  );
}
