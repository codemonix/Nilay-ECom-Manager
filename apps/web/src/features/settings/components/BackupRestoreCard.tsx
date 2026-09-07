import { useRef, useState } from "react";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import { useTranslation } from "react-i18next";
import { API_URL } from "../../../services/apiSlice";

type BackupType = "settings" | "data";

export function BackupRestoreCard() {
  const { t } = useTranslation("settings");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<BackupType | null>(null);
  const settingsInput = useRef<HTMLInputElement>(null);
  const dataInput = useRef<HTMLInputElement>(null);

  const download = async (type: BackupType) => {
    setError(null);
    setBusy(type);
    try {
      const response = await fetch(`${API_URL}/settings/${type === "settings" ? "backup" : "data-backup"}`);
      if (!response.ok) throw new Error(t("backupRestore.error"));
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = type === "settings" ? "settings-backup.json" : "system-data-backup.json";
      link.click();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : t("backupRestore.error"));
    } finally {
      setBusy(null);
    }
  };

  const restore = async (type: BackupType, file: File) => {
    setError(null);
    setBusy(type);
    try {
      const payload = JSON.parse(await file.text()) as { type?: BackupType };
      if (payload.type !== type) throw new Error(t("backupRestore.wrongType"));
      const response = await fetch(`${API_URL}/settings/${type === "settings" ? "restore" : "data-restore"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(t("backupRestore.error"));
      window.location.reload();
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : t("backupRestore.error"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Stack spacing={1.5}>
        <Typography variant="h3">{t("backupRestore.title")}</Typography>
        <Typography variant="body2" color="text.secondary">{t("backupRestore.description")}</Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <Button variant="outlined" disabled={busy !== null} onClick={() => void download("settings")}>{t("backupRestore.backupSettings")}</Button>
          <Button variant="outlined" disabled={busy !== null} onClick={() => settingsInput.current?.click()}>{t("backupRestore.restoreSettings")}</Button>
          <input ref={settingsInput} hidden type="file" accept="application/json,.json" onChange={(event) => event.target.files?.[0] && void restore("settings", event.target.files[0])} />
        </Stack>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <Button variant="outlined" disabled={busy !== null} onClick={() => void download("data")}>{t("backupRestore.backupData")}</Button>
          <Button variant="outlined" disabled={busy !== null} onClick={() => dataInput.current?.click()}>{t("backupRestore.restoreData")}</Button>
          <input ref={dataInput} hidden type="file" accept="application/json,.json" onChange={(event) => event.target.files?.[0] && void restore("data", event.target.files[0])} />
        </Stack>
        {error && <Alert severity="error">{error}</Alert>}
      </Stack>
    </Paper>
  );
}