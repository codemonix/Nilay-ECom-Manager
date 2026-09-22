import { useState } from "react";
import { CATEGORY_TREND_WINDOWS, DEFAULT_CATEGORY_TREND_MONTHS, DataSource } from "@complaint-system/shared";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableBody from "@mui/material/TableBody";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import { useTranslation } from "react-i18next";
import { useGetCategoryTrendsQuery } from "../api/reportingApi";
import type { CategoryTrendMonths } from "../types";
import { CategoryTrendChart, type TrendMetric } from "../components/CategoryTrendChart";
import { seriesLabel } from "../categoryTrendPalette";
import { useGetSettingsQuery } from "../../settings/api/settingsApi";
import { getApiErrorMessage } from "../../../utils/apiError";
import { formatDate, formatDateTime, formatNumber } from "../../../utils/localeFormat";
import { useActiveLanguage } from "../../../i18n/useActiveLanguage";

type View = "chart" | "table";

/**
 * Reporting's category trends: a stacked column chart of units (or revenue)
 * sold per category across equal time buckets ending today -- 1 month in
 * 3-day steps, 3 months in 5-day, 6 months in 10-day, 12 months in 30-day
 * (see CATEGORY_TREND_WINDOWS). Runs on open and on every window change;
 * results are cached server-side for 10 minutes. Live-API only.
 */
export function CategoryTrendsReportPage() {
  const { t } = useTranslation("reporting", { keyPrefix: "categoryTrends" });
  const language = useActiveLanguage();
  const [months, setMonths] = useState<CategoryTrendMonths>(DEFAULT_CATEGORY_TREND_MONTHS);
  // null = the window's default step; only the 12-month window offers a choice (see CATEGORY_TREND_WINDOWS.stepOptions).
  const [chosenStep, setChosenStep] = useState<number | null>(null);
  const [metric, setMetric] = useState<TrendMetric>("quantity");
  const [view, setView] = useState<View>("chart");

  const { data: settings } = useGetSettingsQuery();
  const isLiveApi = settings?.dataSource === DataSource.LIVE_API;
  const window = CATEGORY_TREND_WINDOWS.find((w) => w.months === months);
  const stepOptions: readonly number[] = window?.stepOptions ?? [];
  const stepDays = chosenStep !== null && stepOptions.includes(chosenStep) ? chosenStep : (window?.stepDays ?? 0);
  const { data: result, isFetching, error } = useGetCategoryTrendsQuery({ months, stepDays }, { skip: !isLiveApi || !window });

  const otherLabel = t("other");

  return (
    <Stack spacing={2}>
      <Typography variant="h1">{t("title")}</Typography>
      <Typography variant="body2" color="text.secondary">
        {t("description")}
      </Typography>

      {!isLiveApi && <Alert severity="warning">{t("liveApiRequired")}</Alert>}

      <Card variant="outlined" sx={{ borderRadius: "14px" }}>
        <CardContent>
          <Stack spacing={2}>
            <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
              <ToggleButtonGroup
                size="small"
                exclusive
                value={months}
                onChange={(_e, value: CategoryTrendMonths | null) => {
                  if (!value) return;
                  setMonths(value);
                  setChosenStep(null);
                }}
                disabled={!isLiveApi}
                aria-label={t("window")}
              >
                {CATEGORY_TREND_WINDOWS.map((w) => (
                  <ToggleButton key={w.months} value={w.months}>
                    {t("windowOption", { count: w.months })}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
              {stepOptions.length > 1 && (
                <ToggleButtonGroup
                  size="small"
                  exclusive
                  value={stepDays}
                  onChange={(_e, value: number | null) => value && setChosenStep(value)}
                  disabled={!isLiveApi}
                  aria-label={t("step")}
                >
                  {stepOptions.map((step) => (
                    <ToggleButton key={step} value={step}>
                      {step === 30 ? t("stepMonth") : t("stepDaysOption", { count: step, formatted: formatNumber(step, language) })}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              )}
              <ToggleButtonGroup
                size="small"
                exclusive
                value={metric}
                onChange={(_e, value: TrendMetric | null) => value && setMetric(value)}
                aria-label={t("metric")}
              >
                <ToggleButton value="quantity">{t("metricQuantity")}</ToggleButton>
                <ToggleButton value="revenue">{t("metricRevenue")}</ToggleButton>
              </ToggleButtonGroup>
              <ToggleButtonGroup
                size="small"
                exclusive
                value={view}
                onChange={(_e, value: View | null) => value && setView(value)}
                aria-label={t("view")}
              >
                <ToggleButton value="chart">{t("viewChart")}</ToggleButton>
                <ToggleButton value="table">{t("viewTable")}</ToggleButton>
              </ToggleButtonGroup>
            </Stack>
            {window && (
              <Typography variant="caption" color="text.secondary">
                {t("stepNote", { step: formatNumber(stepDays, language) })}
              </Typography>
            )}

            {isFetching && (
              <Alert severity="info" icon={<CircularProgress size={16} />}>
                {t("loading")}
              </Alert>
            )}
            {error && !isFetching && <Alert severity="error">{getApiErrorMessage(error) ?? t("generateError")}</Alert>}

            {result && !isFetching && (
              <>
                <Typography variant="caption" color="text.secondary">
                  {t("resultMeta", {
                    from: formatDate(result.rangeFromISO, language),
                    to: formatDate(result.rangeToISO, language),
                    time: formatDateTime(result.generatedAtISO, language),
                  })}
                </Typography>
                {result.series.length === 0 ? (
                  <Alert severity="info">{t("noSales")}</Alert>
                ) : view === "chart" ? (
                  <CategoryTrendChart result={result} metric={metric} otherLabel={otherLabel} />
                ) : (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>{t("periodColumn")}</TableCell>
                          {result.series.map((s) => (
                            <TableCell key={s.categoryId} align="right">
                              {seriesLabel(s, otherLabel)}
                            </TableCell>
                          ))}
                          <TableCell align="right">{t("totalColumn")}</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {result.buckets.map((bucket, i) => (
                          <TableRow key={bucket.startDate} hover>
                            <TableCell>
                              {formatDate(bucket.startDate, language)} – {formatDate(bucket.endDate, language)}
                            </TableCell>
                            {result.series.map((s) => (
                              <TableCell key={s.categoryId} align="right">
                                {formatNumber(s[metric][i] ?? 0, language)}
                              </TableCell>
                            ))}
                            <TableCell align="right">
                              {formatNumber(result.series.reduce((sum, s) => sum + (s[metric][i] ?? 0), 0), language)}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600 }}>{t("totalColumn")}</TableCell>
                          {result.series.map((s) => (
                            <TableCell key={s.categoryId} align="right" sx={{ fontWeight: 600 }}>
                              {formatNumber(metric === "quantity" ? s.totalQuantity : s.totalRevenue, language)}
                            </TableCell>
                          ))}
                          <TableCell align="right" sx={{ fontWeight: 600 }}>
                            {formatNumber(
                              result.series.reduce((sum, s) => sum + (metric === "quantity" ? s.totalQuantity : s.totalRevenue), 0),
                              language,
                            )}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
