import { useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Alert from "@mui/material/Alert";
import { useTranslation } from "react-i18next";
import { useAddNoteMutation } from "../../api/casesApi";

interface NoteDialogProps {
  open: boolean;
  onClose: () => void;
  caseId: string;
  visibility: "internal" | "customer";
}

export function NoteDialog({ open, onClose, caseId, visibility }: NoteDialogProps) {
  const { t } = useTranslation("complaints");
  const [body, setBody] = useState("");
  const [addNote, { isLoading, error }] = useAddNoteMutation();

  const handleClose = () => {
    setBody("");
    onClose();
  };

  const handleSubmit = async () => {
    if (!body.trim()) return;
    await addNote({ caseId, body: body.trim(), visibility }).unwrap();
    handleClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {visibility === "internal" ? t("detail.noteDialog.internalTitle") : t("detail.noteDialog.customerTitle")}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label={t("detail.noteDialog.bodyLabel")}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            multiline
            minRows={4}
            autoFocus
            fullWidth
          />
          {error && <Alert severity="error">{t("state.error", { ns: "common" })}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>{t("actions.cancel", { ns: "common" })}</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={!body.trim() || isLoading}>
          {t("detail.noteDialog.submit")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
