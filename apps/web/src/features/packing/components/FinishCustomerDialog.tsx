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
  onClose: () => void;
  onTakePicture: () => void;
}

/**
 * Blocks leaving a customer whose orders are all fully packed (every item
 * green) but not yet saved -- staff must take the final picture(s) and save
 * this customer first, so a finished box is never left behind unsaved.
 */
export function FinishCustomerDialog({ open, onClose, onTakePicture }: FinishCustomerDialogProps) {
  const { t } = useTranslation("packing");

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t("finishCustomerTitle")}</DialogTitle>
      <DialogContent>
        <Alert severity="warning">{t("finishCustomerMessage")}</Alert>
      </DialogContent>
      <DialogActions sx={{ flexWrap: "wrap", gap: 1 }}>
        <Button onClick={onTakePicture} startIcon={<PhotoCameraIcon />}>
          {t("confirmSendTakePicture")}
        </Button>
        <Button onClick={onClose} variant="contained">
          {t("finishCustomerOk")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
