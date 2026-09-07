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
import { useLinkItemMutation } from "../../api/casesApi";

export function LinkItemDialog({ open, onClose, caseId }: { open: boolean; onClose: () => void; caseId: string }) {
  const { t } = useTranslation("complaints");
  const [sku, setSku] = useState("");
  const [title, setTitle] = useState("");
  const [linkItem, { isLoading, error }] = useLinkItemMutation();

  const handleClose = () => {
    setSku("");
    setTitle("");
    onClose();
  };

  const handleSubmit = async () => {
    const skuValue = sku.trim();
    if (!skuValue || !title.trim()) return;
    await linkItem({ caseId, externalItemId: skuValue, sku: skuValue, title: title.trim() }).unwrap();
    handleClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t("detail.linkItemDialog.title")}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label={t("detail.linkItemDialog.sku")}
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            autoFocus
            fullWidth
          />
          <TextField label={t("form.subject")} value={title} onChange={(e) => setTitle(e.target.value)} fullWidth />
          {error && <Alert severity="error">{t("state.error", { ns: "common" })}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>{t("actions.cancel", { ns: "common" })}</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={!sku.trim() || !title.trim() || isLoading}>
          {t("actions.add", { ns: "common" })}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
