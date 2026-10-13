import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { INestApplication } from '@nestjs/common';
import { PrismaClient, OrderStatus, UserRole, UserStatus } from '@prisma/client';
import supertest from 'supertest';
import * as bcrypt from 'bcrypt';
import { createTestApp, closeTestApp } from '../helpers/app.helper';
import { seedRunner, seedCustomer, loginAs } from '../helpers/seed.helper';
import { cleanDatabase } from '../setup';

describe('Security Audit: Runner Contact Privacy Lifecycle Guard (D35)', () => {
  let app: INestApplication;
  let request: ReturnType<typeof supertest>;
  let prisma: PrismaClient;

  let customer1Token: string;
  let customer2Token: string;
  let customer1Id: string;
  let customer2Id: string;
  let runner1Id: string;
  const runnerWhatsapp = '0981571936';
  const runnerAltPhone = '0981571999';

  beforeAll(async () => {
    app = await createTestApp();
    request = supertest(app.getHttpServer());
    prisma = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_URL_TEST || process.env.DATABASE_URL } },
    });
    await prisma.$connect();
    await cleanDatabase();

    // 1. Seed Customer 1
    const uCust1 = await seedCustomer(prisma);
    customer1Id = uCust1.customer!.id;
    customer1Token = await loginAs(request, uCust1.whatsapp, 'Customer@12345');

    // 2. Seed Customer 2 (for IDOR tests)
    const hash = await bcrypt.hash('Password@12345', 12);
    const uCust2 = await prisma.user.create({
      data: {
        name: 'Attacker Customer Two',
        whatsapp: '0999000099',
        passwordHash: hash,
        role: UserRole.CUSTOMER,
        status: UserStatus.VERIFIED,
        customer: {
          create: {
            address: {
              create: { lat: 33.5, lng: 36.2, description: 'Addr 2' },
            },
          },
        },
      },
      include: { customer: true },
    });
    customer2Id = uCust2.customer!.id;
    customer2Token = await loginAs(request, '0999000099', 'Password@12345');

    // 3. Seed Runner with explicit WhatsApp and altPhone
    const uRunner = await prisma.user.create({
      data: {
        name: 'Ahmad Runner',
        whatsapp: runnerWhatsapp,
        altPhone: runnerAltPhone,
        passwordHash: hash,
        role: UserRole.RUNNER,
        status: UserStatus.VERIFIED,
        runner: {
          create: {
            status: 'AVAILABLE',
            isVisible: true,
            avgRating: 4.8,
            totalRatings: 15,
          },
        },
      },
      include: { runner: true },
    });
    runner1Id = uRunner.runner!.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await closeTestApp();
  });

  let orderCounter = 1;
  async function createOrderWithStatus(status: OrderStatus) {
    const seq = orderCounter++;
    return prisma.order.create({
      data: {
        customerId: customer1Id,
        runnerId: runner1Id,
        status,
        orderNumber: `FW-TEST-${status}-${seq}`,
        deliveryLat: 33.5138,
        deliveryLng: 36.2765,
        deliveryDesc: 'Test Address',
        baseFee: 60,
        totalFee: 60,
      },
    });
  }

  describe('Scenario 1: Active Order Statuses Expose Runner Contact to Order Owner', () => {
    const activeStatuses: OrderStatus[] = [
      OrderStatus.ASSIGNED,
      OrderStatus.IN_PROGRESS,
      OrderStatus.OUT_FOR_DELIVERY,
    ];

    for (const status of activeStatuses) {
      it(`exposes runner phone and whatsapp when order is in active status: ${status}`, async () => {
        const order = await createOrderWithStatus(status);

        // Test GET /customer/orders/:id
        const detailRes = await request
          .get(`/api/v1/customer/orders/${order.id}`)
          .set('Authorization', `Bearer ${customer1Token}`);

        expect(detailRes.status).toBe(200);
        expect(detailRes.body.runner).not.toBeNull();
        expect(detailRes.body.runner.id).toBe(runner1Id);
        expect(detailRes.body.runner.name).toBe('Ahmad Runner');
        expect(detailRes.body.runner.whatsapp).toBe(runnerWhatsapp);
        expect(detailRes.body.runner.phone).toBe(runnerAltPhone);

        // Test GET /customer/orders (list)
        const listRes = await request
          .get('/api/v1/customer/orders')
          .set('Authorization', `Bearer ${customer1Token}`);

        expect(listRes.status).toBe(200);
        const listOrder = listRes.body.data.find((o: any) => o.id === order.id);
        expect(listOrder).toBeDefined();
        expect(listOrder.runner).not.toBeNull();
        expect(listOrder.runner.whatsapp).toBe(runnerWhatsapp);
        expect(listOrder.runner.phone).toBe(runnerAltPhone);
      });
    }
  });

  describe('Scenario 2: Delivered Order Status Masks Runner Contact (Null)', () => {
    it('masks runner phone and whatsapp as null when order is DELIVERED, but preserves runner public info', async () => {
      const order = await createOrderWithStatus(OrderStatus.DELIVERED);

      // Test GET /customer/orders/:id
      const detailRes = await request
        .get(`/api/v1/customer/orders/${order.id}`)
        .set('Authorization', `Bearer ${customer1Token}`);

      expect(detailRes.status).toBe(200);
      expect(detailRes.body.runner).not.toBeNull();
      expect(detailRes.body.runner.id).toBe(runner1Id);
      expect(detailRes.body.runner.name).toBe('Ahmad Runner');
      // Crucial security invariant: contact details MUST be null
      expect(detailRes.body.runner.whatsapp).toBeNull();
      expect(detailRes.body.runner.phone).toBeNull();

      // Test GET /customer/orders (list)
      const listRes = await request
        .get('/api/v1/customer/orders')
        .set('Authorization', `Bearer ${customer1Token}`);

      expect(listRes.status).toBe(200);
      const listOrder = listRes.body.data.find((o: any) => o.id === order.id);
      expect(listOrder).toBeDefined();
      expect(listOrder.runner).not.toBeNull();
      expect(listOrder.runner.whatsapp).toBeNull();
      expect(listOrder.runner.phone).toBeNull();
    });
  });

  describe('Scenario 3: Cancelled Order Status Masks Runner Contact (Null)', () => {
    it('masks runner phone and whatsapp as null when order is CANCELLED', async () => {
      const order = await createOrderWithStatus(OrderStatus.CANCELLED);

      // Test GET /customer/orders/:id
      const detailRes = await request
        .get(`/api/v1/customer/orders/${order.id}`)
        .set('Authorization', `Bearer ${customer1Token}`);

      expect(detailRes.status).toBe(200);
      expect(detailRes.body.runner).not.toBeNull();
      expect(detailRes.body.runner.id).toBe(runner1Id);
      expect(detailRes.body.runner.name).toBe('Ahmad Runner');
      // Crucial security invariant: contact details MUST be null
      expect(detailRes.body.runner.whatsapp).toBeNull();
      expect(detailRes.body.runner.phone).toBeNull();

      // Test GET /customer/orders (list)
      const listRes = await request
        .get('/api/v1/customer/orders')
        .set('Authorization', `Bearer ${customer1Token}`);

      expect(listRes.status).toBe(200);
      const listOrder = listRes.body.data.find((o: any) => o.id === order.id);
      expect(listOrder).toBeDefined();
      expect(listOrder.runner).not.toBeNull();
      expect(listOrder.runner.whatsapp).toBeNull();
      expect(listOrder.runner.phone).toBeNull();
    });
  });

  describe('Scenario 4: IDOR Prevention: Customer 2 Cannot Access Customer 1 Order or Runner Contact', () => {
    it('returns 404 Not Found when Customer 2 tries to access Customer 1 order (even if active)', async () => {
      const activeOrder = await createOrderWithStatus(OrderStatus.IN_PROGRESS);

      const res = await request
        .get(`/api/v1/customer/orders/${activeOrder.id}`)
        .set('Authorization', `Bearer ${customer2Token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBeDefined();
    });
  });
});
