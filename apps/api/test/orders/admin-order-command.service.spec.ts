import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  NotFoundException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AdminOrderCommandService } from '../../src/modules/orders/services/admin-order-command.service.js';
import { OrderStateMachine } from '../../src/state-machine/order-state-machine.js';
import { RunnerStateMachine } from '../../src/state-machine/runner-state-machine.js';
import { ORDER_TRANSITIONS } from '../../src/state-machine/order-transitions.js';
import { RUNNER_TRANSITIONS } from '../../src/state-machine/runner-transitions.js';
import type { PrismaService } from '../../src/database/prisma.service.js';
import type { AuditService } from '../../src/modules/audit/audit.service.js';
import type { NotificationsService } from '../../src/modules/notifications/notifications.service.js';
import type { PricingService } from '../../src/modules/pricing/pricing.service.js';

describe('AdminOrderCommandService', () => {
  let service: AdminOrderCommandService;
  let txClient: {
    order: {
      findUnique: ReturnType<typeof vi.fn>;
      findUniqueOrThrow: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
    };
    runner: {
      findUnique: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
    };
  };
  let prisma: {
    $transaction: ReturnType<typeof vi.fn>;
  };
  let auditService: {
    log: ReturnType<typeof vi.fn>;
  };
  let notificationsService: {
    emitToCustomer: ReturnType<typeof vi.fn>;
    emitToRunner: ReturnType<typeof vi.fn>;
    emitToAdmin: ReturnType<typeof vi.fn>;
  };
  let pricingService: {
    calculateFee: ReturnType<typeof vi.fn>;
  };
  let orderStateMachine: OrderStateMachine;
  let runnerStateMachine: RunnerStateMachine;

  beforeEach(() => {
    txClient = {
      order: {
        findUnique: vi.fn(),
        findUniqueOrThrow: vi.fn(),
        updateMany: vi.fn(),
        count: vi.fn(),
      },
      runner: {
        findUnique: vi.fn(),
        updateMany: vi.fn(),
      },
    };

    prisma = {
      $transaction: vi.fn().mockImplementation((callback) => callback(txClient)),
    };

    auditService = {
      log: vi.fn().mockResolvedValue(undefined),
    };

    notificationsService = {
      emitToCustomer: vi.fn().mockResolvedValue(undefined),
      emitToRunner: vi.fn().mockResolvedValue(undefined),
      emitToAdmin: vi.fn().mockResolvedValue(undefined),
    };

    pricingService = {
      calculateFee: vi.fn().mockImplementation(({ isPeripheral, purchasedStoreCount }) => {
        const baseFee = 60;
        const peripheralFee = isPeripheral ? 40 : 0;
        const extraStoresFee = Math.max(0, (purchasedStoreCount || 0) - 1) * 20;
        const totalFee = baseFee + peripheralFee + extraStoresFee;
        return {
          baseFee,
          peripheralFee,
          extraStoresFee,
          totalFee,
          runnerShare: Math.floor(totalFee * 0.75),
          platformShare: Math.ceil(totalFee * 0.25),
        };
      }),
    };

    orderStateMachine = new OrderStateMachine(ORDER_TRANSITIONS);
    runnerStateMachine = new RunnerStateMachine(RUNNER_TRANSITIONS);

    service = new AdminOrderCommandService(
      prisma as unknown as PrismaService,
      auditService as unknown as AuditService,
      notificationsService as unknown as NotificationsService,
      pricingService as unknown as PricingService,
      orderStateMachine,
      runnerStateMachine,
    );
  });

  describe('approveOrder', () => {
    const orderId = 'ord-100';
    const adminId = 'admin-user-1';

    it('approves order from PENDING_REVIEW to AWAITING_RUNNER without preferred runner', async () => {
      const mockOrder = {
        id: orderId,
        orderNumber: 'ORD-2026-100',
        status: 'PENDING_REVIEW',
        customerId: 'cust-1',
        customer: { userId: 'usr-cust-1' },
        preferredRunnerId: null,
        waitForPreferred: false,
        isPeripheral: false,
        baseFee: 60,
        peripheralFee: 0,
        extraStoresFee: 0,
        totalFee: 60,
        orderStores: [{ id: 'st-1' }],
      };

      txClient.order.findUnique.mockResolvedValue(mockOrder);
      txClient.order.updateMany.mockResolvedValue({ count: 1 });
      txClient.order.findUniqueOrThrow.mockResolvedValue({
        ...mockOrder,
        status: 'AWAITING_RUNNER',
      });

      const result = await service.approveOrder(orderId, adminId, {
        isPeripheral: false,
        notes: 'Approved without notes',
      });

      expect(result.order.status).toBe('AWAITING_RUNNER');
      expect(result.feeChanged).toBe(false);

      expect(txClient.order.updateMany).toHaveBeenCalledWith({
        where: { id: orderId, status: 'PENDING_REVIEW' },
        data: expect.objectContaining({
          status: 'AWAITING_RUNNER',
          isPeripheral: false,
          notes: 'Approved without notes',
        }),
      });

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId,
          event: 'ORDER_REVIEW_STARTED',
          fromStatus: 'PENDING_REVIEW',
          toStatus: 'UNDER_REVIEW',
        }),
        txClient,
      );

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId,
          event: 'ORDER_APPROVED',
          fromStatus: 'UNDER_REVIEW',
          toStatus: 'AWAITING_RUNNER',
        }),
        txClient,
      );

      expect(notificationsService.emitToCustomer).toHaveBeenCalledWith(
        'usr-cust-1',
        'order:status_changed',
        expect.objectContaining({
          orderId,
          newStatus: 'AWAITING_RUNNER',
          oldStatus: 'PENDING_REVIEW',
        }),
        'status_update',
      );
    });

    it('approves order to AWAITING_RUNNER when preferred runner is AVAILABLE', async () => {
      const mockOrder = {
        id: orderId,
        orderNumber: 'ORD-2026-101',
        status: 'PENDING_REVIEW',
        customerId: 'cust-1',
        customer: { userId: 'usr-cust-1' },
        preferredRunnerId: 'run-1',
        waitForPreferred: true,
        preferredRunner: { status: 'AVAILABLE' },
        isPeripheral: false,
        baseFee: 60,
        peripheralFee: 0,
        extraStoresFee: 0,
        totalFee: 60,
        orderStores: [{ id: 'st-1' }],
      };

      txClient.order.findUnique.mockResolvedValue(mockOrder);
      txClient.order.updateMany.mockResolvedValue({ count: 1 });
      txClient.order.findUniqueOrThrow.mockResolvedValue({
        ...mockOrder,
        status: 'AWAITING_RUNNER',
      });

      const result = await service.approveOrder(orderId, adminId, {
        isPeripheral: false,
      });

      expect(result.order.status).toBe('AWAITING_RUNNER');
    });

    it('approves order to AWAITING_PREFERRED_RUNNER when preferred runner is busy and waitForPreferred is true', async () => {
      const mockOrder = {
        id: orderId,
        orderNumber: 'ORD-2026-102',
        status: 'PENDING_REVIEW',
        customerId: 'cust-1',
        customer: { userId: 'usr-cust-1' },
        preferredRunnerId: 'run-1',
        waitForPreferred: true,
        preferredRunner: { status: 'ON_MISSION' },
        isPeripheral: false,
        baseFee: 60,
        peripheralFee: 0,
        extraStoresFee: 0,
        totalFee: 60,
        orderStores: [{ id: 'st-1' }],
      };

      txClient.order.findUnique.mockResolvedValue(mockOrder);
      txClient.order.updateMany.mockResolvedValue({ count: 1 });
      txClient.order.findUniqueOrThrow.mockResolvedValue({
        ...mockOrder,
        status: 'AWAITING_PREFERRED_RUNNER',
      });

      const result = await service.approveOrder(orderId, adminId, {
        isPeripheral: false,
      });

      expect(result.order.status).toBe('AWAITING_PREFERRED_RUNNER');
    });

    it('throws NotFoundException when order does not exist', async () => {
      txClient.order.findUnique.mockResolvedValue(null);

      await expect(
        service.approveOrder('non-existent-order', adminId, { isPeripheral: false }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException on concurrent status change during approval', async () => {
      const mockOrder = {
        id: orderId,
        orderNumber: 'ORD-2026-100',
        status: 'PENDING_REVIEW',
        customerId: 'cust-1',
        customer: { userId: 'usr-cust-1' },
        preferredRunnerId: null,
        waitForPreferred: false,
        isPeripheral: false,
        baseFee: 60,
        peripheralFee: 0,
        extraStoresFee: 0,
        totalFee: 60,
        orderStores: [],
      };

      txClient.order.findUnique.mockResolvedValue(mockOrder);
      txClient.order.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.approveOrder(orderId, adminId, { isPeripheral: false }),
      ).rejects.toThrow(ConflictException);
    });

    it('emits fee update notifications when peripheral fee changes during approval', async () => {
      const mockOrder = {
        id: orderId,
        orderNumber: 'ORD-2026-103',
        status: 'PENDING_REVIEW',
        customerId: 'cust-1',
        customer: { userId: 'usr-cust-1' },
        preferredRunnerId: null,
        waitForPreferred: false,
        isPeripheral: false,
        baseFee: 60,
        peripheralFee: 0,
        extraStoresFee: 0,
        totalFee: 60,
        orderStores: [{ id: 'st-1' }],
      };

      txClient.order.findUnique.mockResolvedValue(mockOrder);
      txClient.order.updateMany.mockResolvedValue({ count: 1 });
      txClient.order.findUniqueOrThrow.mockResolvedValue({
        ...mockOrder,
        isPeripheral: true,
        peripheralFee: 40,
        totalFee: 100,
        status: 'AWAITING_RUNNER',
      });

      const result = await service.approveOrder(orderId, adminId, {
        isPeripheral: true,
      });

      expect(result.feeChanged).toBe(true);
      expect(result.newFee.totalFee).toBe(100);

      expect(notificationsService.emitToCustomer).toHaveBeenCalledWith(
        'usr-cust-1',
        'order:fee_updated',
        expect.objectContaining({
          orderId,
          oldFee: 60,
          newFee: 100,
          reason: 'ADMIN_APPROVAL',
        }),
        'status_update',
      );
    });
  });

  describe('rejectOrder', () => {
    const orderId = 'ord-200';
    const adminId = 'admin-user-2';

    it('rejects order from PENDING_REVIEW to CANCELLED with cancelReason', async () => {
      const mockOrder = {
        id: orderId,
        orderNumber: 'ORD-2026-200',
        status: 'PENDING_REVIEW',
        customerId: 'cust-2',
        customer: { userId: 'usr-cust-2' },
      };

      txClient.order.findUnique.mockResolvedValue(mockOrder);
      txClient.order.updateMany.mockResolvedValue({ count: 1 });
      txClient.order.findUniqueOrThrow.mockResolvedValue({
        ...mockOrder,
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelReason: 'Store closed today',
      });

      const result = await service.rejectOrder(orderId, adminId, {
        cancelReason: 'Store closed today',
      });

      expect(result.order.status).toBe('CANCELLED');
      expect(txClient.order.updateMany).toHaveBeenCalledWith({
        where: { id: orderId, status: 'PENDING_REVIEW' },
        data: expect.objectContaining({
          status: 'CANCELLED',
          cancelledByUserId: adminId,
          cancelReason: 'Store closed today',
        }),
      });

      expect(auditService.log).toHaveBeenCalledWith(
        {
          orderId,
          actorId: adminId,
          actorRole: 'ADMIN',
          event: 'ORDER_REJECTED',
          fromStatus: 'PENDING_REVIEW',
          toStatus: 'CANCELLED',
          meta: {
            orderNumber: 'ORD-2026-200',
            cancelReason: 'Store closed today',
          },
        },
        txClient,
      );

      expect(notificationsService.emitToCustomer).toHaveBeenCalledWith(
        'usr-cust-2',
        'order:cancelled',
        expect.objectContaining({
          orderId,
          reason: 'Store closed today',
          cancelledBy: adminId,
        }),
        'status_update',
      );
    });

    it('throws NotFoundException when rejecting a non-existent order', async () => {
      txClient.order.findUnique.mockResolvedValue(null);

      await expect(
        service.rejectOrder('non-existent-order', adminId, { cancelReason: 'Invalid' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException on concurrent status change during rejection', async () => {
      const mockOrder = {
        id: orderId,
        status: 'PENDING_REVIEW',
        customerId: 'cust-2',
        customer: { userId: 'usr-cust-2' },
      };

      txClient.order.findUnique.mockResolvedValue(mockOrder);
      txClient.order.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.rejectOrder(orderId, adminId, { cancelReason: 'Cancelled' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('assignRunner', () => {
    const orderId = 'ord-300';
    const adminId = 'admin-user-3';
    const runnerId = 'run-300';

    it('assigns available verified runner to order and sets runner to ON_MISSION', async () => {
      const mockOrder = {
        id: orderId,
        orderNumber: 'ORD-2026-300',
        status: 'AWAITING_RUNNER',
        runnerId: null,
        runner: null,
      };

      const mockRunner = {
        id: runnerId,
        status: 'AVAILABLE',
        user: {
          id: 'usr-run-300',
          name: 'Ahmed Runner',
          status: 'VERIFIED',
        },
      };

      const mockAssignedOrderRecord = {
        id: orderId,
        orderNumber: 'ORD-2026-300',
        status: 'ASSIGNED',
        deliveryLat: 33.5138,
        deliveryLng: 36.2765,
        deliveryDesc: 'Home address',
        baseFee: 60,
        peripheralFee: 0,
        extraStoresFee: 0,
        totalFee: 60,
        customer: {
          userId: 'usr-cust-300',
          user: { name: 'Customer One' },
        },
        items: [
          {
            itemName: 'Milk',
            quantity: 2,
            customStoreName: null,
            anyStore: false,
          },
        ],
        orderStores: [],
      };

      txClient.order.findUnique.mockResolvedValue(mockOrder);
      txClient.runner.findUnique.mockResolvedValue(mockRunner);
      txClient.order.count.mockResolvedValue(0); // F2: No active orders
      txClient.runner.updateMany.mockResolvedValue({ count: 1 });
      txClient.order.updateMany.mockResolvedValue({ count: 1 });
      txClient.order.findUniqueOrThrow.mockResolvedValue(mockAssignedOrderRecord);

      const result = await service.assignRunner(orderId, adminId, runnerId);

      expect(result.order.status).toBe('ASSIGNED');

      // Runner transitioned to ON_MISSION
      expect(txClient.runner.updateMany).toHaveBeenCalledWith({
        where: { id: runnerId, status: 'AVAILABLE' },
        data: { status: 'ON_MISSION' },
      });

      // Order transitioned to ASSIGNED
      expect(txClient.order.updateMany).toHaveBeenCalledWith({
        where: { id: orderId, status: 'AWAITING_RUNNER' },
        data: expect.objectContaining({
          status: 'ASSIGNED',
          runnerId,
        }),
      });

      // Audit logs recorded
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'RUNNER_STATUS_CHANGED',
          fromStatus: 'AVAILABLE',
          toStatus: 'ON_MISSION',
        }),
        txClient,
      );

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'RUNNER_ASSIGNED',
          fromStatus: 'AWAITING_RUNNER',
          toStatus: 'ASSIGNED',
          meta: expect.objectContaining({ runnerId }),
        }),
        txClient,
      );

      // Notifications emitted
      expect(notificationsService.emitToRunner).toHaveBeenCalledWith(
        'usr-run-300',
        'order:assigned',
        expect.objectContaining({
          orderId,
          customerName: 'Customer One',
        }),
        'new_order',
      );

      expect(notificationsService.emitToCustomer).toHaveBeenCalledWith(
        'usr-cust-300',
        'order:runner_assigned',
        expect.objectContaining({
          orderId,
          runnerName: 'Ahmed Runner',
        }),
        'status_update',
      );
    });

    it('throws ConflictException when runner already has an active order (BUG-017)', async () => {
      const mockOrder = {
        id: orderId,
        status: 'AWAITING_RUNNER',
        runner: null,
      };

      const mockRunner = {
        id: runnerId,
        status: 'AVAILABLE',
        user: { status: 'VERIFIED' },
      };

      txClient.order.findUnique.mockResolvedValue(mockOrder);
      txClient.runner.findUnique.mockResolvedValue(mockRunner);
      txClient.order.count.mockResolvedValue(1); // Already has an active order

      await expect(service.assignRunner(orderId, adminId, runnerId)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.assignRunner(orderId, adminId, runnerId)).rejects.toThrow(
        'لا يمكن إسناد الطلب للمندوب لوجود طلب نشط قيد التنفيذ لديه مسبقًا',
      );
    });

    it('throws UnprocessableEntityException when runner is not available or not verified', async () => {
      const mockOrder = {
        id: orderId,
        status: 'AWAITING_RUNNER',
        runner: null,
      };

      txClient.order.findUnique.mockResolvedValue(mockOrder);

      // Case 1: Runner status is not AVAILABLE
      txClient.runner.findUnique.mockResolvedValue({
        id: runnerId,
        status: 'ON_MISSION',
        user: { status: 'VERIFIED' },
      });

      await expect(service.assignRunner(orderId, adminId, runnerId)).rejects.toThrow(
        UnprocessableEntityException,
      );

      // Case 2: Runner user status is not VERIFIED
      txClient.runner.findUnique.mockResolvedValue({
        id: runnerId,
        status: 'AVAILABLE',
        user: { status: 'PENDING' },
      });

      await expect(service.assignRunner(orderId, adminId, runnerId)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('throws NotFoundException when order does not exist', async () => {
      txClient.order.findUnique.mockResolvedValue(null);

      await expect(service.assignRunner('non-existent', adminId, runnerId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('cancelOrderAdmin', () => {
    const orderId = 'ord-400';
    const adminId = 'admin-user-4';

    it('cancels assigned order and returns runner to AVAILABLE', async () => {
      const mockOrder = {
        id: orderId,
        orderNumber: 'ORD-2026-400',
        status: 'ASSIGNED',
        runnerId: 'run-400',
        customerId: 'cust-400',
        customer: { userId: 'usr-cust-400' },
        runner: {
          id: 'run-400',
          userId: 'usr-run-400',
          status: 'ON_MISSION',
        },
      };

      txClient.order.findUnique.mockResolvedValue(mockOrder);
      txClient.order.updateMany.mockResolvedValue({ count: 1 });
      txClient.order.findUniqueOrThrow.mockResolvedValue({
        ...mockOrder,
        status: 'CANCELLED',
        cancelledAt: new Date(),
      });
      txClient.runner.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.cancelOrderAdmin(orderId, adminId, 'Cancelled by admin');

      expect(result.order.status).toBe('CANCELLED');

      expect(txClient.runner.updateMany).toHaveBeenCalledWith({
        where: { id: 'run-400', status: 'ON_MISSION' },
        data: { status: 'AVAILABLE' },
      });

      expect(notificationsService.emitToRunner).toHaveBeenCalledWith(
        'usr-run-400',
        'order:assignment_cancelled',
        expect.objectContaining({
          orderId,
          reason: 'Cancelled by admin',
        }),
        'status_update',
      );

      expect(notificationsService.emitToCustomer).toHaveBeenCalledWith(
        'usr-cust-400',
        'order:cancelled',
        expect.objectContaining({
          orderId,
          reason: 'Cancelled by admin',
        }),
        'status_update',
      );
    });

    it('throws ConflictException on concurrent runner state change during cancellation', async () => {
      const mockOrder = {
        id: orderId,
        orderNumber: 'ORD-2026-400',
        status: 'ASSIGNED',
        runnerId: 'run-400',
        customerId: 'cust-400',
        customer: { userId: 'usr-cust-400' },
        runner: {
          id: 'run-400',
          userId: 'usr-run-400',
          status: 'ON_MISSION',
        },
      };

      txClient.order.findUnique.mockResolvedValue(mockOrder);
      txClient.order.updateMany.mockResolvedValue({ count: 1 });
      txClient.order.findUniqueOrThrow.mockResolvedValue({
        ...mockOrder,
        status: 'CANCELLED',
        cancelledAt: new Date(),
      });
      txClient.runner.updateMany.mockResolvedValue({ count: 0 }); // Concurrent change

      await expect(service.cancelOrderAdmin(orderId, adminId)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.cancelOrderAdmin(orderId, adminId)).rejects.toThrow(
        'CONCURRENT_RUNNER_STATE_CHANGE',
      );
    });

    it('throws NotFoundException when order does not exist', async () => {
      txClient.order.findUnique.mockResolvedValue(null);

      await expect(service.cancelOrderAdmin('non-existent', adminId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
