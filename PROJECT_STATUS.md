# FORERUN — Project Status & Diagnostic Playbook

> **آخر تحديث:** 2026-10-06
> **الغرض:** هذا الملف هو المرجع الوحيد لحالة المشروع، القرارات المعمارية، الأخطاء المعروفة، وحلولها.
> **مهم:** أي وكيل أو مطوّر يبدأ العمل يجب أن يقرأ هذا الملف كاملًا قبل أي تعديل.
> **نطاق المرجعية:** هذا الملف يملك حقائق **الإنتاج والبنية التحتية** فقط. لتوثيق Android انظر خريطة التوثيق في [§11](#11-خريطة-التوثيق--أي-ملف-يملك-أي-حققيقة).

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
- **API**: `https://fawrun-api-production.up.railway.app/api/v1`
- **Admin**: `https://fawrun-admin.vercel.app`
- **Runner**: `https://fawrun-runner-pwa-steel.vercel.app`
- **Customer**: `https://fawrun-customer-web-three.vercel.app`
- **Android**: **APK موقَّع** (3 ABI) — **جاهز للنشر بعد ربط Firebase** (Sprint 8F). لا يوجد رابط إنتاج. مفتاح التوقيع: `CN=FORERUN` · SHA-256 `725b4683…09879` — انظر [§12 · D6](#12-سجل-القرارات).
- **GitHub**: `github.com/ghaithmoa84-cyber/forerun` (master)

### 1.1 حالة الإنتاج وقاعدة البيانات — 2026-10-01

| الحقيقة | الحالة |
|---|---|
| منصة الإنتاج وقاعدة البيانات | **Railway** — وليس Supabase |
| Schema Drift | **0**، آخر فحص: **2026-10-01** |
| سجل `_prisma_migrations` | **7 migrations** مُسجَّلة |
| Migration الحالية | `20261001160600_add_device_token` مُطبَّق |
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
SENTRY_DSN            = <optional>
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

| 9 | **سبرنت 6B (أسطح الز_Unbound والمندوب وAndroid) — إضافة customFee/customFeeReason إلى الـ frontends و raise MAX_CUSTOM_FEE إلى 500** | ✅ مكتملة ومختبرة | 4 commits: 4fe7cb · aaf2d8 · 86ac39a · 7b4ae2. pnpm build + 	ypecheck + lint ناجح (6/6). ✅ مُكتمل — الدمج git merge --no-ff معلّق على مالك. |
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
│   └── android/                ← Kotlin + Jetpack Compose (9 سبرنتات منجزة: 1–8D)
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

| 2026-10-05 | **سبرنت 6B (أسطح الز_Unbound والمندوب وAndroid)** — رفع MAX_CUSTOM_FEE إلى 500، إضافة customFee/customFeeReason لـ customer-web (OrderDetail) و runner-pwa (ActiveOrder) و Android (DTO + PricingCard + strings.xml)، وحمولة order:assigned WebSocket carrying customFee. 4 semantic commits: 4fe7cb (shared types) · aaf2d8 (backend) · 86ac39a (frontends) · 7b4ae2 (tests). pnpm build + 	ypecheck + lint ناجح (6/6). ✅ مُكتمل — الدمج git merge --no-ff معلّق على مالك. |
| 2026-10-06 | إلغاء نظام الحصص (D25–D28) نُشر على الإنتاج: merge `af6ae4e` · 12 commits · API/Admin/Runner Ready · Customer Web لم يتغيّر. |
| 2026-10-06 | S5 ميداني ناجح (FW-000093) · LedgerEntry واحد ORDER_FEE_TOTAL=100 · M-1 مغلق. |

---

## 10. نصائح لتسريع التشخيص مستقبلًا

1. **عند أي خطأ، ابحث في جدول Playbook أولًا** (بند 4).
2. **انسخ نص الخطأ كاملًا** — لا تلخّصه.
3. **افحص `schema.prisma` قبل أي كتابة FK.**
4. **استخدم أوامر التشخيص السريقة** (بند 4) بدلًا من الاستنتاجات.
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

**تنبيه صيانة:** توجد نسختان متطابقتان من JKS (`apps/android/` و `apps/android/app/` — نفس SHA-256 `FAC8DBE7…3864`). البناء يفضّل نسخة `app/` (`build.gradle.kts:30,40`). هما متطابقتان اليوم، لكن تحديث إحداهما دون الأخرى يجعل البناء يوقّع بمفتاح مختلف — يُنصح بالإبقاء على **نسخة واحدة فقط**.

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

---

**نهاية الملف.**

