import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { INestApplication } from '@nestjs/common';
import { PrismaClient, OrderStatus } from '@prisma/client';
import supertest from 'supertest';
import { createTestApp, closeTestApp } from '../helpers/app.helper';
import { seedAdmin, seedRunner, seedCustomer, loginAs } from '../helpers/seed.helper';
import { cleanDatabase } from '../setup';

describe('Audit: Settlement closeDay Remediation & Zero Drift Verification (Post-Fix)', () => {
  let app: INestApplication;
  let request: ReturnType<typeof supertest>;
  let prisma: PrismaClient;

  beforeAll(async () => {
    app = await createTestApp();
    request = supertest(app.getHttpServer());
    prisma = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_URL_TEST || process.env.DATABASE_URL } },
    });
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await closeTestApp();
  });

  it('proves zero-leak settlement: order created yesterday and delivered today is captured in today settlement, and re-closing is explicitly rejected (409)', async () => {
    await cleanDatabase();
    const admin = await seedAdmin(prisma);
    const runner = await seedRunner(prisma);
    const customer = await seedCustomer(prisma);

    const yesterday = new Date('2026-10-10T12:00:00.000Z');
    const today = new Date('2026-10-11T12:00:00.000Z');

    // Order created yesterday, delivered today
    const order = await prisma.order.create({
      data: {
        customerId: customer.customer!.id,
        runnerId: runner.runner!.id,
        orderNumber: 'FW-FIX-13-001',
        status: OrderStatus.DELIVERED,
        deliveryLat: 33.5138,
        deliveryLng: 36.2765,
        deliveryDesc: 'Damascus Test Location',
        baseFee: 60,
        extraStoresFee: 0,
        totalFee: 60,
        createdAt: yesterday,
        deliveredAt: today,
      },
    });

    const adminToken = await loginAs(request, admin.whatsapp, 'Admin@12345');

    // 1. Run closeDay for TODAY
    const resToday = await request
      .post('/api/v1/admin/settlements/close-day')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        operationalDate: '2026-10-11',
        notes: 'Today settlement batch (post-fix)',
      });

    console.log('[POST-FIX CLOSE-DAY TODAY STATUS]:', resToday.status, resToday.body);
    expect(resToday.status).toBe(201);
    expect(resToday.body.runnerCount).toBe(1);
    expect(resToday.body.settlements).toHaveLength(1);
    expect(resToday.body.settlements[0].totalOrders).toBe(1);
    expect(resToday.body.settlements[0].totalFees).toBe(60);

    // Verify database record has settlement item linking the order
    const settlementItem = await prisma.settlementItem.findUnique({
      where: { orderId: order.id },
    });
    expect(settlementItem).not.toBeNull();
    expect(settlementItem?.orderFee).toBe(60);
    // Decision D26/D48: runnerShare/platformShare columns were dropped from SettlementItem in C-2 migration; verify orderFee matches settlement totalFees
    expect(settlementItem?.orderFee).toBe(resToday.body.settlements[0].totalFees);

    // 2. Attempting to re-close today must be explicitly rejected with 409 Conflict (no silent drop)
    const resReclose = await request
      .post('/api/v1/admin/settlements/close-day')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        operationalDate: '2026-10-11',
        notes: 'Attempted duplicate close',
      });

    console.log('[POST-FIX RE-CLOSE STATUS]:', resReclose.status, resReclose.body);
    expect(resReclose.status).toBe(409);
    expect(resReclose.body.message).toContain('already been closed');
  });

  it('proves carry-forward: late order delivered yesterday after yesterday was already closed is carried forward and settled today', async () => {
    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    const runner = await prisma.runner.findFirst();
    const customer = await prisma.customer.findFirst();
    const adminToken = await loginAs(request, admin!.whatsapp, 'Admin@12345');

    // Simulate closing day 2026-10-12 initially with no orders
    const resDay1 = await request
      .post('/api/v1/admin/settlements/close-day')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        operationalDate: '2026-10-12',
        notes: 'Day 12 close',
      });
    expect(resDay1.status).toBe(201);

    // A late order delivered on 2026-10-12 after the batch was run:
    const lateOrder = await prisma.order.create({
      data: {
        customerId: customer!.id,
        runnerId: runner!.id,
        orderNumber: 'FW-FIX-13-LATE',
        status: OrderStatus.DELIVERED,
        deliveryLat: 33.5138,
        deliveryLng: 36.2765,
        deliveryDesc: 'Late Damascus delivery',
        baseFee: 60,
        extraStoresFee: 20,
        totalFee: 80,
        createdAt: new Date('2026-10-12T10:00:00.000Z'),
        deliveredAt: new Date('2026-10-12T23:30:00.000Z'),
      },
    });

    // When running closeDay for 2026-10-13, the unsettled late delivered order is automatically carried forward
    const resDay2 = await request
      .post('/api/v1/admin/settlements/close-day')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        operationalDate: '2026-10-13',
        notes: 'Day 13 close with carried forward late order',
      });

    expect(resDay2.status).toBe(201);
    expect(resDay2.body.runnerCount).toBe(1);
    expect(resDay2.body.settlements[0].totalOrders).toBe(1);
    expect(resDay2.body.settlements[0].totalFees).toBe(80);

    const lateItem = await prisma.settlementItem.findUnique({
      where: { orderId: lateOrder.id },
    });
    expect(lateItem).not.toBeNull();
    expect(lateItem?.orderFee).toBe(80);
  });
});
