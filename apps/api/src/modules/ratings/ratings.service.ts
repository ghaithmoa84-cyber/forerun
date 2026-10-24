import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CONFIG } from '@forerun/shared-constants';
import type {
  CreateRatingBodyRequest,
  RatingResponse,
  UpdateRatingBodyRequest,
} from '@forerun/shared-types';
import { PrismaService } from '../../database/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { mapRating } from './rating.mapper.js';

export interface RatingsActor {
  userId: string;
  role: string;
}

@Injectable()
export class RatingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async createRating(
    orderId: string,
    actor: RatingsActor,
    dto: CreateRatingBodyRequest,
  ): Promise<RatingResponse> {
    if (actor.role !== 'CUSTOMER') {
      throw new ForbiddenException('Only customers can create ratings');
    }

    const customer = await this.prisma.customer.findUnique({
      where: { userId: actor.userId },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
      });

      if (!order || order.customerId !== customer.id) {
        throw new NotFoundException('Order not found');
      }

      if (order.status !== 'DELIVERED') {
        throw new UnprocessableEntityException(
          'Only delivered orders can be rated',
        );
      }

      if (!order.deliveredAt) {
        throw new UnprocessableEntityException(
          'Order has no delivery timestamp',
        );
      }
      const hoursSinceDelivery =
        (Date.now() - order.deliveredAt.getTime()) / (1000 * 60 * 60);
      if (hoursSinceDelivery > 24) {
        throw new UnprocessableEntityException(
          'Rating window has expired (24 hours after delivery)',
        );
      }

      if (!order.runnerId) {
        throw new UnprocessableEntityException('Order has no runner to rate');
      }

      const existing = await tx.rating.findUnique({
        where: {
          orderId_runnerId: { orderId, runnerId: order.runnerId },
        },
      });
      if (existing) {
        throw new ConflictException(
          'Rating already exists for this order and runner',
        );
      }

      const expiresAt = new Date(Date.now() + CONFIG.RATING_EDIT_WINDOW_MS);

      const rating = await tx.rating.create({
        data: {
          orderId,
          customerId: customer.id,
          runnerId: order.runnerId,
          stars: dto.stars,
          note: dto.note ?? null,
          expiresAt,
          isFinal: false,
        },
      });

      let updateSuccess = false;
      const MAX_RETRIES = 5;
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        const runner = await tx.runner.findUnique({
          where: { id: order.runnerId },
        });
        if (!runner) {
          throw new NotFoundException('Runner not found');
        }
        const oldTotal = runner.totalRatings;
        const oldAvg = runner.avgRating;
        const newTotal = oldTotal + 1;
        const newAvg =
          oldAvg === null || oldTotal === 0
            ? dto.stars
            : (oldAvg * oldTotal + dto.stars) / newTotal;

        const updated = await tx.runner.updateMany({
          where: {
            id: order.runnerId,
            totalRatings: oldTotal,
            ...(oldAvg === null ? { avgRating: null } : { avgRating: oldAvg }),
          },
          data: {
            avgRating: newAvg,
            totalRatings: newTotal,
          },
        });

        if (updated.count === 1) {
          updateSuccess = true;
          break;
        }
      }

      if (!updateSuccess) {
        throw new ConflictException('CONCURRENT_RUNNER_RATING_UPDATE');
      }

      await this.auditService.log(
        {
          orderId,
          actorId: actor.userId,
          actorRole: 'CUSTOMER',
          event: 'RATING_CREATED',
          meta: {
            ratingId: rating.id,
            runnerId: order.runnerId,
            stars: dto.stars,
          },
        },
        tx,
      );

      return mapRating(rating, actor.role);
    });
  }

  async updateRating(
    orderId: string,
    actor: RatingsActor,
    dto: UpdateRatingBodyRequest,
  ): Promise<RatingResponse> {
    if (actor.role !== 'CUSTOMER') {
      throw new ForbiddenException('Only customers can update ratings');
    }

    const customer = await this.prisma.customer.findUnique({
      where: { userId: actor.userId },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order || order.customerId !== customer.id) {
      throw new NotFoundException('Order not found');
    }

    if (!order.runnerId) {
      throw new UnprocessableEntityException('Order has no runner to rate');
    }

    const rating = await this.prisma.rating.findUnique({
      where: {
        orderId_runnerId: { orderId, runnerId: order.runnerId },
      },
    });
    if (!rating) {
      throw new NotFoundException('Rating not found');
    }

    if (rating.customerId !== customer.id) {
      throw new ForbiddenException(
        'You are not authorized to update this rating',
      );
    }

    // نافذة التحرير منتهية: خُتم واحدة كـ final ولا تُعدّل.
    if (rating.expiresAt <= new Date()) {
      await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.rating.update({
          where: { id: rating.id },
          data: { isFinal: true },
        });
        await this.auditService.log(
          {
            orderId,
            actorId: actor.userId,
            actorRole: 'CUSTOMER',
            event: 'RATING_FINALIZED',
            meta: { ratingId: rating.id, reason: 'edit_window_expired' },
          },
          tx,
        );
      });
      throw new UnprocessableEntityException(
        'Rating edit window has expired',
      );
    }

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const updated = await tx.rating.update({
        where: { id: rating.id },
        data: {
          stars: dto.stars,
          note: dto.note ?? null,
        },
      });

      if (rating.runnerId) {
        let updateSuccess = false;
        const MAX_RETRIES = 5;
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
          const runner = await tx.runner.findUnique({
            where: { id: rating.runnerId },
          });
          if (!runner) {
            throw new NotFoundException('Runner not found');
          }
          const totalCount = runner.totalRatings;
          if (totalCount === 0) {
            updateSuccess = true;
            break;
          }
          const currentAvg = runner.avgRating ?? 0;
          const newAvg =
            (currentAvg * totalCount - rating.stars + dto.stars) / totalCount;

          const updated = await tx.runner.updateMany({
            where: {
              id: rating.runnerId,
              totalRatings: totalCount,
              ...(runner.avgRating === null
                ? { avgRating: null }
                : { avgRating: runner.avgRating }),
            },
            data: { avgRating: newAvg },
          });

          if (updated.count === 1) {
            updateSuccess = true;
            break;
          }
        }

        if (!updateSuccess) {
          throw new ConflictException('CONCURRENT_RUNNER_RATING_UPDATE');
        }

        await this.auditService.log(
          {
            orderId,
            actorId: actor.userId,
            actorRole: 'CUSTOMER',
            event: 'RATING_UPDATED',
            meta: { ratingId: rating.id, runnerId: rating.runnerId },
          },
          tx,
        );
      }

      return mapRating(updated, actor.role);
    });
  }
}