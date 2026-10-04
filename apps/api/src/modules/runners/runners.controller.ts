import { Body, Controller, Get, Post, Put, Param, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { RunnersService } from './runners.service.js';
import { VerifiedUserGuard } from '../../common/guards/verified-user.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import {
  CreateRunnerSchema,
  UpdateRunnerSchema,
  UpdateVisibilitySchema,
  RunnerStatusUpdateSchema,
  type CreateRunnerRequest,
  type UpdateRunnerRequest,
  type UpdateVisibilityRequest,
  type RunnerStatusUpdate,
  CuidParamSchema,
  type CuidParamRequest,
  PaginationQuerySchema,
  type PaginationQueryRequest,
} from '@forerun/shared-types';

@Controller('admin/runners')
@UseGuards(VerifiedUserGuard)
@Roles('ADMIN')
export class RunnersController {
  constructor(private readonly runnersService: RunnersService) {}

  @Get()
  async findAll(
    @Query(new ZodValidationPipe(PaginationQuerySchema)) query: PaginationQueryRequest,
  ) {
    return this.runnersService.findAll(query.page, query.limit);
  }

  @Post()
  async create(
    @Body(new ZodValidationPipe(CreateRunnerSchema)) body: CreateRunnerRequest,
    @CurrentUser() user: { userId: string; role: string; status: string },
  ) {
    return this.runnersService.create({
      name: body.name,
      whatsapp: body.whatsapp,
      password: body.password,
      altPhone: body.altPhone,
    }, user.userId);
  }

  @Put(':id')
  async update(
    @Param(new ZodValidationPipe(CuidParamSchema)) params: CuidParamRequest,
    @Body(new ZodValidationPipe(UpdateRunnerSchema)) body: UpdateRunnerRequest,
    @CurrentUser() user: { userId: string; role: string; status: string },
  ) {
    return this.runnersService.update({
      id: params.id,
      name: body.name,
      altPhone: body.altPhone,
      notes: body.notes,
      password: body.password,
    }, user.userId);
  }

  @Put(':id/visibility')
  async updateVisibility(
    @Param(new ZodValidationPipe(CuidParamSchema)) params: CuidParamRequest,
    @Body(new ZodValidationPipe(UpdateVisibilitySchema)) body: UpdateVisibilityRequest,
    @CurrentUser() user: { userId: string; role: string; status: string },
  ) {
    return this.runnersService.updateVisibility({
      id: params.id,
      isVisible: body.isVisible,
    }, user.userId);
  }
}

@Controller('runner')
@UseGuards(VerifiedUserGuard)
@Roles('RUNNER')
export class RunnerController {
  constructor(private readonly runnersService: RunnersService) {}

  @Get('me')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async getMyProfile(
    @CurrentUser() user: { userId: string; role: string; status: string },
  ) {
    return this.runnersService.getMyProfile(user.userId);
  }

  @Put('me/status')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async updateMyStatus(
    @Body(new ZodValidationPipe(RunnerStatusUpdateSchema)) body: RunnerStatusUpdate,
    @CurrentUser() user: { userId: string; role: string; status: string },
  ) {
    return this.runnersService.updateMyStatus(user.userId, body.status);
  }

  @Get('orders/active')
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  async getActiveOrder(
    @CurrentUser() user: { userId: string; role: string; status: string },
  ) {
    return this.runnersService.getActiveOrder(user.userId);
  }
}
