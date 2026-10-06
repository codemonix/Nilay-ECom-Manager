import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import Skeleton from "@mui/material/Skeleton";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useGetApiVersionQuery } from "../api/settingsApi";
import { APP_VERSION } from "../../../config/appVersion";
import { Ltr } from "../../../components/Ltr";
import { formatDateTime } from "../../../utils/localeFormat";
import { useActiveLanguage } from "../../../i18n/useActiveLanguage";

/**
 * Which build is running. The web app and the API are released together, so
 * their versions normally match; they differ only while this browser tab is
 * still on a bundle loaded before the last deploy, which is worth telling
 * the user about.
 */
export function VersionCard() {
  const { t } = useTranslation("settings");
  const language = useActiveLanguage();
  const { data: api, isLoading, error } = useGetApiVersionQuery();

  const renderRow = (label: string, value: ReactNode, withDivider: boolean) => (
    <Stack
      direction="row"
      justifyContent="space-between"
      alignItems="center"
      sx={withDivider ? { py: 0.75, borderBottom: 1, borderColor: "divider" } : { py: 0.75 }}
    >
      <Typography variant="body2">{label}</Typography>
      <Typography variant="body2" color="text.secondary" component="div">
        {value}
      </Typography>
    </Stack>
  );

  const renderVersion = (version: string, commit: string) => <Ltr>{commit ? `${version} (${commit})` : version}</Ltr>;

  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Stack spacing={1.5}>
        <Typography variant="h3">{t("version.title")}</Typography>

        {api && api.version !== APP_VERSION.version && <Alert severity="warning">{t("version.mismatch")}</Alert>}

        <Stack>
          {renderRow(t("version.web"), renderVersion(APP_VERSION.version, APP_VERSION.commit), true)}
          {renderRow(
            t("version.api"),
            isLoading ? (
              <Skeleton width={120} />
            ) : api ? (
              renderVersion(api.version, api.commit)
            ) : (
              t("version.unavailable")
            ),
            true,
          )}
          {renderRow(
            t("version.buildDate"),
            APP_VERSION.buildDate ? formatDateTime(APP_VERSION.buildDate, language) : t("version.unavailable"),
            false,
          )}
        </Stack>

        {error && !api && <Alert severity="error">{t("version.error")}</Alert>}
      </Stack>
    </Paper>
  );
}
