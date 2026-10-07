import type { TFunction } from "i18next";
import type { CreateOrderCaseResultDTO } from "@complaint-system/shared";

/** What to tell staff after a case was raised from an order screen: a warning when Shopfa could not be updated and the order still needs changing by hand. */
export function describeOrderCaseResult(
  result: CreateOrderCaseResultDTO,
  t: TFunction<"complaints">,
): { severity: "success" | "warning"; message: string } {
  const params = { caseNumber: result.case.caseNumber, orderNumber: result.case.relatedOrders[0]?.orderNumber ?? "" };
  return result.orderSynced
    ? { severity: "success", message: t("orderCase.created", params) }
    : { severity: "warning", message: t("orderCase.createdNotSynced", params) };
}
