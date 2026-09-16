import { useMemo, type SyntheticEvent } from "react";
import { useSearchParams } from "react-router-dom";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import { useTranslation } from "react-i18next";
import { PackageStatus } from "@complaint-system/shared";
import { useListReceivingPackagesQuery } from "../api/receivingApi";
import { ReceivingPackageTable } from "../components/ReceivingPackageTable";

type TabValue = typeof PackageStatus.IN_PROGRESS | typeof PackageStatus.COMPLETED;

export function ReceivingListPage() {
  const { t } = useTranslation("receiving");
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = useMemo<TabValue>(() => {
    const status = searchParams.get("status");
    return status === PackageStatus.COMPLETED ? PackageStatus.COMPLETED : PackageStatus.IN_PROGRESS;
  }, [searchParams]);

  const { data, isFetching } = useListReceivingPackagesQuery({ status: tab, page: 1, pageSize: 50 });

  const handleChange = (_event: SyntheticEvent, value: TabValue) => {
    const next = new URLSearchParams(searchParams);
    next.set("status", value);
    setSearchParams(next);
  };

  return (
    <Stack spacing={2}>
      <Typography variant="h1">{t("title")}</Typography>
      <Typography variant="body2" color="text.secondary">
        {t("description")}
      </Typography>

      <Tabs value={tab} onChange={handleChange} sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Tab value={PackageStatus.IN_PROGRESS} label={t("tabs.awaitingReceipt")} />
        <Tab value={PackageStatus.COMPLETED} label={t("tabs.received")} />
      </Tabs>

      <ReceivingPackageTable packages={data?.items ?? []} isLoading={isFetching && !data} />
    </Stack>
  );
}
