import { beforeEach, describe, it, expect, vi } from 'vitest';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { RatingsService } from '../../src/modules/ratings/ratings.service.js';
import { mapRating } from '../../src/modules/ratings/rating.mapper.js';
import type { PrismaService } from '../../src/database/prisma.service.js';
import type { AuditService } from '../../src/modules/audit/audit.service.js';

const future = new Date(Date.now() + 24 * 60 * 60 * 1000);

const baseRating = {
  id: 'rating-1',
  orderId: 'order-1',
  customerId: 'cust-1',
  runnerId: 'runner-1',
  storeNameRated: null,
  stars: 5,
  note: 'great runner',
  isFinal: false,
  createdAt: new Date('2026-09-15T10:00:00.000Z'),
  updatedAt: new Date('2026-09-15T10:00:00.000Z'),
  expiresAt: future,
};

const CUSTOMER = { userId: 'cust-user-1', role: 'CUSTOMER', status: 'VERIFIED' };
const RUNNER = { userId: 'runner-user-1', role: 'RUNNER', status: 'VERIFIED' };

function makeService() {
  const auditService = { log: vi.fn().mockResolvedValue(undefined) };
  const prisma: any = {
    customer: { findUnique: vi.fn() },
    order: { findUnique: vi.fn() },
    rating: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    runner: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    $transaction: vi.fn(),
  };
  prisma.$transaction.mockImplementation(async (fn: any) => fn(prisma));
  const service = new RatingsService(
    prisma as unknown as PrismaService,
    auditService as unknown as AuditService,
  );
  return { service, prisma, auditService };
}

describe('RatingsService', () => {
  let service: RatingsService;
  let prisma: any;
  let auditService: any;

  beforeEach(() => {
    ({ service, prisma, auditService } = makeService());
  });

  describe('mapRating visibility', () => {
    it('exposes notes for ADMIN and CUSTOMER and hides them for RUNNER', () => {
      expect(mapRating(baseRating, 'CUSTOMER').note).toBe('great runner');
      expect(mapRating(baseRating, 'ADMIN').note).toBe('great runner');
      expect(mapRating(baseRating, 'RUNNER').note).toBeNull();
    });
  });

  describe('createRating', () => {
    it('creates the first rating and updates the runner average', async () => {
      prisma.customer.findUnique.mockResolvedValue({ id: 'cust-1' });
      prisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        customerId: 'cust-1',
        status: 'DELIVERED',
        deliveredAt: new Date(),
        runnerId: 'runner-1',
      });
      prisma.rating.findUnique.mockResolvedValue(null);
      prisma.rating.create.mockResolvedValue({ ...baseRating, stars: 5 });
      prisma.runner.findUnique.mockResolvedValue({
        id: 'runner-1',
        avgRating: null,
        totalRatings: 0,
      });
      prisma.runner.update.mockResolvedValue({});

      const result = await service.createRating('order-1', CUSTOMER, {
        stars: 5,
        note: 'nice',
      });

      expect(result.stars).toBe(5);
      expect(result.note).toBe('great runner');
      expect(prisma.rating.create).toHaveBeenCalledWith({
        data: {
          orderId: 'order-1',
          customerId: 'cust-1',
          runnerId: 'runner-1',
          stars: 5,
          note: 'nice',
          isFinal: false,
          expiresAt: expect.any(Date),
        },
      });
      expect(prisma.runner.updateMany).toHaveBeenCalledWith({
        where: { id: 'runner-1', totalRatings: 0, avgRating: null },
        data: { avgRating: 5, totalRatings: 1 },
      });
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 'order-1',
          actorId: 'cust-user-1',
          actorRole: 'CUSTOMER',
          event: 'RATING_CREATED',
        }),
        prisma,
      );
    });

    it('calculates the moving average for a second rating', async () => {
      prisma.customer.findUnique.mockResolvedValue({ id: 'cust-1' });
      prisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        customerId: 'cust-1',
        status: 'DELIVERED',
        deliveredAt: new Date(),
        runnerId: 'runner-1',
      });
      prisma.rating.findUnique.mockResolvedValue(null);
      prisma.rating.create.mockResolvedValue({ ...baseRating, stars: 5 });
      prisma.runner.findUnique.mockResolvedValue({
        id: 'runner-1',
        avgRating: 4,
        totalRatings: 1,
      });
      prisma.runner.update.mockResolvedValue({});

      await service.createRating('order-1', CUSTOMER, { stars: 5 });

      expect(prisma.runner.updateMany).toHaveBeenCalledWith({
        where: { id: 'runner-1', totalRatings: 1, avgRating: 4 },
        data: { avgRating: 4.5, totalRatings: 2 },
      });
    });

    it('rejects ratings for orders that are not delivered', async () => {
      prisma.customer.findUnique.mockResolvedValue({ id: 'cust-1' });
      prisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        customerId: 'cust-1',
        status: 'PENDING_REVIEW',
        runnerId: 'runner-1',
      });

      await expect(
        service.createRating('order-1', CUSTOMER, { stars: 5 }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('rejects orders that are not owned by the customer', async () => {
      prisma.customer.findUnique.mockResolvedValue({ id: 'cust-1' });
      prisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        customerId: 'other',
        status: 'DELIVERED',
        deliveredAt: new Date(),
        runnerId: 'runner-1',
      });

      await expect(
        service.createRating('order-1', CUSTOMER, { stars: 5 }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects a duplicate rating for the order and runner', async () => {
      prisma.customer.findUnique.mockResolvedValue({ id: 'cust-1' });
      prisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        customerId: 'cust-1',
        status: 'DELIVERED',
        deliveredAt: new Date(),
        runnerId: 'runner-1',
      });
      prisma.rating.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.createRating('order-1', CUSTOMER, { stars: 5 }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects ratings created more than 24h after delivery', async () => {
      const expiredDelivery = new Date(Date.now() - 25 * 60 * 60 * 1000);
      prisma.customer.findUnique.mockResolvedValue({ id: 'cust-1' });
      prisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        customerId: 'cust-1',
        status: 'DELIVERED',
        deliveredAt: expiredDelivery,
        runnerId: 'runner-1',
      });

      await expect(
        service.createRating('order-1', CUSTOMER, { stars: 5 }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('forbids non-customer actors before querying the customer', async () => {
      await expect(
        service.createRating('order-1', RUNNER, { stars: 5 }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.customer.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('updateRating', () => {
    it('updates a rating inside the edit window and replaces the runner average', async () => {
      prisma.customer.findUnique.mockResolvedValue({ id: 'cust-1' });
      prisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        customerId: 'cust-1',
        status: 'DELIVERED',
        runnerId: 'runner-1',
        orderNumber: 'FW-000001',
      });
      prisma.rating.findUnique.mockResolvedValue({
        ...baseRating,
        stars: 4,
        runnerId: 'runner-1',
      });
      prisma.runner.findUnique.mockResolvedValue({
        id: 'runner-1',
        avgRating: 4,
        totalRatings: 5,
      });
      prisma.rating.update.mockResolvedValue({ ...baseRating, stars: 5 });
      prisma.runner.update.mockResolvedValue({});

      const result = await service.updateRating('order-1', CUSTOMER, {
        stars: 5,
        note: 'updated',
      });

      expect(result.note).toBe('great runner');
      expect(prisma.rating.update).toHaveBeenCalledWith({
        where: { id: 'rating-1' },
        data: { stars: 5, note: 'updated' },
      });
      expect(prisma.runner.updateMany).toHaveBeenCalledWith({
        where: { id: 'runner-1', totalRatings: 5, avgRating: 4 },
        data: { avgRating: 4.2 },
      });
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 'order-1',
          actorId: 'cust-user-1',
          actorRole: 'CUSTOMER',
          event: 'RATING_UPDATED',
        }),
        prisma,
      );
    });

    it('finalizes an expired rating in a transaction and then rejects the update', async () => {
      prisma.customer.findUnique.mockResolvedValue({ id: 'cust-1' });
      prisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        customerId: 'cust-1',
        status: 'DELIVERED',
        runnerId: 'runner-1',
        orderNumber: 'FW-000001',
      });
      prisma.rating.findUnique.mockResolvedValue({
        ...baseRating,
        runnerId: 'runner-1',
        expiresAt: new Date(Date.now() - 1),
      });
      prisma.rating.update.mockResolvedValue({ ...baseRating, isFinal: true });

      await expect(
        service.updateRating('order-1', CUSTOMER, { stars: 5 }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);

      expect(prisma.rating.update).toHaveBeenCalledWith({
        where: { id: 'rating-1' },
        data: { isFinal: true },
      });
      expect(prisma.$transaction).toHaveBeenCalledOnce();
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 'order-1',
          actorId: 'cust-user-1',
          actorRole: 'CUSTOMER',
          event: 'RATING_FINALIZED',
        }),
        prisma,
      );
    });

    it('rejects an update when the rating is not found', async () => {
      prisma.customer.findUnique.mockResolvedValue({ id: 'cust-1' });
      prisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        customerId: 'cust-1',
        status: 'DELIVERED',
        runnerId: 'runner-1',
        orderNumber: 'FW-000001',
      });
      prisma.rating.findUnique.mockResolvedValue(null);

      await expect(
        service.updateRating('order-1', CUSTOMER, { stars: 5 }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
