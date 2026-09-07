import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";

export function NoAccessPage() {
  const { t } = useTranslation("navigation");
  return (
    <Stack spacing={1} alignItems="center" sx={{ py: 8 }}>
      <Typography variant="h1">{t("noAccess.title")}</Typography>
      <Typography color="text.secondary">{t("noAccess.description")}</Typography>
    </Stack>
  );
}
