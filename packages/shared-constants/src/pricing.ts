export const PRICING = {
  BASE_FEE: 60,
  PERIPHERAL_FEE: 40,
  EXTRA_STORE_FEE: 20,
  RUNNER_SHARE: 0.75,
  PLATFORM_SHARE: 0.25,
} as const;

export const DEFAULT_PRICING_CONFIG = {
  baseFee: PRICING.BASE_FEE,
  peripheralFee: PRICING.PERIPHERAL_FEE,
  extraStoreFee: PRICING.EXTRA_STORE_FEE,
} as const;
