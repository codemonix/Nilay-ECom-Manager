import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import TablePagination from "@mui/material/TablePagination";
import AddIcon from "@mui/icons-material/Add";
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);

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

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" useFlexGap>
        <Typography variant="h1">{t("title")}</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
          {t("createCase")}
        </Button>
      </Stack>

      <CaseFilters
        value={query}
        onChange={(patch) => updateParams(patch)}
        onClear={() => setSearchParams(new URLSearchParams())}
      />

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

      <CreateCaseDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </Stack>
  );
}
