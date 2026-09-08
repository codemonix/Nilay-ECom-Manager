import { getShopfaClient } from "../integrations/shopfa";
import { ApiError } from "../utils/ApiError";

export async function getCustomerSummary(externalCustomerId: string, phone?: string) {
  const client = await getShopfaClient();
  const summary = await client.getCustomerOrderSummary(externalCustomerId, phone);
  if (!summary) throw ApiError.notFound("Customer not found");
  return summary;
}

export async function searchCustomers(query: string) {
  const client = await getShopfaClient();
  return client.searchCustomer(query);
}

/** Read-only order lookup against the active Shopfa client, used by case creation to let staff pick a real order instead of typing an id by hand. Never creates/updates/deletes anything on Shopfa. */
export async function searchOrders(query: string) {
  const client = await getShopfaClient();
  return client.searchOrders(query);
}

export async function getOrderSummary(externalOrderId: string) {
  const client = await getShopfaClient();
  const order = await client.getOrder(externalOrderId);
  if (!order) throw ApiError.notFound("Order not found");
  return order;
}
