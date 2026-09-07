import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ColorModeContext,
  getSystemPreference,
  readStoredPreference,
  STORAGE_KEY,
  type ResolvedColorMode,
  type ThemeModePreference,
} from "./colorModeStore";

export function ColorModeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemeModePreference>(readStoredPreference);
  const [systemMode, setSystemMode] = useState<ResolvedColorMode>(getSystemPreference);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (event: MediaQueryListEvent) => setSystemMode(event.matches ? "dark" : "light");
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const setPreference = (next: ThemeModePreference) => {
    setPreferenceState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  };

  const resolvedMode = preference === "system" ? systemMode : preference;

  const value = useMemo(() => ({ preference, resolvedMode, setPreference }), [preference, resolvedMode]);

  return <ColorModeContext.Provider value={value}>{children}</ColorModeContext.Provider>;
}
