import createCache, { type EmotionCache } from "@emotion/cache";
import { prefixer } from "stylis";
import rtlPlugin from "stylis-plugin-rtl";

let ltrCache: EmotionCache | undefined;
let rtlCache: EmotionCache | undefined;

/** Emotion caches are direction-specific (the RTL one runs stylis-plugin-rtl to flip physical CSS properties). Cached per direction so switching languages doesn't leak stale styles. */
export function getEmotionCache(direction: "ltr" | "rtl"): EmotionCache {
  if (direction === "rtl") {
    rtlCache ??= createCache({ key: "mui-rtl", stylisPlugins: [prefixer, rtlPlugin] });
    return rtlCache;
  }
  ltrCache ??= createCache({ key: "mui-ltr" });
  return ltrCache;
}
