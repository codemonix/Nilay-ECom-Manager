import { useEffect, useState } from "react";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import TextField from "@mui/material/TextField";
import Autocomplete from "@mui/material/Autocomplete";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Chip from "@mui/material/Chip";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableBody from "@mui/material/TableBody";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select, { type SelectChangeEvent } from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import { useTranslation } from "react-i18next";
import { useLazyGetSoldQuantityQuery, useSearchDevToolsItemsQuery } from "../api/devToolsApi";
import { SOLD_QUANTITY_RANGE_DAYS_VALUES, type SoldItemSearchResultDTO, type SoldQuantityRangeDays } from "../types";
import { formatDateTime } from "../../../utils/localeFormat";
import { useActiveLanguage } from "../../../i18n/useActiveLanguage";

const MIN_SEARCH_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 350;
const DEFAULT_RANGE_DAYS: SoldQuantityRangeDays = 30;

/** Simple internal check tool: look up total quantity sold for a product within a chosen time frame, either by entering its exact code or by searching its name and picking from a list -- both paths run the same sold-quantity lookup against the live Shopfa client. */
export function SoldQuantityCheckPage() {
  const { t } = useTranslation("devTools", { keyPrefix: "soldQuantity" });
  const language = useActiveLanguage();
  const [productCode, setProductCode] = useState("");
  const [days, setDays] = useState<SoldQuantityRangeDays>(DEFAULT_RANGE_DAYS);
  const [nameQuery, setNameQuery] = useState("");
  const [debouncedNameQuery, setDebouncedNameQuery] = useState("");

  const [runLookup, { data: result, isFetching: isLookingUp, error: lookupError }] = useLazyGetSoldQuantityQuery();

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedNameQuery(nameQuery), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [nameQuery]);

  const { data: searchResults = [], isFetching: isSearchingByName } = useSearchDevToolsItemsQuery(
    debouncedNameQuery.trim(),
    { skip: debouncedNameQuery.trim().length < MIN_SEARCH_LENGTH },
  );

  const handleCheckByCode = () => {
    if (!productCode.trim()) return;
    void runLookup({ productCode: productCode.trim(), days });
  };

  const handleSelectByName = (option: SoldItemSearchResultDTO | null) => {
    if (!option) return;
    setProductCode(option.productCode);
    void runLookup({ productCode: option.productCode, days });
  };

  const handleDaysChange = (e: SelectChangeEvent<number>) => {
    const nextDays = Number(e.target.value) as SoldQuantityRangeDays;
    setDays(nextDays);
    if (productCode.trim()) void runLookup({ productCode: productCode.trim(), days: nextDays });
  };

  return (
    <Stack spacing={2}>
      <Typography variant="h1">{t("title")}</Typography>
      <Typography variant="body2" color="text.secondary">
        {t("description")}
      </Typography>

      <Card variant="outlined" sx={{ borderRadius: "14px" }}>
        <CardContent>
          <Stack spacing={2}>
            <FormControl size="small" sx={{ maxWidth: 260 }}>
              <InputLabel id="sold-quantity-range-label">{t("timeFrame")}</InputLabel>
              <Select
                labelId="sold-quantity-range-label"
                label={t("timeFrame")}
                value={days}
                onChange={handleDaysChange}
              >
                {SOLD_QUANTITY_RANGE_DAYS_VALUES.map((value) => (
                  <MenuItem key={value} value={value}>
                    {t(`range.${value}`)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Stack direction="row" spacing={1}>
              <TextField
                size="small"
                label={t("productCode")}
                value={productCode}
                onChange={(e) => setProductCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCheckByCode();
                }}
                fullWidth
              />
              <Button
                variant="outlined"
                onClick={handleCheckByCode}
                disabled={!productCode.trim() || isLookingUp}
                startIcon={isLookingUp ? <CircularProgress size={14} /> : undefined}
              >
                {t("check")}
              </Button>
            </Stack>

            <Divider>
              <Typography variant="caption" color="text.secondary">
                {t("or")}
              </Typography>
            </Divider>

            <Autocomplete
              options={searchResults}
              getOptionLabel={(option) => option.title}
              filterOptions={(options) => options}
              loading={isSearchingByName}
              inputValue={nameQuery}
              onInputChange={(_e, value) => setNameQuery(value)}
              onChange={(_e, value) => handleSelectByName(value)}
              noOptionsText={
                debouncedNameQuery.trim().length < MIN_SEARCH_LENGTH ? t("searchByNameHint") : t("noResults")
              }
              isOptionEqualToValue={(option, value) => option.productCode === value.productCode}
              renderOption={(props, option) => {
                const { key, ...optionProps } = props;
                return (
                  <li key={key} {...optionProps}>
                    <Stack spacing={0}>
                      <Typography variant="body2">{option.title}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {option.productCode}
                        {option.sku ? ` · ${option.sku}` : ""}
                      </Typography>
                    </Stack>
                  </li>
                );
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  size="small"
                  label={t("searchByName")}
                  placeholder={t("searchByNamePlaceholder")}
                  slotProps={{
                    input: {
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {isSearchingByName ? <CircularProgress size={14} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    },
                  }}
                />
              )}
            />

            {isLookingUp && (
              <Alert severity="info" icon={<CircularProgress size={16} />}>
                {t("loading")}
              </Alert>
            )}

            {lookupError && <Alert severity="error">{t("lookupError")}</Alert>}

            {result && !isLookingUp && (
              <Alert severity={result.totalQuantity > 0 ? "success" : "info"} icon={false}>
                <Stack spacing={0.5}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {result.title ?? t("titleUnknown")}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {result.productCode}
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                    <Chip size="small" color="primary" label={t("totalQuantity", { count: result.totalQuantity })} />
                    <Chip size="small" variant="outlined" label={t("orderCount", { count: result.orderCount })} />
                  </Stack>
                </Stack>
              </Alert>
            )}

            {result && !isLookingUp && result.byStatus.length > 0 && (
              <Stack spacing={1}>
                <Stack direction="row" justifyContent="space-between" alignItems="baseline" flexWrap="wrap" gap={0.5}>
                  <Typography variant="subtitle2">{t("byStatusTitle")}</Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="caption" color="text.secondary">
                      {t("rangeShown", {
                        from: formatDateTime(result.rangeFromISO, language),
                        to: formatDateTime(result.rangeToISO, language),
                      })}
                    </Typography>
                    <Chip
                      size="small"
                      variant="outlined"
                      color={result.fromCache ? "default" : "success"}
                      label={
                        result.fromCache
                          ? t("cachedAt", { time: formatDateTime(result.fetchedAtISO, language) })
                          : t("liveJustNow")
                      }
                    />
                  </Stack>
                </Stack>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>{t("statusColumn")}</TableCell>
                        <TableCell align="right">{t("quantityColumn")}</TableCell>
                        <TableCell align="right">{t("ordersColumn")}</TableCell>
                        <TableCell align="center">{t("countedColumn")}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {result.byStatus.map((row) => (
                        <TableRow key={row.status} selected={row.countedInTotal}>
                          <TableCell>{row.status}</TableCell>
                          <TableCell align="right">{row.quantity}</TableCell>
                          <TableCell align="right">{row.orderCount}</TableCell>
                          <TableCell align="center">
                            {row.countedInTotal ? (
                              <Chip size="small" color="success" label={t("counted")} />
                            ) : (
                              <Chip size="small" variant="outlined" label={t("notCounted")} />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Stack>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
