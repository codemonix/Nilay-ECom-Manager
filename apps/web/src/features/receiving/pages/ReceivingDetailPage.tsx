import { useState } from "react";
import { useParams, Link as RouterLink } from "react-router-dom";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import Skeleton from "@mui/material/Skeleton";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import Paper from "@mui/material/Paper";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import { useTranslation } from "react-i18next";
import { PackageStatus } from "@complaint-system/shared";
import {
  useConfirmReceivedMutation,
  useGetReceivingPackageEventsQuery,
  useGetReceivingPackageQuery,
  useListReceivingAttachmentsQuery,
} from "../api/receivingApi";
import { ReceivingItemRow } from "../components/ReceivingItemRow";
import { resolvePhotoUrl } from "../../../utils/attachments";
import { PackageStatusChip } from "../../../components/PackageStatusChip";
import { PackageEventDetail } from "../../../components/PackageEventDetail";
import { EmptyState } from "../../../components/EmptyState";
import { Ltr } from "../../../components/Ltr";
import { formatDateTime } from "../../../utils/localeFormat";
import { useActiveLanguage } from "../../../i18n/useActiveLanguage";

export function ReceivingDetailPage() {
  const { packageId = "" } = useParams<{ packageId: string }>();
  const { t } = useTranslation(["receiving", "navigation"]);
  const language = useActiveLanguage();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { data: packageData, isLoading, isError } = useGetReceivingPackageQuery(packageId, { skip: !packageId });
  const { data: events, isLoading: isLoadingEvents } = useGetReceivingPackageEventsQuery(packageId, { skip: !packageId });
  const { data: attachments = [] } = useListReceivingAttachmentsQuery(packageId, { skip: !packageId });
  const [confirmReceived, { isLoading: isConfirming }] = useConfirmReceivedMutation();

  if (isLoading) {
    return (
      <Stack spacing={2}>
        <Skeleton variant="rounded" height={72} />
        <Skeleton variant="rounded" height={400} />
      </Stack>
    );
  }

  if (isError || !packageData) {
    return <Alert severity="error">{t("detail.notFound")}</Alert>;
  }

  const isAwaitingReceipt = packageData.status === PackageStatus.IN_PROGRESS;

  const handleConfirm = async () => {
    await confirmReceived({ packageId, markAllComplete: true }).unwrap();
    setConfirmOpen(false);
  };

  return (
    <Stack spacing={2}>
      <Breadcrumbs>
        <Link component={RouterLink} to="/receiving" underline="hover" color="inherit">
          {t("navigation:breadcrumbs.receiving")}
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
              {packageData.supplierName || t("list.noSupplier")}
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <PackageStatusChip status={packageData.status} size="medium" />
            {isAwaitingReceipt && (
              <Button
                variant="contained"
                onClick={() => setConfirmOpen(true)}
                disabled={isConfirming}
                startIcon={isConfirming ? <CircularProgress size={16} color="inherit" /> : undefined}
              >
                {t("detail.confirmReceived")}
              </Button>
            )}
          </Stack>
        </Stack>
      </Paper>

      {!isAwaitingReceipt && packageData.status === PackageStatus.COMPLETED && (
        <Alert severity="success">
          {t("detail.alreadyReceived", {
            name: packageData.receivedBy?.name ?? "—",
            date: packageData.receivedAt ? formatDateTime(packageData.receivedAt, language) : "",
          })}
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: "16px" }}>
        <Typography variant="h3" sx={{ mb: 1 }}>
          {t("detail.sections.items")}
        </Typography>
        {packageData.items.length === 0 ? (
          <EmptyState message={t("detail.itemsEmpty")} />
        ) : (
          <Stack>
            {packageData.items.map((item) => (
              <ReceivingItemRow
                key={item.id}
                packageId={packageId}
                item={item}
                photoUrl={resolvePhotoUrl(item.photoAttachmentId, attachments)}
                disabled={!isAwaitingReceipt}
              />
            ))}
          </Stack>
        )}
      </Paper>

      <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: "16px" }}>
        <Typography variant="h3" sx={{ mb: 1.5 }}>
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
                    {t(`events.${event.type}`, { ns: "purchasing", defaultValue: event.type })}
                  </Typography>
                  <PackageEventDetail event={event} />
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

      {confirmOpen && (
        <Paper
          variant="outlined"
          sx={{ p: 2, borderRadius: "16px", borderColor: "warning.main", position: "sticky", bottom: 16 }}
        >
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ xs: "stretch", sm: "center" }} justifyContent="space-between">
            <Typography variant="body2">{t("detail.confirmPrompt")}</Typography>
            <Stack direction="row" spacing={1}>
              <Button onClick={() => setConfirmOpen(false)}>{t("actions.cancel", { ns: "common" })}</Button>
              <Button variant="contained" color="warning" onClick={handleConfirm} disabled={isConfirming}>
                {t("detail.confirmReceived")}
              </Button>
            </Stack>
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}
