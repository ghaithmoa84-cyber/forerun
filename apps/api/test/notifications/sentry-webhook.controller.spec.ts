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
  const TEST_SECRET = 'test-secret-123';

  function createSignature(payload: unknown, secret: string = TEST_SECRET): string {
    const raw = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(raw);
    return hmac.digest('hex');
  }

  beforeEach(() => {
    vi.restoreAllMocks();

    mockConfigService = {
      get: vi.fn((key: string) => {
        if (key === 'SENTRY_WEBHOOK_SECRET') return TEST_SECRET;
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

  it('1. should throw UnauthorizedException when secret is configured but signature header is missing', async () => {
    await expect(
      controller.handleSentryWebhook({ action: 'created' }),
    ).rejects.toThrow(UnauthorizedException);

    expect(mockTelegramService.sendMessage).not.toHaveBeenCalled();
  });

  it('2. should authorize and forward alert when valid HMAC signature is provided', async () => {
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

    const signature = createSignature(payload);
    const response = await controller.handleSentryWebhook(payload, signature);

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

  it('3. should reject when HMAC signature is invalid', async () => {
    const payload = { action: 'created' };
    const invalidSignature = 'invalid-signature-hex-1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

    await expect(
      controller.handleSentryWebhook(payload, invalidSignature),
    ).rejects.toThrow(UnauthorizedException);

    expect(mockTelegramService.sendMessage).not.toHaveBeenCalled();
  });

  it('4. should reject with signature of different secret', async () => {
    const payload = { action: 'created' };
    const wrongSignature = createSignature(payload, 'wrong-secret');

    await expect(
      controller.handleSentryWebhook(payload, wrongSignature),
    ).rejects.toThrow(UnauthorizedException);

    expect(mockTelegramService.sendMessage).not.toHaveBeenCalled();
  });

  it('5. should handle fatal level with skull icon', async () => {
    const payload = {
      message: 'Unhandled fatal exception in worker',
      level: 'fatal',
      project_name: 'fawrun-api',
      url: 'https://fawrun-api.sentry.io/issues/999',
    };

    const signature = createSignature(payload);
    const response = await controller.handleSentryWebhook(payload, signature);

    expect(response).toEqual({ status: 'success', handled: true });
    expect(mockTelegramService.sendMessage).toHaveBeenCalledTimes(1);
    const sentMessage = mockTelegramService.sendMessage.mock.calls[0][0];

    expect(sentMessage).toContain('💀 <b>تنبيه Sentry — خطأ جديد في الإنتاج</b>');
    expect(sentMessage).toContain('<b>المستوى:</b> <code>FATAL</code>');
    expect(sentMessage).toContain('Unhandled fatal exception in worker');
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

    const signature = createSignature(payload);
    const response = await controller.handleSentryWebhook(payload, signature);

    expect(response).toEqual({ status: 'ignored', handled: false });
    expect(mockTelegramService.sendMessage).not.toHaveBeenCalled();
  });

  it('7. should escape HTML tags in error messages to avoid breaking Telegram formatting', async () => {
    const payload = {
      message: 'Error with <script>alert("xss")</script> & raw <tags>',
      level: 'error',
      url: 'https://sentry.io',
    };

    const signature = createSignature(payload);
    await controller.handleSentryWebhook(payload, signature);

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
