import { z } from 'zod';

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
