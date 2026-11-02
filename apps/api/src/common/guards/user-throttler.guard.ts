import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerLimitDetail, ThrottlerRequest } from '@nestjs/throttler';

/**
 * Normalizes Syrian phone formats to canonical local representation (09XXXXXXXX).
 * Handles +963, 00963, 963 prefixes, whitespace, dashes, and parentheses
 * to ensure all variations of the same WhatsApp number map to the identical throttle bucket.
 */
export function normalizeSyrianPhone(raw?: unknown): string {
  if (typeof raw !== 'string') return '';
  let cleaned = raw.trim().replace(/[\s\-().]/g, '');
  if (cleaned.startsWith('00963')) {
    cleaned = '0' + cleaned.substring(5);
  } else if (cleaned.startsWith('+963')) {
    cleaned = '0' + cleaned.substring(4);
  } else if (cleaned.startsWith('963') && cleaned.length === 12) {
    cleaned = '0' + cleaned.substring(3);
  }
  return cleaned;
}

@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected override async handleRequest(requestProps: ThrottlerRequest): Promise<boolean> {
    const { throttler, context } = requestProps;

    // D66: phone-based login throttler tracks the target WhatsApp number across all IPs.
    // Strictly adheres to LoginSchema payload (whatsapp field only - no dead aliases).
    if (throttler.name === 'login_phone') {
      const { req } = this.getRequestResponse(context);
      const body = req.body as { whatsapp?: unknown } | undefined;
      const normalizedPhone = normalizeSyrianPhone(body?.whatsapp);
      const tracker = normalizedPhone ? `phone:${normalizedPhone}` : (req.ip as string) || '';

      return super.handleRequest({
        ...requestProps,
        getTracker: () => Promise.resolve(tracker),
      });
    }

    return super.handleRequest(requestProps);
  }

  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    // 1. Authenticated user attached to request (verified by JwtAuthGuard)
    const user = req.user as { userId?: string } | undefined;
    if (user?.userId) {
      return `user:${user.userId}`;
    }

    // 2. Unauthenticated / public routes: strictly throttle by client IP
    return (req.ip as string) || '';
  }

  protected override async getErrorMessage(
    _context: ExecutionContext,
    throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<string> {
    if (
      throttlerLimitDetail.key.includes('login_phone') ||
      throttlerLimitDetail.tracker.startsWith('phone:')
    ) {
      return 'محاولات دخول كثيرة جداً لهذا الرقم مؤقتاً — يرجى المحاولة بعد قليل';
    }
    return 'محاولات كثيرة جداً — يرجى المحاولة لاحقاً';
  }
}
