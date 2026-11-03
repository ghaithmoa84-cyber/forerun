import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import supertest from 'supertest';
import { createTestApp, closeTestApp, getRequest } from '../helpers/app.helper.js';
import { cleanDatabase, prisma } from '../setup.js';
import { seedAdmin, seedCustomer, seedRunner, loginAs } from '../helpers/seed.helper.js';
import { OrderStatus, UserRole, UserStatus } from '@prisma/client';
import { mapRating } from '../../../src/modules/ratings/rating.mapper.js';
import * as bcrypt from 'bcrypt';

describe('Audit: Live Verification of Rating Note Privacy, DTO Lifecycle & IDOR Resistance (D43 & Rule 7)', () => {
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

  let seq = 1;
  async function createDeliveredOrder(customerId: string, runnerId: string) {
    const s = seq++;
    return prisma.order.create({
      data: {
        customerId,
        runnerId,
        status: OrderStatus.DELIVERED,
        orderNumber: `FW-SA4-RATE-${s}`,
        deliveryLat: 33.5138,
        deliveryLng: 36.2765,
        deliveryDesc: 'Damascus Test Address',
        baseFee: 60,
        totalFee: 60,
        deliveredAt: new Date(),
      },
    });
  }

  it('Case 1 & 2 (Customer Owner Visibility): Customer who created the rating sees the full text note in GET /customer/orders/:id', async () => {
    const customerUser = await seedCustomer(prisma);
    const runnerUser = await seedRunner(prisma);
    const customerToken = await loginAs(request, customerUser.whatsapp, 'Customer@12345');

    const order = await createDeliveredOrder(customerUser.customer!.id, runnerUser.runner!.id);

    const RATING_NOTE = 'المندوب كان سريع جداً والتعامل راقي ومحترم';

    // 1. Submit rating as customer
    const createRes = await request
      .post(`/api/v1/customer/orders/${order.id}/ratings`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ stars: 5, note: RATING_NOTE });

    expect(createRes.status).toBe(201);
    expect(createRes.body.stars).toBe(5);
    expect(createRes.body.note).toBe(RATING_NOTE);

    // 2. Query order details as the same customer
    const getRes = await request
      .get(`/api/v1/customer/orders/${order.id}`)
      .set('Authorization', `Bearer ${customerToken}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.rating).toBeDefined();
    expect(getRes.body.rating.stars).toBe(5);
    expect(getRes.body.rating.note).toBe(RATING_NOTE);
  });

  it('Case 3 (Runner Masking): Rating note is strictly masked (null/unexposed) for the runner who delivered the order', async () => {
    const customerUser = await seedCustomer(prisma);
    const runnerUser = await seedRunner(prisma);
    const customerToken = await loginAs(request, customerUser.whatsapp, 'Customer@12345');
    const runnerToken = await loginAs(request, runnerUser.whatsapp, 'Runner@12345');

    const order = await createDeliveredOrder(customerUser.customer!.id, runnerUser.runner!.id);

    const SENSITIVE_NOTE = 'المندوب تأخر قليلاً ولكن الخدمة جيدة';

    // Create rating with note
    await request
      .post(`/api/v1/customer/orders/${order.id}/ratings`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ stars: 4, note: SENSITIVE_NOTE });

    // 1. Runner attempts to call customer order details endpoint -> Rejected by role guard
    const runnerOrderRes = await request
      .get(`/api/v1/customer/orders/${order.id}`)
      .set('Authorization', `Bearer ${runnerToken}`);
    expect(runnerOrderRes.status).toBe(403);

    // 2. Runner active orders endpoint -> Does NOT expose ratings or notes
    const activeOrderRes = await request
      .get('/api/v1/runner/orders/active')
      .set('Authorization', `Bearer ${runnerToken}`);
    expect(activeOrderRes.status).toBe(200);
    // Since order is DELIVERED, it is not in active status; body is empty and has no rating/note
    expect(activeOrderRes.body).not.toHaveProperty('rating');
    expect(activeOrderRes.body).not.toHaveProperty('note');

    // 3. Direct rating mapper contract check (D43): role === 'RUNNER' MUST mask note to null
    const dbRating = await prisma.rating.findUnique({
      where: { orderId_runnerId: { orderId: order.id, runnerId: runnerUser.runner!.id } },
    });
    expect(dbRating).toBeDefined();
    expect(dbRating!.note).toBe(SENSITIVE_NOTE);

    const runnerMapped = mapRating(dbRating!, 'RUNNER');
    expect(runnerMapped.note).toBeNull();
    expect(runnerMapped.stars).toBe(4);
    expect(runnerMapped.runnerId).toBe(runnerUser.runner!.id);
  });

  it('Case 4 (Admin Visibility): ADMIN token sees the full rating note in order details', async () => {
    const customerUser = await seedCustomer(prisma);
    const runnerUser = await seedRunner(prisma);
    const adminUser = await seedAdmin(prisma);
    const customerToken = await loginAs(request, customerUser.whatsapp, 'Customer@12345');
    const adminToken = await loginAs(request, adminUser.whatsapp, 'Admin@12345');

    const order = await createDeliveredOrder(customerUser.customer!.id, runnerUser.runner!.id);

    const ADMIN_VISIBLE_NOTE = 'ملاحظة مهمة للإدارة بخصوص التوصيل';

    await request
      .post(`/api/v1/customer/orders/${order.id}/ratings`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ stars: 3, note: ADMIN_VISIBLE_NOTE });

    const adminRes = await request
      .get(`/api/v1/admin/orders/${order.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(adminRes.status).toBe(200);
    expect(adminRes.body.ratings).toBeInstanceOf(Array);
    expect(adminRes.body.ratings.length).toBe(1);
    expect(adminRes.body.ratings[0].stars).toBe(3);
    expect(adminRes.body.ratings[0].note).toBe(ADMIN_VISIBLE_NOTE);
  });

  it('Case 5 (IDOR Prevention): Another customer cannot access or view ratings/notes of an order they do not own (404 Not Found)', async () => {
    const customer1 = await seedCustomer(prisma);
    const runnerUser = await seedRunner(prisma);

    // Seed a second independent customer
    const hash = await bcrypt.hash('OtherCustomer@12345', 12);
    const customer2 = await prisma.user.create({
      data: {
        name: 'Unrelated Customer',
        whatsapp: '0999000088',
        passwordHash: hash,
        role: UserRole.CUSTOMER,
        status: UserStatus.VERIFIED,
        customer: { create: {} },
      },
      include: { customer: true },
    });

    const customer1Token = await loginAs(request, customer1.whatsapp, 'Customer@12345');
    const customer2Token = await loginAs(request, customer2.whatsapp, 'OtherCustomer@12345');

    const order = await createDeliveredOrder(customer1.customer!.id, runnerUser.runner!.id);

    await request
      .post(`/api/v1/customer/orders/${order.id}/ratings`)
      .set('Authorization', `Bearer ${customer1Token}`)
      .send({ stars: 5, note: 'ملاحظة سرية لعميل 1' });

    // Customer 2 attempts to query Customer 1's order details -> Must return 404 (IDOR safe)
    const getRes = await request
      .get(`/api/v1/customer/orders/${order.id}`)
      .set('Authorization', `Bearer ${customer2Token}`);

    expect(getRes.status).toBe(404);
    expect(getRes.body.message).toMatch(/order not found/i);

    // Customer 2 attempts to create rating on Customer 1's order -> Must return 404
    const postRes = await request
      .post(`/api/v1/customer/orders/${order.id}/ratings`)
      .set('Authorization', `Bearer ${customer2Token}`)
      .send({ stars: 1, note: 'محاولة اختراق' });

    expect(postRes.status).toBe(404);

    // Customer 2 attempts to update rating on Customer 1's order -> Must return 404
    const putRes = await request
      .put(`/api/v1/customer/orders/${order.id}/ratings`)
      .set('Authorization', `Bearer ${customer2Token}`)
      .send({ stars: 1, note: 'محاولة تعديل غير مصرح' });

    expect(putRes.status).toBe(404);
  });

  it('Case 6 (Anti-Overmasking): Runner profile endpoint (/runner/me) displays aggregate avgRating and totalRatings accurately without exposing notes', async () => {
    const customerUser = await seedCustomer(prisma);
    const runnerUser = await seedRunner(prisma);
    const customerToken = await loginAs(request, customerUser.whatsapp, 'Customer@12345');
    const runnerToken = await loginAs(request, runnerUser.whatsapp, 'Runner@12345');

    const order = await createDeliveredOrder(customerUser.customer!.id, runnerUser.runner!.id);

    await request
      .post(`/api/v1/customer/orders/${order.id}/ratings`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ stars: 5, note: 'نص التقييم المحجوب عن المندوب' });

    const runnerMeRes = await request
      .get('/api/v1/runner/me')
      .set('Authorization', `Bearer ${runnerToken}`);

    expect(runnerMeRes.status).toBe(200);
    expect(runnerMeRes.body.totalRatings).toBe(1);
    expect(runnerMeRes.body.avgRating).toBe(5);
    // Crucial check: verify 'note' is NOT present anywhere on the runner profile DTO
    expect(runnerMeRes.body).not.toHaveProperty('note');
    expect(runnerMeRes.body).not.toHaveProperty('notes');
  });
});
