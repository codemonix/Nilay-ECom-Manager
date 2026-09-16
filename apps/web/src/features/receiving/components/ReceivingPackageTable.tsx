import { useNavigate } from "react-router-dom";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableBody from "@mui/material/TableBody";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Skeleton from "@mui/material/Skeleton";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import { useTranslation } from "react-i18next";
import type { PackageDTO } from "../types";
import { PackageStatusChip } from "../../../components/PackageStatusChip";
import { EmptyState } from "../../../components/EmptyState";
import { Ltr } from "../../../components/Ltr";
import { formatRelativeTime } from "../../../utils/localeFormat";
import { useActiveLanguage } from "../../../i18n/useActiveLanguage";

interface ReceivingPackageTableProps {
  packages: PackageDTO[];
  isLoading: boolean;
}

export function ReceivingPackageTable({ packages, isLoading }: ReceivingPackageTableProps) {
  const { t } = useTranslation("receiving");
  const language = useActiveLanguage();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  if (isLoading) {
    return (
      <Stack spacing={1}>
        {[1, 2, 3].map((key) => (
          <Skeleton key={key} variant="rounded" height={48} />
        ))}
      </Stack>
    );
  }

  if (packages.length === 0) {
    return <EmptyState message={t("list.empty")} />;
  }

  if (isMobile) {
    return (
      <Stack spacing={1.5}>
        {packages.map((p) => (
          <Card key={p.id} variant="outlined" sx={{ borderRadius: "14px", overflow: "hidden" }}>
            <CardActionArea onClick={() => navigate(`/receiving/${p.id}`)} sx={{ p: 0.5 }}>
              <CardContent sx={{ display: "flex", alignItems: "center", gap: 1, py: 1.5, px: 1.5 }}>
                <Stack spacing={0.75} sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ gap: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      <Ltr>{p.packageNumber}</Ltr>
                    </Typography>
                    <PackageStatusChip status={p.status} />
                  </Stack>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    {p.supplierName || t("list.noSupplier")}
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">
                      {t("list.itemCount", { count: p.items.length })}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatRelativeTime(p.lastActivityAt, language)}
                    </Typography>
                  </Stack>
                </Stack>
                <ChevronRightIcon color="disabled" />
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
      </Stack>
    );
  }

  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>{t("list.columns.packageNumber")}</TableCell>
            <TableCell>{t("list.columns.supplier")}</TableCell>
            <TableCell>{t("list.columns.items")}</TableCell>
            <TableCell>{t("list.columns.status")}</TableCell>
            <TableCell>{t("list.columns.lastActivity")}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {packages.map((p) => (
            <TableRow
              key={p.id}
              hover
              onClick={() => navigate(`/receiving/${p.id}`)}
              sx={{ cursor: "pointer" }}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter") navigate(`/receiving/${p.id}`);
              }}
            >
              <TableCell>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  <Ltr>{p.packageNumber}</Ltr>
                </Typography>
              </TableCell>
              <TableCell>{p.supplierName || t("list.noSupplier")}</TableCell>
              <TableCell>{p.items.length}</TableCell>
              <TableCell>
                <PackageStatusChip status={p.status} />
              </TableCell>
              <TableCell>{formatRelativeTime(p.lastActivityAt, language)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
