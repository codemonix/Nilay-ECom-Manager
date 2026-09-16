import type { ShopfaRawCustomer, ShopfaRawOrder } from "./shopfaTypes";

/**
 * Realistic mock data standing in for the Shopfa jewelry storefront so the
 * whole application can be developed and demoed without real Shopfa
 * credentials (SHOPFA_MOCK=true). Also reused by apps/api/scripts/seed.ts
 * so seeded cases reference customers/orders that resolve consistently
 * through the mock Shopfa client.
 */
export const MOCK_CUSTOMERS: ShopfaRawCustomer[] = [
  { id: "cust_1001", full_name: "Ali Ahmadi", phone_number: "+98 912 111 2233", email: "ali.ahmadi@example.com", orders_count: 17, total_spent: "48250000", currency: "IRR", last_order_at: "2026-08-20T10:15:00.000Z" },
  { id: "cust_1002", full_name: "Sara Mohammadi", phone_number: "+98 912 222 3344", email: "sara.m@example.com", orders_count: 9, total_spent: "21300000", currency: "IRR", last_order_at: "2026-08-28T14:40:00.000Z" },
  { id: "cust_1003", full_name: "Reza Karimi", phone_number: "+98 912 333 4455", email: "reza.karimi@example.com", orders_count: 3, total_spent: "6420000", currency: "IRR", last_order_at: "2026-07-02T09:05:00.000Z" },
  { id: "cust_1004", full_name: "Maryam Hosseini", phone_number: "+98 912 444 5566", email: "maryam.h@example.com", orders_count: 24, total_spent: "112500000", currency: "IRR", last_order_at: "2026-09-01T11:20:00.000Z" },
  { id: "cust_1005", full_name: "Amir Rostami", phone_number: "+98 912 555 6677", email: "amir.rostami@example.com", orders_count: 1, total_spent: "1850000", currency: "IRR", last_order_at: "2026-05-14T16:00:00.000Z" },
  { id: "cust_1006", full_name: "Neda Sadeghi", phone_number: "+98 912 666 7788", email: "neda.sadeghi@example.com", orders_count: 6, total_spent: "15900000", currency: "IRR", last_order_at: "2026-08-10T08:30:00.000Z" },
  { id: "cust_1007", full_name: "Hossein Jafari", phone_number: "+98 912 777 8899", email: "h.jafari@example.com", orders_count: 12, total_spent: "39800000", currency: "IRR", last_order_at: "2026-08-25T13:10:00.000Z" },
  { id: "cust_1008", full_name: "Fatemeh Moradi", phone_number: "+98 912 888 9900", email: "fatemeh.moradi@example.com", orders_count: 2, total_spent: "3200000", currency: "IRR", last_order_at: "2026-06-18T12:00:00.000Z" },
  { id: "cust_1009", full_name: "Omid Ghasemi", phone_number: "+98 912 999 0011", email: "omid.ghasemi@example.com", orders_count: 8, total_spent: "27600000", currency: "IRR", last_order_at: "2026-08-30T17:45:00.000Z" },
  { id: "cust_1010", full_name: "Elham Rahimi", phone_number: "+98 912 000 1122", email: "elham.rahimi@example.com", orders_count: 15, total_spent: "63400000", currency: "IRR", last_order_at: "2026-08-15T19:25:00.000Z" },
  { id: "cust_1011", full_name: "Kaveh Norouzi", phone_number: "+98 912 121 2121", email: "kaveh.norouzi@example.com", orders_count: 5, total_spent: "11200000", currency: "IRR", last_order_at: "2026-07-22T10:00:00.000Z" },
  { id: "cust_1012", full_name: "Parisa Amini", phone_number: "+98 912 343 4343", email: "parisa.amini@example.com", orders_count: 20, total_spent: "89700000", currency: "IRR", last_order_at: "2026-08-29T09:50:00.000Z" },
];

const PRODUCTS: Array<{ sku: string; title: string }> = [
  { sku: "NCK-GLD-001", title: "18k Gold Necklace - Classic Chain" },
  { sku: "RNG-DMD-014", title: "Diamond Solitaire Ring" },
  { sku: "ERR-PRL-007", title: "Pearl Drop Earrings" },
  { sku: "BRC-SLV-022", title: "Sterling Silver Bracelet" },
  { sku: "NCK-EMR-003", title: "Emerald Pendant Necklace" },
  { sku: "RNG-GLD-009", title: "18k Gold Wedding Band" },
  { sku: "ERR-GLD-011", title: "Gold Hoop Earrings" },
  { sku: "BRC-GLD-018", title: "Gold Tennis Bracelet" },
];

function pseudoRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

/**
 * Fixture product catalog for Purchasing's "Match & Register" step
 * (ShopfaClient.getProductByCode), so it's demoable/testable without live
 * Shopfa access. Codes are arbitrary but stable across test runs.
 */
export const MOCK_PRODUCT_CODES: Array<{
  code: string;
  shopfaProductId: string;
  sku: string;
  title: string;
  price: number;
  availableQuantity: number;
}> = [
  ...PRODUCTS.map((product, i) => ({
    code: `SHF-${1000 + i}`,
    shopfaProductId: `prod_${1000 + i}`,
    sku: product.sku,
    title: product.title,
    price: 1_000_000 + i * 250_000,
    availableQuantity: Math.floor(pseudoRandom(i + 1) * 40),
  })),
  // A title ending in "*" -- Shopfa's own convention this store uses to flag
  // something for inventory follow-up. Kept separate from PRODUCTS above so
  // adding it doesn't shift the pseudo-random product selection MOCK_ORDERS relies on.
  // Zero stock illustrates the plausible real-world meaning of the "*" flag.
  { code: "SHF-STAR", shopfaProductId: "prod_star", sku: "RNG-DMD-099", title: "Diamond Eternity Ring*", price: 4_500_000, availableQuantity: 0 },
];

export const MOCK_ORDERS: ShopfaRawOrder[] = MOCK_CUSTOMERS.flatMap((customer, ci) => {
  const orderCount = Math.min(3, Math.max(1, Math.floor(customer.orders_count / 6) + 1));
  return Array.from({ length: orderCount }).map((_, oi) => {
    const idx = ci * 10 + oi;
    const product = PRODUCTS[Math.floor(pseudoRandom(idx + 1) * PRODUCTS.length)]!;
    const quantity = 1 + Math.floor(pseudoRandom(idx + 2) * 3);
    const daysAgo = Math.floor(pseudoRandom(idx + 3) * 60);
    const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
    return {
      id: `ord_${1000 + idx}`,
      order_number: `SF-${20260000 + idx}`,
      customer_id: customer.id,
      created_at: createdAt,
      status: ["processing", "shipped", "delivered"][idx % 3]!,
      total: String(1500000 + Math.floor(pseudoRandom(idx + 4) * 8000000)),
      currency: "IRR",
      items: [
        {
          item_id: `item_${product.sku}`,
          sku: product.sku,
          title: product.title,
          quantity,
        },
      ],
    };
  });
});
