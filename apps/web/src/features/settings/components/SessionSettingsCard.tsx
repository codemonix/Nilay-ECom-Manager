import { useEffect, useState } from "react";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Skeleton from "@mui/material/Skeleton";
import { useTranslation } from "react-i18next";
import { SESSION_TTL_LIMITS } from "@complaint-system/shared";
import { useGetSettingsQuery, useUpdateSessionSettingsMutation } from "../api/settingsApi";
import { getApiErrorMessage } from "../../../utils/apiError";

const { accessTokenTtlMinutes: ACCESS_LIMITS, refreshTokenTtlDays: REFRESH_LIMITS } = SESSION_TTL_LIMITS;

function parseInRange(value: string, limits: { min: number; max: number }): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  const parsed = Number(value);
  return parsed >= limits.min && parsed <= limits.max ? parsed : null;
}

/** Admin-only: access/refresh token lifetimes -- see SESSION_TTL_LIMITS. */
export function SessionSettingsCard() {
  const { t } = useTranslation("settings");
  const { data: settings, isLoading } = useGetSettingsQuery();
  const [updateSessionSettings, { isLoading: isSaving, error, isSuccess, reset }] = useUpdateSessionSettingsMutation();
  const [accessInput, setAccessInput] = useState("");
  const [refreshInput, setRefreshInput] = useState("");

  useEffect(() => {
    if (!settings) return;
    setAccessInput(String(settings.accessTokenTtlMinutes));
    setRefreshInput(String(settings.refreshTokenTtlDays));
  }, [settings]);

  if (isLoading || !settings) {
    return <Skeleton variant="rounded" height={190} />;
  }

  const accessMinutes = parseInRange(accessInput, ACCESS_LIMITS);
  const refreshDays = parseInRange(refreshInput, REFRESH_LIMITS);
  const refreshNotLonger =
    accessMinutes !== null && refreshDays !== null && refreshDays * 24 * 60 <= accessMinutes;
  const isDirty =
    accessMinutes !== settings.accessTokenTtlMinutes || refreshDays !== settings.refreshTokenTtlDays;
  const canSave = accessMinutes !== null && refreshDays !== null && !refreshNotLonger && isDirty && !isSaving;

  const handleSave = () => {
    if (accessMinutes === null || refreshDays === null) return;
    void updateSessionSettings({ accessTokenTtlMinutes: accessMinutes, refreshTokenTtlDays: refreshDays });
  };

  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Stack spacing={1.5}>
        <Typography variant="h3">{t("session.title")}</Typography>
        <Typography variant="body2" color="text.secondary">
          {t("session.description")}
        </Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "flex-start" }}>
          <TextField
            size="small"
            type="number"
            label={t("session.accessTokenTtl")}
            value={accessInput}
            onChange={(event) => {
              reset();
              setAccessInput(event.target.value);
            }}
            error={accessMinutes === null}
            helperText={t("session.accessTokenTtlHelp", ACCESS_LIMITS)}
            slotProps={{ htmlInput: { min: ACCESS_LIMITS.min, max: ACCESS_LIMITS.max, step: 1 } }}
            sx={{ maxWidth: 280 }}
          />
          <TextField
            size="small"
            type="number"
            label={t("session.refreshTokenTtl")}
            value={refreshInput}
            onChange={(event) => {
              reset();
              setRefreshInput(event.target.value);
            }}
            error={refreshDays === null || refreshNotLonger}
            helperText={
              refreshNotLonger ? t("session.refreshMustBeLonger") : t("session.refreshTokenTtlHelp", REFRESH_LIMITS)
            }
            slotProps={{ htmlInput: { min: REFRESH_LIMITS.min, max: REFRESH_LIMITS.max, step: 1 } }}
            sx={{ maxWidth: 280 }}
          />
        </Stack>
        <Stack direction="row">
          <Button variant="contained" onClick={handleSave} disabled={!canSave}>
            {t("session.save")}
          </Button>
        </Stack>
        {isSuccess && <Alert severity="success">{t("session.saved")}</Alert>}
        {error && <Alert severity="error">{getApiErrorMessage(error) ?? t("session.updateError")}</Alert>}
      </Stack>
    </Paper>
  );
}
