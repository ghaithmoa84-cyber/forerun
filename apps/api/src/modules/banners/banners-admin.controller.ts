import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  ForbiddenException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { VerifiedUserGuard } from '../../common/guards/verified-user.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import {
  CreateBannerSchema,
  UpdateBannerSchema,
  ReorderBannersSchema,
  IdParamSchema,
  type CreateBannerDto,
  type UpdateBannerDto,
  type ReorderBannersDto,
  type IdParamRequest,
  type AdminBannerResponse,
} from '@forerun/shared-types';
import { BannersService } from './banners.service.js';

@Controller('admin/banners')
@UseGuards(VerifiedUserGuard)
@Roles('ADMIN')
export class BannersAdminController {
  constructor(private readonly bannersService: BannersService) {}

  /**
   * إنشاء شريحة جديدة
   */
  @Post()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async createBanner(
    @Body(new ZodValidationPipe(CreateBannerSchema)) dto: CreateBannerDto,
    @CurrentUser()
    user: {
      userId: string;
      adminId?: string | null;
      role: string;
      status: string;
    },
  ): Promise<AdminBannerResponse> {
    if (!user.adminId) {
      throw new ForbiddenException('Admin ID not found');
    }
    return this.bannersService.createBanner(dto, user.userId, user.adminId);
  }

  /**
   * جرد جميع الشرائح للأدمن
   */
  @Get()
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async getAllBanners(): Promise<AdminBannerResponse[]> {
    return this.bannersService.getAllBannersAdmin();
  }

  /**
   * إعادة ترتيب الشرائح
   * ⚠️ حرج: معرَّف قبل /:id لتجنب التقاط 'reorder' كمعرف param
   */
  @Patch('reorder')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async reorderBanners(
    @Body(new ZodValidationPipe(ReorderBannersSchema)) dto: ReorderBannersDto,
    @CurrentUser()
    user: {
      userId: string;
      adminId?: string | null;
      role: string;
      status: string;
    },
  ): Promise<{ success: boolean; count: number }> {
    if (!user.adminId) {
      throw new ForbiddenException('Admin ID not found');
    }
    return this.bannersService.reorderBanners(
      dto.bannerIds,
      user.userId,
      user.adminId,
    );
  }

  /**
   * جلب شريحة واحدة بالمعرف
   */
  @Get(':id')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async getBannerById(
    @Param(new ZodValidationPipe(IdParamSchema)) params: IdParamRequest,
  ): Promise<AdminBannerResponse> {
    return this.bannersService.getBannerByIdAdmin(params.id);
  }

  /**
   * تحديث شريحة جزئياً
   */
  @Patch(':id')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async updateBanner(
    @Param(new ZodValidationPipe(IdParamSchema)) params: IdParamRequest,
    @Body(new ZodValidationPipe(UpdateBannerSchema)) dto: UpdateBannerDto,
    @CurrentUser()
    user: {
      userId: string;
      adminId?: string | null;
      role: string;
      status: string;
    },
  ): Promise<AdminBannerResponse> {
    if (!user.adminId) {
      throw new ForbiddenException('Admin ID not found');
    }
    return this.bannersService.updateBanner(
      params.id,
      dto,
      user.userId,
      user.adminId,
    );
  }

  /**
   * حذف شريحة (Soft delete)
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async deleteBanner(
    @Param(new ZodValidationPipe(IdParamSchema)) params: IdParamRequest,
    @CurrentUser()
    user: {
      userId: string;
      adminId?: string | null;
      role: string;
      status: string;
    },
  ): Promise<{ success: boolean }> {
    if (!user.adminId) {
      throw new ForbiddenException('Admin ID not found');
    }
    return this.bannersService.deleteBanner(
      params.id,
      user.userId,
      user.adminId,
    );
  }
}
