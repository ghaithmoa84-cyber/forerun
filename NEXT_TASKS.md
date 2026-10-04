# FAWRUN — Next Tasks

> **آخر تحديث:** 2026-10-01
> **المرجع الكامل:** [HANDOFF.md](HANDOFF.md)، [PROJECT_STATUS.md](PROJECT_STATUS.md)
> **خريطة التوثيق:** [PROJECT_STATUS.md §11](PROJECT_STATUS.md#11-خريطة-التوثيق--أي-ملف-يملك-أي-حقيقة)

---

## مؤجَّل بقرار — لا يُنفَّذ قبل MVP

| # | المهمة | الحالة | المسؤول | ملاحظات |
|---|---|---|---|---|
| B1 | **R2 + ميزة رفع الإيصالات — مؤجَّلة لما بعد MVP** | ⏔ **مؤجَّل بقرار 2026-09-30** | — | **ليست عائقاً — لا شيء في MVP يتوقف عليها.** القرار مسجَّل في [PROJECT_STATUS.md §12 · D5](PROJECT_STATUS.md#12-سجل-القرارات). عند المراجعة: (1) قراءة `R2_*` من Railway · (2) ربط bucket `fawrun-receipts` · (3) استبدال رسالة الخطأ الإنجليزية في `runner-pwa/src/components/ReceiptUploader.tsx:44` برسالة عربية · (4) اعتماد `docs/android/ROADMAP.md` Sprint 9 كموعد المراجعة. |

> **ما يجب معرفته:** المندوب لو حاول رفع إيصال اليوم يرى رسالة إنجليزية تسرّب أسماء `R2_*`. إصلاحها **جزء من هذه المهمة المؤجَّلة** وليس منفصلاً.

---

## مسار Android (مرقّم 8D–10 — لا يدخل ترقيم `Sprint N` الخاص بـ backend)

| # | المهمة | الأولوية | الحالة | المسؤول | ملاحظات |
|---|---|---|---|---|---|
| A0 | **Sprint 8D** — معماري | منجَز | ✅ **مُدمج في `1055b5f`** | @feature-dev | **247 `@Test` ناجح (+24)** · `lint` 0 · APKs موقّعة · تم تنظيف الـ DI وحذف 1MB والـ DTO mapping. |
| A1 | **Sprint 8E** — WebSocket Port | منجَز | ✅ **مُدمج في `b6acfaf`** | @code-architect | **261 `@Test` ناجح (+14)** · `lint` 0 · `assembleDebug` ناجح · تم فصل WebSocket عن `core` عبر `OrderEventsGateway` وإغلاق فجوة D23 (`account:verified`) واستهلاك `connectionState`. المرجع: [docs/android/ROADMAP.md](docs/android/ROADMAP.md). |
| A2 | **Firebase** — إعداد النشر | عالية | ✅ **مُنجَز** | المستخدم | تم إنشاء مشروع Firebase ووضع `google-services.json` الحقيقي وتوفير `Service Account`. |
| A3 | **Sprint 8F** — إشعارات FCM والنشر | عالية | ✅ **مُنجَز في `090d261`** | @feature-dev | تم إنشاء `DeviceToken` في الـ DB ونقاط نهاية `POST/DELETE /api/v1/customer/me/device-token` وخدمة `FcmService` وإرسال إشعارات تغيير حالة الطلب. |

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
| P-1 | قرار منتج: الرسم الأساسي 60 ل.س أم 5,000 ل.س؟ | 🟡 متوسطة | ❓ **يحتاج قرار بشري** | المستخدم | `strings.xml:361` يقول للعميل 5,000 ل.س بينما `shared-constants/src/pricing.ts:2` = 60 ل.س والمواصفة تؤكّد 60. **لا يُنفَّذ أي تغيير عشوائي.** |

---

## بنود Sprint 6 الـ backend المتبقية (موروثة — انظر `docs/sprints/Sprint 6 Brief.md`)

| # | المهمة | الأولوية | الحالة | المسؤول | ملاحظات |
|---|---|---|---|---|---|
| S1 | اختبار تكامل Pricing | متوسطة | ⏳ غير مُنجَز | @feature-dev | `apps/api/vitest.config.ts:21` يستثني `test/integration/**` — لا تغطية تسعير. |
| S2 | مراجعة أمنية موثّقة | عالية | 🟡 **بانتظار التوقيع** | @test-engineer | الوثيقة جاهزة: [docs/SECURITY-AND-CODE-REVIEW.md](docs/SECURITY-AND-CODE-REVIEW.md) الإصدار 2 — 33 بنداً مفتوحاً موثّقاً بـ`ملف:سطر` على `744bf23` + قسم مرفوضات مُثبتة بالدليل. **المتبقّي: توقيع المستخدم.** |
| S3 | خط أساس الأداء `docs/performance-baseline.md` | متوسطة | ⏳ **الملف غير موجود** | @test-engineer | مُشار إليه في Sprint 6 Brief لكنه لم يُنشأ. |
| S4 | Sentry — تفعيل على الإنتاج | منخفضة | ⏸️ مؤجل | @feature-dev | `SENTRY_DSN` غير مضبوط. |
| S5 | **اختبار ميداني** بعميل حقيقي 1–2 | عالية | ⏳ غير مُنجَز | @test-engineer | **هذا هو المتبقّي من بند «اختبار يدوي لكل الشاشات»** — ليس تغطية شاشات آلية، بل رحلة طلب حقيقية على الإنتاج. |

---

> **ملاحظة:** أُلغي البند القديم «اختبار يدوي لكل الشاشات» — غطّته آليًا 223 اختبار Android + 184 اختبار وحدة. حُلّ محلًا بالبند S5 أعلاه.

---

للتفاصيل الكاملة عن الحالة، القرارات، والأخطاء المعروفة — ارجع إلى [PROJECT_STATUS.md](PROJECT_STATUS.md).
**نهاية الملف.**
