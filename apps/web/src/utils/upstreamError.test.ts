import { describe, expect, it } from "vitest";
import { getAutoRetryDelaySeconds, getUpstreamErrorKind } from "./upstreamError";

describe("getUpstreamErrorKind", () => {
  it("recognizes a 502 UPSTREAM_ERROR from our API", () => {
    expect(getUpstreamErrorKind({ status: 502, data: { error: { code: "UPSTREAM_ERROR" } } })).toBe("upstream");
  });
  it("recognizes the API itself being unreachable", () => {
    expect(getUpstreamErrorKind({ status: "FETCH_ERROR", error: "x" })).toBe("network");
  });
  it("ignores non-retryable errors", () => {
    expect(getUpstreamErrorKind({ status: 422, data: { error: { code: "VALIDATION_ERROR" } } })).toBeNull();
    expect(getUpstreamErrorKind({ status: 502, data: {} })).toBeNull();
    expect(getUpstreamErrorKind(undefined)).toBeNull();
  });
});

describe("getAutoRetryDelaySeconds", () => {
  it("backs off and eventually stops", () => {
    expect(getAutoRetryDelaySeconds(0)).toBe(10);
    expect(getAutoRetryDelaySeconds(1)).toBe(20);
    expect(getAutoRetryDelaySeconds(5)).toBeNull();
  });
});
