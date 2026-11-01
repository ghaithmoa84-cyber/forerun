import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import * as crypto from 'crypto';
import { cleanDatabase, prisma } from '../setup.js';
import { createTestApp, closeTestApp, getRequest } from '../helpers/app.helper.js';
import { seedCustomer } from '../helpers/seed.helper.js';
import { LOGIN_LOCKED_MESSAGE } from '@forerun/shared-constants';

const jwtKeys = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { format: 'pem', type: 'pkcs8' },
  publicKeyEncoding: { format: 'pem', type: 'spki' },
});

describe('Login Lockout Session Termination Integration Tests (SA-5)', () => {
  let customerUser: any;

  beforeAll(async () => {
    process.env.JWT_PRIVATE_KEY = jwtKeys.privateKey;
    process.env.JWT_PUBLIC_KEY = jwtKeys.publicKey;
    await createTestApp();
  });

  afterAll(async () => {
    await closeTestApp();
  });

  beforeEach(async () => {
    await cleanDatabase();
    customerUser = await seedCustomer(prisma);
  });

  it('1. terminates active session upon 5th failed login attempt and immediately rejects refresh token with 401', async () => {
    const request = getRequest();

    // 1. Legitimate user logs in and obtains valid tokens
    const loginRes = await request.post('/api/v1/auth/login').send({
      whatsapp: customerUser.whatsapp,
      password: 'Customer@12345',
    });
    expect(loginRes.status).toBe(200);
    const { accessToken, refreshToken } = loginRes.body;
    expect(accessToken).toBeDefined();
    expect(refreshToken).toBeDefined();

    // Confirm that the refresh token is currently active in DB
    const [selector] = refreshToken.split(':');
    const tokenInDbBefore = await prisma.refreshToken.findUnique({
      where: { selector },
    });
    expect(tokenInDbBefore?.isRevoked).toBe(false);

    // 2. Simulate 5 consecutive failed login attempts (e.g., from an attacker)
    for (let attempt = 1; attempt <= 4; attempt++) {
      const failRes = await request.post('/api/v1/auth/login').send({
        whatsapp: customerUser.whatsapp,
        password: 'WrongPassword@123',
      });
      expect(failRes.status).toBe(401);
    }

    // 5th attempt triggers lockout
    const lockoutRes = await request.post('/api/v1/auth/login').send({
      whatsapp: customerUser.whatsapp,
      password: 'WrongPassword@123',
    });
    expect(lockoutRes.status).toBe(403);
    expect(lockoutRes.body.message).toBe(LOGIN_LOCKED_MESSAGE);

    // 3. Verify user is locked in DB
    const lockedUser = await prisma.user.findUnique({
      where: { id: customerUser.id },
      select: { failedLoginAttempts: true, loginLockedAt: true },
    });
    expect(lockedUser?.failedLoginAttempts).toBe(5);
    expect(lockedUser?.loginLockedAt).not.toBeNull();

    // 4. Verify refresh token was revoked in DB within the transaction
    const tokenInDbAfter = await prisma.refreshToken.findUnique({
      where: { selector },
    });
    expect(tokenInDbAfter?.isRevoked).toBe(true);
    expect(tokenInDbAfter?.revokedAt).not.toBeNull();

    // 5. Verify AuditLog recorded USER_LOGIN_LOCKED with session revocation details
    const audit = await prisma.auditLog.findFirst({
      where: { event: 'USER_LOGIN_LOCKED', actorId: customerUser.id },
    });
    expect(audit).toBeDefined();
    const meta = audit?.meta as Record<string, unknown>;
    expect(meta.sessionsRevoked).toBe(true);
    expect(meta.revokedTokensCount).toBe(1);

    // 6. Legitimate session attempts to rotate/refresh -> must be rejected with 401
    const refreshRes = await request.post('/api/v1/auth/refresh').send({
      refreshToken,
    });
    expect(refreshRes.status).toBe(401);
    expect(refreshRes.body.message).toBe('رمز التجديد غير صالح أو منتهي الصلاحية');
  });

  it('2. terminates multiple concurrent sessions across different devices upon lockout', async () => {
    const request = getRequest();

    // User logs in on Device 1
    const login1 = await request.post('/api/v1/auth/login').send({
      whatsapp: customerUser.whatsapp,
      password: 'Customer@12345',
    });
    expect(login1.status).toBe(200);
    const tokenDevice1 = login1.body.refreshToken;

    // User logs in on Device 2
    const login2 = await request.post('/api/v1/auth/login').send({
      whatsapp: customerUser.whatsapp,
      password: 'Customer@12345',
    });
    expect(login2.status).toBe(200);
    const tokenDevice2 = login2.body.refreshToken;

    // Trigger lockout via 5 failed attempts
    for (let i = 0; i < 5; i++) {
      await request.post('/api/v1/auth/login').send({
        whatsapp: customerUser.whatsapp,
        password: 'WrongPassword@999',
      });
    }

    // Both device tokens must fail refresh with 401
    const refresh1 = await request.post('/api/v1/auth/refresh').send({
      refreshToken: tokenDevice1,
    });
    expect(refresh1.status).toBe(401);

    const refresh2 = await request.post('/api/v1/auth/refresh').send({
      refreshToken: tokenDevice2,
    });
    expect(refresh2.status).toBe(401);

    // Check AuditLog recorded count of 2 revoked tokens
    const audit = await prisma.auditLog.findFirst({
      where: { event: 'USER_LOGIN_LOCKED', actorId: customerUser.id },
    });
    const meta = audit?.meta as Record<string, unknown>;
    expect(meta.revokedTokensCount).toBe(2);
  });

  it('3. rejects refresh request with 403 if user has loginLockedAt set directly', async () => {
    const request = getRequest();

    // User logs in
    const loginRes = await request.post('/api/v1/auth/login').send({
      whatsapp: customerUser.whatsapp,
      password: 'Customer@12345',
    });
    const { refreshToken } = loginRes.body;

    // Force loginLockedAt directly in DB without revoking the token (testing defense-in-depth in refresh endpoint)
    await prisma.user.update({
      where: { id: customerUser.id },
      data: { loginLockedAt: new Date() },
    });

    // Refresh should reject with 403 Forbidden
    const refreshRes = await request.post('/api/v1/auth/refresh').send({
      refreshToken,
    });
    expect(refreshRes.status).toBe(403);
    expect(refreshRes.body.message).toBe(LOGIN_LOCKED_MESSAGE);
  });

  it('4. ensures exactly one transaction wins and locks/revokes under simultaneous concurrent lockout race condition', async () => {
    const request = getRequest();

    // User logs in and obtains active refresh token
    const loginRes = await request.post('/api/v1/auth/login').send({
      whatsapp: customerUser.whatsapp,
      password: 'Customer@12345',
    });
    const { refreshToken } = loginRes.body;

    // Set user to 4 failed attempts (1 attempt away from threshold)
    await prisma.user.update({
      where: { id: customerUser.id },
      data: { failedLoginAttempts: 4, loginLockedAt: null },
    });

    // Fire 2 simultaneous failed login attempts racing to lock the account
    const [res1, res2] = await Promise.all([
      request.post('/api/v1/auth/login').send({
        whatsapp: customerUser.whatsapp,
        password: 'ConcurrentFail1@123',
      }),
      request.post('/api/v1/auth/login').send({
        whatsapp: customerUser.whatsapp,
        password: 'ConcurrentFail2@123',
      }),
    ]);

    // Both requests must end up rejected with 403 Forbidden
    expect(res1.status).toBe(403);
    expect(res2.status).toBe(403);
    expect(res1.body.message).toBe(LOGIN_LOCKED_MESSAGE);
    expect(res2.body.message).toBe(LOGIN_LOCKED_MESSAGE);

    // Exactly ONE USER_LOGIN_LOCKED audit log must exist (CAS prevented double execution)
    const auditLogs = await prisma.auditLog.findMany({
      where: { event: 'USER_LOGIN_LOCKED', actorId: customerUser.id },
    });
    expect(auditLogs).toHaveLength(1);

    // Refresh token must be revoked
    const refreshRes = await request.post('/api/v1/auth/refresh').send({
      refreshToken,
    });
    expect(refreshRes.status).toBe(401);
  });
});
