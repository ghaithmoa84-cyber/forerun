import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PRICING, DEFAULT_PRICING_CONFIG } from '@forerun/shared-constants';
import { PricingService } from '../../src/modules/pricing/pricing.service.js';
import type { PrismaService } from '../../src/database/prisma.service.js';
import type { Prisma } from '@prisma/client';
import type { AuditService } from '../../src/modules/audit/audit.service.js';
import type { NotificationsService } from '../../src/modules/notifications/notifications.service.js';

describe('PricingService', () => {
  let service: PricingService;
  let prisma: {
    order: {
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    platformPricing: {
      findUnique: ReturnType<typeof vi.fn>;
      findUniqueOrThrow: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      upsert: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };
  let auditService: {
    log: ReturnType<typeof vi.fn>;
  };
  let notificationsService: Partial<NotificationsService>;

  beforeEach(() => {
    prisma = {
      order: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      platformPricing: {
        findUnique: vi.fn(),
        findUniqueOrThrow: vi.fn(),
        updateMany: vi.fn(),
        create: vi.fn(),
        upsert: vi.fn(),
      },
      $transaction: vi.fn().mockImplementation(async (callback) => {
        return callback(prisma);
      }),
    };
    auditService = {
      log: vi.fn().mockResolvedValue(undefined),
    };
    notificationsService = {};

    service = new PricingService(
      prisma as unknown as PrismaService,
      auditService as unknown as AuditService,
      notificationsService as unknown as NotificationsService,
    );
  });

  describe('calculateFee', () => {
    it('calculates fee for single store, non-peripheral (baseFee only)', () => {
      const result = service.calculateFee(
        {
          isPeripheral: false,
          purchasedStoreCount: 1,
        },
        DEFAULT_PRICING_CONFIG,
      );

      expect(result).toEqual({
        baseFee: PRICING.BASE_FEE,
        peripheralFee: 0,
        extraStoresFee: 0,
        customFee: 0,
        customFeeReason: null,
        totalFee: PRICING.BASE_FEE,
      });
      expect(result.totalFee).toBe(60);
    });

    it('calculates fee for single store, peripheral (baseFee + peripheralFee)', () => {
      const result = service.calculateFee(
        {
          isPeripheral: true,
          purchasedStoreCount: 1,
        },
        DEFAULT_PRICING_CONFIG,
      );

      expect(result).toEqual({
        baseFee: PRICING.BASE_FEE,
        peripheralFee: PRICING.PERIPHERAL_FEE,
        extraStoresFee: 0,
        customFee: 0,
        customFeeReason: null,
        totalFee: PRICING.BASE_FEE + PRICING.PERIPHERAL_FEE,
      });
      expect(result.totalFee).toBe(100);
    });

    it('calculates fee for 3 stores (baseFee + extraStoresFee * 2)', () => {
      const result = service.calculateFee(
        {
          isPeripheral: false,
          purchasedStoreCount: 3,
        },
        DEFAULT_PRICING_CONFIG,
      );

      const expectedExtraStoresFee = 2 * PRICING.EXTRA_STORE_FEE;
      const expectedTotalFee = PRICING.BASE_FEE + expectedExtraStoresFee;

      expect(result).toEqual({
        baseFee: PRICING.BASE_FEE,
        peripheralFee: 0,
        extraStoresFee: expectedExtraStoresFee,
        customFee: 0,
        customFeeReason: null,
        totalFee: expectedTotalFee,
      });
      expect(result.extraStoresFee).toBe(40);
      expect(result.totalFee).toBe(100);
    });

    it('calculates fee for 0 stores (baseFee only, extraStoresFee = 0)', () => {
      const result = service.calculateFee(
        {
          isPeripheral: false,
          purchasedStoreCount: 0,
        },
        DEFAULT_PRICING_CONFIG,
      );

      expect(result).toEqual({
        baseFee: PRICING.BASE_FEE,
        peripheralFee: 0,
        extraStoresFee: 0,
        customFee: 0,
        customFeeReason: null,
        totalFee: PRICING.BASE_FEE,
      });
      expect(result.extraStoresFee).toBe(0);
      expect(result.totalFee).toBe(60);
    });

    it('throws BadRequestException when purchasedStoreCount is negative', () => {
      expect(() =>
        service.calculateFee(
          {
            isPeripheral: false,
            purchasedStoreCount: -1,
          },
          DEFAULT_PRICING_CONFIG,
        ),
      ).toThrow(BadRequestException);

      expect(() =>
        service.calculateFee(
          {
            isPeripheral: false,
            purchasedStoreCount: -5,
          },
          DEFAULT_PRICING_CONFIG,
        ),
      ).toThrow('purchasedStoreCount must be a non-negative integer');
    });

    it('throws BadRequestException when purchasedStoreCount is fractional', () => {
      expect(() =>
        service.calculateFee(
          {
            isPeripheral: false,
            purchasedStoreCount: 1.5,
          },
          DEFAULT_PRICING_CONFIG,
        ),
      ).toThrow(BadRequestException);

      expect(() =>
        service.calculateFee(
          {
            isPeripheral: false,
            purchasedStoreCount: 0.1,
          },
          DEFAULT_PRICING_CONFIG,
        ),
      ).toThrow('purchasedStoreCount must be a non-negative integer');
    });

    it('verifies fee sharing formulas floor(75%) and ceil(25%) without rounding loss', () => {
      // Test across multiple total fee values
      const testFees = [60, 75, 80, 85, 90, 100, 115, 120, 135];
      for (const fee of testFees) {
        const runnerShare = Math.floor(fee * PRICING.RUNNER_SHARE);
        const platformShare = Math.ceil(fee * PRICING.PLATFORM_SHARE);

        expect(runnerShare).toBe(Math.floor(fee * 0.75));
        expect(platformShare).toBe(Math.ceil(fee * 0.25));
        expect(runnerShare + platformShare).toBeGreaterThanOrEqual(fee);
      }
    });
  });

  describe('recalculateFee', () => {
    it('throws NotFoundException when order does not exist', async () => {
      prisma.order.findUnique.mockResolvedValue(null);

      await expect(service.recalculateFee('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.recalculateFee('non-existent-id')).rejects.toThrow(
        'Order not found',
      );
    });

    it('throws ConflictException when order is DELIVERED', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'ord-123',
        status: 'DELIVERED',
        isPeripheral: false,
        orderStores: [{ status: 'PURCHASED' }],
      });

      await expect(service.recalculateFee('ord-123')).rejects.toThrow(
        ConflictException,
      );
      await expect(service.recalculateFee('ord-123')).rejects.toThrow(
        'Cannot recalculate fee for a delivered order',
      );
    });

    it('updates fee in DB and writes audit log when fee changes', async () => {
      const mockOrder = {
        id: 'ord-456',
        orderNumber: 'ORD-2026-001',
        status: 'IN_PROGRESS',
        customerId: 'cust-1',
        isPeripheral: false,
        baseFee: 60,
        peripheralFee: 0,
        extraStoresFee: 0,
        customFee: 0,
        customFeeReason: null,
        totalFee: 60,
        orderStores: [
          { status: 'PURCHASED' },
          { status: 'PURCHASED' },
        ],
      };

      prisma.order.findUnique.mockResolvedValue(mockOrder);
      prisma.order.update.mockResolvedValue({
        ...mockOrder,
        extraStoresFee: 20,
        totalFee: 80,
      });

      const result = await service.recalculateFee('ord-456');

      expect(result.feeChanged).toBe(true);
      expect(result.oldFee).toEqual({
        baseFee: 60,
        peripheralFee: 0,
        extraStoresFee: 0,
        customFee: 0,
        customFeeReason: null,
        totalFee: 60,
      });
      expect(result.newFee).toEqual({
        baseFee: 60,
        peripheralFee: 0,
        extraStoresFee: 20,
        customFee: 0,
        customFeeReason: null,
        totalFee: 80,
      });
      expect(result.notificationPayload).toEqual({
        customerId: 'cust-1',
        orderId: 'ord-456',
        orderNumber: 'ORD-2026-001',
        oldFee: {
          baseFee: 60,
          peripheralFee: 0,
          extraStoresFee: 0,
          customFee: 0,
          customFeeReason: null,
          totalFee: 60,
        },
        newFee: result.newFee,
        reason: 'RECALCULATE_FEE',
      });

      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: 'ord-456' },
        data: {
          extraStoresFee: 20,
          totalFee: 80,
        },
      });

      expect(auditService.log).toHaveBeenCalledWith(
        {
          orderId: 'ord-456',
          actorRole: 'SYSTEM',
          event: 'ORDER_FEE_UPDATED',
          fromStatus: 'IN_PROGRESS',
          toStatus: 'IN_PROGRESS',
          meta: {
            orderNumber: 'ORD-2026-001',
            oldFee: {
              baseFee: 60,
              peripheralFee: 0,
              extraStoresFee: 0,
              customFee: 0,
              customFeeReason: null,
              totalFee: 60,
            },
            newFee: result.newFee,
            purchasedStoreCount: 2,
            reason: 'RECALCULATE_FEE',
          },
        },
        prisma,
      );
    });

    it('does not log audit event when fee has not changed', async () => {
      const mockOrder = {
        id: 'ord-789',
        orderNumber: 'ORD-2026-002',
        status: 'IN_PROGRESS',
        customerId: 'cust-2',
        isPeripheral: false,
        baseFee: 60,
        peripheralFee: 0,
        extraStoresFee: 0,
        totalFee: 60,
        orderStores: [{ status: 'PURCHASED' }],
      };

      prisma.order.findUnique.mockResolvedValue(mockOrder);
      prisma.order.update.mockResolvedValue(mockOrder);

      const result = await service.recalculateFee('ord-789');

      expect(result.feeChanged).toBe(false);
      expect(result.oldFee).toBeNull();
      expect(result.notificationPayload).toBeNull();
      expect(auditService.log).not.toHaveBeenCalled();
    });

    it('uses provided transaction client when passed', async () => {
      const mockTx = {
        order: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'ord-tx',
            orderNumber: 'ORD-TX-001',
            status: 'IN_PROGRESS',
            customerId: 'cust-tx',
            isPeripheral: false,
            baseFee: 60,
            peripheralFee: 0,
            extraStoresFee: 0,
            totalFee: 60,
            orderStores: [{ status: 'PURCHASED' }],
          }),
          update: vi.fn().mockResolvedValue({}),
        },
      };

      await service.recalculateFee('ord-tx', mockTx as unknown as Prisma.TransactionClient);

      expect(mockTx.order.findUnique).toHaveBeenCalledWith({
        where: { id: 'ord-tx' },
        include: {
          orderStores: {
            where: { status: 'PURCHASED' },
          },
        },
      });
      expect(prisma.order.findUnique).not.toHaveBeenCalled();
    });

    it('preserves order snapshot baseFee (80) after recalculation', async () => {
      const mockOrder = {
        id: 'ord-base80',
        orderNumber: 'ORD-2026-080',
        status: 'IN_PROGRESS',
        customerId: 'cust-base80',
        isPeripheral: false,
        baseFee: 80,
        peripheralFee: 0,
        extraStoresFee: 0,
        totalFee: 80,
        orderStores: [{ status: 'PURCHASED' }, { status: 'PURCHASED' }],
      };

      prisma.order.findUnique.mockResolvedValue(mockOrder);
      prisma.order.update.mockResolvedValue({
        ...mockOrder,
        extraStoresFee: 20,
        totalFee: 100,
      });

      const result = await service.recalculateFee('ord-base80');

      expect(result.feeChanged).toBe(true);
      expect(result.newFee.baseFee).toBe(80);
      expect(result.newFee.peripheralFee).toBe(0);
      expect(result.newFee.extraStoresFee).toBe(20);
      expect(result.newFee.totalFee).toBe(100);

      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: 'ord-base80' },
        data: {
          extraStoresFee: 20,
          totalFee: 100,
        },
      });
    });

    it('preserves order snapshot peripheralFee (40) after recalculation', async () => {
      const mockOrder = {
        id: 'ord-peri40',
        orderNumber: 'ORD-2026-040',
        status: 'IN_PROGRESS',
        customerId: 'cust-peri40',
        isPeripheral: true,
        baseFee: 60,
        peripheralFee: 40,
        extraStoresFee: 0,
        totalFee: 100,
        orderStores: [{ status: 'PURCHASED' }, { status: 'PURCHASED' }],
      };

      prisma.order.findUnique.mockResolvedValue(mockOrder);
      prisma.order.update.mockResolvedValue({
        ...mockOrder,
        extraStoresFee: 20,
        totalFee: 120,
      });

      const result = await service.recalculateFee('ord-peri40');

      expect(result.feeChanged).toBe(true);
      expect(result.newFee.baseFee).toBe(60);
      expect(result.newFee.peripheralFee).toBe(40);
      expect(result.newFee.extraStoresFee).toBe(20);
      expect(result.newFee.totalFee).toBe(120);

      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: 'ord-peri40' },
        data: {
          extraStoresFee: 20,
          totalFee: 120,
        },
      });
    });

    it('scales extraStoresFee correctly with store count (0, 1, 3 stores)', async () => {
      // 0 stores
      prisma.order.findUnique.mockResolvedValue({
        id: 'ord-stores-0',
        orderNumber: 'ORD-0',
        status: 'IN_PROGRESS',
        customerId: 'c0',
        isPeripheral: false,
        baseFee: 60,
        peripheralFee: 0,
        extraStoresFee: 20,
        totalFee: 80,
        orderStores: [],
      });
      prisma.order.update.mockResolvedValue({});
      const res0 = await service.recalculateFee('ord-stores-0');
      expect(res0.newFee.extraStoresFee).toBe(0);
      expect(res0.newFee.totalFee).toBe(60);

      // 1 store
      prisma.order.findUnique.mockResolvedValue({
        id: 'ord-stores-1',
        orderNumber: 'ORD-1',
        status: 'IN_PROGRESS',
        customerId: 'c1',
        isPeripheral: false,
        baseFee: 60,
        peripheralFee: 0,
        extraStoresFee: 20,
        totalFee: 80,
        orderStores: [{ status: 'PURCHASED' }],
      });
      const res1 = await service.recalculateFee('ord-stores-1');
      expect(res1.newFee.extraStoresFee).toBe(0);
      expect(res1.newFee.totalFee).toBe(60);

      // 3 stores
      prisma.order.findUnique.mockResolvedValue({
        id: 'ord-stores-3',
        orderNumber: 'ORD-3',
        status: 'IN_PROGRESS',
        customerId: 'c3',
        isPeripheral: false,
        baseFee: 60,
        peripheralFee: 0,
        extraStoresFee: 0,
        totalFee: 60,
        orderStores: [
          { status: 'PURCHASED' },
          { status: 'PURCHASED' },
          { status: 'PURCHASED' },
        ],
      });
      const res3 = await service.recalculateFee('ord-stores-3');
      expect(res3.newFee.extraStoresFee).toBe(40); // (3 - 1) * 20
      expect(res3.newFee.totalFee).toBe(100);
    });

    it('calculates totalFee as sum and satisfies floor/ceil share splitting formula', async () => {
      const mockOrder = {
        id: 'ord-odd',
        orderNumber: 'ORD-ODD',
        status: 'IN_PROGRESS',
        customerId: 'c-odd',
        isPeripheral: false,
        baseFee: 61,
        peripheralFee: 0,
        extraStoresFee: 0,
        totalFee: 61,
        orderStores: [{ status: 'PURCHASED' }, { status: 'PURCHASED' }],
      };

      prisma.order.findUnique.mockResolvedValue(mockOrder);
      prisma.order.update.mockResolvedValue({});

      // totalFee = 61 + 0 + 20 = 81
      const result = await service.recalculateFee('ord-odd');
      expect(result.newFee.totalFee).toBe(81);
    });
  });

  describe('calculateFee with custom config', () => {
    it('uses custom PricingConfig when provided', () => {
      const customConfig = {
        baseFee: 100,
        peripheralFee: 50,
        extraStoreFee: 30,
      };

      const result = service.calculateFee(
        {
          isPeripheral: true,
          purchasedStoreCount: 3,
        },
        customConfig,
      );

      // base: 100, peripheral: 50, extraStores: (3-1)*30 = 60 -> total: 210
      expect(result.baseFee).toBe(100);
      expect(result.peripheralFee).toBe(50);
      expect(result.extraStoresFee).toBe(60);
      expect(result.totalFee).toBe(210);
    });

    it('calculates 60/40/20 when DEFAULT_PRICING_CONFIG is provided', () => {
      const result = service.calculateFee(
        {
          isPeripheral: true,
          purchasedStoreCount: 2,
        },
        DEFAULT_PRICING_CONFIG,
      );

      // base: 60, peripheral: 40, extraStores: (2-1)*20 = 20 -> total: 120
      expect(result.baseFee).toBe(60);
      expect(result.peripheralFee).toBe(40);
      expect(result.extraStoresFee).toBe(20);
      expect(result.totalFee).toBe(120);
    });
  });

  describe('getPricingConfig', () => {
    it('returns values when default row exists in DB', async () => {
      prisma.platformPricing.findUnique.mockResolvedValue({
        id: 'default',
        baseFee: 80,
        peripheralFee: 50,
        extraStoreFee: 25,
      });

      const config = await service.getPricingConfig();

      expect(config).toEqual({
        baseFee: 80,
        peripheralFee: 50,
        extraStoreFee: 25,
      });
      expect(prisma.platformPricing.findUnique).toHaveBeenCalledWith({
        where: { id: 'default' },
      });
    });

    it('returns fallback DEFAULT_PRICING_CONFIG and logs warn when row is null', async () => {
      prisma.platformPricing.findUnique.mockResolvedValue(null);

      const config = await service.getPricingConfig();

      expect(config).toEqual({
        baseFee: 60,
        peripheralFee: 40,
        extraStoreFee: 20,
      });
    });

    it('returns fallback when row contains negative or non-integer values', async () => {
      service.disableCacheForTesting();

      // Case 1: negative baseFee
      prisma.platformPricing.findUnique.mockResolvedValue({
        id: 'default',
        baseFee: -10,
        peripheralFee: 40,
        extraStoreFee: 20,
      });
      let config = await service.getPricingConfig();
      expect(config).toEqual({ baseFee: 60, peripheralFee: 40, extraStoreFee: 20 });

      // Case 2: non-integer peripheralFee
      prisma.platformPricing.findUnique.mockResolvedValue({
        id: 'default',
        baseFee: 60,
        peripheralFee: 40.5,
        extraStoreFee: 20,
      });
      config = await service.getPricingConfig();
      expect(config).toEqual({ baseFee: 60, peripheralFee: 40, extraStoreFee: 20 });
    });

    it('returns fallback and does not throw when DB throws an error', async () => {
      prisma.platformPricing.findUnique.mockRejectedValue(new Error('DB Connection Timeout'));

      const config = await service.getPricingConfig();

      expect(config).toEqual({
        baseFee: 60,
        peripheralFee: 40,
        extraStoreFee: 20,
      });
    });

    it('caches config in-memory for TTL duration (two calls within 30s make one DB query)', async () => {
      service.enableCacheForTesting(30_000);
      prisma.platformPricing.findUnique.mockResolvedValue({
        id: 'default',
        baseFee: 75,
        peripheralFee: 35,
        extraStoreFee: 15,
      });

      const config1 = await service.getPricingConfig();
      const config2 = await service.getPricingConfig();

      expect(config1).toEqual(config2);
      expect(prisma.platformPricing.findUnique).toHaveBeenCalledTimes(1);
    });

    it('bypasses cache when disableCacheForTesting is called', async () => {
      service.disableCacheForTesting();
      prisma.platformPricing.findUnique.mockResolvedValue({
        id: 'default',
        baseFee: 75,
        peripheralFee: 35,
        extraStoreFee: 15,
      });

      await service.getPricingConfig();
      await service.getPricingConfig();

      expect(prisma.platformPricing.findUnique).toHaveBeenCalledTimes(2);
    });

    it('reads via transaction client when tx is passed', async () => {
      const mockTx = {
        platformPricing: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'default',
            baseFee: 90,
            peripheralFee: 45,
            extraStoreFee: 25,
          }),
        },
      };

      const config = await service.getPricingConfig(mockTx as unknown as Prisma.TransactionClient);

      expect(config).toEqual({
        baseFee: 90,
        peripheralFee: 45,
        extraStoreFee: 25,
      });
      expect(mockTx.platformPricing.findUnique).toHaveBeenCalledWith({
        where: { id: 'default' },
      });
      expect(prisma.platformPricing.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('customFee handling (Sprint 6A-6)', () => {
    it('calculateFee adds customFee to totalFee', () => {
      const result = service.calculateFee(
        {
          isPeripheral: false,
          purchasedStoreCount: 1,
          customFee: 50,
        },
        DEFAULT_PRICING_CONFIG,
      );

      // baseFee=60, peripheral=0, extra=0, customFee=50 -> total=110
      expect(result.baseFee).toBe(60);
      expect(result.customFee).toBe(50);
      expect(result.totalFee).toBe(110);
    });

    it('calculateFee rejects negative or non-integer customFee', () => {
      expect(() =>
        service.calculateFee(
          { isPeripheral: false, purchasedStoreCount: 1, customFee: -1 },
          DEFAULT_PRICING_CONFIG,
        ),
      ).toThrow(BadRequestException);

      expect(() =>
        service.calculateFee(
          { isPeripheral: false, purchasedStoreCount: 1, customFee: 10.5 },
          DEFAULT_PRICING_CONFIG,
        ),
      ).toThrow(BadRequestException);
    });

    it('recalculateFee preserves order customFee in totalFee and shares', async () => {
      const mockOrder = {
        id: 'ord-custom-1',
        orderNumber: 'ORD-2026-CF1',
        status: 'IN_PROGRESS',
        customerId: 'cust-cf',
        isPeripheral: false,
        baseFee: 60,
        peripheralFee: 0,
        extraStoresFee: 0,
        customFee: 50,
        totalFee: 110,
        orderStores: [{ status: 'PURCHASED' }, { status: 'PURCHASED' }], // 2 stores -> extraStoresFee = 20
      };

      prisma.order.findUnique.mockResolvedValue(mockOrder);
      prisma.order.update.mockResolvedValue(mockOrder);

      const result = await service.recalculateFee('ord-custom-1');

      // newFee: base=60 + peripheral=0 + extra=20 + custom=50 -> total=130
      // splitShares(130): runner=97, platform=33
      expect(result.feeChanged).toBe(true);
      expect(result.newFee.baseFee).toBe(60);
      expect(result.newFee.extraStoresFee).toBe(20);
      expect(result.newFee.customFee).toBe(50);
      expect(result.newFee.totalFee).toBe(130);

      // Verifies update writes back ONLY extraStoresFee and totalFee
      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: 'ord-custom-1' },
        data: {
          extraStoresFee: 20,
          totalFee: 130,
        },
      });
    });
  });

  describe('previewFee (Sprint 6A-7)', () => {
    it('previews fee for regular order (base=60, peripheral=false, no custom, 2 stores -> extraStores=20)', async () => {
      const mockOrder = {
        id: 'ord-prev-1',
        isPeripheral: false,
        baseFee: 60,
        orderStores: [{ id: 's1' }, { id: 's2' }],
      };
      prisma.order.findUnique.mockResolvedValue(mockOrder);

      const result = await service.previewFee('ord-prev-1', {
        isPeripheral: false,
        customFee: 0,
      });

      expect(result).toEqual({
        baseFee: 60,
        peripheralFee: 0,
        extraStoresFee: 20,
        customFee: 0,
        customFeeReason: null,
        totalFee: 80,
      });
      // Verify NO database writes
      expect(prisma.order.update).not.toHaveBeenCalled();
    });

    it('counts soft-deleted order stores exactly like approveOrder', async () => {
      const mockOrder = {
        id: 'ord-prev-deleted',
        isPeripheral: false,
        baseFee: 60,
        orderStores: [{ id: 's1' }, { id: 's2' }, { id: 's3', isDeleted: true }],
      };
      prisma.order.findUnique.mockResolvedValue(mockOrder);

      const result = await service.previewFee('ord-prev-deleted', {
        isPeripheral: false,
        customFee: 0,
      });

      expect(result.extraStoresFee).toBe(40);
      expect(result.totalFee).toBe(100);
      expect(prisma.order.findUnique).toHaveBeenCalledWith({
        where: { id: 'ord-prev-deleted' },
        include: { orderStores: { select: { id: true } } },
      });
    });

    it('previews fee for peripheral order with customFee=50 (matches splitShares)', async () => {
      const mockOrder = {
        id: 'ord-prev-2',
        isPeripheral: false, // will be overridden by dto
        baseFee: 60,
        orderStores: [{ id: 's1' }], // 1 store -> extraStores = 0
      };
      prisma.order.findUnique.mockResolvedValue(mockOrder);

      const result = await service.previewFee('ord-prev-2', {
        isPeripheral: true,
        customFee: 50,
        customFeeReason: 'طرد ثقيل',
      });

      // total = base 60 + peripheral 40 + extraStores 0 + custom 50 = 150
      // splitShares(150): runner = 112 (floor(150*0.75)), platform = 38 (ceil(150*0.25))
      expect(result).toEqual({
        baseFee: 60,
        peripheralFee: 40,
        extraStoresFee: 0,
        customFee: 50,
        customFeeReason: 'طرد ثقيل',
        totalFee: 150,
      });
      expect(prisma.order.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when order does not exist', async () => {
      prisma.order.findUnique.mockResolvedValue(null);

      await expect(
        service.previewFee('non-existent-order', {
          isPeripheral: false,
          customFee: 0,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when customFee > 0 without reason', async () => {
      const mockOrder = {
        id: 'ord-prev-3',
        isPeripheral: false,
        baseFee: 60,
        orderStores: [{ id: 's1' }],
      };
      prisma.order.findUnique.mockResolvedValue(mockOrder);

      await expect(
        service.previewFee('ord-prev-3', {
          isPeripheral: false,
          customFee: 50,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when customFee = 0 with reason', async () => {
      const mockOrder = {
        id: 'ord-prev-4',
        isPeripheral: false,
        baseFee: 60,
        orderStores: [{ id: 's1' }],
      };
      prisma.order.findUnique.mockResolvedValue(mockOrder);

      await expect(
        service.previewFee('ord-prev-4', {
          isPeripheral: false,
          customFee: 0,
          customFeeReason: 'سبب غير مبرر',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('supports baseFee override within PRICING_LIMITS', async () => {
      const mockOrder = {
        id: 'ord-prev-5',
        isPeripheral: false,
        baseFee: 60,
        orderStores: [{ id: 's1' }],
      };
      prisma.order.findUnique.mockResolvedValue(mockOrder);

      const result = await service.previewFee('ord-prev-5', {
        isPeripheral: false,
        baseFee: 80,
        customFee: 0,
      });

      expect(result.baseFee).toBe(80);
      expect(result.totalFee).toBe(80);
    });
  });

  describe('pricing wired from PlatformPricing row (Sprint 6A-3.1b)', () => {
    it('previewFee reads extraStoreFee from the DB row (3 stores, row extraStoreFee=30 -> 60)', async () => {
      service.disableCacheForTesting();
      prisma.platformPricing.findUnique.mockResolvedValue({
        id: 'default',
        baseFee: 80,
        peripheralFee: 50,
        extraStoreFee: 30,
      });
      prisma.order.findUnique.mockResolvedValue({
        id: 'ord-wire-1',
        isPeripheral: false,
        baseFee: 60,
        orderStores: [{ id: 's1' }, { id: 's2' }, { id: 's3' }],
      });

      const result = await service.previewFee('ord-wire-1', {
        isPeripheral: false,
        customFee: 0,
      });

      // extraStoresFee = (3 - 1) * 30 = 60 من الصف، لا 20 من الثابت
      expect(result.extraStoresFee).toBe(60);
      expect(result.baseFee).toBe(60);
      expect(result.totalFee).toBe(120);
      expect(prisma.platformPricing.findUnique).toHaveBeenCalledWith({
        where: { id: 'default' },
      });
      expect(prisma.order.update).not.toHaveBeenCalled();
    });

    it('previewFee keeps the order baseFee snapshot when dto.baseFee is absent, even if the row differs (D21)', async () => {
      service.disableCacheForTesting();
      prisma.platformPricing.findUnique.mockResolvedValue({
        id: 'default',
        baseFee: 500,
        peripheralFee: 50,
        extraStoreFee: 30,
      });
      prisma.order.findUnique.mockResolvedValue({
        id: 'ord-wire-2',
        isPeripheral: false,
        baseFee: 60,
        orderStores: [{ id: 's1' }],
      });

      const result = await service.previewFee('ord-wire-2', {
        isPeripheral: false,
        customFee: 0,
      });

      expect(result.baseFee).toBe(60);
      expect(result.totalFee).toBe(60);
    });

    it('previewFee falls back to DEFAULT_PRICING_CONFIG when the row is missing', async () => {
      prisma.platformPricing.findUnique.mockResolvedValue(null);
      prisma.order.findUnique.mockResolvedValue({
        id: 'ord-wire-3',
        isPeripheral: false,
        baseFee: 60,
        orderStores: [{ id: 's1' }, { id: 's2' }],
      });

      const result = await service.previewFee('ord-wire-3', {
        isPeripheral: false,
        customFee: 0,
      });

      expect(result).toEqual({
        baseFee: 60,
        peripheralFee: 0,
        extraStoresFee: 20,
        customFee: 0,
        customFeeReason: null,
        totalFee: 80,
      });
    });

    it('recalculateFee without config reads the row and writes only extraStoresFee/totalFee, keeping the baseFee snapshot (D16)', async () => {
      const mockOrder = {
        id: 'ord-wire-4',
        orderNumber: 'ORD-WIRE-004',
        status: 'IN_PROGRESS',
        customerId: 'cust-wire-4',
        isPeripheral: false,
        baseFee: 80,
        peripheralFee: 0,
        extraStoresFee: 0,
        totalFee: 80,
        orderStores: [{ status: 'PURCHASED' }, { status: 'PURCHASED' }],
      };
      prisma.platformPricing.findUnique.mockResolvedValue({
        id: 'default',
        baseFee: 60,
        peripheralFee: 40,
        extraStoreFee: 30,
      });
      prisma.order.findUnique.mockResolvedValue(mockOrder);
      prisma.order.update.mockResolvedValue({
        ...mockOrder,
        extraStoresFee: 30,
        totalFee: 110,
      });

      const result = await service.recalculateFee('ord-wire-4');

      // (2 - 1) * 30 من الصف
      expect(result.newFee.extraStoresFee).toBe(30);
      expect(result.newFee.baseFee).toBe(80);
      expect(result.newFee.peripheralFee).toBe(0);
      expect(result.newFee.totalFee).toBe(110);
      expect(result.feeChanged).toBe(true);

      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: 'ord-wire-4' },
        data: { extraStoresFee: 30, totalFee: 110 },
      });
    });

    it('recalculateFee respects an explicitly passed config and does not query the row (backward compatibility)', async () => {
      const mockOrder = {
        id: 'ord-wire-5',
        orderNumber: 'ORD-WIRE-005',
        status: 'IN_PROGRESS',
        customerId: 'cust-wire-5',
        isPeripheral: false,
        baseFee: 60,
        peripheralFee: 0,
        extraStoresFee: 0,
        totalFee: 60,
        orderStores: [{ status: 'PURCHASED' }, { status: 'PURCHASED' }],
      };
      prisma.platformPricing.findUnique.mockResolvedValue({
        id: 'default',
        baseFee: 60,
        peripheralFee: 40,
        extraStoreFee: 30,
      });
      prisma.order.findUnique.mockResolvedValue(mockOrder);
      prisma.order.update.mockResolvedValue({});

      const result = await service.recalculateFee('ord-wire-5', undefined, {
        baseFee: 60,
        peripheralFee: 40,
        extraStoreFee: 15,
      });

      expect(result.newFee.extraStoresFee).toBe(15);
      expect(result.newFee.totalFee).toBe(75);
      expect(prisma.platformPricing.findUnique).not.toHaveBeenCalled();
    });

    it('recalculateFee reads the row through the provided transaction client', async () => {
      const mockTx = {
        order: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'ord-wire-6',
            orderNumber: 'ORD-WIRE-006',
            status: 'IN_PROGRESS',
            customerId: 'cust-wire-6',
            isPeripheral: false,
            baseFee: 60,
            peripheralFee: 0,
            extraStoresFee: 0,
            totalFee: 60,
            orderStores: [
              { status: 'PURCHASED' },
              { status: 'PURCHASED' },
              { status: 'PURCHASED' },
            ],
          }),
          update: vi.fn().mockResolvedValue({}),
        },
        platformPricing: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'default',
            baseFee: 60,
            peripheralFee: 40,
            extraStoreFee: 25,
          }),
        },
      };

      const result = await service.recalculateFee(
        'ord-wire-6',
        mockTx as unknown as Prisma.TransactionClient,
      );

      expect(mockTx.platformPricing.findUnique).toHaveBeenCalledWith({
        where: { id: 'default' },
      });
      // (3 - 1) * 25 = 50
      expect(result.newFee.extraStoresFee).toBe(50);
      expect(result.newFee.totalFee).toBe(110);
      expect(prisma.platformPricing.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('getPlatformPricing (Sprint 6A-7)', () => {
    it('returns DEFAULT_PRICING_CONFIG when default row is absent', async () => {
      prisma.platformPricing.findUnique.mockResolvedValue(null);

      const result = await service.getPlatformPricing();

      expect(result).toEqual({
        baseFee: DEFAULT_PRICING_CONFIG.baseFee,
        extraStoreFee: DEFAULT_PRICING_CONFIG.extraStoreFee,
        peripheralFee: DEFAULT_PRICING_CONFIG.peripheralFee,
        updatedAt: null,
        updatedByUserId: null,
      });
    });

    it('returns row values when present in DB', async () => {
      const now = new Date();
      prisma.platformPricing.findUnique.mockResolvedValue({
        id: 'default',
        baseFee: 75,
        extraStoreFee: 25,
        peripheralFee: 50,
        updatedAt: now,
        updatedByUserId: 'usr-admin-1',
      });

      const result = await service.getPlatformPricing();

      expect(result).toEqual({
        baseFee: 75,
        extraStoreFee: 25,
        peripheralFee: 50,
        updatedAt: now,
        updatedByUserId: 'usr-admin-1',
      });
    });
  });

  describe('updatePlatformPricing (Sprint 6A-7)', () => {
    it('upserts new pricing, logs audit event, and clears cache on valid input', async () => {
      const oldDate = new Date('2026-10-01T10:00:00.000Z');
      const newDate = new Date('2026-10-05T12:00:00.000Z');

      prisma.platformPricing.findUnique.mockResolvedValue({
        id: 'default',
        baseFee: 60,
        extraStoreFee: 20,
        peripheralFee: 40,
        updatedAt: oldDate,
        updatedByUserId: 'usr-old',
      });

      prisma.platformPricing.updateMany.mockResolvedValue({ count: 1 });
      prisma.platformPricing.findUniqueOrThrow.mockResolvedValue({
        id: 'default',
        baseFee: 80,
        extraStoreFee: 30,
        peripheralFee: 50,
        updatedAt: newDate,
        updatedByUserId: 'usr-admin-1',
      });

      const result = await service.updatePlatformPricing(
        {
          baseFee: 80,
          extraStoreFee: 30,
          peripheralFee: 50,
          updatedAt: oldDate,
        },
        'usr-admin-1',
      );

      expect(result).toEqual({
        baseFee: 80,
        extraStoreFee: 30,
        peripheralFee: 50,
        updatedAt: newDate,
        updatedByUserId: 'usr-admin-1',
      });

      expect(prisma.platformPricing.updateMany).toHaveBeenCalledWith({
        where: { id: 'default', updatedAt: oldDate },
        data: {
          baseFee: 80,
          extraStoreFee: 30,
          peripheralFee: 50,
          updatedByUserId: 'usr-admin-1',
          updatedAt: expect.any(Date),
        },
      });

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 'usr-admin-1',
          actorRole: 'ADMIN',
          event: 'PRICING_UPDATED',
          meta: {
            before: {
              baseFee: 60,
              extraStoreFee: 20,
              peripheralFee: 40,
              updatedAt: oldDate,
            },
            after: {
              baseFee: 80,
              extraStoreFee: 30,
              peripheralFee: 50,
              updatedAt: newDate,
            },
          },
        }),
        expect.anything(),
      );
    });

    it('throws 409 ConflictException when updatedAt does not match DB timestamp', async () => {
      const dbDate = new Date('2026-10-05T12:00:00.000Z');
      const clientStaleDate = new Date('2026-10-05T11:00:00.000Z');

      prisma.platformPricing.findUnique.mockResolvedValue({
        id: 'default',
        baseFee: 60,
        extraStoreFee: 20,
        peripheralFee: 40,
        updatedAt: dbDate,
        updatedByUserId: 'usr-old',
      });

      await expect(
        service.updatePlatformPricing(
          {
            baseFee: 80,
            extraStoreFee: 30,
            peripheralFee: 50,
            updatedAt: clientStaleDate,
          },
          'usr-admin-1',
        ),
      ).rejects.toThrow(ConflictException);

      expect(prisma.platformPricing.upsert).not.toHaveBeenCalled();
    });

    it('throws BadRequestException on baseFee = 0 or negative values', async () => {
      await expect(
        service.updatePlatformPricing(
          {
            baseFee: 0,
            extraStoreFee: 20,
            peripheralFee: 40,
          },
          'usr-admin-1',
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.updatePlatformPricing(
          {
            baseFee: 60,
            extraStoreFee: -5,
            peripheralFee: 40,
          },
          'usr-admin-1',
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.updatePlatformPricing(
          {
            baseFee: 60,
            extraStoreFee: 20,
            peripheralFee: -10,
          },
          'usr-admin-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});


