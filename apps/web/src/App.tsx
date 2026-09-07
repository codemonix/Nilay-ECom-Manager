import { useEffect, useMemo } from "react";
import { CacheProvider } from "@emotion/react";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { Provider } from "react-redux";
import { store } from "./app/store";
import { createAppTheme } from "./theme/createAppTheme";
import { getEmotionCache } from "./theme/rtlCache";
import { isRtl } from "./i18n/i18n";
import { useActiveLanguage } from "./i18n/useActiveLanguage";
import { AppRoutes } from "./routes/AppRoutes";

function ThemedApp() {
  const language = useActiveLanguage();
  const direction = isRtl(language) ? "rtl" : "ltr";

  const theme = useMemo(() => createAppTheme(language), [language]);
  const cache = useMemo(() => getEmotionCache(direction), [direction]);

  useEffect(() => {
    document.documentElement.dir = direction;
    document.documentElement.lang = language;
  }, [direction, language]);

  return (
    <CacheProvider value={cache}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AppRoutes />
      </ThemeProvider>
    </CacheProvider>
  );
}

export default function App() {
  return (
    <Provider store={store}>
      <ThemedApp />
    </Provider>
  );
}
