import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { DataSourceCard } from "../components/DataSourceCard";
import { ImportOrdersCard } from "../components/ImportOrdersCard";
import { ImportedOrdersTable } from "../components/ImportedOrdersTable";
import { BackupRestoreCard } from "../components/BackupRestoreCard";
import { LogLevelCard } from "../components/LogLevelCard";

export function SettingsPage() {
  const { t } = useTranslation("settings");

  return (
    <Stack spacing={2.5}>
      <Typography variant="h1">{t("title")}</Typography>
      <DataSourceCard />
      <ImportOrdersCard />
      <LogLevelCard />
      <BackupRestoreCard />
      <ImportedOrdersTable />
    </Stack>
  );
}
