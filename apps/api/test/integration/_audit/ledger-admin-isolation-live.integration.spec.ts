import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import supertest from 'supertest';
import { randomUUID } from 'node:crypto';
import { createTestApp, closeTestApp, getRequest } from '../helpers/app.helper.js';
import { cleanDatabase, prisma } from '../setup.js';
import { seedAdmin, seedCustomer, seedRunner, loginAs } from '../helpers/seed.helper.js';
import { OrderStatus } from '@prisma/client';

function findKeysDeep(obj: unknown, predicate: (key: string) => boolean): string[] {
  const matches: string[] = [];
  function recurse(current: unknown) {
    if (!current || typeof current !== 'object') return;
    if (Array.isArray(current)) {
      current.forEach(recurse);
      return;
    }
    for (const [key, val] of Object.entries(current as Record<string, unknown>)) {
      if (predicate(key)) {
        matches.push(key);
      }
      recurse(val);
    }
  }
  recurse(obj);
  return matches;
}

describe('Audit: Live Verification of Ledger Isolation & Accidental DTO Leakage Prevention (Rule 7 & D35)', () => {
  let request: ReturnType<typeof supertest>;

  beforeAll(async () => {
    await createTestApp();
    request = getRequest();
  });

  afterAll(async () => {
    await closeTestApp();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('Case 1: Customer token calling GET /api/v1/admin/ledger is strictly rejected with 403 Forbidden', async () => {
    const customerUser = await seedCustomer(prisma);
    const customerToken = await loginAs(request, customerUser.whatsapp, 'Customer@12345');

    const res = await request
      .get('/api/v1/admin/ledger')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/required role: admin/i);
  });

  it('Case 2: Runner token calling GET /api/v1/admin/ledger is strictly rejected with 403 Forbidden', async () => {
    const runnerUser = await seedRunner(prisma);
    const runnerToken = await loginAs(request, runnerUser.whatsapp, 'Runner@12345');

    const res = await request
      .get('/api/v1/admin/ledger')
      .set('Authorization', `Bearer ${runnerToken}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/required role: admin/i);
  });

  it('Case 3: Unauthenticated request (no token) calling GET /api/v1/admin/ledger is rejected with 401 Unauthorized', async () => {
    const res = await request.get('/api/v1/admin/ledger');

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/missing or invalid authorization header/i);
  });

  it('Case 4: ADMIN token calling GET /api/v1/admin/ledger succeeds with 200 OK and valid ledger entries structure', async () => {
    const adminUser = await seedAdmin(prisma);
    const adminToken = await loginAs(request, adminUser.whatsapp, 'Admin@12345');

    // Create a dummy ledger entry directly in DB to verify retrieval
    await prisma.ledgerEntry.create({
      data: {
        type: 'ORDER_FEE_TOTAL',
        amount: 60,
        orderId: null,
        description: 'Test administrative seed entry',
      },
    });

    const res = await request
      .get('/api/v1/admin/ledger')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('meta');
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0]).toHaveProperty('type', 'ORDER_FEE_TOTAL');
    expect(res.body.data[0]).toHaveProperty('amount', 60);
  });

  it('Case 5 (Accidental Leakage Prevention): Non-ledger endpoints (Customer & Runner) never leak raw LedgerEntry fields via Prisma include relations', async () => {
    const adminUser = await seedAdmin(prisma);
    const runnerUser = await seedRunner(prisma);
    const customerUser = await seedCustomer(prisma);

    const [adminToken, runnerToken, customerToken] = await Promise.all([
      loginAs(request, adminUser.whatsapp, 'Admin@12345'),
      loginAs(request, runnerUser.whatsapp, 'Runner@12345'),
      loginAs(request, customerUser.whatsapp, 'Customer@12345'),
    ]);

    // 1. Create order as Customer
    const createRes = await request
      .post('/api/v1/customer/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        items: [
          {
            itemName: 'Fresh Milk',
            quantity: '2 bottles',
            customStoreName: 'Local Market',
            anyStore: false,
          },
        ],
        notes: 'Please handle with care',
        preferredRunnerId: null,
        waitForPreferred: false,
        deliveryAddress: {
          lat: 33.5138,
          lng: 36.2765,
          description: 'Damascus Test Address',
        },
      });
    expect(createRes.status).toBe(201);
    const orderId = createRes.body.id;

    const orderStore = await prisma.orderStore.findFirst({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
    });
    expect(orderStore).not.toBeNull();
    const storeId = orderStore!.id;

    // 2. Admin flow: review, approve, assign
    await request
      .put(`/api/v1/admin/orders/${orderId}/start-review`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    await request
      .put(`/api/v1/admin/orders/${orderId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isPeripheral: false });
    await request
      .put(`/api/v1/admin/orders/${orderId}/assign-runner`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ runnerId: runnerUser.runner!.id });

    // 3. Runner flow: start, purchase, proceed to delivery
    await request
      .put(`/api/v1/runner/orders/${orderId}/start`)
      .set('Authorization', `Bearer ${runnerToken}`);
    await request
      .put(`/api/v1/runner/orders/${orderId}/stores/${storeId}/purchase`)
      .set('Authorization', `Bearer ${runnerToken}`);
    await request
      .put(`/api/v1/runner/orders/${orderId}/proceed-to-delivery`)
      .set('Authorization', `Bearer ${runnerToken}`);

    // Check Runner active order DTO during in-progress delivery
    const runnerActiveRes = await request
      .get('/api/v1/runner/orders/active')
      .set('Authorization', `Bearer ${runnerToken}`);
    expect(runnerActiveRes.status).toBe(200);

    const runnerActiveMatches = findKeysDeep(runnerActiveRes.body, (k) => /ledger/i.test(k));
    expect(runnerActiveMatches).toEqual([]);

    // 4. Runner delivers the order -> Triggers calculateAndRecordLedger in DB transaction
    const idempotencyKey = randomUUID();
    const deliverRes = await request
      .put(`/api/v1/runner/orders/${orderId}/deliver`)
      .set('Authorization', `Bearer ${runnerToken}`)
      .send({ idempotencyKey });
    expect(deliverRes.status).toBe(200);

    // Verify delivery response itself excludes ledger data
    const deliverMatches = findKeysDeep(deliverRes.body, (k) => /ledger/i.test(k));
    expect(deliverMatches).toEqual([]);
    expect(deliverRes.body).not.toHaveProperty('ledgerEntries');

    // Confirm ledger entries DO exist in database for this order
    const dbEntries = await prisma.ledgerEntry.findMany({ where: { orderId } });
    expect(dbEntries.length).toBeGreaterThanOrEqual(1);

    // 5. Customer fetches order details for delivered order (with active ledger records in DB)
    const customerOrderRes = await request
      .get(`/api/v1/customer/orders/${orderId}`)
      .set('Authorization', `Bearer ${customerToken}`);
    expect(customerOrderRes.status).toBe(200);

    // Deep inspection: verify NO ledger-related key exists anywhere in Customer Order DTO
    const customerOrderMatches = findKeysDeep(customerOrderRes.body, (k) => /ledger/i.test(k));
    expect(customerOrderMatches).toEqual([]);
    expect(customerOrderRes.body).not.toHaveProperty('ledgerEntries');
    expect(customerOrderRes.body).not.toHaveProperty('ledgerEntry');

    // Also verify Customer order list endpoint (GET /customer/orders)
    const customerListRes = await request
      .get('/api/v1/customer/orders')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(customerListRes.status).toBe(200);

    const customerListMatches = findKeysDeep(customerListRes.body, (k) => /ledger/i.test(k));
    expect(customerListMatches).toEqual([]);
  });
});
