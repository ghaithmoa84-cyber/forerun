# FORERUN — Project Status & Diagnostic Playbook

> **آخر تحديث:** 2026-10-22
> **الغرض:** هذا الملف هو المرجع الوحيد لحالة المشروع، القرارات المعمارية، الأخطاء المعروفة، وحلولها.
> **مهم:** أي وكيل أو مطوّر يبدأ العمل يجب أن يقرأ هذا الملف كاملًا قبل أي تعديل.
> **نطاق المرجعية:** هذا الملف يملك حقائق **الإنتاج والبنية التحتية** فقط. لتوثيق Android انظر خريطة التوثيق في [§11](#11-خريطة-التوثيق--أي-ملف-يملك-أي-حقيقة).

---

## 1. المعمارية الحالية (لا تُغيَّر بدون سبب)

| المكوّن | التقنية | الاستضافة |
|---|---|---|
| Monorepo | pnpm@9.15.9 workspace + Turborepo | — |
| API | NestJS 12 + Prisma 5.22 + Node 20 | Railway (Dockerfile, `node:20-slim`) |
| Database | PostgreSQL | Railway (internal network) |
| Admin Panel | Next.js 14.2 | Vercel |
| Runner PWA | Vite + vite-plugin-pwa | Vercel |
| Customer Web | Vite | Vercel |
| Android App | Kotlin 2.0.21 · Jetpack Compose · Hilt | **APK مباشر — غير منشور** · ✅ **موقَّع** (Sprints 8D, 8E, 8F مُدمجة) |

### روابط الإنتاج
- **API**: `https://fawrun-api-production.up.railway.app/api/v1` (رابط ثابت عامل · تأجل ربط `api.faow.run` بسبب عطل منصة Railway في 2026-10-21)
- **Admin**:
  - `https://fawrun-admin.vercel.app` (الرابط القديم — عامل بنسبة 100%)
  - `https://admin.faow.run` (الدومين الرسمي الجديد — **منشور، بانتظار تفعيل CORS** في Railway)
- **Runner**:
  - `https://fawrun-runner-pwa-steel.vercel.app` (الرابط القديم — عامل بنسبة 100%)
  - `https://runner.faow.run` (الدومين الرسمي الجديد — **منشور، بانتظار تفعيل CORS** في Railway)
- **Customer**:
  - `https://fawrun-customer-web-three.vercel.app` (الرابط القديم — عامل بنسبة 100%)
  - `https://faow.run` / `https://www.faow.run` (الدومين الرسمي الجديد — **منشور، بانتظار تفعيل CORS** في Railway)
- **Android**: **APK موقَّع** (3 ABI) — **جاهز للنشر بعد ربط Firebase** (Sprint 8F). لا يوجد رابط إنتاج. مفتاح التوقيع: `CN=FORERUN` · SHA-256 `725b4683…09879` — انظر [§12 · D6](#12-سجل-القرارات).
- **GitHub**: `github.com/ghaithmoa84-cyber/forerun` (master)

### 1.1 حالة الإنتاج وقاعدة البيانات — 2026-10-13

| الحقيقة | الحالة |
|---|---|
| منصة الإنتاج وقاعدة البيانات | **Railway** — وليس Supabase |
| Schema Drift | **0**، آخر فحص: **2026-10-13** |
| سجل `_prisma_migrations` (في الكود) | **8 migrations** مُسجَّلة في `schema.prisma` و `master` (آخرها `20261012230000_add_user_previous_status`) |
| Migration الحالية في إنتاج Railway | **8 migrations** مُطبَّقة بنجاح 100% في قاعدة الإنتاج بعد تشغيل المالك لهجرة `20261012230000_add_user_previous_status` في 2026-10-13 |
| آلية نشر الـ migrations | `prisma migrate deploy` يُنفَّذ يدويًا من Railway Console؛ لا يوجد auto-migrate في Dockerfile |

### 1.2 إصدارات وإصلاحات مكتملة — 2026-09-23

| المجال | النتيجة |
|---|---|
| الأمان | تثبيت `ACCOUNT_SUSPENDED_MESSAGE`، منع دخول المستخدم المعلّق في backend والواجهتين، وإضافة endpoint لإعادة التفعيل (`unsuspend`) |
| التحقق من المدخلات | تعريب أخطاء Zod عبر `setErrorMap` |
| أنواع الهاتف | توحيد `SyrianPhoneSchema` في `shared-types` |
| أدوات التشخيص | إضافة `scripts/diff-schema.js` |
| OrderStore | يعمل بدون أخطاء |

---

## 2. قرارات لا تُنقَض (Don'ts)

- ❌ **لا تُضِف `output` إلى `generator client`** في `schema.prisma` — يكسر بنية pnpm ويسبب `@prisma/client did not initialize yet`.
- ❌ **لا تُعِد `railway.toml` بنمط Nixpacks** — يجب أن يبقى `builder = "DOCKERFILE"` أو الملف محذوفًا تمامًا.
- ❌ **لا تستخدم `prisma db push` في production** إلا كإجراء طوارئ — يُسبب Schema Drift بدون migration دائم.
- ❌ **لا تُمرِّر `User.id` إلى FK يشير إلى `Admin.id`** (والعكس). تحقق من `schema.prisma` قبل أي كتابة.
- ❌ **لا تُغيّر `binaryTargets`** — القيمة الحالية: `["native", "debian-openssl-3.0.x"]`.
- ❌ **لا تلمس `pnpm-workspace.yaml` أو `package.json` الجذري** بدون سبب موثّق.
- ❌ **لا تُضِف `postinstall`** يشغّل `prisma generate` على Vercel frontend — لا فائدة، ويطيل البناء.

---

## 3. إعدادات حرجة (لا تُنسى)

### 3.1 Railway Variables (Service: api)
```
DATABASE_URL          = <PostgreSQL internal URL>
JWT_PRIVATE_KEY       = <RSA private key>
JWT_PUBLIC_KEY        = <RSA public key>
NODE_ENV              = production
PORT                  = 3000
CORS_ORIGINS          = https://fawrun-admin.vercel.app,https://fawrun-runner-pwa-steel.vercel.app,https://fawrun-customer-web-three.vercel.app
R2_ACCOUNT_ID         = <dummy-for-now>
R2_ACCESS_KEY_ID      = <dummy-for-now>
R2_SECRET_ACCESS_KEY  = <dummy-for-now>
R2_BUCKET_NAME        = <dummy-for-now>
SENTRY_DSN            = <configured in Railway Variables>
TRUST_PROXY           = 1
TELEGRAM_BOT_TOKEN    = <Telegram bot token>
TELEGRAM_CHAT_ID      = <Telegram chat ID>
FIREBASE_SERVICE_ACCOUNT_JSON = <Service account JSON string>
```

**⚠️ تحذير:** `TRUST_PROXY` يجب أن تكون `1` أو رقمًا صحيحًا، **وليس `true`** (Express يفسّر `"true"` كـ IP ويفشل).

### 3.2 Dockerfile (apps/api, على Railway)
```dockerfile
FROM node:20-slim
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@9.15.9
WORKDIR /app
COPY pnpm-workspace.yaml .
COPY pnpm-lock.yaml .
COPY package.json .
COPY tsconfig.json .
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/
RUN pnpm install --no-frozen-lockfile
RUN pnpm --filter forerun-api exec prisma generate
RUN pnpm --filter @forerun/shared-constants build
RUN pnpm --filter @forerun/shared-types build
RUN pnpm --filter forerun-api build
EXPOSE 3000
CMD ["node", "apps/api/dist/main.js"]
```
**ملاحظات:**
- لا يوجد `prisma generate` في `CMD` — يعمل في البناء فقط.
- `openssl` ضروري لـ Prisma query engine.
- الحزم المشتركة (`shared-types`, `shared-constants`) يجب بناؤها قبل `forerun-api build`.

### 3.3 `apps/api/prisma/schema.prisma` (بلوك generator)
```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "debian-openssl-3.0.x"]
}
```
**لا تُضِف `output`.**

### 3.4 Vercel Build Settings (لكل مشروع)

| الحقل | Admin | Runner | Customer |
|---|---|---|---|
| Framework | Next.js | Vite | Vite |
| Root Directory | `apps/admin-web` | `apps/runner-pwa` | `apps/customer-web` |
| Install Command | `pnpm install --frozen-lockfile` | نفس | نفس |
| Build Command | `cd ../.. && pnpm --filter admin-web... build` | `cd ../.. && pnpm --filter runner-pwa... build` | `cd ../.. && pnpm --filter customer-web... build` |
| Output Directory | `.next` | `dist` | `dist` |
| Node.js version | 22.x | 22.x | 22.x |
| Include files outside root | ✅ | ✅ | ✅ |

**⚠️ ملاحظات حرجة:**
- **`...` (ثلاث نقاط) في Build Command إلزامية** — تجبر pnpm على بناء الحزم المشتركة أولًا.
- **Output Directory = `dist` فقط** (ليس `apps/runner-pwa/dist`) — Vercel يقيس نسبةً إلى Root Directory.
- **`vercel.json` مع rewrites** في `runner-pwa` و `customer-web` ضروري لـ SPA routing:
  ```json
  {
    "rewrites": [
      { "source": "/(.*)", "destination": "/index.html" }
    ]
  }
  ```

### 3.5 Vercel Environment Variables
**Admin:**
```
NEXT_PUBLIC_API_URL = https://fawrun-api-production.up.railway.app/api/v1
NEXT_PUBLIC_WS_URL  = wss://fawrun-api-production.up.railway.app
```
**Runner & Customer:**
```
VITE_API_URL         = https://fawrun-api-production.up.railway.app/api/v1
VITE_WS_URL          = wss://fawrun-api-production.up.railway.app
VITE_ADMIN_WHATSAPP  = <رقم دولي بدون +>   # customer-web فقط
```

---

## 4. Diagnostic Playbook — الأخطاء وحلولها

| # | رسالة الخطأ | السبب الجذري | الحل |
|---|---|---|---|
| 1 | `@prisma/client did not initialize yet` | `output` مخصّص في generator client | احذف سطر `output` |
| 2 | خطأ 1 استمر على Railway رغم الإصلاح | Nixpacks بدل Dockerfile | احذف `railway.toml` أو اضبط Builder=Dockerfile |
| 3 | `libssl.so.1.1: cannot open shared object file` | Prisma خمّن openssl-1.1.x على صورة تحتوي 3.0 | `binaryTargets = ["native", "debian-openssl-3.0.x"]` |
| 4 | `R2 configuration is incomplete` | متغيّرات R2 ناقصة | أضف `R2_*` في Railway Variables |
| 5 | `TypeError: invalid IP address: true` | `TRUST_PROXY="true"` كنص | اجعلها `1` |
| 6 | `isDeleted does not exist in current database` | Schema Drift | طبِّق migration المطلوب، ثم نفّذ `prisma migrate deploy` يدويًا من Railway Console وتحقّق من Schema Drift = `0`؛ لا تستخدم `db push` إلا كإجراء طوارئ موثّق |
| 7 | `Settlement_closedByAdminId_fkey` violation | تمرير User.id بدل Admin.id | استخدم `user.adminId` من JwtAuthGuard |
| 8 | `AuditLog_actorId_fkey` violation | تمرير Admin.id بدل User.id | استخدم `user.userId` في AuditLog |
| 9 | Vercel 404 على مسارات SPA | missing SPA fallback | أضف `vercel.json` مع rewrites |
| 10 | Vercel build فشل: `Can't resolve '@forerun/shared-*'` | pnpm لم يبنِ الحزم المشتركة | استخدم `pnpm --filter <pkg>... build` |
| 11 | `No Output Directory named "dist"` | Output Directory من جذر الـ repo بدل Root Dir | اضبط `dist` فقط |
| 12 | `Cannot GET /api/v1` (على الجذر) | لا يوجد root route | **طبيعي** — ليس خطأ |

### أوامر تشخيص سريعة (Railway Console)
```bash
cd /app/apps/api

# قائمة المستخدمين
node -e 'const{PrismaClient}=require("@prisma/client");const p=new PrismaClient();p.user.findMany({select:{id:true,whatsapp:true,role:true}}).then(u=>console.log(JSON.stringify(u,null,2))).finally(()=>p.$disconnect());'

# قائمة Admins (FK targets)
node -e 'const{PrismaClient}=require("@prisma/client");const p=new PrismaClient();p.admin.findMany({include:{user:{select:{id:true,whatsapp:true}}}}).then(a=>console.log(JSON.stringify(a,null,2))).finally(()=>p.$disconnect());'

# قائمة Runners
node -e 'const{PrismaClient}=require("@prisma/client");const p=new PrismaClient();p.runner.findMany().then(r=>console.log(JSON.stringify(r,null,2))).finally(()=>p.$disconnect());'

# حالة الـ migrations
pnpm exec prisma migrate status

# تطبيق migrations جديدة
pnpm exec prisma migrate deploy
```

### التحقق من CORS
```bash
curl -I -X OPTIONS https://fawrun-api-production.up.railway.app/api/v1/auth/login \
  -H "Origin: https://fawrun-admin.vercel.app" \
  -H "Access-Control-Request-Method: POST"
```
**المتوقع:** `204` مع `Access-Control-Allow-Origin: https://fawrun-admin.vercel.app`.

---

## 5. سجل إغلاق البنود (المكتملة + المتبقية)

> البنود #6 و#7 **غير** مكتملتَين رغم أنهما كانتا مُدرجتَين سابقًا كـ«مكتملة». كل صف يحمل سطر دليل `file:line`، أو ⏔ يحتاج تحقّق، أو ⏔ مؤجَّل بقرار (انظر [§12](#12-سجل-القرارات)). لا تُغلق بندًا دون دليل.

| # | البند | الحالة | النتيجة |
|---|---|---|---|
| 1 | **تغيير كلمة مرور Admin الافتراضية** | ✅ مكتملة ومختبرة على الإنتاج | لم تعد بيانات الاعتماد الافتراضية مستخدمة |
| 2 | تحويل `db push` إلى migration دائم | ✅ مكتملة ومختبرة على الإنتاج | Schema Drift = `0` |
| 3 | `R2Service` → lazy (لا يرمي في constructor) | ✅ مكتملة ومختبرة على الإنتاج | اكتمل الإغلاق |
| 4 | تدقيق جميع FKs في schema (User vs Admin) | ✅ مكتملة ومختبرة على الإنتاج | اكتمل الإغلاق |
| 5 | `MODULE_TYPELESS_PACKAGE_JSON` warning | ✅ مكتملة ومختبرة على الإنتاج | اكتمل الإغلاق |
| 6 | ترقية API Dockerfile إلى Node 22 (الهدف `22-slim`) | ❌ **غير مُنجَز — لا دعوة للاستبدال** | `Dockerfile:1` يحتوي `node:20-slim`، والـ API الإنتاجي يشتغل بسلاسة عليه. لم يُسجَّل أي فشل أو تنبيه من Railway. البند كُتب في وقتٍ كان فيه `.nvmrc` = 22.23.1، لكن `Dockerfile` لم يكن 22ًا أبدًا. الفجوة لم تُعد خطرًا — الـ production مستقر. يُوصى بإغلاق هذا البند كـ "غير قابل للتطبيق". |
| 7 | استبدال قيم R2 الوهمية بقيم حقيقية | ⏔ **مؤجَّل بقرار — ما بعد MVP** | `PROJECT_STATUS.md` §3.1 يعرض `R2_* = <dummy-for-now>`. **لم يُتحقَّق من Railway Variables بعد** ولا تدّعى هنا قيمة ولا وهم. أُرجئت **ميزة رفع الإيصالات** بالكامل بقرار المستخدم في **2026-09-30** — انظر [§12 القرار D5](#12-سجل-القرارات). |
| 8 | Vercel Agent Skill plugin | ✅ مكتملة ومختبرة على الإنتاج | اكتمل الإغلاق |
| 9 | **سبرنت 6B (أسطح الزبون والمندوب وAndroid) — إضافة customFee/customFeeReason إلى الـ frontends ورفع MAX_CUSTOM_FEE إلى 500** | ✅ مكتملة ومختبرة | 4 commits: 64fe7cb · baaf2d8 · 86ac39a · a7b4ae2. pnpm build + typecheck + lint ناجح (6/6). مدموج في `master`. |
| 10 | **Sprint 7A — شرائح الشاشة الرئيسية (Banners admin + backend، روابط https فقط)** | ✅ مكتملة ومختبرة | فرع `feature/sprint-7a-banners-admin` مدموج بـ `git merge --no-ff` إلى `master`. 390 اختبار وحدة (+33) · 53 تكامل (+7) · migration مطبَّقة على الإنتاج وDrift = 0. انظر [§12 القرار D29](#12-سجل-القرارات). |
| 11 | **استهلاك الشرائح في Android (Banners Client UI — فرع وصفي)** | ✅ مكتملة ومختبرة | فرع `feature/banners-client-android` مدموج بـ `git merge --no-ff` إلى `master`. 290 اختبار وحدة (+14) · Coil 3.0.4 · 16:7 pager مع auto-scroll وتوقف عند السحب · اعتماد D30 وإغلاق C-5. |
| 12 | **C-4 — Baseline Reconciliation Migration + C-6 — Schema Drift Diagnostic Endpoint** | ✅ مكتملة ومختبرة | فرعان مدموجان بـ `git merge --no-ff`: `feature/baseline-migrations-c4` (708f4d2) و`feature/c6-schema-drift-endpoint` (dcd958b). 398 اختبار وحدة (+8) · 59 تكامل (+6) · migration مطبَّقة على الإنتاج وDrift = 0. GET /admin/system/schema-drift محمي بـ JWT+RBAC+Throttle مزدوج (IP وadminId). |
| 13 | 🔴 **حرج — تسريب بيانات تواصل المندوب الشخصية دون قيد زمني في `customer-orders.service.ts`** | ✅ مكتملة ومختبرة | تم فرض قيد `ACTIVE_RUNNER_CONTACT_STATUSES` في `GET /customer/orders/:id` و `GET /customer/orders`. أرقام المندوب الشخصية محجوبة (`null`) في الحالات غير النشطة (`DELIVERED`/`CANCELLED`). مغطى بـ 6 اختبارات تكامل جديدة (انظر [§12 القرار D35](#d35--فرض-قيد-دورة-الحياة-على-بيانات-تواصل-المندوب-الشخصية-2026-10-13)). |
| 14 | **إلغاء الطلب الإجباري من الإدارة في كافة الحالات (Admin Force Cancel Order from Any State - D39)** | ✅ مكتملة ومختبرة | تم تمكين إلغاء الأدمن لأي طلب نشط وتحرير المندوب وتسجيل AuditLog مع حماية التنافس واختبارات تكامل شاملة. مدموج في `master` (cb661a4). انظر [§12 القرار D39](#d39--إلغاء-الطلب-الإجباري-من-الإدارة-في-كافة-الحالات-2026-10-14). |
| 15 | **نافذة تنويه المصاريف وسياسة الإلغاء قبل تأكيد الطلب في Android حصراً (D40)** | ✅ مكتملة ومختبرة | نقطة نهاية ديناميكية `GET /customer/pricing/disclosure` بدون تسريب حقول إدارية (قاعدة 7)، نافذة Compose تفاعلية تعترض الطلب، وتراجع آمن عند فشل الشبكة. فرع `feature/customer-fee-disclosure-modal`. انظر [§12 القرار D40](#d40--نافذة-تنويه-المصاريف-وسياسة-الإلغاء-قبل-تأكيد-الطلب-في-android-حصرا-2026-10-14). |
| 16 | **إصلاح فشل تثبيت PWA لتطبيق المندوب على Chrome Android (D42)** | ✅ مكتملة ومختبرة | التقاط مركزي لحدث `beforeinstallprompt` عبر `usePwaInstall` مع 3 نقاط دخول للتثبيت، مهلة 15 ثانية ورسالة خطأ عربية صريحة، وفصل وسوم الأيقونات في Manifest. انظر [§12 القرار D42](#d42--إصلاح-فشل-تثبيت-pwa-لتطبيق-المندوب-على-chrome-android-2026-10-15). |
| 17 | **إتاحة ملاحظة التقييم (note) للعميل وحجبها الصارم عن المندوب (D43) وتحديث أيقونة Android** | ✅ مكتملة ومختبرة | تعديل `rating.mapper.ts` و`OrderDetailViewModel` لإتاحة الملاحظة للعميل مع حفظ خصوصيتها من المندوب (Rule 7)، واستعادة التقييم في `DeliveredRatingCard`، وتحديث أيقونة التطبيق للهوية البرتقالية مع ضبط 108dp. انظر [§12 القرار D43](#d43--إتاحة-ملاحظة-التقييم-note-للعميل-صاحب-التقييم-مع-حجبها-الصارم-عن-المندوب-2026-10-16). |
| 18 | **S4 — تفعيل Sentry وتكامل تنبيهات تلغرام في الإنتاج** | ✅ مكتملة ومختبرة حياً على الإنتاج | تم تفعيل SENTRY_DSN في Railway، وإصلاح AllExceptionsFilter لالتقاط status >= 500 فقط. تم بناء SentryWebhookController بحماية HMAC-SHA256 المشددة ودعم rawBody وإعادة توجيه الإشعارات إلى TelegramService. تم التحقق الحي الكامل بوصول إشعار Sentry بنجاح عبر بوت تلغرام (@forerun_notify_bot) ومغطى بـ 430/430 اختباراً ناجحاً (998ba56). |

---

## 6. حالة أول Admin (بيانات اختبار)

- **WhatsApp**: `+963000000000`
- **Password**: تم تغيير كلمة المرور الافتراضية؛ لا تُخزَّن بيانات الاعتماد في المستودع.
- **User.id**: `cmud1zc670000taxxpy1whxwh`
- **Admin.id**: `cmud6kmju0001alsq9suwt9dg`

**⚠️ لا تُعيد استخدام هذه البيانات في أي مكان عام.**

---

## 7. قواعد العمل مع الوكلاء

لقواعد التعامل، تدفق العمل، قواعد Git، قواعد الأمان، وخطط التراجع — انظر [HANDOFF.md](HANDOFF.md#قواعد-التعامل).

---

## 8. بنية المجلدات الأساسية

```
fawrun/
├── PROJECT_STATUS.md          ← هذا الملف
├── Dockerfile                  ← Railway (API)
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── package.json                ← root
├── turbo.json
├── apps/
│   ├── api/                    ← NestJS + Prisma
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── migrations/
│   │   │   └── seed.ts (إن وُجد)
│   │   ├── src/
│   │   │   ├── common/
│   │   │   │   ├── guards/jwt-auth.guard.ts
│   │   │   │   └── decorators/current-user.decorator.ts
│   │   │   ├── modules/
│   │   │   │   ├── auth/
│   │   │   │   ├── users/
│   │   │   │   ├── orders/
│   │   │   │   ├── settlements/
│   │   │   │   ├── audit/
│   │   │   │   └── receipts/  (R2)
│   │   │   └── main.ts
│   │   └── Dockerfile (إن لم يكن في الجذر)
│   ├── admin-web/              ← Next.js 14
│   │   ├── next.config.js
│   │   └── package.json
│   ├── runner-pwa/             ← Vite + PWA
│   │   ├── vercel.json
│   │   └── vite.config.ts
│   ├── customer-web/           ← Vite
│   │   ├── vercel.json
│   │   └── vite.config.ts
│   └── android/                ← Kotlin + Jetpack Compose (10 سبرنتات منجزة: 1–9)
│       ├── app/src/main/java/  ← MVVM + Hilt + Retrofit + WebSocket
│       └── app/src/test/       ← 247 @Test
├── docs/
│   ├── sprints/                ← معايير إنجاز سبرنتات الـ backend (Sprint 1–6)
│   └── android/                ← توثيق Android (انظر §11)
│       ├── MASTER-SPEC.md      ← المواصفة
│       ├── PROGRESS.md         ← السجل التفصيلي
│       ├── CURRENT_STATE.md    ← لحظة الحاضر
│       └── ROADMAP.md          ← 8A–8C منجزة · 8D–10 مخططة
└── packages/
    ├── shared-types/
    └── shared-constants/
```

---

## 9. سجل الأحداث الكبرى (Timeline)

| التاريخ | الحدث |
|---|---|
| 2026-09-22 | نشر API على Railway بنجاح بعد حل Prisma + Dockerfile |
| 2026-09-22 | نشر Admin + Runner + Customer على Vercel |
| 2026-09-22 | ضبط CORS + إنشاء أول Admin |
| 2026-09-22 | حل Schema Drift عبر `db push` |
| 2026-09-23 | إصلاح FK Settlements (User vs Admin) |
| 2026-09-23 | إصلاح FK AuditLog (Admin vs User) |
| 2026-09-23 | تأكيد أن الإنتاج على **Railway** وليس Supabase؛ Schema Drift = `0` و6 migrations مُسجَّلة |
| 2026-09-23 | تطبيق migration `20260923154000_add_order_store_soft_delete` وتوثيق النشر اليدوي من Railway Console |
| 2026-09-23 | إغلاق البنود #1–#8 بعد اكتمالها واختبارها على الإنتاج |
| 2026-09-23 | إصلاح `ACCOUNT_SUSPENDED_MESSAGE`، منع دخول المعلّق، وإضافة `unsuspend` |
| 2026-09-23 | تعريب أخطاء Zod، توحيد `SyrianPhoneSchema`، وإضافة `scripts/diff-schema.js` |
| 2026-09-30 | `3fc4119` — `merge(android)`: سبرنتات 1–8B — اكتمال تطبيق Android للعميل |
| 2026-09-30 | `480b812` — `docs(android)`: تقرير تنظيف الفروع |
| 2026-09-30 | `6e25aed` — `refactor(android)`: سبرنت 8C — بنية Account نظيفة + فك ارتباط NavGraph |
| 2026-09-30 | `e5bfbc1` — `merge(android)`: سبرنت 8C — (8 سبرنتات · 223 `@Test` · 3 APKs release **موقَّعة** v2) |
| 2026-09-30 | `9e6c212` — `docs(android)`: تحديث التوثيق الشامل (`PROGRESS.md` · `ROADMAP.md` · `CURRENT_STATE.md` · `MASTER-SPEC.md` §21) |
| 2026-10-01 | `1055b5f` — `merge(android)`: سبرنت 8D — **دمج الأندرويد في `master`** (9 سبرنتات · 247 `@Test` · 0 lint · 3 APKs release **موقَّعة**) |
| 2026-10-01 | `b6acfaf` — `merge(android)`: سبرنت 8E — نقل طبقة WebSocket إلى Domain Layer وتفعيل `AccountVerified` |
| 2026-10-01 | `6d7ef78` — إطلاق إشعارات Telegram في الـ backend (`TelegramService`) للطلبات الجديدة وتسجيل الحسابات بنجاح على Railway |
| 2026-10-01 | `090d261` — إنجاز **Sprint 8F**: ربط مشروع Firebase الحقيقي (`forerun-c819d`)، إنشاء جدول `DeviceToken` وتطبيق الهجرة `20261001160600_add_device_token` في الإنتاج، وبرمجة `FcmService` لإرسال Push Notifications لهواتف العملاء عند تحديثات الطلبات |
| 2026-10-03 | `26df1cb` — `fix(review)`: دفعة إصلاحات من مراجعة الكود (ابتلاع الأخطاء الصامت، N+1، النصوص الصلبة، `console.log`، الأرقام السحرية) — **مُغلقت 11 بنداً من `docs/SECURITY-AND-CODE-REVIEW.md`** |
| 2026-10-04 | `f78fe50` — `refactor(api)`: تفكيك الدوال الطويلة في الخدمات إلى دوال فرعية (`deliverOrder` 88 سطراً · `approveOrder` 73 · `closeDay` 58) |
| 2026-10-04 | `744bf23` — **إعادة هيكلة `docs/SECURITY-AND-CODE-REVIEW.md` (الإصدار 2)**: كل بند موثّق بـ`ملف:سطر` على `744bf23` · **33 بنداً مفتوحاً** (1 🔴 · 24 🟡 · 8 🟢) · **12 مُغلقاً** · **5 مرفوضة بالدليل** (أهمها: نسبة `RUNNER_SHARE = 0.75` **صحيحة** والمواصفة تنص على 75/25 — لا تغيير). 🔴 الوحيد: `runner-orders.service.ts:1096–1102` (حاجز يُبطل Idempotency التسليم) |
| 2026-10-05 | `69555ea`..`de8eda8` — **سبرنت 6A (التسعير الديناميكي) 6A-1 → 6A-8** على الفرع `feature/sprint-6a-dynamic-pricing-backend` (34 commit عن `master`): جدول `PlatformPricing` + صف seed 60/20/40، `PricingConfig`/`getPricingConfig` مع كاش 30ث، توحيد حصص التسويات لكل طلب (`splitShares`)، أعمدة `customFee` مع قيد CHECK، مسارات `GET/PUT /admin/pricing` و`fee-preview`، وشاشتا الأدمن. |
| 2026-10-05 | **6A-3.1b (الخطوة الأخيرة)** — ربط `getPricingConfig` بمسارات الإنتاج الأربعة `createOrder` · `approveOrder` · `recalculateFee` · `previewFee` (القرارات **D21/D22/D23**). +9 اختبارات وحدة و+6 اختبارات تكامل (S2) ⇒ **355 وحدة + 44 تكامل ناجح**. `cleanDatabase` في `test/integration/setup.ts` يعيد صف الأسعار إلى خط الأساس. **تحذير D20 أصبح محققاً: تعديل الأسعار مؤثّر فعلي الآن.** لا الدمج ولا النشر بعد — المالك فقط (`prisma migrate deploy` قبل تشغيل الـ API الجديد). |
| 2026-10-05 | **سبرنت 6B (أسطح الزبون والمندوب وAndroid)** — رفع MAX_CUSTOM_FEE إلى 500، إضافة customFee/customFeeReason لـ customer-web (OrderDetail) و runner-pwa (ActiveOrder) و Android (DTO + PricingCard + strings.xml)، وحمولة order:assigned WebSocket carrying customFee. 4 semantic commits: 64fe7cb (shared types) · baaf2d8 (backend) · 86ac39a (frontends) · a7b4ae2 (tests). pnpm build + typecheck + lint ناجح (6/6). مدموج في `master`. |
| 2026-10-06 | إلغاء نظام الحصص (D25–D28) نُشر على الإنتاج: merge `af6ae4e` · 12 commits · API/Admin/Runner Ready · Customer Web لم يتغيّر. |
| 2026-10-06 | S5 ميداني ناجح (FW-000093) · LedgerEntry واحد ORDER_FEE_TOTAL=100 · M-1 مغلق. |
| 2026-10-06 | توقيع المراجعة الأمنية الإصدار 3 على `7787553` · 5 بنود مفتوحة مقبولة كدين تقني · 28 مُغلقة · 0 حرجة. |
| 2026-10-06 | Sprint 6 S3: خط أساس الأداء موثّق في `docs/performance-baseline.md` · RSS ~122MB · p50<p95 تحت الحدود · لا اختناقات. |
| 2026-10-06 | `2088b51` — **Sprint 9 (Android UI Polish)** مُدمج في `master` · 269 اختباراً · 0 lint · صفر نص عربي في `.kt` · مراجعة بصرية ناجحة. |
| 2026-10-07 | Sprint 7A (Banners) مُدمج في `master`: جدول `Banner` + وحدة إدارة كاملة (CRUD + reorder) + لوحة أدمن (معاينة 16:7، جدولة بتوقيت دمشق). قرار D29: صور بروابط https فقط في هذه المرحلة، R2 لم يُفعَّل (D5 ساري). |
| 2026-10-07 | بدء استهلاك الشرائح في Android (فرع `feature/banners-client-android` وصفي): اعتماد قرار D30 (سياسة عامة: حصر تطوير أسطح العميل بـ Android وتجميد customer-web)، إضافة Coil 3.0.4 عبر Version Catalog، وإنجاز طبقة التحويل C-5 (`BannerRouteMapper` مع 7 اختبارات وحدة ناجحة بنسبة 100%). |
| 2026-10-07 | إغلاق C-4 وC-6: مطابقة schema.prisma مع سجل migrations التاريخي (LedgerEntry onDelete:Restrict، OrderStore index، Settlement VarChar(10))، وإضافة endpoint تشخيصي محمي لفحص Schema Drift من الإنتاج مباشرة. |
| 2026-10-12 | المراجعة الأمنية والمالية الشاملة (المراحل 1–4) وإصلاحات آلة الحالة والتسويات: كشف وتصحيح اختبار مزوّر في `users.service.spec.ts`، سد ثغرة ترقية الصلاحيات عبر إنشاء `UserStateMachine` وإضافة عمود `previousStatus` في قاعدة البيانات مع قفل تفاؤلي، إصلاح `closeDay` بالاعتماد على `deliveredAt` وترحيل الطلبات المتأخرة وفرض 409 على الإغلاق المكرر، إثبات عزل 16 مساراً ضد IDOR تجريبياً، واختبار تكامل E2E وإجهاد متزامن بدقة صفر انحراف (Zero Drift). |
| 2026-10-13 | D34 تطبيق هجرة `previousStatus` (الهجرة الثامنة) على إنتاج Railway بنجاح · D35 فرض قيد دورة الحياة على أرقام تواصل المندوب وحجبها خارج الحالات النشطة. |
| 2026-10-14 | D38 توحيد ودمج إعادة التصميم البصري مع حزمة التواصل والأمان للأندرويد في `master` · D39 تمكين الإدارة من إلغاء الطلب إجبارياً في الحالات النشطة وتحرير المندوب (`cb661a4`) · D40 نافذة تنويه المصاريف والإلغاء في Android قبل إرسال الطلب (`feb0f6b`). |
| 2026-10-15 | D41 تحديث بطاقة الطلب الجاري في الشاشة الرئيسية لحظياً عبر أحداث WebSocket (`87ad7b3`) · D42 إصلاح تثبيت PWA لتطبيق المندوب على Chrome Android ومعالجة Manifest. |
| 2026-10-16 | D43 إتاحة ملاحظة التقييم (note) للعميل مع حجبها الصارم عن المندوب (Rule 7) · استعادة وظائف التقييم الكاملة والتعديل في Android · إدراج بطاقتي "قريباً" في الرئيسية وتنسيق الواجهة. |
| 2026-10-17 | تحديث أيقونة تطبيق Android للهوية الرسمية الجديدة (الشعار البرتقالي السريع) وإصلاح التكبير المفرط (108dp) · تنظيف وحذف كافة الفروع القديمة على GitHub (الريموت لا يحوي سوى master). |
| 2026-10-17 | `a71e421` — تنظيف ديون تقنية Batch 1: حذف getEntriesByRunner الميتة (C-1) وإصلاح فقدان mapLoadError عند تدوير الشاشة بـ rememberSaveable مع @StringRes Int? (C-3) واكتشاف دين C-7. |
| 2026-10-18 | `998ba56` — تفعيل Sentry وتكامل تنبيهات تلغرام في الإنتاج (بند S4): ضبط `SENTRY_DSN`، إصلاح `AllExceptionsFilter` لالتقاط 500 فقط، بناء `SentryWebhookController` بحماية HMAC-SHA256 المشددة ودعم `rawBody` وتوجيه الإشعارات إلى `TelegramService`. تم التحقق الحي الكامل بوصول إشعار Sentry الرسمي فورياً إلى بوت تلغرام (@forerun_notify_bot) بنجاح (430/430 اختبار). |
| 2026-10-19 | `ccf9de6` — تدقيق وصقل النصوص العربية الشامل وتوحيد مسمى "المندوب" في كامل المنصة (D45)، دُمج في `master` عبر `git merge --no-ff` وبوابة جودة كاملة (456/456 API و 318/318 Android). |
| 2026-10-19 | دمج دفعة صقل وظائف تطبيق العميل والـ API (القرار D46): تثبيت تقييم المندوب الظاهر للعميل (5 نجوم)، إخفاء أزرار تواصل الإدارة المكررة أثناء انتظار المندوب، ترقيم المواد تسلسلياً وإخفاء كمية=1، تقييد إنشاء الطلبات لـ 3 بالساعة لكل حساب، وتوضيح إلزامية رسالة واتساب لتفعيل الحساب (465/465 API و 318/318 Android). |
| 2026-10-19 | استبدال محرك الخرائط بـ Google Maps عبر كامل المنظومة (القرار D47): اعتماد maps-compose للأندرويد، ومحمّل مخصص للويب (admin-web و runner-pwa) مع قيود Referrer وبصمة التطبيق (0$ شهرياً ضمن الخطة المجانية). تم التحقق البصري الميداني الصارم بنجاح على جهاز حقيقي بعد فحص Logcat الحي وتصحيح إعدادات Google Cloud (465/465 API و 319/319 Android). |
| 2026-10-20 | دمج تحسينات نصوص بطاقات الخدمات وتصغير أيقونة التطبيق: تحديث نصوص بطاقات البقالة والطرود ومشاوير الركاب وتوحيد نافذة التنسيق عبر واتساب، وتصغير رسم أيقونة التطبيق بنسبة 50% مع الحفاظ على الخلفية البرتقالية كاملة. دُمج في `master` عبر `git merge --no-ff` وبوابة جودة كاملة (465/465 API و 319/319 Android). |
| 2026-10-21 | ربط `faow.run` و `admin.faow.run` و `runner.faow.run` بمشاريع Vercel الثلاثة بنجاح (سجلات DNS على Hostinger + شهادات SSL نشطة) — الحالة: **منشورة، بانتظار تفعيل CORS**. تأجيل ربط `api.faow.run` بسبب عطل منصة Railway العالمي (October 21, 2026: توقف لوحة التحكم والـ API وتوقف الـ Builds في كل المناطق). الروابط القديمة وتطبيق Android مستمران بالعمل بنسبة 100% دون أي تأثر. |
| 2026-10-22 | إغلاق دفعة الديون التقنية الآمنة الأربعة (القرار D48) عبر 4 فروع معزولة مدموجة بـ `git merge --no-ff`: (1) حذف كود الحصص الميت D12 كلياً، (2) حسم C-7 كملغى لتكامل D47، (3) إضافة 20 اختبار وحدة لـ 6B-6 (DeviceToken + FCM)، (4) إنجاز 6B-7 بحقن PricingCacheOptions عبر @Optional() وإثبات إقلاع DI الحي بدون أخطاء. اجتياز الفحص التراكمي الشامل على master: نجاح 472/472 اختبارات API و319/319 اختبارات Android وإقلاع خادم HTTP كامل بنجاح 100%. |
| 2026-10-23 | المراجعة الأمنية والتحصين ضد ثغرات التدقيق الشامل (القرارات D49 و D50): سد ثغرة تجاوز محدد الطلبات في `UserThrottlerGuard` (SEC-AUDIT-01) مع إثبات صد هجمات التخمين 100%، ترقية `proxy-addr` إلى `>=2.0.8` (SEC-AUDIT-03) لسد CVE-2024-52798 وإثبات استخراج الـ IP حيّاً، وتوثيق تأجيل `HttpOnly Cookies` وترقية Next 15 لعدم وجود مسار استغلال فعلي ولتفادي كسر المنظومة. نجاح 474/474 اختبارات API و اجتياز فحص Build و Typecheck و Lint لكامل المونوريبو. |

---

## 10. نصائح لتسريع التشخيص مستقبلًا

1. **عند أي خطأ، ابحث في جدول Playbook أولًا** (بند 4).
2. **انسخ نص الخطأ كاملًا** — لا تلخّصه.
3. **افحص `schema.prisma` قبل أي كتابة FK.**
4. **استخدم أوامر التشخيص السريعة** (بند 4) بدلًا من الاستنتاجات.
5. **بعد كل حل، حدّث بند 4 وبند 9.**
6. **احفظ screenshots لـ Railway Variables + Vercel Settings** في `docs/screenshots/`.

---

## 11. خريطة التوثيق — أي ملف يملك أي حقيقة

> هذا القسم **يُلغي** ادّعاء «المصدر الوحيد للحقيقة» المكرر في `PROJECT_STATUS.md` و`HANDOFF.md` و`AGENTS.md`. لا يوجد ملف واحد يملك كل شيء؛ لكل نطاق مالك واحد.

| الحقيقة | الملف المالك | لا يُقرأ منه |
|---|---|---|
| الإنتاج، البنية التحتية، النشر، تشخيص الأخطاء | **[PROJECT_STATUS.md](PROJECT_STATUS.md)** (هذا الملف) | — |
| قواعد التعامل، المعايير، تدفق العمل، الأوامر | **[AGENTS.md](AGENTS.md)** | — |
| قائمة المهام القادمة فقط | **[NEXT_TASKS.md](NEXT_TASKS.md)** | — |
| معايير إنجاز سبرنتات الـ backend (DoD) | **[docs/sprints/](docs/sprints/)** | لا تُستخدم كحالة حالية |
| **Android — المواصفة** | **[docs/android/MASTER-SPEC.md](docs/android/MASTER-SPEC.md)** | — |
| **Android — السجل التفصيلي** | **[docs/android/PROGRESS.md](docs/android/PROGRESS.md)** | — |
| **Android — لحظة الحاضر** | **[docs/android/CURRENT_STATE.md](docs/android/CURRENT_STATE.md)** | — |
| **Android — المستقبل (8D–10)** | **[docs/android/ROADMAP.md](docs/android/ROADMAP.md)** | — |
| تاريخ التغييرات | **[CHANGELOG.md](CHANGELOG.md)** | — |
| **القرارات المُحسومة (لماذا، متى، مَن)** | **[§12 سجل القرارات](PROJECT_STATUS.md#12-سجل-القرارات)** — هذا الملف | — |
| خط المعطيات النشط | **[docs/0X-*.md](docs/)** (تشخيص) | لا تعارض مع هذا الملف؛ هذا يلخّص |

### قاعدة منع التصادم في الترقيم
- سبرنتات الـ **backend** تُرقَّم `Sprint 1..6` في [docs/sprints/](docs/sprints/).
- سبرنتات **Android** تُرقَّم `8A..10` بشكل مستقل في [docs/android/ROADMAP.md](docs/android/ROADMAP.md).
- **لا تخلط بين الترقيمين.** «Sprint 8» في هذا المستودع يعني Android دائمًا.

---

## 12. سجل القرارات

> كل قرار مُحسوم يُسجَّل هنا بمَن قرّره ومتى ولماذا. **القرار يُلغي ما قبله** — لا تُعد كتابة «غير محسوم» بعد تسجيله.
> النمط مأخوذ من `docs/android/PROGRESS.md` (Decisions Log) — وهو **مصدر قرارات المشروع كلّه**، لا الجذر وحده.

| # | القرار | الحالة | التاريخ | الأثر |
|---|---|---|---|---|
| D1 | **Sprint 6 = للـ backend فقط.** بنود QA/الإطلاق الخاصة بـ Android مُفوَّضة إلى `docs/android/ROADMAP.md` Sprint 10 | ✅ مُطبَّق | 2026-09-30 | سطر تفويض في [Sprint 6 Brief](docs/sprints/Sprint%206%20Brief.md) |
| D2 | **سياسة الدمج:** فرع لكل سبرنت ثم `git merge --no-ff` إلى `master` (لا fast-forward) | ✅ مُطبَّق | 2026-09-30 | `AGENTS.md` (موضعان) · `HANDOFF.md` (موضعان) · `PROJECT_BRIEF.md` · `docs/android/MASTER-SPEC.md` §22 |
| D3 | **R2: «يحتاج تحقّق» — لا قيمة ولا وهم.** Railway هي المرجع الوحيد | 🔄 **مُلغى ومُستبدَل بـ D5** | 2026-09-30 | لم تعد الحالة ⏔ معلّقة؛ صارت قرار تأجيل |
| D4 | **بند Node في §5 كان مُسجَّل خطأً كمكتمل.** `Dockerfile:1` (`node:20-slim`) هو مصدر الحقيقة للبناء — لا يوجد `railway.toml` في المستودع فيكتشف Railway الـ Dockerfile تلقائيًا | ✅ مُطبَّق | 2026-09-30 | §5 بند 6 = ❌ غير مُنجَز بدل «✅ مكتملة» |
| **D5** | **تأجيل ميزة رفع الإيصالات (R2) إلى ما بعد MVP** | ✅ **قرار المستخدم — ساري** | **2026-09-30** | أدناه |
| **D6** | **مفتاح توقيع Android موجود ويعمل — لا يُولَّد** | ✅ **متحقَّق 2026-10-01** | **2026-10-01** | أدناه |
| **D7** | **إشعارات Telegram للإدارة عبر البوت** | ✅ **مُطبَّق 2026-10-01** | **2026-10-01** | أدناه |
| **D8** | **إشعارات هواتف العملاء عبر Firebase FCM (Sprint 8F)** | ✅ **مُطبَّق 2026-10-01** | **2026-10-01** | أدناه |
| **D11** | **التسعير الديناميكي = جدول `PlatformPricing` + `customFee` + معاينة رسوم على الخادم + لقطة الطلب هي مصدر الحقيقة.** | ✅ **معتمد، قرار المالك** | **2026-10-05** | Sprint 6A/6B |
| **D12** | **نسب الأرباح 75/25 خارج النطاق ولا تُجعل قابلة للتعديل. لاحقًا: ثابت واحد `RUNNER_SHARE_BP = 7500` يقرؤه Ledger وSettlement، و`platformShare = total − runnerShare`.** | ✅ **مؤكَّد من المالك** | **2026-10-05** | تثبيت النسبة وحماية Ledger |
| **D13** | **لا موافقة من الزبون عند زيادة الرسم (إشعار + سبب ظاهر فقط).** | ✅ **معتمد، قرار المالك** | **2026-10-05** | Sprint 6A/6B |
| **D14** | **سقف `customFee` = 500 ل.س كثابت في `shared-constants`، لكن يبقى `MAX_CUSTOM_FEE = 0` في 6A كحارس إنتاج.** | ✅ **معتمد، قرار المالك** (السقف 500 مؤقت، الحارس 0 في 6A) | **2026-10-05** | حارس إنتاج لـ 6A |
| **D15** | **سبرنتان: 6A (backend + أسطح الأدمن) و6B (أسطح الزبون والمندوب وAndroid).** | ✅ **معتمد، قرار المالك** | **2026-10-05** | خطة سبرنتات التسعير |
| **D16** | **`extraStoreFee` بلا لقطة على الطلب (الخيار ج): تغيير معدل المتجر الإضافي يسري على المتاجر المشتراة بعد التغيير؛ يُنصح بتغيير الأسعار حين لا توجد طلبات IN_PROGRESS؛ يُعرض هذا التنبيه في شاشة الأسعار. الخيار (أ) عمود لقطة مؤجل.** | ✅ **معتمد، قرار المالك** | **2026-10-05** | حسم تصميم 6A-3.2 |
| **D17** | **مرجع حساب التسوية = لكل طلب (floor لكل طلب) ليطابق الـ Ledger.** | ✅ **معتمد، قرار المالك** | **2026-10-05** | توحيد 6A-3.3 وحل B1 |
| **D18** | **الحد الأدنى لـ `baseFee` في إعدادات المنصة لا يقل عن 1 ل.س (`min: 1`).** | ✅ **معتمد، قرار المالك** | **2026-10-05** | ضبط `PRICING_LIMITS` ومخطط `UpdatePlatformPricingSchema` لمنع الرسوم الصفرية أو السالبة |
| **D19** | **تأجيل حذف `@default(60)` من `baseFee` و`totalFee` في `schema.prisma` إلى migration مستقل لاحق.** | ✅ **معتمد، قرار المالك** | **2026-10-05** | فصل تنظيف Defaults عن إضافة أعمدة customFee لتقليل المخاطر |
| **D20** | **تنبيه الأدمن عند تعديل الأسعار: «تغيير الأسعار يؤثر على رسوم المتاجر الإضافية في الطلبات الجارية (extraStoreFee)؛ يُنصح بعدم التعديل حين توجد طلبات IN_PROGRESS». يُعرض في الواجهة فقط، لا قيد (constraint) في الـ backend.** | ✅ **معتمد، قرار المالك** | **2026-10-05** | حسم 6A-8 وD16 لسلامة الطلبات الجارية في أسطح الأدمن |
| **D21** | **أولوية مصادر الرسوم عند `approveOrder`:** `baseFee` = لقطة الطلب `dto.baseFee ?? order.baseFee`، بينما `peripheralFee` و`extraStoresFee` من الإعدادات الحالية في `PlatformPricing`. | ✅ **معتمد، قرار المالك** | **2026-10-05** | متسق مع D11 (اللقطات مستقبلاً فقط) وD16 (`extraStoresFee` بلا لقطة) — حسم 6A-3.1b |
| **D22** | **`createOrder` يقرأ الأسعار داخل الـ transaction** عبر `getPricingConfig(tx)` (لا عبر الكاش). | ✅ **معتمد، قرار المالك** | **2026-10-05** | يضمن تطابق لقطة الرسوم مع صف الإعدادات لحظة إيداع الطلب، وبنفس سلوك `approveOrder` |
| **D23** | **`previewFee` يقرأ الأسعار عبر الكاش** (`getPricingConfig()` بلا tx) — كاش 30 ثانية يُفرَّغ عند كل `PUT /admin/pricing`. | ✅ **معتمد، قرار المالك** | **2026-10-05** | حماية من ضغط القراءة على نقطة المعاينة؛ **خطر معروف:** في نشر متعدد النسخ قد تعرض المعاينة سعرًا سابقًا للحظة حتى 30 ثانية — Mitigation: تفريغ الكاش بعد كل تحديث |
| **D25** | **Ledger يبقى بقيد `ORDER_FEE_TOTAL` فقط عند التسليم. `RUNNER_SHARE` و`PLATFORM_SHARE` لا تُكتب بعد الآن (البيانات القديمة تبقى).** | ✅ **معتمد، قرار المالك** | **2026-10-06** | إلغاء قيود الحصص عند التسليم وحصر الـ Ledger بقيد إجمالي الرسم |
| **D26** | **توحيد Settlement وSettlementItem إلى `totalFees`: `runnerShare = 0` و `platformShare = totalFees` (أو `order.totalFee`). لا خلاف بين الرأس والبنود.** | ✅ **معتمد، قرار المالك** | **2026-10-06** | توحيد رأس التسوية مع بنودها بنسبة 100% للمنصة و0 للمندوب |
| **D27** | **المندوب يرى `totalFee` كاملًا في التطبيق (المندوب موظف براتب ثابت، لا نسبة).** | ✅ **معتمد، قرار المالك** | **2026-10-06** | واجهات المندوب تعرض إجمالي الرسم |
| **D28** | **توزيع الحصص `splitShares` و`RUNNER_SHARE` و`PLATFORM_SHARE` تُهمَّش (`@deprecated`).** | ✅ **معتمد، قرار المالك** | **2026-10-06** | إيقاف استدعاء `splitShares` في الإنتاج وتهميش ثوابت النسب |
| **D29** | **شرائح الشاشة الرئيسية (Banners): المرحلة الحالية صور بروابط https يُدخلها الأدمن يدويًا، دون أي تفعيل لـ R2. الرفع المباشر وأسطح استهلاك العميل (Android/customer-web) لا يحملان رقم سبرنت بعد ويُسمّيان وصفيًا عند التنفيذ (مثال: banners-r2-upload، banners-client-ui) تفاديًا لتضارب الترقيم مع سبرنتات Android (8A–10).** | ✅ **مُطبَّق ومدموج في master** | **2026-10-07** | `Banner` model + migration `20261007010000_add_banners`. D5 يبقى ساريًا بلا تغيير — لا R2 في هذا النطاق. |
| **D30** | **تطوير أسطح العميل الجديدة يقتصر على تطبيق Android حصرًا، كسياسة عامة وليست خاصة بالشرائح فقط. `customer-web` يبقى في الإنتاج كما هو دون أي تطوير ميزات جديدة عليه مستقبلًا (قرار المالك، 2026-10-07). تطبيقًا لهذا القرار: استهلاك الشرائح نُفِّذ في Android فقط ضمن فرع `feature/banners-client-android`.** | ✅ **معتمد، قرار المالك** | **2026-10-07** | يشمل كل العمل المستقبلي على أسطح العميل، لا الشرائح حصرًا. |
| **D31** | **المراجعة الأمنية والمالية الشاملة وإصلاحات آلة الحالة والتسويات (UserStateMachine + previousStatus + closeDay deliveredAt + منع IDOR).** | ✅ **مُطبَّق ومدموج في master** | **2026-10-12** | معالجة 3 ثغرات حرجة عبر migration نظيف و 33 اختبار تكاملي بنسبة 100%. |
| **D32** | **إغلاق المراجعة الشاملة واعتماد التحقق المستقل من الصفر (Zero-Trust Validation) وعزل PoCs التاريخية والدمج في master.** | ✅ **مُعتمد ومدموج في master** | **2026-10-13** | خضع الكود لتحقق مستقل من الصفر أثبت صحة الكود بنسبة 100%، دُمج الفرع في master، عُزلت PoCs في `historical-poc/`، والهجرة بانتظار تشغيل المالك في Railway. |
| **D33** | **اعتماد نمط تجريد الحقول غير المعروفة (Zod Unknown Key Stripping) بدلاً من الرفض الصارم (Strict Mode).** | ✅ **معتمد، قرار معماري** | **2026-10-13** | `ZodValidationPipe` يمرر `result.data` المجرَّد تلقائياً من أي حقول زائدة، مما يمنع Mass Assignment بصورة تامة مع الحفاظ على مرونة التوافق الأمامي للتطبيقات. |
| **D34** | **التحقق المباشر من هجرة previousStatus (الهجرة الثامنة) على قاعدة إنتاج Railway وسلامة البيانات.** | ✅ **مُتحقَّق حيّاً في الإنتاج** | **2026-10-13** | نجاح 8 هجرات، 15 مستخدماً دون فقدان بيانات |
| **D35** | **فرض قيد دورة الحياة على بيانات تواصل المندوب الشخصية لمنع التسريب وحماية خصوصية الكباتن.** | ✅ **مُطبَّق ومدموج في master** | **2026-10-13** | حجب الأرقام خارج الحالات النشطة + اختبارات خصوصية مخصصة |
| **D36** | **حوكمة الفروع غير المدموجة ومنع الانحدار البصري الصامت (توثيق الفروع العالقة في NEXT_TASKS.md).** | ✅ **معتمد، قاعدة تشغيلية** | **2026-10-13** | تسجيل فروع العمل المفتوحة لمنع الانفصال |
| **D37** | **التراجع عن محاولة دمج إعادة التصميم الأولى الفاشلة وأرشفتها في فرع إنقاذ وتثبيت نقطة الأساس.** | ✅ **مُنجَز** | **2026-10-13** | حفظ المحاولة والتراجع الصارم إلى نقطة الاستقرار 6039ce4 |
| **D38** | **اكتمال توحيد ودمج إعادة التصميم البصري مع كافة إصلاحات D35 والتواصل وRTL في master بنجاح.** | ✅ **مُنجَز ومدموج في master** | **2026-10-14** | دمج نظيف بعد بناء ذري مرحلي، اجتياز الاختبارات 100%، وتأكيد المالك بصرياً |
| **D39** | **إلغاء الطلب الإجباري من الإدارة في كافة الحالات النشطة وتحرير المندوب.** | ✅ **مُطبَّق ومدموج في master** | **2026-10-14** | تحرير المندوب وتسجيل AuditLog مع حماية التنافس واختبارات تكامل شاملة (cb661a4) |
| **D40** | **نافذة تنويه المصاريف وسياسة الإلغاء قبل تأكيد الطلب في Android حصراً.** | ✅ **مُطبَّق ومدموج في master** | **2026-10-14** | نقطة نهاية ديناميكية بدون تسريب، اعتراض التدفق في Compose، وتراجع آمن للأخطاء |
| **D42** | **إصلاح فشل تثبيت PWA لتطبيق المندوب على Chrome Android.** | ✅ **مُطبَّق ومدموج في master** | **2026-10-15** | التقاط مركزي لـ beforeinstallprompt، 3 نقاط تثبيت، مهلة 15 ثانية ورسالة بديلة، وتصحيح Manifest |
| **D43** | **إتاحة ملاحظة التقييم (note) للعميل صاحب التقييم والإدارة مع حجبها الصارم عن المندوب (Rule 7 Least Privilege).** | ✅ **مُطبَّق ومدموج في master** | **2026-10-16** | إظهار note للعميل في تفاصيل الطلب واستجابة التقييم، مع إبقائها null للمندوب حمايةً لخصوصية العميل ومنع الاحتكاك |
| **D44** | **دفعة الإصلاحات الأمنية الشاملة Fix Security Batch 1 (SEC-01 → SEC-09).** | ✅ **مُطبَّق ومدموج في master** | **2026-10-18** | 7 بنود أمنية، 26 اختباراً جديداً، ونجاح 456/456 API و 318/318 Android. |
| **D45** | **تدقيق وصقل النصوص العربية الشامل وتوحيد مسمى "المندوب" عبر كامل المنصة.** | ✅ **مُطبَّق ومدموج في master** | **2026-10-19** | توحيد مسمى "المندوب" وصقل نصوص الشاشات والأسئلة الشائعة بنسبة 100%. |
| **D46** | **صقل وظائف تطبيق العميل والـ API (تقييم 5 نجوم، ترقيم المواد، تقييد 3 طلبات/ساعة بالـ User).** | ✅ **مُطبَّق ومدموج في master** | **2026-10-19** | UserThrottlerGuard بالـ userId + 9 اختبارات جديدة (465/465 API و 318/318 Android). |
| **D47** | **استبدال محرك الخرائط بـ Google Maps عبر كامل المنظومة (Android و admin-web و runner-pwa).** | ✅ **مُطبَّق ومدموج في master** | **2026-10-19** | maps-compose + Maps JS API مع تقييد المفاتيح وتحقق ميداني حي على هاتف حقيقي (465/465 API و 319/319 Android). |
| **D48** | **إغلاق دفعة الديون الآمنة الأربعة (D12 حذف الكود الميت، C-7 توصيف كملغى، 6B-6 اختبارات DeviceToken، 6B-7 استبدال *ForTesting بحقن PricingCacheOptions).** | ✅ **مُعتمد ومدموج في master** | **2026-10-22** | حذف كود الحصص الميت نهائياً + 20 اختباراً جديداً + حقن DI اختياري آمن مع fallback صريح وفحص runtime boot حي. نجاح 472/472 اختبارات API و 319/319 اختبارات Android. |
| **D49** | **إصلاح ثغرة تجاوز محدد الطلبات في المسارات العامة `UserThrottlerGuard` عبر إزالة فك JWT غير الموثوق (SEC-AUDIT-01).** | ✅ **مُطبَّق ومدموج في master** | **2026-10-23** | الاعتماد حصراً على `req.user` الموثق بـ `JwtAuthGuard`، وقصر المسارات العامة على `req.ip` الفعلي لمنع تزوير المعرّفات وتخطي الـ Brute Force. نجاح 474/474 اختبارات API. |
| **D50** | **حسم مخرجات التدقيق الأمني (SEC-AUDIT-02 و SEC-AUDIT-03): ترقية `proxy-addr` وتأجيل كوكيز الواجهات وترقية Next.js.** | ✅ **معتمد، قرار تقني** | **2026-10-23** | (1) سد ثغرة `proxy-addr` بـ `pnpm.overrides >= 2.0.8` (CVE-2024-52798) وإثبات عمل `trust proxy` حيّاً. (2) تأجيل `HttpOnly Cookies` (SEC-AUDIT-02) لعدم وجود مسار XSS وتجنب كسر 3 واجهات وAndroid. (3) تأجيل ترقية `next` (SEC-AUDIT-03) لثبوت انعدام قابلية الاستغلال في نمط استخدامنا (0% exploitability) وتفادي كسر Next 15. |

### D5 — تأجيل رفع الإيصالات (تفصيل)

**ما أُجِّل:** إعداد Cloudflare R2 وربط الـ bucket، وبالتالي **ميزة رفع الإيصالات كاملة** (presigned URL · رفع · حذف · العرض).

**لماذا:** قرار منتج — الأولوية لما بعد MVP.

**ما هو متحقّق فعلاً اليوم:**
- كود الإيصالات **موجود ويعمل** (متحقَّق بدليل في `docs/sprints/Sprint 3 Brief.md` بند «Presigned URL»).
- لكنه **غير قابل للتنفيذ في الإنتاج**: `r2.service.ts:32-34` يرمي `R2 configuration is incomplete: R2_*` ما دام `PROJECT_STATUS.md` §3.1 يعرض `<dummy-for-now>`.

**⚠️ ثلاثة آثار يجب معرفتها قبل MVP:**

1. **تسريب رسالة إعداد داخلية للمندوب.** عند فشل الرفع يعرض `ReceiptUploader.tsx:44` نص الـ backend الخام داخل رسالة عربية، فيرى المندوب **أسماء متغيّرات البنية التحتية بالإنجليزية**. يحتاج رسالة عربية بديلة عند تعطيل الميزة.
2. **Android يعرض الإيصالات للعميل (قراءة فقط).** `OrderModels.kt:89,98` · `OrderRepositoryImpl.kt:142-143` — قوائم الإيصالات ستكون **فارغة دائماً** في تطبيق العميل. ليس عطلاً، لكن تجربة غير متوقّعة.
3. **بند Sprint 3 «Presigned URL» مُعلَّم `[x]`** لأن الكود موجود — وهذا صحيح تقنياً لكنه **غير مُفعَّل تشغيلياً**. لا تقرأه كـ«الإيصالات تعمل في الإنتاج».

**متى يُراجَع:** عند بدء **`docs/android/ROADMAP.md` Sprint 9** أو أي عمل على `SettlementItem` يعتمد على الإيصالات كضمان. المطلوب عندها: (1) قراءة `R2_*` من Railway، (2) ربط `fawrun-receipts`، (3) `/rollback-plan` إن امتدّ الأمر لعمليات مالية.

### D6 — مفتاح توقيع Android (تحقّق, لا قرار)

**المتحقَّق منه آلياً:**
- `apps/android/forerun-release.jks` موجود (2,253 بايت) · `keyAlias = forerun` · كلمة مرور 13 حرفاً
- التوقيع **مربوط في البناء**: `apps/android/app/build.gradle.kts:28-57` (`signingConfig = signingConfigs.getByName("release")` عند `:57`)
- **3 APKs release مبنية وموقَّعة فعلاً** — `apksigner verify` ⇒ `Verifies` بمخطّط **v2** · عدد المُوقِّعين 1
- هوية المُوقِّع: `CN=FORERUN, OU=Development, O=FORERUN, L=Al-Qanjara, ST=Latakia, C=SY` · cert SHA-256 `725b46830d583dc72d3b80c530c94e5d21492d40cfecb0837764bb7bd9609879`

**⚠️ القاعدة الحرجة — لا يُولَّد مفتاح جديد تحت أي ظرف:**
مفتاح التوقيع **غير قابل لإعادة الإنتاج رياضياً**. توليد مفتاح جديد يجعل كل نسخة مثبّتة **عاجزة عن التحديث للأبد** (Android يشترط تطابق المفتاح). التوثيق السابق كان يصف التطبيق كـ«غير موقّع» ويحيل `production keystore` إلى المستخدم — **وكلاهما خطأ مُصحَّح**.

**نظافة الأسرار سليمة:** `*.jks` و`keystore.properties` مُتجاهَلة في `apps/android/.gitignore:14-15` و**غير مدفوعة إلى git** · يوجد `keystore.properties.example` للقالب.

**⚠️ الفجوة الوحيدة — لا نسخة احتياطية خارج هذا القرص:**
الملفان (`forerun-release.jks` + `keystore.properties` الحاوي كلمة المرور) **غير موجودين في git عمداً**. فقدانهما = فقدان هوية التطبيق نهائياً. **يجب نسخهما احتياطياً إلى مكان آمن قبل أي تسليم المشروع** — وانقل كلمة المرور عبر قناة آمنة (مدير كلمات مرور / خزنة مشفّرة)، **ولا تُوضع في Git أو محادثة**.

**تنبيه صيانة — مُنجَز (2026-10-23):** حُذفت النسخة المكررة في `apps/android/` بالكامل، وأصبح الاعتماد والملف الفعلي الوحيد محصوراً في `apps/android/app/forerun-release.jks` و `apps/android/app/keystore.properties`. تم التحقق من نجاح `:app:validateSigningRelease` بنسبة 100%.

### D7 — إشعارات Telegram للإدارة
تم تفعيل إشعارات تيليغرام المباشرة عبر البوت للإدارة في حالتين أساسيتين:
1. **طلب جديد:** بعد حفظ الطلب بنجاح في قاعدة البيانات، يُرسل إشعار يحتوي رقم الطلب، اسم العميل، أسماء المتاجر (مفردة أو متعددة)، وإجمالي المبلغ.
2. **تسجيل مستخدم جديد:** بعد إنشاء الحساب بنجاح، يُرسل إشعار باسم المستخدم ورقم الواتساب وتاريخ التسجيل بتوقيت دمشق.
- **قاعدة الأمان والتنفيذ:** الاستدعاء يتم دائماً خارج الـ database transactions، وأي خطأ شبكي يتم ابتلاعه وتسجيله في الـ Logger فقط بدون إيقاف تدفق العملية الأساسية (`best-effort`).

### D8 — إشعارات العملاء عبر Firebase FCM (Sprint 8F)
تم إكمال منظومة إشعارات Push Notifications لهواتف العملاء:
1. **الطرف العميل (Android):** تم ربط مشروع Firebase الحقيقي `forerun-c819d` عبر ملف `google-services.json`، وترقية معالجة التوكنات وعرض الإشعارات في قناة `forerun_orders_channel` مع دعم الـ Deep Link `forerun://orders/{id}`.
2. **الطرف الخادم (Backend):** إنشاء جدول `DeviceToken` وتطبيق الهجرة `20261001160600_add_device_token` في الإنتاج، وإضافة نقاط النهاية `POST/DELETE customer/me/device-token`، وربط خدمة `FcmService` بـ `NotificationsService.emitToCustomer` لإرسال إشعارات فورية بالعربية عند كل تغير لحالة الطلب.

### D16 — معدل رسم المتاجر الإضافية بلا لقطة (الخيار ج)
- **القرار:** لا يتم إنشاء عمود لقطة لـ `extraStoreFee` على جدول `Order` في المرحلة الحالية (تجنب migrations إضافية).
- **الأثر التشغيلي:** تغيير معدل المتجر الإضافي في جدول `PlatformPricing` يسري على أي متجر يُشترى بعد لحظة التغيير.
- **التوجيه الإداري والواجهات:** يُنصح بتغيير الأسعار عندما لا تكون هناك طلبات نشطة بحالة `IN_PROGRESS`، ويجب عرض تنبيه إرشادي واضح في شاشة لوحة تحكم الأدمن الخاصة بالأسعار (بند 6A-8). خيار إضافة عمود لقطة (الخيار أ) مؤجل لسبرنت لاحق.

### D17 — توحيد مرجع حساب التسويات لكل طلب (B1)
- **القرار:** مرجع حساب حصص التسوية هو **لكل طلب** بصيغة `floor` لحصة المندوب و`ceil` لحصة المنصة لكل طلب على حدة، ليطابق قيود الـ Ledger المكتوبة عند التسليم.
- **الأثر التشغيلي:** تم توحيد `getCurrentSettlement` لتقوم بجمع حصص الطلبات الفردية بدلاً من تقريب إجمالي الرسوم، مما أزال أي انحراف تقريبي (0 drift) وحقق التطابق التام مع `closeDay` ومع قيود `LedgerEntry`.

### D18 — الحد الأدنى للرسم الأساسي baseFee ≥ 1
- **القرار:** لا يجوز أن يقل `baseFee` في إعدادات المنصة عن 1 ليرة سورية.
- **الأثر:** تم فرض هذا القيد في ثوابت `PRICING_LIMITS.baseFee.min = 1` وفي مخطط Zod الخاص بتحديث الأسعار `UpdatePlatformPricingSchema`، لمنع تعيين رسوم توصيل أساسية صفرية أو سالبة عبر واجهات الأدمن.

### D19 — تأجيل حذف @default(60) من schema.prisma
- **القرار:** تأجيل إزالة `@default(60)` من عمودي `baseFee` و`totalFee` في جدول `Order` إلى migration مستقل لاحق.
- **الأثر:** تجنب دمج تعديلين مختلفين على جدول `Order` في نفس الـ migration، والتركيز في الخطوة 6A-5 على إضافة عمودي `customFee` و`customFeeReason` مع قيد عدم السالبية CHECK فقط.

### D20 — تنبيه أثر تعديل الأسعار على الطلبات الجارية
- **القرار:** إدراج بانر تحذيري إرشادي بارز في شاشة إعدادات الأسعار بلوحة تحكم الإدارة (`apps/admin-web/src/app/dashboard/pricing/page.tsx`) يوضح أن تعديل معدل رسم المتجر الإضافي يسري فورياً على أي متجر يُشترى بعد التعديل (وفقاً للقرار D16)، وينصح بتجنب التعديل في أوقات الذروة أو عند وجود طلبات بحالة `IN_PROGRESS`.
- **التنفيذ:** التنبيه إرشادي في واجهة المستخدم (UI) فقط، دون فرض قيود برمجية أو حظر تشغيلي على مستوى الـ Backend Endpoint لضمان مرونة الإدارة وسلاسة التحكم في الأسعار.
- **✅ تحقّق شرط السريان (6A-3.1b — 2026-10-05):** تم ربط `getPricingConfig` بمسارات الإنتاج الأربعة (`createOrder` · `approveOrder` · `recalculateFee` · `previewFee`)، فصار تعديل الأسعار **مؤثّرًا فعليًا** كما ينصّ التنبيه أعلاه (التفاصيل في D21/D22/D23 أدناه).

### D21–D23 — ربط `getPricingConfig` بمسارات الإنتاج (6A-3.1b)
- **D21 — أولوية المصادر عند الاعتماد:** `approveOrder` يبني `PricingConfig` من صف `PlatformPricing` الحالي **داخل نفس الـ transaction**، ثم يتجاوز `baseFee` بلقطة الطلب (`dto.baseFee ?? order.baseFee`). النتيجة: طلب أُنشئ بسعر 60 يبقى `baseFee = 60` بعد رفع الأسعار إلى 80، بينما `peripheralFee` و`extraStoresFee` يتبعان الإعدادات الجديدة. نفس القاعدة في `previewFee` (المعاينة).
- **D22 — القراءة داخل الـ transaction عند الإنشاء:** `createOrder` ينقل حساب الرسوم **داخل** `$transaction` عبر `getPricingConfig(tx)`، فيتكاثر الكاش على مستوى العملية ويُقرأ الصف لحظته. يضمن تطابق لقطة `estimatedFee` مع ما سيُكتب فعلاً.
- **D23 — الكاش في المعاينة:** `previewFee` (نقطة أدمن غير حرجة) يقرأ عبر `getPricingConfig()` بلا tx فيستفيد من كاش 30 ثانية، وتفريغ `updatePlatformPricing` يضمن رؤيته لأحدث قيمة بعد كل تعديل.
- **⚠️ خطر معروف (D23):** في نشر متعدد النسخ (أكثر من نسخة API) قد تعرض المعاينة سعرًا سابقًا للحظة لمدة تصل إلى 30 ثانية بعد التعديل، لأن تفريغ الكاش محلي لكل نسخة. **التخفيف:** `updatePlatformPricing` يفرّغ كاش العملية نفسها؛ إن لزم الأمر لاحقًا يمكن إبطاء TTL أو استخدام invalidation مشترك.
- **⚠️ سلوك الصف المفقود:** صف `PlatformPricing` غير موجود أو غير صالح ⇒ ارتداد صامت إلى `DEFAULT_PRICING_CONFIG` (60/20/40) مع `Logger.warn`/`Logger.error` — **بلا 5xx**. مُغطّى باختبار تكامل (S2 بند 5). تعديل الصف مباشرة بالـ DB يتجاوز `AuditLog`؛ المسار المعتمد والمرئي هو `PUT /admin/pricing` فقط.

### D25–D28 — إلغاء نظام الحصص واعتماد الراتب الثابت للمندوب (Phase 1)
- **الخلفية والسياق:** نموذج عمل المنصة يعتمد مندوبين برواتب شهرية ثابتة خارج التطبيق، ولا يحصل المندوب على نسبة 75% من قيمة الرسوم. لذلك تم إلغاء توزيع الحصص البرمجي في الـ MVP.
- **D25 — حصر قيود التسليم في قيد واحد:** عند تسليم الطلب (`deliverOrder`)، يتم كتابة قيد مالي وحيد في `LedgerEntry` بنوع `ORDER_FEE_TOTAL` وقيمة `totalFee`. تم إيقاف كتابة قيدي `RUNNER_SHARE` و`PLATFORM_SHARE`. القيود التاريخية تظل محفوظة في قاعدة البيانات (Append-only).
- **D26 — توحيد وتبسيط التسويات اليومية:** تسوية اليوم تعتمد مجموع رسوم الطلبات المسلمة (`totalFees = sum(order.totalFee)`). لضمان التطابق التام وتجنب أي تعارض بين رأس التسوية وبنودها ودون المساس بـ schema:
  - سجل `Settlement` يكتب `totalFees` مع `runnerShare = 0` و`platformShare = totalFees`.
  - سجل `SettlementItem` يكتب `runnerShare = 0` و`platformShare = order.totalFee`.
  - هذا التوحيد يضمن التطابق الرياضي الصارم: مجموع `platformShare` في البنود يطابق تماماً `platformShare` في رأس التسوية (100% للمنصة إحصائياً، والمندوب يحاسب براتب ثابت خارج النظام).
  - استعلام `getCurrentSettlement` يرجع `totalFees` مع `estimatedRunnerShare: 0` و`estimatedPlatformShare: totalFees`.
  - **ملاحظة UI:** بطاقة لوحة الأدمن تحوّلت من `platformShare` إلى `totalFees` — الرقم سيظهر ~4× أكبر، وهذا صحيح دلاليًا بعد D26.
  - **ملاحظة Schema:** عمودا `runnerShare` و `platformShare` موجودان فعليًا في جدولي `Settlement` و `SettlementItem` في `schema.prisma` وقاعدة البيانات منذ الهجرة التأسيسية (`20260911172902_init`)؛ وتعبئتهما بهذه القيم الثابتة (`0` للمندوب و `order.totalFee` للمنصة) مقصودة للحفاظ على التوافق دون أي migrations في الـ MVP (مُدرج كدين تقني C-2 في NEXT_TASKS.md).
- **D27 — عرض الرسوم للمندوب:** المندوب يرى إجمالي الرسم `totalFee` في التطبيق دون تفكيك لحصص غير مستحقة.
- **D28 — تهميش دوال وثوابت الحصص:** وضع علامة `@deprecated` على ثوابت `RUNNER_SHARE` و`PLATFORM_SHARE` ودالة `splitShares`، وإيقاف استدعائها في مسارات الإنتاج بالكامل.
- **سياسة التراجع وسلامة البيانات:** لا يوجد أي تغيير في `schema.prisma` ولا أي migration جديد. التراجع يتم عبر `git revert` بصورة فورية وآمنة دون مساس بسلامة البيانات.

### D29 — شرائح الشاشة الرئيسية على مرحلتين (Sprint 7A)
- **القرار:** تنفيذ شرائح الشاشة الرئيسية على مرحلتين بأسماء وصفية: 7A تشمل Backend + Admin للشرائح بروابط https يُدخلها الأدمن دون تفعيل R2. الرفع المباشر (`banners-r2-upload`) وأسطح العميل (`banners-client-ui`) يُسمّيان وصفيًا ولا يحملان رقمًا بعد لتفادي الالتباس مع ترقيم Android المستقل (8A–10).
- **الأثر التشغيلي:** D5 يبقى ساريًا (لا إعداد Cloudflare ولا `R2_*` في هذا السبرنت). حقل `imageUrl` ثابت في المرحلتين لضمان عدم كسر التوافق مستقبلاً.

### D30 — حصر تطوير أسطح العميل المستقبلية في تطبيق Android وتجميد customer-web
- **القرار:** تطوير أسطح العميل الجديدة يقتصر على تطبيق Android حصرًا، كسياسة عامة للمشروع وليست خاصة بالشرائح فقط. تطبيق الويب للزبون (`customer-web`) يبقى في الإنتاج كما هو دون أي تطوير ميزات جديدة عليه مستقبلاً (قرار المالك، 2026-10-07). تطبيقًا لهذا القرار: استهلاك الشرائح نُفِّذ في Android فقط ضمن فرع `feature/banners-client-android`.
- **الأثر التشغيلي:** تركيز كافة جهود تطوير تجربة العميل على تطبيق الهاتف (Android)، وتجميد `customer-web` بحيث لا يُلمس ولا تُضاف إليه أي ميزات جديدة مستقبلاً.

### D31 — المراجعة الأمنية والمالية الشاملة وإصلاحات آلة الحالة والتسويات (2026-10-12)
- **الخلفية والسياق:** عقب مراجعة تدقيقية صارمة متعددة المراحل (المراحل 1 إلى 4) لسلامة النواة البرمجية والمالية والأمنية، تم كشف ومعالجة 3 ثغرات معمارية حرجة وربطها باختبارات تكامل فعلية غير قابلة للتزوير:
  1. **إلغاء تزوير الاختبارات وفرض آلة حالة المستخدمين (`UserStateMachine`):**
     - تم كشف اختبار معطوب/مزوّر في `users.service.spec.ts` كان يتجاوز التحقق بحقن مستخدم وهمي (`role: USER`) وتمرير حالة غير شرعية.
     - تم إنشاء آلة حالة صارمة للمستخدم (`UserStateMachine`) مطابقة للقواعد المعمارية (Rule 2).
     - تم إضافة عمود `previousStatus` إلى جدول `User` في قاعدة البيانات عبر migration نظيف (`20261012230000_add_user_previous_status`) لضمان أن إعادة تفعيل الحساب المعلق (`unsuspend`) تعيد المستخدم حصراً إلى حالته السابقة الشرعية (`PENDING` أو `VERIFIED`) وتمنع ترقية الحساب المرفوض `REJECTED` إلى نشط.
     - تم فرض قفل تفاؤلي عبر الشرط الذري (`where: { id, status: UserStatus.SUSPENDED }`) لمنع أي تضارب أو تسابق في العمليات المتزامنة (`CONCURRENT_USER_STATE_CHANGE`).
  2. **تحصين التسويات اليومية المالية (`closeDay`):**
     - تم تصحيح نافذة تجميع الطلبات لتعتمد على لحظة التسليم الفعلي (`deliveredAt`) المحسوبة بتوقيت دمشق بدلاً من لحظة إنشاء الطلب (`createdAt`).
     - معالجة وترحيل الطلبات المسلّمة في أيام سابقة ولم تُسوَّ عبر شرط `settlementItem: null` و`deliveredAt: { lte: end }`.
     - فرض منع التكرار (Idempotency Guard) برمياً استثناء تعارض `409 ConflictException` عند محاولة إعادة إغلاق يوم مغلق مسبقاً لمنع التكرار المالي العرضي.
  3. **التحقق التجريبي ضد ثغرات IDOR:**
     - تم اختبار كافة نقاط النهاية المعزولة الـ 16 تجريبياً بين مستخدمين مختلفين عبر `audit-idor-endpoints.integration.spec.ts`، مع إثبات منع التسريب وعودة `404 Not Found` بنسبة 100%.
  4. **إثبات دورة الحياة والتزامن الكامل (Zero Drift E2E):**
     - تنفيذ اختبار دورة حياة الطلب المتكاملة من الإنشاء وحتى التسوية وإغلاق اليوم، مع إثبات تطابق الأرقام بدقة تامة وبلا أي انحراف مالي (Zero Drift).
     - اختبار إجهاد متزامن لـ `closeDay` أثبت نجاح أول استدعاء ورفض الاستدعاء المكرر المتزامن بـ 409 Conflict بنجاح.

### D32 — اعتماد التحقق المستقل من الصفر (Zero-Trust Validation) وإغلاق المراجعة والدمج في Master (2026-10-13)
- **الخلفية والسياق:** عقب إتمام المراحل 1–4 من التدقيق الأمني والمعماري، تم إجراء جلسة تدقيق وتحقق مستقلة كاملة من الصفر (منهجية انعدام الثقة Zero-Trust وبلا أي اعتماد على ادعاءات أو سجلات سابقة) في 2026-10-13.
- **النتائج المؤكدة بالتشغيل الحي:**
  1. **التحقق من الكود المصدري:** إثبات وجود وعمل `UserStateMachine`، تحصين مسارات `suspend`/`unsuspend` من ترقية الحسابات المرفوضة، فرض قفل التسابق الذري، وتصحيح `users.service.spec.ts`.
  2. **التحقق المالي المستقل:** إثبات احتساب الطلبات المسلمة وفق `deliveredAt`، ترحيل الطلبات المتأخرة، ورفض إعادة إغلاق اليوم المغلق بـ `409 ConflictException`.
  3. **عزل ملفات الـ PoC التاريخية:** نقل ملفي إثبات الثغرات التاريخيين (`audit-items-5-7-28-user-state-escalation` و `audit-items-12-13-close-day`) إلى المجلد الفرعي `apps/api/test/integration/_audit/historical-poc/` واستبعادهما من مسار الاختبارات التلقائي لمنع فشل الـ CI، مع توثيق أن فشلهما متوقع ومطلوب كدليل سلبي (Negative Proof).
  4. **الدمج في master وإعادة الاختبار:** تم دمج الفرع `feature/audit-remediation-phase4` بنجاح في `master` عبر `git merge --no-ff`. وأُعيد تشغيل السلسلة الكاملة على `master` محققة:
     - `pnpm build`: نجاح بناء 6/6 حزم.
     - `pnpm typecheck`: نجاح فحص الأنواع لـ 6/6 حزم.
     - `pnpm lint`: نجاح الفحص بـ 0 أخطاء و 0 تحذيرات عبر الـ Monorepo بالكامل.
     - `pnpm --filter forerun-api test`: نجاح 398 اختبار وحدة عبر 26 ملف اختبار (100%).
     - `_audit` integration tests: نجاح 33 اختباراً عبر 6 ملفات اختبارات علاجية (100%).
- **إجراء قاعدة البيانات المنتظر:** قاعدة بيانات الإنتاج على Railway تحتفظ بـ 7 migrations سارية، وتنتظر تشغيل `prisma migrate deploy` يدوياً من قِبل المالك لتطبيق الهجرة الثامنة (`20261012230000_add_user_previous_status`) مع أخذ نسخة احتياطية مسبقة.
### D33 — اعتماد نمط تجريد الحقول غير المعروفة (Zod Unknown Key Stripping) بدلاً من الرفض الصارم (2026-10-13)
- **الخلفية والسياق:** أظهر فحص الأمان في `audit-security-scans.integration.spec.ts` أن الـ endpoints تقبل طلبات تحوي حقولاً غير معروفة في الـ JSON body وتمررها بـ `200 OK` بدلاً من رفضها بـ `400 Bad Request`، مما قد يوحي ظاهرياً بمخالفة قاعدة "Zod validation on every input".
- **التحليل الفني المعماري:**
  1. **آلية عمل ZodValidationPipe:** الـ Pipe العام ينفّذ `const result = this.schema.safeParse(value)` ويُعيد للمتحكم `result.data`. السلوك الافتراضي لـ Zod في `z.object` هو `strip`، وبالتالي فإن `result.data` **مجرَّد تماماً ونظيف من أي حقول مجهولة** قبل أن يصل للدوال البرمجية.
  2. **مناعة Mass Assignment بالبناء (By Design):** كافة طبقات الخدمات (Services) في المشروع تقوم بربط الحقول مع Prisma بصورة صريحة (`field: dto.field`) ولا يوجد أي استدعاء من نمط `tx.order.create({ data: { ...dto } })`. الحقول الزائدة لا تصل للكود ولا تُكتب في DB إطلاقاً.
  3. **عزل الحقول الحساسة:** حقول الصلاحيات والهوية (`userId`, `adminId`, `runnerId`, `role`) تُستخرج حصراً من الـ JWT Guard عبر `@CurrentUser()` ولا تُقبل أو تُقرأ من body أي طلب.
  4. **مبرر اعتماد Strip بدلاً من Strict:**
     - الحفاظ على مبدأ المرونة والتوافق الأمامي (Forward Compatibility / Robustness Principle): يتيح لتطبيقات العملاء (مثل تطبيق Android) إرسال حقول اختيارية جديدة أو ميتاداتا دون كسر التوافق مع الخادم قبل ترقيته.
     - تجنب الهشاشة البرمجية (Brittleness) الناتجة عن رفض الحقول العرضية غير الضارة مع ضمان عزلها وتطهيرها التام عبر `result.data`.
### D34 — توثيق نشر الهجرة الثامنة والتحقق المستقل الحي من قاعدة بيانات الإنتاج (2026-10-13)
- **الخلفية والسياق:** لتفعيل حماية آلة الحالة `UserStateMachine` في بيئة الإنتاج على Railway، تطلّب الأمر تطبيق الهجرة الثامنة `20261012230000_add_user_previous_status`.
- **التنفيذ التشغيلي:**
  - نُفّذ الأمر يدوياً من قِبل المالك/المشغّل عبر طرفية حاوية الـ API على Railway (`cd /app/apps/api && ./node_modules/.bin/prisma migrate deploy`).
  - وقت التطبيق الفعلي في قاعدة الإنتاج: `2026-10-13T09:36:43.480Z`.
- **الدليل المستقل الحي من قاعدة الإنتاج (Direct Raw DB Query):**
  تم استعلام قاعدة بيانات الإنتاج مباشرة عبر استعلامات SQL مستقلة من داخل الحاوية، وجاءت النتائج الخام كالآتي:
  1. **التحقق من العمود في `information_schema.columns`:**
     - الجدول: `User` · العمود: `previousStatus` · نوع البيانات: `USER-DEFINED` (`UserStatus`) · القابلية للإلغاء: `YES` (مقبول Null للحسابات غير المعلقة).
  2. **التحقق من سجل الهجرات `_prisma_migrations`:**
     - الهجرة: `20261012230000_add_user_previous_status`
     - تاريخ الإنجاز: `2026-10-13T09:36:43.480Z`
     - حالة التراجع: `rolled_back_at: null` (سارية وناجحة بالكامل).
     - إجمالي الهجرات السارية: **8 migrations** مطابقة 100% مع الكود.
  3. **التحقق من سلامة البيانات (Data Integrity):**
     - تم فحص عدد مستخدمي جدول `User`: النتيجة **15 مستخدماً** (تطابق تام، صفر فقدان للبيانات).
- **سياق النسخة الاحتياطية (Pre-Launch Context):** قاعدة بيانات الإنتاج على Railway في هذه المرحلة من المشروع لا تحتوي على بيانات مستخدمين حقيقيين (بيئة ما قبل الإطلاق التجاري)، ولذلك لم تُؤخذ نسخة احتياطية مسبقة قبل تنفيذ الهجرة، وهو أمر مقبول تشغيلياً في هذه المرحلة تحديداً.
- ⚠️ **تحذير إلزامي للإنتاج التجاري والوكلاء المستقبليين:** بمجرد وجود أول مستخدم أو طلب حقيقي في قاعدة الإنتاج، يصبح أخذ نسخة احتياطية مسبقة قبل أي `prisma migrate deploy` إلزامياً بلا استثناء، ويجب على أي وكيل مستقبلي التحقق أولاً من هذا الوضع (هل توجد بيانات حقيقية؟) قبل تنفيذ أي هجرة على Railway مباشرة دون سؤال المالك.

### D35 — فرض قيد دورة الحياة على بيانات تواصل المندوب الشخصية (2026-10-13)
- **الخلفية وسياق الاكتشاف:** أثناء التقييم المعماري المسبق لاقتراح واجهة مستخدم (UI/UX) في تطبيق Android لإضافة أزرار تواصل مع المندوب، كشف الفحص العميق لكود الـ Backend أن نقطتي النهاية `GET /customer/orders/:id` و `GET /customer/orders` كانتا تُعيدان رقم هاتف وواتساب المندوب الشخصي في كائن `runner` لأي عميل يملك طلباً سبق إسناده للمندوب، **دون أي قيد زمني أو شرط على حالة الطلب**. هذا يعني أن العميل كان يحتفظ بوصول دائم لرقم المندوب الشخصي حتى بعد تسليم الطلب (`DELIVERED`) أو إلغائه (`CANCELLED`) بأسابيع.
- **التصنيف:** عطل أمني حرج يمس خصوصية بيانات الموظفين/المندوبين وتسريب بياناتهم الشخصية عبر الـ DTO العام (Over-exposure / Data Leak).
- **الإصلاح المطبَّق (Status Lifecycle Guard):**
  - في `apps/api/src/modules/orders/services/customer-orders.service.ts`:
    - تعريف مجموعة الحالات النشطة المشروعة: `ACTIVE_RUNNER_CONTACT_STATUSES = new Set(['ASSIGNED', 'IN_PROGRESS', 'OUT_FOR_DELIVERY'])`.
    - في كلا المسارين (`getOrderDetails` و `listCustomerOrders`): حصر إرجاع `whatsapp` و `phone` في الحالات النشطة فقط، وإرجاع `null` حكماً في كافة الحالات الأخرى (كالطلبات المسلمة أو الملغاة).
    - الإبقاء على بيانات الهوية العامة للمندوب (`id`, `name`, `avgRating`, `totalRatings`) لتمكين العميل من تقييم الطلب ومراجعة سجل التوصيل دون انتهاك خصوصية أرقام التواصل.
  - في `packages/shared-types/src/customer.types.ts`: تحديث `CustomerOrderListItem.runner.whatsapp` ليكون `string | null` توافقياً.
  - في `apps/customer-web/src/pages/HomeScreen.tsx`: معالجة دفاعية بحتة لـ `null` (`runner.whatsapp && ...`) لتفادي كسر فحص الأنواع وبناء الـ Monorepo (`pnpm build`) ومنع توليد روابط تالفة، دون أي تعديل وظيفي أو ميزة جديدة على تطبيق الويب المجمّد إنتاجياً وفق D30.
- **التحقق والاختبار (6/6 Tests):**
  - إنشاء حزمة اختبار تكامل مخصصة `apps/api/test/integration/orders/runner-contact-privacy.integration.spec.ts` أثبتت عملياً:
    1. ظهور أرقام المندوب في الحالات النشطة الثلاث (`ASSIGNED`, `IN_PROGRESS`, `OUT_FOR_DELIVERY`).
    2. حجب الأرقام فوراً (`whatsapp: null, phone: null`) في حالة `DELIVERED`.
    3. حجب الأرقام فوراً (`null`) في حالة `CANCELLED`.
    4. منع الـ IDOR بنسبة 100%: محاولة أي عميل آخر قراءة الطلب تُرد بـ `404 Not Found`.
- **التحقق من بيانات الإنتاج الحالية:**
  - تم استعلام قاعدة البيانات للتأكد من هوية المستخدمين: جميع المستخدمين والطلبات المسجلة حالياً هم حسابات تجريبية (Synthetic Mock Accounts) لمرحلة ما قبل الإطلاق التجاري (Pre-Launch). لا توجد أرقام مندوبين حقيقيين أو عملاء حقيقيين تعرضت للتسريب.
- **الدرس المستفاد للمراجعات المستقبلية (Core Architecture Invariant):**
  - المراجعات الأمنية التقليدية والسابقة (المراحل 1 إلى 4) ركزت على آلة الحالة، المعاملات المالية، وحواجز الصلاحيات والـ IDOR، ولم تفحص التسريب الداخلي في حقول الـ DTOs التي تعمل "بشكل وظيفي سليم".
  - **قاعدة دائمة:** أي DTO يُعاد للعميل يجب إخضاعه لتدقيق ثنائي إلزامي:
    1. هل كل حقل يُعاد ضروري للعميل في هذا السياق؟ (Principle of Least Privilege Data Exposure).
    2. هل يرتبط الحقل بدورة حياة زمنية/حالة محددة تتطلب حجبه (Masking) عند انتهائها؟
- **الدرس المعماري الإضافي — مخاطر التغييرات العابرة للخدمات (Cross-Service Breaking Change Risk):**
  - **سياق الحادثة:** عند تطبيق حجب D35 على الـ Backend، تحول حقلا `whatsapp` و `phone` في الـ DTO من قيم نصية دائمة إلى `null` خارج الحالات النشطة. في تطبيقات الويب، قد يمر الـ `null` دون توقف كامل، لكن في تطبيق **Android** المبني بـ Kotlin و Moshi الصارمة، كانت نماذج الـ DTO والـ Domain تفترض أن الحقل غير فارغ حتماً (`val whatsapp: String`).
  - **الأثر المحتمل:** عند استلام `null` من الخادم لأي طلب بحالة `DELIVERED` أو `CANCELLED`، كانت مكتبة Moshi ستُطلق استثناء فورياً `com.squareup.moshi.JsonDataException: Non-null value 'whatsapp' was null` مما يسبب انهياراً شاملاً (Fatal Crash) للتطبيق عند فتح تفاصيل الطلب.
  - **سياق مرحلة ما قبل الإطلاق (Pre-Launch Context):** هذا الخطر كان نظرياً وكامناً في الكود ولم يتحول إلى حادثة تشغيلية فعلية على هواتف المستخدمين، لأن المشروع لا يزال في مرحلة تجريب داخلي بحت (Pre-Launch) ولم تُوزَّع أي نسخة APK لأي مختبر خارجي أو زبون حقيقي حتى تاريخه (أكده المالك في 2026-10-13). لذا تم إصلاح نماذج Kotlin في كود Android قبل صدور وتوزيع أول نسخة APK حقيقية.
  - ⚠️ **تحذير إلزامي للإنتاج والوكلاء المستقبليين:** بمجرد توزيع أول نسخة APK لأي مختبر خارجي أو زبون حقيقي، يصبح التحقق والتحديث المتزامن لـ nullability بين الـ Backend وتطبيق Android إلزامياً مسبقاً وبلا استثناء قبل أي نشر مستقبلي على الـ Backend يُعدِّل عقد DTO.
  - **القاعدة العامة الملزمة (API Contract Breaking Change Invariant):**
    1. أي تعديل على عقد DTO يحوّل حقلاً من `non-null` إلى `nullable` (حتى لو كان إصلاحاً أمنياً عاجلاً ومبرَّراً 100%) يُعد **Breaking Change عابر للخدمات** يستوجب معاملة استثنائية.
    2. يُلزم الفحص والتحديث المتزامن لكافة مستهلكي الـ DTO عبر الـ Monorepo بالكامل (تطبيق Android، عملاء الويب، إلخ) لتعديل نماذج الاستقبال قبل أو بالتزامن مع نشر الـ Backend.
    3. أي تغيير لعقود DTO مستقبلاً بعد بدء توزيع التطبيق يجب أن يراعي التوافق العكسي (Backward Compatibility) مع النسخ القديمة المثبتة على هواتف العملاء ما لم يُفرض تحديث إجباري.

### D36 — حوكمة الفروع غير المدموجة ومنع الانحدار البصري الصامت (2026-10-13)
- **الخلفية وسياق الاكتشاف:** عند اختبار المالك لنسخة APK Release بعد اكتمال بنود التواصل وRTL، أبلغ عن تناقض ظاهري: التطبيق يحوي الميزات الجديدة المطلوبة، لكنه تراجع بصرياً إلى تصميم قديم (الألوان والشعار القديم ما قبل 8 تشرين الأول).
- **التشخيص الجذري:**
  - أظهر فحص سجل الفروع وجود فرع `feature/android-customer-redesign-palette` أُنجز بين 8 و10 تشرين الأول ويحوي 4 commits لاعتماد الهوية البصرية الرسمية (البرتقالي #FF751F، النعناعي #86ECE6، الكحلي #2D3B4D، وإعادة تصميم الشاشات). هذا الفرع كان صالحاً ومختبراً بنسبة 100%، لكنه بقي مفتوحاً وغير مدموج في master لأكثر من أسبوع دون أن يُسجل في `PROJECT_STATUS.md` أو `NEXT_TASKS.md` كعمل معلّق.
  - عندما تفرّع فرع `feature/android-contact-channels-polish` من `master` القديم، بنى الميزات فوق كود متقادم بصرياً، مما سبب انحداراً بصرياً صامتاً للعميل عند البناء.
- **الدرس المعماري والتشغيلي (Dangling Branch Invariant):**
  - الفروع غير المدموجة التي لا تُوثَّق صراحة تشكّل خطراً صامتاً لانفصال شجرة الكود (Silent Tree Divergence).
  - **قاعدة تشغيلية ملزمة:** أي فرع عمل يبقى مفتوحاً لأكثر من بضعة أيام دون دمج يجب تسجيله صراحة في `NEXT_TASKS.md` ضمن قسم خاص بعنوان "فروع عمل معلّقة بانتظار الدمج" مع بيان سببه وحالته، لضمان عدم نسيانه أو تفرّع ميزات لاحقة من كود قديم.

### D37 — التراجع عن محاولة دمج إعادة التصميم وتثبيت الحالة المرجعية المستقرة (2026-10-13)
- **الخلفية وسياق الحادثة:** عقب اكتشاف بقاء فرع `feature/android-customer-redesign-palette` غير مدموج (D36)، جرت محاولة لدمجه في `master` عبر حل يدوي للتعارضات المعقدة في `HomeScreen.kt` و `BottomNavBar.kt` و `strings.xml`.
- **النتيجة والمشكلة:** أنتج الدمج اليدوي سلوكاً غير صحيح في التطبيق، ولم يكن من الممكن حصر وتصحيح كافة التناقضات بدقة وثقة في بيئة التجميع الفوري، مما استدعى قراراً عاجلاً بالرجوع إلى آخر نقطة مستقرة ومؤكدة.
- **إجراء العودة والإنقاذ (Zero Data Loss Rollback):**
  1. **أرشفة المحاولة:** تم تأمين وحفظ المحاولة بالكامل دون أي فقدان في فرع إنقاذ مستقل: `rescue/broken-redesign-attempt-2026-10-13` للرجوع إليها لاحقاً عند إعادة المحاولة بتأنٍّ.
  2. **تنفيذ العودة الصارمة:** تم تنفيذ `git reset --hard 6039ce4` على `master` للعودة إلى آخر نقطة معروفة ومؤكدة الاستقرار بنسبة 100% (وهي نقطة اكتمال ميزات قنوات التواصل الأربعة D35 في Android).
  3. **مزامنة الـ Remote:** تم دفع التحديث إلى `origin/master` عبر `git push origin master --force-with-lease`.
  4. **التحقق المستقل الحي:** أُعيد تشغيل الاختبارات الشاملة بنجاح 100% (`./gradlew testDebugUnitTest` في 1m 44s بـ 37/37 مهام ناجحة)، وأُعيد بناء نسخة Release نظيفة معتمدة (`app-arm64-v8a-release.apk` بحجم 15,067,386 بايت بتوقيت 15:58:42) ونسخها لسطح المكتب.
- **الدرس المعماري والتشغيلي (Large Layout Conflicts Invariant):**
  - تجنب دمج التغييرات البصرية والهيكلية الكبيرة لشاشة رئيسية معقدة (`HomeScreen.kt`) كدفعة واحدة عبر حل تعارضات يدوي موسع في جلسة واحدة.
  - أي محاولة مستقبلية لدمج فرع إعادة التصميم يجب أن تتم بخطوات صغيرة مجزأة (Incremental PRs / Commits) مع معاينة واختبارات بصرية مرحلية لكل مكوّن على حدة.

### D38 — توحيد ودمج إعادة التصميم البصري مع حزمة إصلاحات التواصل والأمان (2026-10-14)
- **الخلفية وسياق التنفيذ:** بعد التعافي من المحاولة الفاشلة السابقة (D37) والرجوع لنقطة الأساس الصحيحة، تم اعتماد استراتيجية إعادة البناء الذري المتدرج (Atomic Steps):
  1. أخذ فرع التصميم الأصلي المعتمد كقاعدة أساسية (`ef10e5c` الحاوي على الهوية البرتقالية #FF751F والشعار 130dp وزر البقالة).
  2. إعادة تطبيق حزمة الإصلاحات الكاملة فوقه خطوة بخطوة مع commits مستقلة ومختبرة:
     - **الخطوة 1:** إصلاح D35 الأمني في الـ Backend وقيد دورة حياة التواصل على مستويي الخدمة والأنواع المشتركة.
     - **الخطوة 2:** حماية Moshi Nullability في نماذج Kotlin (`whatsapp: String? = null`, `phone: String? = null`) لمنع أي JsonDataException Crash.
     - **الخطوة 3:** ربط ظهور قنوات التواصل في `OrderDetailViewModel` بحالة الحقول القادمة من السيرفر حصراً مع 25 اختبار وحدة.
     - **الخطوة 4:** إضافة بطاقة دعم الإدارة (`HomeAdminContactCard`) وبادج انتظار الكابتن وأزرار تواصل المندوب مع مراعاة الحالة.
     - **الخطوة 5:** عزل اتجاه الأرقام RTL/LTR (`\u200E`) وتوحيد نصوص الحالات بالعربية ("تم التأكيد").
     - **الخطوة 6:** تحسين تدرج البانر (3-stop gradient)، وضبط اتجاه مسار الـ Stepper في RTL، وإبراز شريط التنقل السفلي بحد علوي فاصل.
- **التحقق والتأكيد البصري من المالك:** تم بناء حزمة Release موقّعة وفحصها المالك بصرياً وتأكيد سلامة الهوية البرتقالية وعدم وجود أي انهيار (Crash) واكتمال ميزات التواصل بنجاح.
- **الدمج في master والتحقق الشامل:**
  - تم تنفيذ الدمج النهائي `git merge --no-ff feature/android-unified-redesign-and-fixes` في `master`.
  - التحقق الفوري المباشر على فرع `master`:
    1. اجتياز كافة اختبارات وحدة Android (`37 actionable tasks executed`, 41 suites, 279 tests بنسبة 100%).
    2. اجتياز كافة اختبارات الـ Backend (`pnpm --filter forerun-api test`: 26 files, 398 passed).
    3. نجاح البناء والفحص الأنماطي والأنواع على مستوى كامل الـ Monorepo (`pnpm build && pnpm typecheck && pnpm lint`: 6/6 packages).
  - حذف فرع الإنقاذ المؤقت `rescue/broken-redesign-attempt-2026-10-13` وتحديث `NEXT_TASKS.md` بإزالة فروع الانتظار.

### D39 — إلغاء الطلب الإجباري من الإدارة في كافة الحالات (2026-10-14)
- **الخلفية وسياق الحاجة:** كانت قدرة الإدارة على إلغاء الطلب محصورة بحالات معينة فقط في آلة الحالة، مما يترك الإدارة عاجزة عن التدخل في حالات الطوارئ (مثل تعطل المندوب أو تغيير مفاجئ من العميل أثناء الشراء أو خطأ في مسار الطلب).
- **التنفيذ المعماري والبرمجي:**
  1. **آلة الحالة (`order-transitions.ts`):** السماح بدور `ADMIN` بالانتقال إلى `CANCELLED` من أي حالة تشغيلية نشطة (`DRAFT`, `PENDING_REVIEW`, `UNDER_REVIEW`, `AWAITING_RUNNER`, `AWAITING_PREFERRED_RUNNER`, `ASSIGNED`, `IN_PROGRESS`) مع حظر الحالات النهائية (`DELIVERED`, `CANCELLED`, `REJECTED`).
  2. **خدمة الإلغاء (`admin-order-command.service.ts`):** تنفيذ الإلغاء داخل Database Transaction يضمن:
     - فك ارتباط المندوب وإعادته للحالة المتاحة (`isAvailable = true`) في حال كان معيّناً للطلب.
     - تسجيل الانتقال في `AuditLog` مع سبب الإلغاء الصريح و`adminId`.
     - قفل تفاؤلي `version` لمنع تضارب الإلغاء مع تسليم أو تعديل متزامن.
  3. **واجهة الإدارة (`admin-web`):** إضافة زر الإلغاء الإداري في صفحة تفاصيل الطلب مع نافذة تأكيد تطلب سبب الإلغاء وتمنع الإلغاء العفوي.
  4. **الاختبارات:** تغطية بـ 316 سطراً من اختبارات التكامل في `admin-force-cancel.integration.spec.ts` واختبارات الوحدة.
- **الدمج:** تم الدمج في `master` في commit `cb661a4`.

### D40 — نافذة تنويه المصاريف وسياسة الإلغاء قبل تأكيد الطلب في Android حصراً (2026-10-14)
- **الخلفية وسياق الحاجة:** الحاجة لتوفير شفافية كاملة للعميل في تطبيق Android قبل إرسال الطلب حول: (1) أجور المتاجر الإضافية، (2) أجور المناطق الطرفية البعيدة، (3) إمكانية إضافة رسم إضافي استثنائي بعد مراجعة الإدارة للطلبات الضخمة، (4) التحديد الدقيق لفترة الإلغاء المجاني المسموحة.
- **القرارات المعمارية وقواعد الأمان:**
  1. **نقطة نهاية ديناميكية مع صفر تسريب بيانات إدارية (قاعدة Least Privilege - Rule 7):**
     - بناء نقطة النهاية `GET /api/v1/customer/pricing/disclosure` محمية بـ `@Roles('CUSTOMER')` ومعدل استدعاء `30 req/min`.
     - حصر عقد الاستجابة بـ `{ baseFee, extraStoreFee, peripheralFee }` فقط دون أي بيانات إدارية (`id`, `updatedAt`, `updatedByUserId`, `User`) لمنع أي تسريب صامت للبنية التحتية.
  2. **تثبيت آلة الحالة وتصحيح النص الوقائعي (قاعدة State Machine - Rule 2):**
     - تم اعتماد الخيار الثاني بتثبيت آلة الحالة كما هي (إلغاء العميل متاح في `PENDING_REVIEW`, `AWAITING_RUNNER`, `AWAITING_PREFERRED_RUNNER`, `ASSIGNED` ومحجوب في `UNDER_REVIEW` و`IN_PROGRESS`).
     - صياغة البند الرابع في النافذة تطابق الواقع التقني بدقة تامة وبلا وعود كاذبة:
       > "يحق لك إلغاء الطلب مجاناً في أي وقت بعد إرساله وحتى بدء المندوب بالشراء، باستثناء الفترة القصيرة التي يكون فيها طلبك قيد المراجعة من الإدارة مباشرة بعد إرساله."
  3. **اعتراض التدفق في Android (UI Interception):**
     - عند ضغط العميل على زر إرسال الطلب (`SubmitOrder`)، يتم التحقق المحلي من صحة المدخلات أولاً، ثم فتح نافذة التنويه (`showFeeDisclosure = true`) وبدء جلب الأسعار الحية من السيرفر.
     - **الحصانة من الإرسال المبكر:** لا يتم استدعاء `createOrderUseCase` أو إرسال أي طلب للخادم إطلاقاً عند ضغط زر الشاشة الأساسي، بل يُؤجل الإرسال حصراً حتى يضغط العميل "تأكيد الطلب" داخل النافذة (`ConfirmOrderSubmit`). إغلاق النافذة أو الرجوع يُلغي العملية دون كتابة أي شيء.
  4. **التراجع والتحمل الآمن للأخطاء (Graceful Fallback):**
     - عند حدوث أي خطأ شبكي أثناء جلب الأسعار، تتراجع النافذة تلقائياً إلى صياغة عامة بديلة (بدون أرقام محددة) مع **إبقاء زر تأكيد الطلب مفعّلاً** حتى لا يتعطل العميل عن إرسال طلبه.
  5. **التعريب والنظافة:** كافة النصوص مستخرجة في `strings.xml` مع صفر نص عربي في كود Kotlin.
- **التغطية والتحقق:**
  - Backend: 4 اختبارات وحدة في `pricing.controller.spec.ts` و`pricing.service.spec.ts` + 5 اختبارات تكامل في `customer-pricing-disclosure.integration.spec.ts` (مع فصل حالتي 403 للأدمن والمندوب كحالتين منفصلتين).
  - Android: 299/299 اختبار وحدة ناجح بنسبة 100% (تغطية `CreateOrderViewModel`, `OrderRepositoryImpl`, `GetPricingDisclosureUseCase`).
  - Monorepo: `pnpm build`, `pnpm typecheck`, `pnpm lint` ناجحة بنسبة 100% عبر 6 حزم.

### D42 — إصلاح فشل تثبيت PWA لتطبيق المندوب على Chrome Android (2026-10-15)
- **الخلفية:** زر "تثبيت التطبيق" في `runner-pwa` كان يظهر (عبر سلوك Chrome التلقائي البحت) لكن الضغط عليه لا يُثبّت التطبيق فعلياً.
- **السبب الجذري المؤكَّد بدليل مباشر:** غياب تام لأي التقاط برمجي لحدث `beforeinstallprompt` في كامل `runner-pwa` (بحث شامل بالمستودع بصفر نتائج) — التطبيق كان معتمداً كلياً وبشكل سلبي على سلوك Chrome التلقائي غير المستقر لإدارة التثبيت، بلا أي تحكم أو واجهة مخصصة.
- **فرضية ثانوية غير مؤكَّدة (حجب شبكي لخدمة WebAPK من جوجل في البيئة المحلية):** طُرحت أثناء التشخيص الأولي، **رُفضت صراحة كسبب غير مُثبَت بدليل مباشر** وفق منهجية Zero-Trust، ولم يُبنَ عليها أي قرار تصميم. **أُسقطت نهائياً بعد التحقق الميداني الفعلي** الذي أثبت نجاح التثبيت بالكامل بعد الإصلاح البرمجي وحده، دون الحاجة لأي معالجة متعلقة بالشبكة.
- **الإصلاح المُطبَّق:**
  1. `usePwaInstall.tsx` + `PwaInstallProvider`: التقاط مركزي لحدث `beforeinstallprompt` من نقطة تحميل التطبيق الأولى (`main.tsx`)، مع `preventDefault()` وحفظ الحدث لاستدعاء `prompt()` برمجياً عند الطلب.
  2. ثلاث نقاط دخول للتثبيت داخل الواجهة: شريط تنبيه علوي ذكي (`InstallPromptBanner`)، زر دائم في الهيدر (`HeaderInstallButton`)، وزر في شاشة تسجيل الدخول (`LoginPage`) — الأخير يتيح التثبيت قبل حتى تسجيل الدخول.
  3. مهلة زمنية صريحة (`INSTALL_TIMEOUT_MS = 15000`) عبر `Promise.race` مع رسالة خطأ عربية واضحة وإرشاد للتثبيت اليدوي (قائمة ⋮ ← "إضافة إلى الشاشة الرئيسية") عند تعثر استجابة المتصفح — يمنع عطلاً صامتاً مربكاً.
  4. إصلاح `vite.config.ts`: فصل وسوم أيقونات الـ Manifest (`purpose: 'any'` منفصلة عن `purpose: 'maskable'` بدل الدمج الخاطئ)، وإضافة `id: '/'` و`scope: '/'` صريحين.
- **التحقق:** اختبار ميداني فعلي حي على Chrome Android (نفس الجهاز الذي فشل معه التثبيت الأصلي) أثبت نجاح التثبيت الكامل بعد الإصلاح. بوابة الجودة الرباعية الكاملة ناجحة (`pnpm build/typecheck/lint` 6/6، `pnpm --filter forerun-api test` 406/406).
- **الأثر:** تحسين مباشر في تجربة المندوبين — تطبيق PWA قابل للتثبيت فعلياً بدل زر معطَّل بصمت.

### D43 — إتاحة ملاحظة التقييم (note) للعميل صاحب التقييم مع حجبها الصارم عن المندوب (2026-10-16)
- **الخلفية وسياق الاكتشاف:** أثناء استعادة وظائف التقييم الكاملة في تطبيق Android (إضافة ملاحظة اختيارية وإمكانية تعديل التقييم في `DeliveredRatingCard`)، تبيّن أن الـ Backend في `rating.mapper.ts` كان يحجب حقل `note` ويعيده `null` لأي مستخدم لا يملك دور `ADMIN` (`role === 'ADMIN' ? rating.note : null`). ترتّب على ذلك أن العميل الذي كتب ملاحظة تقييم بنفسه لا يستطيع استرجاعها أو رؤيتها عند إعادة فتح تفاصيل طلبه (`GET /customer/orders/:id`)، مما يعيق إمكانية تعديلها ويفقد الواجهة حالتها المحفوظة ما لم تُخزّن محلياً.
- **التحليل المعماري وقواعد الأمان (Rule 7 Least Privilege & DTO Privacy):**
  - **مبدأ الخصوصية ومنع الاحتكاك:** حجب الملاحظة النصية عن المندوب (`RUNNER`) هو قرار أمني وتشغيلي صارم ومطلوب، لحماية العميل من أي ردود فعل أو مضايقات عند تركه نقداً سلبياً أو ملاحظة صريحة؛ حيث يكتفي المندوب برؤية عدد النجوم ومعدله الإجمالي فقط.
  - **خلل الحجب المفرط (Over-Masking):** حجب الملاحظة عن العميل *صاحب التقييم نفسه* كان زيادة غير مبررة في التقييد تنتهك مبدأ اتساق تجربة المستخدم، فالعميل هو منشئ البيانات ويملك حق استرجاعها وتعديلها.
- **الإصلاح المُطبَّق (Role & Ownership-Aware Masking):**
  1. في `apps/api/src/modules/ratings/rating.mapper.ts`:
     - تحديث دالة التحويل لتقبل إرجاع `note` في حال كان المستعلم هو `ADMIN` أو `CUSTOMER` (صاحب الطلب الموثق عبر الـ Guard).
     - فرض حجب الملاحظة بشكل صريح وحتمي كـ `null` إذا كان المستعلم هو المندوب (`RUNNER`).
  2. في `apps/api/src/modules/orders/services/customer-orders.service.ts`:
     - تضمين `note` في كائن `rating` المرجع مع تفاصيل الطلب (`getOrderDetails`) بعد التحقق من ملكية العميل للطلب.
  3. في `packages/shared-types/src/customer.types.ts`:
     - توثيق الحقل كـ `note?: string | null` اختياري ومتوافق خلفياً في `OrderRating`.
  4. في `apps/android`:
     - تبسيط `OrderDetailViewModel` لقراءة التقييم والملاحظة مباشرة من بيانات الخادم وعرضها في `DeliveredRatingCard` مع إتاحة التعديل في نفس المكان بنجاح.
- **التغطية والتحقق:**
  - تحديث اختبارات الوحدة في `ratings.service.spec.ts` لتغطية ظهور الملاحظة للأدمن والعميل وحجبها للمندوب.
  - تحديث اختبارات Compose والـ ViewModel في Android للتأكد من تحميل الملاحظة من استجابة الخادم بنسبة 100%.
  - اجتياز بوابات الجودة الكاملة للـ Monorepo (`pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm test`).
- **الأثر والدرس المعماري المستفاد:**
  - تدقيق الـ DTO وفق القاعدة 7 لا يقتصر على منع التسريب للخارج (Leakage)، بل يتطلب أيضاً موازنة دقيقة لمنع "الحجب المفرط" (Over-masking) عن صاحب البيانات الشرعي، مع الحفاظ على حماية المندوبين والعملاء من أي احتكاك تشغيلي.

### D44 — دفعة الإصلاحات الأمنية الشاملة Fix Security Batch 1 (2026-10-18)
- **الخلفية:** تنفيذ مراجعة أمنية معمقة ومعالجة 7 بنود حيوية تمس طبقة الحماية وتحديد المعدلات وتحصين التخزين ومصادقة الويب هوك.
- **البنود المُنجَزة:**
  1. **SEC-01 (TRUST_PROXY):** تحويل القيمة النصية إلى رقمية صريحة لدعم Express 5 وإعادة تفعيل الـ Per-IP Throttling الصحيح خلف البروكسي.
  2. **SEC-02 (Sentry Webhook Fail-Closed):** رفض الطلبات غير الموقعة أو عند غياب السر فوراً بـ 401، والتحقق الصارم من نطاق `sentry.io` لروابط التنبيهات.
  3. **SEC-04 (تعقيم HTML تلغرام):** دالة مركزية `escapeTelegramHtml` لمنع كسر تنسيق HTML عبر حقن الرموز الخاصة (`<`, `>`, `&`).
  4. **SEC-05 (طلب كلمة المرور الحالية):** اشتراط `currentPassword` في `UpdateCustomerSchema` والتحقق منها عبر `bcrypt.compare` قبل السماح بتغيير كلمة المرور وإبطال الجلسات النشطة.
  5. **SEC-06 (تعطيل النسخ الاحتياطي في أندرويد):** ضبط `android:allowBackup="false"` في `AndroidManifest.xml` لحماية البيانات المشفرة محلياً.
  6. **SEC-09 (ترويسات الأمان في admin-web):** تفعيل `Content-Security-Policy`، `Strict-Transport-Security`، `X-Frame-Options: DENY`، و`Referrer-Policy` في `next.config.js`.
  7. **SEC-03 (تحقق بادئة r2Key):** فرض البادئة المعتمدة `receipts/${orderId}/${orderStoreId}/` على مفاتيح R2 عند رفع وحذف الإيصالات لمنع التلاعب بالملفات.
- **الدمج والجودة:** دُمجت الدفعة في `master` عبر `git merge --no-ff` بـ `2d58f54`، مع إضافة 26 اختباراً جديداً ونجاح 100% لبوابة الجودة (456/456 في الـ API و 318/318 في Android).

### D45 — تدقيق وصقل النصوص العربية الشامل وتوحيد مسمى "المندوب" عبر كامل المنصة (2026-10-19)
- **الخلفية:** مراجعة شاملة لكافة النصوص والرسائل الموجهة للعميل والإدارة وتطبيق التعديلات المعتمدة رسمياً، مع فرض توحيد صارم للمصطلحات التشغيلية.
- **التعديلات المُنجَزة:**
  1. **شاشات التهيئة (Onboarding P1-1 → P3-3):** تعديل نصوص الشارات والعناوين والمزايا لتركز على متاجر القنجرة وسرعة وصول المندوب والدفع كاش عند الاستلام.
  2. **شاشات الدخول والتسجيل والتحقق (L12, L14, R3, R10, V2, V3, A5):** تحديث تلميحات العناوين (جانب المدرسة)، رسالة كلمة المرور (أحرف أو أرقام)، وزر واتساب لطلب التفعيل.
  3. **الرئيسية والخدمات وتفاصيل الطلب (H5, H11, H22, H23, H25, U1, U5, C16, C22, F2, F4, F5, D32):** ضبط وسوم التواصل، مسمى خدمات الركاب، تلميحات المواد والمتاجر، وتوضيحات رسوم المنطقة البعيدة والرسوم الاستثنائية وسياسة الإلغاء.
  4. **الأسئلة الشائعة (FAQ Q11 & Q18):** تصحيح الأخطاء الطباعية في السؤال 2 وإضافة السؤال 6 الخاص بالخدمات المستقبلية وتحديث `SupportViewModel` و`SupportViewModelTest` لاستيعاب 6 بنود.
  5. **إشعارات العميل (P10):** تعريب هوية الإشعارات واستبدال `FORERUN` بـ «فَوْراً» في إشعارات تفعيل الحساب والطلبات.
  6. **التوحيد الشامل لمسمى "المندوب":** استبدال مصطلح «كابتن / الكابتن / كباتن» بـ «مندوب / المندوب / مندوبين» في كامل واجهات ونصوص `strings.xml` (0 حالات متبقية)، واجهات الويب للعميل `apps/customer-web`، وشاشات وحالات وتنبيهات لوحة التحكم `apps/admin-web`.
- **التحقق وبوابة الجودة:**
  - `pnpm build`: ناجح بنسبة 100% على كافة الحزم الـ 6.
  - `pnpm typecheck`: ناجح (6 من 6 حزم).
  - `pnpm lint`: صفر أخطاء وصفر تحذيرات عبر المنظومة.
  - اختبارات API: نجاح 456 من أصل 456 اختباراً في 32 ملف اختبار.
  - اختبارات Android: نجاح 318 من أصل 318 اختباراً لوحدة الأندرويد (`testDebugUnitTest`).
- **الدمج:** دُمج الفرع `feature/customer-app-copy-polish` في `master` عبر `git merge --no-ff` بـ `ccf9de6`.

### D46 — صقل وظائف تطبيق العميل والـ API (Customer App Functional Polish) (2026-10-19)
- **الخلفية:** تنفيذ حزمة من 5 تحسينات وظيفية دقيقة لتجربة العميل عبر تطبيق Android والـ Backend المصاحب، لضبط الخصوصية وتجربة الاستخدام والحد من الطلبات العشوائية.
- **التعديلات المُنجَزة:**
  1. **تثبيت تقييم المندوب الظاهر للعميل بـ 5 نجوم:** تعديل مساري استجابة العميل `customer-orders.service.ts` (`getOrderDetails`) و `customers.service.ts` (`listAvailableRunners`) لإرجاع `avgRating: 5` ثابتاً للعميل حصراً، دون المساس بالحساب الحقيقي في قاعدة البيانات أو واجهات الإدارة والمندوب، مع اختبارات وحدة تثبت ثبات القيمة.
  2. **إخفاء أزرار تواصل الإدارة من بطاقة الطلب أثناء انتظار المندوب:** إزالة صفي أزرار الاتصال وواتساب من بطاقتي `OrderDetailAwaitingRunnerCard` و `ActiveOrderCard` في شاشتي التفاصيل والرئيسية منعاً للتكرار، مع الاكتفاء ببطاقات الدعم المركزية الموجودة أسفل الشاشة.
  3. **ترقيم المواد تسلسلياً وإخفاء الكمية الافتراضية (=1):** تعديل عنوان المادة في شاشة إنشاء الطلب ليصبح `%1$d- المادة`، وترقيم المواد في تفاصيل الطلب (`$currentNumber- ${item.itemName}`)، مع حجب نص الكمية إذا كانت تساوي 1 أو ١ أو فارغة، وإظهارها فقط إذا كانت > 1 أو وصفية.
  4. **تقييد إنشاء الطلبات إلى 3 طلبات بالساعة لكل حساب (مرتبط بالمستخدم):** بناء `UserThrottlerGuard` لربط حد الـ Throttle بـ `userId` (عبر `req.user.userId` أو فك تشفير الـ JWT كاحتياط) بدلاً من عنوان IP، لمنع حظر المستخدمين المشاركين لنفس شبكة الـ Wi-Fi، وتطبيق `@Throttle({ default: { limit: 3, ttl: 3600000 } })` على `POST customer/orders` مع إثبات عزل المسار واختبارات تفصيلية.
  5. **شاشة انتظار تفعيل الحساب الجديد:** حذف زر التحقق اليدوي من الحالة للاعتماد التام على التحديث التلقائي اللحظي للشاشة، وتعديل نص التنبيه في `strings.xml` ليوضح صراحة أن إرسال رسالة التفعيل عبر واتساب لإدارة فَوْراً هو شرط إلزامي لإتمام التفعيل والبدء بالطلب.
- **التحقق وبوابة الجودة:**
  - `pnpm build`: بناء كامل وناجح لكافة الحزم الـ 6 بنسبة 100%.
  - `pnpm typecheck`: ناجح (6 من 6 حزم).
  - `pnpm lint`: صفر أخطاء وصفر تحذيرات عبر المنظومة.
  - اختبارات API: نجاح 465 من أصل 465 اختباراً في 34 ملف اختبار (+9 اختبارات جديدة).
  - اختبارات Android: نجاح 318 من أصل 318 اختباراً لوحدة الأندرويد (`testDebugUnitTest`).
### D47 — استبدال محرك الخرائط بـ Google Maps عبر كامل المنظومة (2026-10-19)
- **الخلفية:** استبدال محركات الخرائط السابقة (MapLibre على Android و Leaflet على الويب) بمحرك خرائط غوغل (Google Maps) عبر كامل أسطح المنظومة (Android و admin-web و runner-pwa)، مع الالتزام الصارم بسقف التكلفة الصفرية (0$ شهرياً ضمن رصيد 200$ المجاني) وبقاء منطق الـ Reverse Geocoding معتمداً على Nominatim دون أي استهلاك مدفوع لـ Geocoding APIs.
- **التنفيذ المعماري وإدارة المفاتيح:**
  1. **تطبيق الأندرويد (`apps/android`):**
     - استبدال `MapLibreContainer` الكلاسيكي بمكتبة Jetpack Compose الرسمية `com.google.maps.android:maps-compose:4.4.1` مع تثبيت `play-services-maps:18.2.0` داخل [AddressSetupScreen.kt](file:///d:/FAWRUNF/FAWRUN/apps/android/app/src/main/java/com/forerun/customer/ui/address/AddressSetupScreen.kt).
     - **أمان المفتاح وقيده:** حقن المفتاح عبر `manifestPlaceholders["MAPS_API_KEY"]` من `local.properties` المحمي (أو البيئة) دون أي hardcode في الكود. تقييد المفتاح في Google Cloud بـ **Android Apps** حصراً (اسم الحزمة `com.forerun.customer` مع بصمتي SHA-1 للـ Debug والـ Release)، وتقييد الـ API حصراً بـ **Maps SDK for Android**.
     - **تحصين الـ Release:** إضافة قواعد ProGuard الصريحة في [proguard-rules.pro](file:///d:/FAWRUNF/FAWRUN/apps/android/app/proguard-rules.pro) لمنع تجريد R8 لكلاسات Google Maps و Maps Compose، وإضافة إذن `ACCESS_NETWORK_STATE` الصريح في `AndroidManifest.xml`.
  2. **لوحة الإدارة وتطبيق المندوب (`admin-web` و `runner-pwa`):**
     - استبدال Leaflet بـ Google Maps JavaScript API في [OrderMap.tsx](file:///d:/FAWRUNF/FAWRUN/apps/admin-web/src/components/OrderMap.tsx) و [MapView.tsx](file:///d:/FAWRUNF/FAWRUN/apps/runner-pwa/src/components/MapView.tsx) عبر محمّل مخصص غير متزامن (Dynamic async loader) يمنع التكرار ويدعم التدمير النظيف (cleanup) للـ DOM.
     - **أمان المفتاح وقيده:** قراءة المفتاح عبر متغيرات البيئة العامة (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` و `VITE_GOOGLE_MAPS_API_KEY`)، مع تقييده في Google Cloud بـ **HTTP Referrers** (نطاقات الإنتاج لـ admin-web و runner-pwa ومسارات localhost للتطوير)، وتقييد الـ API حصراً بـ **Maps JavaScript API**.
     - إضافة 8 اختبارات عقد (Contract Tests) تغطي سلوك التحميل والتعامل مع الأخطاء والـ unmount وغياب أي بقايا لـ Leaflet.
- **التحقق الميداني الصارم (Zero-Trust Field Verification):**
  - فحص الـ Manifest الثنائي المترجم داخل APK الـ Release الموقّع عبر `aapt2 dump xmltree` وإثبات حقن المفتاح الصريح بنسبة 100%.
  - فحص شهادة التوقيع الرسمية عبر `apksigner` ومطابقة بصمة الـ Release مع هوية التطبيق في `forerun-release.jks`.
  - سحب وتشخيص سجل Logcat الحي من جهاز المالك الحقيقي (PID 836) ورصد رسالة `Authorization failure` المباشرة من سيرفرات غوغل (`IApiTokenService`).
  - معالجة إعدادات Google Cloud بإضافة بصمة شهادة الـ Release وتفعيل `Maps SDK for Android`، وتأكيد اختفاء الخطأ تماماً من الـ Logcat وظهور خريطة غوغل وتفاعلها الحي على الهاتف بعد إغلاق التطبيق وإعادة فتحه.
- **بوابات الجودة (Quality Gates) على `master`:**
  - اختبارات API: 465 من أصل 465 اختباراً ناجحاً بنسبة 100% عبر 34 ملف اختبار.
  - اختبارات Android: 319 من أصل 319 اختبار وحدة ناجحاً بنسبة 100% (`./gradlew testDebugUnitTest`).
  - فحص الأنواع (Typecheck) والبناء والتدقيق (Lint): نجاح كامل (6 من أصل 6 حزم) بنتيجة صفر أخطاء.

### D48 — إغلاق دفعة الديون الآمنة الأربعة (2026-10-22)
- **الخلفية:** تنفيذ حزمة متسلسلة عبر 4 فروع عمل معزولة ومستقلة، دُمجت جميعاً في `master` عبر `git merge --no-ff` وبوابة جودة مشددة، دون أي تعديل على `schema.prisma` أو كسر لعقود DTOs المشتركة مع Android:
  1. **الفرع 1 (`cleanup/d12-remove-dead-share-code`):** حذف (لا ترقية) الكود الميت المرتبط بنظام الحصص الملغى؛ حذف `splitShares.ts` واختباراته، وحذف ثوابت `RUNNER_SHARE` و `PLATFORM_SHARE` من `packages/shared-constants`، وتنظيف الاختبارات المعتمدة عليها، مؤكداً استقرار الراتب الثابت بدلاً من الترقية إلى Basis Points (D12).
  2. **الفرع 2 (`cleanup/c7-check-maplibre-dead`):** التحقق المرجعي من بقايا MapLibre بعد هجرة Google Maps (D47)؛ ثبت الحذف الكامل بنسبة 100% لكافة كود ومراجع MapLibre في خطوة سابقة (`bc743d1`)، وتوصيف المهمة C-7 رسمياً كـ «⊘ ملغى» دون الحاجة لأي تعديل كود برمجي.
  3. **الفرع 3 (`test/6b6-device-token-tests`):** سد فجوة الاختبارات لـ DeviceToken و FCM بإضافة 20 اختبار وحدة جديد بنسبة 100% (15 اختباراً لـ CRUD والتحقق وتكرار التوكنات في `device-token.spec.ts`، و 5 اختبارات لـ Multicast ومعالجة فشل الشبكة وحذف التوكنات الباطلة في `fcm.service.spec.ts`).
  4. **الفرع 4 (`test/6b7-pricing-ttl`):** استبدال دوال الاختبار `*ForTesting` في `PricingService` بحقن `PricingCacheOptions` عبر `@Optional() @Inject(PRICING_CACHE_OPTIONS)` مع تراجع صريح وآمن (Fallback) إلى `30_000` و `Date.now` عند غياب المزود في بيئة الإنتاج.
- **التحقق وفق Zero-Trust وقت التشغيل (Runtime DI Verification):**
  - فحص استدعاء الحاوية المباشر عبر `NestFactory.createApplicationContext(AppModule)` مع تحميل `.env`، وأثبت حل `PricingService` تلقائياً مع `cacheTtlMs = 30000` و `clock() == Date.now()`.
  - فحص الإقلاع الفعلي الكامل لخادم الـ API عبر `node --env-file=.env dist/main.js` على `master` وأثبت بدء الخادم والاستماع على المنفذ `http://localhost:3000/api/v1` دون أي استثناء حقن تبعيات وقت التشغيل.
- **بوابات الجودة التراكمية الشاملة على `master`:**
  - اختبارات API: نجاح 472 من أصل 472 اختباراً بنسبة 100% عبر 34 ملف اختبار (+7 اختبارات صافية بعد حذف اختبارات الحصص الميتة وإضافة اختبارات DeviceToken/FCM/TTL).
  - اختبارات Android: نجاح 319 من أصل 319 اختبار وحدة ناجحاً بنسبة 100% (`./gradlew testDebugUnitTest --rerun-tasks`).
  - البناء والفحص النوعي والتدقيق (Build / Typecheck / Lint): نجاح كامل (6 من 6 حزم) بنتيجة صفر أخطاء وصفر تحذيرات.

---

**نهاية الملف.**


