import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { SentryWebhookController } from '../../src/modules/notifications/sentry-webhook.controller.js';
import type { TelegramService } from '../../src/modules/notifications/telegram.service.js';

describe('SentryWebhookController', () => {
  let controller: SentryWebhookController;
  let mockConfigService: { get: ReturnType<typeof vi.fn> };
  let mockTelegramService: { sendMessage: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.restoreAllMocks();

    mockConfigService = {
      get: vi.fn((key: string) => {
        if (key === 'SENTRY_WEBHOOK_SECRET') return 'test-secret-123';
        return undefined;
      }),
    };

    mockTelegramService = {
      sendMessage: vi.fn().mockResolvedValue(undefined),
    };

    controller = new SentryWebhookController(
      mockConfigService as unknown as ConfigService,
      mockTelegramService as unknown as TelegramService,
    );
  });

  it('1. should throw UnauthorizedException when secret is configured but not provided in request', async () => {
    await expect(
      controller.handleSentryWebhook({ action: 'created' }),
    ).rejects.toThrow(UnauthorizedException);

    expect(mockTelegramService.sendMessage).not.toHaveBeenCalled();
  });

  it('2. should authorize and forward alert when valid query secret is provided', async () => {
    const payload = {
      action: 'created',
      data: {
        issue: {
          id: '12345',
          shortId: 'FAWRUN-API-1',
          title: 'Database connection failed',
          culprit: 'customer-orders.service.ts',
          level: 'error',
          permalink: 'https://fawrun-api.sentry.io/issues/12345',
          project: { slug: 'fawrun-api' },
        },
      },
    };

    const response = await controller.handleSentryWebhook(
      payload,
      undefined,
      undefined,
      'test-secret-123',
    );

    expect(response).toEqual({ status: 'success', handled: true });
    expect(mockTelegramService.sendMessage).toHaveBeenCalledTimes(1);
    const sentMessage = mockTelegramService.sendMessage.mock.calls[0][0];

    expect(sentMessage).toContain('🚨 <b>تنبيه Sentry — خطأ جديد في الإنتاج</b>');
    expect(sentMessage).toContain('<b>المشروع:</b> <code>fawrun-api</code>');
    expect(sentMessage).toContain('<b>المعرّف:</b> <code>FAWRUN-API-1</code>');
    expect(sentMessage).toContain('<b>الخطأ:</b> <code>Database connection failed</code>');
    expect(sentMessage).toContain('<b>الموقع:</b> <code>customer-orders.service.ts</code>');
    expect(sentMessage).toContain('https://fawrun-api.sentry.io/issues/12345');
  });

  it('3. should authorize when Bearer token matches secret in authorization header', async () => {
    const payload = {
      message: 'Unhandled fatal exception in worker',
      level: 'fatal',
      project_name: 'fawrun-api',
      url: 'https://fawrun-api.sentry.io/issues/999',
    };

    const response = await controller.handleSentryWebhook(
      payload,
      undefined,
      'Bearer test-secret-123',
    );

    expect(response).toEqual({ status: 'success', handled: true });
    expect(mockTelegramService.sendMessage).toHaveBeenCalledTimes(1);
    const sentMessage = mockTelegramService.sendMessage.mock.calls[0][0];

    expect(sentMessage).toContain('💀 <b>تنبيه Sentry — خطأ جديد في الإنتاج</b>');
    expect(sentMessage).toContain('<b>المستوى:</b> <code>FATAL</code>');
    expect(sentMessage).toContain('Unhandled fatal exception in worker');
  });

  it('4. should authorize when HMAC signature header is valid', async () => {
    const payload = {
      action: 'created',
      data: {
        issue: {
          title: 'PrismaClientKnownRequestError',
          level: 'error',
          permalink: 'https://fawrun-api.sentry.io/issues/555',
        },
      },
    };

    const rawString = JSON.stringify(payload);
    const hmac = crypto.createHmac('sha256', 'test-secret-123');
    hmac.update(rawString);
    const signature = hmac.digest('hex');

    const response = await controller.handleSentryWebhook(
      payload,
      signature,
    );

    expect(response).toEqual({ status: 'success', handled: true });
    expect(mockTelegramService.sendMessage).toHaveBeenCalledTimes(1);
  });

  it('5. should reject when HMAC signature is invalid', async () => {
    const payload = { action: 'created' };
    const invalidSignature = 'invalid-signature-hex-1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

    await expect(
      controller.handleSentryWebhook(payload, invalidSignature),
    ).rejects.toThrow(UnauthorizedException);

    expect(mockTelegramService.sendMessage).not.toHaveBeenCalled();
  });

  it('6. should ignore non-creation actions such as resolved without sending notification', async () => {
    const payload = {
      action: 'resolved',
      data: {
        issue: {
          id: '12345',
          title: 'Already resolved bug',
        },
      },
    };

    const response = await controller.handleSentryWebhook(
      payload,
      undefined,
      'Bearer test-secret-123',
    );

    expect(response).toEqual({ status: 'ignored', handled: false });
    expect(mockTelegramService.sendMessage).not.toHaveBeenCalled();
  });

  it('7. should escape HTML tags in error messages to avoid breaking Telegram formatting', async () => {
    const payload = {
      message: 'Error with <script>alert("xss")</script> & raw <tags>',
      level: 'error',
      url: 'https://sentry.io',
    };

    await controller.handleSentryWebhook(
      payload,
      undefined,
      'Bearer test-secret-123',
    );

    const sentMessage = mockTelegramService.sendMessage.mock.calls[0][0];
    expect(sentMessage).toContain('&lt;script&gt;alert("xss")&lt;/script&gt; &amp; raw &lt;tags&gt;');
    expect(sentMessage).not.toContain('<script>');
  });

  it('8. should allow requests in dev/test when secret is not configured', async () => {
    mockConfigService.get.mockReturnValue(''); // No secret configured

    const payload = {
      message: 'Dev error test',
      level: 'warning',
    };

    const response = await controller.handleSentryWebhook(payload);
    expect(response).toEqual({ status: 'success', handled: true });
    expect(mockTelegramService.sendMessage).toHaveBeenCalledTimes(1);
  });
});
