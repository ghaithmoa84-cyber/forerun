import { z } from 'zod';

export const SoundTypeSchema = z.enum([
  'new_order',
  'status_update',
  'urgent',
  'success',
]);

export type SoundType = z.infer<typeof SoundTypeSchema>;

export const CLIENT_EVENTS = {
  ORDER_STATUS_CHANGED: 'order:status_changed',
  ORDER_RUNNER_ASSIGNED: 'order:runner_assigned',
  ORDER_FEE_UPDATED: 'order:fee_updated',
  ORDER_STORE_PURCHASED: 'order:store_purchased',
  ORDER_OUT_FOR_DELIVERY: 'order:out_for_delivery',
  ORDER_DELIVERED: 'order:delivered',
  ORDER_CANCELLED: 'order:cancelled',
  ACCOUNT_VERIFIED: 'account:verified',
} as const;

export const RUNNER_EVENTS = {
  ORDER_ASSIGNED: 'order:assigned',
  ORDER_REASSIGNED: 'order:reassigned',
  ORDER_ASSIGNMENT_CANCELLED: 'order:assignment_cancelled',
} as const;

export const ADMIN_EVENTS = {
  ORDER_NEW: 'order:new',
  ORDER_STATUS_CHANGED: 'order:status_changed',
  ORDER_NEEDS_ATTENTION: 'order:needs_attention',
  USER_NEW_REGISTRATION: 'user:new_registration',
  SETTLEMENT_REMINDER: 'settlement:reminder',
  SETTLEMENT_CLOSED: 'settlement:closed',
} as const;

export type OrderStatusChangedPayload = {
  orderId: string;
  orderNumber: string;
  newStatus: string;
  oldStatus: string;
  sound?: SoundType;
};

export type OrderRunnerAssignedPayload = {
  orderId: string;
  runnerName: string;
  sound?: SoundType;
};

export type OrderFeeUpdatedPayload = {
  orderId: string;
  oldFee: number;
  newFee: number;
  reason: string;
  sound?: SoundType;
  customFee?: number | null;
  customFeeReason?: string | null;
};

export type OrderStorePurchasedPayload = {
  orderId: string;
  storeName: string;
  sound?: SoundType;
};

export type OrderOutForDeliveryPayload = {
  orderId: string;
  sound?: SoundType;
};

export type OrderDeliveredPayload = {
  orderId: string;
  deliveredAt: string;
  sound?: SoundType;
};

export type OrderCancelledPayload = {
  orderId: string;
  reason: string;
  cancelledBy: string;
  sound?: SoundType;
};

export type AccountVerifiedPayload = {
  message: string;
  sound?: SoundType;
};

export type OrderAssignedPayload = {
  orderId: string;
  orderNumber: string;
  customerName: string;
  deliveryAddress: {
    lat: number;
    lng: number;
    description: string;
  };
  items: Array<{
    itemName: string;
    quantity: string;
    customStoreName: string | null;
    anyStore: boolean;
  }>;
  estimatedFee: {
    baseFee: number;
    peripheralFee: number;
    extraStoresFee: number;
    customFee: number;
    customFeeReason: string | null;
    totalFee: number;
    note: string;
  };
  sound?: SoundType;
};

export type OrderReassignedPayload = {
  orderId: string;
  sound?: SoundType;
};

export type OrderAssignmentCancelledPayload = {
  orderId: string;
  reason: string;
  sound?: SoundType;
};

export type OrderNewPayload = {
  orderId: string;
  orderNumber: string;
  customerName: string;
  itemCount: number;
  sound?: SoundType;
};

export type OrderNeedsAttentionPayload = {
  orderId: string;
  reason: string;
  sound?: SoundType;
};

export type UserNewRegistrationPayload = {
  userId: string;
  userName: string;
  whatsapp: string;
  sound?: SoundType;
};

export type SettlementReminderPayload = {
  date: string;
  pendingRunnerCount: number;
  sound?: SoundType;
};
