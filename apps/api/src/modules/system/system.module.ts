import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module.js';
import { UsersModule } from '../users/users.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { SystemController } from './system.controller.js';
import { SchemaDriftService } from './schema-drift.service.js';

@Module({
  imports: [PrismaModule, UsersModule, AuditModule, NotificationsModule],
  controllers: [SystemController],
  providers: [SchemaDriftService],
  exports: [SchemaDriftService],
})
export class SystemModule {}
