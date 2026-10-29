# خطة التراجع (Rollback Plan) — مسار العروض الترويجية: أول N طلبات مجاناً (Decision D59)

> **التاريخ:** 2026-10-29  
> **النطاق:** قاعدة البيانات + الباكند + الأنواع المشتركة + لوحة الإدارة + تطبيق أندرويد (`feature/free-orders-promo`)  
> **الإلزامية:** وفق قواعد الأمان المالي في `AGENTS.md` (البند 3: العمليات المالية) ومهارة `rollback-plan` — توثيق خطة التراجع واعتمادها بشرياً قبل فتح الفرع وكتابة أي كود تنفيذي.  
> **القرار المرتبط:** [PROJECT_STATUS.md §12 D59](file:///d:/FAWRUNF/FAWRUN/PROJECT_STATUS.md#d59--تطبيق-عرض-أول-n-طلبات-مجاناً-عبر-عداد-ذري-على-المستخدم-واسترجاع-الفتحة-عند-الإلغاء-2026-10-29).

---

## 1. وصف العملية والتغييرات المالية (Operation Description)

### 1.1 التغيير المالي والتشغيلي المخطط له
إطلاق ميزة ترويجية ديناميكية تمنح المستخدمين الجدد عدداً محدداً من طلبات التوصيل المجانية (افتراضياً: أول 3 طلبات مجاناً بدون رسوم توصيل `totalFee = 0`)، مع التحكم الكامل للإدارة عبر زر تبديل مركزي (Toggle) وحقل عداد في جدول تسعير المنصة `PlatformPricing`.

### 1.2 الجداول والأعمدة المتأثرة
1. **جدول `PlatformPricing`**:
   - `freeOrdersPromoEnabled Boolean @default(false)`: مفتاح الإيقاف/التشغيل العام والفوري للعرض.
   - `freeOrdersCount Int @default(3)`: عدد الطلبات المجانية الممنوحة لكل عميل جديد يُسجل أثناء تفعيل العرض.
2. **جدول `User`**:
   - `freeOrdersRemaining Int @default(0)`: رصيد العميل المتبقي من فتحات التوصيل المجانية. يُزرع فقط عند تسجيل حساب جديد بقيمة `freeOrdersCount` إذا كان `freeOrdersPromoEnabled = true`، أو بـ `0` إذا كان العرض معطلاً.
3. **جدول `Order`**:
   - `wasFreeOrderSlot Boolean @default(false)`: راية حتمية غير قابلة للتغيير تُحدد ما إذا كان هذا الطلب قد استهلك فتحة مجانية من رصيد العميل، وتُستخدم حصرياً لاسترجاع الفتحة تلقائياً في حال إلغاء الطلب لاحقاً.
4. **جدول `LedgerEntry`**:
   - **لا يتم إنشاء أي قيد مالي** (`LedgerEntry`) عند تسليم طلب برسم توصيل مجاني (`totalFee = 0`)، تماشياً مع قاعدة السلامة المالية الصارمة D53 التي ترفض القيود الصفرية أو السالبة (`amount <= 0`).
5. **جدول `AuditLog`**:
   - تسجيل إلزامي لعمليات استهلاك الفتحة (`ORDER_FREE_PROMO_APPLIED`) واسترجاعها عند الإلغاء (`ORDER_FREE_PROMO_RESTORED`) وتغيير إعدادات العرض إدارياً (`PLATFORM_PRICING_UPDATED`).

### 1.3 حجم الأثر المتوقع (Expected Volume)
- استهلاك الفتحات: محصور بالعملاء المؤهلين الذين يملكون `freeOrdersRemaining > 0` أثناء تفعيل العرض.
- حجم التسجيل الجديد المتوقع: ~10 إلى 50 عميلاً يومياً في مرحلة الإطلاق.

---

## 2. خطوات التقدّم (Forward Steps)

يتم التنفيذ عبر 9 خطوات ذرية (FP-1 حتى FP-9) على الفرع `feature/free-orders-promo`:

```
FP-1  [Migration] إضافة الأعمدة الأربعة بقيم افتراضية محايدة (لا تمس بيانات تاريخية):
        - PlatformPricing: freeOrdersPromoEnabled (false), freeOrdersCount (3)
        - User: freeOrdersRemaining (0)
        - Order: wasFreeOrderSlot (false)
FP-2  [shared-types] إضافة حقول PricingConfig و UpdatePlatformPricingSchema و User/Order types مع Zod
FP-3  [Backend — التسجيل] زرع freeOrdersRemaining عند إنشاء المستخدم الجديد بناءً على حالة العرض اللحظية
FP-4  [Backend — استهلاك الفتحة] خصم ذري بالقفل التفاؤلي داخل transaction إنشاء الطلب (createOrder)
        - شرط: if (config.freeOrdersPromoEnabled && user.freeOrdersRemaining > 0)
        - تحديث: updateMany({ where: { id: userId, freeOrdersRemaining: { gt: 0 } }, data: { decrement: 1 } })
        - نجاح الخصم (count === 1) -> ضبط totalFee = 0 و wasFreeOrderSlot = true و AuditLog
FP-5  [Backend — استرجاع الفتحة عند الإلغاء] في مسارات الإلغاء (Customer Cancel أو Admin Force Cancel D39):
        - إن كان order.wasFreeOrderSlot === true -> increment: freeOrdersRemaining بمقدار 1 + AuditLog
FP-6  [Backend — توافق Idempotency D58] إعادة محاولة الطلب بنفس المفتاح تعيد نفس الطلب دون استهلاك فتحة إضافية
FP-7  [Admin UI] إضافة مفتاح التحكم وحقل العداد في /dashboard/pricing مع التنبيه الإرشادي
FP-8  [Android UI] إظهار شريط الرصيد المتبقي من بيانات الخادم دون أي حساب محلي (Rule 1)
FP-9  [اختبارات الجودة الشاملة] 5 اختبارات تكامل للسيناريوهات المالية والتزامنية والبوابة الرباعية كاملة
```

---

## 3. آلية التراجع والتعطيل في حالات الطوارئ (Rollback Strategy)

تم تصميم النظام ليوفر **3 مستويات متدرجة للتراجع**، تبدأ من التعطيل التشغيلي الفوري في ثوانٍ معدودة دون لمس الكود أو قاعدة البيانات، وصولاً إلى التراجع البرمجي الكامل:

```
[المستوى 1: المفتاح الفوري Kill-Switch] ──> ثوانٍ معدودة عبر لوحة الأدمن أو SQL (بدون نشر كود)
                  │
[المستوى 2: تراجع الكود والتجميد الآمن] ──> دقائق عبر git revert مع إبقاء الأعمدة خاملة (Safe Freeze)
                  │
[المستوى 3: إسقاط الهجرة الكامل DDL]   ──> إجراء طارئ استثنائي فقط إن فشل النشر قبل الإطلاق الحي
```

---

### 3.1 المستوى الأول: التعطيل التشغيلي الفوري (Instant Operational Kill-Switch)
> **الزمن المتوقع:** < 30 ثانية.  
> **الأثر:** فوري وبدون أي توقف للخدمة (Zero Downtime)، ولا يتطلب أي نشر كود أو مساس بقاعدة البيانات.

#### كيف يعمل؟
يقوم المشرف بتحويل مفتاح العرض إلى وضع الإيقاف (`freeOrdersPromoEnabled = false`) من لوحة التحكم (`/dashboard/pricing`) أو بتنفيذ استعلام SQL مباشر:
```sql
UPDATE "PlatformPricing"
SET "freeOrdersPromoEnabled" = false, "updatedAt" = NOW()
WHERE id = 'default';
```

#### السلوك الدقيق للنظام عند التعطيل:
1. **المستخدمون الجدد:** يُزرع لهم `freeOrdersRemaining = 0` تلقائياً فوراً من لحظة الإيقاف.
2. **إنشاء الطلبات الجديدة:** شرط الاستهلاك `if (pricingConfig.freeOrdersPromoEnabled && user.freeOrdersRemaining > 0)` يفشل فورياً، فيتم تسعير كافة الطلبات الجديدة بالرسوم الطبيعية دون خصم، ولا يُنقَّص رصيد أي مستخدم، ولا يُعلَّم أي طلب بـ `wasFreeOrderSlot`.
3. **أرصدة المستخدمين الحاليين:** **تتجمد بأمان تام**؛ لا تُمس ولا تُحذف. إذا أعادت الإدارة تفعيل العرض مستقبلاً، يستأنف المستخدمون الاستفادة من أرصدتهم المتبقية.
4. **الطلبات الجارية والمسلمة سابقاً:** لا تتأثر مطلقاً وتستمر دورة حياتها الطبيعية.
5. **استرجاع الفتحات عند الإلغاء:** إذا تم إلغاء طلب سابق كان قد استهلك فتحة مجانية (`wasFreeOrderSlot === true`)، تُسترجع الفتحة إلى رصيد المستخدم تلقائياً (`freeOrdersRemaining += 1`) حفاظاً على حق العميل، لكنه لن يتمكن من استهلاكها طالما أن العرض معطل (`freeOrdersPromoEnabled = false`).

---

### 3.2 المستوى الثاني: تراجع الكود مع التجميد الآمن للأعمدة (Code Revert with Safe Freeze)
> **الزمن المتوقع:** 5 إلى 10 دقائق.  
> **الأثر:** إعادة الكود البرمجي للإصدار السابق عبر `git revert` مع إبقاء أعمدة قاعدة البيانات في حالة خمود آمنة (Dormant).

#### لماذا التجميد الآمن هو الخيار الأفضل بدلاً من حذف الأعمدة مباشرة؟
1. **منع حظر الجداول (Lock Contention):** إسقاط الأعمدة (`ALTER TABLE DROP COLUMN`) على جداول مركزية حية مثل `User` و `Order` يتطلب قفل وصول حصري (`ACCESS EXCLUSIVE LOCK`) قد يؤدي إلى تجميد استعلامات الإنتاج أثناء ذروة العمليات.
2. **التوافق العكسي التام مع Prisma:** الكود السابق لـ `master` لا يعرف الأعمدة الجديدة ولا يطلبها في استعلامات `SELECT` أو `INSERT`، وبما أن الأعمدة الجديدة تملك قيماً افتراضية (`DEFAULT`)، فإن الكود القديم يعمل بسلاسة تامة بنسبة 100% دون أدنى تعارض مع بنية الـ DB.
3. **الحفاظ على سلامة التاريخ الرقابي:** إبقاء عمود `wasFreeOrderSlot` يحفظ السجل التاريخي للطلبات التي سُلِّمت مجاناً أثناء فترة تشغيل الميزة، مما يمنع تشويه التقارير المحاسبية.

#### خطوات التنفيذ:
1. تعطيل العرض تشغيلياً (المستوى الأول) لضمان عدم إنشاء أي طلبات مجانية جديدة.
2. تنفيذ `git revert` لـ commits الميزة على فرع `master`.
3. نشر الإصدار المعكوس عبر CI/CD المعتاد إلى Railway و Vercel.

---

### 3.3 المستوى الثالث: التراجع الكامل عن الهجرة وإسقاط الأعمدة (DDL Reversal Migration)
> **الزمن المتوقع:** 10 إلى 15 دقيقة (يُنفَّذ فقط في نافذة صيانة أو في حال فشل الـ migration أثناء النشر الأولي قبل بدء أي عمليات إنتاجية).

في حال تقرر استئصال الأعمدة نهائياً من قاعدة البيانات، يُنفَّذ سكريبت التراجع التالي:

```sql
BEGIN;

-- 1. التأكد من عدم وجود معاملات نشطة معلقة
SET LOCAL lock_timeout = '5s';

-- 2. إسقاط الأعمدة من الجداول بالترتيب
ALTER TABLE "Order" DROP COLUMN IF EXISTS "wasFreeOrderSlot";
ALTER TABLE "User" DROP COLUMN IF EXISTS "freeOrdersRemaining";
ALTER TABLE "PlatformPricing" DROP COLUMN IF EXISTS "freeOrdersPromoEnabled";
ALTER TABLE "PlatformPricing" DROP COLUMN IF EXISTS "freeOrdersCount";

-- 3. إزالة سجل الهجرة من جدول هجرات بريزما للسماح بإعادة المحاولة لاحقاً
DELETE FROM "_prisma_migrations" 
WHERE migration_name LIKE '%add_free_orders_promo%';

COMMIT;
```

ثم محاذاة Prisma محلياً:
```bash
pnpm exec prisma migrate resolve --rolled-back "<migration_name>"
```

---

## 4. استعلامات التحقق والمراقبة (Verification & Health Queries)

### 4.1 استعلام فحص حالة العرض ورصيد العملاء
```sql
-- التحقق من حالة إعدادات التسعير
SELECT id, "baseFee", "freeOrdersPromoEnabled", "freeOrdersCount", "updatedAt"
FROM "PlatformPricing"
WHERE id = 'default';

-- إحصائية أرصدة العملاء الحالية
SELECT 
  "freeOrdersRemaining", 
  COUNT(*) AS user_count
FROM "User"
WHERE "role" = 'CUSTOMER' AND "isDeleted" = false
GROUP BY "freeOrdersRemaining"
ORDER BY "freeOrdersRemaining" DESC;
```

### 4.2 استعلام فحص سلامة الطلبات المجانية
```sql
-- التحقق من مطابقة الطلبات المجانية (يجب أن يكون totalFee = 0 دائماً)
SELECT 
  id, "orderNumber", "customerId", "status", "baseFee", "totalFee", "wasFreeOrderSlot", "createdAt"
FROM "Order"
WHERE "wasFreeOrderSlot" = true
ORDER BY "createdAt" DESC
LIMIT 20;

-- كشف أي شذوذ مالي (يجب أن تكون النتيجة 0 صفوف قطيعاً)
SELECT id, "orderNumber", "totalFee", "wasFreeOrderSlot"
FROM "Order"
WHERE ("wasFreeOrderSlot" = true AND "totalFee" > 0)
   OR ("wasFreeOrderSlot" = false AND "totalFee" = 0 AND "status" != 'CANCELLED');
```

### 4.3 استعلام فحص دفتر الأستاذ (Zero-Ledger Check)
```sql
-- تأكيد عدم وجود أي قيد مالي مسجل لطلبات التوصيل المجانية (يجب أن تكون النتيجة 0 دائماً وفق D53)
SELECT l.id, l."orderId", l."amount", l."type", o."wasFreeOrderSlot"
FROM "LedgerEntry" l
JOIN "Order" o ON l."orderId" = o.id
WHERE o."wasFreeOrderSlot" = true;
```

---

## 5. خطة التواصل والاستجابة (Incident Communication Plan)

| الدور | المسؤول | الإجراء عند تفعيل خطة التراجع | قناة الاتصال |
|---|---|---|---|
| **مدير النظام / المشرف** | الإدارة | تحويل مفتاح `freeOrdersPromoEnabled` إلى `false` فوراً عبر لوحة التحكم | Admin Dashboard |
| **مهندس البرمجيات** | Code Architect | مراقبة سجلات الـ API و Sentry واستعلامات التحقق المالي | Railway Logs / Sentry |
| **الدعم الفني والعملاء** | فريق العمليات | في حال استفسار أي عميل: توضيح أن العرض الترويجي المؤقت قد انتهت فترته، والأرصدة غير المستهلكة محفوظة في الحساب | WhatsApp Support |

---

## 6. إقرار الجاهزية والاعتماد (Sign-off)

- [x] تم تحليل المسارات المالية وتأكيد التوافق التام مع D53 (عدم إنشاء قيود صفرية في `LedgerEntry`).
- [x] تم إثبات أن `freeOrdersPromoEnabled = false` تعمل كقاطع طوارئ فوري (Kill-Switch) شامل يعزل النظام في ثوانٍ دون لمس البيانات.
- [x] تم إقرار استراتيجية التجميد الآمن (Safe Freeze) لتجنب أقفال الجداول في الإنتاج.
- [x] الخطة جاهزة للاعتماد لبدء فتح الفرع `feature/free-orders-promo` والتنفيذ بالترتيب.
