import { describe, it, expect } from 'vitest';
import {
  createApproveOrderSchema,
  ApproveOrderSchema,
  UpdatePlatformPricingSchema,
  FeePreviewRequestSchema,
} from '@forerun/shared-types';
import {
  MAX_CUSTOM_FEE,
  CUSTOM_FEE_CAP,
  CUSTOM_FEE_REASON_MAX_LENGTH,
  PRICING_LIMITS,
} from '@forerun/shared-constants';
import { arabicErrorMap } from '../../src/common/pipes/zod-validation.pipe.js';
import { z } from 'zod';

describe('Pricing & CustomFee Schemas (Sprint 6A-4)', () => {
  // Ensure arabic error map is active for tests
  z.setErrorMap(arabicErrorMap);

  describe('createApproveOrderSchema({ maxCustomFee: 500 })', () => {
    const schema = createApproveOrderSchema({ maxCustomFee: 500 });

    it('accepts customFee = 0 without reason', () => {
      const result = schema.parse({
        isPeripheral: false,
        customFee: 0,
      });
      expect(result.customFee).toBe(0);
      expect(result.customFeeReason).toBeUndefined();
    });

    it('defaults customFee to 0 when omitted', () => {
      const result = schema.parse({
        isPeripheral: true,
        notes: 'ملاحظة',
      });
      expect(result.customFee).toBe(0);
      expect(result.customFeeReason).toBeUndefined();
    });

    it('accepts customFee = 50 with valid reason', () => {
      const result = schema.parse({
        isPeripheral: false,
        customFee: 50,
        customFeeReason: 'طلب خاص من الزبون بعد منتصف الليل',
      });
      expect(result.customFee).toBe(50);
      expect(result.customFeeReason).toBe('طلب خاص من الزبون بعد منتصف الليل');
    });

    it('rejects customFee = 50 without reason with Arabic error message', () => {
      const parsed = schema.safeParse({
        isPeripheral: false,
        customFee: 50,
      });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        const issue = parsed.error.issues.find(
          (i) => i.path.join('.') === 'customFeeReason',
        );
        expect(issue).toBeDefined();
        expect(issue?.message).toBe('يجب إدخال سبب عند تحديد رسم إضافي للطلب');
      }
    });

    it('rejects customFee = 50 with empty or whitespace reason', () => {
      const parsedEmpty = schema.safeParse({
        isPeripheral: false,
        customFee: 50,
        customFeeReason: '',
      });
      expect(parsedEmpty.success).toBe(false);

      const parsedWhitespace = schema.safeParse({
        isPeripheral: false,
        customFee: 50,
        customFeeReason: '    ',
      });
      expect(parsedWhitespace.success).toBe(false);
    });

    it('rejects customFee = 0 with a reason provided', () => {
      const parsed = schema.safeParse({
        isPeripheral: false,
        customFee: 0,
        customFeeReason: 'سبب غير مبرر لرسم صفري',
      });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        const issue = parsed.error.issues.find(
          (i) => i.path.join('.') === 'customFeeReason',
        );
        expect(issue).toBeDefined();
        expect(issue?.message).toBe(
          'لا يمكن تحديد سبب للرسم الإضافي إذا كان الرسم الإضافي 0',
        );
      }
    });

    it('rejects customFee > maxCustomFee (501)', () => {
      const parsed = schema.safeParse({
        isPeripheral: false,
        customFee: 501,
        customFeeReason: 'رسم يتجاوز السقف',
      });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        const issue = parsed.error.issues.find(
          (i) => i.path.join('.') === 'customFee',
        );
        expect(issue).toBeDefined();
        expect(issue?.message).toBe('القيمة طويلة جدًا');
      }
    });

    it('rejects customFee < 0 (-1)', () => {
      const parsed = schema.safeParse({
        isPeripheral: false,
        customFee: -1,
        customFeeReason: 'سالب',
      });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        const issue = parsed.error.issues.find(
          (i) => i.path.join('.') === 'customFee',
        );
        expect(issue).toBeDefined();
        expect(issue?.message).toBe('القيمة قصيرة جدًا');
      }
    });

    it('rejects non-integer customFee (10.5)', () => {
      const parsed = schema.safeParse({
        isPeripheral: false,
        customFee: 10.5,
        customFeeReason: 'كسر عشري',
      });
      expect(parsed.success).toBe(false);
    });

    it('rejects customFeeReason longer than CUSTOM_FEE_REASON_MAX_LENGTH (200)', () => {
      const longReason = 'أ'.repeat(CUSTOM_FEE_REASON_MAX_LENGTH + 1);
      const parsed = schema.safeParse({
        isPeripheral: false,
        customFee: 50,
        customFeeReason: longReason,
      });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        const issue = parsed.error.issues.find(
          (i) => i.path.join('.') === 'customFeeReason',
        );
        expect(issue).toBeDefined();
        expect(issue?.message).toBe('القيمة طويلة جدًا');
      }
    });

    it('accepts baseFee when valid and within limits', () => {
      const parsed = schema.parse({
        isPeripheral: false,
        baseFee: 80,
      });
      expect(parsed.baseFee).toBe(80);
    });

    it('allows baseFee to be omitted (optional)', () => {
      const parsed = schema.parse({
        isPeripheral: false,
      });
      expect(parsed.baseFee).toBeUndefined();
    });

    it('accepts baseFee at boundaries (min: 1, max: 1000)', () => {
      const atMin = schema.parse({ isPeripheral: false, baseFee: 1 });
      expect(atMin.baseFee).toBe(1);

      const atMax = schema.parse({ isPeripheral: false, baseFee: 1000 });
      expect(atMax.baseFee).toBe(1000);
    });

    it('rejects baseFee < 1 (0 or negative) with Arabic error message', () => {
      const parsedZero = schema.safeParse({ isPeripheral: false, baseFee: 0 });
      expect(parsedZero.success).toBe(false);
      if (!parsedZero.success) {
        expect(parsedZero.error.issues[0]?.message).toContain('الرسم الأساسي يجب ألا يقل عن 1');
      }

      const parsedNeg = schema.safeParse({ isPeripheral: false, baseFee: -10 });
      expect(parsedNeg.success).toBe(false);
    });

    it('rejects baseFee > 1000 with Arabic error message', () => {
      const parsed = schema.safeParse({ isPeripheral: false, baseFee: 1001 });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0]?.message).toContain('الرسم الأساسي يجب ألا يتجاوز 1000');
      }
    });

    it('rejects decimal baseFee (80.5)', () => {
      const parsed = schema.safeParse({ isPeripheral: false, baseFee: 80.5 });
      expect(parsed.success).toBe(false);
    });
  });

  describe('Production ApproveOrderSchema (maxCustomFee = MAX_CUSTOM_FEE = 0)', () => {
    it('verifies MAX_CUSTOM_FEE is 0 and CUSTOM_FEE_CAP is 500', () => {
      expect(MAX_CUSTOM_FEE).toBe(0);
      expect(CUSTOM_FEE_CAP).toBe(500);
      expect(CUSTOM_FEE_REASON_MAX_LENGTH).toBe(200);
    });

    it('accepts customFee = 0', () => {
      const result = ApproveOrderSchema.parse({
        isPeripheral: false,
        customFee: 0,
      });
      expect(result.customFee).toBe(0);
    });

    it('rejects customFee = 1 due to production guard (MAX_CUSTOM_FEE = 0)', () => {
      const parsed = ApproveOrderSchema.safeParse({
        isPeripheral: false,
        customFee: 1,
        customFeeReason: 'محاولة استخدام customFee في 6A',
      });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        const issue = parsed.error.issues.find(
          (i) => i.path.join('.') === 'customFee',
        );
        expect(issue).toBeDefined();
        expect(issue?.message).toBe('القيمة طويلة جدًا');
      }
    });

    it('preserves existing legacy fields behavior (isPeripheral, notes)', () => {
      const res = ApproveOrderSchema.parse({
        isPeripheral: true,
        notes: 'ملاحظة للسائق',
      });
      expect(res.isPeripheral).toBe(true);
      expect(res.notes).toBe('ملاحظة للسائق');
      expect(res.customFee).toBe(0);
      expect(res.customFeeReason).toBeUndefined();

      const resNullableNotes = ApproveOrderSchema.parse({
        isPeripheral: false,
        notes: null,
      });
      expect(resNullableNotes.notes).toBeNull();
    });
  });

  describe('UpdatePlatformPricingSchema (Decision D12, D18)', () => {
    it('verifies PRICING_LIMITS constants', () => {
      expect(PRICING_LIMITS.baseFee).toEqual({ min: 1, max: 1000 });
      expect(PRICING_LIMITS.extraStoreFee).toEqual({ min: 0, max: 500 });
      expect(PRICING_LIMITS.peripheralFee).toEqual({ min: 0, max: 500 });
    });

    it('accepts valid pricing configuration within limits', () => {
      const valid = {
        baseFee: 60,
        extraStoreFee: 20,
        peripheralFee: 15,
      };
      const result = UpdatePlatformPricingSchema.parse(valid);
      expect(result).toEqual(valid);
    });

    it('accepts boundary values (min and max)', () => {
      const atMin = {
        baseFee: 1,
        extraStoreFee: 0,
        peripheralFee: 0,
      };
      expect(UpdatePlatformPricingSchema.parse(atMin)).toEqual(atMin);

      const atMax = {
        baseFee: 1000,
        extraStoreFee: 500,
        peripheralFee: 500,
      };
      expect(UpdatePlatformPricingSchema.parse(atMax)).toEqual(atMax);
    });

    it('treats null or empty updatedAt as absent (no stale-write guard)', () => {
      const withNull = UpdatePlatformPricingSchema.safeParse({
        baseFee: 60,
        extraStoreFee: 20,
        peripheralFee: 15,
        updatedAt: null,
      });
      expect(withNull.success).toBe(true);
      expect(withNull.data?.updatedAt).toBeUndefined();

      const withEmptyString = UpdatePlatformPricingSchema.safeParse({
        baseFee: 60,
        extraStoreFee: 20,
        peripheralFee: 15,
        updatedAt: '',
      });
      expect(withEmptyString.success).toBe(true);
      expect(withEmptyString.data?.updatedAt).toBeUndefined();
    });

    it('rejects a non-parsable updatedAt value', () => {
      const parsed = UpdatePlatformPricingSchema.safeParse({
        baseFee: 60,
        extraStoreFee: 20,
        peripheralFee: 15,
        updatedAt: 'not-a-date',
      });
      expect(parsed.success).toBe(false);
    });

    it('rejects baseFee = 0 (D18: baseFee must be >= 1)', () => {
      const parsed = UpdatePlatformPricingSchema.safeParse({
        baseFee: 0,
        extraStoreFee: 20,
        peripheralFee: 15,
      });
      expect(parsed.success).toBe(false);
    });

    it('rejects negative values', () => {
      expect(
        UpdatePlatformPricingSchema.safeParse({
          baseFee: -10,
          extraStoreFee: 20,
          peripheralFee: 15,
        }).success,
      ).toBe(false);

      expect(
        UpdatePlatformPricingSchema.safeParse({
          baseFee: 60,
          extraStoreFee: -1,
          peripheralFee: 15,
        }).success,
      ).toBe(false);

      expect(
        UpdatePlatformPricingSchema.safeParse({
          baseFee: 60,
          extraStoreFee: 20,
          peripheralFee: -1,
        }).success,
      ).toBe(false);
    });

    it('rejects float / decimal values', () => {
      expect(
        UpdatePlatformPricingSchema.safeParse({
          baseFee: 60.5,
          extraStoreFee: 20,
          peripheralFee: 15,
        }).success,
      ).toBe(false);

      expect(
        UpdatePlatformPricingSchema.safeParse({
          baseFee: 60,
          extraStoreFee: 20.25,
          peripheralFee: 15,
        }).success,
      ).toBe(false);
    });

    it('strips extra ratio fields (D12: ratios 75/25 are out-of-scope and not updatable)', () => {
      const inputWithRatios = {
        baseFee: 60,
        extraStoreFee: 20,
        peripheralFee: 15,
        runnerShare: 0.75,
        platformShare: 0.25,
      };
      const result = UpdatePlatformPricingSchema.parse(inputWithRatios);
      expect(result).toEqual({
        baseFee: 60,
        extraStoreFee: 20,
        peripheralFee: 15,
      });
      expect((result as Record<string, unknown>).runnerShare).toBeUndefined();
      expect((result as Record<string, unknown>).platformShare).toBeUndefined();
    });

    it('accepts valid updatedAt date / ISO string', () => {
      const dateStr = '2026-10-05T12:00:00.000Z';
      const result = UpdatePlatformPricingSchema.parse({
        baseFee: 60,
        extraStoreFee: 20,
        peripheralFee: 15,
        updatedAt: dateStr,
      });
      expect(result.updatedAt).toBeInstanceOf(Date);
      expect(result.updatedAt?.toISOString()).toBe(dateStr);
    });
  });

  describe('FeePreviewRequestSchema', () => {
    it('accepts default empty payload and defaults customFee to 0', () => {
      const result = FeePreviewRequestSchema.parse({});
      expect(result.customFee).toBe(0);
      expect(result.customFeeReason).toBeUndefined();
    });

    it('accepts customFee = 50 with valid reason', () => {
      const result = FeePreviewRequestSchema.parse({
        isPeripheral: true,
        customFee: 50,
        customFeeReason: 'طلب خاص من العميل',
        baseFee: 70,
      });
      expect(result.isPeripheral).toBe(true);
      expect(result.customFee).toBe(50);
      expect(result.customFeeReason).toBe('طلب خاص من العميل');
      expect(result.baseFee).toBe(70);
    });

    it('accepts customFee up to CUSTOM_FEE_CAP (500)', () => {
      const result = FeePreviewRequestSchema.parse({
        customFee: 500,
        customFeeReason: 'السقف الأقصى للرسم الإضافي',
      });
      expect(result.customFee).toBe(500);
    });

    it('rejects customFee > 500', () => {
      const parsed = FeePreviewRequestSchema.safeParse({
        customFee: 501,
        customFeeReason: 'تجاوز السقف',
      });
      expect(parsed.success).toBe(false);
    });

    it('rejects customFee > 0 without reason', () => {
      const parsed = FeePreviewRequestSchema.safeParse({
        customFee: 50,
      });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        const issue = parsed.error.issues.find(
          (i) => i.path.join('.') === 'customFeeReason',
        );
        expect(issue?.message).toBe('يجب إدخال سبب عند تحديد رسم إضافي للطلب');
      }
    });

    it('rejects customFee = 0 with reason', () => {
      const parsed = FeePreviewRequestSchema.safeParse({
        customFee: 0,
        customFeeReason: 'سبب بلا رسم',
      });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        const issue = parsed.error.issues.find(
          (i) => i.path.join('.') === 'customFeeReason',
        );
        expect(issue?.message).toBe(
          'لا يمكن تحديد سبب للرسم الإضافي إذا كان الرسم الإضافي 0',
        );
      }
    });

    it('rejects baseFee out of limits (e.g. 0 or > 1000)', () => {
      expect(
        FeePreviewRequestSchema.safeParse({
          baseFee: 0,
        }).success,
      ).toBe(false);

      expect(
        FeePreviewRequestSchema.safeParse({
          baseFee: 1001,
        }).success,
      ).toBe(false);
    });
  });
});

