import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeviceTokenSchema, type DeviceTokenRequest } from '@forerun/shared-types';
import { CustomersService } from '../../src/modules/customers/customers.service.js';
import { CustomersController } from '../../src/modules/customers/customers.controller.js';
import type { PrismaService } from '../../src/database/prisma.service.js';
import type { AuditService } from '../../src/modules/audit/audit.service.js';

describe('DeviceToken & Customer Push Notification Token CRUD', () => {
  describe('1. DeviceTokenSchema (Zod Validation)', () => {
    it('accepts valid token with default platform android', () => {
      const parsed = DeviceTokenSchema.safeParse({
        token: 'fcm_sample_token_abc_123',
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.token).toBe('fcm_sample_token_abc_123');
        expect(parsed.data.platform).toBe('android');
      }
    });

    it('accepts valid token with explicit platform ios', () => {
      const parsed = DeviceTokenSchema.safeParse({
        token: 'apns_sample_token_xyz_456',
        platform: 'ios',
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.platform).toBe('ios');
      }
    });

    it('accepts valid token with explicit platform web', () => {
      const parsed = DeviceTokenSchema.safeParse({
        token: 'web_push_token_789',
        platform: 'web',
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.platform).toBe('web');
      }
    });

    it('rejects empty string token', () => {
      const parsed = DeviceTokenSchema.safeParse({
        token: '',
      });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0]?.message).toBe('Token is required');
      }
    });

    it('rejects missing token field', () => {
      const parsed = DeviceTokenSchema.safeParse({});
      expect(parsed.success).toBe(false);
    });

    it('rejects invalid platform value', () => {
      const parsed = DeviceTokenSchema.safeParse({
        token: 'fcm_token_valid',
        platform: 'windows_phone',
      });
      expect(parsed.success).toBe(false);
    });

    it('strips unknown extra fields cleanly', () => {
      const parsed = DeviceTokenSchema.safeParse({
        token: 'fcm_token_valid',
        extraField: 'malicious_or_unknown',
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect((parsed.data as Record<string, unknown>).extraField).toBeUndefined();
      }
    });
  });

  describe('2. CustomersService.registerDeviceToken (CRUD: Create & Duplicate)', () => {
    let service: CustomersService;
    let mockPrisma: {
      deviceToken: {
        upsert: ReturnType<typeof vi.fn>;
        deleteMany: ReturnType<typeof vi.fn>;
      };
    };
    let mockAuditService: { log: ReturnType<typeof vi.fn> };

    beforeEach(() => {
      mockPrisma = {
        deviceToken: {
          upsert: vi.fn(),
          deleteMany: vi.fn(),
        },
      };
      mockAuditService = { log: vi.fn() };
      service = new CustomersService(
        mockPrisma as unknown as PrismaService,
        mockAuditService as unknown as AuditService,
      );
    });

    it('creates a new device token record via upsert for user', async () => {
      mockPrisma.deviceToken.upsert.mockResolvedValue({
        id: 'dt-1',
        userId: 'user-100',
        token: 'fcm_token_alpha',
        platform: 'android',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const dto: DeviceTokenRequest = {
        token: 'fcm_token_alpha',
        platform: 'android',
      };

      const result = await service.registerDeviceToken('user-100', dto);

      expect(result).toEqual({ success: true });
      expect(mockPrisma.deviceToken.upsert).toHaveBeenCalledWith({
        where: { token: 'fcm_token_alpha' },
        create: {
          userId: 'user-100',
          token: 'fcm_token_alpha',
          platform: 'android',
        },
        update: {
          userId: 'user-100',
          platform: 'android',
        },
      });
    });

    it('handles duplicate token registration for same user seamlessly (idempotent)', async () => {
      mockPrisma.deviceToken.upsert.mockResolvedValue({
        id: 'dt-1',
        userId: 'user-100',
        token: 'fcm_token_alpha',
        platform: 'android',
        createdAt: new Date('2026-10-01T10:00:00Z'),
        updatedAt: new Date('2026-10-22T10:00:00Z'),
      });

      const dto: DeviceTokenRequest = {
        token: 'fcm_token_alpha',
        platform: 'android',
      };

      // Calling twice with same token and user
      const res1 = await service.registerDeviceToken('user-100', dto);
      const res2 = await service.registerDeviceToken('user-100', dto);

      expect(res1).toEqual({ success: true });
      expect(res2).toEqual({ success: true });
      expect(mockPrisma.deviceToken.upsert).toHaveBeenCalledTimes(2);
    });

    it('reassigns token to a new user when device is shared/transferred', async () => {
      mockPrisma.deviceToken.upsert.mockResolvedValue({
        id: 'dt-1',
        userId: 'user-200', // newly updated owner
        token: 'shared_device_token',
        platform: 'android',
        createdAt: new Date('2026-10-01T10:00:00Z'),
        updatedAt: new Date('2026-10-22T12:00:00Z'),
      });

      const dto: DeviceTokenRequest = {
        token: 'shared_device_token',
        platform: 'android',
      };

      const result = await service.registerDeviceToken('user-200', dto);

      expect(result).toEqual({ success: true });
      expect(mockPrisma.deviceToken.upsert).toHaveBeenCalledWith({
        where: { token: 'shared_device_token' },
        create: {
          userId: 'user-200',
          token: 'shared_device_token',
          platform: 'android',
        },
        update: {
          userId: 'user-200',
          platform: 'android',
        },
      });
    });
  });

  describe('3. CustomersService.unregisterDeviceToken (CRUD: Delete & Missing Record)', () => {
    let service: CustomersService;
    let mockPrisma: {
      deviceToken: {
        upsert: ReturnType<typeof vi.fn>;
        deleteMany: ReturnType<typeof vi.fn>;
      };
    };
    let mockAuditService: { log: ReturnType<typeof vi.fn> };

    beforeEach(() => {
      mockPrisma = {
        deviceToken: {
          upsert: vi.fn(),
          deleteMany: vi.fn(),
        },
      };
      mockAuditService = { log: vi.fn() };
      service = new CustomersService(
        mockPrisma as unknown as PrismaService,
        mockAuditService as unknown as AuditService,
      );
    });

    it('successfully deletes an existing token for the user', async () => {
      mockPrisma.deviceToken.deleteMany.mockResolvedValue({ count: 1 });

      const dto: DeviceTokenRequest = {
        token: 'fcm_token_to_remove',
        platform: 'android',
      };

      const result = await service.unregisterDeviceToken('user-100', dto);

      expect(result).toEqual({ success: true });
      expect(mockPrisma.deviceToken.deleteMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-100',
          token: 'fcm_token_to_remove',
        },
      });
    });

    it('handles non-existent record deletion gracefully (count: 0) without throwing', async () => {
      mockPrisma.deviceToken.deleteMany.mockResolvedValue({ count: 0 });

      const dto: DeviceTokenRequest = {
        token: 'non_existent_token',
        platform: 'android',
      };

      const result = await service.unregisterDeviceToken('user-100', dto);

      expect(result).toEqual({ success: true });
      expect(mockPrisma.deviceToken.deleteMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-100',
          token: 'non_existent_token',
        },
      });
    });

    it('ensures userId is strictly scoped so users cannot delete other users tokens', async () => {
      mockPrisma.deviceToken.deleteMany.mockResolvedValue({ count: 0 });

      const dto: DeviceTokenRequest = {
        token: 'target_victim_token',
        platform: 'android',
      };

      await service.unregisterDeviceToken('attacker_user_id', dto);

      expect(mockPrisma.deviceToken.deleteMany).toHaveBeenCalledWith({
        where: {
          userId: 'attacker_user_id',
          token: 'target_victim_token',
        },
      });
    });
  });

  describe('4. CustomersController (Device Token Endpoints)', () => {
    let controller: CustomersController;
    let mockCustomersService: {
      registerDeviceToken: ReturnType<typeof vi.fn>;
      unregisterDeviceToken: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
      mockCustomersService = {
        registerDeviceToken: vi.fn().mockResolvedValue({ success: true }),
        unregisterDeviceToken: vi.fn().mockResolvedValue({ success: true }),
      };
      controller = new CustomersController(
        mockCustomersService as unknown as CustomersService,
      );
    });

    it('POST /customer/me/device-token extracts userId from JWT user and delegates to service', async () => {
      const mockUser = {
        userId: 'usr-customer-42',
        role: 'CUSTOMER',
        status: 'VERIFIED',
      };
      const dto: DeviceTokenRequest = {
        token: 'fcm_endpoint_token',
        platform: 'android',
      };

      const res = await controller.registerDeviceToken(mockUser, dto);

      expect(res).toEqual({ success: true });
      expect(mockCustomersService.registerDeviceToken).toHaveBeenCalledWith(
        'usr-customer-42',
        dto,
      );
    });

    it('DELETE /customer/me/device-token extracts userId from JWT user and delegates to service', async () => {
      const mockUser = {
        userId: 'usr-customer-42',
        role: 'CUSTOMER',
        status: 'VERIFIED',
      };
      const dto: DeviceTokenRequest = {
        token: 'fcm_endpoint_token',
        platform: 'android',
      };

      const res = await controller.unregisterDeviceToken(mockUser, dto);

      expect(res).toEqual({ success: true });
      expect(mockCustomersService.unregisterDeviceToken).toHaveBeenCalledWith(
        'usr-customer-42',
        dto,
      );
    });
  });
});
