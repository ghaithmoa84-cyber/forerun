# Historical Proof-of-Concept (PoC) Tests — دليل ملفات إثبات الثغرات التاريخية

## ما هذا المجلد؟
يحتوي هذا المجلد على ملفات اختبار تكاملية كُتبت أثناء المراحل الأولى للمراجعة التدقيقية الشاملة لـ FAWRUN (2026-10-12) بغرض **إثبات وجود الثغرات المعمارية والأمنية والمالية تجريبياً (Proof of Concept)** قبل معالجتها بالكود:

1. **`audit-items-5-7-28-user-state-escalation.integration.spec.ts`**:
   - يُثبت إمكانية رفع الحسابات المرفوضة أو المعلقة عبر ثغرة غياب آلة الحالة (`UserStateMachine`).
2. **`audit-items-12-13-close-day.integration.spec.ts`**:
   - يُثبت عيب تجميع التسويات بالاعتماد على `createdAt` بدلاً من `deliveredAt`، مما أدى لإسقاط الطلبات المسلمة في أيام تالية.

## لماذا تفشل هذه الاختبارات الآن؟
**فشل هذه الاختبارات الآن متوقَّع ومطلوب وطبيعي.**
هذه الاختبارات تتوقع نجاح الهجوم (مثال: `expect(status).toBe(200)` أو `expect(todayItems.length).toBe(0)`). نظراً لأن الكود تم تحصينه بالكامل في المرحلة 4 (عبر `UserStateMachine` و `previousStatus` ونافذة `deliveredAt` و `409 ConflictException` لمنع تكرار الإغلاق)، فإن النظام الآن يرفض هذه المحاولات بـ `422 Unprocessable Entity` ويضم الطلبات المسلمة إلى يومها الصحيح.

## أين توجد الاختبارات المعتمدة للإصلاح؟
الاختبارات التي تثبت نجاح الكود وصحته وتعمل في مسار CI تقع مباشرة في المجلد الرئيسي `apps/api/test/integration/_audit/`:
- `audit-user-state-escalation-fixed.integration.spec.ts` (بديل 5-7-28)
- `audit-close-day-fixed.integration.spec.ts` (بديل 12-13)
- `audit-double-suspend.integration.spec.ts`
- `audit-idor-endpoints.integration.spec.ts`
- `audit-e2e-final-verification.integration.spec.ts`
- `audit-security-scans.integration.spec.ts`

## طريقة التشغيل اليدوي (إن لزم)
تم استبعاد هذا المجلد تلقائياً من `vitest.config.integration.ts` لمنع كسر أوامر الفحص الآلي، ويمكن تشغيله يدوياً وفردياً عند الحاجة عبر:
```bash
pnpm --filter forerun-api exec vitest run test/integration/_audit/historical-poc/<filename>
```
