# FAWRUN — Next Tasks

> **آخر تحديث:** 2026-10-06
> **المرجع الكامل:** [HANDOFF.md](HANDOFF.md)، [PROJECT_STATUS.md](PROJECT_STATUS.md)
> **خريطة التوثيق:** [PROJECT_STATUS.md §11](PROJECT_STATUS.md#11-خريطة-التوثيق--أي-ملف-يملك-أي-حقيقة)

---

## مسار الشرائح الإعلانية (Sprint 7A — Banners)

- [x] Sprint 7A — Banners (admin + backend) — مكتمل ومدموج 2026-10-07. انظر PROJECT_STATUS.md §12 D29.
- [ ] C-4 (دَين تقني، أولوية منخفضة): معالجة انحراف migrate diff التاريخي في جداول (DeviceToken, LedgerEntry, OrderStore, RefreshToken, Settlement) عبر baseline migration مستقل — خارج نطاق 7A، اكتُشف عبر shadow-database prisma migrate diff.
- [ ] C-5: بناء طبقة تحويل (mapping) في Android من مسارات البانرات المخزَّنة (`/create-order`, `/orders`, `/account`, `/support`, `/home`) إلى ثوابت Routes الفعلية (`Routes.CREATE_ORDER = "create_order"` إلخ) — مطلوب عند تنفيذ سبرنت استهلاك العميل (banners-client-ui) اللاحق.
- [ ] C-6 (فحص الـ Drift غير متاح في بيئة الإنتاج): فحص انحراف المخطط ضد قاعدة الإنتاج يتطلب تشغيل الفحص من داخل Railway أو توفير قناة اتصال آمنة.

---

## مسار إلغاء نظام الحصص واعتماد الراتب الثابت (القرارات D25–D28)

> ⚠️ **Release Blocker:** كسر عقد `FeePreviewResponse` (بحذف حقول الحصص `runnerShare` و `platformShare`) يتطلب إطلاق المرحلة 1 (Backend) والمرحلة 3 (admin-web) معاً في **نفس الإصدار (Same Release)**، ويُحظر نشر الـ Backend منفرداً قبل تحديث أسطح الأدمن.

### المرحلة 1: Backend (فرع `feature/remove-shares-mvp`) — ✅ مُنجَز
- إلغاء قيدي `RUNNER_SHARE` و `PLATFORM_SHARE` عند التسليم في الـ Ledger، وحصر القيد بـ `ORDER_FEE_TOTAL` (D25).
- تبسيط التسويات إلى `totalFees` وتصفير الحصص دون المساس بـ DB (D26).
- حذف الحصص من حساب الرسوم ومعاينتها وتهميش الثوابت والدوال (D27, D28).
- وضع 13 اختبار تكامل S1 في حالة `skip` مؤقتاً تمهيداً للمرحلة 2.

### المرحلة 2: إعادة كتابة وتحديث اختبارات التكامل (S1) — ✅ مُنجَز
| # | المهمة | الأولوية | الحالة | المسؤول | ملاحظات |
|---|---|---|---|---|---|
| P2-1 | إعادة صياغة اختبارات S1 الـ 13 لتوقع قيد `ORDER_FEE_TOTAL` فقط عند التسليم | عالية | ✅ مُنجَز | @test-engineer + @feature-dev | تم تعديل التوقعات وإثبات الـ Idempotency الفردية |
| P2-2 | تحديث توقعات التسويات في اختبارات التكامل لتعكس `totalFees` و `runnerShare: 0, platformShare: totalFees` | عالية | ✅ مُنجَز | @test-engineer | التحقق من سلوك `closeDay` و `getCurrentSettlement` بعد التوحيد |
| P2-3 | تفعيل الاختبارات وتشغيل `test:integration` للتأكد من نجاح الاختبارات بالكامل | عالية | ✅ مُنجَز | @test-engineer | نجاح 46/46 اختبار تكامل بنسبة 100% وبدون أي skip |

### المرحلة 3: واجهات الإدارة ولوحة التحكم وتطبيق المندوب — ✅ مُنجَز
| # | المهمة | الأولوية | الحالة | المسؤول | ملاحظات |
|---|---|---|---|---|---|
| P3-1 | تحديث شاشة التسويات في `admin-web` (`settlements/page.tsx`) | عالية | ✅ مُنجَز | @feature-dev | حذف عمودَي الحصص وعرض `totalFees` فقط |
| P3-2 | تحديث بطاقة التسوية في الصفحة الرئيسية (`dashboard/page.tsx`) | متوسطة | ✅ مُنجَز | @feature-dev | تحويل البطاقة إلى «إجمالي رسوم اليوم» وحساب `totalFees` |
| P3-3 | مراجعة واجهات `runner-pwa` وإزالة مراجع الحصص (`SettlementsPage.tsx`) | متوسطة | ✅ مُنجَز | @feature-dev | إزالة `runnerShare` وحصص 75%/25% وعرض `totalFees` فقط |

### مهام التنظيف المؤجلة (Cleanup)
| # | المهمة | الأولوية | الحالة | المسؤول | ملاحظات |
|---|---|---|---|---|---|
| C-1 | مراجعة `getEntriesByRunner` (`ledger.service.ts:145`) — إما rename أو حذف | منخفضة | ⏳ معلّق | @code-architect | إدراج `ORDER_FEE_TOTAL` فيها يخالف D25 مفهوميًا |
| C-2 | تنظيف عمودَي `runnerShare` و `platformShare` من جدولي `Settlement` و `SettlementItem` في migration مستقل بعد MVP | منخفضة | ⏳ مؤجل لما بعد MVP | @code-architect | حقول إرثية (Legacy) أصبحت ثابتة (0 و totalFees) بموجب D26 لتجنب تعديل schema في MVP |
| C-3 | AddressSetupScreen — تحويل `mapLoadError` من `remember` إلى `rememberSaveable` (بحفظ مفتاح `R.string` بدل النص) لتجنب فقدان رسالة الخطأ عند التدوير | منخفضة | ⏳ معلّق | @android-dev | تنظيف لاحق لـ Sprint 9 |
| C-4 | معالجة انحراف الـ migrations التاريخية في جداول (DeviceToken, LedgerEntry, OrderStore, RefreshToken, Settlement) عبر baseline migration مستقل لما بعد 7A | منخفضة | ⏳ مؤجل لما بعد 7A | @code-architect | دَين تقني موروث على master أظهره أمر shadow-database prisma migrate diff؛ خارج نطاق 7A لتجنب مس الجداول المالية. |
| C-5 | طبقة تحويل (Mapping Layer) في Android من مسارات الويب المخزَّنة (مثل '/create-order') إلى ثوابت Routes (مثل 'create_order') عند تنفيذ سبرنت 'banners-client-ui' | متوسطة | ⏳ مؤجل لـ banners-client-ui | @android-dev | قيم actionValue المخزنة في البانر تتبع صيغة الويب (/); يحتاج تطبيق أندرويد تحويلها لثوابت Routes المقابلة عند معالجة النقر. |
| C-6 | فحص الـ Drift غير متاح في بيئة الإنتاج | منخفضة | ⏳ معلّق | Ops / @code-architect | فحص انحراف المخطط ضد قاعدة الإنتاج يتطلب تشغيل الفحص من داخل Railway أو توفير قناة اتصال آمنة. |
| P-ORD-FILTER-1 | دعم فلترة المجموعات (ACTIVE) في GET /customer/orders | متوسطة | ⏳ مؤجل إلى Sprint 11 | @backend-dev | تطلّب تعديل API لدعم مصفوفة أو حالة مركّبة لـ ACTIVE بدل Enum مفرد (مستبعد من Sprint 9) |

### مهام المراقبة بعد النشر (Post-Deployment Monitoring)
| # | المهمة | الأولوية | الحالة | المسؤول | ملاحظات |
|---|---|---|---|---|---|
| M-1 | عند أول طلب مسلّم في الإنتاج بعد 2026-10-06، تحقق يدويًا من: `LedgerEntry` يحوي قيدًا واحدًا `ORDER_FEE_TOTAL` فقط لا أكثر. | عالية | ✅ مُنجَز | Ops / @test-engineer | تم الإثبات حيًا على الطلب FW-000093: قيد وحيد ORDER_FEE_TOTAL=100 ل.س |

---

## مسار التسعير الديناميكي (Sprint 6A & 6B — القرارات D11–D15)

> **حارس الإنتاج:** `MAX_CUSTOM_FEE = 0` في 6A كحارس إنتاج، ويُرفع إلى 500 في 6B بعد اكتمال أسطح الزبون والمندوب.

### سبرنت 6A (Backend + أسطح الأدمن)
| # | المهمة | الحالة | المسؤول | ملاحظات |
|---|---|---|---|---|
| 6A-S1 | **اختبارات تكامل تثبّت سلوك التسعير الحالي** (Order / Approve / Deliver / Settlement / Invariants / Recalculate) | ✅ **مُنجَز** | @feature-dev + @test-engineer | البند S1 — تم تجميد السلوك الحالي باختبارات تكامل شاملة مع عزل B2 وتوثيق عيب التقريب |
| 6A-1 | **جرد `order.create`** للتأكد من تمرير `baseFee` و `totalFee` صراحةً | ✅ **مُنجَز** | @feature-dev | موضع وحيد في `customer-orders.service.ts:162` يمررهما صراحة، وحذف defaults من schema آمن |
| 6A-2 | **Migration لجدول `PlatformPricing` وعلاقة `User`** | ✅ **مُنجَز** | @feature-dev | القرار D11 — ملف migration مع إدراج صف seed افتراضي آمن 60/20/40 (فُصل customFee لخطوة لاحقة) |
| 6A-3.1 | **نوع `PricingConfig` وثابت `DEFAULT_PRICING_CONFIG` ودالة `getPricingConfig`** | ✅ **مُنجَز** | @feature-dev | القرار D11 — إضافة النوع والثابت في shared packages، وإضافة getPricingConfig مع كاش 30ث دون ربطها بالمسارات الإنتاجية |
| 6A-3.2 | **تحديث `PricingService` وحفظ لقطة الطلب (B2)** | ✅ **مُنجَز في `f26e2e0`** | @feature-dev | قراءة الأسعار مع جعل config إلزاميًا في `calculateFee` (`c3cc60d`)، وحفظ لقطة الطلب `baseFee/peripheralFee` في `recalculateFee` وتحديث `extraStoresFee/totalFee` فقط (`f26e2e0`). تم تفعيل اختبار 6.2 واختبارات الوحدة والتكامل. |
| 6A-3.3 | **توحيد مصدر الحصص في `SettlementsService` (B1)** | ✅ **مُنجَز في `78b4400`** | @feature-dev | استخراج دالة نقية `splitShares` (`646f9d4`) وتوحيد حساب الحصص لكل طلب في `getCurrentSettlement` ومطابقة `closeDay` والـ Ledger (0 drift). تم تفعيل اختبار 5.2 وتحويل 5.1 لحارس انحدار وإضافة 5.3 واختبارات الوحدة (`78b4400`). |
| 6A-4 | **ثوابت ومخططات `customFee` و `UpdatePlatformPricing` في shared packages** | ✅ **مُنجَز في `d57a564`** | @feature-dev | إضافة `MAX_CUSTOM_FEE = 0` و `CUSTOM_FEE_CAP = 500` و `PRICING_LIMITS` ومخططات Zod (`createApproveOrderSchema` و `UpdatePlatformPricingSchema`) مع تعريب كامل لرسائل الأخطاء وتغطية 21 اختبار وحدة. |
| 6A-5 | **Migration لعمودي `customFee` و `customFeeReason` في جدول `Order` مع قيد CHECK** | ✅ **مُنجَز في `77a1e59`** | @feature-dev | إضافة عمودي `customFee` (default 0) و `customFeeReason` وقيد `Order_customFee_nonneg_check` في `20261005110000_add_order_custom_fee` بنجاح واختبار تكامل يثبت الحالات الافتراضية والقيد. |
| 6A-6 | **ربط `baseFee` و `customFee` في خدمة `approveOrder` والتحقق الإنتاجي** | ✅ **مُنجَز في `57dce57`** | @feature-dev | ربط التمرير والتحقق الدفاعي وحفظ customFee في recalculateFee وتوسيع AuditLog وإرسال WebSocket بعد الـ commit مع بقاء حارس الإنتاج `MAX_CUSTOM_FEE = 0`. رفع MAX_CUSTOM_FEE إلى 500 في 6B بعد أسطح الزبون/المندوب. |
| 6A-7 | **مسارات الأدمن للتحكم بالتسعير ومحاكاة رسوم الطلب** (`GET/PUT /admin/pricing`, `POST /admin/orders/:id/fee-preview`) | ✅ **مُنجَز في `61ca5f1`** (`976f3b5`) | @feature-dev | محاكاة رسوم الطلب دون كتابة بقاعدة البيانات مع سقف 500 للمعاينة، واسترجاع وتعديل أسعار المنصة مع حارس التزامن المتفائل `updatedAt` (409) وتسجيل `AuditLog` وتفريغ الكاش واختبارات وحدة وتكامل شاملة. |
| 6A-8 | **شاشات لوحة تحكم الأدمن** لإدارة الأسعار وبطاقة المعاينة المباشرة في مراجعة الطلب | ✅ **مُنجَز في `0fba194`** | @feature-dev | أسطح الإدارة في `admin-web` (القرار D15): صفحة إعدادات الأسعار `/dashboard/pricing` مع تنبيه D20 وحارس التزامن، وبطاقة المعاينة المباشرة (Live Preview مع debounce 400ms) في صفحة الطلب `/orders/[id]` أثناء مراجعة الطلب. |
| 6A-3.1b | **ربط `getPricingConfig` بالمسارات الإنتاجية** (إنشاء الطلب / الاعتماد / recalculate) | ✅ **مُنجَز في `0b9a88b`** | @feature-dev | آخر خطوة في 6A: `previewFee` و`recalculateFee` و`approveOrder` و`createOrder` تقرأ صف `PlatformPricing` فعليًا (القرارات D21/D22/D23)، مع بقاء `baseFee` لقطةً للطلب عند الاعتماد. +9 اختبارات وحدة و+6 اختبارات تكامل (S2) ⇒ **355 وحدة + 44 تكامل**. جاهز لبوابة الدمج `git merge --no-ff` (والمالك فقط). |

> **ديون فنية مؤجلة بقرارات معتمدة:**
> 1. **حذف `@default(60)` من `baseFee` و`totalFee`:** يُنفَّذ كـ migration مستقل لاحق لتفادي خلط التعديلات (القرار D19).
> 2. **الانتقال من `RUNNER_SHARE` الفلوتي إلى `RUNNER_SHARE_BP = 7500`:** حساب صحيح لحماية الحصص وتفادي انحرافات الفواصل (القرار D12).

### سبرنت 6B (أسطح الز_Unbound والمندوب وAndroid) — ✅ مُكتمل
| # | المهمة | الأولوية | الحالة | المسؤول | ملاحظات |
|---|---|---|---|---|---|
| 6B-1 | رفع MAX_CUSTOM_FEE إلى 500 + إظهر customFee/customFeeReason في customer-web (OrderDetail) | عالية | ✅ **مُنجَز** | @feature-dev | مدمج في 86ac39a + 4fe7cb — الرسم الإضافي يظهر في تفاصيل الطلب عند وجوده |
| 6B-2 | إضافة customFee/customFeeReason + estimatedFee الكاملة في runner-pwa (ActiveOrder) | عالية | ✅ **مُنجَز** | @feature-dev | مدمج في 86ac39a — شاشة الطلب النشطعرض الرسم الإضافي والسبب |
| 6B-3 | إضافة customFee/customFeeReason في Android OrderDetailDtos.kt + واجهة العرض | عالية | ✅ **مُنجَز** | @feature-dev | مدمج في 86ac39a — DTO + domain model + mapper + PricingCard + strings.xml |
| 6B-4 | تعديل نص strings.xml:359 («ثابتة» + «60 ل.س» → مرن) | متوسطة | ✅ **مُنجَز** | @feature-dev | مدمج في 86ac39a — النص يصف التسعير الديناميكي |
| 6B-5 | إضافة estimatedFee.customFee في حمولة order:assigned للمندوب | متوسطة | ✅ **مُنجَز** | @feature-dev | مدمج في aaf2d8 — WebSocket payload يحمل customFee/customFeeReason |
| 6B-6 | اختبارات وحدة مخصصة لـ DeviceToken | منخفضة | ⏸️ مؤجل | @test-engineer | لم يُنفَّذ — تغطية CRUD DeviceToken و FCM integration |
| 6B-7 |,rightن TTL في PricingService بدل دوال *ForTesting | منخفضة | ⏸️ مؤجل | @feature-dev | لم يُنفَّذ — تحسين قابلية الاختبار وإزالة دوال الاختبار الخاصة |

---

## مسار Android (مرقّم 8D–10 — لا يدخل ترقيم `Sprint N` الخاص بـ backend)

| # | المهمة | الأولوية | الحالة | المسؤول | ملاحظات |
|---|---|---|---|---|---|
| A0 | **Sprint 8D** — معماري | منجَز | ✅ **مُدمج في `1055b5f`** | @feature-dev | **247 `@Test` ناجح (+24)** · `lint` 0 · APKs موقّعة · تم تنظيف الـ DI وحذف 1MB والـ DTO mapping. |
| A1 | **Sprint 8E** — WebSocket Port | منجَز | ✅ **مُدمج في `b6acfaf`** | @code-architect | **261 `@Test` ناجح (+14)** · `lint` 0 · `assembleDebug` ناجح · تم فصل WebSocket عن `core` عبر `OrderEventsGateway` وإغلاق فجوة D23 (`account:verified`) واستهلاك `connectionState`. المرجع: [docs/android/ROADMAP.md](docs/android/ROADMAP.md). |
| A2 | **Firebase** — إعداد النشر | عالية | ✅ **مُنجَز** | المستخدم | تم إنشاء مشروع Firebase ووضع `google-services.json` الحقيقي وتوفير `Service Account`. |
| A3 | **Sprint 8F** — إشعارات FCM والنشر | عالية | ✅ **مُنجَز في `090d261`** | @feature-dev | تم إنشاء `DeviceToken` في الـ DB ونقاط نهاية `POST/DELETE /api/v1/customer/me/device-token` وخدمة `FcmService` وإرسال إشعارات تغيير حالة الطلب. |
| A4 | **Sprint 9** — Android UI Polish | عالية | ✅ **مُدمج في `2088b51`** (2026-10-06) | @feature-dev + @test-engineer | **269 `@Test` ناجح (+8)** · `lint` 0 · `assembleDebug` ناجح · توحيد ترجمة وبادجات الحالات عبر `OrderStatusLabel` · تدويل رسائل الخطأ من `strings.xml` (صفر نص عربي في `.kt`) · حماية تدوير الشاشة بـ `rememberSaveable` · ضبط Scaffolds وإزاحة الدبوس الديناميكية مع `imePadding` · إحداثيات دمشق الافتراضية · مراجعة بصرية ناجحة لـ 5 شاشات. |

---

## بنود المراجعة الأمنية والكود (مُستخرَجة من `docs/SECURITY-AND-CODE-REVIEW.md` — الإصدار 2 على `744bf23`)

> **المرجع الكامل:** [docs/SECURITY-AND-CODE-REVIEW.md](docs/SECURITY-AND-CODE-REVIEW.md) — كل بند فيه موثّق بـ`ملف:سطر` قابل للحلّ.
> **القاعدة:** البنود المرقّمة هنا تُضاف ولا تُعاد اكتشافها. البنود **المرفوضة** في القسم B من التقرير لا تُنفَّذ أبداً — وأهمها تصحيح نسبة الأرباح إلى 80% (المواصفة تنص على **75/25**).

| # | المهمة | الأولوية | الحالة | المسؤول | ملاحظات |
|---|---|---|---|---|---|
| R-1 | **حاجز يُبطل Idempotency التسليم** | 🔴 حرجة | ✅ **مُنجَز** | @feature-dev | تم حذف `preCheckOrder` في `runner-orders.service.ts` وتحديث اختبار التكامل للتحقق من نجاح إعادة المحاولة بنفس المفتاح وتأكيد 409 على المفتاح المختلف. |
| T-1 | **تشغيل اختبارات التكامل في CI** | 🔴 عالية | ✅ **مُنجَز** | @test-engineer | تم حذف `if: false` في `integration-tests.yml` وتصحيح `vitest.config.integration.ts` بـ `fileParallelism: false` وتجاوز `getStorageToken` في بيئة الاختبار. نجحت جميع اختبارات التكامل الـ 13 بنسبة 100%. |
| R-2 | **تصحيح رمز استثناء عدد المتاجر** | 🟡 متوسطة | ✅ **مُنجَز** | @feature-dev | تم استبدال `ForbiddenException` بـ `BadRequestException` في `pricing.service.ts` لضبط دلالات كود الخطأ. |
| R-3 | **تصحيح استثناء الطلب المسلّم** | 🟡 متوسطة | ✅ **مُنجَز** | @feature-dev | تم استبدال `ForbiddenException` بـ `ConflictException` (409) في `recalculateFee` وإزالة الاستيراد غير المستخدم. |
| R-4 | **استثناء الإفراج المتزامن عن المندوب** | 🟢 منخفضة | ✅ **مُنجَز** | @feature-dev | تم توحيد الاستثناء إلى `ConflictException('CONCURRENT_RUNNER_STATE_CHANGE')` في `customer-orders.service.ts` و `runner-orders.service.ts` و `admin-order-command.service.ts`. |
| NEW-01 | **حذف فحص null الميت بعد findUniqueOrThrow** | 🟢 منخفضة | ✅ **مُنجَز** | @feature-dev | تم حذف الشرط الميت `if (!updatedOrder || !updatedStore)` في `runner-orders.service.ts:263-265`. |
| S-1 | **فصل الحساب الموقوف من WebSocket** | 🟡 متوسطة | ✅ **مُنجَز** | @feature-dev | تم فصل الحسابات الموقوفة (`SUSPENDED`) فوراً عند الاتصال في `orders.gateway.ts` وإضافة اختبار وحدة يغطي الحالة. |
| S-4 | **تحديد معدل refresh و logout** | 🟡 متوسطة | ✅ **مُنجَز** | @feature-dev | تم ضبط `@Throttle({ refresh: { limit: 30, ttl: 60000 } })` و `@Throttle({ logout: { limit: 30, ttl: 60000 } })` في `auth.controller.ts`. |
| S-5 | **تحديد معدل device-token والمسارات الإدارية** | 🟡 متوسطة | ✅ **مُنجَز** | @feature-dev | تم تقييد نقاط `device-token` في `customers.controller.ts` والمسارات الإدارية في `settlements.controller.ts` بـ `@Throttle`. |
| H-2 | **ProGuard: Log + توكن FCM (S-2 + S-3)** | 🟡 متوسطة | ✅ **مُنجَز** | @feature-dev | تم حصر طباعة توكن FCM بـ `if (BuildConfig.DEBUG)` في `ForerunFirebaseMessagingService.kt` وإضافة قواعد ProGuard لإزالة Log وحفظ كلاسات التخزين المشفر في `proguard-rules.pro`. |
| T-3 | **اختبارات وحدة لـ PricingService** | 🟡 متوسطة | ✅ **مُنجَز** | @feature-dev | تم إنشاء `test/pricing/pricing.service.spec.ts` بـ 12 اختباراً تغطي سيناريوهات الرسوم، الحالات الحدية، معادلات الحصص، ومنع إعادة التسعير لطلب DELIVERED. |
| T-4 | **اختبارات وحدة لـ SettlementsService** | 🟡 متوسطة | ✅ **مُنجَز** | @feature-dev | تم إنشاء `test/settlements/settlements.service.spec.ts` بـ 11 اختباراً تغطي إغلاق اليوم وعملية markSettled واحتساب الحصص والتقريب وidempotency. |
| T-5 | **اختبارات وحدة لـ AdminOrderCommandService** | 🟡 متوسطة | ✅ **مُنجَز** | @feature-dev | تم إنشاء `test/orders/admin-order-command.service.spec.ts` بـ 16 اختباراً تغطي approveOrder وrejectOrder وassignRunner (مع BUG-017) وcancelOrderAdmin. |
| A-1 | **نقل resolveOrderStore لـ ReceiptsService** | 🟡 متوسطة | ✅ **مُنجَز** | @feature-dev | تم نقل الدالة من `receipts.controller.ts` إلى `ReceiptsService` وسحب `PrismaService` من المتحكم. |
| A-2 | **نقل resolveRunner لـ SettlementsService** | 🟡 متوسطة | ✅ **مُنجَز** | @feature-dev | تم نقل الدالة مع فحص VERIFIED من `settlements.controller.ts` إلى `SettlementsService` وسحب `PrismaService` من المتحكم. |
| A-3 | **إزالة RolesGuard المكرر من المتحكمات** | 🟢 منخفضة | ✅ **مُنجَز** | @feature-dev | تم حذف `RolesGuard` غير الضروري من جميع المتحكمات الـ 8 لتسجيله كحارس عام (`APP_GUARD`) في `app.module.ts`. |
| A-8 | **حذف ملف logout.dto.ts الوسيط** | 🟢 منخفضة | ✅ **مُنجَز** | @feature-dev | تم حذف `apps/api/src/modules/auth/dto/logout.dto.ts` والاستيراد المباشر من `@forerun/shared-types`. |
| NEW-02 | **نقل مخططات التعيين والإلغاء إلى shared-types** | 🟢 منخفضة | ✅ **مُنجَز** | @feature-dev | تم نقل `AssignRunnerSchema` و `CancelOrderSchema` وتصديرهما من `@forerun/shared-types` وحذف تعريف `z.object` المحلي في `orders.controller.ts`. |
| NEW-05 | **تضمين customer في استعلام assignRunner** | 🟡 متوسطة | ✅ **مُنجَز** | @feature-dev | تم إضافة `customer: true` في `include` لضمان إرسال إشعارات العميل وتوفر `customerUserId`. |
| H-1 | **سلسلة فشل الجلسة في الأندرويد (A-4/5/6/10)** | 🟡 متوسطة | ✅ **مُنجَز** | @feature-dev | تم تغليف KeyStore وPrefs بـ `runCatching` وإعادة البناء التلقائي عند التلف، وتأمين استدعاءات `tokenStorage` في `AuthRepositoryImpl` بـ `runCatching`، وضمان إطلاق `_navigateToLogin` بـ `try/finally` في `HomeViewModel`، وحذف النصوص الميتة من `strings.xml`. |
| I-1/2/3 | **إعادة بناء Dockerfile متعدد المراحل (FIX-23)** | 🟡 متوسطة | ✅ **مُنجَز** | @feature-dev | تم إعادة بناء `Dockerfile` على مرحلتين (builder و runtime) مع `--frozen-lockfile` وتشغيل الحاوية بحساب `node` الآمن (non-root) وحفظ طبقات التثبيت المثلى. |
| NEW-03 | **تحويل دوال الإشعارات إلى async و await لـ FCM** | 🟡 متوسطة | ✅ **مُنجَز** | @feature-dev | تم تحويل `emitToCustomer` و `emitToRunner` و `emitToAdmin` إلى `async Promise<void>` مع انتظار FCM push الحقيقي ومعالجة الأخطاء وإضافة اختبارات وحدة شاملة. |
| I-7 | **معالجة TODO لحدث order:needs_attention (FIX-26)** | 🟢 منخفضة | ✅ **مُنجَز** | @feature-dev | تم تنفيذ دالة المجدول `@Cron` باسم `checkStaleOrders` للبحث عن الطلبات العالقة في انتظار مندوب لأكثر من 10 دقائق وبث حدث `order:needs_attention` للإدارة مع اختبارات وحدة كاملة. |
| A-9 | **فهرس OrderStore(orderId, isDeleted) (FIX-21)** | 🟢 منخفضة | ✅ **مُنجَز** | @feature-dev | تم إضافة `@@index([orderId, isDeleted])` في `schema.prisma` وإنشاء migration نظيف وترقية Prisma client بنجاح. |
| P-1 | **حسم الرسم الأساسي (60 ل.س)** | 🟡 متوسطة | ✅ **مُنجَز** | المستخدم | تم تأكيد الرسم الأساسي بـ 60 ل.س ومطابقة نص `strings.xml:359` مع كود التسعير. تم تسجيل مقترح ميزة إدارة وتعديل الأسعار ديناميكياً من لوحة تحكم الإدارة. |

---

## بنود Sprint 6 الـ backend المتبقية (موروثة — انظر `docs/sprints/Sprint 6 Brief.md`)

| # | المهمة | الأولوية | الحالة | المسؤول | ملاحظات |
|---|---|---|---|---|---|
| S1 | اختبار تكامل Pricing | متوسطة | ✅ مُنجَز (Sprint 6A-S1) | @feature-dev + @test-engineer | تغطية مسار التسعير الحالي باختبارات تكامل شاملة تثبت السلوك وتوثق الانحرافات. |
| S2 | مراجعة أمنية موثّقة | عالية | ✅ **مُنجَز — موقّعة v3** (2026-10-06) | @test-engineer | تم توقيع الإصدار 3 في [docs/SECURITY-AND-CODE-REVIEW.md](docs/SECURITY-AND-CODE-REVIEW.md) على 7787553 وقبول 5 بنود كدين تقني. |
| S3 | خط أساس الأداء `docs/performance-baseline.md` | متوسطة | ✅ مُنجَز — docs/performance-baseline.md (2026-10-06) | @test-engineer | خط أساس الأداء موثّق: زمن استجابة API، خطط استعلامات DB، أزمنة بناء Turborepo، وبصمة الذاكرة RSS (~122MB). |
| S4 | Sentry — تفعيل على الإنتاج | منخفضة | ⏸️ مؤجل | @feature-dev | `SENTRY_DSN` غير مضبوط. |
| S5 | **اختبار ميداني** بعميل حقيقي 1–2 | عالية | ✅ **مُنجَز** (2026-10-06) | Ops / @test-engineer | نُفّذ بنجاح على الطلب الإنتاجي FW-000093 وتأكيد قيد وحيد ORDER_FEE_TOTAL=100. |

---

> **ملاحظة:** أُلغي البند القديم «اختبار يدوي لكل الشاشات» — غطّته آليًا 223 اختبار Android + 184 اختبار وحدة. حُلّ محلًا بالبند S5 أعلاه.

---

للتفاصيل الكاملة عن الحالة، القرارات، والأخطاء المعروفة — ارجع إلى [PROJECT_STATUS.md](PROJECT_STATUS.md).
**نهاية الملف.**
