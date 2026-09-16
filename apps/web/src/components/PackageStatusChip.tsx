import Chip from "@mui/material/Chip";
import { useTheme } from "@mui/material/styles";
import { useTranslation } from "react-i18next";
import type { PackageStatus } from "@complaint-system/shared";

const LIGHT_PALETTE: Record<PackageStatus, { bg: string; color: string; border: string }> = {
  draft: { bg: "rgba(148, 163, 184, 0.12)", color: "#475569", border: "rgba(148, 163, 184, 0.28)" },
  in_progress: { bg: "rgba(79, 70, 229, 0.12)", color: "#4F46E5", border: "rgba(79, 70, 229, 0.28)" },
  completed: { bg: "rgba(16, 185, 129, 0.14)", color: "#047857", border: "rgba(16, 185, 129, 0.28)" },
};

const DARK_PALETTE: Record<PackageStatus, { bg: string; color: string; border: string }> = {
  draft: { bg: "rgba(148, 163, 184, 0.16)", color: "#CBD5E1", border: "rgba(148, 163, 184, 0.32)" },
  in_progress: { bg: "rgba(139, 92, 246, 0.2)", color: "#C4B5FD", border: "rgba(139, 92, 246, 0.38)" },
  completed: { bg: "rgba(52, 211, 153, 0.18)", color: "#6EE7B7", border: "rgba(52, 211, 153, 0.35)" },
};

export function PackageStatusChip({ status, size = "small" }: { status: PackageStatus; size?: "small" | "medium" }) {
  const { t } = useTranslation("purchasing");
  const theme = useTheme();
  const chip = (theme.palette.mode === "dark" ? DARK_PALETTE : LIGHT_PALETTE)[status];

  return (
    <Chip
      size={size}
      label={t(`status.${status}`)}
      variant={status === "draft" ? "outlined" : "filled"}
      sx={{
        fontWeight: 700,
        backgroundColor: chip.bg,
        color: chip.color,
        borderColor: chip.border,
        borderWidth: status === "draft" ? 1 : 0,
      }}
    />
  );
}
