import { z } from 'zod';
import { PRICING_LIMITS } from '@forerun/shared-constants';

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
    .number()
    .int()
    .min(PRICING_LIMITS.baseFee.min)
    .max(PRICING_LIMITS.baseFee.max),
  extraStoreFee: z
    .number()
    .int()
    .min(PRICING_LIMITS.extraStoreFee.min)
    .max(PRICING_LIMITS.extraStoreFee.max),
  peripheralFee: z
    .number()
    .int()
    .min(PRICING_LIMITS.peripheralFee.min)
    .max(PRICING_LIMITS.peripheralFee.max),
});

export type UpdatePlatformPricingInput = z.infer<
  typeof UpdatePlatformPricingSchema
>;
