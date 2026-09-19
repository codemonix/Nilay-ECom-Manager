import { useEffect, useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import FormGroup from "@mui/material/FormGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import { useTranslation } from "react-i18next";
import { ASSIGNABLE_MENU_KEY_VALUES, StaffRole, type UserDTO } from "@complaint-system/shared";
import { useUpdateUserMutation } from "../api/usersApi";
import { getApiErrorMessage } from "../../../utils/apiError";

interface EditPermissionsDialogProps {
  user: UserDTO | null;
  onClose: () => void;
}

export function EditPermissionsDialog({ user, onClose }: EditPermissionsDialogProps) {
  const { t } = useTranslation(["users", "navigation", "common"]);
  const [selected, setSelected] = useState<string[]>([]);
  const [updateUser, { isLoading, error }] = useUpdateUserMutation();
  const isAdmin = user?.role === StaffRole.ADMIN;

  useEffect(() => {
    if (user) setSelected(user.permissions);
  }, [user]);

  const togglePermission = (key: string) =>
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const handleClose = () => {
    if (!isLoading) onClose();
  };

  const handleSave = async () => {
    if (!user) return;
    try {
      await updateUser({ id: user.id, permissions: selected }).unwrap();
      onClose();
    } catch {
      // surfaced via `error`
    }
  };

  return (
    <Dialog open={Boolean(user)} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>{user ? t("users:permissions.title", { name: user.name }) : ""}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ mt: 1 }}>
          {isAdmin ? (
            <Alert severity="info">{t("users:permissions.adminNotice")}</Alert>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary">
                {t("users:permissions.helper")}
              </Typography>
              <FormGroup>
                {ASSIGNABLE_MENU_KEY_VALUES.map((key) => (
                  <FormControlLabel
                    key={key}
                    control={<Checkbox checked={selected.includes(key)} onChange={() => togglePermission(key)} />}
                    label={t(`navigation:modules.${key}`)}
                  />
                ))}
              </FormGroup>
            </>
          )}

          {error && <Alert severity="error">{getApiErrorMessage(error) ?? t("users:permissions.error")}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isLoading}>
          {t("common:actions.cancel")}
        </Button>
        {!isAdmin && (
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={isLoading}
            startIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {t("common:actions.save")}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
