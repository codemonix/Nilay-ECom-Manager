import { useEffect, useRef, useState } from "react";
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

interface CameraCaptureDialogProps {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
  /** Lets the caller fall back to a plain OS file picker (e.g. no webcam, permission denied). */
  onUseFilePicker: () => void;
}

/**
 * Live in-browser camera capture via getUserMedia, used as the primary
 * capture flow for laptops/desktops where a hidden <input capture> input
 * only opens a plain file picker (no webcam option) -- see
 * ItemCaptureStep.tsx for the reasoning. Falls back to onUseFilePicker when
 * getUserMedia is unavailable or access is denied/fails.
 */
export function CameraCaptureDialog({ open, onClose, onCapture, onUseFilePicker }: CameraCaptureDialogProps) {
  const { t } = useTranslation("purchasing");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<"starting" | "ready" | "error">("starting");

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setStatus("starting");

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [open]);

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video || status !== "ready") return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        onCapture(new File([blob], `receiving-photo-${Date.now()}.jpg`, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.92,
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t("cameraDialog.title")}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {status === "error" ? (
            <Alert severity="error">{t("cameraDialog.error")}</Alert>
          ) : (
            <Box
              sx={{
                position: "relative",
                width: "100%",
                aspectRatio: "4 / 3",
                bgcolor: "black",
                borderRadius: "12px",
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
              {status === "starting" && (
                <Box sx={{ position: "absolute" }}>
                  <CircularProgress color="inherit" sx={{ color: "white" }} />
                </Box>
              )}
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onUseFilePicker}>{t("cameraDialog.useFilePicker")}</Button>
        <Button onClick={onClose}>{t("actions.cancel", { ns: "common" })}</Button>
        <Button
          onClick={handleCapture}
          variant="contained"
          disabled={status !== "ready"}
          startIcon={<PhotoCameraIcon />}
        >
          {t("cameraDialog.capture")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
