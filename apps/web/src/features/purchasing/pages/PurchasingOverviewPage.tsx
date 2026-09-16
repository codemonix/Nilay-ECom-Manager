import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Grid from "@mui/material/Grid2";
import Skeleton from "@mui/material/Skeleton";
import Alert from "@mui/material/Alert";
import { useTranslation } from "react-i18next";
import { PackageStatus } from "@complaint-system/shared";
import { useGetPurchasingOverviewQuery } from "../api/purchasingOverviewApi";
import { EmptyState } from "../../../components/EmptyState";
import { PackageEventDetail } from "../../../components/PackageEventDetail";
import { formatDateTime } from "../../../utils/localeFormat";
import { useActiveLanguage } from "../../../i18n/useActiveLanguage";

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: "16px", height: "100%" }}>
      <Typography variant="h2" sx={{ fontWeight: 800 }}>
        {value}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
    </Paper>
  );
}

export function PurchasingOverviewPage() {
  const { t } = useTranslation(["purchasing", "common"]);
  const language = useActiveLanguage();
  const { data, isLoading, isError } = useGetPurchasingOverviewQuery();

  if (isLoading) {
    return (
      <Stack spacing={2}>
        <Skeleton variant="rounded" height={72} />
        <Skeleton variant="rounded" height={200} />
      </Stack>
    );
  }

  if (isError || !data) {
    return <Alert severity="error">{t("state.error", { ns: "common" })}</Alert>;
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h1">{t("overview.title")}</Typography>

      <Grid container spacing={2}>
        <Grid size={{ xs: 4 }}>
          <StatTile label={t("status.draft")} value={data.countsByStatus[PackageStatus.DRAFT] ?? 0} />
        </Grid>
        <Grid size={{ xs: 4 }}>
          <StatTile label={t("status.in_progress")} value={data.countsByStatus[PackageStatus.IN_PROGRESS] ?? 0} />
        </Grid>
        <Grid size={{ xs: 4 }}>
          <StatTile label={t("status.completed")} value={data.countsByStatus[PackageStatus.COMPLETED] ?? 0} />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 6 }}>
          <StatTile label={t("overview.itemsPendingMatch")} value={data.itemsPendingMatch} />
        </Grid>
        <Grid size={{ xs: 6 }}>
          <StatTile label={t("overview.itemsPendingInventoryDecision")} value={data.itemsPendingInventoryDecision} />
        </Grid>
      </Grid>

      <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: "16px" }}>
        <Typography variant="h3" sx={{ mb: 1.5 }}>
          {t("overview.recentActivity")}
        </Typography>
        {data.recentEvents.length === 0 ? (
          <EmptyState message={t("overview.noRecentActivity")} />
        ) : (
          <Stack spacing={1}>
            {data.recentEvents.map((event) => (
              <Stack key={event.id} direction="row" spacing={1.5} alignItems="baseline">
                <Typography variant="caption" color="text.secondary" sx={{ minWidth: 130 }}>
                  {formatDateTime(event.createdAt, language)}
                </Typography>
                <Typography variant="body2">{t(`events.${event.type}`, { defaultValue: event.type })}</Typography>
                <PackageEventDetail event={event} />
                {event.actor && (
                  <Typography variant="caption" color="text.secondary">
                    {event.actor.name}
                  </Typography>
                )}
              </Stack>
            ))}
          </Stack>
        )}
      </Paper>
    </Stack>
  );
}
