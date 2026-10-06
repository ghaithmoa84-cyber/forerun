# Roadmap — Sprints القادمة

> **تاريخ:** 30 سبتمبر 2026
> **نقطة الانطلاق:** `master` عند `e5bfbc1` — بعد دمج Sprint 8C
> **المرجع:** [`ARCHITECTURE-REVIEW.md`](./ARCHITECTURE-REVIEW.md) §5 · [`CODE-REVIEW.md`](./CODE-REVIEW.md) · [`PROGRESS.md`](./PROGRESS.md)

> ℹ️ **تنبيه ترقيم (عكس [`docs/sprints/Sprint 1 Brief.md`](../../docs/sprints/Sprint%201%20Brief.md)):** هذا الملف يخصّ **سبرنتات Android** (`1–8C` منجزة · `8D–10` مخططة). سبرنتات **backend** تُرقَّم `Sprint 1..6` في [`docs/sprints/`](../../docs/sprints/). **لا تخلط بين الترقيمين** — «Sprint 8» يعني Android دائمًا. خريطة التوثيق الكاملة في [`PROJECT_STATUS.md` §11](../../PROJECT_STATUS.md).

Sprints 1-8C منجز ومدمج. المتبقي هو: إغلاق الديون المعمارية المتبقية، تقسيم WebSocket، تفعيل FCM الحقيقي، نصوص `strings.xml`، ثم QA وإطلاق.

---

## Sprint 8D — Medium Architecture (2-3 ساعات)

المصدر: `ARCHITECTURE-REVIEW.md` §5 بنود 5-13 + بنود Gradle §2.4. لا مساس بسلوك المستخدم.

| # | المهمة | المرجع | الحجم |
|---|--------|--------|-------|
| 1 | **نقل `TokenRefreshManager` → `core/auth`** مع حل A17 | §5.7 · A17 | S |
| 2 | **تحويل `RefreshInterceptor` → `okhttp3.Authenticator`** — يزيل Cycle 1 جذرياً ويجعل `AuthRepositoryImpl` غير قابل للـ nullable `Provider` (Cycle 2) | §5.12 · Cycle 1/2 | M |
| 3 | **شطب `Provider<AuthApi>` / `Provider<CustomerApi>`** بعد #2 | Cycle 1/2 | S |
| 4 | **توثيق دورات DI** بتعليقات في `NetworkModule` و`AuthRepositoryImpl` — أي contributor يستبدل `Provider` مباشرة يرى الإشارة فوراً | §3.3 | S |
| 5 | **`ObserveOnboardingUseCase`** وإزالة حقن `OnboardingPrefs` المباشر من `OnboardingViewModel` | A11 · §5.5 | S |
| 6 | **`ReverseGeocodeUseCase`** وحقن `GeocodingService` عبره بدل الحقن المباشر | A14 · §5.5 | S |
| 7 | **إلغاء الـ nullable-default constructor injection** في `LoginViewModel` (`SocketManager?`) و`SplashViewModel` (`DeepLinkHolder?`) — استبدلها بمنشئات اختبار `@Inject` | A12 · A13 · §5.6 | S |
| 8 | **إصلاح Nominatim DI**: حذف `= AddressReverseGeocodeCache()` كي يحقن Hilt النسخة `@Singleton`، وحقن `OkHttpClient` مؤهَّل بدل بناء عميل بـ 5s hardcoded | A18 · A19 · §5.9 | M |
| 9 | **`OrderDetailMapper`** لاستخراج ~90 سطراً من mapping المضمّن في `OrderRepositoryImpl.getOrderDetail` (60+ اسم نوع مؤهَّل) | A21 · §5.11 | M |
| 10 | **توحيد endpoints الطلبات** في `OrderApi` (إزالة `getAvailableRunners` من `CustomerApi`) | A22 | S |
| 11 | **Gradle hygiene**: حذف `libs.material` غير المستخدم (~1MB)، استبدال `isReturnDefaultValues` بـ mocks/Robolectric صريحة، تثبيت `security-crypto` على إصدار مستقر أو توثيق متطلب alpha | B3 · B5 · B6 · §5.13 | S |
| 12 | **`@Binds` بدل `@Provides`** في `provideOnboardingPrefs`، وحذف الت provision المكرر | DI-2 · A16 | XS |
| 13 | **`CustomerProfile.status` → `UserStatus`** بدل `String` (يلمس `HomeRepositoryImpl` + `HomeViewModelTest`) | 8C follow-up | S |

**شرط الإنجاز:** `./gradlew test` 223 → ≥ 235 ناجح، `lint` 0، `assembleDebug` + `assembleRelease` نظيفان، وصفر استيراد `data.*` في `ui/`.

---

## Sprint 8E — WebSocket Port (2 ساعات)

فصل بنية WebSocket عن `SocketManager` الخرساني، وإغلاق فجوة `account:verified`.

| # | المهمة | المرجع | الحجم |
|---|--------|--------|-------|
| 1 | **`OrderEventsGateway` interface في `domain/`** يعيد `Flow<WebSocketEvent>` (مستوى domain، بدون Socket.IO) | A8 · §5 | M |
| 2 | **تنفيذ `SocketOrderEventsGateway`** في `data/` يفوّض إلى `SocketManager` | A8 | S |
| 3 | **`ObserveOrderEventsUseCase` نظيف** يستهلك البوابة بدل `core.websocket.SocketManager` مباشرة — يصبح قابلاً للاختبار بلا خادم | A8 | S |
| 4 | **معالج `AccountVerified` حقيقي**: حدث `VERIFIED` يجب أن يُجبر إعادة فحص حالة الجلسة (يحل الاعتماد على إعادة فتح التطبيق، ويغلق D23) | D23 · §5.14 | M |
| 5 | **`connectionState` مُستهلكاً**: إما إظهار مؤشر اتصال في الشاشات المتأثرة، أو حذف الـ `StateFlow` غير المرصود | D18 | S |
| 6 | **DEEP-MEDIUM-02**: Home وOrders يستمعان لأحداث السوكيت (بطاقة الطلب النشط تتحدث لحظياً بدل السحب اليدوي) | DEEP-MEDIUM-02 | M |

**شرط الإنجاز:** `domain/` لا يستورد `core.websocket` إطلاقاً؛ `WebSocketEvent.AccountVerified` له مستهلك واحد على الأقل؛ الاختبارات تغطي مسار `account:verified` بلا اتصال.

---

## Sprint 8F — FCM + App Distribution (مكتمل الأساس التقني ✅)

**الحالة (2026-10-01):** تم إنجاز الجزء البرمجي والإنتاجي بالكامل:
1. ✅ إنشاء مشروع Firebase حقيقي `forerun-c819d`
2. ✅ توفير ملف `google-services.json` الحقيقي في `apps/android/app/` (gitignored)
3. ✅ توفير `Service Account` وضبط متغير `FIREBASE_SERVICE_ACCOUNT_JSON` على Railway
4. ✅ إنشاء جدول `DeviceToken` وتطبيق الهجرة `20261001160600_add_device_token` على قاعدة الإنتاج
5. ✅ تفعيل نقاط النهاية `POST/DELETE customer/me/device-token` وخدمة `FcmService` في الباك إند
6. ✅ ربط إشعارات Push Notifications بالعربية لكل تغيير بحالة الطلب مع دعم القناة `forerun_orders_channel` ورابط `forerun://orders/{id}`
7. ✅ مفتاح التوقيع Keystore مُتحقّق منه ويعمل (D6)

| # | المهمة | المرجع | الحجم | الحالة |
|---|--------|--------|-------|--------|
| 1 | **FCM حقيقي بدل الـ placeholder**: مشروع Firebase + `google-services.json` + `FIREBASE_SERVICE_ACCOUNT_JSON` | Gap 3 | M | ✅ مُنجَز |
| 2 | **جدول وهجرة `DeviceToken`**: إضافة الموديل لـ Prisma وتطبيق الهجرة على Railway | — | S | ✅ مُنجَز |
| 3 | **نقاط نهاية وخدمة FCM بالباك إند**: `POST/DELETE /customer/me/device-token` و`FcmService` | — | M | ✅ مُنجَز |
| 4 | **اختبار الـ Deep Link والإشعار**: قناة `forerun_orders_channel` ورابط `forerun://orders/{id}` | DEEP-CRITICAL-04 | M | ✅ مُنجَز |
| 5 | **DEEP-MEDIUM-07**: إضافة `https` intent-filter في `AndroidManifest` لروابط `forerun.app/orders/{id}` | DEEP-MEDIUM-07 | XS | ⏳ لاحق |
| 6 | **Firebase App Distribution**: رفع Build الموقّع ودعوة الـ testers | RELEASE-CHECKLIST.md | S | ⏳ خطوة النشر |

**النتيجة:** منظومة الإشعارات الفورية (FCM) أصبحت نشطة بالكامل بين هواتف العملاء والباك إند وقاعدة البيانات.

---

## Sprint 9 — UI Polish (مكتمل 2026-10-06 — 11/12 بندًا (البند 9 مؤجل لـ Sprint 11))

**مكتمل 2026-10-06 — 11/12 بندًا (البند 9 مؤجل لـ Sprint 11)**

المرجع: جدول الـ 81 نصاً في `CODE-REVIEW.md` (73 صفاً، ~14 ملفاً) + MEDIUM/SURFACE المتبقية.

| # | المهمة | الحجم | الحالة |
|---|--------|-------|-------|
| 1 | **نقل 81 نصاً hardcoded → `strings.xml`** بمفاتيح مسماة (`action_hide_password`, `error_*`, `cd_*`, `support_faq_*`) | M | ✅ مُنجَز |
| 2 | **توحيد ترجمة الحالات**: دالة واحدة تعيد `@StringRes` بدل `mapStatusToArabic` + `getStatusBadgeLabel` المكررتين في `HomeScreen` و`OrderDetailScreen` (19 نسخة من 10 حالات) | S | ✅ مُنجَز |
| 3 | **MEDIUM-02**: `remember` → `rememberSaveable` لحقول النماذج (فقدان الإدخال عند تدوير الشاشة / process recreation) | M | ✅ مُنجَز |
| 4 | **MEDIUM-01**: تداخل `Scaffold` داخلي مع `Scaffold` الـ NavGraph | S | ✅ مُنجَز |
| 5 | **MEDIUM-03**: إزاحة الدبوس الثابتة (200dp) التي تحجبه لوحة المفاتيح | S | ✅ مُنجَز |
| 6 | **MEDIUM-04**: حذف قيمة العنوان الوهمية في التسجيل | XS | ✅ مُنجَز |
| 7 | **MEDIUM-05**: بطاقة حالة فارغة للطلب الجاري في Home (النصوص جاهزة أصلاً في `strings.xml`) | XS | ✅ مُنجَز |
| 8 | **DEEP-MEDIUM-06**: توحيد تأكيد الطلب — Dialog أم شاشة منفصلة، لا الاثنان | S | ✅ مُنجَز |
| 9 | **DEEP-MEDIUM-03**: تمرير الفلتر إلى السيرفر بدل الترشيح في الذاكرة (يتعطل مع pagination) | M | ⏳ مؤجل لـ Sprint 11 (`P-ORD-FILTER-1`) |
| 10 | **DEEP-MEDIUM-04**: إحداثيات افتراضية دمشق `33.5138, 36.2765` بدل اللاذقية | XS | ✅ مُنجَز |
| 11 | **SURFACE-01/03**: سهم `←` كنص → أيقونة `AutoMirrored`؛ `Modifier.weight(1f)` في صف خيار المتجر | XS | ✅ مُنجَز |
| 12 | مراجعة بصرية من المستخدم للشاشات الخمس المذكورة في `CODE-REVIEW.md` §"شاشات بحاجة لمراجعة بصرية" | — | ✅ مراجعة بصرية ناجحة |

**شرط الإنجاز:** صفر نص عربي داخل `.kt`؛ كل النصوص في `strings.xml`؛ لا فقد إدخال عند التدوير. (مُحقق بالكامل: 269 اختباراً ناجحاً · 0 lint · assembleDebug ناجح).

---

## Sprint 10 — QA + Launch (4-6 ساعات)

| # | المهمة | الحجم |
|---|--------|-------|
| 1 | **Integration tests**: Repository عبر `MockWebServer` لكل endpoint مستخدم، silent-refresh، WebSocket parsing بعينات payloads حقيقية | M |
| 2 | **اختبارات تكامل E2E آلية** على CI (Appium / `connectedAndroidTest`) — يسدّ Gap 4 | L |
| 3 | **UI tests (Compose)**: 5-10 مسارات حرجة — login → home → create order → submit | M |
| 4 | **Security review**: `keystore.properties` و`google-services.json` غير متسربين · لا أسرار في السجلات · R8 rules لا تكشف endpoints · `isReturnDefaultValues` مُزال | M |
| 5 | **Performance baseline**: زمن cold start، استهلاك الذاكرة، حجم APK لكل ABI، سلوك تحت شبكة بطيئة/منقطعة | M |
| 6 | **اجتياز بوابات الجودة**: `lint` + `test` + `assembleDebug` + `assembleRelease` + `bundleRelease` | S |
| 7 | **أول release رسمي 1.0.0**: ترقيم، توقيع، رفع، صفحة تحميل، إعلان | S |
| 8 | **توثيق Post-Launch**: `PROGRESS.md` + `CURRENT_STATE.md` + أرشفة الفروع المنتهية | XS |

**شرط الإنجاز:** APK موقّع على جهازين فعليين، صفر crash في 30 دقيقة استخدام مستمر، ووثائق محدّثة.

---

## ترتيب مقترح

| # | المرحلة | المدة | الاعتماد |
|:-:|---------|-------|----------|
| 1 | **Sprint 8D** — Medium Architecture | 2-3 ساعات | لا شيء — ابدأ هنا |
| 2 | **Sprint 8E** — WebSocket Port | 2 ساعات | 8D (#1-#3) يمسّان نفس طبقة المصادقة |
| 3 | **Sprint 9** — UI Polish | 3-4 ساعات | 8E (بند #6 يمسّ Home/Orders) |
| 4 | **Sprint 8F** — FCM + Distribution | 2-3 ساعات + انتظار | ⛔ **موقوف على المستخدم**: Firebase + Keystore |
| 5 | **Sprint 10** — QA + Launch | 4-6 ساعات | 8F (يحتاج ثنائي حقيقي) + 9 (يحتاج نصوص نهائية) |

**الإجمالي الهندسي:** ~13-18 ساعة عمل فعّال، موزّعة على 5 جلسات.
**الاعتماد الخارجي الوحيد:** إعداد Firebase ومفتاح Keystore من المستخدم — ابدأ به بالتوازي مع 8D لأنه لا يحتاج عملك.

**ملاحظة على 8F و10:** لا يمكن للوكيل-alone إكمالهما. كل ما سبق (8D، 8E، 9) يمكن تنفيذه بدون مدخلات خارجية.

---

**End of ROADMAP.md**
