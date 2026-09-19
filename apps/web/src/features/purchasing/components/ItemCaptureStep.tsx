import { useRef, useState } from "react";
import Stack from "@mui/material/Stack";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Avatar from "@mui/material/Avatar";
import CircularProgress from "@mui/material/CircularProgress";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import { useTranslation } from "react-i18next";
import { CameraCaptureDialog } from "../../../components/CameraCaptureDialog";

export interface ItemCaptureValues {
  photo: File;
  quantity: number;
  unitPrice: number;
  description?: string;
  variantLabel?: string;
  notes?: string;
}

interface ItemCaptureStepProps {
  onSubmit: (values: ItemCaptureValues) => Promise<void>;
  isSubmitting: boolean;
}

/**
 * Item capture: prefers a live in-browser camera (getUserMedia) so it works
 * on laptops/desktops, where a hidden file input with capture="environment"
 * only opens a plain file picker with no webcam option -- that attribute is
 * a mobile-only hint. Falls back to the plain file picker when getUserMedia
 * is unavailable or access fails/is denied (see CameraCaptureDialog.tsx).
 * There is no existing bottom-sheet/camera component in this codebase to
 * reuse, so this is a new, purpose-built pattern (see AttachmentsPanel.tsx
 * for the closest precedent this extends).
 */
const hasCameraApi = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

export function ItemCaptureStep({ onSubmit, isSubmitting }: ItemCaptureStepProps) {
  const { t } = useTranslation("purchasing");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [cameraDialogOpen, setCameraDialogOpen] = useState(false);
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [description, setDescription] = useState("");
  const [variantLabel, setVariantLabel] = useState("");
  const [notes, setNotes] = useState("");

  const applyPhoto = (file: File) => {
    setPhoto(file);
    setPhotoPreviewUrl(URL.createObjectURL(file));
  };

  const handlePhotoSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    applyPhoto(file);
    event.target.value = "";
  };

  const handleCapture = (file: File) => {
    applyPhoto(file);
    setCameraDialogOpen(false);
  };

  const openCapture = () => {
    if (hasCameraApi) {
      setCameraDialogOpen(true);
    } else {
      fileInputRef.current?.click();
    }
  };

  const useFilePicker = () => {
    setCameraDialogOpen(false);
    fileInputRef.current?.click();
  };

  const canSubmit = !!photo && Number(quantity) > 0 && Number(unitPrice) >= 0 && !isSubmitting;

  const reset = () => {
    setPhoto(null);
    setPhotoPreviewUrl(null);
    setQuantity("1");
    setUnitPrice("");
    setDescription("");
    setVariantLabel("");
    setNotes("");
  };

  const handleSubmit = async () => {
    if (!photo) return;
    await onSubmit({
      photo,
      quantity: Number(quantity),
      unitPrice: Number(unitPrice),
      description: description || undefined,
      variantLabel: variantLabel || undefined,
      notes: notes || undefined,
    });
    reset();
  };

  return (
    <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: "16px" }}>
      <Stack spacing={2}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Avatar
            variant="rounded"
            src={photoPreviewUrl ?? undefined}
            sx={{ width: 72, height: 72, bgcolor: "action.hover", cursor: "pointer" }}
            onClick={openCapture}
          >
            <PhotoCameraIcon color="action" />
          </Avatar>
          <Stack spacing={0.5} sx={{ flexGrow: 1 }}>
            <Button variant="outlined" startIcon={<PhotoCameraIcon />} onClick={openCapture}>
              {photo ? t("receiveItems.retakePhoto") : t("receiveItems.takePhoto")}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              hidden
              accept="image/*"
              capture="environment"
              onChange={handlePhotoSelected}
            />
          </Stack>
        </Stack>

        <Stack direction="row" spacing={2}>
          <TextField
            label={t("receiveItems.quantity")}
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            slotProps={{ htmlInput: { min: 1, step: 1 } }}
            fullWidth
          />
          <TextField
            label={t("receiveItems.unitPrice")}
            type="number"
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
            slotProps={{ htmlInput: { min: 0, step: 1000 } }}
            fullWidth
          />
        </Stack>

        <TextField
          label={t("receiveItems.description")}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          fullWidth
        />
        <TextField
          label={t("receiveItems.variantLabel")}
          placeholder={t("receiveItems.variantLabelPlaceholder")}
          value={variantLabel}
          onChange={(e) => setVariantLabel(e.target.value)}
          fullWidth
        />
        <TextField
          label={t("receiveItems.notes")}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          multiline
          minRows={2}
          fullWidth
        />

        <Button
          variant="contained"
          size="large"
          disabled={!canSubmit}
          onClick={handleSubmit}
          startIcon={isSubmitting ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {t("receiveItems.addItem")}
        </Button>
        {!photo && (
          <Typography variant="caption" color="text.secondary">
            {t("receiveItems.photoRequired")}
          </Typography>
        )}
      </Stack>
      <CameraCaptureDialog
        open={cameraDialogOpen}
        onClose={() => setCameraDialogOpen(false)}
        onCapture={handleCapture}
        onUseFilePicker={useFilePicker}
        fileNamePrefix="receiving-photo"
      />
    </Paper>
  );
}
