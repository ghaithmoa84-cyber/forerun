import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    // 1. Prefer authenticated user attached to request (e.g. from JwtAuthGuard)
    const user = req.user as { userId?: string } | undefined;
    if (user?.userId) {
      return `user:${user.userId}`;
    }

    // 2. Fallback: safely extract subject from Bearer JWT header if not yet attached
    const headers = req.headers as Record<string, string | undefined> | undefined;
    const authHeader = headers?.authorization;
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as { sub?: string };
          if (payload?.sub) {
            return `user:${payload.sub}`;
          }
        }
      } catch {
        // Fall back to IP if decoding fails
      }
    }

    // 3. Fallback to client IP for unauthenticated / public routes
    return (req.ip as string) || '';
  }
}
