import { useEffect, useState } from "react";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Autocomplete from "@mui/material/Autocomplete";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Avatar from "@mui/material/Avatar";
import Alert from "@mui/material/Alert";
import Divider from "@mui/material/Divider";
import CircularProgress from "@mui/material/CircularProgress";
import { useTranslation } from "react-i18next";
import type { MatchPreviewDTO, PackageItemDTO } from "../types";
import {
  useListPackageAttachmentsQuery,
  useMatchItemMutation,
  usePreviewMatchItemMutation,
  useUnmatchItemMutation,
} from "../api/packagesApi";
import { useSearchShopfaProductsQuery } from "../api/shopfaProductsApi";
import { ItemPhoto } from "../../../components/ItemPhoto";
import { resolvePhotoUrl } from "../../../utils/attachments";
import { formatCurrency } from "../../../utils/localeFormat";
import { useActiveLanguage } from "../../../i18n/useActiveLanguage";

interface ItemMatchCardProps {
  packageId: string;
  packageNumber: string;
  item: PackageItemDTO;
}

const MIN_SEARCH_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 350;

/**
 * Two-phase match: the user finds a Shopfa product -- either by entering its
 * exact code, or by typing its name and picking from a search-results list
 * -- and previews it (read-only, nothing saved yet) so they can visually
 * confirm it's the same item and the name is correct before committing;
 * only then does "Confirm Match" persist it. Matching itself isn't gated by
 * package status (it can happen while draft, in transit, or already received).
 */
export function ItemMatchCard({ packageId, packageNumber, item }: ItemMatchCardProps) {
  const { t } = useTranslation("purchasing");
  const language = useActiveLanguage();
  const [productCode, setProductCode] = useState("");
  const [preview, setPreview] = useState<MatchPreviewDTO | null>(null);
  const [nameQuery, setNameQuery] = useState("");
  const [debouncedNameQuery, setDebouncedNameQuery] = useState("");

  const [previewMatch, { isLoading: isPreviewing, error: previewError }] = usePreviewMatchItemMutation();
  const [matchItem, { isLoading: isConfirming }] = useMatchItemMutation();
  const [unmatchItem, { isLoading: isUnmatching }] = useUnmatchItemMutation();
  const { data: attachments = [] } = useListPackageAttachmentsQuery(packageId);
  const photoUrl = resolvePhotoUrl(item.photoAttachmentId, attachments);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedNameQuery(nameQuery), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [nameQuery]);

  const { data: searchResults = [], isFetching: isSearchingByName } = useSearchShopfaProductsQuery(
    debouncedNameQuery.trim(),
    { skip: debouncedNameQuery.trim().length < MIN_SEARCH_LENGTH },
  );

  const handlePreviewByCode = async () => {
    if (!productCode.trim()) return;
    const result = await previewMatch({ packageId, itemId: item.id, productCode: productCode.trim() })
      .unwrap()
      .catch(() => null);
    if (result) setPreview(result);
  };

  const handleConfirm = async () => {
    if (!preview) return;
    await matchItem({ packageId, itemId: item.id, productCode: preview.productCode }).unwrap();
    setProductCode("");
    setNameQuery("");
    setPreview(null);
  };

  const handleCancelPreview = () => {
    setPreview(null);
  };

  return (
    <Card variant="outlined" sx={{ borderRadius: "14px" }}>
      <CardContent>
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={2} alignItems="flex-start">
            <ItemPhoto src={photoUrl} alt={item.description || t("receiveItems.unnamedItem")} size={96} quantity={item.quantity} />
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ flexGrow: 1, minWidth: 0 }}>
              <Stack spacing={0.25}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  {item.description || t("receiveItems.unnamedItem")}
                  {item.variantLabel ? ` · ${item.variantLabel}` : ""}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {packageNumber} · {item.quantity} × {formatCurrency(item.unitPrice, language, item.currency)}
                </Typography>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                {item.receivedQuantity !== null && (
                  <Chip size="small" variant="outlined" label={`${t("detail.itemsColumns.receivedQuantity")}: ${item.receivedQuantity}`} />
                )}
                {item.matchedAt ? (
                  <Chip size="small" color="success" label={t("matchRegister.matched")} />
                ) : (
                  <Chip size="small" variant="outlined" label={t("matchRegister.unmatched")} />
                )}
              </Stack>
            </Stack>
          </Stack>

          {item.matchedAt ? (
            <Stack spacing={1}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                {item.matchedProductImageUrl && (
                  <Avatar variant="rounded" src={item.matchedProductImageUrl} sx={{ width: 48, height: 48 }} />
                )}
                <Stack spacing={0.25}>
                  <Typography variant="body2">
                    {t("matchRegister.matchedTo", { title: item.matchedProductTitle, code: item.productCode })}
                  </Typography>
                  {item.titleEndsWithAsterisk && (
                    <Chip size="small" color="warning" variant="outlined" label={t("matchRegister.asteriskFlag")} />
                  )}
                </Stack>
              </Stack>

              {(() => {
                const addedQuantity = item.receivedQuantity ?? item.quantity;
                const updatedQuantity =
                  item.matchedAvailableQuantity !== null ? item.matchedAvailableQuantity + addedQuantity : null;
                return (
                  <Alert severity="success" icon={false} sx={{ py: 0.5 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {updatedQuantity !== null
                        ? t("matchRegister.updateShopfaTo", { count: updatedQuantity })
                        : t("matchRegister.updateShopfaUnknown")}
                    </Typography>
                    {updatedQuantity !== null && (
                      <Typography variant="caption" color="text.secondary">
                        {t("matchRegister.updateShopfaBreakdown", {
                          before: item.matchedAvailableQuantity,
                          added: addedQuantity,
                        })}
                      </Typography>
                    )}
                  </Alert>
                );
              })()}

              <Stack direction="row" spacing={1}>
                {item.inventoryPending && (
                  <Chip size="small" variant="outlined" label={t("matchRegister.inventoryPending")} />
                )}
                <Button size="small" color="inherit" onClick={() => unmatchItem({ packageId, itemId: item.id })} disabled={isUnmatching}>
                  {t("matchRegister.unmatch")}
                </Button>
              </Stack>
            </Stack>
          ) : preview ? (
            <Stack spacing={1.5}>
              <Alert severity="info" icon={false}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <ItemPhoto src={preview.imageUrl} alt={preview.title} size={80} />
                  <Stack spacing={0.25}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {preview.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {preview.productCode} {preview.sku ? `· ${preview.sku}` : ""} ·{" "}
                      {formatCurrency(preview.price, language)}
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                      <Chip
                        size="small"
                        variant="outlined"
                        color={preview.availableQuantity === 0 ? "error" : "default"}
                        label={
                          preview.availableQuantity === null
                            ? t("matchRegister.availableQuantityUnknown")
                            : t("matchRegister.availableQuantity", { count: preview.availableQuantity })
                        }
                      />
                      {preview.titleEndsWithAsterisk && (
                        <Chip size="small" color="warning" variant="outlined" label={t("matchRegister.asteriskFlag")} />
                      )}
                    </Stack>
                  </Stack>
                </Stack>
              </Alert>
              <Typography variant="caption" color="text.secondary">
                {t("matchRegister.confirmPrompt")}
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button
                  variant="contained"
                  onClick={handleConfirm}
                  disabled={isConfirming}
                  startIcon={isConfirming ? <CircularProgress size={14} /> : undefined}
                >
                  {t("matchRegister.confirmMatch")}
                </Button>
                <Button color="inherit" onClick={handleCancelPreview}>
                  {t("actions.cancel", { ns: "common" })}
                </Button>
              </Stack>
            </Stack>
          ) : (
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1}>
                <TextField
                  size="small"
                  label={t("matchRegister.productCode")}
                  value={productCode}
                  onChange={(e) => setProductCode(e.target.value)}
                  fullWidth
                />
                <Button
                  variant="outlined"
                  onClick={handlePreviewByCode}
                  disabled={!productCode.trim() || isPreviewing}
                  startIcon={isPreviewing ? <CircularProgress size={14} /> : undefined}
                >
                  {t("matchRegister.search")}
                </Button>
              </Stack>

              <Divider>
                <Typography variant="caption" color="text.secondary">
                  {t("matchRegister.or")}
                </Typography>
              </Divider>

              <Autocomplete
                options={searchResults}
                getOptionLabel={(option) => option.title}
                filterOptions={(options) => options}
                loading={isSearchingByName}
                inputValue={nameQuery}
                onInputChange={(_e, value) => setNameQuery(value)}
                onChange={(_e, value) => {
                  if (value) setPreview(value);
                }}
                noOptionsText={
                  debouncedNameQuery.trim().length < MIN_SEARCH_LENGTH
                    ? t("matchRegister.searchByNameHint")
                    : t("matchRegister.noResults")
                }
                isOptionEqualToValue={(option, value) => option.shopfaProductId === value.shopfaProductId}
                renderOption={(props, option) => {
                  const { key, ...optionProps } = props;
                  return (
                    <li key={key} {...optionProps}>
                      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ width: "100%", py: 0.5 }}>
                        <Avatar variant="rounded" src={option.imageUrl ?? undefined} sx={{ width: 40, height: 40 }} />
                        <Stack spacing={0} sx={{ minWidth: 0 }}>
                          <Typography variant="body2" noWrap>
                            {option.title}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {option.productCode} · {formatCurrency(option.price, language)} ·{" "}
                            {option.availableQuantity === null
                              ? t("matchRegister.availableQuantityUnknown")
                              : t("matchRegister.availableQuantity", { count: option.availableQuantity })}
                          </Typography>
                        </Stack>
                      </Stack>
                    </li>
                  );
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    size="small"
                    label={t("matchRegister.searchByName")}
                    placeholder={t("matchRegister.searchByNamePlaceholder")}
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
            </Stack>
          )}
          {previewError && <Alert severity="error">{t("matchRegister.matchError")}</Alert>}
        </Stack>
      </CardContent>
    </Card>
  );
}
