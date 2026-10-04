import { Throttle } from '@nestjs/throttler';
import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  CloseSettlementSchema,
  SettlementAdminQuerySchema,
  RunnerSettlementsQuerySchema,
  PendingSettlementsQuerySchema,
  CuidParamSchema,
  type CloseSettlementRequest,
  type SettlementAdminQuery,
  type RunnerSettlementsQuery,
  type PendingSettlementsQuery,
  type CuidParamRequest,
} from '@forerun/shared-types';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { VerifiedUserGuard } from '../../common/guards/verified-user.guard.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { SettlementsService } from './settlements.service.js';

@Controller()
@UseGuards(VerifiedUserGuard)
export class SettlementsController {
  constructor(
    private readonly settlementsService: SettlementsService,
  ) {}

  @Get('runner/settlements')
  @Roles('RUNNER')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async listRunner(
    @Query(new ZodValidationPipe(RunnerSettlementsQuerySchema))
    query: RunnerSettlementsQuery,
    @CurrentUser() user: { userId: string; role: string; status: string },
  ) {
    const runner = await this.settlementsService.resolveRunner(user.userId);

    return this.settlementsService.listRunnerSettlements(
      runner.id,
      query.page,
      query.limit,
    );
  }

  @Get('runner/settlements/current')
  @Roles('RUNNER')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async getCurrentSettlement(
    @CurrentUser() user: { userId: string; role: string; status: string },
  ) {
    const runner = await this.settlementsService.resolveRunner(user.userId);

    return this.settlementsService.getCurrentSettlement(runner.id);
  }

  @Post('admin/settlements/close-day')
  @Roles('ADMIN')
  @Throttle({ default: { limit: 5, ttl: 600000 } })
  async closeDay(
    @Body(new ZodValidationPipe(CloseSettlementSchema)) dto: CloseSettlementRequest,
    @CurrentUser() user: { userId: string; adminId?: string | null; role: string; status: string },
  ) {
    if (!user.adminId) {
      throw new ForbiddenException('Admin record not found');
    }
    return this.settlementsService.closeDay(dto.operationalDate, dto.notes, user.userId, user.adminId);
  }

  @Put('admin/settlements/:id/mark-settled')
  @Roles('ADMIN')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async markSettled(
    @Param(new ZodValidationPipe(CuidParamSchema)) params: CuidParamRequest,
    @CurrentUser() user: { userId: string; adminId?: string | null; role: string; status: string },
  ) {
    if (!user.adminId) {
      throw new ForbiddenException('Admin record not found');
    }
    return this.settlementsService.markSettled(params.id, user.userId, user.adminId);
  }

  @Get('admin/settlements')
  @Roles('ADMIN')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async listAdmin(
    @Query(new ZodValidationPipe(SettlementAdminQuerySchema))
    query: SettlementAdminQuery,
  ) {
    return this.settlementsService.listAdmin(query);
  }

  @Get('admin/settlements/pending')
  @Roles('ADMIN')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async getPendingSettlements(
    @Query(new ZodValidationPipe(PendingSettlementsQuerySchema))
    query: PendingSettlementsQuery,
  ) {
    return this.settlementsService.getPendingSettlements(
      query.page,
      query.limit,
    );
  }
}
