import { useEffect, useState } from "react";
import type { ImportedOrderDTO, OrderSummaryDTO } from "@complaint-system/shared";
import { useLazyListImportedOrdersQuery } from "../../settings/api/importedOrdersApi";
import { useLazySearchShopOrdersQuery } from "../../customers/api/customersApi";
import type { MatchedCustomerOrder } from "../types";

function fromImportedOrder(order: ImportedOrderDTO): MatchedCustomerOrder {
  return {
    source: "imported",
    externalOrderId: order.externalOrderId,
    orderNumber: order.externalOrderId,
    externalCustomerId: order.buyer.externalBuyerId,
    customerName: order.buyer.fullName,
    customerPhone: order.buyer.mobile,
    purchaseDate: order.purchaseDate,
    totalAmount: order.totalAmount,
  };
}

/** Live Shopfa orders without an identifiable customer (e.g. legacy/guest data) can't be matched to a case, so they're skipped rather than shown with placeholder identity. */
function fromLiveOrder(order: OrderSummaryDTO): MatchedCustomerOrder | null {
  if (!order.customerName) return null;
  return {
    source: "live",
    externalOrderId: order.externalOrderId,
    orderNumber: order.orderNumber,
    externalCustomerId: order.externalCustomerId ?? order.externalOrderId,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    purchaseDate: order.createdAt,
    totalAmount: order.total,
  };
}

/**
 * Searches for the order(s) behind a customer-name/phone/order-id query,
 * across both the live Shopfa API and imported orders, merging the results.
 * Case creation is matched against orders rather than Shopfa's registered
 * "users" list because most storefront customers check out as guests --
 * their name/phone/email only ever exist on their orders, not a user
 * account (see /api/user/users vs. /api/shop/orders in the Shopfa API).
 */
export function useOrderCustomerSearch(query: string, minLength = 2) {
  const [triggerLive] = useLazySearchShopOrdersQuery();
  const [triggerImported] = useLazyListImportedOrdersQuery();
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
      Promise.all([
        triggerLive(trimmed)
          .unwrap()
          .catch(() => [] as OrderSummaryDTO[]),
        triggerImported({ page: 1, pageSize: 10, search: trimmed })
          .unwrap()
          .then((r) => r.items)
          .catch(() => [] as ImportedOrderDTO[]),
      ])
        .then(([live, imported]) => {
          if (cancelled) return;
          const merged = new Map<string, MatchedCustomerOrder>();
          imported.forEach((order) => merged.set(`imported:${order.externalOrderId}`, fromImportedOrder(order)));
          live.forEach((order) => {
            const matched = fromLiveOrder(order);
            if (matched) merged.set(`live:${matched.externalOrderId}`, matched);
          });
          setOptions(Array.from(merged.values()));
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query, minLength, triggerLive, triggerImported]);

  return { options, isLoading };
}
