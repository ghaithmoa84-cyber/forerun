import { Throttle } from '@nestjs/throttler';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  IdParamSchema,
  UpdatePlatformPricingSchema,
  FeePreviewRequestSchema,
  type IdParamRequest,
  type UpdatePlatformPricingDto,
  type FeePreviewDto,
  type PlatformPricingResponse,
  type FeePreviewResponse,
} from '@forerun/shared-types';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { VerifiedUserGuard } from '../../common/guards/verified-user.guard.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { PricingService } from './pricing.service.js';

@Controller()
@UseGuards(VerifiedUserGuard)
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  @Get('admin/pricing')
  @Roles('ADMIN')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async getPlatformPricing(): Promise<PlatformPricingResponse> {
    return this.pricingService.getPlatformPricing();
  }

  @Put('admin/pricing')
  @Roles('ADMIN')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async updatePlatformPricing(
    @Body(new ZodValidationPipe(UpdatePlatformPricingSchema))
    dto: UpdatePlatformPricingDto,
    @CurrentUser() user: { userId: string; role: string; status: string },
  ): Promise<PlatformPricingResponse> {
    return this.pricingService.updatePlatformPricing(dto, user.userId);
  }

  @Post('admin/orders/:id/fee-preview')
  @HttpCode(HttpStatus.OK)
  @Roles('ADMIN')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async previewFee(
    @Param(new ZodValidationPipe(IdParamSchema)) params: IdParamRequest,
    @Body(new ZodValidationPipe(FeePreviewRequestSchema)) dto: FeePreviewDto,
  ): Promise<FeePreviewResponse> {
    return this.pricingService.previewFee(params.id, dto);
  }
}
