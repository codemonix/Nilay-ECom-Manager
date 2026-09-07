import Chip from "@mui/material/Chip";
import PriorityHighIcon from "@mui/icons-material/PriorityHigh";
import { useTranslation } from "react-i18next";
import type { CasePriority } from "@complaint-system/shared";

const PRIORITY_COLOR: Record<CasePriority, "default" | "info" | "warning" | "error"> = {
  low: "default",
  normal: "info",
  high: "warning",
  urgent: "error",
};

/**
 * Urgent/high priority never relies on color alone: they always carry an
 * icon too, so the distinction still reads for color-blind users and on
 * low-fidelity displays.
 */
export function PriorityChip({ priority, size = "small" }: { priority: CasePriority; size?: "small" | "medium" }) {
  const { t } = useTranslation("complaints");
  const showIcon = priority === "high" || priority === "urgent";
  return (
    <Chip
      size={size}
      color={PRIORITY_COLOR[priority]}
      label={t(`priority.${priority}`)}
      icon={showIcon ? <PriorityHighIcon /> : undefined}
      variant={priority === "urgent" ? "filled" : priority === "low" ? "outlined" : "filled"}
      sx={priority === "urgent" ? { fontWeight: 700 } : undefined}
    />
  );
}
