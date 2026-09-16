import { describe, expect, it } from "vitest";
import {
  buildOrderPrecheckNote,
  parseOrderPrecheckUnavailableCodes,
} from "../src/integrations/shopfa/orderPrecheckNoteMarker";

describe("Order Precheck note marker", () => {
  it("round-trips a single unavailable code through an empty note", () => {
    const note = buildOrderPrecheckNote("", ["7724765"]);
    expect(parseOrderPrecheckUnavailableCodes(note)).toEqual(["7724765"]);
  });

  it("preserves pre-existing free text outside the marker", () => {
    const note = buildOrderPrecheckNote("تست یادداشت مدیر", ["7724765"]);
    expect(note).toContain("تست یادداشت مدیر");
    expect(parseOrderPrecheckUnavailableCodes(note)).toEqual(["7724765"]);
  });

  it("replaces a prior marker with an updated code list on re-save", () => {
    const first = buildOrderPrecheckNote("یادداشت اصلی", ["1111111"]);
    const second = buildOrderPrecheckNote(first, ["1111111", "2222222"]);
    expect(parseOrderPrecheckUnavailableCodes(second)).toEqual(["1111111", "2222222"]);
    expect(second).toContain("یادداشت اصلی");
    expect(second.match(/یادداشت اصلی/g)).toHaveLength(1);
  });

  it("removes the marker entirely once every item becomes available again", () => {
    const marked = buildOrderPrecheckNote("یادداشت اصلی", ["1111111"]);
    const cleared = buildOrderPrecheckNote(marked, []);
    expect(cleared).toBe("یادداشت اصلی");
    expect(parseOrderPrecheckUnavailableCodes(cleared)).toBeNull();
  });

  it("returns null when the note has no marker at all", () => {
    expect(parseOrderPrecheckUnavailableCodes("یادداشت بدون علامت")).toBeNull();
    expect(parseOrderPrecheckUnavailableCodes("")).toBeNull();
  });

  /**
   * Regression test for a bug confirmed live against test order session
   * 4783608554 (2026-09-16): an earlier version of buildOrderPrecheckNote
   * used JSON.stringify (wrapping each code in `"`), and Shopfa
   * HTML-entity-encodes an order note on write, turning those quotes into
   * `&quot;` -- a later read came back as `[&quot;7724765&quot;]`, which
   * JSON.parse rejects, silently losing the restore. The current
   * comma-separated, quote-free format sidesteps this since it never emits
   * a quote character in the first place -- this pins that down.
   */
  it("never emits a quote character that Shopfa's HTML-entity encoding could corrupt", () => {
    const note = buildOrderPrecheckNote("", ["7724765", "1234567"]);
    expect(note).not.toMatch(/["']/);
  });

  it("tolerates HTML-entity-encoded free text elsewhere in the note without losing the marker", () => {
    const note = buildOrderPrecheckNote('یادداشت با &amp; و &quot;نقل‌قول&quot;', ["7724765"]);
    expect(parseOrderPrecheckUnavailableCodes(note)).toEqual(["7724765"]);
  });
});
