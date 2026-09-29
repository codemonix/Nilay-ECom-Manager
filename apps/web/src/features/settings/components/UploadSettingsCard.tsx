import { useEffect, useState } from "react";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Skeleton from "@mui/material/Skeleton";
import { useTranslation } from "react-i18next";
import { IMAGE_UPLOAD_LIMITS } from "@complaint-system/shared";
import { useGetSettingsQuery, useUpdateUploadSettingsMutation } from "../api/settingsApi";
import { getApiErrorMessage } from "../../../utils/apiError";

const LIMITS = IMAGE_UPLOAD_LIMITS.maxImageUploadSizeMB;

function parseSize(value: string): number | null {
  if (!/^\d+(\.\d+)?$/.test(value.trim())) return null;
  const parsed = Number(value);
  return parsed >= LIMITS.min && parsed <= LIMITS.max ? parsed : null;
}

/** Per-image upload cap -- see IMAGE_UPLOAD_LIMITS. */
export function UploadSettingsCard() {
  const { t } = useTranslation("settings");
  const { data: settings, isLoading } = useGetSettingsQuery();
  const [updateUploadSettings, { isLoading: isSaving, error, isSuccess, reset }] = useUpdateUploadSettingsMutation();
  const [sizeInput, setSizeInput] = useState("");

  useEffect(() => {
    if (settings) setSizeInput(String(settings.maxImageUploadSizeMB));
  }, [settings]);

  if (isLoading || !settings) {
    return <Skeleton variant="rounded" height={170} />;
  }

  const sizeMB = parseSize(sizeInput);
  const canSave = sizeMB !== null && sizeMB !== settings.maxImageUploadSizeMB && !isSaving;

  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Stack spacing={1.5}>
        <Typography variant="h3">{t("uploads.title")}</Typography>
        <Typography variant="body2" color="text.secondary">
          {t("uploads.description")}
        </Typography>
        <TextField
          size="small"
          type="number"
          label={t("uploads.maxImageSize")}
          value={sizeInput}
          onChange={(event) => {
            reset();
            setSizeInput(event.target.value);
          }}
          error={sizeMB === null}
          helperText={t("uploads.maxImageSizeHelp", LIMITS)}
          slotProps={{ htmlInput: { min: LIMITS.min, max: LIMITS.max, step: 0.5 } }}
          sx={{ maxWidth: 280 }}
        />
        <Stack direction="row">
          <Button
            variant="contained"
            onClick={() => sizeMB !== null && void updateUploadSettings({ maxImageUploadSizeMB: sizeMB })}
            disabled={!canSave}
          >
            {t("uploads.save")}
          </Button>
        </Stack>
        {isSuccess && <Alert severity="success">{t("uploads.saved")}</Alert>}
        {error && <Alert severity="error">{getApiErrorMessage(error) ?? t("uploads.updateError")}</Alert>}
      </Stack>
    </Paper>
  );
}
