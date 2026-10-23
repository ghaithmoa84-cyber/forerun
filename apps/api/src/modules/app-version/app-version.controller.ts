import {
  Controller,
  Get,
  Put,
  Query,
  Body,
  Res,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { VerifiedUserGuard } from '../../common/guards/verified-user.guard.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { AppVersionService } from './app-version.service.js';
import {
  AppVersionQuerySchema,
  type AppVersionQueryDto,
  type PublicAppVersionResponse,
  type AdminAppVersionResponse,
  UpdatePlatformAppVersionSchema,
  type UpdatePlatformAppVersionDto,
} from '@forerun/shared-types';

interface AuthenticatedAdminUser {
  userId: string;
  adminId: string;
}

@Controller()
export class AppVersionController {
  constructor(private readonly appVersionService: AppVersionService) {}

  /**
   * Public endpoint to check current app version requirements.
   * Strictly unauthenticated (@Public) and rate-limited via client IP (UserThrottlerGuard, D49/D50).
   * Returns 200 with PublicAppVersionResponse, or 204 No Content if platform not found.
   */
  @Get('app/version')
  @Public()
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async getPublicAppVersion(
    @Query(new ZodValidationPipe(AppVersionQuerySchema)) query: AppVersionQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PublicAppVersionResponse | void> {
    const version = await this.appVersionService.getPublicAppVersion(query.platform);
    if (!version) {
      res.status(HttpStatus.NO_CONTENT);
      return;
    }
    return version;
  }

  /**
   * Admin endpoint to inspect current platform version config and optimistic concurrency token.
   */
  @Get('admin/app-version')
  @UseGuards(VerifiedUserGuard)
  @Roles('ADMIN')
  async getAdminAppVersion(
    @Query(new ZodValidationPipe(AppVersionQuerySchema)) query: AppVersionQueryDto,
  ): Promise<AdminAppVersionResponse> {
    return this.appVersionService.getAdminAppVersion(query.platform);
  }

  /**
   * Admin endpoint to update platform version config with optimistic locking and AuditLog.
   */
  @Put('admin/app-version')
  @UseGuards(VerifiedUserGuard)
  @Roles('ADMIN')
  async updateAppVersion(
    @Body(new ZodValidationPipe(UpdatePlatformAppVersionSchema))
    dto: UpdatePlatformAppVersionDto,
    @CurrentUser() user: AuthenticatedAdminUser,
  ): Promise<AdminAppVersionResponse> {
    return this.appVersionService.updateAppVersion(dto, user.userId);
  }
}
