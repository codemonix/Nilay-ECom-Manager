import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { DataSourceCard } from "../components/DataSourceCard";
import { ImportOrdersCard } from "../components/ImportOrdersCard";
import { ImportedOrdersTable } from "../components/ImportedOrdersTable";
import { BackupRestoreCard } from "../components/BackupRestoreCard";
import { LogLevelCard } from "../components/LogLevelCard";
import { LogSizesCard } from "../components/LogSizesCard";
import { SessionSettingsCard } from "../components/SessionSettingsCard";
import { UploadSettingsCard } from "../components/UploadSettingsCard";
import { useAppSelector } from "../../../app/hooks";
import { StaffRole } from "@complaint-system/shared";

export function SettingsPage() {
  const { t } = useTranslation("settings");
  const isAdmin = useAppSelector((state) => state.auth.user?.role === StaffRole.ADMIN);

  return (
    <Stack spacing={2.5}>
      <Typography variant="h1">{t("title")}</Typography>
      <DataSourceCard />
      <ImportOrdersCard />
      {isAdmin && <SessionSettingsCard />}
      <UploadSettingsCard />
      <LogLevelCard />
      <LogSizesCard />
      <BackupRestoreCard />
      <ImportedOrdersTable />
    </Stack>
  );
}
