import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import { useTranslation } from "react-i18next";

interface ConfirmSendDialogProps {
  open: boolean;
  isSending: boolean;
  onCancel: () => void;
  onTakePicture: () => void;
  onConfirm: () => void;
}

/**
 * Dialog A of the order status machine: shown when staff press Save before
 * any final picture of the group was taken. Cancel saves nothing; Take
 * picture closes this and opens the camera -- staff then press Save again
 * themselves (no automatic re-save); Confirm saves without a picture.
 */
export function ConfirmSendDialog({ open, isSending, onCancel, onTakePicture, onConfirm }: ConfirmSendDialogProps) {
  const { t } = useTranslation("packing");

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>{t("confirmSendTitle")}</DialogTitle>
      <DialogContent>
        <Alert severity="warning">{t("confirmSendMessage")}</Alert>
      </DialogContent>
      <DialogActions sx={{ flexWrap: "wrap", gap: 1 }}>
        <Button onClick={onCancel} disabled={isSending}>
          {t("cancel")}
        </Button>
        <Button onClick={onTakePicture} startIcon={<PhotoCameraIcon />} disabled={isSending}>
          {t("confirmSendTakePicture")}
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          color="warning"
          disabled={isSending}
          startIcon={isSending ? <CircularProgress size={14} color="inherit" /> : undefined}
        >
          {t("confirmSendConfirmWithoutPhoto")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
