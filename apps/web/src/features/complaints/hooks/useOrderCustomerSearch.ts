import { useEffect, useState } from "react";
import type { OrderSummaryDTO } from "@complaint-system/shared";
import { useLazySearchShopOrdersQuery } from "../../customers/api/customersApi";
import type { MatchedCustomerOrder } from "../types";

/** Orders without an identifiable customer (e.g. legacy/guest data) can't be matched to a case, so they're skipped rather than shown with placeholder identity. */
function fromOrder(order: OrderSummaryDTO): MatchedCustomerOrder | null {
  if (!order.customerName) return null;
  return {
    externalOrderId: order.externalOrderId,
    orderNumber: order.orderNumber,
    externalCustomerId: order.externalCustomerId ?? order.externalOrderId,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    purchaseDate: order.createdAt,
    totalAmount: order.total,
    items: order.items,
  };
}

/**
 * Searches for the order(s) behind a customer-name/phone/order-id query.
 * Case creation is matched against orders rather than Shopfa's registered
 * "users" list because most storefront customers check out as guests --
 * their name/phone/email only ever exist on their orders, not a user
 * account (see /api/user/users vs. /api/shop/orders in the Shopfa API).
 */
export function useOrderCustomerSearch(query: string, minLength = 2) {
  const [triggerSearch] = useLazySearchShopOrdersQuery();
  const [options, setOptions] = useState<MatchedCustomerOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < minLength) {
      setOptions([]);
      return;
    }

    let cancelled = false;
    const handle = setTimeout(() => {
      setIsLoading(true);
      triggerSearch(trimmed)
        .unwrap()
        .then((orders) => {
          if (cancelled) return;
          setOptions(orders.map(fromOrder).filter((order): order is MatchedCustomerOrder => order !== null));
        })
        .catch(() => {
          if (!cancelled) setOptions([]);
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query, minLength, triggerSearch]);

  return { options, isLoading };
}
