# إكمال سبرنت 6A — الخطوة 6A-3.1b ثم الدمج

## السياق

- الفرع `feature/sprint-6a-dynamic-pricing-backend` فيه 33 commit عن `master` (`05b3724`) — **لا شيء مدمج**.
- 6A-1 → 6A-8 منجزة على الفرع؛ المتبقي خطوة واحدة: `TODO(6A-3.1b)` = ربط `getPricingConfig` بمسارات الإنتاج، بعدها `git merge --no-ff`.
- تحققتُ: `getPricingConfig` له **صفر مستدعٍ إنتاجي**، ومواضع TODO أربعة.
- **م/master لا يحتوي** migration `add_platform_pricing` ولا `add_order_custom_fee` → قاعدة الإنتاج بلا جدول `PlatformPricing` ولا عمود `customFee`.
- DI جاهز: `PricingModule` مستورد في `orders.module.ts`، و`PricingService` محقون في الخدمات الثلاث (لا تغيير DI).

## القرارات (معتمدة من المالك — لا تُفتح مجددًا)

| # | القرار | التفصيل |
|---|---|---|
| **D21** | أولوية مصادر الرسوم في `approveOrder` | `baseFee` = لقطة الطلب `dto.baseFee ?? order.baseFee`؛ `peripheralFee` و`extraStoresFee` من الإعدادات الحالية. متسق مع D11 (المستقبل فقط) و D16 (extraStoresFee بلا لقطة) |
| **D22** | `createOrder` يقرأ الأسعار **داخل** الـ transaction | يضمن تطابق اللقطة مع صف الإعدادات لحظة الإيداع، وبنفس سلوك الموضعين 2 و 4 |
| **D23** | `previewFee` يقرأ عبر الكاش (`getPricingConfig()` بلا tx) | الكاش 30ث ويُفرَّغ عند كل `PUT /admin/pricing`. تحذير stale في النشر متعدد النسخ مسجَّل في المخاطر |

**خارج النطاق:** رفع `MAX_CUSTOM_FEE` (يبقى `0` — سبرنت 6B) · أي تعديل على `schema.prisma`/migrations · `SettlementsService` (نسب 75/25 ثابتة D12) · واجهات العميل/المندوب/Android · إضافة لقطة إعدادات إلى `meta` الأوامر (تغيير شكل AuditLog قد يكسر اختبارات).

---

## المهام (بالترتيب — كل مهمة مع ملفها وسطرها)

### 1. `PricingService` — موقعان
**1a. `previewFee`** — `apps/api/src/modules/pricing/pricing.service.ts:166-173`
احذف سطر `TODO(6A-3.1b)` واستبدل `pricingConfig` بـ:
```ts
const pricingConfig = await this.getPricingConfig();
const feeResult = this.calculateFee(
  { isPeripheral: effectiveIsPeripheral, purchasedStoreCount: order.orderStores.length, customFee },
  { ...pricingConfig, baseFee: effectiveBaseFee },
);
```
`effectiveBaseFee` يبقى `dto.baseFee ?? order.baseFee` (D21) ولا يُقرأ `config.baseFee` إلا إذا مُرّر `dto.baseFee`.

**1b. `recalculateFee`** — نفس الملف `:456-492`
```ts
async recalculateFee(orderId: string, tx?: Prisma.TransactionClient, config?: PricingConfig): Promise<RecalculateFeeResult> {
  // ...Body كما هو
  const effectiveConfig = config ?? (await this.getPricingConfig(tx));
  const extraStoresFee = Math.max(0, purchasedStoreCount - 1) * effectiveConfig.extraStoreFee;
```
احذف `TODO(6A-3.1b)` (`:489`) وحدّث التعليق القائم ليشير إلى D16.
**لا تلمس** ما يكتبه: يبقى `extraStoresFee` و`totalFee` فقط (لقطة `baseFee`/`peripheralFee`/`customFee` محفوظة). المستدعوان `runner-orders.service.ts:256` و`:878` **لا يحتاجان تعديلًا** (معيار `config` يبقى متوافقًا).

### 2. `approveOrder` — `apps/api/src/modules/orders/services/admin-order-command.service.ts:182-186`
```ts
const pricingConfig = {
  ...(await this.pricingService.getPricingConfig(tx)),
  baseFee: effectiveBaseFee, // D21: لقطة الطلب ما لم يحدّد الأدمن قيمة
};
```
الدالة `applyPeripheralFeeIfNeeded` async أصلًا و`tx` متاح عند الاستدعاء (`:475` داخل `$transaction`).

### 3. `createOrder` — `apps/api/src/modules/orders/services/customer-orders.service.ts:113-122` و `:338-351`
```ts
private async calculateOrderFee(tx: Prisma.TransactionClient, storeCount: number): Promise<FeeResult> {
  return this.pricingService.calculateFee(
    { isPeripheral: false, purchasedStoreCount: storeCount },
    await this.pricingService.getPricingConfig(tx),
  );
}
```
وفي `createOrder` — **نقل الحساب داخل الـ transaction** (D22) مع إرجاع `{ order, fee }` لتفادي «used before assigned»:
```ts
const { order, fee } = await this.prisma.$transaction(
  async (tx) => {
    const fee = await this.calculateOrderFee(tx, orderStoresData.length);
    const order = await this.createOrderRecord(tx, { customerId: customer.id, userId, dto, fee, orderStoresData });
    return { order, fee };
  },
  { timeout: CONFIG.TRANSACTION_TIMEOUT_MS },
);
```
باقي الدالة (الاستجابة `estimatedFee` عند `:359-370` والإشعارات) يبقى كما هو لأن الاسمين لم يتغيرا. احذف الاستيراد غير المستخدم `DEFAULT_PRICING_CONFIG` من السطر 10 إن لم يعد مستخدمًا.

### 4. اختبارات الوحدة (إضافات فقط — لا تعديل assertion قائم)
`apps/api/test/pricing/pricing.service.spec.ts`:
- `previewFee` يقرأ `extraStoreFee` من صف `PlatformPricing` (صف 30 مع 3 متاجر → 60).
- `previewFee` يبقي `baseFee` من الطلب عند غياب `dto.baseFee` مع `config.baseFee` مختلف (يثبت D21).
- `recalculateFee` بلا `config` يقرأ من الصف ويكتب `extraStoresFee`/`totalFee` فقط (لقطة `baseFee=80` تبقى 80).
- `recalculateFee` يحترم `config` صريحًا مُمرَّرًا (توافق للخلف).

`apps/api/test/orders/admin-order-command.service.spec.ts`:
- `approveOrder` يأخذ `peripheralFee` من الصف، و`baseFee` يبقى لقطة الطلب (قيم الصف مختلفة عمدًا).
- حارس `MAX_CUSTOM_FEE = 0` يبقى فعالًا (لا تفكيك).

### 5. اختبار تكامل S2 — ملف جديد
`apps/api/test/integration/pricing/pricing-wiring.integration.spec.ts` (نمط `admin-pricing.integration.spec.ts`: `cleanDatabase` + seed صف `default` + `createTestApp`):
1. `PUT /admin/pricing` (80/30/50) → إنشاء طلب → `baseFee=80`، `peripheralFee=0`، `extraStoresFee=30`.
2. طلب أُنشئ **قبل** التغيير → `approve` لا يغيّر `baseFee`Snapshot (60) لكن `peripheralFee/extraStoresFee` يأخذان الجديد (إثبات D21).
3. `recalculateFee` عبر نقطة runner (إضافة متجر) → `extraStoresFee = 30 × (n−1)`.
4. `customFee` ما زال مرفوضًا عند الاعتماد (400) — حارس الإنتاج.
5. **Fallback**: حذف صف `PlatformPricing` → كل المسارات ترجع 60/20/40 بلا 5xx.
6. اتساق `GET /admin/pricing` مع الأرقام المحسوبة فعليًا.
ولا تعديل على `pricing-behavior.integration.spec.ts` (S1 = 14/14) ولا على أي assertion قائم.

### 6. التحقق الإلزامي
```bash
pnpm build && pnpm typecheck && pnpm lint
pnpm --filter forerun-api test              # 346 + الجديد
pnpm --filter forerun-api test:integration  # 38 + S2
git grep -n "TODO(6A-3.1b)" -- apps/api/src              # يجب أن يكون فارغًا
git grep -n "DEFAULT_PRICING_CONFIG" -- apps/api/src     # لا يبقى إلا داخل PricingService كـ fallback
git grep -nE "MAX_CUSTOM_FEE" -- packages                # 0 ثابتة
git grep -nE "customFee" -- apps/customer-web apps/runner-pwa apps/android   # فارغ
git diff master --name-only -- apps/api/src packages apps/admin-web           # فقط المواقع المتوقعة
```

### 7. التوثيق
- `NEXT_TASKS.md`: 6A-3.1b → ✅ مع الـ hash.
- `PROJECT_STATUS.md §12`: تسجيل **D21/D22/D23** · `§9`: سطر حدث في سجل الأحداث.
- `PROJECT_STATUS.md` تفاصيل D20: **احذف سطر «⚠️ شرط السريان (تُحدَّث عند 6A-3.1b)»** — بعد هذه الخطوة يصبح تحذير D20 محققًا فعليًا.
- `ROLLBACK_PLAN_dynamic-pricing.md`: بند تراجع 6A-3.1b = `git revert` للـ commit الأول فقط؛ **لا رجوع مالي للطلبات القائمة** لأن `extraStoresFee` بلا لقطة (D16)؛ صفر أثر على `LedgerEntry`/`Settlement`.

### 8. الـ commits (3، دلالية — بلا دمج)
```
feat(pricing): wire getPricingConfig into order creation, approval and recalculation
test(pricing): add S2 integration suite for dynamic pricing wiring
docs: close 6A-3.1b and record decisions D21-D23
```

### 9. بوابة الدمج والنشر — ‎يتطلب موافقة صريحة للمالك
```bash
git checkout master && git merge --no-ff feature/sprint-6a-dynamic-pricing-backend
pnpm --filter forerun-api exec prisma migrate deploy   # add_platform_pricing + add_order_custom_fee
node scripts/diff-schema.js
```
- ترتيب النشر: الـ migration **قبل** تشغيل الـ API الجديد (الكود لا ينهار بدونه — `getPricingConfig` يلتقط الخطأ ويرجع للافتراضي مع `Logger.error` — لكنه يُصدر ضجيجًا في سجلات).
- Smoke بعد النشر: `GET /admin/pricing` يرجع 60/20/40 من صف الـ seed · إنشاء طلب تجريبي ومطابقة الأرقام · `PUT` 80/30/50 ثم طلب جديد (يجب أن يُحتسب 80) ثم **العودة للسعر المعتمد** أو تثبيت القرار.
- تحذير: بعد 3.1b يصبح **تعديل الأسعار مؤثّرًا فعليًا** (تحذير D20). نافذة آمنة للتعديل: تفادي وجود طلبات `IN_PROGRESS` (D20).

## المخاطر

| الخطر | الأثر | التخفيف |
|---|---|---|
| الكاش 30ث في نسخ API متعددة بعد `PUT` | معاينة/حساب قد يعرض سعرًا سابقًا للحظة | `updatePlatformPricing` يفرّغ كاش العملية؛ يُسجَّل كـ D23 مع ملاحظة في `PROJECT_STATUS §12` |
| تعديل صف `PlatformPricing` مباشرة بالـ DB | لا AuditLog | التعديل المعتمد ومرئي عبر `PUT` فقط (`PRICING_UPDATED`) |
| صف مفقود/غير صالح | ارتداد صامت لـ 60/20/40 | سلوك قائم مع `Logger.warn` + اختبار S2 رقم 5 |
| خلط في `createOrder` (بنية جديدة) | كسر استجابة `estimatedFee` | مراجعة سطر `:359-370` بعد التعديل + اختبار `create-order.integration.spec.ts` القائم |

## خارج النطاق
6B-1..6B-4 (أسطح العرض ثم رفع `MAX_CUSTOM_FEE = 500`) · حذف `@default(60)` (D19، migration مستقل) · `RUNNER_SHARE_BP` (D12) · أي تعديل على Android/الزبون/المندوب.
