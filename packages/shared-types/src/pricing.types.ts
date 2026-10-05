import { z } from 'zod';
import {
  PRICING_LIMITS,
  CUSTOM_FEE_CAP,
  CUSTOM_FEE_REASON_MAX_LENGTH,
} from '@forerun/shared-constants';

export const PricingConfigSchema = z.object({
  baseFee: z.number().int().nonnegative(),
  peripheralFee: z.number().int().nonnegative(),
  extraStoreFee: z.number().int().nonnegative(),
});

export type PricingConfig = Readonly<{
  baseFee: number;
  peripheralFee: number;
  extraStoreFee: number;
}>;

export const UpdatePlatformPricingSchema = z.object({
  baseFee: z
    .number({ invalid_type_error: 'يجب أن يكون الرسم الأساسي رقماً' })
    .int('يجب أن يكون الرسم الأساسي عدداً صحيحاً')
    .min(
      PRICING_LIMITS.baseFee.min,
      `الرسم الأساسي يجب ألا يقل عن ${PRICING_LIMITS.baseFee.min}`,
    )
    .max(
      PRICING_LIMITS.baseFee.max,
      `الرسم الأساسي يجب ألا يتجاوز ${PRICING_LIMITS.baseFee.max}`,
    ),
  extraStoreFee: z
    .number({ invalid_type_error: 'يجب أن يكون رسم المتجر الإضافي رقماً' })
    .int('يجب أن يكون رسم المتجر الإضافي عدداً صحيحاً')
    .min(
      PRICING_LIMITS.extraStoreFee.min,
      `رسم المتجر الإضافي يجب ألا يقل عن ${PRICING_LIMITS.extraStoreFee.min}`,
    )
    .max(
      PRICING_LIMITS.extraStoreFee.max,
      `رسم المتجر الإضافي يجب ألا يتجاوز ${PRICING_LIMITS.extraStoreFee.max}`,
    ),
  peripheralFee: z
    .number({ invalid_type_error: 'يجب أن يكون رسم المنطقة الطرفية رقماً' })
    .int('يجب أن يكون رسم المنطقة الطرفية عدداً صحيحاً')
    .min(
      PRICING_LIMITS.peripheralFee.min,
      `رسم المنطقة الطرفية يجب ألا يقل عن ${PRICING_LIMITS.peripheralFee.min}`,
    )
    .max(
      PRICING_LIMITS.peripheralFee.max,
      `رسم المنطقة الطرفية يجب ألا يتجاوز ${PRICING_LIMITS.peripheralFee.max}`,
    ),
  updatedAt: z.preprocess(
    (value) => (value === null || value === '' ? undefined : value),
    z.coerce.date().optional(),
  ),
});

export type UpdatePlatformPricingRequest = z.input<
  typeof UpdatePlatformPricingSchema
>;
export type UpdatePlatformPricingDto = z.infer<
  typeof UpdatePlatformPricingSchema
>;
export type UpdatePlatformPricingInput = UpdatePlatformPricingDto;

export const FeePreviewRequestSchema = z
  .object({
    isPeripheral: z
      .boolean({
        invalid_type_error: 'يجب تحديد ما إذا كان الطلب لمنطقة طرفية',
      })
      .optional(),
    baseFee: z
      .number({ invalid_type_error: 'يجب أن يكون الرسم الأساسي رقماً' })
      .int('يجب أن يكون الرسم الأساسي عدداً صحيحاً')
      .min(
        PRICING_LIMITS.baseFee.min,
        `الرسم الأساسي يجب ألا يقل عن ${PRICING_LIMITS.baseFee.min}`,
      )
      .max(
        PRICING_LIMITS.baseFee.max,
        `الرسم الأساسي يجب ألا يتجاوز ${PRICING_LIMITS.baseFee.max}`,
      )
      .optional(),
    customFee: z
      .number({ invalid_type_error: 'يجب أن يكون الرسم الإضافي رقماً' })
      .int('يجب أن يكون الرسم الإضافي عدداً صحيحاً')
      .min(0, 'يجب ألا يقل الرسم الإضافي عن 0')
      .max(CUSTOM_FEE_CAP, `الرسم الإضافي يجب ألا يتجاوز ${CUSTOM_FEE_CAP}`)
      .optional()
      .default(0),
    customFeeReason: z
      .string()
      .trim()
      .min(1, 'سبب الرسم الإضافي لا يمكن أن يكون فارغاً')
      .max(
        CUSTOM_FEE_REASON_MAX_LENGTH,
        `سبب الرسم الإضافي يجب ألا يتجاوز ${CUSTOM_FEE_REASON_MAX_LENGTH} حرفاً`,
      )
      .optional(),
  })
  .superRefine((data, ctx) => {
    const fee = data.customFee ?? 0;
    const hasReason =
      typeof data.customFeeReason === 'string' &&
      data.customFeeReason.trim().length > 0;

    if (fee > 0 && !hasReason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'يجب إدخال سبب عند تحديد رسم إضافي للطلب',
        path: ['customFeeReason'],
      });
    }

    if (fee === 0 && hasReason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'لا يمكن تحديد سبب للرسم الإضافي إذا كان الرسم الإضافي 0',
        path: ['customFeeReason'],
      });
    }
  });

export type FeePreviewRequest = z.input<typeof FeePreviewRequestSchema>;
export type FeePreviewDto = z.infer<typeof FeePreviewRequestSchema>;

export const FeePreviewResponseSchema = z.object({
  baseFee: z.number().int(),
  peripheralFee: z.number().int(),
  extraStoresFee: z.number().int(),
  customFee: z.number().int(),
  customFeeReason: z.string().nullable().optional(),
  totalFee: z.number().int(),
  runnerShare: z.number().int(),
  platformShare: z.number().int(),
});

export type FeePreviewResponse = z.infer<typeof FeePreviewResponseSchema>;

export const PlatformPricingResponseSchema = z.object({
  baseFee: z.number().int(),
  extraStoreFee: z.number().int(),
  peripheralFee: z.number().int(),
  updatedAt: z.union([z.date(), z.string()]).nullable(),
  updatedByUserId: z.string().nullable(),
});

export type PlatformPricingResponse = z.infer<
  typeof PlatformPricingResponseSchema
>;

