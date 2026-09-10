import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import RefreshIcon from "@mui/icons-material/Refresh";
import Skeleton from "@mui/material/Skeleton";
import Alert from "@mui/material/Alert";
import { useTranslation } from "react-i18next";
import { useGetLogSizesQuery } from "../api/settingsApi";
import type { LogCollectionSizeDTO } from "../types";
import { formatBytes, formatNumber } from "../../../utils/localeFormat";
import { useActiveLanguage } from "../../../i18n/useActiveLanguage";
import { getApiErrorMessage } from "../../../utils/apiError";

/** Sizes for the two log streams that have no automatic rotation (SystemLog is capped at 60 days / 50 MB and doesn't need watching here -- see the Logs page for it). */
export function LogSizesCard() {
  const { t } = useTranslation("settings");
  const language = useActiveLanguage();
  const { data, isLoading, isFetching, error, refetch } = useGetLogSizesQuery();

  const renderRow = (label: string, stats: LogCollectionSizeDTO, withDivider: boolean) => (
    <Stack
      direction="row"
      justifyContent="space-between"
      alignItems="center"
      sx={withDivider ? { py: 0.75, borderBottom: 1, borderColor: "divider" } : { py: 0.75 }}
    >
      <Typography variant="body2">{label}</Typography>
      <Typography variant="body2" color="text.secondary">
        {t("logSizes.summary", {
          size: formatBytes(stats.sizeBytes, language),
          // Named "entries", not "count" -- i18next reserves the `count`
          // interpolation key for its own pluralization logic and requires
          // it to be a number, not this already-formatted display string.
          entries: formatNumber(stats.documentCount, language),
        })}
      </Typography>
    </Stack>
  );

  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Stack spacing={1.5}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h3">{t("logSizes.title")}</Typography>
          <Tooltip title={t("logSizes.refresh")}>
            <span>
              <IconButton size="small" onClick={() => void refetch()} disabled={isFetching}>
                <RefreshIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
        <Typography variant="body2" color="text.secondary">
          {t("logSizes.description")}
        </Typography>

        {isLoading && (
          <Stack spacing={1}>
            <Skeleton variant="rounded" height={32} />
            <Skeleton variant="rounded" height={32} />
          </Stack>
        )}

        {error && <Alert severity="error">{getApiErrorMessage(error) ?? t("logSizes.error")}</Alert>}

        {data && (
          <Stack>
            {renderRow(t("logSizes.userActivity"), data.userActivity, true)}
            {renderRow(t("logSizes.shopfaTransactions"), data.shopfaTransactions, false)}
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}
