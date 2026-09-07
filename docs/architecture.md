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
  -> integrations/shopfa/index.ts        (factory: mock vs. real, by SHOPFA_MOCK)
    -> integrations/shopfa/shopfaClient.ts       (real HTTP client, axios)
    -> integrations/shopfa/mockShopfaClient.ts   (in-memory mock, default)
       both implement -> shopfaTypes.ts#ShopfaClient (the interface)
    -> integrations/shopfa/shopfaMapper.ts       (raw Shopfa shape -> our DTOs)
```

`customerService.ts` (and any future service) depends only on the
`ShopfaClient` interface, never on `HttpShopfaClient` or `MockShopfaClient`
directly (dependency inversion) — swapping providers is a one-line change in
the factory, not a refactor.

**The frontend never receives a Shopfa credential.** `SHOPFA_API_TOKEN` is
read only in `apps/api/src/config/env.ts` and used only inside
`shopfaClient.ts`.

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
