import { useState } from "react";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import ButtonGroup from "@mui/material/ButtonGroup";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ReplayIcon from "@mui/icons-material/Replay";
import LockIcon from "@mui/icons-material/Lock";
import NoteAddIcon from "@mui/icons-material/NoteAdd";
import ChatIcon from "@mui/icons-material/Chat";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import EditIcon from "@mui/icons-material/Edit";
import FlagIcon from "@mui/icons-material/Flag";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import { useTranslation } from "react-i18next";
import { CASE_STATUS_TRANSITIONS, CaseStatus } from "@complaint-system/shared";
import type { CaseDTO } from "../types";
import { StatusChip } from "../../../components/StatusChip";
import { PriorityChip } from "../../../components/PriorityChip";
import { useChangeStatusMutation } from "../api/casesApi";
import { Ltr } from "../../../components/Ltr";
import { StatusDialog } from "./dialogs/StatusDialog";
import { PriorityDialog } from "./dialogs/PriorityDialog";
import { AssignDialog } from "./dialogs/AssignDialog";
import { NoteDialog } from "./dialogs/NoteDialog";

type DialogKind = "status" | "priority" | "assign" | "internalNote" | "customerNote" | null;

export function CaseHeader({ caseData }: { caseData: CaseDTO }) {
  const { t } = useTranslation("complaints");
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [openDialog, setOpenDialog] = useState<DialogKind>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [changeStatus, { isLoading: isTransitioning }] = useChangeStatusMutation();

  const allowedNext = CASE_STATUS_TRANSITIONS[caseData.status] ?? [];
  const canResolve = allowedNext.includes(CaseStatus.RESOLVED);
  const canClose = allowedNext.includes(CaseStatus.CLOSED);
  const canReopen =
    allowedNext.includes(CaseStatus.OPEN) &&
    (caseData.status === CaseStatus.RESOLVED || caseData.status === CaseStatus.CLOSED);

  const quickTransition = (status: CaseStatus) => changeStatus({ caseId: caseData.id, status });

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2}>
        <Stack spacing={0.5} sx={{ minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary">
            <Ltr>{caseData.caseNumber}</Ltr>
          </Typography>
          <Typography variant="h2" component="h1" sx={{ wordBreak: "break-word" }}>
            {caseData.subject}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
            <StatusChip status={caseData.status} />
            <PriorityChip priority={caseData.priority} />
          </Stack>
        </Stack>

        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          flexWrap="wrap"
          useFlexGap
          justifyContent={{ xs: "space-between", md: "flex-end" }}
        >
          <ButtonGroup
            size={isMobile ? "medium" : "small"}
            variant="contained"
            sx={isMobile ? { flexGrow: 1, "& .MuiButton-root": { flex: 1 } } : undefined}
          >
            {canResolve && (
              <Button
                color="success"
                startIcon={<CheckCircleIcon />}
                disabled={isTransitioning}
                onClick={() => quickTransition(CaseStatus.RESOLVED)}
              >
                {t("detail.actions.resolve")}
              </Button>
            )}
            {canReopen && (
              <Button
                color="warning"
                startIcon={<ReplayIcon />}
                disabled={isTransitioning}
                onClick={() => quickTransition(CaseStatus.OPEN)}
              >
                {t("detail.actions.reopen")}
              </Button>
            )}
            {canClose && (
              <Button
                color="inherit"
                startIcon={<LockIcon />}
                disabled={isTransitioning}
                onClick={() => quickTransition(CaseStatus.CLOSED)}
              >
                {t("detail.actions.close")}
              </Button>
            )}
          </ButtonGroup>

          {isMobile ? (
            <>
              <IconButton
                aria-label={t("detail.actions.moreActions")}
                onClick={(e) => setMenuAnchor(e.currentTarget)}
                sx={{ border: 1, borderColor: "divider" }}
              >
                <MoreVertIcon />
              </IconButton>
              <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
                <MenuItem
                  onClick={() => {
                    setOpenDialog("status");
                    setMenuAnchor(null);
                  }}
                >
                  <ListItemIcon>
                    <EditIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>{t("detail.actions.changeStatus")}</ListItemText>
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    setOpenDialog("priority");
                    setMenuAnchor(null);
                  }}
                >
                  <ListItemIcon>
                    <FlagIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>{t("detail.actions.changePriority")}</ListItemText>
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    setOpenDialog("assign");
                    setMenuAnchor(null);
                  }}
                >
                  <ListItemIcon>
                    <PersonAddIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>{t("detail.actions.assignStaff")}</ListItemText>
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    setOpenDialog("internalNote");
                    setMenuAnchor(null);
                  }}
                >
                  <ListItemIcon>
                    <NoteAddIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>{t("detail.actions.addInternalNote")}</ListItemText>
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    setOpenDialog("customerNote");
                    setMenuAnchor(null);
                  }}
                >
                  <ListItemIcon>
                    <ChatIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>{t("detail.actions.addCustomerNote")}</ListItemText>
                </MenuItem>
              </Menu>
            </>
          ) : (
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap justifyContent="flex-end">
              <Button size="small" variant="outlined" onClick={() => setOpenDialog("status")}>
                {t("detail.actions.changeStatus")}
              </Button>
              <Button size="small" variant="outlined" onClick={() => setOpenDialog("priority")}>
                {t("detail.actions.changePriority")}
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<PersonAddIcon />}
                onClick={() => setOpenDialog("assign")}
              >
                {t("detail.actions.assignStaff")}
              </Button>
              <Button size="small" startIcon={<NoteAddIcon />} onClick={() => setOpenDialog("internalNote")}>
                {t("detail.actions.addInternalNote")}
              </Button>
              <Button size="small" startIcon={<ChatIcon />} onClick={() => setOpenDialog("customerNote")}>
                {t("detail.actions.addCustomerNote")}
              </Button>
            </Stack>
          )}
        </Stack>
      </Stack>

      <StatusDialog
        open={openDialog === "status"}
        onClose={() => setOpenDialog(null)}
        caseId={caseData.id}
        currentStatus={caseData.status}
      />
      <PriorityDialog
        open={openDialog === "priority"}
        onClose={() => setOpenDialog(null)}
        caseId={caseData.id}
        currentPriority={caseData.priority}
      />
      <AssignDialog
        open={openDialog === "assign"}
        onClose={() => setOpenDialog(null)}
        caseId={caseData.id}
        currentAssigneeId={caseData.assignedTo?.id ?? null}
      />
      <NoteDialog
        open={openDialog === "internalNote"}
        onClose={() => setOpenDialog(null)}
        caseId={caseData.id}
        visibility="internal"
      />
      <NoteDialog
        open={openDialog === "customerNote"}
        onClose={() => setOpenDialog(null)}
        caseId={caseData.id}
        visibility="customer"
      />
    </Paper>
  );
}
