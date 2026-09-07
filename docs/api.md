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

Every non-GET request that changes a Case should include an
`x-user-id: <staff user id>` header — see [architecture.md#authentication](architecture.md#authentication).
Requests without it still succeed; the resulting `CaseEvent.actorId` is just
`null` (attributed to "system" in the UI).

Standard HTTP status codes are used: `200` (success), `201` (created), `400`
(bad request), `404` (not found), `409` (conflict — e.g. invalid status
transition), `422` (validation error), `502` (Shopfa upstream error).

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
