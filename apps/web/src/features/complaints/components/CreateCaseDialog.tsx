import { useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
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
import Autocomplete from "@mui/material/Autocomplete";
import Checkbox from "@mui/material/Checkbox";
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import { useTranslation } from "react-i18next";
import {
  CASE_CATEGORY_VALUES,
  CASE_CONTACT_PLATFORM_VALUES,
  CASE_CONTACT_PLATFORMS_REQUIRING_ID,
  CASE_PRIORITY_VALUES,
  CASE_SOURCE_VALUES,
  CaseContactPlatform,
  CasePriority,
  CaseSource,
  type CaseContactPlatform as CaseContactPlatformType,
} from "@complaint-system/shared";
import { useCreateCaseMutation } from "../api/casesApi";
import { useListUsersQuery } from "../../users/api/usersApi";
import { useAppSelector } from "../../../app/hooks";
import { CustomerOrderAutocomplete } from "./CustomerOrderAutocomplete";
import type { MatchedCustomerOrder, MatchedCustomerOrderItem } from "../types";
import { formatDate } from "../../../utils/localeFormat";
import { useActiveLanguage } from "../../../i18n/useActiveLanguage";
import { Ltr } from "../../../components/Ltr";

interface CreateCaseDialogProps {
  open: boolean;
  onClose: () => void;
}

interface FormState {
  /** Set by searching the customer's orders (live shop or imported) -- identifies both the customer and, per docs/architecture.md, the order the case is about. */
  matchedOrder: MatchedCustomerOrder | null;
  /** Products from matchedOrder the case is actually about; cleared whenever matchedOrder changes. */
  selectedItems: MatchedCustomerOrderItem[];
  /** Fallback for a customer with no order to match yet; mutually exclusive with matchedOrder. */
  manualCustomerName: string;
  subject: string;
  description: string;
  category: string;
  priority: string;
  source: string;
  contactPlatform: string;
  contactId: string;
  assignedTo: string;
  tags: string[];
}

/** Defaults assignedTo to the case's creator -- staff who file a case are responsible for it by default, unless they explicitly reassign it. */
function buildInitialState(assignedTo: string): FormState {
  return {
    matchedOrder: null,
    selectedItems: [],
    manualCustomerName: "",
    subject: "",
    description: "",
    category: "",
    priority: CasePriority.NORMAL,
    source: CaseSource.PHONE,
    contactPlatform: CaseContactPlatform.INSTAGRAM,
    contactId: "",
    assignedTo,
    tags: [],
  };
}

/** Placeholder id for a customer entered by hand and not confirmed against a server record. */
function generateManualCustomerId(name: string): string {
  const slug =
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 40) || "customer";
  return `manual-${slug}-${Math.random().toString(36).slice(2, 8)}`;
}

export function CreateCaseDialog({ open, onClose }: CreateCaseDialogProps) {
  const { t } = useTranslation("complaints");
  const { t: tValidation } = useTranslation("validation");
  const navigate = useNavigate();
  const language = useActiveLanguage();
  const { data: users = [] } = useListUsersQuery();
  const [createCase, { isLoading, error }] = useCreateCaseMutation();
  const currentUser = useAppSelector((state) => state.auth.user);

  const [form, setForm] = useState<FormState>(() => buildInitialState(currentUser?.id ?? ""));
  const [tagInput, setTagInput] = useState("");
  const [touched, setTouched] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);

  const hasManualCustomer = form.manualCustomerName.trim().length > 0;
  const isSocialMedia = form.source === CaseSource.SOCIAL_MEDIA;
  const contactIdRequired =
    isSocialMedia &&
    CASE_CONTACT_PLATFORMS_REQUIRING_ID.includes(form.contactPlatform as CaseContactPlatformType);
  const errors = {
    customer: !form.matchedOrder && !hasManualCustomer,
    subject: form.subject.trim().length < 3,
    description: form.description.trim().length === 0,
    category: !form.category,
    priority: !form.priority,
    source: !form.source,
    contactId: contactIdRequired && form.contactId.trim().length === 0,
  };
  const isValid = !Object.values(errors).some(Boolean);

  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);

  const isDirty =
    tagInput.length > 0 ||
    JSON.stringify(form) !== JSON.stringify(buildInitialState(currentUser?.id ?? ""));

  const handleClose = () => {
    setConfirmDiscardOpen(false);
    setForm(buildInitialState(currentUser?.id ?? ""));
    setTagInput("");
    setTouched(false);
    setManualOpen(false);
    onClose();
  };

  /** Backdrop click, Escape and Cancel all land here so a half-filled form is never discarded silently. */
  const requestClose = () => {
    if (isLoading) return;
    if (isDirty) setConfirmDiscardOpen(true);
    else handleClose();
  };

  const handleMatchChange = (matchedOrder: MatchedCustomerOrder | null) => {
    setForm((prev) => ({
      ...prev,
      matchedOrder,
      selectedItems: [],
      manualCustomerName: matchedOrder ? "" : prev.manualCustomerName,
    }));
  };

  /** Typing a manual name after an order match invalidates that match -- the two are mutually exclusive. */
  const handleManualNameChange = (value: string) => {
    setForm((prev) => ({ ...prev, manualCustomerName: value, matchedOrder: value.trim() ? null : prev.matchedOrder }));
  };

  const handleAddTag = () => {
    const value = tagInput.trim();
    if (!value || form.tags.includes(value)) return;
    setForm((prev) => ({ ...prev, tags: [...prev.tags, value] }));
    setTagInput("");
  };

  const handleTagKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleAddTag();
    }
  };

  const handleSubmit = async () => {
    setTouched(true);
    if (!isValid) return;

    const customer = form.matchedOrder
      ? {
          externalCustomerId: form.matchedOrder.externalCustomerId,
          name: form.matchedOrder.customerName,
          phone: form.matchedOrder.customerPhone,
        }
      : { externalCustomerId: generateManualCustomerId(form.manualCustomerName), name: form.manualCustomerName.trim() };

    const relatedOrder = form.matchedOrder
      ? { externalOrderId: form.matchedOrder.externalOrderId, orderNumber: form.matchedOrder.orderNumber }
      : undefined;
    const relatedItems =
      form.selectedItems.length > 0
        ? form.selectedItems.map(({ externalItemId, sku, title }) => ({ externalItemId, sku, title }))
        : undefined;
    const contactPoint = isSocialMedia
      ? { platform: form.contactPlatform, contactId: form.contactId.trim() || undefined }
      : undefined;

    const created = await createCase({
      customer,
      subject: form.subject.trim(),
      description: form.description.trim(),
      category: form.category,
      priority: form.priority,
      source: form.source,
      contactPoint,
      assignedTo: form.assignedTo || undefined,
      relatedOrder,
      relatedItems,
      tags: form.tags.length > 0 ? form.tags : undefined,
    }).unwrap();

    handleClose();
    navigate(`/cases/${created.id}`);
  };

  return (
    <Dialog
      open={open}
      onClose={requestClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>{t("form.title")}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <CustomerOrderAutocomplete
            value={form.matchedOrder}
            onChange={handleMatchChange}
            error={touched && errors.customer && !manualOpen}
            helperText={touched && errors.customer && !manualOpen ? tValidation("selectCustomer") : undefined}
          />
          {form.matchedOrder && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: -1.5 }}>
              {t("form.linkedOrder", {
                orderNumber: form.matchedOrder.orderNumber,
                date: form.matchedOrder.purchaseDate ? formatDate(form.matchedOrder.purchaseDate, language) : "—",
              })}
            </Typography>
          )}

          {form.matchedOrder && form.matchedOrder.items.length > 0 && (
            <Autocomplete
              multiple
              options={form.matchedOrder.items}
              value={form.selectedItems}
              onChange={(_e, newValue) => setForm((prev) => ({ ...prev, selectedItems: newValue }))}
              getOptionLabel={(option) => option.title}
              isOptionEqualToValue={(option, val) => option.externalItemId === val.externalItemId}
              renderOption={(props, option, { selected }) => (
                <li {...props} key={option.externalItemId}>
                  <Checkbox
                    icon={<CheckBoxOutlineBlankIcon fontSize="small" />}
                    checkedIcon={<CheckBoxIcon fontSize="small" />}
                    checked={selected}
                    sx={{ mr: 1 }}
                  />
                  <Stack>
                    <Typography variant="body2">{option.title}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      <Ltr>{option.sku}</Ltr> · {t("form.itemQuantity", { count: option.quantity })}
                    </Typography>
                  </Stack>
                </li>
              )}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    {...getTagProps({ index })}
                    key={option.externalItemId}
                    label={option.title}
                    size="small"
                  />
                ))
              }
              renderInput={(params) => (
                <TextField {...params} label={t("form.relatedItems")} helperText={t("form.relatedItemsHelp")} />
              )}
            />
          )}

          <Stack spacing={1} alignItems="flex-start">
            <Button size="small" onClick={() => setManualOpen((prev) => !prev)}>
              {manualOpen ? t("form.manualEntry.toggleHide") : t("form.manualEntry.toggleShow")}
            </Button>
            {manualOpen && (
              <TextField
                label={t("form.manualEntry.customerName")}
                helperText={t("form.manualEntry.help")}
                value={form.manualCustomerName}
                onChange={(e) => handleManualNameChange(e.target.value)}
                fullWidth
              />
            )}
            {touched && errors.customer && manualOpen && (
              <Typography variant="caption" color="error">
                {tValidation("enterCustomerName")}
              </Typography>
            )}
          </Stack>

          <TextField
            label={t("form.subject")}
            value={form.subject}
            onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))}
            error={touched && errors.subject}
            helperText={touched && errors.subject ? tValidation("minLength", { count: 3 }) : undefined}
            required
            fullWidth
          />

          <TextField
            label={t("form.description")}
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            error={touched && errors.description}
            helperText={touched && errors.description ? tValidation("required") : undefined}
            multiline
            minRows={3}
            required
            fullWidth
          />

          <Stack direction="row" spacing={2}>
            <TextField
              select
              label={t("form.category")}
              value={form.category}
              onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
              error={touched && errors.category}
              required
              fullWidth
            >
              {CASE_CATEGORY_VALUES.map((c) => (
                <MenuItem key={c} value={c}>
                  {t(`category.${c}`)}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label={t("form.priority")}
              value={form.priority}
              onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value }))}
              required
              fullWidth
            >
              {CASE_PRIORITY_VALUES.map((p) => (
                <MenuItem key={p} value={p}>
                  {t(`priority.${p}`)}
                </MenuItem>
              ))}
            </TextField>
          </Stack>

          <Stack direction="row" spacing={2}>
            <TextField
              select
              label={t("form.source")}
              value={form.source}
              onChange={(e) => setForm((prev) => ({ ...prev, source: e.target.value }))}
              required
              fullWidth
            >
              {CASE_SOURCE_VALUES.map((s) => (
                <MenuItem key={s} value={s}>
                  {t(`source.${s}`)}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label={t("form.assignedTo")}
              value={form.assignedTo}
              onChange={(e) => setForm((prev) => ({ ...prev, assignedTo: e.target.value }))}
              fullWidth
            >
              <MenuItem value="">—</MenuItem>
              {users.map((u) => (
                <MenuItem key={u.id} value={u.id}>
                  {u.name}
                </MenuItem>
              ))}
            </TextField>
          </Stack>

          {isSocialMedia && (
            <Stack direction="row" spacing={2}>
              <TextField
                select
                label={t("form.contactPlatform")}
                value={form.contactPlatform}
                onChange={(e) => setForm((prev) => ({ ...prev, contactPlatform: e.target.value }))}
                required
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
                value={form.contactId}
                onChange={(e) => setForm((prev) => ({ ...prev, contactId: e.target.value }))}
                error={touched && errors.contactId}
                helperText={touched && errors.contactId ? tValidation("required") : undefined}
                required={contactIdRequired}
                fullWidth
              />
            </Stack>
          )}

          <Stack spacing={1}>
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
              {form.tags.map((tag) => (
                <Chip
                  key={tag}
                  label={tag}
                  size="small"
                  onDelete={() => setForm((prev) => ({ ...prev, tags: prev.tags.filter((t2) => t2 !== tag) }))}
                />
              ))}
            </Stack>
            <TextField
              label={t("form.tags")}
              placeholder={t("form.tagsPlaceholder")}
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              fullWidth
            />
          </Stack>

          {error && <Alert severity="error">{t("state.error", { ns: "common" })}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={requestClose} disabled={isLoading}>
          {t("actions.cancel", { ns: "common" })}
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={isLoading}
          startIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {isLoading ? t("form.submitting") : t("form.submit")}
        </Button>
      </DialogActions>
      <Dialog open={confirmDiscardOpen} onClose={() => setConfirmDiscardOpen(false)}>
        <DialogTitle>{t("form.discard.title")}</DialogTitle>
        <DialogContent>
          <Typography>{t("form.discard.message")}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDiscardOpen(false)} autoFocus>
            {t("form.discard.keepEditing")}
          </Button>
          <Button onClick={handleClose} color="error">
            {t("form.discard.confirm")}
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
}
