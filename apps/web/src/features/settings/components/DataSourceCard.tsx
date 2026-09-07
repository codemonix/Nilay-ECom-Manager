import { useState, type ChangeEvent } from "react";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Skeleton from "@mui/material/Skeleton";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import { useTranslation } from "react-i18next";
import { useGetSettingsQuery, useTestShopfaConnectionMutation, useUpdateDataSourceMutation } from "../api/settingsApi";
import { DataSource } from "../types";
import { getApiErrorMessage } from "../../../utils/apiError";

export function DataSourceCard() {
  const { t } = useTranslation("settings");
  const { data: settings, isLoading } = useGetSettingsQuery();
  const [updateDataSource, { isLoading: isUpdating, error }] = useUpdateDataSourceMutation();
  const [testConnection, { data: testResult, isLoading: isTesting, error: testError }] =
    useTestShopfaConnectionMutation();
  const [showRaw, setShowRaw] = useState(false);

  if (isLoading || !settings) {
    return <Skeleton variant="rounded" height={150} />;
  }

  const isLive = settings.dataSource === DataSource.LIVE_API;
  const canEnableLive = settings.shopfaApiConfigured;

  const handleToggle = (event: ChangeEvent<HTMLInputElement>) => {
    void updateDataSource(event.target.checked ? DataSource.LIVE_API : DataSource.IMPORTED_FILE);
  };

  const handleTestConnection = () => {
    setShowRaw(false);
    void testConnection();
  };

  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Stack spacing={1.5}>
        <Typography variant="h3">{t("dataSource.title")}</Typography>
        <Typography variant="body2" color="text.secondary">
          {t("dataSource.description")}
        </Typography>
        <FormControlLabel
          control={
            <Switch
              checked={isLive}
              onChange={handleToggle}
              disabled={isUpdating || (!isLive && !canEnableLive)}
            />
          }
          label={isLive ? t("dataSource.liveEnabled") : t("dataSource.liveDisabled")}
        />
        {!canEnableLive && (
          <Alert severity="info" variant="outlined">
            {t("dataSource.notConfigured")}
          </Alert>
        )}
        {error && <Alert severity="error">{getApiErrorMessage(error) ?? t("dataSource.updateError")}</Alert>}

        <Stack spacing={1} alignItems="flex-start" sx={{ pt: 1, borderTop: 1, borderColor: "divider" }}>
          <Typography variant="body2" color="text.secondary" sx={{ pt: 1 }}>
            {t("dataSource.testConnectionHelp")}
          </Typography>
          <Button
            variant="outlined"
            size="small"
            onClick={handleTestConnection}
            disabled={isTesting}
            startIcon={isTesting ? <CircularProgress size={16} /> : undefined}
          >
            {isTesting ? t("dataSource.testConnectionRunning") : t("dataSource.testConnection")}
          </Button>

          {testError && (
            <Alert severity="error" sx={{ width: "100%" }}>
              {getApiErrorMessage(testError) ?? t("dataSource.testConnectionRequestFailed")}
            </Alert>
          )}

          {testResult && (
            <Alert severity={testResult.ok ? "success" : "error"} sx={{ width: "100%" }}>
              <AlertTitle>
                {testResult.ok ? t("dataSource.testConnectionSuccess") : t("dataSource.testConnectionFailure")}
              </AlertTitle>
              {testResult.ok && testResult.shop
                ? t("dataSource.testConnectionShopInfo", {
                    title: testResult.shop.title ?? "—",
                    domain: testResult.shop.domain ?? "—",
                  })
                : testResult.message}
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <Button size="small" onClick={() => setShowRaw((prev) => !prev)}>
                  {showRaw ? t("dataSource.hideRawResponse") : t("dataSource.showRawResponse")}
                </Button>
              </Stack>
              {showRaw && (
                <Typography
                  component="pre"
                  variant="caption"
                  sx={{
                    mt: 1,
                    p: 1.5,
                    bgcolor: "action.hover",
                    borderRadius: 1,
                    overflowX: "auto",
                    direction: "ltr",
                    textAlign: "left",
                  }}
                >
                  {JSON.stringify(testResult.raw ?? testResult, null, 2)}
                </Typography>
              )}
            </Alert>
          )}
        </Stack>
      </Stack>
    </Paper>
  );
}
