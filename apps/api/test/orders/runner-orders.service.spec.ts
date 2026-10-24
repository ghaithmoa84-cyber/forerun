import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RunnerOrdersService } from '../../src/modules/orders/services/runner-orders.service.js';
import { OrderStateMachine } from '../../src/state-machine/order-state-machine.js';
import { RunnerStateMachine } from '../../src/state-machine/runner-state-machine.js';
import { OrderStoreStateMachine } from '../../src/state-machine/order-store-state-machine.js';
import { ORDER_TRANSITIONS, ORDER_STORE_TRANSITIONS } from '../../src/state-machine/order-transitions.js';
import { RUNNER_TRANSITIONS } from '../../src/state-machine/runner-transitions.js';

describe('RunnerOrdersService — deliverOrder DTO Least Privilege', () => {
  let service: RunnerOrdersService;
  let txClient: any;
  let prisma: any;
  let auditService: any;
  let ledgerService: any;
  let notificationsService: any;
  let pricingService: any;

  beforeEach(() => {
    txClient = {
      runner: {
        findUnique: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      order: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findUniqueOrThrow: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      customer: {
        update: vi.fn().mockResolvedValue({}),
      },
    };

    prisma = {
      $transaction: vi.fn((callback: any) => callback(txClient)),
    };

    auditService = {
      log: vi.fn().mockResolvedValue({}),
    };

    ledgerService = {
      createMany: vi.fn().mockResolvedValue([
        {
          id: 'ledger-entry-1',
          type: 'ORDER_FEE_TOTAL',
          amount: 60,
          orderId: 'order-123',
        },
      ]),
    };

    notificationsService = {
      emitToCustomer: vi.fn().mockResolvedValue(undefined),
      emitToRunner: vi.fn().mockResolvedValue(undefined),
      emitToAdmin: vi.fn().mockResolvedValue(undefined),
    };

    pricingService = {
      recalculateFee: vi.fn().mockResolvedValue({
        newFee: {
          baseFee: 60,
          extraStoresFee: 0,
          peripheralFee: 0,
          customFee: 0,
          totalFee: 60,
        },
      }),
    };

    const orderStateMachine = new OrderStateMachine(ORDER_TRANSITIONS);
    const orderStoreStateMachine = new OrderStoreStateMachine(ORDER_STORE_TRANSITIONS);
    const runnerStateMachine = new RunnerStateMachine(RUNNER_TRANSITIONS);

    service = new RunnerOrdersService(
      prisma,
      auditService,
      ledgerService,
      notificationsService,
      pricingService,
      orderStateMachine,
      orderStoreStateMachine,
      runnerStateMachine,
    );
  });

  it('deliverOrder strictly excludes customerId, ledgerEntries, and runnerId from returned object', async () => {
    const mockRunner = {
      id: 'runner-abc',
      userId: 'runner-user-123',
      status: 'ON_MISSION',
      user: { status: 'VERIFIED' },
    };

    const mockOrder = {
      id: 'order-123',
      orderNumber: 'ORD-2026-001',
      status: 'OUT_FOR_DELIVERY',
      idempotencyKey: null,
      runnerId: 'runner-abc',
      customerId: 'customer-secret-uuid',
      runner: { status: 'ON_MISSION' },
      customer: { userId: 'customer-user-456' },
      orderStores: [
        { id: 'store-1', status: 'PURCHASED' },
      ],
    };

    txClient.runner.findUnique.mockResolvedValue(mockRunner);
    txClient.order.findFirst.mockResolvedValue(mockOrder);
    txClient.order.findUniqueOrThrow.mockResolvedValue({
      ...mockOrder,
      status: 'DELIVERED',
      deliveredAt: new Date(),
    });

    const response = await service.deliverOrder('order-123', 'runner-user-123', {
      idempotencyKey: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    });

    // 1. Verify expected contract fields
    expect(response.orderId).toBe('order-123');
    expect(response.orderNumber).toBe('ORD-2026-001');
    expect(response.status).toBe('DELIVERED');
    expect(response.idempotent).toBe(false);

    // 2. Strict negative checks: ensure leaked keys do not exist in the returned object
    expect('customerId' in response).toBe(false);
    expect('ledgerEntries' in response).toBe(false);
    expect('runnerId' in response).toBe(false);

    expect(response).not.toHaveProperty('customerId');
    expect(response).not.toHaveProperty('ledgerEntries');
    expect(response).not.toHaveProperty('runnerId');

    // 3. Exact key inventory match
    const keys = Object.keys(response).sort();
    expect(keys).toEqual(['idempotent', 'orderId', 'orderNumber', 'status']);
  });

  it('deliverOrder idempotent replay strictly excludes customerId, ledgerEntries, and runnerId', async () => {
    const idempotencyKey = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
    const mockRunner = {
      id: 'runner-abc',
      userId: 'runner-user-123',
      status: 'AVAILABLE',
      user: { status: 'VERIFIED' },
    };

    const mockDeliveredOrder = {
      id: 'order-123',
      orderNumber: 'ORD-2026-001',
      status: 'DELIVERED',
      idempotencyKey,
      runnerId: 'runner-abc',
      customerId: 'customer-secret-uuid',
      runner: { status: 'AVAILABLE' },
      customer: { userId: 'customer-user-456' },
      orderStores: [
        { id: 'store-1', status: 'PURCHASED' },
      ],
    };

    txClient.runner.findUnique.mockResolvedValue(mockRunner);
    txClient.order.findFirst.mockResolvedValue(mockDeliveredOrder);

    const response = await service.deliverOrder('order-123', 'runner-user-123', {
      idempotencyKey,
    });

    expect(response.orderId).toBe('order-123');
    expect(response.orderNumber).toBe('ORD-2026-001');
    expect(response.status).toBe('DELIVERED');
    expect(response.idempotent).toBe(true);

    expect('customerId' in response).toBe(false);
    expect('ledgerEntries' in response).toBe(false);
    expect('runnerId' in response).toBe(false);

    const keys = Object.keys(response).sort();
    expect(keys).toEqual(['idempotent', 'orderId', 'orderNumber', 'status']);
  });
});
