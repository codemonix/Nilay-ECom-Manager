import { useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Alert from "@mui/material/Alert";
import { useTranslation } from "react-i18next";
import { CASE_STATUS_TRANSITIONS, type CaseStatus } from "@complaint-system/shared";
import { useChangeStatusMutation } from "../../api/casesApi";

interface StatusDialogProps {
  open: boolean;
  onClose: () => void;
  caseId: string;
  currentStatus: CaseStatus;
}

export function StatusDialog({ open, onClose, caseId, currentStatus }: StatusDialogProps) {
  const { t } = useTranslation("complaints");
  const [status, setStatus] = useState<CaseStatus | "">("");
  const [reason, setReason] = useState("");
  const [changeStatus, { isLoading, error }] = useChangeStatusMutation();

  const allowedStatuses = CASE_STATUS_TRANSITIONS[currentStatus] ?? [];

  const handleClose = () => {
    setStatus("");
    setReason("");
    onClose();
  };

  const handleSubmit = async () => {
    if (!status) return;
    await changeStatus({ caseId, status, reason: reason || undefined }).unwrap();
    handleClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t("detail.statusDialog.title")}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {allowedStatuses.length === 0 && (
            <Alert severity="info">{t("detail.statusDialog.noValidTransitions")}</Alert>
          )}
          <TextField
            select
            label={t("detail.statusDialog.newStatus")}
            value={status}
            onChange={(e) => setStatus(e.target.value as CaseStatus)}
            disabled={allowedStatuses.length === 0}
            fullWidth
          >
            {allowedStatuses.map((s) => (
              <MenuItem key={s} value={s}>
                {t(`status.${s}`)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label={t("detail.statusDialog.reason")}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            multiline
            minRows={2}
            fullWidth
          />
          {error && <Alert severity="error">{t("state.error", { ns: "common" })}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>{t("actions.cancel", { ns: "common" })}</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={!status || isLoading}>
          {t("actions.save", { ns: "common" })}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
