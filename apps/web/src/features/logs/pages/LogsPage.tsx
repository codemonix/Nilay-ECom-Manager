import { useState, type SyntheticEvent } from "react";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import { useTranslation } from "react-i18next";
import { SystemLogsTable } from "../components/SystemLogsTable";
import { UserActivityLogsTable } from "../components/UserActivityLogsTable";
import { ShopfaTransactionLogsTable } from "../components/ShopfaTransactionLogsTable";

type LogTab = "activity" | "shopfa" | "system";

export function LogsPage() {
  const { t } = useTranslation("logs");
  const [tab, setTab] = useState<LogTab>("activity");

  const handleChange = (_event: SyntheticEvent, value: LogTab) => setTab(value);

  return (
    <Stack spacing={2.5}>
      <Typography variant="h1">{t("title")}</Typography>
      <Typography variant="body2" color="text.secondary">
        {t("description")}
      </Typography>

      <Tabs value={tab} onChange={handleChange} sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Tab value="activity" label={t("tabs.activity")} />
        <Tab value="shopfa" label={t("tabs.shopfa")} />
        <Tab value="system" label={t("tabs.system")} />
      </Tabs>

      {tab === "activity" && <UserActivityLogsTable />}
      {tab === "shopfa" && <ShopfaTransactionLogsTable />}
      {tab === "system" && <SystemLogsTable />}
    </Stack>
  );
}
