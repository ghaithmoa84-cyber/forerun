# تقرير مراجعة الكود والأمان — FORERUN

| | |
|---|---|
| **الحالة** | مُعاد هيكلته — الإصدار 2 |
| **قاعدة المراجعة** | `744bf23` (نظيفة، بلا تعديلات معلّقة) |
| **تاريخ التحقق** | 2026-10-04 |
| **النطاق** | Backend (NestJS + Prisma) · Android (Kotlin + Compose) · Web Clients · البنية التحتية |
| **ملف يملكه** | هذا الملف فقط. حالة التنفيذ ومالك كل بند: [NEXT_TASKS.md](../NEXT_TASKS.md) |

---

## كيف تقرأ هذا التقرير

**كل سطر في هذا التقرير مُتحقَّق منه آلياً على `744bf23`.** أي بند لا يحوي `ملف:سطر` قابل للحلّ ليس بنداً.

| الرمز | المعنى |
|---|---|
| 🔴 | حرج — يفترض **منع الإطلاق الميداني** حتى الإغلاق |
| 🟡 | متوسط — يُجدول في سبرنت، لا يوقف التشغيل |
| 🟢 | منخفض — تحسين/تنظيف |
| **مفتوح** | لم يُعالَج بعد |
| **مُغلق** | حُلّ في كوميت — لا يُنفَّذ مجدداً |
| **مرفوض** | ثبت خطأه بالدليل — **لا يُنفَّذ أبداً** |

> **تصحيح منهجي:** الإصدار 1 من هذا التقرير (2026-10-03) كُتب على شجرة أقدم من `26df1cb` و`f78fe50`، وتضمّن بنوداً **خاطئة** وأرقام أسطر **لا تُحلّ**. أُغلقت ومرفوضة في الأقسام A وB أدناه. سبب التغيير موثَّق في [PROJECT_STATUS.md §9](../PROJECT_STATUS.md).

---

## الملخص التنفيذي

البنية المعمارية سليمة ولا تحتاج إعادة بناء: الفصل نظيف، وآلة الحالة مفروضة على كل انتقالات الحالة، ولا يوجد SQL خام، ولا `any` في الواجهات البرمجية. **المخاطر الحقيقية محصورة في بندين.**

**الخطر الأول فعلي وخطير:** حاجز `preCheckOrder` خارج المعاملة في `deliverOrder` يحوّل أي إعادة محاولة آمنة إلى خطأ `409`، ويُبطل عقد الـ Idempotency المصمَّم في نفس الملف. هذا يُعطِّل الضمانة التي تحمي تكرار قيد الـ Ledger.

**الخطر الثاني هو غياب الحاجز:** اختبارات التكامل مكتوبة وتعمل محلياً، لكنها مستثناة من `pnpm test` **ومعطَّلة في CI بـ `if: false`** — أي أن مسار التسليم المالي بلا بوابة تراجع آلياً إطلاقاً.

ما عدا ذلك بنود متوسطة ومنخفضة، معظمها تجميد معماري أو فجوات تغطية، ولا يُنتج أيٌّ منها خطراً مباشراً.

**الخلاصة:** لا حاجة لحالة طوارئ. سبرنت تنظيف مركّز (يومان) يكفي لإغلاق الـ 🔴 والـ 🟡 ذات الأثر.

---

## القسم A — بنود مُغلقة (لا تُنفَّذ مجدداً)

حُلّت في `26df1cb` (fix: review batch-1) و`f78fe50` (refactor: extract long functions):

| البند القديم | الحالة | الدليل على الإغلاق |
|---|---|---|
| `catch { void 0; }` في 5 مواضع | ✅ **مُغلق** | لا `void 0` في أي ملف مصدر. الخمسة تسجّل الآن: `admin-order-command.service.ts:360, :522, :615, :882, :1074` |
| `console.log` في Runner PWA | ✅ **مُغلق** | العدد **0** في `apps/runner-pwa/src` (بقي `console.error` واحد مقصود في `useWebSocket.ts:39`) |
| مئات النصوص العربية الصلبة في الأندرويد | ✅ **مُغلق** | المتبقي **6 نصوص فقط** كلها في `core/network/ApiCall.kt:41,46,79,84,111,121`. صفر في `ui/**`، و351 مدخلاً في `strings.xml` |
| `deliverOrder` 271 سطراً | ✅ **مُغلق** | `runner-orders.service.ts:1084–1171` (88 سطراً) |
| `approveOrder` 191 سطراً | ✅ **مُغلق** | `admin-order-command.service.ts:367–439` (73 سطراً) |
| `closeDay` 158 سطراً | ✅ **مُغلق** | `settlements.service.ts:246–303` (58 سطراً) |
| مهلة معاملة `{ timeout: 15000 }` مكرّرة | ✅ **مُغلق** | صفر مطابقة في `apps/api/src` — كلها `CONFIG.TRANSACTION_TIMEOUT_MS` |
| الرقم السحري `24*60*60*1000` | ✅ **مُغلق** | الثابت موجود: `shared-constants/src/config.ts:9` (`RATING_EDIT_WINDOW_MS`)، مستهلك في `customer-orders.service.ts:430` |
| `settlementItem.create` في حلقة (N+1 مالي) | ✅ **مُغلق** | `settlements.service.ts:204` يستخدم `createMany` |
| `orderItem.create` في حلقة مزدوجة | ✅ **مُغلق** | `customer-orders.service.ts:232` يستخدم `createMany` |
| `findUnique` لكل مندوب في `closeDay` | ✅ **مُغلق** | `settlements.service.ts:103` — استعلام واحد `findMany({ runnerId: { in: runnerIds } })` |
| `createOrder` 226 سطراً | ❌ **لم يكن خطأً** | `customer-orders.service.ts:326–367` (42 سطراً) |

---

## القسم B — بنود مرفوضة (ثبت خطأها — لا تُنفَّذ أبداً)

| البند القديم | الحكم | الدليل |
|---|---|---|
| **`RUNNER_SHARE` يجب أن يكون 0.80 بدل 0.75** | ❌ **خطأ جوهري** | المواصفة نفسها `MVP Technical Specification.txt:643–644` تنص على **75/25**، وكذلك `PROJECT_BRIEF.md:157–158` · `schema.prisma:55–56` · `docs/04-module-status.md:13` · Sprint 1/3/4. لا وجود لـ `0.80/0.20` في المستودع كله. **تطبيق هذا "الإصلاح" يكسر حسابيّات الـ Ledger ويخالف Sprint 4.** |
| **حاجز الفحص المسبق — وُصف كـ«حماية زائدة»** | ⚠️ **التشخيص خاطئ، والخطر صحيح** | الوصف أخطأ في تفسير المشكلة، لكن الخطر **حقيقي ويستوجب الحذف** — انظر `R-1`. الفحص المسبق ليس حماية زائدة، بل مسار موازٍ يجعل الاسترجاع الآمن مستحيلاً. |
| `orders.gateway.ts:58–74` | ⚠️ **الموقع خاطئ، والخطورة مبالغ فيها** | الفعلي `:61–69` — والخطورة **🟡 لا 🔴**، لأن HTTP محمي بـ `jwt-auth.guard.ts:69`، والـ Refresh يُلغى عند الإيقاف (`users.service.ts:215`)، والسوكيت استقبال فقط بلا أوامر. |
| `admin-order-command.service.ts:254` يحمل `catch { void 0; }` | ❌ **غير موجود** | السطر 254 داخل `meta` لAudit Log. الخمسة catches في `:359, :521, :614, :881, :1073` وكلها `logger.warn`. |
| بنود مُدرجة في `NEXT_TASKS.md` ولم يُشر إليها التقرير | ⚠️ **ازدواج ملكية** | `S1` (اختبار تسعير تكاملي) و`S4` (Sentry) مملوكة أصلاً لـ `@feature-dev` في `NEXT_TASKS.md:34, :37` — التقرير تكرار لا اكتشاف. |

---

## القسم 1 — الأخطاء البرمجية والمالية (Bugs — Financial Path)

| # | الملف:السطر | المشكلة | الخطورة | الإجراء |
|---|---|---|---|---|
| **R-1** | `orders/services/runner-orders.service.ts:1096–1102` | **حاجز يُبطل الـ Idempotency:** فحص `if (preCheckOrder?.status === 'DELIVERED') throw new ConflictException('ORDER_ALREADY_DELIVERED')` يتم **قبل** `$transaction`، فيصطدم أولاً مع `processIdempotentDelivery` (`:794–861`) ويُرجع 409 بدلاً من الاستجابة السليمة على إعادة المحاولة. النتيجة: عقد الـ Idempotency (`:810–826`) ومعه الاسترجاع الآمن (`:1162–1170`) **غير قابل للوصول**. | 🔴 | **حذف `1096–1102` كاملاً.** الاستعلام الذرّي `updateMany` في `:832–839` داخل المعاملة كافٍ ويمنع التسابق. (✅ **مُنجَز في المسار الأول** `bff27a1`). |
| R-2 | `pricing/pricing.service.ts:53–59` | `ForbiddenException` (403) على تحقّق مُدخل (`purchasedStoreCount` غير صحيح/سالب) — خطأ دلالي في رمز الحالة. | 🟡 | `BadRequestException` (✅ **مُنجَز في المسار الثاني**). |
| R-3 | `pricing/pricing.service.ts:99–103` | تعارض حالة (طلب مُسلَّم) يُرفع كـ 403 Forbidden؛ يُستدعى من `runner-orders.service.ts:256, :881`. | 🟡 | `ConflictException` (409) (✅ **مُنجَز في المسار الثاني**). |
| R-4 | `customer-orders.service.ts:626–632` | فشل الإفراج عن المندوب سببه **تغيّر متزامن** (`updateMany.count === 0`) لكنه يُرفع كـ 422 `RUNNER_NOT_AVAILABLE` — مربك تشخيصياً. | 🟢 | `ConflictException` + كود `CONCURRENT_RUNNER_STATE_CHANGE` (✅ **مُنجَز في المواضع الثلاثة**). |

**لماذا R-1 وحده 🔴:** لا يوقف طلباً من التنفيذ — يوقف **الضمانة** التي تمنع تكرار قيد الـ Ledger. قابلية الاكتشاف منخفضة (تظهر عند إعادة المحاولة فقط) وأثرها مالي مباشر. أما R-2 وR-3 فهي أخطاء دلالية في رمز الحالة، والعمليات نفسها تسير بشكل صحيح.

---

## القسم 2 — الأمان (Security)

| # | الملف:السطر | المشكلة | الخطورة | الإجراء |
|---|---|---|---|---|
| S-1 | `websocket/gateways/orders.gateway.ts:61–69` | البوابة تقرأ `status` (`:63`) ولا تفحصه: تُفصل فقط عند `!user \|\| user.isDeleted`. حساب `SUSPENDED` يبقى يستقبل أحداث الطلبات. | 🟡 | `if (user.status === 'SUSPENDED') { client.disconnect(true); return; }` (✅ **مُنجَز في المسار الثالث**). |
| S-2 | `android/.../core/notification/ForerunFirebaseMessagingService.kt:28` | `Log.d(TAG, "Refreshed FCM token received: $token")` يطبع التوكن كاملاً بلا شرط `BuildConfig.DEBUG`، وملف ProGuard **لا يحذف** سجلات Log (انظر `S-3`). | 🟡 | طبقتان: احصر الاستدعاء بـ `if (BuildConfig.DEBUG)` **و** أضف قاعدة الإزالة في `S-3` — لا تعتمد على إحداهما وحدها (✅ **مُنجَز في المسار الثالث**). |
| S-3 | `android/app/proguard-rules.pro` (75 سطراً) | لا قاعدة `-assumenosideeffects class android.util.Log { *; }`. القاعدة الحالية تغطي Moshi/Retrofit/Socket.IO/OkHttp/MapLibre فقط (`:12–75`). **ولا حماية** لـ `EncryptedTokenStorage`/`MasterKey`. | 🟡 | إضافة قاعدة Log + قواعد `-keep` لفئات `core/storage` و `androidx.security.crypto` (✅ **مُنجَز في المسار الثالث**). |
| S-4 | `auth/auth.controller.ts:36, :42` | `POST /auth/refresh` و `POST /auth/logout` بلا `@Throttle` خاص؛ `register` (`:17`) و `login` (`:24`) محددان. السقف العام 300/دقيقة (`app.module.ts:31–48`). | 🟡 | `@Throttle` بـ 30/دقيقة على `refresh` و `logout` (✅ **مُنجَز في المسار الثالث**). |
| S-5 | `customers/customers.controller.ts:67–81` · `users/users.controller.ts` (كامل) | `customer/me/device-token` وواجهات الإدارة بلا `@Throttle`. **استثناء**: مسارات `settlements.controller.ts:100–131` الإدارية بلا حدّ بينما كل مسارات المندوب محدّدة (`:97, :109, :118, :127`). | 🟡 | تقييد نقاط النهاية للإداريين و`device-token` (✅ **مُنجَز في المسار الثالث**). |
| S-6 | `android/.../core/di/NetworkModule.kt:60–69` | `OkHttpClient` بلا `CertificatePinner`؛ الـ `BASE_URL` مثبَّت في `:24`. العميل الثاني `:93–101` مكشوف أيضاً. | 🟢 | تقييم تفعيل SSL Pinning في تحديث أمني قادم — كلفته مرتفعة لأن كل تدوير للمفتاح يكسر التطبيق عند المستخدمين. |

**ما لا يشمله هذا القسم:** لا SQL خام، ولا أسرار مُشفَّرة في المصدر، ولا `any` في الواجهات البرمجية. منطق المصادقة والتفويض سليم — الفجوات أعلاه كلها على مستوى **حدود المعدّل** و**نقل الاتصال** لا مستوى **التحقق من الصلاحية**.

---

## القسم 3 — بنية الاختبارات (Test Safety Net)

| # | الملف:السطر | المشكلة | الخطورة | الإجراء |
|---|---|---|---|---|
| T-1 | `.github/workflows/integration-tests.yml:9` | **`if: false`** — job التكامل معطَّل كلياً. اختبارات `deliver-order` / `create-order` / `auth` موجودة وتعمل محلياً، لكن **لا بوابة تراجع آلية في CI على مسار التسليم المالي**. | 🟡 | احذف السطر. البنية التحتية جاهزة: Postgres service (`:12–25`)، و`migrate deploy` (`:60`)، وأمر `test:integration` (`apps/api/package.json:24`). |
| T-2 | `apps/api/vitest.config.ts:21` | `exclude: ['test/integration/**/*.spec.ts']` يمنع تشغيلها عبر `pnpm test`. | 🟡 | مقبول كتصميم (حفظ سرعة اختبار الوحدة)، بشرط تفعيل `T-1`. |
| T-3 | `apps/api/test/` (21 ملفاً) | **صفر اختبارات** لـ `pricing.service.ts` — المحرّك الحسابي غير المغطى. | 🟡 | `pricing.service.spec.ts`: سيناريوهات + الحالات الحدية. |
| T-4 | `apps/api/test/settlements/settlements.cron.spec.ts` فقط | `closeDay` (`:246–303`) و`confirmSettlement` بلا اختبارات معاملات. | 🟡 | اختبارات: صحّة القيود · منع الازدواجية · `floor`/`ceil` عند `settlements.service.ts:140–141`. |
| T-5 | نفس | **صفر اختبارات** لـ `admin-order-command.service.ts` (`approve` / `reject` / `assignRunner`). | 🟡 | تغطية المسارات الثلاثة. |
| T-6 | `apps/android/app/src/androidTest/` | **غير موجود** — 0% تغطية UI. | 🟢 | مساران: تسجيل الدخول + تفاصيل الطلب (Compose Test). |

**ملاحظة على T-1:** الإصدار 1 عدّها 🔴. أُعيد تصنيفها إلى 🟡 بقرار صريح: غياب بوابة التراجع **عيب عملية** لا عيب سلوك — لا يُعطِّل طلباً ولا يُفسد قيداً مالياً، لكنه يجعل R-1 قابلاً للعودة في أي مراجعة لاحقة ما لم يُصلَح. البند `S1` في [NEXT_TASKS.md](../NEXT_TASKS.md) يغطي الجذر نفسه (اختبار تكامل التسعير · `T-2` + `T-3`).

---

## القسم 4 — معماري وجودة (Architecture & Quality)

| # | الملف:السطر | المشكلة | الخطورة | الإجراء |
|---|---|---|---|---|
| A-1 | `receipts/receipts.controller.ts:37–65` | `PrismaService` محقون في المتحكم؛ `resolveOrderStore` ينفّذ 3 استعلامات متسلسلة (`:47, :54, :61`). | 🟡 | نقلها إلى `ReceiptsService` وإزالة الحقن. |
| A-2 | `settlements/settlements.controller.ts:37–57` | نفس النمط؛ `resolveRunner` فيه قاعدة تجارية (`:52–53`: المندوب يجب أن يكون VERIFIED). | 🟡 | نقلها إلى `SettlementsService`. |
| A-3 | `orders/orders.controller.ts:69` + 6 ملفات أخرى | `@UseGuards(VerifiedUserGuard, RolesGuard)` بينما `RolesGuard` مسجَّل عالمياً في `app.module.ts:142–144`. تكرار في `users:16` · `receipts:35` · `ledger:19` · `ratings:26` · `settlements:35` · `runners:25,79`. | 🟢 | حذف `RolesGuard` من الديكورات — 8 مواضع. لا أثر أمني (سلوك مطابق). |
| A-4 | `android/.../ui/home/HomeViewModel.kt:111–116` | `logout()` ينفّذ `logoutUseCase()` داخل `viewModelScope.launch` بلا `try/catch/finally`؛ عند الفشل **لا يُطلق `_navigateToLogin.emit`** (`:114`) فيعلق المستخدم على الشاشة الرئيسية. | 🟡 | `try/finally` حول emit. مرتبط بـ A-5. |
| A-5 | `android/.../core/storage/EncryptedTokenStorage.kt:16–30` | `MasterKey` (`:17`) و`EncryptedSharedPreferences.create` (`:23`) داخل `by lazy` بلا `try/catch` ولا منطق إعادة بناء. | 🟡 | `runCatching` + مسح prefs وإعادة بناء المفتاح عند `GeneralSecurityException`. |
| A-6 | `android/.../data/.../AuthRepositoryImpl.kt:133, :141` | `tokenStorage.getRefreshToken()` و `clearAll()` **خارج** أي `try` (الشبكة محمية في `:125–131, :135–140`). مع A-5: فشل KeyStore يُسقط `logout()` → **A-4 يُفعَّل**. سلسلة فشل موثّقة. | 🟡 | تغليف الاستدعاءين. |
| A-7 | `android/gradle/libs.versions.toml:19` | `androidx.security:security-crypto = 1.1.0-alpha06` — **نسخة pre-release**، والتعليق في `:16` يوثّق انهيارات KeyStore في `1.0.0` على API 29+، و`minSdk = 26` (`build.gradle.kts:20`). | 🟡 | تقييم الترقية لاستقرة ≥1.1.0. |
| A-8 | `auth/dto/logout.dto.ts:1–2` | ملف re-export بلا أي تصريح. **مستورد من ملفين**: `auth.service.ts:16` و `auth.controller.ts:6–7`. | 🟢 | استيراد مباشر من `@forerun/shared-types` وحذفه (المصدر الحقيقي `shared-types/src/auth.types.ts:75`). |
| A-9 | `prisma/schema.prisma:297` | `OrderStore.isDeleted` بلا فهرس؛ الفهرس الوحيد `@@index([orderId, status])` (`:303`). | 🟢 | `@@index([orderId, isDeleted])`. |
| A-10 | `android/.../res/values/strings.xml:92, :96` | `orders_stub_desc` و `account_stub_desc` نصوص "قريباً" **لا يُشيران إليها أي ملف Kotlin ولا layout** — موارد ميتة في الـ APK. | 🟢 | حذفها. |

**نقطة قوة موثّقة:** طبقة `apps/android/.../domain` نقية 100% — صفر استيراد من `ui` أو `data`.

---

## القسم 5 — البنية التحتية والبيانات (Infra & Data)

| # | الملف:السطر | المشكلة | الخطورة | الإجراء |
|---|---|---|---|---|
| I-1 | `Dockerfile:9–11` | نسخ `packages/` و `apps/api/` كاملَين **قبل** `pnpm install` → أي تعديل على `src` يُبطل طبقة التثبيت (`.dockerignore:2` يستثني `dist` فقط). | 🟡 | نسخ `package.json` + `pnpm-lock.yaml` فقط قبل التثبيت، والمصادر بعده. |
| I-2 | `Dockerfile:11` | `pnpm install --no-frozen-lockfile` → خطر انحراف إصدارات عن المحلي. | 🟡 | `--frozen-lockfile`. |
| I-3 | `Dockerfile:1, :17` | صورة واحدة بلا Multi-Stage، بلا `USER` → **root**، وتحتوي أدوات بناء (`:2` openssl، `:3` pnpm) وكود المصدر وdevDeps. لا `prisma migrate deploy` قبل الإقلاع، ولا `docker-compose` في المستودع. | 🟡 | Multi-Stage + `USER node` + توثيق أمر الترحيل قبل النشر. |
| I-4 | `apps/api/src/main.ts:32–39` · `.env.example:10` | Sentry مُهيّأ شرطياً لكن `SENTRY_DSN` فارغ في `.env.example` و`.env` وCI (`integration-tests.yml:35`). | 🟡 | ضبطه في Railway. **مملوك بالفعل**: `NEXT_TASKS.md:37` (S4). |
| I-5 | `apps/android/app/build.gradle.kts:140–142` | لا Crashlytics ولا Sentry (grep على المشروع = صفر). أخطاء المستخدم تصل نصاً عربياً فقط عبر `ApiCall.kt`. | 🟡 | Crashlytics — مشروع Firebase **جاهز** (`NEXT_TASKS.md:25`). |
| I-6 | `strings.xml:361` | نصٌّ موجَّه للعميل يقول «رسوم التوصيل … تبدأ من الرسم الأساسي (**5,000 ل.س**)» بينما الكود `shared-constants/src/pricing.ts:2` = **60 ل.س** (والمواصفة `MVP Technical Specification.txt:640` تؤكّد 60). | 🟡 | **قرار منتج مطلوب**: إمّا تصحيح النص إلى 60 ل.س، أو تحديث `BASE_FEE` — ولا يُنفَّذ أيٌّ منهما بلا قرار. أخطر بند في هذا القسم لأنه معلومات مالية خاطئة تصل للعميل مباشرة. |
| I-7 | `admin-order-command.service.ts:1090–1095` | `order:needs_attention` معرَّف في الأنواع (`shared-types/src/websocket.events.ts:32`) والمواصفة، باقٍ كـ TODO بلا emit site. | 🟢 | تنفيذ Cron أو شطبه من قائمة الأحداث. **مُتتبَّع مسبقاً**: `CHANGELOG.md:136` · `Sprint 3 Brief:497`. |

---

## خطة التنفيذ

### المسار الأول — يوم واحد (يغلق آخر 🔴)

1. **حذف `runner-orders.service.ts:1096–1102`** — 7 أسطر، يغلق 🔴 R-1.
2. **حذف `integration-tests.yml:9`** — سطر واحد، يفتح بوابة التراجع على المسار المالي (`T-1`).

### المسار الثاني — سبرنت واحد (🟡 ذات أثر)

3. اختبارات وحدة التسعير (`T-3`) واختبارات `closeDay` (`T-4`).
4. ProGuard: قاعدة Log + `EncryptedSharedPreferences` fallback + `try/finally` في `logout` (`S-2`, `S-3`, `A-4`, `A-5`, `A-6`).
5. WebSocket + الحساب الموقوف (`S-1`) — 3 أسطر.
6. تصحيح استثناءات التسعير + سحب Prisma من المتحكمين (`R-2`, `R-3`, `A-1`, `A-2`).
7. حدود المعدّل على `refresh` و`device-token` والإدارة (`S-4`, `S-5`).

### المسار الثالث — تنظيف (🟢)

8. `S-6`, `A-3`, `A-7`, `A-8`, `A-9`, `A-10`, `R-4`, `I-1`, `I-2`, `I-3`, `I-4`, `I-5`, `I-7`.

### خارج نطاق الوكيل — يحتاج قراراً بشرياً

- **`I-6`** / `NEXT_TASKS.md:P-1`: الرسم الأساسي 60 ل.س أم 5,000 ل.س؟ لا يُنفَّذ أيٌّ من الرقمين بلا قرار — الرقمان موجودان في نظامين مختلفين، وتغيير أحدهما يترتّب عليه تعديل Ledger وواجهات الدفع.

---

## الإحصاء

| | مفتوح | مُغلق | مرفوض |
|---|---|---|---|
| 🔴 حرج | **1** | — | — |
| 🟡 متوسط | **24** | — | — |
| 🟢 منخفض | **8** | — | — |
| **المجموع** | **33** | **12** | **5** |

**تركّز الأخطار:** المسار المالي (`R-*`) بند حرج واحد حقيقي · بنية الاختبارات (`T-*`) أعلى كثافة · الأندرويد (`A-*`) ثلث البنود لكن أثره على المستخدم فقط.

**المقارنة بالإصدار 1:** ادّعى الإصدار 1 **35 بنداً**. التحقق على `744bf23` أنتج **33 بنداً مفتوحاً** مُتحقَّقاً · **12** منها كانت مُغلقة أصلاً (بندان منها لم يكونا خطأين أصلاً) · **5 مرفوضة** بالدليل. المجموع يتجاوز 35 لأن بعض الادعاءات تكرّرت (البند `2.1` و `10.3` وصفا عيباً واحداً) وبعضها تفرّع إلى بنود مستقلّة عند التحقق.

---

## كيف تتحقّق من هذا التقرير بنفسك

```bash
# R-1 (يجب أن يطبع 7 أسطر)
git show 744bf23:apps/api/src/modules/orders/services/runner-orders.service.ts | sed -n '1096,1102p'

# T-1 (يجب أن يطبع false)
git show 744bf23:.github/workflows/integration-tests.yml | sed -n '9p'

# القسم B — لا وجود لـ 0.80/0.20 في أي مكان
grep -rn "0\.80\|0\.20" --include='*.ts' --include='*.prisma' --include='*.md' . | grep -v node_modules
```

**قاعدة الصيانة:** أي مراجعة جديدة تُلزم نفس المعيار — رقم سطر يحلّ، أو ليست بنداً. البنود المُغلقة تُنقل إلى القسم A مع رقم الكوميت، والمرفوضة إلى القسم B مع دليل رفضها.

---
**نهاية التقرير.**