import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../setup';
import { PricingService } from '../../../src/modules/pricing/pricing.service';
import type { PrismaService } from '../../../src/database/prisma.service';
import type { AuditService } from '../../../src/modules/audit/audit.service';
import type { NotificationsService } from '../../../src/modules/notifications/notifications.service';

describe('PlatformPricing Integration (Sprint 6A Phase 1)', () => {
  let pricingService: PricingService;

  beforeAll(async () => {
    pricingService = new PricingService(
      prisma as unknown as PrismaService,
      { log: () => Promise.resolve() } as unknown as AuditService,
      {} as unknown as NotificationsService,
    );
  });

  it('default row exists in test DB with values 60/20/40 after migration', async () => {
    const row = await prisma.platformPricing.findUnique({
      where: { id: 'default' },
    });

    expect(row).not.toBeNull();
    expect(row?.id).toBe('default');
    expect(row?.baseFee).toBe(60);
    expect(row?.extraStoreFee).toBe(20);
    expect(row?.peripheralFee).toBe(40);
  });

  it('PricingService.getPricingConfig reads the default row from test DB correctly', async () => {
    pricingService.disableCacheForTesting();
    const config = await pricingService.getPricingConfig();

    expect(config).toEqual({
      baseFee: 60,
      peripheralFee: 40,
      extraStoreFee: 20,
    });
  });
});
