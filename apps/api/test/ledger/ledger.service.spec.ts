import { beforeEach, describe, it, expect, vi } from 'vitest';
import {
  LedgerEntryType,
  type CreateLedgerEntryRequest,
} from '@forerun/shared-types';
import { LedgerService } from '../../src/modules/ledger/ledger.service.js';
import { PrismaService } from '../../src/database/prisma.service.js';
import { BadRequestException, NotFoundException } from '@nestjs/common';

const LEDGER_TYPES = [
  'ORDER_FEE_TOTAL',
  'RUNNER_SHARE',
  'PLATFORM_SHARE',
  'SETTLEMENT_PAID',
  'ADMIN_ADJUSTMENT',
] as const;

describe('LedgerService', () => {
  let service: LedgerService;
  let prisma: ReturnType<typeof vi.fn>;

  const mockEntry = (overrides: Record<string, unknown> = {}) => ({
    id: 'ledger-1',
    orderId: 'order-1',
    runnerId: 'runner-1',
    type: 'ORDER_FEE_TOTAL',
    amount: 6000,
    description: 'Test entry',
    meta: null,
    createdAt: new Date('2026-09-15T10:00:00Z'),
    ...overrides,
  });

  beforeEach(() => {
    prisma = {
      ledgerEntry: {
        create: vi.fn(),
        count: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
      },
      $transaction: vi.fn(),
    };
    service = new LedgerService(prisma as unknown as PrismaService);
  });

  // ── createEntry ──────────────────────────────────────────
  describe('createEntry', () => {
    it('creates a ledger entry with correct data when amount is positive', async () => {
      const input: CreateLedgerEntryRequest = {
        type: 'RUNNER_SHARE' as LedgerEntryType,
        amount: 6000,
        description: 'Runner share for order FW-000001',
        orderId: 'order-1',
        runnerId: 'runner-1',
      };

      prisma.ledgerEntry.create.mockResolvedValue(
        mockEntry({ id: 'le-1', type: 'RUNNER_SHARE', amount: 6000 }),
      );

      const result = await service.createEntry(input);

      expect(prisma.ledgerEntry.create).toHaveBeenCalledWith({
        data: {
          orderId: 'order-1',
          runnerId: 'runner-1',
          type: 'RUNNER_SHARE',
          amount: 6000,
          description: 'Runner share for order FW-000001',
          meta: expect.anything(),
        },
      });
      expect(result.id).toBe('le-1');
      expect(result.type).toBe('RUNNER_SHARE');
      expect(result.amount).toBe(6000);
    });

    it('rejects amount = 0 throwing BadRequestException', async () => {
      const input: CreateLedgerEntryRequest = {
        type: 'ORDER_FEE_TOTAL' as LedgerEntryType,
        amount: 0,
        description: 'Zero amount entry',
      };

      await expect(service.createEntry(input)).rejects.toThrow(BadRequestException);
      expect(prisma.ledgerEntry.create).not.toHaveBeenCalled();
    });

    it('rejects negative amount throwing BadRequestException', async () => {
      const input: CreateLedgerEntryRequest = {
        type: 'ORDER_FEE_TOTAL' as LedgerEntryType,
        amount: -100,
        description: 'Negative amount entry',
      };

      await expect(service.createEntry(input)).rejects.toThrow(BadRequestException);
      expect(prisma.ledgerEntry.create).not.toHaveBeenCalled();
    });

    it('rejects NaN, null, and non-integer floats', async () => {
      const invalidInputs: unknown[] = [NaN, null, 10.5, '6000', undefined];

      for (const amount of invalidInputs) {
        const input = {
          type: 'ORDER_FEE_TOTAL' as LedgerEntryType,
          amount: amount as number,
          description: 'Invalid amount entry',
        };

        await expect(service.createEntry(input)).rejects.toThrow(BadRequestException);
        expect(prisma.ledgerEntry.create).not.toHaveBeenCalled();
      }
    });

    it('creates a ledger entry without orderId or runnerId', async () => {
      const input: CreateLedgerEntryRequest = {
        type: 'PLATFORM_SHARE' as LedgerEntryType,
        amount: 1500,
        description: 'Platform share',
      };

      prisma.ledgerEntry.create.mockResolvedValue(mockEntry({ id: 'le-2' }));

      const result = await service.createEntry(input);

      expect(prisma.ledgerEntry.create).toHaveBeenCalledWith({
        data: {
          orderId: null,
          runnerId: null,
          type: 'PLATFORM_SHARE',
          amount: 1500,
          description: 'Platform share',
          meta: expect.anything(),
        },
      });
      expect(result.id).toBe('le-2');
    });

    it('passes meta as JsonValue when provided', async () => {
      const input: CreateLedgerEntryRequest = {
        type: 'ADMIN_ADJUSTMENT' as LedgerEntryType,
        amount: 500,
        description: 'Admin adjustment',
        meta: { reason: 'fee correction', oldAmount: 400 },
      };

      prisma.ledgerEntry.create.mockResolvedValue(mockEntry({ id: 'le-3' }));

      await service.createEntry(input);

      expect(prisma.ledgerEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            meta: input.meta,
          }),
        }),
      );
    });
  });

  // ── createMany ──────────────────────────────────────────
  describe('createMany', () => {
    it('creates multiple entries in a transaction when all amounts are positive', async () => {
      const entries: CreateLedgerEntryRequest[] = [
        {
          type: 'ORDER_FEE_TOTAL' as LedgerEntryType,
          amount: 6000,
          description: 'Order fee',
          orderId: 'order-1',
        },
        {
          type: 'RUNNER_SHARE' as LedgerEntryType,
          amount: 4500,
          description: 'Runner share',
          orderId: 'order-1',
          runnerId: 'runner-1',
        },
      ];

      prisma.$transaction.mockImplementation(
        async (fn: (tx: typeof prisma) => Promise<unknown>) => {
          return fn(prisma);
        },
      );
      prisma.ledgerEntry.create
        .mockResolvedValueOnce(mockEntry({ id: 'le-1' }))
        .mockResolvedValueOnce(mockEntry({ id: 'le-2' }));

      const result = await service.createMany(entries);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('le-1');
      expect(result[1].id).toBe('le-2');
      expect(prisma.ledgerEntry.create).toHaveBeenCalledTimes(2);
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('rejects amount = 0 in createMany throwing BadRequestException', async () => {
      const entries: CreateLedgerEntryRequest[] = [
        {
          type: 'ORDER_FEE_TOTAL' as LedgerEntryType,
          amount: 0,
          description: 'Zero amount',
        },
      ];

      await expect(service.createMany(entries)).rejects.toThrow(BadRequestException);
      expect(prisma.ledgerEntry.create).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects negative amount in createMany throwing BadRequestException', async () => {
      const entries: CreateLedgerEntryRequest[] = [
        {
          type: 'ORDER_FEE_TOTAL' as LedgerEntryType,
          amount: -100,
          description: 'Negative amount',
        },
      ];

      await expect(service.createMany(entries)).rejects.toThrow(BadRequestException);
      expect(prisma.ledgerEntry.create).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects NaN, null, and non-integer floats in createMany', async () => {
      const invalidAmounts = [NaN, null, 15.75, '500', undefined];

      for (const amount of invalidAmounts) {
        const entries = [
          {
            type: 'ORDER_FEE_TOTAL' as LedgerEntryType,
            amount: amount as number,
            description: 'Invalid amount',
          },
        ];

        await expect(service.createMany(entries)).rejects.toThrow(BadRequestException);
        expect(prisma.ledgerEntry.create).not.toHaveBeenCalled();
      }
    });

    it('enforces atomicity: if one entry has amount = 0, no entries are written', async () => {
      const entries: CreateLedgerEntryRequest[] = [
        {
          type: 'ORDER_FEE_TOTAL' as LedgerEntryType,
          amount: 6000,
          description: 'Valid fee',
        },
        {
          type: 'RUNNER_SHARE' as LedgerEntryType,
          amount: 0,
          description: 'Zero fee',
        },
      ];

      await expect(service.createMany(entries)).rejects.toThrow(BadRequestException);
      expect(prisma.ledgerEntry.create).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('returns empty array when given empty entries without invoking transaction or create', async () => {
      const result = await service.createMany([]);
      expect(result).toEqual([]);
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.ledgerEntry.create).not.toHaveBeenCalled();
    });
  });

  // ── listAdminEntries ─────────────────────────────────────
  describe('listAdminEntries', () => {
    it('returns paginated results sorted by createdAt desc', async () => {
      prisma.ledgerEntry.count.mockResolvedValue(2);
      prisma.ledgerEntry.findMany.mockResolvedValue([mockEntry()]);

      const result = await service.listAdminEntries({
        page: 1,
        limit: 20,
      });

      expect(prisma.ledgerEntry.count).toHaveBeenCalledWith({ where: {} });
      expect(prisma.ledgerEntry.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
      });

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
    });

    it('filters by type', async () => {
      prisma.ledgerEntry.count.mockResolvedValue(1);
      prisma.ledgerEntry.findMany.mockResolvedValue([mockEntry()]);

      await service.listAdminEntries({
        page: 1,
        limit: 20,
        type: 'ORDER_FEE_TOTAL' as LedgerEntryType,
      });

      expect(prisma.ledgerEntry.count).toHaveBeenCalledWith({
        where: { type: 'ORDER_FEE_TOTAL' },
      });
    });

    it('filters by runnerId', async () => {
      prisma.ledgerEntry.count.mockResolvedValue(1);
      prisma.ledgerEntry.findMany.mockResolvedValue([mockEntry()]);

      await service.listAdminEntries({
        page: 1,
        limit: 20,
        runnerId: 'runner-1',
      });

      expect(prisma.ledgerEntry.count).toHaveBeenCalledWith({
        where: { runnerId: 'runner-1' },
      });
    });

    it('filters by orderId', async () => {
      prisma.ledgerEntry.count.mockResolvedValue(1);
      prisma.ledgerEntry.findMany.mockResolvedValue([mockEntry()]);

      await service.listAdminEntries({
        page: 1,
        limit: 20,
        orderId: 'order-1',
      });

      expect(prisma.ledgerEntry.count).toHaveBeenCalledWith({
        where: { orderId: 'order-1' },
      });
    });

    it('filters by date range', async () => {
      prisma.ledgerEntry.count.mockResolvedValue(1);
      prisma.ledgerEntry.findMany.mockResolvedValue([mockEntry()]);

      const dateFrom = new Date('2026-09-01');
      const dateTo = new Date('2026-09-30');

      await service.listAdminEntries({
        page: 1,
        limit: 20,
        dateFrom,
        dateTo,
      });

      expect(prisma.ledgerEntry.count).toHaveBeenCalledWith({
        where: {
          createdAt: { gte: dateFrom, lte: dateTo },
        },
      });
    });

    it('handles empty results', async () => {
      prisma.ledgerEntry.count.mockResolvedValue(0);
      prisma.ledgerEntry.findMany.mockResolvedValue([]);

      const result = await service.listAdminEntries({
        page: 1,
        limit: 20,
      });

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
    });

    it('calculates totalPages correctly', async () => {
      prisma.ledgerEntry.count.mockResolvedValue(50);
      prisma.ledgerEntry.findMany.mockResolvedValue([]);

      const result = await service.listAdminEntries({
        page: 2,
        limit: 20,
      });

      expect(result.meta.totalPages).toBe(3);
      expect(prisma.ledgerEntry.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 20,
        take: 20,
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  // ── getEntryById ──────────────────────────────────────────
  describe('getEntryById', () => {
    it('returns entry when found', async () => {
      prisma.ledgerEntry.findUnique.mockResolvedValue(mockEntry({ id: 'le-1' }));

      const result = await service.getEntryById('le-1');

      expect(result.id).toBe('le-1');
    });

    it('throws NotFoundException when not found', async () => {
      prisma.ledgerEntry.findUnique.mockResolvedValue(null);

      await expect(service.getEntryById('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
