import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { OrderStatus } from '@forerun/shared-constants';
import { CONFIG } from '@forerun/shared-constants';
import { CreateOrderRequest } from '@forerun/shared-types';
import type {
  CreateOrderResponse,
  CustomerOrderDetails,
  CustomerOrderListItem,
  CustomerOrdersQuery,
} from '@forerun/shared-types';
import { PrismaService } from '../../../database/prisma.service.js';
import { AuditService } from '../../audit/audit.service.js';
import { NotificationsService } from '../../notifications/notifications.service.js';
import { TelegramService } from '../../notifications/telegram.service.js';
import { PricingService, type FeeResult } from '../../pricing/pricing.service.js';
import { OrderStateMachine } from '../../../state-machine/order-state-machine.js';
import { RunnerStateMachine } from '../../../state-machine/runner-state-machine.js';
import { mapOrderItem } from './order-mapper.js';
import type { Prisma } from '@prisma/client';

@Injectable()
export class CustomerOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly telegramService: TelegramService,
    private readonly pricingService: PricingService,
    private readonly orderStateMachine: OrderStateMachine,
    private readonly runnerStateMachine: RunnerStateMachine,
  ) {}

  private readonly logger = new Logger(CustomerOrdersService.name);

  /**
   * Validates customer existence and ensures non-anyStore items provide customStoreName.
   */
  private async validateOrderPreconditions(
    userId: string,
    items: CreateOrderRequest['items'],
  ) {
    const customer = await this.prisma.customer.findUnique({
      where: { userId },
      include: { user: { select: { name: true } } },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    for (const item of items) {
      const key = item.anyStore
        ? '__any_store__'
        : (item.customStoreName ?? '').trim();
      if (!key) {
        throw new BadRequestException(
          'Item customStoreName is required when anyStore is false',
        );
      }
    }

    return customer;
  }

  /**
   * Groups order items by store and constructs the structured store dataset.
   */
  private buildOrderStoresData(items: CreateOrderRequest['items']): Array<{
    storeName: string;
    isAnyStore: boolean;
    items: Array<{
      itemName: string;
      quantity: string;
      customStoreName?: string | null;
      anyStore: boolean;
    }>;
  }> {
    const storeGroups = new Map<string, typeof items>();

    for (const item of items) {
      const key = item.anyStore
        ? '__any_store__'
        : (item.customStoreName ?? '').trim();
      const group = storeGroups.get(key);
      if (group) {
        group.push(item);
      } else {
        storeGroups.set(key, [item]);
      }
    }

    return Array.from(storeGroups.entries()).map(([storeName, storeItems]) => ({
      storeName: storeName === '__any_store__' ? 'أي متجر' : storeName,
      isAnyStore: storeName === '__any_store__',
      items: storeItems.map((item) => ({
        itemName: item.itemName,
        quantity: item.quantity,
        customStoreName: item.customStoreName,
        anyStore: item.anyStore,
      })),
    }));
  }

  /**
   * Calculates estimated fee for a new order based on store count.
   */
  private calculateOrderFee(storeCount: number): FeeResult {
    return this.pricingService.calculateFee({
      isPeripheral: false,
      purchasedStoreCount: storeCount,
    });
  }

  /**
   * Creates the order, orderStores, and orderItems within a transaction and logs audit entries.
   */
  private async createOrderRecord(
    tx: Prisma.TransactionClient,
    params: {
      customerId: string;
      userId: string;
      dto: CreateOrderRequest;
      fee: FeeResult;
      orderStoresData: Array<{
        storeName: string;
        isAnyStore: boolean;
        items: Array<{
          itemName: string;
          quantity: string;
          customStoreName?: string | null;
          anyStore: boolean;
        }>;
      }>;
    },
  ) {
    const { customerId, userId, dto, fee, orderStoresData } = params;

    if (dto.preferredRunnerId) {
      const preferredRunner = await tx.runner.findUnique({
        where: { id: dto.preferredRunnerId },
        include: { user: true },
      });
      if (!preferredRunner) {
        throw new NotFoundException('Preferred runner not found');
      }
      const isPreferredRunnerActive =
        String(preferredRunner.status) !== 'SUSPENDED' &&
        preferredRunner.user.status === 'VERIFIED';
      if (!isPreferredRunnerActive) {
        throw new UnprocessableEntityException(
          'PREFERRED_RUNNER_NOT_AVAILABLE',
        );
      }
    }

    const order = await tx.order.create({
      data: {
        customerId,
        deliveryLat: dto.deliveryAddress.lat,
        deliveryLng: dto.deliveryAddress.lng,
        deliveryDesc: dto.deliveryAddress.description,
        notes: dto.notes,
        preferredRunnerId: dto.preferredRunnerId,
        waitForPreferred: dto.waitForPreferred,
        baseFee: fee.baseFee,
        peripheralFee: fee.peripheralFee,
        extraStoresFee: fee.extraStoresFee,
        totalFee: fee.totalFee,
      },
    });

    const transitionResult = this.orderStateMachine.transition(
      'DRAFT',
      'PENDING_REVIEW',
      'CUSTOMER',
    );

    const updated = await tx.order.updateMany({
      where: { id: order.id, status: order.status },
      data: {
        orderNumber: `${CONFIG.ORDER_NUMBER_PREFIX}-${String(
          order.seqNumber,
        ).padStart(CONFIG.ORDER_NUMBER_PAD_LENGTH, '0')}`,
        status: transitionResult.to,
      },
    });
    if (updated.count === 0) {
      throw new ConflictException('ORDER_STATUS_CHANGED_CONCURRENTLY');
    }
    const updatedOrder = await tx.order.findUniqueOrThrow({
      where: { id: order.id },
    });

    const allItems: Array<{
      orderId: string;
      orderStoreId: string;
      itemName: string;
      quantity: string;
      customStoreName: string | null;
      anyStore: boolean;
    }> = [];

    for (const store of orderStoresData) {
      const orderStore = await tx.orderStore.create({
        data: {
          orderId: updatedOrder.id,
          storeName: store.storeName,
          isAnyStore: store.isAnyStore,
          status: 'PENDING',
          addedBy: 'CUSTOMER',
        },
      });

      for (const item of store.items) {
        allItems.push({
          orderId: updatedOrder.id,
          orderStoreId: orderStore.id,
          itemName: item.itemName,
          quantity: item.quantity,
          customStoreName: item.customStoreName ?? null,
          anyStore: item.anyStore,
        });
      }
    }

    await tx.orderItem.createMany({ data: allItems });

    await this.auditService.log(
      {
        orderId: updatedOrder.id,
        actorId: userId,
        actorRole: 'CUSTOMER',
        event: 'ORDER_CREATED',
        fromStatus: 'DRAFT',
        toStatus: 'PENDING_REVIEW',
        meta: { orderNumber: updatedOrder.orderNumber },
      },
      tx,
    );

    await this.auditService.log(
      {
        orderId: updatedOrder.id,
        actorId: userId,
        actorRole: 'CUSTOMER',
        event: 'ORDER_SUBMITTED',
        fromStatus: 'PENDING_REVIEW',
        toStatus: 'PENDING_REVIEW',
        meta: { orderNumber: updatedOrder.orderNumber },
      },
      tx,
    );

    return updatedOrder;
  }

  /**
   * Emits WebSocket event to admin and posts order summary to Telegram channel.
   */
  private async sendOrderCreationNotifications(params: {
    order: { id: string; orderNumber: string | null; totalFee: number };
    customerName: string;
    itemCount: number;
  }): Promise<void> {
    const { order, customerName, itemCount } = params;

    try {
      await this.notificationsService.emitToAdmin(
        'order:new',
        {
          orderId: order.id,
          orderNumber: order.orderNumber,
          customerName,
          itemCount,
        },
        'new_order',
      );
    } catch (error) {
      this.logger.warn('Notification emit failed', {
        error,
        orderId: order.id,
      });
    }

    try {
      const fullOrder = await this.prisma.order.findUnique({
        where: { id: order.id },
        include: {
          orderStores: { where: { isDeleted: false } },
          customer: { include: { user: true } },
        },
      });

      const storeNames =
        fullOrder?.orderStores
          ?.map((os) => os.storeName)
          .filter(Boolean)
          .join('، ') || 'غير محدد';

      const storesLine =
        (fullOrder?.orderStores?.length ?? 0) > 1
          ? `المتاجر (${fullOrder?.orderStores.length}): ${storeNames}`
          : `المتجر: ${storeNames}`;

      await this.telegramService.sendMessage(
        `🛍️ <b>طلب جديد</b>\n` +
          `رقم الطلب: <b>#${order.orderNumber}</b>\n` +
          `العميل: ${fullOrder?.customer?.user?.name ?? customerName ?? 'غير محدد'}\n` +
          `${storesLine}\n` +
          `الإجمالي: ${order.totalFee} ل.س`
      );
    } catch (error) {
      this.logger.warn('Telegram notification failed', {
        error,
        orderId: order.id,
      });
    }
  }

  async createOrder(
    userId: string,
    dto: CreateOrderRequest,
  ): Promise<CreateOrderResponse> {
    const customer = await this.validateOrderPreconditions(userId, dto.items);

    const orderStoresData = this.buildOrderStoresData(dto.items);

    const fee = this.calculateOrderFee(orderStoresData.length);

    const order = await this.prisma.$transaction(
      async (tx) => {
        return this.createOrderRecord(tx, {
          customerId: customer.id,
          userId,
          dto,
          fee,
          orderStoresData,
        });
      },
      { timeout: CONFIG.TRANSACTION_TIMEOUT_MS },
    );

    await this.sendOrderCreationNotifications({
      order,
      customerName: customer.user?.name ?? '',
      itemCount: dto.items.length,
    });

    return {
      id: order.id,
      orderNumber: order.orderNumber!,
      status: order.status,
      estimatedFee: {
        baseFee: fee.baseFee,
        peripheralFee: fee.peripheralFee,
        extraStoresFee: fee.extraStoresFee,
        totalFee: fee.totalFee,
        note: 'الرسم النهائي يُحدد بعد المراجعة',
      },
    };
  }

  async listCustomerOrders(
    userId: string,
    page: number,
    limit: number,
    status?: CustomerOrdersQuery['status'],
  ): Promise<{
    data: CustomerOrderListItem[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const customer = await this.prisma.customer.findUnique({
      where: { userId },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const where = {
      customerId: customer.id,
      ...(status ? { status } : {}),
    };

    const [total, orders] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { items: true },
          },
          ratings: {
            where: { customerId: customer.id },
            select: { id: true, expiresAt: true, isFinal: true },
          },
          runner: {
            include: {
              user: {
                select: { id: true, name: true, whatsapp: true, altPhone: true },
              },
            },
          },
        },
      }),
    ]);

    return {
      data: orders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber!,
        status: order.status,
        totalFee: order.totalFee,
        itemCount: order._count.items,
        createdAt: order.createdAt,
        deliveredAt: order.deliveredAt,
        hasRating: order.ratings.length > 0,
        canRate:
          order.status === 'DELIVERED' &&
          order.ratings.length === 0 &&
          order.deliveredAt != null &&
          new Date(order.deliveredAt.getTime() + CONFIG.RATING_EDIT_WINDOW_MS) >
            new Date(),
        runner: order.runner
          ? {
              id: order.runner.id,
              name: order.runner.user.name,
              whatsapp: order.runner.user.whatsapp,
              phone: order.runner.user.altPhone || order.runner.user.whatsapp,
            }
          : null,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getOrderDetails(
    orderId: string,
    userId: string,
  ): Promise<CustomerOrderDetails> {
    const customer = await this.prisma.customer.findUnique({
      where: { userId },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        customerId: customer.id,
      },
      include: {
        items: {
          orderBy: { createdAt: 'asc' },
        },
        orderStores: {
          where: { isDeleted: false },
          orderBy: { createdAt: 'asc' },
          include: {
            items: {
              orderBy: { createdAt: 'asc' },
            },
            receipts: {
              where: { isDeleted: false },
              orderBy: { uploadedAt: 'asc' },
            },
          },
        },
        runner: {
          include: {
            user: { select: { name: true, whatsapp: true, altPhone: true } },
          },
        },
        ratings: {
          where: { customerId: customer.id },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return {
      id: order.id,
      orderNumber: order.orderNumber!,
      status: order.status,
      isPeripheral: order.isPeripheral,
      baseFee: order.baseFee,
      peripheralFee: order.peripheralFee,
      extraStoresFee: order.extraStoresFee,
      totalFee: order.totalFee,
      pricing: {
        baseFee: order.baseFee,
        peripheralFee: order.peripheralFee,
        extraStoresFee: order.extraStoresFee,
        totalFee: order.totalFee,
      },
      deliveryLat: order.deliveryLat,
      deliveryLng: order.deliveryLng,
      deliveryDesc: order.deliveryDesc,
      notes: order.notes,
      preferredRunnerId: order.preferredRunnerId,
      waitForPreferred: order.waitForPreferred,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      deliveredAt: order.deliveredAt,
      cancelledAt: order.cancelledAt,
      cancelReason: order.cancelReason,
      items: order.items.map((item) => mapOrderItem(item)),
      orderStores: order.orderStores.map((store) => ({
        id: store.id,
        storeName: store.storeName,
        isAnyStore: store.isAnyStore,
        status: store.status,
        isExtra: store.isExtra,
        addedBy: store.addedBy,
        purchasedAt: store.purchasedAt,
        createdAt: store.createdAt,
        updatedAt: store.updatedAt,
        items: store.items.map((item) => mapOrderItem(item)),
      })),
      stores: order.orderStores.map((store) => ({
        id: store.id,
        storeName: store.storeName,
        status: store.status,
        isExtra: store.isExtra,
        items: store.items.map((item) => ({
          id: item.id,
          itemName: item.itemName,
          quantity: item.quantity,
        })),
        receipts: store.receipts.map((receipt) => ({
          id: receipt.id,
          imageUrl: receipt.imageUrl,
        })),
      })),
      rating:
        order.ratings.length > 0
          ? { stars: order.ratings[0].stars }
          : null,
      timeline: {
        createdAt: order.createdAt,
        reviewedAt: order.reviewedAt,
        assignedAt: order.assignedAt,
        startedAt: order.startedAt,
        deliveredAt: order.deliveredAt,
        cancelledAt: order.cancelledAt,
      },
      runner: order.runner
        ? {
            id: order.runner.id,
            name: order.runner.user.name,
            avgRating: order.runner.avgRating,
            totalRatings: order.runner.totalRatings,
            status: order.runner.status,
            whatsapp: order.runner.user.whatsapp,
            phone: order.runner.user.altPhone || order.runner.user.whatsapp,
          }
        : null,
    };
  }

  async cancelOrder(orderId: string, userId: string) {
    const result = await this.prisma.$transaction(
      async (tx) => {
        const order = await tx.order.findUnique({
          where: { id: orderId },
          include: { runner: true, customer: true },
        });

        const customer = await tx.customer.findUnique({
          where: { userId },
        });
        if (!customer) {
          throw new NotFoundException('Customer not found');
        }
        if (!order || order.customerId !== customer.id) {
          throw new NotFoundException('Order not found');
        }

        const transitionResult = this.orderStateMachine.transition(
          order.status as OrderStatus,
          'CANCELLED',
          'CUSTOMER',
        );

        const updated = await tx.order.updateMany({
          where: { id: order.id, status: order.status },
          data: {
            status: transitionResult.to,
            cancelledByUserId: userId,
            cancelledAt: new Date(),
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
            actorId: userId,
            actorRole: 'CUSTOMER',
            event: 'ORDER_CANCELLED',
            fromStatus: order.status,
            toStatus: 'CANCELLED',
            meta: {
              orderNumber: order.orderNumber,
              runnerId: order.runnerId,
            },
          },
          tx,
        );

        return {
          order: updatedOrder,
          oldRunnerUserId: order.runner?.userId ?? null,
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
            reason: 'تم إلغاء الطلب من قبل الزبون',
          },
          'status_update',
        );
      }

      await this.notificationsService.emitToCustomer(
        result.customerUserId,
        'order:cancelled',
        {
          orderId: result.order.id,
          reason: 'تم إلغاء الطلب من قبل الزبون',
          cancelledBy: userId,
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
      id: result.order.id,
      orderNumber: result.order.orderNumber!,
      status: result.order.status,
      cancelledAt: result.order.cancelledAt,
    };
  }
}
