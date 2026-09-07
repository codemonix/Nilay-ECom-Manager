import { useRef, type ChangeEvent } from "react";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Divider from "@mui/material/Divider";
import CircularProgress from "@mui/material/CircularProgress";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import { useTranslation } from "react-i18next";
import { useGetSettingsQuery, useImportOrdersFileMutation } from "../api/settingsApi";
import { getApiErrorMessage } from "../../../utils/apiError";
import { formatDateTime } from "../../../utils/localeFormat";
import { useActiveLanguage } from "../../../i18n/useActiveLanguage";

export function ImportOrdersCard() {
  const { t } = useTranslation("settings");
  const language = useActiveLanguage();
  const { data: settings } = useGetSettingsQuery();
  const [importOrdersFile, { isLoading, data: result, error, reset }] = useImportOrdersFileMutation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    reset();
    await importOrdersFile(file);
  };

  const lastImport = settings?.lastImport;

  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Stack spacing={1.5}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" useFlexGap>
          <Box>
            <Typography variant="h3">{t("import.title")}</Typography>
            <Typography variant="body2" color="text.secondary">
              {t("import.description")}
            </Typography>
          </Box>
          <Button
            variant="contained"
            component="label"
            startIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : <UploadFileIcon />}
            disabled={isLoading}
          >
            {t("import.chooseFile")}
            <input
              ref={fileInputRef}
              type="file"
              hidden
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={handleFileSelected}
            />
          </Button>
        </Stack>

        {result && (
          <Alert severity="success">
            {t("import.successSummary", {
              orders: result.ordersImported,
              items: result.itemsImported,
              skipped: result.rowsSkipped,
            })}
          </Alert>
        )}
        {error && <Alert severity="error">{getApiErrorMessage(error) ?? t("import.error")}</Alert>}

        <Divider />

        {lastImport ? (
          <Stack spacing={0.5}>
            <Typography variant="subtitle2">{t("import.lastImport")}</Typography>
            <Typography variant="body2" color="text.secondary">
              {t("import.lastImportSummary", {
                fileName: lastImport.fileName,
                date: formatDateTime(lastImport.importedAt, language),
                user: lastImport.importedByName ?? t("import.systemUser"),
              })}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t("import.lastImportCounts", {
                orders: lastImport.ordersImported,
                items: lastImport.itemsImported,
                skipped: lastImport.rowsSkipped,
              })}
            </Typography>
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">
            {t("import.neverImported")}
          </Typography>
        )}
      </Stack>
    </Paper>
  );
}
