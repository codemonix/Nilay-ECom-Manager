import { useParams } from "react-router-dom";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Chip from "@mui/material/Chip";
import Avatar from "@mui/material/Avatar";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableBody from "@mui/material/TableBody";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import { useTranslation } from "react-i18next";
import { useGetReportingOrderDetailsQuery } from "../api/reportingApi";
import { getApiErrorMessage } from "../../../utils/apiError";
import { formatDateTime } from "../../../utils/localeFormat";
import { useActiveLanguage } from "../../../i18n/useActiveLanguage";

/** Read-only view of one live Shopfa order, opened in a new tab from the shortage report's order-number links. */
export function ReportingOrderDetailsPage() {
  const { t } = useTranslation("reporting", { keyPrefix: "orderDetails" });
  const language = useActiveLanguage();
  const { orderNumber = "" } = useParams<{ orderNumber: string }>();
  const { data: order, isFetching, error } = useGetReportingOrderDetailsQuery(orderNumber, { skip: !orderNumber });

  return (
    <Stack spacing={2}>
      <Typography variant="h1">{t("title", { orderNumber })}</Typography>

      {isFetching && (
        <Alert severity="info" icon={<CircularProgress size={16} />}>
          {t("loading")}
        </Alert>
      )}
      {error && <Alert severity="error">{getApiErrorMessage(error) ?? t("loadError")}</Alert>}

      {order && (
        <Card variant="outlined" sx={{ borderRadius: "14px" }}>
          <CardContent>
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
                <Chip color="primary" label={order.statusTitle} />
                {order.buyerName && <Chip variant="outlined" label={`${t("buyer")}: ${order.buyerName}`} />}
                <Chip
                  variant="outlined"
                  label={`${t("paymentDate")}: ${order.paymentDateISO ? formatDateTime(order.paymentDateISO, language) : t("unpaid")}`}
                />
                {order.orderDateISO && (
                  <Chip variant="outlined" label={`${t("orderDate")}: ${formatDateTime(order.orderDateISO, language)}`} />
                )}
              </Stack>

              <Stack spacing={0.5}>
                <Typography variant="subtitle2">{t("adminNote")}</Typography>
                <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }} color={order.note ? "text.primary" : "text.secondary"}>
                  {order.note || "—"}
                </Typography>
              </Stack>

              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell />
                      <TableCell>{t("itemColumn")}</TableCell>
                      <TableCell>{t("productCodeColumn")}</TableCell>
                      <TableCell align="right">{t("quantityColumn")}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {order.items.map((item, index) => (
                      <TableRow key={`${item.productId}-${index}`}>
                        <TableCell>
                          <Avatar variant="rounded" src={item.imageUrl ?? undefined} sx={{ width: 48, height: 48 }} />
                        </TableCell>
                        <TableCell>{item.title}</TableCell>
                        <TableCell>{item.productId}</TableCell>
                        <TableCell align="right">{item.quantity}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Stack>
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}
