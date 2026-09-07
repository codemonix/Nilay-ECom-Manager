import { useState, type KeyboardEvent } from "react";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import IconButton from "@mui/material/IconButton";
import { useTranslation } from "react-i18next";
import { CaseSource } from "@complaint-system/shared";
import type { CaseDTO } from "../types";
import { useAddTagMutation, useRemoveTagMutation } from "../api/casesApi";
import { Ltr } from "../../../components/Ltr";
import { LinkOrderDialog } from "./dialogs/LinkOrderDialog";
import { LinkItemDialog } from "./dialogs/LinkItemDialog";
import { ContactPointDialog } from "./dialogs/ContactPointDialog";
import { formatDateTime } from "../../../utils/localeFormat";
import { useActiveLanguage } from "../../../i18n/useActiveLanguage";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Stack spacing={0.25}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      {children}
    </Stack>
  );
}

export function CaseInfoPanel({ caseData }: { caseData: CaseDTO }) {
  const { t } = useTranslation("complaints");
  const language = useActiveLanguage();
  const [newTag, setNewTag] = useState("");
  const [linkOrderOpen, setLinkOrderOpen] = useState(false);
  const [linkItemOpen, setLinkItemOpen] = useState(false);
  const [contactPointOpen, setContactPointOpen] = useState(false);
  const [addTag] = useAddTagMutation();
  const [removeTag] = useRemoveTagMutation();

  const handleAddTag = () => {
    const value = newTag.trim();
    if (!value) return;
    void addTag({ caseId: caseData.id, tag: value });
    setNewTag("");
  };

  const handleTagKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleAddTag();
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="h3" sx={{ mb: 2 }}>
        {t("detail.sections.information")}
      </Typography>

      <Stack spacing={2}>
        <Field label={t("detail.fields.category")}>
          <Typography variant="body2">{t(`category.${caseData.category}`)}</Typography>
        </Field>
        <Field label={t("detail.fields.source")}>
          <Typography variant="body2">{t(`source.${caseData.source}`)}</Typography>
        </Field>
        {caseData.source === CaseSource.SOCIAL_MEDIA && (
          <Field label={t("detail.fields.contactPoint")}>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Typography variant="body2">
                {caseData.contactPoint ? (
                  <>
                    {t(`contactPlatform.${caseData.contactPoint.platform}`)}
                    {caseData.contactPoint.contactId && (
                      <>
                        {" — "}
                        <Ltr>{caseData.contactPoint.contactId}</Ltr>
                      </>
                    )}
                  </>
                ) : (
                  "—"
                )}
              </Typography>
              <IconButton size="small" onClick={() => setContactPointOpen(true)}>
                <EditIcon fontSize="inherit" />
              </IconButton>
            </Stack>
          </Field>
        )}
        <Field label={t("detail.fields.assignedTo")}>
          <Typography variant="body2">{caseData.assignedTo?.name ?? t("detail.unassigned")}</Typography>
        </Field>
        <Field label={t("detail.fields.createdBy")}>
          <Typography variant="body2">{caseData.createdBy?.name ?? "—"}</Typography>
        </Field>
        <Field label={t("detail.fields.createdAt")}>
          <Typography variant="body2">{formatDateTime(caseData.createdAt, language)}</Typography>
        </Field>
        <Field label={t("detail.fields.lastActivityAt")}>
          <Typography variant="body2">{formatDateTime(caseData.lastActivityAt, language)}</Typography>
        </Field>

        <Divider />

        <Field label={t("detail.fields.tags")}>
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
            {caseData.tags.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                —
              </Typography>
            )}
            {caseData.tags.map((tag) => (
              <Chip
                key={tag}
                label={tag}
                size="small"
                onDelete={() => removeTag({ caseId: caseData.id, tag })}
              />
            ))}
          </Stack>
          <Stack direction="row" spacing={1}>
            <TextField
              size="small"
              placeholder={t("detail.tagDialog.tag")}
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={handleTagKeyDown}
              fullWidth
            />
            <Button size="small" variant="outlined" onClick={handleAddTag} disabled={!newTag.trim()}>
              <AddIcon fontSize="small" />
            </Button>
          </Stack>
        </Field>

        <Divider />

        <Field label={t("detail.fields.relatedOrders")}>
          <Stack spacing={0.5}>
            {caseData.relatedOrders.map((order) => (
              <Chip
                key={order.externalOrderId}
                label={<Ltr>{order.orderNumber}</Ltr>}
                size="small"
                variant="outlined"
              />
            ))}
            <Button size="small" onClick={() => setLinkOrderOpen(true)} sx={{ alignSelf: "flex-start" }}>
              {t("detail.actions.linkOrder")}
            </Button>
          </Stack>
        </Field>

        <Field label={t("detail.fields.relatedItems")}>
          <Stack spacing={0.5}>
            {caseData.relatedItems.map((item) => (
              <Chip
                key={item.externalItemId}
                label={<Ltr>{`${item.title} (${item.sku})`}</Ltr>}
                size="small"
                variant="outlined"
              />
            ))}
            <Button size="small" onClick={() => setLinkItemOpen(true)} sx={{ alignSelf: "flex-start" }}>
              {t("detail.actions.linkItem")}
            </Button>
          </Stack>
        </Field>
      </Stack>

      <LinkOrderDialog open={linkOrderOpen} onClose={() => setLinkOrderOpen(false)} caseId={caseData.id} />
      <LinkItemDialog open={linkItemOpen} onClose={() => setLinkItemOpen(false)} caseId={caseData.id} />
      <ContactPointDialog
        open={contactPointOpen}
        onClose={() => setContactPointOpen(false)}
        caseId={caseData.id}
        currentContactPoint={caseData.contactPoint}
      />
    </Paper>
  );
}
