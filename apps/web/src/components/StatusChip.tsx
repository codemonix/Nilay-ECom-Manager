import Chip from "@mui/material/Chip";
import { useTheme } from "@mui/material/styles";
import { useTranslation } from "react-i18next";
import type { CaseStatus } from "@complaint-system/shared";

const LIGHT_PALETTE: Record<CaseStatus, { bg: string; color: string; border: string }> = {
  open: { bg: "rgba(14, 165, 233, 0.14)", color: "#0284C7", border: "rgba(14, 165, 233, 0.28)" },
  in_progress: { bg: "rgba(79, 70, 229, 0.12)", color: "#4F46E5", border: "rgba(79, 70, 229, 0.28)" },
  waiting_for_customer: { bg: "rgba(245, 158, 11, 0.14)", color: "#B45309", border: "rgba(245, 158, 11, 0.3)" },
  waiting_for_internal_action: { bg: "rgba(217, 119, 6, 0.14)", color: "#92400E", border: "rgba(217, 119, 6, 0.3)" },
  resolved: { bg: "rgba(16, 185, 129, 0.14)", color: "#047857", border: "rgba(16, 185, 129, 0.28)" },
  closed: { bg: "rgba(148, 163, 184, 0.12)", color: "#475569", border: "rgba(148, 163, 184, 0.3)" },
};

// Dark-mode variant swaps in lighter pastel text over a saturated-but-translucent
// fill; the light-mode hex values read as low-contrast, muddy text on dark paper.
const DARK_PALETTE: Record<CaseStatus, { bg: string; color: string; border: string }> = {
  open: { bg: "rgba(56, 189, 248, 0.18)", color: "#7DD3FC", border: "rgba(56, 189, 248, 0.35)" },
  in_progress: { bg: "rgba(139, 92, 246, 0.2)", color: "#C4B5FD", border: "rgba(139, 92, 246, 0.38)" },
  waiting_for_customer: { bg: "rgba(251, 191, 36, 0.18)", color: "#FCD34D", border: "rgba(251, 191, 36, 0.35)" },
  waiting_for_internal_action: { bg: "rgba(251, 146, 60, 0.2)", color: "#FDBA74", border: "rgba(251, 146, 60, 0.38)" },
  resolved: { bg: "rgba(52, 211, 153, 0.18)", color: "#6EE7B7", border: "rgba(52, 211, 153, 0.35)" },
  closed: { bg: "rgba(148, 163, 184, 0.16)", color: "#CBD5E1", border: "rgba(148, 163, 184, 0.32)" },
};

export function StatusChip({ status, size = "small" }: { status: CaseStatus; size?: "small" | "medium" }) {
  const { t } = useTranslation("complaints");
  const theme = useTheme();
  const chip = (theme.palette.mode === "dark" ? DARK_PALETTE : LIGHT_PALETTE)[status];

  return (
    <Chip
      size={size}
      label={t(`status.${status}`)}
      variant={status === "closed" ? "outlined" : "filled"}
      sx={{
        fontWeight: 700,
        backgroundColor: chip.bg,
        color: chip.color,
        borderColor: chip.border,
        borderWidth: status === "closed" ? 1 : 0,
      }}
    />
  );
}
