import type { PackageDTO, PackageEventDTO, PackageItemDTO, PackageListQuery } from "@complaint-system/shared";

export type { PackageDTO, PackageItemDTO, PackageEventDTO, PackageListQuery };

export interface PackageListResult {
  items: PackageDTO[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** Mirrors apps/api's serializeAttachment output for a package-scoped attachment. */
export interface PackageAttachmentDTO {
  id: string;
  subjectType: "case" | "package";
  subjectId: string;
  originalFilename: string;
  storedFilename: string;
  mimeType: string;
  size: number;
  url: string;
  uploadedBy: string | null;
  createdAt: string;
}
