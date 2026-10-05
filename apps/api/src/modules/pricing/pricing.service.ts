import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { DEFAULT_PRICING_CONFIG } from '@forerun/shared-constants';
import type { PricingConfig } from '@forerun/shared-types';
import { splitShares } from './split-shares.js';
import { PrismaService } from '../../database/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';

export interface FeeResult {
  baseFee: number;
  peripheralFee: number;
  extraStoresFee: number;
  customFee?: number;
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
    customFee?: number;
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
      customFee?: number;
      totalFee: number;
    } | null;
    newFee: FeeResult;
    reason: string;
  } | null;
}

@Injectable()
export class PricingService {
  private readonly logger = new Logger(PricingService.name);

  // In-memory cache for pricing config with 30s TTL
  private cachedConfig: { config: PricingConfig; expiresAt: number } | null = null;
  private cacheTtlMs = 30_000;
  private cacheEnabled = true;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Helper methods for controlling the cache during testing
   */
  disableCacheForTesting(): void {
    this.cacheEnabled = false;
    this.cachedConfig = null;
  }

  enableCacheForTesting(ttlMs: number = 30_000): void {
    this.cacheEnabled = true;
    this.cacheTtlMs = ttlMs;
    this.cachedConfig = null;
  }

  clearCacheForTesting(): void {
    this.cachedConfig = null;
  }


  calculateFee(
    params: {
      isPeripheral: boolean;
      purchasedStoreCount: number;
      customFee?: number;
    },
    config: PricingConfig,
  ): FeeResult {
    if (
      !Number.isInteger(params.purchasedStoreCount) ||
      params.purchasedStoreCount < 0
    ) {
      throw new BadRequestException(
        'purchasedStoreCount must be a non-negative integer',
      );
    }

    const customFee = params.customFee ?? 0;
    if (!Number.isInteger(customFee) || customFee < 0) {
      throw new BadRequestException('customFee must be a non-negative integer');
    }

    const baseFee = config.baseFee;
    const peripheralFee = params.isPeripheral
      ? config.peripheralFee
      : 0;
    const extraStoresFee =
      Math.max(0, params.purchasedStoreCount - 1) * config.extraStoreFee;
    const totalFee = baseFee + peripheralFee + extraStoresFee + customFee;
    const { runnerShare, platformShare } = splitShares(totalFee);

    return {
      baseFee,
      peripheralFee,
      extraStoresFee,
      totalFee,
      runnerShare,
      platformShare,
      ...(params.customFee !== undefined ? { customFee: params.customFee } : {}),
    };
  }

  async getPricingConfig(
    tx?: Prisma.TransactionClient,
  ): Promise<PricingConfig> {
    const now = Date.now();
    // Cache hit: only when no transaction is provided and cache is enabled & unexpired
    if (!tx && this.cacheEnabled && this.cachedConfig && this.cachedConfig.expiresAt > now) {
      return this.cachedConfig.config;
    }

    try {
      const client = tx ?? this.prisma;
      const row = await client.platformPricing.findUnique({
        where: { id: 'default' },
      });

      if (!row) {
        this.logger.warn('PlatformPricing "default" row not found, using fallback config');
        return DEFAULT_PRICING_CONFIG;
      }

      if (
        !Number.isInteger(row.baseFee) || row.baseFee < 0 ||
        !Number.isInteger(row.peripheralFee) || row.peripheralFee < 0 ||
        !Number.isInteger(row.extraStoreFee) || row.extraStoreFee < 0
      ) {
        this.logger.warn(
          `Invalid pricing values in DB: baseFee=${row.baseFee}, peripheralFee=${row.peripheralFee}, extraStoreFee=${row.extraStoreFee}. Using fallback config`,
        );
        return DEFAULT_PRICING_CONFIG;
      }

      const config: PricingConfig = Object.freeze({
        baseFee: row.baseFee,
        peripheralFee: row.peripheralFee,
        extraStoreFee: row.extraStoreFee,
      });

      if (!tx && this.cacheEnabled) {
        this.cachedConfig = {
          config,
          expiresAt: now + this.cacheTtlMs,
        };
      }

      return config;
    } catch (error) {
      this.logger.error('Failed to fetch pricing config from DB, using fallback config', error);
      return DEFAULT_PRICING_CONFIG;
    }
  }

  async recalculateFee(
    orderId: string,
    tx?: Prisma.TransactionClient,
    config: PricingConfig = DEFAULT_PRICING_CONFIG,
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
      throw new ConflictException(
        'Cannot recalculate fee for a delivered order',
      );
    }

    // Preserve the order's existing fee snapshot (Bug B2 fix + customFee)
    const baseFee = order.baseFee;
    const peripheralFee = order.peripheralFee;
    const customFee = (order as { customFee?: number }).customFee ?? 0;

    // Recalculate extraStoresFee only, based on purchased stores count
    const purchasedStoreCount = order.orderStores.length;
    // TODO(6A-3.1b): replace DEFAULT_PRICING_CONFIG with await this.getPricingConfig(tx)
    const extraStoresFee =
      Math.max(0, purchasedStoreCount - 1) * config.extraStoreFee;

    const totalFee = baseFee + peripheralFee + extraStoresFee + customFee;
    const { runnerShare, platformShare } = splitShares(totalFee);

    const hasOrderCustomFee =
      (order as { customFee?: number }).customFee !== undefined &&
      (order as { customFee?: number }).customFee !== null;

    const newFee: FeeResult = {
      baseFee,
      peripheralFee,
      extraStoresFee,
      totalFee,
      runnerShare,
      platformShare,
      ...(hasOrderCustomFee ? { customFee } : {}),
    };

    const oldFee = {
      baseFee: order.baseFee,
      peripheralFee: order.peripheralFee,
      extraStoresFee: order.extraStoresFee,
      totalFee: order.totalFee,
      ...(hasOrderCustomFee ? { customFee: (order as { customFee?: number }).customFee } : {}),
    };

    const feeChanged =
      oldFee.baseFee !== newFee.baseFee ||
      oldFee.peripheralFee !== newFee.peripheralFee ||
      oldFee.extraStoresFee !== newFee.extraStoresFee ||
      oldFee.totalFee !== newFee.totalFee;

    // Write back ONLY extraStoresFee and totalFee (DO NOT overwrite baseFee, peripheralFee, or customFee)
    await client.order.update({
      where: { id: order.id },
      data: {
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