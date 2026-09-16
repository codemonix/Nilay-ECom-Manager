import { useEffect, useMemo, useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import FormGroup from "@mui/material/FormGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import { useTranslation } from "react-i18next";
import { hasMenuAccess, type MenuKey } from "@complaint-system/shared";
import { useAppDispatch, useAppSelector } from "../../../app/hooks";
import { setCurrentUser } from "../../../store/authSlice";
import { ADMIN_NAV_ITEMS, PRIMARY_NAV_ITEMS } from "../../../config/navItems";
import { useUpdateQuickAccessMenuMutation } from "../api/authApi";
import { getApiErrorMessage } from "../../../utils/apiError";

const MAX_QUICK_ACCESS_ITEMS = 4;

interface QuickAccessMenuDialogProps {
  open: boolean;
  onClose: () => void;
}

export function QuickAccessMenuDialog({ open, onClose }: QuickAccessMenuDialogProps) {
  const { t } = useTranslation(["auth", "navigation", "common"]);
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const [updateQuickAccessMenu, { isLoading, error, reset }] = useUpdateQuickAccessMenuMutation();
  const [selected, setSelected] = useState<MenuKey[]>([]);

  const candidateItems = useMemo(
    () => [...PRIMARY_NAV_ITEMS, ...ADMIN_NAV_ITEMS].filter((item) => item.path && user && hasMenuAccess(user, item.key)),
    [user],
  );

  useEffect(() => {
    if (open) setSelected(user?.quickAccessMenu ?? []);
  }, [open, user]);

  const handleClose = () => {
    reset();
    onClose();
  };

  const toggle = (key: MenuKey) => {
    setSelected((prev) =>
      prev.includes(key)
        ? prev.filter((k) => k !== key)
        : prev.length >= MAX_QUICK_ACCESS_ITEMS
          ? prev
          : [...prev, key],
    );
  };

  const handleSave = async () => {
    try {
      const updated = await updateQuickAccessMenu({ quickAccessMenu: selected }).unwrap();
      dispatch(setCurrentUser(updated));
      onClose();
    } catch {
      // surfaced via `error`
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t("auth:quickAccess.title")}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {t("auth:quickAccess.description", { count: MAX_QUICK_ACCESS_ITEMS })}
        </Typography>
        <FormGroup>
          {candidateItems.map((item) => (
            <FormControlLabel
              key={item.key}
              control={
                <Checkbox
                  checked={selected.includes(item.key)}
                  onChange={() => toggle(item.key)}
                  disabled={!selected.includes(item.key) && selected.length >= MAX_QUICK_ACCESS_ITEMS}
                />
              }
              label={t(item.labelKey ?? `navigation:modules.${item.key}`)}
            />
          ))}
        </FormGroup>
        {error && (
          <Alert severity="error" sx={{ mt: 1.5 }}>
            {getApiErrorMessage(error) ?? t("auth:quickAccess.error")}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isLoading}>
          {t("common:actions.close")}
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={isLoading}
          startIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {t("common:actions.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
