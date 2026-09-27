import { useState } from "react";
import Box from "@mui/material/Box";
import Dialog from "@mui/material/Dialog";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import CloseIcon from "@mui/icons-material/Close";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import { useTranslation } from "react-i18next";

interface ItemPhotoProps {
  src: string | null;
  alt: string;
  size?: number;
  /** Fills 100% of the parent's width as a square instead of a fixed pixel size, so the photo is as large as the surrounding layout allows (e.g. Order Precheck's review cards, sized by a responsive grid) -- overrides `size`. */
  fluid?: boolean;
  /** Shown as a badge over the full-screen preview (not the thumbnail) so the count is visible while identifying the item. */
  quantity?: number;
}

/**
 * Large, consistently-sized item photo used everywhere a purchased item is
 * listed (Package detail, Receive Items, Match & Register, Receiving) --
 * items are visually identified by their photo first, so this is
 * deliberately much bigger than a typical row-icon/avatar. Clicking it opens
 * a full-screen preview, mirroring AttachmentsPanel.tsx's pattern.
 */
export function ItemPhoto({ src, alt, size = 120, fluid = false, quantity }: ItemPhotoProps) {
  const { t } = useTranslation("common");
  const [previewOpen, setPreviewOpen] = useState(false);

  return (
    <>
      <Box
        onClick={src ? () => setPreviewOpen(true) : undefined}
        sx={{
          ...(fluid ? { width: "100%", aspectRatio: "1" } : { width: size, height: size }),
          borderRadius: "12px",
          overflow: "hidden",
          bgcolor: "action.hover",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          cursor: src ? "pointer" : "default",
        }}
      >
        {src ? (
          <Box component="img" src={src} alt={alt} sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <Inventory2Icon color="disabled" sx={{ fontSize: fluid ? "40%" : size * 0.4 }} />
        )}
      </Box>

      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} maxWidth={false} fullScreen>
        <IconButton
          onClick={() => setPreviewOpen(false)}
          aria-label={t("actions.close")}
          sx={{ position: "absolute", top: 8, insetInlineEnd: 8, color: "common.white", bgcolor: "rgba(0,0,0,0.5)" }}
        >
          <CloseIcon />
        </IconButton>
        <Stack
          alignItems="center"
          justifyContent="center"
          sx={{ height: "100%", bgcolor: "rgba(0,0,0,0.9)", cursor: "zoom-out" }}
          onClick={() => setPreviewOpen(false)}
        >
          {src && (
            // `dvw`/`dvh` (dynamic viewport units), not `vw`/`vh`: on mobile browsers the static
            // `vh` unit is taller than the actually visible viewport (it ignores the address bar
            // chrome), which let the image size itself past what's really on screen and get
            // clipped. `dvh`/`dvw` track the real visible area as browser chrome shows/hides.
            <Box sx={{ position: "relative", maxWidth: "92dvw", maxHeight: "92dvh" }}>
              <Box
                component="img"
                src={src}
                alt={alt}
                sx={{ display: "block", maxWidth: "92dvw", maxHeight: "92dvh", objectFit: "contain" }}
                onClick={(e) => e.stopPropagation()}
              />
              {quantity !== undefined && (
                <Chip
                  label={t("itemPhoto.quantityBadge", { count: quantity })}
                  sx={{
                    position: "absolute",
                    bottom: 16,
                    insetInlineStart: 16,
                    bgcolor: "rgba(0,0,0,0.65)",
                    color: "common.white",
                    fontWeight: 700,
                    fontSize: "1rem",
                    height: 36,
                    px: 1,
                  }}
                />
              )}
            </Box>
          )}
        </Stack>
      </Dialog>
    </>
  );
}
