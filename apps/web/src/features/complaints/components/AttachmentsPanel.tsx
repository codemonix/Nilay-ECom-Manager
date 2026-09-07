import { useRef } from "react";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import ImageList from "@mui/material/ImageList";
import ImageListItem from "@mui/material/ImageListItem";
import ImageListItemBar from "@mui/material/ImageListItemBar";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import CircularProgress from "@mui/material/CircularProgress";
import { useTranslation } from "react-i18next";
import { useListAttachmentsQuery, useUploadAttachmentMutation } from "../api/casesApi";
import { API_ORIGIN } from "../../../services/apiSlice";
import { EmptyState } from "../../../components/EmptyState";

export function AttachmentsPanel({ caseId }: { caseId: string }) {
  const { t } = useTranslation("complaints");
  const { data: attachments = [], isLoading } = useListAttachmentsQuery(caseId);
  const [uploadAttachment, { isLoading: isUploading }] = useUploadAttachmentMutation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await uploadAttachment({ caseId, file });
    event.target.value = "";
  };

  return (
    <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="h3">{t("detail.sections.attachments")}</Typography>
        <Button
          size="small"
          variant="outlined"
          startIcon={isUploading ? <CircularProgress size={14} /> : <UploadFileIcon />}
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          {t("attachments.upload")}
        </Button>
        <input ref={fileInputRef} type="file" hidden onChange={handleFileSelected} accept="image/*,application/pdf" />
      </Stack>

      {!isLoading && attachments.length === 0 && <EmptyState message={t("attachments.empty")} />}

      {attachments.length > 0 && (
        <ImageList cols={3} gap={8} sx={{ m: 0 }}>
          {attachments.map((attachment) => {
            const isImage = attachment.mimeType.startsWith("image/");
            const fileUrl = `${API_ORIGIN}${attachment.url}`;
            return (
              <ImageListItem key={attachment.id} sx={{ borderRadius: 1, overflow: "hidden" }}>
                {isImage ? (
                  <img src={fileUrl} alt={attachment.originalFilename} loading="lazy" style={{ height: 120, objectFit: "cover" }} />
                ) : (
                  <Stack
                    component="a"
                    href={fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    alignItems="center"
                    justifyContent="center"
                    sx={{ height: 120, bgcolor: "action.hover", color: "text.secondary" }}
                  >
                    <InsertDriveFileIcon fontSize="large" />
                  </Stack>
                )}
                <ImageListItemBar
                  title={attachment.originalFilename}
                  sx={{ "& .MuiImageListItemBar-title": { fontSize: 12 } }}
                />
              </ImageListItem>
            );
          })}
        </ImageList>
      )}
    </Paper>
  );
}
