import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";
import { useTranslation } from "react-i18next";
import { APP_VERSION } from "../config/appVersion";
import { Ltr } from "./Ltr";

/** Small "Version 1.0.14" caption for the login page and the account menu. */
export function AppVersion({ sx }: { sx?: SxProps<Theme> }) {
  const { t } = useTranslation("common");
  return (
    <Typography variant="caption" color="text.secondary" component="div" sx={sx}>
      {t("app.version")} <Ltr>{APP_VERSION.version}</Ltr>
    </Typography>
  );
}
