import { useCallback } from "react";
import { IMAGE_UPLOAD_LIMITS } from "@complaint-system/shared";
import { useGetAppConfigQuery } from "../api/settingsApi";
import { prepareImageUpload } from "../../../utils/imageCompression";

/**
 * Returns the function every upload runs its file through before sending:
 * images are compressed to fit the admin-configured size limit
 * (Settings -> Image uploads), other files pass through unchanged.
 */
export function usePrepareImageUpload(): (file: File) => Promise<File> {
  const { data: appConfig } = useGetAppConfigQuery();
  const maxMB = appConfig?.maxImageUploadSizeMB ?? IMAGE_UPLOAD_LIMITS.maxImageUploadSizeMB.default;
  return useCallback((file: File) => prepareImageUpload(file, Math.round(maxMB * 1024 * 1024)), [maxMB]);
}
