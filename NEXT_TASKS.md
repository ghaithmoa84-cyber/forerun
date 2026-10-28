# FAWRUN — Next Tasks

> **آخر تحديث:** 2026-10-28
> **المرجع الكامل:** [HANDOFF.md](HANDOFF.md)، [PROJECT_STATUS.md](PROJECT_STATUS.md)
> **خريطة التوثيق:** [PROJECT_STATUS.md §11](PROJECT_STATUS.md#11-خريطة-التوثيق--أي-ملف-يملك-أي-حقيقة)

---

## عمل معلّق بانتظار عامل خارجي (External Blocker)

### نافذة الصيانة الموحَّدة عند عودة Railway (نافذتان منفصلتان إلزامياً)

**السبب:** عطل منصة Railway العالمي بتاريخ 2026-10-21 (Console/API/CLI معطّلة، Builds متوقفة بكل المناطق)، يحتاج يومين تقريباً للعودة.

**الحالة:** كل الكود مدموج ومختبر محلياً على `master` (475/475 API، 322/322 Android)، جاهز للنشر فور عودة الخدمة. لا دمج إضافي بانتظار — فقط النشر نفسه.

**القاعدة الإلزامية: فصل تام بين النافذتين، لا تنفيذهما معاً.** الهدف عزل أسباب أي عطل محتمل.

---

#### النافذة 1 — نشر migrations وإصلاحات الأمان (أولاً)
يشمل: D19 (حذف fee defaults)، C-2 (حذف أعمدة الحصص الإرثية)، C-8 (مدموج فعلياً مسبقاً، لا يحتاج نشراً منفصلاً إذ هو Android فقط)، D49 (SEC-AUDIT-01)، D50 (proxy-addr)، وهجرة D58 (`20261026120000_add_create_idempotency_key_to_order` لمنع تكرار الطلبات).

خطوات التنفيذ الكاملة والمتسلسلة:
1. نسخة احتياطية حقيقية: `pg_dump $DATABASE_URL > backup_pre_phase2_$(date +%Y%m%d_%H%M%S).sql`
2. `git push origin master` — تحقق من نجاح البناء على Railway قبل المتابعة
3. من Railway Console: `pnpm exec prisma migrate status` — **توقف وتأكد أن الـ pending هي الثلاث migrations فقط: `remove_order_fee_defaults` و`remove_legacy_share_columns` و`add_create_idempotency_key_to_order`، لا شيء آخر**
4. `pnpm exec prisma migrate deploy`
5. تحقق فوري: `pnpm exec prisma migrate status` + `node scripts/diff-schema.js $DATABASE_URL`
6. فحص صحي: `curl https://fawrun-api-production.up.railway.app/api/v1` + تحقق شاشة تسوية حقيقية تعرض `totalFees` بشكل صحيح
7. اختبار حي لإصلاح SEC-AUDIT-01: عدة محاولات `/auth/login` خاطئة بترويسة Authorization مزوَّرة مختلفة، تأكيد 429 بعد المحاولة العاشرة فعلياً على الإنتاج
8. **مراقبة Sentry/Telegram 15 دقيقة كحد أدنى دون أي تنبيه قبل اعتبار النافذة منتهية**
9. عند أي خطأ: تفعيل [`docs/ROLLBACK_PLAN_phase2_schema_debts.md`](docs/ROLLBACK_PLAN_phase2_schema_debts.md) فوراً

---

#### النافذة 2 — تفعيل CORS (بعد تأكيد استقرار النافذة 1 فقط، لا قبل)
1. Railway Console → مشروع FORERUN → خدمة `api` → `Variables` → عدّل `CORS_ORIGINS`:
   ```text
   https://admin.faow.run,https://runner.faow.run,https://faow.run,https://www.faow.run,https://fawrun-admin.vercel.app,https://fawrun-runner-pwa-steel.vercel.app,https://fawrun-customer-web-three.vercel.app
   ```
2. تحقق: `curl -I -X OPTIONS .../auth/login -H "Origin: https://admin.faow.run" -H "Access-Control-Request-Method: POST"` → توقَّع 204
3. اختبار فعلي في المتصفح على الدومينات الجديدة الثلاثة
4. مراقبة 10 دقائق إضافية قبل اعتبار الدومينات الجديدة جاهزة للتوزيع الفعلي

⚠️ **تحذير قائم:** الروابط الرسمية الجديدة منشورة لكن غير وظيفية حتى تُنفَّذ هذه الخطوة — لا تُوزَّع لمستخدمين حقيقيين قبلها.

### تشغيل حزمة اختبارات الحمل والتزامن (scripts/load-testing/) على Railway

**السياق:** تم دمج حزمة سكربتات متكاملة لاختبار الحمل والتزامن في [`scripts/load-testing/`](scripts/load-testing/) تغطي 5 سيناريوهات حرجة:
1. إنشاء طلبات متزامنة (`01-concurrent-orders.js`)
2. تسليم طلبات متزامن مع قيود دفتر الأستاذ وآلة الحالة (`02-concurrent-deliveries.js`)
3. محاكاة تضارب وسباق قبول وإلغاء الطلبات المتزامنة (`03-concurrent-conflicts.js`)
4. أحمال اتصالات WebSocket والمقابس الحية (`04-websocket-connections.js`)
5. قياس خط الأساس للقراءة السريعة (`05-read-baseline.js`)

**الحالة والشرط الإلزامي:**
- **يتطلب تشغيل هذه الحزمة تأكيداً بشرياً صريحاً ومستقلاً قبل التنفيذ.**
- يُنفَّذ التشغيل على بيئة Railway بعد عودة واستقرار المنصة بالكامل، وقبل إعلان الجاهزية الكاملة للإنتاج.

**خطوات التحضير والتنفيذ:**
1. ضبط متغير البيئة `TARGET_URL` (للرابط الإنتاجي أو الرابط المؤقت).
2. تشغيل سكربت إعداد البيانات التجريبية أولاً:
   ```bash
   node scripts/load-testing/setup-fixtures.js
   ```
   (يقوم بإنشاء 50 حساب عميل و10 حسابات مناديب وحساب أدمن معزول تماماً ومخزن في `.fixtures.json`).
3. تشغيل الحزمة الكاملة عبر:
   ```bash
   node scripts/load-testing/run-all.js
   ```
4. مراقبة استهلاك الموارد (CPU/RAM) على Railway ولوحة Sentry وتنبيهات بوت Telegram.

---

## حالة فروع العمل وشجرة الكود (Branch Status)

- ⏳ **عمل معلّق بانتظار إذن الدمج إلى `master`:**
  - *(لا يوجد عمل معلّق حالياً — شجرة الكود نظيفة وكافة الفروع مدموجة بنجاح إلى `master` عبر `git merge --no-ff`)*.

- ✅ **الفروع المدموجة سابقاً:**
  - دفعة فروع معالجة التكرار والإصلاحات الميدانية والدفاعية المدمجة (2026-10-26):
    - فرع `fix/create-order-idempotency`: (القرار D58 — إضافة حقل `createIdempotencyKey` لمسار إنشاء الطلب `POST /customer/orders` وهجرة schema لمنع تكرار الطلبات وتغطية حالات التسابق، مع اعتماد قاعدة استثناء سلامة البيانات والأمان وحماية التنافس من تجميد `customer-web` بموجب D30).
    - فرع `fix/minor-field-findings-batch-1`: (القرار D57 — معالجة 3 بنود ميدانية ودفاعية: 1. تسجيل `ConnectivityManager.NetworkCallback` في Android لإعادة الاتصال الفوري عند تبديل الشبكة، 2. إعادة مزامنة تفاصيل الطلب تلقائياً بعد استئناف WebSocket في `OrderDetailViewModel` عبر مسار Refresh، 3. حماية دورة الحياة الدفاعية لبيانات تواصل العميل `customerWhatsapp` في `getActiveOrder` بالباكند).
  - دفعة فروع تحسين الواجهات واختبارات الحمل وإصلاح قفل التسليم المدمجة (2026-10-26):
    - فرع `fix/delivery-idempotency-key-stuck-on-network-failure`: (القرار D56 — تحرير قفل idempotency عند فشل شبكة طلب التسليم وإبقاؤه عند نجاح الخادم مع وحدة `deliveryLock.ts` واختباراتها بنجاح 9/9).
    - فرع `test/load-testing-scripts`: (حزمة سكربتات اختبار الحمل والتزامن `scripts/load-testing/`).
    - فرع `feature/landing-page`: (القرار D55 — تطبيق صفحة الهبوط التسويقية المستقلة `apps/landing-page` لتحميل APK فقط).
    - فروع إصلاح رسائل الخطأ الخام (`fix/admin-web-generic-error-messages`، `fix/runner-pwa-generic-error-messages`، `fix/android-generic-error-messages`): (القرار D54 — استبدال الرسائل التقنية والاستثناءات الخام برسائل عربية عامة عبر `ErrorSanitizer` و `errorMessage.ts`).
  - دفعة فروع الإصلاحات الستة المدمجة (2026-10-25):
    - فرع `fix/ledger-amount-validation`: (القرار D53 — تحصين `LedgerService` برفض `amount <= 0` وتوحيد `markSettled` لاستخدام `LedgerService` وتخطي القيد لتسويات `totalFees = 0` · خطة التراجع [docs/ROLLBACK_PLAN_ledger_amount_validation.md](docs/ROLLBACK_PLAN_ledger_amount_validation.md)).
    - فرع `fix/settlement-status-type-contract`: (توحيد عقد `RunnerCurrentSettlement` وضمان الاتساق بين المخطط والأنواع المشتركة).
    - فرع `fix/sentry-webhook-validation`: (التحقق الصارم عبر Zod على حمولة Sentry webhook).
    - فرع `fix/pricing-cap-enforcement`: (فرض سقف `CUSTOM_FEE_CAP` داخل `calculateFee`).
    - فرع `fix/dto-least-privilege-runner-responses`: (تنظيف DTO وحماية الخصوصية: حذف `customerId` و `ledgerEntries` من استجابة `deliverOrder`، وحذف `notes` من `getMyProfile`).
    - فرع `fix/concurrency-guard-status-updates`: (حراسة التزامن: منع سباق الحالات في الإلغاء الإداري، حذف متجر الطلب، وتقييم المندوب).
  - فرع `fix/integration-test-debt-settlement-shares`: (القرار D52 — إصلاح توكيدات الحصص الإرثية في اختبارات التكامل الـ 4 لتوقع `totalFees` بدلاً من الأعمدة المحذوفة بموجب D26/D48، مع تصحيح نظافة بنيوي مستقل بإضافة `DeviceToken` المفقود إلى `cleanDatabase` في `setup.ts`. بخصوص أعراض الفئة الثانية السابقة: لم تتكرر الأعراض عبر 5 تشغيلات متتالية من الصفر، ودُمج الفرع في `master` بـ `33e6d87` بنجاح 135/135 تكامل و 487/487 وحدة و0 drift).
  - فرع `feature/app-update-check` (القرار D51 — نظام التحقق من إصدار التطبيق والتحديث الإلزامي/الاختياري للأندرويد: مسار عام GET `/app/version` بدون تسريب ومسارات إدارة محمية مع قفل تفاؤلي `updatedAt` وقائمة بيضاء للروابط ومحاكاة Sideloading وشاشة حظر كاملة وبانر اختياري. نجاح 487/487 API و 14/14 تكامل و 338/338 Android و0 drift).
  - فرع `fix/sec-audit-03-proxy-addr-override` (القرار D50 — ترقية `proxy-addr` إلى `>= 2.0.8` لسد CVE-2024-52798 مع اختبار TCP حي، وتوثيق تأجيل كوكيز الواجهات وترقية Next 15، مع 475/475 اختباراً).
  - فرع `fix/sec-audit-01-throttler-bypass` (القرار D49 — سد ثغرة تجاوز Rate Limit في المسارات العامة وحظر التخمين بـ `fa28b17` مع 474/474 اختباراً).
  - دفعة ديون Schema والعقود (D19، C-2، C-8) دُمجت في `master` (إزالة defaults، إخفاء كود الحصص، وتوحيد أنواع التسويات).
  - دفعة الديون الآمنة الأربعة (D12، C-7، 6B-6، 6B-7) دُمجت جميعاً في `master` عبر `git merge --no-ff` (القرار D48 — مع 472/472 اختبارات API و319/319 اختبارات Android، وإثبات إقلاع DI الحي بدون أخطاء).
  - صقل وتحديث نصوص بطاقات الخدمات وتصغير أيقونة التطبيق (`feature/services-cards-copy-polish`) دُمجت في `master` (مع 465/465 اختبارات API و319/319 اختبارات Android).
  - هجرة محرك الخرائط إلى Google Maps (`feature/google-maps-migration`) دُمجت في `master` (القرار D47 — مع 465/465 اختبارات API و319/319 اختبارات Android، وتأكيد عملي على هاتف حقيقي).
  - دفعة صقل وظائف تطبيق العميل والـ API (`feature/customer-app-functional-polish`) دُمجت في `master` (القرار D46 — مع 465/465 اختبارات API و318/318 اختبارات Android).
  - تدقيق وصقل النصوص وتوحيد مسمى "المندوب" (`feature/customer-app-copy-polish`) دُمج في `master` بـ `ccf9de6` (القرار D45 — مع 456/456 اختبارات API و318/318 اختبارات Android).
  - دفعة الإصلاحات الأمنية الشاملة (`fix/security-batch-1`) دُمجت في `master` بـ `2d58f54` (7 بنود أمنية: SEC-01, SEC-02, SEC-04, SEC-05, SEC-06, SEC-09, SEC-03 — مع 456/456 اختبارات API و318/318 اختبارات Android).
  - فرع `feature/customer-fee-disclosure-modal` دُمج في `master` بـ `feb0f6b` (القرار D40).
  - فروع الميزات الأخيرة (D41، D42، D43، استعادة التقييم، وتحديث الأيقونة) دُمجت جميعاً بـ `git merge --no-ff`.
  - تم تنظيف وإغلاق كافة الفروع البعيدة القديمة على GitHub.

---

## بنود متوسطة 🟡 مكتشفة ميدانياً في اختبارات الشبكة الضعيفة (غير مُصلحة بعد)

> **ملاحظة منهجية:** تم اكتشاف هذه البنود أثناء محاكاة اختبارات ميدانية حية تحت ظروف شبكة ضعيفة ومتقطعة. أولوية هذه البنود أقل من خلل قفل التسليم الحرج (Blocker) الذي تم إصلاحه (القرار D56)، وهي موثقة هنا لمعالجتها في تحسينات قادمة.

1. **عدم تحديث بيانات تفاصيل الطلب تلقائياً بعد إعادة اتصال WebSocket في تطبيقات الويب (Runner PWA / Customer Web):**
   - **العَرَض:** عند انقطاع الاتصال ثم عودته في واجهات الويب، تستعيد مكتبة Socket.IO الاتصال بنجاح وتستمع للأحداث الجديدة، لكن بيانات تفاصيل الطلب الحالي المعروضة في الشاشة لا يُعاد جلبها تلقائياً بالكامل (`fetchActiveOrder`)، مما يستلزم سحب يدوي للتحديث (Pull-to-refresh) أو إعادة تحميل الصفحة لمطابقة الحالة الميدانية التي قد تكون تغيرت أثناء فترة الانقطاع.
   - **المقترح المستقبلي:** إضافة استدعاء تلقائي لـ `fetchActiveOrder()` داخل مستمع حدث `connect` / `reconnect` في المقابس.

2. **فجوة انقطاع صامتة 20-45 ثانية عند تبديل الشبكة بين Wi-Fi والبيانات الخلوية في Android:** ✅ (تم الحل في فرع `fix/minor-field-findings-batch-1` — القرار D57)
   - **العَرَض:** عند خروج المندوب أو العميل من تغطية Wi-Fi وانتقاله لشبكة الهاتف، يمر التطبيق بفترة صمت طويلة (20-45 ثانية) قبل اكتشاف انقطاع الاتصال وإعادة الاتصال، نظراً لانتظار انتهاء مهلة مقبس TCP الافتراضية بدلاً من الاستجابة الفورية لتغير واجهة الشبكة الفيزيائية.
   - **المقترح والحل المُنفّذ:** تم تسجيل `ConnectivityManager.NetworkCallback` في `SocketManager.kt` لإشعار طبقة الشبكة فور تبدل الشبكة الفيزيائية وإجبار Socket.IO على إعادة الاتصال فورياً مع اختبارات وحدة 5/5 ناجحة.

3. **غياب idempotencyKey في مسار إنشاء الطلب (`POST /customer/orders`):** ✅ (تم الحل في فرع `fix/create-order-idempotency`)
   - **العَرَض:** مسار إنشاء الطلب لا يفرض حالياً مفتاح Idempotency من العميل، مما يعني أنه في حال انقطاع الشبكة بعد وصول الطلب للباكند ومعالجته وقبل استلام تطبيق العميل لرد التأكيد (201 Created)، فإن إعادة محاولة العميل قد تُنشئ طلباً ثانياً جديداً.
   - **التقييم والتخفيف الحالي:** هذا الخطر تم حله في فرع `fix/create-order-idempotency` عبر حقل `idempotencyKey` وقفل المعاملة الفريد ورد الطلب السابق مع اختبارات تكامل متزامنة.

---

## مسار التدقيق الأمني والمعماري الشامل (Audit Phase 1–4 Remediation) — ✅ مُنجَز ومدموج في master (2026-10-13)

- [x] **الخطوة 0: مسح IDOR التجريبي الحي:** فحص 16 مساراً بمستخدمين حقيقيين عبر `audit-idor-endpoints.integration.spec.ts` وإثبات عودة 404 لمنع تسريب الموارد.
- [x] **الفئة 1: كشف وتصحيح الاختبار المزوّر:** تصحيح `users.service.spec.ts` وحذف التجاوزات الوهمية.
- [x] **الفئة 2: حماية آلة حالة المستخدم وترقية الصلاحيات:**
  - بناء `UserStateMachine` وإضافة هجرة `previousStatus` في قاعدة البيانات.
  - قفل تفاؤلي `where: { id, status: SUSPENDED }` لمنع سباق الحالات المتزامنة.
  - إثبات الحماية بـ 5 حالات تكامل في `audit-user-state-escalation-fixed.integration.spec.ts`.
- [x] **الفئة 3: تحصين التسويات اليومية `closeDay`:**
  - الانتقال إلى `deliveredAt` (توقيت دمشق) مع ترحيل الطلبات غير المسواة المتأخرة عبر `settlementItem: null`.
  - منع تكرار الإغلاق بـ `409 ConflictException`، وإثباته باختبار تكامل `audit-close-day-fixed.integration.spec.ts`.
- [x] **اختبار دورة الحياة الكاملة والتزامن المتعدد (E2E Lifecycle & Concurrency):**
  - دورة كاملة للطلب من الإنشاء إلى التسوية مع صفر انحراف (Zero Drift).
  - اختبار التزامن المتوازي لـ `closeDay` يرفض الاستدعاء المزدوج بـ 409 Conflict.
- [x] **التحقق المستقل وعزل PoCs والدمج في master (D32):**
  - إجراء تحقق مستقل من الصفر (Zero-Trust) بدون أي افتراض مسبق.
  - عزل ملفات PoC القديمة في `historical-poc/` لتفادي كسر الـ CI.
  - دمج الفرع بنجاح إلى `master` عبر `git merge --no-ff` واجتياز الفحص الشامل بنسبة 100%.

---

## بنود مؤجلة من المراجعة الأمنية الشاملة

- [x] **حماية بيانات العميل في الطلب النشط للمندوب (GET /runner/orders/active):** ✅ (تم الحل في فرع `fix/minor-field-findings-batch-1` — القرار D57)
  - **الوصف والحل:** إضافة شرط دفاعي صريح ومستقل في طبقة بناء الاستجابة (`customerWhatsapp: ACTIVE_CUSTOMER_CONTACT_STATUSES.has(activeOrder.status) ? ... : null`) لمنع كشف رقم العميل إذا كان الطلب في حالة غير نشطة، مدعوماً باختبارات وحدة 13/13.

- ⏳ **بندا الإيصالات المؤجلان (مرتبطان بقرار D5 وتأجيل ميزة الإيصالات):**
  - **سباق تزامن في `deleteReceipt`:** احتمالية تكرار `AuditLog` واستدعاء مزدوج لحذف ملف Cloudflare R2 في حال حدوث طلبات حذف متزامنة لنفس الإيصال.
  - **كشف `r2Key` الداخلي في استجابات المندوب:** ظهور المفتاح الداخلي للتخزين السحابي `r2Key` ضمن حقول استجابة المندوب بدلاً من الاقتصار على الرابط الموقّع المؤقت.
  - **الأولوية والتقييم:** ميزة الإيصالات برمتها مؤجلة بموجب القرار [D5](PROJECT_STATUS.md#d5--تأجيل-رفع-الإيصالات-تفصيل) وغير مستخدمة في الإنتاج حالياً. يُصلح هذان البندان فقط عند إعادة تفعيل ميزة الإيصالات وتكامل R2 مستقبلاً، وليسا أولوية إطلاقاً في الوقت الراهن.

---

## تحسينات واجهات الإدارة المؤجلة (Admin UI Improvements)

- [ ] **بناء واجهة إدارة إصدارات التطبيق (App Version Management UI) في لوحة الأدمن (`admin-web`):**
  - **السياق:** تم بناء مساري الـ API (`GET /api/v1/admin/app-version` و `PUT /api/v1/admin/app-version`) بنمط API-first (curl/Postman) ضمن الفرع `feature/app-update-check` (القرار D51).
  - **المطلوب:** بناء صفحة تحكم مرئية في `apps/admin-web` تتيح للأدمن استعراض الإعدادات الحالية وتعديلها (رقم الإصدار الأخير، رقم الإصدار الأدنى، رابط APK على `faow.run`، وملاحظات الإصدار) مع إرسال رمز القفل التفاؤلي (`updatedAt`) لمعالجة تعارض الجلسات (409 Conflict) عبر Toast تنبيهي (مؤجل تماشياً مع نمط D36 لتوثيق العمل المؤجل).
- [x] **تحسين رسالة فك التعليق في admin-web (Unsuspend UX):** ✅ مُنجَز (2026-10-13)
  - **التنفيذ:** تصحيح مسميات الأزرار إلى «فك التعليق» بدلاً من «إعادة تفعيل»، وحصرها على الحسابات المعلّقة فقط (`SUSPENDED`)، مع إبراز حالة الحسابات المرفوضة (`REJECTED`) كحالة نهائية بدون أزرار غير صالحة.
  - **التوضيح والمعالجة:** إضافة تنبيه تفسيري داخل الـ Modal يوضح أن فك التعليق يستعيد الحالة السابقة، ومعالجة خطأ 422 بـ Toast عربي صريح يوضح سبب الرفض عند محاولة فك تعليق حساب كان مرفوضاً قبل التعليق. (ملاحظة تدقيقية: تم التحقق عبر سكربت محاكاة منطقي Node script يختبر صحة منطق تحويل أخطاء 422/409 بمعزل عن React runtime، وليس اختبار E2E/DOM تفاعلياً).

---

## مسار الشرائح الإعلانية (Sprint 7A — Banners)

- [x] Sprint 7A — Banners (admin + backend) — مكتمل ومدموج 2026-10-07. انظر PROJECT_STATUS.md §12 D29.
- [x] C-4 — مكتمل ومدموج 2026-10-07. انظر PROJECT_STATUS.md §5.
- [x] C-5: بناء طبقة تحويل (mapping) في Android عبر `BannerRouteMapper` مع 7 اختبارات وحدة وربطها بالواجهة — مُنجَز ومدموج في `master` (فرع `feature/banners-client-android`).
- [x] C-6 — مكتمل ومدموج 2026-10-07. endpoint GET /admin/system/schema-drift. انظر PROJECT_STATUS.md §5.

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
| C-1 | مراجعة `getEntriesByRunner` (`ledger.service.ts:145`) — إما rename أو حذف | منخفضة | ✅ مُنجَز | @code-architect | حُذفت بالكامل كـ Dead Code بموجب D25 ودُمجت في master بـ `a71e421` (415/415 اختبار حي). |
| C-2 | تنظيف عمودَي `runnerShare` و `platformShare` من جدولي `Settlement` و `SettlementItem` في migration مستقل بعد MVP | منخفضة | ✅ مُنجَز ومدمج محلياً | @code-architect | حُذفت الأعمدة وهجرة `20261022132205_remove_legacy_share_columns` جاهزة للنشر في Railway (D49). |
| C-3 | AddressSetupScreen — تحويل `mapLoadError` من `remember` إلى `rememberSaveable` (بحفظ مفتاح `R.string` بدل النص) لتجنب فقدان رسالة الخطأ عند التدوير | منخفضة | ✅ مُنجَز | @android-dev | تحويلها إلى `@StringRes Int?` عبر `rememberSaveable` ودُمجت في master بـ `a71e421` (318/318 اختبار وحدة). |
| C-4 | معالجة انحراف الـ migrations التاريخية في جداول (DeviceToken, LedgerEntry, OrderStore, RefreshToken, Settlement) عبر baseline migration مستقل لما بعد 7A | منخفضة | ✅ مُنجَز | @code-architect | تم إنشاء الهجرة 20261007120000_reconcile_token_defaults ومطابقة schema.prisma مع التاريخ (D31). |
| C-5 | طبقة تحويل (Mapping Layer) في Android عبر `BannerRouteMapper` مع 7 اختبارات وحدة وربطها بالواجهة | متوسطة | ✅ مُنجَز | @android-dev | تم التنفيذ في `BannerRouteMapper` والدمج في `master` من `feature/banners-client-android` |
| C-6 | فحص الـ Drift عبر نقطة تشخيصية في بيئة الإنتاج | منخفضة | ✅ مُنجَز | Ops / @code-architect | تم بناء GET /admin/system/schema-drift مع Throttle مزدوج وAuditLog وتحديث runbook. |
| C-7 | توحيد onError في MapLibreContainer ليُرجع معرّف مورد نصي (@StringRes) بدل نص الاستثناء الخام (String) | منخفضة | ⊘ ملغى | @android-dev | ملغى — الكود المعني حُذف بالكامل ضمن D47 migration (استبدال محرك الخرائط بـ Google Maps، 2026-10-19)؛ لم يعد قابلاً للتطبيق. |
| C-8 | توحيد عقد استجابة cancelOrder: إما تعديل Backend لإرجاع success/message فعلياً، أو تعديل Android DTO ليعكس الحقول الحقيقية المُرجَعة (id, orderNumber, status, cancelledAt) بدل الاعتماد على defaults وهمية | منخفضة | ✅ مُنجَز ومدمج محلياً | @feature-dev | تم تعديل `CancelOrderResponseDto` في Android لدعم العقد الحقيقي مع التوافق العكسي الكامل واختبارات وحدة 322/322 (D49). |
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
> 1. **حذف `@default(60)` من `baseFee` و`totalFee` (القرار D19):** ✅ مُنجَز ومدمج محلياً في master وهجرة `20261022131218_remove_order_fee_defaults` جاهزة للنشر في Railway (القرار D49).
> 2. **الانتقال من `RUNNER_SHARE` الفلوتي إلى `RUNNER_SHARE_BP = 7500` (القرار D12):** ✅ أُغلق بالحذف النهائي (لا الترقية) — تم حذف كود الحصص الميت (`splitShares`، `RUNNER_SHARE`، `PLATFORM_SHARE`) كلياً في الفرع الأول من دفعة الديون (القرار D48).

### سبرنت 6B (أسطح الز_Unbound والمندوب وAndroid) — ✅ مُكتمل
| # | المهمة | الأولوية | الحالة | المسؤول | ملاحظات |
|---|---|---|---|---|---|
| 6B-1 | رفع MAX_CUSTOM_FEE إلى 500 + إظهر customFee/customFeeReason في customer-web (OrderDetail) | عالية | ✅ **مُنجَز** | @feature-dev | مدمج في 86ac39a + 4fe7cb — الرسم الإضافي يظهر في تفاصيل الطلب عند وجوده |
| 6B-2 | إضافة customFee/customFeeReason + estimatedFee الكاملة في runner-pwa (ActiveOrder) | عالية | ✅ **مُنجَز** | @feature-dev | مدمج في 86ac39a — شاشة الطلب النشطعرض الرسم الإضافي والسبب |
| 6B-3 | إضافة customFee/customFeeReason في Android OrderDetailDtos.kt + واجهة العرض | عالية | ✅ **مُنجَز** | @feature-dev | مدمج في 86ac39a — DTO + domain model + mapper + PricingCard + strings.xml |
| 6B-4 | تعديل نص strings.xml:359 («ثابتة» + «60 ل.س» → مرن) | متوسطة | ✅ **مُنجَز** | @feature-dev | مدمج في 86ac39a — النص يصف التسعير الديناميكي |
| 6B-5 | إضافة estimatedFee.customFee في حمولة order:assigned للمندوب | متوسطة | ✅ **مُنجَز** | @feature-dev | مدمج في aaf2d8 — WebSocket payload يحمل customFee/customFeeReason |
| 6B-6 | اختبارات وحدة مخصصة لـ DeviceToken | منخفضة | ✅ **مُنجَز** | @test-engineer | تم إنشاء 15 اختبار وحدة لـ DeviceToken CRUD و+5 اختبارات لـ FCM integration بنجاح ومدموج في master (القرار D48) |
| 6B-7 | حقن TTL في PricingService بدل دوال *ForTesting | منخفضة | ✅ **مُنجَز** | @feature-dev | تم استبدال دوال الاختبار بحقن PricingCacheOptions عبر @Optional() مع فحص DI وقت التشغيل بنجاح ومدموج في master (القرار D48) |

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
| S4 | Sentry وتنبيهات تلغرام — تفعيل على الإنتاج | عالية | ✅ مُنجَز ومفعَّل ومختبر حياً في الإنتاج | @feature-dev | SENTRY_DSN مضبوط في Railway. AllExceptionsFilter يلتقط status >= 500 فقط ويعزل ضجيج 4xx. تم بناء وحدة SentryWebhookController الرسمية بحماية HMAC-SHA256 المشددة وتفعيل rawBody: true لدعم التوقيع، وربطها بـ TelegramService. تم التحقق الحي الكامل بنجاح: وصول إشعار Sentry الرسمي فورياً إلى بوت التلغرام (@forerun_notify_bot). مدموج في master بـ 998ba56 و430/430 اختبار ناجح. |
| S5 | **اختبار ميداني** بعميل حقيقي 1–2 | عالية | ✅ **مُنجَز** (2026-10-06) | Ops / @test-engineer | نُفّذ بنجاح على الطلب الإنتاجي FW-000093 وتأكيد قيد وحيد ORDER_FEE_TOTAL=100. |

---

> **ملاحظة:** أُلغي البند القديم «اختبار يدوي لكل الشاشات» — غطّته آليًا 223 اختبار Android + 184 اختبار وحدة. حُلّ محلًا بالبند S5 أعلاه.

---

للتفاصيل الكاملة عن الحالة، القرارات، والأخطاء المعروفة — ارجع إلى [PROJECT_STATUS.md](PROJECT_STATUS.md).
**نهاية الملف.**
