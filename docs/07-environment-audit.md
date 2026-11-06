# 07. تدقيق متغيرات البيئة (Environment Audit)

## قسم الاستضافة (Hosting)

| الخدمة | المزود | ملاحظات |
|---|---|---|
| API (NestJS + PostgreSQL) | **Railway** | Dockerfile `node:20-slim`، migrations عبر Railway Console |
| Admin Dashboard | **Vercel** | Next.js 14.2 |
| Runner PWA | **Vercel** | Vite + PWA |
| Customer Web | **Vercel** | Vite |

الواجهات الثلاث (Admin, Runner, Customer) منشورة على Vercel.

---

| # | Variable Name | Read Location & Line | Fallback Value | Security / Config Status | Notes / Safety Assessment |
|---|---------------|----------------------|----------------|--------------------------|---------------------------|
| 1 | `DATABASE_URL` | [apps/api/prisma/schema.prisma:8](file:///d:/FAWRUNF/FAWRUN/apps/api/prisma/schema.prisma#L8)<br>[apps/api/.env:2](file:///d:/FAWRUNF/FAWRUN/apps/api/.env#L2) | N/A | Configured | قاعدة بيانات PostgreSQL المحلية المباشرة. |
| 2 | `DATABASE_URL_TEST` | [apps/api/test/integration/setup.ts:34](file:///d:/FAWRUNF/FAWRUN/apps/api/test/integration/setup.ts#L34)<br>[apps/api/.env:5](file:///d:/FAWRUNF/FAWRUN/apps/api/.env#L5) | `postgresql://postgres:postgres@localhost:5432/fawrun_test` | Configured | قاعدة بيانات Supabase المنفصلة المخصصة للاختبارات التكافلية. |
| 3 | `JWT_PRIVATE_KEY` | [apps/api/src/config/jwt.config.ts:9](file:///d:/FAWRUNF/FAWRUN/apps/api/src/config/jwt.config.ts#L9)<br>[apps/api/.env:3](file:///d:/FAWRUNF/FAWRUN/apps/api/.env#L3) | `secrets/private.pem` (فقط في حال الصراحة `_FILE`) | Configured | مفتاح RSA الخاص لـ RS256 JWT مضمّن كـ string في `.env`. |
| 4 | `JWT_PUBLIC_KEY` | [apps/api/src/config/jwt.config.ts:9](file:///d:/FAWRUNF/FAWRUN/apps/api/src/config/jwt.config.ts#L9)<br>[apps/api/.env:4](file:///d:/FAWRUNF/FAWRUN/apps/api/.env#L4) | `secrets/public.pem` (فقط في حال الصراحة `_FILE`) | Configured | مفتاح RSA العام لـ RS256 JWT مضمّن كـ string في `.env`. |
| 5 | `JWT_SECRETS_DIR` | [apps/api/src/config/jwt.config.ts:5](file:///d:/FAWRUNF/FAWRUN/apps/api/src/config/jwt.config.ts#L5) | `join(process.cwd(), 'secrets')` | Fallback active | مجلد احتياطي لاست قراءة ملفات PEM الخارجية. |
| 6 | `JWT_ACCESS_TOKEN_EXPIRY` | [apps/api/src/config/jwt.config.ts:42](file:///d:/FAWRUNF/FAWRUN/apps/api/src/config/jwt.config.ts#L42) | `'2h'` | Fallback active | مدة صلاحية توكن التوثيق (ساعتان افتراضياً). |
| 7 | `R2_ACCOUNT_ID` | [apps/api/src/modules/receipts/r2.service.ts:24](file:///d:/FAWRUNF/FAWRUN/apps/api/src/modules/receipts/r2.service.ts#L24)<br>[apps/api/.env:6](file:///d:/FAWRUNF/FAWRUN/apps/api/.env#L6) | Throws error if missing | Configured (`test`) | معرّف حساب Cloudflare R2 لرفع صور الفواتير. |
| 8 | `R2_ACCESS_KEY_ID` | [apps/api/src/modules/receipts/r2.service.ts:25](file:///d:/FAWRUNF/FAWRUN/apps/api/src/modules/receipts/r2.service.ts#L25)<br>[apps/api/.env:7](file:///d:/FAWRUNF/FAWRUN/apps/api/.env#L7) | Throws error if missing | Configured (`test`) | مفتاح الوصول لـ Cloudflare R2. |
| 9 | `R2_SECRET_ACCESS_KEY` | [apps/api/src/modules/receipts/r2.service.ts:26](file:///d:/FAWRUNF/FAWRUN/apps/api/src/modules/receipts/r2.service.ts#L26)<br>[apps/api/.env:8](file:///d:/FAWRUNF/FAWRUN/apps/api/.env#L8) | Throws error if missing | Configured (`test`) | المفتاح السري لـ Cloudflare R2. |
| 10 | `R2_BUCKET_NAME` | [apps/api/src/modules/receipts/r2.service.ts:29](file:///d:/FAWRUNF/FAWRUN/apps/api/src/modules/receipts/r2.service.ts#L29)<br>[apps/api/.env:9](file:///d:/FAWRUNF/FAWRUN/apps/api/.env#L9) | Throws error if missing | Configured (`test`) | اسم الحاوية Bucket المستهدفة في R2. |
| 11 | `R2_ENDPOINT` | [apps/api/src/modules/receipts/r2.service.ts:38](file:///d:/FAWRUNF/FAWRUN/apps/api/src/modules/receipts/r2.service.ts#L38)<br>[apps/api/.env:10](file:///d:/FAWRUNF/FAWRUN/apps/api/.env#L10) | `https://${accountId}.r2.cloudflarestorage.com` | Configured (`http://localhost:3005`) | مسار الربط المحلي المخصص لـ S3 mock. |
| 12 | `SENTRY_DSN` | [apps/api/src/main.ts:27](file:///d:/FAWRUNF/FAWRUN/apps/api/src/main.ts#L27)<br>[apps/api/.env:11](file:///d:/FAWRUNF/FAWRUN/apps/api/.env#L11) | Disabled | Unset | تتبع الأخطاء الإنتاجية (يتجاوز إذا كان فارغاً). |
| 13 | `CORS_ORIGINS` | [apps/api/src/main.ts:38](file:///d:/FAWRUNF/FAWRUN/apps/api/src/main.ts#L38)<br>[apps/api/.env:12](file:///d:/FAWRUNF/FAWRUN/apps/api/.env#L12) | None | Configured | النطاقات المسموحة للاتصال الخارجي عبر HTTP و WebSockets. |
| 14 | `TRUST_PROXY` | [apps/api/src/main.ts:20](file:///d:/FAWRUNF/FAWRUN/apps/api/src/main.ts#L20) | `false` | Fallback active | تحديد عنوان الـ IP الموثوق خلف الـ Reverse Proxy. |
| 15 | `PORT` | [apps/api/src/main.ts:53](file:///d:/FAWRUNF/FAWRUN/apps/api/src/main.ts#L53) | `3000` | Fallback active | المنفذ التشغيلي لمنفذ API. |
| 16 | `NEXT_PUBLIC_API_URL` | [apps/admin-web/src/lib/api.ts:10](file:///d:/FAWRUNF/FAWRUN/apps/admin-web/src/lib/api.ts#L10) | `'http://localhost:3000/api/v1'` | Fallback active | رابط الواجهة لـ admin-web. |
| 17 | `NEXT_PUBLIC_WS_URL` | [apps/admin-web/src/hooks/useAdminWebSocket.ts:20](file:///d:/FAWRUNF/FAWRUN/apps/admin-web/src/hooks/useAdminWebSocket.ts#L20) | `'http://localhost:3000'` | Fallback active | رابط بث WebSocket لـ admin-web. |
| 18 | `VITE_API_URL` | [apps/runner-pwa/src/api/client.ts:10](file:///d:/FAWRUNF/FAWRUN/apps/runner-pwa/src/api/client.ts#L10)<br>[apps/customer-web/src/lib/client.ts:10](file:///d:/FAWRUNF/FAWRUN/apps/customer-web/src/lib/client.ts#L10) | `'http://localhost:3000/api/v1'` | Fallback active | رابط API المستهدف لكل من runner-pwa و customer-web. |
| 19 | `VITE_WS_URL` | [apps/runner-pwa/src/hooks/useWebSocket.ts:15](file:///d:/FAWRUNF/FAWRUN/apps/runner-pwa/src/hooks/useWebSocket.ts#L15)<br>[apps/customer-web/src/hooks/useCustomerWebSocket.ts:18](file:///d:/FAWRUNF/FAWRUN/apps/customer-web/src/hooks/useCustomerWebSocket.ts#L18) | `'http://localhost:3000'` | Fallback active | رابط بث البث المباشر WebSocket في تطبيقات التطبيق. |
| 20 | `VITE_ADMIN_WHATSAPP` | [apps/customer-web/src/pages/PendingVerificationPage.tsx:14](file:///d:/FAWRUNF/FAWRUN/apps/customer-web/src/pages/PendingVerificationPage.tsx#L14) | `'963995535895'` | Configured | رقم الواتساب الرسمي الموجه له العميل عند انتظار التفعيل أو الدعم. |
| 21 | `VITE_ADMIN_PHONE` | [apps/customer-web/src/pages/HomeScreen.tsx:58](file:///d:/FAWRUNF/FAWRUN/apps/customer-web/src/pages/HomeScreen.tsx#L58) | `'0995535895'` | Configured | رقم هاتف المسؤول للاتصال المباشر عند الحاجة. |
