import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
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

  it('scenario 5 - idempotency: retry with same idempotencyKey returns identical order and creates only 1 DB record', async () => {
    const request = getRequest();
    const idempotencyKey = randomUUID();
    const orderPayload = {
      items: [
        {
          itemName: 'Milk',
          quantity: '2',
          customStoreName: 'بقالية السعادة',
          anyStore: false,
        },
      ],
      notes: 'يرجى التوصيل عند الباب',
      preferredRunnerId: null,
      waitForPreferred: false,
      deliveryAddress: {
        lat: 33.5138,
        lng: 36.2765,
        description: 'Damascus Test Address',
      },
      idempotencyKey,
    };

    // First attempt
    const firstRes = await request
      .post('/api/v1/customer/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send(orderPayload);

    expect(firstRes.status).toBe(201);
    expect(firstRes.body).toHaveProperty('id');
    expect(firstRes.body.orderNumber).toMatch(/^FW-\d{6}$/);
    expect(firstRes.body.idempotent).toBe(false);

    // Second attempt (simulating retry after dropped network response)
    const secondRes = await request
      .post('/api/v1/customer/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send(orderPayload);

    expect(secondRes.status).toBe(201);
    expect(secondRes.body.id).toBe(firstRes.body.id);
    expect(secondRes.body.orderNumber).toBe(firstRes.body.orderNumber);
    expect(secondRes.body.status).toBe(firstRes.body.status);
    expect(secondRes.body.idempotent).toBe(true);
    expect(secondRes.body.estimatedFee.totalFee).toBe(firstRes.body.estimatedFee.totalFee);

    // Assert strictly that only 1 order exists in database for this key
    const matchingOrders = await prisma.order.findMany({
      where: { createIdempotencyKey: idempotencyKey },
    });
    expect(matchingOrders).toHaveLength(1);
    expect(matchingOrders[0].id).toBe(firstRes.body.id);
  });

  it('scenario 6 - idempotency: duplicate key from a different customer is rejected with 409 Conflict', async () => {
    const request = getRequest();
    const idempotencyKey = randomUUID();

    // Customer 1 creates an order
    const firstRes = await request
      .post('/api/v1/customer/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        items: [{ itemName: 'Item 1', quantity: '1', customStoreName: 'متجر', anyStore: false }],
        notes: null,
        preferredRunnerId: null,
        waitForPreferred: false,
        deliveryAddress: { lat: 33.5138, lng: 36.2765, description: 'Address 1' },
        idempotencyKey,
      });
    expect(firstRes.status).toBe(201);

    // Seed a second verified customer
    const secondCustomerUser = await prisma.user.create({
      data: {
        name: 'Second Customer',
        whatsapp: '0999000088',
        altPhone: null,
        passwordHash: await bcrypt.hash('Customer@12345', 12),
        role: UserRole.CUSTOMER,
        status: UserStatus.VERIFIED,
      },
    });
    await prisma.customer.create({ data: { userId: secondCustomerUser.id } });
    const secondCustomerToken = await loginAs(request, '0999000088', 'Customer@12345');

    // Customer 2 tries to send the same idempotencyKey
    const conflictRes = await request
      .post('/api/v1/customer/orders')
      .set('Authorization', `Bearer ${secondCustomerToken}`)
      .send({
        items: [{ itemName: 'Item 2', quantity: '2', customStoreName: 'متجر 2', anyStore: false }],
        notes: null,
        preferredRunnerId: null,
        waitForPreferred: false,
        deliveryAddress: { lat: 33.5138, lng: 36.2765, description: 'Address 2' },
        idempotencyKey,
      });

    expect(conflictRes.status).toBe(409);
  });

  it('scenario 7 - idempotency: expired key (> 24 hours) is rejected with 409 Conflict', async () => {
    const request = getRequest();
    const idempotencyKey = randomUUID();

    // First create an order with this key
    const firstRes = await request
      .post('/api/v1/customer/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        items: [{ itemName: 'Item Expired Test', quantity: '1', customStoreName: 'متجر', anyStore: false }],
        notes: null,
        preferredRunnerId: null,
        waitForPreferred: false,
        deliveryAddress: { lat: 33.5138, lng: 36.2765, description: 'Address' },
        idempotencyKey,
      });
    expect(firstRes.status).toBe(201);

    // Artificially age the order's createdAt to 25 hours ago
    const pastDate = new Date(Date.now() - 25 * 60 * 60 * 1000);
    await prisma.order.update({
      where: { id: firstRes.body.id },
      data: { createdAt: pastDate },
    });

    // Replay after expiry
    const replayRes = await request
      .post('/api/v1/customer/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        items: [{ itemName: 'Item Expired Test', quantity: '1', customStoreName: 'متجر', anyStore: false }],
        notes: null,
        preferredRunnerId: null,
        waitForPreferred: false,
        deliveryAddress: { lat: 33.5138, lng: 36.2765, description: 'Address' },
        idempotencyKey,
      });

    expect(replayRes.status).toBe(409);
  });

  it('scenario 8 - idempotency: concurrent requests with same idempotencyKey create exactly 1 DB order', async () => {
    const request = getRequest();
    const idempotencyKey = randomUUID();
    const payload = {
      items: [{ itemName: 'Concurrent Item', quantity: '1', customStoreName: 'متجر التزامن', anyStore: false }],
      notes: null,
      preferredRunnerId: null,
      waitForPreferred: false,
      deliveryAddress: { lat: 33.5138, lng: 36.2765, description: 'Damascus Address' },
      idempotencyKey,
    };

    // Fire 2 concurrent requests simultaneously
    const [resA, resB] = await Promise.all([
      request
        .post('/api/v1/customer/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(payload),
      request
        .post('/api/v1/customer/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(payload),
    ]);

    expect(resA.status).toBe(201);
    expect(resB.status).toBe(201);
    expect(resA.body.id).toBe(resB.body.id);
    expect(resA.body.orderNumber).toBe(resB.body.orderNumber);

    const ordersInDb = await prisma.order.findMany({
      where: { createIdempotencyKey: idempotencyKey },
    });
    expect(ordersInDb).toHaveLength(1);
  });
});

