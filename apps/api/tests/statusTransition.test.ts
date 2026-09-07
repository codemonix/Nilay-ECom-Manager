import { describe, expect, it } from "vitest";
import { CaseStatus, isValidStatusTransition } from "@complaint-system/shared";
import { assertValidStatusTransition } from "../src/services/statusTransitionService";
import { ApiError } from "../src/utils/ApiError";

describe("Case status transitions", () => {
  it("allows the documented forward workflow", () => {
    expect(isValidStatusTransition(CaseStatus.OPEN, CaseStatus.IN_PROGRESS)).toBe(true);
    expect(isValidStatusTransition(CaseStatus.IN_PROGRESS, CaseStatus.WAITING_FOR_CUSTOMER)).toBe(true);
    expect(isValidStatusTransition(CaseStatus.IN_PROGRESS, CaseStatus.WAITING_FOR_INTERNAL_ACTION)).toBe(true);
    expect(isValidStatusTransition(CaseStatus.WAITING_FOR_CUSTOMER, CaseStatus.IN_PROGRESS)).toBe(true);
    expect(isValidStatusTransition(CaseStatus.IN_PROGRESS, CaseStatus.RESOLVED)).toBe(true);
    expect(isValidStatusTransition(CaseStatus.RESOLVED, CaseStatus.CLOSED)).toBe(true);
    expect(isValidStatusTransition(CaseStatus.RESOLVED, CaseStatus.OPEN)).toBe(true);
    expect(isValidStatusTransition(CaseStatus.CLOSED, CaseStatus.OPEN)).toBe(true);
  });

  it("rejects skipping straight from open to resolved", () => {
    expect(isValidStatusTransition(CaseStatus.OPEN, CaseStatus.RESOLVED)).toBe(false);
    expect(() => assertValidStatusTransition(CaseStatus.OPEN, CaseStatus.RESOLVED)).toThrow(ApiError);
  });

  it("rejects transitioning a status to itself", () => {
    expect(isValidStatusTransition(CaseStatus.IN_PROGRESS, CaseStatus.IN_PROGRESS)).toBe(false);
  });

  it("rejects acting on a closed case without reopening it first", () => {
    expect(isValidStatusTransition(CaseStatus.CLOSED, CaseStatus.IN_PROGRESS)).toBe(false);
  });
});
