import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type { OrderStatus } from '@forerun/shared-constants';
import { CONFIG, DEFAULT_PRICING_CONFIG } from '@forerun/shared-constants';
import {
  ApproveOrderRequest,
  RejectOrderRequest,
  StartOrderReviewRequest,
} from '@forerun/shared-types';
import type {
  AdminOrderApprovalResult,
  AdminOrderRejectionResult,
} from '@forerun/shared-types';
import { PrismaService } from '../../../database/prisma.service.js';
import { AuditService } from '../../audit/audit.service.js';
import { NotificationsService } from '../../notifications/notifications.service.js';
import { PricingService, type FeeResult } from '../../pricing/pricing.service.js';
import { OrderStateMachine } from '../../../state-machine/order-state-machine.js';
import { RunnerStateMachine } from '../../../state-machine/runner-state-machine.js';
import type { Prisma } from '@prisma/client';

@Injectable()
export class AdminOrderCommandService {
  private readonly logger = new Logger(AdminOrderCommandService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly pricingService: PricingService,
    private readonly orderStateMachine: OrderStateMachine,
    private readonly runnerStateMachine: RunnerStateMachine,
  ) {}

  /**
   * Validates order existence and loads relations required for approval.
   */
  private async validateApprovalPreconditions(
    tx: Prisma.TransactionClient,
    orderId: string,
  ) {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        preferredRunner: true,
        customer: true,
        orderStores: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  /**
   * Resolves the target status based on preferred runner settings and availability.
   */
  private resolveTargetStatus(order: {
    preferredRunnerId: string | null;
    waitForPreferred: boolean;
    preferredRunner?: { status: string } | null;
  }): OrderStatus {
    return order.preferredRunnerId &&
      order.waitForPreferred &&
      order.preferredRunner?.status !== 'AVAILABLE'
      ? 'AWAITING_PREFERRED_RUNNER'
      : 'AWAITING_RUNNER';
  }

  /**
   * Executes status transitions to move order from PENDING_REVIEW / UNDER_REVIEW to targetStatus.
   */
  private async transitionApprovalStatus(
    tx: Prisma.TransactionClient,
    order: {
      id: string;
      orderNumber: string | null;
      status: string;
    },
    adminId: string,
    targetStatus: OrderStatus,
    notes?: string | null,
  ): Promise<void> {
    if (order.status === 'PENDING_REVIEW') {
      this.orderStateMachine.transition(
        'PENDING_REVIEW',
        'UNDER_REVIEW',
        'ADMIN',
      );

      await this.auditService.log(
        {
          orderId: order.id,
          actorId: adminId,
          actorRole: 'ADMIN',
          event: 'ORDER_REVIEW_STARTED',
          fromStatus: 'PENDING_REVIEW',
          toStatus: 'UNDER_REVIEW',
          meta: {
            orderNumber: order.orderNumber,
            notes: notes ?? null,
          },
        },
        tx,
      );

      this.orderStateMachine.transition(
        'UNDER_REVIEW',
        targetStatus,
        'ADMIN',
      );
    } else if (order.status === 'UNDER_REVIEW') {
      this.orderStateMachine.transition(
        'UNDER_REVIEW',
        targetStatus,
        'ADMIN',
      );
    } else {
      this.orderStateMachine.transition(
        order.status as OrderStatus,
        targetStatus,
        'ADMIN',
      );
    }
  }

  /**
   * Calculates new fees based on peripheral flag and store count, and updates order.
   */
  private async applyPeripheralFeeIfNeeded(
    tx: Prisma.TransactionClient,
    order: {
      id: string;
      status: string;
      isPeripheral: boolean;
      baseFee: number;
      peripheralFee: number;
      extraStoresFee: number;
      totalFee: number;
      orderStores: unknown[];
    },
    targetStatus: OrderStatus,
    dto: ApproveOrderRequest,
  ): Promise<{
    updatedOrder: Prisma.OrderGetPayload<Record<string, never>>;
    feeChanged: boolean;
    oldFee: {
      baseFee: number;
      peripheralFee: number;
      extraStoresFee: number;
      totalFee: number;
    };
    newFee: FeeResult;
  }> {
    // TODO(6A-3.1b): replace with await pricingService.getPricingConfig(tx)
    const newFee = this.pricingService.calculateFee(
      {
        isPeripheral: dto.isPeripheral,
        purchasedStoreCount: order.orderStores.length,
      },
      DEFAULT_PRICING_CONFIG,
    );
    const oldFee = {
      baseFee: order.baseFee,
      peripheralFee: order.peripheralFee,
      extraStoresFee: order.extraStoresFee,
      totalFee: order.totalFee,
    };
    const feeChanged =
      order.isPeripheral !== dto.isPeripheral ||
      oldFee.baseFee !== newFee.baseFee ||
      oldFee.peripheralFee !== newFee.peripheralFee ||
      oldFee.extraStoresFee !== newFee.extraStoresFee ||
      oldFee.totalFee !== newFee.totalFee;

    const updated = await tx.order.updateMany({
      where: { id: order.id, status: order.status as OrderStatus },
      data: {
        isPeripheral: dto.isPeripheral,
        status: targetStatus,
        reviewedAt: new Date(),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(feeChanged
          ? {
              baseFee: newFee.baseFee,
              peripheralFee: newFee.peripheralFee,
              extraStoresFee: newFee.extraStoresFee,
              totalFee: newFee.totalFee,
            }
          : {}),
      },
    });
    if (updated.count === 0) {
      throw new ConflictException('ORDER_STATUS_CHANGED_CONCURRENTLY');
    }
    const updatedOrder = await tx.order.findUniqueOrThrow({
      where: { id: order.id },
    });

    return {
      updatedOrder,
      feeChanged,
      oldFee,
      newFee,
    };
  }

  /**
   * Records audit logs for approval, peripheral flag change, and fee updates.
   */
  private async recordApprovalAuditLog(
    tx: Prisma.TransactionClient,
    params: {
      orderId: string;
      orderNumber: string | null;
      adminId: string;
      targetStatus: OrderStatus;
      isPeripheral: boolean;
      notes?: string | null;
      feeChanged: boolean;
      oldFee: {
        baseFee: number;
        peripheralFee: number;
        extraStoresFee: number;
        totalFee: number;
      };
      newFee: FeeResult;
    },
  ): Promise<void> {
    const {
      orderId,
      orderNumber,
      adminId,
      targetStatus,
      isPeripheral,
      notes,
      feeChanged,
      oldFee,
      newFee,
    } = params;

    await this.auditService.log(
      {
        orderId,
        actorId: adminId,
        actorRole: 'ADMIN',
        event: 'ORDER_APPROVED',
        fromStatus: 'UNDER_REVIEW',
        toStatus: targetStatus,
        meta: {
          orderNumber,
          isPeripheral,
          notes: notes ?? null,
        },
      },
      tx,
    );

    if (isPeripheral) {
      await this.auditService.log(
        {
          orderId,
          actorId: adminId,
          actorRole: 'ADMIN',
          event: 'ORDER_PERIPHERAL_SET',
          fromStatus: 'UNDER_REVIEW',
          toStatus: targetStatus,
          meta: { orderNumber },
        },
        tx,
      );
    }

    if (feeChanged) {
      await this.auditService.log(
        {
          orderId,
          actorId: adminId,
          actorRole: 'ADMIN',
          event: 'ORDER_FEE_UPDATED',
          fromStatus: 'UNDER_REVIEW',
          toStatus: targetStatus,
          meta: {
            orderNumber,
            oldFee,
            newFee,
            reason: 'ADMIN_APPROVAL',
          },
        },
        tx,
      );
    }
  }

  /**
   * Sends notifications for status changes and fee updates to customer and admin.
   */
  private async sendApprovalNotifications(params: {
    customerUserId: string;
    order: {
      id: string;
      orderNumber: string | null;
      status: string;
    };
    oldStatus: string;
    feeChanged: boolean;
    oldFee: { totalFee: number };
    newFee: { totalFee: number };
  }): Promise<void> {
    const { customerUserId, order, oldStatus, feeChanged, oldFee, newFee } = params;
    try {
      await this.notificationsService.emitToCustomer(
        customerUserId,
        'order:status_changed',
        {
          orderId: order.id,
          orderNumber: order.orderNumber,
          newStatus: order.status,
          oldStatus,
        },
        'status_update',
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

      if (feeChanged) {
        const feePayload = {
          orderId: order.id,
          oldFee: oldFee.totalFee,
          newFee: newFee.totalFee,
          reason: 'ADMIN_APPROVAL',
        };

        await this.notificationsService.emitToCustomer(
          customerUserId,
          'order:fee_updated',
          feePayload,
          'status_update',
        );

        await this.notificationsService.emitToAdmin(
          'order:fee_updated',
          feePayload,
          'status_update',
        );
      }
    } catch (err) {
      this.logger.warn('[approveOrder] notifications failed silently', {
        error: err instanceof Error ? err.message : String(err),
        orderId: order.id,
      });
    }
  }

  async approveOrder(
    orderId: string,
    adminId: string,
    dto: ApproveOrderRequest,
  ): Promise<AdminOrderApprovalResult> {
    const result = await this.prisma.$transaction(
      async (tx) => {
        const order = await this.validateApprovalPreconditions(tx, orderId);

        const targetStatus = this.resolveTargetStatus(order);

        await this.transitionApprovalStatus(
          tx,
          order,
          adminId,
          targetStatus,
          dto.notes,
        );

        const { updatedOrder, feeChanged, oldFee, newFee } =
          await this.applyPeripheralFeeIfNeeded(
            tx,
            order,
            targetStatus,
            dto,
          );

        await this.recordApprovalAuditLog(tx, {
          orderId: order.id,
          orderNumber: order.orderNumber,
          adminId,
          targetStatus,
          isPeripheral: dto.isPeripheral,
          notes: dto.notes,
          feeChanged,
          oldFee,
          newFee,
        });

        return {
          order: updatedOrder,
          customerId: order.customerId,
          customerUserId: order.customer.userId,
          feeChanged,
          oldFee,
          newFee,
          oldStatus: order.status,
        };
      },
      { timeout: CONFIG.TRANSACTION_TIMEOUT_MS },
    );

    await this.sendApprovalNotifications({
      customerUserId: result.customerUserId,
      order: result.order,
      oldStatus: result.oldStatus,
      feeChanged: result.feeChanged,
      oldFee: result.oldFee,
      newFee: result.newFee,
    });

    return {
      order: {
        id: result.order.id,
        orderNumber: result.order.orderNumber!,
        status: result.order.status,
      },
      customerId: result.customerId,
      feeChanged: result.feeChanged,
      oldFee: result.oldFee,
      newFee: result.newFee,
    };
  }

  async rejectOrder(
    orderId: string,
    adminId: string,
    dto: RejectOrderRequest,
  ): Promise<AdminOrderRejectionResult> {
    const result = await this.prisma.$transaction(
      async (tx) => {
        const order = await tx.order.findUnique({
          where: { id: orderId },
          include: { customer: true },
        });

        if (!order) {
          throw new NotFoundException('Order not found');
        }

        const transitionResult = this.orderStateMachine.transition(
          order.status as OrderStatus,
          'CANCELLED',
          'ADMIN',
        );

        const updated = await tx.order.updateMany({
          where: { id: order.id, status: order.status },
          data: {
            status: transitionResult.to,
            cancelledByUserId: adminId,
            cancelledAt: new Date(),
            cancelReason: dto.cancelReason ?? null,
          },
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
            actorId: adminId,
            actorRole: 'ADMIN',
            event: 'ORDER_REJECTED',
            fromStatus: order.status,
            toStatus: 'CANCELLED',
            meta: {
              orderNumber: order.orderNumber,
              cancelReason: dto.cancelReason ?? null,
            },
          },
          tx,
        );

        return {
          order: updatedOrder,
          customerId: order.customerId,
          customerUserId: order.customer.userId,
        };
      },
      { timeout: CONFIG.TRANSACTION_TIMEOUT_MS },
    );

    try {
      await this.notificationsService.emitToCustomer(
        result.customerUserId,
        'order:cancelled',
        {
          orderId: result.order.id,
          reason: dto.cancelReason ?? 'Order rejected by admin',
          cancelledBy: adminId,
        },
        'status_update',
      );

      await this.notificationsService.emitToAdmin('order:status_changed', {
        orderId: result.order.id,
        orderNumber: result.order.orderNumber,
        newStatus: result.order.status,
      }, 'status_update');
    } catch (err) {
      this.logger.warn('[rejectOrder] notifications failed silently', {
        error: err instanceof Error ? err.message : String(err),
        orderId: result.order.id,
      });
    }

    return {
      order: {
        id: result.order.id,
        orderNumber: result.order.orderNumber!,
        status: result.order.status,
        cancelledAt: result.order.cancelledAt,
      },
      customerId: result.customerId,
    };
  }

  async startOrderReview(
    orderId: string,
    adminId: string,
    dto: StartOrderReviewRequest,
  ): Promise<{ order: { id: string; orderNumber: string; status: string } }> {
    const result = await this.prisma.$transaction(
      async (tx) => {
        const order = await tx.order.findUnique({
          where: { id: orderId },
          include: { customer: true },
        });

        if (!order) {
          throw new NotFoundException('Order not found');
        }

        const transitionResult = this.orderStateMachine.transition(
          order.status as OrderStatus,
          'UNDER_REVIEW',
          'ADMIN',
        );

        const updated = await tx.order.updateMany({
          where: { id: order.id, status: order.status },
          data: {
            status: transitionResult.to,
            reviewedAt: new Date(),
          },
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
            actorId: adminId,
            actorRole: 'ADMIN',
            event: 'ORDER_REVIEW_STARTED',
            fromStatus: order.status,
            toStatus: transitionResult.to,
            meta: {
              orderNumber: order.orderNumber,
              notes: dto.notes ?? null,
            },
          },
          tx,
        );

        return { order: updatedOrder, customerId: order.customerId, customerUserId: order.customer.userId, oldStatus: order.status };
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
          newStatus: result.order.status,
          oldStatus: result.oldStatus,
        },
        'status_update',
      );

      await this.notificationsService.emitToAdmin('order:status_changed', {
        orderId: result.order.id,
        orderNumber: result.order.orderNumber,
        newStatus: result.order.status,
      }, 'status_update');
    } catch (err) {
      this.logger.warn('[startOrderReview] notifications failed silently', {
        error: err instanceof Error ? err.message : String(err),
        orderId: result.order.id,
      });
    }

    return {
      order: {
        id: result.order.id,
        orderNumber: result.order.orderNumber!,
        status: result.order.status,
      },
    };
  }

  /**
   * Validates runner availability, verified status, and ensures no active orders exist.
   */
  private async validateRunnerAvailability(
    tx: Prisma.TransactionClient,
    runnerId: string,
  ) {
    const runner = await tx.runner.findUnique({
      where: { id: runnerId },
      include: { user: true },
    });

    if (
      !runner ||
      runner.status !== 'AVAILABLE' ||
      runner.user?.status !== 'VERIFIED'
    ) {
      throw new UnprocessableEntityException(
        'Runner not available or not verified',
      );
    }

    // F2: منع الإسناد لمندوب لديه طلب نشط (BUG-017)
    const activeOrdersCount = await tx.order.count({
      where: {
        runnerId,
        status: {
          in: [
            'ASSIGNED',
            'IN_PROGRESS',
            'OUT_FOR_DELIVERY',
            'AWAITING_PREFERRED_RUNNER',
          ],
        },
      },
    });

    if (activeOrdersCount > 0) {
      throw new ConflictException(
        'لا يمكن إسناد الطلب للمندوب لوجود طلب نشط قيد التنفيذ لديه مسبقًا',
      );
    }

    return runner;
  }

  /**
   * Transitions runner status to ON_MISSION, updates DB record, and logs audit entry.
   */
  private async transitionRunnerToOnMission(
    tx: Prisma.TransactionClient,
    runner: Prisma.RunnerGetPayload<{ include: { user: true } }>,
    adminId: string,
    orderId: string,
  ): Promise<void> {
    this.runnerStateMachine.transition(
      runner.status,
      'ON_MISSION',
      'SYSTEM',
    );

    const updated = await tx.runner.updateMany({
      where: { id: runner.id, status: runner.status },
      data: { status: 'ON_MISSION' },
    });
    if (updated.count === 0) {
      throw new UnprocessableEntityException('RUNNER_NOT_AVAILABLE');
    }

    // F3: تسجيل RUNNER_STATUS_CHANGED عند الإسناد (BUG-018)
    await this.auditService.log(
      {
        actorId: adminId,
        actorRole: 'ADMIN',
        event: 'RUNNER_STATUS_CHANGED',
        fromStatus: runner.status,
        toStatus: 'ON_MISSION',
        meta: {
          runnerId: runner.id,
          orderId,
        },
      },
      tx,
    );
  }

  /**
   * Transitions order to ASSIGNED and updates runnerId and assignedAt timestamp.
   */
  private async transitionOrderToAssigned(
    tx: Prisma.TransactionClient,
    order: { id: string; status: OrderStatus },
    runnerId: string,
  ) {
    const transitionResult = this.orderStateMachine.transition(
      order.status,
      'ASSIGNED',
      'ADMIN',
    );

    const updatedOrder = await tx.order.updateMany({
      where: { id: order.id, status: order.status },
      data: {
        status: transitionResult.to,
        runnerId,
        assignedAt: new Date(),
      },
    });
    if (updatedOrder.count === 0) {
      throw new ConflictException('ORDER_STATUS_CHANGED_CONCURRENTLY');
    }

    const orderRecord = await tx.order.findUniqueOrThrow({
      where: { id: order.id },
      include: {
        customer: {
          include: { user: true },
        },
        items: {
          orderBy: { createdAt: 'asc' },
        },
        orderStores: true,
      },
    });

    return {
      transitionResult,
      orderRecord,
    };
  }

  /**
   * Logs RUNNER_ASSIGNED audit event.
   */
  private async recordAssignmentAuditLog(
    tx: Prisma.TransactionClient,
    params: {
      orderId: string;
      orderNumber: string | null;
      fromStatus: string;
      toStatus: OrderStatus;
      adminId: string;
      runnerId: string;
      previousRunnerId: string | null;
    },
  ): Promise<void> {
    const {
      orderId,
      orderNumber,
      fromStatus,
      toStatus,
      adminId,
      runnerId,
      previousRunnerId,
    } = params;

    await this.auditService.log(
      {
        orderId,
        actorId: adminId,
        actorRole: 'ADMIN',
        event: 'RUNNER_ASSIGNED',
        fromStatus,
        toStatus,
        meta: {
          orderNumber,
          runnerId,
          previousRunnerId,
        },
      },
      tx,
    );
  }

  /**
   * Emits notifications to old runner (if reassigned), new runner, customer, and admin.
   */
  private async sendAssignmentNotifications(params: {
    order: Prisma.OrderGetPayload<{
      include: {
        customer: { include: { user: true } };
        items: true;
        orderStores: true;
      };
    }>;
    oldRunnerUserId: string | null;
    runnerUserId: string;
    runnerName: string;
  }): Promise<void> {
    const { order, oldRunnerUserId, runnerUserId, runnerName } = params;

    try {
      const assignedPayload = {
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customer?.user?.name ?? '',
        deliveryAddress: {
          lat: order.deliveryLat,
          lng: order.deliveryLng,
          description: order.deliveryDesc,
        },
        items: order.items.map((item) => ({
          itemName: item.itemName,
          quantity: item.quantity,
          customStoreName: item.customStoreName,
          anyStore: item.anyStore,
        })),
        estimatedFee: {
          baseFee: order.baseFee,
          peripheralFee: order.peripheralFee,
          extraStoresFee: order.extraStoresFee,
          totalFee: order.totalFee,
          note: 'الرسم النهائي يُحدد بعد المراجعة',
        },
      };

      if (oldRunnerUserId) {
        await this.notificationsService.emitToRunner(
          oldRunnerUserId,
          'order:reassigned',
          { orderId: order.id },
          'status_update',
        );
      }

      await this.notificationsService.emitToRunner(
        runnerUserId,
        'order:assigned',
        assignedPayload,
        'new_order',
      );

      await this.notificationsService.emitToCustomer(
        order.customer.userId,
        'order:runner_assigned',
        {
          orderId: order.id,
          runnerName,
        },
        'status_update',
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
    } catch (err) {
      this.logger.warn('[assignRunner] notifications failed silently', {
        error: err instanceof Error ? err.message : String(err),
        orderId: order.id,
      });
    }
  }

  async assignRunner(
    orderId: string,
    adminId: string,
    runnerId: string,
  ): Promise<{ order: { id: string; orderNumber: string; status: string } }> {
    const result = await this.prisma.$transaction(
      async (tx) => {
        const order = await tx.order.findUnique({
          where: { id: orderId },
          include: { runner: true, customer: true },
        });

        if (!order) {
          throw new NotFoundException('Order not found');
        }

        const runner = await this.validateRunnerAvailability(tx, runnerId);

        await this.transitionRunnerToOnMission(
          tx,
          runner,
          adminId,
          order.id,
        );

        const { transitionResult, orderRecord } =
          await this.transitionOrderToAssigned(
            tx,
            order,
            runnerId,
          );

        await this.recordAssignmentAuditLog(tx, {
          orderId: order.id,
          orderNumber: order.orderNumber,
          fromStatus: order.status,
          toStatus: transitionResult.to,
          adminId,
          runnerId,
          previousRunnerId: order.runnerId,
        });

        return {
          order: orderRecord,
          oldStatus: order.status,
          oldRunnerUserId: order.runner?.userId ?? null,
          runnerUserId: runner.user.id,
          runnerName: runner.user.name,
        };
      },
      { timeout: CONFIG.TRANSACTION_TIMEOUT_MS },
    );

    await this.sendAssignmentNotifications({
      order: result.order,
      oldRunnerUserId: result.oldRunnerUserId,
      runnerUserId: result.runnerUserId,
      runnerName: result.runnerName,
    });

    return {
      order: {
        id: result.order.id,
        orderNumber: result.order.orderNumber!,
        status: result.order.status,
      },
    };
  }

  async cancelOrderAdmin(
    orderId: string,
    adminId: string,
    cancelReason?: string,
  ): Promise<{
    order: { id: string; orderNumber: string; status: string };
    cancelledAt: Date | null;
  }> {
    const result = await this.prisma.$transaction(
      async (tx) => {
        const order = await tx.order.findUnique({
          where: { id: orderId },
          include: { runner: true, customer: true },
        });

        if (!order) {
          throw new NotFoundException('Order not found');
        }

        const transitionResult = this.orderStateMachine.transition(
          order.status as OrderStatus,
          'CANCELLED',
          'ADMIN',
        );

        const updated = await tx.order.updateMany({
          where: { id: order.id, status: order.status },
          data: {
            status: transitionResult.to,
            cancelledByUserId: adminId,
            cancelledAt: new Date(),
            cancelReason: cancelReason ?? null,
          },
        });
        if (updated.count === 0) {
          throw new ConflictException('ORDER_STATUS_CHANGED_CONCURRENTLY');
        }
        const updatedOrder = await tx.order.findUniqueOrThrow({
          where: { id: order.id },
        });

        if (order.runnerId) {
          if (!order.runner) {
            throw new NotFoundException('Runner not found');
          }
          this.runnerStateMachine.transition(
            order.runner.status,
            'AVAILABLE',
            'SYSTEM',
          );
          const runnerUpdated = await tx.runner.updateMany({
            where: { id: order.runnerId, status: order.runner.status },
            data: { status: 'AVAILABLE' },
          });
          if (runnerUpdated.count === 0) {
            throw new ConflictException('CONCURRENT_RUNNER_STATE_CHANGE');
          }
        }

        await this.auditService.log(
          {
            orderId: order.id,
            actorId: adminId,
            actorRole: 'ADMIN',
            event: 'ORDER_CANCELLED',
            fromStatus: order.status,
            toStatus: 'CANCELLED',
            meta: {
              orderNumber: order.orderNumber,
              cancelReason: cancelReason ?? null,
              runnerId: order.runnerId,
            },
          },
          tx,
        );

        return {
          order: updatedOrder,
          oldRunnerUserId: order.runner?.userId ?? null,
          customerId: order.customerId,
          customerUserId: order.customer.userId,
        };
      },
      { timeout: CONFIG.TRANSACTION_TIMEOUT_MS },
    );

    try {
      if (result.oldRunnerUserId) {
        await this.notificationsService.emitToRunner(
          result.oldRunnerUserId,
          'order:assignment_cancelled',
          {
            orderId: result.order.id,
            reason: cancelReason ?? 'تم إلغاء الطلب من قبل الإدارة',
          },
          'status_update',
        );
      }

      await this.notificationsService.emitToCustomer(
        result.customerUserId,
        'order:cancelled',
        {
          orderId: result.order.id,
          reason: cancelReason ?? 'تم إلغاء الطلب من قبل الإدارة',
          cancelledBy: adminId,
        },
        'status_update',
      );

      await this.notificationsService.emitToAdmin('order:status_changed', {
        orderId: result.order.id,
        orderNumber: result.order.orderNumber,
        newStatus: result.order.status,
      }, 'status_update');
    } catch (err) {
      this.logger.warn('[cancelOrderAdmin] notifications failed silently', {
        error: err instanceof Error ? err.message : String(err),
        orderId: result.order.id,
      });
    }

    return {
      order: {
        id: result.order.id,
        orderNumber: result.order.orderNumber!,
        status: result.order.status,
      },
      cancelledAt: result.order.cancelledAt,
    };
  }

  /**
   * Scans for orders stuck in awaiting runner state for more than thresholdMinutes (default: 10m)
   * and notifies admins with an urgent alert.
   */
  @Cron('*/5 * * * *')
  async checkStaleOrders(thresholdMinutes = 10): Promise<{ notifiedCount: number }> {
    const thresholdDate = new Date(Date.now() - thresholdMinutes * 60 * 1000);
    const staleOrders = await this.prisma.order.findMany({
      where: {
        status: {
          in: ['AWAITING_RUNNER', 'AWAITING_PREFERRED_RUNNER'],
        },
        updatedAt: {
          lte: thresholdDate,
        },
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        updatedAt: true,
      },
    });

    for (const order of staleOrders) {
      this.logger.warn(
        `Order ${order.orderNumber || order.id} has been in ${order.status} for >${thresholdMinutes} minutes`,
      );
      await this.notificationsService.emitToAdmin(
        'order:needs_attention',
        {
          orderId: order.id,
          reason: `الطلب ${order.orderNumber || order.id} بانتظار مندوب منذ أكثر من ${thresholdMinutes} دقائق (${order.status})`,
        },
        'urgent',
      );
    }

    return { notifiedCount: staleOrders.length };
  }
}