import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { CustomerOrdersService } from '../../src/modules/orders/services/customer-orders.service';
import type { PrismaService } from '../../src/database/prisma.service';
import type { AuditService } from '../../src/modules/audit/audit.service';
import type { NotificationsService } from '../../src/modules/notifications/notifications.service';
import type { TelegramService } from '../../src/modules/notifications/telegram.service';
import type { PricingService } from '../../src/modules/pricing/pricing.service';
import type { OrderStateMachine } from '../../src/state-machine/order-state-machine';
import type { RunnerStateMachine } from '../../src/state-machine/runner-state-machine';

describe('CustomerOrdersService — Runner rating fixed 5 stars for customer', () => {
  let service: CustomerOrdersService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      customer: {
        findUnique: vi.fn(),
      },
      order: {
        findFirst: vi.fn(),
      },
    };

    service = new CustomerOrdersService(
      mockPrisma as unknown as PrismaService,
      {} as unknown as AuditService,
      {} as unknown as NotificationsService,
      {} as unknown as TelegramService,
      {} as unknown as PricingService,
      {} as unknown as OrderStateMachine,
      {} as unknown as RunnerStateMachine,
    );
  });

  it('always returns avgRating = 5 in getOrderDetails regardless of the runner real avgRating in DB', async () => {
    mockPrisma.customer.findUnique.mockResolvedValue({ id: 'cust_1', isDeleted: false });

    // Order with runner having avgRating 3.4 in DB
    mockPrisma.order.findFirst.mockResolvedValue({
      id: 'order_1',
      orderNumber: 'FW-000001',
      status: 'ASSIGNED',
      isPeripheral: false,
      baseFee: 60,
      peripheralFee: 0,
      extraStoresFee: 0,
      customFee: 0,
      customFeeReason: null,
      totalFee: 60,
      deliveryLat: 33.5138,
      deliveryLng: 36.2765,
      deliveryDesc: 'دمشق',
      notes: null,
      preferredRunnerId: null,
      waitForPreferred: false,
      createdAt: new Date(),
      reviewedAt: null,
      assignedAt: new Date(),
      startedAt: null,
      deliveredAt: null,
      cancelledAt: null,
      cancelReason: null,
      items: [],
      orderStores: [],
      ratings: [],
      runner: {
        id: 'run_1',
        avgRating: 3.4, // Real DB rating is 3.4
        totalRatings: 10,
        status: 'ON_MISSION',
        user: {
          name: 'أحمد المندوب',
          whatsapp: '0999000111',
          altPhone: null,
        },
      },
    });

    const result = await service.getOrderDetails('order_1', 'user_cust_1');

    expect(result.runner).not.toBeNull();
    expect(result.runner?.avgRating).toBe(5); // MUST be fixed 5
    expect(result.runner?.name).toBe('أحمد المندوب');
    expect(result.runner?.totalRatings).toBe(10);
  });
});
