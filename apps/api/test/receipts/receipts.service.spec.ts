import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';

vi.mock('@prisma/client', () => ({
  PrismaClient: class {},
  Prisma: {},
}));

vi.mock('../../src/database/prisma.service.js', () => ({
  PrismaService: class {},
}));

import { ReceiptsService } from '../../src/modules/receipts/receipts.service';
import type { PrismaService } from '../../src/database/prisma.service';
import type { AuditService } from '../../src/modules/audit/audit.service';
import type { R2Service } from '../../src/modules/receipts/r2.service';

interface MockPrisma {
  receipt: {
    create: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  orderStore: {
    findUnique: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
  };
  runner: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  order: {
    findFirst: ReturnType<typeof vi.fn>;
  };
  $transaction: (cb: (tx: MockPrisma) => Promise<unknown>) => Promise<unknown>;
}

describe('SEC-03 — r2Key prefix validation in receipts.service', () => {
  let service: ReceiptsService;
  let mockPrisma: MockPrisma;
  let mockAudit: { log: ReturnType<typeof vi.fn> };
  let mockR2: {
    generatePresignedUrl: ReturnType<typeof vi.fn>;
    deleteObject: ReturnType<typeof vi.fn>;
    getPublicUrl: ReturnType<typeof vi.fn>;
  };

  const orderId = 'ord-100';
  const orderStoreId = 'store-200';

  beforeEach(() => {
    mockPrisma = {
      receipt: {
        create: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
      },
      orderStore: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
      },
      runner: {
        findUnique: vi.fn(),
      },
      order: {
        findFirst: vi.fn(),
      },
      $transaction: vi.fn(async (cb) => {
        return cb(mockPrisma);
      }),
    };

    mockAudit = {
      log: vi.fn().mockResolvedValue(undefined),
    };

    mockR2 = {
      generatePresignedUrl: vi.fn(),
      deleteObject: vi.fn().mockResolvedValue(undefined),
      getPublicUrl: vi.fn((key: string) => `https://r2.forerun.com/${key}`),
    };

    service = new ReceiptsService(
      mockPrisma as unknown as PrismaService,
      mockAudit as unknown as AuditService,
      mockR2 as unknown as R2Service,
    );
  });

  describe('createReceipt', () => {
    it('1. accepts r2Key that correctly starts with receipts/${orderId}/${orderStoreId}/', async () => {
      const validKey = `receipts/${orderId}/${orderStoreId}/123_abc.jpg`;
      mockPrisma.receipt.create.mockResolvedValue({
        id: 'rcpt-1',
        orderStoreId,
        r2Key: validKey,
        imageUrl: `https://r2.forerun.com/${validKey}`,
        isDeleted: false,
        deletedAt: null,
        uploadedAt: new Date(),
      });

      const res = await service.createReceipt(orderId, orderStoreId, {
        r2Key: validKey,
      });

      expect(res.id).toBe('rcpt-1');
      expect(res.r2Key).toBe(validKey);
      expect(mockPrisma.receipt.create).toHaveBeenCalledWith({
        data: {
          orderStoreId,
          r2Key: validKey,
          imageUrl: `https://r2.forerun.com/${validKey}`,
          isDeleted: false,
        },
      });
    });

    it('2. rejects r2Key with spoofed orderId', async () => {
      const spoofedKey = `receipts/other-order-999/${orderStoreId}/123_abc.jpg`;

      await expect(
        service.createReceipt(orderId, orderStoreId, { r2Key: spoofedKey }),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.receipt.create).not.toHaveBeenCalled();
    });

    it('3. rejects r2Key with spoofed storeId', async () => {
      const spoofedKey = `receipts/${orderId}/other-store-888/123_abc.jpg`;

      await expect(
        service.createReceipt(orderId, orderStoreId, { r2Key: spoofedKey }),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.receipt.create).not.toHaveBeenCalled();
    });

    it('4. rejects arbitrary or malicious path', async () => {
      const maliciousKey = `system/secret-backup.zip`;

      await expect(
        service.createReceipt(orderId, orderStoreId, { r2Key: maliciousKey }),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.receipt.create).not.toHaveBeenCalled();
    });
  });

  describe('deleteReceipt', () => {
    it('5. deletes object from R2 when receipt r2Key matches order and store prefix', async () => {
      const validKey = `receipts/${orderId}/${orderStoreId}/123_abc.jpg`;
      mockPrisma.receipt.findFirst.mockResolvedValue({
        id: 'rcpt-1',
        orderStoreId,
        r2Key: validKey,
        isDeleted: false,
      });

      mockPrisma.orderStore.findUnique.mockResolvedValue({
        id: orderStoreId,
        orderId,
        status: 'PENDING',
      });

      mockPrisma.receipt.update.mockResolvedValue({
        id: 'rcpt-1',
        orderStoreId,
        r2Key: validKey,
        isDeleted: true,
      });

      const res = await service.deleteReceipt('rcpt-1', orderStoreId, orderId);

      expect(res.isDeleted).toBe(true);
      expect(res.fileDeletedFromR2).toBe(true);
      expect(mockR2.deleteObject).toHaveBeenCalledWith(validKey);
    });

    it('6. rejects deletion and does NOT call deleteObject if receipt r2Key prefix does not match order/store', async () => {
      const spoofedKey = `receipts/other-order/other-store/123_abc.jpg`;
      mockPrisma.receipt.findFirst.mockResolvedValue({
        id: 'rcpt-1',
        orderStoreId,
        r2Key: spoofedKey,
        isDeleted: false,
      });

      mockPrisma.orderStore.findUnique.mockResolvedValue({
        id: orderStoreId,
        orderId,
        status: 'PENDING',
      });

      await expect(
        service.deleteReceipt('rcpt-1', orderStoreId, orderId),
      ).rejects.toThrow(BadRequestException);

      expect(mockR2.deleteObject).not.toHaveBeenCalled();
      expect(mockPrisma.receipt.update).not.toHaveBeenCalled();
    });
  });
});
