import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { SettlementsService } from '../../src/modules/settlements/settlements.service.js';
import type { PrismaService } from '../../src/database/prisma.service.js';
import type { AuditService } from '../../src/modules/audit/audit.service.js';
import type { NotificationsService } from '../../src/modules/notifications/notifications.service.js';

describe('SettlementsService (Critical Settlement Paths)', () => {
  let service: SettlementsService;
  let txClient: {
    order: {
      findMany: ReturnType<typeof vi.fn>;
    };
    settlement: {
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
    };
    settlementItem: {
      createMany: ReturnType<typeof vi.fn>;
    };
    ledgerEntry: {
      create: ReturnType<typeof vi.fn>;
    };
  };
  let prisma: {
    $transaction: ReturnType<typeof vi.fn>;
  };
  let auditService: {
    log: ReturnType<typeof vi.fn>;
  };
  let notificationsService: {
    emitToAdmin: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    txClient = {
      order: {
        findMany: vi.fn(),
      },
      settlement: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        updateMany: vi.fn(),
      },
      settlementItem: {
        createMany: vi.fn(),
      },
      ledgerEntry: {
        create: vi.fn(),
      },
    };

    prisma = {
      $transaction: vi.fn().mockImplementation((callback) => callback(txClient)),
    };

    auditService = {
      log: vi.fn().mockResolvedValue(undefined),
    };

    notificationsService = {
      emitToAdmin: vi.fn().mockResolvedValue(undefined),
    };

    service = new SettlementsService(
      prisma as unknown as PrismaService,
      auditService as unknown as AuditService,
      notificationsService as unknown as NotificationsService,
    );
  });

  describe('calculateSettlementAmounts', () => {
    it('calculates amounts with totalFees and unified runnerShare=0, platformShare=totalFees per D26', () => {
      const orders = [
        { id: 'ord-1', totalFee: 60 },
        { id: 'ord-2', totalFee: 75 },
        { id: 'ord-3', totalFee: 100 },
      ];

      const result = (service as any).calculateSettlementAmounts(orders);

      expect(result.totalFees).toBe(235);
      expect(result.runnerShare).toBe(0);
      expect(result.platformShare).toBe(235);

      expect(result.items).toHaveLength(3);
      expect(result.items[0]).toEqual({
        orderId: 'ord-1',
        orderFee: 60,
        runnerShare: 0,
        platformShare: 60,
      });
      expect(result.items[1]).toEqual({
        orderId: 'ord-2',
        orderFee: 75,
        runnerShare: 0,
        platformShare: 75,
      });
      expect(result.items[2]).toEqual({
        orderId: 'ord-3',
        orderFee: 100,
        runnerShare: 0,
        platformShare: 100,
      });
    });

    it('returns zeroes for an empty order list', () => {
      const result = (service as any).calculateSettlementAmounts([]);

      expect(result).toEqual({
        totalFees: 0,
        runnerShare: 0,
        platformShare: 0,
        items: [],
      });
    });
  });

  describe('closeDay', () => {
    const operationalDate = '2026-10-04';
    const userId = 'admin-user-id';
    const adminId = 'admin-id';

    it('returns empty result when there are no delivered orders', async () => {
      txClient.order.findMany.mockResolvedValue([]);
      txClient.settlement.findMany.mockResolvedValue([]);

      const result = await service.closeDay(operationalDate, null, userId, adminId);

      expect(result).toEqual({
        settlements: [],
        runnerCount: 0,
      });

      expect(txClient.settlement.create).not.toHaveBeenCalled();
      expect(txClient.settlementItem.createMany).not.toHaveBeenCalled();

      expect(auditService.log).toHaveBeenCalledWith(
        {
          actorId: userId,
          actorRole: 'ADMIN',
          event: 'SETTLEMENT_CLOSED',
          meta: {
            operationalDate,
            runnerCount: 0,
            orderCount: 0,
          },
        },
        txClient,
      );

      expect(notificationsService.emitToAdmin).toHaveBeenCalledWith('settlement:closed', {
        date: operationalDate,
        runnerCount: 0,
      });
    });

    it('skips already settled runners (idempotency)', async () => {
      const orders = [
        { id: 'o-1', runnerId: 'runner-1', totalFee: 60 },
        { id: 'o-2', runnerId: 'runner-2', totalFee: 100 },
      ];
      txClient.order.findMany.mockResolvedValue(orders);

      // Both runners are already in the settlement table for this operationalDate
      txClient.settlement.findMany.mockResolvedValue([
        { runnerId: 'runner-1' },
        { runnerId: 'runner-2' },
      ]);

      const result = await service.closeDay(operationalDate, 'notes', userId, adminId);

      expect(result).toEqual({
        settlements: [],
        runnerCount: 0,
      });
      expect(txClient.settlement.create).not.toHaveBeenCalled();
      expect(txClient.settlementItem.createMany).not.toHaveBeenCalled();
      expect(notificationsService.emitToAdmin).toHaveBeenCalledWith('settlement:closed', {
        date: operationalDate,
        runnerCount: 0,
      });
    });

    it('creates settlement and breakdown records for 3 runners with 5 orders', async () => {
      const orders = [
        { id: 'ord-1', runnerId: 'r-1', totalFee: 60 },
        { id: 'ord-2', runnerId: 'r-1', totalFee: 100 },
        { id: 'ord-3', runnerId: 'r-2', totalFee: 80 },
        { id: 'ord-4', runnerId: 'r-2', totalFee: 90 },
        { id: 'ord-5', runnerId: 'r-3', totalFee: 70 },
      ];
      txClient.order.findMany.mockResolvedValue(orders);

      // No runners closed yet
      txClient.settlement.findMany.mockResolvedValue([]);

      let settlementCounter = 1;
      txClient.settlement.create.mockImplementation(({ data }) =>
        Promise.resolve({
          id: `set-${settlementCounter++}`,
          ...data,
          status: 'PENDING',
          closedAt: null,
          closedByAdminId: null,
          createdAt: new Date(),
        }),
      );
      txClient.settlementItem.createMany.mockResolvedValue({ count: 2 });

      const result = await service.closeDay(operationalDate, 'Daily settlement batch', userId, adminId);

      expect(result.runnerCount).toBe(3);
      expect(result.settlements).toHaveLength(3);

      // Runner 1: 60 + 100 = 160; runnerShare: 0; platformShare: 160
      expect(txClient.settlement.create).toHaveBeenCalledWith({
        data: {
          runnerId: 'r-1',
          operationalDate,
          totalOrders: 2,
          totalFees: 160,
          runnerShare: 0,
          platformShare: 160,
          notes: 'Daily settlement batch',
        },
      });

      // Runner 2: 80 + 90 = 170; runnerShare: 0; platformShare: 170
      expect(txClient.settlement.create).toHaveBeenCalledWith({
        data: {
          runnerId: 'r-2',
          operationalDate,
          totalOrders: 2,
          totalFees: 170,
          runnerShare: 0,
          platformShare: 170,
          notes: 'Daily settlement batch',
        },
      });

      // Runner 3: 70; runnerShare: 0; platformShare: 70
      expect(txClient.settlement.create).toHaveBeenCalledWith({
        data: {
          runnerId: 'r-3',
          operationalDate,
          totalOrders: 1,
          totalFees: 70,
          runnerShare: 0,
          platformShare: 70,
          notes: 'Daily settlement batch',
        },
      });

      expect(txClient.settlementItem.createMany).toHaveBeenCalledTimes(3);

      expect(auditService.log).toHaveBeenCalledWith(
        {
          actorId: userId,
          actorRole: 'ADMIN',
          event: 'SETTLEMENT_CLOSED',
          meta: {
            operationalDate,
            runnerCount: 3,
            orderCount: 5,
          },
        },
        txClient,
      );

      expect(notificationsService.emitToAdmin).toHaveBeenCalledWith('settlement:closed', {
        date: operationalDate,
        runnerCount: 3,
      });
    });

    it('settles only unclosed runners when one runner is already closed', async () => {
      const orders = [
        { id: 'ord-1', runnerId: 'r-already-closed', totalFee: 100 },
        { id: 'ord-2', runnerId: 'r-new', totalFee: 60 },
      ];
      txClient.order.findMany.mockResolvedValue(orders);

      txClient.settlement.findMany.mockResolvedValue([{ runnerId: 'r-already-closed' }]);

      txClient.settlement.create.mockResolvedValue({
        id: 'set-new',
        runnerId: 'r-new',
        operationalDate,
        totalOrders: 1,
        totalFees: 60,
        runnerShare: 45,
        platformShare: 15,
        notes: null,
      });

      const result = await service.closeDay(operationalDate, null, userId, adminId);

      expect(result.runnerCount).toBe(1);
      expect(result.settlements).toHaveLength(1);
      expect(txClient.settlement.create).toHaveBeenCalledTimes(1);
      expect(txClient.settlement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ runnerId: 'r-new' }),
        }),
      );
    });
  });

  describe('markSettled', () => {
    const settlementId = 'set-100';
    const userId = 'user-admin-1';
    const adminId = 'admin-id-1';

    it('throws NotFoundException when settlement does not exist', async () => {
      txClient.settlement.findUnique.mockResolvedValue(null);

      await expect(service.markSettled(settlementId, userId, adminId)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.markSettled(settlementId, userId, adminId)).rejects.toThrow(
        'Settlement not found',
      );
    });

    it('throws ConflictException when settlement is already SETTLED', async () => {
      txClient.settlement.findUnique.mockResolvedValue({
        id: settlementId,
        status: 'SETTLED',
      });

      await expect(service.markSettled(settlementId, userId, adminId)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.markSettled(settlementId, userId, adminId)).rejects.toThrow(
        'Settlement already marked as settled',
      );
    });

    it('throws BadRequestException when settlement status is not PENDING', async () => {
      txClient.settlement.findUnique.mockResolvedValue({
        id: settlementId,
        status: 'CANCELLED',
      });

      await expect(service.markSettled(settlementId, userId, adminId)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.markSettled(settlementId, userId, adminId)).rejects.toThrow(
        'Settlement is not pending',
      );
    });

    it('throws ConflictException on concurrent update race condition', async () => {
      txClient.settlement.findUnique.mockResolvedValue({
        id: settlementId,
        runnerId: 'run-1',
        status: 'PENDING',
        platformShare: 50,
        operationalDate: '2026-10-04',
      });

      txClient.settlement.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.markSettled(settlementId, userId, adminId)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.markSettled(settlementId, userId, adminId)).rejects.toThrow(
        'Settlement already settled or not found',
      );
    });

    it('successfully settles a pending settlement, creates LedgerEntry and logs audit', async () => {
      const mockSettlement = {
        id: settlementId,
        runnerId: 'run-1',
        status: 'PENDING',
        platformShare: 75,
        runnerShare: 225,
        totalFees: 300,
        totalOrders: 3,
        operationalDate: '2026-10-04',
      };

      txClient.settlement.findUnique.mockResolvedValue(mockSettlement);
      txClient.settlement.updateMany.mockResolvedValue({ count: 1 });
      txClient.ledgerEntry.create.mockResolvedValue({ id: 'led-1' });

      const result = await service.markSettled(settlementId, userId, adminId);

      expect(txClient.settlement.updateMany).toHaveBeenCalledWith({
        where: { id: settlementId, status: 'PENDING' },
        data: {
          status: 'SETTLED',
          closedAt: expect.any(Date),
          closedByAdminId: adminId,
        },
      });

      expect(txClient.ledgerEntry.create).toHaveBeenCalledWith({
        data: {
          runnerId: 'run-1',
          type: 'SETTLEMENT_PAID',
          amount: 75,
          description: `Settlement ${settlementId} settled for 2026-10-04`,
        },
      });

      expect(auditService.log).toHaveBeenCalledWith(
        {
          actorId: userId,
          actorRole: 'ADMIN',
          event: 'SETTLEMENT_MARKED_SETTLED',
          fromStatus: 'PENDING',
          toStatus: 'SETTLED',
          meta: {
            settlementId,
            runnerId: 'run-1',
          },
        },
        txClient,
      );

      expect(result.settlement).toEqual(
        expect.objectContaining({
          id: settlementId,
          runnerId: 'run-1',
          status: 'SETTLED',
          closedByAdminId: adminId,
          closedAt: expect.any(Date),
        }),
      );
    });
  });
});
