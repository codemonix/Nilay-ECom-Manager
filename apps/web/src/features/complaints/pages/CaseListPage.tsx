import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Fab from "@mui/material/Fab";
import Badge from "@mui/material/Badge";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TablePagination from "@mui/material/TablePagination";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from "@mui/icons-material/FilterList";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import { useTranslation } from "react-i18next";
import type { CaseListQuery } from "@complaint-system/shared";
import { useListCasesQuery } from "../api/casesApi";
import { CaseFilters } from "../components/CaseFilters";
import { CaseTable } from "../components/CaseTable";
import { CreateCaseDialog } from "../components/CreateCaseDialog";

const DEFAULT_PAGE_SIZE = 20;

function parseQuery(searchParams: URLSearchParams): CaseListQuery {
  const query: CaseListQuery = {
    page: Number(searchParams.get("page") ?? 1),
    pageSize: Number(searchParams.get("pageSize") ?? DEFAULT_PAGE_SIZE),
    sortBy: (searchParams.get("sortBy") as CaseListQuery["sortBy"]) ?? "lastActivityAt",
    sortDir: (searchParams.get("sortDir") as CaseListQuery["sortDir"]) ?? "desc",
  };
  const search = searchParams.get("search");
  const status = searchParams.get("status");
  const priority = searchParams.get("priority");
  const category = searchParams.get("category");
  const assignedTo = searchParams.get("assignedTo");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  if (search) query.search = search;
  if (status) query.status = status as CaseListQuery["status"];
  if (priority) query.priority = priority as CaseListQuery["priority"];
  if (category) query.category = category as CaseListQuery["category"];
  if (assignedTo) query.assignedTo = assignedTo;
  if (dateFrom) query.dateFrom = dateFrom;
  if (dateTo) query.dateTo = dateTo;
  return query;
}

export function CaseListPage() {
  const { t } = useTranslation("complaints");
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [searchParams, setSearchParams] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mobileSearch, setMobileSearch] = useState("");

  const query = useMemo(() => parseQuery(searchParams), [searchParams]);
  const { data, isFetching } = useListCasesQuery(query);

  const updateParams = (patch: Partial<CaseListQuery>, resetPage = true) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([key, val]) => {
      if (val === undefined || val === "") next.delete(key);
      else next.set(key, String(val));
    });
    if (resetPage) next.set("page", "1");
    setSearchParams(next);
  };

  useEffect(() => setMobileSearch(query.search ?? ""), [query.search]);

  useEffect(() => {
    const handle = setTimeout(() => {
      if (mobileSearch !== (query.search ?? "")) updateParams({ search: mobileSearch || undefined });
    }, 350);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mobileSearch]);

  const activeFilterCount = [
    query.status,
    query.priority,
    query.category,
    query.assignedTo,
    query.dateFrom,
    query.dateTo,
  ].filter(Boolean).length;

  return (
    <Stack spacing={2} sx={{ pb: isMobile ? 9 : 0 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" useFlexGap>
        <Typography variant="h1">{t("title")}</Typography>
        {!isMobile && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
            {t("createCase")}
          </Button>
        )}
      </Stack>

      {isMobile ? (
        <Stack direction="row" spacing={1}>
          <TextField
            size="small"
            placeholder={t("list.searchPlaceholder")}
            value={mobileSearch}
            onChange={(e) => setMobileSearch(e.target.value)}
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
          <Badge badgeContent={activeFilterCount} color="primary">
            <Button
              variant="outlined"
              onClick={() => setFiltersOpen(true)}
              sx={{ minWidth: 0, px: 1.5 }}
              aria-label={t("actions.filters", { ns: "common" })}
            >
              <FilterListIcon fontSize="small" />
            </Button>
          </Badge>
        </Stack>
      ) : (
        <CaseFilters
          value={query}
          onChange={(patch) => updateParams(patch)}
          onClear={() => setSearchParams(new URLSearchParams())}
        />
      )}

      {data && (
        <Typography variant="body2" color="text.secondary">
          {t("list.resultsCount", { count: data.total })}
        </Typography>
      )}

      <CaseTable cases={data?.items ?? []} isLoading={isFetching && !data} />

      {data && data.total > 0 && (
        <TablePagination
          component="div"
          count={data.total}
          page={data.page - 1}
          rowsPerPage={data.pageSize}
          rowsPerPageOptions={[10, 20, 50]}
          labelRowsPerPage={t("pagination.rowsPerPage", { ns: "common" })}
          onPageChange={(_e, newPage) => updateParams({ page: newPage + 1 }, false)}
          onRowsPerPageChange={(e) => updateParams({ pageSize: Number(e.target.value) })}
        />
      )}

      {isMobile && (
        <Fab
          color="primary"
          aria-label={t("createCase")}
          onClick={() => setCreateOpen(true)}
          sx={{
            position: "fixed",
            bottom: "calc(64px + env(safe-area-inset-bottom) + 16px)",
            insetInlineEnd: 20,
          }}
        >
          <AddIcon />
        </Fab>
      )}

      <Dialog open={filtersOpen} onClose={() => setFiltersOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{t("actions.filters", { ns: "common" })}</DialogTitle>
        <DialogContent>
          <CaseFilters value={query} onChange={(patch) => updateParams(patch)} onClear={() => {}} bare hideSearch />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setSearchParams(new URLSearchParams());
              setFiltersOpen(false);
            }}
          >
            {t("actions.clearFilters", { ns: "common" })}
          </Button>
          <Button variant="contained" onClick={() => setFiltersOpen(false)}>
            {t("actions.apply", { ns: "common" })}
          </Button>
        </DialogActions>
      </Dialog>

      <CreateCaseDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </Stack>
  );
}
