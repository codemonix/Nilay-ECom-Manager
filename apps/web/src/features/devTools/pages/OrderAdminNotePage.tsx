import { useEffect, useState } from "react";
import { DataSource } from "@complaint-system/shared";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import { useTranslation } from "react-i18next";
import { useLazyGetOrderAdminNoteQuery, useUpdateOrderAdminNoteMutation } from "../api/devToolsApi";
import type { UpdateOrderAdminNoteResultDTO } from "../types";
import { useGetSettingsQuery } from "../../settings/api/settingsApi";
import { getApiErrorMessage } from "../../../utils/apiError";

/**
 * Internal check tool: look up an order by its customer-facing order
 * number and read/edit its admin note ("یادداشت مدیر" in the Shopfa
 * dashboard). Only available against the live API -- Shopfa exposes this
 * note under a `note` key that's absent unless explicitly requested (see
 * ShopfaClient.getOrderAdminNote), and imported order data has no such
 * field at all. Saving always re-fetches the note afterward to confirm
 * the write actually landed (see UpdateOrderAdminNoteResultDTO.applied),
 * rather than trusting the update call's own response -- Shopfa's
 * /orders/update reports success unconditionally.
 */
export function OrderAdminNotePage() {
  const { t } = useTranslation("devTools", { keyPrefix: "orderNote" });
  const [orderNumber, setOrderNumber] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [saveResult, setSaveResult] = useState<UpdateOrderAdminNoteResultDTO | null>(null);

  const { data: settings } = useGetSettingsQuery();
  const isLiveApi = settings?.dataSource === DataSource.LIVE_API;

  const [runLookup, { data: result, isFetching: isLookingUp, error: lookupError }] = useLazyGetOrderAdminNoteQuery();
  const [runSave, { isLoading: isSaving, error: saveError }] = useUpdateOrderAdminNoteMutation();

  useEffect(() => {
    if (result) setNoteDraft(result.note);
  }, [result]);

  const handleLookup = () => {
    if (!orderNumber.trim() || !isLiveApi) return;
    setSaveResult(null);
    void runLookup(orderNumber.trim());
  };

  const handleSave = async () => {
    if (!result) return;
    const outcome = await runSave({ orderNumber: result.orderNumber, note: noteDraft }).unwrap();
    setSaveResult(outcome);
  };

  const hasUnsavedChanges = !!result && noteDraft !== (saveResult?.currentNote ?? result.note);

  return (
    <Stack spacing={2}>
      <Typography variant="h1">{t("title")}</Typography>
      <Typography variant="body2" color="text.secondary">
        {t("description")}
      </Typography>

      {!isLiveApi && <Alert severity="warning">{t("liveApiRequired")}</Alert>}

      <Card variant="outlined" sx={{ borderRadius: "14px" }}>
        <CardContent>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1}>
              <TextField
                size="small"
                label={t("orderNumber")}
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleLookup();
                }}
                disabled={!isLiveApi}
                fullWidth
              />
              <Button
                variant="outlined"
                onClick={handleLookup}
                disabled={!orderNumber.trim() || !isLiveApi || isLookingUp}
                startIcon={isLookingUp ? <CircularProgress size={14} /> : undefined}
              >
                {t("lookup")}
              </Button>
            </Stack>

            {isLookingUp && (
              <Alert severity="info" icon={<CircularProgress size={16} />}>
                {t("loading")}
              </Alert>
            )}

            {lookupError && <Alert severity="error">{getApiErrorMessage(lookupError) ?? t("lookupError")}</Alert>}

            {result && !isLookingUp && (
              <Stack spacing={1.5}>
                <Typography variant="caption" color="text.secondary">
                  {result.orderNumber}
                </Typography>
                <TextField
                  label={t("note")}
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  multiline
                  minRows={3}
                  fullWidth
                />
                <Stack direction="row" spacing={1}>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={handleSave}
                    disabled={isSaving || !hasUnsavedChanges}
                    startIcon={isSaving ? <CircularProgress size={14} /> : undefined}
                  >
                    {t("save")}
                  </Button>
                </Stack>

                {saveError && <Alert severity="error">{getApiErrorMessage(saveError) ?? t("saveError")}</Alert>}
                {saveResult && !saveResult.applied && <Alert severity="warning">{t("saveNotApplied")}</Alert>}
                {saveResult && saveResult.applied && <Alert severity="success">{t("saveApplied")}</Alert>}
              </Stack>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
