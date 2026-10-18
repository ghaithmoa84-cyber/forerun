import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { TelegramService, escapeTelegramHtml } from './telegram.service.js';

describe('TelegramService', () => {
  let mockConfigService: { get: ReturnType<typeof vi.fn> };
  let loggerWarnSpy: ReturnType<typeof vi.spyOn>;
  let loggerErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    loggerWarnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    loggerErrorSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. should silently disable notifications and log a warning when config variables are missing', async () => {
    mockConfigService = {
      get: vi.fn((key: string) => {
        if (key === 'TELEGRAM_BOT_TOKEN') return '';
        if (key === 'TELEGRAM_CHAT_ID') return '';
        return undefined;
      }),
    };

    const fetchSpy = vi.spyOn(global, 'fetch');

    const service = new TelegramService(mockConfigService as unknown as ConfigService);

    expect(loggerWarnSpy).toHaveBeenCalledWith(
      'Telegram notifications disabled — TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set',
    );

    await service.sendMessage('test message');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('2. should send message successfully with mock fetch when enabled', async () => {
    mockConfigService = {
      get: vi.fn((key: string) => {
        if (key === 'TELEGRAM_BOT_TOKEN') return 'test-token';
        if (key === 'TELEGRAM_CHAT_ID') return 'test-chat-id';
        return undefined;
      }),
    };

    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      text: async () => 'ok',
    } as Response);

    const service = new TelegramService(mockConfigService as unknown as ConfigService);

    await service.sendMessage('Hello <b>World</b>');

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.telegram.org/bottest-token/sendMessage',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: 'test-chat-id',
          text: 'Hello <b>World</b>',
          parse_mode: 'HTML',
        }),
      },
    );
  });

  it('3. should swallow errors and log error when fetch fails or rejects without throwing', async () => {
    mockConfigService = {
      get: vi.fn((key: string) => {
        if (key === 'TELEGRAM_BOT_TOKEN') return 'test-token';
        if (key === 'TELEGRAM_CHAT_ID') return 'test-chat-id';
        return undefined;
      }),
    };

    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));

    const service = new TelegramService(mockConfigService as unknown as ConfigService);

    await expect(service.sendMessage('test message')).resolves.not.toThrow();
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      'Failed to send Telegram notification',
      expect.any(Error),
    );
  });

  it('4. should log error when response is not ok without throwing', async () => {
    mockConfigService = {
      get: vi.fn((key: string) => {
        if (key === 'TELEGRAM_BOT_TOKEN') return 'test-token';
        if (key === 'TELEGRAM_CHAT_ID') return 'test-chat-id';
        return undefined;
      }),
    };

    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      text: async () => 'Bad Request',
    } as Response);

    const service = new TelegramService(mockConfigService as unknown as ConfigService);

    await expect(service.sendMessage('test message')).resolves.not.toThrow();
    expect(loggerErrorSpy).toHaveBeenCalledWith('Telegram API error: Bad Request');
  });

  describe('escapeTelegramHtml helper', () => {
    it('5. escapes <, >, and & characters to prevent Telegram parse errors', () => {
      const maliciousName = 'Ahmad <script>alert("hack")</script> & Co';
      const escaped = escapeTelegramHtml(maliciousName);

      expect(escaped).toBe('Ahmad &lt;script&gt;alert("hack")&lt;/script&gt; &amp; Co');
      expect(escaped).not.toContain('<script>');
      expect(escaped).not.toContain('& Co');
    });

    it('6. safely handles null, undefined, and empty string without throwing', () => {
      expect(escapeTelegramHtml(null)).toBe('');
      expect(escapeTelegramHtml(undefined)).toBe('');
      expect(escapeTelegramHtml('')).toBe('');
    });

    it('7. leaves regular safe text unchanged', () => {
      expect(escapeTelegramHtml('محمد علي')).toBe('محمد علي');
      expect(escapeTelegramHtml('+963912345678')).toBe('+963912345678');
    });
  });
});
