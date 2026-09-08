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
import type { CaseDTO } from "../types";
import { StatusChip } from "../../../components/StatusChip";
import { PriorityChip } from "../../../components/PriorityChip";
import { EmptyState } from "../../../components/EmptyState";
import { Ltr } from "../../../components/Ltr";
import { formatDateTime, formatRelativeTime } from "../../../utils/localeFormat";
import { useActiveLanguage } from "../../../i18n/useActiveLanguage";

interface CaseTableProps {
  cases: CaseDTO[];
  isLoading: boolean;
}

export function CaseTable({ cases, isLoading }: CaseTableProps) {
  const { t } = useTranslation("complaints");
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

  if (cases.length === 0) {
    return <EmptyState message={t("list.empty")} />;
  }

  if (isMobile) {
    return (
      <Stack spacing={1.5}>
        {cases.map((c) => (
          <Card
            key={c.id}
            variant="outlined"
            sx={{
              borderRadius: "14px",
              overflow: "hidden",
              borderLeft: 4,
              borderLeftColor: "primary.main",
              background: (theme) =>
                theme.palette.mode === "dark"
                  ? "linear-gradient(135deg, rgba(79, 70, 229, 0.12), rgba(17, 24, 39, 0.94))"
                  : "linear-gradient(135deg, rgba(79, 70, 229, 0.05), rgba(255,255,255,0.94))",
            }}
          >
            <CardActionArea onClick={() => navigate(`/cases/${c.id}`)} sx={{ p: 0.5 }}>
              <CardContent sx={{ display: "flex", alignItems: "center", gap: 1, py: 1.5, px: 1.5 }}>
                <Stack spacing={0.75} sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ gap: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      <Ltr>{c.caseNumber}</Ltr>
                    </Typography>
                    <StatusChip status={c.status} />
                  </Stack>
                  <Typography variant="subtitle1" sx={{ wordBreak: "break-word", fontWeight: 700 }}>
                    {c.subject}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" noWrap>
                    {c.customer.name}
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                    <PriorityChip priority={c.priority} />
                    <Typography variant="caption" color="text.secondary">
                      {formatRelativeTime(c.lastActivityAt, language)}
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
            <TableCell>{t("list.columns.caseNumber")}</TableCell>
            <TableCell>{t("list.columns.customer")}</TableCell>
            <TableCell>{t("list.columns.subject")}</TableCell>
            <TableCell>{t("list.columns.category")}</TableCell>
            <TableCell>{t("list.columns.priority")}</TableCell>
            <TableCell>{t("list.columns.status")}</TableCell>
            <TableCell>{t("list.columns.assignedTo")}</TableCell>
            <TableCell>{t("list.columns.lastActivity")}</TableCell>
            <TableCell>{t("list.columns.created")}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {cases.map((c) => (
            <TableRow
              key={c.id}
              hover
              onClick={() => navigate(`/cases/${c.id}`)}
              sx={{ cursor: "pointer" }}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter") navigate(`/cases/${c.id}`);
              }}
            >
              <TableCell>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  <Ltr>{c.caseNumber}</Ltr>
                </Typography>
              </TableCell>
              <TableCell>{c.customer.name}</TableCell>
              <TableCell sx={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {c.subject}
              </TableCell>
              <TableCell>{t(`category.${c.category}`)}</TableCell>
              <TableCell>
                <PriorityChip priority={c.priority} />
              </TableCell>
              <TableCell>
                <StatusChip status={c.status} />
              </TableCell>
              <TableCell>{c.assignedTo?.name ?? t("list.unassigned")}</TableCell>
              <TableCell>{formatRelativeTime(c.lastActivityAt, language)}</TableCell>
              <TableCell>{formatDateTime(c.createdAt, language)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
