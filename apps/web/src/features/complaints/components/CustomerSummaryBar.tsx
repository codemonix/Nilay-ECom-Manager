import Paper from "@mui/material/Paper";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Avatar from "@mui/material/Avatar";
import Skeleton from "@mui/material/Skeleton";
import Divider from "@mui/material/Divider";
import PersonIcon from "@mui/icons-material/Person";
import { useTranslation } from "react-i18next";
import { useGetCustomerSummaryQuery } from "../../customers/api/customersApi";
import { formatCurrency, formatDate, formatNumber } from "../../../utils/localeFormat";
import { useActiveLanguage } from "../../../i18n/useActiveLanguage";
import { Ltr } from "../../../components/Ltr";
import type { CaseDTO } from "../types";

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <Stack spacing={0} sx={{ minWidth: 110 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="subtitle1">{value}</Typography>
    </Stack>
  );
}

export function CustomerSummaryBar({ customer }: { customer: CaseDTO["customer"] }) {
  const { t } = useTranslation("complaints");
  const language = useActiveLanguage();
  const { data, isLoading, isError } = useGetCustomerSummaryQuery({
    externalCustomerId: customer.externalCustomerId,
    phone: customer.phone,
  });

  return (
    <Paper
      variant="outlined"
      sx={{
        p: { xs: 1.5, sm: 2 },
        mb: 2,
        borderRadius: "16px",
        background: (theme) =>
          theme.palette.mode === "dark"
            ? "linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(17, 24, 39, 0.96))"
            : "linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(255,255,255,0.96))",
      }}
    >
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ xs: "stretch", sm: "center" }}>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: { sm: 200 } }}>
          <Avatar sx={{ bgcolor: "primary.main", width: 42, height: 42 }}>
            <PersonIcon />
          </Avatar>
          <Stack spacing={0} sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" noWrap>
              {customer.name}
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              <Ltr>{customer.phone}</Ltr>
              {customer.email ? (
                <>
                  {" · "}
                  <Ltr>{customer.email}</Ltr>
                </>
              ) : null}
            </Typography>
          </Stack>
        </Stack>

        <Divider sx={{ display: { xs: "block", sm: "none" } }} />
        <Divider orientation="vertical" flexItem sx={{ display: { xs: "none", sm: "block" } }} />

        {isLoading && (
          <Stack direction="row" spacing={3}>
            <Skeleton variant="text" width={90} />
            <Skeleton variant="text" width={90} />
            <Skeleton variant="text" width={90} />
          </Stack>
        )}

        {isError && (
          <Typography variant="body2" color="text.secondary">
            {t("detail.customerSummary.unavailable")}
          </Typography>
        )}

        {data && (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(4, auto)" },
              gap: { xs: 1.5, sm: 3 },
            }}
          >
            <StatBlock label={t("detail.customerSummary.orders")} value={formatNumber(data.ordersCount, language)} />
            <StatBlock
              label={t("detail.customerSummary.totalSpent")}
              value={formatCurrency(data.totalSpent, language, data.currency)}
            />
            <StatBlock
              label={t("detail.customerSummary.averageOrderValue")}
              value={formatCurrency(data.averageOrderValue, language, data.currency)}
            />
            <StatBlock
              label={t("detail.customerSummary.lastOrder")}
              value={data.lastOrderDate ? formatDate(data.lastOrderDate, language) : "—"}
            />
          </Box>
        )}
      </Stack>
    </Paper>
  );
}
