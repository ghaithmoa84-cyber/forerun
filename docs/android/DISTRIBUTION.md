# دليل توزيع وتحديث تطبيق FORERUN Android

> **آخر تحديث:** 2026-10-29
> **الحالة:** مفعّل ومؤتمت بالكامل (Production Ready) ✅

---

## 1. القناة الإنتاجية الأساسية — التحميل المباشر والتحديث الداخلي

### الرابط المعتمد الدائم للإنتاج:
```text
https://faow.run/forerun.apk
```
هذا الرابط ثابت دائماً، ولا يتغير مع أي إصدار جديد.

### آلية الأتمتة وضمان عدم الخطأ (Zero-Risk Pipeline):
سابقاً كان نسخ الـ APK يتم يدوياً بعد البناء، مما قد يسبب خطأً بشرياً (نسخ ملف خاطئ أو نسيانه).
تمت **أتمتة العملية برمجياً داخل Gradle**:
- عند تشغيل أمر البناء:
  ```bash
  cd apps/android
  ./gradlew assembleRelease
  ```
- بمجرد اكتمال البناء وتوقيع الحزمة، يتم تلقائياً تفعيل مهمة:
  `copyReleaseApkToLandingPage`
- تقوم هذه المهمة بحسب الكود التالي بنسخ الحزمة الشاملة (`app-universal-release.apk`) حصراً، وتسميتها `forerun.apk` ونقلها إلى `apps/landing-page/public/forerun.apk`:
  ```kotlin
  val copyReleaseApkToLandingPage by tasks.registering(Copy::class) {
      from(layout.buildDirectory.file("outputs/apk/release/app-universal-release.apk"))
      into(rootProject.file("../../apps/landing-page/public"))
      rename { "forerun.apk" }
  }
  tasks.matching { it.name == "assembleRelease" }.configureEach {
      finalizedBy(copyReleaseApkToLandingPage)
  }
  ```
- **النتيجة:** يستحيل نسيان نسخ الملف، ويستحيل حفظه في مكان خاطئ أو نسخ حزمة ذات معمارية ناقصة (arm32 فقط أو arm64 فقط).

---

## 2. إدارة وتفعيل الإصدارات عبر لوحة التحكم

بعد رفع الكود إلى Git ونشر موقع الهبوط، تتحكم الإدارة في إطلاق التحديث عبر لوحة التحكم الإدارية:
👉 `/dashboard/app-version`

| الحقل | الوظيفة | القاعدة البرمجية |
|---|---|---|
| `latestVersionCode` | رقم الإصدار الأحدث المتوفر | إذا كان رقم العميل أصغر منه، يُعرض التحديث |
| `minSupportedVersionCode` | أدنى إصدار مسموح به | إذا كان رقم العميل أصغر منه، يكون التحديث **إلزامياً** |
| `latestVersionName` | الاسم الظاهر للمستخدم | نص للعرض فقط (مثل `0.1.3`) |
| `downloadUrl` | رابط الملف المباشر | يجب أن يكون دائماً: `https://faow.run/forerun.apk` |

---

## 3. قناة الاختبارات الداخلية (Firebase App Distribution)

> مخصصة للمطورين والمختبرين قبل الإطلاق العام للجمهور.

- **Firebase Project:** `forerun-c819d`
- **رابط الدعوة للمختبرين:** `https://appdistribution.firebase.dev/i/aa7a4768f6595870`
- **رفع الإصدار:** عبر Firebase Console → App Distribution أو أداة `firebase appdistribution:distribute`.

---

## 4. معلومات التوقيع والـ Keystore

| البند | القيمة |
|---|---|
| Package Name | `com.forerun.customer` |
| Keystore File | `forerun-release.jks` |
| Key Alias | `forerun` |
| إعدادات التوقيع | `apps/android/app/keystore.properties` |
| موقع Keystore | `apps/android/app/forerun-release.jks` |

### تنبيهات الأمان:
- ⚠️ ملفات `forerun-release.jks` و `keystore.properties` و `google-services.json` محمية داخل `.gitignore` ولا تُرفع أبداً للمستودع العام.
