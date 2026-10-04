# FAWRUN Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Version](https://semver.org/spec/v2.0.0.html).

### 2026-10-04 11:45 — إعادة هيكلة تقرير مراجعة الكود والأمان (الإصدار 2)

**الملفات المعدّلة:**
- `docs/SECURITY-AND-CODE-REVIEW.md` — إعادة كتابة كاملة: بنية جديدة (مetadata + مفتاح قراءة + القسم A للمُغلق + القسم B للمرفوض + 5 أقسام للمفتوح + خطة تنفيذ + إحصاء + أوامر تحقّق).
- `PROJECT_STATUS.md` — 3 صفوف جديدة في §9 سجل الأحداث (`26df1cb` · `f78fe50` · إعادة هيكلة التقرير).
- `NEXT_TASKS.md` — قسم جديد «بنود المراجعة الأمنية والكود» بـ 5 بنود ومالك لكل بند · تحديث `S2` إلى «بانتظار التوقيع».

**السبب:**
التقرير الأصلي (الإصدار 1، 2026-10-03) كُتب على شجرة أقدم من كوميتَي `26df1cb` و`f78fe50`، وتضمّن بنوداً مغلقة بلا علامة، وأرقام أسطر لا تُحلّ، وبنداً خاطئاً جوهرياً (نسبة الأرباح 80% مقابل 75%). أُعيد التحقق من كل بند آلياً على `744bf23` وأُعيد البناء على أساس ما ثبت فقط.

**النتائج:**
- **33 بنداً مفتوحاً** موثّقاً بـ`ملف:سطر` قابل للحلّ: 1 🔴 · 24 🟡 · 8 🟢.
- **12 بنداً مُغلقاً** نُقلت إلى القسم A مع كوميت الإغلاق (منها `catch { void 0 }` · `console.log` · النصوص الصلبة · أطوال الدوال · N+1 · الأرقام السحرية).
- **5 بنود مرفوضة** بالدليل في القسم B — أهمها: `RUNNER_SHARE = 0.75` **صحيحة** والمواصفة `MVP Technical Specification.txt:643–644` تنص على 75/25؛ لا وجود لـ `0.80/0.20` في المستودع. تطبيق «الإصلاح» كان سيكسر Ledger Sprint 4.
- **البند الحرج الوحيد (R-1)** — `runner-orders.service.ts:1096–1102`: فحص `preCheckOrder` قبل `$transaction` يجعل `processIdempotentDelivery` (`:794–861`) غير قابل للوصول، فيُبطل الاسترجاع الآمن. الحل: حذف 7 أسطر.
- اكتشاف جديد لم يكن في الإصدار 1: **`.github/workflows/integration-tests.yml:9` فيه `if: false`** — job التكامل معطَّل كلياً، أي لا بوابة تراجع على المسار المالي.
- إعادة معايرة الخطورة: `orders.gateway.ts` من 🔴 إلى 🟡 (HTTP محمي بـ `jwt-auth.guard.ts:69`، السوكيت استقبال فقط) · `vitest.config.ts:21` من 🔴 إلى 🟡 (عيب عملية لا سلوك).
- بند جديد يحتاج قرار بشري (`P-1`): `strings.xml:361` يقول للعميل 5,000 ل.س بينما `pricing.ts:2` = 60 ل.س.
- **لم يُنفَّذ أي تغيير على كود الإنتاج** — التوثيق فقط.

**الأوامر والنتائج:**
- `git rev-parse --short HEAD` → `744bf23` · `git status --porcelain` → نظيف.
- `rg` غير متاح في البيئة → استُخدم `grep`/`glob` المدمجان في الأدوات.
- فحص آلي على 30+ موقع مُعلن في التقرير — **لا موقع غير محلول**.

**الأخطاء والحلول:**
- أخطاء تحرير في مسودّة التقرير (نصّ مشوّش: `Trainer's Error` · `该` · `无人` · `closes` · `reached` · `milder`) ← أُعيدت صياغة كل سطر.
- تناقض ذاتي: سطر «لا يوجد `--no-frozen-lockfile` في الإنتاج» كان يناقض البند `I-2` الذي يؤكد وجوده في `Dockerfile:11` ← حُذف ادعاء مباشرة واستُبدل بملاحظة نطاق.
- تصحيح مرجعي خاطئ: `I-6` كان يشير إلى «القسم 7» بعد إعادة الترقيم ← صُحّح إلى القسم 5، وثُبِّت سطر المواصفة `MVP Technical Specification.txt:640`.
- ترقيم مكرر: أُضيفت بنود `S1`/`S4` مكررَين في `NEXT_TASKS.md` ← حُذفا واستُبدلا ببند `P-1` (قرار المنتج) لتفادي تصادم المعرّفات.
- `S2` (مراجعة أمنية موثّقة) كُتب أولاً كـ ✅ «مغطّاة» ثم صُحّح إلى 🟡 «بانتظار التوقيع» — التوقيع من المستخدم لا من الوكيل.

### 2026-10-01 — Sprint 8F: Firebase FCM Push Notifications & DeviceToken Management (D8)

**المُنجَز:** تفعيل منظومة إشعارات Push Notifications الحقيقية للعميل مع مشروع Firebase الحقيقي والـ Backend وقاعدة البيانات:
- **ربط مشروع Firebase:** تم ربط مشروع `forerun-c819d` الحقيقي، ووضع `google-services.json` الحقيقي في `apps/android/app/` (مستثنى في `.gitignore`).
- **تهيئة Firebase Admin SDK:** إضافة حزمة `firebase-admin` (v14 modular) في `apps/api`، ودعم قراءة الاعتماد من متغير البيئة `FIREBASE_SERVICE_ACCOUNT_JSON` على Railway، أو من ملف محلي للتطوير (مستثنى في `.gitignore`).
- **جدول `DeviceToken` في قاعدة البيانات:**
  - إضافة نموذج `DeviceToken` في `apps/api/prisma/schema.prisma` مع علاقة بالمستخدم وفهارس على `userId` و`token`.
  - إنشاء الهجرة `20261001160600_add_device_token` ونشرها وتطبيقها بنجاح على قاعدة بيانات الإنتاج في Railway (`pnpm --filter forerun-api exec prisma migrate deploy`) مع استقرار Schema Drift = 0.
- **نقاط النهاية والأنواع المشتركة:**
  - إضافة `DeviceTokenSchema`، `DeviceTokenRequest`، `DeviceTokenResponse` في `packages/shared-types`.
  - إضافة `POST /api/v1/customer/me/device-token` لتسجيل/تحديث التوكن (Upsert على مستوى المستخدم ونوع الجهاز).
  - إضافة `DELETE /api/v1/customer/me/device-token` لإلغاء تسجيل التوكن عند تسجيل الخروج.
- **خدمة `FcmService`:**
  - بناء خدمة إرسال متعددة الأجهزة (`sendToUser`) تبني إشعارات مخصصة بنصوص عربية وحقول Deep Link (`forerun://orders/{id}`).
  - استهداف قناة Android ذات الأولوية العالية `forerun_orders_channel`.
  - التنظيف التلقائي للتوكنات غير الصالحة (`messaging/registration-token-not-registered`) من قاعدة البيانات فور استجابة Firebase.
  - تغطية الخدمة باختبارات الوحدة في `fcm.service.spec.ts`.
- **الربط مع تحديثات الطلبات:** تعديل `NotificationsService.emitToCustomer` لإرسال إشعار Socket.IO وإشعار FCM Push معاً، بنمط `best-effort` يحمي معاملات قاعدة البيانات.

### 2026-10-01 — Telegram Bot Notifications for Admin (D7)

**المُنجَز:** تفعيل إشعارات تيليغرام المباشرة للإدارة عبر البوت على بيئة الإنتاج Railway:
- **خدمة `TelegramService`:** خدمة موثوقة لإرسال رسائل التنبيهات باستخدام Telegram Bot API، مع التعامل مع الأخطاء بنمط `best-effort` وتسجيلها بالـ Logger.
- **إشعارات الطلبات الجديدة:** إشعار يحتوي رقم الطلب، اسم العميل، أسماء المتاجر، وإجمالي المبلغ بعد إنشاء الطلب بنجاح.
- **إشعارات تسجيل العملاء الجدد:** إشعار باسم العميل الجديد ورقم هاتفه وتاريخ التسجيل بتوقيت دمشق.
- **الاختبارات والتفعيل:** كتابة اختبارات الوحدة في `telegram.service.spec.ts`، وضبط `TELEGRAM_BOT_TOKEN` و`TELEGRAM_CHAT_ID` على Railway واختبار وصول الإشعار بنجاح.

### 2026-10-01 — Sprint 8E: WebSocket Domain Port & Account Verification (Android)

**المُنجَز:** نقل طبقة الـ WebSocket إلى الـ Domain Layer وإغلاق فجوة التحقق:
- **`OrderEventsGateway`**: واجهة في `domain/` تعيد `Flow<WebSocketEvent>` وتفصل الـ Domain عن Socket.IO.
- **`SocketOrderEventsGateway`**: تنفيذ البوابة في `data/` مع التفويض إلى `SocketManager`.
- **إغلاق D23:** معالجة حدث `account:verified` في `SplashViewModel` لإعادة فحص الجلسة فورياً.
- **استهلاك `connectionState`**: تمرير حالة الاتصال للمستهلكين.
- **الاختبارات:** 261 اختبار وحدة ناجحة (+14 اختبار).

### 2026-10-01 — Sprint 8D: Clean Architecture & DI Cleanup (Android)

**المُنجَز:** معالجة الديون التقنية ومعمارية المصادقة وحزم الـ APK:
- **إغلاق A17:** تحويل `TokenRefreshManager` إلى `Authenticator` و`TokenRepository` وفصل التبعيات الدائرية.
- **تخفيض حجم APK:** إزالة `libs.material` غير المستخدمة لتوفير ~1 MB.
- **Mappers كاملة:** فصل DTOs عن طبقات الـ Domain والـ UI.
- **الاختبارات:** 247 اختبار وحدة ناجحة (+24 اختبار).

### 2026-10-01 — D6: Android release keystore verified; "unsigned" was wrong in 5 places

**المكتشف:** التطبيق **موقَّع فعلاً** — التوثيق كان يقول «غير موقّع» في 5 مواضع ويحيل `production keystore` إلى المستخدم كعائق. **كلاهما خطأ مُصحَّح.**

**المتحقَّق منه آلياً (`apksigner` 36.0.0 + `keytool`):**
- `apksigner verify` ⇒ `Verifies` · **APK Signature Scheme v2** · عدد المُوقِّعين 1
- هوية المُوقِّع `CN=FORERUN, OU=Development, O=FORERUN, L=Al-Qanjara, ST=Latakia, C=SY` · cert SHA-256 `725b46830d583dc72d3b80c530c94e5d21492d40cfecb0837764bb7bd9609879`
- 3 APKs release مبنية 2026-09-30 (15.8 / 12.8 / 16.1 MB) · التوقيع مربوط في `apps/android/app/build.gradle.kts:57`

**الملفات المُصحَّحة (6):**
- `PROJECT_STATUS.md` — **§12 · D6 جديد** (تحقّق لا قرار) · §1 روابط الإنتاج وصفَAndroid · §9 صف `e5bfbc1`
- `HANDOFF.md` — صفّ Android: ✅ موقَّع v2
- `NEXT_TASKS.md` — A2 لم تعد تطلب Keystore · A3 من «غير مُنجَز» → ⏔ جزئي (النشر فقط)
- `docs/android/CURRENT_STATE.md` — فقرة البناء + Gap 5 (~~مشطوب~~ مع بقية الخطر)
- `docs/android/PROGRESS.md` — البند 8 (~~مشطوب~~)
- `docs/android/MASTER-SPEC.md` — صفّ 8F لم يعد يذكر `production keystore` كعائق
- `AGENTS.md` — قسم «ابدأ من هنا» لترتيب القراءة (تسليم للوكيل جديد)

**⚠️ القاعدة الحرجة المسجَّلة:** مفتاح التوقيع **غير قابل لإعادة الإنتاج رياضياً**. توليد مفتاح جديد يجعل كل نسخة مثبّتة عاجزة عن التحديث للأبد. **لا يُولَّد تحت أي ظرف.**

**نظافة الأسرار سليمة:** `*.jks` و`keystore.properties` مُتجاهَلة في `apps/android/.gitignore:14-15` وغير مدفوعة إلى git · `keystore.properties.example` موجود للقالب.

**⚠️ الفجوة الوحيدة المتبقّية:** لا نسخة احتياطية خارج هذا القرص. يجب نسخ `forerun-release.jks` + كلمة المرور إلى مكان آمن **قبل التسليم**. وكلمة المرور عبر قناة آمنة — لا Git ولا محادثة.

**تنبيه صيانة مسجَّل:** نسختان متطابقتان من JKS (`apps/android/` و `apps/android/app/`، نفس SHA-256 `FAC8DBE7…3864`)؛ البناء يفضّل `app/`. يُنصح بالإبقاء على نسخة واحدة.

**الأوامر والنتائج:** `apksigner verify` ×1 · `git ls-files`/`check-ignore` للتحقق من عدم دفع الأسرار · صفر روابط مكسورة.

### 2026-09-30 — D5: receipt upload (R2) deferred until after MVP

**القرار (مستخدم، 2026-09-30):** تأجيل **ميزة رفع الإيصالات (Cloudflare R2)** بالكامل إلى ما بعد MVP. ساري.

**الملفات المعدّلة (6 — توثيق فقط، صفر كود):**
- `PROJECT_STATUS.md` — **§12 سجل قرارات جديد** (جدول D1–D5 + تفصيل D5) · §5 بند 7: ⏔ «يحتاج تحقّق» → ⏔ «مؤجَّل بقرار» · §11 يسجّل «سجل القرارات» كمالك fact جديدة
- `NEXT_TASKS.md` — B1 من **⛔ حاجز** إلى **⏔ مؤجَّل**؛ لم تعد توقف أي مهمة في MVP
- `HANDOFF.md` — صفّ R2 + بند «الخطوة التالية»
- `PROJECT_BRIEF.md` — §20: `BUG-015` نُقل من «Blocked (environmental)» إلى قسم «Deferred by product decision»
- `CHANGELOG.md` — هذا الإدخال

**D3 أصبح ملغىً ومستبدلاً بـ D5:** لم تعد الحالة ⏔ «غير محسومة» — صارت قرار تأجيل. لم تُدّعَ قيمة لـ R2 ولا وهم.

**ثلاثة آثار موثّقة (تحقّقتُ منها في الكود قبل الكتابة):**
1. **تسريب رسالة إعداد داخلية** — `apps/runner-pwa/src/components/ReceiptUploader.tsx:44` يدمج نص الـ backend الخام في رسالة عربية، فيرى المندوب أسماء `R2_ACCOUNT_ID`… بالإنجليزية عند تعطيل الميزة.
2. **Android يعرض الإيصالات للعميل قراءةً فقط** — `OrderModels.kt:89,98` · `OrderRepositoryImpl.kt:142-143` → القوائم فارغة دائماً.
3. **بند Sprint 3 «Presigned URL» مُعلَّم `[x]` تقنياً** لكنه غير مُفعَّل تشغيلياً — وثِّق هذا التمييز صراحةً حتى لا يُقرأ كتوفّر تشغيلي.

**لم يُحذف الكود:** كود الإيصالات سليم ومُتحقَّق منه؛ إزالته كلفة إعادة عمل بلا فائدة. التأجيل موثَّق لا مُنفَّذ.

**موعد المراجعة:** `docs/android/ROADMAP.md` Sprint 9، أو أي عمل على `SettlementItem` يعتمد على الإيصالات.

**الأوامر والنتائج:**
- صفر كود — لا `pnpm` ولا `gradlew`. تحقّق روابط + روابط §12 فقط.

### 2026-09-30 — Root docs sync + Sprint DoD reconciliation (documentation-only)

**الملفات المعدّلة (P1 — توثيق الجذر):**
- `PROJECT_STATUS.md` — التاريخ → 2026-09-30 · صفّ Android في §1 (`Kotlin 2.0.21 · Compose · Hilt` · «APK مباشر — غير منشور») · **تصحيح §5 بند 6**: `Dockerfile:1` ما زال `node:20-slim` بينما `.nvmrc:1` = 22.23.1 → ❌ غير مُنجَز (كان مُسجَّل «✅ مكتملة») · **تصحيح §5 بند 7**: R2 → ⏔ يحتاج تحقّق (كان «✅ مكتملة») · §8 شجرة المجلدات أُضيفت إليها `apps/android/` و`docs/android/` · §9 خمسة أسطر أحداث للـ commits الخمسة · **§11 جديد «خريطة التوثيق»** يلغي ادّعاء «المصدر الوحيد للحقيقة» المكرر في ثلاثة ملفات
- `HANDOFF.md` — التاريخ → 2026-09-30 · `:4` استُبدل بإشارة نطاق إلى §11 · صفّ Android في جدول الإنتاج · R2 ⏔ + Sentry ⏸️ · صفّ Android في جدول الفحص المحلي (223 `@Test`) · «الخطوة التالية» = Sprint 8D + بنود Sprint 6 الـ backend · **سياسة الدفع في الموضعين `:85` و`:90`**
- `NEXT_TASKS.md` — التاريخ → 2026-09-30 · **المرساة المكسورة `[Q3.2](#04-module-status)` حُذفت** · R2 ← ⛔ حاجز ⏔ غير محسوم · **مسار Android جديد** (8D · Firebase+Keystore ⛔ يحتاج المستخدم · 8F) · بنود Sprint 6 الـ backend الموروثة · استبدال «اختبار يدوي لكل الشاشات» بـ «اختبار ميداني»
- `AGENTS.md` — `:52` و`:57` سياسة الدفع (D2) · `:58` قاعدة «لا دمج حتى إشارة المستخدم» **محذوفة** → «الأندرويد مدمج في `master` منذ `e5bfbc1`»
- `PROJECT_BRIEF.md` — `:14` «planned android app» → منجز ومدمج · `:465` سياسة الدفع · **مسار Android جدولاً مستقلاً** (§14) مع قاعدة منع تصادم الترقيم

**الملفات المعدّلة (P2 — معايير الإنجاز):**
كل بند حالته `[x]` أو `[ ]` صار يحمل سطر دليل `file:line` أو سطر سبب صريح. **لا مربّع واحد بُدّل بلا قراءة الكود.**

| الملف | النتيجة بعد التدقيق |
|---|---|
| `docs/sprints/Sprint 3 Brief.md` | **9 ✅ / 4 ⬜** — مختومة «مكتمل جزئيًا» |
| `docs/sprints/Sprint 4 Brief.md` | **11 ✅ / 3 ⬜** — مختومة «مكتمل جزئيًا» |
| `docs/sprints/Sprint 5 Brief.md` | Admin **4 ✅ / 2 ⬜** · Runner **6 ✅ / 0 ⬜** · Android **8 صفوف تحويل** |
| `docs/sprints/Sprint 6 Brief.md` | **3 ✅ / 9 ⬜** — لم يكتمل |
| `docs/sprints/Sprint 2 Brief.md` | البنود الـ15 مُعلَّمة سلفًا ← **ختم `Sprint 2 Complete — 2026-09-30`** أُضيف (كان ناقصًا) |
| `docs/sprints/Sprint 1 Brief.md` | **سطر تنبيه الترقيم فقط** (لا تدقيق DoD — بنوده مُعلَّمة من قبل) |
| `docs/android/MASTER-SPEC.md` §22 | «No direct push to master» → فرع لكل سبرنت + `git merge --no-ff` (مواءمة مع الجذر) |
| `docs/android/ROADMAP.md` | سطر تنبيه ترقيم معاكس يمنع تصادم `8A..10` مع `Sprint 1..6` |

**القرارات المحسومة المطبّقة:**
- **D1** Sprint 6 = للـ backend فقط؛ بنود QA/الإطلاق الخاصة بـ Android مُفوَّضة إلى `docs/android/ROADMAP.md` Sprint 10 (سطر تفويض في briefs)
- **D2** فرع لكل سبرنت ثم `git merge --no-ff` إلى `master` — في `AGENTS.md` (موضعان) + `HANDOFF.md` (موضعان) + `PROJECT_BRIEF.md` + `MASTER-SPEC.md` §22
- **D3** R2 = «⏔ يحتاج تحقّق» — لا قيمة ولا وهم مُعلَن؛ Railway المرجع الوحيد
- **D4** §5 بند 6 كان خاطئًا: `Dockerfile:1` = `node:20-slim` هو مصدر الحقيقة (لا يوجد `railway.toml` في المستودع، فيكتشف Railway الـ Dockerfile تلقائيًا)

**مفارقات متحقَّق منها في الكود (خارج النطاق — سُجِّلت ولم تُصلَح):**
- **لا يوجد قفل رسم نهائي** — لا حقل `feeLocked` في `schema.prisma` ولا منطق في `pricing.service.ts`. يُبطل بند Sprint 3 «الرسم النهائي يُقفل» وبند Sprint 6 «قفل عند التسليم».
- **`order:needs_attention` غير مُنفَّذ** — لا emit site، فقط TODO في `admin-order-command.service.ts:792-798`. يُبطل «جميع أحداث القسم 10» في Sprint 3.
- **نمط Outbox (المهمة 3.6) غير موجود** — كل الإرسال fire-and-forget؛ لا `OutboxEntry` ولا إعادة محاولة.
- **`RECEIPT_UPLOADED` AuditLog غير موجود** — لا يظهر في أي `*.ts` رغم مطالبة `Sprint 3 Brief.md:199`. (يوجد `RECEIPT_DELETED` فقط.)
- **لا `SettlementStateMachine`** — `markSettled` يعدّل `status` مباشرةً (`settlements.service.ts:215-222`) خلافًا لـ `AGENTS.md` §2.
- **عدّ الإيصالات قابل للتحايل** — الحد 5 يُفرض في `generatePresignedUrl` (`receipts.service.ts:76-83`) لا في `createReceipt` (`:93-107`).
- **`connection_limit=10` محلي فقط** — في `apps/api/.env:2`، غير موثّق للإنتاج في `PROJECT_STATUS.md` §3.1.
- **خلاف في عدد شاشات Android** — `docs/android/PROGRESS.md:55` يقول «17 شاشة» والمتحقَّق منه **15** (15 وجهة `ForerunNavGraph.kt:32-50` + 15 ملف `*Screen.kt`).
- **`admin-web` بلا `react-leaflet`** — يستخدم Leaflet خامًا (`OrderMap.tsx:40`) بينما `runner-pwa` و`customer-web` يستخدمان `react-leaflet`.
- **تصحيح `184` في `docs/06-testing-status.md:8`** (مسمّى «العدد الإجمالي»): المتحقَّق منه **15 ملف spec** (12 وحدة + 3 تكامل) و**126 موقع `it()`**. `apps/api/vitest.config.ts:21` يستثني `test/integration/**`، فـ **184 هو عدّ الوحدة فقط** بعد توسيع `it.each`، و**13 موقع `it()` تكامل** لا تدخل العدّ أصلًا.
- **`apps/api/src/src/`** شجرة وحدة ميتة **متبَّعة في git** (10 ملفات `.gitkeep`).

**الأوامر والنتائج:**
- **صفر كود**: لا `gradlew` ولا `pnpm lint/typecheck/test` — لا مصدر تغيّر. التحقّق statique فقط.
- `git diff --stat` → **14 ملف Markdown**، صفر `apps/` وصفر `packages/` (تحقّق آلي: صفر ملف `.ts/.tsx/.kt/.js/.prisma/.json/.toml/.gradle`).
- بحث التعارضات → **صفر** في كل المواضع: «دفع مباشر إلى master» · «No direct push» · «لا دمج حتى إشارة المستخدم» · «planned android» · `node:22-slim` · «المصدر الوحيد للحقيقة». و`merge --no-ff` **موجود في 6 مواضع** موزّعة على 4 ملفات.
- الروابط النسبية: **34 رابطًا، صفر مكسور** (بعد فك ترميز `%20`).
- المربّعات غير المعلَّمة في `docs/sprints/3-6`: **18**، وكل واحد تحقّق من وجود سطر سبب بجواره (تحقّق آلي).

### 2026-09-27 18:10 — Repository cleanup & documentation alignment

**الملفات والدوال المعدّلة:**
- `AGENTS.md` — تصحيح المرجع المكسور لـ `PROJECT_STATUS.md`
- `HANDOFF.md` — تحديث الـ commit hash المعتمد وإزالة رابط `CURRENT_STATE.md` المحذوف
- `PROJECT_BRIEF.md` — تحديث المراجع إلى `PROJECT_STATUS.md`
- `.kilo/agent/code-architect.md` — توجيه المخرجات إلى `PROJECT_STATUS.md`
- `docs/07-environment-audit.md` — توضيح آلية قراءة مفاتيح JWT من `.env` والمجلد الاحتياطي
- `apps/android/.gitignore` — إضافة `build/` و `app/build/` لمخرجات البناء
- **الملفات المحذوفة:** `private.pem`, `public.pem`, `railpack.json`, `.tmp-patch-tty.js`, `build-output.txt`, `test-output.txt`, `apps/api/.tmp-answers.txt`, `apps/api/.env.local`, `apps/runner-pwa/test-scenarios.mjs`, `CURRENT_STATE.md`, `.kilo/plans/1789831012062-sprint-4-review-plan.md`, `.kilo/worktrees/exclusive-ring`

**السبب:**
تطهير المستودع من المخلفات المؤقتة والملفات الميتة، وحذف المفاتيح والإعدادات المضللة، وتوحيد مرجع التوثيق على `PROJECT_STATUS.md`.

**الأوامر والنتائج:**
- `pnpm typecheck` → 6/6 packages successful
- `pnpm lint` → 6/6 packages successful
- `pnpm test` → 12 test files passed, 184 tests passed

### 2026-09-19 12:54 — Customer order details: full details mapping (feature-dev)

**الملفات والدوال المعدّلة:**
- `apps/api/src/modules/orders/services/customer-orders.service.ts` — `getOrderDetails`:
  - Prisma query: added `orderStores.receipts` (filtered `isDeleted: false`, ordered `uploadedAt` asc), `orderStores` filtered `isDeleted: false` (matches runner-orders pattern), `ratings` filtered by `customerId` (current customer), and `runner.user` now selects only `name`
  - Response mapped to the updated `CustomerOrderDetails` type: added `pricing`, `stores` (simplified view with `id`, `storeName`, `status`, `isExtra`, `items`, `receipts`), `rating` (`{ stars } | null`, only when customer rated), and `timeline` (`createdAt`, `reviewedAt`, `assignedAt`, `startedAt`, `deliveredAt`, `cancelledAt`)
  - Ownership check preserved via `customerId: customer.id` in the `where` clause

**السبب:**
تم توحيد `getOrderDetails` مع النوع المحدَّث `CustomerOrderDetails` في `shared-types`، بما في ذلك بيانات التقييمات، الإيصالات، التسعير، والجدول الزمني.

**الأوامر والنتائج:**
- `pnpm exec turbo run typecheck --force` → 4/4 packages successful (كان يوجد cache قديم أظهر خطأ `pricing` غير موجود اقتارفه، تم حله بزيارة الكاش)
- `pnpm exec turbo run lint --force` → 4/4 successful؛ forerun-api نظيف؛ تحذيرات runner-pwa موجودة مسبقًا غير مرتبطة

### 2026-09-12 18:18 — CodeRabbit review documentation fixes (Sprint 2/3 Brief)

**الملفات والدوال المعدّلة:**
- `docs/sprints/Sprint 2 Brief.md` — Fix 1: `BadRequestException` → `UnprocessableEntityException` (line 85); Fix 2: Added runner AVAILABLE/VERIFIED check + status update to ON_MISSION in transaction (lines 94-102); Fix 3: `fromStatus: 'AWAITING_RUNNER'` → `fromStatus: order.status` (line 111)
- `docs/sprints/Sprint 3 Brief.md` — Fix 4: Replaced "ذرّية إرسال الأحداث" WebSocket transaction guidance with Outbox Pattern pattern (lines 331-338)

**السبب:**
معالجة 4 ملاحظات من CodeRabbit في توثيق Sprint 2 و Sprint 3 Briefs: استثناء غير صحيح، حالة runner مفقودة في transaction، status ثابت في AuditLog، ونمط إرسال WebSocket الخاطئ.

**الأوامر والنتائج:**
- `git add && git commit -m "fix: CodeRabbit review fixes - Sprint 2/3 brief documentation"` → نجح، commit 8faa553
- `git push origin feature/sprint-1-auth-admin-websocket` → نجح

**الأخطاء والحلول:**
- خطأ `oldString not found` في Fix 2 و Fix 4 بسبب عدم تطابق المسافات/الفواصل → تم إصلاح بتطابق دقيق للنص بعد قراءة الأسطر الحالية

### 2026-09-18 10:40 — Sprint 3 Task 3.1: Runner endpoints implementation and fixes

**الملفات والدوال المعدّلة:**
- `apps/api/src/modules/runners/runners.service.ts` — دالة `getMyProfile`: إضافة `altPhone` للاستجابة؛ دالة `updateMyStatus`: إضافة فحص الطلبات النشطة قبل السماح بالانتقال AVAILABLE→UNAVAILABLE (يرفض بـ 422 عند وجود طلب نشط)؛ دالة `getActiveOrder`: إضافة `orderStores` مع `items` و `receipts`، و `pricing` (baseFee/peripheralFee/extraStoresFee/totalFee)، و `deliveryAddress` (lat/lng/description)
- `apps/api/src/modules/orders/services\runner-orders.service.ts` — دالة `startOrder`: إضافة `sound: 'status_update'` إلى جميع إرساليات WebSocket (customer, runner, admin)
- `packages/shared-types/src/runner.types.ts` — تحديث `RunnerProfileResponseSchema` بإضافة `altPhone`؛ إضافة `ActiveOrderDeliveryAddressSchema`، `ActiveOrderPricingSchema`، `ActiveOrderStoreItemSchema`، `ActiveOrderStoreSchema`؛ تحديث `ActiveOrderResponseSchema` ليشمل `deliveryAddress`، `pricing`، `orderStores`
- `CHANGELOG.md` — تسجيل التغييرات

**السبب:**
تطبيق Sprint 3 المهمة 3.1 (Runner endpoints) مع تصحيح الفجوات المكتشفة في المراجعة:
1. `PUT /api/v1/runner/me/status` يجب أن يرفض 422 عند محاولة التحول UNAVAILABLE مع طلب نشط (ASSIGNED/IN_PROGRESS/OUT_FOR_DELIVERY)
2. `GET /api/v1/runner/orders/active` يجب أن يشمل OrderStores + Receipts + Pricing + Delivery Address
3. `GET /api/v1/runner/me` يجب أن يُرجع altPhone
4. `PUT /api/v1/runner/orders/:id/start` WebSocket يجب أن يتضمن sound: 'status_update'

**الأوامر والنتائج:**
- `git checkout -b feature/sprint-3-runner-endpoints` → نجح
- `pnpm build` → نجح، 3/3 حزم
- `pnpm typecheck` → نجح، 3/3 حزم
- `pnpm lint` → نجح، 3/3 حزم
- `pnpm --filter forerun-api test` → نجح، 7 ملفات و148 اختبارًا

**الأخطاء والحلول:**
- لا توجد أخطاء تشغيل

## [Unreleased]

### 2026-09-19 16:21 — Runner settlement list and current endpoints

**Modified files and functions:**
- `apps/api/src/modules/settlements/settlements.controller.ts` — Added `listRunner()` for `GET /runner/settlements` with `RunnerSettlementsQuerySchema` validation and `getCurrentSettlement()` for `GET /runner/settlements/current`; both resolve the authenticated `userId` to a verified runner profile through `resolveRunner()` before calling `SettlementsService`.
- `CHANGELOG.md` — Recorded this controller change and validation results.

**Reason:**
Expose runner-owned paginated settlement history and the current settlement while enforcing RUNNER authorization, verified-account checks, pagination validation, and rate limiting.

**Commands and results:**
- `pnpm --filter forerun-api typecheck` → passed
- `pnpm --filter forerun-api lint` → passed
- `pnpm --filter forerun-api test` → passed, 9 files / 163 tests
- `git diff -- apps/api/src/modules/settlements/settlements.controller.ts && git status --short` → controller diff reviewed; working tree contains unrelated concurrent changes

**Errors and resolutions:**
- Vitest reported the existing `vite-tsconfig-paths` deprecation and `test.poolOptions` migration warnings; tests still passed.
- PowerShell `date` alias rejected the format string → used `Get-Date -Format 'yyyy-MM-dd HH:mm'` for the changelog timestamp.

### 2026-09-19 16:16 — Runner settlements service: listRunnerSettlements and getCurrentSettlement

**Modified files and functions:**
- `apps/api/src/modules/settlements/settlements.service.ts` — Added two methods:
  - `listRunnerSettlements(runnerId, page, limit)`: Filter settlements by `runnerId`, paginate with `skip`/`take`, order by `createdAt: desc`, return `{ data: RunnerSettlement[], meta: { total, page, limit, totalPages } }` mapped to `RunnerSettlementSchema` shape
  - `getCurrentSettlement(runnerId)`: Check if today's settlement exists for runnerId + operationalDate; if exists return with items (orderNumber, deliveredAt); if not, compute temporary summary from DELIVERED orders (totalOrders, totalFees, estimatedRunnerShare=floor(totalFees*0.75), estimatedPlatformShare=ceil(totalFees*0.25)) with `status: 'NOT_CLOSED'`

**Reason:**
Implement Task 4.5 — provide runner-facing settlement views with support for temporary (NOT_CLOSED) status when today's settlement hasn't been closed yet.

**Commands and results:**
- `pnpm typecheck` → passed, 4/4 packages
- `pnpm lint` → passed, 4/4 packages (0 errors)
- `pnpm --filter forerun-api test` → passed, 9 files / 163 tests

**Errors and resolutions:**
- `settlementItems does not exist` in Prisma include — the relation in schema is `items`, not `settlementItems` → corrected relation name
- TS2322 nullable fields (`orderNumber: string | null`, `deliveredAt: Date | null`) don't match `RunnerSettlementItemSchema` (non-nullable) → used non-null assertions (`!`) when mapping
- `@forerun/shared-types` types not found during typecheck → ran `pnpm build` in shared-types first to compile new exports

### 2026-09-19 13:08 — Task 4.5: Runner settlement DTOs in shared-types

**Modified files and functions:**
- `packages/shared-types/src/settlement.types.ts` — Added `RunnerSettlementItemSchema` (orderNumber, totalFee, deliveredAt), `RunnerSettlementSchema` (operationalDate, status PENDING|SETTLED, totalOrders, totalFees, runnerShare, platformShare), `RunnerSettlementListResponseSchema` (paginated with PaginatedMetaSchema), `RunnerCurrentSettlementSchema` (NOT_CLOSED status with estimatedRunnerShare/estimatedPlatformShare and orders array), `RunnerSettlementsQuerySchema` (page/limit pagination). All schemas exported with Zod inference types.

**Reason:**
Define shared Zod schemas and TypeScript types for runner settlement views as part of Task 4.5, following the existing pattern of DTOs-first in shared-types.

**Commands and results:**
- `npx tsc --noEmit -p packages/shared-types/tsconfig.json` → passed (no output, no errors)

**Errors and resolutions:**
- None.

### 2026-09-19 16:05 — Add rating availability to customer order list

**Modified files and functions:**
- `apps/api/src/modules/orders/services/customer-orders.service.ts` — `listCustomerOrders`: add a customer-scoped `ratings` Prisma include selecting `id`, `expiresAt`, and `isFinal`; map `hasRating` and `canRate` using `DELIVERED`, no existing rating, `deliveredAt`, and the 24-hour rating window.

**Reason:**
Match the updated `CustomerOrderListItem` contract and expose whether the customer can rate each delivered order.

**Commands and results:**
- `pnpm --filter @forerun/shared-types build` → passed
- `pnpm --filter forerun-api exec tsc --noEmit --incremental false --pretty false` → passed
- `pnpm --filter forerun-api exec eslint src/modules/orders/services/customer-orders.service.ts` → passed
- `git diff --check -- apps/api/src/modules/orders/services/customer-orders.service.ts` → passed

**Errors and resolutions:**
- The incremental API typecheck initially reported `CustomerOrderDetails` missing `pricing` after concurrent `getOrderDetails` changes; a cache-free typecheck passed against the current shared type.
- `pnpm exec prettier --write apps/api/src/modules/orders/services/customer-orders.service.ts` reformatted unrelated call sites; those incidental changes were reverted to keep the patch scoped.

### 2026-09-19 15:31 — اختبارات unit للمهمتين 4.2 و4.3

**الملفات والدوال المعدّلة:**
- `apps/api/test/ratings/ratings.service.spec.ts` — اختبارات `RatingsService.createRating()` و`updateRating()` و`mapRating()` مع Prisma وAudit mocks
- `apps/api/test/settlements/settlements.cron.spec.ts` — اختبارات `getOperationalDate()` و`checkPendingOrders()` و`settlementReminder()` مع Prisma وNotifications mocks

**السبب:**
تغطية منطق التقييمات ونافذة التحرير والمتوسط المتحرك، ومنطق Cron لتذكير التسويات، بدون اتصال بقاعدة بيانات.

**الأوامر والنتائج:**
- `pnpm --filter forerun-api test` → نجح، 9 ملفات و163 اختبارًا

**الأخطاء والحلول:**
- تم تصحيح قيمة `lte` في mock الخاص بنطاق تاريخ التسوية بعد مراجعة الملف قبل تشغيل الاختبارات.

### 2026-09-19 14:43 — تثبيت إعداد Vitest للخيار 3 واستثناء integration

**الملفات والدوال المعدّلة:**
- `apps/api/vitest.config.ts` — إضافة `pool: 'forks'`، و`execArgv: ['--require', 'ts-node/register']`، وalias لـ `@prisma/client`، و`exclude: ['test/integration/**/*.spec.ts']`؛ استخدام `resolve` من `node:path` مع `__dirname` المناسب لـ ESM

**السبب:**
تجاوز فشل `vite:oxc` عند تحليل Prisma `const enum`، وتشغيل اختبارات unit فقط من config الرئيسي مع إبقاء integration على `vitest.config.integration.ts`.

**الأوامر والنتائج:**
- `pnpm --filter forerun-api test` → نجح، 7 ملفات و148 اختبارًا
- `pnpm --filter forerun-api lint` → نجح
- `pnpm --filter forerun-api typecheck` → نجح

**الأخطاء والحلول:**
- Vitest 4.1.11 لا يصدّر `resolve` من `vitest/config`، لذلك استُخدم `node:path` مع تعريف `__dirname` بصيغة ESM
- ظهور تحذير `test.poolOptions`Deprecated` من Vitest 4؛ الإعداد ما زال يعمل ويعطي النتيجة المطلوبة

### 2026-09-19 14:39 — اختبار بدائل إعداد Vitest لمعالجة Prisma const enum

**الملفات والدوال المعدّلة:**
- `apps/api/vitest.config.ts` — تطبيق وإعادة إعدادات الخيارات 1 و3 و4 مؤقتًا، ثم استعادة الإعداد الأصلي
- `apps/api/vite.config.ts` — إنشاء إعداد الخيار 2 مؤقتًا ثم حذفه

**السبب:**
تحديد إعداد يحل فشل `vite:oxc` عند تحليل `node_modules/.prisma/client/index.d.ts` الناتج عن `const enum`.

**الأوامر والنتائج:**
- `pnpm --filter forerun-api test` مع الخيار 1 → فشل: 5 ملفات و123 اختبارًا ناجحًا؛ استمرار خطأ `Missing initializer in const declaration` من `vite:oxc`
- `pnpm --filter forerun-api test` مع الخيار 2 → فشل: 5 ملفات و123 اختبارًا ناجحًا؛ استمرار الخطأ نفسه
- `pnpm --filter forerun-api test` مع الخيار 3 → تجاوز خطأ OXC: 7 ملفات نجحت، 3 ملفات integration فشلت بسبب عدم الوصول إلى قاعدة البيانات؛ 148 اختبارًا ناجحًا و13 تخطى
- `pnpm --filter forerun-api test` مع الخيار 4 → فشل: 5 ملفات و123 اختبارًا ناجحًا؛ حذّر Vitest من وجود `esbuild` و`oxc` معًا وأن إعدادات `oxc` هي المستخدمة
- `git status --short -- apps/api/vitest.config.ts apps/api/vite.config.ts` → لا توجد تغييرات متبقية في ملفات الإعداد المؤقتة

**الأخطاء والحلول:**
- الخيار 4 لا يبدّل المحوّل إلى esbuild في Vitest 4.1.11/Vite 8.3.0؛ بقي OXC هو الفعّال
- الخيار 3 هو الوحيد الذي تجاوز خطأ Prisma، لكنه يحتاج قاعدة اختبار متاحة قبل اعتبار الاختبارات مكتملة

### 2026-09-19 14:30 — Sprint 4 Task 4.1: Settlements module implementation

**الملفات والدوال المعدّلة:**
- `packages/shared-types/src/settlement.types.ts` — إضافة `SettlementItemSchema`، `SettlementSchema`، `SettlementListResponseSchema`، `SettlementAdminQuerySchema` وأنواعها
- `packages/shared-types/src/rating.types.ts` — إنشاء schemas: `CreateRatingSchema`، `RatingSchema`، `RatingListResponseSchema`، `RatingListQuerySchema`
- `packages/shared-types/src/websocket.events.ts` — إضافة `SETTLEMENT_CLOSED` إلى `ADMIN_EVENTS`
- `packages/shared-types/src/index.ts` — تصدير `rating.types`
- `apps/api/src/modules/settlements/settlements.controller.ts` — Controller بـ 4 endpoints: `POST /admin/settlements/close-day`، `PUT /admin/settlements/:id/mark-settled`، `GET /admin/settlements`، `GET /admin/settlements/pending`
- `apps/api/src/modules/settlements/settlements.service.ts` — Service بمنطق: `closeDay` (transaction مع حساب Damascus range، idempotent check، إنشاء Settlement + SettlementItems + SETTLEMENT_PAID LedgerEntry + AuditLog + WebSocket)، `markSettled` (PENDING→SETTLED + SETTLEMENT_PAID LedgerEntry + AuditLog)، `listAdmin` (pagination + filters)، `getPending` (مجمّعة حسب المندوب)
- `apps/api/src/modules/settlements/settlements.module.ts` — Module مع Prisma + Audit + Notifications
- `apps/api/src/app.module.ts` — تسجيل `SettlementsModule`

**السبب:**
تنفيذ المهمة 4.1 من Sprint 4 — إنشاء module التسويات اليومية (Settlements) بالكامل مع الالتزام بجميع القواعد: DTOs في shared-types أولاً، كل عملية مالية = LedgerEntry (SETTLEMENT_PAID فقط)، كل العمليات في transaction واحدة، فحص idempotency، AuditLog لكل عملية، WebSocket emitToAdmin.

**الأوامر والنتائج:**
- `pnpm build` → نجح، 4/4 حزم
- `pnpm typecheck` → نجح، 4/4 حزم
- `pnpm lint` → نجح، 4/4 حزم (0 errors)
- `pnpm --filter forerun-api test` → ⚠️ 123 اختبار نجح | 5 ملفات فشلت (بنية تحتية مسبقة — Prisma + Vitest/oxc incompatibility)

**الأخطاء والحلول:**
- خطأ `Duplicate identifier 'SettlementAdminQuery'` — تم تصحيح الاستيراد (القيمة `SettlementAdminQuerySchema` والنوع `type SettlementAdminQuery`)
- خطأ `Module has no exported member 'Prisma'` — تم تصحيح الاستيراد من `@prisma/client` بدلاً من `prisma.service.js`
- خطأ `TS2322: Type 'string' is not assignable to SettlementStatus` — تم تصحيح الـ cast إلى `'PENDING' | 'SETTLED'`
- خطأ `no-unused-vars: CloseSettlementRequest` — تم إزالة الاستيراد غير المستخدم
- خطأ `no-explicit-any` — تم تعيين نوع صريح لمتغير `settlements`

### 2026-09-19 11:13 — تصحيح تسلسل مراجعة الطلب في اختبارات integration

**الملفات والدوال المعدّلة:**
- `apps/api/test/integration/orders/deliver-order.integration.spec.ts` — إضافة طلب `PUT /api/v1/admin/orders/:id/start-review` قبل `approve` في `prepareOrderForDelivery()`.
- `apps/api/test/integration/orders/create-order.integration.spec.ts` — تغيير assertion حالة الطلب من `DRAFT` إلى `PENDING_REVIEW`.

**السبب:**
مطابقة تسلسل State Machine الفعلي: `DRAFT → PENDING_REVIEW → UNDER_REVIEW → AWAITING_RUNNER → ASSIGNED`، ومطابقة الحالة التي يُرجعها API بعد إنشاء الطلب.

**الأوامر والنتائج:**
- `pnpm typecheck --filter forerun-api` → نجح، مهمة واحدة ناجحة من مهمة واحدة.
- `git diff --check -- apps/api/test/integration/orders/deliver-order.integration.spec.ts apps/api/test/integration/orders/create-order.integration.spec.ts` → نجح بدون أخطاء.

**الأخطاء والحلول:**
- لا توجد أخطاء تشغيل.

### 2026-09-19 03:15 — إضافة اختبار integration لأولوية P0: deliverOrder

**الملفات والدوال المعدّلة:**
- `apps/api/test/integration/orders/deliver-order.integration.spec.ts` — إضافة سيناريوهات التدفق الكامل للتسليم، وIdempotency، ومحاولة runner خاطئ؛ مع إنشاء الطلب ومراجعته وتعيين runner والشراء والانتقال للتوصيل ثم التسليم.
- `apps/api/test/integration/helpers/seed.helper.ts` — دالة `seedRunner()`: إضافة رقم Whatsapp اختياري لتمكين إنشاء runner ثانٍ داخل الاختبار.

**السبب:**
تغطية سلوك `deliverOrder` ضد API وPostgreSQL فعليين بدون mocks، والتحقق من حالة الطلب، و3 سجلات Ledger، وتوزيع الرسوم، وإحصاءات العميل، وحالة runner، وAuditLog، وIdempotency، وفحص الملكية.

**الأوامر والنتائج:**
- `pnpm typecheck --filter forerun-api` → نجح.
- `pnpm exec prettier --write "apps/api/test/integration/orders/deliver-order.integration.spec.ts" "apps/api/test/integration/helpers/seed.helper.ts"` → نجح.
- `git diff --check` على ملفي الاختبار وhelper → نجح.
- لم تُشغّل الاختبارات حسب الطلب؛ لا توجد قاعدة بيانات اختبار فعلية بعد.

**الأخطاء والحلول:**
- فحص TypeScript المباشر الأول كشف أن `test/` مستثنى من `apps/api/tsconfig.json` وأن imports/إعدادات Vitest تحتاج مشروع فحص مؤقت؛ تم التحقق بنجاح عبر temporary tsconfig.
- المراجعة الثابتة أظهرت أن `approveOrder` ينتقل من `PENDING_REVIEW` إلى `AWAITING_RUNNER` بينما `order-transitions.ts` لا يحتوي على هذا الانتقال؛ لم يتم تعديل الـ endpoint وحسب التعليمات يُبلّغ عن المشكلة بدل معالجتها ذاتيًا.


**الملفات والدوال المعدّلة:**
- `apps/api/test/integration/helpers/seed.helper.ts` — دالة `seedCustomer()`: تغيير علاقة `CustomerAddress` من `addresses` إلى `address` وفق `schema.prisma`، وإزالة الحقل غير الموجود `isDefault`؛ ودالة `loginAs()`: قراءة `accessToken` مباشرة من `res.body.accessToken` لأن استجابة `/auth/login` لا تستخدم wrapper باسم `data`.

**السبب:**
مطابقة اسم حقل العلاقة الفعلي في Prisma ومسار الـ access token الفعلي في استجابة خدمة المصادقة قبل تشغيل الاختبارات.

**الأوامر والنتائج:**
- `pnpm build && pnpm typecheck && pnpm lint` → نجحت المراحل الثلاث؛ البناء 4/4، وفحص الأنواع 4/4، والـ lint 4/4 مع 5 تحذيرات و0 أخطاء.

**الأخطاء والحلول:**
- لا توجد أخطاء تشغيل.

### 2026-09-18 16:12 — Sprint 3 PR Created

**السبب:**
إنهاء موسم Sprint 3 وإنشاء PR على GitHub للمراجعة.

**الأوامر والنتائج:**
- `git add -A && git commit -m "feat: Sprint 3 - Runner execution flow..."` → نجح (53 files changed, commit 9134fda)
- `git push origin feature/sprint-3-runner-endpoints` → نجح
- `gh pr create --title "feat: Sprint 3 — Runner Execution Flow"` → نجح
- PR URL: https://github.com/ghaithmoa84-cyber/fawrun/pull/5
- `pnpm build && pnpm typecheck && pnpm lint && pnpm --filter forerun-api test` → All passed (4/4 packages build, 0 type errors, 0 lint errors, 148/148 tests)

**الأخطاء والحلول:**
- `App.css` was re-added by `git add -A` after being untracked; deleted from filesystem and committed removal
- `.gitignore` updated to exclude `dev-dist/` build artifacts

### 2026-09-18 15:52 — Runner PWA scaffold: install + build fixes

**الملفات والدوال المعدّلة:**
- `apps/runner-pwa/package.json` — Fix `@types/react-dom` version `^19.3.7` → `^19.3.0` (19.3.7 doesn't exist on npm)
- `apps/runner-pwa/.oxlintrc.json` — Fix `ignores` → `ignorePatterns` (invalid oxlint config field); added `dev-dist/` to ignore patterns
- `apps/runner-pwa/src/hooks/useAuth.ts` → `useAuth.tsx` — Renamed from `.ts` to `.tsx` (file contains JSX; TypeScript couldn't parse JSX in `.ts` files)
- `apps/runner-pwa/src/main.tsx` — Fix import `./App.tsx` → `./App` (TS5097: `.tsx` extension requires `allowImportingTsExtensions`)
- `apps/runner-pwa/src/api/client.ts` — Fix axios config: `credentials: 'include'` → `withCredentials: true` (correct Axios property name)
- `apps/runner-pwa/src/components/StoreCard.tsx` — Add `ActiveOrderStoreReceipt` type and annotate `receipt` callback param
- `apps/runner-pwa/src/pages/AvailablePage.tsx` — Remove unused `useAuth` import; annotate `prev` param in `setProfile` callback; cast `response.data.status` to `RunnerProfileResponse['status']`
- `apps/runner-pwa/src/pages/ActiveOrderPage.tsx` — Remove unused `error` state + `setError` calls; annotate `.every`/`.some` callback params; remove unused `ItemsList` import
- `apps/runner-pwa/src/hooks/useWebSocket.ts` — Refactor from `useRef` to `useState` for socket (fixes React ref-during-render warning); remove unused `useRef` import

**السبب:**
Runner PWA scaffold had blocking errors preventing typecheck, lint, and build from passing. Root causes: missing `@types/react-dom` install (blocked `pnpm install`), incorrect file extension for JSX-containing file, wrong axios property name, invalid oxlint config schema, and missing type annotations for implicit-any callback params.

**الأوامر والنتائج:**
- `pnpm install` → Fixed by correcting `@types/react-dom` version
- `pnpm typecheck --filter runner-pwa` → نجح (0 errors)
- `pnpm lint --filter runner-pwa` → نجح (0 errors, 4 warnings for standard data-fetching patterns)
- `pnpm build --filter runner-pwa` → نجح (161 modules transformed, PWA manifest + service worker generated)

**الأخطاء والحلول:**
- `Cannot find module '@forerun/shared-types'` → Resolved by `pnpm install` (pnpm workspace symlinks not yet linked)
- `TS1005: '>' expected` in `useAuth.ts:102` → JSX syntax in `.ts` file; renamed to `.tsx`
- `TS5097: An import path can only end with '.tsx'` → Removed explicit `.tsx` extension from import
- `TS2353: 'credentials' does not exist` → Changed to `withCredentials: true`
- `TS7006: Parameter implicitly has 'any' type` → Added explicit type annotations
- `oxlint: unknown field 'ignores'` → Changed to `ignorePatterns`

### 2026-09-18 17:04 — تصحيح إشعارات إعادة تعيين المندوب

**الملفات والدوال المعدّلة:**
- `apps/api/src/modules/orders/services/admin-order-command.service.ts` — دالة `assignRunner`: إرسال `order:reassigned` إلى `result.oldRunnerUserId` عند إعادة التعيين، ثم إرسال `order:assigned` مع `assignedPayload` و`sound: 'new_order'` إلى `result.runnerUserId`؛ إزالة إرسال `order:assignment_cancelled` أثناء إعادة التعيين.

**السبب:**
مطابقة spec: المندوب القديم يتلقى إشعار نقل الطلب، والمندوب الجديد يتلقى الطلب كاملًا، بينما يُ保留 `order:assignment_cancelled` لحالات إلغاء التعيين كليًا.

**الأوامر والنتائج:**
- `pnpm build && pnpm typecheck && pnpm lint && pnpm --filter forerun-api test` → نجح؛ البناء وفحص الأنواع وlint نجحت، و7 ملفات اختبار و148 اختبارًا نجحت.

**الأخطاء والحلول:**
- لا توجد أخطاء تشغيل.

### 2026-09-17 21:20 — إكمال المرحلة R09 والتجميع النهائي وقرار الجاهزية الشامل

**الملفات والدوال المعدّلة:**
- `.kilo/plans/1789646023666-review-09-final-synthesis.md` — التقرير النهائي الشامل لمراجعة مشروع FAWRUN ودمج نتائج R01–R08
- `.kilo/plans/1789646023666-review-09-handoff.md` — حزمة تسليم المرحلة R09 وقرار الجاهزية الرسمي
- `.kilo/plans/1789646023666-review-control-center.md` — تحديث حالة R09 إلى مكتملة وتسجيل القرار النهائي NO-GO وخطة المعالجة

**السبب:**
إنجاز التوليف النهائي الشامل لجميع المراجعات من R01 إلى R08 وتوحيد خط الأساس، وتصنيف 15 مشكلة P0 حرج و21 مشكلة P1 عالي، وإصدار قرار NO-GO الصريح مع تحديد معايير الدخول للمرحلة القادمة وخطة معالجة مرتبة حسب الأولوية دون أي تعديل على كود المصدر.

**الأوامر والنتائج:**
- مراجعة وتوليف 8 حزم تسليم (R01–R08) وتوحيد سجل انحراف المواصفات (Spec Drift).
- مطابقة 40 نقطة نهاية و15 نموذج Prisma ومصفوفات التزامن والعمليات المالية.
- تأكيد عدم إجراء أي تعديل على كود المصدر.

**الأخطاء والحلول:**
- لا توجد أخطاء تشغيل؛ اكتملت المراجعة بتوثيق دقيق ومبني حصريًا على الأدلة الموثقة.


### 2026-09-17 16:39 — تصحيح مسار R02 في مركز التنسيق

**الملفات والدوال المعدّلة:**
- `.kilo/plans/1789646023666-review-control-center.md` — تصحيح مسار حزمة R02 بعد تحديث حالة R08

**السبب:**
كان مسار R02 يحتوي على أرقام مكررة بالخطأ؛ تم تصحيحه ليطابق الملف الفعلي.

**الأوامر والنتائج:**
- قراءة ملف مركز التنسيق والتحقق من وجود `.kilo/plans/1789646023666-review-02-handoff.md` → تم التحقق

**الأخطاء والحلول:**
- خطأ نسخ في مسار R02 ← تم استبداله بالمسار الصحيح.


### 2026-09-17 16:38 — استلام وتسليم مراجعة R08

**الملفات والدوال المعدّلة:**
- `.kilo/plans/1789646023666-review-08-handoff.md` — حفظ نتائج مراجعة الاختبارات والنشر والواجهات
- `.kilo/plans/1789646023666-review-control-center.md` — تحديث حالة R08 إلى مكتملة وتسجيل جاهزية R09

**السبب:**
تثبيت نتائج R08 في حزمة تسليم قابلة لإعادة الاستخدام، بما في ذلك غياب integration/E2E، ملف E2E config مفقود، غياب CI/CD والواجهات، وNo-op لمهمة typecheck.

**الأوامر والنتائج:**
- `pnpm build` → نجح، 3/3 حزم
- `pnpm lint` → نجح، 3/3 حزم
- `pnpm typecheck` → NO-OP
- `pnpm test` → نجح، 7 ملفات و148 اختبارًا
- عمليات glob للـ workflows وDocker وE2E وhealth → لم تُعثر على الملفات المتوقعة

**الأخطاء والحلول:**
- لا توجد أخطاء تشغيل؛ اكتملت المراجعة دون تعديل مصدر.


### 2026-09-17 16:14 — استلام وتسليم مراجعة R07

**الملفات والدوال المعدّلة:**
- `.kilo/plans/1789646023666-review-07-handoff.md` — حفظ نتائج مراجعة WebSocket والموثوقية والتفويض
- `.kilo/plans/1789646023666-review-control-center.md` — تحديث حالة R07 إلى مكتملة وتسجيل جاهزية R08

**السبب:**
تثبيت نتائج R07 في حزمة تسليم قابلة لإعادة الاستخدام، بما في ذلك غياب Outbox، استخدام دور JWT القديم في الغرف، فشل إرسال Admin الصامت، وعدم وجود تنظيف reconnect/disconnect.

**الأوامر والنتائج:**
- قراءة وفحص event catalog وGateways وNotifications وSocket Registry وجميع emit call sites → اكتملت
- لم يتوفر خادم Socket.IO أو قاعدة بيانات للاختبار runtime

**الأخطاء والحلول:**
- انتهت جلسة R07 برسالة فارغة؛ أُعيدت الجلسة بسياق محفوظ وطُلب منها تسليم مختصر، فنجحت.


### 2026-09-17 16:08 — استلام وتسليم مراجعة R06

**الملفات والدوال المعدّلة:**
- `.kilo/plans/1789646023666-review-06-handoff.md` — حفظ نتائج مراجعة Pricing وLedger وSettlement والنزاهة المالية
- `.kilo/plans/1789646023666-review-control-center.md` — تحديث حالة R06 إلى مكتملة وتسجيل جاهزية R07

**السبب:**
تثبيت نتائج R06 في حزمة تسليم قابلة لإعادة الاستخدام، بما في ذلك blockers مالية حرجة: عدم وجود تسوية، غياب rollback للإلغاء، تحديث حالة التسليم غير المشروط، وغياب فرض Append-only على مستوى قاعدة البيانات.

**الأوامر والنتائج:**
- `git log --oneline -5` → نجح
- قراءة وفحص ملفات Pricing وLedger وOrders وSettlement وSchema والمigrations وRollback plans → اكتملت
- لم تُشغّل `db:push` أو `migrate reset` أو أي عملية قاعدة بيانات

**الأخطاء والحلول:**
- محاولة `git show --stat` تعثرت بسبب استخدام pipeline مع `head`؛ تم الاعتماد على `git log` والقراءة المباشرة بدل تكرار الأمر.


### 2026-09-17 15:59 — استلام وتسليم مراجعة R05

**الملفات والدوال المعدّلة:**
- `.kilo/plans/1789646023666-review-05-handoff.md` — حفظ نتائج مراجعة State Machines وTransactions وConcurrency وIdempotency
- `.kilo/plans/1789646023666-review-control-center.md` — تحديث حالة R05 إلى مكتملة وتسجيل جاهزية R06

**السبب:**
تثبيت نتائج R05 في حزمة تسليم قابلة لإعادة الاستخدام، بما في ذلك مخاطر P0 الخاصة بالتحديثات غير المشروطة وسباق الإلغاء مع التسليم، وتأكد المسار المالي داخل Transaction.

**الأوامر والنتائج:**
- `git show 2457aff --stat` → نجح
- `git status` → الشجرة مطابقة للـ Commit
- عمليات grep/read-only لحالات `status` وTransactions وraw SQL → اكتملت
- لم تُشغّل `db:push` أو `migrate reset` أو أي عملية قاعدة بيانات

**الأخطاء والحلول:**
- لا توجد أخطاء تشغيل؛ اكتملت المراجعة دون تعديل مصدر.


### 2026-09-17 15:18 — إنهاء مراجعة R03 بعد تعثر الجلسة القديمة

**الملفات والدوال المعدّلة:**
- `.kilo/plans/1789646023666-review-03-handoff.md` — حفظ نتائج مراجعة قاعدة البيانات وPrisma والمigrations
- `.kilo/plans/1789646023666-review-control-center.md` — تحديث حالة R03 إلى مكتملة وتسجيل جاهزية R05

**السبب:**
الجلسة القديمة لـ R03 دخلت في تكرار ثم فشلت بسبب compaction؛ أُعيدت المراجعة كجلسة جديدة ضيقة القراءة فقط، مع حد أقصى للنتائج ومنع تكرار الاستكشاف، حتى لا تضيع الجلسة في حلقة.

**الأوامر والنتائج:**
- قراءة وفحص `schema.prisma` و5 ملفات migrations وخدمات Audit/Ledger/Auth/Order ذات الصلة فقط
- لم تُشغّل `db:push` أو `migrate reset` أو أي عملية تغير قاعدة البيانات

**الأخطاء والحلول:**
- خطأ الجلسة القديمة: تكرار استكشاف ثم `Compaction worker returned an empty response`
- الحل: بدء جلسة R03 جديدة بنطاق أضيق، وقراءة أولية واحدة، وإخراج Handoff مباشرة دون تكرار


### 2026-09-17 14:20 — استلام وتسليم مراجعة R04

**الملفات والدوال المعدّلة:**
- `.kilo/plans/1789646023666-review-04-handoff.md` — حفظ نتائج مراجعة REST API وAuthentication وAuthorization وSecurity
- `.kilo/plans/1789646023666-review-control-center.md` — تحديث حالة R04 إلى مكتملة بشروط وبقاء R03 قيد التنفيذ

**السبب:**
تثبيت نتائج R04 في حزمة تسليم قابلة لإعادة الاستخدام، بما في ذلك جرد 40 endpoint وفجوات التحقق والصلاحيات وسلوك Refresh Token ومخاطر WebSocket.

**الأوامر والنتائج:**
- `pnpm --filter forerun-api test` → نجح، 7 ملفات و148 اختبارًا
- `pnpm --filter forerun-api lint` → نجح
- `pnpm --filter forerun-api exec tsc --noEmit` → نجح
- فحص PEM الآمن → لم يُعثر على مادة مفتاح خاص متعقبة؛ الزوج المحلي موجود وصالح دون طباعة محتواه

**الأخطاء والحلول:**
- انتهت جلسة R04 برسالة فارغة؛ أُعيدت الجلسة بسياق محفوظ وطُلب منها تسليم مختصر، فنجحت.


### 2026-09-17 13:48 — استلام وتسليم مراجعة R02

**الملفات والدوال المعدّلة:**
- `.kilo/plans/1789646023666-review-02-handoff.md` — حفظ نتائج مراجعة البنية والوثائق والعقود
- `.kilo/plans/1789646023666-review-control-center.md` — تحديث حالة R02 إلى مكتملة وتسجيل بقاء R03/R04 قيد التنفيذ

**السبب:**
تثبيت نتائج R02 في حزمة تسليم قابلة لإعادة الاستخدام، بما في ذلك نتائج build/lint/test وفجوات الواجهات وOutbox وtypecheck ومخاطر المفاتيح.

**الأوامر والنتائج:**
- `pnpm build` → نجح، 3/3 حزم
- `pnpm lint` → نجح، 3/3 حزم
- `pnpm typecheck` → لم يُنفذ أي task بسبب غياب مهمة typecheck في Turbo
- `pnpm test` → نجح، 7 suites و148 اختبارًا

**الأخطاء والحلول:**
- انتهت جلسة R02 الأولى بـ idle timeout؛ أُعيدت الجلسة بسياق محفوظ وطُلب منها تسليم مختصر بدل تكرار المراجعة، فنجحت.


### 2026-09-17 13:32 — تسليم R01 وتشغيل المراجعات المتوازية R02–R04

**الملفات والدوال المعدّلة:**
- `.kilo/plans/1789646023666-review-01-handoff.md` — نقل نتائج مراجعة Baseline وGit History إلى حزمة تسليم موحدة
- `.kilo/plans/1789646023666-review-control-center.md` — تحديث حالة R01 إلى مكتملة وتسجيل تشغيل R02/R03/R04 بالتوازي

**السبب:**
تمكين المتابعة السريعة للمراجعة الشاملة دون فقدان سياق R01، وتشغيل ثلاث مراجعات مستقلة على نفس Commit لتقليل الاعتماد على محادثة واحدة طويلة.

**الأوامر والنتائج:**
- لم تُنفذ أوامر تشغيل على المشروع؛ تم إنشاء ملفات تسليم وتحديث حالة التنسيق فقط.
- R02 وR03 وR04 أُطلقت كجلسات مراجعة مستقلة في الخلفية.

**الأخطاء والحلول:**
- لا توجد أخطاء مسجلة.


### 2026-09-17 13:14 — تنظيم خطة المراجعة الشاملة إلى مراجعات مستقلة

**الملفات والدوال المعدّلة:**
- `.kilo/plans/1789646023666-review-control-center.md` — مركز تنسيق المراجعات وخريطة التبعيات وحالات R00–R09
- `.kilo/plans/1789646023666-review-handoff-template.md` — قالب تسليم موحد للمراجعات المستقلة
- `.kilo/plans/1789646023666-review-01-baseline-history.md` — خطة مراجعة خط الأساس وGit history
- `.kilo/plans/1789646023666-review-02-architecture-docs.md` — خطة مراجعة البنية والوثائق والعقود
- `.kilo/plans/1789646023666-review-03-db-migrations.md` — خطة مراجعة قاعدة البيانات وPrisma والمigrations
- `.kilo/plans/1789646023666-review-04-api-auth-security.md` — خطة مراجعة REST API وAuthentication وAuthorization وSecurity
- `.kilo/plans/1789646023666-review-05-state-transactions-concurrency.md` — خطة مراجعة State Machines وTransactions وConcurrency وIdempotency
- `.kilo/plans/1789646023666-review-06-finance-ledger-settlement.md` — خطة مراجعة التسعير وLedger وSettlement
- `.kilo/plans/1789646023666-review-07-websocket-reliability.md` — خطة مراجعة WebSocket والموثوقية
- `.kilo/plans/1789646023666-review-08-tests-deployment-frontends.md` — خطة مراجعة الاختبارات والنشر والواجهات
- `.kilo/plans/1789646023666-review-09-final-synthesis.md` — خطة التجميع النهائي وقرار Go/No-Go

**السبب:**
تقسيم المراجعة الشاملة الطويلة إلى خطط مستقلة قابلة للتنفيذ في محادثات منفصلة، مع مركز تنسيق وقالب Handoff لمنع تكرار العمل وفقدان النتائج.

**الأوامر والنتائج:**
- لم تُنفذ أوامر تشغيل؛ العمل اقتصر على إنشاء وتنظيم ملفات الخطط.

**الأخطاء والحلول:**
- لا توجد أخطاء مسجلة.

### 2026-09-13 — CodeRabbit Triage (Round 5)

**الملفات والدوال المعدّلة:**
- `apps/api/prisma/schema.prisma` — Fix A1: orderNumber reverted to nullable; Fix A2: tokenSecret removed
- `apps/api/prisma/migrations/20260911172902_init/migration.sql` — Sync with schema (orderNumber nullable, tokenSecret removed)
- `apps/api/src/modules/auth/auth.service.ts` — Fix A2: tokenSecret removed, refresh() reverted
- `packages/shared-types/src/settlement.types.ts` — Fix A3: runnerId removed from CloseSettlementSchema
- `CHANGELOG.md` — Documented deferred items (Category B)

**السبب:**
Triage of CodeRabbit round 5 comments. Only Category A (real blockers) fixed. Category B deferred to Sprint 2/3/4 per triage classification.

**الأوامر والنتائج:**
- `pnpm --filter @forerun/shared-types build` → نجح
- `pnpm --filter forerun-api db:generate` → نجح
- `pnpm --filter forerun-api build` → نجح
- `pnpm lint` → نجح (3/3)

### 2026-09-13 — PR #1 Created — Sprint 1 Foundation

**الملفات والدوال المعدّلة:**
- `CHANGELOG.md` — PR creation entry
- `feature/sprint-1-auth-admin-websocket` — Pushed commit 84a4aa3

**السبب:**
PR #1 created on GitHub for Sprint 1 Foundation with CodeRabbit review requested.

**الأوامر والنتائج:**
- `git push origin feature/sprint-1-auth-admin-websocket` → نجح
- `gh pr edit 1 --title "feat: Sprint 1 — Foundation (Auth + Admin + WebSocket)"` → نجح
- PR URL: https://github.com/ghaithmoa84-cyber/fawrun/pull/1

### 2026-09-13 10:48 — إضافة مهارتَي FAWRUN Domain Gate وAPI Contract Security

**الملفات والدوال المعدّلة:**
- `.kilo/skills/fawrun-domain-gate/SKILL.md` — إضافة بوابة التحقق من State Machine والعمليات المالية وسلامة البيانات
- `.kilo/skills/api-contract-security/SKILL.md` — إضافة بوابة العقود المشتركة والتحقق التفويضي وأمان APIs
- `AGENTS.md` — إضافة المهارتين إلى قائمة مهارات المشروع

**السبب:**
توحيد فرض قواعد المجال والعقود الأمنية أثناء تطوير FAWRUN، والحد من تغييرات الحالة المباشرة والعمليات المالية غير الآمنة وثغرات APIs.

**الأوامر والنتائج:**
- `git diff --check` → نجح، مع تحذير Git المعتاد حول LF/CRLF في `AGENTS.md`
- `pnpm lint` → نجح، 3 مهام ناجحة
- `pnpm typecheck` → نجح كإعداد Turbo، لكن لم تُنفّذ مهام لأن الحزم لا تعرّف مهام `typecheck`

**الأخطاء والحلول:**
- لم تُكتشف مهام `typecheck` في Turbo؛ تم تسجيل ذلك بدل اعتبار النتيجة تحققًا نوعيًا كاملًا.

### 2026-09-12 18:14 — إكمال التحقق من إصلاحات CodeRabbit

**الملفات والدوال المعدّلة:**
- `CHANGELOG.md` — توثيق نتائج التحقق النهائية

**السبب:**
إكمال خطة التحقق و记录 حالة الأوامر الناجحة والفاشلة دون تعديل ملفات API خارج نطاق الخطة.

**الأوامر والنتائج:**
- `pnpm --filter forerun-api test` → لم يُعثَر على ملفات اختبارات، exit code 1
- `pnpm --filter @forerun/shared-types build` → نجح
- `pnpm --filter @forerun/shared-constants lint` → نجح
- `pnpm --filter forerun-api exec prisma validate` → نجح
- `git diff --check` → نجح

**الأخطاء والحلول:**
- أخطاء `apps/api/src/app.module.ts:90` و`apps/api/src/config/jwt.config.ts:26` موجودة في `HEAD` ولم تُعدّل ضمن هذه الخطة.
- لم يتوفر `DATABASE_URL` أو `psql` محليًا، لذا لم يُنفّذ `pnpm db:push --force`.

### 2026-09-12 17:50 — إصلاح مراجعات CodeRabbit اليدوية

**الملفات والدوال المعدّلة:**
- `AGENTS.md` — إزالة الأحرف التحكمية من قواعد Types First وقائمة المهارات
- `CHANGELOG.md` — تصحيح القوس الزائد في مهمة Auto room assignment
- `apps/api/prisma/migrations/20260911172902_init/migration.sql` — تصحيح `orderNumber` و`operationalDate` وعلاقات LedgerEntry وإضافة فهرس Rating الفريد

**السبب:**
معالجة البنود غير المؤجلة في خطة مراجعات CodeRabbit اليدوية والحفاظ على سلامة الهجرة الأولية.

**الأوامر والنتائج:**
- `pnpm --filter @forerun/shared-types lint` → نجح
- `pnpm --filter forerun-api db:generate` → نجح
- `pnpm --filter forerun-api lint` → فشل بسبب أخطاء parsing/type موجودة مسبقًا في `apps/api/src/app.module.ts:90` و`apps/api/src/config/jwt.config.ts:26`
- `pnpm lint` → فشل لنفس أخطاء API الموجودة مسبقًا
- `pnpm typecheck` → لم يُنفّذ أي مهمة بسبب إعدادات Turbo الحالية
- `pnpm --filter forerun-api build` → فشل بنفس أخطاء API الموجودة مسبقًا
- `git diff --check` → نجح

**الأخطاء والحلول:**
- لم يتوفر `DATABASE_URL` أو `psql` محليًا، لذا لم يُنفّذ `pnpm db:push --force`.

### 2026-09-12 16:30 — إكمال تنفيذ خطة مراجعات CodeRabbit

**الملفات والدوال المعدّلة:**
- `apps/api/src/app.module.ts` — إصلاح خطأ بنائي: إغلاق `JwtModule.registerAsync` بشكل صحيح
- `apps/api/src/config/jwt.config.ts` — إصلاح `normalize.sep` → `sep` (استيراد مباشر من `path`) للتحقق من مسار المجلد
- `packages/shared-constants/src/pricing.ts` — إزالة `calculateFee` (نقلت إلى الـ API layer)
- `apps/api/src/modules/pricing/pricing.service.ts` — إنشاء PricingService جديد في الـ API
- `apps/api/src/modules/pricing/pricing.module.ts` — إنشاء PricingModule
- `apps/api/prisma/schema.prisma` — تصحيح `@@unique([orderId, runnerId])` → `@@unique([orderId, customerId])` للفهرس الفريد
- `docs/sprints/Sprint 2 Brief.md` — إضافة قسم ضمان الذرّية في انتقالات الحالة
- `docs/sprints/Sprint 1 Brief.md` — إضافة أمثلة payloads WebSocket وقواعد الإرسال
- `docs/sprints/Sprint 3 Brief.md` — إضافة قاعدة ذرّية إرسال الأحداث

**السبب:**
نقل منطق التسعير إلى طبقة الـ API وفق قاعدة Server is Source of Truth، وتوثيق انتقالات الحالة الذرّية وقواعد WebSocket.

**الأوامر والنتائج:**
- `pnpm lint` → نجح (3/3)
- `pnpm --filter forerun-api build` → نجح
- `pnpm --filter @forerun/shared-types build` → نجح
- `pnpm --filter @forerun/shared-constants build` → نجح
- `pnpm --filter forerun-api db:generate` → نجح
- `git diff --check` → نجح

### Fixed
- **Exception filter** — Standardized error responses: All exceptions now return `{ statusCode, error, message }` via `HTTP_ERROR_MAP` instead of NestJS default format (1:1, 400, 401, 409, 429, 404).
- **ESLint flat config** — Created `eslint.config.mjs` for ESLint 9 compatibility (was missing entire config).
- **TypeScript tsconfig** — Fixed `declarationMap` error by adding `declarationMap: false` override.
- **Unused imports** — Removed `Server` from notifications.service.ts, `Body` and `BadRequestException` from users.controller.ts, `CONFIG` from users.service.ts, `MessageBody`/`SubscribeMessage`/`ConnectedSocket` from orders.gateway.ts.
- **Zod validation** — Replaced `any` types in ZodValidationPipe (`ZodSchema<any,any>` → `ZodSchema`, `value: any` → `value: unknown`).
- **Runner controller** — Added Zod schemas (`CreateRunnerSchema`, `UpdateRunnerSchema`, `UpdateVisibilitySchema`) to shared-types, integrated `ZodValidationPipe` on all endpoints.
- **Type safety** — Replaced `any` types in audit.service.ts, auth.service.ts, runners.controller.ts, runners.service.ts with proper types (`Prisma.InputJsonValue`, `Prisma.UserUpdateInput`, etc.).

### Added
- Zod schemas for runner create/update operations in `packages/shared-types/src/runner.types.ts`

### Validated
- ESLint: 0 errors
- TypeScript: 0 errors (tsc --noEmit)
- Build: nest build succeeds
- Runtime: 200 auth tests passing (register, login, refresh, logout, protected endpoint, rate limiting, SQL injection, invalid JSON)

### Added
- FAWRUN MVP Technical Specification (from spec v1.1)
- Monorepo structure: apps/api, apps/admin-web, apps/runner-pwa, apps/android, packages/shared-types, packages/shared-constants
- pnpm + Turborepo workspace configuration
- Prisma schema from spec section 5
- 4 sub-agents: code-architect, feature-dev, test-engineer, debugger
- 3 skills: pre-sprint-checklist, rollback-plan, coderabbit-workflow
- Command shortcuts: /pre-sprint, /rollback-plan, /pr
- AGENTS.md with full coding standards and workflow
- CURRENT_STATE.md for session memory
- Semantic commit enforcement via commitlint
- Kilo agent configuration in kilo.json

### Changed
- None

### Fixed
- None

### Security
- None yet

---

## [0.1.0] - 2026-09-11

### Added
- Project initialization
- MVP Technical Specification imported
- Monorepo directory structure created
- Workflow agents and skills configured

## Sprint 1 Complete — Foundation

- pnpm-workspace.yaml, turbo.json, tsconfig.json, .gitignore
- packages/shared-constants: ORDER_STATUSES, PRICING+calculateFee, CONFIG
- packages/shared-types: Auth/Order/Runner/Settlement DTOs + Zod schemas + WebSocket event types
- apps/api: NestJS 12 app with ESM, TS strict, full Prisma schema (15 models, 7 enums)
- First migration applied to PostgreSQL
- Auth: register (201, PENDING_VERIFICATION, bcrypt 12 rounds, transaction)
- Auth: login (JWT RS256 2h, 64-byte refresh token bcrypt-hashed in DB)
- Auth: refresh (silent access token renewal)
- Auth: logout (revokes refresh token in DB)
- JWT Auth Guard + Roles Guard as global APP_GUARD
- @Public, @Roles, @CurrentUser decorators
- ZodValidationPipe for all request bodies
- AllExceptionsFilter with standardized error format per spec 9.0
- VerifiedUserGuard ready for Sprint 2 order endpoints
- Admin: user list/details/verify/reject/suspend (all with AuditLog)
- Admin: runner list/create/update/visibility endpoints
- AuditService: append-only AuditLog for all status changes
- WebSocket: OrdersGateway (/orders) + AdminGateway (/admin) with JWT auth on connect
- Auto room assignment: customer:{id}, runner:{id}, admin:all
- NotificationsService: emitToCustomer/Runner/Admin helpers
- Rate limiting: 100/min default, login 10/15min, register 3/hr
- CORS configured from env, Helmet enabled
- Global prefix /api/v1, Port 3000
- .env + .env.example with all variables documented
