import {
  Controller,
  Post,
  Body,
  Headers,
  Query,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import * as crypto from 'crypto';
import { Public } from '../../common/decorators/public.decorator.js';
import { TelegramService } from './telegram.service.js';

interface SentryWebhookIssue {
  id?: string;
  title?: string;
  culprit?: string;
  permalink?: string;
  level?: string;
  shortId?: string;
  project?: {
    slug?: string;
  };
}

interface SentryWebhookPayload {
  action?: string;
  project_name?: string;
  message?: string;
  level?: string;
  url?: string;
  web_url?: string;
  culprit?: string;
  issue?: SentryWebhookIssue;
  data?: {
    issue?: SentryWebhookIssue;
    event?: {
      title?: string;
    };
  };
}

function escapeHtml(text: string): string {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

@Controller('webhooks/sentry')
export class SentryWebhookController {
  private readonly logger = new Logger(SentryWebhookController.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly telegramService: TelegramService,
  ) {}

  /**
   * يستقبل تنبيهات Sentry الرسمية (Internal Integration أو Alert Rule Webhook)
   * ويقوم بإعادة توجيهها فوراً إلى محادثة تلغرام الخاصة بالمشروع
   */
  @Post()
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async handleSentryWebhook(
    @Body() body: SentryWebhookPayload,
    @Headers('sentry-hook-signature') signature?: string,
    @Headers('authorization') authHeader?: string,
    @Query('secret') querySecret?: string,
  ): Promise<{ status: string; handled: boolean }> {
    const configuredSecret = this.configService.get<string>('SENTRY_WEBHOOK_SECRET');

    // التحقق الأمني: إذا كان الرمز السري مضبوطاً في البيئة، نتحقق منه بدقة
    if (configuredSecret) {
      const isAuthorized = this.verifyAuthorization(
        body,
        configuredSecret,
        signature,
        authHeader,
        querySecret,
      );

      if (!isAuthorized) {
        this.logger.warn('Unauthorized Sentry webhook attempt rejected');
        throw new UnauthorizedException('Invalid or missing Sentry webhook credentials');
      }
    }

    // استخراج بيانات المشكلة بمرونة سواء كانت من Internal Integration أو Alert Rule
    const issueData = body?.data?.issue || body?.issue;
    const action = body?.action;

    // إذا كان الإجراء محدداً كـ resolved أو ignored ولا يمثل خطأ جديداً
    if (action && action !== 'created' && action !== 'triggered' && !body?.message) {
      return { status: 'ignored', handled: false };
    }

    const title = issueData?.title || body?.message || body?.data?.event?.title || 'Unknown Sentry Error';
    const level = (issueData?.level || body?.level || 'error').toUpperCase();
    const project = issueData?.project?.slug || body?.project_name || 'fawrun-api';
    const url = issueData?.permalink || body?.url || body?.web_url || '';
    const culprit = issueData?.culprit || body?.culprit || '';
    const shortId = issueData?.shortId || '';

    const icon = level === 'FATAL' ? '💀' : '🚨';
    const messageLines = [
      `${icon} <b>تنبيه Sentry — خطأ جديد في الإنتاج</b>`,
      `<b>المشروع:</b> <code>${escapeHtml(project)}</code>`,
      shortId ? `<b>المعرّف:</b> <code>${escapeHtml(shortId)}</code>` : '',
      `<b>المستوى:</b> <code>${escapeHtml(level)}</code>`,
      `<b>الخطأ:</b> <code>${escapeHtml(title)}</code>`,
      culprit ? `<b>الموقع:</b> <code>${escapeHtml(culprit)}</code>` : '',
      url ? `<a href="${url}">🔗 فتح المشكلة في Sentry</a>` : '',
    ].filter(Boolean);

    await this.telegramService.sendMessage(messageLines.join('\n'));

    return { status: 'success', handled: true };
  }

  private verifyAuthorization(
    body: unknown,
    secret: string,
    signature?: string,
    authHeader?: string,
    querySecret?: string,
  ): boolean {
    // 1. التحقق عبر توكن الاستعلام URL ?secret=...
    if (querySecret && querySecret === secret) {
      return true;
    }

    // 2. التحقق عبر ترويسة Authorization: Bearer <secret>
    if (authHeader && authHeader === `Bearer ${secret}`) {
      return true;
    }

    // 3. التحقق عبر توقيع HMAC التابع لـ Sentry: sentry-hook-signature
    if (signature) {
      try {
        const rawPayload = typeof body === 'string' ? body : JSON.stringify(body);
        const hmac = crypto.createHmac('sha256', secret);
        hmac.update(rawPayload);
        const digest = hmac.digest('hex');

        if (digest.length === signature.length && crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature))) {
          return true;
        }
      } catch (err) {
        this.logger.error('Failed to verify HMAC signature', err);
      }
    }

    return false;
  }
}
