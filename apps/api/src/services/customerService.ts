import { getShopfaClient } from "../integrations/shopfa";
import { ApiError } from "../utils/ApiError";

export async function getCustomerSummary(externalCustomerId: string) {
  const summary = await getShopfaClient().getCustomerOrderSummary(externalCustomerId);
  if (!summary) throw ApiError.notFound("Customer not found");
  return summary;
}

export async function searchCustomers(query: string) {
  return getShopfaClient().searchCustomer(query);
}
