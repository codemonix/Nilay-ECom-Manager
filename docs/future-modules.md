# Future Module Architecture

V1 implements Complaint / Case Management only. This document describes how
the next five modules attach to the existing architecture **without
rewriting it** — the point of building the foundation this way now.

## General pattern for adding a module

Backend:

1. `models/<Thing>.ts` — a new Mongoose model. If the module needs its own
   event/history log (recommended for anything with a workflow), add a
   `<Thing>Event` model the same way `CaseEvent` works.
2. `repositories/<thing>Repository.ts`, `services/<thing>Service.ts`,
   `controllers/<thing>Controller.ts`, `routes/<thing>Routes.ts` — same
   route → controller → service → repository → model layering as
   `cases/*`. Mount the new router in `routes/index.ts`.
3. If the module needs Shopfa data (e.g. Order Pre-Check needs order line
   items), add methods to the existing `ShopfaClient` interface and both
   implementations — don't create a second Shopfa client.
4. Add Zod validators in `validators/<thing>Validators.ts` and reuse
   `middleware/validate.ts`.

Frontend:

1. `features/<module>/{api,components,pages,hooks,types,utils}` — a new
   feature folder, mirroring `features/complaints`.
2. `features/<module>/api/<thing>Api.ts` — `apiSlice.injectEndpoints(...)`,
   same as `casesApi.ts`. No changes to `services/apiSlice.ts` itself.
3. Add the route in `routes/AppRoutes.tsx` and flip the corresponding item
   in `layouts/MainLayout.tsx#NAV_ITEMS` from `{ key, icon }` (disabled,
   "Coming soon") to `{ key, icon, path }` (enabled).
4. Add a new i18n namespace file (`locales/en/<module>.json` +
   `locales/fa/<module>.json`) and register it in `i18n/i18n.ts`'s `ns` list.

Because `packages/shared` already holds cross-cutting enums/types, a new
module that needs to reference a `Case` (e.g. Packing referencing the case
that flagged a shortage) imports `CaseDTO` from `@complaint-system/shared`
rather than redefining it.

## Module 2 — Order Pre-Check

Workflow: `pending → checking → sufficient | insufficient → ready_for_packing`.

- New model: `OrderCheck` (`externalOrderId`, `status`, `items: [{
  externalItemId, sku, title, orderedQty, availableQty }]`).
- Reuses the existing Shopfa integration for order line items and product
  images (`ShopfaClient.getOrder`).
- UI: a list view showing customer name, order number, product image,
  ordered quantity; when `orderedQty > availableQty`, highlight the quantity
  cell (color **and** an icon/label, per this project's rule that priority/
  status is never color-only — see `components/PriorityChip.tsx` for the
  established pattern to follow). Staff can edit `availableQty` inline.
- This can optionally create a `Case` automatically (category `product`,
  tag `shortage`) when an order is marked `insufficient`, reusing
  `caseService.createCase` — this is exactly why Case creation is a plain
  service function and not something buried in a controller.

## Module 3 — Packing

Workflow: only orders with `OrderCheck.status = "ready_for_packing"` appear.

- New model: `PackingSession` (`externalOrderId`, `items: [{ ..., packed:
  boolean }]`, `photoAttachmentId`, `completedAt`).
- Reuses the `Attachment` model/pattern from V1 (same `storageProvider`
  abstraction) for the packaged-order photo — no new upload infrastructure
  needed, just a new `caseId`-less usage of the same attachment
  service/multer config (generalize `attachmentService.addAttachment` to
  accept a polymorphic `subjectType`/`subjectId` instead of only `caseId`
  when this module is built).
- UI: tap-to-complete item checklist (green on confirm), camera/file capture
  for the final package photo.

## Module 4 — Purchasing

- New model: `Purchase` (`photoAttachmentId`, `price`, `quantity`,
  `shopfaProductId` — nullable until the "website inventory updater" step
  links it).
- Reuses `Attachment` for the product photo.
- The later "enter Shopfa stock/product id" step is a `PATCH` that fills in
  `shopfaProductId`, at which point this becomes the seam back into Shopfa's
  own inventory (still one-directional: we never write Shopfa's live catalog
  from here in V1 scope, we only record the mapping).

## Module 5 — Reporting

This is why `CaseEvent` was designed as an append-only, structured log
instead of ad-hoc counters:

- *"Which complaint categories are increasing?"* → aggregate `CaseEvent`
  where `type = "created"`, grouped by `data.category` (already stored on
  the `created` event), bucketed by week/month.
- *"Which products generate the most returns?"* → aggregate `Case` where
  `category = "return"`, joined through `relatedItems.sku`.
- *"Which staff members have the most unresolved cases?"* → aggregate
  `Case` where `status` not in `[resolved, closed]`, grouped by
  `assignedTo`.
- *"How many items are currently insufficient to fulfill open orders?"*
  (once Module 2 exists) → aggregate `OrderCheck` where
  `status = "insufficient"`.

All of these are MongoDB aggregation pipelines over collections that already
exist by the time this module is built — no new "analytics" tables, and
nothing to keep in sync, because the source data (`Case`, `CaseEvent`, and
later `OrderCheck`/`PackingSession`/`Purchase`) is already the durable
record of what happened.

New backend surface for this module is read-only: a `reportsController.ts`
+ `reportsService.ts` that run aggregation pipelines and return DTOs; no new
write paths are needed, keeping this module lower-risk than the others.
