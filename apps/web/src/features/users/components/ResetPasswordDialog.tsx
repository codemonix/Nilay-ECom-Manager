import { useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import { useTranslation } from "react-i18next";
import type { UserDTO } from "@complaint-system/shared";
import { useResetUserPasswordMutation } from "../api/usersApi";
import { getApiErrorMessage } from "../../../utils/apiError";

interface ResetPasswordDialogProps {
  user: UserDTO | null;
  onClose: () => void;
}

export function ResetPasswordDialog({ user, onClose }: ResetPasswordDialogProps) {
  const { t } = useTranslation(["users", "common", "validation"]);
  const [newPassword, setNewPassword] = useState("");
  const [resetPassword, { isLoading, error, isSuccess, reset }] = useResetUserPasswordMutation();

  const handleClose = () => {
    setNewPassword("");
    reset();
    onClose();
  };

  const isValid = newPassword.length >= 8;

  const handleSubmit = async () => {
    if (!user || !isValid) return;
    try {
      await resetPassword({ id: user.id, newPassword }).unwrap();
      setNewPassword("");
    } catch {
      // surfaced via `error`
    }
  };

  return (
    <Dialog open={Boolean(user)} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t("users:resetPassword.title", { name: user?.name })}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <TextField
            label={t("users:resetPassword.newPassword")}
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            helperText={t("validation:minLength", { count: 8 })}
            autoComplete="new-password"
            fullWidth
            autoFocus
          />
          {isSuccess && <Alert severity="success">{t("users:resetPassword.success")}</Alert>}
          {error && <Alert severity="error">{getApiErrorMessage(error) ?? t("users:resetPassword.error")}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isLoading}>
          {t("common:actions.close")}
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={isLoading || !isValid}
          startIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {t("common:actions.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
