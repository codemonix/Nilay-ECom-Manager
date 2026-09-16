import { useEffect, useState } from "react";
import { DataSource } from "@complaint-system/shared";
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
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { useTranslation } from "react-i18next";
import {
  useLazyCheckTitleAsteriskQuery,
  useSearchDevToolsItemsQuery,
  useToggleTitleAsteriskMutation,
} from "../api/devToolsApi";
import type { SoldItemSearchResultDTO, ToggleTitleAsteriskResultDTO } from "../types";
import { useGetSettingsQuery } from "../../settings/api/settingsApi";
import { getApiErrorMessage } from "../../../utils/apiError";

const MIN_SEARCH_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 350;

/**
 * Internal check tool: look up a product by code or name, see whether its
 * title currently ends in "*" (Shopfa's inventory follow-up flag), and
 * toggle it. Toggling only works against the live Shopfa API -- imported
 * order data has no product catalog to write back to -- and always
 * re-fetches the product afterward to confirm the change actually landed
 * (see ToggleTitleAsteriskResultDTO.applied), rather than trusting the
 * write call's own response. If a toggle ever fails, "Edit in Shopfa
 * admin" links straight to the manual editor as a fallback.
 */
export function TitleAsteriskCheckPage() {
  const { t } = useTranslation("devTools", { keyPrefix: "titleAsterisk" });
  const [productCode, setProductCode] = useState("");
  const [nameQuery, setNameQuery] = useState("");
  const [debouncedNameQuery, setDebouncedNameQuery] = useState("");
  const [toggleResult, setToggleResult] = useState<ToggleTitleAsteriskResultDTO | null>(null);

  const { data: settings } = useGetSettingsQuery();
  const isLiveApi = settings?.dataSource === DataSource.LIVE_API;

  const [runCheck, { data: result, isFetching: isChecking, error: checkError }] = useLazyCheckTitleAsteriskQuery();
  const [runToggle, { isLoading: isToggling, error: toggleError }] = useToggleTitleAsteriskMutation();

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedNameQuery(nameQuery), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [nameQuery]);

  const { data: searchResults = [], isFetching: isSearchingByName } = useSearchDevToolsItemsQuery(
    debouncedNameQuery.trim(),
    { skip: debouncedNameQuery.trim().length < MIN_SEARCH_LENGTH },
  );

  const handleCheck = (code: string) => {
    if (!code.trim()) return;
    setToggleResult(null);
    void runCheck(code.trim());
  };

  const handleSelectByName = (option: SoldItemSearchResultDTO | null) => {
    if (!option) return;
    setProductCode(option.productCode);
    handleCheck(option.productCode);
  };

  const handleToggle = async () => {
    if (!result) return;
    const outcome = await runToggle(result.productCode).unwrap();
    setToggleResult(outcome);
  };

  const displayedTitle = toggleResult?.currentTitle ?? result?.title;
  const displayedHasAsterisk = toggleResult?.hasAsterisk ?? result?.hasAsterisk;

  return (
    <Stack spacing={2}>
      <Typography variant="h1">{t("title")}</Typography>
      <Typography variant="body2" color="text.secondary">
        {t("description")}
      </Typography>

      <Card variant="outlined" sx={{ borderRadius: "14px" }}>
        <CardContent>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1}>
              <TextField
                size="small"
                label={t("productCode")}
                value={productCode}
                onChange={(e) => setProductCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCheck(productCode);
                }}
                fullWidth
              />
              <Button
                variant="outlined"
                onClick={() => handleCheck(productCode)}
                disabled={!productCode.trim() || isChecking}
                startIcon={isChecking ? <CircularProgress size={14} /> : undefined}
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

            {isChecking && (
              <Alert severity="info" icon={<CircularProgress size={16} />}>
                {t("loading")}
              </Alert>
            )}

            {checkError && <Alert severity="error">{getApiErrorMessage(checkError) ?? t("checkError")}</Alert>}

            {result && !isChecking && (
              <Alert severity={displayedHasAsterisk ? "success" : "info"} icon={false}>
                <Stack spacing={1}>
                  <Stack spacing={0.5}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {displayedTitle}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {result.productCode}
                    </Typography>
                  </Stack>
                  <Chip
                    size="small"
                    color={displayedHasAsterisk ? "success" : "default"}
                    variant={displayedHasAsterisk ? "filled" : "outlined"}
                    label={displayedHasAsterisk ? t("hasAsterisk") : t("noAsterisk")}
                    sx={{ alignSelf: "flex-start" }}
                  />

                  {!isLiveApi && <Alert severity="warning">{t("liveApiRequired")}</Alert>}

                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Button
                      variant="contained"
                      size="small"
                      onClick={handleToggle}
                      disabled={!isLiveApi || isToggling}
                      startIcon={isToggling ? <CircularProgress size={14} /> : undefined}
                    >
                      {displayedHasAsterisk ? t("removeAsterisk") : t("addAsterisk")}
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      endIcon={<OpenInNewIcon fontSize="small" />}
                      href={result.adminEditUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {t("editInAdmin")}
                    </Button>
                  </Stack>
                </Stack>
              </Alert>
            )}

            {toggleError && <Alert severity="error">{getApiErrorMessage(toggleError) ?? t("toggleError")}</Alert>}

            {toggleResult && !toggleResult.applied && <Alert severity="warning">{t("toggleNotApplied")}</Alert>}
            {toggleResult && toggleResult.applied && <Alert severity="success">{t("toggleApplied")}</Alert>}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
