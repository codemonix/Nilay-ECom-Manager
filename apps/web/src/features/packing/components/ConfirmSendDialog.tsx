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
  photoPreviewUrls: string[];
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
  photoPreviewUrls,
  isSending,
  onCancel,
  onTakePicture,
  onConfirm,
}: ConfirmSendDialogProps) {
  const { t } = useTranslation("packing");

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>{t("confirmSendTitle")}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <Alert severity="warning">{t("confirmSendMessage")}</Alert>
          {photoPreviewUrls.length > 0 && (
            <Stack direction="row" gap={1} flexWrap="wrap">
              {photoPreviewUrls.map((url) => (
                <Box
                  key={url}
                  component="img"
                  src={url}
                  alt={t("photoAlt")}
                  sx={{ width: 96, height: 96, objectFit: "cover", borderRadius: "10px", bgcolor: "action.hover" }}
                />
              ))}
            </Stack>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ flexWrap: "wrap", gap: 1 }}>
        <Button onClick={onTakePicture} startIcon={<PhotoCameraIcon />} disabled={isSending}>
          {t("confirmSendTakePicture")}
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          color={photoPreviewUrls.length > 0 ? "primary" : "warning"}
          disabled={isSending}
          startIcon={isSending ? <CircularProgress size={14} color="inherit" /> : undefined}
        >
          {photoPreviewUrls.length > 0 ? t("confirmSendConfirmWithPhoto") : t("confirmSendConfirmWithoutPhoto")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
