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
import { useTheme, type Theme } from "@mui/material/styles";
import { useTranslation } from "react-i18next";
import type { PackageDTO } from "../types";
import { PackageStatusChip } from "../../../components/PackageStatusChip";
import { EmptyState } from "../../../components/EmptyState";
import { Ltr } from "../../../components/Ltr";
import { formatDateTime, formatRelativeTime } from "../../../utils/localeFormat";
import { useActiveLanguage } from "../../../i18n/useActiveLanguage";

interface PackageTableProps {
  packages: PackageDTO[];
  isLoading: boolean;
}

function packageStats(pkg: PackageDTO) {
  const itemCount = pkg.items.length;
  const matchedCount = pkg.items.filter((item) => item.matchedAt).length;
  return {
    itemCount,
    totalQuantity: pkg.items.reduce((sum, item) => sum + item.quantity, 0),
    matchedCount,
    isFullyMatched: itemCount > 0 && matchedCount === itemCount,
  };
}

/**
 * A subtle red tint flags a package that isn't fully matched yet -- kept
 * faint so row text and the status chip stay easy to read. `!important` is
 * required here: createAppTheme.ts's MuiTableBody override paints its own
 * zebra stripe on every odd row (`& tr:nth-of-type(odd)`), a descendant
 * selector with higher specificity than a plain sx background, so without
 * it the red tint would only "win" on even rows -- same reason that
 * theme's own row-hover override already uses `!important`.
 */
function incompleteRowBackground(theme: Theme): string {
  const color = theme.palette.mode === "dark" ? "rgba(239, 68, 68, 0.14)" : "rgba(239, 68, 68, 0.08)";
  return `${color} !important`;
}

export function PackageTable({ packages, isLoading }: PackageTableProps) {
  const { t } = useTranslation("purchasing");
  const language = useActiveLanguage();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  if (isLoading) {
    return (
      <Stack spacing={1}>
        {[1, 2, 3, 4, 5].map((key) => (
          <Skeleton key={key} variant="rounded" height={48} />
        ))}
      </Stack>
    );
  }

  if (packages.length === 0) {
    return <EmptyState message={t("packages.list.empty")} />;
  }

  if (isMobile) {
    return (
      <Stack spacing={1.5}>
        {packages.map((p) => {
          const stats = packageStats(p);
          return (
            <Card
              key={p.id}
              variant="outlined"
              sx={{
                borderRadius: "14px",
                overflow: "hidden",
                backgroundColor: stats.isFullyMatched ? undefined : (theme) => incompleteRowBackground(theme),
              }}
            >
              <CardActionArea onClick={() => navigate(`/purchasing/packages/${p.id}`)} sx={{ p: 0.5 }}>
                <CardContent sx={{ display: "flex", alignItems: "center", gap: 1, py: 1.5, px: 1.5 }}>
                  <Stack spacing={0.75} sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ gap: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        <Ltr>{p.packageNumber}</Ltr>
                      </Typography>
                      <PackageStatusChip status={p.status} />
                    </Stack>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      {p.supplierName || t("packages.list.noSupplier")}
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                      <Typography variant="body2" color="text.secondary">
                        {t("packages.list.itemCount", { count: stats.itemCount })}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        · {t("packages.list.columns.totalQuantity")}: {stats.totalQuantity}
                      </Typography>
                    </Stack>
                    <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                      <Typography variant="caption" color="text.secondary">
                        {t("packages.list.columns.matched")}:{" "}
                        <Typography component="span" variant="caption" color="success.main" sx={{ fontWeight: 700 }}>
                          {stats.matchedCount}
                        </Typography>
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
          );
        })}
      </Stack>
    );
  }

  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>{t("packages.list.columns.packageNumber")}</TableCell>
            <TableCell>{t("packages.list.columns.supplier")}</TableCell>
            <TableCell>{t("packages.list.columns.items")}</TableCell>
            <TableCell>{t("packages.list.columns.totalQuantity")}</TableCell>
            <TableCell>{t("packages.list.columns.matched")}</TableCell>
            <TableCell>{t("packages.list.columns.status")}</TableCell>
            <TableCell>{t("packages.list.columns.lastActivity")}</TableCell>
            <TableCell>{t("packages.list.columns.created")}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {packages.map((p) => {
            const stats = packageStats(p);
            return (
              <TableRow
                key={p.id}
                hover
                onClick={() => navigate(`/purchasing/packages/${p.id}`)}
                sx={{
                  cursor: "pointer",
                  backgroundColor: stats.isFullyMatched ? undefined : (theme) => incompleteRowBackground(theme),
                }}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter") navigate(`/purchasing/packages/${p.id}`);
                }}
              >
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    <Ltr>{p.packageNumber}</Ltr>
                  </Typography>
                </TableCell>
                <TableCell>{p.supplierName || t("packages.list.noSupplier")}</TableCell>
                <TableCell>{stats.itemCount}</TableCell>
                <TableCell>{stats.totalQuantity}</TableCell>
                <TableCell>
                  <Typography variant="body2" color="success.main" sx={{ fontWeight: 700 }}>
                    {stats.matchedCount}
                  </Typography>
                </TableCell>
                <TableCell>
                  <PackageStatusChip status={p.status} />
                </TableCell>
                <TableCell>{formatRelativeTime(p.lastActivityAt, language)}</TableCell>
                <TableCell>{formatDateTime(p.createdAt, language)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
