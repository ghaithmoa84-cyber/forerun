import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as crypto from 'node:crypto';
import supertest from 'supertest';
import { createTestApp, closeTestApp, getRequest } from '../helpers/app.helper.js';
import { cleanDatabase, prisma } from '../setup.js';
import { seedCustomer, seedAdmin, loginAs } from '../helpers/seed.helper.js';

function base64url(input: string | Buffer): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf.toString('base64url');
}

function getPrivateKeyPem(): string {
  const raw = process.env.JWT_PRIVATE_KEY || '';
  return raw.includes('-----BEGIN') ? raw.replace(/\\n/g, '\n') : Buffer.from(raw, 'base64').toString('utf8');
}

function getPublicKeyPem(): string {
  const raw = process.env.JWT_PUBLIC_KEY || '';
  return raw.includes('-----BEGIN') ? raw.replace(/\\n/g, '\n') : Buffer.from(raw, 'base64').toString('utf8');
}

function signRS256(payload: object, privateKeyPem: string, headerOverrides: object = {}): string {
  const header = { alg: 'RS256', typ: 'JWT', ...headerOverrides };
  const h = base64url(JSON.stringify(header));
  const p = base64url(JSON.stringify(payload));
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(`${h}.${p}`);
  const sig = signer.sign(privateKeyPem, 'base64url');
  return `${h}.${p}.${sig}`;
}

function signHS256(payload: object, secret: string | Buffer): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const h = base64url(JSON.stringify(header));
  const p = base64url(JSON.stringify(payload));
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(`${h}.${p}`);
  const sig = hmac.digest('base64url');
  return `${h}.${p}.${sig}`;
}

function makeNoneToken(payload: object): string {
  const header = { alg: 'none', typ: 'JWT' };
  const h = base64url(JSON.stringify(header));
  const p = base64url(JSON.stringify(payload));
  return `${h}.${p}.`;
}

describe('Audit: Live Verification of JWT Token Forgery Resistance & Algorithm Hardening', () => {
  let request: ReturnType<typeof supertest>;

  beforeAll(async () => {
    await createTestApp();
    request = getRequest();
  });

  afterAll(async () => {
    await closeTestApp();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('Case 1 (Expired Token): rejects legitimately signed RS256 token whose exp is in the past with 401', async () => {
    const customer = await seedCustomer(prisma);
    const privateKey = getPrivateKeyPem();

    const nowSeconds = Math.floor(Date.now() / 1000);
    const expiredPayload = {
      sub: customer.id,
      role: 'CUSTOMER',
      status: 'VERIFIED',
      iat: nowSeconds - 7200,
      exp: nowSeconds - 3600, // expired 1 hour ago
    };

    const token = signRS256(expiredPayload, privateKey);

    const res = await request
      .get('/api/v1/customer/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid or expired token/i);
  });

  it('Case 2 (Wrong Key Forgery): rejects RS256 token signed with an independent untrusted RSA private key with 401', async () => {
    const customer = await seedCustomer(prisma);

    // Generate ephemeral attacker RSA-2048 keypair
    const attackerKeypair = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });

    const nowSeconds = Math.floor(Date.now() / 1000);
    const forgedPayload = {
      sub: customer.id,
      role: 'CUSTOMER',
      status: 'VERIFIED',
      iat: nowSeconds,
      exp: nowSeconds + 3600,
    };

    const token = signRS256(forgedPayload, attackerKeypair.privateKey);

    const res = await request
      .get('/api/v1/customer/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid or expired token/i);
  });

  it('Case 3 (alg: none Attack): rejects token with alg: "none" and empty signature with 401', async () => {
    const customer = await seedCustomer(prisma);

    const nowSeconds = Math.floor(Date.now() / 1000);
    const payload = {
      sub: customer.id,
      role: 'CUSTOMER',
      status: 'VERIFIED',
      iat: nowSeconds,
      exp: nowSeconds + 3600,
    };

    const token = makeNoneToken(payload);

    const res = await request
      .get('/api/v1/customer/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid or expired token/i);
  });

  it('Case 4 (Algorithm Confusion Attack): rejects HS256 token signed with server public key as secret with 401', async () => {
    const customer = await seedCustomer(prisma);
    const publicKeyPem = getPublicKeyPem();

    const nowSeconds = Math.floor(Date.now() / 1000);
    const confusionPayload = {
      sub: customer.id,
      role: 'CUSTOMER',
      status: 'VERIFIED',
      iat: nowSeconds,
      exp: nowSeconds + 3600,
    };

    // Attacker uses server's known public key string as HMAC secret key
    const token = signHS256(confusionPayload, publicKeyPem);

    const res = await request
      .get('/api/v1/customer/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid or expired token/i);
  });

  it('Case 5 (Role Segregation): returns 403 Forbidden (not 401 or 200) when a valid CUSTOMER token accesses ADMIN-only endpoint', async () => {
    const customer = await seedCustomer(prisma);
    const token = await loginAs(request, customer.whatsapp, 'Customer@12345');

    // Attempt to access ADMIN-only ledger endpoint with legitimate CUSTOMER token
    const res = await request
      .get('/api/v1/admin/ledger')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/required role: admin/i);
  });

  it('Case 6 (Payload Tampering): rejects token with modified sub/payload without valid re-signature with 401', async () => {
    const customerA = await seedCustomer(prisma);
    const customerB = await prisma.user.create({
      data: {
        name: 'Target Customer B',
        whatsapp: '0999000099',
        passwordHash: customerA.passwordHash,
        role: 'CUSTOMER',
        status: 'VERIFIED',
        customer: { create: {} },
      },
    });

    const legitimateToken = await loginAs(request, customerA.whatsapp, 'Customer@12345');
    const [headerB64, payloadB64, sigB64] = legitimateToken.split('.');

    // Tamper with payload: change sub to customerB.id
    const payloadJson = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    payloadJson.sub = customerB.id;
    const tamperedPayloadB64 = base64url(JSON.stringify(payloadJson));

    const tamperedToken = `${headerB64}.${tamperedPayloadB64}.${sigB64}`;

    const res = await request
      .get('/api/v1/customer/me')
      .set('Authorization', `Bearer ${tamperedToken}`);

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid or expired token/i);
  });
});
