import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { BannersService } from './banners.service.js';
import { BannersAdminController } from './banners-admin.controller.js';
import { BannersPublicController } from './banners-public.controller.js';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [BannersAdminController, BannersPublicController],
  providers: [BannersService],
  exports: [BannersService],
})
export class BannersModule {}
