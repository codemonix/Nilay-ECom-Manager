import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import { useTranslation } from "react-i18next";
import type { PackageItemDTO } from "../types";
import { ItemPhoto } from "../../../components/ItemPhoto";
import { formatCurrency } from "../../../utils/localeFormat";
import { useActiveLanguage } from "../../../i18n/useActiveLanguage";

interface PackageItemCardProps {
  item: PackageItemDTO;
  photoUrl: string | null;
}

/** Large-photo card for one item on a package -- items are identified by sight first, not by reading a description column. */
export function PackageItemCard({ item, photoUrl }: PackageItemCardProps) {
  const { t } = useTranslation("purchasing");
  const language = useActiveLanguage();
  const label = item.description || t("receiveItems.unnamedItem");

  return (
    <Card variant="outlined" sx={{ borderRadius: "14px" }}>
      <CardContent sx={{ display: "flex", gap: 2 }}>
        <ItemPhoto src={photoUrl} alt={label} size={120} quantity={item.quantity} />
        <Stack spacing={0.75} sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {label}
            {item.variantLabel ? ` · ${item.variantLabel}` : ""}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t("detail.itemsColumns.quantity")}: {item.quantity} · {formatCurrency(item.unitPrice, language, item.currency)}
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {item.matchedAt ? (
              <Chip size="small" color="success" label={item.matchedProductTitle ?? t("matchRegister.matched")} />
            ) : (
              <Chip size="small" variant="outlined" label={t("matchRegister.unmatched")} />
            )}
            {item.receivedQuantity !== null && (
              <Chip size="small" variant="outlined" label={`${t("detail.itemsColumns.receivedQuantity")}: ${item.receivedQuantity}`} />
            )}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
