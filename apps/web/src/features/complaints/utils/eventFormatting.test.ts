import { describe, expect, it } from "vitest";
import type { TFunction } from "i18next";
import { describeActor, describeEvent } from "./eventFormatting";
import type { CaseEventDTO } from "../types";

const fakeT = ((key: string, options?: Record<string, unknown>) => {
  if (!options) return key;
  return `${key}:${Object.entries(options)
    .map(([k, v]) => `${k}=${String(v)}`)
    .join(",")}`;
}) as unknown as TFunction<"complaints">;

function makeEvent(overrides: Partial<CaseEventDTO>): CaseEventDTO {
  return {
    id: "evt1",
    caseId: "case1",
    type: "status_changed",
    actor: null,
    body: null,
    data: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("describeEvent", () => {
  it("describes a status change with from/to", () => {
    const event = makeEvent({ type: "status_changed", data: { from: "open", to: "in_progress" } });
    expect(describeEvent(event, fakeT)).toContain("from=status.open");
    expect(describeEvent(event, fakeT)).toContain("to=status.in_progress");
  });

  it("describes an unassigned assignment change", () => {
    const event = makeEvent({ type: "assignment_changed", data: { toUserName: null } });
    expect(describeEvent(event, fakeT)).toBe("events.assignment_changed_unassigned");
  });

  it("describes a reassignment between two users", () => {
    const event = makeEvent({
      type: "assignment_changed",
      data: { fromUserName: "Sara", toUserName: "Ali" },
    });
    expect(describeEvent(event, fakeT)).toContain("fromUserName=Sara");
    expect(describeEvent(event, fakeT)).toContain("toUserName=Ali");
  });
});

describe("describeActor", () => {
  it("attributes an event to its actor when present", () => {
    const event = makeEvent({ actor: { id: "u1", name: "Sara" } });
    expect(describeActor(event, fakeT)).toContain("name=Sara");
  });

  it("falls back to system attribution when there is no actor", () => {
    const event = makeEvent({ actor: null });
    expect(describeActor(event, fakeT)).toBe("events.bySystem");
  });
});
