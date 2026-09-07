import {
  CASE_STATUS_TRANSITIONS,
  isValidStatusTransition,
  type CaseStatus,
} from "@complaint-system/shared";
import { ApiError } from "../utils/ApiError";

export function assertValidStatusTransition(from: CaseStatus, to: CaseStatus): void {
  if (!isValidStatusTransition(from, to)) {
    throw ApiError.conflict(`Cannot transition case status from "${from}" to "${to}"`, {
      from,
      to,
      allowedNextStatuses: CASE_STATUS_TRANSITIONS[from] ?? [],
    });
  }
}
