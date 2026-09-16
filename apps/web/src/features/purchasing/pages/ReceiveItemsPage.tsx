import { Link as RouterLink } from "react-router-dom";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import Skeleton from "@mui/material/Skeleton";
import Paper from "@mui/material/Paper";
import Link from "@mui/material/Link";
import { useTranslation } from "react-i18next";
import { useActiveDraftPackage } from "../hooks/useActiveDraftPackage";
import { useListPackageAttachmentsQuery, useReceiveItemMutation } from "../api/packagesApi";
import { ItemCaptureStep, type ItemCaptureValues } from "../components/ItemCaptureStep";
import { PackageItemCard } from "../components/PackageItemCard";
import { EmptyState } from "../../../components/EmptyState";
import { resolvePhotoUrl } from "../../../utils/attachments";

export function ReceiveItemsPage() {
  const { t } = useTranslation("purchasing");
  const { draftPackage, isLoading, isError } = useActiveDraftPackage();
  const [receiveItem, { isLoading: isSubmitting }] = useReceiveItemMutation();
  const { data: attachments = [] } = useListPackageAttachmentsQuery(draftPackage?.id ?? "", { skip: !draftPackage });

  const handleSubmit = async (values: ItemCaptureValues) => {
    if (!draftPackage) return;
    await receiveItem({ packageId: draftPackage.id, ...values }).unwrap();
  };

  if (isLoading) {
    return (
      <Stack spacing={2}>
        <Skeleton variant="rounded" height={72} />
        <Skeleton variant="rounded" height={320} />
      </Stack>
    );
  }

  if (isError || !draftPackage) {
    return <Alert severity="error">{t("receiveItems.loadError")}</Alert>;
  }

  return (
    <Stack spacing={2} sx={{ maxWidth: 560, mx: "auto" }}>
      <Stack spacing={0.5}>
        <Typography variant="h1">{t("receiveItems.title")}</Typography>
        <Typography variant="body2" color="text.secondary">
          {t("receiveItems.currentDraft", { packageNumber: draftPackage.packageNumber })}{" "}
          <Link component={RouterLink} to={`/purchasing/packages/${draftPackage.id}`}>
            {t("receiveItems.viewPackage")}
          </Link>
        </Typography>
      </Stack>

      <ItemCaptureStep onSubmit={handleSubmit} isSubmitting={isSubmitting} />

      <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: "16px" }}>
        <Typography variant="h3" sx={{ mb: 1 }}>
          {t("receiveItems.itemsSoFar", { count: draftPackage.items.length })}
        </Typography>
        {draftPackage.items.length === 0 ? (
          <EmptyState message={t("receiveItems.noItemsYet")} />
        ) : (
          <Stack spacing={1.5}>
            {[...draftPackage.items].reverse().map((item) => (
              <PackageItemCard key={item.id} item={item} photoUrl={resolvePhotoUrl(item.photoAttachmentId, attachments)} />
            ))}
          </Stack>
        )}
      </Paper>
    </Stack>
  );
}
