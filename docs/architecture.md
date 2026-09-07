# Architecture

## Guiding principle: Shopfa owns commerce data, we own operations

Shopfa (the existing e-commerce platform) is the system of record for
customers, orders, products, and sales. This application is a separate
**internal operations system** layered on top. It never duplicates Shopfa's
database. Instead:

- `Case.customer` stores a **snapshot** (`externalCustomerId`, `name`,
  `phone`, `email`) taken at case-creation time, so a case stays readable
  even if the customer's Shopfa record later changes.
- `Case.relatedOrders` / `Case.relatedItems` store **references**
  (`externalOrderId`/`externalItemId` + a display label), not full order/item
  documents.
- Live data (order counts, total spend, average order value) is fetched
  on-demand from Shopfa through `GET /api/customers/:externalCustomerId/summary`
  — never cached into the Case document, so it's always current.

## Layering (backend)

```
routes/          Express route definitions + validation middleware wiring
  -> controllers/  Thin: parse req, call one service function, format response
    -> services/     Business logic, orchestration, transactions
      -> repositories/  Mongoose queries only, no business rules
        -> models/        Mongoose schemas
    -> integrations/shopfa/  The ONLY place that talks to Shopfa
```

Controllers never import Mongoose models directly, and repositories never
contain business rules (e.g. status-transition validation lives in
`services/statusTransitionService.ts`, not in the repository or model).

Validation is centralized in `validators/*.ts` (Zod schemas) and applied via
a generic `middleware/validate.ts`, so no controller trusts unvalidated input,
and no validation logic is duplicated between routes.

## Case + CaseEvent: the core domain model

`Case` holds **current state**. `CaseEvent` is an **append-only** log of every
change (`created`, `status_changed`, `priority_changed`,
`assignment_changed`, `note_added` variants, `order_linked`, `item_linked`,
`attachment_added`, `resolved`, `reopened`, `closed`, `tag_added`/`tag_removed`).
No route ever updates or deletes a CaseEvent.

Every service function that mutates a case (`changeStatus`, `changePriority`,
`assignCase`, `addNote`, `linkOrder`, `linkItem`, `addTag`, `removeTag`) goes
through one shared helper, `applyCaseMutationWithEvent` in
`services/caseService.ts`, which:

1. Loads the case,
2. Applies the mutation the caller supplies,
3. Bumps `lastActivityAt`,
4. Writes the corresponding `CaseEvent`,

as a single logical operation — see
[docs/database.md](database.md#transactions--consistency) for how this stays
consistent with or without MongoDB transactions available.

This is also why future analytics (module 9/10) doesn't need new counters
scattered around the codebase: **CaseEvent is already the operational
history** to aggregate over (e.g. "how many `status_changed` events to
`resolved` happened this month, grouped by category").

## Shopfa integration

```
services/customerService.ts
  -> integrations/shopfa/index.ts        (factory: mock / live / imported, see below)
    -> integrations/shopfa/shopfaClient.ts             (real HTTP client, axios)
    -> integrations/shopfa/mockShopfaClient.ts         (in-memory mock, dev/test)
    -> integrations/shopfa/importedOrdersShopfaClient.ts (backed by imported-order data)
       all three implement -> shopfaTypes.ts#ShopfaClient (the interface)
    -> integrations/shopfa/shopfaMapper.ts             (raw Shopfa shape -> our DTOs)
```

`customerService.ts` (and any future service) depends only on the
`ShopfaClient` interface, never on `HttpShopfaClient`, `MockShopfaClient`, or
`ImportedOrdersShopfaClient` directly (dependency inversion) — swapping
providers is a one-line change in the factory, not a refactor.

**The frontend never receives a Shopfa credential.** `SHOPFA_API_TOKEN` is
read only in `apps/api/src/config/env.ts` and used only inside
`shopfaClient.ts`.

### Data source: live API vs. imported orders

`HttpShopfaClient` (`shopfaClient.ts`) implements the `ShopfaClient`
interface against the real Shopfa REST API, verified directly against the
live Nilay Jewelry store (its OpenAPI export turned out to be incomplete/
wrong on several points that only surfaced by testing against real
responses — see the conventions documented at the top of
`shopfaApiTypes.ts`). Every Shopfa endpoint is called with HTTP POST, but
Shopfa reads every parameter *including auth* from the query string, not
the JSON body or an Authorization header: a request interceptor injects
`private_key` (the token from `/api/user/signin`) into every call's query
params. Errors come back as a non-2xx HTTP status with `successful: true`
(not `false`!) and an `error`/`error_code` field, so failures are detected
from the HTTP status. `/api/shop/orders` and `/api/shop/orders/details`
(the same underlying list, filtered by `id`) wrap rows under `baskets`;
`/api/user/users` wraps rows under `items`. Shopfa has no single "customer
summary" endpoint, so `getCustomerOrderSummary` derives one by listing that
customer's orders (`POST /api/shop/orders` filtered by `user_id`) and
aggregating; `searchCustomer` uses `POST /api/user/users`. The wire shapes
and this mapping live in `shopfaApiTypes.ts` / `shopfaApiMapper.ts`, kept
separate from the simplified `ShopfaRaw*` shapes in `shopfaTypes.ts` that
back `MockShopfaClient`/`mockData.ts` — the two never need to agree on a
wire format, only on the `ShopfaClient` interface both implement.

Because Shopfa access wasn't available for most of this project, V1 also
ships a stopgap that remains the default: staff export an orders xlsx from
Shopfa and upload it on the Settings page, which parses and stores it in
the `importedorders` collection (see
[database.md](database.md#importedorders)). `getShopfaClient()` in
`integrations/shopfa/index.ts` picks the client at request time:

1. If `SHOPFA_MOCK=true` (local dev/tests), always the static in-memory
   mock, same as before this feature existed.
2. Otherwise it reads the runtime `Settings.dataSource` toggle (the
   Settings page's "live API" switch, backed by `settingsRepository`):
   `"live_api"` returns `HttpShopfaClient`; `"imported_file"` (the default)
   returns `ImportedOrdersShopfaClient`, which serves `getCustomer`,
   `getOrder`, `searchCustomer`, `searchOrders` from the imported-order
   collection instead of an HTTP call.

Because the toggle lives in MongoDB rather than an env var, flipping it on
the Settings page takes effect on the next request with no server restart.
This is also why `getShopfaClient()` is `async` and why
`integrations/shopfa/importedOrdersShopfaClient.ts` is the one place in the
integrations layer allowed to depend on a repository directly (via
`importedOrderRepository`) instead of an HTTP client — it's still just
swapping the *backend* behind the same `ShopfaClient` interface.

The imported-order browse/search surface on the Settings page
(`GET /orders`, `GET /orders/:externalOrderId`) reads the imported-order
collection directly through `orderService.ts`, independent of which
`ShopfaClient` is currently active — it always shows what's actually been
imported, regardless of the live/imported toggle.

## Authentication

V1 intentionally ships without real authentication (per the project brief —
"do not spend excessive time implementing a complicated authentication
system"). Instead:

- `middleware/currentUser.ts` reads an `x-user-id` header, looks up the
  seeded `User`, and attaches `req.currentUser`.
- The frontend's `DevUserSelector` (in the header) lets whoever is using the
  browser pick which seeded staff member they're "acting as"; that choice is
  persisted in `localStorage` and sent as `x-user-id` on every request via
  `services/apiSlice.ts`'s `prepareHeaders`.

Swapping this for real session/JWT auth later means replacing
`attachCurrentUser` with real middleware that populates `req.currentUser` the
same way — **no controller, service, or frontend component needs to change**,
because they only ever depend on `req.currentUser` / the Redux `devUser`
slice, never on how that identity was established.

## Frontend structure

```
src/
  app/            Redux store setup
  components/      Cross-cutting presentational components (StatusChip, Ltr, ...)
  dev/             The V1 development user selector (see Authentication above)
  features/
    complaints/    Case Management (V1) -- api/, components/, pages/, types/, utils/
    customers/     Read-only Shopfa customer summary/search API slice
    settings/      Data-source toggle + xlsx order import + imported-orders browse
    users/         Staff list API slice
  i18n/            react-i18next setup, locale JSON, language hook
  layouts/         MainLayout (app bar, side nav, responsive drawer)
  routes/          React Router route table
  services/        apiSlice.ts -- the single RTK Query base, injected into by each feature
  theme/           createAppTheme(language), RTL emotion cache
  utils/           Locale-aware date/number/currency formatting
```

A future module is added as a new `features/<module>/` folder plus one new
route and one new (disabled -> enabled) nav item in `layouts/MainLayout.tsx`
— it does not touch `features/complaints/*`.

## Shared package dual build

`packages/shared` holds enums, DTO types, and the case-status-transition
table used by *both* apps, so the two can never drift out of sync (e.g. the
frontend only ever offers status transitions the backend will actually
accept, because both read `CASE_STATUS_TRANSITIONS` from the same module).

It's built twice — `dist/cjs` (consumed by `apps/api` via Node's `require`)
and `dist/esm` (consumed by `apps/web`'s Rollup production bundle) — because
a single CommonJS build's `export *` re-exports aren't statically analyzable
by Rollup's production bundler, while Node's CJS `require()` can't load a
pure-ESM package. `package.json#exports` maps `require`/`import` to the
matching build. Run `npm run build:shared` after changing anything in
`packages/shared/src` during development (both apps import the built
`dist/`, not the TS source, to keep this dual-build story simple).

## Directory tree

```
/
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── config/          env, db, logger
│   │   │   ├── controllers/
│   │   │   ├── middleware/      errorHandler, validate, upload, currentUser, ...
│   │   │   ├── models/          Case, CaseEvent, Attachment, User, Counter
│   │   │   ├── repositories/
│   │   │   ├── services/
│   │   │   ├── integrations/shopfa/
│   │   │   ├── routes/
│   │   │   ├── validators/
│   │   │   ├── utils/
│   │   │   └── types/
│   │   ├── scripts/seed.ts
│   │   └── tests/
│   └── web/
│       └── src/  (see "Frontend structure" above)
├── packages/
│   └── shared/
├── uploads/
├── docs/
├── docker-compose.yml
└── package.json  (npm workspaces root)
```
