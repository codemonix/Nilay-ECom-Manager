import { useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Alert from "@mui/material/Alert";
import { useTranslation } from "react-i18next";
import {
  CASE_CONTACT_PLATFORM_VALUES,
  CASE_CONTACT_PLATFORMS_REQUIRING_ID,
  CaseContactPlatform,
  type CaseContactPlatform as CaseContactPlatformType,
  type CaseContactPoint,
} from "@complaint-system/shared";
import { useChangeContactPointMutation } from "../../api/casesApi";

interface ContactPointDialogProps {
  open: boolean;
  onClose: () => void;
  caseId: string;
  currentContactPoint: CaseContactPoint | null;
}

export function ContactPointDialog({ open, onClose, caseId, currentContactPoint }: ContactPointDialogProps) {
  const { t } = useTranslation("complaints");
  const { t: tValidation } = useTranslation("validation");
  const [platform, setPlatform] = useState<CaseContactPlatformType>(
    currentContactPoint?.platform ?? CaseContactPlatform.INSTAGRAM,
  );
  const [contactId, setContactId] = useState(currentContactPoint?.contactId ?? "");
  const [touched, setTouched] = useState(false);
  const [changeContactPoint, { isLoading, error }] = useChangeContactPointMutation();

  const contactIdRequired = CASE_CONTACT_PLATFORMS_REQUIRING_ID.includes(platform);
  const contactIdError = touched && contactIdRequired && contactId.trim().length === 0;

  const handleSubmit = async () => {
    setTouched(true);
    if (contactIdRequired && contactId.trim().length === 0) return;
    await changeContactPoint({
      caseId,
      contactPoint: { platform, contactId: contactId.trim() || undefined },
    }).unwrap();
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t("detail.contactPointDialog.title")}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            select
            label={t("form.contactPlatform")}
            value={platform}
            onChange={(e) => setPlatform(e.target.value as CaseContactPlatformType)}
            fullWidth
          >
            {CASE_CONTACT_PLATFORM_VALUES.map((p) => (
              <MenuItem key={p} value={p}>
                {t(`contactPlatform.${p}`)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label={t("form.contactId")}
            value={contactId}
            onChange={(e) => setContactId(e.target.value)}
            error={contactIdError}
            helperText={contactIdError ? tValidation("required") : undefined}
            required={contactIdRequired}
            fullWidth
          />
          {error && <Alert severity="error">{t("state.error", { ns: "common" })}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("actions.cancel", { ns: "common" })}</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={isLoading}>
          {t("actions.save", { ns: "common" })}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
