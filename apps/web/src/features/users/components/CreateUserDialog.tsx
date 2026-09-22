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
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import {
  DEFAULT_PERMISSIONS_BY_ROLE,
  STAFF_ROLE_VALUES,
  StaffRole,
} from "@complaint-system/shared";
import { PermissionsChecklist } from "./PermissionsChecklist";
import { useCreateUserMutation } from "../api/usersApi";
import { getApiErrorMessage } from "../../../utils/apiError";

interface CreateUserDialogProps {
  open: boolean;
  onClose: () => void;
}

const INITIAL_ROLE = StaffRole.CUSTOMER_SERVICE as string;
const INITIAL_FORM = {
  name: "",
  email: "",
  password: "",
  role: INITIAL_ROLE,
  permissions: DEFAULT_PERMISSIONS_BY_ROLE[StaffRole.CUSTOMER_SERVICE] as string[],
};

export function CreateUserDialog({ open, onClose }: CreateUserDialogProps) {
  const { t } = useTranslation(["users", "navigation", "common", "validation"]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [touched, setTouched] = useState(false);
  const [createUser, { isLoading, error }] = useCreateUserMutation();
  const isAdminRole = form.role === StaffRole.ADMIN;

  const togglePermission = (key: string) =>
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(key)
        ? prev.permissions.filter((k) => k !== key)
        : [...prev.permissions, key],
    }));

  const errors = {
    name: form.name.trim().length === 0,
    email: !/^\S+@\S+\.\S+$/.test(form.email),
    password: form.password.length < 8,
  };
  const isValid = !Object.values(errors).some(Boolean);

  const handleClose = () => {
    setForm(INITIAL_FORM);
    setTouched(false);
    onClose();
  };

  const handleSubmit = async () => {
    setTouched(true);
    if (!isValid) return;
    try {
      await createUser(form).unwrap();
      handleClose();
    } catch {
      // surfaced via `error`
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t("users:create.title")}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <TextField
            label={t("users:create.name")}
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            error={touched && errors.name}
            helperText={touched && errors.name ? t("validation:required") : undefined}
            required
            fullWidth
          />
          <TextField
            label={t("users:create.email")}
            type="email"
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            error={touched && errors.email}
            helperText={touched && errors.email ? t("validation:invalidEmail") : undefined}
            required
            fullWidth
          />
          <TextField
            label={t("users:create.password")}
            type="password"
            value={form.password}
            onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
            error={touched && errors.password}
            helperText={touched && errors.password ? t("validation:minLength", { count: 8 }) : undefined}
            autoComplete="new-password"
            required
            fullWidth
          />
          <TextField
            select
            label={t("users:create.role")}
            value={form.role}
            onChange={(e) => {
              const role = e.target.value;
              setForm((prev) => ({ ...prev, role, permissions: DEFAULT_PERMISSIONS_BY_ROLE[role as keyof typeof DEFAULT_PERMISSIONS_BY_ROLE] }));
            }}
            fullWidth
          >
            {STAFF_ROLE_VALUES.map((role) => (
              <MenuItem key={role} value={role}>
                {t(`common:roles.${role}`)}
              </MenuItem>
            ))}
          </TextField>

          <Stack spacing={0.5}>
            <Typography variant="subtitle2">{t("users:permissions.action")}</Typography>
            {isAdminRole ? (
              <Alert severity="info">{t("users:permissions.adminNotice")}</Alert>
            ) : (
              <PermissionsChecklist selected={form.permissions} onToggle={togglePermission} />
            )}
          </Stack>

          {error && <Alert severity="error">{getApiErrorMessage(error) ?? t("users:create.error")}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isLoading}>
          {t("common:actions.cancel")}
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={isLoading}
          startIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {t("common:actions.create")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
