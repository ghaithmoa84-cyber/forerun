import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import {
  type SettlementAdminQuery,
  SettlementListResponse,
  type RunnerSettlement,
  RunnerCurrentSettlementSchema,
  type RunnerCurrentSettlement,
  type RunnerSettlementItem,
} from '@forerun/shared-types';
import { PRICING } from '@forerun/shared-constants';

import { fromZonedTime } from 'date-fns-tz';

function getUtcRangeForOperationalDate(date: string) {
  const TZ = 'Asia/Damascus';
  const start = fromZonedTime(`${date}T00:00:00`, TZ);
  const end = fromZonedTime(`${date}T23:59:59.999`, TZ);
  return { start, end };
}

export function getOperationalDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Damascus',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export interface CloseDayResult {
  settlements: Array<{
    id: string;
    runnerId: string;
    operationalDate: string;
    status: string;
    totalOrders: number;
    totalFees: number;
    runnerShare: number;
    platformShare: number;
    notes: string | null;
    closedAt: Date | null;
    closedByAdminId: string | null;
    createdAt: Date;
  }>;
  runnerCount: number;
}

@Injectable()
export class SettlementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async resolveRunner(userId: string) {
    const runner = await this.prisma.runner.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!runner) {
      throw new NotFoundException('Runner profile not found');
    }

    if (runner.user.status !== 'VERIFIED') {
      throw new ForbiddenException('Runner account is not verified');
    }

    return runner;
  }

  /**
   * Fetches delivered orders for the operational date and groups them by runner.
   */
  private async collectDeliveredOrders(
    tx: Prisma.TransactionClient,
    operationalDate: string,
  ) {
    const { start, end } = getUtcRangeForOperationalDate(operationalDate);

    const orders = await tx.order.findMany({
      where: {
        status: 'DELIVERED',
        createdAt: { gte: start, lte: end },
      },
      include: { runner: true },
    });

    const runnerOrderMap = new Map<string, typeof orders>();
    for (const order of orders) {
      if (!order.runnerId) continue;
      if (!runnerOrderMap.has(order.runnerId)) {
        runnerOrderMap.set(order.runnerId, []);
      }
      runnerOrderMap.get(order.runnerId)!.push(order);
    }

    return { orders, runnerOrderMap };
  }

  /**
   * Identifies runners who already have settlement records for this operational date.
   */
  private async validateDayNotAlreadyClosed(
    tx: Prisma.TransactionClient,
    operationalDate: string,
    runnerIds: string[],
  ): Promise<Set<string>> {
    const existing = await tx.settlement.findMany({
      where: {
        operationalDate,
        runnerId: { in: runnerIds },
      },
      select: { runnerId: true },
    });
    return new Set(existing.map((s) => s.runnerId));
  }

  /**
   * Pure function: calculates shares and breakdown items for a runner's orders without DB calls.
   */
  private calculateSettlementAmounts(
    runnerOrders: Array<{ id: string; totalFee: number }>,
  ): {
    totalFees: number;
    runnerShare: number;
    platformShare: number;
    items: Array<{
      orderId: string;
      orderFee: number;
      runnerShare: number;
      platformShare: number;
    }>;
  } {
    let runnerShare = 0;
    let platformShare = 0;
    const items: Array<{
      orderId: string;
      orderFee: number;
      runnerShare: number;
      platformShare: number;
    }> = [];

    for (const order of runnerOrders) {
      const fee = order.totalFee;
      const rShare = Math.floor(fee * PRICING.RUNNER_SHARE);
      const pShare = Math.ceil(fee * PRICING.PLATFORM_SHARE);
      runnerShare += rShare;
      platformShare += pShare;
      items.push({
        orderId: order.id,
        orderFee: fee,
        runnerShare: rShare,
        platformShare: pShare,
      });
    }

    const totalFees = runnerOrders.reduce(
      (sum: number, o: { totalFee: number }) => sum + o.totalFee,
      0,
    );

    return { totalFees, runnerShare, platformShare, items };
  }

  /**
   * Creates settlement record and its breakdown items in DB.
   */
  private async createSettlementRecords(
    tx: Prisma.TransactionClient,
    params: {
      runnerId: string;
      operationalDate: string;
      totalOrders: number;
      totalFees: number;
      runnerShare: number;
      platformShare: number;
      notes: string | null;
      items: Array<{
        orderId: string;
        orderFee: number;
        runnerShare: number;
        platformShare: number;
      }>;
    },
  ) {
    const {
      runnerId,
      operationalDate,
      totalOrders,
      totalFees,
      runnerShare,
      platformShare,
      notes,
      items,
    } = params;

    const settlement = await tx.settlement.create({
      data: {
        runnerId,
        operationalDate,
        totalOrders,
        totalFees,
        runnerShare,
        platformShare,
        notes,
      },
    });

    await tx.settlementItem.createMany({
      data: items.map((item) => ({
        settlementId: settlement.id,
        orderId: item.orderId,
        orderFee: item.orderFee,
        runnerShare: item.runnerShare,
        platformShare: item.platformShare,
      })),
    });

    return settlement;
  }

  /**
   * Records SETTLEMENT_CLOSED audit entry.
   */
  private async recordCloseDayAuditLog(
    tx: Prisma.TransactionClient,
    params: {
      userId: string;
      operationalDate: string;
      runnerCount: number;
      orderCount: number;
    },
  ): Promise<void> {
    const { userId, operationalDate, runnerCount, orderCount } = params;

    await this.auditService.log(
      {
        actorId: userId,
        actorRole: 'ADMIN',
        event: 'SETTLEMENT_CLOSED',
        meta: {
          operationalDate,
          runnerCount,
          orderCount,
        },
      },
      tx,
    );
  }

  async closeDay(
    operationalDate: string,
    notes: string | null,
    userId: string,
    _adminId: string,
  ): Promise<CloseDayResult> {
    const result = await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const { orders, runnerOrderMap } = await this.collectDeliveredOrders(
          tx,
          operationalDate,
        );

        const existingRunnerIds = await this.validateDayNotAlreadyClosed(
          tx,
          operationalDate,
          [...runnerOrderMap.keys()],
        );

        const settlements: CloseDayResult['settlements'] = [];

        for (const [runnerId, runnerOrders] of runnerOrderMap) {
          if (existingRunnerIds.has(runnerId)) continue;

          const calculated = this.calculateSettlementAmounts(runnerOrders);

          const settlement = await this.createSettlementRecords(tx, {
            runnerId,
            operationalDate,
            totalOrders: runnerOrders.length,
            totalFees: calculated.totalFees,
            runnerShare: calculated.runnerShare,
            platformShare: calculated.platformShare,
            notes,
            items: calculated.items,
          });

          settlements.push(settlement);
        }

        await this.recordCloseDayAuditLog(tx, {
          userId,
          operationalDate,
          runnerCount: settlements.length,
          orderCount: orders.length,
        });

        return { settlements, runnerCount: settlements.length };
      },
    );

    await this.notificationsService.emitToAdmin('settlement:closed', {
      date: operationalDate,
      runnerCount: result.runnerCount,
    });

    return result;
  }

  async markSettled(id: string, userId: string, adminId: string) {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const settlement = await tx.settlement.findUnique({ where: { id } });

      if (!settlement) {
        throw new NotFoundException('Settlement not found');
      }

      if (settlement.status === 'SETTLED') {
        throw new ConflictException(
          'Settlement already marked as settled',
        );
      }

      if (settlement.status !== 'PENDING') {
        throw new BadRequestException('Settlement is not pending');
      }

      const closedAt = new Date();

      const updated = await tx.settlement.updateMany({
        where: { id, status: 'PENDING' },
        data: {
          status: 'SETTLED',
          closedAt,
          closedByAdminId: adminId,
        },
      });

      if (updated.count === 0) {
        throw new ConflictException(
          'Settlement already settled or not found',
        );
      }

      await tx.ledgerEntry.create({
        data: {
          runnerId: settlement.runnerId,
          type: 'SETTLEMENT_PAID',
          amount: settlement.platformShare,
          description: `Settlement ${id} settled for ${settlement.operationalDate}`,
        },
      });

      await this.auditService.log(
        {
          actorId: userId,
          actorRole: 'ADMIN',
          event: 'SETTLEMENT_MARKED_SETTLED',
          fromStatus: 'PENDING',
          toStatus: 'SETTLED',
          meta: { settlementId: id, runnerId: settlement.runnerId },
        },
        tx,
      );

      return {
        settlement: { ...settlement, status: 'SETTLED', closedAt, closedByAdminId: adminId },
      };
    });
  }

  async listAdmin(query: SettlementAdminQuery): Promise<SettlementListResponse> {
    const { page, limit, status, runnerId, dateFrom, dateTo } = query;

    const where: Prisma.SettlementWhereInput = {
      ...(status ? { status: status as 'PENDING' | 'SETTLED' } : {}),
      ...(runnerId ? { runnerId } : {}),
      ...(dateFrom || dateTo
        ? {
            createdAt: {
              ...(dateFrom ? { gte: dateFrom } : {}),
              ...(dateTo ? { lte: dateTo } : {}),
            },
          }
        : {}),
    };

    const [total, data] = await Promise.all([
      this.prisma.settlement.count({ where }),
      this.prisma.settlement.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async listRunnerSettlements(
    runnerId: string,
    page: number,
    limit: number,
  ): Promise<{ data: RunnerSettlement[]; meta: { total: number; page: number; limit: number; totalPages: number } }> {
    const [total, data] = await Promise.all([
      this.prisma.settlement.count({ where: { runnerId } }),
      this.prisma.settlement.findMany({
        where: { runnerId },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const mappedData: RunnerSettlement[] = data.map((settlement) => ({
      operationalDate: settlement.operationalDate,
      status: settlement.status,
      totalOrders: settlement.totalOrders,
      totalFees: settlement.totalFees,
      runnerShare: settlement.runnerShare,
      platformShare: settlement.platformShare,
    }));

    return {
      data: mappedData,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getCurrentSettlement(runnerId: string): Promise<RunnerCurrentSettlement> {
    const operationalDate = getOperationalDate();

    const settlement = await this.prisma.settlement.findUnique({
      where: {
        runnerId_operationalDate: {
          runnerId,
          operationalDate,
        },
      },
      include: {
        items: {
          include: {
            order: {
              select: {
                orderNumber: true,
                deliveredAt: true,
              },
            },
          },
        },
      },
    });

    if (settlement) {
      const orders: RunnerSettlementItem[] = settlement.items.map((item) => ({
        orderNumber: item.order.orderNumber!,
        totalFee: item.orderFee,
        deliveredAt: item.order.deliveredAt!,
      }));

      return {
        operationalDate: settlement.operationalDate,
        status: settlement.status as RunnerCurrentSettlement['status'],
        totalOrders: settlement.totalOrders,
        totalFees: settlement.totalFees,
        estimatedRunnerShare: settlement.runnerShare,
        estimatedPlatformShare: settlement.platformShare,
        orders,
      };
    }

    const { start, end } = getUtcRangeForOperationalDate(operationalDate);

    const rawOrders = await this.prisma.order.findMany({
      where: {
        runnerId,
        status: 'DELIVERED',
        createdAt: { gte: start, lte: end },
      },
      select: {
        orderNumber: true,
        totalFee: true,
        deliveredAt: true,
      },
    });

    const orders: RunnerSettlementItem[] = rawOrders.map((o) => ({
      orderNumber: o.orderNumber!,
      totalFee: o.totalFee,
      deliveredAt: o.deliveredAt!,
    }));

    const totalOrders = orders.length;
    const totalFees = orders.reduce((sum, o) => sum + o.totalFee, 0);
    const estimatedRunnerShare = Math.floor(totalFees * PRICING.RUNNER_SHARE);
    const estimatedPlatformShare = Math.ceil(totalFees * PRICING.PLATFORM_SHARE);

    return RunnerCurrentSettlementSchema.parse({
      operationalDate,
      status: 'NOT_CLOSED',
      totalOrders,
      totalFees,
      estimatedRunnerShare,
      estimatedPlatformShare,
      orders,
    });
  }

  async getPendingSettlements(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.settlement.findMany({
        where: { status: 'PENDING' },
        skip,
        take: limit,
        include: { runner: { include: { user: true } } },
        orderBy: { operationalDate: 'desc' },
      }),
      this.prisma.settlement.count({ where: { status: 'PENDING' } }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async checkPendingOrders(date: string): Promise<number> {
    const { start, end } = getUtcRangeForOperationalDate(date);

    const pendingOrders = await this.prisma.order.findMany({
      where: {
        status: 'DELIVERED',
        createdAt: { gte: start, lte: end },
        settlementItem: { is: null },
      },
      select: { runnerId: true },
    });

    const runnerIds = new Set<string>();
    for (const order of pendingOrders) {
      if (order.runnerId) {
        runnerIds.add(order.runnerId);
      }
    }
    return runnerIds.size;
  }

  @Cron('0 23 * * *', { timeZone: 'Asia/Damascus' })
  async settlementReminder(): Promise<void> {
    const today = getOperationalDate();
    const pendingRunnerCount = await this.checkPendingOrders(today);
    if (pendingRunnerCount > 0) {
      await this.notificationsService.emitToAdmin('settlement:reminder', {
        date: today,
        pendingRunnerCount,
        message: 'لديك تسوية معلقة لم تُغلق بعد',
      });
    }
  }
}

