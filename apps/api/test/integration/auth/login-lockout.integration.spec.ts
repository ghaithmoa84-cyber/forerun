import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import * as crypto from 'crypto';
import type { Socket } from 'socket.io';
import { cleanDatabase, prisma } from '../setup.js';
import { createTestApp, closeTestApp, getRequest, getTestApp } from '../helpers/app.helper.js';
import { seedAdmin, seedCustomer, loginAs } from '../helpers/seed.helper.js';
import { LOGIN_LOCKED_MESSAGE } from '@forerun/shared-constants';
import { OrdersGateway } from '../../../src/websocket/gateways/orders.gateway.js';

const jwtKeys = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { format: 'pem', type: 'pkcs8' },
  publicKeyEncoding: { format: 'pem', type: 'spki' },
});

describe('Login Lockout & Brute Force Hardening Integration Tests (BF-7)', () => {
  let adminToken: string;
  let customerUser: any;
  let adminUser: any;

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
    adminUser = await seedAdmin(prisma);
    customerUser = await seedCustomer(prisma);
    const request = getRequest();
    adminToken = await loginAs(request, adminUser.whatsapp, 'Admin@12345');
  });

  it('1. progressively locks account on 5th consecutive failed attempt and rejects 6th attempt with 403 even if password is correct', async () => {
    const request = getRequest();

    for (let attempt = 1; attempt <= 4; attempt++) {
      const res = await request.post('/api/v1/auth/login').send({
        whatsapp: customerUser.whatsapp,
        password: 'WrongPassword@123',
      });
      expect(res.status).toBe(401);
      expect(res.body.message).toBe('رقم الواتساب أو كلمة المرور غير صحيحة');

      const u = await prisma.user.findUnique({
        where: { id: customerUser.id },
        select: { failedLoginAttempts: true, loginLockedAt: true },
      });
      expect(u?.failedLoginAttempts).toBe(attempt);
      expect(u?.loginLockedAt).toBeNull();
    }

    // 5th attempt: triggers lockout
    const res5 = await request.post('/api/v1/auth/login').send({
      whatsapp: customerUser.whatsapp,
      password: 'WrongPassword@123',
    });
    expect(res5.status).toBe(403);
    expect(res5.body.message).toBe(LOGIN_LOCKED_MESSAGE);

    const lockedUser = await prisma.user.findUnique({
      where: { id: customerUser.id },
      select: { failedLoginAttempts: true, loginLockedAt: true },
    });
    expect(lockedUser?.failedLoginAttempts).toBe(5);
    expect(lockedUser?.loginLockedAt).not.toBeNull();

    // Check AuditLog for USER_LOGIN_LOCKED
    const audit = await prisma.auditLog.findFirst({
      where: { event: 'USER_LOGIN_LOCKED', actorId: customerUser.id },
    });
    expect(audit).toBeDefined();

    // 6th attempt: with CORRECT password still rejected with 403 Forbidden
    const res6 = await request.post('/api/v1/auth/login').send({
      whatsapp: customerUser.whatsapp,
      password: 'Customer@12345',
    });
    expect(res6.status).toBe(403);
    expect(res6.body.message).toBe(LOGIN_LOCKED_MESSAGE);
  });

  it('2. resets failedLoginAttempts to 0 upon successful login before reaching lockout threshold', async () => {
    const request = getRequest();

    for (let i = 0; i < 3; i++) {
      await request.post('/api/v1/auth/login').send({
        whatsapp: customerUser.whatsapp,
        password: 'WrongPassword@123',
      });
    }

    let userInDb = await prisma.user.findUnique({
      where: { id: customerUser.id },
      select: { failedLoginAttempts: true, loginLockedAt: true },
    });
    expect(userInDb?.failedLoginAttempts).toBe(3);
    expect(userInDb?.loginLockedAt).toBeNull();

    // Successful login
    const successRes = await request.post('/api/v1/auth/login').send({
      whatsapp: customerUser.whatsapp,
      password: 'Customer@12345',
    });
    expect(successRes.status).toBe(200);
    expect(successRes.body.accessToken).toBeDefined();

    // Counter reset in DB
    userInDb = await prisma.user.findUnique({
      where: { id: customerUser.id },
      select: { failedLoginAttempts: true, loginLockedAt: true },
    });
    expect(userInDb?.failedLoginAttempts).toBe(0);
    expect(userInDb?.loginLockedAt).toBeNull();
  });

  it('3. handles concurrent failed login attempts safely without double-jumping or missing lockout threshold', async () => {
    const request = getRequest();

    // Start with user at 3 attempts
    await prisma.user.update({
      where: { id: customerUser.id },
      data: { failedLoginAttempts: 3, loginLockedAt: null },
    });

    // Fire 2 concurrent failed login attempts (should land at 4 and 5)
    const [res1, res2] = await Promise.all([
      request.post('/api/v1/auth/login').send({
        whatsapp: customerUser.whatsapp,
        password: 'ConcurrentWrong1@123',
      }),
      request.post('/api/v1/auth/login').send({
        whatsapp: customerUser.whatsapp,
        password: 'ConcurrentWrong2@123',
      }),
    ]);

    // One must be 401 (reached 4), the other must be 403 (reached 5 and locked)
    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([401, 403]);

    const finalUser = await prisma.user.findUnique({
      where: { id: customerUser.id },
      select: { failedLoginAttempts: true, loginLockedAt: true },
    });
    expect(finalUser?.failedLoginAttempts).toBe(5);
    expect(finalUser?.loginLockedAt).not.toBeNull();
  });

  it('4. admin resetPassword unlocks account and permits immediate login with new credentials', async () => {
    const request = getRequest();

    // Lock account
    await prisma.user.update({
      where: { id: customerUser.id },
      data: { failedLoginAttempts: 5, loginLockedAt: new Date() },
    });

    // Attempt login -> 403
    const lockedRes = await request.post('/api/v1/auth/login').send({
      whatsapp: customerUser.whatsapp,
      password: 'Customer@12345',
    });
    expect(lockedRes.status).toBe(403);
    expect(lockedRes.body.message).toBe(LOGIN_LOCKED_MESSAGE);

    // Admin reset password
    const resetRes = await request
      .put(`/api/v1/admin/users/${customerUser.id}/reset-password`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ password: 'UnlockedPassword@2026' });
    expect(resetRes.status).toBe(200);

    // Verify unlocked in DB
    const u = await prisma.user.findUnique({
      where: { id: customerUser.id },
      select: { failedLoginAttempts: true, loginLockedAt: true },
    });
    expect(u?.failedLoginAttempts).toBe(0);
    expect(u?.loginLockedAt).toBeNull();

    // Login with new password succeeds immediately
    const loginRes = await request.post('/api/v1/auth/login').send({
      whatsapp: customerUser.whatsapp,
      password: 'UnlockedPassword@2026',
    });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.accessToken).toBeDefined();
  });

  it('5. WebSocket enforces max 5 concurrent connections per user and accepts reconnect after disconnect', async () => {
    const gateway = getTestApp().get(OrdersGateway);
    const userId = customerUser.id;

    const request = getRequest();
    const loginRes = await request.post('/api/v1/auth/login').send({
      whatsapp: customerUser.whatsapp,
      password: 'Customer@12345',
    });
    const token = loginRes.body.accessToken;

    const sockets: Array<{
      handshake: { auth: { token: string } };
      data: Record<string, unknown>;
      disconnect: ReturnType<typeof vi.fn>;
      join: ReturnType<typeof vi.fn>;
    }> = [];

    // Connect 5 sockets
    for (let i = 0; i < 5; i++) {
      const s = {
        handshake: { auth: { token } },
        data: {},
        disconnect: vi.fn(),
        join: vi.fn(),
      };
      sockets.push(s);
      await gateway.handleConnection(s as unknown as Socket);
      expect(s.disconnect).not.toHaveBeenCalled();
    }
    expect(gateway.getActiveConnections(userId)).toBe(5);

    // 6th socket should be rejected
    const socket6 = {
      handshake: { auth: { token } },
      data: {},
      disconnect: vi.fn(),
      join: vi.fn(),
    };
    await gateway.handleConnection(socket6 as unknown as Socket);
    expect(socket6.disconnect).toHaveBeenCalledWith(true);
    expect(gateway.getActiveConnections(userId)).toBe(5);

    // Disconnect one socket
    gateway.handleDisconnect(sockets[0] as unknown as Socket);
    expect(gateway.getActiveConnections(userId)).toBe(4);

    // Connect a new socket -> accepted
    const socket7 = {
      handshake: { auth: { token } },
      data: {},
      disconnect: vi.fn(),
      join: vi.fn(),
    };
    await gateway.handleConnection(socket7 as unknown as Socket);
    expect(socket7.disconnect).not.toHaveBeenCalled();
    expect(gateway.getActiveConnections(userId)).toBe(5);

    // Clean up
    for (let i = 1; i < 5; i++) {
      gateway.handleDisconnect(sockets[i] as unknown as Socket);
    }
    gateway.handleDisconnect(socket7 as unknown as Socket);
    expect(gateway.getActiveConnections(userId)).toBe(0);
  });

  it('6. confirms register and createOrder regression sanity is preserved', async () => {
    const request = getRequest();

    // Register a new customer
    const regRes = await request.post('/api/v1/auth/register').send({
      name: 'Regression Customer',
      whatsapp: '0999555111',
      password: 'Password@123',
      address: { lat: 33.5138, lng: 36.2765, description: 'Regression Address' },
    });
    expect(regRes.status).toBe(201);

    // Create order for existing customer
    const custToken = await loginAs(request, customerUser.whatsapp, 'Customer@12345');
    const orderRes = await request
      .post('/api/v1/customer/orders')
      .set('Authorization', `Bearer ${custToken}`)
      .send({
        items: [
          {
            itemName: 'حليب',
            quantity: '2',
            customStoreName: 'متجر تجريبي',
            anyStore: false,
          },
        ],
        notes: null,
        preferredRunnerId: null,
        waitForPreferred: false,
        deliveryAddress: {
          lat: 33.5138,
          lng: 36.2765,
          description: 'Damascus Test Address',
        },
        createIdempotencyKey: 'regr-idemp-' + Date.now(),
      });
    expect(orderRes.status).toBe(201);
    expect(orderRes.body.orderNumber).toBeDefined();
  });
});

