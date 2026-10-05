# Sprint 6B Implementation Plan: Customer/Runner/Android Surfaces + Production Guard

> **Goal**: Expose `customFee` and `customFeeReason` on all three frontends, then lift `MAX_CUSTOM_FEE: 0 → 500`.
> **Prerequisite**: 6A-3.1b merged & deployed (✅ done). Backend columns exist, `PlatformPricing` readable, admin can set `customFee` via `approveOrder`.

---

## 1. Shared Types & Constants (Foundation — Do First)

### 1.1 `packages/shared-constants/src/pricing.ts`
- **Change**: `MAX_CUSTOM_FEE = 500` (was `0`)
- **Impact**: Flows to `runner.types.ts:196` (`createApproveOrderSchema`) and `pricing.types.ts:91` (`FeePreviewRequestSchema`)
- **Order**: Do this **last** (after all frontends render the fields). Keep at `0` during 6B-1..6B-5.

### 1.2 `packages/shared-types/src/customer.types.ts`
- **Add to `CustomerOrderDetails`** (line ~179):
  ```ts
  customFee?: number | null;
  customFeeReason?: string | null;
  ```
- **Update `OrderPricing`** (line ~159) to include `customFee`:
  ```ts
  export type OrderPricing = {
    baseFee: number;
    peripheralFee: number;
    extraStoresFee: number;
    customFee?: number;          // NEW
    customFeeReason?: string | null; // NEW
    totalFee: number;
  };
  ```
- **Update `EstimatedFeeSchema`** (line ~37) to include `customFee`, `customFeeReason`:
  ```ts
  export const EstimatedFeeSchema = z.object({
    baseFee: z.number(),
    peripheralFee: z.number(),
    extraStoresFee: z.number(),
    customFee: z.number().optional().default(0),      // NEW
    customFeeReason: z.string().nullable().optional(), // NEW
    totalFee: z.number(),
    note: z.string(),
  });
  ```

### 1.3 `packages/shared-types/src/runner.types.ts`
- **Update `ActiveOrderPricingSchema`** (line ~40):
  ```ts
  export const ActiveOrderPricingSchema = z.object({
    baseFee: z.number(),
    peripheralFee: z.number(),
    extraStoresFee: z.number(),
    customFee: z.number().optional().default(0),      // NEW
    customFeeReason: z.string().nullable().optional(), // NEW
    totalFee: z.number(),
  });
  ```
- **Update `PurchaseStoreResponse`** (line ~130) `updatedFee` to include `customFee`, `customFeeReason`.

### 1.4 `packages/shared-types/src/websocket.events.ts`
- **Update `OrderAssignedPayload`** (line ~91):
  ```ts
  estimatedFee: {
    baseFee: number;
    peripheralFee: number;
    extraStoresFee: number;
    customFee: number;              // NEW
    customFeeReason: string | null; // NEW
    totalFee: number;
    note: string;
  };
  ```
- **Update `OrderFeeUpdatedPayload`** (line ~52) — already has `customFee?`/`customFeeReason?` ✅

### 1.5 `packages/shared-types/src/pricing.types.ts`
- **Verify** `FeePreviewResponseSchema` (line ~130) includes `customFee` ✅ (already there)

### 1.6 `packages/shared-types/src/index.ts`
- Re-export updated types.

---

## 2. Backend API (apps/api)

### 2.1 `customer-orders.service.ts` — `getOrderDetails` (line ~507)
- **Add to returned object**:
  ```ts
  customFee: order.customFee ?? 0,
  customFeeReason: order.customFeeReason ?? null,
  ```
- **Also add to `pricing` sub-object** (line ~516).

### 2.2 `runners.service.ts` — `getActiveOrder` (line ~212)
- **Add to `pricing` object**:
  ```ts
  customFee: activeOrder.customFee ?? 0,
  customFeeReason: activeOrder.customFeeReason ?? null,
  ```

### 2.3 `admin-order-command.service.ts` — `assignRunner` payload (line ~930)
- **Update `assignedPayload.estimatedFee`**:
  ```ts
  estimatedFee: {
    baseFee: order.baseFee,
    peripheralFee: order.peripheralFee,
    extraStoresFee: order.extraStoresFee,
    customFee: order.customFee ?? 0,           // NEW
    customFeeReason: order.customFeeReason ?? null, // NEW
    totalFee: order.totalFee,
    note: 'الرسم النهائي يُحدد بعد المراجعة',
  },
  ```

### 2.4 `pricing.service.ts` — `recalculateFee` return (line ~506)
- **Ensure `newFee` includes `customFee`** (already done via `hasOrderCustomFee` spread ✅)

### 2.5 `runner-orders.service.ts` — `purchaseStore` return (line ~336)
- **`updatedFee` already returns full `FeeResult`** which includes `customFee` ✅

---

## 3. customer-web (Next.js App Router)

### 3.1 `apps/customer-web/src/pages/OrderDetailScreen.tsx`
- **Pricing Breakdown section** (line ~527): Add `customFee` row after `extraStoresFee`:
  ```tsx
  {order.customFee && order.customFee > 0 && (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ color: 'var(--text-muted)' }}>رسم إضافي:</span>
      <span>{order.customFee} ل.س</span>
    </div>
  )}
  {order.customFeeReason && (
    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
      السبب: {order.customFeeReason}
    </div>
  )}
  ```
- **Type import**: Ensure `CustomerOrderDetails` import picks up new fields (auto via shared-types).

---

## 4. runner-pwa (Vite + React)

### 4.1 `apps/runner-pwa/src/pages/ActiveOrderPage.tsx`
- **Fee Summary section** (line ~468): Add `customFee` row:
  ```tsx
  {order.pricing.customFee && order.pricing.customFee > 0 && (
    <div className="fee-row">
      <span>رسم إضافي:</span>
      <span>{order.pricing.customFee} ل.س</span>
    </div>
  )}
  {order.pricing.customFeeReason && (
    <div className="fee-row" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
      <span>السبب:</span>
      <span>{order.pricing.customFeeReason}</span>
    </div>
  )}
  ```

---

## 5. Android (Kotlin + Compose)

### 5.1 `apps/android/app/src/main/java/com/forerun/customer/data/remote/dto/order/OrderDetailDtos.kt`
- **Add to `OrderDetailResponseDto`** (after `extraStoresFee`):
  ```kotlin
  @Json(name = "customFee") val customFee: Int = 0,
  @Json(name = "customFeeReason") val customFeeReason: String? = null,
  ```

### 5.2 `apps/android/app/src/main/java/com/forerun/customer/data/remote/mapper/OrderDetailMapper.kt`
- **Map new fields** in `mapToDomain()`.

### 5.3 `apps/android/app/src/main/java/com/forerun/customer/ui/order/detail/OrderDetailScreen.kt`
- **Add UI rows** for `customFee` and `customFeeReason` in pricing section.

### 5.4 `apps/android/app/src/main/res/values/strings.xml` — Line 359 (`support_faq_2_answer`)
- **Current**: "رسوم التوصيل ثابتة وشفافة تبدأ من الرسم الأساسي (60 ل.س)..."
- **Replace with flexible wording**:
  ```xml
  <string name="support_faq_2_answer">رسوم التوصيل شفافة وتعتمد على إعدادات المنصة الحالية: رسم أساسي، ورسم للمناطق الطرفية، ورسم لكل متجر إضافي. قد يضاف رسم إضافي للطلب مع سبب مبرر. تظهر لك الرسوم المحتسبة بدقة في تفاصيل الطلب قبل التأكيد.</string>
  ```

---

## 6. WebSocket Payload Verification (6B-5)

### 6.1 `admin-order-command.service.ts` — `assignRunner` (line ~930)
- Already covered in **2.3** — `OrderAssignedPayload` now includes `customFee`/`customFeeReason`.

### 6.2 `notifications.service.ts` — emit paths
- Verify `emitToRunner('order:assigned', assignedPayload)` passes the updated payload.

---

## 7. DeviceToken Unit Tests (6B-6 — Low Priority)

### 7.1 `apps/api/src/modules/notifications/fcm.service.spec.ts`
- **Add tests** for:
  - `registerDeviceToken` (create/upsert)
  - `unregisterDeviceToken` (delete)
  - `sendToUser` with multiple tokens
  - Token cleanup on invalid tokens

---

## 8. TTL Injection Refactor (6B-7 — Low Priority)

### 8.1 `apps/api/src/modules/pricing/pricing.service.ts`
- **Replace `getPricingConfigForTesting` / `clearPricingCacheForTesting`** with constructor-injected TTL:
  ```ts
  constructor(
    @Inject(PRICING_TTL_MS) private readonly ttlMs: number = 30_000,
  ) {}
  ```
- **Update test files** to provide custom TTL via module override.

---

## 9. Execution Order & Gates

| Phase | Tasks | Gate |
|-------|-------|------|
| **0** | 1.1–1.6 (Shared Types) | `pnpm build && pnpm typecheck` ✅ |
| **1** | 2.1–2.5 (Backend) | Unit tests 355+, Integration 44+ ✅ |
| **2** | 3.1 (customer-web) | `pnpm --filter customer-web build` ✅ |
| **3** | 4.1 (runner-pwa) | `pnpm --filter runner-pwa build` ✅ |
| **4** | 5.1–5.4 (Android) | `./gradlew :app:assembleDebug` ✅ |
| **5** | 6.1–6.2 (WS Verify) | Manual WS test or integration test |
| **6** | **Flip `MAX_CUSTOM_FEE = 500`** (1.1) | **Only after Phases 0–5 pass** |
| **7** | 7.1 (DeviceToken tests) | `pnpm test` ✅ |
| **8** | 8.1 (TTL refactor) | `pnpm test` ✅ |

---

## 10. Rollback Plan

If `MAX_CUSTOM_FEE = 500` causes issues:
1. Revert `packages/shared-constants/src/pricing.ts` to `0`
2. `pnpm build && pnpm --filter forerun-api test`
3. Deploy API only (no DB migration needed)

---

## 11. Open Questions (Decide Before Phase 0)

1. **EstimatedFee note text**: Keep "الرسم النهائي يُحدد بعد المراجعة" or update to mention customFee?
2. **Android `OrderDetailDtos.kt`**: Should `customFeeReason` be non-null empty string instead of null?
3. **WebSocket `OrderAssignedPayload`**: Add `runnerShare`/`platformShare` for runner display? (Currently not in payload)
4. **Customer web fee notification banner** (line ~300): Should it show `customFee` change reason?

---

## 12. Files to Modify (Summary)

| Package | Files |
|---------|-------|
| `shared-constants` | `src/pricing.ts` |
| `shared-types` | `src/customer.types.ts`, `src/runner.types.ts`, `src/websocket.events.ts`, `src/pricing.types.ts`, `src/index.ts` |
| `api` | `src/modules/orders/services/customer-orders.service.ts`, `src/modules/runners/runners.service.ts`, `src/modules/orders/services/admin-order-command.service.ts` |
| `customer-web` | `src/pages/OrderDetailScreen.tsx` |
| `runner-pwa` | `src/pages/ActiveOrderPage.tsx` |
| `android` | `app/src/main/java/.../dto/order/OrderDetailDtos.kt`, `app/src/main/java/.../mapper/OrderDetailMapper.kt`, `app/src/main/java/.../ui/order/detail/OrderDetailScreen.kt`, `app/src/main/res/values/strings.xml` |
| `tests` | `apps/api/src/modules/notifications/fcm.service.spec.ts` |

---

**Plan ready for implementation.** Next: switch to implementation agent to start Phase 0 (Shared Types).