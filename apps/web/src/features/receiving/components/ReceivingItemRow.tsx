import { useState } from "react";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Avatar from "@mui/material/Avatar";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import CircularProgress from "@mui/material/CircularProgress";
import CheckIcon from "@mui/icons-material/Check";
import { useTranslation } from "react-i18next";
import type { PackageItemDTO } from "../types";
import { useUpdateReceivedQuantityMutation } from "../api/receivingApi";
import { ItemPhoto } from "../../../components/ItemPhoto";

interface ReceivingItemRowProps {
  packageId: string;
  item: PackageItemDTO;
  photoUrl: string | null;
  disabled: boolean;
}

/**
 * The core of the receiving comparison: the purchase photo next to whatever
 * Shopfa data the item already has (if it's been matched -- matching can
 * happen at any package stage, so it may not have happened yet), with an
 * editable count distinct from the originally purchased quantity.
 */
export function ReceivingItemRow({ packageId, item, photoUrl, disabled }: ReceivingItemRowProps) {
  const { t } = useTranslation("receiving");
  const { t: tPurchasing } = useTranslation("purchasing");
  const [receivedQuantity, setReceivedQuantity] = useState(String(item.receivedQuantity ?? item.quantity));
  const [updateReceivedQuantity, { isLoading }] = useUpdateReceivedQuantityMutation();

  const handleSave = () => {
    const value = Number(receivedQuantity);
    if (!Number.isFinite(value) || value < 0) return;
    updateReceivedQuantity({ packageId, itemId: item.id, receivedQuantity: value });
  };

  return (
    <Stack spacing={1.5} sx={{ py: 2 }}>
      <Stack direction="row" spacing={2} alignItems="flex-start">
        <ItemPhoto
          src={photoUrl}
          alt={item.description || tPurchasing("receiveItems.unnamedItem")}
          size={120}
          quantity={item.quantity}
        />

        <Stack spacing={0.5} sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {item.description || tPurchasing("receiveItems.unnamedItem")}
            {item.variantLabel ? ` · ${item.variantLabel}` : ""}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t("detail.expectedQuantity", { count: item.quantity })}
          </Typography>

          {item.matchedAt ? (
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
              {item.matchedProductImageUrl && (
                <Avatar variant="rounded" src={item.matchedProductImageUrl} sx={{ width: 32, height: 32 }} />
              )}
              <Typography variant="caption" color="text.secondary">
                {t("detail.shopfaMatch", { title: item.matchedProductTitle })}
              </Typography>
            </Stack>
          ) : (
            <Chip size="small" variant="outlined" label={t("detail.notMatchedYet")} sx={{ alignSelf: "flex-start", mt: 0.5 }} />
          )}
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center">
          <TextField
            size="small"
            type="number"
            label={t("detail.receivedQuantity")}
            value={receivedQuantity}
            onChange={(e) => setReceivedQuantity(e.target.value)}
            disabled={disabled}
            slotProps={{ htmlInput: { min: 0, step: 1 } }}
            sx={{ width: 110 }}
          />
          <IconButton
            color="primary"
            onClick={handleSave}
            disabled={disabled || isLoading || Number(receivedQuantity) === (item.receivedQuantity ?? -1)}
            aria-label={t("detail.saveCount")}
          >
            {isLoading ? <CircularProgress size={18} /> : <CheckIcon />}
          </IconButton>
        </Stack>
      </Stack>
      <Divider />
    </Stack>
  );
}
