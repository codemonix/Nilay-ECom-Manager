import { describe, expect, it } from "vitest";
import axios from "axios";
import Transport from "winston-transport";
import { logger } from "../src/config/logger";

describe("logger redaction", () => {
  it("never emits secrets from axios errors or secret-named meta to any transport", async () => {
    const lines: string[] = [];
    const MESSAGE = Symbol.for("message");
    const capture = new (class extends Transport {
      log(info: Record<symbol, unknown>, cb: () => void) {
        lines.push(String(info[MESSAGE]));
        cb();
      }
    })();
    logger.add(capture);
    const err = new axios.AxiosError("getaddrinfo ENOTFOUND shop.example", "ENOTFOUND", {
      baseURL: "https://shop.example",
      url: "/api/shop/orders",
      params: { private_key: "topsecretkey123" },
    } as never);
    logger.error("Shopfa failed", { err, token: "tok-987654321", url: "/x?private_key=topsecretkey123" });
    logger.remove(capture);

    const out = lines.join("\n");
    expect(out).toContain("ENOTFOUND");
    expect(out).not.toMatch(/topsecretkey123|tok-987654321/);
  });
});
