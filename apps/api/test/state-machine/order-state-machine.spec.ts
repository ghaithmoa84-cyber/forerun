import { describe, it, expect } from 'vitest';
import { type OrderStatus } from '@forerun/shared-constants';
import { OrderStateMachine } from '../../src/state-machine/order-state-machine.js';
import { ORDER_TRANSITIONS } from '../../src/state-machine/order-transitions.js';

describe('OrderStateMachine', () => {
  const sm = new OrderStateMachine(ORDER_TRANSITIONS);

  // ── Positive: every allowed transition must be accepted ──────────────
  describe('canTransition — allowed transitions', () => {
    const allowed: Array<[string, string, string]> = [
      ['DRAFT', 'PENDING_REVIEW', 'CUSTOMER'],
      ['PENDING_REVIEW', 'UNDER_REVIEW', 'ADMIN'],
      ['PENDING_REVIEW', 'CANCELLED', 'CUSTOMER'],
      ['UNDER_REVIEW', 'AWAITING_PREFERRED_RUNNER', 'ADMIN'],
      ['UNDER_REVIEW', 'AWAITING_RUNNER', 'ADMIN'],
      ['UNDER_REVIEW', 'CANCELLED', 'ADMIN'],
      ['AWAITING_RUNNER', 'AWAITING_PREFERRED_RUNNER', 'SYSTEM'],
      ['AWAITING_RUNNER', 'ASSIGNED', 'RUNNER'],
      ['AWAITING_RUNNER', 'CANCELLED', 'CUSTOMER'],
      ['AWAITING_PREFERRED_RUNNER', 'ASSIGNED', 'RUNNER'],
      ['AWAITING_PREFERRED_RUNNER', 'ASSIGNED', 'ADMIN'],
      ['AWAITING_PREFERRED_RUNNER', 'AWAITING_RUNNER', 'SYSTEM'],
      ['AWAITING_PREFERRED_RUNNER', 'CANCELLED', 'CUSTOMER'],
      ['ASSIGNED', 'IN_PROGRESS', 'RUNNER'],
      ['ASSIGNED', 'CANCELLED', 'CUSTOMER'],
      ['IN_PROGRESS', 'OUT_FOR_DELIVERY', 'RUNNER'],
      ['OUT_FOR_DELIVERY', 'DELIVERED', 'RUNNER'],
      // Admin force cancellations (Decision D39)
      ['DRAFT', 'CANCELLED', 'ADMIN'],
      ['DELIVERED', 'CANCELLED', 'ADMIN'],
    ];

    it.each(allowed)(
      'allows %s -> %s by %s',
      (from, to, actor) => {
        expect(sm.canTransition(from as any, to as any, actor as any)).toBe(true);
      },
    );

    it('returns a valid TransitionResult on transition()', () => {
      const result = sm.transition('DRAFT', 'PENDING_REVIEW', 'CUSTOMER');
      expect(result).toEqual({
        from: 'DRAFT',
        to: 'PENDING_REVIEW',
        actor: 'CUSTOMER',
        description: 'Customer submits order for admin review',
      });
    });

    it('allows DELIVERED -> CANCELLED by ADMIN (Decision D39)', () => {
      const result = sm.transition('DELIVERED', 'CANCELLED', 'ADMIN');
      expect(result).toEqual({
        from: 'DELIVERED',
        to: 'CANCELLED',
        actor: 'ADMIN',
        description: 'Admin force cancels delivered order',
      });
    });
  });

  // ── Negative: every forbidden transition must be rejected ────────────
  describe('canTransition — forbidden transitions', () => {
    const forbidden: Array<[string, string, string, string]> = [
      // Customer cannot cancel once shopping started, and cannot bypass admin review
      ['IN_PROGRESS', 'CANCELLED', 'CUSTOMER', 'customer cancellation from IN_PROGRESS'],
      ['OUT_FOR_DELIVERY', 'CANCELLED', 'CUSTOMER', 'customer cancellation from OUT_FOR_DELIVERY'],
      ['DELIVERED', 'CANCELLED', 'CUSTOMER', 'customer cancellation from DELIVERED'],
      ['UNDER_REVIEW', 'CANCELLED', 'CUSTOMER', 'only ADMIN can cancel during review'],
      // DELIVERED has no outgoing transitions for RUNNER
      ['DELIVERED', 'IN_PROGRESS', 'RUNNER', 'no runner transition from DELIVERED'],
      // CANCELLED is terminal
      ['CANCELLED', 'DRAFT', 'CUSTOMER', 'CANCELLED is terminal'],
      ['CANCELLED', 'PENDING_REVIEW', 'ADMIN', 'CANCELLED is terminal'],
      // Wrong actor for allowed target
      ['DRAFT', 'PENDING_REVIEW', 'ADMIN', 'only CUSTOMER can submit'],
      ['PENDING_REVIEW', 'UNDER_REVIEW', 'CUSTOMER', 'only ADMIN can review'],
      ['ASSIGNED', 'IN_PROGRESS', 'CUSTOMER', 'only RUNNER can start shopping'],
      ['OUT_FOR_DELIVERY', 'DELIVERED', 'CUSTOMER', 'only RUNNER can confirm delivery'],
      // Backward transitions
      ['PENDING_REVIEW', 'DRAFT', 'CUSTOMER', 'no backward to DRAFT'],
      ['IN_PROGRESS', 'ASSIGNED', 'RUNNER', 'no backward to ASSIGNED'],
      ['DELIVERED', 'OUT_FOR_DELIVERY', 'RUNNER', 'no backward from DELIVERED'],
      // Invalid target from source
      ['DRAFT', 'DELIVERED', 'CUSTOMER', 'cannot skip to DELIVERED'],
      ['DRAFT', 'IN_PROGRESS', 'RUNNER', 'cannot skip to IN_PROGRESS'],
      ['AWAITING_RUNNER', 'DELIVERED', 'RUNNER', 'cannot skip to DELIVERED'],
      ['ASSIGNED', 'DELIVERED', 'RUNNER', 'cannot skip to DELIVERED'],
      // Unknown actor
      ['PENDING_REVIEW', 'CANCELLED', 'UNKNOWN', 'unknown actor'],
      // Only CUSTOMER may cancel while the order waits for a runner
      ['AWAITING_RUNNER', 'CANCELLED', 'SYSTEM', 'SYSTEM cannot cancel on customer behalf'],
      ['AWAITING_PREFERRED_RUNNER', 'CANCELLED', 'SYSTEM', 'SYSTEM cannot cancel on customer behalf'],
      ['AWAITING_PREFERRED_RUNNER', 'CANCELLED', 'RUNNER', 'only CUSTOMER or ADMIN can cancel'],
    ];

    it.each(forbidden)(
      'rejects %s -> %s by %s (%s)',
      (from, to, actor, _desc) => {
        expect(sm.canTransition(from as any, to as any, actor as any)).toBe(false);
      },
    );

    it('throws UnprocessableEntityException on transition() for forbidden move', () => {
      expect(() => sm.transition('DELIVERED', 'CANCELLED', 'CUSTOMER')).toThrow(
        expect.objectContaining({ status: 422 }),
      );
    });

    it('throws UnprocessableEntityException when transitioning from terminal state', () => {
      expect(() => sm.transition('CANCELLED', 'DRAFT', 'CUSTOMER')).toThrow(
        expect.objectContaining({ status: 422 }),
      );
    });
  });

  // ── Terminal state checks ────────────────────────────────────────────
  describe('isTerminal', () => {
    it('returns true for DELIVERED and CANCELLED', () => {
      expect(sm.isTerminal('DELIVERED')).toBe(true);
      expect(sm.isTerminal('CANCELLED')).toBe(true);
    });

    it('returns false for all non-terminal states', () => {
      const nonTerminal = [
        'DRAFT',
        'PENDING_REVIEW',
        'UNDER_REVIEW',
        'AWAITING_RUNNER',
        'AWAITING_PREFERRED_RUNNER',
        'ASSIGNED',
        'IN_PROGRESS',
        'OUT_FOR_DELIVERY',
      ] as const;
      for (const s of nonTerminal) {
        expect(sm.isTerminal(s)).toBe(false);
      }
    });
  });

  // ── assertNotTerminal ────────────────────────────────────────────────
  describe('assertNotTerminal', () => {
    it('does not throw for non-terminal states', () => {
      expect(() => sm.assertNotTerminal('DRAFT')).not.toThrow();
    });

    it('throws 422 for terminal states', () => {
      expect(() => sm.assertNotTerminal('DELIVERED')).toThrow(
        expect.objectContaining({ status: 422 }),
      );
      expect(() => sm.assertNotTerminal('CANCELLED')).toThrow(
        expect.objectContaining({ status: 422 }),
      );
    });
  });

  // ── Transition count ─────────────────────────────────────────────────
  describe('transition table integrity', () => {
    it('defines exactly 30 allowed order transitions (including D39 admin force cancel)', () => {
      expect(ORDER_TRANSITIONS).toHaveLength(30);
    });

    it('covers all 10 OrderStatus enum values', () => {
      const statuses = new Set<OrderStatus>();
      for (const t of ORDER_TRANSITIONS) {
        statuses.add(t.from);
        statuses.add(t.to);
      }
      // Every status must appear at least once (as source or target)
      expect(statuses.size).toBe(10);
    });
  });
});