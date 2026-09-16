import {
  PACKAGE_STATUS_TRANSITIONS,
  isValidPackageStatusTransition,
  type PackageStatus,
} from "@complaint-system/shared";
import { ApiError } from "../utils/ApiError";

export function assertValidPackageStatusTransition(from: PackageStatus, to: PackageStatus): void {
  if (!isValidPackageStatusTransition(from, to)) {
    throw ApiError.conflict(`Cannot transition package status from "${from}" to "${to}"`, {
      from,
      to,
      allowedNextStatuses: PACKAGE_STATUS_TRANSITIONS[from] ?? [],
    });
  }
}
