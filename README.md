# Business Operations System

Internal business-operations web application for a Shopfa-based online jewelry
business. **Version 1** implements the **Complaint / Case Management** module.
The architecture is deliberately built to grow into order pre-checking,
packing/fulfillment, purchasing, inventory, and reporting without a rewrite —
see [docs/future-modules.md](docs/future-modules.md).

## 1. Architecture overview

Shopfa (the existing e-commerce platform) remains the source of truth for
customers, orders, products, and sales. This application does **not**
duplicate that data. Instead:

- Cases store a **snapshot** of customer info (name/phone/email) so a case
  stays readable even if the customer record changes later in Shopfa.
- Cases reference orders/items by **external id** (`externalOrderId`,
  `externalItemId`), not by copying Shopfa's catalog.
- All communication with Shopfa is isolated behind a single
  `ShopfaClient` interface (`apps/api/src/integrations/shopfa`). The rest of
  the app never talks to Shopfa directly, and the frontend never sees Shopfa
  credentials — only the backend calls out, through this one seam.

Backend layering is strict and one-directional:

```
route -> controller -> service -> repository -> model
                  \-> integrations/shopfa (external data only)
```

Frontend is feature-oriented (`apps/web/src/features/complaints/...`) so a
future `features/packing`, `features/purchasing`, etc. can be added as
self-contained modules. Full details: [docs/architecture.md](docs/architecture.md).

## 2. Project structure

```
apps/
  api/    Express + TypeScript + MongoDB backend (REST API)
  web/    React + TypeScript + Vite frontend
packages/
  shared/ Types, enums, and status-transition rules shared by both apps
uploads/  Local attachment storage (V1; swappable for S3 later)
docs/     Architecture, API, database, i18n, and future-module docs
```

See [docs/architecture.md](docs/architecture.md) for the full directory tree.

## 3. Requirements

- Node.js 20+ (developed against Node 22)
- npm 10+
- Docker (for local MongoDB) — or any MongoDB 6+ instance

## 4. Installation

```bash
npm install
```

This installs all three workspaces (`apps/api`, `apps/web`, `packages/shared`)
from the repo root via npm workspaces.

## 5. Environment variables

Copy the example files and adjust as needed:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

`apps/api/.env`:

| Variable | Purpose | Default |
|---|---|---|
| `PORT` | API port | `4000` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27020/business_ops` |
| `CORS_ORIGIN` | Allowed frontend origin | `http://localhost:5173` |
| `LOG_LEVEL` | winston log level | `info` |
| `SHOPFA_API_BASE_URL` | Real Shopfa API base URL | — |
| `SHOPFA_API_TOKEN` | Real Shopfa API token (never sent to the frontend) | — |
| `SHOPFA_MOCK` | `true` to use realistic in-memory mock Shopfa data | `true` |
| `UPLOAD_DIR` | Local attachment storage directory | `uploads` |
| `MAX_UPLOAD_SIZE_MB` | Max attachment size | `10` |

`apps/web/.env`:

| Variable | Purpose | Default |
|---|---|---|
| `VITE_API_URL` | Backend API base URL | `http://localhost:4000/api` |

**You do not need real Shopfa credentials to run this application.** With
`SHOPFA_MOCK=true` (the default), a realistic mock dataset of 12 customers and
25 orders is served from `apps/api/src/integrations/shopfa/mockData.ts`.

## 6. Running MongoDB

```bash
npm run mongo:up     # docker compose up -d mongo
```

This starts MongoDB on **host port 27020** (not the default 27017, to avoid
colliding with any other local MongoDB instance) with a persistent volume.
Stop it with `npm run mongo:down`.

If you'd rather run your own MongoDB, just point `MONGODB_URI` at it.

## 7. Running the backend

```bash
npm run dev:api   # builds packages/shared, then starts apps/api on :4000
```

Health check: `curl http://localhost:4000/api/health`

## 8. Running the frontend

```bash
npm run dev:web   # builds packages/shared, then starts apps/web (Vite) on :5173
```

Or run both together from the repo root:

```bash
npm run dev
```

## 9. Seeding data

```bash
npm run seed
```

Seeds 5 staff users, and 16 cases (spanning every status/priority/category)
with realistic event timelines, built through the same service layer the API
uses — so seeded data is guaranteed consistent (every case has its `created`
event, every status change is a valid transition, etc). Customers/orders come
from the Shopfa mock data automatically; no separate customer seeding step is
needed.

## 10. Running tests

```bash
npm run test        # backend + frontend
npm run test:api     # backend only (Vitest + Supertest + mongodb-memory-server)
npm run test:web     # frontend only (Vitest)
```

Backend tests spin up an in-memory MongoDB (`mongodb-memory-server`) — no
running database is required to run the test suite.

## 11. Building for production

```bash
npm run build
```

Builds `packages/shared` first (as both a CJS build for the Node backend and
an ESM build for the Vite/Rollup frontend bundle — see
[docs/architecture.md](docs/architecture.md#shared-package-dual-build)), then
`apps/api` (`tsc`) and `apps/web` (`tsc` + `vite build`).

## 12. Shopfa integration

See [docs/architecture.md](docs/architecture.md#shopfa-integration) for the
full design. In short: `ShopfaClient` is an interface with a mock
implementation (default) and a real HTTP implementation, selected by
`SHOPFA_MOCK` in a small factory (`integrations/shopfa/index.ts`). Swapping to
the real Shopfa API later means implementing/adjusting `shopfaMapper.ts`
against Shopfa's actual response shapes — no other file in the app changes.

## 13. Internationalization

The UI ships with English and Persian (Farsi) from day one, switchable at
runtime (no reload), persisted in `localStorage`, defaulting to English. See
[docs/internationalization.md](docs/internationalization.md) for the full
i18n/RTL architecture, including how logical CSS properties, the
direction-aware MUI theme, and the emotion RTL cache work together, and how
identifiers (phone numbers, case/order numbers) are kept visually correct
inside right-to-left text.

## 14. RTL architecture

Selecting Persian flips `<html dir>` to `rtl`, switches the MUI theme
direction, and swaps in an RTL-aware emotion cache (stylis + `stylis-plugin-rtl`)
so every MUI component mirrors automatically. Details in
[docs/internationalization.md](docs/internationalization.md).

## 15. Future expansion strategy

Order Pre-Check, Packing, Purchasing, Inventory, and Reporting are designed
into the architecture now (shared package structure, feature-folder
convention, CaseEvent as an operational-history source for analytics) so they
can be added as new modules later without touching the Complaint Management
code. See [docs/future-modules.md](docs/future-modules.md).

## Known limitations (V1)

- **Authentication**: V1 has no real login. A "development user selector" in
  the header lets you act as any seeded staff member (sent via `x-user-id`).
  See [docs/architecture.md](docs/architecture.md#authentication) for how
  real auth slots in later without changing services/controllers.
- **Attachments** are stored on local disk (`uploads/`), not object storage.
  The `Attachment` model already isolates `storageProvider`/`path` so an S3
  adapter can be added later without a schema change.
- **MongoDB transactions**: the docker-compose MongoDB is a standalone
  instance (no replica set), so it doesn't support multi-document
  transactions. The backend detects this and falls back to sequential writes
  with manual compensation — see
  [docs/database.md](docs/database.md#transactions--consistency).
- One moderate-severity `qs` advisory (a transitive dependency of Express 4's
  `body-parser`) currently has no published fix upstream; re-run `npm audit`
  periodically and upgrade when one lands.
- The production frontend bundle is a single ~745KB (236KB gzipped) chunk;
  route-based code-splitting would help once more feature modules are added.
