import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdminOrderQueryService } from '../../src/modules/orders/services/admin-order-query.service';
import type { PrismaService } from '../../src/database/prisma.service';

describe('AdminOrderQueryService - Search & D35 Lifecycle Masking', () => {
  let service: AdminOrderQueryService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      order: {
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn(),
      },
    };
    service = new AdminOrderQueryService(mockPrisma as PrismaService);
  });

  describe('listAdminOrders - Omni Search', () => {
    it('applies OR search filter on orderNumber, customer name, whatsapp, and altPhone when search is provided', async () => {
      mockPrisma.order.count.mockResolvedValue(1);
      mockPrisma.order.findMany.mockResolvedValue([
        {
          id: 'ord-1',
          seqNumber: 1,
          orderNumber: 'FW-000101',
          status: 'PENDING_REVIEW',
          totalFee: 50,
          createdAt: new Date(),
          customer: { user: { name: 'محمد', whatsapp: '0933112233' } },
          runner: null,
          preferredRunner: null,
          _count: { items: 2 },
        },
      ]);

      const result = await service.listAdminOrders({
        page: 1,
        limit: 20,
        search: '  0933112233  ',
      });

      expect(mockPrisma.order.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          OR: [
            { orderNumber: { contains: '0933112233', mode: 'insensitive' } },
            { customer: { user: { name: { contains: '0933112233', mode: 'insensitive' } } } },
            { customer: { user: { whatsapp: { contains: '0933112233' } } } },
            { customer: { user: { altPhone: { contains: '0933112233' } } } },
          ],
        }),
      });

      expect(result.data.length).toBe(1);
      expect(result.data[0].orderNumber).toBe('FW-000101');
    });

    it('does not include OR clause when search is empty or undefined', async () => {
      await service.listAdminOrders({ page: 1, limit: 20 });
      expect(mockPrisma.order.count).toHaveBeenCalledWith({ where: {} });
    });
  });

  describe('getAdminOrderDetails - D35 Runner Lifecycle Masking', () => {
    const createMockOrder = (status: string) => ({
      id: 'ord-test',
      orderNumber: 'FW-000999',
      status,
      isPeripheral: false,
      baseFee: 50,
      peripheralFee: 0,
      extraStoresFee: 0,
      customFee: 0,
      customFeeReason: null,
      totalFee: 50,
      deliveryLat: 33.5,
      deliveryLng: 36.2,
      deliveryDesc: 'دمشق',
      notes: null,
      preferredRunnerId: null,
      preferredRunner: null,
      waitForPreferred: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      deliveredAt: status === 'DELIVERED' ? new Date() : null,
      cancelledAt: status === 'CANCELLED' ? new Date() : null,
      customer: {
        id: 'c-1',
        userId: 'u-c1',
        user: { name: 'عميل تجريبي', whatsapp: '0933000000', altPhone: null, status: 'VERIFIED' },
      },
      runner: {
        id: 'r-1',
        userId: 'u-r1',
        status: 'AVAILABLE',
        avgRating: 4.8,
        totalRatings: 10,
        isVisible: true,
        notes: null,
        user: { name: 'كابتن تجريبي', whatsapp: '0944000000' },
      },
      items: [],
      orderStores: [],
      ratings: [],
    });

    it('returns runner.whatsapp when status is ASSIGNED (active)', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(createMockOrder('ASSIGNED'));
      const details = await service.getAdminOrderDetails('ord-test');
      expect(details.runner?.whatsapp).toBe('0944000000');
    });

    it('returns runner.whatsapp when status is IN_PROGRESS (active)', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(createMockOrder('IN_PROGRESS'));
      const details = await service.getAdminOrderDetails('ord-test');
      expect(details.runner?.whatsapp).toBe('0944000000');
    });

    it('returns runner.whatsapp when status is OUT_FOR_DELIVERY (active)', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(createMockOrder('OUT_FOR_DELIVERY'));
      const details = await service.getAdminOrderDetails('ord-test');
      expect(details.runner?.whatsapp).toBe('0944000000');
    });

    it('masks runner.whatsapp to null when status is DELIVERED (D35 rule)', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(createMockOrder('DELIVERED'));
      const details = await service.getAdminOrderDetails('ord-test');
      expect(details.runner?.whatsapp).toBeNull();
    });

    it('masks runner.whatsapp to null when status is CANCELLED (D35 rule)', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(createMockOrder('CANCELLED'));
      const details = await service.getAdminOrderDetails('ord-test');
      expect(details.runner?.whatsapp).toBeNull();
    });
  });
});
