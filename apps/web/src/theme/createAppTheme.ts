import { alpha, createTheme, type Theme } from "@mui/material/styles";
import type { SupportedLanguage } from "../i18n/i18n";
import { isRtl } from "../i18n/i18n";
import type { ResolvedColorMode } from "./colorModeStore";

const FONT_STACKS: Record<SupportedLanguage, string> = {
  en: '"Roboto", "Helvetica", "Arial", system-ui, sans-serif',
  fa: '"Vazirmatn", "Roboto", "Tahoma", system-ui, sans-serif',
};

const LIGHT_PALETTE = {
  mode: "light" as const,
  primary: { main: "#4F46E5" },
  secondary: { main: "#EC4899" },
  info: { main: "#0EA5E9" },
  success: { main: "#10B981" },
  warning: { main: "#F59E0B" },
  error: { main: "#EF4444" },
  background: { default: "#F5F7FF", paper: "#FFFFFF" },
  divider: "rgba(79, 70, 229, 0.12)",
};

const DARK_PALETTE = {
  mode: "dark" as const,
  primary: { main: "#8B5CF6" },
  secondary: { main: "#F472B6" },
  info: { main: "#38BDF8" },
  success: { main: "#34D399" },
  warning: { main: "#FBBF24" },
  error: { main: "#F87171" },
  background: { default: "#0F172A", paper: "#111827" },
  divider: "rgba(148, 163, 184, 0.18)",
};

/**
 * Builds a direction-, language- and color-mode-aware MUI theme. Called
 * whenever the active language or color mode changes; see App.tsx for how
 * this is combined with the RTL-aware emotion cache.
 */
export function createAppTheme(language: SupportedLanguage, mode: ResolvedColorMode = "light"): Theme {
  const direction = isRtl(language) ? "rtl" : "ltr";
  const palette = mode === "dark" ? DARK_PALETTE : LIGHT_PALETTE;
  const isDark = mode === "dark";

  // Odd/even row tints for zebra striping; subtle enough to read as
  // texture rather than a hard band, and tuned separately per mode since
  // a fixed alpha reads too strong against a dark paper background.
  const zebraStripe = isDark ? alpha("#FFFFFF", 0.035) : alpha("#000000", 0.025);
  const rowHover = isDark ? alpha("#FFFFFF", 0.07) : alpha("#000000", 0.045);

  // Tight negative tracking reads as crisp/modern on Latin display type, but
  // Persian is a joined script: pulling letters together distorts the joins
  // and hurts legibility, so Farsi headings keep normal tracking.
  const headingLetterSpacing = direction === "rtl" ? { h1: "normal", h2: "normal" } : { h1: "-0.04em", h2: "-0.03em" };

  return createTheme({
    direction,
    palette,
    typography: {
      fontFamily: FONT_STACKS[language],
      fontSize: 14,
      h1: {
        fontSize: "clamp(1.8rem, 3vw, 2.4rem)",
        fontWeight: 800,
        letterSpacing: headingLetterSpacing.h1,
        lineHeight: 1.2,
      },
      h2: { fontSize: "clamp(1.4rem, 2vw, 1.9rem)", fontWeight: 800, letterSpacing: headingLetterSpacing.h2 },
      h3: { fontSize: "1.15rem", fontWeight: 700 },
      subtitle1: { fontWeight: 700 },
      body1: { lineHeight: 1.6 },
      body2: { lineHeight: 1.6 },
      button: { textTransform: "none", fontWeight: 700 },
    },
    shape: { borderRadius: 12 },
    spacing: 8,
    components: {
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            minHeight: 42,
            paddingInline: 16,
            borderRadius: 10,
            fontWeight: 700,
            boxShadow: "none",
            transition: "all 180ms ease",
            "&:hover": { boxShadow: "none" },
          },
          containedPrimary: {
            background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)",
            color: "#fff",
          },
          sizeSmall: { minHeight: 38, paddingInline: 12 },
          sizeLarge: { minHeight: 50, fontSize: "1rem" },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: { padding: 9, borderRadius: 10 },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
            boxShadow: isDark ? "0 18px 40px rgba(15, 23, 42, 0.28)" : "0 14px 28px rgba(79, 70, 229, 0.08)",
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            border: `1px solid ${palette.divider}`,
            boxShadow: isDark ? "0 16px 32px rgba(15, 23, 42, 0.28)" : "0 12px 28px rgba(15, 23, 42, 0.06)",
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            "& .MuiOutlinedInput-root": {
              borderRadius: 10,
              backgroundColor: isDark ? alpha("#FFFFFF", 0.02) : alpha("#4F46E5", 0.02),
            },
          },
        },
      },
      MuiTableContainer: {
        styleOverrides: {
          root: { borderRadius: 12 },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          head: {
            fontWeight: 700,
            whiteSpace: "nowrap",
            backgroundColor: isDark ? alpha("#FFFFFF", 0.04) : alpha("#4F46E5", 0.04),
          },
          root: {
            borderBottomColor: palette.divider,
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            "&.MuiTableRow-hover:hover": {
              backgroundColor: `${rowHover} !important`,
            },
          },
        },
      },
      MuiTableBody: {
        styleOverrides: {
          root: {
            "& tr:nth-of-type(odd)": {
              backgroundColor: zebraStripe,
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { fontWeight: 700, borderRadius: 999 },
          sizeSmall: { height: 26 },
        },
      },
      MuiAppBar: {
        defaultProps: { color: "default", elevation: 0 },
        styleOverrides: {
          root: {
            borderBottom: `1px solid ${palette.divider}`,
            background: isDark
              ? "linear-gradient(135deg, rgba(15, 23, 42, 0.96), rgba(30, 41, 59, 0.94))"
              : "linear-gradient(135deg, rgba(255,255,255,0.98), rgba(244,247,255,0.98))",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            boxShadow: isDark ? "0 12px 28px rgba(15, 23, 42, 0.26)" : "0 10px 26px rgba(79, 70, 229, 0.08)",
          },
        },
      },
      MuiBottomNavigation: {
        styleOverrides: {
          root: {
            height: 64,
            backgroundColor: isDark ? "rgba(17, 24, 39, 0.96)" : "rgba(255,255,255,0.96)",
            borderTop: `1px solid ${palette.divider}`,
          },
        },
      },
      MuiBottomNavigationAction: {
        styleOverrides: {
          root: {
            minWidth: 64,
            paddingTop: 6,
            color: isDark ? alpha("#F8FAFC", 0.72) : alpha("#111827", 0.72),
            "&.Mui-selected": { paddingTop: 6, color: palette.primary.main },
          },
          label: {
            fontSize: "0.72rem",
            "&.Mui-selected": { fontSize: "0.75rem", fontWeight: 700 },
          },
        },
      },
      MuiFab: {
        styleOverrides: {
          root: {
            background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)",
            boxShadow: "0 18px 28px rgba(79, 70, 229, 0.28)",
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          container: ({ theme: t }) => ({
            [t.breakpoints.down("sm")]: { alignItems: "flex-end" },
          }),
          paper: ({ theme: t }) => ({
            [t.breakpoints.down("sm")]: {
              margin: 0,
              width: "100%",
              maxWidth: "100%",
              borderRadius: "16px 16px 0 0",
              maxHeight: "88vh",
            },
          }),
        },
      },
      MuiDialogTitle: {
        styleOverrides: {
          root: { fontSize: "1.2rem", fontWeight: 700, paddingBottom: 8 },
        },
      },
      MuiDialogContent: {
        styleOverrides: {
          root: ({ theme: t }) => ({
            [t.breakpoints.down("sm")]: { paddingLeft: 20, paddingRight: 20 },
          }),
        },
      },
      MuiDialogActions: {
        styleOverrides: {
          root: ({ theme: t }) => ({
            padding: 16,
            [t.breakpoints.down("sm")]: {
              flexDirection: "column",
              gap: 8,
              paddingBottom: "max(16px, env(safe-area-inset-bottom))",
              "& > :not(style) ~ :not(style)": { marginLeft: 0 },
              "& .MuiButton-root": { width: "100%", minHeight: 46 },
            },
          }),
        },
      },
    },
  });
}
