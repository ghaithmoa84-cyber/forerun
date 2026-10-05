import { beforeEach, describe, it, expect, vi } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  DEFAULT_PRICING_CONFIG,
} from '@forerun/shared-constants';
import {
  UpdatePlatformPricingSchema,
  FeePreviewRequestSchema,
  type PlatformPricingResponse,
  type FeePreviewResponse,
} from '@forerun/shared-types';
import { PricingController } from '../../src/modules/pricing/pricing.controller.js';
import { PricingService } from '../../src/modules/pricing/pricing.service.js';
import { ZodValidationPipe } from '../../src/common/pipes/zod-validation.pipe.js';

describe('PricingController (Sprint 6A-7)', () => {
  let controller: PricingController;
  let pricingService: {
    getPlatformPricing: ReturnType<typeof vi.fn>;
    updatePlatformPricing: ReturnType<typeof vi.fn>;
    previewFee: ReturnType<typeof vi.fn>;
  };

  const mockAdminUser = {
    userId: 'usr-admin-123',
    role: 'ADMIN',
    status: 'VERIFIED',
  };

  beforeEach(() => {
    pricingService = {
      getPlatformPricing: vi.fn(),
      updatePlatformPricing: vi.fn(),
      previewFee: vi.fn(),
    };

    controller = new PricingController(
      pricingService as unknown as PricingService,
    );
  });

  describe('GET /admin/pricing', () => {
    it('returns DEFAULT_PRICING_CONFIG if row is missing', async () => {
      const defaultResponse: PlatformPricingResponse = {
        baseFee: DEFAULT_PRICING_CONFIG.baseFee,
        extraStoreFee: DEFAULT_PRICING_CONFIG.extraStoreFee,
        peripheralFee: DEFAULT_PRICING_CONFIG.peripheralFee,
        updatedAt: null,
        updatedByUserId: null,
      };
      pricingService.getPlatformPricing.mockResolvedValue(defaultResponse);

      const result = await controller.getPlatformPricing();

      expect(result).toEqual(defaultResponse);
      expect(pricingService.getPlatformPricing).toHaveBeenCalledOnce();
    });

    it('returns configured platform pricing when present', async () => {
      const configuredResponse: PlatformPricingResponse = {
        baseFee: 80,
        extraStoreFee: 30,
        peripheralFee: 50,
        updatedAt: new Date('2026-10-05T12:00:00.000Z'),
        updatedByUserId: 'usr-admin-123',
      };
      pricingService.getPlatformPricing.mockResolvedValue(configuredResponse);

      const result = await controller.getPlatformPricing();

      expect(result).toEqual(configuredResponse);
    });
  });

  describe('PUT /admin/pricing', () => {
    const updatePipe = new ZodValidationPipe(UpdatePlatformPricingSchema);

    it('successfully updates pricing with valid values and updatedAt', async () => {
      const input = {
        baseFee: 80,
        extraStoreFee: 30,
        peripheralFee: 50,
        updatedAt: '2026-10-05T10:00:00.000Z',
      };
      const parsedDto = updatePipe.transform(input, {} as Parameters<ZodValidationPipe['transform']>[1]);

      const expectedResponse: PlatformPricingResponse = {
        baseFee: 80,
        extraStoreFee: 30,
        peripheralFee: 50,
        updatedAt: new Date('2026-10-05T12:00:00.000Z'),
        updatedByUserId: mockAdminUser.userId,
      };
      pricingService.updatePlatformPricing.mockResolvedValue(expectedResponse);

      const result = await controller.updatePlatformPricing(parsedDto, mockAdminUser);

      expect(result).toEqual(expectedResponse);
      expect(pricingService.updatePlatformPricing).toHaveBeenCalledWith(
        parsedDto,
        mockAdminUser.userId,
      );
    });

    it('rejects baseFee = 0 via ZodValidationPipe (400)', () => {
      expect(() =>
        updatePipe.transform(
          { baseFee: 0, extraStoreFee: 20, peripheralFee: 40 },
          {} as Parameters<ZodValidationPipe['transform']>[1],
        ),
      ).toThrow(BadRequestException);
    });

    it('rejects negative values via ZodValidationPipe (400)', () => {
      expect(() =>
        updatePipe.transform(
          { baseFee: 60, extraStoreFee: -5, peripheralFee: 40 },
          {} as Parameters<ZodValidationPipe['transform']>[1],
        ),
      ).toThrow(BadRequestException);

      expect(() =>
        updatePipe.transform(
          { baseFee: 60, extraStoreFee: 20, peripheralFee: -10 },
          {} as Parameters<ZodValidationPipe['transform']>[1],
        ),
      ).toThrow(BadRequestException);
    });

    it('propagates 409 ConflictException when updatedAt is stale', async () => {
      const parsedDto = updatePipe.transform(
        {
          baseFee: 80,
          extraStoreFee: 30,
          peripheralFee: 50,
          updatedAt: '2026-10-01T00:00:00.000Z',
        },
        {} as Parameters<ZodValidationPipe['transform']>[1],
      );

      pricingService.updatePlatformPricing.mockRejectedValue(
        new ConflictException('تعارض في التحديث: تم تعديل إعدادات الأسعار من قِبل جلسة أخرى'),
      );

      await expect(
        controller.updatePlatformPricing(parsedDto, mockAdminUser),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('POST /admin/orders/:id/fee-preview', () => {
    const previewPipe = new ZodValidationPipe(FeePreviewRequestSchema);

    it('returns fee calculation for existing order', async () => {
      const input = {
        isPeripheral: true,
        customFee: 50,
        customFeeReason: 'طرد ثقيل',
      };
      const parsedDto = previewPipe.transform(input, {} as Parameters<ZodValidationPipe['transform']>[1]);

      const mockResponse: FeePreviewResponse = {
        baseFee: 60,
        peripheralFee: 40,
        extraStoresFee: 20,
        customFee: 50,
        customFeeReason: 'طرد ثقيل',
        totalFee: 170,
        runnerShare: 127,
        platformShare: 43,
      };
      pricingService.previewFee.mockResolvedValue(mockResponse);

      const result = await controller.previewFee({ id: 'ord-123' }, parsedDto);

      expect(result).toEqual(mockResponse);
      expect(pricingService.previewFee).toHaveBeenCalledWith('ord-123', parsedDto);
    });

    it('throws NotFoundException (404) for non-existent order', async () => {
      const parsedDto = previewPipe.transform(
        { isPeripheral: false },
        {} as Parameters<ZodValidationPipe['transform']>[1],
      );

      pricingService.previewFee.mockRejectedValue(
        new NotFoundException('الطلب غير موجود'),
      );

      await expect(
        controller.previewFee({ id: 'non-existent' }, parsedDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects customFee = 50 without reason via ZodValidationPipe (400)', () => {
      expect(() =>
        previewPipe.transform(
          { isPeripheral: false, customFee: 50 },
          {} as Parameters<ZodValidationPipe['transform']>[1],
        ),
      ).toThrow(BadRequestException);
    });
  });
});
