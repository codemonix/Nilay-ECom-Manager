import Chip from "@mui/material/Chip";
import { useTranslation } from "react-i18next";
import type { CaseStatus } from "@complaint-system/shared";

const STATUS_COLOR: Record<CaseStatus, "default" | "info" | "primary" | "warning" | "success"> = {
  open: "info",
  in_progress: "primary",
  waiting_for_customer: "warning",
  waiting_for_internal_action: "warning",
  resolved: "success",
  closed: "default",
};

export function StatusChip({ status, size = "small" }: { status: CaseStatus; size?: "small" | "medium" }) {
  const { t } = useTranslation("complaints");
  return (
    <Chip
      size={size}
      color={STATUS_COLOR[status]}
      label={t(`status.${status}`)}
      variant={status === "closed" ? "outlined" : "filled"}
    />
  );
}
