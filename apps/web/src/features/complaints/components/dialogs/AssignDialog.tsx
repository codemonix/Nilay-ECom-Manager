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
import { useAssignCaseMutation } from "../../api/casesApi";
import { useListUsersQuery } from "../../../users/api/usersApi";

interface AssignDialogProps {
  open: boolean;
  onClose: () => void;
  caseId: string;
  currentAssigneeId: string | null;
}

export function AssignDialog({ open, onClose, caseId, currentAssigneeId }: AssignDialogProps) {
  const { t } = useTranslation("complaints");
  const { data: users = [] } = useListUsersQuery();
  const [assignedTo, setAssignedTo] = useState<string>(currentAssigneeId ?? "");
  const [assignCase, { isLoading, error }] = useAssignCaseMutation();

  const handleSubmit = async () => {
    await assignCase({ caseId, assignedTo: assignedTo || null }).unwrap();
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t("detail.assignDialog.title")}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            select
            label={t("detail.assignDialog.staffMember")}
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            fullWidth
          >
            <MenuItem value="">{t("detail.unassigned")}</MenuItem>
            {users.map((user) => (
              <MenuItem key={user.id} value={user.id}>
                {user.name}
              </MenuItem>
            ))}
          </TextField>
          {error && <Alert severity="error">{t("state.error", { ns: "common" })}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("actions.cancel", { ns: "common" })}</Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={(assignedTo || null) === currentAssigneeId || isLoading}
        >
          {t("actions.save", { ns: "common" })}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
