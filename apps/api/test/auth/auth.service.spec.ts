import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

vi.mock('bcrypt', () => ({
  compare: vi.fn(),
  hash: vi.fn(),
}));

import { AuthService } from '../../src/modules/auth/auth.service.js';
import { CONFIG, LOGIN_LOCKED_MESSAGE, ACCOUNT_SUSPENDED_MESSAGE } from '@forerun/shared-constants';
import type { PrismaService } from '../../src/database/prisma.service.js';
import type { JwtService } from '@nestjs/jwt';
import type { AuditService } from '../../src/modules/audit/audit.service.js';
import type { NotificationsService } from '../../src/modules/notifications/notifications.service.js';
import type { TelegramService } from '../../src/modules/notifications/telegram.service.js';
import type { PricingService } from '../../src/modules/pricing/pricing.service.js';

describe('AuthService - Login Lockout Unit Tests (BF-2)', () => {
  let authService: AuthService;
  let mockPrisma: any;
  let mockJwt: any;
  let mockAudit: any;
  let mockNotifications: any;
  let mockTelegram: any;
  let mockPricing: any;

  const mockUser = {
    id: 'user-123',
    whatsapp: '0912345678',
    passwordHash: '$2b$10$hashedpassword',
    name: 'Test User',
    role: 'CUSTOMER',
    status: 'VERIFIED',
    isDeleted: false,
    failedLoginAttempts: 0,
    loginLockedAt: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockPrisma = {
      user: {
        findUnique: vi.fn(),
        update: vi.fn().mockResolvedValue({}),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      refreshToken: {
        create: vi.fn().mockResolvedValue({}),
      },
      $transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => {
        return cb(mockPrisma);
      }),
    };

    mockJwt = {
      sign: vi.fn().mockReturnValue('mock.jwt.token'),
    };

    mockAudit = {
      log: vi.fn().mockResolvedValue(undefined),
    };

    mockNotifications = {};
    mockTelegram = {
      sendMessage: vi.fn().mockResolvedValue(undefined),
    };
    mockPricing = {};

    authService = new AuthService(
      mockPrisma as unknown as PrismaService,
      mockJwt as unknown as JwtService,
      mockAudit as unknown as AuditService,
      mockNotifications as unknown as NotificationsService,
      mockTelegram as unknown as TelegramService,
      mockPricing as unknown as PricingService,
    );
  });

  it('progressively increments failed attempts up to 5 and locks the account on the 5th attempt', async () => {
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

    let currentAttempts = 0;

    for (let attempt = 1; attempt <= 4; attempt++) {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        ...mockUser,
        failedLoginAttempts: currentAttempts,
        loginLockedAt: null,
      });

      await expect(
        authService.login({ whatsapp: '0912345678', password: 'wrongpassword' }),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockPrisma.user.updateMany).toHaveBeenLastCalledWith({
        where: {
          id: mockUser.id,
          failedLoginAttempts: currentAttempts,
          loginLockedAt: null,
        },
        data: {
          failedLoginAttempts: currentAttempts + 1,
        },
      });

      expect(mockAudit.log).not.toHaveBeenCalled();
      currentAttempts++;
    }

    // 5th attempt reaches threshold (CONFIG.MAX_FAILED_LOGIN_ATTEMPTS = 5)
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      ...mockUser,
      failedLoginAttempts: 4,
      loginLockedAt: null,
    });

    await expect(
      authService.login({ whatsapp: '0912345678', password: 'wrongpassword' }),
    ).rejects.toThrow(new ForbiddenException(LOGIN_LOCKED_MESSAGE));

    expect(mockPrisma.user.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          id: mockUser.id,
          failedLoginAttempts: 4,
          loginLockedAt: null,
        },
        data: expect.objectContaining({
          failedLoginAttempts: 5,
          loginLockedAt: expect.any(Date),
        }),
      }),
    );

    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: mockUser.id,
        actorRole: mockUser.role,
        event: 'USER_LOGIN_LOCKED',
        meta: expect.objectContaining({
          userId: mockUser.id,
          failedLoginAttempts: 5,
        }),
      }),
    );
  });

  it('rejects a 6th attempt immediately with 403 Forbidden without comparing password when account is locked', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      ...mockUser,
      failedLoginAttempts: 5,
      loginLockedAt: new Date(),
    });

    await expect(
      authService.login({ whatsapp: '0912345678', password: 'evenCorrectPassword' }),
    ).rejects.toThrow(new ForbiddenException(LOGIN_LOCKED_MESSAGE));

    expect(bcrypt.compare).not.toHaveBeenCalled();
    expect(mockPrisma.user.updateMany).not.toHaveBeenCalled();
  });

  it('successful login resets failedLoginAttempts and loginLockedAt if previously non-zero', async () => {
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
    vi.mocked(bcrypt.hash).mockResolvedValue('hashedToken' as never);

    mockPrisma.user.findUnique.mockResolvedValueOnce({
      ...mockUser,
      failedLoginAttempts: 3,
      loginLockedAt: null,
    });

    const result = await authService.login({
      whatsapp: '0912345678',
      password: 'correctpassword',
    });

    expect(result.accessToken).toBe('mock.jwt.token');
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: mockUser.id },
      data: {
        failedLoginAttempts: 0,
        loginLockedAt: null,
      },
    });
  });

  it('successful login does not issue an unnecessary user update if attempts are already zero and not locked', async () => {
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
    vi.mocked(bcrypt.hash).mockResolvedValue('hashedToken' as never);

    mockPrisma.user.findUnique.mockResolvedValueOnce({
      ...mockUser,
      failedLoginAttempts: 0,
      loginLockedAt: null,
    });

    const result = await authService.login({
      whatsapp: '0912345678',
      password: 'correctpassword',
    });

    expect(result.accessToken).toBe('mock.jwt.token');
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it('lockout check takes precedence over SUSPENDED user status', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      ...mockUser,
      status: 'SUSPENDED',
      failedLoginAttempts: 5,
      loginLockedAt: new Date(),
    });

    await expect(
      authService.login({ whatsapp: '0912345678', password: 'password' }),
    ).rejects.toThrow(new ForbiddenException(LOGIN_LOCKED_MESSAGE));
  });

  it('rejects suspended user if not locked', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      ...mockUser,
      status: 'SUSPENDED',
      failedLoginAttempts: 0,
      loginLockedAt: null,
    });

    await expect(
      authService.login({ whatsapp: '0912345678', password: 'password' }),
    ).rejects.toThrow(new UnauthorizedException(ACCOUNT_SUSPENDED_MESSAGE));
  });
});
