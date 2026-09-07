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
import { useTranslation } from "react-i18next";
import { SystemLogLevel, SYSTEM_LOG_LEVEL_VALUES } from "@complaint-system/shared";
import { useListSystemLogsQuery } from "../api/logsApi";
import { EmptyState } from "../../../components/EmptyState";
import { Ltr } from "../../../components/Ltr";
import { formatDateTime } from "../../../utils/localeFormat";
import { useActiveLanguage } from "../../../i18n/useActiveLanguage";

const DEFAULT_PAGE_SIZE = 20;

const LEVEL_COLOR: Record<SystemLogLevel, "error" | "warning" | "info" | "default"> = {
  [SystemLogLevel.ERROR]: "error",
  [SystemLogLevel.WARN]: "warning",
  [SystemLogLevel.INFO]: "info",
  [SystemLogLevel.HTTP]: "default",
  [SystemLogLevel.DEBUG]: "default",
};

export function SystemLogsTable() {
  const { t } = useTranslation(["logs", "common"]);
  const language = useActiveLanguage();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [level, setLevel] = useState<SystemLogLevel | "">("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const handle = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const { data, isFetching } = useListSystemLogsQuery({
    page,
    pageSize,
    level: level || undefined,
    search: search || undefined,
  });

  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap alignItems="center">
          <TextField
            size="small"
            placeholder={t("logs:system.searchPlaceholder")}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            sx={{ minWidth: 260 }}
          />
          <Select
            size="small"
            value={level}
            displayEmpty
            onChange={(e) => {
              setLevel(e.target.value as SystemLogLevel | "");
              setPage(1);
            }}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="">{t("logs:system.allLevels")}</MenuItem>
            {SYSTEM_LOG_LEVEL_VALUES.map((lvl) => (
              <MenuItem key={lvl} value={lvl}>
                {t(`logs:levels.${lvl}`)}
              </MenuItem>
            ))}
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

        {data && data.items.length === 0 && <EmptyState message={t("logs:system.empty")} />}

        {data && data.items.length > 0 && (
          <TableContainer sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t("logs:system.columns.time")}</TableCell>
                  <TableCell>{t("logs:system.columns.level")}</TableCell>
                  <TableCell>{t("logs:system.columns.message")}</TableCell>
                  <TableCell>{t("logs:system.columns.context")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.items.map((log) => (
                  <TableRow key={log.id} hover>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>
                      <Ltr>{formatDateTime(log.createdAt, language)}</Ltr>
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={t(`logs:levels.${log.level}`)} color={LEVEL_COLOR[log.level]} />
                    </TableCell>
                    <TableCell sx={{ maxWidth: 480, overflowWrap: "anywhere" }}>{log.message}</TableCell>
                    <TableCell>{log.context ?? "—"}</TableCell>
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
