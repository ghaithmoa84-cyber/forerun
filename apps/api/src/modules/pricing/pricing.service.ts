import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  DEFAULT_PRICING_CONFIG,
  PRICING_LIMITS,
  CUSTOM_FEE_CAP,
} from '@forerun/shared-constants';
import type {
  PricingConfig,
  FeePreviewDto,
  FeePreviewResponse,
  PlatformPricingResponse,
  UpdatePlatformPricingDto,
} from '@forerun/shared-types';
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

  /**
   * Clears the in-memory pricing config cache.
   */
  clearCache(): void {
    this.cachedConfig = null;
  }

  /**
   * Previews the fees for an order without persisting any changes.
   */
  async previewFee(
    orderId: string,
    dto: FeePreviewDto,
  ): Promise<FeePreviewResponse> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        orderStores: {
          select: { id: true },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('الطلب غير موجود');
    }

    // Defensive check on customFee
    const customFee = dto.customFee ?? 0;
    if (!Number.isInteger(customFee) || customFee < 0) {
      throw new BadRequestException(
        'يجب أن يكون الرسم الإضافي عدداً صحيحاً غير سالب',
      );
    }
    if (customFee > CUSTOM_FEE_CAP) {
      throw new BadRequestException(
        `الرسم الإضافي (${customFee}) يتجاوز الحد الأقصى المسموح به (${CUSTOM_FEE_CAP})`,
      );
    }

    const hasReason =
      typeof dto.customFeeReason === 'string' &&
      dto.customFeeReason.trim().length > 0;

    if (customFee > 0 && !hasReason) {
      throw new BadRequestException('يجب إدخال سبب عند تحديد رسم إضافي للطلب');
    }
    if (customFee === 0 && hasReason) {
      throw new BadRequestException(
        'لا يمكن تحديد سبب للرسم الإضافي إذا كان الرسم الإضافي 0',
      );
    }

    // Defensive check on baseFee if provided
    if (dto.baseFee !== undefined) {
      if (
        !Number.isInteger(dto.baseFee) ||
        dto.baseFee < PRICING_LIMITS.baseFee.min ||
        dto.baseFee > PRICING_LIMITS.baseFee.max
      ) {
        throw new BadRequestException(
          `الرسم الأساسي يجب أن يكون عدداً صحيحاً بين ${PRICING_LIMITS.baseFee.min} و ${PRICING_LIMITS.baseFee.max}`,
        );
      }
    }

    const effectiveBaseFee =
      dto.baseFee !== undefined ? dto.baseFee : order.baseFee;
    const effectiveIsPeripheral =
      dto.isPeripheral !== undefined ? dto.isPeripheral : order.isPeripheral;

    // 6A-3.1b: تُقرأ رسوم peripheralFee/extraStoreFee من صف PlatformPricing عبر الكاش (D23).
    // baseFee يبقى لقطة الطلب ما لم يحدّد الأدمن قيمة (D21).
    const pricingConfig = await this.getPricingConfig();

    const feeResult = this.calculateFee(
      {
        isPeripheral: effectiveIsPeripheral,
        purchasedStoreCount: order.orderStores.length,
        customFee,
      },
      { ...pricingConfig, baseFee: effectiveBaseFee },
    );

    return {
      baseFee: feeResult.baseFee,
      peripheralFee: feeResult.peripheralFee,
      extraStoresFee: feeResult.extraStoresFee,
      customFee,
      totalFee: feeResult.totalFee,
      runnerShare: feeResult.runnerShare,
      platformShare: feeResult.platformShare,
    };
  }

  /**
   * Fetches current platform pricing configuration or default if absent.
   */
  async getPlatformPricing(): Promise<PlatformPricingResponse> {
    const row = await this.prisma.platformPricing.findUnique({
      where: { id: 'default' },
    });

    if (!row) {
      return {
        baseFee: DEFAULT_PRICING_CONFIG.baseFee,
        extraStoreFee: DEFAULT_PRICING_CONFIG.extraStoreFee,
        peripheralFee: DEFAULT_PRICING_CONFIG.peripheralFee,
        updatedAt: null,
        updatedByUserId: null,
      };
    }

    return {
      baseFee: row.baseFee,
      extraStoreFee: row.extraStoreFee,
      peripheralFee: row.peripheralFee,
      updatedAt: row.updatedAt,
      updatedByUserId: row.updatedByUserId,
    };
  }

  /**
   * Updates platform pricing with concurrency protection, DB upsert, and AuditLog.
   */
  async updatePlatformPricing(
    dto: UpdatePlatformPricingDto,
    userId: string,
  ): Promise<PlatformPricingResponse> {
    // Defensive check on bounds
    if (
      !Number.isInteger(dto.baseFee) ||
      dto.baseFee < PRICING_LIMITS.baseFee.min ||
      dto.baseFee > PRICING_LIMITS.baseFee.max
    ) {
      throw new BadRequestException(
        `الرسم الأساسي يجب أن يكون عدداً صحيحاً بين ${PRICING_LIMITS.baseFee.min} و ${PRICING_LIMITS.baseFee.max}`,
      );
    }

    if (
      !Number.isInteger(dto.extraStoreFee) ||
      dto.extraStoreFee < PRICING_LIMITS.extraStoreFee.min ||
      dto.extraStoreFee > PRICING_LIMITS.extraStoreFee.max
    ) {
      throw new BadRequestException(
        `رسم المتجر الإضافي يجب أن يكون عدداً صحيحاً بين ${PRICING_LIMITS.extraStoreFee.min} و ${PRICING_LIMITS.extraStoreFee.max}`,
      );
    }

    if (
      !Number.isInteger(dto.peripheralFee) ||
      dto.peripheralFee < PRICING_LIMITS.peripheralFee.min ||
      dto.peripheralFee > PRICING_LIMITS.peripheralFee.max
    ) {
      throw new BadRequestException(
        `رسم المنطقة الطرفية يجب أن يكون عدداً صحيحاً بين ${PRICING_LIMITS.peripheralFee.min} و ${PRICING_LIMITS.peripheralFee.max}`,
      );
    }

    const updatedRow = await this.prisma.$transaction(async (tx) => {
      const currentRow = await tx.platformPricing.findUnique({
        where: { id: 'default' },
      });

      if (dto.updatedAt !== undefined && dto.updatedAt !== null) {
        if (!currentRow) {
          throw new ConflictException(
            'تعارض في التحديث: تم تعديل إعدادات الأسعار من قِبل جلسة أخرى، يرجى إعادة التحميل',
          );
        }
        const clientTimestamp = new Date(dto.updatedAt).getTime();
        const dbTimestamp = new Date(currentRow.updatedAt).getTime();
        if (clientTimestamp !== dbTimestamp) {
          throw new ConflictException(
            'تعارض في التحديث: تم تعديل إعدادات الأسعار من قِبل جلسة أخرى، يرجى إعادة التحميل',
          );
        }
      }

      const before = currentRow
        ? {
            baseFee: currentRow.baseFee,
            extraStoreFee: currentRow.extraStoreFee,
            peripheralFee: currentRow.peripheralFee,
            updatedAt: currentRow.updatedAt,
          }
        : {
            baseFee: DEFAULT_PRICING_CONFIG.baseFee,
            extraStoreFee: DEFAULT_PRICING_CONFIG.extraStoreFee,
            peripheralFee: DEFAULT_PRICING_CONFIG.peripheralFee,
            updatedAt: null,
          };

      let row: Prisma.PlatformPricingGetPayload<Record<string, never>>;

      if (currentRow) {
        const updateResult = await tx.platformPricing.updateMany({
          where: {
            id: 'default',
            updatedAt: currentRow.updatedAt,
          },
          data: {
            baseFee: dto.baseFee,
            extraStoreFee: dto.extraStoreFee,
            peripheralFee: dto.peripheralFee,
            updatedByUserId: userId,
          },
        });

        if (updateResult.count === 0) {
          throw new ConflictException(
            'تعارض في التحديث: تم تعديل إعدادات الأسعار من قِبل جلسة أخرى، يرجى إعادة التحميل',
          );
        }

        row = await tx.platformPricing.findUniqueOrThrow({
          where: { id: 'default' },
        });
      } else {
        row = await tx.platformPricing.create({
          data: {
            id: 'default',
            baseFee: dto.baseFee,
            extraStoreFee: dto.extraStoreFee,
            peripheralFee: dto.peripheralFee,
            updatedByUserId: userId,
          },
        });
      }

      const after = {
        baseFee: row.baseFee,
        extraStoreFee: row.extraStoreFee,
        peripheralFee: row.peripheralFee,
        updatedAt: row.updatedAt,
      };

      await this.auditService.log(
        {
          actorId: userId,
          actorRole: 'ADMIN',
          event: 'PRICING_UPDATED',
          meta: {
            before,
            after,
          },
        },
        tx,
      );

      return row;
    });

    this.clearCache();

    return {
      baseFee: updatedRow.baseFee,
      extraStoreFee: updatedRow.extraStoreFee,
      peripheralFee: updatedRow.peripheralFee,
      updatedAt: updatedRow.updatedAt,
      updatedByUserId: updatedRow.updatedByUserId,
    };
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
    config?: PricingConfig,
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

    // Recalculate extraStoresFee only, based on purchased stores count (D16)
    const purchasedStoreCount = order.orderStores.length;
    // 6A-3.1b: سعر المتجر الإضافي يأتي من صف PlatformPricing (يُقرأ داخل الـ tx عند توفره)
    const effectiveConfig = config ?? (await this.getPricingConfig(tx));
    const extraStoresFee =
      Math.max(0, purchasedStoreCount - 1) * effectiveConfig.extraStoreFee;

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