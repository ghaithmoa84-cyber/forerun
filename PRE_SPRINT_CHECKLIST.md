# PRE_SPRINT_CHECKLIST — Sprint: Dynamic Pricing + Custom Fee + Fee Review UI

> **التاريخ:** 2026-10-04
> **النطاق المقترح:** أسعار المنصة في DB · `Order.customFee` · بطاقة مراجعة الرسوم
> **الحالة:** ⛔ **مرفوضة للتنفيذ** — 6 بنود مانعة (B1–B6) + 5 بنود عالية (H1–H5)
> **قاعدة:** لا يُنفَّذ أي بند قبل تفريغ B1–B6
> **مرجع قاعدة التراجع:** [ROLLBACK_PLAN_dynamic-pricing.md](ROLLBACK_PLAN_dynamic-pricing.md)

---

## 1. Prisma Schema Compatibility

| # | الفحص | النتيجة |
|---|---|---|
| 1.1 | `Order` يحمل حقول التسعير | ✅ `schema.prisma:207-211` |
| 1.2 | **اللقطة السعرية موجودة أصلاً** | ✅ `customer-orders.service.ts:171-174` تكتب `baseFee/peripheralFee/extraStoresFee/totalFee` عند الإنشاء — **ليست ميزة جديدة** |
| 1.3 | **`Order` يحمل القيم المالية صلبة** | ⛔ **B5** `schema.prisma:208` `baseFee Int @default(60)` · `:211` `totalFee Int @default(60)` — نسخة ثالثة من `60` |
| 1.4 | `PlatformPricing` غير موجود | ⛔ المطلوب إنشاؤه — لكن موديل الخطة ناقص (انظر B4) |
| 1.5 | علاقة `User` العكسية | ⛔ **B4** `updatedBy User?` يتطلب `pricingUpdates PlatformPricing[]` على `User` (`schema.prisma:70-94`) وإلا فشل الـmigration |
| 1.6 | `LedgerEntryType` يغطي الأحداث الجديدة | ✅ `schema.prisma:53-59` — `ORDER_FEE_TOTAL / RUNNER_SHARE / PLATFORM_SHARE / SETTLEMENT_PAID / ADMIN_ADJUSTMENT`. **لا تحتاج نوعاً جديداً** |
| 1.7 | حقل `ADMIN_ADJUSTMENT` غير مستخدم | ⚠️ `schema.prisma:58` معرَّف لكنه غير مستعمل في الكود — استخدمه لـ`customFee` إن أردت أثراً مستقلاً في الـLedger |

---

## 2. Shared Types Updated

| # | الفحص | النتيجة |
|---|---|---|
| 2.1 | `ApproveOrderSchema` | ✅ موجود `runner.types.ts:137-140` — حقلان فقط (`isPeripheral`, `notes`) |
| 2.2 | `OrderPricing` | ⚠️ **H4** `customer.types.ts:159-164` — 4 حقول فقط، **لا `customFee`** |
| 2.3 | `CustomerOrderDetails` | ⚠️ **H4** `customer.types.ts:184-188` — مكرّر فوقي + `pricing` متداخل، كلاهما بلا `customFee` |
| 2.4 | `PurchaseResponse.updatedFee` | ⚠️ **H4** `runner.types.ts:130-133` — `{extraStoresFee, totalFee}` فقط |
| 2.5 | أنواع الاستجابة **ليست Zod** | ⚠️ `customer.types.ts:179` `export type` صرفة + `api.get<CustomerOrderDetails>` cast بلا `parse` ⇒ **الحقول الجديدة تُتجاهل بصمت** (انظر §6) |
| 2.6 | `customFeeReason` اختياري مستقل | ⛔ **H3** الخطة تجعله `.optional()` منفصلاً ⇒ `customFee: 50` بلا سبب يمرّ. يلزم `.superRefine()` |
| 2.7 | `any` في الواجهات العامة | ✅ لا يوجد |

---

## 3. State Machine Conflict Check

| # | الفحص | النتيجة |
|---|---|---|
| 3.1 | انتقال جديد في `OrderStateMachine` | ✅ **لا يوجد** — `customFee` و`baseFee` حقول بيانات لا حالة |
| 3.2 | `approveOrder` يحافظ على `updateMany` + `count===0` | ✅ `admin-order-command.service.ts:181-200` |
| 3.3 | `recalculateFee` يمنع `DELIVERED` | ✅ `pricing.service.ts:104-108` `ConflictException` |
| 3.4 | Idempotency على `DELIVERED` | ✅ `runner-orders.service.ts:877` + `idempotencyKey` في `meta` القيود `:966,974,982` |
| 3.5 | `ORDER_FEE_UPDATED`AuditLog | ✅ **موجود** `admin-order-command.service.ts:279-297` — يُوسَّع ولا يُخترع |
| 3.6 | حدث `order:fee_updated` | ✅ **موجود** `admin-order-command.service.ts:347-352` |
| 3.7 | مسار **`PATCH /admin/orders/:id/fee`** | ⚠️ **H5** غير موجود — لا طريقة لتعديل الرسم بعد الاعتماد |

---

## 4. Financial Operations Safety

| # | الفحص | النتيجة |
|---|---|---|
| 4.1 | **Ledger ↔ Settlement متساويان** | ⛔ **B1 — الأخطر.** `settlements.service.ts:158-159` و `:522-523` تعيد حساب الحصص من ثوابت `PRICING.*` **متجاهلةً `PricingService` تماماً**. الـLedger يُكتب من `feeResult.newFee.*` في `runner-orders.service.ts:958-986`. أي نسبة قابلة للتحرير ⇒ انفصال دائم |
| 4.2 | **ثابت المجموع `r+p == total`** | ⛔ **B3** `Math.floor(T*0.75)+Math.ceil(T*0.25)==T` صحيح ** فقط لأن `0.75+0.25=1`**. لا `CHECK` في DB ولا `.refine()` في Zod |
| 4.3 | النسبة مواصفة مُلزِمة | ⛔ **B3** `NEXT_TASKS.md:24`: *"أهمها تصحيح نسبة الأرباح إلى 80% (المواصفة تنص على 75/25)"* — **بند مرفوض مسجَّل**. `schema.prisma:55-56` يثبّت 75/25 في تعليق الـenum |
| 4.4 | **اللقطة محمية من إعادة التسعير** | ⛔ **B2 — تناقض داخلي بالخطة.** `pricing.service.ts:67-72` + `:111` و `admin-order-command.service.ts:164` تقرأ `PRICING.BASE_FEE` **حيّاً**. عند جعل الأسعار متحرّرة: طلب بـ60 يُعاد تسعيره صامتاً إلى 100 عند الشراء/التسليم. §3.1 من الخطة تعالج `customFee` فقط |
| 4.5 | `customFee` يصمد عبر `recalculateFee` | ✅ التشخيص **صحيح** — الخطر حقيقي (`:129-137` يكتب `totalFee` من `calculateFee` مجدداً) |
| 4.6 | `customFee` على نسبة 75/25 نفسها | ✅ **صحيح** — يُبقي أنواع `LedgerEntry` وثابت `floor/ceil` سليمين |
| 4.7 | خطة التراجع | ⛔ **B6** `AGENTS.md` + skill `rollback-plan` يفرضانها. الخطة الأصلية: **صفر**. (أُنجزت الآن في `ROLLBACK_PLAN_dynamic-pricing.md`) |
| 4.8 | صف seed + fallback | ⛔ ** part of B4** صف واحد مفقود ⇒ `null` ⇒ كل إنشاء طلب ينهار |

---

## 5. Code Quality Gates

| # | الفحص | النتيجة |
|---|---|---|
| 5.1 | **لا قيم صلبة في حساب الرسوم** | ⛔ **B1/B3/B5** — 4 مواقع حيّة + 2 قيم Prisma default + نصوص |
| 5.2 | `calculateFee` نقية ومتزامنة | ⚠️ `pricing.service.ts:54-83` — تحويلها لـDB = كسر 3 مواقع استدعاء + 12 تأكيداً |
| 5.3 | `findUnique` مع معالجة null | ✅ |
| 5.4 | كل `catch` يسجّل | ✅ `admin-order-command.service.ts:361`, `:524`, `:615`, `:883`, `:1048` |
| 5.5 | `updateMany` + `count===1` | ✅ `admin-order-command.service.ts:198-200`, `:472-474`, `:567-569`, `:738-741`, `:1011-1015` |
| 5.6 | WebSocket room من DB | ✅ خارج النطاق |

---

## 6. سلوك العملاء تجاه الحقول الجديدة (جواب صريح)

| # | الفحص | النتيجة |
|---|---|---|
| 6.1 | **Android يتجاهل الحقول المجهولة؟** | ✅ **نعم** — Moshi، `NetworkModule.kt:29` `Moshi.Builder().build()` **بدون** `.failOnUnknown()` ⇒ يتجاهل بصمت |
| 6.2 | **Android يعرض `customFee`?** | ⛔ **لا** — `OrderDetailDtos.kt:12-15` 4 حقول فقط. **إخفاء صامت بلا أي إشارة** |
| 6.3 | **customer-web يتجاهل الحقول المجهولة؟** | ✅ **نعم** — `CustomerOrderDetails` نوع TS صرفة (`customer.types.ts:179`) + cast بلا `parse` ⇒ لا تحقق زمن تشغيل |
| 6.4 | **customer-web يعرض `customFee`?** | ⛔ **لا** — `OrderDetailScreen.tsx:532-559` يعرض 4 بنود فقط |
| 6.5 | **runner-pwa** | ⛔ **لا** — `ActiveOrderPage.tsx:474-490` 4 بنود فقط |
| 6.6 | **النتيجةtranslated** | 🔴 **عيب مُثبَت:** الزبون يرى `baseFee + peripheralFee + extraStoresFee` ≠ `totalFee` المعروض، بلا سبب مذكور — **عيب حسابي ظاهر للعميل** ي-invalidates الغرض من `customFeeReason` |

---

## 7. Decision Log

| البند | القرار |
|---|---|
| B1 | ⛔ إصلاح إلزامي — `SettlementsService` يجب أن يقرأ من مصدر واحد مع `PricingService` |
| B2 | ⛔ إصلاح إلزامي — `recalculateFee` يعيد حساب `extraStoresFee` فقط ويحفظ `baseFee/peripheralFee` من الطلب |
| B3 | ⛔ **احذف `runnerSharePercent`/`platformSharePercent` من الجدول القابل للتحرير** — المواصفة تفرض 75/25 |
| B4 | ⛔ relations + seed + fallback + حذف الـdefaults الصلبة |
| B5 | ⛔ `schema.prisma:208,211` |
| B6 | ⛔ `ROLLBACK_PLAN_dynamic-pricing.md` |
| H4 | ⚠️ **نطاق إلزامي** — 9 مواقع إسقاط رسوم في API + 3 أنواع + 5 شاشات |

---

**الحكم:** لا اعتماد. المطلوب تفريغ B1–B6 أولاً. H4 يجب أن يدخل نفس النطاق لا مرحلة لاحقة.