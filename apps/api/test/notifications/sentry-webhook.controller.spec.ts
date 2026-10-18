import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import * as crypto from 'crypto';
import { SentryWebhookController } from '../../src/modules/notifications/sentry-webhook.controller.js';
import type { TelegramService } from '../../src/modules/notifications/telegram.service.js';

describe('SentryWebhookController', () => {
  let controller: SentryWebhookController;
  let mockConfigService: { get: ReturnType<typeof vi.fn> };
  let mockTelegramService: { sendMessage: ReturnType<typeof vi.fn> };
  const TEST_SECRET = 'test-secret-123';

  function createSignature(payload: unknown, secret: string = TEST_SECRET): { signature: string; buffer: Buffer } {
    const raw = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const buffer = Buffer.from(raw, 'utf-8');
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(buffer);
    return { signature: hmac.digest('hex'), buffer };
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
    const mockReq = {} as Request & { rawBody?: Buffer };

    await expect(
      controller.handleSentryWebhook({ action: 'created' }, mockReq),
    ).rejects.toThrow(UnauthorizedException);

    expect(mockTelegramService.sendMessage).not.toHaveBeenCalled();
  });

  it('2. should authorize and forward alert when valid HMAC signature is provided with rawBody buffer', async () => {
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

    const { signature, buffer } = createSignature(payload);
    const mockReq = { rawBody: buffer } as Request & { rawBody?: Buffer };
    const response = await controller.handleSentryWebhook(payload, mockReq, signature);

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
    const mockReq = { rawBody: Buffer.from(JSON.stringify(payload)) } as Request & { rawBody?: Buffer };

    await expect(
      controller.handleSentryWebhook(payload, mockReq, invalidSignature),
    ).rejects.toThrow(UnauthorizedException);

    expect(mockTelegramService.sendMessage).not.toHaveBeenCalled();
  });

  it('4. should reject with signature of different secret', async () => {
    const payload = { action: 'created' };
    const { signature, buffer } = createSignature(payload, 'wrong-secret');
    const mockReq = { rawBody: buffer } as Request & { rawBody?: Buffer };

    await expect(
      controller.handleSentryWebhook(payload, mockReq, signature),
    ).rejects.toThrow(UnauthorizedException);

    expect(mockTelegramService.sendMessage).not.toHaveBeenCalled();
  });

  it('5. should handle fatal level with skull icon and description field', async () => {
    const payload = {
      description: 'This is a test notification from Sentry alert rule',
      level: 'fatal',
      project_name: 'fawrun-api',
      web_url: 'https://fawrun-api.sentry.io/issues/999',
    };

    const { signature, buffer } = createSignature(payload);
    const mockReq = { rawBody: buffer } as Request & { rawBody?: Buffer };
    const response = await controller.handleSentryWebhook(payload, mockReq, signature);

    expect(response).toEqual({ status: 'success', handled: true });
    expect(mockTelegramService.sendMessage).toHaveBeenCalledTimes(1);
    const sentMessage = mockTelegramService.sendMessage.mock.calls[0][0];

    expect(sentMessage).toContain('💀 <b>تنبيه Sentry — خطأ جديد في الإنتاج</b>');
    expect(sentMessage).toContain('<b>المستوى:</b> <code>FATAL</code>');
    expect(sentMessage).toContain('This is a test notification from Sentry alert rule');
  });

  it('6. should ignore resolved action without sending notification', async () => {
    const payload = {
      action: 'resolved',
      data: {
        issue: {
          id: '12345',
          title: 'Already resolved bug',
        },
      },
    };

    const { signature, buffer } = createSignature(payload);
    const mockReq = { rawBody: buffer } as Request & { rawBody?: Buffer };
    const response = await controller.handleSentryWebhook(payload, mockReq, signature);

    expect(response).toEqual({ status: 'ignored', handled: false });
    expect(mockTelegramService.sendMessage).not.toHaveBeenCalled();
  });

  it('7. should escape HTML tags in error messages to avoid breaking Telegram formatting', async () => {
    const payload = {
      message: 'Error with <script>alert("xss")</script> & raw <tags>',
      level: 'error',
      url: 'https://sentry.io',
    };

    const { signature, buffer } = createSignature(payload);
    const mockReq = { rawBody: buffer } as Request & { rawBody?: Buffer };
    await controller.handleSentryWebhook(payload, mockReq, signature);

    const sentMessage = mockTelegramService.sendMessage.mock.calls[0][0];
    expect(sentMessage).toContain('&lt;script&gt;alert("xss")&lt;/script&gt; &amp; raw &lt;tags&gt;');
    expect(sentMessage).not.toContain('<script>');
  });

  it('8. should throw UnauthorizedException when secret is not configured at all (fail-closed)', async () => {
    mockConfigService.get.mockReturnValue(''); // No secret configured

    const payload = {
      message: 'Unauthenticated attack attempt',
      level: 'warning',
    };

    const mockReq = {} as Request & { rawBody?: Buffer };
    await expect(
      controller.handleSentryWebhook(payload, mockReq, 'some-signature'),
    ).rejects.toThrow(UnauthorizedException);
    expect(mockTelegramService.sendMessage).not.toHaveBeenCalled();
  });

  it('9. should omit url when url does not match valid https sentry domain without rejecting webhook', async () => {
    const maliciousPayload = {
      message: 'Test with phishing link',
      level: 'error',
      url: 'http://malicious-phishing.com/login',
    };

    const { signature, buffer } = createSignature(maliciousPayload);
    const mockReq = { rawBody: buffer } as Request & { rawBody?: Buffer };
    const response = await controller.handleSentryWebhook(maliciousPayload, mockReq, signature);

    expect(response).toEqual({ status: 'success', handled: true });
    expect(mockTelegramService.sendMessage).toHaveBeenCalledTimes(1);
    const sentMessage = mockTelegramService.sendMessage.mock.calls[0][0];
    expect(sentMessage).not.toContain('malicious-phishing.com');
    expect(sentMessage).not.toContain('🔗 فتح المشكلة في Sentry');
  });

  it('10. should include url when url is a valid https sentry.io domain', async () => {
    const validPayload = {
      message: 'Test with valid sentry link',
      level: 'error',
      url: 'https://org.sentry.io/issues/54321',
    };

    const { signature, buffer } = createSignature(validPayload);
    const mockReq = { rawBody: buffer } as Request & { rawBody?: Buffer };
    const response = await controller.handleSentryWebhook(validPayload, mockReq, signature);

    expect(response).toEqual({ status: 'success', handled: true });
    expect(mockTelegramService.sendMessage).toHaveBeenCalledTimes(1);
    const sentMessage = mockTelegramService.sendMessage.mock.calls[0][0];
    expect(sentMessage).toContain('https://org.sentry.io/issues/54321');
    expect(sentMessage).toContain('🔗 فتح المشكلة في Sentry');
  });
});
