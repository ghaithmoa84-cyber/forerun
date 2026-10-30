export const CONFIG = {
  ACCESS_TOKEN_EXPIRY: '2h',
  BCRYPT_ROUNDS: 12,
  MAX_RECEIPT_SIZE_MB: 5,
  MAX_RECEIPTS_PER_STORE: 5,
  ACCEPTED_IMAGE_TYPES: ['image/jpeg', 'image/png'],
  PRESIGNED_URL_EXPIRY_SECONDS: 300,
  RATING_EDIT_WINDOW_HOURS: 24,
  RATING_EDIT_WINDOW_MS: 24 * 60 * 60 * 1000,
  TRANSACTION_TIMEOUT_MS: 15000,
  RATE_LIMIT_LOGIN: { max: 10, windowMinutes: 15 },
  RATE_LIMIT_REGISTER: { max: 3, windowMinutes: 60 },
  RATE_LIMIT_GENERAL: { max: 100, windowMinutes: 1 },
  PAGINATION_DEFAULT_LIMIT: 20,
  PAGINATION_MAX_LIMIT: 100,
  ORDER_NUMBER_PREFIX: 'FW',
  ORDER_NUMBER_PAD_LENGTH: 6,
  DAMASCUS_TIMEZONE: 'Asia/Damascus',
  MAX_FAILED_LOGIN_ATTEMPTS: 5,
  MAX_CONCURRENT_WS_CONNECTIONS: 5,
} as const;

export const ACCOUNT_SUSPENDED_MESSAGE = 'Account is suspended' as const;
export const LOGIN_LOCKED_MESSAGE =
  'لقد تجاوزت الحد المسموح من محاولات تسجيل الدخول. يرجى التواصل مع إدارة فَوْراً عبر واتساب لإعادة تفعيل الدخول.' as const;
