import Box from "@mui/material/Box";
import type { ReactNode } from "react";

/**
 * Wraps identifiers (phone numbers, case/order numbers, SKUs, emails) so
 * they render in a forced LTR embedding with bidi isolation. Without this,
 * a string like "+98 912 000 1122" gets visually reordered by the
 * browser's bidi algorithm when it sits inside RTL page text (Persian),
 * even though the underlying stored value is untouched -- see
 * docs/internationalization.md.
 */
export function Ltr({ children }: { children: ReactNode }) {
  return (
    <Box component="span" dir="ltr" sx={{ unicodeBidi: "isolate", display: "inline-block" }}>
      {children}
    </Box>
  );
}
