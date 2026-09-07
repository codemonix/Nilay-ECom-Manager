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
  primary: { main: "#1F3A5F" },
  secondary: { main: "#8A6D3B" },
  background: { default: "#F4F5F7", paper: "#FFFFFF" },
  warning: { main: "#B5651D" },
  error: { main: "#B3261E" },
  divider: "rgba(0,0,0,0.08)",
};

const DARK_PALETTE = {
  mode: "dark" as const,
  primary: { main: "#7DA2D1" },
  secondary: { main: "#D2B48C" },
  background: { default: "#10151C", paper: "#1A212C" },
  warning: { main: "#E0954F" },
  error: { main: "#E5666B" },
  divider: "rgba(255,255,255,0.09)",
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

  return createTheme({
    direction,
    palette,
    typography: {
      fontFamily: FONT_STACKS[language],
      fontSize: 14,
      h1: { fontSize: "1.75rem", fontWeight: 700 },
      h2: { fontSize: "1.4rem", fontWeight: 700 },
      h3: { fontSize: "1.15rem", fontWeight: 700 },
      subtitle1: { fontWeight: 600 },
      button: { textTransform: "none", fontWeight: 600 },
    },
    shape: { borderRadius: 12 },
    spacing: 8,
    components: {
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { minHeight: 42, paddingInline: 16 },
          sizeSmall: { minHeight: 38, paddingInline: 12 },
          sizeLarge: { minHeight: 50, fontSize: "1rem" },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: { padding: 9 },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: "none" },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: { borderRadius: 14 },
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
            backgroundColor: isDark ? alpha("#FFFFFF", 0.04) : alpha("#000000", 0.02),
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
          root: { fontWeight: 600 },
          sizeSmall: { height: 26 },
        },
      },
      MuiAppBar: {
        defaultProps: { color: "default", elevation: 0 },
        styleOverrides: {
          root: {
            borderBottom: `1px solid ${palette.divider}`,
            backgroundColor: palette.background.paper,
          },
        },
      },
      MuiBottomNavigation: {
        styleOverrides: {
          root: { height: 64 },
        },
      },
      MuiBottomNavigationAction: {
        styleOverrides: {
          root: {
            minWidth: 64,
            paddingTop: 6,
            "&.Mui-selected": { paddingTop: 6 },
          },
          label: {
            fontSize: "0.72rem",
            "&.Mui-selected": { fontSize: "0.75rem" },
          },
        },
      },
      // Dialogs slide up from the bottom on small screens, like a native
      // app sheet, instead of appearing as a small centered box that's
      // fiddly to interact with on a touchscreen.
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
              borderRadius: "20px 20px 0 0",
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
