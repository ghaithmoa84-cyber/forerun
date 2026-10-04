import {
  Injectable,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PRICING } from '@forerun/shared-constants';
import { PrismaService } from '../../database/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';

export interface FeeResult {
  baseFee: number;
  peripheralFee: number;
  extraStoresFee: number;
  totalFee: number;
  runnerShare: number;
  platformShare: number;
}

export interface RecalculateFeeResult {
  feeChanged: boolean;
  oldFee: {
    baseFee: number;
    peripheralFee: number;
    extraStoresFee: number;
    totalFee: number;
  } | null;
  newFee: FeeResult;
  notificationPayload: {
    customerId: string;
    orderId: string;
    orderNumber: string | null;
    oldFee: {
      baseFee: number;
      peripheralFee: number;
      extraStoresFee: number;
      totalFee: number;
    } | null;
    newFee: FeeResult;
    reason: string;
  } | null;
}

@Injectable()
export class PricingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  calculateFee(params: {
    isPeripheral: boolean;
    purchasedStoreCount: number;
  }): FeeResult {
    if (
      !Number.isInteger(params.purchasedStoreCount) ||
      params.purchasedStoreCount < 0
    ) {
      throw new BadRequestException(
        'purchasedStoreCount must be a non-negative integer',
      );
    }

    const baseFee = PRICING.BASE_FEE;
    const peripheralFee = params.isPeripheral
      ? PRICING.PERIPHERAL_FEE
      : 0;
    const extraStoresFee =
      Math.max(0, params.purchasedStoreCount - 1) * PRICING.EXTRA_STORE_FEE;
    const totalFee = baseFee + peripheralFee + extraStoresFee;

    return {
      baseFee,
      peripheralFee,
      extraStoresFee,
      totalFee,
      runnerShare: Math.floor(totalFee * PRICING.RUNNER_SHARE),
      platformShare: Math.ceil(totalFee * PRICING.PLATFORM_SHARE),
    };
  }

  async recalculateFee(
    orderId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<RecalculateFeeResult> {
    const client = tx ?? this.prisma;

    const order = await client.order.findUnique({
      where: { id: orderId },
      include: {
        orderStores: {
          where: { status: 'PURCHASED' },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status === 'DELIVERED') {
      throw new ForbiddenException(
        'Cannot recalculate fee for a delivered order',
      );
    }

    const purchasedStoreCount = order.orderStores.length;
    const newFee = this.calculateFee({
      isPeripheral: order.isPeripheral,
      purchasedStoreCount,
    });

    const oldFee = {
      baseFee: order.baseFee,
      peripheralFee: order.peripheralFee,
      extraStoresFee: order.extraStoresFee,
      totalFee: order.totalFee,
    };

    const feeChanged =
      oldFee.baseFee !== newFee.baseFee ||
      oldFee.peripheralFee !== newFee.peripheralFee ||
      oldFee.extraStoresFee !== newFee.extraStoresFee ||
      oldFee.totalFee !== newFee.totalFee;

    await client.order.update({
      where: { id: order.id },
      data: {
        baseFee: newFee.baseFee,
        peripheralFee: newFee.peripheralFee,
        extraStoresFee: newFee.extraStoresFee,
        totalFee: newFee.totalFee,
      },
    });

    if (feeChanged) {
      await this.auditService.log(
        {
          orderId: order.id,
          actorRole: 'SYSTEM',
          event: 'ORDER_FEE_UPDATED',
          fromStatus: order.status,
          toStatus: order.status,
          meta: {
            orderNumber: order.orderNumber,
            oldFee,
            newFee,
            purchasedStoreCount,
            reason: 'RECALCULATE_FEE',
          },
        },
        client,
      );
    }

    return {
      feeChanged,
      oldFee: feeChanged ? oldFee : null,
      newFee,
      notificationPayload: feeChanged
        ? {
            customerId: order.customerId,
            orderId: order.id,
            orderNumber: order.orderNumber,
            oldFee: feeChanged ? oldFee : null,
            newFee,
            reason: 'RECALCULATE_FEE',
          }
        : null,
    };
  }
}