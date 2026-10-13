import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import supertest from 'supertest';
import { AppModule } from '../../../src/app.module';
import { seedAdmin, seedCustomer, loginAs } from '../helpers/seed.helper';
import { cleanDatabase } from '../setup';
import { ACCOUNT_SUSPENDED_MESSAGE } from '@forerun/shared-constants';

describe('Audit: Security Scans by Actual Execution', () => {
  let app: INestApplication;
  let request: ReturnType<typeof supertest>;
  let prisma: PrismaClient;

  beforeAll(async () => {
    // Set CORS_ORIGINS to specific allowed origins for testing
    process.env.CORS_ORIGINS = 'http://localhost:3000,https://fawrun-admin.vercel.app';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    app.setGlobalPrefix('api/v1');
    app.enableCors({
      origin: ['http://localhost:3000', 'https://fawrun-admin.vercel.app'],
      credentials: true,
    });
    await app.init();

    request = supertest(app.getHttpServer());
    prisma = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_URL_TEST || process.env.DATABASE_URL } },
    });
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  describe('1. Suspended Account Enforcement on Protected Endpoints', () => {
    it('proves that a SUSPENDED user is rejected with 401 on every authenticated request even with a valid unexpired JWT', async () => {
      await cleanDatabase();
      const customer = await seedCustomer(prisma);
      const token = await loginAs(request, customer.whatsapp, 'Customer@12345');
      expect(token).toBeDefined();

      // Verify access works while VERIFIED
      const resBefore = await request
        .get('/api/v1/customer/me')
        .set('Authorization', `Bearer ${token}`);
      expect(resBefore.status).toBe(200);

      // Now suspend the customer in the database
      await prisma.user.update({
        where: { id: customer.id },
        data: { status: UserStatus.SUSPENDED },
      });

      // Try accessing the same protected endpoint with the unexpired JWT
      const resAfter = await request
        .get('/api/v1/customer/me')
        .set('Authorization', `Bearer ${token}`);

      console.log('[SECURITY AUDIT] SUSPENDED USER RESPONSE:', resAfter.status, resAfter.body);
      expect(resAfter.status).toBe(401);
      expect(resAfter.body.message).toBe(ACCOUNT_SUSPENDED_MESSAGE);
    });
  });

  describe('2. Large Payload Protection (Body Parser Limits)', () => {
    it('verifies that oversized JSON payloads are rejected by the HTTP body parser', async () => {
      const hugeString = 'A'.repeat(2 * 1024 * 1024);
      const res = await request
        .post('/api/v1/auth/login')
        .send({ whatsapp: '0999000001', password: hugeString });

      console.log('[SECURITY AUDIT] OVERSIZED PAYLOAD RESPONSE:', res.status);
      expect(res.status).toBe(413);
    });
  });

  describe('3. SQL Injection Resilience on Inputs', () => {
    it('verifies that SQL injection strings in parameters and body are sanitized by Zod & Prisma', async () => {
      const sqlInjectionPayload = "0999000001' OR '1'='1";
      const res = await request
        .post('/api/v1/auth/login')
        .send({ whatsapp: sqlInjectionPayload, password: 'password123' });

      console.log('[SECURITY AUDIT] SQL INJECTION INPUT RESPONSE:', res.status, res.body);
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('رقم الواتساب');
    });
  });

  describe('4. Permissive vs Strict Zod Schemas (Unknown Key Stripping)', () => {
    it('verifies that unknown keys are silently stripped rather than rejected with an error', async () => {
      await cleanDatabase();
      const customer = await seedCustomer(prisma);

      const res = await request
        .post('/api/v1/auth/login')
        .send({
          whatsapp: customer.whatsapp,
          password: 'Customer@12345',
          maliciousInjectedField: 'DROP TABLE users;',
          isAdmin: true,
        });

      console.log('[SECURITY AUDIT] UNKNOWN KEYS LOGIN RESPONSE:', res.status);
      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
    });
  });

  describe('5. Rate Limiting Active Enforcement in Code', () => {
    it('proves that rate limiting triggers 429 Too Many Requests upon rapid bursts on login endpoint', async () => {
      await cleanDatabase();
      const customer = await seedCustomer(prisma);

      const requests = Array.from({ length: 15 }).map(() =>
        request
          .post('/api/v1/auth/login')
          .send({ whatsapp: customer.whatsapp, password: 'WrongPassword@123' })
      );

      const responses = await Promise.all(requests);
      const statuses = responses.map((r) => r.status);
      console.log('[SECURITY AUDIT] BURST LOGIN STATUSES:', statuses);

      const has429 = statuses.some((s) => s === 429);
      console.log('[SECURITY AUDIT] RATE LIMITING (429) TRIGGERED:', has429);
      expect(has429).toBe(true);
    });
  });

  describe('6. CORS Origin Rejection on Unauthorized Origins', () => {
    it('verifies that preflight OPTIONS from unauthorized origin lacks Access-Control-Allow-Origin', async () => {
      const unauthorizedOrigin = 'http://malicious-attacker.com';
      const res = await request
        .options('/api/v1/auth/login')
        .set('Origin', unauthorizedOrigin)
        .set('Access-Control-Request-Method', 'POST');

      console.log('[SECURITY AUDIT] UNAUTHORIZED CORS OPTIONS HEADERS:', res.headers['access-control-allow-origin']);
      // Should NOT contain the unauthorized origin
      expect(res.headers['access-control-allow-origin']).not.toBe(unauthorizedOrigin);
    });
  });
});
