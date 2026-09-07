import { createContext } from "react";

export type ThemeModePreference = "light" | "dark" | "system";
export type ResolvedColorMode = "light" | "dark";

export const STORAGE_KEY = "bizops.themeMode";

export interface ColorModeContextValue {
  preference: ThemeModePreference;
  resolvedMode: ResolvedColorMode;
  setPreference: (preference: ThemeModePreference) => void;
}

export const ColorModeContext = createContext<ColorModeContextValue | undefined>(undefined);

export function getSystemPreference(): ResolvedColorMode {
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function readStoredPreference(): ThemeModePreference {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
}
