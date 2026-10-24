import { z } from 'zod';
import { PaginatedMetaSchema } from './order.types.js';

export const CloseSettlementSchema = z.object({
  operationalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format, expected YYYY-MM-DD').refine(
    (val) => {
      const [year, month, day] = val.split('-').map(Number);
      const date = new Date(Date.UTC(year, month - 1, day));
      return date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day;
    },
    'Invalid date: components do not form a valid UTC date',
  ),
  notes: z.string().nullable(),
});

export type CloseSettlementRequest = z.infer<typeof CloseSettlementSchema>;

export const SettlementItemSchema = z.object({
  id: z.string(),
  settlementId: z.string(),
  orderId: z.string(),
  orderFee: z.number().int(),
});

export type SettlementItem = z.infer<typeof SettlementItemSchema>;

export const SETTLEMENT_STATUS_VALUES = ['PENDING', 'SETTLED'] as const;
export type SettlementStatus = (typeof SETTLEMENT_STATUS_VALUES)[number];

export const SettlementSchema = z.object({
  id: z.string(),
  runnerId: z.string(),
  operationalDate: z.string(),
  status: z.enum(SETTLEMENT_STATUS_VALUES),
  totalOrders: z.number().int(),
  totalFees: z.number().int(),
  notes: z.string().nullable(),
  closedAt: z.date().nullable(),
  closedByAdminId: z.string().nullable(),
  createdAt: z.date(),
});

export type Settlement = z.infer<typeof SettlementSchema>;

export const SettlementListResponseSchema = z.object({
  data: z.array(SettlementSchema),
  meta: z.object({
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    totalPages: z.number(),
  }),
});

export type SettlementListResponse = z.infer<typeof SettlementListResponseSchema>;

export const SettlementAdminQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['PENDING', 'SETTLED']).optional(),
  runnerId: z.string().trim().min(1).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export type SettlementAdminQuery = z.infer<typeof SettlementAdminQuerySchema>;

export const RunnerSettlementItemSchema = z.object({
  orderNumber: z.string(),
  totalFee: z.number().int(),
  deliveredAt: z.date(),
});

export type RunnerSettlementItem = z.infer<typeof RunnerSettlementItemSchema>;

export const RunnerSettlementSchema = z.object({
  operationalDate: z.string(),
  status: z.enum(['PENDING', 'SETTLED']),
  totalOrders: z.number().int(),
  totalFees: z.number().int(),
});

export type RunnerSettlement = z.infer<typeof RunnerSettlementSchema>;

export const RunnerSettlementListResponseSchema = z.object({
  data: z.array(RunnerSettlementSchema),
  meta: PaginatedMetaSchema,
});

export type RunnerSettlementListResponse = z.infer<typeof RunnerSettlementListResponseSchema>;

export const RUNNER_CURRENT_SETTLEMENT_STATUS_VALUES = [
  'NOT_CLOSED',
  'PENDING',
  'SETTLED',
] as const;

export type RunnerCurrentSettlementStatus =
  (typeof RUNNER_CURRENT_SETTLEMENT_STATUS_VALUES)[number];

export const RunnerCurrentSettlementSchema = z.object({
  operationalDate: z.string(),
  status: z.enum(RUNNER_CURRENT_SETTLEMENT_STATUS_VALUES),
  totalOrders: z.number().int(),
  totalFees: z.number().int(),
  estimatedRunnerShare: z.number().int(),
  estimatedPlatformShare: z.number().int(),
  orders: z.array(RunnerSettlementItemSchema),
});

export type RunnerCurrentSettlement = z.infer<typeof RunnerCurrentSettlementSchema>;

export const RunnerSettlementsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type RunnerSettlementsQuery = z.infer<typeof RunnerSettlementsQuerySchema>;

export const PendingSettlementsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type PendingSettlementsQuery = z.infer<typeof PendingSettlementsQuerySchema>;
