import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { UserStatus } from '@prisma/client';

vi.mock('@prisma/client', () => ({
  PrismaClient: class {},
  Prisma: {},
  UserStatus: {
    PENDING_VERIFICATION: 'PENDING_VERIFICATION',
    VERIFIED: 'VERIFIED',
    REJECTED: 'REJECTED',
    SUSPENDED: 'SUSPENDED',
  },
}));

vi.mock('../../src/database/prisma.service.js', () => ({
  PrismaService: class {},
}));

import { UsersService } from '../../src/modules/users/users.service';
import { UserStateMachine } from '../../src/state-machine/user-state-machine';
import { USER_TRANSITIONS } from '../../src/state-machine/user-transitions';
import type { PrismaService } from '../../src/database/prisma.service';
import type { AuditService } from '../../src/modules/audit/audit.service';
import type { NotificationsService } from '../../src/modules/notifications/notifications.service';

interface MockPrisma {
  $transaction: (cb: (tx: MockPrisma) => Promise<unknown>) => Promise<unknown>;
  user: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  refreshToken: {
    updateMany: ReturnType<typeof vi.fn>;
  };
  deviceToken: {
    deleteMany: ReturnType<typeof vi.fn>;
  };
  order: {
    count: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  settlement: {
    count: ReturnType<typeof vi.fn>;
  };
  runner: {
    update: ReturnType<typeof vi.fn>;
  };
  auditLog: {
    findMany: ReturnType<typeof vi.fn>;
  };
}

describe('UsersService - unsuspend', () => {
  let usersService: UsersService;
  let mockPrisma: MockPrisma;
  let mockAudit: { log: ReturnType<typeof vi.fn> };
  let mockNotifications: { emitToCustomer: ReturnType<typeof vi.fn> };
  let userStateMachine: UserStateMachine;

  beforeEach(() => {
    mockPrisma = {
      $transaction: vi.fn(async (cb) => {
        return cb(mockPrisma);
      }),
      user: {
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        count: vi.fn(),
        findMany: vi.fn(),
      },
      refreshToken: {
        updateMany: vi.fn(),
      },
      deviceToken: {
        deleteMany: vi.fn(),
      },
      order: {
        count: vi.fn(),
        findMany: vi.fn(),
      },
      auditLog: {
        findMany: vi.fn(),
      },
      settlement: {
        count: vi.fn(),
      },
      runner: {
        update: vi.fn(),
      },
    };

    mockAudit = {
      log: vi.fn().mockResolvedValue(undefined),
    };

    mockNotifications = {
      emitToCustomer: vi.fn().mockResolvedValue(undefined),
    };

    userStateMachine = new UserStateMachine(USER_TRANSITIONS);

    usersService = new UsersService(
      mockPrisma as unknown as PrismaService,
      mockAudit as unknown as AuditService,
      mockNotifications as unknown as NotificationsService,
      userStateMachine,
    );
  });

  it('successfully unsuspends a SUSPENDED user and logs USER_UNSUSPENDED', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'usr_1',
      status: UserStatus.SUSPENDED,
      previousStatus: UserStatus.VERIFIED,
      isDeleted: false,
    });
    mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });

    const result = await usersService.unsuspend('usr_1', 'admin_1');

    expect(result).toEqual({
      statusCode: 200,
      message: 'Account unsuspended successfully',
    });

    expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'usr_1', status: UserStatus.SUSPENDED, isDeleted: false },
      data: { status: UserStatus.VERIFIED, previousStatus: null },
    });

    expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'usr_1', isRevoked: false },
      data: { isRevoked: true, revokedAt: expect.any(Date) },
    });

    expect(mockAudit.log).toHaveBeenCalledWith(
      {
        actorId: 'admin_1',
        actorRole: 'ADMIN',
        event: 'USER_UNSUSPENDED',
        fromStatus: UserStatus.SUSPENDED,
        toStatus: UserStatus.VERIFIED,
        meta: { userId: 'usr_1', restoredStatus: UserStatus.VERIFIED },
      },
      expect.anything(),
    );

    expect(mockNotifications.emitToCustomer).toHaveBeenCalledWith(
      'usr_1',
      'account:verified',
      { message: 'تم إعادة تفعيل حسابك بنجاح' },
    );
  });

  it('throws NotFoundException when user does not exist', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(usersService.unsuspend('non_existent', 'admin_1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws UnprocessableEntityException when user is not in SUSPENDED status', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'usr_1',
      status: UserStatus.VERIFIED,
      previousStatus: null,
      isDeleted: false,
    });

    await expect(usersService.unsuspend('usr_1', 'admin_1')).rejects.toThrow(
      UnprocessableEntityException,
    );
  });

  it('throws UnprocessableEntityException when previousStatus is REJECTED', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'usr_1',
      status: UserStatus.SUSPENDED,
      previousStatus: UserStatus.REJECTED,
      isDeleted: false,
    });

    await expect(usersService.unsuspend('usr_1', 'admin_1')).rejects.toThrow(
      UnprocessableEntityException,
    );
  });

  it('falls back to PENDING_VERIFICATION when previousStatus is null', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'usr_1',
      status: UserStatus.SUSPENDED,
      previousStatus: null,
      isDeleted: false,
    });
    mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

    const result = await usersService.unsuspend('usr_1', 'admin_1');

    expect(result).toEqual({
      statusCode: 200,
      message: 'Account unsuspended successfully',
    });

    expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'usr_1', status: UserStatus.SUSPENDED, isDeleted: false },
      data: { status: UserStatus.PENDING_VERIFICATION, previousStatus: null },
    });

    expect(mockNotifications.emitToCustomer).not.toHaveBeenCalled();
  });
});

describe('UsersService - findAll (search filter)', () => {
  let usersService: UsersService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      user: {
        count: vi.fn(),
        findMany: vi.fn(),
      },
    };
    usersService = new UsersService(
      mockPrisma as any,
      {} as any,
      {} as any,
      {} as any,
    );
  });

  it('filters users with OR on name, whatsapp, and altPhone when search is provided', async () => {
    mockPrisma.user.count.mockResolvedValue(1);
    mockPrisma.user.findMany.mockResolvedValue([
      {
        id: 'u-1',
        name: 'سامر الحلبي',
        whatsapp: '0966445566',
        altPhone: null,
        status: 'VERIFIED',
        createdAt: new Date(),
      },
    ]);

    const res = await usersService.findAll(1, 20, ' سامر ');

    expect(mockPrisma.user.count).toHaveBeenCalledWith({
      where: {
        isDeleted: false,
        role: 'CUSTOMER',
        OR: [
          { name: { contains: 'سامر', mode: 'insensitive' } },
          { whatsapp: { contains: 'سامر' } },
          { altPhone: { contains: 'سامر' } },
        ],
      },
    });

    expect(res.data.length).toBe(1);
    expect(res.data[0].name).toBe('سامر الحلبي');
    expect(res.meta.total).toBe(1);
  });

  it('queries without search OR clause when search is omitted', async () => {
    mockPrisma.user.count.mockResolvedValue(0);
    mockPrisma.user.findMany.mockResolvedValue([]);
    await usersService.findAll(1, 20);

    expect(mockPrisma.user.count).toHaveBeenCalledWith({
      where: {
        isDeleted: false,
        role: 'CUSTOMER',
      },
    });
  });
});

describe('UsersService - resetPassword (AS-2)', () => {
  let usersService: UsersService;
  let mockPrisma: MockPrisma;
  let mockAudit: { log: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockPrisma = {
      $transaction: vi.fn(async (cb) => cb(mockPrisma)),
      user: {
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        count: vi.fn(),
        findMany: vi.fn(),
      },
      refreshToken: {
        updateMany: vi.fn(),
      },
      deviceToken: {
        deleteMany: vi.fn(),
      },
      order: {
        count: vi.fn(),
        findMany: vi.fn(),
      },
      settlement: {
        count: vi.fn(),
      },
      runner: {
        update: vi.fn(),
      },
    };

    mockAudit = {
      log: vi.fn().mockResolvedValue(undefined),
    };

    usersService = new UsersService(
      mockPrisma as unknown as PrismaService,
      mockAudit as unknown as AuditService,
      {} as any,
      {} as any,
    );
  });

  it('throws NotFoundException if user is not found or isDeleted', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(
      usersService.resetPassword('missing_id', 'newPassword123', 'admin_1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws ForbiddenException if target user is an ADMIN', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'admin_target',
      role: 'ADMIN',
      isDeleted: false,
    });

    await expect(
      usersService.resetPassword('admin_target', 'newPassword123', 'admin_1'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('successfully resets password, revokes tokens, deletes device tokens, and audits', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'cust_1',
      role: 'CUSTOMER',
      isDeleted: false,
    });
    mockPrisma.user.update.mockResolvedValue({ id: 'cust_1' });
    mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });
    mockPrisma.deviceToken.deleteMany.mockResolvedValue({ count: 1 });

    const result = await usersService.resetPassword('cust_1', 'SecretPass123', 'admin_1');

    expect(result).toEqual({
      statusCode: 200,
      message: 'Password reset successfully',
    });

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'cust_1' },
      data: { passwordHash: expect.any(String) },
    });

    expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'cust_1', isRevoked: false },
      data: { isRevoked: true, revokedAt: expect.any(Date) },
    });

    expect(mockPrisma.deviceToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'cust_1' },
    });

    expect(mockAudit.log).toHaveBeenCalledWith(
      {
        actorId: 'admin_1',
        actorRole: 'ADMIN',
        event: 'USER_PASSWORD_RESET_BY_ADMIN',
        meta: {
          targetUserId: 'cust_1',
          targetRole: 'CUSTOMER',
        },
      },
      expect.anything(),
    );
  });
});

describe('UsersService - softDelete (AS-3)', () => {
  let usersService: UsersService;
  let mockPrisma: MockPrisma;
  let mockAudit: { log: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockPrisma = {
      $transaction: vi.fn(async (cb) => cb(mockPrisma)),
      user: {
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        count: vi.fn(),
        findMany: vi.fn(),
      },
      refreshToken: {
        updateMany: vi.fn(),
      },
      deviceToken: {
        deleteMany: vi.fn(),
      },
      order: {
        count: vi.fn(),
        findMany: vi.fn(),
      },
      settlement: {
        count: vi.fn(),
      },
      runner: {
        update: vi.fn(),
      },
    };

    mockAudit = {
      log: vi.fn().mockResolvedValue(undefined),
    };

    usersService = new UsersService(
      mockPrisma as unknown as PrismaService,
      mockAudit as unknown as AuditService,
      {} as any,
      {} as any,
    );
  });

  it('throws NotFoundException if user is not found or isDeleted', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(usersService.softDelete('missing', 'admin_1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws ForbiddenException if target user is an ADMIN', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'admin_target',
      role: 'ADMIN',
      isDeleted: false,
    });

    await expect(usersService.softDelete('admin_target', 'admin_1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('throws ConflictException if customer has active orders', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'cust_1',
      role: 'CUSTOMER',
      isDeleted: false,
      customer: { id: 'cust_model_1' },
    });
    mockPrisma.order.count.mockResolvedValue(1);

    await expect(usersService.softDelete('cust_1', 'admin_1')).rejects.toThrow(
      ConflictException,
    );
  });

  it('throws ConflictException if runner has active assigned orders', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'runner_usr',
      role: 'RUNNER',
      isDeleted: false,
      runner: { id: 'runner_model_1' },
    });
    // First count: active runner orders
    mockPrisma.order.count.mockResolvedValueOnce(1);

    await expect(usersService.softDelete('runner_usr', 'admin_1')).rejects.toThrow(
      ConflictException,
    );
  });

  it('throws ConflictException if runner has delivered orders awaiting daily settlement closure', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'runner_usr',
      role: 'RUNNER',
      isDeleted: false,
      runner: { id: 'runner_model_1' },
    });
    // First count: active assigned = 0
    mockPrisma.order.count.mockResolvedValueOnce(0);
    // Second count: unsettled delivered orders = 2
    mockPrisma.order.count.mockResolvedValueOnce(2);

    await expect(usersService.softDelete('runner_usr', 'admin_1')).rejects.toThrow(
      ConflictException,
    );
  });

  it('throws ConflictException if runner has pending settlements', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'runner_usr',
      role: 'RUNNER',
      isDeleted: false,
      runner: { id: 'runner_model_1' },
    });
    // First count: active assigned = 0
    mockPrisma.order.count.mockResolvedValueOnce(0);
    // Second count: unsettled delivered = 0
    mockPrisma.order.count.mockResolvedValueOnce(0);
    // Third count: pending settlements = 1
    mockPrisma.settlement.count.mockResolvedValueOnce(1);

    await expect(usersService.softDelete('runner_usr', 'admin_1')).rejects.toThrow(
      ConflictException,
    );
  });

  it('successfully soft deletes customer when no active orders exist', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'cust_1',
      role: 'CUSTOMER',
      isDeleted: false,
      customer: { id: 'cust_model_1' },
    });
    mockPrisma.order.count.mockResolvedValue(0);
    mockPrisma.user.update.mockResolvedValue({ id: 'cust_1', isDeleted: true });
    mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.deviceToken.deleteMany.mockResolvedValue({ count: 1 });

    const result = await usersService.softDelete('cust_1', 'admin_1', 'Customer requested closure');

    expect(result).toEqual({
      statusCode: 200,
      message: 'User archived successfully',
    });

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'cust_1' },
      data: { isDeleted: true },
    });

    expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'cust_1', isRevoked: false },
      data: { isRevoked: true, revokedAt: expect.any(Date) },
    });

    expect(mockAudit.log).toHaveBeenCalledWith(
      {
        actorId: 'admin_1',
        actorRole: 'ADMIN',
        event: 'USER_SOFT_DELETED',
        meta: {
          targetUserId: 'cust_1',
          targetRole: 'CUSTOMER',
          reason: 'Customer requested closure',
        },
      },
      expect.anything(),
    );
  });

  it('successfully soft deletes runner when no blockers exist, deactivating runner state', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'runner_usr',
      role: 'RUNNER',
      isDeleted: false,
      runner: { id: 'runner_model_1' },
    });
    mockPrisma.order.count.mockResolvedValue(0);
    mockPrisma.settlement.count.mockResolvedValue(0);
    mockPrisma.runner.update.mockResolvedValue({ id: 'runner_model_1' });
    mockPrisma.user.update.mockResolvedValue({ id: 'runner_usr', isDeleted: true });
    mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.deviceToken.deleteMany.mockResolvedValue({ count: 1 });

    const result = await usersService.softDelete('runner_usr', 'admin_1');

    expect(result).toEqual({
      statusCode: 200,
      message: 'User archived successfully',
    });

    expect(mockPrisma.runner.update).toHaveBeenCalledWith({
      where: { id: 'runner_model_1' },
      data: {
        status: 'UNAVAILABLE',
        isVisible: false,
      },
    });

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'runner_usr' },
      data: { isDeleted: true },
    });
  });
});


describe('UsersService - getAuditLogs (CD-3)', () => {
  let usersService: UsersService;
  let mockPrisma: MockPrisma;

  beforeEach(() => {
    mockPrisma = {
      $transaction: vi.fn(async (cb) => cb(mockPrisma)),
      user: {
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        count: vi.fn(),
        findMany: vi.fn(),
      },
      refreshToken: {
        updateMany: vi.fn(),
      },
      deviceToken: {
        deleteMany: vi.fn(),
      },
      order: {
        count: vi.fn(),
        findMany: vi.fn(),
      },
      settlement: {
        count: vi.fn(),
      },
      runner: {
        update: vi.fn(),
      },
      auditLog: {
        findMany: vi.fn(),
      },
    };

    usersService = new UsersService(
      mockPrisma as unknown as PrismaService,
      {} as any,
      {} as any,
      {} as any,
    );
  });
  it('throws NotFoundException if user is not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(usersService.getAuditLogs('nonexistent_id')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws ForbiddenException if target user is an ADMIN', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'admin_usr',
      role: 'ADMIN',
    });

    await expect(usersService.getAuditLogs('admin_usr')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('returns mapped audit logs with actorName for customer or runner', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'cust_123',
      role: 'CUSTOMER',
    });

    const mockDate = new Date('2026-10-29T10:00:00Z');
    mockPrisma.auditLog.findMany.mockResolvedValue([
      {
        id: 'log_1',
        actorId: 'admin_1',
        actorRole: 'ADMIN',
        event: 'USER_PASSWORD_RESET_BY_ADMIN',
        fromStatus: null,
        toStatus: null,
        meta: { targetUserId: 'cust_123' },
        createdAt: mockDate,
        actor: {
          id: 'admin_1',
          name: 'Super Admin',
          role: 'ADMIN',
        },
      },
      {
        id: 'log_2',
        actorId: 'cust_123',
        actorRole: 'CUSTOMER',
        event: 'USER_REGISTERED',
        fromStatus: null,
        toStatus: 'PENDING_VERIFICATION',
        meta: { userId: 'cust_123' },
        createdAt: mockDate,
        actor: {
          id: 'cust_123',
          name: 'Ahmad Customer',
          role: 'CUSTOMER',
        },
      },
      {
        id: 'log_3',
        actorId: null,
        actorRole: null,
        event: 'SYSTEM_EVENT',
        fromStatus: null,
        toStatus: null,
        meta: { userId: 'cust_123' },
        createdAt: mockDate,
        actor: null,
      },
    ]);

    const result = await usersService.getAuditLogs('cust_123');

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      id: 'log_1',
      actorId: 'admin_1',
      actorRole: 'ADMIN',
      actorName: 'Super Admin',
      event: 'USER_PASSWORD_RESET_BY_ADMIN',
      fromStatus: null,
      toStatus: null,
      meta: { targetUserId: 'cust_123' },
      createdAt: mockDate,
    });
    expect(result[1]).toEqual({
      id: 'log_2',
      actorId: 'cust_123',
      actorRole: 'CUSTOMER',
      actorName: 'Ahmad Customer',
      event: 'USER_REGISTERED',
      fromStatus: null,
      toStatus: 'PENDING_VERIFICATION',
      meta: { userId: 'cust_123' },
      createdAt: mockDate,
    });
    expect(result[2]).toEqual({
      id: 'log_3',
      actorId: null,
      actorRole: null,
      actorName: null,
      event: 'SYSTEM_EVENT',
      fromStatus: null,
      toStatus: null,
      meta: { userId: 'cust_123' },
      createdAt: mockDate,
    });

    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { actorId: 'cust_123' },
          { meta: { path: ['userId'], equals: 'cust_123' } },
          { meta: { path: ['targetUserId'], equals: 'cust_123' } },
        ],
      },
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  });
});


describe('UsersService - findOne (CD-2)', () => {
  let usersService: UsersService;
  let mockPrisma: MockPrisma;

  beforeEach(() => {
    mockPrisma = {
      $transaction: vi.fn(async (cb) => cb(mockPrisma)),
      user: {
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        count: vi.fn(),
        findMany: vi.fn(),
      },
      refreshToken: {
        updateMany: vi.fn(),
      },
      deviceToken: {
        deleteMany: vi.fn(),
      },
      order: {
        count: vi.fn(),
        findMany: vi.fn(),
      },
      settlement: {
        count: vi.fn(),
      },
      runner: {
        update: vi.fn(),
      },
      auditLog: {
        findMany: vi.fn(),
      },
    };

    usersService = new UsersService(
      mockPrisma as unknown as PrismaService,
      {} as any,
      {} as any,
      {} as any,
    );
  });

  it('throws NotFoundException if user is not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(usersService.findOne('nonexistent_id')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws ForbiddenException if target user is an ADMIN', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'admin_usr',
      role: 'ADMIN',
    });

    await expect(usersService.findOne('admin_usr')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('throws NotFoundException if user has no customer profile', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'usr_no_cust',
      role: 'CUSTOMER',
      customer: null,
    });

    await expect(usersService.findOne('usr_no_cust')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('returns full customer details with stats and recent orders mapped properly', async () => {
    const mockCreatedAt = new Date('2026-10-01T12:00:00Z');
    const mockOrderDate = new Date('2026-10-28T14:30:00Z');

    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'cust_user_1',
      name: 'Salim Customer',
      whatsapp: '+963911223344',
      altPhone: '+963922334455',
      role: 'CUSTOMER',
      status: 'VERIFIED',
      createdAt: mockCreatedAt,
      updatedAt: mockCreatedAt,
      customer: {
        id: 'cust_model_1',
        completedOrders: 5,
        totalFeesPaid: 2500,
        createdAt: mockCreatedAt,
        address: {
          id: 'addr_1',
          lat: 33.5138,
          lng: 36.2765,
          description: 'Mazza Highway, Building 10',
          createdAt: mockCreatedAt,
          updatedAt: mockCreatedAt,
        },
      },
    });

    // Mock recent orders
    mockPrisma.order.findMany.mockResolvedValue([
      {
        id: 'ord_1',
        orderNumber: 'ORD-101',
        status: 'DELIVERED',
        totalFee: 500,
        createdAt: mockOrderDate,
      },
    ]);

    // Mock counts: cancelledOrders = 2, totalOrders = 8
    mockPrisma.order.count
      .mockResolvedValueOnce(2) // cancelledOrders
      .mockResolvedValueOnce(8); // totalOrders

    const result = await usersService.findOne('cust_user_1');

    expect(result).toEqual({
      id: 'cust_user_1',
      name: 'Salim Customer',
      whatsapp: '+963911223344',
      altPhone: '+963922334455',
      role: 'CUSTOMER',
      status: 'VERIFIED',
      createdAt: mockCreatedAt,
      updatedAt: mockCreatedAt,
      customer: {
        id: 'cust_model_1',
        completedOrders: 5,
        totalFeesPaid: 2500,
        createdAt: mockCreatedAt,
      },
      address: {
        id: 'addr_1',
        lat: 33.5138,
        lng: 36.2765,
        description: 'Mazza Highway, Building 10',
        createdAt: mockCreatedAt,
        updatedAt: mockCreatedAt,
      },
      stats: {
        completedOrders: 5,
        cancelledOrders: 2,
        totalOrders: 8,
        totalFeesPaid: 2500,
      },
      recentOrders: [
        {
          id: 'ord_1',
          orderNumber: 'ORD-101',
          status: 'DELIVERED',
          totalFee: 500,
          createdAt: mockOrderDate,
        },
      ],
    });

    expect(mockPrisma.order.findMany).toHaveBeenCalledWith({
      where: { customerId: 'cust_model_1' },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalFee: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
  });
});
