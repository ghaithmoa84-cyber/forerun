import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service.js';
import { TelegramService } from './telegram.service.js';
import { FcmService } from './fcm.service.js';
import { SentryWebhookController } from './sentry-webhook.controller.js';

@Module({
  controllers: [SentryWebhookController],
  providers: [NotificationsService, TelegramService, FcmService],
  exports: [NotificationsService, TelegramService, FcmService],
})
export class NotificationsModule {}
