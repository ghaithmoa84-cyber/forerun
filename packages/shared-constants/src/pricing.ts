/** @deprecated D28: نسب الحصص أُلغيت في MVP. المندوب موظف براتب ثابت. */
export const RUNNER_SHARE = 0.75;
/** @deprecated D28 */
export const PLATFORM_SHARE = 0.25;

export const PRICING = {
  BASE_FEE: 60,
  PERIPHERAL_FEE: 40,
  EXTRA_STORE_FEE: 20,
  /** @deprecated D28 */
  RUNNER_SHARE,
  /** @deprecated D28 */
  PLATFORM_SHARE,
} as const;

export const DEFAULT_PRICING_CONFIG = {
  baseFee: PRICING.BASE_FEE,
  peripheralFee: PRICING.PERIPHERAL_FEE,
  extraStoreFee: PRICING.EXTRA_STORE_FEE,
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
