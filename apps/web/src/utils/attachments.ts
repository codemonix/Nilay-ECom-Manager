import { API_ORIGIN } from "../services/apiSlice";

/** Resolves an attachment id (e.g. a package item's photoAttachmentId) to a fully-qualified URL, given the subject's attachment list. */
export function resolvePhotoUrl(attachmentId: string | null, attachments: { id: string; url: string }[]): string | null {
  if (!attachmentId) return null;
  const attachment = attachments.find((a) => a.id === attachmentId);
  return attachment ? `${API_ORIGIN}${attachment.url}` : null;
}

/** Uploaded files are served by the API, not the web app: turns an API-relative `/uploads/...` path into a URL the browser can load from any origin setup. */
export function resolveUploadUrl(path: string): string {
  return `${API_ORIGIN}${path}`;
}
