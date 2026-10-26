# FORERUN - Project Brief (English)

## 1. What FORERUN Is

FORERUN is a grocery delivery platform (Syria-based). A customer places an order; a runner buys the items and delivers them; payment is cash on delivery. FORERUN takes 25% of the service fee; the runner keeps 75%.

MVP scope: buying items from one or more stores + delivery. No catalog, no online payments, no store integration. Store names are free-text written by the customer or runner - there is no store database.

## 2. Architecture

- Style: Modular Monolith inside a Monorepo (not microservices - easier now, can split later).
- Backend and Frontend are fully separated.
- Communication: REST API (/api/v1) + real-time WebSocket (Socket.IO).
  Note: The Android app is complete, signed, and merged (Sprints 8A-8F, 223+ @Test) - see docs/android/ROADMAP.md and PROJECT_STATUS.md §1.
- Server is always the source of truth - never compute fees or change states on the frontend.

### Monorepo layout
forerun/
apps/api/src/modules/ - auth, users, customers, runners, orders, order-items, order-stores, pricing, settlements, ledger, ratings, receipts, notifications, audit
apps/api/src/websocket/ - Socket.IO gateways
apps/api/src/state-machine/ - order / orderStore / runner machines
apps/api/src/common/ - guards, decorators, filters, interceptors
apps/admin-web/ - Next.js 14 (App Router)
apps/runner-pwa/ - React 18 + Vite + PWA
apps/android/ - Kotlin (Native Android)
apps/customer-web/ - React 18 + Vite (customer web interface - tested in S2)
packages/shared-types/ - DTOs + Zod schemas shared by all apps
packages/shared-constants/ - shared enums + pricing constants

## 3. Tech Stack

Backend: NestJS 12 + TypeScript
Database: PostgreSQL
ORM: Prisma 5
Real-time: Socket.IO
Validation: Zod 3
Password hashing: bcrypt (12 rounds)
Auth: JWT RS256 - Access Token (2h) + Refresh Token (permanent, revocable)
Admin dashboard: Next.js 14 (App Router)
Runner interface: React 18 + Vite + PWA
Customer app: Customer Web (Vite)
Maps: OpenStreetMap + Leaflet (free, no API key)
File storage: Cloudflare R2 (free up to 10GB, S3-compatible)
Backend hosting: Railway (Node.js + PostgreSQL + WebSocket)
Frontend hosting: Vercel
Error tracking: Sentry (Free Tier)
Package manager: pnpm 9 + Turborepo 2

## 4. Data Model (Prisma Schema)

### Enums
- UserRole: CUSTOMER, RUNNER, ADMIN
- UserStatus: PENDING_VERIFICATION, VERIFIED, REJECTED, SUSPENDED
- RunnerStatus: AVAILABLE, ON_MISSION, UNAVAILABLE
- OrderStatus: DRAFT, PENDING_REVIEW, UNDER_REVIEW, AWAITING_RUNNER, AWAITING_PREFERRED_RUNNER, ASSIGNED, IN_PROGRESS, OUT_FOR_DELIVERY, DELIVERED, CANCELLED
- OrderStoreStatus: PENDING, PURCHASED, SKIPPED
- LedgerEntryType: ORDER_FEE_TOTAL, RUNNER_SHARE, PLATFORM_SHARE, SETTLEMENT_PAID, ADMIN_ADJUSTMENT
- SettlementStatus: PENDING, SETTLED

### Key Models (15 total)
- User - base for all roles (whatsapp unique, passwordHash, role, status, soft-delete isDeleted)
- RefreshToken - tokenHash (bcrypt), deviceInfo, isRevoked
- Customer - completedOrders, totalFeesPaid, address (lat/lng/description)
- Runner - status, isVisible (hidden from customer lists), avgRating
- Admin - simple role marker
- CustomerAddress - customer delivery address (lat/lng/description)
- Order - seqNumber (autoincrement), orderNumber (FW-XXXXXX), status, pricing fields (baseFee/peripheralFee/extraStoresFee/totalFee), delivery snapshot, preferredRunner, timestamps
- OrderItem - itemName, quantity (free text), customStoreName, anyStore flag, isCancelled
- OrderStore - storeName (free text), isAnyStore, status, isExtra (+20 fee), purchasedAt
- Receipt - imageUrl (R2), r2Key, soft-delete
- Rating - stars (1-5), note (admin-only), expiresAt (24h), isFinal
- LedgerEntry - append-only (no updatedAt, no deletes ever), type, amount, description, meta (JSON)
- Settlement - runnerId, operationalDate (YYYY-MM-DD, Damascus time), status, totals; unique([runnerId, operationalDate])
- SettlementItem - per-order breakdown (orderFee, runnerShare, platformShare)
- AuditLog - append-only, orderId, actor, actorRole, event, fromStatus, toStatus, meta

### Critical Data Rules
- Soft delete only - isDeleted flag; no hard deletes in production data.
- AuditLog and LedgerEntry are never deleted, ever.
- orderNumber generated from seqNumber inside a transaction after save: FW-.
- All monetary amounts are Int (Syrian Pounds, integer).
- Ledger is append-only - no UPDATE, no DELETE.

## 5. State Machines (CRITICAL - all changes MUST go through these)

### 5.1 Order State Machine
DRAFT -> [customer submits] -> PENDING_REVIEW -> [admin opens for review] -> UNDER_REVIEW
From UNDER_REVIEW:
  - [admin rejects] -> CANCELLED
  - [admin approves + any runner] -> AWAITING_RUNNER
  - [admin approves + preferred runner unavailable] -> AWAITING_PREFERRED_RUNNER
From AWAITING_PREFERRED_RUNNER -> [available / customer changes mind] -> ASSIGNED
From AWAITING_RUNNER -> [admin assigns] -> ASSIGNED
From ASSIGNED:
  - [customer cancels] -> CANCELLED
  - [runner taps started] -> IN_PROGRESS
From IN_PROGRESS:
  - [admin cancels] -> CANCELLED
  - [runner taps proceed to delivery] -> OUT_FOR_DELIVERY
From OUT_FOR_DELIVERY:
  - [admin cancels] -> CANCELLED
  - [runner taps delivered] -> DELIVERED (final)

Strict rules:
- Customer can cancel from PENDING_REVIEW and ASSIGNED only.
- After IN_PROGRESS, cancellation is admin-only.
- DELIVERED is final - no reversal in the app.
- Every transition is logged to AuditLog with actor + timestamp.
- DELIVERED duplicate detection: a second PUT /deliver returns 409 ORDER_ALREADY_DELIVERED.
  ⚠️ Known limitation (BUG-016, confirmed S3.15): the "safe" path (idempotent: true)
  is unreachable due to a pre-transaction check. The 409 prevents duplicate financial
  entries but does not return an idempotent success response.
- Idempotency on other state transitions (purchaseStore, proceedToDelivery, startOrder):
  no idempotencyKey defined; duplicate calls return clean 422 (Design Gap, Phase 3).

### 5.2 OrderStore State Machine
PENDING -> [runner taps purchased] -> PURCHASED (final)
PENDING -> [runner taps skipped] -> SKIPPED (final)
- Before PURCHASED, the store can be deleted if added by mistake.
- After PURCHASED, no reversal - any correction goes through admin.

### 5.3 Runner Status Machine
UNAVAILABLE -> [runner taps available] -> AVAILABLE -> [admin assigns runner to order] -> ON_MISSION
ON_MISSION -> [order reaches DELIVERED or CANCELLED] -> AVAILABLE (automatic)

## 6. Authentication & Authorization

### 6.1 Auth Flow
- Customer registration: name, whatsapp, password (min 8), address. Account created as PENDING_VERIFICATION. Customer sends a message from their WhatsApp number to the admin WhatsApp (outside the app). Admin verifies and taps activate; status becomes VERIFIED; customer gets a WebSocket notification.
- Runner accounts: admin-only, created from the admin panel.
- JWT strategy - always-logged-in experience with full security:
  - On successful login: Access Token (JWT RS256, valid 2 hours) + Refresh Token (random 64-byte string, no expiry). The hash of the refresh token is stored in the RefreshToken table.
  - When the access token expires (every 2 hours, silently in the background): the app sends the refresh token automatically; the server checks the DB (exists + not revoked); generates a new access token; the user feels nothing.
  - On manual logout: isRevoked = true on the refresh token.
  - Emergency revocation by admin (e.g., stolen phone): revokes all refresh tokens for the user at once; session ends within 2 hours max.
  - Why 2 hours and not 30 days? The refresh token is what keeps the user logged in forever - it is stored hashed in the DB and can be revoked instantly. The short access token ensures that if stolen, it works for at most 2 hours.

### 6.2 Permissions (enforced on the server, not just the frontend)
| Operation | CUSTOMER | RUNNER | ADMIN |
|-----------|----------|--------|-------|
| Create order | Yes (own account only) | No | Yes |
| View order details | own orders only | own orders only | all |
| Change order status | limited | limited | Yes |
| Cancel order | Yes (PENDING_REVIEW, ASSIGNED) | No | Yes |
| Activate customer account | No | No | Yes |
| Create runner account | No | No | Yes |
| View Ledger | No | limited (own share) | Yes |
| Close settlement | No | No | Yes |
| View rating notes | No | No | Yes |

## 7. Pricing Engine

const PRICING = {
  BASE_FEE: 60,
  PERIPHERAL_FEE: 40,
  EXTRA_STORE_FEE: 20,
  RUNNER_SHARE: 0.75,
  PLATFORM_SHARE: 0.25,
};

function calculateFee({ isPeripheral, purchasedStoreCount }) {
  const baseFee = 60;
  const peripheralFee = isPeripheral ? 40 : 0;
  const extraStoresFee = Math.max(0, purchasedStoreCount - 1) * 20;
  const totalFee = baseFee + peripheralFee + extraStoresFee;
  return {
    baseFee, peripheralFee, extraStoresFee, totalFee,
    runnerShare: Math.floor(totalFee * 0.75),
    platformShare: Math.ceil(totalFee * 0.25),
  };
}

When the fee is recalculated:
- On order creation - initial estimate (no peripheral yet)
- When admin approves with isPeripheral set - fee may change
- Every time an OrderStore becomes PURCHASED - adds +20 if it is an extra store
- On delivery - final fee is locked in

Customer is notified via WebSocket on every fee change.

## 8. API Standards

- Base URL: /api/v1
- Format: JSON
- Auth: Authorization: Bearer (accessToken) (except /auth/*)
- Input validation: Zod validation on every input (query, path, body)
- Standardized error format: { statusCode, error, message }
  - 400 VALIDATION_ERROR - invalid request data
  - 401 UNAUTHORIZED - session expired or no token
  - 403 FORBIDDEN - not permitted
  - 404 NOT_FOUND - resource not found
  - 409 CONFLICT - duplicate (e.g., delivered sent twice)
  - 422 BUSINESS_RULE_VIOLATION - rule broken (e.g., cancel after IN_PROGRESS)
  - 500 INTERNAL_SERVER_ERROR - server errors

Pagination (on list endpoints): page (default 1), limit (default 20, max 100).
Response always includes data + meta (total, page, limit, totalPages).

### Completed Endpoints (All MVP Sprints & Active Production API)

Auth & Users:
- POST /auth/register - register customer (201, PENDING_VERIFICATION)
- POST /auth/login - login (JWT RS256 access, 64-byte refresh)
- POST /auth/refresh - refresh access token
- POST /auth/logout - logout (revokes refresh token)
- GET /admin/users - list customers (paginated)
- GET /admin/users/:id - customer details
- PUT /admin/users/:id/verify - verify account
- PUT /admin/users/:id/reject - reject account
- PUT /admin/users/:id/suspend - suspend account (revokes tokens)
- PUT /admin/users/:id/unsuspend - unsuspend account
- GET /admin/runners - list runners (paginated)
- POST /admin/runners - create runner
- PUT /admin/runners/:id - update runner
- PUT /admin/runners/:id/visibility - toggle runner visibility

Customer:
- GET /customer/me, PUT /customer/me
- GET/PUT /customer/me/address
- GET /customer/runners
- GET /customer/orders, GET /customer/orders/:id
- POST /customer/orders, DELETE /customer/orders/:id (cancel if draft/pending review)
- POST /customer/orders/:id/ratings, PUT /customer/orders/:id/ratings

Runner:
- GET /runner/me, PUT /runner/me/status
- GET /runner/orders/active
- PUT /runner/orders/:id/start
- GET /runner/orders/:id/stores
- POST /runner/orders/:id/stores
- DELETE /runner/orders/:id/stores/:storeId
- PUT /runner/orders/:id/stores/:storeId/purchase
- PUT /runner/orders/:id/stores/:storeId/skip
- POST /runner/orders/:id/stores/:storeId/receipts (postponed until R2 operational)
- DELETE /runner/orders/:id/stores/:storeId/receipts/:receiptId
- POST /runner/orders/:id/items
- PUT /runner/orders/:id/proceed-to-delivery
- PUT /runner/orders/:id/deliver
- GET /runner/settlements, GET /runner/settlements/current

Admin & Operations:
- GET /admin/dashboard
- GET /admin/orders, GET /admin/orders/:id
- GET /admin/orders/:id/audit
- PUT /admin/orders/:id/approve
- PUT /admin/orders/:id/reject
- PUT /admin/orders/:id/assign-runner
- PUT /admin/orders/:id/cancel
- GET /admin/settlements, GET /admin/settlements/pending
- POST /admin/settlements/close-day
- PUT /admin/settlements/:id/mark-settled
- GET /admin/ledger

## 9. WebSocket Events (Socket.IO)

Auth on connect: token = accessToken in the auth header.

Namespaces:
- /orders - order events (customer + runner + admin)
- /admin - admin-only events

Events sent to Customer (joins room customer:{customerId}):
- order:status_changed - { orderId, orderNumber, newStatus, oldStatus }
- order:runner_assigned - { orderId, runnerName }
- order:fee_updated - { orderId, oldFee, newFee, reason }
- order:store_purchased - { orderId, storeName }
- order:out_for_delivery - { orderId }
- order:delivered - { orderId, deliveredAt }
- order:cancelled - { orderId, reason, cancelledBy }
- account:verified - { message }

Events sent to Runner (joins room runner:{runnerId}):
- order:assigned - { orderId, orderNumber, customerName, deliveryAddress, items, estimatedFee }
- order:reassigned - { orderId }
- order:assignment_cancelled - { orderId, reason }

Events sent to Admin (joins room admin:all):
- order:new - { orderId, orderNumber, customerName, itemCount }
- order:status_changed - { orderId, orderNumber, newStatus }
- order:needs_attention - { orderId, reason }
- user:new_registration - { userId, userName, whatsapp }
- settlement:reminder - { date, pendingRunnerCount }

Notification sounds (played locally by the frontend): new_order, status_update, urgent, success.

## 10. Audit Log Events

Every state transition and significant action creates an AuditLog entry. Event codes:

Order lifecycle:
ORDER_CREATED, ORDER_SUBMITTED, ORDER_REVIEW_STARTED, ORDER_APPROVED, ORDER_REJECTED,
ORDER_PERIPHERAL_SET, ORDER_FEE_UPDATED, RUNNER_ASSIGNED, RUNNER_REASSIGNED,
ORDER_STARTED, ORDER_CANCELLED, ORDER_DELIVERED

Stores/purchases:
STORE_ADDED, STORE_REMOVED, STORE_PURCHASED, STORE_SKIPPED, ITEM_CANCELLED,
RECEIPT_UPLOADED, RECEIPT_DELETED, PROCEEDED_TO_DELIVERY

Financial:
LEDGER_ENTRY_CREATED, SETTLEMENT_CLOSED, SETTLEMENT_MARKED_SETTLED

Accounts:
USER_VERIFIED, USER_REJECTED, USER_SUSPENDED, TOKEN_REVOKED

## 11. Financial Operations (Settlement)

orderNumber generation (inside a transaction after save):
  const orderNumber = 'FW-' + String(order.seqNumber).padStart(6, '0');
  // seqNumber is autoincrement - PostgreSQL guarantees uniqueness.

closeSettlementDay(date, adminId):
  1. Find all DELIVERED orders with operationalDate = date
  2. Group by runnerId
  3. For each runner: create Settlement + SettlementItems + LedgerEntries
     (RUNNER_SHARE 75%, PLATFORM_SHARE 25%)
  4. Log AuditLog
  5. Notify admin via WebSocket
  ⚠️ TODO (Sprint 4): قبل early return للـ Settlement الموجود، تحقق من DELIVERED orders التي لا تملك SettlementItems وأضفها قبل تخطي الـ runner.
  Idempotent: if a Settlement already exists for this runner + date, skip.

operationalDate (the business day):
- Determined by the order's createdAt (Damascus time), NOT deliveredAt.
- An order created before midnight Damascus belongs to that day even if delivered after midnight.
- All dates stored as UTC in DB; operationalDate in Settlement is calculated as Asia/Damascus.
- Example: order created 2025-09-10 23:45 Damascus, delivered 2025-09-11 00:15 -> operationalDate = 2025-09-10.

Cron reminder: runs daily at 23:00 Damascus time. If there are pending orders for the day, notifies admin via WebSocket.

## 12. Security

1. Helmet.js - HTTP security headers
2. Rate limiting:
   - /auth/login: 10 attempts / 15 min per IP
   - /auth/register: 3 attempts / hour per IP
   - all other endpoints: 100 requests / minute
   3. Input validation: Zod validation on every input (query, path, body)
4. SQL injection: fully protected via Prisma
5. Passwords: bcrypt (12 rounds)
6. JWT: RS256 (private/public key pair) - Access Token valid 2 hours only
7. R2 URLs: short-lived presigned URLs (5 minutes)
8. HTTPS mandatory in production
9. Environment variables for all secrets - no secrets in code or Git
10. CORS: restricted to approved origins only
11. Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
12. Central exception handling: Prisma P2002 (unique violation) → 409 CONFLICT
    (implemented via AllExceptionsFilter, post-review F1)
13. All API error messages and Zod validation messages: Arabic (post-review F4/F5/F6)
14. Field paths in validation errors: localized to Arabic (e.g., "المواد[0].اسم المادة")
15. Database connection pooling: connection_limit in DATABASE_URL for Railway load

## 13. Deployment

Backend (NestJS + PostgreSQL): Railway
- Service 1: Node.js App (NestJS)
- Service 2: PostgreSQL plugin with connection_limit=10 in DATABASE_URL
- Environment: production secrets in Railway Variables
- Port: 3000 internally; Railway provides automatic HTTPS

Admin Dashboard (Next.js): Vercel
- Connects to backend API via HTTPS
- Connects to WebSocket via WSS

Runner PWA (React + Vite): Vercel
- Connects to backend API via HTTPS
- Connects to WebSocket via WSS

Receipts Storage: Cloudflare R2
- Bucket: fawrun-receipts
- Access via API token

Error Tracking: Sentry
- Backend DSN: in env variables
- Frontend DSN: in env variables

Required Environment Variables:
# Backend
DATABASE_URL=          # includes connection_limit=10
JWT_PRIVATE_KEY=
JWT_PUBLIC_KEY=
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
SENTRY_DSN=

# Admin + Runner PWA
NEXT_PUBLIC_API_URL=
NEXT_PUBLIC_WS_URL=

## 14. Sprint Roadmap

Sprint 1 - Foundation (2 weeks) - COMPLETED
- Monorepo setup (pnpm + Turborepo)
- NestJS skeleton + Prisma schema + first migration
- Auth module: Register, Login, Refresh (automatic), Logout
- Manual WhatsApp verification
- Basic WebSocket gateway
- Admin: user management + account activation

Sprint 2 - Order Core (2 weeks) - COMPLETED
- Complete Order State Machine
- Customer: create order + free-text store names + location
- Admin: review + approve + set peripheral + assign runner
- Pricing Engine
- Audit Log
- OpenStreetMap + Leaflet integration

Sprint 3 - Execution Flow (2 weeks) - COMPLETED
- Runner: receive tasks + start execution
- Runner: manage OrderStores (purchase, skip, add)
- Runner: upload receipts (Cloudflare R2)
- Runner: proceed to delivery + confirm delivery
- Complete WebSocket events + notification sounds
- LedgerEntry for every completed order

Sprint 4 - Financial + Ratings (1 week) - COMPLETED
- Complete Settlement module
- Cron job for settlement reminder
- Rating system (runner only)
- Customer: order history + details
- Runner: daily settlement report

Sprint 5 - Frontends (3 weeks) - COMPLETED
- Admin Dashboard (Next.js) - 1 week
- Runner PWA (React + Vite) - 1 week
- Customer Web (React + Vite) - 1 week
- الواجهات الثلاث (Admin, Runner, Customer) منشورة على Vercel

Sprint 6 - QA + Launch (1 week) - COMPLETED
- Integration tests for State Machine and Pricing
- Security review & Privacy/Lifecycle masking
- Performance baseline & Load test suites
- Production deployment on Railway + Vercel
- Pre-launch staging & verification

### Android track - separate numbering (does NOT use `Sprint N`)

Android sprints are numbered **8A..10** independently of the backend `Sprint 1..6` above.
**Do not mix the two numberings** - "Sprint 8" in this repository always means Android.

| Android Sprint | Status | Scope |
|---|---|---|
| 8A - 8C | ✅ COMPLETED (merged to `master` at `e5bfbc1`) | Full customer app: 15 screens, MVVM + Hilt, Retrofit + JWT refresh, WebSocket + reconnection, MapLibre/OSM. 223 @Test. |
| 8D - 8F | ✅ COMPLETED (merged to `master`) | App hardening, offline banner/lifecycle resilience, signed APK release build (3 ABI). Ready for distribution / Firebase link. |
| 10 | 📋 PLANNED | Production pilot rollout & operational field telemetry. |

Android QA and release items are delegated to `docs/android/ROADMAP.md`.

## 15. Coding Rules (Spec Section 17)

1. Server is source of truth - never compute fees or change states on the frontend only.
2. Every state change goes through the State Machine - never mutate the status field directly in a service without going through the machine.
3. Every financial operation = LedgerEntry - no financial operation without a Ledger record.
4. Use transactions for composite operations - assign runner + update status + AuditLog = one transaction.
5. Idempotency - the delivered operation returns 409 on duplicate; the safe idempotent
   path is currently unreachable (BUG-016). Other state transitions rely on clean 422
   rejection (Design Gap).
6. No history deletion - soft delete only. AuditLog and LedgerEntry: never delete.
7. orderNumber is generated from seqNumber - always inside a transaction, right after save.
8. Automatic refresh token - the frontend refreshes the access token silently 10 minutes before it expires.
9. No stores in the database - store names are always free text in OrderStore.storeName.
10. shared-types first - any new DTO is written in packages/shared-types and used by both server and frontends.
11. API versioning respected - every endpoint under /api/v1/ without exception.
12. Zod on every input - never trust any incoming data, no matter the source.
13. Environment variables only for secrets - no keys in code or in Git.

## 17. Development Workflow

1. code-architect runs /pre-sprint (runs pre-sprint-checklist)
2. feature-dev implements endpoints
3. test-engineer runs full local checklist (lint, typecheck, test, db:generate + security)
4. /pr command: commit + push + create PR + wait for CodeRabbit
5. CodeRabbit reviews on GitHub (not locally)
6. Kilo reads CodeRabbit comments and fixes them
7. Merge to main

Git rules:
- Semantic commits: feat:, fix:, refactor:, etc.
- Branch per Sprint: feature/sprint-N-
- Branch per sprint, then `git merge --no-ff` to master (no fast-forward - keeps the merge history visible)
- Use /pr command to ensure full workflow
- Wait for CodeRabbit review before merge

Commands:
- pnpm build - build all packages
- pnpm dev - start all apps in dev mode
- pnpm lint - lint all code
- pnpm typecheck - type check all code
- pnpm test - run all tests
- pnpm db:generate - generate Prisma client
- pnpm db:push - push schema to DB

⚠️ Note: The local review workflow currently uses direct commits
to master. CodeRabbit / PR workflow described here is historical and may not reflect
current practice.

## 18. Agents, Commands & Skills

Agents:
- @code-architect - Sprint planning, schema design, state machine validation
- @feature-dev - Endpoint implementation
- @test-engineer - Tests, lint, typecheck, security checks
- @debugger - Bug investigation (on-demand only)
- @reviewer - CodeRabbit review loop agent

Commands:
- /pre-sprint - Run pre-sprint checklist
- /rollback-plan - Create rollback plan for financial ops
- /pr - Full PR workflow with CodeRabbit

Skills:
- pre-sprint-checklist - Pre-Sprint validation
- rollback-plan - Financial rollback documentation
- coderabbit-workflow - PR workflow with CodeRabbit review

## 19. How to Use This Brief

This file is a condensed English summary of the FORERUN project, intended for another AI tool to understand the project quickly. It covers:
- What FORERUN is and its business model
- Architecture and tech stack
- Data model (Prisma schema) and critical data rules
- The three State Machines (Order, OrderStore, Runner) - the most critical part
- Authentication and authorization
- Pricing Engine
- API standards and endpoint list
- WebSocket events
- Audit log events
- Financial operations (Settlement)
- Security
- Deployment
- Sprint roadmap (1-6)
- Coding rules (Spec Section 17)
- Current status
- Development workflow
- Agents, commands, and skills

For the full detail, refer to:
- FORERUN - MVP Technical Specification.txt (the authoritative spec, mostly Arabic)
- PROJECT_STATUS.md (current project and sprint status)
- AGENTS.md (coding standards and workflow)
- .kilo/agent/*.md, .kilo/command/*.md, .kilo/skills/*/SKILL.md (agent/command/skill definitions)

## 20. Known Limitations

### Deferred (low priority)
- BUG-001: R2 delete inside transaction (perf).
- BUG-002: SettlementItem loop instead of createMany (perf).
- BUG-004: RATE_LIMIT_GENERAL orphan constant.
- BUG-005: order:needs_attention cron TODO.
- BUG-008: Duplicate ORDER_SUBMITTED audit entry.
- BUG-010: Approve button performs two transitions (UX decision).
- BUG-023: Latent stored XSS on user.name (no exploit path in current React code).
- RefreshToken cleanup: 28+ records per user; needs a scheduled cleanup job.

### Deferred by product decision — after MVP (2026-09-30)
- **Receipt upload (Cloudflare R2) is postponed until after MVP.** The code exists and passes review, but it is not operationally enabled: `r2.service.ts:32` throws while `R2_*` remains `<dummy-for-now>`. Decision and consequences recorded in [PROJECT_STATUS.md §12 · D5](PROJECT_STATUS.md#12-سجل-القرارات).
- Consequences to keep in mind before MVP: (1) `ReceiptUploader.tsx:44` leaks the raw backend config error to runners in English; (2) the Android customer app renders receipt lists that will always be empty (`OrderModels.kt:89,98`).

### Known coverage gaps
- WebSocket notifications: not tested.
- Order reassignment: not tested.
- F2-part1: code-verified only (no behavioral test).
- Performance / load testing: not performed.
