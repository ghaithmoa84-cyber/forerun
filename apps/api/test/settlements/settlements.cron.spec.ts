import { beforeEach, describe, it, expect, vi } from 'vitest';
import {
  SettlementsService,
  getOperationalDate,
} from '../../src/modules/settlements/settlements.service.js';
import type { PrismaService } from '../../src/database/prisma.service.js';
import type { AuditService } from '../../src/modules/audit/audit.service.js';
import type { NotificationsService } from '../../src/modules/notifications/notifications.service.js';

describe('SettlementsService cron helpers', () => {
  let prisma: any;
  let notificationsService: { emitToAdmin: ReturnType<typeof vi.fn> };
  let service: SettlementsService;

  beforeEach(() => {
    notificationsService = { emitToAdmin: vi.fn().mockResolvedValue(undefined) };
    prisma = {
      order: { findMany: vi.fn() },
      $transaction: vi.fn(),
    };
    service = new SettlementsService(
      prisma as unknown as PrismaService,
      {} as unknown as AuditService,
      notificationsService as unknown as NotificationsService,
    );
  });

  describe('getOperationalDate', () => {
    it('returns a valid YYYY-MM-DD operational date', () => {
      const date = getOperationalDate();

      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(new Date(`${date}T00:00:00Z`).getTime())).toBe(false);
    });
  });

  describe('checkPendingOrders', () => {
    it('counts unique runners with pending delivered orders', async () => {
      const date = '2026-09-19';
      prisma.order.findMany.mockResolvedValue([
        { runnerId: 'r1' },
        { runnerId: 'r1' },
        { runnerId: 'r2' },
      ]);

      const result = await service.checkPendingOrders(date);

      expect(result).toBe(2);
      expect(prisma.order.findMany).toHaveBeenCalledWith({
        where: {
          status: 'DELIVERED',
          createdAt: {
            gte: new Date(`${date}T00:00:00+03:00`),
            lte: new Date(`${date}T23:59:59.999+03:00`),
          },
          settlementItem: { is: null },
        },
        select: { runnerId: true },
      });
    });

    it('returns zero when there are no pending orders', async () => {
      prisma.order.findMany.mockResolvedValue([]);

      await expect(service.checkPendingOrders('2026-09-19')).resolves.toBe(0);
      expect(prisma.order.findMany).toHaveBeenCalledOnce();
    });
  });

  describe('settlementReminder', () => {
    it('emits one reminder with the pending runner count', async () => {
      prisma.order.findMany.mockResolvedValue([
        { runnerId: 'r1' },
        { runnerId: 'r2' },
      ]);

      await service.settlementReminder();

      expect(notificationsService.emitToAdmin).toHaveBeenCalledTimes(1);
      expect(notificationsService.emitToAdmin).toHaveBeenCalledWith(
        'settlement:reminder',
        expect.objectContaining({
          pendingRunnerCount: 2,
          date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
          message: 'لديك تسوية معلقة لم تُغلق بعد',
        }),
      );
      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'DELIVERED' }),
          select: { runnerId: true },
        }),
      );
    });

    it('does not emit a reminder when there are no pending orders', async () => {
      prisma.order.findMany.mockResolvedValue([]);

      await service.settlementReminder();

      expect(notificationsService.emitToAdmin).not.toHaveBeenCalled();
    });
  });
});
