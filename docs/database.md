# Database

MongoDB via Mongoose. Dates are stored in UTC; the frontend converts to the
viewer's local timezone at render time (`utils/localeFormat.ts`).

## Collections

### `cases`

| Field | Type | Notes |
|---|---|---|
| `caseNumber` | string, unique | Human-facing id, e.g. `C-20260903-0001`. Never expose `_id` as the primary identifier in the UI. |
| `customer` | embedded `{ externalCustomerId, name, phone?, email? }` | Snapshot at creation time |
| `subject`, `description` | string | |
| `category` | enum (`CaseCategory`) | |
| `priority` | enum (`CasePriority`) | |
| `status` | enum (`CaseStatus`) | See transition table in [api.md](api.md#case-status-transitions) |
| `source` | enum (`CaseSource`) | |
| `assignedTo` | ObjectId ref `User`, nullable | |
| `relatedOrders` | `[{ externalOrderId, orderNumber }]` | |
| `relatedItems` | `[{ externalItemId, sku, title }]` | |
| `tags` | `string[]` | |
| `lastActivityAt` | Date | Bumped by every mutating action |
| `resolvedAt`, `closedAt` | Date, nullable | Set/cleared by status transitions |
| `createdBy` | ObjectId ref `User`, nullable | |

Indexes:

- `caseNumber` unique
- `{ "customer.externalCustomerId": 1 }`
- `{ status: 1, priority: 1, lastActivityAt: -1 }`
- `{ assignedTo: 1, status: 1, lastActivityAt: -1 }`
- `{ createdAt: -1 }`
- text index on `subject`, `description`, `caseNumber` (backs `search`)

### `caseevents`

Append-only. No update/delete route exists for this collection on purpose.

| Field | Type | Notes |
|---|---|---|
| `caseId` | ObjectId ref `Case` | |
| `type` | enum (`CaseEventType`) | `created`, `status_changed`, `priority_changed`, `assignment_changed`, `internal_note`, `customer_message`, `order_linked`, `item_linked`, `attachment_added`, `resolved`, `reopened`, `closed`, `tag_added`, `tag_removed`, `note_added` |
| `actorId` | ObjectId ref `User`, nullable | `null` = system/no dev-user selected |
| `body` | string, nullable | Free text (notes, status-change reason) |
| `data` | Mixed, nullable | Structured payload, e.g. `{ from, to }` for a status change |
| `createdAt` | Date | No `updatedAt` — events are immutable |

Index: `{ caseId: 1, createdAt: 1 }` (backs the timeline query).

### `attachments`

| Field | Type | Notes |
|---|---|---|
| `caseId` | ObjectId ref `Case` | |
| `originalFilename`, `storedFilename` | string | Stored filename is randomized; original is never trusted as a path |
| `mimeType`, `size` | | |
| `storageProvider` | `"local"` (enum, extensible) | Add `"s3"` here + a new adapter later; no migration needed for existing rows |
| `path` | string | Relative to `UPLOAD_DIR` |
| `uploadedBy` | ObjectId ref `User`, nullable | |

Index: `{ caseId: 1, createdAt: -1 }`.

### `users`

Seeded staff (`admin`, `customer_service`, `warehouse`, `manager`,
`purchasing` roles). See [architecture.md#authentication](architecture.md#authentication)
for why there's no password field in V1.

### `counters`

Single-purpose collection backing gapless per-day case-number sequences
(`case-YYYYMMDD` → next integer), via `findByIdAndUpdate` with `$inc` +
`upsert`, which is atomic at the document level regardless of transaction
support.

### `importedorders`

One document per order imported from a Shopfa xlsx export (see
[architecture.md#data-source-live-api-vs-imported-orders](architecture.md#data-source-live-api-vs-imported-orders)),
with every line item of that order rolled up into `items`. Upserted by
`externalOrderId` on each import, so re-importing an updated export updates
existing orders instead of duplicating them.

| Field | Type | Notes |
|---|---|---|
| `externalOrderId` | string, unique | Shopfa's order code (کد سفارش) |
| `status` | string | Raw Shopfa status text -- not a controlled enum, since it's Shopfa's own workflow, not ours |
| `purchaseDate` | Date, nullable | Parsed from the export's Gregorian purchase-date column |
| `buyer` | embedded `{ externalBuyerId, firstName, lastName, province?, city?, address?, postalCode?, mobile?, landline?, nationalId? }` | |
| `items` | `[{ productCode, sku?, title, quantity, unitPrice, amount }]` | |
| `shippingCost`, `discountAmount`, `itemsTotal`, `totalAmount` | number | `totalAmount = itemsTotal + shippingCost - discountAmount` |
| `importedAt` | Date | Set on every (re-)import, independent of `createdAt`/`updatedAt` |

Indexes: `externalOrderId` unique, `{ "buyer.externalBuyerId": 1 }`,
`{ purchaseDate: -1 }`. Search (order id, buyer name/mobile) is a bounded
regex scan rather than a text index -- see
`repositories/importedOrderRepository.ts` -- since a MongoDB text index's
default stemmer isn't a good fit for mixed Farsi/numeric fields.

### `settings`

Singleton document (fixed `_id: "app"`, created lazily on first read) for
app-wide settings -- currently just the order data-source toggle
(`dataSource: "imported_file" | "live_api"`) and `lastImport` metadata
(`fileName`, `importedAt`, `importedBy`, row/order/item counts). See
`repositories/settingsRepository.ts`.

## Transactions & consistency

Every action that changes both a `Case` and writes a `CaseEvent` (creating a
case, changing status/priority/assignment, adding a note, linking an
order/item, tagging) goes through one path —
`caseService.ts#applyCaseMutationWithEvent` (and the equivalent block inside
`createCase`) — which:

1. **Tries a real MongoDB transaction** (`session.withTransaction`). This
   works when MongoDB is a replica set or `mongos`.
2. **Falls back automatically** when the driver reports transactions aren't
   supported (`isTransactionsUnsupportedError` in `utils/transactions.ts`) —
   which is the case for the single-node `mongod` this repo's
   `docker-compose.yml` runs by default. In the fallback path, writes happen
   sequentially (case save, then event create), and if the event write fails
   after the case write succeeded, the case is **compensated** — its
   pre-mutation field values are restored (or, for a brand-new case, the case
   document itself is deleted) — so a `Case` can never end up in a state with
   no matching `CaseEvent` explaining how it got there.

This means the same code is correct in both local development (standalone
MongoDB) and a production replica-set deployment, without any environment
-specific branching in the callers. If you deploy against a replica set, no
code change is needed to get real atomicity — it activates automatically.

## Why not duplicate Shopfa's data model here

See [architecture.md](architecture.md#guiding-principle-shopfa-owns-commerce-data-we-own-operations).
In short: this database only ever stores a customer/order/item *reference*
plus a small display snapshot, never Shopfa's full catalog or order history.
