/**
 * Central source of truth for case-related enums.
 * Both the API and the web app import these instead of scattering literal
 * strings throughout controllers, services, and UI components.
 */

export const CaseStatus = {
  OPEN: "open",
  IN_PROGRESS: "in_progress",
  WAITING_FOR_CUSTOMER: "waiting_for_customer",
  WAITING_FOR_INTERNAL_ACTION: "waiting_for_internal_action",
  RESOLVED: "resolved",
  CLOSED: "closed",
} as const;
export type CaseStatus = (typeof CaseStatus)[keyof typeof CaseStatus];
export const CASE_STATUS_VALUES = Object.values(CaseStatus);

export const CasePriority = {
  LOW: "low",
  NORMAL: "normal",
  HIGH: "high",
  URGENT: "urgent",
} as const;
export type CasePriority = (typeof CasePriority)[keyof typeof CasePriority];
export const CASE_PRIORITY_VALUES = Object.values(CasePriority);

/**
 * Configurable category list. This is intentionally a plain array (not a
 * hardcoded union baked into the schema as a strict enum only) so new
 * categories can be appended without a breaking schema migration; the API
 * still validates against this list centrally via validators/caseValidators.
 */
export const CaseCategory = {
  ORDER: "order",
  DELIVERY: "delivery",
  PRODUCT: "product",
  PAYMENT: "payment",
  RETURN: "return",
  EXCHANGE: "exchange",
  DAMAGED_ITEM: "damaged_item",
  MISSING_ITEM: "missing_item",
  WRONG_ITEM: "wrong_item",
  QUALITY: "quality",
  OTHER: "other",
} as const;
export type CaseCategory = (typeof CaseCategory)[keyof typeof CaseCategory];
export const CASE_CATEGORY_VALUES = Object.values(CaseCategory);

export const CaseSource = {
  PHONE: "phone",
  EMAIL: "email",
  CHAT: "chat",
  SOCIAL_MEDIA: "social_media",
  SHOPFA: "shopfa",
  IN_PERSON: "in_person",
  OTHER: "other",
} as const;
export type CaseSource = (typeof CaseSource)[keyof typeof CaseSource];
export const CASE_SOURCE_VALUES = Object.values(CaseSource);

export const CaseEventType = {
  CREATED: "created",
  NOTE_ADDED: "note_added",
  INTERNAL_NOTE: "internal_note",
  CUSTOMER_MESSAGE: "customer_message",
  STATUS_CHANGED: "status_changed",
  ASSIGNMENT_CHANGED: "assignment_changed",
  PRIORITY_CHANGED: "priority_changed",
  ORDER_LINKED: "order_linked",
  ITEM_LINKED: "item_linked",
  ATTACHMENT_ADDED: "attachment_added",
  RESOLVED: "resolved",
  REOPENED: "reopened",
  CLOSED: "closed",
  TAG_ADDED: "tag_added",
  TAG_REMOVED: "tag_removed",
} as const;
export type CaseEventType = (typeof CaseEventType)[keyof typeof CaseEventType];
export const CASE_EVENT_TYPE_VALUES = Object.values(CaseEventType);

export const StaffRole = {
  ADMIN: "admin",
  CUSTOMER_SERVICE: "customer_service",
  WAREHOUSE: "warehouse",
  MANAGER: "manager",
  PURCHASING: "purchasing",
} as const;
export type StaffRole = (typeof StaffRole)[keyof typeof StaffRole];
export const STAFF_ROLE_VALUES = Object.values(StaffRole);

/**
 * Allowed case status transitions. Shared between the backend
 * (statusTransitionService enforces this) and the frontend (UI only
 * offers valid next statuses), so the two never drift apart.
 */
export const CASE_STATUS_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  [CaseStatus.OPEN]: [CaseStatus.IN_PROGRESS],
  [CaseStatus.IN_PROGRESS]: [
    CaseStatus.WAITING_FOR_CUSTOMER,
    CaseStatus.WAITING_FOR_INTERNAL_ACTION,
    CaseStatus.RESOLVED,
  ],
  [CaseStatus.WAITING_FOR_CUSTOMER]: [CaseStatus.IN_PROGRESS],
  [CaseStatus.WAITING_FOR_INTERNAL_ACTION]: [CaseStatus.IN_PROGRESS],
  [CaseStatus.RESOLVED]: [CaseStatus.CLOSED, CaseStatus.OPEN],
  [CaseStatus.CLOSED]: [CaseStatus.OPEN],
};

export function isValidStatusTransition(from: CaseStatus, to: CaseStatus): boolean {
  if (from === to) return false;
  return CASE_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}
