import { Throttle } from '@nestjs/throttler';
import {
  Body,
  Controller,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  CuidParamSchema,
  CreateRatingBodySchema,
  UpdateRatingBodySchema,
  type CuidParamRequest,
  type CreateRatingBodyRequest,
  type UpdateRatingBodyRequest,
} from '@forerun/shared-types';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { VerifiedUserGuard } from '../../common/guards/verified-user.guard.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { RatingsService } from './ratings.service.js';

@Controller()
@UseGuards(VerifiedUserGuard)
export class RatingsController {
  constructor(private readonly ratingsService: RatingsService) {}

  @Post('customer/orders/:id/ratings')
  @Roles('CUSTOMER')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async createRating(
    @Param(new ZodValidationPipe(CuidParamSchema))
    params: CuidParamRequest,
    @CurrentUser() user: { userId: string; role: string; status: string },
    @Body(new ZodValidationPipe(CreateRatingBodySchema))
    dto: CreateRatingBodyRequest,
  ) {
    return this.ratingsService.createRating(params.id, user, dto);
  }

  @Put('customer/orders/:id/ratings')
  @Roles('CUSTOMER')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async updateRating(
    @Param(new ZodValidationPipe(CuidParamSchema))
    params: CuidParamRequest,
    @CurrentUser() user: { userId: string; role: string; status: string },
    @Body(new ZodValidationPipe(UpdateRatingBodySchema))
    dto: UpdateRatingBodyRequest,
  ) {
    return this.ratingsService.updateRating(params.id, user, dto);
  }
}