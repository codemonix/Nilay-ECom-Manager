import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Chip from "@mui/material/Chip";
import { useTranslation } from "react-i18next";
import { isValidDateRange, lastDaysRange, type DateRangeValue } from "../dateRange";

const PRESET_DAYS = [7, 30, 90, 365] as const;

interface DateRangeFieldsProps {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  disabled?: boolean;
}

/** Shared period picker for the customer and item-sales reports: from/to date inputs plus one-click "last N days" presets. The period is at most one year (server-enforced, see refineDateWindow). */
export function DateRangeFields({ value, onChange, disabled }: DateRangeFieldsProps) {
  const { t } = useTranslation("reporting", { keyPrefix: "common" });
  const invalid = Boolean(value.from) && Boolean(value.to) && !isValidDateRange(value);
  return (
    <Stack spacing={1}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
        <TextField
          size="small"
          type="date"
          label={t("from")}
          value={value.from}
          onChange={(e) => onChange({ ...value, from: e.target.value })}
          InputLabelProps={{ shrink: true }}
          error={invalid}
          disabled={disabled}
        />
        <TextField
          size="small"
          type="date"
          label={t("to")}
          value={value.to}
          onChange={(e) => onChange({ ...value, to: e.target.value })}
          InputLabelProps={{ shrink: true }}
          error={invalid}
          helperText={invalid ? t("invalidRange") : undefined}
          disabled={disabled}
        />
      </Stack>
      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
        {PRESET_DAYS.map((days) => (
          <Chip
            key={days}
            size="small"
            variant="outlined"
            clickable={!disabled}
            disabled={disabled}
            label={t("lastDays", { count: days })}
            onClick={() => onChange(lastDaysRange(days))}
          />
        ))}
      </Stack>
    </Stack>
  );
}
