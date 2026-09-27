import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import { useTranslation } from "react-i18next";

interface FinishCustomerDialogProps {
  open: boolean;
  onTakePicture: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Dialog B of the order status machine: moving to another customer while
 * every item of the current one is green but no final picture was taken.
 * Take picture opens the camera and stays on this customer (staff press Next
 * again themselves); Cancel stays and keeps packing; Confirm moves on WITHOUT
 * saving -- no order status changes.
 */
export function FinishCustomerDialog({ open, onTakePicture, onCancel, onConfirm }: FinishCustomerDialogProps) {
  const { t } = useTranslation("packing");

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>{t("finishCustomerTitle")}</DialogTitle>
      <DialogContent>
        <Alert severity="warning">{t("finishCustomerMessage")}</Alert>
      </DialogContent>
      <DialogActions sx={{ flexWrap: "wrap", gap: 1 }}>
        <Button onClick={onTakePicture} startIcon={<PhotoCameraIcon />}>
          {t("confirmSendTakePicture")}
        </Button>
        <Button onClick={onCancel}>{t("cancel")}</Button>
        <Button onClick={onConfirm} variant="contained" color="warning">
          {t("finishCustomerConfirm")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
