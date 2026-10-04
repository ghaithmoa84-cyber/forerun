import { Controller, Get, Param, Put, Query, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { VerifiedUserGuard } from '../../common/guards/verified-user.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import {
  CuidParamSchema,
  type CuidParamRequest,
  PaginationQuerySchema,
  type PaginationQueryRequest,
} from '@forerun/shared-types';

@Controller('admin/users')
@UseGuards(VerifiedUserGuard)
@Roles('ADMIN')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async findAll(
    @Query(new ZodValidationPipe(PaginationQuerySchema)) query: PaginationQueryRequest,
  ) {
    return this.usersService.findAll(query.page, query.limit);
  }

  @Get(':id')
  async findOne(
    @Param(new ZodValidationPipe(CuidParamSchema)) params: CuidParamRequest,
  ) {
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
}
