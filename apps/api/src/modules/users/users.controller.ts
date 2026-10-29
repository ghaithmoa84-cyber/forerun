import { Body, Controller, Delete, Get, Param, Put, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UsersService } from './users.service.js';
import { VerifiedUserGuard } from '../../common/guards/verified-user.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import {
  CuidParamSchema,
  type CuidParamRequest,
  AdminUsersQuerySchema,
  type AdminUsersQueryRequest,
  AdminResetPasswordSchema,
  type AdminResetPasswordRequest,
  AdminSoftDeleteUserSchema,
  type AdminSoftDeleteUserRequest,
  type AdminUserActionResponse,
  type UserAuditLogEntry,
  type AdminCustomerDetailsResponse,
} from '@forerun/shared-types';

@Controller('admin/users')
@UseGuards(VerifiedUserGuard)
@Roles('ADMIN')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async findAll(
    @Query(new ZodValidationPipe(AdminUsersQuerySchema)) query: AdminUsersQueryRequest,
  ) {
    return this.usersService.findAll(query.page, query.limit, query.search);
  }

  @Get(':id/audit-logs')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async getAuditLogs(
    @Param(new ZodValidationPipe(CuidParamSchema)) params: CuidParamRequest,
  ): Promise<UserAuditLogEntry[]> {
    return this.usersService.getAuditLogs(params.id);
  }

  @Get(':id')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async findOne(
    @Param(new ZodValidationPipe(CuidParamSchema)) params: CuidParamRequest,
  ): Promise<AdminCustomerDetailsResponse> {
    return this.usersService.findOne(params.id);
  }

  @Put(':id/verify')
  async verify(
    @Param(new ZodValidationPipe(CuidParamSchema)) params: CuidParamRequest,
    @CurrentUser() user: { userId: string; role: string; status: string },
  ) {
    return this.usersService.verify(params.id, user.userId);
  }

  @Put(':id/reject')
  async reject(
    @Param(new ZodValidationPipe(CuidParamSchema)) params: CuidParamRequest,
    @CurrentUser() user: { userId: string; role: string; status: string },
  ) {
    return this.usersService.reject(params.id, user.userId);
  }

  @Put(':id/suspend')
  async suspend(
    @Param(new ZodValidationPipe(CuidParamSchema)) params: CuidParamRequest,
    @CurrentUser() user: { userId: string; role: string; status: string },
  ) {
    return this.usersService.suspend(params.id, user.userId);
  }

  @Put(':id/unsuspend')
  async unsuspend(
    @Param(new ZodValidationPipe(CuidParamSchema)) params: CuidParamRequest,
    @CurrentUser() user: { userId: string; role: string; status: string },
  ) {
    return this.usersService.unsuspend(params.id, user.userId);
  }

  @Put(':id/reset-password')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async resetPassword(
    @Param(new ZodValidationPipe(CuidParamSchema)) params: CuidParamRequest,
    @Body(new ZodValidationPipe(AdminResetPasswordSchema)) body: AdminResetPasswordRequest,
    @CurrentUser() user: { userId: string; role: string; status: string },
  ): Promise<AdminUserActionResponse> {
    return this.usersService.resetPassword(params.id, body.password, user.userId);
  }

  @Delete(':id')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async softDelete(
    @Param(new ZodValidationPipe(CuidParamSchema)) params: CuidParamRequest,
    @Body(new ZodValidationPipe(AdminSoftDeleteUserSchema)) body: AdminSoftDeleteUserRequest,
    @CurrentUser() user: { userId: string; role: string; status: string },
  ): Promise<AdminUserActionResponse> {
    return this.usersService.softDelete(params.id, user.userId, body?.reason);
  }
}
