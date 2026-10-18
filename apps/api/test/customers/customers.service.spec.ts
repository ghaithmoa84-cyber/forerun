import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UpdateCustomerSchema } from '@forerun/shared-types';

vi.mock('@prisma/client', () => ({
  PrismaClient: class {},
  Prisma: {},
}));

vi.mock('../../src/database/prisma.service.js', () => ({
  PrismaService: class {},
}));

import { CustomersService } from '../../src/modules/customers/customers.service';
import type { PrismaService } from '../../src/database/prisma.service';
import type { AuditService } from '../../src/modules/audit/audit.service';

interface MockPrisma {
  customer: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  user: {
    update: ReturnType<typeof vi.fn>;
  };
  refreshToken: {
    updateMany: ReturnType<typeof vi.fn>;
  };
  $transaction: (cb: (tx: MockPrisma) => Promise<unknown>) => Promise<unknown>;
}

describe('SEC-05 — Current password requirement on profile update', () => {
  describe('UpdateCustomerSchema (Zod Validation)', () => {
    it('1. accepts profile update without password field', () => {
      const result = UpdateCustomerSchema.safeParse({
        name: 'سامر أحمد',
        altPhone: '0933111222',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('سامر أحمد');
        expect(result.data.altPhone).toBe('0933111222');
      }
    });

    it('2. rejects password update when currentPassword is completely missing', () => {
      const result = UpdateCustomerSchema.safeParse({
        password: 'NewStrongPassword@123',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const issues = result.error.issues;
        expect(issues.some((issue) => issue.path.includes('currentPassword'))).toBe(true);
      }
    });

    it('3. rejects password update when currentPassword is an empty string', () => {
      const result = UpdateCustomerSchema.safeParse({
        password: 'NewStrongPassword@123',
        currentPassword: '   ',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const issues = result.error.issues;
        expect(issues.some((issue) => issue.path.includes('currentPassword'))).toBe(true);
      }
    });

    it('4. accepts password update when currentPassword is provided', () => {
      const result = UpdateCustomerSchema.safeParse({
        password: 'NewStrongPassword@123',
        currentPassword: 'OldPassword@123',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.password).toBe('NewStrongPassword@123');
        expect(result.data.currentPassword).toBe('OldPassword@123');
      }
    });
  });

  describe('CustomersService.updateProfile', () => {
    let service: CustomersService;
    let mockPrisma: MockPrisma;
    let mockAudit: { log: ReturnType<typeof vi.fn> };
    const oldPasswordHash = bcrypt.hashSync('CorrectOldPass@123', 8);

    beforeEach(() => {
      mockPrisma = {
        customer: {
          findUnique: vi.fn(),
        },
        user: {
          update: vi.fn(),
        },
        refreshToken: {
          updateMany: vi.fn(),
        },
        $transaction: vi.fn(async (cb) => {
          return cb(mockPrisma);
        }),
      };

      mockAudit = {
        log: vi.fn().mockResolvedValue(undefined),
      };

      service = new CustomersService(
        mockPrisma as unknown as PrismaService,
        mockAudit as unknown as AuditService,
      );
    });

    it('5. throws NotFoundException if customer does not exist', async () => {
      mockPrisma.customer.findUnique.mockResolvedValue(null);

      await expect(
        service.updateProfile('cust_unknown', { name: 'New Name' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('6. successfully updates profile without touching password or currentPassword', async () => {
      mockPrisma.customer.findUnique.mockResolvedValue({
        id: 'cust_1',
        userId: 'usr_1',
        user: {
          id: 'usr_1',
          name: 'Old Name',
          whatsapp: '0999123456',
          altPhone: null,
          status: 'VERIFIED',
          passwordHash: oldPasswordHash,
        },
      });

      mockPrisma.user.update.mockResolvedValue({
        id: 'usr_1',
        name: 'New Name',
        whatsapp: '0999123456',
        altPhone: null,
        status: 'VERIFIED',
      });

      const res = await service.updateProfile('usr_1', { name: 'New Name' });

      expect(res.name).toBe('New Name');
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { name: 'New Name' },
        }),
      );
      expect(mockPrisma.refreshToken.updateMany).not.toHaveBeenCalled();
    });

    it('7. throws BadRequestException when password is provided without currentPassword', async () => {
      mockPrisma.customer.findUnique.mockResolvedValue({
        id: 'cust_1',
        userId: 'usr_1',
        user: {
          id: 'usr_1',
          name: 'Old Name',
          whatsapp: '0999123456',
          altPhone: null,
          status: 'VERIFIED',
          passwordHash: oldPasswordHash,
        },
      });

      await expect(
        service.updateProfile('usr_1', {
          password: 'NewStrongPassword@123',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('8. throws UnauthorizedException when currentPassword is incorrect', async () => {
      mockPrisma.customer.findUnique.mockResolvedValue({
        id: 'cust_1',
        userId: 'usr_1',
        user: {
          id: 'usr_1',
          name: 'Old Name',
          whatsapp: '0999123456',
          altPhone: null,
          status: 'VERIFIED',
          passwordHash: oldPasswordHash,
        },
      });

      await expect(
        service.updateProfile('usr_1', {
          password: 'NewStrongPassword@123',
          currentPassword: 'WrongPassword@123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('9. successfully updates password when currentPassword is valid and revokes refresh tokens', async () => {
      mockPrisma.customer.findUnique.mockResolvedValue({
        id: 'cust_1',
        userId: 'usr_1',
        user: {
          id: 'usr_1',
          name: 'Old Name',
          whatsapp: '0999123456',
          altPhone: null,
          status: 'VERIFIED',
          passwordHash: oldPasswordHash,
        },
      });

      mockPrisma.user.update.mockResolvedValue({
        id: 'usr_1',
        name: 'Old Name',
        whatsapp: '0999123456',
        altPhone: null,
        status: 'VERIFIED',
      });

      mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      const res = await service.updateProfile('usr_1', {
        password: 'NewStrongPassword@123',
        currentPassword: 'CorrectOldPass@123',
      });

      expect(res.id).toBe('usr_1');
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'usr_1' },
          data: expect.objectContaining({
            passwordHash: expect.any(String),
          }),
        }),
      );
      // Ensure refresh tokens are revoked
      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'usr_1', isRevoked: false },
        data: { isRevoked: true },
      });
      // Ensure audit logged
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 'usr_1',
          actorRole: 'CUSTOMER',
          event: 'CUSTOMER_PROFILE_UPDATED',
        }),
        expect.anything(),
      );
    });
  });
});
