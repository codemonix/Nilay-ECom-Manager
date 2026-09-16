import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import TablePagination from "@mui/material/TablePagination";
import AddIcon from "@mui/icons-material/Add";
import { useTranslation } from "react-i18next";
import { PackageStatus, type PackageListQuery } from "@complaint-system/shared";
import { useListPackagesQuery } from "../api/packagesApi";
import { PackageTable } from "../components/PackageTable";
import { CreatePackageDialog } from "../components/dialogs/CreatePackageDialog";

const DEFAULT_PAGE_SIZE = 20;
type TabValue = "all" | PackageStatus;

function parseQuery(searchParams: URLSearchParams): { tab: TabValue; page: number; pageSize: number } {
  const status = searchParams.get("status") as PackageStatus | null;
  return {
    tab: status ?? "all",
    page: Number(searchParams.get("page") ?? 1),
    pageSize: Number(searchParams.get("pageSize") ?? DEFAULT_PAGE_SIZE),
  };
}

export function PackagesPage() {
  const { t } = useTranslation("purchasing");
  const [searchParams, setSearchParams] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const { tab, page, pageSize } = useMemo(() => parseQuery(searchParams), [searchParams]);

  const query: PackageListQuery = {
    page,
    pageSize,
    ...(tab !== "all" ? { status: tab } : {}),
  };
  const { data, isFetching } = useListPackagesQuery(query);

  const updateParams = (patch: Record<string, string | number | undefined>, resetPage = true) => {
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
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} spacing={2}>
        <Typography variant="h1">{t("packages.title")}</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
          {t("packages.newPackage")}
        </Button>
      </Stack>

      <Tabs
        value={tab}
        onChange={(_e, value: TabValue) => updateParams({ status: value === "all" ? undefined : value })}
        sx={{ borderBottom: 1, borderColor: "divider" }}
        variant="scrollable"
        scrollButtons="auto"
      >
        <Tab value="all" label={t("packages.tabs.all")} />
        <Tab value={PackageStatus.DRAFT} label={t("packages.tabs.draft")} />
        <Tab value={PackageStatus.IN_PROGRESS} label={t("packages.tabs.inProgress")} />
        <Tab value={PackageStatus.COMPLETED} label={t("packages.tabs.completed")} />
      </Tabs>

      {data && (
        <Typography variant="body2" color="text.secondary">
          {t("packages.list.resultsCount", { count: data.total })}
        </Typography>
      )}

      <PackageTable packages={data?.items ?? []} isLoading={isFetching && !data} />

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

      <CreatePackageDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </Stack>
  );
}
