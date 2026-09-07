import { useEffect, useState } from "react";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
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
import { useTranslation } from "react-i18next";
import { useListUserActivityLogsQuery } from "../api/logsApi";
import { EmptyState } from "../../../components/EmptyState";
import { Ltr } from "../../../components/Ltr";
import { formatDateTime } from "../../../utils/localeFormat";
import { useActiveLanguage } from "../../../i18n/useActiveLanguage";

const DEFAULT_PAGE_SIZE = 20;

export function UserActivityLogsTable() {
  const { t } = useTranslation(["logs", "common"]);
  const language = useActiveLanguage();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const handle = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const { data, isFetching } = useListUserActivityLogsQuery({
    page,
    pageSize,
    search: search || undefined,
  });

  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Stack spacing={1.5}>
        <TextField
          size="small"
          placeholder={t("logs:activity.searchPlaceholder")}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          sx={{ minWidth: 260, alignSelf: "flex-start" }}
        />

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

        {data && data.items.length === 0 && <EmptyState message={t("logs:activity.empty")} />}

        {data && data.items.length > 0 && (
          <TableContainer sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t("logs:activity.columns.time")}</TableCell>
                  <TableCell>{t("logs:activity.columns.user")}</TableCell>
                  <TableCell>{t("logs:activity.columns.role")}</TableCell>
                  <TableCell>{t("logs:activity.columns.action")}</TableCell>
                  <TableCell align="right">{t("logs:activity.columns.status")}</TableCell>
                  <TableCell align="right">{t("logs:activity.columns.duration")}</TableCell>
                  <TableCell>{t("logs:activity.columns.ip")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.items.map((log) => (
                  <TableRow key={log.id} hover>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>
                      <Ltr>{formatDateTime(log.createdAt, language)}</Ltr>
                    </TableCell>
                    <TableCell>{log.userName}</TableCell>
                    <TableCell>{t(`common:roles.${log.userRole}`)}</TableCell>
                    <TableCell>
                      <Ltr>
                        {log.method} {log.path}
                      </Ltr>
                    </TableCell>
                    <TableCell align="right">
                      <Chip
                        size="small"
                        label={log.statusCode}
                        color={log.statusCode >= 500 ? "error" : log.statusCode >= 400 ? "warning" : "success"}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Ltr>{log.durationMs}ms</Ltr>
                    </TableCell>
                    <TableCell>
                      <Ltr>{log.ip ?? "—"}</Ltr>
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
