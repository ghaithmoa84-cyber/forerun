import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export function escapeTelegramHtml(text: string | null | undefined): string {
  if (text == null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly botToken: string;
  private readonly chatId: string;
  private readonly enabled: boolean;

  constructor(private readonly configService: ConfigService) {
    this.botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN') ?? '';
    this.chatId = this.configService.get<string>('TELEGRAM_CHAT_ID') ?? '';
    this.enabled = !!this.botToken && !!this.chatId;

    if (!this.enabled) {
      this.logger.warn(
        'Telegram notifications disabled — TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set',
      );
    }
  }

  async sendMessage(message: string): Promise<void> {
    if (!this.enabled) return;

    const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.chatId,
          text: message,
          parse_mode: 'HTML',
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        this.logger.error(`Telegram API error: ${error}`);
      }
    } catch (err) {
      // لا نرمي الخطأ — فشل الإشعار لا يوقف العملية الأساسية
      this.logger.error('Failed to send Telegram notification', err);
    }
  }
}
