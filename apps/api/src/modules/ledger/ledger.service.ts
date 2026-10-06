import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { LedgerEntry as PrismaLedgerEntry } from '@prisma/client';
import {
  CreateLedgerEntryRequest,
  LedgerEntry,
  LedgerEntryListResult,
  LedgerQuery,
} from '@forerun/shared-types';
import { PrismaService } from '../../database/prisma.service.js';

function mapPrismaToLedgerEntry(entry: PrismaLedgerEntry): LedgerEntry {
  return {
    id: entry.id,
    orderId: entry.orderId,
    runnerId: entry.runnerId,
    type: entry.type as LedgerEntry['type'],
    amount: entry.amount,
    description: entry.description,
    meta: entry.meta as Record<string, unknown> | null,
    createdAt: entry.createdAt,
  };
}

@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  async createEntry(
    data: CreateLedgerEntryRequest,
    tx?: Prisma.TransactionClient,
  ): Promise<LedgerEntry> {
    const client = tx ?? this.prisma;
    const entry = await client.ledgerEntry.create({
      data: {
        orderId: data.orderId ?? null,
        runnerId: data.runnerId ?? null,
        type: data.type,
        amount: data.amount,
        description: data.description,
        meta: (data.meta ? data.meta : Prisma.JsonNull) as Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue,
      },
    });

    return mapPrismaToLedgerEntry(entry);
  }

  async createMany(
    entries: CreateLedgerEntryRequest[],
    tx?: Prisma.TransactionClient,
  ): Promise<LedgerEntry[]> {
    if (entries.length === 0) {
      return [];
    }

    if (tx) {
      return this.createEntriesInTransaction(entries, tx);
    }

    return this.prisma.$transaction((transactionClient) =>
      this.createEntriesInTransaction(entries, transactionClient),
    );
  }

  private async createEntriesInTransaction(
    entries: CreateLedgerEntryRequest[],
    tx: Prisma.TransactionClient,
  ): Promise<LedgerEntry[]> {
    const results: LedgerEntry[] = [];
    for (const data of entries) {
      const entry = await tx.ledgerEntry.create({
        data: {
          orderId: data.orderId ?? null,
          runnerId: data.runnerId ?? null,
          type: data.type,
          amount: data.amount,
          description: data.description,
          meta: (data.meta ? data.meta : Prisma.JsonNull) as Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue,
        },
      });
      results.push(mapPrismaToLedgerEntry(entry));
    }
    return results;
  }

  async listAdminEntries(query: LedgerQuery): Promise<LedgerEntryListResult> {
    const { page, limit, type, runnerId, orderId, dateFrom, dateTo } = query;

    const where: Prisma.LedgerEntryWhereInput = {
      ...(type ? { type: type as Prisma.LedgerEntryWhereInput['type'] } : {}),
      ...(runnerId ? { runnerId } : {}),
      ...(orderId ? { orderId } : {}),
      ...(dateFrom || dateTo
        ? {
            createdAt: {
              ...(dateFrom ? { gte: dateFrom } : {}),
              ...(dateTo ? { lte: dateTo } : {}),
            },
          }
        : {}),
    };

    const [total, entries] = await Promise.all([
      this.prisma.ledgerEntry.count({ where }),
      this.prisma.ledgerEntry.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      data: entries.map(mapPrismaToLedgerEntry),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getEntryById(id: string): Promise<LedgerEntry> {
    const entry = await this.prisma.ledgerEntry.findUnique({
      where: { id },
    });

    if (!entry) {
      throw new NotFoundException('Ledger entry not found');
    }

    return mapPrismaToLedgerEntry(entry);
  }

  async getEntriesByOrder(orderId: string): Promise<LedgerEntry[]> {
    const entries = await this.prisma.ledgerEntry.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
    });

    return entries.map(mapPrismaToLedgerEntry);
  }

  async getEntriesByRunner(runnerId: string): Promise<LedgerEntry[]> {
    const entries = await this.prisma.ledgerEntry.findMany({
      where: {
        runnerId,
        type: { in: ['RUNNER_SHARE', 'ORDER_FEE_TOTAL'] },
      },
      orderBy: { createdAt: 'asc' },
    });

    return entries.map(mapPrismaToLedgerEntry);
  }
}
