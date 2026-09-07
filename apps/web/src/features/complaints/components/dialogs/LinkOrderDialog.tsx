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
import { useLinkOrderMutation } from "../../api/casesApi";

export function LinkOrderDialog({
  open,
  onClose,
  caseId,
}: {
  open: boolean;
  onClose: () => void;
  caseId: string;
}) {
  const { t } = useTranslation("complaints");
  const [orderNumber, setOrderNumber] = useState("");
  const [linkOrder, { isLoading, error }] = useLinkOrderMutation();

  const handleClose = () => {
    setOrderNumber("");
    onClose();
  };

  const handleSubmit = async () => {
    const value = orderNumber.trim();
    if (!value) return;
    await linkOrder({ caseId, externalOrderId: value, orderNumber: value }).unwrap();
    handleClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t("detail.linkOrderDialog.title")}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label={t("detail.linkOrderDialog.orderId")}
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            autoFocus
            fullWidth
          />
          {error && <Alert severity="error">{t("state.error", { ns: "common" })}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>{t("actions.cancel", { ns: "common" })}</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={!orderNumber.trim() || isLoading}>
          {t("actions.add", { ns: "common" })}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
