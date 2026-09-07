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
import { useChangePasswordMutation } from "../api/authApi";
import { getApiErrorMessage } from "../../../utils/apiError";

interface ChangePasswordDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ChangePasswordDialog({ open, onClose }: ChangePasswordDialogProps) {
  const { t } = useTranslation(["auth", "common", "validation"]);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changePassword, { isLoading, error, isSuccess, reset }] = useChangePasswordMutation();

  const handleClose = () => {
    setCurrentPassword("");
    setNewPassword("");
    reset();
    onClose();
  };

  const isValid = currentPassword.length > 0 && newPassword.length >= 8;

  const handleSubmit = async () => {
    if (!isValid) return;
    try {
      await changePassword({ currentPassword, newPassword }).unwrap();
      setCurrentPassword("");
      setNewPassword("");
    } catch {
      // surfaced via `error`
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t("auth:changePassword.title")}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <TextField
            label={t("auth:changePassword.current")}
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            fullWidth
            autoFocus
          />
          <TextField
            label={t("auth:changePassword.new")}
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            helperText={t("validation:minLength", { count: 8 })}
            fullWidth
          />
          {isSuccess && <Alert severity="success">{t("auth:changePassword.success")}</Alert>}
          {error && <Alert severity="error">{getApiErrorMessage(error) ?? t("auth:changePassword.error")}</Alert>}
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
