/**
 * Central source of truth for purchasing-package-related enums, mirroring
 * the caseEnums.ts pattern so the backend (packageStatusTransitionService)
 * and frontend (UI only offers valid next statuses) never drift apart.
 *
 * Package lifecycle (3 stages, each a one-way handoff between roles):
 *  - draft:       purchasing is assembling the package (adding items, each
 *                 with a photo/quantity/price).
 *  - in_progress: the package has been handed to the shipping company --
 *                 purchasing's work on it is done; it's in transit.
 *  - completed:   confirmed received at the destination -- set exclusively
 *                 by the separate Receiving module (see MenuKey.RECEIVING),
 *                 never directly by a purchasing user.
 * Matching a package's items to a Shopfa product code can happen during any
 * of these stages -- it is not gated by package status.
 */
export const PackageStatus = {
  DRAFT: "draft",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
} as const;
export type PackageStatus = (typeof PackageStatus)[keyof typeof PackageStatus];
export const PACKAGE_STATUS_VALUES = Object.values(PackageStatus);

export const PACKAGE_STATUS_TRANSITIONS: Record<PackageStatus, PackageStatus[]> = {
  [PackageStatus.DRAFT]: [PackageStatus.IN_PROGRESS],
  [PackageStatus.IN_PROGRESS]: [PackageStatus.COMPLETED],
  [PackageStatus.COMPLETED]: [],
};

export function isValidPackageStatusTransition(from: PackageStatus, to: PackageStatus): boolean {
  if (from === to) return false;
  return PACKAGE_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

export const PackageEventType = {
  CREATED: "created",
  ITEM_RECEIVED: "item_received",
  ITEM_UPDATED: "item_updated",
  ITEM_REMOVED: "item_removed",
  ITEM_MATCHED: "item_matched",
  ITEM_UNMATCHED: "item_unmatched",
  STATUS_CHANGED: "status_changed",
  RECEIVED_QUANTITY_UPDATED: "received_quantity_updated",
  ATTACHMENT_ADDED: "attachment_added",
} as const;
export type PackageEventType = (typeof PackageEventType)[keyof typeof PackageEventType];
export const PACKAGE_EVENT_TYPE_VALUES = Object.values(PackageEventType);

/** Subject an Attachment belongs to -- see models/Attachment.ts's subjectType/subjectId generalization. */
export const AttachmentSubjectType = {
  CASE: "case",
  PACKAGE: "package",
} as const;
export type AttachmentSubjectType = (typeof AttachmentSubjectType)[keyof typeof AttachmentSubjectType];
export const ATTACHMENT_SUBJECT_TYPE_VALUES = Object.values(AttachmentSubjectType);
