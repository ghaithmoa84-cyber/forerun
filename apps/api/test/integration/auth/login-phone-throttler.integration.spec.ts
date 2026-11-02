import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { getStorageToken } from '@nestjs/throttler';
import { cleanDatabase, prisma as setupPrisma } from '../setup.js';
import { createTestApp, closeTestApp, getRequest, getTestApp } from '../helpers/app.helper.js';
import { seedCustomer } from '../helpers/seed.helper.js';

type BcryptModule = typeof import('bcrypt') & {
  default?: typeof import('bcrypt');
};

const mocks = vi.hoisted(() => {
  return {
    actualBcryptCompare: { current: null as (((plain: string | Buffer, hash: string) => Promise<boolean>) | null) },
    evaluatedCount: { current: 0 },
  };
});

vi.mock('bcrypt', async (importOriginal) => {
  const actual = await importOriginal<BcryptModule>();
  const realComp = actual.default?.compare ?? actual.compare;
  mocks.actualBcryptCompare.current = realComp;
  const mockComp = vi.fn(async (plain: string | Buffer, hash: string) => {
    if (typeof plain === 'string' && plain.startsWith('D66-BURST-')) {
      mocks.evaluatedCount.current += 1;
    }
    return realComp(plain, hash);
  });
  return {
    ...actual,
    default: {
      ...(actual.default ?? actual),
      compare: mockComp,
    },
    compare: mockComp,
  };
});

const jwtKeys = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { format: 'pem', type: 'pkcs8' },
  publicKeyEncoding: { format: 'pem', type: 'spki' },
});

describe('D66: Phone-Based Login Throttler Integration Tests', () => {
  const prisma = setupPrisma as unknown as PrismaClient;

  beforeAll(async () => {
    process.env.JWT_PRIVATE_KEY = jwtKeys.privateKey;
    process.env.JWT_PUBLIC_KEY = jwtKeys.publicKey;
    // Enable real memory ThrottlerStorage for D66 verification
    await createTestApp({ enableThrottler: true });
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await closeTestApp();
  });

  beforeEach(async () => {
    await cleanDatabase();
    mocks.evaluatedCount.current = 0;
    // Reset in-memory Throttler storage between tests for complete isolation
    try {
      const storageService = getTestApp().get(getStorageToken()) as { storage: Map<string, unknown> };
      if (storageService?.storage?.clear) {
        storageService.storage.clear();
      }
    } catch {
      // Ignored if storage token is not found
    }
  });

  it('1. throttles repeated failed login attempts for the SAME whatsapp number across DIFFERENT IPs (distributed attack mitigation)', async () => {
    const customer = await seedCustomer(prisma);
    const request = getRequest();

    // 5 attempts from 5 distinct IP addresses using the exact whatsapp field
    for (let i = 1; i <= 5; i++) {
      const res = await request
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', `198.51.100.${i}`)
        .send({
          whatsapp: customer.whatsapp,
          password: `WrongPassword@${i}`,
        });

      // Under attempt 5, each request either gets 401 or triggers lockout at 5 (403)
      expect([401, 403]).toContain(res.status);
    }

    // 6th attempt from a brand-new 6th IP: must be blocked by phone throttler with 429
    const res6 = await request
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', '198.51.100.99')
      .send({
        whatsapp: customer.whatsapp,
        password: 'AnotherWrongPassword@99',
      });

    expect(res6.status).toBe(429);
    expect(res6.body.statusCode).toBe(429);
    expect(res6.body.message).toBe('محاولات دخول كثيرة جداً لهذا الرقم مؤقتاً — يرجى المحاولة بعد قليل');
  });

  it('2. does not penalize a DIFFERENT whatsapp number coming from the same IP address', async () => {
    const customer1 = await seedCustomer(prisma);
    // Seed second customer with unique whatsapp
    const hash = await bcrypt.hash('Customer2@12345', 12);
    const customer2User = await prisma.user.create({
      data: {
        name: 'Second Customer',
        whatsapp: '0999888777',
        passwordHash: hash,
        role: 'CUSTOMER',
        status: 'VERIFIED',
        customer: { create: {} },
      },
    });

    const request = getRequest();
    const sharedIp = '203.0.113.50';

    // Exhaust phone throttle for customer1 (5 requests)
    for (let i = 1; i <= 5; i++) {
      await request
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', sharedIp)
        .send({
          whatsapp: customer1.whatsapp,
          password: `WrongPassword@${i}`,
        });
    }

    // 6th request for customer1 is 429
    const blockedRes = await request
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', sharedIp)
      .send({
        whatsapp: customer1.whatsapp,
        password: 'WrongPassword@6',
      });
    expect(blockedRes.status).toBe(429);

    // Login for customer2 with correct password succeeds immediately despite sharing the same IP (IP has made 6 requests, which is below IP limit 10)
    const allowedRes = await request
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', sharedIp)
      .send({
        whatsapp: customer2User.whatsapp,
        password: 'Customer2@12345',
      });
    expect(allowedRes.status).toBe(200);
    expect(allowedRes.body.accessToken).toBeDefined();
  });

  it('3. real burst verification: clamps 50 parallel requests down to maximum 5 bcrypt evaluations', async () => {
    // Create new customer for burst test
    const hash = await bcrypt.hash('BurstTarget@12345', 12);
    const targetUser = await prisma.user.create({
      data: {
        name: 'Burst Target',
        whatsapp: '0999111222',
        passwordHash: hash,
        role: 'CUSTOMER',
        status: 'VERIFIED',
        customer: { create: {} },
      },
    });

    const request = getRequest();
    const burstSize = 50;

    // Fire 50 simultaneous parallel requests from 50 simulated rotating proxy IPs
    const requests = Array.from({ length: burstSize }, (_, i) =>
      request
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', `10.0.${Math.floor(i / 255)}.${(i % 254) + 1}`)
        .send({
          whatsapp: targetUser.whatsapp,
          password: `D66-BURST-${i}`,
        }),
    );

    const responses = await Promise.all(requests);

    const statusCounts = responses.reduce<Record<number, number>>((acc, res) => {
      acc[res.status] = (acc[res.status] || 0) + 1;
      return acc;
    }, {});

    console.log('\n================== D66 POST-FIX BURST MEASUREMENT (50 REQUESTS) ==================');
    console.log(`Total Parallel Requests Sent:       ${burstSize}`);
    console.log(`Actual bcrypt.compare Evaluations:  ${mocks.evaluatedCount.current}`);
    console.log(`Status 429 Count (Throttled):       ${statusCounts[429] || 0}`);
    console.log(`Status 401 Count (Wrong Password):  ${statusCounts[401] || 0}`);
    console.log(`Status 403 Count (Account Locked):  ${statusCounts[403] || 0}`);
    console.log(`Status Breakdown:                   ${JSON.stringify(statusCounts)}`);
    console.log('==================================================================================\n');

    // D66 Success Invariant: bcrypt MUST NOT be evaluated more than 5 times!
    expect(mocks.evaluatedCount.current).toBeLessThanOrEqual(5);
    // Exactly 45 requests must have been blocked by 429 Too Many Requests
    expect(statusCounts[429]).toBe(45);
  });

  it('4. bypass resistance: different formatting variations (+963, 00963, 963, spaces, dashes) of the SAME number share the same throttle bucket', async () => {
    const targetPhone = '0912345678';
    const request = getRequest();

    // 5 variations of the same phone number across 5 different IPs
    const variations = [
      '+963912345678',
      '00963912345678',
      '963912345678',
      '09-1234-5678',
      ' 09 1234 5678 ',
    ];

    for (let i = 0; i < variations.length; i++) {
      await request
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', `172.16.0.${i + 1}`)
        .send({
          whatsapp: variations[i],
          password: `AttemptPassword@${i + 1}`,
        });
    }

    // 6th attempt with standard local format 0912345678 from a 6th IP must be BLOCKED with 429
    const res6 = await request
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', '172.16.0.99')
      .send({
        whatsapp: targetPhone,
        password: 'AttemptPassword@6',
      });

    expect(res6.status).toBe(429);
    expect(res6.body.message).toBe('محاولات دخول كثيرة جداً لهذا الرقم مؤقتاً — يرجى المحاولة بعد قليل');
  });

  it('5. edge case safety: missing or empty whatsapp payload does not cause 500 error, is rejected by Zod pipe (400), and falls back to IP throttle', async () => {
    const request = getRequest();

    // Empty string whatsapp
    const emptyRes = await request
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', '192.0.2.1')
      .send({
        whatsapp: '',
        password: 'Password@123',
      });
    expect(emptyRes.status).toBe(400);
    expect(emptyRes.body.error).toBe('Bad Request');

    // Missing whatsapp field completely
    const missingRes = await request
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', '192.0.2.2')
      .send({
        password: 'Password@123',
      });
    expect(missingRes.status).toBe(400);
    expect(missingRes.body.error).toBe('Bad Request');

    // Empty payload object
    const emptyObjRes = await request
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', '192.0.2.3')
      .send({});
    expect(emptyObjRes.status).toBe(400);
    expect(emptyObjRes.body.error).toBe('Bad Request');
  });
});
