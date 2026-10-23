import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    // 1. Authenticated user attached to request (verified by JwtAuthGuard)
    const user = req.user as { userId?: string } | undefined;
    if (user?.userId) {
      return `user:${user.userId}`;
    }

    // 2. Unauthenticated / public routes: strictly throttle by client IP
    return (req.ip as string) || '';
  }
}
