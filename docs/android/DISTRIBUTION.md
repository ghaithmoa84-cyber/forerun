# Firebase App Distribution — دليل التوزيع

> **آخر تحديث:** 2026-10-02
> **الحالة:** مفعّل ✅

---

## ما تم إعداده (مرة واحدة — مكتمل)

| البند | الحالة |
|---|---|
| Firebase Project | `forerun-c819d` ✅ |
| App Distribution | مفعّل ✅ |
| APK مرفوع | النسخة الأولى ✅ |
| Invite Link | مفعّل ✅ |

---

## رابط الدعوة للمستخدمين الجدد

> ⚠️ احفظ هذا الرابط — أرسله لأي مستخدم جديد تريد منحه وصولاً للتطبيق.

**رابط الدعوة:** `https://appdistribution.firebase.dev/i/aa7a4768f6595870`

### ما يفعله المستخدم الجديد (مرة واحدة فقط):
1. يفتح رابط الدعوة على هاتفه
2. يحمّل تطبيق **Firebase App Tester** من Google Play
3. يسجّل دخول ببريده الإلكتروني
4. يرى التطبيق ويضغط **Download**
5. يثبّته — وعند أي تحديث يصله إشعار تلقائي

---

## عند كل إصدار جديد

### الخطوة 1 — بناء APK موقّع
```bash
cd apps/android

# Windows (يقرأ keystore.properties تلقائياً):
.\gradlew.bat assembleRelease

# أو بتمرير المتغيرات يدوياً:
# .\gradlew.bat assembleRelease \
#   -Pandroid.injected.signing.store.file=forerun-release.jks \
#   -Pandroid.injected.signing.store.password=<STORE_PASSWORD> \
#   -Pandroid.injected.signing.key.alias=forerun \
#   -Pandroid.injected.signing.key.password=<KEY_PASSWORD>

# الملفات الناتجة:
# app/build/outputs/apk/release/app-arm64-v8a-release.apk    ← هواتف 64-bit (الأكثر شيوعاً)
# app/build/outputs/apk/release/app-armeabi-v7a-release.apk  ← هواتف 32-bit
# app/build/outputs/apk/release/app-x86_64-release.apk       ← المحاكيات
```

### الخطوة 2 — رفع APK على Firebase
1. افتح [Firebase Console](https://console.firebase.google.com) → مشروع `forerun-c819d`
2. **Release & Monitor** → **App Distribution**
3. اضغط **Upload** وارفع `app-arm64-v8a-release.apk`
4. أضف Release Notes (مثال: `إصلاح FCM · تحسينات الأداء`)
5. اضغط **Distribute**

### النتيجة:
- كل المستخدمين المسجّلين يصلهم إشعار فوري: **"تحديث جديد متاح"**
- يضغطون زر واحد → تحديث تلقائي

---

## معلومات التطبيق

| البند | القيمة |
|---|---|
| Package Name | `com.forerun.customer` |
| Firebase App ID | `1:482968000948:android:0e623122ece7b9e604bae1` |
| Keystore File | `forerun-release.jks` |
| Key Alias | `forerun` |
| موقع Keystore | `D:\FAWRUNF\FAWRUN\apps\android\app\forerun-release.jks` |
| نسخة احتياطية | `D:\Backups\FORERUN-KEYSTORE\` |

---

## أتمتة الرفع (Sprint 8F — مستقبلاً)

```bash
npm install -g firebase-tools
firebase login
firebase appdistribution:distribute \
  app/build/outputs/apk/release/app-arm64-v8a-release.apk \
  --app 1:482968000948:android:0e623122ece7b9e604bae1 \
  --groups testers \
  --release-notes "وصف التحديث هنا"
```

---

## ملاحظات حرجة

- ⚠️ **لا ترفع `forerun-release.jks` إلى GitHub** — موجود في `.gitignore`
- ⚠️ **لا ترفع `google-services.json` إلى GitHub** — موجود في `.gitignore`
- ⚠️ **كلمات مرور Keystore** — محفوظة عند المستخدم فقط، لا تُكتب في أي ملف في المستودع
- ℹ️ **للانتقال لـ Google Play** لاحقاً — راجع `docs/android/ROADMAP.md` Sprint 10
