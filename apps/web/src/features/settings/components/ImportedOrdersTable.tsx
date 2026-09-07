import { useEffect, useState } from "react";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableBody from "@mui/material/TableBody";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TablePagination from "@mui/material/TablePagination";
import Skeleton from "@mui/material/Skeleton";
import { useTranslation } from "react-i18next";
import { useListImportedOrdersQuery } from "../api/importedOrdersApi";
import type { ImportedOrderDTO } from "../types";
import { EmptyState } from "../../../components/EmptyState";
import { Ltr } from "../../../components/Ltr";
import { formatCurrency, formatDateTime } from "../../../utils/localeFormat";
import { useActiveLanguage } from "../../../i18n/useActiveLanguage";
import { OrderDetailDialog } from "./OrderDetailDialog";

const DEFAULT_PAGE_SIZE = 10;

export function ImportedOrdersTable() {
  const { t } = useTranslation("settings");
  const language = useActiveLanguage();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<ImportedOrderDTO | null>(null);

  useEffect(() => {
    const handle = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const { data, isFetching } = useListImportedOrdersQuery({
    page,
    pageSize,
    search: search || undefined,
  });

  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Stack spacing={1.5}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography variant="h3">{t("orders.title")}</Typography>
          <TextField
            size="small"
            placeholder={t("orders.searchPlaceholder")}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            sx={{ minWidth: 260 }}
          />
        </Stack>

        {data && (
          <Typography variant="body2" color="text.secondary">
            {t("orders.resultsCount", { count: data.total })}
          </Typography>
        )}

        {isFetching && !data && (
          <Stack spacing={1}>
            {[1, 2, 3].map((key) => (
              <Skeleton key={key} variant="rounded" height={40} />
            ))}
          </Stack>
        )}

        {data && data.items.length === 0 && <EmptyState message={t("orders.empty")} />}

        {data && data.items.length > 0 && (
          <TableContainer sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t("orders.columns.orderId")}</TableCell>
                  <TableCell>{t("orders.columns.buyer")}</TableCell>
                  <TableCell>{t("orders.columns.city")}</TableCell>
                  <TableCell>{t("orders.columns.status")}</TableCell>
                  <TableCell align="right">{t("orders.columns.items")}</TableCell>
                  <TableCell align="right">{t("orders.columns.total")}</TableCell>
                  <TableCell>{t("orders.columns.purchaseDate")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.items.map((order) => (
                  <TableRow
                    key={order.id}
                    hover
                    onClick={() => setSelectedOrder(order)}
                    sx={{ cursor: "pointer" }}
                  >
                    <TableCell>
                      <Ltr>{order.externalOrderId}</Ltr>
                    </TableCell>
                    <TableCell>{order.buyer.fullName}</TableCell>
                    <TableCell>{order.buyer.city ?? "—"}</TableCell>
                    <TableCell>{order.status}</TableCell>
                    <TableCell align="right">{order.items.length}</TableCell>
                    <TableCell align="right">{formatCurrency(order.totalAmount, language)}</TableCell>
                    <TableCell>
                      {order.purchaseDate ? formatDateTime(order.purchaseDate, language) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {data && data.total > 0 && (
          <TablePagination
            component="div"
            count={data.total}
            page={data.page - 1}
            rowsPerPage={data.pageSize}
            rowsPerPageOptions={[10, 20, 50]}
            labelRowsPerPage={t("pagination.rowsPerPage", { ns: "common" })}
            onPageChange={(_e, newPage) => setPage(newPage + 1)}
            onRowsPerPageChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
          />
        )}
      </Stack>

      <OrderDetailDialog order={selectedOrder} onClose={() => setSelectedOrder(null)} />
    </Paper>
  );
}
