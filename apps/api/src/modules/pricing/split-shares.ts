import { PRICING } from '@forerun/shared-constants';

export interface SplitSharesResult {
  runnerShare: number;
  platformShare: number;
}

/**
 * Pure function to split an order total fee into runner and platform shares.
 * Runner receives Math.floor(totalFee * PRICING.RUNNER_SHARE) (75%).
 * Platform receives Math.ceil(totalFee * PRICING.PLATFORM_SHARE) (25%).
 */
export function splitShares(totalFee: number): SplitSharesResult {
  return {
    runnerShare: Math.floor(totalFee * PRICING.RUNNER_SHARE),
    platformShare: Math.ceil(totalFee * PRICING.PLATFORM_SHARE),
  };
}
