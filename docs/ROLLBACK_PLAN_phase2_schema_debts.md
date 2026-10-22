# خطة التراجع (Rollback Plan) — المرحلة 2: ديون Schema والعقود (D19, C-2)

> **التاريخ:** 2026-10-22  
> **النطاق:** بنية قاعدة البيانات (جداول `Order`, `Settlement`, `SettlementItem`) + عقود DTO  
> **الإلزامية:** وفق قواعد الأمان المالي في `AGENTS.md` ومهارة `rollback-plan` — توثيق خطة التراجع واعتمادها قبل فتح أي فرع كود أو تطبيق أي migration.  
> **الحالة الحالية لقاعدة البيانات:** متطابقة بنسبة 100% مع schema (`13 migrations found`, `Database schema is up to date`, `[RESULT: IN SYNC]`).

---

## 1. وصف العمليات المالية والتغييرات

| البند | الجدول المستهدف | التغيير | المخاطرة | حجم الأثر |
|---|---|---|---|---|
| **D19** | `Order` | حذف `@default(60)` من عمودي `baseFee` و `totalFee` | **منخفضة جداً** — لا يمس أي بيانات موجودة ولا يغير أي قيمة مسجلة | معدومة على البيانات الحية؛ يحمي النظام من إنشاء أي طلب بقيمة افتراضية بالخطأ |
| **C-2** | `Settlement` & `SettlementItem` | حذف عمودي `runnerShare` و `platformShare` الإرثيين | **متوسطة** — عملية DDL بحذف أعمدة إرثية أصبحت ثابتة منذ D26 | لا يؤثر على حركة الحسابات؛ المندوبون براتب ثابت والنظام يقرأ ويعتمد `totalFees` فقط |

---

## 2. الحالة قبل التغيير (Current Baseline State)

- **فحص Prisma Migrate Status:**
  ```text
  13 migrations found in prisma/migrations
  Database schema is up to date!
  ```
- **فحص Schema Drift Detector (`node scripts/diff-schema.js`):**
  ```text
  [SUMMARY OF DRIFT]
  - Expected models in schema.prisma: 18
  - Base tables found in database:    18
  - Missing/Extra tables/columns:     0
  [RESULT: IN SYNC] No schema drift detected! Live database schema matches schema.prisma.
  ```
- **حالة جدول `Order`:**
  - `baseFee`: `INTEGER NOT NULL DEFAULT 60`
  - `totalFee`: `INTEGER NOT NULL DEFAULT 60`
  - تم التحقق من الكود البرمجي: نقطة إنشاء الطلب الوحيدة (`customer-orders.service.ts:189-192`) وكافة سيناريوهات الاختبارات تمرر `baseFee` و `totalFee` صراحةً بنسبة 100%.
- **حالة جدولي `Settlement` و `SettlementItem`:**
  - تحوي `runnerShare` و `platformShare` (أعمدة `INTEGER NOT NULL`).
  - منذ اعتماد القرار D26 (2026-10-06)، تُكتب هذه الحقول كـ `0` لحصة المندوب و `totalFees` / `order.totalFee` لحصة المنصة. لا يوجد أي منطق تحكم أو قرار مالي يعتمد على قراءتها.
  - شاشات `admin-web` و `runner-pwa` لا تقرأ هذه الأعمدة إطلاقاً (تم التحقق: 0 ظهور).

---

## 3. خطوات التقدّم (Forward Migration)

### 3.1 الفرع fix/d19-remove-fee-defaults
- **العملية:**
  ```sql
  -- AlterTable
  ALTER TABLE "Order" ALTER COLUMN "baseFee" DROP DEFAULT;
  ALTER TABLE "Order" ALTER COLUMN "totalFee" DROP DEFAULT;
  ```
- **حدود المعاملة:** معاملة DDL منفصلة داخل migration مستقل `remove_order_fee_defaults`.
- **زمن التنفيذ المتوقع:** < 1 ثانية.

### 3.2 الفرع cleanup/c2-remove-legacy-share-columns
- **العملية:**
  ```sql
  -- AlterTable
  ALTER TABLE "Settlement" DROP COLUMN "runnerShare";
  ALTER TABLE "Settlement" DROP COLUMN "platformShare";

  -- AlterTable
  ALTER TABLE "SettlementItem" DROP COLUMN "runnerShare";
  ALTER TABLE "SettlementItem" DROP COLUMN "platformShare";
  ```
- **حدود المعاملة:** معاملة DDL منفصلة داخل migration مستقل `remove_legacy_share_columns`.
- **تحديثات الكود المرافقة:** حذف الحقلين من DTOs في `packages/shared-types` وخدمة `settlements.service.ts`.
- **زمن التنفيذ المتوقع:** < 2 ثانية.

---

## 4. خطوات التراجع الدقيقة في حال الطوارئ (Rollback Steps)

### 4.1 التراجع عن D19 إن فشل التطبيق
- **أمر التراجع السريع (Reverse DDL):**
  ```sql
  ALTER TABLE "Order" ALTER COLUMN "baseFee" SET DEFAULT 60;
  ALTER TABLE "Order" ALTER COLUMN "totalFee" SET DEFAULT 60;
  ```
- **تسجيل التراجع في Prisma:**
  حذف سجل الـ migration من جدول `_prisma_migrations` عبر:
  ```sql
  DELETE FROM "_prisma_migrations" WHERE migration_name LIKE '%remove_order_fee_defaults%';
  ```
- **الزمن المقدر:** أقل من دقيقة واحدة.
- **هل يحتاج استعادة نسخة احتياطية كاملة؟**
  **قطعاً لا.** التغيير لم يحذف أي عمود أو بيانات، وإعادة الـ DEFAULT تتم لحظياً عبر ALTER COLUMN.

### 4.2 التراجع عن C-2 إن فشل التطبيق
- **المخطط الفعلي لجدول `SettlementItem` (المُنشأ في 20260911172902_init والمثبَت بالـ DB):**
  - `id`: TEXT (PK)
  - `settlementId`: TEXT (FK -> Settlement)
  - `orderId`: TEXT (Unique, FK -> Order)
  - `orderFee`: INTEGER NOT NULL — **عمود موجود فعلياً في الجدول** يحفظ لقطة رسم الطلب لحظة التسوية (`totalFee`)
  - `runnerShare`: INTEGER NOT NULL (العمود المستهدف بالحذف)
  - `platformShare`: INTEGER NOT NULL (العمود المستهدف بالحذف)

- **أمر التراجع السريع (Reverse DDL + Backfill):**
  ```sql
  -- 1. إعادة إضافة الأعمدة بقيمة افتراضية 0 لمنع خطأ NOT NULL على السجلات القائمة
  ALTER TABLE "Settlement" ADD COLUMN "runnerShare" INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE "Settlement" ADD COLUMN "platformShare" INTEGER NOT NULL DEFAULT 0;

  ALTER TABLE "SettlementItem" ADD COLUMN "runnerShare" INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE "SettlementItem" ADD COLUMN "platformShare" INTEGER NOT NULL DEFAULT 0;

  -- 2. استعادة التطابق الحسابي لما بعد D26 (حصة المنصة = إجمالي الرسوم)
  -- أ. رأس التسوية:
  UPDATE "Settlement" SET "platformShare" = "totalFees" WHERE "platformShare" = 0;

  -- ب. بنود التسوية — [الخيار المفضل والموصى به دفاعياً (Recommended)]:
  -- سحب totalFee مباشرة من جدول Order عبر JOIN لضمان القراءة من المصدر الأصلي:
  UPDATE "SettlementItem" si
  SET "platformShare" = o."totalFee"
  FROM "Order" o
  WHERE si."orderId" = o.id AND si."platformShare" = 0;

  -- خيار بديل (عبر عمود orderFee المحفوظ في SettlementItem ذاته):
  -- UPDATE "SettlementItem" SET "platformShare" = "orderFee" WHERE "platformShare" = 0;
  ```
  *(ملاحظة أمان: تم اختبار كلا الاستعلامين بنجاح في معاملة تجريبية Dry-Run حية على قاعدة البيانات المحلية)*.

- **تسجيل التراجع في Prisma:**
  ```sql
  DELETE FROM "_prisma_migrations" WHERE migration_name LIKE '%remove_legacy_share_columns%';
  ```
- **الزمن المقدر:** أقل من 2 دقيقة.
- **هل يحتاج استعادة نسخة احتياطية كاملة؟**
  **لا حاجة لاستعادة نسخة احتياطية للتشغيل الحي.**
  - سبب ذلك: كافة التسويات منذ اعتماد القرار D26 تعتمد رياضياً `runnerShare = 0` و `platformShare = totalFees`. أوامر الـ UPDATE أعلاه تعيد الحالة إلى التطابق التام 100%.
  - السجلات التاريخية السابقة لـ D26 (قبل 2026-10-06): محفوظة ومحمية بالكامل في قيود `LedgerEntry` المحاسبية غير القابلة للتعديل أو الحذف (Append-only).
  - بالتالي Migration عكسي كافٍ تماماً لإعادة الاستقرار الفوري دون إيقاف قاعدة البيانات.

---

## 5. استعلامات التحقق (Verification Queries)

### بعد التقدّم (Forward Verification):
```sql
-- 1. التأكد من إزالة الـ Defaults من Order
SELECT column_name, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'Order' AND column_name IN ('baseFee', 'totalFee');
-- المتوقع: column_default IS NULL لكلا العمودين

-- 2. التأكد من حذف عمودي الحصص
SELECT column_name
FROM information_schema.columns
WHERE table_name IN ('Settlement', 'SettlementItem')
  AND column_name IN ('runnerShare', 'platformShare');
-- المتوقع: 0 صفوف
```

### بعد التراجع إن حدث (Rollback Verification):
```sql
-- 1. التأكد من عودة Defaults جدول Order
SELECT column_name, column_default
FROM information_schema.columns
WHERE table_name = 'Order' AND column_name IN ('baseFee', 'totalFee');
-- المتوقع: column_default = 60 لكلا العمودين

-- 2. التأكد من تطابق قيم platformShare المستعادة مع totalFees
SELECT id, "totalFees", "runnerShare", "platformShare"
FROM "Settlement"
WHERE "platformShare" != "totalFees";
-- المتوقع: 0 صفوف (تطابق تام 100%)
```

---

## 6. خطة التواصل وإدارة المخاطر (Communication & Safety)

1. **الالتزام بالقيد الصارم:** لا تنفيذ لـ `prisma migrate deploy` على بيئة الإنتاج في Railway إلا بعد موافقة وتأكيد خطي صريح من المالك.
2. **أخذ لقطة احتياطية احترازية (Snapshot Backup):** قبل تشغيل أي migration على Railway، يتم أخذ لقطة لقاعدة البيانات من لوحة التحكم كإجراء دفاعي روتيني، رغم أن التراجع البرمجي العكسي كافٍ وموثّق بالكامل أعلاه.
