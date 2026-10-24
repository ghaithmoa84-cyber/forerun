import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanDatabase, prisma } from '../setup';
import { createTestApp, closeTestApp, getRequest, getTestApp } from '../helpers/app.helper';
import {
  seedAdmin,
  seedRunner,
  seedCustomer,
  loginAs,
} from '../helpers/seed.helper';
import { PrismaService } from '../../../src/database/prisma.service';
import { OrderStoreStatus } from '@prisma/client';

describe('deleteOrderStore — Integration & Concurrency Guard', () => {
  let request!: ReturnType<typeof getRequest>;
  let adminToken: string;
  let runnerToken: string;
  let customerToken: string;
  let runnerUser: Awaited<ReturnType<typeof seedRunner>>;
  let customerUser: Awaited<ReturnType<typeof seedCustomer>>;
  let orderId: string;
  let storeId: string;

  beforeAll(async () => {
    await createTestApp();
    request = getRequest();
  });

  afterAll(async () => {
    await closeTestApp();
  });

  beforeEach(async () => {
    await cleanDatabase();

    const adminUser = await seedAdmin(prisma);
    runnerUser = await seedRunner(prisma);
    customerUser = await seedCustomer(prisma);

    [adminToken, runnerToken, customerToken] = await Promise.all([
      loginAs(request, adminUser.whatsapp, 'Admin@12345'),
      loginAs(request, runnerUser.whatsapp, 'Runner@12345'),
      loginAs(request, customerUser.whatsapp, 'Customer@12345'),
    ]);
  });

  async function prepareOrderWithTwoStores() {
    const createRes = await request
      .post('/api/v1/customer/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        items: [
          {
            itemName: 'Milk',
            quantity: '1 carton',
            customStoreName: 'First Store',
            anyStore: false,
          },
          {
            itemName: 'Bread',
            quantity: '2 loaves',
            customStoreName: 'Second Store',
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
    expect(createRes.status).toBe(201);

    orderId = createRes.body.id;

    const reviewRes = await request
      .put(`/api/v1/admin/orders/${orderId}/start-review`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(reviewRes.status).toBe(200);

    const approveRes = await request
      .put(`/api/v1/admin/orders/${orderId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isPeripheral: false });
    expect(approveRes.status).toBe(200);

    const assignRes = await request
      .put(`/api/v1/admin/orders/${orderId}/assign-runner`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ runnerId: runnerUser.runner!.id });
    expect(assignRes.status).toBe(200);

    const startRes = await request
      .put(`/api/v1/runner/orders/${orderId}/start`)
      .set('Authorization', `Bearer ${runnerToken}`);
    expect(startRes.status).toBe(200);

    const stores = await prisma.orderStore.findMany({
      where: { orderId, isDeleted: false },
      orderBy: { createdAt: 'asc' },
    });
    expect(stores.length).toBe(2);
    storeId = stores[0].id;
    return stores;
  }

  it('successfully deletes a PENDING store from an active in-progress order', async () => {
    await prepareOrderWithTwoStores();

    const deleteRes = await request
      .delete(`/api/v1/runner/orders/${orderId}/stores/${storeId}`)
      .set('Authorization', `Bearer ${runnerToken}`);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.orderStore.isDeleted).toBe(true);

    // Verify in DB that it is marked deleted
    const dbStore = await prisma.orderStore.findFirst({
      where: { id: storeId },
    });
    expect(dbStore).not.toBeNull();
    expect(dbStore!.isDeleted).toBe(true);
    expect(dbStore!.deletedAt).not.toBeNull();
  });

  it('rejects deletion with 422 if store is already PURCHASED', async () => {
    await prepareOrderWithTwoStores();

    // Mark store as PURCHASED in DB
    await prisma.orderStore.update({
      where: { id: storeId },
      data: { status: OrderStoreStatus.PURCHASED, purchasedAt: new Date() },
    });

    const deleteRes = await request
      .delete(`/api/v1/runner/orders/${orderId}/stores/${storeId}`)
      .set('Authorization', `Bearer ${runnerToken}`);

    expect(deleteRes.status).toBe(422);
    expect(deleteRes.body.message).toBe('Only pending stores can be removed');

    // Verify DB store was NOT deleted
    const dbStore = await prisma.orderStore.findFirst({
      where: { id: storeId },
    });
    expect(dbStore!.isDeleted).toBe(false);
  });

  it('concurrency guard: fails with 409 Conflict if store transitions to PURCHASED concurrently during deletion', async () => {
    await prepareOrderWithTwoStores();

    const app = getTestApp();
    const prismaService = app.get(PrismaService);
    const realTransaction = prismaService.$transaction.bind(prismaService);

    // Simulate concurrent purchase:
    // Read store as PENDING, but before updateMany soft-deletes it, another transaction marks it PURCHASED
    const transactionSpy = vi.spyOn(prismaService, '$transaction').mockImplementation(async (cb: any, options?: any) => {
      return realTransaction(async (tx: any) => {
        const origFindFirst = tx.orderStore.findFirst.bind(tx.orderStore);
        tx.orderStore.findFirst = async (...args: any[]) => {
          const foundStore = await origFindFirst(...args);
          // Parallel transaction transitions store to PURCHASED
          await prisma.orderStore.update({
            where: { id: storeId },
            data: {
              status: OrderStoreStatus.PURCHASED,
              purchasedAt: new Date(),
            },
          });
          return foundStore;
        };
        return cb(tx);
      }, options);
    });

    try {
      const deleteRes = await request
        .delete(`/api/v1/runner/orders/${orderId}/stores/${storeId}`)
        .set('Authorization', `Bearer ${runnerToken}`);

      expect(deleteRes.status).toBe(409);
      expect(deleteRes.body.message).toBe('ORDER_STATUS_CHANGED_CONCURRENTLY');

      // Verify that the store was NOT deleted and remains PURCHASED
      const dbStore = await prisma.orderStore.findFirst({
        where: { id: storeId },
      });
      expect(dbStore).not.toBeNull();
      expect(dbStore!.status).toBe(OrderStoreStatus.PURCHASED);
      expect(dbStore!.isDeleted).toBe(false);
    } finally {
      transactionSpy.mockRestore();
    }
  });
});
