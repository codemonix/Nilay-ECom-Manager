import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import { BOTTOM_NAV_HEIGHT, DRAWER_WIDTH } from "../layouts/layoutMetrics";

const CLEARANCE_PX = 112;

/**
 * Action buttons (Previous / primary action / Next) pinned to one fixed spot
 * on the screen -- just above MainLayout's bottom navigation on mobile, at
 * the bottom of the content area beside the side drawer on desktop. Unlike a
 * sticky or in-flow bar, its position never depends on how tall the current
 * order's content is, so staff can keep a thumb/cursor on the same button
 * while paging through many orders. Includes an in-flow spacer so the last
 * content isn't hidden behind the bar.
 */
export function FixedActionBar({ children }: { children: ReactNode }) {
  return (
    <>
      <Box aria-hidden sx={{ height: CLEARANCE_PX, flexShrink: 0 }} />
      <Box
        sx={{
          position: "fixed",
          insetInlineStart: { xs: 0, md: `${DRAWER_WIDTH}px` },
          insetInlineEnd: 0,
          bottom: { xs: `calc(${BOTTOM_NAV_HEIGHT}px + env(safe-area-inset-bottom))`, md: 0 },
          zIndex: 1050,
          display: "flex",
          justifyContent: "center",
          px: 1.5,
          pb: { xs: 1, md: 2 },
          pointerEvents: "none",
        }}
      >
        <Paper
          elevation={6}
          sx={{
            pointerEvents: "auto",
            width: "100%",
            maxWidth: 640,
            p: 1.5,
            borderRadius: "14px",
            display: "flex",
            gap: 1.5,
          }}
        >
          {children}
        </Paper>
      </Box>
    </>
  );
}
