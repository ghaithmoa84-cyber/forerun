import { Prisma } from '@prisma/client';
import {
  Injectable,
  NotFoundException,
  ConflictException,
  UnprocessableEntityException,
  ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { RunnerStateMachine } from '../../state-machine/runner-state-machine.js';
import { CONFIG } from '@forerun/shared-constants';

@Injectable()
export class RunnersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly runnerStateMachine: RunnerStateMachine,
  ) {}

  async findAll(page: number, limit: number) {
    const [total, data] = await Promise.all([
      this.prisma.runner.count({
        where: { user: { isDeleted: false } },
      }),
      this.prisma.runner.findMany({
        where: { user: { isDeleted: false } },
        include: { user: true },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      data: data.map((r) => ({
        id: r.id,
        name: r.user.name,
        whatsapp: r.user.whatsapp,
        status: r.status,
        isVisible: r.isVisible,
        avgRating: r.avgRating,
        totalRatings: r.totalRatings,
        notes: r.notes,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getMyProfile(userId: string) {
    const runner = await this.prisma.runner.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!runner) {
      throw new NotFoundException('Runner profile not found');
    }

    return {
      id: runner.id,
      name: runner.user.name,
      whatsapp: runner.user.whatsapp,
      altPhone: runner.user.altPhone ?? null,
      status: runner.status,
      isVisible: runner.isVisible,
      avgRating: runner.avgRating ?? null,
      totalRatings: runner.totalRatings,
      notes: runner.notes ?? null,
    };
  }

  async updateMyStatus(userId: string, newStatus: 'AVAILABLE' | 'UNAVAILABLE') {
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

    const currentStatus = runner.status;
    if (currentStatus === newStatus) {
      return {
        statusCode: 200,
        message: `Runner is already ${newStatus.toLowerCase()}`,
        status: currentStatus,
      };
    }

    if (currentStatus === 'AVAILABLE' && newStatus === 'UNAVAILABLE') {
      const activeOrder = await this.prisma.order.findFirst({
        where: {
          runnerId: runner.id,
          status: { in: ['ASSIGNED', 'IN_PROGRESS', 'OUT_FOR_DELIVERY'] },
        },
        select: { id: true, orderNumber: true, status: true },
      });
      if (activeOrder) {
        throw new UnprocessableEntityException(
          `Cannot go UNAVAILABLE: order ${activeOrder.orderNumber} is ${activeOrder.status}`,
        );
      }
    }

    const actor = 'RUNNER' as const;
    let transitionResult;
    try {
      transitionResult = this.runnerStateMachine.transition(
        currentStatus,
        newStatus,
        actor,
        { actorId: userId },
      );
    } catch {
      throw new UnprocessableEntityException(
        `Invalid status transition: ${currentStatus} -> ${newStatus}`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.runner.updateMany({
        where: { userId, status: currentStatus },
        data: { status: newStatus },
      });
      if (updated.count === 0) {
        throw new ConflictException('RUNNER_STATUS_CHANGED_CONCURRENTLY');
      }

      await this.auditService.log({
        actorId: userId,
        actorRole: 'RUNNER',
        event: 'RUNNER_STATUS_CHANGED',
        meta: {
          runnerId: runner.id,
          fromStatus: currentStatus,
          toStatus: newStatus,
        },
      }, tx);
    });

    return {
      statusCode: 200,
      message: `Runner status changed to ${newStatus}`,
      status: newStatus,
      transition: transitionResult.description,
    };
  }

  async getActiveOrder(userId: string) {
    const runner = await this.prisma.runner.findUnique({
      where: { userId },
    });

    if (!runner) {
      throw new NotFoundException('Runner profile not found');
    }

    const activeOrder = await this.prisma.order.findFirst({
      where: {
        runnerId: runner.id,
        status: {
          in: ['ASSIGNED', 'IN_PROGRESS', 'OUT_FOR_DELIVERY'],
        },
      },
      include: {
        customer: { include: { user: true } },
        items: true,
        orderStores: { where: { isDeleted: false }, include: { items: true, receipts: { where: { isDeleted: false } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!activeOrder) {
      return null;
    }

    // F2: كشف الطلبات النشطة المخفية (BUG-017)
    const activeOrdersCount = await this.prisma.order.count({
      where: {
        runnerId: runner.id,
        status: {
          in: ['ASSIGNED', 'IN_PROGRESS', 'OUT_FOR_DELIVERY'],
        },
      },
    });
    const hasMoreActive = activeOrdersCount > 1;

    return {
      id: activeOrder.id,
      orderNumber: activeOrder.orderNumber!,
      status: activeOrder.status,
      customerName: activeOrder.customer.user.name,
      customerWhatsapp: activeOrder.customer.user.whatsapp,
      deliveryAddress: {
        lat: activeOrder.deliveryLat,
        lng: activeOrder.deliveryLng,
        description: activeOrder.deliveryDesc,
      },
      pricing: {
        baseFee: activeOrder.baseFee,
        peripheralFee: activeOrder.peripheralFee,
        extraStoresFee: activeOrder.extraStoresFee,
        customFee: activeOrder.customFee ?? 0,
        customFeeReason: activeOrder.customFeeReason ?? null,
        totalFee: activeOrder.totalFee,
      },
      isPeripheral: activeOrder.isPeripheral,
      createdAt: activeOrder.createdAt.toISOString(),
      assignedAt: activeOrder.assignedAt?.toISOString() ?? null,
      items: activeOrder.items.map((item) => ({
        id: item.id,
        itemName: item.itemName,
        quantity: item.quantity,
        customStoreName: item.customStoreName,
        anyStore: item.anyStore,
      })),
      orderStores: activeOrder.orderStores.map((store) => ({
        id: store.id,
        storeName: store.storeName,
        isAnyStore: store.isAnyStore,
        status: store.status,
        isExtra: store.isExtra,
        addedBy: store.addedBy,
        purchasedAt: store.purchasedAt?.toISOString() ?? null,
        items: store.items.map((item) => ({
          id: item.id,
          itemName: item.itemName,
          quantity: item.quantity,
          customStoreName: item.customStoreName,
          anyStore: item.anyStore,
        })),
        receipts: store.receipts.map((receipt) => ({
          id: receipt.id,
          imageUrl: receipt.imageUrl,
          isDeleted: receipt.isDeleted,
          uploadedAt: receipt.uploadedAt.toISOString(),
        })),
      })),
      activeOrdersCount,
      hasMoreActive,
    };
  }

  async create(body: {
    name: string;
    whatsapp: string;
    password: string;
    altPhone?: string;
  }, actorId: string) {
    const existing = await this.prisma.user.findUnique({
      where: { whatsapp: body.whatsapp },
    });

    if (existing) {
      throw new ConflictException('Runner with this WhatsApp already exists');
    }

    const passwordHash = await bcrypt.hash(body.password, CONFIG.BCRYPT_ROUNDS);

    await this.prisma.$transaction(async (tx) => {
      try {
        const user = await tx.user.create({
          data: {
            name: body.name,
            whatsapp: body.whatsapp,
            altPhone: body.altPhone || null,
            passwordHash,
            role: 'RUNNER',
            status: 'VERIFIED',
          },
        });

        await tx.runner.create({
          data: {
            userId: user.id,
          },
        });

        await this.auditService.log({
          actorId,
          actorRole: 'ADMIN',
          event: 'RUNNER_CREATED',
          meta: { userId: user.id, runnerWhatsapp: body.whatsapp },
        }, tx);
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          throw new ConflictException('This WhatsApp number is already registered');
        }
        throw err;
      }
    });

    return {
      statusCode: 201,
      message: 'Runner account created successfully',
    };
  }

  async update(body: {
    id: string;
    name?: string;
    altPhone?: string;
    notes?: string;
    password?: string;
  }, actorId: string) {
    const runner = await this.prisma.runner.findUnique({
      where: { id: body.id },
      include: { user: true },
    });

    if (!runner) {
      throw new NotFoundException('Runner not found');
    }

    await this.prisma.$transaction(async (tx) => {
      const updateData: Prisma.UserUpdateInput = {
        name: body.name ?? undefined,
        altPhone: body.altPhone ?? undefined,
      };

      if (body.password) {
        updateData.passwordHash = await bcrypt.hash(
          body.password,
          CONFIG.BCRYPT_ROUNDS,
        );
      }

      await tx.user.update({
        where: { id: runner.userId },
        data: updateData,
      });

      await tx.runner.update({
        where: { id: body.id },
        data: body.notes !== undefined ? { notes: body.notes } : {},
      });

      await this.auditService.log({
        actorId,
        actorRole: 'ADMIN',
        event: 'RUNNER_UPDATED',
        meta: { runnerId: body.id },
      }, tx);
    });

    return {
      statusCode: 200,
      message: 'Runner updated successfully',
    };
  }

  async updateVisibility(body: { id: string; isVisible: boolean }, actorId: string) {
    const runner = await this.prisma.runner.findUnique({
      where: { id: body.id },
    });

    if (!runner) {
      throw new NotFoundException('Runner not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.runner.update({
        where: { id: body.id },
        data: { isVisible: body.isVisible },
      });

      await this.auditService.log({
        actorId,
        actorRole: 'ADMIN',
        event: 'RUNNER_VISIBILITY_CHANGED',
        meta: { runnerId: body.id, isVisible: body.isVisible },
      }, tx);
    });

    return {
      statusCode: 200,
      message: `Runner ${body.isVisible ? 'visible' : 'hidden'} successfully`,
    };
  }
}
