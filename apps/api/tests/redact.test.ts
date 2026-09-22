import { describe, expect, it } from "vitest";
import axios from "axios";
import { createRedactor } from "../src/utils/redact";

const { redact, scrubString } = createRedactor(["super-secret-literal-value"]);

describe("redactor", () => {
  it("masks values under sensitive keys, at any depth", () => {
    const out = redact({ params: { private_key: "abc123", status: 13 }, headers: { Authorization: "Bearer xyz" }, list: [{ password: "pw" }] });
    expect(JSON.stringify(out)).not.toMatch(/abc123|xyz|"pw"/);
    expect((out as { params: { status: number } }).params.status).toBe(13);
  });

  it("scrubs secrets embedded in strings", () => {
    expect(scrubString("GET /x?private_key=abc123&page=1")).toBe("GET /x?private_key=[REDACTED]&page=1");
    expect(scrubString("Bearer abc.def.ghi")).toBe("Bearer [REDACTED]");
    expect(scrubString("mongodb://user:hunter2@host/db")).toBe("mongodb://user:[REDACTED]@host/db");
    expect(scrubString("value super-secret-literal-value here")).toBe("value [REDACTED] here");
  });

  it("reduces axios errors to a safe subset without params, headers or body", () => {
    const err = new axios.AxiosError("boom", "ENOTFOUND", {
      baseURL: "https://shop.example",
      url: "/api/shop/orders",
      method: "post",
      params: { private_key: "topsecretkey123" },
      headers: { Authorization: "Bearer leaked" } as never,
      data: "{}",
    } as never);
    const text = JSON.stringify(redact({ err }));
    expect(text).not.toMatch(/topsecretkey123|leaked/);
    expect(text).toContain("ENOTFOUND");
    expect(text).toContain("/api/shop/orders");
  });

  it("survives circular references", () => {
    const a: Record<string, unknown> = { name: "a" };
    a.self = a;
    expect((redact(a) as { self: unknown }).self).toBe("[Circular]");
  });
});
