# API Reference

Base URL: `http://localhost:4000/api` (configurable via `VITE_API_URL` on the
frontend, `PORT` on the backend).

## Conventions

All responses are wrapped:

```json
{ "success": true, "data": { }, "meta": { } }
```

```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "...", "details": { } } }
```

`meta` is only present on paginated list endpoints (`page`, `pageSize`,
`total`, `totalPages`).

Every endpoint except `/health` and the public `/auth` ones requires
`Authorization: Bearer <access token>` -- see
[architecture.md#authentication](architecture.md#authentication).

Standard HTTP status codes are used: `200` (success), `201` (created), `400`
(bad request), `404` (not found), `409` (conflict — e.g. invalid status
transition), `422` (validation error), `502` (Shopfa upstream error).

## Auth

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/auth/login` | `{ email, password }` | Returns `{ token, user }` and sets the `refresh_token` httpOnly cookie; `429` with `Retry-After` after 5 failures for one account (or 20 for any accounts) from one IP within 15 minutes |
| POST | `/auth/refresh` | — (cookie) | Rotates the refresh cookie, returns `{ token, user }`; `401` if missing/expired/revoked |
| POST | `/auth/logout` | — (cookie) | Revokes the refresh token and clears the cookie |
| GET | `/auth/me` | — | Current user |
| POST | `/auth/change-password` | `{ currentPassword, newPassword }` | Also signs out the user's other sessions |

## Health

`GET /health` → `{ status, uptimeSeconds, database, timestamp }`

## Cases

| Method | Path | Body / Query | Notes |
|---|---|---|---|
| GET | `/cases` | query: `page, pageSize, search, status, priority, category, assignedTo, customerId, dateFrom, dateTo, sortBy, sortDir` | Paginated list |
| POST | `/cases` | `{ customer, subject, description, category, priority, source, assignedTo?, relatedOrder?, relatedItem?, tags? }` | Creates the case + its `created` event atomically |
| GET | `/cases/:id` | — | Full case, `assignedTo`/`createdBy` populated |
| GET | `/cases/:id/events` | — | Full chronological timeline |
| POST | `/cases/:id/events` | `{ body, visibility: "internal" \| "customer" }` | Same as `/notes` below |
| POST | `/cases/:id/status` | `{ status, reason? }` | Validated against the allowed-transition table; `409` if invalid |
| POST | `/cases/:id/priority` | `{ priority }` | |
| POST | `/cases/:id/assign` | `{ assignedTo: string \| null }` | `null` unassigns |
| POST | `/cases/:id/notes` | `{ body, visibility }` | `visibility: "internal"` → `internal_note` event; `"customer"` → `customer_message` event |
| POST | `/cases/:id/orders` | `{ externalOrderId, orderNumber }` | Appends to `relatedOrders` (idempotent on `externalOrderId`) |
| POST | `/cases/:id/items` | `{ externalItemId, sku, title }` | Appends to `relatedItems` |
| POST | `/cases/:id/tags` | `{ tag }` | |
| DELETE | `/cases/:id/tags` | `{ tag }` | |
| GET | `/cases/:id/attachments` | — | |
| POST | `/cases/:id/attachments` | multipart `file` field | Max size `MAX_UPLOAD_SIZE_MB`; images/PDF only |

### Case status transitions

```
open -> in_progress
in_progress -> waiting_for_customer | waiting_for_internal_action | resolved
waiting_for_customer -> in_progress
waiting_for_internal_action -> in_progress
resolved -> closed | open
closed -> open
```

Anything else returns `409 CONFLICT` with the allowed next statuses in
`error.details.allowedNextStatuses`. This table lives in exactly one place —
`packages/shared/src/constants/caseEnums.ts` — imported by both the API
(enforcement) and the web app (UI only offers valid choices).

## Customers (read-only, proxied from Shopfa)

| Method | Path | Notes |
|---|---|---|
| GET | `/customers/:externalCustomerId/summary` | `{ externalCustomerId, name, phone, email, ordersCount, totalSpent, currency, averageOrderValue, lastOrderDate }` |
| GET | `/customers/search?q=` | Array of `{ externalCustomerId, name, phone, email }` |

## Users (staff)

| Method | Path | Notes |
|---|---|---|
| GET | `/users` | Active staff only, sorted by name |

## Settings & order import

Until live Shopfa API credentials are available, order/customer data comes
from orders imported via an xlsx upload -- see
[architecture.md#shopfa-integration](architecture.md#shopfa-integration).

| Method | Path | Body / Query | Notes |
|---|---|---|---|
| GET | `/settings` | — | `{ dataSource, shopfaApiConfigured, lastImport, systemLogLevel, accessTokenTtlMinutes, refreshTokenTtlDays, updatedAt }` |
| PATCH | `/settings/session` | `{ accessTokenTtlMinutes: 1–1440, refreshTokenTtlDays: 1–365 }` | Admin only; `400` unless the refresh lifetime is longer than the access lifetime |
| PATCH | `/settings/data-source` | `{ dataSource: "imported_file" \| "live_api" }` | `400` if switching to `live_api` without `SHOPFA_API_BASE_URL`/`SHOPFA_API_TOKEN` configured |
| POST | `/settings/orders/import` | multipart `file` field (`.xlsx`) | Parses a Shopfa order export, upserts by order code (re-importing an order updates it, never duplicates), returns `{ rowsProcessed, rowsSkipped, ordersImported, itemsImported, skippedSamples, settings }` |
| GET | `/orders` | query: `page, pageSize, search` | Paginated list of imported orders |
| GET | `/orders/:externalOrderId` | — | Full order detail incl. line items |

## Backups

Backups use the versioned `nilay-ecom-backup` JSON format. ObjectIds and dates
are stored with explicit `$oid` and `$date` markers so references survive a
restore. Backup downloads are the raw JSON envelope rather than the standard
success wrapper, and can be posted directly to the matching restore endpoint.

All four endpoints are **admin-only**, even for staff granted the Settings
menu: a data backup contains every user's password hash, and a data restore
replaces the users collection. Each download/restore is recorded as a
security event.

| Method | Path | Notes |
|---|---|---|
| GET | `/settings/backup` | Settings singleton only; does not include Shopfa credentials or derived configuration |
| POST | `/settings/restore` | Replaces the settings singleton after schema validation; operational data is untouched |
| GET | `/settings/data-backup` | Users, cases, case events, attachment metadata and files, imported orders, and counters |
| POST | `/settings/data-restore` | Validates all documents, references, and attachment checksums before replacing those operational collections |

## Security events (Logs permission)

Failed and throttled logins, forged/invalid access tokens, reused refresh
tokens, requests to protected routes without a session, `403`s, failed
password changes, and sensitive admin actions (user changes, password
resets, session settings, backups/restores) are recorded in the
`SecurityEvent` collection (kept 180 days).

| Method | Path | Query | Notes |
|---|---|---|---|
| GET | `/logs/security` | `page, pageSize, type, severity, search, from, to` | Paged event list; `search` matches IP, target email, user name or path |
| GET | `/logs/security/report` | `from, to` (default: last 7 days) | Counts by type/severity, top source IPs, most-targeted accounts, and `flags`: brute force (≥10 failed logins from an IP), credential stuffing (≥3 accounts from an IP), targeted account (≥5 failures), privilege probing (≥5 `403`s for a user), token tampering |

## Example: create a case

```bash
curl -X POST http://localhost:4000/api/cases \
  -H "Content-Type: application/json" \
  -H "x-user-id: <staff-user-id>" \
  -d '{
    "customer": { "externalCustomerId": "cust_1001", "name": "Ali Ahmadi", "phone": "+98 912 111 2233" },
    "subject": "Necklace arrived damaged",
    "description": "Clasp was broken on arrival.",
    "category": "damaged_item",
    "priority": "high",
    "source": "phone"
  }'
```
