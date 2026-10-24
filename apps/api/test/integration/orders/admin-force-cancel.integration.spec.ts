import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { INestApplication } from '@nestjs/common';
import { PrismaClient, OrderStatus, UserRole, UserStatus, LedgerEntryType } from '@prisma/client';
import supertest from 'supertest';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../../src/database/prisma.service';
import { createTestApp, closeTestApp } from '../helpers/app.helper';
import { seedAdmin, seedRunner, seedCustomer, loginAs } from '../helpers/seed.helper';
import { cleanDatabase } from '../setup';

describe('Admin Force Cancel Order Integration Tests (Decision D39)', () => {
  let app: INestApplication;
  let request: ReturnType<typeof supertest>;
  let prisma: PrismaClient;

  let adminToken: string;
  let adminUserId: string;
  let customerToken: string;
  let runnerToken: string;
  let customerId: string;
  let runnerId: string;

  beforeAll(async () => {
    app = await createTestApp();
    request = supertest(app.getHttpServer());
    prisma = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_URL_TEST || process.env.DATABASE_URL } },
    });
    await prisma.$connect();
    await cleanDatabase();

    // 1. Seed Admin
    const adminUser = await seedAdmin(prisma);
    adminUserId = adminUser.id;
    adminToken = await loginAs(request, adminUser.whatsapp, 'Admin@12345');

    // 2. Seed Customer
    const uCustomer = await seedCustomer(prisma);
    customerId = uCustomer.customer!.id;
    customerToken = await loginAs(request, uCustomer.whatsapp, 'Customer@12345');

    // 3. Seed Runner
    const hash = await bcrypt.hash('Runner@12345', 12);
    const uRunner = await prisma.user.create({
      data: {
        name: 'Speedy Runner',
        whatsapp: '0981999888',
        passwordHash: hash,
        role: UserRole.RUNNER,
        status: UserStatus.VERIFIED,
        runner: {
          create: {
            status: 'AVAILABLE',
            isVisible: true,
          },
        },
      },
      include: { runner: true },
    });
    runnerId = uRunner.runner!.id;
    runnerToken = await loginAs(request, '0981999888', 'Runner@12345');
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await closeTestApp();
  });

  let counter = 1;
  async function createTestOrder(status: OrderStatus, customRunnerId?: string) {
    const seq = counter++;
    return prisma.order.create({
      data: {
        customerId,
        runnerId: customRunnerId,
        status,
        orderNumber: `FW-D39-${status}-${seq}`,
        deliveryLat: 33.5138,
        deliveryLng: 36.2765,
        deliveryDesc: 'Test Address Damascus',
        baseFee: 60,
        totalFee: 60,
        deliveredAt: status === OrderStatus.DELIVERED ? new Date() : null,
      },
    });
  }

  // ── 1. Successful cancellation from every allowed state ───────────────────
  describe('Admin force cancel from each lifecycle state', () => {
    const states: OrderStatus[] = [
      OrderStatus.DRAFT,
      OrderStatus.PENDING_REVIEW,
      OrderStatus.UNDER_REVIEW,
      OrderStatus.AWAITING_RUNNER,
      OrderStatus.AWAITING_PREFERRED_RUNNER,
      OrderStatus.ASSIGNED,
      OrderStatus.IN_PROGRESS,
      OrderStatus.OUT_FOR_DELIVERY,
      OrderStatus.DELIVERED,
    ];

    it.each(states)('successfully cancels order from state %s', async (fromStatus) => {
      // In states that require a runner, assign the runner
      const needsRunner = ['ASSIGNED', 'IN_PROGRESS', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(
        fromStatus,
      );
      if (needsRunner && ['ASSIGNED', 'IN_PROGRESS', 'OUT_FOR_DELIVERY'].includes(fromStatus)) {
        await prisma.runner.update({
          where: { id: runnerId },
          data: { status: 'ON_MISSION' },
        });
      }

      const order = await createTestOrder(fromStatus, needsRunner ? runnerId : undefined);

      const res = await request
        .put(`/api/v1/admin/orders/${order.id}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          reason: `Admin force cancellation from ${fromStatus}`,
        });

      expect(res.status).toBe(200);
      expect(res.body.order.status).toBe('CANCELLED');

      // Verify in DB
      const dbOrder = await prisma.order.findUnique({ where: { id: order.id } });
      expect(dbOrder!.status).toBe(OrderStatus.CANCELLED);
      expect(dbOrder!.cancelledByUserId).toBe(adminUserId);
      expect(dbOrder!.cancelReason).toBe(`Admin force cancellation from ${fromStatus}`);
      expect(dbOrder!.cancelledAt).toBeInstanceOf(Date);

      // Verify runner freed only for active missions
      if (['ASSIGNED', 'IN_PROGRESS', 'OUT_FOR_DELIVERY'].includes(fromStatus)) {
        const dbRunner = await prisma.runner.findUnique({ where: { id: runnerId } });
        expect(dbRunner!.status).toBe('AVAILABLE');
      }
    });
  });

  // ── 2. Concurrent double cancellation ─────────────────────────────────────
  describe('Concurrency & Idempotency guard', () => {
    it('concurrent double cancellation: first succeeds, second returns 409 Conflict', async () => {
      const order = await createTestOrder(OrderStatus.AWAITING_RUNNER);

      const [res1, res2] = await Promise.all([
        request
          .put(`/api/v1/admin/orders/${order.id}/cancel`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ reason: 'Concurrent request 1' }),
        request
          .put(`/api/v1/admin/orders/${order.id}/cancel`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ reason: 'Concurrent request 2' }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([200, 409]);

      const conflictRes = res1.status === 409 ? res1 : res2;
      expect(conflictRes.body.message).toBe('ORDER_ALREADY_CANCELLED');
    });

    it('returns 409 when attempting to cancel an already CANCELLED order', async () => {
      const order = await createTestOrder(OrderStatus.CANCELLED);

      const res = await request
        .put(`/api/v1/admin/orders/${order.id}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Attempting to cancel already cancelled' });

      expect(res.status).toBe(409);
      expect(res.body.message).toBe('ORDER_ALREADY_CANCELLED');
    });

    it('concurrent status transition: fails with 409 Conflict when order transitions to DELIVERED before cancellation update', async () => {
      // 1. Create order in ASSIGNED state with runner
      await prisma.runner.update({
        where: { id: runnerId },
        data: { status: 'ON_MISSION' },
      });
      const order = await createTestOrder(OrderStatus.ASSIGNED, runnerId);

      // 2. Intercept Prisma transaction to simulate race condition:
      // Read order as ASSIGNED, then an external concurrent transaction completes delivery
      const prismaService = app.get(PrismaService);
      const realTransaction = prismaService.$transaction.bind(prismaService);

      const transactionSpy = vi.spyOn(prismaService, '$transaction').mockImplementation(async (cb: any, options?: any) => {
        return realTransaction(async (tx: any) => {
          const origFindUnique = tx.order.findUnique.bind(tx.order);
          tx.order.findUnique = async (...args: any[]) => {
            const foundOrder = await origFindUnique(...args);
            // Simulate parallel transaction completing delivery before cancellation update
            await prisma.order.update({
              where: { id: order.id },
              data: {
                status: OrderStatus.DELIVERED,
                deliveredAt: new Date(),
              },
            });
            return foundOrder;
          };
          return cb(tx);
        }, options);
      });

      try {
        const res = await request
          .put(`/api/v1/admin/orders/${order.id}/cancel`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ reason: 'Admin attempting cancel during concurrent delivery' });

        expect(res.status).toBe(409);
        expect(res.body.message).toBe('ORDER_STATUS_CHANGED_CONCURRENTLY');

        // Confirm database integrity: Order remains DELIVERED and was NOT overwritten to CANCELLED
        const dbOrder = await prisma.order.findUnique({
          where: { id: order.id },
        });
        expect(dbOrder!.status).toBe(OrderStatus.DELIVERED);
        expect(dbOrder!.cancelledAt).toBeNull();
      } finally {
        transactionSpy.mockRestore();
      }
    });
  });

  // ── 3. Non-existent order returns 404 ─────────────────────────────────────
  describe('Not Found', () => {
    it('returns 404 when order does not exist', async () => {
      const res = await request
        .put('/api/v1/admin/orders/non-existent-order-id/cancel')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Cancelling non-existent order' });

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Order not found');
    });
  });

  // ── 4. Financial immutability: LedgerEntry untouched after DELIVERED cancellation
  describe('Financial Safety (Decision D39 & Rule 3)', () => {
    it('preserves existing LedgerEntry for DELIVERED order without any modification or reversal', async () => {
      const order = await createTestOrder(OrderStatus.DELIVERED, runnerId);

      // Seed an append-only LedgerEntry simulating order delivery fee (D25)
      const ledgerEntry = await prisma.ledgerEntry.create({
        data: {
          orderId: order.id,
          runnerId,
          type: LedgerEntryType.ORDER_FEE_TOTAL,
          amount: 60,
          description: 'Delivery fee snapshot for order',
          meta: { originalFee: 60 },
        },
      });

      // Admin force-cancels the DELIVERED order
      const res = await request
        .put(`/api/v1/admin/orders/${order.id}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Disputed delivery - cancelled by admin' });

      expect(res.status).toBe(200);

      // Verify the LedgerEntry is 100% untouched
      const dbEntries = await prisma.ledgerEntry.findMany({
        where: { orderId: order.id },
      });
      expect(dbEntries).toHaveLength(1);
      expect(dbEntries[0].id).toBe(ledgerEntry.id);
      expect(dbEntries[0].amount).toBe(60);
      expect(dbEntries[0].type).toBe(LedgerEntryType.ORDER_FEE_TOTAL);
      expect(dbEntries[0].description).toBe('Delivery fee snapshot for order');
    });
  });

  // ── 5. AuditLog verification ─────────────────────────────────────────────
  describe('AuditLog Record', () => {
    it('records ORDER_FORCE_CANCELLED_BY_ADMIN with actorId = user.userId, previousStatus, and reason', async () => {
      const order = await createTestOrder(OrderStatus.IN_PROGRESS, runnerId);
      await prisma.runner.update({
        where: { id: runnerId },
        data: { status: 'ON_MISSION' },
      });

      const cancelReason = 'Customer requested cancellation due to store item stock issue';
      const res = await request
        .put(`/api/v1/admin/orders/${order.id}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: cancelReason });

      expect(res.status).toBe(200);

      const auditLog = await prisma.auditLog.findFirst({
        where: {
          orderId: order.id,
          event: 'ORDER_FORCE_CANCELLED_BY_ADMIN',
        },
      });

      expect(auditLog).toBeDefined();
      expect(auditLog!.actorId).toBe(adminUserId);
      expect(auditLog!.actorRole).toBe('ADMIN');
      expect(auditLog!.fromStatus).toBe(OrderStatus.IN_PROGRESS);
      expect(auditLog!.toStatus).toBe(OrderStatus.CANCELLED);

      const meta = auditLog!.meta as Record<string, unknown>;
      expect(meta.previousStatus).toBe(OrderStatus.IN_PROGRESS);
      expect(meta.reason).toBe(cancelReason);
      expect(meta.orderNumber).toBe(order.orderNumber);
      expect(meta.action).toBe('ORDER_FORCE_CANCELLED_BY_ADMIN');
    });
  });

  // ── 6. RBAC & Input Validation ────────────────────────────────────────────
  describe('RBAC & Input Validation', () => {
    it('returns 403 when customer attempts to call admin cancel endpoint', async () => {
      const order = await createTestOrder(OrderStatus.AWAITING_RUNNER);

      const res = await request
        .put(`/api/v1/admin/orders/${order.id}/cancel`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ reason: 'Customer trying to force cancel via admin endpoint' });

      expect(res.status).toBe(403);
    });

    it('returns 403 when runner attempts to call admin cancel endpoint', async () => {
      const order = await createTestOrder(OrderStatus.AWAITING_RUNNER);

      const res = await request
        .put(`/api/v1/admin/orders/${order.id}/cancel`)
        .set('Authorization', `Bearer ${runnerToken}`)
        .send({ reason: 'Runner trying to force cancel via admin endpoint' });

      expect(res.status).toBe(403);
    });

    it('returns 401 when request has no authorization header', async () => {
      const order = await createTestOrder(OrderStatus.AWAITING_RUNNER);

      const res = await request
        .put(`/api/v1/admin/orders/${order.id}/cancel`)
        .send({ reason: 'No auth' });

      expect(res.status).toBe(401);
    });

    it('returns 400 when reason is missing or shorter than 3 characters', async () => {
      const order = await createTestOrder(OrderStatus.AWAITING_RUNNER);

      const resEmpty = await request
        .put(`/api/v1/admin/orders/${order.id}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(resEmpty.status).toBe(400);

      const resShort = await request
        .put(`/api/v1/admin/orders/${order.id}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'no' });

      expect(resShort.status).toBe(400);
    });
  });
});
