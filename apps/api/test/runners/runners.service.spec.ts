import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { RunnersService } from '../../src/modules/runners/runners.service.js';
import { RunnerStateMachine } from '../../src/state-machine/runner-state-machine.js';
import { RUNNER_TRANSITIONS } from '../../src/state-machine/runner-transitions.js';

describe('RunnersService — Least Privilege Profile & Admin Notes', () => {
  let service: RunnersService;
  let prisma: any;
  let auditService: any;
  let runnerStateMachine: RunnerStateMachine;

  beforeEach(() => {
    prisma = {
      runner: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        update: vi.fn(),
      },
      user: {
        update: vi.fn(),
      },
      order: {
        findFirst: vi.fn(),
        count: vi.fn(),
      },
      $transaction: vi.fn(async (cb: any) => cb(prisma)),
    };

    auditService = {
      log: vi.fn().mockResolvedValue({}),
    };

    runnerStateMachine = new RunnerStateMachine(RUNNER_TRANSITIONS);

    service = new RunnersService(prisma, auditService, runnerStateMachine);
  });

  describe('getMyProfile (GET /runner/me)', () => {
    it('strictly does not contain the notes property even if present in DB', async () => {
      const mockRunnerInDb = {
        id: 'runner-cuid-1',
        userId: 'user-cuid-1',
        status: 'AVAILABLE',
        isVisible: true,
        avgRating: 4.8,
        totalRatings: 25,
        notes: 'Administrative confidential note: evaluated as top tier runner',
        user: {
          id: 'user-cuid-1',
          name: 'Ahmed Runner',
          whatsapp: '0999123456',
          altPhone: '0999654321',
        },
      };

      prisma.runner.findUnique.mockResolvedValue(mockRunnerInDb);

      const profile = await service.getMyProfile('user-cuid-1');

      // 1. Verify standard runner profile fields
      expect(profile).toEqual({
        id: 'runner-cuid-1',
        name: 'Ahmed Runner',
        whatsapp: '0999123456',
        altPhone: '0999654321',
        status: 'AVAILABLE',
        isVisible: true,
        avgRating: 4.8,
        totalRatings: 25,
      });

      // 2. Strict negative checks: ensure notes key is completely absent
      expect('notes' in profile).toBe(false);
      expect(profile).not.toHaveProperty('notes');
      expect((profile as any).notes).toBeUndefined();

      // 3. Exact key inventory match
      const keys = Object.keys(profile).sort();
      expect(keys).toEqual([
        'altPhone',
        'avgRating',
        'id',
        'isVisible',
        'name',
        'status',
        'totalRatings',
        'whatsapp',
      ]);
    });

    it('throws NotFoundException when runner does not exist', async () => {
      prisma.runner.findUnique.mockResolvedValue(null);

      await expect(service.getMyProfile('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('Admin Routes — reading and updating notes unaffected', () => {
    it('findAll (GET /admin/runners) still exposes notes for administrators', async () => {
      const mockRunnersList = [
        {
          id: 'runner-cuid-1',
          status: 'AVAILABLE',
          isVisible: true,
          avgRating: 4.5,
          totalRatings: 10,
          notes: 'Admin note: reliable morning runner',
          user: {
            name: 'Runner 1',
            whatsapp: '0999111111',
          },
        },
        {
          id: 'runner-cuid-2',
          status: 'OFFLINE',
          isVisible: false,
          avgRating: null,
          totalRatings: 0,
          notes: null,
          user: {
            name: 'Runner 2',
            whatsapp: '0999222222',
          },
        },
      ];

      prisma.runner.count.mockResolvedValue(2);
      prisma.runner.findMany.mockResolvedValue(mockRunnersList);

      const result = await service.findAll(1, 10);

      expect(result.data).toHaveLength(2);
      expect('notes' in result.data[0]).toBe(true);
      expect(result.data[0].notes).toBe('Admin note: reliable morning runner');
      expect('notes' in result.data[1]).toBe(true);
      expect(result.data[1].notes).toBeNull();
    });

    it('update (PUT /admin/runners/:id) successfully updates notes and writes audit log', async () => {
      const mockRunner = {
        id: 'runner-cuid-1',
        userId: 'user-cuid-1',
        user: {
          id: 'user-cuid-1',
          name: 'Ahmed',
        },
      };

      prisma.runner.findUnique.mockResolvedValue(mockRunner);
      prisma.user.update.mockResolvedValue({});
      prisma.runner.update.mockResolvedValue({});

      const result = await service.update(
        {
          id: 'runner-cuid-1',
          notes: 'Updated admin internal remark',
        },
        'admin-user-id',
      );

      expect(result).toEqual({
        statusCode: 200,
        message: 'Runner updated successfully',
      });

      // Verify DB update included notes
      expect(prisma.runner.update).toHaveBeenCalledWith({
        where: { id: 'runner-cuid-1' },
        data: { notes: 'Updated admin internal remark' },
      });

      // Verify audit log
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 'admin-user-id',
          actorRole: 'ADMIN',
          event: 'RUNNER_UPDATED',
          meta: { runnerId: 'runner-cuid-1' },
        }),
        prisma,
      );
    });
  });

  describe('getActiveOrder (GET /runner/orders/active) — Defensive Lifecycle Masking', () => {
    const mockRunner = {
      id: 'runner-cuid-1',
      userId: 'user-cuid-1',
    };

    const createMockOrder = (status: string) => ({
      id: 'order-cuid-1',
      orderNumber: 'FW-000100',
      status,
      deliveryLat: 35.5,
      deliveryLng: 35.8,
      deliveryDesc: 'Latakia center',
      baseFee: 60,
      peripheralFee: 0,
      extraStoresFee: 0,
      customFee: 0,
      customFeeReason: null,
      totalFee: 60,
      isPeripheral: false,
      createdAt: new Date('2026-10-26T10:00:00Z'),
      assignedAt: new Date('2026-10-26T10:05:00Z'),
      customer: {
        user: {
          name: 'Sara Customer',
          whatsapp: '0999888777',
        },
      },
      items: [
        {
          id: 'item-1',
          itemName: 'Milk',
          quantity: '1L',
          customStoreName: null,
          anyStore: true,
        },
      ],
      orderStores: [],
    });

    it.each(['ASSIGNED', 'IN_PROGRESS', 'OUT_FOR_DELIVERY'])(
      'exposes customerWhatsapp when order is in active state (%s)',
      async (status) => {
        prisma.runner.findUnique.mockResolvedValue(mockRunner);
        prisma.order.findFirst.mockResolvedValue(createMockOrder(status));
        prisma.order.count.mockResolvedValue(1);

        const result = await service.getActiveOrder('user-cuid-1');

        expect(result).not.toBeNull();
        expect(result!.customerWhatsapp).toBe('0999888777');
        expect(result!.customerName).toBe('Sara Customer');
        expect(result!.status).toBe(status);
      },
    );

    it.each(['DELIVERED', 'CANCELLED', 'PENDING_REVIEW', 'AWAITING_RUNNER'])(
      'defensively masks customerWhatsapp to null if a non-active order (%s) reaches response serialization',
      async (status) => {
        prisma.runner.findUnique.mockResolvedValue(mockRunner);
        // Simulating non-active order returned (e.g. hypothetical query regression or race)
        prisma.order.findFirst.mockResolvedValue(createMockOrder(status));
        prisma.order.count.mockResolvedValue(0);

        const result = await service.getActiveOrder('user-cuid-1');

        expect(result).not.toBeNull();
        // Defensive masking ensures customerWhatsapp is NULL, not exposed
        expect(result!.customerWhatsapp).toBeNull();
        expect(result!.customerName).toBe('Sara Customer');
        expect(result!.status).toBe(status);
      },
    );

    it('returns null when no active order exists in DB', async () => {
      prisma.runner.findUnique.mockResolvedValue(mockRunner);
      prisma.order.findFirst.mockResolvedValue(null);

      const result = await service.getActiveOrder('user-cuid-1');

      expect(result).toBeNull();
    });

    it('throws NotFoundException when runner does not exist', async () => {
      prisma.runner.findUnique.mockResolvedValue(null);

      await expect(service.getActiveOrder('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
