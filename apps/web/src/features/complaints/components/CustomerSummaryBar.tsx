import Paper from "@mui/material/Paper";
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
  const { data, isLoading, isError } = useGetCustomerSummaryQuery(customer.externalCustomerId);

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
      <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 200 }}>
          <Avatar sx={{ bgcolor: "primary.main" }}>
            <PersonIcon />
          </Avatar>
          <Stack spacing={0}>
            <Typography variant="subtitle1">{customer.name}</Typography>
            <Typography variant="body2" color="text.secondary">
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
          <Stack direction="row" spacing={3} flexWrap="wrap" useFlexGap>
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
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}
