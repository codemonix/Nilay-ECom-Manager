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
  /** Skip the outer Paper — used when the caller already provides a container (e.g. a bottom sheet). */
  bare?: boolean;
  /** Hide the free-text search field — used when the caller renders search separately. */
  hideSearch?: boolean;
}

export function CaseFilters({ value, onChange, onClear, bare, hideSearch }: CaseFiltersProps) {
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

  const content = (
    <Stack
      direction={bare ? "column" : "row"}
      spacing={bare ? 2 : 1.5}
      flexWrap={bare ? undefined : "wrap"}
      useFlexGap={!bare}
      alignItems={bare ? "stretch" : "center"}
    >
      {!hideSearch && (
        <TextField
          size="small"
          placeholder={t("list.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          fullWidth={bare}
          sx={bare ? undefined : { minWidth: 260, flexGrow: 1 }}
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
      )}

      <TextField
        select
        size="small"
        label={t("list.filterStatus")}
        value={value.status ?? ""}
        onChange={(e) => onChange({ status: (e.target.value || undefined) as CaseListQuery["status"] })}
        fullWidth={bare}
        sx={bare ? undefined : { minWidth: 160 }}
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
        fullWidth={bare}
        sx={bare ? undefined : { minWidth: 150 }}
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
        fullWidth={bare}
        sx={bare ? undefined : { minWidth: 170 }}
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
        fullWidth={bare}
        sx={bare ? undefined : { minWidth: 170 }}
      >
        <MenuItem value="">{t("list.allStaff")}</MenuItem>
        {users.map((u) => (
          <MenuItem key={u.id} value={u.id}>
            {u.name}
          </MenuItem>
        ))}
      </TextField>

      <Stack direction="row" spacing={1.5} sx={bare ? undefined : { minWidth: 320 }}>
        <TextField
          size="small"
          type="date"
          label={t("list.filterDateFrom")}
          value={value.dateFrom ?? ""}
          onChange={(e) => onChange({ dateFrom: e.target.value || undefined })}
          slotProps={{ inputLabel: { shrink: true } }}
          fullWidth={bare}
          sx={bare ? undefined : { minWidth: 150 }}
        />
        <TextField
          size="small"
          type="date"
          label={t("list.filterDateTo")}
          value={value.dateTo ?? ""}
          onChange={(e) => onChange({ dateTo: e.target.value || undefined })}
          slotProps={{ inputLabel: { shrink: true } }}
          fullWidth={bare}
          sx={bare ? undefined : { minWidth: 150 }}
        />
      </Stack>

      {!bare && hasActiveFilters && (
        <Button size="small" startIcon={<ClearIcon />} onClick={onClear}>
          {t("actions.clearFilters", { ns: "common" })}
        </Button>
      )}
    </Stack>
  );

  if (bare) return content;

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
      {content}
    </Paper>
  );
}
