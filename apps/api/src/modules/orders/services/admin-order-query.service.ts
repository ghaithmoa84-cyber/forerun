import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { AdminOrderAuditEntry, AdminOrderDetails, AdminOrderListItem, AdminOrderStore, AdminOrdersQuery, PaginatedResponse } from '@forerun/shared-types';
import { PrismaService } from '../../../database/prisma.service.js';
import { mapOrderItem } from './order-mapper.js';

@Injectable()
export class AdminOrderQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async listAdminOrders(
    query: AdminOrdersQuery,
  ): Promise<PaginatedResponse<AdminOrderListItem>> {
    const where: Prisma.OrderWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.runnerId ? { runnerId: query.runnerId } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            createdAt: {
              ...(query.dateFrom ? { gte: query.dateFrom } : {}),
              ...(query.dateTo ? { lte: query.dateTo } : {}),
            },
          }
        : {}),
    };

    const [total, orders] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: {
            include: {
              user: true,
            },
          },
          runner: {
            include: {
              user: true,
            },
          },
          preferredRunner: {
            include: {
              user: {
                select: { name: true },
              },
            },
          },
          _count: {
            select: { items: true },
          },
        },
      }),
    ]);

    return {
      data: orders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber!,
        status: order.status,
        customerId: order.customerId,
        customerName: order.customer?.user.name ?? '',
        runnerId: order.runnerId,
        runnerName: order.runner?.user.name ?? null,
        preferredRunner: order.preferredRunner
          ? {
              id: order.preferredRunner.id,
              name: order.preferredRunner.user.name,
            }
          : null,
        totalFee: order.totalFee,
        itemCount: order._count.items,
        createdAt: order.createdAt,
        deliveredAt: order.deliveredAt,
        cancelledAt: order.cancelledAt,
      })),
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async getAdminOrderDetails(orderId: string): Promise<AdminOrderDetails> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: {
          include: {
            user: true,
          },
        },
        runner: {
          include: {
            user: true,
          },
        },
        preferredRunner: {
          include: {
            user: {
              select: { name: true },
            },
          },
        },
        items: {
          orderBy: { createdAt: 'asc' },
        },
        orderStores: {
          orderBy: { createdAt: 'asc' },
          include: {
            items: {
              orderBy: { createdAt: 'asc' },
            },
            receipts: {
              orderBy: { uploadedAt: 'asc' },
            },
          },
        },
        ratings: {
          orderBy: { createdAt: 'asc' },
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
      customFee: order.customFee,
      customFeeReason: order.customFeeReason,
      totalFee: order.totalFee,
      deliveryLat: order.deliveryLat,
      deliveryLng: order.deliveryLng,
      deliveryDesc: order.deliveryDesc,
      notes: order.notes,
      preferredRunnerId: order.preferredRunnerId,
      preferredRunner: order.preferredRunner
        ? {
            id: order.preferredRunner.id,
            name: order.preferredRunner.user.name,
          }
        : null,
      waitForPreferred: order.waitForPreferred,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      deliveredAt: order.deliveredAt,
      cancelledAt: order.cancelledAt,
      customer: {
        id: order.customer.id,
        userId: order.customer.userId,
        name: order.customer.user.name,
        whatsapp: order.customer.user.whatsapp,
        altPhone: order.customer.user.altPhone,
        status: order.customer.user.status,
      },
      runner: order.runner
        ? {
            id: order.runner.id,
            userId: order.runner.userId,
            name: order.runner.user.name,
            status: order.runner.status,
            avgRating: order.runner.avgRating,
            totalRatings: order.runner.totalRatings,
            isVisible: order.runner.isVisible,
            notes: order.runner.notes,
          }
        : null,
      items: order.items.map((item) => mapOrderItem(item)),
       orderStores: order.orderStores.map((store): AdminOrderStore => ({
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
      ratings: order.ratings.map((rating) => ({
        id: rating.id,
        orderId: rating.orderId,
        customerId: rating.customerId,
        runnerId: rating.runnerId,
        storeNameRated: rating.storeNameRated,
        stars: rating.stars,
        note: rating.note,
        createdAt: rating.createdAt,
        updatedAt: rating.updatedAt,
        expiresAt: rating.expiresAt,
        isFinal: rating.isFinal,
      })),
    };
  }

  async getAdminOrderAudit(orderId: string): Promise<AdminOrderAuditEntry[]> {
    const logs = await this.prisma.auditLog.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
    });

    return logs.map((log) => ({
      id: log.id,
      orderId: log.orderId,
      actorId: log.actorId,
      actorRole: log.actorRole,
      event: log.event,
      fromStatus: log.fromStatus,
      toStatus: log.toStatus,
      meta: log.meta as unknown,
      createdAt: log.createdAt,
    }));
  }
}