import { z } from 'zod';
import {
  BANNER_ACTION_TYPES,
  type BannerActionType,
  BANNER_IN_APP_ROUTES,
  type BannerInAppRoute,
  MAX_ACTIVE_BANNERS,
} from '@forerun/shared-constants';

export function isValidHttpsUrl(urlString: string): boolean {
  try {
    const trimmed = urlString.trim();
    if (!trimmed.toLowerCase().startsWith('https://')) return false;
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' && parsed.hostname.length > 0;
  } catch {
    return false;
  }
}

export const BannerActionTypeSchema = z.enum([
  'NONE',
  'EXTERNAL_URL',
  'IN_APP_ROUTE',
  'WHATSAPP_ADMIN',
]);

export const CreateBannerSchema = z
  .object({
    title: z
      .string({ required_error: 'عنوان الشريحة مطلوب' })
      .trim()
      .min(1, 'عنوان الشريحة مطلوب')
      .max(80, 'عنوان الشريحة يجب ألا يتجاوز 80 حرفاً'),
    headline: z
      .string()
      .trim()
      .max(60, 'عنوان العرض الرئيسي يجب ألا يتجاوز 60 حرفاً')
      .optional()
      .nullable(),
    subtitle: z
      .string()
      .trim()
      .max(120, 'الوصف الفرعي يجب ألا يتجاوز 120 حرفاً')
      .optional()
      .nullable(),
    imageUrl: z
      .string({ required_error: 'رابط الصورة مطلوب' })
      .trim()
      .refine(isValidHttpsUrl, {
        message: 'يجب أن يكون رابط الصورة رابط https صالح يحتوي على اسم نطاق',
      }),
    actionType: BannerActionTypeSchema.default('NONE'),
    actionValue: z
      .string()
      .trim()
      .max(500, 'قيمة الإجراء يجب ألا تتجاوز 500 حرف')
      .optional()
      .nullable(),
    ctaLabel: z
      .string()
      .trim()
      .max(30, 'نص زر الإجراء يجب ألا يتجاوز 30 حرفاً')
      .optional()
      .nullable(),
    sortOrder: z
      .number({ invalid_type_error: 'ترتيب العرض يجب أن يكون رقماً' })
      .int('ترتيب العرض يجب أن يكون عدداً صحيحاً')
      .min(0, 'ترتيب العرض يجب ألا يقل عن 0')
      .default(0),
    isActive: z.boolean().default(true),
    startsAt: z
      .string()
      .datetime({ offset: true, message: 'تاريخ البدء غير صالح' })
      .optional()
      .nullable(),
    endsAt: z
      .string()
      .datetime({ offset: true, message: 'تاريخ الانتهاء غير صالح' })
      .optional()
      .nullable(),
  })
  .superRefine((data, ctx) => {
    // 1. التاريخ: إذا كان كلا التاريخين موجودين، يجب أن يكون تاريخ الانتهاء بعد تاريخ البدء
    if (data.startsAt && data.endsAt) {
      if (new Date(data.endsAt) <= new Date(data.startsAt)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['endsAt'],
          message: 'تاريخ الانتهاء يجب أن يكون بعد تاريخ البدء',
        });
      }
    }

    // 2. التحقق من actionValue بناءً على actionType
    if (data.actionType === 'EXTERNAL_URL') {
      if (!data.actionValue || !isValidHttpsUrl(data.actionValue)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['actionValue'],
          message:
            'الرابط الخارجي مطلوب ويجب أن يكون رابط https صالح يحتوي على اسم نطاق',
        });
      }
    } else if (data.actionType === 'IN_APP_ROUTE') {
      if (!data.actionValue || !data.actionValue.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['actionValue'],
          message: 'المسار الداخلي مطلوب عند اختيار مسار داخل التطبيق',
        });
      } else if (
        !BANNER_IN_APP_ROUTES.includes(
          data.actionValue.trim() as (typeof BANNER_IN_APP_ROUTES)[number],
        )
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['actionValue'],
          message: `المسار الداخلي غير مدعوم. المسارات المسموحة: ${BANNER_IN_APP_ROUTES.join(', ')}`,
        });
      }
    } else if (
      data.actionType === 'NONE' ||
      data.actionType === 'WHATSAPP_ADMIN'
    ) {
      if (data.actionValue && data.actionValue.trim().length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['actionValue'],
          message:
            'لا يُسمح بتحديد قيمة للإجراء عند اختيار بلا إجراء أو واتساب الإدارة',
        });
      }
    }
  });

export type CreateBannerDto = z.infer<typeof CreateBannerSchema>;

export const UpdateBannerSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'عنوان الشريحة لا يمكن أن يكون فارغاً')
      .max(80, 'عنوان الشريحة يجب ألا يتجاوز 80 حرفاً')
      .optional(),
    headline: z
      .string()
      .trim()
      .max(60, 'عنوان العرض الرئيسي يجب ألا يتجاوز 60 حرفاً')
      .optional()
      .nullable(),
    subtitle: z
      .string()
      .trim()
      .max(120, 'الوصف الفرعي يجب ألا يتجاوز 120 حرفاً')
      .optional()
      .nullable(),
    imageUrl: z
      .string()
      .trim()
      .refine(isValidHttpsUrl, {
        message: 'يجب أن يكون رابط الصورة رابط https صالح يحتوي على اسم نطاق',
      })
      .optional(),
    actionType: BannerActionTypeSchema.optional(),
    actionValue: z
      .string()
      .trim()
      .max(500, 'قيمة الإجراء يجب ألا تتجاوز 500 حرف')
      .optional()
      .nullable(),
    ctaLabel: z
      .string()
      .trim()
      .max(30, 'نص زر الإجراء يجب ألا يتجاوز 30 حرفاً')
      .optional()
      .nullable(),
    sortOrder: z
      .number({ invalid_type_error: 'ترتيب العرض يجب أن يكون رقماً' })
      .int('ترتيب العرض يجب أن يكون عدداً صحيحاً')
      .min(0, 'ترتيب العرض يجب ألا يقل عن 0')
      .optional(),
    isActive: z.boolean().optional(),
    startsAt: z
      .string()
      .datetime({ offset: true, message: 'تاريخ البدء غير صالح' })
      .optional()
      .nullable(),
    endsAt: z
      .string()
      .datetime({ offset: true, message: 'تاريخ الانتهاء غير صالح' })
      .optional()
      .nullable(),
  })
  .superRefine((data, ctx) => {
    // 1. التاريخ: إذا قُدِّم كلا التاريخين في التعديل
    if (data.startsAt && data.endsAt) {
      if (new Date(data.endsAt) <= new Date(data.startsAt)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['endsAt'],
          message: 'تاريخ الانتهاء يجب أن يكون بعد تاريخ البدء',
        });
      }
    }

    // 2. التحقق الجزئي من actionValue إذا ذُكر actionType صراحة في طلب التعديل
    if (data.actionType === 'EXTERNAL_URL') {
      if (data.actionValue !== undefined) {
        if (!data.actionValue || !isValidHttpsUrl(data.actionValue)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['actionValue'],
            message:
              'الرابط الخارجي مطلوب ويجب أن يكون رابط https صالح يحتوي على اسم نطاق',
          });
        }
      }
    } else if (data.actionType === 'IN_APP_ROUTE') {
      if (data.actionValue !== undefined) {
        if (!data.actionValue || !data.actionValue.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['actionValue'],
            message: 'المسار الداخلي مطلوب عند اختيار مسار داخل التطبيق',
          });
        } else if (
          !BANNER_IN_APP_ROUTES.includes(
            data.actionValue.trim() as (typeof BANNER_IN_APP_ROUTES)[number],
          )
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['actionValue'],
            message: `المسار الداخلي غير مدعوم. المسارات المسموحة: ${BANNER_IN_APP_ROUTES.join(', ')}`,
          });
        }
      }
    } else if (
      data.actionType === 'NONE' ||
      data.actionType === 'WHATSAPP_ADMIN'
    ) {
      if (data.actionValue && data.actionValue.trim().length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['actionValue'],
          message:
            'لا يُسمح بتحديد قيمة للإجراء عند اختيار بلا إجراء أو واتساب الإدارة',
        });
      }
    }
  });

export type UpdateBannerDto = z.infer<typeof UpdateBannerSchema>;

export const ReorderBannersSchema = z.object({
  bannerIds: z
    .array(z.string().min(1, 'معرف الشريحة مطلوب'), {
      required_error: 'قائمة معرفات الشرائح مطلوبة',
    })
    .min(1, 'يجب تمرير معرف شريحة واحد على الأقل'),
});

export type ReorderBannersDto = z.infer<typeof ReorderBannersSchema>;

export interface AdminBannerResponse {
  id: string;
  title: string;
  headline: string | null;
  subtitle: string | null;
  imageUrl: string;
  actionType: BannerActionType;
  actionValue: string | null;
  ctaLabel: string | null;
  sortOrder: number;
  isActive: boolean;
  isDeleted: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdByAdminId: string;
  createdAt: string;
  updatedAt: string;
}

export type BannerAdminResponse = AdminBannerResponse;

export interface ActiveBannerResponse {
  id: string;
  headline: string | null;
  subtitle: string | null;
  imageUrl: string;
  actionType: BannerActionType;
  actionValue: string | null;
  ctaLabel: string | null;
  sortOrder: number;
}
