import { UserStatus } from '@prisma/client';

export type UserActor = 'ADMIN' | 'SYSTEM';

export interface UserTransition {
  readonly from: UserStatus;
  readonly to: UserStatus;
  readonly actor: UserActor;
  readonly description: string;
}

export const USER_TRANSITIONS: readonly UserTransition[] = [
  // PENDING_VERIFICATION -> VERIFIED (Admin approves KYC / registration)
  {
    from: UserStatus.PENDING_VERIFICATION,
    to: UserStatus.VERIFIED,
    actor: 'ADMIN',
    description: 'Admin verifies user account',
  },
  // PENDING_VERIFICATION -> REJECTED (Admin rejects KYC / registration)
  {
    from: UserStatus.PENDING_VERIFICATION,
    to: UserStatus.REJECTED,
    actor: 'ADMIN',
    description: 'Admin rejects user account',
  },
  // PENDING_VERIFICATION -> SUSPENDED (Admin suspends unverified user)
  {
    from: UserStatus.PENDING_VERIFICATION,
    to: UserStatus.SUSPENDED,
    actor: 'ADMIN',
    description: 'Admin suspends unverified user',
  },

  // VERIFIED -> SUSPENDED (Admin suspends verified user)
  {
    from: UserStatus.VERIFIED,
    to: UserStatus.SUSPENDED,
    actor: 'ADMIN',
    description: 'Admin suspends verified user',
  },

  // REJECTED -> SUSPENDED (Admin suspends rejected user)
  {
    from: UserStatus.REJECTED,
    to: UserStatus.SUSPENDED,
    actor: 'ADMIN',
    description: 'Admin suspends rejected user',
  },

  // SUSPENDED -> VERIFIED (Restores to verified only if previousStatus was VERIFIED)
  {
    from: UserStatus.SUSPENDED,
    to: UserStatus.VERIFIED,
    actor: 'ADMIN',
    description: 'Admin unsuspends verified user back to verified',
  },
  // SUSPENDED -> PENDING_VERIFICATION (Restores to pending if previousStatus was PENDING_VERIFICATION)
  {
    from: UserStatus.SUSPENDED,
    to: UserStatus.PENDING_VERIFICATION,
    actor: 'ADMIN',
    description: 'Admin unsuspends user back to pending verification',
  },
  // SUSPENDED -> REJECTED (Restores to rejected if previousStatus was REJECTED)
  {
    from: UserStatus.SUSPENDED,
    to: UserStatus.REJECTED,
    actor: 'ADMIN',
    description: 'Admin unsuspends user back to rejected',
  },
];
