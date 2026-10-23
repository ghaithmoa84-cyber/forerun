import { z } from 'zod';

export const AppPlatformEnum = z.enum(['android']);
export type AppPlatform = z.infer<typeof AppPlatformEnum>;

export const AppVersionQuerySchema = z.object({
  platform: AppPlatformEnum.default('android'),
});
export type AppVersionQueryDto = z.infer<typeof AppVersionQuerySchema>;

export const TRUSTED_DOWNLOAD_ORIGINS = [
  'https://faow.run',
  'https://www.faow.run',
] as const;

export const DownloadUrlSchema = z
  .string({ invalid_type_error: 'يجب أن يكون رابط التحميل نصاً' })
  .url('رابط التحميل غير صالح')
  .refine(
    (url) => {
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:') return false;
        return TRUSTED_DOWNLOAD_ORIGINS.includes(
          parsed.origin as (typeof TRUSTED_DOWNLOAD_ORIGINS)[number],
        );
      } catch {
        return false;
      }
    },
    {
      message:
        'رابط التحميل يجب أن يكون من نطاق موثوق حصراً (https://faow.run أو https://www.faow.run)',
    },
  );

/**
 * Public response schema returned by GET /api/v1/app/version
 * Strictly masks internal database fields (id, updatedByUserId, updatedAt)
 * according to Least Privilege and Rule 7.
 */
export const PublicAppVersionSchema = z.object({
  platform: AppPlatformEnum,
  latestVersionCode: z.number().int().positive(),
  latestVersionName: z.string().min(1),
  minSupportedVersionCode: z.number().int().positive(),
  downloadUrl: DownloadUrlSchema,
  releaseNotes: z.string().nullable().optional(),
});
export type PublicAppVersionResponse = z.infer<typeof PublicAppVersionSchema>;

/**
 * Admin response schema returned by GET /api/v1/admin/app-version
 * Includes optimistic concurrency token (updatedAt) and internal audit fields.
 */
export const AdminAppVersionSchema = z.object({
  id: z.string(),
  platform: AppPlatformEnum,
  latestVersionCode: z.number().int().positive(),
  latestVersionName: z.string().min(1),
  minSupportedVersionCode: z.number().int().positive(),
  downloadUrl: DownloadUrlSchema,
  releaseNotes: z.string().nullable().optional(),
  updatedAt: z.coerce.date(),
  updatedByUserId: z.string().nullable().optional(),
});
export type AdminAppVersionResponse = z.infer<typeof AdminAppVersionSchema>;

/**
 * Admin update request schema for PUT /api/v1/admin/app-version
 * Enforces optimistic concurrency via updatedAt and validates min <= latest.
 */
export const UpdatePlatformAppVersionSchema = z
  .object({
    platform: AppPlatformEnum.default('android'),
    latestVersionCode: z
      .number({ invalid_type_error: 'يجب أن يكون رقم الإصدار الأحدث عدداً صحيحاً' })
      .int('يجب أن يكون رقم الإصدار الأحدث عدداً صحيحاً')
      .positive('يجب أن يكون رقم الإصدار الأحدث موجباً'),
    latestVersionName: z
      .string({ invalid_type_error: 'يجب أن يكون اسم الإصدار نصاً' })
      .trim()
      .min(1, 'اسم الإصدار لا يمكن أن يكون فارغاً'),
    minSupportedVersionCode: z
      .number({ invalid_type_error: 'يجب أن يكون الحد الأدنى للإصدار عدداً صحيحاً' })
      .int('يجب أن يكون الحد الأدنى للإصدار عدداً صحيحاً')
      .positive('يجب أن يكون الحد الأدنى للإصدار موجباً'),
    downloadUrl: DownloadUrlSchema,
    releaseNotes: z.string().nullable().optional(),
    updatedAt: z.coerce.date({
      required_error: 'حقل تاريخ آخر تحديث (updatedAt) إلزامي للقفل التفاؤلي',
      invalid_type_error: 'حقل تاريخ آخر تحديث غير صالح',
    }),
  })
  .refine((data) => data.minSupportedVersionCode <= data.latestVersionCode, {
    message: 'الحد الأدنى للإصدار المدعوم يجب ألا يتجاوز رقم الإصدار الأحدث',
    path: ['minSupportedVersionCode'],
  });

export type UpdatePlatformAppVersionDto = z.infer<typeof UpdatePlatformAppVersionSchema>;
