import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import { useTranslation } from "react-i18next";
import type { PackingItemDTO } from "../types";

const UNPACKED_BORDER_COLOR = "#F59E0B";
const PACKED_BORDER_COLOR = "#22C55E";

/**
 * One order item in Packing's review screen: a deliberately large,
 * picture-only tile (no title/product-code text -- staff match the item by
 * sight against the physical product, not by reading) with the quantity to
 * put in the box overlaid directly on the photo in large, high-contrast
 * text. Tapping the whole tile toggles it between unpacked (orange frame,
 * the default) and packed (green frame) -- there is no separate button.
 */
export function PackingItemTile({
  item,
  packed,
  onToggle,
}: {
  item: PackingItemDTO;
  packed: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation("packing");

  return (
    <Box
      role="button"
      aria-pressed={packed}
      onClick={onToggle}
      sx={{
        position: "relative",
        width: "100%",
        aspectRatio: "1",
        borderRadius: "18px",
        overflow: "hidden",
        cursor: "pointer",
        border: "7px solid",
        borderColor: packed ? PACKED_BORDER_COLOR : UNPACKED_BORDER_COLOR,
        bgcolor: "action.hover",
        transition: "border-color 0.15s ease",
        userSelect: "none",
      }}
    >
      {item.imageUrl ? (
        <Box
          component="img"
          src={item.imageUrl}
          alt={item.title}
          sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        <Stack alignItems="center" justifyContent="center" sx={{ width: "100%", height: "100%" }}>
          <Inventory2Icon color="disabled" sx={{ fontSize: "35%" }} />
        </Stack>
      )}

      <Box
        sx={{
          position: "absolute",
          bottom: 10,
          insetInlineStart: 10,
          bgcolor: "rgba(0,0,0,0.72)",
          color: "common.white",
          fontWeight: 800,
          fontSize: { xs: "1.75rem", sm: "2.25rem" },
          lineHeight: 1,
          borderRadius: "12px",
          px: 1.75,
          py: 1,
        }}
      >
        {item.quantity}
      </Box>

      {packed && (
        <Box
          sx={{
            position: "absolute",
            top: 10,
            insetInlineEnd: 10,
            color: PACKED_BORDER_COLOR,
            bgcolor: "common.white",
            borderRadius: "50%",
            display: "flex",
          }}
        >
          <CheckCircleIcon aria-label={t("packed")} sx={{ fontSize: { xs: 32, sm: 40 } }} />
        </Box>
      )}
    </Box>
  );
}
