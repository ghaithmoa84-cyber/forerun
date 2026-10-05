import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { applySoftDeleteMiddleware } from '../common/prisma-soft-delete.middleware.js';

// Module augmentation to add generated models to PrismaClient
// Using loose types to allow flexible where clauses
declare module '@prisma/client' {
  interface PrismaClient {
    deviceToken: {
      findMany: (args?: unknown) => Promise<{ id: string; token: string }[]>;
      deleteMany: (args: unknown) => Promise<{ count: number }>;
      create: (args: unknown) => Promise<{ id: string; userId: string; token: string; platform: string; createdAt: Date; updatedAt: Date }>;
      upsert: (args: unknown) => Promise<{ id: string; userId: string; token: string; platform: string; createdAt: Date; updatedAt: Date }>;
      findUnique: (args: unknown) => Promise<{ id: string; token: string } | null>;
    };
  }
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super();
    applySoftDeleteMiddleware(this);
  }

  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
