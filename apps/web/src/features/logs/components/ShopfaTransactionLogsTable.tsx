import { useEffect, useState } from "react";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableBody from "@mui/material/TableBody";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TablePagination from "@mui/material/TablePagination";
import Chip from "@mui/material/Chip";
import Skeleton from "@mui/material/Skeleton";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import { useTranslation } from "react-i18next";
import { useListShopfaTransactionLogsQuery } from "../api/logsApi";
import { EmptyState } from "../../../components/EmptyState";
import { Ltr } from "../../../components/Ltr";
import { formatDateTime } from "../../../utils/localeFormat";
import { useActiveLanguage } from "../../../i18n/useActiveLanguage";

const DEFAULT_PAGE_SIZE = 20;

export function ShopfaTransactionLogsTable() {
  const { t } = useTranslation(["logs", "common"]);
  const language = useActiveLanguage();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [outcome, setOutcome] = useState<"" | "true" | "false">("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const handle = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const { data, isFetching } = useListShopfaTransactionLogsQuery({
    page,
    pageSize,
    success: outcome === "" ? undefined : outcome === "true",
    search: search || undefined,
  });

  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap alignItems="center">
          <TextField
            size="small"
            placeholder={t("logs:shopfa.searchPlaceholder")}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            sx={{ minWidth: 260 }}
          />
          <Select
            size="small"
            value={outcome}
            displayEmpty
            onChange={(e) => {
              setOutcome(e.target.value as "" | "true" | "false");
              setPage(1);
            }}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="">{t("logs:shopfa.allOutcomes")}</MenuItem>
            <MenuItem value="true">{t("logs:shopfa.success")}</MenuItem>
            <MenuItem value="false">{t("logs:shopfa.failed")}</MenuItem>
          </Select>
        </Stack>

        {data && (
          <Typography variant="body2" color="text.secondary">
            {t("logs:resultsCount", { count: data.total })}
          </Typography>
        )}

        {isFetching && !data && (
          <Stack spacing={1}>
            {[1, 2, 3].map((key) => (
              <Skeleton key={key} variant="rounded" height={40} />
            ))}
          </Stack>
        )}

        {data && data.items.length === 0 && <EmptyState message={t("logs:shopfa.empty")} />}

        {data && data.items.length > 0 && (
          <TableContainer sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t("logs:shopfa.columns.time")}</TableCell>
                  <TableCell>{t("logs:shopfa.columns.endpoint")}</TableCell>
                  <TableCell align="right">{t("logs:shopfa.columns.status")}</TableCell>
                  <TableCell>{t("logs:shopfa.columns.outcome")}</TableCell>
                  <TableCell align="right">{t("logs:shopfa.columns.duration")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.items.map((log) => (
                  <TableRow key={log.id} hover>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>
                      <Ltr>{formatDateTime(log.createdAt, language)}</Ltr>
                    </TableCell>
                    <TableCell>
                      <Ltr>
                        {log.method} {log.endpoint}
                      </Ltr>
                    </TableCell>
                    <TableCell align="right">
                      <Ltr>{log.statusCode ?? "—"}</Ltr>
                    </TableCell>
                    <TableCell>
                      {log.success ? (
                        <Chip size="small" label={t("logs:shopfa.success")} color="success" variant="outlined" />
                      ) : (
                        <Tooltip title={log.errorMessage ?? ""}>
                          <Chip size="small" label={t("logs:shopfa.failed")} color="error" variant="outlined" />
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Ltr>{log.durationMs}ms</Ltr>
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
            rowsPerPageOptions={[10, 20, 50, 100]}
            labelRowsPerPage={t("pagination.rowsPerPage", { ns: "common" })}
            onPageChange={(_e, newPage) => setPage(newPage + 1)}
            onRowsPerPageChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
          />
        )}
      </Stack>
    </Paper>
  );
}
