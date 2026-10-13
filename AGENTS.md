# FORERUN Coding Standards & Workflow

## ابدأ من هنا (Start Here) — ترتيب القراءة لوكيل جديد

اقرأ هذه الملفات **بهذا الترتيب**، ولا تبدأ عملاً قبل إنهائها:

| # | الملف | لماذا | الحجم |
|---|---|---|---|
| 1 | **[AGENTS.md](AGENTS.md)** (هذا الملف) | المعايير وقواعد الأمان وأوامر المشروع | 97 سطر |
| 2 | **[PROJECT_STATUS.md](PROJECT_STATUS.md)** | حقائق الإنتاج والبنية التحتية · **§5** البنود المتبقية · **§9** سجل الأحداث · **§11 خريطة التوثيق** (أي ملف يملك أي حقيقة) · **§12 سجل القرارات** (لماذا ومتى) | ~315 سطر |
| 3 | **[NEXT_TASKS.md](NEXT_TASKS.md)** | ما يجب عمله بعد، بالترتيب والمالك | 31 سطر |
| 4 | **[HANDOFF.md](HANDOFF.md)** | قواعد التعامل ومسار العمل | 86 سطر |

**ثم عند الحاجة فقط — لا تقرأها مقدَّماً:**
- [PROJECT_BRIEF.md](PROJECT_BRIEF.md) (471 سطر) — المواصفة ومسار السبرنتات. اقرأه إذا كنت تصمّم ميزة.
- [docs/android/ROADMAP.md](docs/android/ROADMAP.md) — الخطوة القادمة لـ Android.
- `docs/sprints/` (2,638 سطر) — **تاريخ لا حالة حالية.** لا تعامل معاييرها كمتطلّبات مفتوحة؛ راجع `PROJECT_STATUS.md §11` أولاً.

**⚠️ ثلاث مغالطات شائعة في هذا المستودع — لا تقع فيها:**
1. **`docs/sprints/` ليست قائمة مهام.** هي تاريخ منجَز. العمل الفعلي في [NEXT_TASKS.md](NEXT_TASKS.md).
2. **«مرجع الحقيقة الوحيد» ليس ملفاً واحداً.** توزيع الحقائق في [§11](PROJECT_STATUS.md#11-خريطة-التوثيق--أي-ملف-يملك-أي-حقيقة) — لا تفترض أن `PROJECT_STATUS.md` يغطي كل شيء.
3. **لا «ادفع مباشرة إلى master».** فرع لكل سبرنت ثم `git merge --no-ff` (قواعد Git أدناه).

---

> **ملاحظة:** الحالة الحالية موثّقة في [PROJECT_STATUS.md](PROJECT_STATUS.md).
> راجعها قبل أي عمل. هذا الملف هو المرجع للمعايير والأدوات والأوامر.

## Project Overview
FORERUN is a grocery delivery platform built as a Modular Monolith in a Monorepo.
- Backend: NestJS + PostgreSQL + Prisma + Socket.IO
- Admin Dashboard: Next.js 14 (App Router)
- Runner PWA: React + Vite + PWA
- Android: Kotlin 2.0.21 + Jetpack Compose + Hilt (مدمج في `master` منذ `e5bfbc1`)

## Coding Rules (Spec Section 17)

### 1. Server is Source of Truth
- Never compute fees or change states on the frontend
- All business logic lives in the backend

### 2. State Machine Enforcement
- Every status change MUST go through the State Machine
- Never mutate the status field directly on a model
- All transitions are logged to AuditLog

### 3. Financial Operations
- Every financial operation = LedgerEntry
- Ledger is append-only (no updates, no deletes)
- Multi-step financial ops must use DB transactions
- Idempotency on critical operations (e.g., DELIVERED)

### 4. Data Integrity
- Soft delete only (isDeleted flag, no hard deletes)
- AuditLog and LedgerEntry: never delete, ever
- orderNumber generated from seqNumber inside a transaction after save

### 5. Types First
- New DTOs go in packages/shared-types first
- Zod schemas shared between backend and frontend
- Never use any in typed APIs

### 6. API Standards
- All endpoints under /api/v1/
- Zod validation on every input (sanitizes and strips unknown keys via result.data)
- Environment variables for all secrets
- Standardized error responses (spec section 9.0)

## Workflow

### Sprint Flow
1. code-architect runs /pre-sprint (runs pre-sprint-checklist)
2. feature-dev implements endpoints
3. test-engineer runs full local checklist
4. فرع لكل سبرنت ثم `git merge --no-ff` إلى `master`

### Git Rules
- Semantic commits: feat:, fix:, refactor:, etc.
- Branch per Sprint: feature/sprint-N-<description>
- فرع لكل سبرنت ثم `git merge --no-ff` إلى `master` (لا fast-forward — يبقي سجل الدمج مرئيًا)
- Android branch strategy: نفس القاعدة بلا استثناء — **الأندرويد مدمج في `master` منذ `e5bfbc1`** (السبرنتات 1–8B في `3fc4119`، و8C في `e5bfbc1`)
- التوثيق في docs/android/ قبل أي sprint جديد

### Security Rules
- No hardcoded secrets
- Authorization on every endpoint
- Rate limiting configured per endpoint
- Zod input validation everywhere (sanitizes and strips unknown keys via result.data)
- See test-engineer agent for full security checklist

### Rollback Plans
Financial operations (Ledger, Settlement, Order fees) require a documented
rollback plan BEFORE execution. Use /rollback-plan command to create one.

## Agents
Defined in `.agents/agents-reference.md` and `.kilo/agent/`:
- @code-architect — Sprint planning, schema design, state machine validation
- @feature-dev — Endpoint implementation
- @test-engineer — Tests, lint, typecheck, security checks
- @debugger — Bug investigation (on-demand only)

## Skills
Active in `.agents/skills/`:
- pre-sprint-checklist — Pre-Sprint validation (`.agents/skills/pre-sprint-checklist/SKILL.md`)
- rollback-plan — Financial rollback documentation (`.agents/skills/rollback-plan/SKILL.md`)

## Commands
- /pre-sprint — Run pre-sprint checklist
- /rollback-plan — Create rollback plan for financial ops

## Commands Reference
- pnpm build — Build all packages
- pnpm dev — Start all apps in dev mode
- pnpm lint — Lint all code
- pnpm typecheck — Type check all code
- pnpm test — Run all tests
- pnpm db:generate — Generate Prisma client
- pnpm db:push — ⚠️ EMERGENCY ONLY — pushes schema to DB directly without a migration; causes schema drift. Use `prisma migrate deploy` instead.
- node scripts/diff-schema.js — Detect schema drift against the live production DB
- docs/runbook-schema-drift.md — Runbook for schema drift diagnosis
