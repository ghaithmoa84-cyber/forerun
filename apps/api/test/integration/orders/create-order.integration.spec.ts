import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import { UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { cleanDatabase, prisma } from '../setup';
import { createTestApp, closeTestApp, getRequest } from '../helpers/app.helper';
import { seedAdmin, seedRunner, seedCustomer, loginAs } from '../helpers/seed.helper';

let runnerToken: string;
let customerToken: string;
let pendingCustomerToken: string;

beforeAll(async () => {
  await createTestApp();
});

afterAll(async () => {
  await closeTestApp();
});

beforeEach(async () => {
  await cleanDatabase();
  await seedAdmin(prisma);
  await seedRunner(prisma);
  await seedCustomer(prisma);
  const request = getRequest();
  runnerToken = await loginAs(request, '0999000002', 'Runner@12345');
  customerToken = await loginAs(request, '0999000003', 'Customer@12345');

  const pendingCustomer = await prisma.user.create({
    data: {
      name: 'Pending Customer',
      whatsapp: '0999000004',
      altPhone: null,
      passwordHash: await bcrypt.hash('Customer@12345', 12),
      role: UserRole.CUSTOMER,
      status: UserStatus.PENDING_VERIFICATION,
    },
  });
  await prisma.customer.create({
    data: { userId: pendingCustomer.id },
  });

  pendingCustomerToken = await loginAs(
    request,
    '0999000004',
    'Customer@12345',
  );
});

describe('POST /api/v1/customer/orders', () => {
  it('scenario 1 - successful order creation', async () => {
    const request = getRequest();
    const res = await request
      .post('/api/v1/customer/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        items: [
          {
            itemName: 'Item 1',
            quantity: '1',
            customStoreName: 'متجر تجريبي',
            anyStore: false,
          },
        ],
        notes: null,
        preferredRunnerId: null,
        waitForPreferred: false,
        deliveryAddress: {
          lat: 33.5138,
          lng: 36.2765,
          description: 'Damascus Test Address',
        },
      });

    expect(res.status).toBe(201);
    const body = res.body;

    const order = await prisma.order.findUnique({
      where: { id: body.id },
    });

    expect(order).not.toBeNull();
    expect(order!.status).toBe('PENDING_REVIEW');
    expect(order!.orderNumber).toMatch(/^FW-\d{6}$/);

    const items = await prisma.orderItem.findMany({
      where: { orderId: order!.id },
    });
    expect(items.length).toBeGreaterThan(0);

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        orderId: order!.id,
        event: 'ORDER_CREATED',
      },
    });
    expect(auditLogs.length).toBeGreaterThan(0);

    expect(body.estimatedFee.totalFee).toBe(60);
  });

  it('scenario 2 - pending verification customer returns 403', async () => {
    const request = getRequest();
    const res = await request
      .post('/api/v1/customer/orders')
      .set('Authorization', `Bearer ${pendingCustomerToken}`)
      .send({
        items: [
          {
            itemName: 'Item 1',
            quantity: '1',
            customStoreName: 'متجر تجريبي',
            anyStore: false,
          },
        ],
        notes: null,
        preferredRunnerId: null,
        waitForPreferred: false,
        deliveryAddress: {
          lat: 33.5138,
          lng: 36.2765,
          description: 'Damascus Test Address',
        },
      });

    expect(res.status).toBe(403);
  });

  it('scenario 3 - runner cannot create customer order returns 403', async () => {
    const request = getRequest();
    const res = await request
      .post('/api/v1/customer/orders')
      .set('Authorization', `Bearer ${runnerToken}`)
      .send({
        items: [
          {
            itemName: 'Item 1',
            quantity: '1',
            customStoreName: 'متجر تجريبي',
            anyStore: false,
          },
        ],
        notes: null,
        preferredRunnerId: null,
        waitForPreferred: false,
        deliveryAddress: {
          lat: 33.5138,
          lng: 36.2765,
          description: 'Damascus Test Address',
        },
      });

    expect(res.status).toBe(403);
  });

  it('scenario 4 - created order defaults customFee=0 and customFeeReason=null in DB, and enforces non-negative CHECK', async () => {
    const request = getRequest();
    const res = await request
      .post('/api/v1/customer/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        items: [
          {
            itemName: 'Item CustomFee Test',
            quantity: '1',
            customStoreName: 'متجر تجريبي',
            anyStore: false,
          },
        ],
        notes: null,
        preferredRunnerId: null,
        waitForPreferred: false,
        deliveryAddress: {
          lat: 33.5138,
          lng: 36.2765,
          description: 'Damascus Test Address',
        },
      });

    expect(res.status).toBe(201);
    const order = await prisma.order.findUnique({
      where: { id: res.body.id },
    });
    expect(order).not.toBeNull();
    expect(order!.customFee).toBe(0);
    expect(order!.customFeeReason).toBeNull();

    // Verify non-negative CHECK constraint in PostgreSQL
    await expect(
      prisma.$executeRaw`UPDATE "Order" SET "customFee" = -1 WHERE id = ${order!.id}`,
    ).rejects.toThrow();
  });
});

