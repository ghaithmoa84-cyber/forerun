import { Controller, Get, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@forerun/shared-types';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { SchemaDriftService, SchemaDriftResult } from './schema-drift.service.js';

interface AuthenticatedAdminUser {
  userId: string;
  adminId: string;
  role: UserRole;
}

@Controller('admin/system')
export class SystemController {
  constructor(private readonly schemaDriftService: SchemaDriftService) {}

  /**
   * Diagnostic endpoint to detect schema drift between schema.prisma and live database.
   *
   * Security & Rate Limiting:
   * - Strictly restricted to ADMIN role via JwtAuthGuard and RolesGuard.
   * - Throttled at IP level via NestJS ThrottlerGuard (3 req/min) behind reverse proxy (TRUST_PROXY=1).
   * - Additionally throttled per-admin within SchemaDriftService (10-second interval).
   * - Zero schema changes, zero raw write executions ($executeRaw forbidden).
   * - All checks logged to AuditLog.
   */
  @Get('schema-drift')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async getSchemaDrift(
    @CurrentUser() user: AuthenticatedAdminUser,
  ): Promise<SchemaDriftResult> {
    return this.schemaDriftService.checkDrift(user.userId, user.adminId);
  }
}
