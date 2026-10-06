# ROLLBACK_PLAN — إلغاء نظام الحصص (D25–D28)

> **التاريخ:** 2026-10-06  
> **الفرع:** `feature/remove-shares-mvp`  
> **النطاق:** Backend (Pricing + Orders Ledger + Settlements + Shared Types & Constants)  
> **القرارات:** D25 (قيد إجمالي التسليم فقط), D26 (تبسيط التسويات), D27 (عرض إجمالي الرسم), D28 (تهميش الحصص)  
> **الحالة:** معتمد وجاهز للتنفيذ

---

## 1. ملخص التغييرات المالية
1. **Ledger عند التسليم (`deliverOrder`):**
   - سابقاً: كتابة قيدين (`RUNNER_SHARE` بنسبة 75% و `PLATFORM_SHARE` بنسبة 25%).
   - حالياً: كتابة قيد مالي وحيد بنوع `ORDER_FEE_TOTAL` وقيمة `totalFee`.
2. **التسويات (`SettlementsService`):**
   - سابقاً: حساب `runnerShare` و `platformShare` لكل طلب وتخزينها وتجميعها.
   - حالياً: حساب `totalFees` كمجموع لرسوم الطلبات المسلمة، وتصفير حقول الحصص في DB (`runnerShare = 0, platformShare = 0`) مع ملء `SettlementItem.runnerShare = totalFee` إحصائياً.
3. **قاعدة البيانات (`schema.prisma`):**
   - **صفر تعديل على الـ Schema وصفر Migrations.**
   - أنواع الـ Enum القديمة وحقول الجداول بقيت كما هي دون حذف.

---

## 2. آلية التراجع (Rollback Strategy)

### قاعدة السلامة الجوهرية
> **التراجع يتم ببساطة عبر `git revert` — البيانات القديمة والجديدة سليمة تماماً.**

- **لا يوجد أي تعديل على بنية قاعدة البيانات (No DDL / No Migrations):**
  - لا تتطلب عملية التراجع أي rollback migration أو تعديل على جداول PostgreSQL.
- **سلامة القيود المحاسبية التاريخية (Append-Only):**
  - قيود `RUNNER_SHARE` و `PLATFORM_SHARE` السابقة لم تُمس ومحفوظة بالكامل في `LedgerEntry`.
  - قيود `ORDER_FEE_TOTAL` التي كُتبت في فترة تشغيل هذه النسخة متوافقة تماماً وموجودة في الـ enum مسبقاً.
  - سجلات `Settlement` و `SettlementItem` السابقة تحتفظ بحقولها دون تلف.

### خطوات التراجع في حال الطوارئ:
1. إلغاء الدمج أو تنفيذ `git revert` لكوميتات ميزة إلغاء الحصص.
2. إعادة بناء ونشر الـ API (`pnpm build && railway up`).
3. السلوك القديم سيعود لكتابة قيدي الحصص دون أي تعارض في البيانات التاريخية.
