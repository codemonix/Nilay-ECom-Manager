import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Alert from "@mui/material/Alert";
import { useTranslation } from "react-i18next";
import { useCreateDraftPackageMutation } from "../../api/packagesApi";

export function CreatePackageDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation("purchasing");
  const navigate = useNavigate();
  const [supplierName, setSupplierName] = useState("");
  const [createDraftPackage, { isLoading, error }] = useCreateDraftPackageMutation();

  const handleClose = () => {
    setSupplierName("");
    onClose();
  };

  const handleSubmit = async () => {
    const created = await createDraftPackage(supplierName ? { supplierName } : undefined).unwrap();
    handleClose();
    navigate(`/purchasing/packages/${created.id}`);
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t("packages.createDialog.title")}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          label={t("packages.createDialog.supplierName")}
          value={supplierName}
          onChange={(e) => setSupplierName(e.target.value)}
          fullWidth
          sx={{ mt: 1 }}
        />
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {t("state.error", { ns: "common" })}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>{t("actions.cancel", { ns: "common" })}</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={isLoading}>
          {t("actions.create", { ns: "common" })}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
