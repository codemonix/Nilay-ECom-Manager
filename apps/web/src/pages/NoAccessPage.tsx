import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAppSelector } from "../app/hooks";
import { getFirstAccessiblePath } from "../config/navItems";

export function NoAccessPage() {
  const { t } = useTranslation("navigation");
  const user = useAppSelector((state) => state.auth.user);
  // "No access to any section" is only true when there is no page at all to
  // send them to; otherwise this is just a page they lack.
  const homePath = getFirstAccessiblePath(user);
  return (
    <Stack spacing={1} alignItems="center" sx={{ py: 8 }}>
      <Typography variant="h1">{t("noAccess.title")}</Typography>
      <Typography color="text.secondary">
        {homePath ? t("noAccess.pageDescription") : t("noAccess.description")}
      </Typography>
      {homePath && (
        <Button component={Link} to={homePath} variant="contained" sx={{ mt: 2 }}>
          {t("noAccess.goHome")}
        </Button>
      )}
    </Stack>
  );
}
