import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableBody from "@mui/material/TableBody";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import { useTranslation } from "react-i18next";
import type { ImportedOrderDTO } from "../types";
import { Ltr } from "../../../components/Ltr";
import { formatCurrency, formatDateTime } from "../../../utils/localeFormat";
import { useActiveLanguage } from "../../../i18n/useActiveLanguage";

export function OrderDetailDialog({
  order,
  onClose,
}: {
  order: ImportedOrderDTO | null;
  onClose: () => void;
}) {
  const { t } = useTranslation("settings");
  const language = useActiveLanguage();

  return (
    <Dialog open={Boolean(order)} onClose={onClose} maxWidth="sm" fullWidth>
      {order && (
        <>
          <DialogTitle>{t("orders.detail.title", { orderId: order.externalOrderId })}</DialogTitle>
          <DialogContent>
            <Stack spacing={2}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="body2" color="text.secondary">
                  {order.purchaseDate ? formatDateTime(order.purchaseDate, language) : "—"}
                </Typography>
                <Chip size="small" variant="outlined" label={order.status} />
              </Stack>

              <Stack spacing={0.5}>
                <Typography variant="subtitle2">{t("orders.detail.buyer")}</Typography>
                <Typography variant="body2">{order.buyer.fullName}</Typography>
                {order.buyer.mobile && (
                  <Typography variant="body2" color="text.secondary">
                    <Ltr>{order.buyer.mobile}</Ltr>
                  </Typography>
                )}
                {(order.buyer.province || order.buyer.city) && (
                  <Typography variant="body2" color="text.secondary">
                    {[order.buyer.province, order.buyer.city].filter(Boolean).join(" · ")}
                  </Typography>
                )}
                {order.buyer.address && (
                  <Typography variant="body2" color="text.secondary">
                    {order.buyer.address}
                  </Typography>
                )}
              </Stack>

              <Divider />

              <Stack spacing={1}>
                <Typography variant="subtitle2">{t("orders.detail.items")}</Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>{t("orders.detail.item")}</TableCell>
                      <TableCell align="right">{t("orders.detail.quantity")}</TableCell>
                      <TableCell align="right">{t("orders.detail.unitPrice")}</TableCell>
                      <TableCell align="right">{t("orders.detail.amount")}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {order.items.map((item, idx) => (
                      <TableRow key={`${item.productCode}-${idx}`}>
                        <TableCell>{item.title}</TableCell>
                        <TableCell align="right">{item.quantity}</TableCell>
                        <TableCell align="right">{formatCurrency(item.unitPrice, language)}</TableCell>
                        <TableCell align="right">{formatCurrency(item.amount, language)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Stack>

              <Divider />

              <Stack spacing={0.5}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">
                    {t("orders.detail.itemsTotal")}
                  </Typography>
                  <Typography variant="body2">{formatCurrency(order.itemsTotal, language)}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">
                    {t("orders.detail.shippingCost")}
                  </Typography>
                  <Typography variant="body2">{formatCurrency(order.shippingCost, language)}</Typography>
                </Stack>
                {order.discountAmount > 0 && (
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">
                      {t("orders.detail.discount")}
                    </Typography>
                    <Typography variant="body2">-{formatCurrency(order.discountAmount, language)}</Typography>
                  </Stack>
                )}
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="subtitle2">{t("orders.detail.total")}</Typography>
                  <Typography variant="subtitle2">{formatCurrency(order.totalAmount, language)}</Typography>
                </Stack>
              </Stack>

              {(order.userMessage || order.adminNote) && <Divider />}
              {order.userMessage && (
                <Stack spacing={0.5}>
                  <Typography variant="subtitle2">{t("orders.detail.userMessage")}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {order.userMessage}
                  </Typography>
                </Stack>
              )}
              {order.adminNote && (
                <Stack spacing={0.5}>
                  <Typography variant="subtitle2">{t("orders.detail.adminNote")}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {order.adminNote}
                  </Typography>
                </Stack>
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>{t("actions.close", { ns: "common" })}</Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
}
