import { describe, it, expect, beforeEach } from 'vitest';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerStorageService, ThrottlerException } from '@nestjs/throttler';
import { UserThrottlerGuard } from '../../src/common/guards/user-throttler.guard.js';
import { OrdersController } from '../../src/modules/orders/orders.controller.js';

describe('UserThrottlerGuard & Customer Orders Rate Limiting', () => {
  let guard: UserThrottlerGuard;
  let storageService: ThrottlerStorageService;
  let reflector: Reflector;

  beforeEach(async () => {
    storageService = new ThrottlerStorageService();
    reflector = new Reflector();
    guard = new UserThrottlerGuard(
      {
        throttlers: [
          {
            name: 'default',
            ttl: 60000,
            limit: 300,
          },
        ],
      },
      storageService,
      reflector,
    );
    await guard.onModuleInit();
  });

  function createMockContext(options: {
    userId?: string;
    authHeader?: string;
    ip?: string;
    handler?: (...args: any[]) => any;
    classRef?: any;
  }): ExecutionContext {
    const req: Record<string, any> = {
      headers: {
        authorization: options.authHeader,
      },
      ip: options.ip || '192.168.1.100',
    };

    if (options.userId) {
      req.user = {
        userId: options.userId,
        role: 'CUSTOMER',
        status: 'VERIFIED',
      };
    }

    const res: Record<string, any> = {
      header: () => res,
      setHeader: () => res,
    };

    const handler = options.handler || OrdersController.prototype.create;
    const classRef = options.classRef || OrdersController;

    return {
      getHandler: () => handler,
      getClass: () => classRef,
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
        getNext: () => () => {},
      }),
    } as unknown as ExecutionContext;
  }

  describe('Tracker resolution (User vs IP)', () => {
    it('uses user ID as tracker when req.user is populated', async () => {
      const context = createMockContext({ userId: 'cust_abc_123', ip: '10.0.0.1' });
      const req = context.switchToHttp().getRequest();
      const tracker = await (guard as any).getTracker(req);
      expect(tracker).toBe('user:cust_abc_123');
    });

    it('extracts sub from Authorization header as fallback if req.user is not yet attached', async () => {
      const payloadBase64 = Buffer.from(JSON.stringify({ sub: 'cust_token_456' })).toString('base64url');
      const fakeJwt = `header.${payloadBase64}.signature`;
      const context = createMockContext({ authHeader: `Bearer ${fakeJwt}`, ip: '10.0.0.1' });
      const req = context.switchToHttp().getRequest();
      const tracker = await (guard as any).getTracker(req);
      expect(tracker).toBe('user:cust_token_456');
    });

    it('falls back to client IP for unauthenticated calls', async () => {
      const context = createMockContext({ ip: '203.0.113.195' });
      const req = context.switchToHttp().getRequest();
      const tracker = await (guard as any).getTracker(req);
      expect(tracker).toBe('203.0.113.195');
    });
  });

  describe('Customer orders throttling (max 3 per hour per account)', () => {
    it('allows 3 orders in an hour for a user, rejects the 4th with ThrottlerException', async () => {
      const sharedIp = '192.168.1.50';
      const userA = 'user_customer_A';

      // 1st request succeeds
      const ctx1 = createMockContext({ userId: userA, ip: sharedIp });
      await expect(guard.canActivate(ctx1)).resolves.toBe(true);

      // 2nd request succeeds
      const ctx2 = createMockContext({ userId: userA, ip: sharedIp });
      await expect(guard.canActivate(ctx2)).resolves.toBe(true);

      // 3rd request succeeds
      const ctx3 = createMockContext({ userId: userA, ip: sharedIp });
      await expect(guard.canActivate(ctx3)).resolves.toBe(true);

      // 4th request from same user fails with ThrottlerException (429)
      const ctx4 = createMockContext({ userId: userA, ip: sharedIp });
      await expect(guard.canActivate(ctx4)).rejects.toThrow(ThrottlerException);
    });

    it('does not penalize a different user sharing the same IP address', async () => {
      const sharedIp = '192.168.1.50';
      const userA = 'user_customer_A';
      const userB = 'user_customer_B';

      // Exhaust User A's quota
      for (let i = 0; i < 3; i++) {
        const ctxA = createMockContext({ userId: userA, ip: sharedIp });
        await expect(guard.canActivate(ctxA)).resolves.toBe(true);
      }

      // 4th request for User A is blocked
      const ctxA4 = createMockContext({ userId: userA, ip: sharedIp });
      await expect(guard.canActivate(ctxA4)).rejects.toThrow(ThrottlerException);

      // User B on the SAME IP can still successfully create orders!
      const ctxB1 = createMockContext({ userId: userB, ip: sharedIp });
      await expect(guard.canActivate(ctxB1)).resolves.toBe(true);
    });
  });

  describe('Endpoint isolation & global default limit integrity', () => {
    it('verifies that other endpoints without @Throttle keep global default (limit 300) and are not capped at 3', async () => {
      const userA = 'user_customer_A';
      const otherHandler = OrdersController.prototype.listCustomerOrders;

      // Make 6 consecutive calls to listCustomerOrders for the same user
      for (let i = 0; i < 6; i++) {
        const ctx = createMockContext({ userId: userA, handler: otherHandler });
        await expect(guard.canActivate(ctx)).resolves.toBe(true);
      }
    });

    it('verifies that being throttled on createOrder does NOT block the user on other endpoints', async () => {
      const userA = 'user_customer_A';

      // 1. Exhaust the 3 orders quota on create
      for (let i = 0; i < 3; i++) {
        const ctxCreate = createMockContext({ userId: userA, handler: OrdersController.prototype.create });
        await expect(guard.canActivate(ctxCreate)).resolves.toBe(true);
      }

      // 4th create request is blocked
      const ctxCreateBlocked = createMockContext({ userId: userA, handler: OrdersController.prototype.create });
      await expect(guard.canActivate(ctxCreateBlocked)).rejects.toThrow(ThrottlerException);

      // 2. User A can STILL immediately access another endpoint (e.g. listCustomerOrders)
      const ctxOther = createMockContext({ userId: userA, handler: OrdersController.prototype.listCustomerOrders });
      await expect(guard.canActivate(ctxOther)).resolves.toBe(true);
    });
  });
});
