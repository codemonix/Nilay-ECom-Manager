import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import { useTranslation } from "react-i18next";
import { ItemPhoto } from "../../../components/ItemPhoto";
import type { OrderPrecheckItemDTO } from "../types";

type AvailabilityValue = "available" | "unavailable" | null;

function toValue(available: boolean | null): AvailabilityValue {
  if (available === null) return null;
  return available ? "available" : "unavailable";
}

/**
 * One order item in Order Precheck's review screen -- deliberately card-based
 * (not a dense table row) with a photo as large as the layout allows (fluid,
 * filling the card's width), since this is meant to be operated on a
 * phone/tablet by warehouse staff comparing the picture against the physical
 * item, not scanned as a data table. The title is clamped to a fixed two-line
 * height (rather than growing with longer titles) specifically so every
 * card in the grid is the same height and the available/unavailable buttons
 * always land in the same place -- switching between items or orders never
 * shifts them.
 */
export function OrderPrecheckItemCard({
  item,
  onChange,
}: {
  item: OrderPrecheckItemDTO;
  onChange: (available: boolean) => void;
}) {
  const { t } = useTranslation("orderPrecheck");
  const value = toValue(item.available);

  return (
    <Card variant="outlined" sx={{ borderRadius: "14px" }}>
      <CardContent>
        <Stack spacing={1.5} alignItems="center">
          <ItemPhoto src={item.imageUrl} alt={item.title} fluid />
          <Typography
            variant="body2"
            align="center"
            sx={{
              width: "100%",
              height: "2.6em",
              lineHeight: 1.3,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {item.title}
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="caption" color="text.secondary">
              {item.productCode}
            </Typography>
            <Chip size="small" label={t("quantity", { count: item.quantity })} />
          </Stack>
          <ToggleButtonGroup
            exclusive
            fullWidth
            value={value}
            onChange={(_e, next: AvailabilityValue) => {
              if (next) onChange(next === "available");
            }}
            sx={{ width: "100%" }}
          >
            <ToggleButton value="available" color="success" sx={{ flex: 1, py: 1.25 }}>
              <CheckCircleIcon fontSize="small" sx={{ mr: 0.75 }} />
              {t("available")}
            </ToggleButton>
            <ToggleButton value="unavailable" color="error" sx={{ flex: 1, py: 1.25 }}>
              <CancelIcon fontSize="small" sx={{ mr: 0.75 }} />
              {t("unavailable")}
            </ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      </CardContent>
    </Card>
  );
}
