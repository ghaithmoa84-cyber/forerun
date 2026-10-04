import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { OrderStatus, OrderStoreStatus } from '@forerun/shared-constants';
import { CONFIG } from '@forerun/shared-constants';
import { MarkStoreSkippedRequest, DeliverOrderRequest } from '@forerun/shared-types';
import type {
  CreateRunnerOrderItemRequest,
  CreateRunnerOrderItemResponse,
  CreateOrderStoreRequest,
  CreateOrderStoreResponse,
  DeleteOrderStoreResponse,
  RunnerOrderActionResponse,
  RunnerOrderStoresResponse,
  PurchaseStoreResponse,
} from '@forerun/shared-types';
import { PrismaService } from '../../../database/prisma.service.js';
import { AuditService } from '../../audit/audit.service.js';
import { LedgerService } from '../../ledger/ledger.service.js';
import { NotificationsService } from '../../notifications/notifications.service.js';
import { PricingService, type RecalculateFeeResult } from '../../pricing/pricing.service.js';
import { OrderStateMachine } from '../../../state-machine/order-state-machine.js';
import { OrderStoreStateMachine } from '../../../state-machine/order-store-state-machine.js';
import { RunnerStateMachine } from '../../../state-machine/runner-state-machine.js';
import type { Prisma } from '@prisma/client';

@Injectable()
export class RunnerOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly ledgerService: LedgerService,
    private readonly notificationsService: NotificationsService,
    private readonly pricingService: PricingService,
    private readonly orderStateMachine: OrderStateMachine,
    private readonly orderStoreStateMachine: OrderStoreStateMachine,
    private readonly runnerStateMachine: RunnerStateMachine,
  ) {}

  private readonly logger = new Logger(RunnerOrdersService.name);

  async listRunnerOrderStores(
    orderId: string,
    runnerUserId: string,
  ): Promise<RunnerOrderStoresResponse> {
    const runner = await this.prisma.runner.findUnique({
      where: { userId: runnerUserId },
    });
    if (!runner) {
      throw new NotFoundException('Runner profile not found');
    }

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, runnerId: runner.id },
      include: {
        orderStores: {
          where: { isDeleted: false },
          orderBy: { createdAt: 'asc' },
          include: {
            items: { orderBy: { createdAt: 'asc' } },
            receipts: {
              where: { isDeleted: false },
              orderBy: { uploadedAt: 'asc' },
            },
          },
        },
      },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return {
      orderId: order.id,
      orderNumber: order.orderNumber!,
      status: order.status,
      stores: order.orderStores.map((store) => ({
        id: store.id,
        storeName: store.storeName,
        isAnyStore: store.isAnyStore,
        status: store.status,
        isExtra: store.isExtra,
        addedBy: store.addedBy,
        purchasedAt: store.purchasedAt,
        isDeleted: store.isDeleted,
        deletedAt: store.deletedAt,
        items: store.items.map((item) => ({
          id: item.id,
          itemName: item.itemName,
          quantity: item.quantity,
          customStoreName: item.customStoreName,
          anyStore: item.anyStore,
        })),
        receipts: store.receipts.map((receipt) => ({
          id: receipt.id,
          orderStoreId: receipt.orderStoreId,
          imageUrl: receipt.imageUrl,
          r2Key: receipt.r2Key,
          isDeleted: receipt.isDeleted,
          deletedAt: receipt.deletedAt,
          uploadedAt: receipt.uploadedAt,
        })),
      })),
    };
  }

  async startOrder(
    orderId: string,
    runnerUserId: string,
  ): Promise<RunnerOrderActionResponse> {
    const result = await this.prisma.$transaction(
      async (tx) => {
        const runner = await tx.runner.findUnique({
          where: { userId: runnerUserId },
          include: { user: true },
        });
        if (!runner || runner.user.status !== 'VERIFIED') {
          throw new UnprocessableEntityException('Runner is not verified');
        }
        if (runner.status !== 'ON_MISSION') {
          throw new UnprocessableEntityException('Runner is not on mission');
        }

        const order = await tx.order.findFirst({
          where: { id: orderId, runnerId: runner.id },
          include: { orderStores: true, customer: true },
        });
        if (!order) {
          throw new NotFoundException('Order not found');
        }

        const transitionResult = this.orderStateMachine.transition(
          order.status as OrderStatus,
          'IN_PROGRESS',
          'RUNNER',
          { actorId: runnerUserId },
        );
        const updated = await tx.order.updateMany({
          where: { id: order.id, status: order.status },
          data: { status: transitionResult.to, startedAt: new Date() },
        });
        if (updated.count === 0) {
          throw new ConflictException('ORDER_STATUS_CHANGED_CONCURRENTLY');
        }
        const updatedOrder = await tx.order.findUniqueOrThrow({
          where: { id: order.id },
        });

        await this.auditService.log(
          {
            orderId: order.id,
            actorId: runnerUserId,
            actorRole: 'RUNNER',
            event: 'ORDER_STARTED',
            fromStatus: order.status,
            toStatus: transitionResult.to,
            meta: { orderNumber: order.orderNumber },
          },
          tx,
        );

        return { order: updatedOrder, customerUserId: order.customer.userId };
      },
      { timeout: CONFIG.TRANSACTION_TIMEOUT_MS },
    );

    try {
      await this.notificationsService.emitToCustomer(
        result.customerUserId,
        'order:status_changed',
        {
          orderId: result.order.id,
          orderNumber: result.order.orderNumber,
          oldStatus: 'ASSIGNED',
          newStatus: result.order.status,
        },
        'status_update',
      );
      await this.notificationsService.emitToRunner(
        runnerUserId,
        'order:status_changed',
        {
          orderId: result.order.id,
          orderNumber: result.order.orderNumber,
          newStatus: result.order.status,
        },
        'status_update',
      );
      await this.notificationsService.emitToAdmin('order:status_changed', {
        orderId: result.order.id,
        orderNumber: result.order.orderNumber,
        newStatus: result.order.status,
      }, 'status_update');
    } catch (error) {
      this.logger.warn('Notification emit failed', { error, orderId: result.order.id });
    }

    return {
      orderId: result.order.id,
      orderNumber: result.order.orderNumber!,
      status: result.order.status,
    };
  }

  async purchaseStore(
    orderId: string,
    storeId: string,
    runnerUserId: string,
  ): Promise<PurchaseStoreResponse> {
    const result = await this.prisma.$transaction(
      async (tx) => {
        const runner = await tx.runner.findUnique({
          where: { userId: runnerUserId },
          include: { user: true },
        });
        if (!runner || runner.user.status !== 'VERIFIED') {
          throw new UnprocessableEntityException('Runner is not verified');
        }
        if (runner.status !== 'ON_MISSION') {
          throw new UnprocessableEntityException('Runner is not on mission');
        }

        const order = await tx.order.findFirst({
          where: { id: orderId, runnerId: runner.id },
          include: { orderStores: true, customer: true },
        });
        if (!order) {
          throw new NotFoundException('Order not found');
        }
        if (order.status !== 'IN_PROGRESS') {
          throw new UnprocessableEntityException('Order is not in progress');
        }

        const store = order.orderStores.find((item) => item.id === storeId);
        if (!store) {
          throw new NotFoundException('Order store not found');
        }
        const transitionResult = this.orderStoreStateMachine.transition(
          store.status as OrderStoreStatus,
          'PURCHASED',
          'RUNNER',
          { actorId: runnerUserId },
        );
        const updated = await tx.orderStore.updateMany({
          where: { id: store.id, status: store.status },
          data: { status: transitionResult.to, purchasedAt: new Date() },
        });
        if (updated.count === 0) {
          throw new ConflictException('ORDER_STATUS_CHANGED_CONCURRENTLY');
        }

        const feeResult = await this.pricingService.recalculateFee(order.id, tx);
        const updatedOrder = await tx.order.findUniqueOrThrow({
          where: { id: order.id },
        });
        const updatedStore = await tx.orderStore.findUniqueOrThrow({
          where: { id: store.id },
        });
        if (!updatedOrder || !updatedStore) {
          throw new NotFoundException('Order store not found');
        }

        await this.auditService.log(
          {
            orderId: order.id,
            actorId: runnerUserId,
            actorRole: 'RUNNER',
            event: 'STORE_PURCHASED',
            fromStatus: store.status,
            toStatus: transitionResult.to,
            meta: {
              orderNumber: order.orderNumber,
              storeId: store.id,
              storeName: store.storeName,
            },
          },
          tx,
        );

        return {
          order: updatedOrder,
          orderStore: updatedStore,
          fee: feeResult.newFee,
          feeChanged: feeResult.feeChanged,
          oldFee: feeResult.oldFee,
          feeReason: 'EXTRA_STORE',
          customerUserId: order.customer.userId,
        };
      },
      { timeout: CONFIG.TRANSACTION_TIMEOUT_MS },
    );

    let customerNotified = false;
    try {
      await this.notificationsService.emitToCustomer(
        result.customerUserId,
        'order:store_purchased',
        { orderId: result.order.id, storeName: result.orderStore.storeName },
      );
      customerNotified = true;
    } catch (error) {
      this.logger.warn('Customer notification failed', {
        error,
        orderId: result.order.id,
      });
    }

    if (result.feeChanged && result.oldFee) {
      try {
        await this.notificationsService.emitToCustomer(
          result.customerUserId,
          'order:fee_updated',
          {
            orderId: result.order.id,
            oldFee: result.oldFee.totalFee,
            newFee: result.fee.totalFee,
            reason: result.feeReason,
          },
          'status_update',
        );
      } catch (error) {
        this.logger.warn('Fee update notification failed', {
          error,
          orderId: result.order.id,
        });
      }
    }
    return {
      orderId: result.order.id,
      orderNumber: result.order.orderNumber!,
      orderStore: {
        id: result.orderStore.id,
        status: 'PURCHASED' as const,
      },
      updatedFee: result.fee,
      customerNotified,
    };
  }

  async createOrderStore(
    orderId: string,
    runnerUserId: string,
    dto: CreateOrderStoreRequest,
  ): Promise<CreateOrderStoreResponse> {
    const result = await this.prisma.$transaction(
      async (tx) => {
        const runner = await tx.runner.findUnique({
          where: { userId: runnerUserId },
          include: { user: true },
        });
        if (!runner || runner.user.status !== 'VERIFIED') {
          throw new UnprocessableEntityException('Runner is not verified');
        }
        if (runner.status !== 'ON_MISSION') {
          throw new UnprocessableEntityException('Runner is not on mission');
        }

        const order = await tx.order.findFirst({
          where: { id: orderId, runnerId: runner.id },
        });
        if (!order) {
          throw new NotFoundException('Order not found');
        }
        if (order.status !== 'IN_PROGRESS') {
          throw new UnprocessableEntityException('Order is not in progress');
        }

        const orderStore = await tx.orderStore.create({
          data: {
            orderId: order.id,
            storeName: dto.storeName,
            status: 'PENDING',
            isExtra: true,
            addedBy: 'RUNNER',
          },
        });

        await this.auditService.log(
          {
            orderId: order.id,
            actorId: runnerUserId,
            actorRole: 'RUNNER',
            event: 'STORE_ADDED',
            meta: {
              orderNumber: order.orderNumber,
              storeId: orderStore.id,
              storeName: orderStore.storeName,
              addedBy: 'RUNNER',
            },
          },
          tx,
        );

        return { order, orderStore };
      },
      { timeout: CONFIG.TRANSACTION_TIMEOUT_MS },
    );

    return {
      orderId: result.order.id,
      orderNumber: result.order.orderNumber!,
      orderStore: {
        id: result.orderStore.id,
        storeName: result.orderStore.storeName,
        isExtra: true,
        status: 'PENDING' as const,
        addedBy: 'RUNNER' as const,
      },
    };
  }

  async deleteOrderStore(
    orderId: string,
    storeId: string,
    runnerUserId: string,
  ): Promise<DeleteOrderStoreResponse> {
    const result = await this.prisma.$transaction(
      async (tx) => {
        const runner = await tx.runner.findUnique({
          where: { userId: runnerUserId },
          include: { user: true },
        });
        if (!runner || runner.user.status !== 'VERIFIED') {
          throw new UnprocessableEntityException('Runner is not verified');
        }
        if (runner.status !== 'ON_MISSION') {
          throw new UnprocessableEntityException('Runner is not on mission');
        }

        const order = await tx.order.findFirst({
          where: { id: orderId, runnerId: runner.id },
        });
        if (!order) {
          throw new NotFoundException('Order not found');
        }
        if (order.status !== 'IN_PROGRESS') {
          throw new UnprocessableEntityException('Order is not in progress');
        }

        const store = await tx.orderStore.findFirst({
          where: { id: storeId, orderId: order.id, includeDeleted: true } as Prisma.OrderStoreWhereInput,
        });
        if (!store) {
          throw new NotFoundException('Order store not found');
        }
        if (store.isDeleted) {
          throw new UnprocessableEntityException('Order store already deleted');
        }
        if (store.status !== 'PENDING') {
          throw new UnprocessableEntityException(
            'Only pending stores can be removed',
          );
        }

        const updatedStore = await tx.orderStore.update({
          where: { id: store.id },
          data: { isDeleted: true, deletedAt: new Date() },
        });

        await this.auditService.log(
          {
            orderId: order.id,
            actorId: runnerUserId,
            actorRole: 'RUNNER',
            event: 'STORE_REMOVED',
            meta: {
              orderNumber: order.orderNumber,
              storeId: store.id,
              storeName: store.storeName,
            },
          },
          tx,
        );

        return { order, orderStore: updatedStore };
      },
      { timeout: CONFIG.TRANSACTION_TIMEOUT_MS },
    );

    return {
      orderId: result.order.id,
      orderNumber: result.order.orderNumber!,
      orderStore: {
        id: result.orderStore.id,
        storeName: result.orderStore.storeName,
        isDeleted: true,
      },
    };
  }

  async createOrderItem(
    orderId: string,
    runnerUserId: string,
    dto: CreateRunnerOrderItemRequest,
  ): Promise<CreateRunnerOrderItemResponse> {
    const result = await this.prisma.$transaction(
      async (tx) => {
        const runner = await tx.runner.findUnique({
          where: { userId: runnerUserId },
          include: { user: true },
        });
        if (!runner || runner.user.status !== 'VERIFIED') {
          throw new UnprocessableEntityException('Runner is not verified');
        }
        if (runner.status !== 'ON_MISSION') {
          throw new UnprocessableEntityException('Runner is not on mission');
        }

        const order = await tx.order.findFirst({
          where: { id: orderId, runnerId: runner.id },
        });
        if (!order) {
          throw new NotFoundException('Order not found');
        }
        if (order.status !== 'IN_PROGRESS') {
          throw new UnprocessableEntityException('Order is not in progress');
        }

        const orderStore = await tx.orderStore.findFirst({
          where: { id: dto.orderStoreId, orderId: order.id },
        });
        if (!orderStore) {
          throw new NotFoundException(
            'Order store not found for this order',
          );
        }

        const orderItem = await tx.orderItem.create({
          data: {
            orderId: order.id,
            orderStoreId: orderStore.id,
            itemName: dto.itemName,
            quantity: dto.quantity,
            anyStore: false,
          },
        });

        return { order, orderItem };
      },
      { timeout: CONFIG.TRANSACTION_TIMEOUT_MS },
    );

    return {
      id: result.orderItem.id,
      itemName: result.orderItem.itemName,
      quantity: result.orderItem.quantity,
      orderStoreId: result.orderItem.orderStoreId!,
      orderId: result.order.id,
    };
  }

  async skipStore(
    orderId: string,
    storeId: string,
    runnerUserId: string,
    dto: MarkStoreSkippedRequest,
  ): Promise<RunnerOrderActionResponse> {
    const result = await this.prisma.$transaction(
      async (tx) => {
        const runner = await tx.runner.findUnique({
          where: { userId: runnerUserId },
          include: { user: true },
        });
        if (!runner || runner.user.status !== 'VERIFIED') {
          throw new UnprocessableEntityException('Runner is not verified');
        }
        if (runner.status !== 'ON_MISSION') {
          throw new UnprocessableEntityException('Runner is not on mission');
        }

        const order = await tx.order.findFirst({
          where: { id: orderId, runnerId: runner.id },
          include: { orderStores: true, customer: true },
        });
        if (!order) {
          throw new NotFoundException('Order not found');
        }
        if (order.status !== 'IN_PROGRESS') {
          throw new UnprocessableEntityException('Order is not in progress');
        }

        const store = order.orderStores.find((item) => item.id === storeId);
        if (!store) {
          throw new NotFoundException('Order store not found');
        }
        const transitionResult = this.orderStoreStateMachine.transition(
          store.status as OrderStoreStatus,
          'SKIPPED',
          'RUNNER',
          { actorId: runnerUserId },
        );
        const updated = await tx.orderStore.updateMany({
          where: { id: store.id, status: store.status },
          data: { status: transitionResult.to },
        });
        if (updated.count === 0) {
          throw new ConflictException('ORDER_STATUS_CHANGED_CONCURRENTLY');
        }
        const updatedStore = await tx.orderStore.findUniqueOrThrow({
          where: { id: store.id },
        });
        await this.auditService.log(
          {
            orderId: order.id,
            actorId: runnerUserId,
            actorRole: 'RUNNER',
            event: 'STORE_SKIPPED',
            fromStatus: store.status,
            toStatus: transitionResult.to,
            meta: {
              orderNumber: order.orderNumber,
              storeId: store.id,
              storeName: store.storeName,
              reason: dto.reason ?? null,
            },
          },
          tx,
        );

        return { order, orderStore: updatedStore, customerUserId: order.customer.userId };
      },
      { timeout: CONFIG.TRANSACTION_TIMEOUT_MS },
    );

    try {
      await this.notificationsService.emitToCustomer(
        result.customerUserId,
        'order:store_skipped',
        {
          orderId: result.order.id,
          storeName: result.orderStore.storeName,
        },
      );
    } catch (error) {
      this.logger.warn('Notification emit failed', { error, orderId: result.order.id });
    }

    return {
      orderId: result.order.id,
      orderNumber: result.order.orderNumber!,
      status: result.order.status,
    };
  }

  async proceedToDelivery(
    orderId: string,
    runnerUserId: string,
  ): Promise<RunnerOrderActionResponse> {
    const result = await this.prisma.$transaction(
      async (tx) => {
        const runner = await tx.runner.findUnique({
          where: { userId: runnerUserId },
          include: { user: true },
        });
        if (!runner || runner.user.status !== 'VERIFIED') {
          throw new UnprocessableEntityException('Runner is not verified');
        }
        if (runner.status !== 'ON_MISSION') {
          throw new UnprocessableEntityException('Runner is not on mission');
        }

        const order = await tx.order.findFirst({
          where: { id: orderId, runnerId: runner.id },
          include: { orderStores: true, customer: true },
        });
        if (!order) {
          throw new NotFoundException('Order not found');
        }
        if (order.status !== 'IN_PROGRESS') {
          throw new UnprocessableEntityException('Order is not in progress');
        }
        if (
          order.orderStores.length === 0 ||
          order.orderStores.some((store) => store.status === 'PENDING')
        ) {
          throw new UnprocessableEntityException(
            'All stores must be purchased or skipped before delivery',
          );
        }

        const transitionResult = this.orderStateMachine.transition(
          order.status as OrderStatus,
          'OUT_FOR_DELIVERY',
          'RUNNER',
          { actorId: runnerUserId },
        );
        const updated = await tx.order.updateMany({
          where: { id: order.id, status: order.status },
          data: { status: transitionResult.to },
        });
        if (updated.count === 0) {
          throw new ConflictException('ORDER_STATUS_CHANGED_CONCURRENTLY');
        }
        const updatedOrder = await tx.order.findUniqueOrThrow({
          where: { id: order.id },
        });

        await this.auditService.log(
          {
            orderId: order.id,
            actorId: runnerUserId,
            actorRole: 'RUNNER',
            event: 'PROCEEDED_TO_DELIVERY',
            fromStatus: order.status,
            toStatus: transitionResult.to,
            meta: { orderNumber: order.orderNumber },
          },
          tx,
        );

        return { order: updatedOrder, customerUserId: order.customer.userId };
      },
      { timeout: CONFIG.TRANSACTION_TIMEOUT_MS },
    );

    try {
      await this.notificationsService.emitToCustomer(
        result.customerUserId,
        'order:out_for_delivery',
        { orderId: result.order.id },
        'status_update',
      );
      await this.notificationsService.emitToAdmin('order:status_changed', {
        orderId: result.order.id,
        orderNumber: result.order.orderNumber,
        newStatus: result.order.status,
      }, 'status_update');
    } catch (error) {
      this.logger.warn('Notification emit failed', { error, orderId: result.order.id });
    }

    return {
      orderId: result.order.id,
      orderNumber: result.order.orderNumber!,
      status: result.order.status,
    };
  }

  /**
   * Validates runner verification status, order readiness, and store completion.
   */
  private async validateDeliveryPreconditions(
    tx: Prisma.TransactionClient,
    orderId: string,
    runnerUserId: string,
  ): Promise<{
    runner: Prisma.RunnerGetPayload<{ include: { user: true } }>;
    order: Prisma.OrderGetPayload<{
      include: { runner: true; customer: true; orderStores: true };
    }>;
  }> {
    const runner = await tx.runner.findUnique({
      where: { userId: runnerUserId },
      include: { user: true },
    });
    if (!runner || runner.user.status !== 'VERIFIED') {
      throw new UnprocessableEntityException('Runner is not verified');
    }

    const order = await tx.order.findFirst({
      where: { id: orderId, runnerId: runner.id },
      include: { runner: true, customer: true, orderStores: true },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== 'DELIVERED') {
      if (order.status !== 'OUT_FOR_DELIVERY') {
        throw new UnprocessableEntityException(
          'Order is not ready for delivery',
        );
      }
      if (
        order.orderStores.length === 0 ||
        order.orderStores.some((store) => store.status === 'PENDING')
      ) {
        throw new UnprocessableEntityException(
          'All stores must be purchased or skipped before delivery',
        );
      }
    }

    return { runner, order };
  }

  /**
   * Handles idempotency validation and claims the delivery lock using idempotencyKey.
   */
  private async processIdempotentDelivery(
    tx: Prisma.TransactionClient,
    order: Prisma.OrderGetPayload<{
      include: { runner: true; customer: true; orderStores: true };
    }>,
    idempotencyKey: string,
  ): Promise<{
    order: Prisma.OrderGetPayload<{
      include?: { runner: true; customer: true; orderStores: true };
    }>;
    idempotent: boolean;
    ledgerEntries: unknown[];
    runnerId: string | null;
    customerId: string;
    customerUserId: string;
  } | null> {
    if (order.status === 'DELIVERED') {
      this.orderStateMachine.validateIdempotencyKeyForDelivered(
        order,
        idempotencyKey,
      );
      if (order.idempotencyKey !== idempotencyKey) {
        throw new ConflictException('Idempotency key mismatch');
      }
      return {
        order,
        idempotent: true,
        ledgerEntries: [],
        runnerId: order.runnerId,
        customerId: order.customerId,
        customerUserId: order.customer.userId,
      };
    }

    this.orderStateMachine.validateIdempotencyKeyForDelivered(
      order,
      idempotencyKey,
    );
    const claimed = await tx.order.updateMany({
      where: {
        id: order.id,
        status: 'OUT_FOR_DELIVERY',
        idempotencyKey: null,
      },
      data: { idempotencyKey },
    });
    if (claimed.count === 0) {
      const current = await tx.order.findUnique({ where: { id: order.id } });
      if (current?.status === 'DELIVERED') {
        this.orderStateMachine.validateIdempotencyKeyForDelivered(
          current,
          idempotencyKey,
        );
        if (current.idempotencyKey === idempotencyKey) {
          return {
            order: current!,
            idempotent: true,
            ledgerEntries: [],
            runnerId: current.runnerId,
            customerId: current.customerId,
            customerUserId: order.customer.userId,
          };
        }
      }
      throw new ConflictException('Delivery is already being processed');
    }

    return null;
  }

  /**
   * Transitions order to DELIVERED, runner to AVAILABLE, and updates customer stats.
   */
  private async updateOrderAndRunnerState(
    tx: Prisma.TransactionClient,
    order: Prisma.OrderGetPayload<{
      include: { runner: true; customer: true; orderStores: true };
    }>,
    runnerUserId: string,
  ) {
    const transitionResult = this.orderStateMachine.transition(
      order.status as OrderStatus,
      'DELIVERED',
      'RUNNER',
      { actorId: runnerUserId },
    );
    const feeResult: RecalculateFeeResult =
      await this.pricingService.recalculateFee(order.id, tx);
    const updated = await tx.order.updateMany({
      where: { id: order.id, status: order.status },
      data: {
        status: transitionResult.to,
        deliveredAt: new Date(),
      },
    });
    if (updated.count === 0) {
      throw new ConflictException('ORDER_STATUS_CHANGED_CONCURRENTLY');
    }
    const updatedOrder = await tx.order.findUniqueOrThrow({
      where: { id: order.id },
    });

    if (!order.runnerId || !order.runner) {
      throw new NotFoundException('Runner not found');
    }
    const runnerTransition = this.runnerStateMachine.transition(
      order.runner.status,
      'AVAILABLE',
      'SYSTEM',
      { actorId: runnerUserId },
    );
    const runnerUpdated = await tx.runner.updateMany({
      where: { id: order.runnerId, status: order.runner.status },
      data: { status: 'AVAILABLE' },
    });
    if (runnerUpdated.count === 0) {
      throw new ConflictException('CONCURRENT_RUNNER_STATE_CHANGE');
    }

    await tx.customer.update({
      where: { id: order.customerId },
      data: {
        completedOrders: { increment: 1 },
        totalFeesPaid: { increment: feeResult.newFee.totalFee },
      },
    });

    return {
      updatedOrder,
      feeResult,
      transitionResult,
      runnerTransition,
    };
  }

  /**
   * Records ledger entries for order fees and shares, and logs audit events.
   */
  private async calculateAndRecordLedger(
    tx: Prisma.TransactionClient,
    params: {
      orderId: string;
      orderNumber: string | null;
      runnerId: string | null;
      customerId: string;
      fromOrderStatus: string;
      toOrderStatus: OrderStatus;
      runnerStatus: string;
      runnerTransitionTo: string;
      runnerUserId: string;
      feeResult: RecalculateFeeResult;
      idempotencyKey: string;
    },
  ): Promise<unknown[]> {
    const {
      orderId,
      orderNumber,
      runnerId,
      fromOrderStatus,
      toOrderStatus,
      runnerStatus,
      runnerTransitionTo,
      runnerUserId,
      feeResult,
      idempotencyKey,
    } = params;

    const ledgerEntries = await this.ledgerService.createMany(
      [
        {
          type: 'ORDER_FEE_TOTAL',
          amount: feeResult.newFee.totalFee,
          description: `Order fee for ${orderNumber}`,
          orderId,
          runnerId: runnerId ?? undefined,
          meta: { idempotencyKey },
        },
        {
          type: 'RUNNER_SHARE',
          amount: feeResult.newFee.runnerShare,
          description: `Runner share for ${orderNumber}`,
          orderId,
          runnerId: runnerId ?? undefined,
          meta: { idempotencyKey },
        },
        {
          type: 'PLATFORM_SHARE',
          amount: feeResult.newFee.platformShare,
          description: `Platform share for ${orderNumber}`,
          orderId,
          runnerId: runnerId ?? undefined,
          meta: { idempotencyKey },
        },
      ],
      tx,
    );

    await this.auditService.log(
      {
        orderId,
        actorId: runnerUserId,
        actorRole: 'RUNNER',
        event: 'ORDER_DELIVERED',
        fromStatus: fromOrderStatus,
        toStatus: toOrderStatus,
        meta: {
          orderNumber,
          idempotencyKey,
        },
      },
      tx,
    );
    await this.auditService.log(
      {
        orderId,
        actorId: runnerUserId,
        actorRole: 'SYSTEM',
        event: 'LEDGER_ENTRY_CREATED',
        meta: {
          orderNumber,
          count: ledgerEntries.length,
          types: ledgerEntries.map((entry) => entry.type),
        },
      },
      tx,
    );
    await this.auditService.log(
      {
        actorId: runnerUserId,
        actorRole: 'SYSTEM',
        event: 'RUNNER_STATUS_CHANGED',
        fromStatus: runnerStatus,
        toStatus: runnerTransitionTo,
        meta: {
          runnerId,
          orderId,
        },
      },
      tx,
    );

    return ledgerEntries;
  }

  /**
   * Sends notifications to customer, runner, and admin outside the transaction.
   */
  private async sendDeliveryNotifications(
    customerUserId: string,
    runnerUserId: string,
    order: {
      id: string;
      orderNumber: string | null;
      status: string;
      deliveredAt: Date | null;
    },
  ): Promise<void> {
    try {
      await this.notificationsService.emitToCustomer(
        customerUserId,
        'order:delivered',
        {
          orderId: order.id,
          deliveredAt: order.deliveredAt,
        },
        'success',
      );
      await this.notificationsService.emitToRunner(
        runnerUserId,
        'order:delivered',
        { orderId: order.id },
        'success',
      );
      await this.notificationsService.emitToAdmin(
        'order:status_changed',
        {
          orderId: order.id,
          orderNumber: order.orderNumber,
          newStatus: order.status,
        },
        'status_update',
      );
    } catch (error) {
      this.logger.warn('Notification emit failed', {
        error,
        orderId: order.id,
      });
    }
  }

  async deliverOrder(
    orderId: string,
    runnerUserId: string,
    dto: DeliverOrderRequest,
  ): Promise<
    RunnerOrderActionResponse & {
      idempotent: boolean;
      ledgerEntries: unknown[];
      runnerId: string | null;
      customerId: string;
    }
  > {
    const result = await this.prisma.$transaction(
      async (tx) => {
        const { order } = await this.validateDeliveryPreconditions(
          tx,
          orderId,
          runnerUserId,
        );

        const idempotentResult = await this.processIdempotentDelivery(
          tx,
          order,
          dto.idempotencyKey,
        );
        if (idempotentResult) {
          return idempotentResult;
        }

        const {
          updatedOrder,
          feeResult,
          transitionResult,
          runnerTransition,
        } = await this.updateOrderAndRunnerState(tx, order, runnerUserId);

        const ledgerEntries = await this.calculateAndRecordLedger(tx, {
          orderId: order.id,
          orderNumber: updatedOrder.orderNumber,
          runnerId: order.runnerId,
          customerId: order.customerId,
          fromOrderStatus: order.status,
          toOrderStatus: transitionResult.to,
          runnerStatus: order.runner!.status,
          runnerTransitionTo: runnerTransition.to,
          runnerUserId,
          feeResult,
          idempotencyKey: dto.idempotencyKey,
        });

        return {
          order: updatedOrder,
          idempotent: false,
          ledgerEntries,
          runnerId: order.runnerId,
          customerId: order.customerId,
          customerUserId: order.customer.userId,
        };
      },
      { timeout: CONFIG.TRANSACTION_TIMEOUT_MS },
    );

    if (!result.idempotent) {
      await this.sendDeliveryNotifications(
        result.customerUserId,
        runnerUserId,
        result.order,
      );
    }

    return {
      orderId: result.order.id,
      orderNumber: result.order.orderNumber!,
      status: result.order.status,
      idempotent: result.idempotent,
      ledgerEntries: result.ledgerEntries ?? [],
      runnerId: result.order.runnerId,
      customerId: result.order.customerId,
    };
  }
}