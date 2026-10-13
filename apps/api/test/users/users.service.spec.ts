import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
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
  };
  refreshToken: {
    updateMany: ReturnType<typeof vi.fn>;
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
      },
      refreshToken: {
        updateMany: vi.fn(),
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
      data: expect.objectContaining({ isRevoked: true }),
    });

    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'admin_1',
        actorRole: 'ADMIN',
        event: 'USER_UNSUSPENDED',
        fromStatus: UserStatus.SUSPENDED,
        toStatus: UserStatus.VERIFIED,
        meta: { userId: 'usr_1', restoredStatus: UserStatus.VERIFIED },
      }),
      mockPrisma,
    );
  });

  it('rejects unsuspending a REJECTED user (prevents unlawful privilege escalation)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'usr_2',
      status: UserStatus.REJECTED,
      isDeleted: false,
    });

    await expect(usersService.unsuspend('usr_2', 'admin_1')).rejects.toThrow(
      UnprocessableEntityException,
    );
    expect(mockPrisma.user.updateMany).not.toHaveBeenCalled();
  });

  it('throws NotFoundException if user not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(usersService.unsuspend('usr_x', 'admin_1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws UnprocessableEntityException if user is already VERIFIED', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'usr_3',
      status: UserStatus.VERIFIED,
      isDeleted: false,
    });

    await expect(usersService.unsuspend('usr_3', 'admin_1')).rejects.toThrow(
      UnprocessableEntityException,
    );
  });

  it('throws UnprocessableEntityException if user is PENDING_VERIFICATION', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'usr_4',
      status: UserStatus.PENDING_VERIFICATION,
      isDeleted: false,
    });

    await expect(usersService.unsuspend('usr_4', 'admin_1')).rejects.toThrow(
      UnprocessableEntityException,
    );
  });
});
