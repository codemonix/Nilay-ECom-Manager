import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import enCommon from "./locales/en/common.json";
import enNavigation from "./locales/en/navigation.json";
import enComplaints from "./locales/en/complaints.json";
import enValidation from "./locales/en/validation.json";
import enSettings from "./locales/en/settings.json";
import enAuth from "./locales/en/auth.json";
import enUsers from "./locales/en/users.json";
import enLogs from "./locales/en/logs.json";
import enPurchasing from "./locales/en/purchasing.json";
import enReceiving from "./locales/en/receiving.json";
import enDevTools from "./locales/en/devTools.json";
import enReporting from "./locales/en/reporting.json";
import enOrderPrecheck from "./locales/en/orderPrecheck.json";
import enPacking from "./locales/en/packing.json";
import faCommon from "./locales/fa/common.json";
import faNavigation from "./locales/fa/navigation.json";
import faComplaints from "./locales/fa/complaints.json";
import faValidation from "./locales/fa/validation.json";
import faSettings from "./locales/fa/settings.json";
import faAuth from "./locales/fa/auth.json";
import faUsers from "./locales/fa/users.json";
import faLogs from "./locales/fa/logs.json";
import faPurchasing from "./locales/fa/purchasing.json";
import faReceiving from "./locales/fa/receiving.json";
import faDevTools from "./locales/fa/devTools.json";
import faReporting from "./locales/fa/reporting.json";
import faOrderPrecheck from "./locales/fa/orderPrecheck.json";
import faPacking from "./locales/fa/packing.json";

export const SUPPORTED_LANGUAGES = ["en", "fa"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export const RTL_LANGUAGES: SupportedLanguage[] = ["fa"];
export const DEFAULT_LANGUAGE: SupportedLanguage = "en";
export const LANGUAGE_STORAGE_KEY = "complaint-system.language";

export function isRtl(language: string): boolean {
  return RTL_LANGUAGES.includes(language as SupportedLanguage);
}

/**
 * i18next's `language` can still surface a regional variant (e.g. "en-GB")
 * from browser detection in some environments even with `load:
 * "languageOnly"` configured below, and an exact-match lookup against that
 * (translation keys, RTL_LANGUAGES.includes, etc.) silently fails. Every
 * read of the active language should go through this normalizer rather
 * than casting i18n.language directly.
 */
export function normalizeLanguage(language: string | undefined): SupportedLanguage {
  const base = (language ?? DEFAULT_LANGUAGE).split("-")[0] ?? DEFAULT_LANGUAGE;
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(base)
    ? (base as SupportedLanguage)
    : DEFAULT_LANGUAGE;
}

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: enCommon,
        navigation: enNavigation,
        complaints: enComplaints,
        validation: enValidation,
        settings: enSettings,
        auth: enAuth,
        users: enUsers,
        logs: enLogs,
        purchasing: enPurchasing,
        receiving: enReceiving,
        devTools: enDevTools,
        reporting: enReporting,
        orderPrecheck: enOrderPrecheck,
        packing: enPacking,
      },
      fa: {
        common: faCommon,
        navigation: faNavigation,
        complaints: faComplaints,
        validation: faValidation,
        settings: faSettings,
        auth: faAuth,
        users: faUsers,
        logs: faLogs,
        purchasing: faPurchasing,
        receiving: faReceiving,
        devTools: faDevTools,
        reporting: faReporting,
        orderPrecheck: faOrderPrecheck,
        packing: faPacking,
      },
    },
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGES as unknown as string[],
    load: "languageOnly",
    ns: [
      "common",
      "navigation",
      "complaints",
      "validation",
      "settings",
      "auth",
      "users",
      "logs",
      "purchasing",
      "receiving",
      "devTools",
      "reporting",
      "orderPrecheck",
      "packing",
    ],
    defaultNS: "common",
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ["localStorage"],
    },
  });

export default i18n;
