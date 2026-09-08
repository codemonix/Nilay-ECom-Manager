import Chip from "@mui/material/Chip";
import PriorityHighIcon from "@mui/icons-material/PriorityHigh";
import { useTheme } from "@mui/material/styles";
import { useTranslation } from "react-i18next";
import type { CasePriority } from "@complaint-system/shared";

const LIGHT_PALETTE: Record<CasePriority, { bg: string; color: string; border: string }> = {
  low: { bg: "rgba(148, 163, 184, 0.12)", color: "#475569", border: "rgba(148, 163, 184, 0.28)" },
  normal: { bg: "rgba(14, 165, 233, 0.12)", color: "#0369A1", border: "rgba(14, 165, 233, 0.28)" },
  high: { bg: "rgba(245, 158, 11, 0.14)", color: "#B45309", border: "rgba(245, 158, 11, 0.28)" },
  urgent: { bg: "rgba(239, 68, 68, 0.14)", color: "#B91C1C", border: "rgba(239, 68, 68, 0.28)" },
};

// Dark-mode variant swaps in lighter pastel text over a saturated-but-translucent
// fill; the light-mode hex values read as low-contrast, muddy text on dark paper.
const DARK_PALETTE: Record<CasePriority, { bg: string; color: string; border: string }> = {
  low: { bg: "rgba(148, 163, 184, 0.16)", color: "#CBD5E1", border: "rgba(148, 163, 184, 0.32)" },
  normal: { bg: "rgba(56, 189, 248, 0.18)", color: "#7DD3FC", border: "rgba(56, 189, 248, 0.35)" },
  high: { bg: "rgba(251, 191, 36, 0.18)", color: "#FCD34D", border: "rgba(251, 191, 36, 0.35)" },
  urgent: { bg: "rgba(248, 113, 113, 0.2)", color: "#FCA5A5", border: "rgba(248, 113, 113, 0.38)" },
};

/**
 * Urgent/high priority never relies on color alone: they always carry an
 * icon too, so the distinction still reads for color-blind users and on
 * low-fidelity displays.
 */
export function PriorityChip({ priority, size = "small" }: { priority: CasePriority; size?: "small" | "medium" }) {
  const { t } = useTranslation("complaints");
  const theme = useTheme();
  const showIcon = priority === "high" || priority === "urgent";
  const chip = (theme.palette.mode === "dark" ? DARK_PALETTE : LIGHT_PALETTE)[priority];

  return (
    <Chip
      size={size}
      label={t(`priority.${priority}`)}
      icon={showIcon ? <PriorityHighIcon /> : undefined}
      variant={priority === "urgent" ? "filled" : priority === "low" ? "outlined" : "filled"}
      sx={{
        fontWeight: 700,
        backgroundColor: chip.bg,
        color: chip.color,
        borderColor: chip.border,
        borderWidth: priority === "low" ? 1 : 0,
      }}
    />
  );
}
