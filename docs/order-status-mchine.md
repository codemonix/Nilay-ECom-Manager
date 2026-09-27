# Order Status Machine

## Status Glossary

| Persian | Shorthand | Meaning |
|---|---|---|
| اعلام پرداخت | `PAYMENT_DECLARED` | Customer declared payment, not yet confirmed |
| پرداخت تایید شده | `PAYMENT_CONFIRMED` | Payment confirmed |
| پردازش انبار | `WAREHOUSE_PROCESSING` | Warehouse is processing / sourcing items (e.g. shortage) |
| تایید حسابداری | `ACCOUNTING_APPROVED` | Accounting approved, waiting to sync with sibling orders |
| آماده ارسال | `READY_TO_SEND` | Precheck sees sibling orders in a mixed/ambiguous status — needs manual review in Shopfa panel |
| ارسال شده به سرویس پستی | `SENT_TO_POST` | Handed off to packing / post service (precheck's terminal state) |
| ارسال شده | `SENT` | Actually packed and dispatched (packing's terminal state) |

## Workflow: Precheck

```
function onPrecheckSave(currentOrder):
    otherOrders = getOtherOrders(customer = currentOrder.customer, excluding = currentOrder, excluding = order.status == SENT
    allItemsAvailable = checkAllItemsAvailable(currentOrder)

    if allItemsAvailable:
        if otherOrders.length > 0:
            if all(o.status == ACCOUNTING_APPROVED for o in otherOrders):
                setStatus(currentOrder, SENT_TO_POST)
                for o in otherOrders:
                    setStatus(o, SENT_TO_POST)
            elif any(o.status in [PAYMENT_CONFIRMED, WAREHOUSE_PROCESSING, PAYMENT_DECLARED] for o in otherOrders):
                setStatus(currentOrder, ACCOUNTING_APPROVED)
            else:
                # sibling orders exist but are in a mixed/unmatched combination of statuses
                setStatus(currentOrder, READY_TO_SEND)
                warnUser("check shopfa panel for more information")
        else:
            # no other orders exist for this customer at all
            setStatus(currentOrder, SENT_TO_POST)

    else:  # shortage in current order
        ordersSentToPost = [o for o in otherOrders if o.status == SENT_TO_POST]
        if ordersSentToPost.length > 0:
            confirmed = warnUser("This will change all this customer's order statuses. Continue?")
            if confirmed:
                for o in ordersSentToPost:
                    setStatus(o, ACCOUNTING_APPROVED)
                setStatus(currentOrder, WAREHOUSE_PROCESSING)
            else:
                return
        else:
            setStatus(currentOrder, WAREHOUSE_PROCESSING)
```

## Workflow: Packing

### Data model

```
PackingGroup {
    customer
    orders: [Order]              // all customer orders currently in SENT_TO_POST
    otherStatusOrders: [Order]   // customer orders in any status OTHER than SENT_TO_POST — informational only
    items: [Item]
    shippingMethodSummary: Map<Method, Count>
    pictures: [Picture]           // one or more per group
    allItemsMarkedGreen: bool
    finalPictureTaken: bool       // true once at least one picture exists for this group's current packing pass
}

Item {
    ...
    packed: bool   // "marked green"
}

Picture {
    ...
    syncStatus: PENDING_SYNC | SYNCED | FAILED   // Shopfa push status
}
```

### 1. Building the packing group for a customer

```
function openPackingGroup(customer):
    group.orders = getOrders(customer, status == SENT_TO_POST)
    group.otherStatusOrders = getOrders(customer, status != SENT_TO_POST)

    if group.otherStatusOrders.length > 0:
        informUser("This customer has other orders in non-SENT_TO_POST statuses: "
                   + list(group.otherStatusOrders))
        # informational only — does not block packing this group

    group.shippingMethodSummary = computeShippingMethodSummary(group)
    return group

function computeShippingMethodSummary(group):
    return countBy(group.orders, order => order.shippingMethod)
```

### 2. Marking items green

```
function onMarkItemGreen(item, group):
    item.packed = true
    group.allItemsMarkedGreen = all(i.packed for i in group.items)
```

### 3. Taking pictures

```
function onTakePicture(group):
    picture = openCamera()
    if picture taken:
        picture.syncStatus = PENDING_SYNC
        group.pictures.append(picture)
        group.finalPictureTaken = true   # any picture taken counts toward "final" — multiple allowed
        pushToShopfaWithRetry(picture, group)
```

### 4. Dialog A — Save button (changes order/group status)

```
function onSave(group):
    if NOT group.finalPictureTaken:
        result = showWarningDialog(
            message: "Final picture(s) have not been taken",
            buttons: [Cancel, TakePicture, Confirm]
        )
        match result:
            case Cancel:
                return  # no save, no status change
            case TakePicture:
                onTakePicture(group)
                return  # user must click Save again themselves — no auto re-trigger
            case Confirm:
                finalizeAndSend(group)  # user may proceed and save without ever taking a picture
    else:
        finalizeAndSend(group)


function finalizeAndSend(group):
    for order in group.orders:
        setStatus(order, SENT)
    persistPictures(group.pictures)
    pushToShopfaWithRetry(group)
```

### 5. Dialog B — Moving to next customer/order (no status change)

```
function onAttemptMoveToNext(currentGroup, nextTarget):
    if currentGroup.allItemsMarkedGreen AND NOT currentGroup.finalPictureTaken:
        result = showWarningDialog(
            message: "All items marked, but no final picture taken for this group",
            buttons: [TakePicture, Cancel, Confirm]
        )
        match result:
            case TakePicture:
                onTakePicture(currentGroup)
                return  # stays on current group — user must click Next again themselves
            case Cancel:
                return  # stay on current group, keep packing — no navigation, no status change
            case Confirm:
                moveTo(nextTarget)  # navigates away WITHOUT changing any order status
    else:
        moveTo(nextTarget)
```

### 6. Shopfa sync (pending / retry)

```
function pushToShopfaWithRetry(payload):
    try:
        pushToShopfa(payload)
        payload.syncStatus = SYNCED
    except:
        payload.syncStatus = PENDING_SYNC   # stays queued, not marked FAILED outright
        scheduleRetry(payload)

function scheduleRetry(payload):
    # background job: periodically re-attempt any item still PENDING_SYNC
    # e.g. exponential backoff, capped attempts, then mark FAILED for manual review
    retryQueue.enqueue(payload)

function retryWorker():
    for payload in retryQueue.pendingItems():
        try:
            pushToShopfa(payload)
            payload.syncStatus = SYNCED
            retryQueue.remove(payload)
        except:
            payload.attempts += 1
            if payload.attempts >= MAX_ATTEMPTS:
                payload.syncStatus = FAILED
                notifyUserOfSyncFailure(payload)
```

### 7. History / audit

```
function getOrderHistory(order):
    return {
        statusChanges: [...],
        pictures: getPicturesForGroup(order.packingGroup),
        shopfaSyncStatus: [...]   # per-picture: SYNCED / PENDING_SYNC / FAILED
    }
```