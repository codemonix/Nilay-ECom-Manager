import { useEffect, useMemo, useState } from "react";
import { DataSource } from "@complaint-system/shared";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import TextField from "@mui/material/TextField";
import Autocomplete from "@mui/material/Autocomplete";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
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
import {
  useGetItemSalesCategoriesQuery,
  useLazyGetItemSalesReportQuery,
  useSearchItemSalesProductsQuery,
} from "../api/reportingApi";
import type { ItemSalesCategoryDTO, ItemSalesProductSearchResultDTO } from "../types";
import { DateRangeFields } from "../components/DateRangeFields";
import { isValidDateRange, lastDaysRange, type DateRangeValue } from "../dateRange";
import { useGetSettingsQuery } from "../../settings/api/settingsApi";
import { getApiErrorMessage } from "../../../utils/apiError";
import { formatDate, formatDateTime, formatNumber } from "../../../utils/localeFormat";
import { useActiveLanguage } from "../../../i18n/useActiveLanguage";

type Mode = "category" | "product";
const MIN_SEARCH_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 350;

/** Categories ordered parent-first with a "Parent › Child" label, so the picker shows where a category sits in the tree. */
function buildCategoryOptions(categories: ItemSalesCategoryDTO[]): Array<{ id: string; label: string }> {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const labelOf = (category: ItemSalesCategoryDTO): string => {
    const parent = byId.get(category.parentId);
    return parent ? `${labelOf(parent)} › ${category.title}` : category.title;
  };
  return categories.map((c) => ({ id: c.id, label: labelOf(c) })).sort((a, b) => a.label.localeCompare(b.label, "fa"));
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Card variant="outlined" sx={{ borderRadius: "14px", flex: 1, minWidth: 140 }}>
      <CardContent>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="h2">{value}</Typography>
      </CardContent>
    </Card>
  );
}

/**
 * Reporting's item sales report: how many units (and how much revenue) of
 * one product, or of a whole category such as earrings or necklaces
 * (sub-categories included), were sold in a chosen period. Counts only
 * sold-status orders, windowed by payment date -- see ItemSalesResultDTO.
 * Live-API only.
 */
export function ItemSalesReportPage() {
  const { t } = useTranslation("reporting", { keyPrefix: "itemSales" });
  const language = useActiveLanguage();
  const [mode, setMode] = useState<Mode>("category");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [product, setProduct] = useState<ItemSalesProductSearchResultDTO | null>(null);
  const [productInput, setProductInput] = useState("");
  const [debouncedProductInput, setDebouncedProductInput] = useState("");
  const [range, setRange] = useState<DateRangeValue>(() => lastDaysRange(30));

  const { data: settings } = useGetSettingsQuery();
  const isLiveApi = settings?.dataSource === DataSource.LIVE_API;

  const { data: categories = [] } = useGetItemSalesCategoriesQuery(undefined, { skip: !isLiveApi });
  const categoryOptions = useMemo(() => buildCategoryOptions(categories), [categories]);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedProductInput(productInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [productInput]);
  const { data: productOptions = [], isFetching: isSearching } = useSearchItemSalesProductsQuery(debouncedProductInput, {
    skip: !isLiveApi || mode !== "product" || debouncedProductInput.length < MIN_SEARCH_LENGTH,
  });

  const [runReport, { data: result, isFetching, error }] = useLazyGetItemSalesReportQuery();

  const hasSelection = mode === "category" ? categoryId !== null : product !== null;
  const canGenerate = isLiveApi && hasSelection && isValidDateRange(range) && !isFetching;
  const handleGenerate = () => {
    if (!canGenerate) return;
    void runReport({
      ...(mode === "category" ? { categoryId: categoryId as string } : { productId: (product as ItemSalesProductSearchResultDTO).productId }),
      ...range,
    });
  };

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
            <ToggleButtonGroup
              size="small"
              exclusive
              value={mode}
              onChange={(_e, value: Mode | null) => value && setMode(value)}
              sx={{ alignSelf: "flex-start" }}
            >
              <ToggleButton value="category">{t("modeCategory")}</ToggleButton>
              <ToggleButton value="product">{t("modeProduct")}</ToggleButton>
            </ToggleButtonGroup>

            {mode === "category" ? (
              <Autocomplete
                size="small"
                sx={{ maxWidth: 420 }}
                options={categoryOptions}
                value={categoryOptions.find((option) => option.id === categoryId) ?? null}
                onChange={(_e, option) => setCategoryId(option?.id ?? null)}
                getOptionLabel={(option) => option.label}
                isOptionEqualToValue={(a, b) => a.id === b.id}
                disabled={!isLiveApi}
                noOptionsText={t("noCategories")}
                renderInput={(params) => <TextField {...params} label={t("category")} helperText={t("categoryHelper")} />}
              />
            ) : (
              <Autocomplete
                size="small"
                sx={{ maxWidth: 420 }}
                options={productOptions}
                value={product}
                onChange={(_e, option) => setProduct(option)}
                inputValue={productInput}
                onInputChange={(_e, value) => setProductInput(value)}
                filterOptions={(options) => options}
                getOptionLabel={(option) => option.title}
                isOptionEqualToValue={(a, b) => a.productId === b.productId}
                loading={isSearching}
                disabled={!isLiveApi}
                noOptionsText={productInput.trim().length < MIN_SEARCH_LENGTH ? t("typeToSearch") : t("noProducts")}
                renderInput={(params) => <TextField {...params} label={t("product")} />}
              />
            )}

            <DateRangeFields value={range} onChange={setRange} disabled={!isLiveApi} />

            <Button
              variant="contained"
              onClick={handleGenerate}
              disabled={!canGenerate}
              startIcon={isFetching ? <CircularProgress size={14} /> : undefined}
              sx={{ alignSelf: "flex-start" }}
            >
              {t("generate")}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {isFetching && (
        <Alert severity="info" icon={<CircularProgress size={16} />}>
          {t("loading")}
        </Alert>
      )}
      {error && !isFetching && <Alert severity="error">{getApiErrorMessage(error) ?? t("generateError")}</Alert>}

      {result && !isFetching && (
        <>
          <Typography variant="h2">
            {result.label}
            {result.scope === "category" && result.categoryCount > 0 && (
              <Typography component="span" variant="body2" color="text.secondary">
                {" "}
                {t("includesSubcategories", { count: result.categoryCount, formatted: formatNumber(result.categoryCount, language) })}
              </Typography>
            )}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t("resultMeta", {
              from: formatDate(result.rangeFromISO, language),
              to: formatDate(result.rangeToISO, language),
              time: formatDateTime(result.generatedAtISO, language),
            })}
          </Typography>

          <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
            <StatTile label={t("totalQuantity")} value={formatNumber(result.totalQuantity, language)} />
            <StatTile label={t("totalRevenue")} value={formatNumber(result.totalRevenue, language)} />
            {result.scope === "category" ? (
              <StatTile label={t("productsSold")} value={formatNumber(result.productsSold, language)} />
            ) : (
              <StatTile label={t("orderCount")} value={formatNumber(result.orderCount ?? 0, language)} />
            )}
          </Stack>

          {result.totalQuantity === 0 ? (
            <Alert severity="info">{t("noSales")}</Alert>
          ) : (
            <Card variant="outlined" sx={{ borderRadius: "14px" }}>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>{t("itemColumn")}</TableCell>
                      <TableCell align="right">{t("quantityColumn")}</TableCell>
                      <TableCell align="right">{t("revenueColumn")}</TableCell>
                      <TableCell align="right">{t("ordersColumn")}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {result.rows
                      .filter((row) => row.quantity > 0)
                      .map((row) => (
                        <TableRow key={row.productId} hover>
                          <TableCell>
                            <Stack direction="row" spacing={1.5} alignItems="center">
                              <Avatar variant="rounded" src={row.imageUrl ?? undefined} sx={{ width: 40, height: 40 }} />
                              <Typography variant="body2">{row.title}</Typography>
                            </Stack>
                          </TableCell>
                          <TableCell align="right">{formatNumber(row.quantity, language)}</TableCell>
                          <TableCell align="right">{formatNumber(row.revenue, language)}</TableCell>
                          <TableCell align="right">{formatNumber(row.orderCount ?? 0, language)}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Card>
          )}
        </>
      )}
    </Stack>
  );
}
