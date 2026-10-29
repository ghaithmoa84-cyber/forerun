export const PRICING = {
  BASE_FEE: 60,
  PERIPHERAL_FEE: 40,
  EXTRA_STORE_FEE: 20,
} as const;

/**
 * القيمة الافتراضية لعدد الطلبات المجانية الممنوحة للعملاء الجدد عند تفعيل العرض الترويجي (القرار D59).
 */
export const DEFAULT_FREE_ORDERS_COUNT = 3;

/**
 * حدود تحرير المشرف لعدد الطلبات المجانية الممنوحة في إعدادات المنصة (القرار D59).
 */
export const FREE_ORDERS_LIMITS = {
  min: 1,
  max: 20,
} as const;

export const DEFAULT_PRICING_CONFIG = {
  baseFee: PRICING.BASE_FEE,
  peripheralFee: PRICING.PERIPHERAL_FEE,
  extraStoreFee: PRICING.EXTRA_STORE_FEE,
  freeOrdersPromoEnabled: false,
  freeOrdersCount: DEFAULT_FREE_ORDERS_COUNT,
} as const;

/**
 * سقف الرسم الإضافي للطلب بعد اكتمال أسطح العميل والمندوب (سبرنت 6B).
 * يُستخدم في createApproveOrderSchema و FeePreviewRequestSchema.
 */
export const MAX_CUSTOM_FEE = 500;

/**
 * القيمة المستهدفة لسقف الرسم الإضافي للطلب (القرار D14).
 */
export const CUSTOM_FEE_CAP = 500;

/**
 * الحد الأقصى لطول نص سبب الرسم الإضافي للطلب.
 */
export const CUSTOM_FEE_REASON_MAX_LENGTH = 200;

/**
 * حدود إعدادات تسعير المنصة (مؤقتة — القرار D18: baseFee لا يقل عن 1).
 */
export const PRICING_LIMITS = {
  baseFee: { min: 1, max: 1000 },
  extraStoreFee: { min: 0, max: 500 },
  peripheralFee: { min: 0, max: 500 },
} as const;
