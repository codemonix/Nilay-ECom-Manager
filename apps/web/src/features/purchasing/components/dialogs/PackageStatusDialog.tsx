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
import { PACKAGE_STATUS_TRANSITIONS, PackageStatus, type PackageDTO } from "@complaint-system/shared";
import { useChangePackageStatusMutation } from "../../api/packagesApi";

interface PackageStatusDialogProps {
  open: boolean;
  onClose: () => void;
  packageData: PackageDTO;
}

/**
 * Only offers draft -> in_progress ("hand to shipping company") -- moving to
 * completed is exclusive to the Receiving module's own confirmation flow, so
 * it never appears here even though it's the package's only other
 * theoretically-valid next status.
 */
export function PackageStatusDialog({ open, onClose, packageData }: PackageStatusDialogProps) {
  const { t } = useTranslation("purchasing");
  const [status, setStatus] = useState<PackageStatus | "">("");
  const [reason, setReason] = useState("");
  const [changeStatus, { isLoading, error }] = useChangePackageStatusMutation();

  const allowedStatuses = (PACKAGE_STATUS_TRANSITIONS[packageData.status] ?? []).filter(
    (s) => s !== PackageStatus.COMPLETED,
  );

  const handleClose = () => {
    setStatus("");
    setReason("");
    onClose();
  };

  const handleSubmit = async () => {
    if (!status) return;
    await changeStatus({ packageId: packageData.id, status, reason: reason || undefined }).unwrap();
    handleClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t("detail.statusDialog.title")}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {allowedStatuses.length === 0 && <Alert severity="info">{t("detail.statusDialog.noValidTransitions")}</Alert>}
          <TextField
            select
            label={t("detail.statusDialog.newStatus")}
            value={status}
            onChange={(e) => setStatus(e.target.value as PackageStatus)}
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
