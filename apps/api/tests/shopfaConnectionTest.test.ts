import { beforeEach, describe, expect, it, vi } from "vitest";

const post = vi.fn();

vi.mock("axios", async (importOriginal) => {
  const actual = await importOriginal<typeof import("axios")>();
  return {
    default: { ...actual.default, post, isAxiosError: actual.default.isAxiosError },
  };
});

vi.mock("../src/config/env", () => ({
  env: { SHOPFA_API_BASE_URL: "https://www.example-shop.com", SHOPFA_API_TOKEN: "test-token" },
}));

const { testShopfaConnection } = await import("../src/integrations/shopfa/shopfaConnectionTest");

describe("testShopfaConnection (Settings page connectivity check)", () => {
  beforeEach(() => {
    post.mockReset();
  });

  it("reports success only once both the base connectivity AND the authenticated check pass", async () => {
    post
      .mockResolvedValueOnce({
        status: 200,
        data: { successful: true, title: "Nilay Jewelry", domain: "nilayjewelry.com", url: "https://nilayjewelry.com/" },
      })
      .mockResolvedValueOnce({ status: 200, data: { items: [] } });

    const result = await testShopfaConnection();

    expect(post).toHaveBeenNthCalledWith(
      1,
      "https://www.example-shop.com/api/system/info",
      {},
      expect.objectContaining({ timeout: 10_000 }),
    );
    expect(post).toHaveBeenNthCalledWith(
      2,
      "https://www.example-shop.com/api/user/users",
      {},
      expect.objectContaining({ params: { private_key: "test-token", limit: 1 } }),
    );
    expect(result).toMatchObject({
      ok: true,
      shop: { title: "Nilay Jewelry", domain: "nilayjewelry.com", url: "https://nilayjewelry.com/" },
    });
  });

  it("reports failure when the base /api/system/info call itself fails, without attempting the auth check", async () => {
    post.mockResolvedValueOnce({ status: 200, data: { successful: false, error: "site disabled" } });
    const result = await testShopfaConnection();
    expect(result.ok).toBe(false);
    expect(result.message).toBe("site disabled");
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("reports failure -- with the shop info still attached -- when the token is rejected on the authenticated check (this is what actually validates the credential, since /api/system/info needs none)", async () => {
    post
      .mockResolvedValueOnce({ status: 200, data: { successful: true, title: "Nilay Jewelry", domain: "nilayjewelry.com" } })
      .mockResolvedValueOnce({ status: 400, data: { error: "دسترسی فقط برای اعضا ممکن است", error_code: 15000 } });

    const result = await testShopfaConnection();

    expect(result.ok).toBe(false);
    expect(result.shop).toMatchObject({ title: "Nilay Jewelry" });
    expect(result.message).toContain("دسترسی فقط برای اعضا ممکن است");
  });

  it("reports failure without throwing when the request itself fails (e.g. DNS/timeout)", async () => {
    post.mockRejectedValueOnce(Object.assign(new Error("timeout of 10000ms exceeded"), { isAxiosError: true }));
    const result = await testShopfaConnection();
    expect(result.ok).toBe(false);
    expect(result.message).toContain("timeout");
  });
});
