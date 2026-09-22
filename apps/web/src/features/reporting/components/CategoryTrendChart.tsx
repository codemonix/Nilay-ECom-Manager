import { useMemo, useRef, useState, type MouseEvent } from "react";
import { useTheme } from "@mui/material/styles";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { CategoryTrendResultDTO } from "../types";
import { formatNumber } from "../../../utils/localeFormat";
import { useActiveLanguage } from "../../../i18n/useActiveLanguage";
import { colorForSeries, seriesLabel } from "../categoryTrendPalette";
import type { SupportedLanguage } from "../../../i18n/i18n";

export type TrendMetric = "quantity" | "revenue";

const HEIGHT = 340;
const MARGIN = { top: 12, right: 12, bottom: 34, left: 56 };
const MIN_WIDTH = 560;
const MAX_BAR = 24;
const GAP = 2;
const RADIUS = 4;

/** Rounds `max` up to a "nice" axis ceiling (1, 2, 2.5, 5 x 10^n) and returns ticks from 0. */
function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0, 1];
  const rough = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step =
    ([1, 2, 2.5, 5, 10].find((m) => m * magnitude >= rough) ?? 10) * magnitude;
  const ticks: number[] = [];
  for (let v = 0; v <= max + step * 0.999; v += step)
    ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}

/** Path for a rect with the two top corners rounded (the stack's data-end) and a square baseline side. */
function topRoundedRect(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): string {
  const rr = Math.min(r, h, w / 2);
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
}

function formatAxisNumber(value: number, language: SupportedLanguage): string {
  const locale = language === "fa" ? "fa-IR" : "en-US";
  return new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatBucketDate(day: string, language: SupportedLanguage): string {
  return new Intl.DateTimeFormat(language === "fa" ? "fa-IR" : "en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${day}T00:00:00Z`));
}

interface CategoryTrendChartProps {
  result: CategoryTrendResultDTO;
  metric: TrendMetric;
  otherLabel: string;
}

/**
 * Stacked column chart: one column per time bucket, one stacked segment per
 * category. Hand-rolled SVG (no chart library in this app). Follows the
 * dataviz mark specs: columns capped at 24px with a 4px rounded top and a
 * square baseline, 2px surface gaps between segments, hairline solid
 * gridlines, categorical hues in fixed order (see categoryTrendPalette.ts),
 * text in text tokens rather than series colors, and a hover tooltip per
 * column that lists every category's value.
 */
export function CategoryTrendChart({
  result,
  metric,
  otherLabel,
}: CategoryTrendChartProps) {
  const theme = useTheme();
  const language = useActiveLanguage();
  const [hovered, setHovered] = useState<number | null>(null);
  // The tooltip is pinned to a top corner of the chart's visible area (never follows the pointer): top-left by
  // default, top-right while the pointer is over the left half so it never covers what is being hovered.
  const [tooltipSide, setTooltipSide] = useState<"left" | "right">("left");
  const frameRef = useRef<HTMLDivElement | null>(null);
  const colors = result.series.map((s) =>
    colorForSeries(theme.palette.mode, s),
  );
  const grid = theme.palette.divider;

  const bucketCount = result.buckets.length;
  const totals = useMemo(
    () =>
      result.buckets.map((_b, i) =>
        result.series.reduce((sum, s) => sum + (s[metric][i] ?? 0), 0),
      ),
    [result, metric],
  );
  const ticks = useMemo(() => niceTicks(Math.max(...totals, 0)), [totals]);
  const yMax = ticks[ticks.length - 1] ?? 1;

  const width = Math.max(MIN_WIDTH, 60 + bucketCount * 44);
  const plotW = width - MARGIN.left - MARGIN.right;
  const plotH = HEIGHT - MARGIN.top - MARGIN.bottom;
  const band = plotW / bucketCount;
  const barW = Math.min(MAX_BAR, band * 0.6);
  const yOf = (v: number) => MARGIN.top + plotH - (v / yMax) * plotH;
  const labelEvery = Math.ceil(bucketCount / 12);

  const showTooltip = (index: number, event: MouseEvent<SVGRectElement>) => {
    const frame = frameRef.current?.getBoundingClientRect();
    if (frame) {
      setTooltipSide(
        event.clientX < frame.left + frame.width / 2 ? "right" : "left",
      );
    }
    setHovered(index);
  };
  const hideTooltip = () => setHovered(null);

  const hoveredBucket = hovered !== null ? result.buckets[hovered] : null;

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap role="list">
        {result.series.map((s, i) => (
          <Stack
            key={s.categoryId}
            direction="row"
            spacing={0.75}
            alignItems="center"
            role="listitem"
          >
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: "3px",
                bgcolor: colors[i],
              }}
            />
            <Typography variant="caption" color="text.secondary">
              {seriesLabel(s, otherLabel)}
            </Typography>
          </Stack>
        ))}
      </Stack>

      <Box ref={frameRef} sx={{ position: "relative" }} dir="ltr">
        <Box sx={{ overflowX: "auto" }}>
          <Box sx={{ position: "relative", width, minWidth: "100%" }}>
            <svg
              viewBox={`0 0 ${width} ${HEIGHT}`}
              width="100%"
              height={HEIGHT}
              role="img"
              aria-label={result.series
                .map((s) => seriesLabel(s, otherLabel))
                .join(", ")}
              style={{ display: "block" }}
            >
              {ticks.map((tick) => (
                <g key={tick}>
                  <line
                    x1={MARGIN.left}
                    x2={width - MARGIN.right}
                    y1={yOf(tick)}
                    y2={yOf(tick)}
                    stroke={grid}
                    strokeWidth={1}
                  />
                  <text
                    x={MARGIN.left - 8}
                    y={yOf(tick)}
                    textAnchor="end"
                    dominantBaseline="middle"
                    fontSize={11}
                    fill={theme.palette.text.secondary}
                  >
                    {formatAxisNumber(tick, language)}
                  </text>
                </g>
              ))}

              {result.buckets.map((bucket, i) => {
                const cx = MARGIN.left + band * i + band / 2;
                const x = cx - barW / 2;
                // Stack bottom-up in series order; the last non-empty segment gets the rounded data-end.
                let acc = 0;
                const segments = result.series
                  .map((s, si) => ({
                    value: s[metric][i] ?? 0,
                    color: colors[si],
                  }))
                  .filter((seg) => seg.value > 0)
                  .map((seg) => {
                    const yTop = yOf(acc + seg.value);
                    const yBottom = yOf(acc);
                    acc += seg.value;
                    return { ...seg, yTop, height: yBottom - yTop };
                  });
                return (
                  <g
                    key={bucket.startDate}
                    opacity={hovered === null || hovered === i ? 1 : 0.55}
                  >
                    {segments.map((seg, si) => {
                      const isTop = si === segments.length - 1;
                      // 2px surface gap between segments: trim the segment's bottom edge (not the first, which sits on the baseline).
                      const trim = si === 0 ? 0 : Math.min(GAP, seg.height / 2);
                      const h = seg.height - trim;
                      return isTop ? (
                        <path
                          key={si}
                          d={topRoundedRect(x, seg.yTop, barW, h, RADIUS)}
                          fill={seg.color}
                        />
                      ) : (
                        <rect
                          key={si}
                          x={x}
                          y={seg.yTop}
                          width={barW}
                          height={h}
                          fill={seg.color}
                        />
                      );
                    })}
                    {i % labelEvery === 0 && (
                      <text
                        x={cx}
                        y={HEIGHT - MARGIN.bottom + 18}
                        textAnchor="middle"
                        fontSize={11}
                        fill={theme.palette.text.secondary}
                      >
                        {formatBucketDate(bucket.endDate, language)}
                      </text>
                    )}
                    {/* Full-height hit target -- much larger than the column itself. */}
                    <rect
                      x={MARGIN.left + band * i}
                      y={MARGIN.top}
                      width={band}
                      height={plotH}
                      fill="transparent"
                      onMouseEnter={(e) => showTooltip(i, e)}
                      onMouseMove={(e) => showTooltip(i, e)}
                      onMouseLeave={hideTooltip}
                      onClick={(e) =>
                        hovered === i ? hideTooltip() : showTooltip(i, e)
                      }
                    />
                  </g>
                );
              })}
              <line
                x1={MARGIN.left}
                x2={width - MARGIN.right}
                y1={yOf(0)}
                y2={yOf(0)}
                stroke={theme.palette.text.disabled}
                strokeWidth={1}
              />
            </svg>
          </Box>
        </Box>
        {hovered !== null && hoveredBucket && (
          <Box
            dir={language === "fa" ? "rtl" : "ltr"}
            // Inline (not sx) so the RTL style plugin cannot flip left/right: "left" always means the screen's left.
            style={tooltipSide === "left" ? { left: 8 } : { right: 8 }}
            sx={{
              position: "absolute",
              top: 8,
              maxWidth: "calc(100% - 16px)",
              bgcolor: "background.paper",
              border: 1,
              borderColor: "divider",
              borderRadius: "10px",
              boxShadow: 3,
              p: 1.25,
              minWidth: 180,
              pointerEvents: "none",
              zIndex: 1,
            }}
          >
            <Typography variant="caption" color="text.secondary">
              {formatBucketDate(hoveredBucket.startDate, language)} –{" "}
              {formatBucketDate(hoveredBucket.endDate, language)}
            </Typography>
            {result.series.map((s, si) => (
              <Stack
                key={s.categoryId}
                direction="row"
                spacing={1}
                alignItems="center"
                justifyContent="space-between"
                sx={{ mt: 0.5 }}
              >
                <Stack direction="row" spacing={0.75} alignItems="center">
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: "2px",
                      bgcolor: colors[si],
                    }}
                  />
                  <Typography variant="caption">
                    {seriesLabel(s, otherLabel)}
                  </Typography>
                </Stack>
                <Typography
                  variant="caption"
                  sx={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {formatNumber(s[metric][hovered] ?? 0, language)}
                </Typography>
              </Stack>
            ))}
            <Stack
              direction="row"
              justifyContent="space-between"
              sx={{
                mt: 0.75,
                pt: 0.75,
                borderTop: 1,
                borderColor: "divider",
              }}
            >
              <Typography variant="caption" fontWeight={600}>
                Σ
              </Typography>
              <Typography
                variant="caption"
                fontWeight={600}
                sx={{ fontVariantNumeric: "tabular-nums" }}
              >
                {formatNumber(totals[hovered] ?? 0, language)}
              </Typography>
            </Stack>
          </Box>
        )}
      </Box>
    </Stack>
  );
}
