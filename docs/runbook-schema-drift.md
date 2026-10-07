# تشغيل فحص تباين المخطط (Schema Drift Runbook)

دليل تشغيل لفحص التباين بين `schema.prisma` وقاعدة البيانات الحية على بيئة الإنتاج/Railway.

---

## الطريقة 1: عبر نقطة الفحص التشخيصية في الـ API (المفضّلة والأساسية)

نقطة نهاية محمية بصلاحيات الأدمن ومعدة للعمل بأمان كامل من داخل شبكة الإنتاج دون الحاجة للوصول المباشر لقاعدة البيانات.

### المسار
`GET /api/v1/admin/system/schema-drift`

### خطوات التشغيل (عبر curl أو أي عميل HTTP)
1. احصل على رمز الوصول (Access Token) الخاص بحساب الأدمن (عبر تسجيل الدخول إلى `/api/v1/auth/login`).
2. نفّذ الاستدعاء التالي:
   ```bash
   curl -s -X GET "https://fawrun-api-production.up.railway.app/api/v1/admin/system/schema-drift" \
     -H "Authorization: Bearer <ADMIN_ACCESS_TOKEN>" \
     -H "Content-Type: application/json"
   ```

### الاستجابة المتوقعة
- **في حال التطابق التام (`IN_SYNC`):**
  ```json
  {
    "status": "IN_SYNC",
    "checkedAt": "2026-10-07T10:55:00.000Z",
    "summary": {
      "expectedModels": 18,
      "actualTables": 18,
      "missingTables": [],
      "extraTables": [],
      "missingColumns": [],
      "extraColumns": []
    }
  }
  ```
- **في حال اكتشاف انحراف (`DRIFT_DETECTED`):**
  - تُرجع الاستجابة `status: "DRIFT_DETECTED"` مع تفاصيل الجداول والأعمدة غير المتطابقة.
  - يُسجل الحدث فورًا في `AuditLog` بنوع `SYSTEM_SCHEMA_DRIFT_CHECK`.
  - يُرسل تنبيه فوري عبر بوت Telegram للإدارة (مع حماية Cooldown مدتها 10 دقائق ضد الإغراق).

### القيود الأمنية وحماية الموارد
- **الصلاحية:** حصرية لدور `ADMIN` فقط (أي دور آخر أو طلب بدون توكن يُرفض فورًا بـ `401` / `403`).
- **معدل الطلب العام:** 3 استدعاءات بالدقيقة على مستوى الـ IP (`@Throttle`).
- **معدل الطلب لكل مسؤول:** فحص واحد كل 10 ثوانٍ كحد أقصى لكل حساب أدمن.
- **طبيعة الاستعلام:** قراءة فقط (`READ-ONLY`) من `information_schema` دون أي أوامر تعديل أو مساس بالبيانات.

---

## الطريقة 2: عبر Railway Console (الطريقة الاحتياطية - Fallback)

في حال تعذر الوصول للـ API أو أثناء إجراء عمليات صيانة هيكلية معطلة للخدمة:

1. افتح **Railway Console** على الخدمة `api`.
2. شغّل الأمر التالي:
   ```bash
   node scripts/diff-schema.js
   ```
   *(يقوم السكربت تلقائيًا بقراءة متغيّر البيئة `DATABASE_URL` المضبوط في خدمة `api`).*
3. انسخ الناتج بالكامل وقدمه للفريق لمطابقة التباينات أو التحقق من المزامنة (`RESULT: IN SYNC`).
