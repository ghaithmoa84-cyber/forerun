import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, BannerActionType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import {
  type CreateBannerDto,
  type UpdateBannerDto,
  type AdminBannerResponse,
  type ActiveBannerResponse,
  isValidHttpsUrl,
} from '@forerun/shared-types';
import {
  MAX_ACTIVE_BANNERS,
  BANNER_IN_APP_ROUTES,
} from '@forerun/shared-constants';

@Injectable()
export class BannersService {
  private readonly logger = new Logger(BannersService.name);
  private activeBannersCache: {
    data: ActiveBannerResponse[];
    expiresAt: number;
  } | null = null;
  private readonly CACHE_TTL_MS = 30 * 1000; // 30 seconds

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * إنشاء شريحة جديدة من قبل الأدمن
   */
  async createBanner(
    dto: CreateBannerDto,
    userId: string,
    adminId: string,
  ): Promise<AdminBannerResponse> {
    return this.prisma.$transaction(async (tx) => {
      // 1. فحص سقف الشرائح النشطة عند الإنشاء
      if (dto.isActive) {
        const activeCount = await tx.banner.count({
          where: { isDeleted: false, isActive: true },
        });
        if (activeCount >= MAX_ACTIVE_BANNERS) {
          throw new BadRequestException(
            `تجاوزت الحد الأقصى للشرائح النشطة المسموح بها (${MAX_ACTIVE_BANNERS} شرائح)`,
          );
        }
      }

      // 2. التحقق من صلاحية الرابط على مستوى الخادم
      if (!isValidHttpsUrl(dto.imageUrl)) {
        throw new BadRequestException(
          'رابط الصورة يجب أن يكون رابط https صالح يحتوي على اسم نطاق',
        );
      }

      // 3. التحقق الدفاعي من actionValue بناءً على actionType
      let sanitizedActionValue: string | null = null;
      if (dto.actionType === 'EXTERNAL_URL') {
        if (!dto.actionValue || !isValidHttpsUrl(dto.actionValue)) {
          throw new BadRequestException(
            'الرابط الخارجي مطلوب ويجب أن يكون رابط https صالح يحتوي على اسم نطاق',
          );
        }
        sanitizedActionValue = dto.actionValue.trim();
      } else if (dto.actionType === 'IN_APP_ROUTE') {
        if (
          !dto.actionValue ||
          !BANNER_IN_APP_ROUTES.includes(
            dto.actionValue.trim() as (typeof BANNER_IN_APP_ROUTES)[number],
          )
        ) {
          throw new BadRequestException(
            `المسار الداخلي غير مدعوم. المسارات المسموحة: ${BANNER_IN_APP_ROUTES.join(', ')}`,
          );
        }
        sanitizedActionValue = dto.actionValue.trim();
      } else {
        // NONE أو WHATSAPP_ADMIN
        sanitizedActionValue = null;
      }

      // 4. التحقق من التواريخ
      const startsAt = dto.startsAt ? new Date(dto.startsAt) : null;
      const endsAt = dto.endsAt ? new Date(dto.endsAt) : null;
      if (startsAt && endsAt && endsAt <= startsAt) {
        throw new BadRequestException(
          'تاريخ الانتهاء يجب أن يكون بعد تاريخ البدء',
        );
      }

      // 5. حساب ترتيب العرض sortOrder إن لم يُحدَّد
      let sortOrder = dto.sortOrder;
      if (sortOrder === undefined || sortOrder === 0) {
        const maxOrderBanner = await tx.banner.findFirst({
          where: { isDeleted: false },
          orderBy: { sortOrder: 'desc' },
          select: { sortOrder: true },
        });
        sortOrder = maxOrderBanner ? maxOrderBanner.sortOrder + 1 : 0;
      }

      // 6. إنشاء السجل
      const banner = await tx.banner.create({
        data: {
          title: dto.title,
          headline: dto.headline?.trim() || null,
          subtitle: dto.subtitle?.trim() || null,
          imageUrl: dto.imageUrl.trim(),
          actionType: dto.actionType,
          actionValue: sanitizedActionValue,
          ctaLabel: dto.ctaLabel?.trim() || null,
          sortOrder,
          isActive: dto.isActive,
          isDeleted: false,
          startsAt,
          endsAt,
          createdByAdminId: adminId,
        },
      });

      // 7. تسجيل AuditLog
      await this.auditService.log(
        {
          actorId: userId,
          actorRole: 'ADMIN',
          event: 'BANNER_CREATED',
          meta: {
            bannerId: banner.id,
            title: banner.title,
            sortOrder: banner.sortOrder,
            isActive: banner.isActive,
          },
        },
        tx,
      );

      this.invalidateCache();
      return this.mapToAdminResponse(banner);
    });
  }

  /**
   * استرجاع جميع الشرائح غير المحذوفة للأدمن
   */
  async getAllBannersAdmin(): Promise<AdminBannerResponse[]> {
    const banners = await this.prisma.banner.findMany({
      where: { isDeleted: false },
      orderBy: { sortOrder: 'asc' },
    });
    return banners.map((b) => this.mapToAdminResponse(b));
  }

  /**
   * استرجاع شريحة واحدة بالمعرف للأدمن
   */
  async getBannerByIdAdmin(id: string): Promise<AdminBannerResponse> {
    const banner = await this.prisma.banner.findFirst({
      where: { id, isDeleted: false },
    });
    if (!banner) {
      throw new NotFoundException('الشريحة غير موجودة');
    }
    return this.mapToAdminResponse(banner);
  }

  /**
   * تحديث شريحة جزئياً من قبل الأدمن
   */
  async updateBanner(
    id: string,
    dto: UpdateBannerDto,
    userId: string,
    _adminId: string,
  ): Promise<AdminBannerResponse> {
    return this.prisma.$transaction(async (tx) => {
      // 1. جلب الشريحة الحالية والتأكد من عدم حذفها
      const existing = await tx.banner.findFirst({
        where: { id, isDeleted: false },
      });
      if (!existing) {
        throw new NotFoundException('الشريحة غير موجودة');
      }

      // 2. بناء الحالة المدمجة للتحقق عبر الحقول
      const mergedActionType = dto.actionType ?? existing.actionType;
      const mergedActionValue =
        dto.actionValue !== undefined
          ? dto.actionValue
          : existing.actionValue;
      const mergedStartsAt =
        dto.startsAt !== undefined
          ? dto.startsAt
            ? new Date(dto.startsAt)
            : null
          : existing.startsAt;
      const mergedEndsAt =
        dto.endsAt !== undefined
          ? dto.endsAt
            ? new Date(dto.endsAt)
            : null
          : existing.endsAt;
      const mergedIsActive =
        dto.isActive !== undefined ? dto.isActive : existing.isActive;

      // 3. التحقق من التواريخ المدمجة
      if (mergedStartsAt && mergedEndsAt && mergedEndsAt <= mergedStartsAt) {
        throw new BadRequestException(
          'تاريخ الانتهاء يجب أن يكون بعد تاريخ البدء',
        );
      }

      // 4. التحقق من رابط الصورة الجديد إن وُجد
      if (dto.imageUrl !== undefined && !isValidHttpsUrl(dto.imageUrl)) {
        throw new BadRequestException(
          'رابط الصورة يجب أن يكون رابط https صالح يحتوي على اسم نطاق',
        );
      }

      // 5. التحقق من سقف الشرائح النشطة عند التفعيل
      if (mergedIsActive && !existing.isActive) {
        const activeCount = await tx.banner.count({
          where: { isDeleted: false, isActive: true, id: { not: id } },
        });
        if (activeCount >= MAX_ACTIVE_BANNERS) {
          throw new BadRequestException(
            `تجاوزت الحد الأقصى للشرائح النشطة المسموح بها (${MAX_ACTIVE_BANNERS} شرائح)`,
          );
        }
      }

      // 6. التحقق من الإجراء المدمج
      let sanitizedActionValue: string | null = null;
      if (mergedActionType === 'EXTERNAL_URL') {
        if (!mergedActionValue || !isValidHttpsUrl(mergedActionValue)) {
          throw new BadRequestException(
            'الرابط الخارجي مطلوب ويجب أن يكون رابط https صالح يحتوي على اسم نطاق',
          );
        }
        sanitizedActionValue = mergedActionValue.trim();
      } else if (mergedActionType === 'IN_APP_ROUTE') {
        if (
          !mergedActionValue ||
          !BANNER_IN_APP_ROUTES.includes(
            mergedActionValue.trim() as (typeof BANNER_IN_APP_ROUTES)[number],
          )
        ) {
          throw new BadRequestException(
            `المسار الداخلي غير مدعوم. المسارات المسموحة: ${BANNER_IN_APP_ROUTES.join(', ')}`,
          );
        }
        sanitizedActionValue = mergedActionValue.trim();
      } else {
        // NONE أو WHATSAPP_ADMIN
        sanitizedActionValue = null;
      }

      // 7. تنفيذ التحديث الدفاعي عبر updateMany مع التحقق من count === 1
      const updateData: Prisma.BannerUpdateInput = {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.headline !== undefined
          ? { headline: dto.headline?.trim() || null }
          : {}),
        ...(dto.subtitle !== undefined
          ? { subtitle: dto.subtitle?.trim() || null }
          : {}),
        ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl.trim() } : {}),
        ...(dto.actionType !== undefined ? { actionType: dto.actionType } : {}),
        actionValue: sanitizedActionValue,
        ...(dto.ctaLabel !== undefined
          ? { ctaLabel: dto.ctaLabel?.trim() || null }
          : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.startsAt !== undefined ? { startsAt: mergedStartsAt } : {}),
        ...(dto.endsAt !== undefined ? { endsAt: mergedEndsAt } : {}),
      };

      const result = await tx.banner.updateMany({
        where: { id, isDeleted: false },
        data: updateData,
      });

      if (result.count !== 1) {
        throw new NotFoundException('تعذر تحديث الشريحة، قد تكون محذوفة');
      }

      // 8. تسجيل AuditLog
      await this.auditService.log(
        {
          actorId: userId,
          actorRole: 'ADMIN',
          event: 'BANNER_UPDATED',
          meta: {
            bannerId: id,
            changes: dto,
          },
        },
        tx,
      );

      const updated = await tx.banner.findUniqueOrThrow({ where: { id } });
      this.invalidateCache();
      return this.mapToAdminResponse(updated);
    });
  }

  /**
   * إعادة ترتيب الشرائح
   */
  async reorderBanners(
    bannerIds: string[],
    userId: string,
    _adminId: string,
  ): Promise<{ success: boolean; count: number }> {
    return this.prisma.$transaction(async (tx) => {
      // 1. جلب جميع الشرائح غير المحذوفة
      const existingBanners = await tx.banner.findMany({
        where: { isDeleted: false },
        select: { id: true },
      });

      // 2. التحقق من التطابق التام لمصفوفة المعرفات
      if (bannerIds.length !== existingBanners.length) {
        throw new BadRequestException(
          'قائمة المعرفات يجب أن تطابق تماماً جميع الشرائح غير المحذوفة',
        );
      }

      if (new Set(bannerIds).size !== bannerIds.length) {
        throw new BadRequestException(
          'قائمة المعرفات تحتوي على معرفات مكررة',
        );
      }

      const existingSet = new Set(existingBanners.map((b) => b.id));
      for (const id of bannerIds) {
        if (!existingSet.has(id)) {
          throw new BadRequestException(
            `معرف الشريحة ${id} غير موجود أو محذوف مسبقاً`,
          );
        }
      }

      // 3. تحديث ترتيب كل شريحة
      for (let i = 0; i < bannerIds.length; i++) {
        const id = bannerIds[i];
        const res = await tx.banner.updateMany({
          where: { id, isDeleted: false },
          data: { sortOrder: i },
        });
        if (res.count !== 1) {
          throw new BadRequestException(`فشل تحديث ترتيب الشريحة ${id}`);
        }
      }

      // 4. تسجيل AuditLog
      await this.auditService.log(
        {
          actorId: userId,
          actorRole: 'ADMIN',
          event: 'BANNERS_REORDERED',
          meta: { bannerIds },
        },
        tx,
      );

      this.invalidateCache();
      return { success: true, count: bannerIds.length };
    });
  }

  /**
   * حذف شريحة (Soft delete)
   */
  async deleteBanner(
    id: string,
    userId: string,
    _adminId: string,
  ): Promise<{ success: boolean }> {
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.banner.updateMany({
        where: { id, isDeleted: false },
        data: { isDeleted: true, isActive: false },
      });

      if (result.count !== 1) {
        throw new NotFoundException('الشريحة غير موجودة أو محذوفة مسبقاً');
      }

      await this.auditService.log(
        {
          actorId: userId,
          actorRole: 'ADMIN',
          event: 'BANNER_DELETED',
          meta: { bannerId: id },
        },
        tx,
      );

      this.invalidateCache();
      return { success: true };
    });
  }

  /**
   * استرجاع الشرائح النشطة للزبون/الجمهور (مكوشة 30ث وخالية من الحقول الإدارية)
   */
  async getActiveBanners(now: Date = new Date()): Promise<ActiveBannerResponse[]> {
    const currentTime = Date.now();
    if (
      this.activeBannersCache &&
      this.activeBannersCache.expiresAt > currentTime
    ) {
      return this.activeBannersCache.data;
    }

    const banners = await this.prisma.banner.findMany({
      where: {
        isDeleted: false,
        isActive: true,
        AND: [
          {
            OR: [{ startsAt: null }, { startsAt: { lte: now } }],
          },
          {
            OR: [{ endsAt: null }, { endsAt: { gte: now } }],
          },
        ],
      },
      orderBy: { sortOrder: 'asc' },
      take: MAX_ACTIVE_BANNERS,
    });

    const activeList: ActiveBannerResponse[] = banners.map((b) => ({
      id: b.id,
      headline: b.headline,
      subtitle: b.subtitle,
      imageUrl: b.imageUrl,
      actionType: b.actionType,
      actionValue: b.actionValue,
      ctaLabel: b.ctaLabel,
      sortOrder: b.sortOrder,
    }));

    this.activeBannersCache = {
      data: activeList,
      expiresAt: currentTime + this.CACHE_TTL_MS,
    };

    return activeList;
  }

  /**
   * تفريغ الكاش المباشر عند أي تعديل
   */
  invalidateCache(): void {
    this.activeBannersCache = null;
  }

  /**
   * تحويل نموذج Prisma إلى عقد AdminBannerResponse
   */
  private mapToAdminResponse(banner: {
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
    startsAt: Date | null;
    endsAt: Date | null;
    createdByAdminId: string;
    createdAt: Date;
    updatedAt: Date;
  }): AdminBannerResponse {
    return {
      id: banner.id,
      title: banner.title,
      headline: banner.headline,
      subtitle: banner.subtitle,
      imageUrl: banner.imageUrl,
      actionType: banner.actionType,
      actionValue: banner.actionValue,
      ctaLabel: banner.ctaLabel,
      sortOrder: banner.sortOrder,
      isActive: banner.isActive,
      isDeleted: banner.isDeleted,
      startsAt: banner.startsAt ? banner.startsAt.toISOString() : null,
      endsAt: banner.endsAt ? banner.endsAt.toISOString() : null,
      createdByAdminId: banner.createdByAdminId,
      createdAt: banner.createdAt.toISOString(),
      updatedAt: banner.updatedAt.toISOString(),
    };
  }
}
