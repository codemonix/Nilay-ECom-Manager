import type { TFunction } from "i18next";
import type { CaseEventDTO } from "../types";

/**
 * Turns a raw CaseEvent into a human-readable timeline line. Kept in one
 * place so every surface that renders events (timeline, future
 * notifications/reporting) stays consistent.
 */
export function describeEvent(event: CaseEventDTO, t: TFunction<"complaints">): string {
  const data = (event.data ?? {}) as Record<string, unknown>;

  switch (event.type) {
    case "status_changed":
      return t("events.status_changed", {
        from: t(`status.${data.from as string}`, { ns: "complaints" }),
        to: t(`status.${data.to as string}`, { ns: "complaints" }),
      });
    case "resolved":
      return t("events.resolved");
    case "reopened":
      return t("events.reopened");
    case "closed":
      return t("events.closed");
    case "priority_changed":
      return t("events.priority_changed", {
        from: t(`priority.${data.from as string}`, { ns: "complaints" }),
        to: t(`priority.${data.to as string}`, { ns: "complaints" }),
      });
    case "assignment_changed":
      if (!data.toUserName) return t("events.assignment_changed_unassigned");
      if (data.fromUserName) {
        return t("events.assignment_changed_from", { fromUserName: data.fromUserName, toUserName: data.toUserName });
      }
      return t("events.assignment_changed", { toUserName: data.toUserName });
    case "order_linked":
      return t("events.order_linked", { orderNumber: data.orderNumber });
    case "item_linked":
      return t("events.item_linked", { title: data.title, sku: data.sku });
    case "attachment_added":
      return t("events.attachment_added", { filename: data.filename });
    case "tag_added":
      return t("events.tag_added", { tag: data.tag });
    case "tag_removed":
      return t("events.tag_removed", { tag: data.tag });
    case "internal_note":
      return t("events.internal_note");
    case "customer_message":
      return t("events.customer_message");
    case "created":
      return t("events.created");
    default:
      return t("events.note_added");
  }
}

export function describeActor(event: CaseEventDTO, t: TFunction<"complaints">): string {
  return event.actor ? t("events.by", { name: event.actor.name }) : t("events.bySystem");
}
