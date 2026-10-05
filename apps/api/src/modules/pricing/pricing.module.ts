import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { PricingService } from './pricing.service.js';
import { PricingController } from './pricing.controller.js';

@Module({
  imports: [AuditModule, NotificationsModule],
  controllers: [PricingController],
  providers: [PricingService],
  exports: [PricingService],
})
export class PricingModule {}