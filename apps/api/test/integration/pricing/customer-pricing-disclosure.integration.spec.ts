import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { cleanDatabase, prisma } from '../setup';
import { createTestApp, closeTestApp, getRequest } from '../helpers/app.helper';
import { seedAdmin, seedCustomer, seedRunner, loginAs } from '../helpers/seed.helper';

describe('Customer Pricing Disclosure Integration (D40)', () => {
  let request!: ReturnType<typeof getRequest>;
  let customerToken: string;
  let adminToken: string;
  let runnerToken: string;

  beforeAll(async () => {
    await createTestApp();
    request = getRequest();
  });

  afterAll(async () => {
    await closeTestApp();
  });

  beforeEach(async () => {
    await cleanDatabase();

    await prisma.platformPricing.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        baseFee: 70,
        extraStoreFee: 25,
        peripheralFee: 45,
      },
      update: {
        baseFee: 70,
        extraStoreFee: 25,
        peripheralFee: 45,
      },
    });

    const [adminUser, customerUser, runnerUser] = await Promise.all([
      seedAdmin(prisma),
      seedCustomer(prisma),
      seedRunner(prisma),
    ]);

    [adminToken, customerToken, runnerToken] = await Promise.all([
      loginAs(request, adminUser.whatsapp, 'Admin@12345'),
      loginAs(request, customerUser.whatsapp, 'Customer@12345'),
      loginAs(request, runnerUser.whatsapp, 'Runner@12345'),
    ]);
  });

  it('GET /api/v1/customer/pricing/disclosure returns 200 with live DB values for authenticated customer', async () => {
    const res = await request
      .get('/api/v1/customer/pricing/disclosure')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      baseFee: 70,
      extraStoreFee: 25,
      peripheralFee: 45,
    });

    // Rule 7 — Least Privilege Data Exposure / D35 privacy pattern check:
    // Assert strictly that no internal administrative metadata or relation fields leak
    const bodyKeys = Object.keys(res.body).sort();
    expect(bodyKeys).toEqual(['baseFee', 'extraStoreFee', 'peripheralFee']);
    expect(res.body.id).toBeUndefined();
    expect(res.body.updatedAt).toBeUndefined();
    expect(res.body.updatedByUserId).toBeUndefined();
    expect(res.body.User).toBeUndefined();
  });

  it('reflects updated PlatformPricing values dynamically from DB (not hardcoded)', async () => {
    // 1. Fetch current admin pricing to get current updatedAt for optimistic locking
    const adminGet = await request
      .get('/api/v1/admin/pricing')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminGet.status).toBe(200);

    // 2. Admin updates pricing via PUT /api/v1/admin/pricing (which updates DB and flushes cache)
    const putRes = await request
      .put('/api/v1/admin/pricing')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        baseFee: 90,
        extraStoreFee: 35,
        peripheralFee: 55,
        updatedAt: adminGet.body.updatedAt,
      });
    expect(putRes.status).toBe(200);

    // 3. Customer disclosure immediately reflects the new prices
    const res = await request
      .get('/api/v1/customer/pricing/disclosure')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      baseFee: 90,
      extraStoreFee: 35,
      peripheralFee: 55,
    });
  });

  it('returns 401 when request is unauthenticated', async () => {
    const res = await request.get('/api/v1/customer/pricing/disclosure');
    expect(res.status).toBe(401);
  });

  it('returns 403 when authenticated as ADMIN role', async () => {
    const adminRes = await request
      .get('/api/v1/customer/pricing/disclosure')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminRes.status).toBe(403);
  });

  it('returns 403 when authenticated as RUNNER role', async () => {
    const runnerRes = await request
      .get('/api/v1/customer/pricing/disclosure')
      .set('Authorization', `Bearer ${runnerToken}`);
    expect(runnerRes.status).toBe(403);
  });
});
