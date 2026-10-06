# Rollback Plan — Runner Delivery and Ledger Creation

> ⚠️ **OUTDATED — see D25/D28.**
> نظام الحصص (RUNNER_SHARE / PLATFORM_SHARE) أُلغي بالقرارين D25 وD28.
> التسليم الآن يكتب قيداً واحداً فقط: ORDER_FEE_TOTAL.

## 1. Operation Description

- Adds authenticated runner delivery actions and creates append-only `LedgerEntry` records for the order fee, runner share, and platform share when an order reaches `DELIVERED`.
- Affected tables: `Order`, `AuditLog`, and `LedgerEntry`; the operation also uses the existing `RunnerStateMachine` and `OrderStateMachine`.
- Expected volume: one delivery event per delivered order in development/test; production volume is not assumed by this code change.
- This plan covers code and non-production verification only. No production database mutation, migration, or financial reconciliation is authorized by this plan.

## 2. Forward Steps

1. Deploy the runner action endpoints and their shared Zod contracts.
2. Authenticate and authorize the runner, then load the order and its persisted state inside a Prisma transaction.
3. Validate the requested idempotency key against the order's stored key before creating financial effects.
4. Transition the order to `DELIVERED` through `OrderStateMachine`; transition the runner to `AVAILABLE` through `RunnerStateMachine` only after the delivery transition is valid.
5. Append exactly one `ORDER_FEE_TOTAL`, one `RUNNER_SHARE`, and one `PLATFORM_SHARE` `LedgerEntry` per delivered order inside the same transaction.
6. Append the delivery audit event inside the same transaction.
7. Commit the transaction, then emit the best-effort WebSocket event.

## 3. Rollback Steps

If validation, typechecking, tests, or non-production integration checks fail before deployment:

1. Do not deploy the change.
2. Revert only the runner delivery/Ledger code and contracts; leave unrelated working-tree changes untouched.
3. In a non-production database, identify delivery transactions by the order idempotency key and delivery audit event.
4. Do not update or delete `LedgerEntry` or `AuditLog` rows. If test data must be reset, restore the entire non-production database from a pre-change backup or recreate the test database.
5. Re-run the API build, lint, typecheck, and tests before retrying deployment.

If a production incident is discovered after deployment:

1. Stop accepting the affected delivery endpoint and notify the backend owner and operations/QA.
2. Preserve all `LedgerEntry` and `AuditLog` rows for investigation; never repair them with UPDATE or DELETE.
3. Reconcile affected orders against a database backup and approved operational records.
4. Apply a separately reviewed correction through the domain service and transaction path; do not run an ad hoc SQL repair.

Estimated rollback time: code rollback is deployment-dependent; database recovery requires the normal database restore procedure and is not performed by this task.

## 4. Verification Queries

Run these only against an approved test or incident database:

```sql
SELECT id, status, idempotency_key, total_fee
FROM "Order"
WHERE id = '<order-id>';

SELECT type, amount, order_id, runner_id, created_at
FROM "LedgerEntry"
WHERE order_id = '<order-id>'
ORDER BY created_at, id;

SELECT event, from_status, to_status, created_at
FROM "AuditLog"
WHERE order_id = '<order-id>'
ORDER BY created_at, id;
```

Forward verification:

- The order is `DELIVERED` and has the expected idempotency key.
- The ledger contains exactly one row for each of `ORDER_FEE_TOTAL`, `RUNNER_SHARE`, and `PLATFORM_SHARE`.
- `ORDER_FEE_TOTAL = runnerShare + platformShare` subject to the project's documented per-order integer rounding rule.
- The delivery audit event exists and references the same order.
- Repeating the same delivery request does not create additional ledger or audit rows.

Rollback verification:

- No `LedgerEntry` or `AuditLog` row was updated or deleted.
- Any restored test database matches the pre-change backup.
- The delivery endpoint is disabled or reverted until a corrected deployment passes validation.

## 5. Communication Plan

- Notify the backend owner, QA, and operations channel before any production enablement.
- Report the order ID, idempotency key, ledger counts, and reconciliation result without exposing tokens or customer data.
- Customer-facing impact is limited to delivery processing; affected orders must remain auditable and must not be silently retried without idempotency reconciliation.
