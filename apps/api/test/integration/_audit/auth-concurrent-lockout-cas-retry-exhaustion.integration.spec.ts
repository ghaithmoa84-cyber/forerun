import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { CONFIG } from '@forerun/shared-constants';
import { cleanDatabase, prisma as setupPrisma } from '../setup.js';
import { createTestApp, closeTestApp, getRequest } from '../helpers/app.helper.js';
import { seedCustomer } from '../helpers/seed.helper.js';

function requireIsolatedTestDatabase() {
  const configured = process.env.DATABASE_URL_TEST;
  if (!configured) throw new Error('DATABASE_URL_TEST must point to the isolated forerun_test database');
  const databaseName = new URL(configured).pathname.replace(/^\//, '');
  const host = new URL(configured).hostname;
  if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(host)) {
    throw new Error('Refusing non-loopback test database host: ' + host);
  }
  if (databaseName !== 'forerun_test') {
    throw new Error(`Refusing audit test database '${databaseName}'; expected forerun_test`);
  }
}

describe('Security audit: concurrent login lockout accounting', () => {
  const prisma = setupPrisma as unknown as PrismaClient;

  beforeAll(async () => {
    requireIsolatedTestDatabase();
    const keys = await import('node:crypto').then(({ generateKeyPairSync }) =>
      generateKeyPairSync('rsa', {
        modulusLength: 2048,
        privateKeyEncoding: { format: 'pem', type: 'pkcs8' },
        publicKeyEncoding: { format: 'pem', type: 'spki' },
      }),
    );
    process.env.JWT_PRIVATE_KEY = keys.privateKey;
    process.env.JWT_PUBLIC_KEY = keys.publicKey;
    await createTestApp();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await closeTestApp();
  });

  it('does not evaluate more than the configured number of concurrent wrong passwords before lockout', async () => {
    const customer = await seedCustomer(prisma);
    const request = getRequest();
    const passwordPrefix = `AUDIT-CAS-${randomUUID()}-`;
    const parallelAttempts = CONFIG.MAX_FAILED_LOGIN_ATTEMPTS + 3;
    let evaluatedWrongPasswords = 0;
    let unlockComparisons!: () => void;
    let markAllComparisonsReached!: () => void;
    const comparisonGate = new Promise<void>((resolve) => { unlockComparisons = resolve; });
    const allComparisonsReached = new Promise<void>((resolve) => { markAllComparisonsReached = resolve; });
    const realCompare = bcrypt.compare.bind(bcrypt);

    vi.spyOn(bcrypt, 'compare').mockImplementation(async (plain, hash) => {
      const matches = await realCompare(plain, hash);
      if (typeof plain === 'string' && plain.startsWith(passwordPrefix)) {
        evaluatedWrongPasswords += 1;
        if (evaluatedWrongPasswords === parallelAttempts) markAllComparisonsReached();
        // Hold every real bcrypt result until all parallel HTTP requests have read the unlocked account.
        await comparisonGate;
      }
      return matches;
    });

    const requests = Array.from({ length: parallelAttempts }, (_, index) =>
      request.post('/api/v1/auth/login').send({
        whatsapp: customer.whatsapp,
        password: `${passwordPrefix}${index}`,
      }).then((response) => response),
    );

    await allComparisonsReached;
    const accountAtBarrier = await prisma.user.findUnique({
      where: { id: customer.id },
      select: { failedLoginAttempts: true, loginLockedAt: true },
    });
    const evaluationsBeforeUnlock = evaluatedWrongPasswords;
    expect(accountAtBarrier?.loginLockedAt).toBeNull();
    expect(accountAtBarrier?.failedLoginAttempts).toBe(0);

    unlockComparisons();
    const responses = await Promise.all(requests);
    const lockedAccount = await prisma.user.findUnique({
      where: { id: customer.id },
      select: { failedLoginAttempts: true, loginLockedAt: true },
    });

    expect(responses.every((response) => [401, 403].includes(response.status))).toBe(true);
    expect(lockedAccount?.loginLockedAt).not.toBeNull();
    // Security invariant: racing requests must not evaluate guesses past the lockout threshold.
    expect(evaluationsBeforeUnlock).toBeLessThanOrEqual(CONFIG.MAX_FAILED_LOGIN_ATTEMPTS);
  });
});





