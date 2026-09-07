import { useTranslation } from "react-i18next";
import { normalizeLanguage, type SupportedLanguage } from "./i18n";

/** The current UI language, normalized to "en" | "fa" regardless of what i18next's raw language string reports. */
export function useActiveLanguage(): SupportedLanguage {
  const { i18n } = useTranslation();
  return normalizeLanguage(i18n.language);
}
