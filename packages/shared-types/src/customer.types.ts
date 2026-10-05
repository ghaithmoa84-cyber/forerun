import { z } from 'zod';
import { passwordSchema, SyrianPhoneSchema } from './auth.types.js';

export const ORDER_STATUS_VALUES = [
  'DRAFT',
  'PENDING_REVIEW',
  'UNDER_REVIEW',
  'AWAITING_RUNNER',
  'AWAITING_PREFERRED_RUNNER',
  'ASSIGNED',
  'IN_PROGRESS',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
] as const;
export type OrderStatus = (typeof ORDER_STATUS_VALUES)[number];

export const RUNNER_STATUS_VALUES = [
  'AVAILABLE',
  'ON_MISSION',
  'UNAVAILABLE',
] as const;
export type RunnerStatus = (typeof RUNNER_STATUS_VALUES)[number];

export const USER_STATUS_VALUES = [
  'PENDING_VERIFICATION',
  'VERIFIED',
  'REJECTED',
  'SUSPENDED',
] as const;
export type UserStatus = (typeof USER_STATUS_VALUES)[number];

export type AdminUserListItem = {
  id: string;
  name: string;
  whatsapp: string;
  altPhone: string | null;
  status: (typeof USER_STATUS_VALUES)[number];
  createdAt: Date;
};

export const IdParamSchema = z.object({
  id: z.string().trim().min(1, 'id cannot be empty'),
});

export const CuidParamSchema = z.object({
  id: z.string().cuid(),
});

export type IdParamRequest = z.infer<typeof IdParamSchema>;
export type CuidParamRequest = z.infer<typeof CuidParamSchema>;

export const CustomerOrdersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(ORDER_STATUS_VALUES).optional(),
});

export type CustomerOrdersQuery = z.infer<typeof CustomerOrdersQuerySchema>;

export const UpdateCustomerSchema = z.object({
  name: z.string().trim().min(2).optional(),
  altPhone: SyrianPhoneSchema.nullable().optional(),
  password: passwordSchema.optional(),
});

export type UpdateCustomerRequest = z.infer<typeof UpdateCustomerSchema>;

export const UpdateCustomerAddressSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  description: z.string().trim().min(1, 'description cannot be empty'),
});

export type UpdateCustomerAddressRequest = z.infer<
  typeof UpdateCustomerAddressSchema
>;

export type CustomerProfile = {
  id: string;
  name: string;
  whatsapp: string;
  altPhone: string | null;
  status: (typeof USER_STATUS_VALUES)[number];
  completedOrders: number;
  totalFeesPaid: number;
  createdAt: Date;
};

export type CustomerAddressResponse = {
  lat: number;
  lng: number;
  description: string;
};

export type CustomerOrderListItem = {
  id: string;
  orderNumber: string;
  status: (typeof ORDER_STATUS_VALUES)[number];
  totalFee: number;
  itemCount: number;
  createdAt: Date;
  deliveredAt: Date | null;
  hasRating: boolean;
  canRate: boolean;
  runner?: {
    id: string;
    name: string;
    whatsapp: string;
    phone?: string | null;
  } | null;
};

export type CustomerOrderItem = {
  id: string;
  itemName: string;
  quantity: string;
  customStoreName: string | null;
  anyStore: boolean;
  orderStoreId: string | null;
  isCancelled: boolean;
  cancelNote: string | null;
  createdAt: Date;
};

export type CustomerOrderStore = {
  id: string;
  storeName: string;
  isAnyStore: boolean;
  status: 'PENDING' | 'PURCHASED' | 'SKIPPED';
  isExtra: boolean;
  addedBy: string | null;
  purchasedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  items: CustomerOrderItem[];
};

export type StoreReceipt = {
  id: string;
  imageUrl: string;
};

export type StoreDetailItem = {
  id: string;
  itemName: string;
  quantity: string;
};

export type StoreDetail = {
  id: string;
  storeName: string;
  status: 'PENDING' | 'PURCHASED' | 'SKIPPED';
  isExtra: boolean;
  items: StoreDetailItem[];
  receipts: StoreReceipt[];
};

export type OrderPricing = {
  baseFee: number;
  peripheralFee: number;
  extraStoresFee: number;
  customFee?: number;
  customFeeReason?: string | null;
  totalFee: number;
};

export type OrderRating = {
  stars: number;
} | null;

export type OrderTimeline = {
  createdAt: Date;
  reviewedAt: Date | null;
  assignedAt: Date | null;
  startedAt: Date | null;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
};

export type CustomerOrderDetails = {
  id: string;
  orderNumber: string;
  status: (typeof ORDER_STATUS_VALUES)[number];
  isPeripheral: boolean;
  baseFee: number;
  peripheralFee: number;
  extraStoresFee: number;
  customFee?: number | null;
  customFeeReason?: string | null;
  totalFee: number;
  pricing: OrderPricing;
  deliveryLat: number;
  deliveryLng: number;
  deliveryDesc: string;
  notes: string | null;
  preferredRunnerId: string | null;
  waitForPreferred: boolean;
  createdAt: Date;
  updatedAt: Date;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
  items: CustomerOrderItem[];
  orderStores: CustomerOrderStore[];
  stores: StoreDetail[];
  rating: OrderRating;
  timeline: OrderTimeline;
  runner: {
    id: string;
    name: string;
    avgRating: number | null;
    totalRatings: number;
    status: (typeof RUNNER_STATUS_VALUES)[number];
    whatsapp?: string | null;
    phone?: string | null;
  } | null;
};

export type AvailableRunner = {
  id: string;
  name: string;
  avgRating: number | null;
  totalRatings: number;
  status: (typeof RUNNER_STATUS_VALUES)[number];
};
