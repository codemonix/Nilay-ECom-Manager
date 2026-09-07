import { useEffect, useState } from "react";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import InputAdornment from "@mui/material/InputAdornment";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import { useTranslation } from "react-i18next";
import {
  CASE_CATEGORY_VALUES,
  CASE_PRIORITY_VALUES,
  CASE_STATUS_VALUES,
  type CaseListQuery,
} from "@complaint-system/shared";
import { useListUsersQuery } from "../../users/api/usersApi";

interface CaseFiltersProps {
  value: CaseListQuery;
  onChange: (patch: Partial<CaseListQuery>) => void;
  onClear: () => void;
}

export function CaseFilters({ value, onChange, onClear }: CaseFiltersProps) {
  const { t } = useTranslation("complaints");
  const { data: users = [] } = useListUsersQuery();
  const [search, setSearch] = useState(value.search ?? "");

  useEffect(() => setSearch(value.search ?? ""), [value.search]);

  useEffect(() => {
    const handle = setTimeout(() => {
      if (search !== (value.search ?? "")) onChange({ search: search || undefined });
    }, 350);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const hasActiveFilters = Boolean(
    value.search || value.status || value.priority || value.category || value.assignedTo || value.dateFrom || value.dateTo,
  );

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
      <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap alignItems="center">
        <TextField
          size="small"
          placeholder={t("list.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ minWidth: 260, flexGrow: 1 }}
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

        <TextField
          select
          size="small"
          label={t("list.filterStatus")}
          value={value.status ?? ""}
          onChange={(e) => onChange({ status: (e.target.value || undefined) as CaseListQuery["status"] })}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="">{t("list.allStatuses")}</MenuItem>
          {CASE_STATUS_VALUES.map((s) => (
            <MenuItem key={s} value={s}>
              {t(`status.${s}`)}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          size="small"
          label={t("list.filterPriority")}
          value={value.priority ?? ""}
          onChange={(e) => onChange({ priority: (e.target.value || undefined) as CaseListQuery["priority"] })}
          sx={{ minWidth: 150 }}
        >
          <MenuItem value="">{t("list.allPriorities")}</MenuItem>
          {CASE_PRIORITY_VALUES.map((p) => (
            <MenuItem key={p} value={p}>
              {t(`priority.${p}`)}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          size="small"
          label={t("list.filterCategory")}
          value={value.category ?? ""}
          onChange={(e) => onChange({ category: (e.target.value || undefined) as CaseListQuery["category"] })}
          sx={{ minWidth: 170 }}
        >
          <MenuItem value="">{t("list.allCategories")}</MenuItem>
          {CASE_CATEGORY_VALUES.map((c) => (
            <MenuItem key={c} value={c}>
              {t(`category.${c}`)}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          size="small"
          label={t("list.filterAssignedTo")}
          value={value.assignedTo ?? ""}
          onChange={(e) => onChange({ assignedTo: e.target.value || undefined })}
          sx={{ minWidth: 170 }}
        >
          <MenuItem value="">{t("list.allStaff")}</MenuItem>
          {users.map((u) => (
            <MenuItem key={u.id} value={u.id}>
              {u.name}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          size="small"
          type="date"
          label={t("list.filterDateFrom")}
          value={value.dateFrom ?? ""}
          onChange={(e) => onChange({ dateFrom: e.target.value || undefined })}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ minWidth: 150 }}
        />
        <TextField
          size="small"
          type="date"
          label={t("list.filterDateTo")}
          value={value.dateTo ?? ""}
          onChange={(e) => onChange({ dateTo: e.target.value || undefined })}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ minWidth: 150 }}
        />

        {hasActiveFilters && (
          <Button size="small" startIcon={<ClearIcon />} onClick={onClear}>
            {t("actions.clearFilters", { ns: "common" })}
          </Button>
        )}
      </Stack>
    </Paper>
  );
}
