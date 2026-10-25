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
import type { LedgerService } from '../../src/modules/ledger/ledger.service.js';
import {
  RunnerCurrentSettlementSchema,
  RUNNER_CURRENT_SETTLEMENT_STATUS_VALUES,
} from '@forerun/shared-types';

describe('SettlementsService (Critical Settlement Paths)', () => {
  let service: SettlementsService;
  let txClient: {
    order: {
      findMany: ReturnType<typeof vi.fn>;
    };
    settlement: {
      count: ReturnType<typeof vi.fn>;
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
    settlement: {
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
    };
    order: {
      findMany: ReturnType<typeof vi.fn>;
    };
  };
  let auditService: {
    log: ReturnType<typeof vi.fn>;
  };
  let notificationsService: {
    emitToAdmin: ReturnType<typeof vi.fn>;
  };
  let ledgerService: {
    createEntry: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    txClient = {
      order: {
        findMany: vi.fn(),
      },
      settlement: {
        count: vi.fn().mockResolvedValue(0),
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
      settlement: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
      },
      order: {
        findMany: vi.fn(),
      },
    };

    auditService = {
      log: vi.fn().mockResolvedValue(undefined),
    };

    notificationsService = {
      emitToAdmin: vi.fn().mockResolvedValue(undefined),
    };

    ledgerService = {
      createEntry: vi.fn().mockResolvedValue({ id: 'led-1' }),
    };

    service = new SettlementsService(
      prisma as unknown as PrismaService,
      auditService as unknown as AuditService,
      notificationsService as unknown as NotificationsService,
      ledgerService as unknown as LedgerService,
    );
  });

  describe('calculateSettlementAmounts', () => {
    it('calculates amounts with totalFees without legacy shares per C-2', () => {
      const orders = [
        { id: 'ord-1', totalFee: 60 },
        { id: 'ord-2', totalFee: 75 },
        { id: 'ord-3', totalFee: 100 },
      ];

      const result = (service as any).calculateSettlementAmounts(orders);

      expect(result.totalFees).toBe(235);
      expect(result.items).toHaveLength(3);
      expect(result.items[0]).toEqual({
        orderId: 'ord-1',
        orderFee: 60,
      });
      expect(result.items[1]).toEqual({
        orderId: 'ord-2',
        orderFee: 75,
      });
      expect(result.items[2]).toEqual({
        orderId: 'ord-3',
        orderFee: 100,
      });
    });

    it('returns zeroes for an empty order list', () => {
      const result = (service as any).calculateSettlementAmounts([]);

      expect(result).toEqual({
        totalFees: 0,
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

    it('rejects already settled runners with ConflictException (no silent omission)', async () => {
      const orders = [
        { id: 'o-1', runnerId: 'runner-1', totalFee: 60 },
        { id: 'o-2', runnerId: 'runner-2', totalFee: 100 },
      ];
      txClient.order.findMany.mockResolvedValue(orders);
      txClient.settlement.count.mockResolvedValue(2);

      // Both runners are already in the settlement table for this operationalDate
      txClient.settlement.findMany.mockResolvedValue([
        { runnerId: 'runner-1' },
        { runnerId: 'runner-2' },
      ]);

      await expect(
        service.closeDay(operationalDate, 'notes', userId, adminId),
      ).rejects.toThrow(ConflictException);

      expect(txClient.settlement.create).not.toHaveBeenCalled();
      expect(txClient.settlementItem.createMany).not.toHaveBeenCalled();
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

      // Runner 1: 60 + 100 = 160
      expect(txClient.settlement.create).toHaveBeenCalledWith({
        data: {
          runnerId: 'r-1',
          operationalDate,
          totalOrders: 2,
          totalFees: 160,
          notes: 'Daily settlement batch',
        },
      });

      // Runner 2: 80 + 90 = 170
      expect(txClient.settlement.create).toHaveBeenCalledWith({
        data: {
          runnerId: 'r-2',
          operationalDate,
          totalOrders: 2,
          totalFees: 170,
          notes: 'Daily settlement batch',
        },
      });

      // Runner 3: 70
      expect(txClient.settlement.create).toHaveBeenCalledWith({
        data: {
          runnerId: 'r-3',
          operationalDate,
          totalOrders: 1,
          totalFees: 70,
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

    it('successfully settles a pending settlement, creates LedgerEntry via LedgerService and logs audit', async () => {
      const mockSettlement = {
        id: settlementId,
        runnerId: 'run-1',
        status: 'PENDING',
        totalFees: 300,
        totalOrders: 3,
        operationalDate: '2026-10-04',
      };

      txClient.settlement.findUnique.mockResolvedValue(mockSettlement);
      txClient.settlement.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.markSettled(settlementId, userId, adminId);

      expect(txClient.settlement.updateMany).toHaveBeenCalledWith({
        where: { id: settlementId, status: 'PENDING' },
        data: {
          status: 'SETTLED',
          closedAt: expect.any(Date),
          closedByAdminId: adminId,
        },
      });

      expect(ledgerService.createEntry).toHaveBeenCalledWith(
        {
          runnerId: 'run-1',
          type: 'SETTLEMENT_PAID',
          amount: 300,
          description: `Settlement ${settlementId} settled for 2026-10-04`,
        },
        txClient,
      );
      expect(txClient.ledgerEntry.create).not.toHaveBeenCalled();

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

    it('successfully settles a pending settlement when totalFees = 0 without creating LedgerEntry', async () => {
      const mockSettlement = {
        id: settlementId,
        runnerId: 'run-1',
        status: 'PENDING',
        totalFees: 0,
        totalOrders: 0,
        operationalDate: '2026-10-04',
      };

      txClient.settlement.findUnique.mockResolvedValue(mockSettlement);
      txClient.settlement.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.markSettled(settlementId, userId, adminId);

      expect(txClient.settlement.updateMany).toHaveBeenCalledWith({
        where: { id: settlementId, status: 'PENDING' },
        data: {
          status: 'SETTLED',
          closedAt: expect.any(Date),
          closedByAdminId: adminId,
        },
      });

      // Crucial: No ledger entry should be created for 0 fees
      expect(ledgerService.createEntry).not.toHaveBeenCalled();
      expect(txClient.ledgerEntry.create).not.toHaveBeenCalled();

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

  describe('getCurrentSettlement', () => {
    const runnerId = 'runner-test-id';

    it('returns NOT_CLOSED status and valid RunnerCurrentSettlement schema when day is unclosed (no DB settlement)', async () => {
      prisma.settlement.findUnique.mockResolvedValue(null);
      prisma.order.findMany.mockResolvedValue([
        {
          orderNumber: 'FW-000001',
          totalFee: 80,
          deliveredAt: new Date('2026-10-24T12:00:00Z'),
        },
        {
          orderNumber: 'FW-000002',
          totalFee: 100,
          deliveredAt: new Date('2026-10-24T13:00:00Z'),
        },
      ]);

      const result = await service.getCurrentSettlement(runnerId);

      expect(result.status).toBe('NOT_CLOSED');
      expect(result.totalOrders).toBe(2);
      expect(result.totalFees).toBe(180);
      expect(result.estimatedRunnerShare).toBe(0);
      expect(result.estimatedPlatformShare).toBe(180);
      expect(result.orders).toHaveLength(2);
      expect(result.orders[0].orderNumber).toBe('FW-000001');

      // Contract validation: RunnerCurrentSettlementSchema.parse() succeeds without error
      const parsed = RunnerCurrentSettlementSchema.parse(result);
      expect(parsed).toEqual(result);
      expect(parsed.status).toBe('NOT_CLOSED');
    });

    it('returns PENDING status and valid schema when day is closed with PENDING settlement in DB', async () => {
      const mockSettlement = {
        id: 'set-pending-1',
        runnerId,
        operationalDate: '2026-10-24',
        status: 'PENDING' as const,
        totalOrders: 2,
        totalFees: 180,
        items: [
          {
            orderFee: 80,
            order: {
              orderNumber: 'FW-000001',
              deliveredAt: new Date('2026-10-24T12:00:00Z'),
            },
          },
          {
            orderFee: 100,
            order: {
              orderNumber: 'FW-000002',
              deliveredAt: new Date('2026-10-24T13:00:00Z'),
            },
          },
        ],
      };

      prisma.settlement.findUnique.mockResolvedValue(mockSettlement);

      const result = await service.getCurrentSettlement(runnerId);

      expect(result.status).toBe('PENDING');
      expect(result.operationalDate).toBe('2026-10-24');
      expect(result.totalOrders).toBe(2);
      expect(result.totalFees).toBe(180);
      expect(result.estimatedRunnerShare).toBe(0);
      expect(result.estimatedPlatformShare).toBe(180);
      expect(result.orders).toHaveLength(2);
      expect(result.orders[0].orderNumber).toBe('FW-000001');
      expect(result.orders[1].orderNumber).toBe('FW-000002');

      // Contract validation: RunnerCurrentSettlementSchema.parse() succeeds without error
      const parsed = RunnerCurrentSettlementSchema.parse(result);
      expect(parsed).toEqual(result);
      expect(parsed.status).toBe('PENDING');
    });

    it('returns SETTLED status and valid schema when day is closed with SETTLED settlement in DB', async () => {
      const mockSettlement = {
        id: 'set-settled-1',
        runnerId,
        operationalDate: '2026-10-24',
        status: 'SETTLED' as const,
        totalOrders: 1,
        totalFees: 90,
        items: [
          {
            orderFee: 90,
            order: {
              orderNumber: 'FW-000003',
              deliveredAt: new Date('2026-10-24T14:00:00Z'),
            },
          },
        ],
      };

      prisma.settlement.findUnique.mockResolvedValue(mockSettlement);

      const result = await service.getCurrentSettlement(runnerId);

      expect(result.status).toBe('SETTLED');
      expect(result.operationalDate).toBe('2026-10-24');
      expect(result.totalOrders).toBe(1);
      expect(result.totalFees).toBe(90);
      expect(result.estimatedRunnerShare).toBe(0);
      expect(result.estimatedPlatformShare).toBe(90);
      expect(result.orders).toHaveLength(1);
      expect(result.orders[0].orderNumber).toBe('FW-000003');

      // Contract validation: RunnerCurrentSettlementSchema.parse() succeeds without error
      const parsed = RunnerCurrentSettlementSchema.parse(result);
      expect(parsed).toEqual(result);
      expect(parsed.status).toBe('SETTLED');
    });

    it('validates that RunnerCurrentSettlementSchema enforces strictly defined statuses', () => {
      expect(RUNNER_CURRENT_SETTLEMENT_STATUS_VALUES).toEqual([
        'NOT_CLOSED',
        'PENDING',
        'SETTLED',
      ]);

      const basePayload = {
        operationalDate: '2026-10-24',
        totalOrders: 1,
        totalFees: 50,
        estimatedRunnerShare: 0,
        estimatedPlatformShare: 50,
        orders: [
          {
            orderNumber: 'FW-000001',
            totalFee: 50,
            deliveredAt: new Date(),
          },
        ],
      };

      // All 3 valid statuses pass
      for (const validStatus of RUNNER_CURRENT_SETTLEMENT_STATUS_VALUES) {
        const parsed = RunnerCurrentSettlementSchema.parse({
          ...basePayload,
          status: validStatus,
        });
        expect(parsed.status).toBe(validStatus);
      }

      // Invalid status fails parse
      expect(() =>
        RunnerCurrentSettlementSchema.parse({
          ...basePayload,
          status: 'INVALID_STATUS',
        }),
      ).toThrow();
    });
  });
});

