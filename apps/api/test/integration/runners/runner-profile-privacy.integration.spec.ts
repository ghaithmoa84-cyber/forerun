import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import supertest from 'supertest';
import { createTestApp, closeTestApp } from '../helpers/app.helper';
import { seedAdmin, seedRunner, loginAs } from '../helpers/seed.helper';
import { cleanDatabase } from '../setup';

describe('Runner Profile Least Privilege & Admin Notes (Integration)', () => {
  let app: INestApplication;
  let request: ReturnType<typeof supertest>;
  let prisma: PrismaClient;

  let adminToken: string;
  let runnerToken: string;
  let runnerRecord: any;

  beforeAll(async () => {
    app = await createTestApp();
    request = supertest(app.getHttpServer());
    prisma = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_URL_TEST || process.env.DATABASE_URL } },
    });
    await prisma.$connect();
    await cleanDatabase();

    const adminUser = await seedAdmin(prisma);
    const runnerUser = await seedRunner(prisma);

    [adminToken, runnerToken] = await Promise.all([
      loginAs(request, adminUser.whatsapp, 'Admin@12345'),
      loginAs(request, runnerUser.whatsapp, 'Runner@12345'),
    ]);

    // Seed administrative notes on runner directly in DB
    runnerRecord = await prisma.runner.update({
      where: { userId: runnerUser.id },
      data: { notes: 'Confidential performance notes for internal evaluation' },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await closeTestApp();
  });

  it('1. GET /api/v1/runner/me strictly does NOT contain notes in the response', async () => {
    const res = await request
      .get('/api/v1/runner/me')
      .set('Authorization', `Bearer ${runnerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(runnerRecord.id);

    // Negative assertions: notes must never be exposed to the runner
    expect('notes' in res.body).toBe(false);
    expect(res.body).not.toHaveProperty('notes');
    expect(res.body.notes).toBeUndefined();
  });

  it('2. Admin routes (PUT /admin/runners/:id and GET /admin/runners) view and update notes normally', async () => {
    // 2a. Admin updates runner notes
    const updateRes = await request
      .put(`/api/v1/admin/runners/${runnerRecord.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        notes: 'Promoted to senior tier runner by dispatch',
      });

    expect(updateRes.status).toBe(200);

    // 2b. Verify admin list includes the updated notes
    const listRes = await request
      .get('/api/v1/admin/runners?page=1&limit=10')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(listRes.status).toBe(200);
    const foundRunner = listRes.body.data.find((r: any) => r.id === runnerRecord.id);
    expect(foundRunner).toBeDefined();
    expect(foundRunner.notes).toBe('Promoted to senior tier runner by dispatch');
    expect('notes' in foundRunner).toBe(true);

    // 2c. Runner re-fetches /runner/me: notes remain strictly masked/absent
    const runnerRes = await request
      .get('/api/v1/runner/me')
      .set('Authorization', `Bearer ${runnerToken}`);

    expect(runnerRes.status).toBe(200);
    expect('notes' in runnerRes.body).toBe(false);
    expect(runnerRes.body).not.toHaveProperty('notes');
  });
});
