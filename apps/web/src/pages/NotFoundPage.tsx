import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import { Link as RouterLink } from "react-router-dom";
import { useTranslation } from "react-i18next";

export function NotFoundPage() {
  const { t } = useTranslation("common");
  return (
    <Stack spacing={2} alignItems="center" sx={{ py: 8 }}>
      <Typography variant="h1">404</Typography>
      <Typography color="text.secondary">{t("state.empty")}</Typography>
      <Button component={RouterLink} to="/cases" variant="contained">
        {t("actions.back")}
      </Button>
    </Stack>
  );
}
