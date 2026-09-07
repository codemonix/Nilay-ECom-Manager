import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Select, { type SelectChangeEvent } from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Alert from "@mui/material/Alert";
import Skeleton from "@mui/material/Skeleton";
import { useTranslation } from "react-i18next";
import { SYSTEM_LOG_LEVEL_VALUES, type SystemLogLevel } from "../types";
import { useGetSettingsQuery, useUpdateSystemLogLevelMutation } from "../api/settingsApi";
import { getApiErrorMessage } from "../../../utils/apiError";

export function LogLevelCard() {
  const { t } = useTranslation("settings");
  const { data: settings, isLoading } = useGetSettingsQuery();
  const [updateSystemLogLevel, { isLoading: isUpdating, error }] = useUpdateSystemLogLevelMutation();

  if (isLoading || !settings) {
    return <Skeleton variant="rounded" height={130} />;
  }

  const handleChange = (event: SelectChangeEvent<string>) => {
    void updateSystemLogLevel(event.target.value as SystemLogLevel);
  };

  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Stack spacing={1.5}>
        <Typography variant="h3">{t("logLevel.title")}</Typography>
        <Typography variant="body2" color="text.secondary">
          {t("logLevel.description")}
        </Typography>
        <Select
          size="small"
          value={settings.systemLogLevel}
          disabled={isUpdating}
          onChange={handleChange}
          sx={{ maxWidth: 280 }}
        >
          {SYSTEM_LOG_LEVEL_VALUES.map((level) => (
            <MenuItem key={level} value={level}>
              {t(`logLevel.levels.${level}`)}
            </MenuItem>
          ))}
        </Select>
        {error && <Alert severity="error">{getApiErrorMessage(error) ?? t("logLevel.updateError")}</Alert>}
      </Stack>
    </Paper>
  );
}
