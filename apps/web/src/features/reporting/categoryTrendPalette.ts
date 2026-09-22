import type { CategoryTrendSeriesDTO } from "@complaint-system/shared";

/**
 * Categorical series colors in fixed slot order (never cycled), all eight validated
 * with the dataviz palette validator against each mode's surface: light
 * (#fcfcfb) passes every gate except a contrast WARN on aqua/yellow/magenta,
 * covered by the legend, hover tooltip and table view; dark (#1a1a19) passes
 * all. The folded "other" series is a neutral gray, never a hue, so it can't
 * be mistaken for a real category.
 */
const LIGHT = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];
const DARK = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"];
const OTHER_LIGHT = "#a3a29c";
const OTHER_DARK = "#75746e";

/** The color of a series: its fixed slot (`colorSlot`, assigned server-side from the store's category order, so it never changes between windows or reports); the folded "other" series is always neutral gray. */
export function colorForSeries(mode: "light" | "dark", series: CategoryTrendSeriesDTO): string {
  if (series.colorSlot === null) return mode === "dark" ? OTHER_DARK : OTHER_LIGHT;
  return (mode === "dark" ? DARK : LIGHT)[series.colorSlot] ?? (mode === "dark" ? OTHER_DARK : OTHER_LIGHT);
}

export function seriesLabel(series: CategoryTrendSeriesDTO, otherLabel: string): string {
  return series.categoryId === "other" ? otherLabel : series.title;
}
