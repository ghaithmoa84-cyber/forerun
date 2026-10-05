import { describe, it, expect } from 'vitest';
import { splitShares } from '../../src/modules/pricing/split-shares.js';

describe('splitShares (pure function)', () => {
  const testCases = [
    { total: 0, expectedRunner: 0, expectedPlatform: 0 },
    { total: 1, expectedRunner: 0, expectedPlatform: 1 },
    { total: 2, expectedRunner: 1, expectedPlatform: 1 },
    { total: 3, expectedRunner: 2, expectedPlatform: 1 },
    { total: 20, expectedRunner: 15, expectedPlatform: 5 },
    { total: 40, expectedRunner: 30, expectedPlatform: 10 },
    { total: 60, expectedRunner: 45, expectedPlatform: 15 },
    { total: 61, expectedRunner: 45, expectedPlatform: 16 },
    { total: 80, expectedRunner: 60, expectedPlatform: 20 },
    { total: 101, expectedRunner: 75, expectedPlatform: 26 },
    { total: 125, expectedRunner: 93, expectedPlatform: 32 },
    { total: 999, expectedRunner: 749, expectedPlatform: 250 },
  ];

  it.each(testCases)(
    'splits totalFee $total into runner: $expectedRunner, platform: $expectedPlatform',
    ({ total, expectedRunner, expectedPlatform }) => {
      const result = splitShares(total);

      // Explicit hardcoded expectations
      expect(result.runnerShare).toBe(expectedRunner);
      expect(result.platformShare).toBe(expectedPlatform);

      // Invariant: runnerShare + platformShare === totalFee
      expect(result.runnerShare + result.platformShare).toBe(total);

      // Non-negative integer invariant
      expect(Number.isInteger(result.runnerShare)).toBe(true);
      expect(Number.isInteger(result.platformShare)).toBe(true);
      expect(result.runnerShare).toBeGreaterThanOrEqual(0);
      expect(result.platformShare).toBeGreaterThanOrEqual(0);
    },
  );
});
