import { z } from "zod";
import {
  MAX_CUSTOM_FEE,
  CUSTOM_FEE_REASON_MAX_LENGTH,
  PRICING_LIMITS,
} from "@forerun/shared-constants";
import { passwordSchema, SyrianPhoneSchema } from "./auth.types.js";

const nonEmptyString = z
  .string()
  .trim()
  .min(1, "Field cannot be empty or whitespace");

export const RunnerStatusUpdateSchema = z.object({
  status: z.enum(["AVAILABLE", "UNAVAILABLE"]),
});

export type RunnerStatusUpdate = z.infer<typeof RunnerStatusUpdateSchema>;

export const RunnerProfileResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  whatsapp: z.string(),
  altPhone: z.string().nullable(),
  status: z.enum(["UNAVAILABLE", "AVAILABLE", "ON_MISSION"]),
  isVisible: z.boolean(),
  avgRating: z.number().nullable(),
  totalRatings: z.number(),
  notes: z.string().nullable(),
});

export type RunnerProfileResponse = z.infer<typeof RunnerProfileResponseSchema>;

export const ActiveOrderDeliveryAddressSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  description: z.string(),
});

export const ActiveOrderPricingSchema = z.object({
  baseFee: z.number(),
  peripheralFee: z.number(),
  extraStoresFee: z.number(),
  customFee: z.number().optional().default(0),
  customFeeReason: z.string().nullable().optional(),
  totalFee: z.number(),
});

export const ActiveOrderStoreItemSchema = z.object({
  id: z.string(),
  itemName: z.string(),
  quantity: z.string(),
  customStoreName: z.string().nullable(),
  anyStore: z.boolean(),
});

export type ActiveOrderStoreItem = z.infer<typeof ActiveOrderStoreItemSchema>;

export const ActiveOrderStoreReceiptSchema = z.object({
  id: z.string(),
  imageUrl: z.string(),
  isDeleted: z.boolean(),
  uploadedAt: z.string(),
});

export type ActiveOrderStoreReceipt = z.infer<typeof ActiveOrderStoreReceiptSchema>;

export const ActiveOrderStoreSchema = z.object({
  id: z.string(),
  storeName: z.string(),
  isAnyStore: z.boolean(),
  status: z.string(),
  isExtra: z.boolean(),
  addedBy: z.string().nullable(),
  purchasedAt: z.string().nullable(),
  items: z.array(ActiveOrderStoreItemSchema),
  receipts: z.array(ActiveOrderStoreReceiptSchema),
});

export type ActiveOrderStore = z.infer<typeof ActiveOrderStoreSchema>;

export const ActiveOrderResponseSchema = z.object({
  id: z.string(),
  orderNumber: z.string(),
  status: z.string(),
  customerName: z.string(),
  customerWhatsapp: z.string(),
  deliveryAddress: ActiveOrderDeliveryAddressSchema,
  pricing: ActiveOrderPricingSchema,
  totalFee: z.number(),
  isPeripheral: z.boolean(),
  createdAt: z.string(),
  assignedAt: z.string().nullable(),
  items: z.array(z.object({
    id: z.string(),
    itemName: z.string(),
    quantity: z.string(),
    customStoreName: z.string().nullable(),
    anyStore: z.boolean(),
  })),
  orderStores: z.array(ActiveOrderStoreSchema),
  activeOrdersCount: z.number().int().nonnegative(),
  hasMoreActive: z.boolean(),
}).nullable();

export type ActiveOrderResponse = z.infer<typeof ActiveOrderResponseSchema>;

export const CreateRunnerSchema = z.object({
  name: nonEmptyString.min(2, "Name must be at least 2 characters"),
  whatsapp: SyrianPhoneSchema,
  password: passwordSchema,
  altPhone: SyrianPhoneSchema.optional(),
});

export type CreateRunnerRequest = z.infer<typeof CreateRunnerSchema>;

export const UpdateRunnerSchema = z.object({
  name: nonEmptyString.min(2, "Name must be at least 2 characters").optional(),
  altPhone: SyrianPhoneSchema.optional(),
  notes: z.string().optional(),
  password: passwordSchema.optional(),
});

export type UpdateRunnerRequest = z.infer<typeof UpdateRunnerSchema>;

export const UpdateVisibilitySchema = z.object({
  isVisible: z.boolean(),
});

export type UpdateVisibilityRequest = z.infer<typeof UpdateVisibilitySchema>;

export type PurchaseResponse = {
  orderStore: {
    id: string;
    status: string;
  };
  updatedFee: {
    extraStoresFee: number;
    totalFee: number;
    customFee?: number;
    customFeeReason?: string | null;
  };
  customerNotified: boolean;
};

export function createApproveOrderSchema({
  maxCustomFee,
}: {
  maxCustomFee: number;
}) {
  return z
    .object({
      isPeripheral: z.boolean(),
      notes: z.string().nullable().optional(),
      baseFee: z
        .number({ invalid_type_error: "يجب أن يكون الرسم الأساسي رقماً" })
        .int("يجب أن يكون الرسم الأساسي عدداً صحيحاً")
        .min(
          PRICING_LIMITS.baseFee.min,
          `الرسم الأساسي يجب ألا يقل عن ${PRICING_LIMITS.baseFee.min}`,
        )
        .max(
          PRICING_LIMITS.baseFee.max,
          `الرسم الأساسي يجب ألا يتجاوز ${PRICING_LIMITS.baseFee.max}`,
        )
        .optional(),
      customFee: z.number().int().min(0).max(maxCustomFee).optional().default(0),
      customFeeReason: z
        .string()
        .trim()
        .min(1)
        .max(CUSTOM_FEE_REASON_MAX_LENGTH)
        .optional(),
    })
    .superRefine((data, ctx) => {
      const fee = data.customFee ?? 0;
      const hasReason =
        typeof data.customFeeReason === "string" &&
        data.customFeeReason.trim().length > 0;

      if (fee > 0 && !hasReason) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "يجب إدخال سبب عند تحديد رسم إضافي للطلب",
          path: ["customFeeReason"],
        });
      }

      if (fee === 0 && hasReason) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "لا يمكن تحديد سبب للرسم الإضافي إذا كان الرسم الإضافي 0",
          path: ["customFeeReason"],
        });
      }
    });
}

export const ApproveOrderSchema = createApproveOrderSchema({
  maxCustomFee: MAX_CUSTOM_FEE,
});

export type ApproveOrderRequest = z.input<typeof ApproveOrderSchema>;
export type ApproveOrderDto = z.infer<typeof ApproveOrderSchema>;

export const AssignRunnerSchema = z.object({
  runnerId: z.string().trim().min(1, "runnerId cannot be empty"),
});

export type AssignRunnerRequest = z.infer<typeof AssignRunnerSchema>;
