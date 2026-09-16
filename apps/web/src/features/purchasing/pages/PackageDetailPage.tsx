import { useState } from "react";
import { useParams, Link as RouterLink } from "react-router-dom";
import Grid from "@mui/material/Grid2";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import Skeleton from "@mui/material/Skeleton";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import Paper from "@mui/material/Paper";
import Button from "@mui/material/Button";
import { useTranslation } from "react-i18next";
import { useGetPackageEventsQuery, useGetPackageQuery } from "../api/packagesApi";
import { PackageStatusChip } from "../../../components/PackageStatusChip";
import { ItemMatchCard } from "../components/ItemMatchCard";
import { PackageEventDetail } from "../../../components/PackageEventDetail";
import { PackageAttachmentsPanel } from "../components/PackageAttachmentsPanel";
import { PackageStatusDialog } from "../components/dialogs/PackageStatusDialog";
import { EmptyState } from "../../../components/EmptyState";
import { Ltr } from "../../../components/Ltr";
import { formatDateTime } from "../../../utils/localeFormat";
import { useActiveLanguage } from "../../../i18n/useActiveLanguage";

export function PackageDetailPage() {
  const { packageId = "" } = useParams<{ packageId: string }>();
  const { t } = useTranslation(["purchasing", "navigation"]);
  const language = useActiveLanguage();
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const { data: packageData, isLoading, isError } = useGetPackageQuery(packageId, { skip: !packageId });
  const { data: events, isLoading: isLoadingEvents } = useGetPackageEventsQuery(packageId, { skip: !packageId });

  if (isLoading) {
    return (
      <Stack spacing={2}>
        <Skeleton variant="rounded" height={72} />
        <Skeleton variant="rounded" height={120} />
        <Skeleton variant="rounded" height={400} />
      </Stack>
    );
  }

  if (isError || !packageData) {
    return <Alert severity="error">{t("detail.notFound")}</Alert>;
  }

  return (
    <Stack spacing={2}>
      <Breadcrumbs>
        <Link component={RouterLink} to="/purchasing/packages" underline="hover" color="inherit">
          {t("navigation:breadcrumbs.purchasingPackages")}
        </Link>
        <Typography color="text.primary">
          <Ltr>{packageData.packageNumber}</Ltr>
        </Typography>
      </Breadcrumbs>

      <Paper variant="outlined" sx={{ p: 2, borderRadius: "16px" }}>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} spacing={2}>
          <Stack spacing={0.5}>
            <Typography variant="h2">
              <Ltr>{packageData.packageNumber}</Ltr>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {packageData.supplierName || t("packages.list.noSupplier")}
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <PackageStatusChip status={packageData.status} size="medium" />
            <Button variant="outlined" onClick={() => setStatusDialogOpen(true)}>
              {t("detail.changeStatus")}
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: "16px" }}>
            <Typography variant="h3" sx={{ mb: 2 }}>
              {t("detail.sections.items")}
            </Typography>
            {packageData.items.length === 0 ? (
              <EmptyState message={t("detail.itemsEmpty")} />
            ) : (
              <Stack spacing={1.5}>
                {packageData.items.map((item) => (
                  <ItemMatchCard key={item.id} packageId={packageData.id} packageNumber={packageData.packageNumber} item={item} />
                ))}
              </Stack>
            )}
          </Paper>

          <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, mt: 2, borderRadius: "16px" }}>
            <Typography variant="h3" sx={{ mb: 2 }}>
              {t("detail.sections.timeline")}
            </Typography>
            {isLoadingEvents ? (
              <Skeleton variant="rounded" height={120} />
            ) : !events || events.length === 0 ? (
              <EmptyState message={t("detail.timelineEmpty")} />
            ) : (
              <Stack spacing={1.25}>
                {events.map((event) => (
                  <Stack key={event.id} direction="row" spacing={1.5} alignItems="flex-start">
                    <Typography variant="caption" color="text.secondary" sx={{ minWidth: 130 }}>
                      {formatDateTime(event.createdAt, language)}
                    </Typography>
                    <Stack spacing={0.25}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {t(`events.${event.type}`, { defaultValue: event.type })}
                      </Typography>
                      <PackageEventDetail event={event} />
                      {event.body && (
                        <Typography variant="body2" color="text.secondary">
                          {event.body}
                        </Typography>
                      )}
                      {event.actor && (
                        <Typography variant="caption" color="text.secondary">
                          {event.actor.name}
                        </Typography>
                      )}
                    </Stack>
                  </Stack>
                ))}
              </Stack>
            )}
          </Paper>

          <PackageAttachmentsPanel packageId={packageData.id} />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: "16px" }}>
            <Typography variant="h3" sx={{ mb: 1.5 }}>
              {t("detail.sections.summary")}
            </Typography>
            <Stack spacing={1}>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  {t("detail.summary.itemCount")}
                </Typography>
                <Typography variant="body2">{packageData.items.length}</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  {t("detail.summary.createdBy")}
                </Typography>
                <Typography variant="body2">{packageData.createdBy?.name ?? "—"}</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  {t("detail.summary.createdAt")}
                </Typography>
                <Typography variant="body2">{formatDateTime(packageData.createdAt, language)}</Typography>
              </Stack>
              {packageData.receivedAt && (
                <>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">
                      {t("detail.summary.receivedBy")}
                    </Typography>
                    <Typography variant="body2">{packageData.receivedBy?.name ?? "—"}</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">
                      {t("detail.summary.receivedAt")}
                    </Typography>
                    <Typography variant="body2">{formatDateTime(packageData.receivedAt, language)}</Typography>
                  </Stack>
                </>
              )}
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      <PackageStatusDialog open={statusDialogOpen} onClose={() => setStatusDialogOpen(false)} packageData={packageData} />
    </Stack>
  );
}
