import { Throttle } from '@nestjs/throttler';
import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  LedgerQuerySchema,
  type LedgerQuery,
} from '@forerun/shared-types';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { VerifiedUserGuard } from '../../common/guards/verified-user.guard.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { LedgerService } from './ledger.service.js';

@Controller()
@UseGuards(VerifiedUserGuard)
export class LedgerController {
  constructor(private readonly ledgerService: LedgerService) {}

  @Get('admin/ledger')
  @Roles('ADMIN')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async listAdmin(
    @Query(new ZodValidationPipe(LedgerQuerySchema))
    query: LedgerQuery,
  ) {
    return this.ledgerService.listAdminEntries(query);
  }
}
