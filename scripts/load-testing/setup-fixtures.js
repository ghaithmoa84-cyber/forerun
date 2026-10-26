/**
 * Test Fixtures Setup for FAWRUN Load Testing
 * 
 * Provisions clear, isolated dummy test accounts:
 * - Customers: 0999900001 - 0999900050
 * - Runners  : 0999800001 - 0999800010
 * - Admin    : 0999000001
 * 
 * Uses direct Prisma seeding when DATABASE_URL is available (local dev),
 * or loads existing credentials and caches them in .fixtures.json.
 */

import fs from 'fs';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { CONFIG } from './config.js';

const TOTAL_CUSTOMERS = 50;
const TOTAL_RUNNERS = 10;

export async function setupFixtures(forceRefresh = false) {
  // If cache exists and not forced, return cached fixtures
  if (!forceRefresh && fs.existsSync(CONFIG.FIXTURES_PATH)) {
    try {
      const cached = JSON.parse(fs.readFileSync(CONFIG.FIXTURES_PATH, 'utf-8'));
      if (cached.customers?.length >= TOTAL_CUSTOMERS && cached.runners?.length >= TOTAL_RUNNERS) {
        console.log(`[Fixtures] Using existing cached fixtures from ${CONFIG.FIXTURES_PATH}`);
        return cached;
      }
    } catch {
      // Fall through to re-generate
    }
  }

  console.log(`[Fixtures] Setting up load testing fixtures in database...`);
  const prisma = new PrismaClient();

  try {
    const passwordHash = await bcrypt.hash(CONFIG.TEST_PASSWORD, 10);
    const adminHash = await bcrypt.hash(CONFIG.ADMIN_PASSWORD, 10);

    // 1. Ensure Admin
    await prisma.user.upsert({
      where: { whatsapp: CONFIG.ADMIN_WHATSAPP },
      update: {
        role: 'ADMIN',
        status: 'VERIFIED',
      },
      create: {
        name: 'Load Test Admin',
        whatsapp: CONFIG.ADMIN_WHATSAPP,
        passwordHash: adminHash,
        role: 'ADMIN',
        status: 'VERIFIED',
        admin: { create: {} },
      },
    });

    const adminUser = await prisma.user.findUnique({
      where: { whatsapp: CONFIG.ADMIN_WHATSAPP },
      include: { admin: true },
    });
    if (!adminUser.admin) {
      await prisma.admin.create({ data: { userId: adminUser.id } });
    }

    // 2. Ensure 50 Customers
    const customers = [];
    for (let i = 1; i <= TOTAL_CUSTOMERS; i++) {
      const pad = String(i).padStart(4, '0');
      const whatsapp = `099990${pad}`;
      const name = `LoadTest Customer ${i}`;

      const user = await prisma.user.upsert({
        where: { whatsapp },
        update: {
          role: 'CUSTOMER',
          status: 'VERIFIED',
          passwordHash,
        },
        create: {
          name,
          whatsapp,
          passwordHash,
          role: 'CUSTOMER',
          status: 'VERIFIED',
        },
      });

      let customer = await prisma.customer.findUnique({
        where: { userId: user.id },
        include: { address: true },
      });

      if (!customer) {
        customer = await prisma.customer.create({
          data: {
            userId: user.id,
            address: {
              create: {
                lat: 33.5138,
                lng: 36.2765,
                description: 'Damascus Load Test Address',
              },
            },
          },
          include: { address: true },
        });
      } else if (!customer.address) {
        await prisma.customerAddress.create({
          data: {
            customerId: customer.id,
            lat: 33.5138,
            lng: 36.2765,
            description: 'Damascus Load Test Address',
          },
        });
      }

      customers.push({
        userId: user.id,
        customerId: customer.id,
        whatsapp,
        password: CONFIG.TEST_PASSWORD,
        name,
      });
    }

    // 3. Ensure 10 Runners
    const runners = [];
    for (let i = 1; i <= TOTAL_RUNNERS; i++) {
      const pad = String(i).padStart(4, '0');
      const whatsapp = `099980${pad}`;
      const name = `LoadTest Runner ${i}`;

      const user = await prisma.user.upsert({
        where: { whatsapp },
        update: {
          role: 'RUNNER',
          status: 'VERIFIED',
          passwordHash,
        },
        create: {
          name,
          whatsapp,
          passwordHash,
          role: 'RUNNER',
          status: 'VERIFIED',
        },
      });

      let runner = await prisma.runner.findUnique({
        where: { userId: user.id },
      });

      if (!runner) {
        runner = await prisma.runner.create({
          data: {
            userId: user.id,
            status: 'AVAILABLE',
            isVisible: true,
          },
        });
      } else {
        await prisma.runner.update({
          where: { id: runner.id },
          data: { status: 'AVAILABLE', isVisible: true },
        });
      }

      runners.push({
        userId: user.id,
        runnerId: runner.id,
        whatsapp,
        password: CONFIG.TEST_PASSWORD,
        name,
      });
    }

    const fixtures = {
      admin: {
        userId: adminUser.id,
        whatsapp: CONFIG.ADMIN_WHATSAPP,
        password: CONFIG.ADMIN_PASSWORD,
      },
      customers,
      runners,
      createdAt: new Date().toISOString(),
    };

    fs.writeFileSync(CONFIG.FIXTURES_PATH, JSON.stringify(fixtures, null, 2));
    console.log(`[Fixtures] Successfully provisioned:`);
    console.log(`  - 1 Admin (${CONFIG.ADMIN_WHATSAPP})`);
    console.log(`  - ${customers.length} Customers (0999900001 - 0999900050)`);
    console.log(`  - ${runners.length} Runners (0999800001 - 0999800010)`);
    console.log(`  - Saved to ${CONFIG.FIXTURES_PATH}`);

    return fixtures;
  } finally {
    await prisma.$disconnect();
  }
}

// Allow CLI execution directly: node setup-fixtures.js [--force]
if (process.argv[1]?.endsWith('setup-fixtures.js')) {
  const force = process.argv.includes('--force');
  setupFixtures(force)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Fixtures Error]', err);
      process.exit(1);
    });
}
