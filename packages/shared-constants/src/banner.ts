export const BANNER_ACTION_TYPES = {
  NONE: 'NONE',
  EXTERNAL_URL: 'EXTERNAL_URL',
  IN_APP_ROUTE: 'IN_APP_ROUTE',
  WHATSAPP_ADMIN: 'WHATSAPP_ADMIN',
} as const;

export type BannerActionType = typeof BANNER_ACTION_TYPES[keyof typeof BANNER_ACTION_TYPES];

export const MAX_ACTIVE_BANNERS = 5;

export const BANNER_IN_APP_ROUTES = [
  '/home',
  '/create-order',
  '/orders',
  '/account',
  '/support',
] as const;

export type BannerInAppRoute = typeof BANNER_IN_APP_ROUTES[number];
