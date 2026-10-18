import {
  Controller,
  Post,
  Body,
  Headers,
  Req,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import type { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import * as crypto from 'crypto';
import { Public } from '../../common/decorators/public.decorator.js';
import { TelegramService, escapeTelegramHtml } from './telegram.service.js';

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
  description?: string;
  level?: string;
  url?: string;
  web_url?: string;
  culprit?: string;
  issue?: SentryWebhookIssue;
  data?: {
    issue?: SentryWebhookIssue;
    description?: string;
    event?: {
      title?: string;
      message?: string;
    };
  };
}


function isValidSentryUrl(urlStr: string): boolean {
  if (!urlStr || typeof urlStr !== 'string') return false;
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'https:') return false;
    const hostname = parsed.hostname.toLowerCase();
    return hostname === 'sentry.io' || hostname.endsWith('.sentry.io');
  } catch {
    return false;
  }
}

@Controller('webhooks/sentry')
export class SentryWebhookController {
  private readonly logger = new Logger(SentryWebhookController.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly telegramService: TelegramService,
  ) {}

  /**
   * يستقبل تنبيهات Sentry الرسمية (Internal Integration Webhook)
   * ويقوم بالتحقق المشدد من توقيع HMAC التابع لـ Sentry عبر rawBody
   * ثم إعادة توجيه الإشعار فوراً إلى محادثة تلغرام الخاصة بالمشروع
   */
  @Post()
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async handleSentryWebhook(
    @Body() body: SentryWebhookPayload,
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('sentry-hook-signature') signature?: string,
  ): Promise<{ status: string; handled: boolean }> {
    const configuredSecret = this.configService.get<string>('SENTRY_WEBHOOK_SECRET');

    // SEC-02: التحقق الأمني بمبدأ Fail-Closed — رفض الطلب حتماً إن لم يكن السر معرّفاً
    if (!configuredSecret || configuredSecret.trim().length === 0) {
      this.logger.warn('SENTRY_WEBHOOK_SECRET is not configured. Webhook rejected.');
      throw new UnauthorizedException('Sentry webhook secret is not configured');
    }

    if (!signature) {
      this.logger.warn('Missing sentry-hook-signature header in Sentry webhook request');
      throw new UnauthorizedException('Missing Sentry webhook signature');
    }

    const isAuthorized = this.verifyHmacSignature(
      req?.rawBody,
      body,
      configuredSecret,
      signature,
    );

    if (!isAuthorized) {
      this.logger.warn('Invalid sentry-hook-signature in Sentry webhook request');
      throw new UnauthorizedException('Invalid Sentry webhook signature');
    }

    // استخراج بيانات المشكلة بمرونة سواء كانت من Internal Integration أو Alert Rule
    const issueData = body?.data?.issue || body?.issue;
    const action = body?.action;

    // إذا كان الإجراء محدداً كـ resolved أو archived
    if (action === 'resolved' || action === 'archived' || action === 'unresolved') {
      return { status: 'ignored', handled: false };
    }

    const title =
      issueData?.title ||
      body?.message ||
      body?.description ||
      body?.data?.description ||
      body?.data?.event?.title ||
      body?.data?.event?.message ||
      'Sentry Test Notification';

    const level = (issueData?.level || body?.level || 'error').toUpperCase();
    const project = issueData?.project?.slug || body?.project_name || 'fawrun-api';
    const rawUrl = issueData?.permalink || body?.url || body?.web_url || '';
    const validUrl = isValidSentryUrl(rawUrl) ? escapeTelegramHtml(rawUrl) : '';
    const culprit = issueData?.culprit || body?.culprit || '';
    const shortId = issueData?.shortId || '';

    const icon = level === 'FATAL' ? '💀' : '🚨';
    const messageLines = [
      `${icon} <b>تنبيه Sentry — خطأ جديد في الإنتاج</b>`,
      `<b>المشروع:</b> <code>${escapeTelegramHtml(project)}</code>`,
      shortId ? `<b>المعرّف:</b> <code>${escapeTelegramHtml(shortId)}</code>` : '',
      `<b>المستوى:</b> <code>${escapeTelegramHtml(level)}</code>`,
      `<b>الخطأ:</b> <code>${escapeTelegramHtml(title)}</code>`,
      culprit ? `<b>الموقع:</b> <code>${escapeTelegramHtml(culprit)}</code>` : '',
      validUrl ? `<a href="${validUrl}">🔗 فتح المشكلة في Sentry</a>` : '',
    ].filter(Boolean);

    await this.telegramService.sendMessage(messageLines.join('\n'));
    this.logger.log(`Sentry webhook notification dispatched to Telegram: ${title}`);

    return { status: 'success', handled: true };
  }

  private verifyHmacSignature(
    rawBuffer: Buffer | undefined,
    body: unknown,
    secret: string,
    signature: string,
  ): boolean {
    try {
      const hmac = crypto.createHmac('sha256', secret);

      if (rawBuffer && Buffer.isBuffer(rawBuffer)) {
        hmac.update(rawBuffer);
      } else {
        const rawPayload = typeof body === 'string' ? body : JSON.stringify(body);
        hmac.update(rawPayload);
      }

      const digest = hmac.digest('hex');

      if (
        digest.length === signature.length &&
        crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature))
      ) {
        return true;
      }
    } catch (err) {
      this.logger.error('Failed to verify Sentry HMAC signature', err);
    }

    return false;
  }
}
