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
import { CASE_PRIORITY_VALUES, type CasePriority } from "@complaint-system/shared";
import { useChangePriorityMutation } from "../../api/casesApi";

interface PriorityDialogProps {
  open: boolean;
  onClose: () => void;
  caseId: string;
  currentPriority: CasePriority;
}

export function PriorityDialog({ open, onClose, caseId, currentPriority }: PriorityDialogProps) {
  const { t } = useTranslation("complaints");
  const [priority, setPriority] = useState<CasePriority>(currentPriority);
  const [changePriority, { isLoading, error }] = useChangePriorityMutation();

  const handleSubmit = async () => {
    await changePriority({ caseId, priority }).unwrap();
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t("detail.priorityDialog.title")}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            select
            label={t("detail.priorityDialog.newPriority")}
            value={priority}
            onChange={(e) => setPriority(e.target.value as CasePriority)}
            fullWidth
          >
            {CASE_PRIORITY_VALUES.map((p) => (
              <MenuItem key={p} value={p}>
                {t(`priority.${p}`)}
              </MenuItem>
            ))}
          </TextField>
          {error && <Alert severity="error">{t("state.error", { ns: "common" })}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("actions.cancel", { ns: "common" })}</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={priority === currentPriority || isLoading}>
          {t("actions.save", { ns: "common" })}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
