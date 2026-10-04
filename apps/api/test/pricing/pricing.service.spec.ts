import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PRICING } from '@forerun/shared-constants';
import { PricingService } from '../../src/modules/pricing/pricing.service.js';
import type { PrismaService } from '../../src/database/prisma.service.js';
import type { AuditService } from '../../src/modules/audit/audit.service.js';
import type { NotificationsService } from '../../src/modules/notifications/notifications.service.js';

describe('PricingService', () => {
  let service: PricingService;
  let prisma: {
    order: {
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
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
      const result = service.calculateFee({
        isPeripheral: false,
        purchasedStoreCount: 1,
      });

      expect(result).toEqual({
        baseFee: PRICING.BASE_FEE,
        peripheralFee: 0,
        extraStoresFee: 0,
        totalFee: PRICING.BASE_FEE,
        runnerShare: Math.floor(PRICING.BASE_FEE * PRICING.RUNNER_SHARE),
        platformShare: Math.ceil(PRICING.BASE_FEE * PRICING.PLATFORM_SHARE),
      });
      expect(result.totalFee).toBe(60);
      expect(result.runnerShare).toBe(45);
      expect(result.platformShare).toBe(15);
      expect(result.runnerShare + result.platformShare).toBe(result.totalFee);
    });

    it('calculates fee for single store, peripheral (baseFee + peripheralFee)', () => {
      const result = service.calculateFee({
        isPeripheral: true,
        purchasedStoreCount: 1,
      });

      expect(result).toEqual({
        baseFee: PRICING.BASE_FEE,
        peripheralFee: PRICING.PERIPHERAL_FEE,
        extraStoresFee: 0,
        totalFee: PRICING.BASE_FEE + PRICING.PERIPHERAL_FEE,
        runnerShare: Math.floor((PRICING.BASE_FEE + PRICING.PERIPHERAL_FEE) * PRICING.RUNNER_SHARE),
        platformShare: Math.ceil((PRICING.BASE_FEE + PRICING.PERIPHERAL_FEE) * PRICING.PLATFORM_SHARE),
      });
      expect(result.totalFee).toBe(100);
      expect(result.runnerShare).toBe(75);
      expect(result.platformShare).toBe(25);
      expect(result.runnerShare + result.platformShare).toBe(result.totalFee);
    });

    it('calculates fee for 3 stores (baseFee + extraStoresFee * 2)', () => {
      const result = service.calculateFee({
        isPeripheral: false,
        purchasedStoreCount: 3,
      });

      const expectedExtraStoresFee = 2 * PRICING.EXTRA_STORE_FEE;
      const expectedTotalFee = PRICING.BASE_FEE + expectedExtraStoresFee;

      expect(result).toEqual({
        baseFee: PRICING.BASE_FEE,
        peripheralFee: 0,
        extraStoresFee: expectedExtraStoresFee,
        totalFee: expectedTotalFee,
        runnerShare: Math.floor(expectedTotalFee * PRICING.RUNNER_SHARE),
        platformShare: Math.ceil(expectedTotalFee * PRICING.PLATFORM_SHARE),
      });
      expect(result.extraStoresFee).toBe(40);
      expect(result.totalFee).toBe(100);
      expect(result.runnerShare).toBe(75);
      expect(result.platformShare).toBe(25);
    });

    it('calculates fee for 0 stores (baseFee only, extraStoresFee = 0)', () => {
      const result = service.calculateFee({
        isPeripheral: false,
        purchasedStoreCount: 0,
      });

      expect(result).toEqual({
        baseFee: PRICING.BASE_FEE,
        peripheralFee: 0,
        extraStoresFee: 0,
        totalFee: PRICING.BASE_FEE,
        runnerShare: Math.floor(PRICING.BASE_FEE * PRICING.RUNNER_SHARE),
        platformShare: Math.ceil(PRICING.BASE_FEE * PRICING.PLATFORM_SHARE),
      });
      expect(result.extraStoresFee).toBe(0);
      expect(result.totalFee).toBe(60);
    });

    it('throws BadRequestException when purchasedStoreCount is negative', () => {
      expect(() =>
        service.calculateFee({
          isPeripheral: false,
          purchasedStoreCount: -1,
        }),
      ).toThrow(BadRequestException);

      expect(() =>
        service.calculateFee({
          isPeripheral: false,
          purchasedStoreCount: -5,
        }),
      ).toThrow('purchasedStoreCount must be a non-negative integer');
    });

    it('throws BadRequestException when purchasedStoreCount is fractional', () => {
      expect(() =>
        service.calculateFee({
          isPeripheral: false,
          purchasedStoreCount: 1.5,
        }),
      ).toThrow(BadRequestException);

      expect(() =>
        service.calculateFee({
          isPeripheral: false,
          purchasedStoreCount: 0.1,
        }),
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
        totalFee: 60,
      });
      expect(result.newFee).toEqual({
        baseFee: 60,
        peripheralFee: 0,
        extraStoresFee: 20,
        totalFee: 80,
        runnerShare: 60,
        platformShare: 20,
      });
      expect(result.notificationPayload).toEqual({
        customerId: 'cust-1',
        orderId: 'ord-456',
        orderNumber: 'ORD-2026-001',
        oldFee: {
          baseFee: 60,
          peripheralFee: 0,
          extraStoresFee: 0,
          totalFee: 60,
        },
        newFee: result.newFee,
        reason: 'RECALCULATE_FEE',
      });

      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: 'ord-456' },
        data: {
          baseFee: 60,
          peripheralFee: 0,
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

      await service.recalculateFee('ord-tx', mockTx as any);

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
  });
});
