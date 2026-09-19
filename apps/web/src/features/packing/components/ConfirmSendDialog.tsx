import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import { useTranslation } from "react-i18next";

interface ConfirmSendDialogProps {
  open: boolean;
  photoPreviewUrl: string | null;
  isSending: boolean;
  onCancel: () => void;
  onTakePicture: () => void;
  onConfirm: () => void;
}

/**
 * Warning shown when staff tap Send before taking a confirmation photo of
 * the package (Packing's own camera button on the main page is the
 * expected path -- this is the safety net for when it was skipped). Taking
 * a picture from here calls the same onTakePicture the main page's camera
 * button uses (PackingPage owns the single CameraCaptureDialog instance and
 * the resulting File), so a photo taken here immediately shows up as the
 * preview below without closing this dialog -- staff can then Confirm & Send
 * right away instead of re-opening Send. Confirm still works with no photo
 * at all, as an explicit "send without one" override.
 */
export function ConfirmSendDialog({
  open,
  photoPreviewUrl,
  isSending,
  onCancel,
  onTakePicture,
  onConfirm,
}: ConfirmSendDialogProps) {
  const { t } = useTranslation("packing");
  const { t: tCommon } = useTranslation("common");

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>{t("confirmSendTitle")}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <Alert severity="warning">{t("confirmSendMessage")}</Alert>
          {photoPreviewUrl && (
            <Box
              component="img"
              src={photoPreviewUrl}
              alt={t("photoAlt")}
              sx={{ width: "100%", maxHeight: 240, objectFit: "contain", borderRadius: "12px", bgcolor: "action.hover" }}
            />
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ flexWrap: "wrap", gap: 1 }}>
        <Button onClick={onCancel} disabled={isSending}>
          {tCommon("actions.cancel")}
        </Button>
        <Button onClick={onTakePicture} startIcon={<PhotoCameraIcon />} disabled={isSending}>
          {t("confirmSendTakePicture")}
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          color={photoPreviewUrl ? "primary" : "warning"}
          disabled={isSending}
          startIcon={isSending ? <CircularProgress size={14} color="inherit" /> : undefined}
        >
          {photoPreviewUrl ? t("confirmSendConfirmWithPhoto") : t("confirmSendConfirmWithoutPhoto")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
