// F5: i18n Arabic Zod messages
import { z } from "zod";
import { ORDER_STATUS_VALUES } from "./customer.types.js";
import type {
  CustomerOrderItem,
  CustomerOrderStore,
} from "./customer.types.js";

const nonEmptyString = z
  .string()
  .trim()
  .min(1, "الحقل لا يمكن أن يكون فارغًا");

export const CreateOrderItemSchema = z.object({
  itemName: nonEmptyString,
  quantity: nonEmptyString,
  customStoreName: z.string().nullable(),
  anyStore: z.boolean(),
});

export const DeliveryAddressSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  description: nonEmptyString,
});

export const CreateOrderSchema = z.object({
  items: z.array(CreateOrderItemSchema).min(1, "يجب إضافة مادة واحدة على الأقل"),
  notes: z.string().nullable(),
  preferredRunnerId: z.string().nullable(),
  waitForPreferred: z.boolean(),
  deliveryAddress: DeliveryAddressSchema,
});

export type CreateOrderRequest = z.infer<typeof CreateOrderSchema>;

export const EstimatedFeeSchema = z.object({
  baseFee: z.number(),
  peripheralFee: z.number(),
  extraStoresFee: z.number(),
  totalFee: z.number(),
  note: z.string(),
});

export type EstimatedFee = z.infer<typeof EstimatedFeeSchema>;

export const CreateOrderResponseSchema = z.object({
  id: z.string(),
  orderNumber: z.string(),
  status: z.string(),
  estimatedFee: EstimatedFeeSchema,
});

export type CreateOrderResponse = z.infer<typeof CreateOrderResponseSchema>;

export const PaginatedMetaSchema = z.object({
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  totalPages: z.number(),
});

export type PaginatedMeta = z.infer<typeof PaginatedMetaSchema>;

export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(
  itemSchema: T,
) =>
  z.object({
    data: z.array(itemSchema),
    meta: PaginatedMetaSchema,
  });

export type PaginatedResponse<T> = {
  data: T[];
  meta: PaginatedMeta;
};

export const AdminOrdersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(ORDER_STATUS_VALUES).optional(),
  runnerId: z.string().trim().min(1).optional(),
  customerId: z.string().trim().min(1).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export type AdminOrdersQuery = z.infer<typeof AdminOrdersQuerySchema>;

export const RejectOrderSchema = z.object({
  cancelReason: z.string().trim().min(1).optional(),
});

export type RejectOrderRequest = z.infer<typeof RejectOrderSchema>;

export const StartOrderReviewSchema = z.object({
  notes: z.string().trim().min(1).optional(),
});

export type StartOrderReviewRequest = z.infer<typeof StartOrderReviewSchema>;

export type AdminOrderListItem = {
  id: string;
  orderNumber: string;
  status: (typeof ORDER_STATUS_VALUES)[number];
  customerId: string;
  customerName: string;
  runnerId: string | null;
  runnerName: string | null;
  preferredRunner: {
    id: string;
    name: string;
  } | null;
  totalFee: number;
  itemCount: number;
  createdAt: Date;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
};

export interface AdminOrderStoreReceipt {
  id: string;
  orderStoreId: string;
  imageUrl: string;
  r2Key: string;
  isDeleted: boolean;
  deletedAt: Date | null;
  uploadedAt: Date;
}

export const ORDER_STORE_STATUS_VALUES = [
  'PENDING',
  'PURCHASED',
  'SKIPPED',
] as const;

export type OrderStoreStatus = (typeof ORDER_STORE_STATUS_VALUES)[number];

export interface AdminOrderStore extends CustomerOrderStore {
  receipts: AdminOrderStoreReceipt[];
}

export type AdminOrderDetails = {
  id: string;
  orderNumber: string;
  status: (typeof ORDER_STATUS_VALUES)[number];
  isPeripheral: boolean;
  baseFee: number;
  peripheralFee: number;
  extraStoresFee: number;
  totalFee: number;
  deliveryLat: number;
  deliveryLng: number;
  deliveryDesc: string;
  notes: string | null;
  preferredRunnerId: string | null;
  preferredRunner: {
    id: string;
    name: string;
  } | null;
  waitForPreferred: boolean;
  createdAt: Date;
  updatedAt: Date;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  customer: {
    id: string;
    userId: string;
    name: string;
    whatsapp: string;
    altPhone: string | null;
    status: string;
  };
  runner: {
    id: string;
    userId: string;
    name: string;
    status: string;
    avgRating: number | null;
    totalRatings: number;
    isVisible: boolean;
    notes: string | null;
  } | null;
  items: CustomerOrderItem[];
   orderStores: AdminOrderStore[];
  ratings: Array<{
    id: string;
    orderId: string;
    customerId: string;
    runnerId: string | null;
    storeNameRated: string | null;
    stars: number;
    note: string | null;
    createdAt: Date;
    updatedAt: Date;
    expiresAt: Date;
    isFinal: boolean;
  }>;
};

export type AdminOrderAuditEntry = {
  id: string;
  orderId: string | null;
  actorId: string | null;
  actorRole: string | null;
  event: string;
  fromStatus: string | null;
  toStatus: string | null;
  meta: unknown;
  createdAt: Date;
};

export type AdminOrderApprovalResult = {
  order: {
    id: string;
    orderNumber: string;
    status: string;
  };
  customerId: string;
  feeChanged: boolean;
  oldFee: {
    baseFee: number;
    peripheralFee: number;
    extraStoresFee: number;
    totalFee: number;
  };
  newFee: {
    baseFee: number;
    peripheralFee: number;
    extraStoresFee: number;
    totalFee: number;
  };
};

export type AdminOrderRejectionResult = {
  order: {
    id: string;
    orderNumber: string;
    status: string;
    cancelledAt: Date | null;
  };
  customerId: string;
};

// ─────────────────────────────────────────────────────────────
// Runner Order Actions (shared contracts)
// ─────────────────────────────────────────────────────────────

export const RunnerOrderStoreParamSchema = z.object({
  id: z.string().cuid(),
  storeId: z.string().cuid(),
});

export type RunnerOrderStoreParamRequest = z.infer<
  typeof RunnerOrderStoreParamSchema
>;

export const RunnerReceiptParamSchema = z.object({
  id: z.string().cuid(),
  storeId: z.string().cuid(),
  receiptId: z.string().cuid(),
});

export type RunnerReceiptParamRequest = z.infer<
  typeof RunnerReceiptParamSchema
>;

export const MarkStoreSkippedSchema = z.object({
  reason: z.string().trim().min(1).optional(),
});

export type MarkStoreSkippedRequest = z.infer<typeof MarkStoreSkippedSchema>;

export const DeliverOrderSchema = z.object({
  idempotencyKey: z.string().uuid(),
});

export type DeliverOrderRequest = z.infer<typeof DeliverOrderSchema>;

export type RunnerOrderActionResponse = {
  orderId: string;
  orderNumber: string;
  status: string;
};

export const RunnerOrderStoreItemSchema = z.object({
  id: z.string(),
  itemName: z.string(),
  quantity: z.string(),
  customStoreName: z.string().nullable(),
  anyStore: z.boolean(),
});

export const RunnerOrderStoreReceiptSchema = z.object({
  id: z.string(),
  orderStoreId: z.string(),
  imageUrl: z.string(),
  r2Key: z.string(),
  isDeleted: z.boolean(),
  deletedAt: z.date().nullable(),
  uploadedAt: z.date(),
});

export type RunnerOrderStoreReceipt = z.infer<
  typeof RunnerOrderStoreReceiptSchema
>;

export const RunnerOrderStoreSchema = z.object({
  id: z.string(),
  storeName: z.string(),
  isAnyStore: z.boolean(),
  status: z.enum(['PENDING', 'PURCHASED', 'SKIPPED']),
  isExtra: z.boolean(),
  addedBy: z.string().nullable(),
  purchasedAt: z.date().nullable(),
  isDeleted: z.boolean(),
  deletedAt: z.date().nullable(),
  items: z.array(RunnerOrderStoreItemSchema),
  receipts: z.array(RunnerOrderStoreReceiptSchema),
});

export type RunnerOrderStore = z.infer<typeof RunnerOrderStoreSchema>;

export const RunnerOrderStoresResponseSchema = z.object({
  orderId: z.string(),
  orderNumber: z.string(),
  status: z.string(),
  stores: z.array(RunnerOrderStoreSchema),
});

export type RunnerOrderStoresResponse = z.infer<
  typeof RunnerOrderStoresResponseSchema
>;

export const PurchaseStoreResponseSchema = z.object({
  orderId: z.string(),
  orderNumber: z.string(),
  orderStore: z.object({
    id: z.string(),
    status: z.enum(['PURCHASED']),
  }),
  updatedFee: z.object({
    baseFee: z.number(),
    peripheralFee: z.number(),
    extraStoresFee: z.number(),
    totalFee: z.number(),
    runnerShare: z.number(),
    platformShare: z.number(),
  }),
  customerNotified: z.boolean(),
});

export type PurchaseStoreResponse = z.infer<
  typeof PurchaseStoreResponseSchema
>;

// ─────────────────────────────────────────────────────────────
// Runner Order Store management (create / delete)
// ─────────────────────────────────────────────────────────────

export const CreateOrderStoreSchema = z.object({
  storeName: z.string().trim().min(1, 'اسم المتجر لا يمكن أن يكون فارغًا'),
});

export type CreateOrderStoreRequest = z.infer<
  typeof CreateOrderStoreSchema
>;

export const CreateOrderStoreResponseSchema = z.object({
  orderId: z.string(),
  orderNumber: z.string(),
  orderStore: z.object({
    id: z.string(),
    storeName: z.string(),
    isExtra: z.boolean(),
    status: z.enum(['PENDING']),
    addedBy: z.enum(['RUNNER']),
  }),
});

export type CreateOrderStoreResponse = z.infer<
  typeof CreateOrderStoreResponseSchema
>;

export const DeleteOrderStoreResponseSchema = z.object({
  orderId: z.string(),
  orderNumber: z.string(),
  orderStore: z.object({
    id: z.string(),
    storeName: z.string(),
    isDeleted: z.boolean(),
  }),
});

export type DeleteOrderStoreResponse = z.infer<
  typeof DeleteOrderStoreResponseSchema
>;

// ─────────────────────────────────────────────────────────────
// Runner Order Item creation
// ─────────────────────────────────────────────────────────────

export const CreateRunnerOrderItemSchema = z.object({
  itemName: z.string().trim().min(1, 'اسم المادة لا يمكن أن يكون فارغًا'),
  quantity: z.string().trim().min(1, 'الكمية لا يمكن أن تكون فارغة'),
  orderStoreId: z.string().cuid('معرف المتجر يجب أن يكون معرف cuid صحيح'),
});

export type CreateRunnerOrderItemRequest = z.infer<
  typeof CreateRunnerOrderItemSchema
>;

export const CreateRunnerOrderItemResponseSchema = z.object({
  id: z.string(),
  itemName: z.string(),
  quantity: z.string(),
  orderStoreId: z.string(),
  orderId: z.string(),
});

export type CreateRunnerOrderItemResponse = z.infer<
  typeof CreateRunnerOrderItemResponseSchema
>;

// ─────────────────────────────────────────────────────────────
// Receipts (Cloudflare R2)
// ─────────────────────────────────────────────────────────────

export const ReceiptSchema = z.object({
  id: z.string(),
  orderStoreId: z.string(),
  imageUrl: z.string(),
  r2Key: z.string(),
  isDeleted: z.boolean(),
  deletedAt: z.date().nullable(),
  uploadedAt: z.date(),
});

export type Receipt = z.infer<typeof ReceiptSchema>;

export const PresignedUrlRequestSchema = z.object({
  fileType: z.enum(['jpg', 'png'], {
    message: 'نوع الملف يجب أن يكون jpg أو png',
  }),
  fileSize: z.number().int().min(1, 'حجم الملف يجب أن يكون عددًا صحيحًا موجبًا'),
});

export type PresignedUrlRequest = z.infer<
  typeof PresignedUrlRequestSchema
>;

export const PresignedUrlResponseSchema = z.object({
  presignedUrl: z.string(),
  r2Key: z.string(),
  expiresIn: z.number(),
});

export type PresignedUrlResponse = z.infer<
  typeof PresignedUrlResponseSchema
>;

export const CreateReceiptRequestSchema = z.object({
  r2Key: z.string().trim().min(1, 'مفتاح r2Key لا يمكن أن يكون فارغًا'),
});

export type CreateReceiptRequest = z.infer<
  typeof CreateReceiptRequestSchema
>;

export const CreateReceiptResponseSchema = z.object({
  id: z.string(),
  orderStoreId: z.string(),
  imageUrl: z.string(),
  r2Key: z.string(),
  isDeleted: z.boolean(),
  uploadedAt: z.date(),
});

export type CreateReceiptResponse = z.infer<
  typeof CreateReceiptResponseSchema
>;

export const DeleteReceiptResponseSchema = z.object({
  id: z.string(),
  orderStoreId: z.string(),
  isDeleted: z.boolean(),
  fileDeletedFromR2: z.boolean(),
});

export type DeleteReceiptResponse = z.infer<
  typeof DeleteReceiptResponseSchema
>;

// ─────────────────────────────────────────────────────────────
// Admin Order Actions (Cancel order)
// ─────────────────────────────────────────────────────────────

export const CancelOrderSchema = z.object({
  cancelReason: z
    .string()
    .min(1, 'Cancel reason must be at least 1 character')
    .optional(),
});

export type CancelOrderRequest = z.infer<typeof CancelOrderSchema>;


