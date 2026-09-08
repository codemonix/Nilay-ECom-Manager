import { useParams, Link as RouterLink } from "react-router-dom";
import Grid from "@mui/material/Grid2";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import Skeleton from "@mui/material/Skeleton";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import Paper from "@mui/material/Paper";
import { useTranslation } from "react-i18next";
import { useGetCaseEventsQuery, useGetCaseQuery } from "../api/casesApi";
import { CustomerSummaryBar } from "../components/CustomerSummaryBar";
import { CaseHeader } from "../components/CaseHeader";
import { CaseTimeline } from "../components/CaseTimeline";
import { CaseInfoPanel } from "../components/CaseInfoPanel";
import { AttachmentsPanel } from "../components/AttachmentsPanel";
import { Ltr } from "../../../components/Ltr";

export function CaseDetailPage() {
  const { caseId = "" } = useParams<{ caseId: string }>();
  const { t } = useTranslation(["complaints", "navigation"]);
  const { data: caseData, isLoading, isError } = useGetCaseQuery(caseId, { skip: !caseId });
  const { data: events, isLoading: isLoadingEvents } = useGetCaseEventsQuery(caseId, { skip: !caseId });

  if (isLoading) {
    return (
      <Stack spacing={2}>
        <Skeleton variant="rounded" height={72} />
        <Skeleton variant="rounded" height={120} />
        <Skeleton variant="rounded" height={400} />
      </Stack>
    );
  }

  if (isError || !caseData) {
    return <Alert severity="error">{t("detail.notFound")}</Alert>;
  }

  return (
    <Stack spacing={0}>
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link component={RouterLink} to="/cases" underline="hover" color="inherit">
          {t("navigation:breadcrumbs.cases")}
        </Link>
        <Typography color="text.primary">
          {t("navigation:breadcrumbs.caseDetailLabel")} <Ltr>{caseData.caseNumber}</Ltr>
        </Typography>
      </Breadcrumbs>

      <CustomerSummaryBar customer={caseData.customer} />
      <CaseHeader caseData={caseData} />

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: "16px" }}>
            <Typography variant="h3" sx={{ mb: 2 }}>
              {t("detail.sections.timeline")}
            </Typography>
            <CaseTimeline events={events} isLoading={isLoadingEvents} />
          </Paper>
          <AttachmentsPanel caseId={caseData.id} />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <CaseInfoPanel caseData={caseData} />
        </Grid>
      </Grid>
    </Stack>
  );
}
