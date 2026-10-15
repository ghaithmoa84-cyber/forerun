import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { type Prisma, UserStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { UserStateMachine } from '../../state-machine/user-state-machine.js';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly userStateMachine: UserStateMachine,
  ) {}

  async findLeanById(id: string): Promise<{ id: string; role: string; status: string; isDeleted: boolean } | null> {
    return this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, status: true, isDeleted: true },
    });
  }

  async findAll(page: number, limit: number, search?: string) {
    const trimmedSearch = search?.trim();
    const where: Prisma.UserWhereInput = {
      isDeleted: false,
      role: 'CUSTOMER',
      ...(trimmedSearch
        ? {
            OR: [
              { name: { contains: trimmedSearch, mode: 'insensitive' } },
              { whatsapp: { contains: trimmedSearch } },
              { altPhone: { contains: trimmedSearch } },
            ],
          }
        : {}),
    };

    const [total, data] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        include: { customer: true },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      data: data.map((u) => ({
        id: u.id,
        name: u.name,
        whatsapp: u.whatsapp,
        altPhone: u.altPhone,
        status: u.status,
        createdAt: u.createdAt,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id, isDeleted: false },
      include: {
        customer: {
          include: { address: true },
        },
      },
    });

    if (!user || !user.customer) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      name: user.name,
      whatsapp: user.whatsapp,
      altPhone: user.altPhone,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      customer: {
        id: user.customer.id,
        completedOrders: user.customer.completedOrders,
        totalFeesPaid: user.customer.totalFeesPaid,
        createdAt: user.customer.createdAt,
      },
      address: user.customer.address
        ? {
            id: user.customer.address.id,
            lat: user.customer.address.lat,
            lng: user.customer.address.lng,
            description: user.customer.address.description,
            createdAt: user.customer.address.createdAt,
            updatedAt: user.customer.address.updatedAt,
          }
        : null,
    };
  }

  async verify(id: string, actorId: string) {
    await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id, isDeleted: false, role: 'CUSTOMER' },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (user.status !== 'PENDING_VERIFICATION') {
        throw new UnprocessableEntityException(
          'Account is not in pending verification state',
        );
      }

      const updateResult = await tx.user.updateMany({
        where: { id, status: 'PENDING_VERIFICATION', isDeleted: false, role: 'CUSTOMER' },
        data: { status: 'VERIFIED' },
      });

      if (updateResult.count !== 1) {
        throw new UnprocessableEntityException(
          'Account is not in pending verification state',
        );
      }

      await this.auditService.log({
        actorId,
        actorRole: 'ADMIN',
        event: 'USER_VERIFIED',
        fromStatus: 'PENDING_VERIFICATION',
        toStatus: 'VERIFIED',
        meta: { userId: id },
      }, tx);
    });

    try {
      await this.notificationsService.emitToCustomer(id, 'account:verified', {
        message: 'تم تفعيل حسابك',
      });
    } catch (err) {
      // WebSocket emit is best-effort
      this.logger.warn('[verify] customer notification failed silently', {
        error: err instanceof Error ? err.message : String(err),
        userId: id,
      });
    }

    return {
      statusCode: 200,
      message: 'Account verified successfully',
    };
  }

  async reject(id: string, actorId: string) {
    await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id, isDeleted: false, role: 'CUSTOMER' },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (user.status !== 'PENDING_VERIFICATION') {
        throw new UnprocessableEntityException(
          'Account is not in pending verification state',
        );
      }

      const updateResult = await tx.user.updateMany({
        where: { id, status: 'PENDING_VERIFICATION', isDeleted: false, role: 'CUSTOMER' },
        data: { status: 'REJECTED' },
      });

      if (updateResult.count !== 1) {
        throw new UnprocessableEntityException(
          'Account is not in pending verification state',
        );
      }

      await this.auditService.log({
        actorId,
        actorRole: 'ADMIN',
        event: 'USER_REJECTED',
        fromStatus: 'PENDING_VERIFICATION',
        toStatus: 'REJECTED',
        meta: { userId: id },
      }, tx);
    });

    return {
      statusCode: 200,
      message: 'Account rejected successfully',
    };
  }

  async suspend(id: string, actorId: string) {
    await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id, isDeleted: false },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (user.status === UserStatus.SUSPENDED) {
        throw new UnprocessableEntityException('Account is already suspended');
      }

      this.userStateMachine.transition(user.status, UserStatus.SUSPENDED, 'ADMIN');

      const updateResult = await tx.user.updateMany({
        where: { id, status: user.status, isDeleted: false },
        data: {
          status: UserStatus.SUSPENDED,
          previousStatus: user.status,
        },
      });

      if (updateResult.count !== 1) {
        throw new ConflictException('Concurrent update detected on user status');
      }

      await tx.refreshToken.updateMany({
        where: { userId: id, isRevoked: false },
        data: { isRevoked: true, revokedAt: new Date() },
      });

      await this.auditService.log({
        actorId,
        actorRole: 'ADMIN',
        event: 'USER_SUSPENDED',
        fromStatus: user.status,
        toStatus: UserStatus.SUSPENDED,
        meta: { userId: id, previousStatus: user.status },
      }, tx);
    });

    return {
      statusCode: 200,
      message: 'Account suspended successfully',
    };
  }

  async unsuspend(id: string, actorId: string) {
    const restoredStatus: UserStatus = await this.prisma.$transaction(
      async (tx): Promise<UserStatus> => {
        const user = await tx.user.findUnique({
          where: { id, isDeleted: false },
        });

        if (!user) {
          throw new NotFoundException('User not found');
        }

        if (user.status !== UserStatus.SUSPENDED) {
          throw new UnprocessableEntityException('Account is not in suspended state');
        }

        if (user.previousStatus === UserStatus.REJECTED) {
          throw new UnprocessableEntityException(
            'Cannot unsuspend account that was rejected prior to suspension',
          );
        }

        const targetStatus: UserStatus =
          user.previousStatus ?? UserStatus.PENDING_VERIFICATION;

        this.userStateMachine.transition(
          UserStatus.SUSPENDED,
          targetStatus,
          'ADMIN',
          { previousStatus: user.previousStatus },
        );

        const updateResult = await tx.user.updateMany({
          where: { id, status: UserStatus.SUSPENDED, isDeleted: false },
          data: {
            status: targetStatus,
            previousStatus: null,
          },
        });

        if (updateResult.count !== 1) {
          throw new ConflictException('Concurrent update detected on user status');
        }

        await tx.refreshToken.updateMany({
          where: { userId: id, isRevoked: false },
          data: { isRevoked: true, revokedAt: new Date() },
        });

        await this.auditService.log(
          {
            actorId,
            actorRole: 'ADMIN',
            event: 'USER_UNSUSPENDED',
            fromStatus: UserStatus.SUSPENDED,
            toStatus: targetStatus,
            meta: { userId: id, restoredStatus: targetStatus },
          },
          tx,
        );

        return targetStatus;
      },
    );

    if (restoredStatus === UserStatus.VERIFIED) {
      try {
        await this.notificationsService.emitToCustomer(id, 'account:verified', {
          message: 'تم إعادة تفعيل حسابك بنجاح',
        });
      } catch (err) {
        this.logger.warn('[unsuspend] customer notification failed silently', {
          error: err instanceof Error ? err.message : String(err),
          userId: id,
        });
      }
    }

    return {
      statusCode: 200,
      message: 'Account unsuspended successfully',
    };
  }
}
