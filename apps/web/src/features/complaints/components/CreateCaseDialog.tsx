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
import CircularProgress from "@mui/material/CircularProgress";
import { useTranslation } from "react-i18next";
import {
  CASE_CATEGORY_VALUES,
  CASE_PRIORITY_VALUES,
  CASE_SOURCE_VALUES,
  CasePriority,
  CaseSource,
  type CustomerSearchResultDTO,
} from "@complaint-system/shared";
import { useCreateCaseMutation } from "../api/casesApi";
import { useListUsersQuery } from "../../users/api/usersApi";
import { CustomerAutocomplete } from "./CustomerAutocomplete";

interface CreateCaseDialogProps {
  open: boolean;
  onClose: () => void;
}

interface FormState {
  customer: CustomerSearchResultDTO | null;
  subject: string;
  description: string;
  category: string;
  priority: string;
  source: string;
  assignedTo: string;
  tags: string[];
}

const INITIAL_STATE: FormState = {
  customer: null,
  subject: "",
  description: "",
  category: "",
  priority: CasePriority.NORMAL,
  source: CaseSource.PHONE,
  assignedTo: "",
  tags: [],
};

export function CreateCaseDialog({ open, onClose }: CreateCaseDialogProps) {
  const { t } = useTranslation("complaints");
  const { t: tValidation } = useTranslation("validation");
  const navigate = useNavigate();
  const { data: users = [] } = useListUsersQuery();
  const [createCase, { isLoading, error }] = useCreateCaseMutation();

  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [tagInput, setTagInput] = useState("");
  const [touched, setTouched] = useState(false);

  const errors = {
    customer: !form.customer,
    subject: form.subject.trim().length < 3,
    description: form.description.trim().length === 0,
    category: !form.category,
    priority: !form.priority,
    source: !form.source,
  };
  const isValid = !Object.values(errors).some(Boolean);

  const handleClose = () => {
    setForm(INITIAL_STATE);
    setTagInput("");
    setTouched(false);
    onClose();
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
    if (!isValid || !form.customer) return;

    const created = await createCase({
      customer: {
        externalCustomerId: form.customer.externalCustomerId,
        name: form.customer.name,
        phone: form.customer.phone,
        email: form.customer.email,
      },
      subject: form.subject.trim(),
      description: form.description.trim(),
      category: form.category,
      priority: form.priority,
      source: form.source,
      assignedTo: form.assignedTo || undefined,
      tags: form.tags.length > 0 ? form.tags : undefined,
    }).unwrap();

    handleClose();
    navigate(`/cases/${created.id}`);
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t("form.title")}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <CustomerAutocomplete
            value={form.customer}
            onChange={(customer) => setForm((prev) => ({ ...prev, customer }))}
            error={touched && errors.customer}
            helperText={touched && errors.customer ? tValidation("selectCustomer") : undefined}
          />

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
        <Button onClick={handleClose} disabled={isLoading}>
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
    </Dialog>
  );
}
