import { useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import TablePagination from "@mui/material/TablePagination";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import Skeleton from "@mui/material/Skeleton";
import SearchIcon from "@mui/icons-material/Search";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useTranslation } from "react-i18next";
import { useListPackingHistoryQuery } from "../api/packingApi";
import type { PackingRecordDTO } from "../types";
import { ItemPhoto } from "../../../components/ItemPhoto";
import { EmptyState } from "../../../components/EmptyState";
import { getApiErrorMessage } from "../../../utils/apiError";
import { formatDateTime } from "../../../utils/localeFormat";
import { useActiveLanguage } from "../../../i18n/useActiveLanguage";

const DEFAULT_PAGE_SIZE = 10;

function PackingHistoryCard({ record, language }: { record: PackingRecordDTO; language: ReturnType<typeof useActiveLanguage> }) {
  const { t } = useTranslation("packing");

  return (
    <Card variant="outlined" sx={{ borderRadius: "14px" }}>
      <CardContent>
        <Stack direction="row" spacing={2} alignItems="flex-start">
          {record.photoUrl ? (
            <ItemPhoto src={record.photoUrl} alt={t("photoAlt")} size={88} />
          ) : (
            <Stack
              alignItems="center"
              justifyContent="center"
              sx={{ width: 88, height: 88, borderRadius: "12px", bgcolor: "action.hover", flexShrink: 0 }}
            >
              <Typography variant="caption" color="text.secondary" align="center">
                {t("historyNoPhoto")}
              </Typography>
            </Stack>
          )}
          <Stack spacing={0.5} sx={{ flexGrow: 1, minWidth: 0 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
              <Typography variant="subtitle1">{record.buyerName || t("guestBuyer")}</Typography>
              <Chip size="small" label={record.statusTitleAfterSend} color="success" variant="outlined" />
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {t("orderNumberLabel")}: {record.orderNumber}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t("historySentAt")}: {formatDateTime(record.sentAtISO, language)}
              {record.sentByName ? ` · ${t("historySentBy")}: ${record.sentByName}` : ""}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t("historyItemsCount", { count: record.items.length })}
            </Typography>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

/**
 * Browsable history of every order Packing has sent, kept locally since
 * Shopfa itself has no equivalent view -- see packingService.markOrderPacked
 * for why this exists as a separate local record. Search matches order
 * number or buyer name, mirroring ImportedOrdersTable's debounced-search +
 * server-paginated pattern.
 */
export function PackingHistoryPage() {
  const { t } = useTranslation("packing");
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

  const { data, isFetching, error } = useListPackingHistoryQuery({ page, pageSize, search: search || undefined });

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Button component={RouterLink} to="/packing" startIcon={<ArrowBackIcon />} size="small">
          {t("backToPacking")}
        </Button>
      </Stack>

      <Typography variant="h1">{t("historyTitle")}</Typography>
      <Typography variant="body2" color="text.secondary">
        {t("historyDescription")}
      </Typography>

      <TextField
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        placeholder={t("historySearchPlaceholder")}
        size="small"
        fullWidth
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          },
        }}
      />

      {error && <Alert severity="error">{getApiErrorMessage(error) ?? t("loadError")}</Alert>}

      {isFetching && !data && (
        <Stack spacing={2}>
          {[1, 2, 3].map((key) => (
            <Skeleton key={key} variant="rounded" height={104} sx={{ borderRadius: "14px" }} />
          ))}
        </Stack>
      )}

      {data && data.items.length === 0 && <EmptyState message={t("historyNoResults")} />}

      {data && data.items.length > 0 && (
        <Stack spacing={1.5}>
          {data.items.map((record) => (
            <PackingHistoryCard key={record.id} record={record} language={language} />
          ))}
        </Stack>
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
  );
}
