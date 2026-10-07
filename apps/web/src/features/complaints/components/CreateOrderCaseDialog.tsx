import { useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import LinearProgress from "@mui/material/LinearProgress";
import Autocomplete from "@mui/material/Autocomplete";
import Checkbox from "@mui/material/Checkbox";
import { useTranslation } from "react-i18next";
import {
  CASE_CATEGORY_VALUES,
  type CaseCategory,
  type CreateOrderCaseResultDTO,
  type OrderCaseItemDTO,
} from "@complaint-system/shared";
import { useCreateOrderCaseMutation, useGetOrderCaseContextQuery } from "../api/casesApi";
import { getApiErrorMessage } from "../../../utils/apiError";
import { Ltr } from "../../../components/Ltr";

interface CreateOrderCaseDialogProps {
  open: boolean;
  orderNumber: string;
  onClose: () => void;
  onCreated: (result: CreateOrderCaseResultDTO) => void;
}

/**
 * Raises a case against one order from an order screen (Order Precheck,
 * Packing, Status Check): staff pick the reason, optionally the item(s)
 * involved and a free-text explanation. Saving puts the order in
 * "در حال پیگیری" and writes the case number into its admin note on Shopfa
 * (see orderCaseService.createOrderCase on the API side).
 */
export function CreateOrderCaseDialog({ open, orderNumber, onClose, onCreated }: CreateOrderCaseDialogProps) {
  const { t } = useTranslation("complaints");
  const { t: tValidation } = useTranslation("validation");
  const {
    data: context,
    isFetching,
    error: contextError,
  } = useGetOrderCaseContextQuery(orderNumber, { skip: !open, refetchOnMountOrArgChange: true });
  const [createOrderCase, { isLoading, error }] = useCreateOrderCaseMutation();

  const [category, setCategory] = useState<CaseCategory | "">("");
  const [selectedItems, setSelectedItems] = useState<OrderCaseItemDTO[]>([]);
  const [description, setDescription] = useState("");
  const [touched, setTouched] = useState(false);

  const handleClose = () => {
    if (isLoading) return;
    setCategory("");
    setSelectedItems([]);
    setDescription("");
    setTouched(false);
    onClose();
  };

  const handleSubmit = async () => {
    setTouched(true);
    if (!category) return;
    const result = await createOrderCase({
      orderNumber,
      category,
      subject: t("orderCase.subject", { reason: t(`category.${category}`), orderNumber }),
      description: description.trim() || undefined,
      productCodes: selectedItems.length > 0 ? selectedItems.map((item) => item.productCode) : undefined,
    })
      .unwrap()
      .catch(() => null);
    if (!result) return;
    setCategory("");
    setSelectedItems([]);
    setDescription("");
    setTouched(false);
    onCreated(result);
  };

  const openCases = context?.openCases ?? [];

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t("orderCase.title", { orderNumber })}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {t("orderCase.description")}
          </Typography>

          {isFetching && <LinearProgress />}
          {contextError && (
            <Alert severity="warning">{getApiErrorMessage(contextError) ?? t("orderCase.itemsLoadError")}</Alert>
          )}
          {openCases.length > 0 && (
            <Alert severity="info">
              {t("orderCase.alreadyOpen", { count: openCases.length })}{" "}
              <Ltr>{openCases.map((openCase) => openCase.caseNumber).join(", ")}</Ltr>
            </Alert>
          )}

          <TextField
            select
            label={t("orderCase.reason")}
            value={category}
            onChange={(e) => setCategory(e.target.value as CaseCategory)}
            error={touched && !category}
            helperText={touched && !category ? tValidation("required") : undefined}
            required
            fullWidth
          >
            {CASE_CATEGORY_VALUES.map((value) => (
              <MenuItem key={value} value={value}>
                {t(`category.${value}`)}
              </MenuItem>
            ))}
          </TextField>

          <Autocomplete
            multiple
            disableCloseOnSelect
            options={context?.items ?? []}
            value={selectedItems}
            onChange={(_e, value) => setSelectedItems(value)}
            getOptionLabel={(option) => option.title}
            isOptionEqualToValue={(option, value) => option.productCode === value.productCode}
            noOptionsText={isFetching ? t("orderCase.itemsLoading") : t("orderCase.noItems")}
            renderOption={(props, option, { selected }) => (
              <li {...props} key={option.productCode}>
                <Checkbox size="small" checked={selected} sx={{ mr: 1 }} />
                <Stack>
                  <Typography variant="body2">{option.title}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    <Ltr>{option.productCode}</Ltr> · {t("form.itemQuantity", { count: option.quantity })}
                  </Typography>
                </Stack>
              </li>
            )}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip {...getTagProps({ index })} key={option.productCode} label={option.title} size="small" />
              ))
            }
            renderInput={(params) => (
              <TextField {...params} label={t("orderCase.items")} helperText={t("orderCase.itemsHelp")} />
            )}
          />

          <TextField
            label={t("orderCase.explanation")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            minRows={3}
            fullWidth
          />

          {error && <Alert severity="error">{getApiErrorMessage(error) ?? t("state.error", { ns: "common" })}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isLoading}>
          {t("actions.cancel", { ns: "common" })}
        </Button>
        <Button
          onClick={() => void handleSubmit()}
          variant="contained"
          disabled={isLoading}
          startIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {isLoading ? t("form.submitting") : t("form.submit")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
