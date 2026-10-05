# ROLLBACK_PLAN — Dynamic Platform Pricing + Order Custom Fee

> **التاريخ:** 2026-10-04
> **النطاق:** Feature كاملة (DB + API + Shared Types + 5 أسطح عرض)
> **مُلزِمي事由:** `AGENTS.md` — أي عملية على Ledger/Settlement/رسوم الطلب تحتاج خطة تراجع **قبل التنفيذ**
> **سابق:** آخر migration = `20261004160000_add_orderstore_isdeleted_index`
> **الحالة:** مُعدّة — **لا تُنفَّذ قبل تفريغ B1–B6 من `PRE_SPRINT_CHECKLIST.md`**

---

## 1. وصف العملية

### 1.1 تغييرات قاعدة البيانات (nullable/reversible)
| جدول | التغيير | المخاطرة |
|---|---|---|
| `PlatformPricing` | 🆕 إنشاء جدول (صف واحد) | **منخفضة** — لا يمسّ بيانات تاريخية |
| `Order` | ➕ `customFee Int @default(0)` **NOT NULL** | **منخفضة** — default محايد، بلا backfill |
| `User` | ➕ `pricingUpdates PlatformPricing[]` | **منخفضة** |

### 1.2 تغييرات(nullable تسبّب انهياراً صامتاً
| حقل | المشكلة |
|---|---|
| `Order.customFee` | يُضاف كـ`NOT NULL @default(0)` **إلزامياً**. تحديث لاحق يحتاج `NOT NULL` بـdefault ⇒ **non-zero-up** |

### 1.3 ⚠️ الأثر المالي الحقيقي ليس في الـDDL — بل في إعادة التسعير

> **ال خطر الجوهري:** `recalculateFee` (`pricing.service.ts:111`) و `applyPeripheralFeeIfNeeded` (`admin-order-command.service.ts:164`) تستدعيان `calculateFee()` التي تقرأ **`PRICING.BASE_FEE` حيّاً**.
> عند نشر المرحلة 3 **قبل** إصلاح B2: كل طلب غير مُسلَّم في الطريق سيُعاد تسعيره صامتاً إلى القيمة الجديدة عند شراء المندوب أو التسليم.
> **الطلبات المتأثرة:** كل طلب بحالة ≠ `DELIVERED` وقت النشر (~50 طلب/يوم).

**حجم الحجم:** `Runner.totalFeesPaid` (`schema.prisma:124`) · `Settlement`/`SettlementItem` (`schema.prisma:390-392`, `:411-413`) · `LedgerEntry` (`schema.prisma:366`)

---

## 2. خطوات التقدّم (Forward)

**الترتيب إلزامي — B2 قبل B3.**

```
F0  [شرط] B1–B6 مُفرَّغة + هذا المستند مُوقَّع + اختبار تكامل تسعير (S1) أخضر
F1  Migration A (صرفة، بلا تعديل سلوك):
      - CREATE TABLE PlatformPricing (+ CHECK على أي قيود)
      - ALTER TABLE "Order" ADD COLUMN customFee Int NOT NULL DEFAULT 0
      - ALTER TABLE "User" ADD back-relation
      - INSERT INTO PlatformPricing (id,...) VALUES ('default', 60,20,40, ...) ON CONFLICT DO NOTHING
F2  shared-types: إضافة customFee/customFeeReason + PricingConfig
F3  PricingService: calculateFee تبقى نقية + getPricingConfig() غير متزامنة + PricingConfig مُمرَّر
F4  ⚠️ B2: recalculateFee → extraStoresFee فقط، حفظ baseFee/peripheralFee من الطلب
F5  ⚠️ B1: SettlementsService يقرأ من PricingService (مصدر واحد)
F6  Ledger: نفس النسبة 75/25 (بدون تغيير في الأنواع)
F7  Admin endpoints + AuditLog + WebSocket
F8  5 أسطح العرض (admin / customer-web / runner-pwa / Android / customer-web AccountScreen)
F9  إعادة نشر + مراقبة
```

**حدود المعاملات:** F1 = migration منفصلة · F3–F7 = معاملات NestJS `$transaction` قائمة مع `CONFIG.TRANSACTION_TIMEOUT_MS` · F1 **لا يُدمج** مع F3–F7 إطلاقاً.

---

## 3. خطوات التراجع (REQUIRED)

### 3.1 التراجع السريع — قبلDelivery (مرMinutes)
```sql
-- R1: إيقاف الكتابة على الأسعار (-feature flag، ليست SQL)
-- R2: إرجاع القيم للثوابت المعروفة
UPDATE "PlatformPricing" SET "baseFee"=60, "extraStoreFee"=20, "peripheralFee"=40
  WHERE id='default';
-- R3: إعادة نشر build المرحلة السابقة (F4/F5/F6 غير مطبّقة)
```
**المدة:** < 5 دقائق · **ال impact:** لا يمسّ `LedgerEntry` إطلاقاً (append-only).

### 3.1.1 تراجع Migration `20261005011000_add_platform_pricing` (المرحلة 1)
حذف جدول `PlatformPricing` آمن تماماً في هذه المرحلة لأن الكود الإنتاجي لا يقرأ منه بعد (يقرأ من `PRICING` الثابت كـfallback):
```sql
-- مسار التراجع اليدوي على DB:
DROP TABLE IF EXISTS "PlatformPricing" CASCADE;
DELETE FROM _prisma_migrations WHERE migration_name = '20261005011000_add_platform_pricing';
```
```bash
# أو عبر prisma migrate:
npx prisma migrate resolve --rolled-back 20261005011000_add_platform_pricing
```

### 3.1.2 تراجع الخطوة 6A-3.2 (إصلاح حفظ لقطة الطلب B2 وجعل config إلزاميًا)
تعديل برمجيات بحت في مسارات `PricingService` وخدمات الطلبات والاختبارات (`c3cc60d` و `f26e2e0`):
- لا يمس أي schema أو migrations أو جداول قاعدة البيانات.
- التراجع عنه يتم عبر `git revert f26e2e0 c3cc60d` (أو التراجع عن الـ commits) وإعادة النشر بأمان تام.
- لا يؤثر على أي قيود مالية في `LedgerEntry` (append-only) للطلبات السابقة.

### 3.1.3 تراجع الخطوة 6A-3.3 (توحيد حساب الحصص لكل طلب B1)
تعديل برمجي بحت في حسابات التسوية (`646f9d4` و `78b4400`):
- لا يمس أي schema أو migrations أو جداول قاعدة البيانات.
- التراجع عنه يتم عبر `git revert 78b4400 646f9d4` بأمان تام.
- لا يمس أي قيود تاريخية في `LedgerEntry` (append-only).

### 3.1.4 تراجع Migration `20261005110000_add_order_custom_fee` (الخطوة 6A-5)
إسقاط القيد ثم العمودين `customFee` و `customFeeReason` آمن تماماً في هذه المرحلة لأن لا كود إنتاجي يقرأهما أو يكتبهما بعد (قيمتهما الافتراضية 0 و null):
```sql
-- مسار التراجع اليدوي على DB:
ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_customFee_nonneg_check";
ALTER TABLE "Order" DROP COLUMN IF EXISTS "customFeeReason";
ALTER TABLE "Order" DROP COLUMN IF EXISTS "customFee";
DELETE FROM _prisma_migrations WHERE migration_name = '20261005110000_add_order_custom_fee';
```
```bash
# أو عبر prisma migrate:
npx prisma migrate resolve --rolled-back 20261005110000_add_order_custom_fee
```

### 3.1.5 تراجع الخطوة 6A-6 (ربط approveOrder مع customFee وbaseFee وحفظ customFee في recalculateFee)
تعديل برمجي بحت في خدمات وحزم الكود (`287d52d` و `9bf94c6` و `57dce57`):
- التراجع عنه يتم برمجياً عبر `git revert 57dce57 9bf94c6 287d52d` وإعادة النشر بأمان تام.
- **أثر البيانات:** طالما أن حارس الإنتاج `MAX_CUSTOM_FEE = 0` مفعّل، فلن توجد أي طلبات إنتاجية اعتُمدت بـ `customFee > 0`، وبالتالي التراجع البرمجي آمن بنسبة 100% ولا يمس أية بيانات.
- **إجراء التعامل إن اعتُمدت طلبات بـ customFee > 0:**
  في حال رُفع الحارس واعتُمدت طلبات بـ `customFee > 0` قبل التراجع:
  1. الطلبات التي وصلت حالة `DELIVERED`: كُتبت لها قيود `LedgerEntry` تتبع مبدأ `append-only` (حظر التعديل أو الحذف). الحصص والتسويات تظل مطابقة للدفتر المالي.
  2. الطلبات التي لا زالت قيد التنفيذ (`IN_PROGRESS` أو `AWAITING_RUNNER`): عند التراجع البرمجي دون إسقاط عمود قاعدة البيانات، سيتجاهل الكود القديم `customFee` ويعتمد على `totalFee` المسجل، ولكن لتفادي أي انحراف في `recalculateFee` للطلبات النشطة:
     يجب تنفيذ تسوية يدوية أو قيد تعديل إداري (`ADMIN_ADJUSTMENT`) لتعويض الفارق في رسم التوصيل، أو انتظار تسليم الطلبات النشطة قبل تطبيق الـ revert، مع توثيق ذلك في `AuditLog`.

### 3.1.6 تراجع الخطوتين 6A-7 و 6A-8 (مسارات وأسطح الأدمن للتسعير ومعاينة الرسوم)
تعديل برمجي في الـ API وواجهات الـ Admin (`976f3b5` و `61ca5f1` و `0fba194`):
- **مسار التراجع البرمجي:**
  `git revert 0fba194 61ca5f1 976f3b5` وإعادة البناء والنشر.
- **أثر البيانات وقواعد البيانات:**
  - لا يمس أي schema أو migrations إضافية (جدول `PlatformPricing` أنشئ سابقاً في 6A-2).
  - نقطة النهاية `POST /admin/orders/:id/fee-preview` هي نقطة محاكاة حسابية بحتة لا تنشئ ولا تعدل أي صف في قاعدة البيانات (Read-only simulation).
   - نقاط النهاية `GET/PUT /admin/pricing` تعدل صف جدول `PlatformPricing` فقط. **ملاحظة زمنية:** كان هذا البند مكتوبًا قبل 6A-3.1b، واليوم (بعد 6A-3.1b) صار الصف **مقروءًا** من `createOrder` و`approveOrder` و`recalculateFee`؛ فتراجع 3.1.6 وحده **لا** يعيد السلوك السابق. التراجع الكامل بعد 6A-3.1b = **3.1.6 + 3.1.7 معاً**.
  - إذا كان هناك رغبة بإسقاط جدول `PlatformPricing` بالكامل، راجع بند التراجع 3.1.1.
- **أثر السجل المالي:**
  صفر أثر على `LedgerEntry` أو `Settlement` أو حسابات المندوبين والعملاء.

### 3.1.7 تراجع الخطوة 6A-3.1b (ربط `getPricingConfig` بمسارات الإنتاج)
تعديل برمجي بحت في ثلاثة مواقع إنتاجية (`pricing.service.ts` · `admin-order-command.service.ts` · `customer-orders.service.ts`) + اختبارين (وحدة وتكامل):
- **مسار التراجع البرمجي:** `git revert <commit-6A-3.1b>` (الـ commit البرمجي فقط — **بدون** الـ commits الاختبارية والتوثيقية) وإعادة البناء والنشر.
- **لا يمس** أي schema أو migrations أو جداول قاعدة بيانات. `PlatformPricing` و `Order.customFee` يبقيان كما هما.
- **لا رجوع مالي للطلبات القائمة:** `extraStoresFee` **بلا لقطة** على الطلب (D16) — أي طلب أُنشئ أو اعتُمد قبل التراجع يحتفظ بقيمته المكتوبة، وليس هناك ما يُعاد حسابه فرقه ماليًا. أما `baseFee`/`peripheralFee`/`customFee` فهي **لقطات محفوظة** أصلًا (D11) ولا يمسّها التراجع.
- **أثر السجل المالي:** صفر على `LedgerEntry` و `Settlement` و `SettlementItem` (append-only) وعلى حسابات المندوبين.
- **ما يبقى فعالاً بعد التراجع:** صف `PlatformPricing` يبقى موجوداً في قاعدة البيانات لكن **لا يُقرأ**؛ كل المسارات ترجع إلى `DEFAULT_PRICING_CONFIG` (60/20/40) — نفس السلوك السابق للخطوة.
- **الفرق الجوهري بين هذا التراجع و R1–R3:** بعد 6A-3.1b يصبح تعديل الأسعار **مؤثّرًا فعليًا** (تحذير D20 محقق). لذلك إذا كان سبب التراجع **سعرًا خاطئًا**، فالتراجع وحده **لا يكفي** — نفّذ أيضاً R2:
  ```sql
  UPDATE "PlatformPricing" SET "baseFee"=60, "extraStoreFee"=20, "peripheralFee"=40
    WHERE id='default';
  ```
  (أو عبر `PUT /admin/pricing` بتمرير `updatedAt` الحالي إن كان الكود الجديد ما زال يعمل — وهو مُسجَّل في `AuditLog` كـ `PRICING_UPDATED`).
- **نافذة الأمان:** تجنّب وجود طلبات `IN_PROGRESS` عند التعديل (D20 + D16)، أو انتظار تسليمها أولاً.

### 3.2 التراجع العميق — بعد Delivery (أيام)
```bash
# R4: إيقاف كل traffic على endpoints التسعير
# R5: Rollback الـmigrations (Destructive — Adri متاح)
npx prisma migrate resolve --rolled-back <migration_name>
# R6: DROP_DATABASE المسار الآمن:
#   - تصدير قاعدة الإنتاج أولاً
#   - DROP TABLE "PlatformPricing"
#   - ALTER TABLE "Order" DROP COLUMN "customFee"
# ⚠️ راجع §4.2 — LedgerEntry لا يُمحى أبداً (قاعدة حراسة AGENTS.md)
```

> ⛔ **حظر مطلق:** لا `UPDATE` ولا `DELETE` على `LedgerEntry` أو `AuditLog` أو `SettlementItem`.
> التصحيح = **قيد تسوية جديد** (`ADMIN_ADJUSTMENT` — `schema.prisma:58`، حالياً غير مستعمل) + قيد `AuditLog`.
> هذا يجعل R6 آمناً: الـDDL يُسقط kolom الطلب لكن **السجل المالي يبقى صحيحاً**.

### 3.3 كشف الحاجة للتراجع
| المؤشر | الحد |
|---|---|
| `SUM(LedgerEntry[RUNNER_SHARE])` ≠ `SUM(SettlementItem[runnerShare])` | **أي** فارق ⇒ تراجع فوري |
| `SUM(ORDER_FEE_TOTAL) - SUM(RUNNER_SHARE) - SUM(PLATFORM_SHARE)` | ≠ 0 لأي طلب |
| `Order.totalFee` ≠ مجموع مكوّناته | أي طلب |
| شكاوى رسوم ⇒ `CustomFee` بلا سبب | أي حالة |
| 5xx في `deliver`/`purchaseStore` | > 1% من الطلبات |
| **اختبار B2 (حرج):** أي طلب أُنشئ بـ`baseFee` مختلف وaya-potaya تسعيره | **أي** حالة ⇒ 🚨 |

**اختبار B2 (للتراجع السريع):**
```sql
SELECT id, "orderNumber", "baseFee", "totalFee", status, "createdAt"
  FROM "Order"
 WHERE "deliveredAt" > '<ts_deploy>' AND status <> 'DELIVERED';
```
إن وُجد صف `baseFee` فيه ≠ لقطة الإنشاء ⇒ **B2 لم يُطبَّق ⇒ تراجع فوري**.

**المدة المقدَّرة:** R1–R3 < 5 د · R4–R6 = 1–2 ساعة (يحتاج نافذة صيانة)

---

## 4. استعلامات التحقق

### 4.1 بعد التقدّم
```sql
-- V1: صف واحد، قيم 60/20/40
SELECT * FROM "PlatformPricing";

-- V2: Rigester — كل طلب: المجموع = مجموع الحصص
SELECT o.id, o."totalFee",
       l_runner.amount AS r, l_platform.amount AS p,
       (l_runner.amount + l_platform.amount - o."totalFee") AS drift
  FROM "Order" o
  JOIN "LedgerEntry" l_runner   ON l_runner."orderId"=o.id AND l_runner.type='RUNNER_SHARE'
  JOIN "LedgerEntry" l_platform ON l_platform."orderId"=o.id AND l_platform.type='PLATFORM_SHARE'
 WHERE o.status='DELIVERED' AND ABS((l_runner.amount + l_platform.amount) - o."totalFee") > 0;

-- V3: ⛔ الخطر الرئيسي — Ledger ↔ Settlement (B1)
SELECT s.id, s."runnerShare" AS settlement_r,
       COALESCE(SUM(li."runnerShare"),0) AS items_r
  FROM "Settlement" s LEFT JOIN "SettlementItem" li ON li."settlementId"=s.id
 GROUP BY s.id, s."runnerShare"
HAVING s."runnerShare" <> COALESCE(SUM(li."runnerShare"),0);

-- V4: B2 — الطلبات التي أُعيد تسعيرها بعد النشر (يجب أن تكون فارغة)
SELECT id, "orderNumber", "baseFee", "totalFee"
  FROM "Order"
 WHERE "createdAt" < '<ts_deploy>' AND "updatedAt" > '<ts_deploy>'
   AND status <> 'DELIVERED';
```

### 4.2 بعد التراجع
```sql
-- V5: PlatformPricing اختفى
SELECT count(*) FROM "PlatformPricing";  -- متوقع: 0
-- V6: financial invariants سليمة (يجب أن تظل كما كانت)
--     V2 + V3 أعلاه ⇒ 0 صفوف
-- V7: لا فقد في السجل المالي
SELECT (SELECT count(*) FROM "LedgerEntry") AS ledger_count;  -- متوقع: مطابق لقبل التراجع
```

---

## 5. خطة الاتصال

| الدور | الإجراء | القناة |
|---|---|---|
| @code-architect | توقيع الخطة + تأكيد B1–B6 | git PR |
| @test-engineer | التحقق: rollback في بيئة اختبار + S1 أخضر | CI |
| @feature-dev | تنفيذ R4–R6 عند الطلب | — |
| المستخدم (مالك المنتج) | **إلزامي** — قرار أسعار المنصة + موافقة التسعير | مراجعة يدوية |
| فريق العمليات | نافذة الصيانة إن لزم R6 | — |

**تأثير على العميل (R6):** مستهدف. R1–R3 غير مرئيين.
**سابقة موثّقة (`NEXT_TASKS.md:24`):** تغييـر نسبة الأرباح إلى 80% **مرفوض**. أي في，变得 النسبة يحتاج **قراراً بشرياً منفصلاً وموثّقاً** — خارج هذا النطاق.

---

## 6. ✅ جاهزية (Go/No-Go)

- [ ] B1–B6 مُفرَّغة ومُراجَعة
- [ ] F4 (B2) مُنفَّذ **قبل** F5 — م sequencing مُلزِم
- [ ] اختبار تكامل تسعير أخضر (`NEXT_TASKS.md:60` — S1 مفتوح حالياً)
- [ ] `pnpm build && pnpm typecheck && pnpm lint && pnpm --filter forerun-api test && pnpm --filter forerun-api test:integration` أخضر
- [ ] `ROLLBACK_PLAN` مُختبَر في بيئة اختبار
- [ ] توقيع المستخدم على التسعير
- [ ] **R6 مُختبَر** (وليس R1–R3 فقط)