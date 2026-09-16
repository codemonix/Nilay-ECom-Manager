import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import type { PackageEventDTO } from "@complaint-system/shared";

interface PackageEventDetailProps {
  event: PackageEventDTO;
}

/**
 * Renders the "from -> to" detail line for a status_changed event (e.g.
 * "Draft → In Progress"), using the same translated status labels shown
 * everywhere else (PackageStatusChip, status dialogs) so the wording never
 * drifts. Renders nothing for every other event type or if the event
 * predates this field being recorded.
 */
export function PackageEventDetail({ event }: PackageEventDetailProps) {
  const { t } = useTranslation("purchasing");
  if (event.type !== "status_changed" || !event.data) return null;
  const { from, to } = event.data;
  if (typeof from !== "string" || typeof to !== "string") return null;
  return (
    <Typography variant="body2" color="text.secondary">
      {t("events.statusChangeDetail", { from: t(`status.${from}`), to: t(`status.${to}`) })}
    </Typography>
  );
}
