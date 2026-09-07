import { createTheme, type Theme } from "@mui/material/styles";
import type { SupportedLanguage } from "../i18n/i18n";
import { isRtl } from "../i18n/i18n";

const FONT_STACKS: Record<SupportedLanguage, string> = {
  en: '"Roboto", "Helvetica", "Arial", system-ui, sans-serif',
  fa: '"Vazirmatn", "Roboto", "Tahoma", system-ui, sans-serif',
};

/**
 * Builds a direction- and language-aware MUI theme. Called every time the
 * active language changes so `direction` and the font stack stay in sync;
 * see App.tsx for how this is combined with the RTL-aware emotion cache.
 */
export function createAppTheme(language: SupportedLanguage): Theme {
  const direction = isRtl(language) ? "rtl" : "ltr";

  return createTheme({
    direction,
    palette: {
      mode: "light",
      primary: { main: "#1F3A5F" },
      secondary: { main: "#8A6D3B" },
      background: { default: "#F4F5F7", paper: "#FFFFFF" },
      warning: { main: "#B5651D" },
      error: { main: "#B3261E" },
    },
    typography: {
      fontFamily: FONT_STACKS[language],
      fontSize: 13.5,
      h1: { fontSize: "2rem", fontWeight: 600 },
      h2: { fontSize: "1.5rem", fontWeight: 600 },
      h3: { fontSize: "1.25rem", fontWeight: 600 },
      subtitle1: { fontWeight: 600 },
      button: { textTransform: "none", fontWeight: 600 },
    },
    shape: { borderRadius: 6 },
    spacing: 8,
    components: {
      MuiButton: {
        defaultProps: { disableElevation: true },
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: "none" },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          head: { fontWeight: 700, whiteSpace: "nowrap" },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { fontWeight: 600 },
        },
      },
      MuiAppBar: {
        defaultProps: { color: "default", elevation: 0 },
        styleOverrides: {
          root: { borderBottom: "1px solid rgba(0,0,0,0.08)" },
        },
      },
    },
  });
}
