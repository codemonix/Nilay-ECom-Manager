import { describe, expect, it } from "vitest";
import { formatCurrency, formatDate, formatNumber } from "./localeFormat";

describe("localeFormat", () => {
  it("formats numbers using the English locale", () => {
    expect(formatNumber(12345, "en")).toBe("12,345");
  });

  it("formats numbers using Persian digits for the Persian locale", () => {
    const result = formatNumber(12345, "fa");
    // Persian locale renders digits with the Extended Arabic-Indic numbering system.
    expect(result).not.toBe("12,345");
    expect(result).toMatch(/[۰-۹]/);
  });

  it("formats currency without corrupting the numeric magnitude", () => {
    const enResult = formatCurrency(1500000, "en", "IRR");
    expect(enResult).toContain("1,500,000");
  });

  it("formats dates for both locales without throwing", () => {
    expect(() => formatDate("2026-09-03T10:00:00.000Z", "en")).not.toThrow();
    expect(() => formatDate("2026-09-03T10:00:00.000Z", "fa")).not.toThrow();
  });
});
