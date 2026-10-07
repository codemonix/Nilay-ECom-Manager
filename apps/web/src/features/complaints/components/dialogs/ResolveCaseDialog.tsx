import { useEffect, useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Alert from "@mui/material/Alert";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import { useTranslation } from "react-i18next";
import { CASE_RESOLVE_ORDER_STATUS_CODES, CaseStatus, SHOPFA_ORDER_STATUS_OPTIONS } from "@complaint-system/shared";
import type { CaseDTO } from "../../types";
import { useChangeCaseOrderStatusMutation, useChangeStatusMutation } from "../../api/casesApi";
import { getApiErrorMessage } from "../../../../utils/apiError";

const ORDER_STATUS_CHOICES = SHOPFA_ORDER_STATUS_OPTIONS.filter((option) =>
  CASE_RESOLVE_ORDER_STATUS_CODES.includes(option.code),
);

interface ResolveCaseDialogProps {
  open: boolean;
  onClose: () => void;
  caseData: CaseDTO;
  /** Text already typed in the "change status" dialog, when the resolve came from there -- prefills the resolution field. */
  reason?: string;
}

/**
 * Resolving a case: staff can describe how it was resolved (kept on the
 * timeline with the "resolved" event) and, when the case has linked orders
 * (left in "در حال پیگیری" when it was opened), choose whether each should
 * move on to another status. The case is resolved first; if an order's change
 * then fails on Shopfa the dialog stays open with the error so it can be
 * retried.
 */
export function ResolveCaseDialog({ open, onClose, caseData, reason }: ResolveCaseDialogProps) {
  const { t } = useTranslation("complaints");
  const [resolution, setResolution] = useState("");
  const [choices, setChoices] = useState<Record<string, number | "">>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [changeStatus, { isLoading: isResolving }] = useChangeStatusMutation();
  const [changeOrderStatus, { isLoading: isChangingOrder }] = useChangeCaseOrderStatusMutation();
  const isBusy = isResolving || isChangingOrder;
  const alreadyResolved = caseData.status === CaseStatus.RESOLVED;

  useEffect(() => {
    if (open) setResolution(reason ?? "");
  }, [open, reason]);

  const handleClose = () => {
    if (isBusy) return;
    setChoices({});
    setErrorMessage(null);
    onClose();
  };

  const handleSubmit = async () => {
    setErrorMessage(null);
    try {
      // Already resolved when retrying after an order's change failed.
      if (!alreadyResolved) {
        await changeStatus({
          caseId: caseData.id,
          status: CaseStatus.RESOLVED,
          reason: resolution.trim() || undefined,
        }).unwrap();
      }
      for (const order of caseData.relatedOrders) {
        const statusCode = choices[order.orderNumber];
        if (statusCode === undefined || statusCode === "") continue;
        await changeOrderStatus({ caseId: caseData.id, orderNumber: order.orderNumber, statusCode }).unwrap();
        setChoices((prev) => ({ ...prev, [order.orderNumber]: "" }));
      }
      setChoices({});
      onClose();
    } catch (err) {
      setErrorMessage(getApiErrorMessage(err) ?? t("state.error", { ns: "common" }));
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t("detail.resolveDialog.title")}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label={t("detail.resolveDialog.resolution")}
            helperText={t("detail.resolveDialog.resolutionHelp")}
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            disabled={isBusy || alreadyResolved}
            slotProps={{ htmlInput: { maxLength: 1000 } }}
            multiline
            minRows={3}
            autoFocus
            fullWidth
          />
          {caseData.relatedOrders.length > 0 && (
            <Typography variant="body2">{t("detail.resolveDialog.question")}</Typography>
          )}
          {caseData.relatedOrders.map((order) => (
            <TextField
              key={order.orderNumber}
              select
              label={t("detail.resolveDialog.orderLabel", { orderNumber: order.orderNumber })}
              value={choices[order.orderNumber] ?? ""}
              onChange={(e) =>
                setChoices((prev) => ({
                  ...prev,
                  [order.orderNumber]: e.target.value === "" ? "" : Number(e.target.value),
                }))
              }
              disabled={isBusy}
              slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
              fullWidth
            >
              <MenuItem value="">{t("detail.resolveDialog.keepStatus")}</MenuItem>
              {ORDER_STATUS_CHOICES.map((option) => (
                <MenuItem key={option.code} value={option.code}>
                  {option.statusTitle}
                </MenuItem>
              ))}
            </TextField>
          ))}
          {errorMessage && (
            <Alert severity="error">
              {alreadyResolved
                ? t("detail.resolveDialog.orderError", { message: errorMessage })
                : errorMessage}
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isBusy}>
          {t("actions.cancel", { ns: "common" })}
        </Button>
        <Button
          onClick={() => void handleSubmit()}
          variant="contained"
          color="success"
          disabled={isBusy}
          startIcon={isBusy ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {alreadyResolved ? t("detail.resolveDialog.retry") : t("detail.actions.resolve")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
