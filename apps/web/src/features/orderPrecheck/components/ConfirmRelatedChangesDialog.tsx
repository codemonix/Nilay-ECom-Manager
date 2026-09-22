import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import { useTranslation } from "react-i18next";
import type { SaveOrderPrecheckResultDTO } from "../types";

interface ConfirmRelatedChangesDialogProps {
  /** The not-yet-saved result asking for confirmation; null keeps the dialog closed. */
  pending: SaveOrderPrecheckResultDTO | null;
  isSaving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Shown when a precheck with missing items would pull the same customer's
 * orders that are already "sent to postal service" back to accounting
 * confirmed -- they'd otherwise ship without the missing items. Cancel
 * changes nothing at all; Confirm saves this order and moves those orders.
 */
export function ConfirmRelatedChangesDialog({ pending, isSaving, onCancel, onConfirm }: ConfirmRelatedChangesDialogProps) {
  const { t } = useTranslation("orderPrecheck");
  const { t: tCommon } = useTranslation("common");

  return (
    <Dialog open={pending !== null} onClose={isSaving ? undefined : onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>{t("confirmRelatedTitle")}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ pt: 0.5 }}>
          <Alert severity="warning">{t("confirmRelatedMessage", { status: pending?.statusTitle ?? "" })}</Alert>
          {pending?.relatedOrders.map((order) => (
            <Typography key={order.orderNumber} variant="body2">
              {order.orderNumber}: {order.fromStatusTitle} ← {order.toStatusTitle}
            </Typography>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={isSaving}>
          {tCommon("actions.cancel")}
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          color="warning"
          disabled={isSaving}
          startIcon={isSaving ? <CircularProgress size={14} color="inherit" /> : undefined}
        >
          {t("confirmRelatedConfirm")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
