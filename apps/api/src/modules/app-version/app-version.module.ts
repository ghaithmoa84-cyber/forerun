import { Module } from '@nestjs/common';
import { AppVersionController } from './app-version.controller.js';
import { AppVersionService } from './app-version.service.js';
import { AuditModule } from '../audit/audit.module.js';

@Module({
  imports: [AuditModule],
  controllers: [AppVersionController],
  providers: [AppVersionService],
  exports: [AppVersionService],
})
export class AppVersionModule {}
