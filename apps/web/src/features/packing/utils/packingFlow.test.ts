import { describe, expect, it } from "vitest";
import { decideMove, decideSave } from "./packingFlow";

describe("Packing Dialog A (Save)", () => {
  it("saves straight away once at least one picture exists", () => {
    expect(decideSave({ photoCount: 1 })).toBe("send");
    expect(decideSave({ photoCount: 4 })).toBe("send");
  });

  it("warns when no picture was taken", () => {
    expect(decideSave({ photoCount: 0 })).toBe("warn_no_picture");
  });
});

describe("Packing Dialog B (moving to the next customer)", () => {
  it("warns when leaving a fully green group with no picture", () => {
    expect(decideMove({ leavingGroup: true, allItemsMarkedGreen: true, photoCount: 0 })).toBe("warn_no_picture");
  });

  it("moves freely when the group has a picture, even if unsaved", () => {
    expect(decideMove({ leavingGroup: true, allItemsMarkedGreen: true, photoCount: 1 })).toBe("move");
  });

  it("moves freely when the group isn't fully green yet (packing in progress)", () => {
    expect(decideMove({ leavingGroup: true, allItemsMarkedGreen: false, photoCount: 0 })).toBe("move");
  });

  it("never warns when moving between orders of the same group", () => {
    expect(decideMove({ leavingGroup: false, allItemsMarkedGreen: true, photoCount: 0 })).toBe("move");
  });
});
