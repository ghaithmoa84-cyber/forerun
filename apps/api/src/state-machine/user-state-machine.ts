import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { UserActor, UserTransition } from './user-transitions.js';

export interface UserTransitionResult {
  from: UserStatus;
  to: UserStatus;
  actor: UserActor;
  description: string;
}

export interface UserTransitionContext {
  actorId?: string;
  previousStatus?: UserStatus | null;
  reason?: string;
  meta?: Record<string, unknown>;
}

@Injectable()
export class UserStateMachine {
  private readonly index = new Map<string, UserTransition>();

  constructor(transitions: readonly UserTransition[]) {
    for (const t of transitions) {
      this.index.set(this.key(t.from, t.to, t.actor), t);
    }
  }

  private key(from: UserStatus, to: UserStatus, actor: UserActor): string {
    return `${from}->${to}::${actor}`;
  }

  canTransition(from: UserStatus, to: UserStatus, actor: UserActor): boolean {
    return this.index.has(this.key(from, to, actor));
  }

  transition(
    from: UserStatus,
    to: UserStatus,
    actor: UserActor,
    context?: UserTransitionContext,
  ): UserTransitionResult {
    const descriptor = this.index.get(this.key(from, to, actor));
    if (!descriptor) {
      throw new UnprocessableEntityException(
        `Invalid user status transition from ${from} to ${to} by ${actor}`,
      );
    }

    // Safety guard: if transitioning out of SUSPENDED, target MUST match previousStatus
    if (from === UserStatus.SUSPENDED) {
      const allowedRestore = context?.previousStatus ?? UserStatus.PENDING_VERIFICATION;
      if (to !== allowedRestore) {
        throw new UnprocessableEntityException(
          `Cannot restore suspended user to ${to}; original status was ${allowedRestore}`,
        );
      }
    }

    return {
      from: descriptor.from,
      to: descriptor.to,
      actor: descriptor.actor,
      description: descriptor.description,
    };
  }
}
