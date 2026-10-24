import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cleanDatabase, prisma } from '../setup';
import { createTestApp, closeTestApp, getRequest } from '../helpers/app.helper';
import { seedRunner, seedCustomer, loginAs } from '../helpers/seed.helper';
import { OrderStatus, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

describe('Runner Rating Concurrency & Exact Arithmetic (Step 3)', () => {
  let request!: ReturnType<typeof getRequest>;
  let runnerId: string;
  let customerUser: Awaited<ReturnType<typeof seedCustomer>>;
  let customerToken: string;

  beforeAll(async () => {
    await createTestApp();
    request = getRequest();
  });

  afterAll(async () => {
    await closeTestApp();
  });

  beforeEach(async () => {
    await cleanDatabase();

    const uRunner = await seedRunner(prisma);
    runnerId = uRunner.runner!.id;

    customerUser = await seedCustomer(prisma);
    customerToken = await loginAs(request, customerUser.whatsapp, 'Customer@12345');
  });

  let orderSeq = 1;
  async function createDeliveredOrder(customCustomerId?: string) {
    const seq = orderSeq++;
    return prisma.order.create({
      data: {
        customerId: customCustomerId ?? customerUser.customer!.id,
        runnerId,
        status: OrderStatus.DELIVERED,
        orderNumber: `FW-RATING-${seq}`,
        deliveryLat: 33.5138,
        deliveryLng: 36.2765,
        deliveryDesc: 'Damascus Test Address',
        baseFee: 60,
        totalFee: 60,
        deliveredAt: new Date(),
      },
    });
  }

  // ── 1. Concurrent rating requests for the same runner ─────────────────────
  it('concurrency test: two simultaneous ratings for the same runner are both calculated without lost update', async () => {
    // Create a second customer so we can simulate independent concurrent ratings
    const hash = await bcrypt.hash('Customer2@12345', 12);
    const uCustomer2 = await prisma.user.create({
      data: {
        name: 'Second Customer',
        whatsapp: '0982222333',
        passwordHash: hash,
        role: UserRole.CUSTOMER,
        status: UserStatus.VERIFIED,
        customer: { create: {} },
      },
      include: { customer: true },
    });
    const customer2Token = await loginAs(request, uCustomer2.whatsapp, 'Customer2@12345');

    // Create 2 delivered orders assigned to the same runner
    const order1 = await createDeliveredOrder(customerUser.customer!.id);
    const order2 = await createDeliveredOrder(uCustomer2.customer!.id);

    // Initial runner rating state
    const initialRunner = await prisma.runner.findUnique({ where: { id: runnerId } });
    expect(initialRunner!.totalRatings).toBe(0);
    expect(initialRunner!.avgRating).toBeNull();

    // Fire both rating requests concurrently via Promise.all
    const [res1, res2] = await Promise.all([
      request
        .post(`/api/v1/customer/orders/${order1.id}/ratings`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ stars: 5, note: 'Excellent delivery' }),
      request
        .post(`/api/v1/customer/orders/${order2.id}/ratings`)
        .set('Authorization', `Bearer ${customer2Token}`)
        .send({ stars: 3, note: 'Average delivery' }),
    ]);

    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);

    // Verify runner record in database: both ratings accounted for (no lost update!)
    const updatedRunner = await prisma.runner.findUnique({ where: { id: runnerId } });
    expect(updatedRunner!.totalRatings).toBe(2);
    expect(updatedRunner!.avgRating).toBe(4.0); // (5 + 3) / 2 = 4.0
  });

  // ── 2. Exact arithmetic sequence test ─────────────────────────────────────
  it('arithmetic test: series of 5 sequential ratings [5, 4, 3, 5, 2] yields mathematically exact avgRating = 3.8', async () => {
    const starRatings = [5, 4, 3, 5, 2];

    for (const stars of starRatings) {
      const order = await createDeliveredOrder();
      const res = await request
        .post(`/api/v1/customer/orders/${order.id}/ratings`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ stars });

      expect(res.status).toBe(201);
    }

    // Verify database record
    const finalRunner = await prisma.runner.findUnique({ where: { id: runnerId } });
    expect(finalRunner!.totalRatings).toBe(5);
    // (5 + 4 + 3 + 5 + 2) / 5 = 19 / 5 = 3.8 exactly
    expect(finalRunner!.avgRating).toBe(3.8);
  });

  // ── 3. Update rating arithmetic test ──────────────────────────────────────
  it('update rating test: customer updates existing rating and moving average updates accurately', async () => {
    const order = await createDeliveredOrder();

    // 1. Initial 5-star rating
    const createRes = await request
      .post(`/api/v1/customer/orders/${order.id}/ratings`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ stars: 5, note: 'Initial 5 stars' });
    expect(createRes.status).toBe(201);

    let runner = await prisma.runner.findUnique({ where: { id: runnerId } });
    expect(runner!.totalRatings).toBe(1);
    expect(runner!.avgRating).toBe(5.0);

    // 2. Update to 3 stars
    const updateRes = await request
      .put(`/api/v1/customer/orders/${order.id}/ratings`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ stars: 3, note: 'Changed to 3 stars' });
    expect(updateRes.status).toBe(200);

    runner = await prisma.runner.findUnique({ where: { id: runnerId } });
    expect(runner!.totalRatings).toBe(1);
    expect(runner!.avgRating).toBe(3.0);
  });
});
