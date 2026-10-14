import { ORDER_STATUSES, ORDER_STORE_STATUSES } from '@forerun/shared-constants';
import type { OrderStatus, OrderStoreStatus } from '@forerun/shared-constants';

export type OrderActor = 'CUSTOMER' | 'ADMIN' | 'RUNNER' | 'SYSTEM';

export interface OrderTransition {
  readonly from: OrderStatus;
  readonly to: OrderStatus;
  readonly actor: OrderActor;
  readonly description: string;
}

export interface OrderStoreTransition {
  readonly from: OrderStoreStatus;
  readonly to: OrderStoreStatus;
  readonly actor: 'RUNNER' | 'SYSTEM';
  readonly description: string;
}

export const ORDER_TRANSITIONS: readonly OrderTransition[] = [
  // DRAFT → PENDING_REVIEW  (customer submits order for review)
  { from: 'DRAFT', to: 'PENDING_REVIEW', actor: 'CUSTOMER', description: 'Customer submits order for admin review' },

  // PENDING_REVIEW → UNDER_REVIEW  (admin begins review)
  { from: 'PENDING_REVIEW', to: 'UNDER_REVIEW', actor: 'ADMIN', description: 'Admin starts reviewing the order' },

  // PENDING_REVIEW → CANCELLED  (customer cancels while pending review)
  { from: 'PENDING_REVIEW', to: 'CANCELLED', actor: 'CUSTOMER', description: 'Customer cancels order during pending review' },

  // UNDER_REVIEW → AWAITING_PREFERRED_RUNNER  (admin approves + preferred unavailable)
  { from: 'UNDER_REVIEW', to: 'AWAITING_PREFERRED_RUNNER', actor: 'ADMIN', description: 'Admin approves, preferred runner unavailable' },

  // UNDER_REVIEW → AWAITING_RUNNER  (admin approves + any runner)
  { from: 'UNDER_REVIEW', to: 'AWAITING_RUNNER', actor: 'ADMIN', description: 'Admin approves order, awaiting runner assignment' },

  // UNDER_REVIEW → CANCELLED  (admin rejects during review)
  { from: 'UNDER_REVIEW', to: 'CANCELLED', actor: 'ADMIN', description: 'Admin rejects order during review' },

  // AWAITING_RUNNER → AWAITING_PREFERRED_RUNNER  (system routes to preferred)
  { from: 'AWAITING_RUNNER', to: 'AWAITING_PREFERRED_RUNNER', actor: 'SYSTEM', description: 'System routes order to preferred runner queue' },

  // AWAITING_RUNNER → CANCELLED  (customer cancels before any runner takes it)
  { from: 'AWAITING_RUNNER', to: 'CANCELLED', actor: 'CUSTOMER', description: 'Customer cancels order while awaiting runner assignment' },

  // AWAITING_RUNNER → ASSIGNED  (runner accepts from pool)
  { from: 'AWAITING_RUNNER', to: 'ASSIGNED', actor: 'RUNNER', description: 'Runner accepts order from pool' },

  // AWAITING_PREFERRED_RUNNER → ASSIGNED  (preferred runner accepts)
  { from: 'AWAITING_PREFERRED_RUNNER', to: 'ASSIGNED', actor: 'RUNNER', description: 'Preferred runner accepts the order' },

  // AWAITING_PREFERRED_RUNNER → ASSIGNED  (admin assigns runner)
  {
    from: 'AWAITING_PREFERRED_RUNNER',
    to: 'ASSIGNED',
    actor: 'ADMIN',
    description: 'Admin assigns runner to order waiting for preferred runner',
  },

  // AWAITING_PREFERRED_RUNNER → AWAITING_RUNNER  (preferred runner declines, fallback)
  { from: 'AWAITING_PREFERRED_RUNNER', to: 'AWAITING_RUNNER', actor: 'SYSTEM', description: 'Preferred runner unavailable, order returns to general pool' },

  // AWAITING_PREFERRED_RUNNER → CANCELLED  (customer cancels while waiting for preferred runner)
  { from: 'AWAITING_PREFERRED_RUNNER', to: 'CANCELLED', actor: 'CUSTOMER', description: 'Customer cancels order while waiting for the preferred runner' },

  // ASSIGNED → IN_PROGRESS  (runner begins shopping)
  { from: 'ASSIGNED', to: 'IN_PROGRESS', actor: 'RUNNER', description: 'Runner starts shopping for order items' },

  // ASSIGNED → CANCELLED  (customer cancels while runner assigned)
  { from: 'ASSIGNED', to: 'CANCELLED', actor: 'CUSTOMER', description: 'Customer cancels order while runner is assigned' },

  // IN_PROGRESS → OUT_FOR_DELIVERY  (shopping complete, heading for delivery)
  { from: 'IN_PROGRESS', to: 'OUT_FOR_DELIVERY', actor: 'RUNNER', description: 'Runner completes shopping and departs for delivery' },

  // OUT_FOR_DELIVERY → DELIVERED  (delivery confirmed)
  { from: 'OUT_FOR_DELIVERY', to: 'DELIVERED', actor: 'RUNNER', description: 'Runner confirms delivery to customer' },

  // Admin cancellations from any non-cancelled state (Decision D39: Admin may cancel from any state including DELIVERED)
  { from: 'DRAFT', to: 'CANCELLED', actor: 'ADMIN', description: 'Admin cancels draft order' },
  { from: 'PENDING_REVIEW', to: 'CANCELLED', actor: 'ADMIN', description: 'Admin cancels order during pending review' },
  { from: 'ASSIGNED', to: 'CANCELLED', actor: 'ADMIN', description: 'Admin cancels order while assigned' },
  { from: 'IN_PROGRESS', to: 'CANCELLED', actor: 'ADMIN', description: 'Admin cancels order during shopping' },
  { from: 'OUT_FOR_DELIVERY', to: 'CANCELLED', actor: 'ADMIN', description: 'Admin cancels order during delivery' },
  { from: 'AWAITING_RUNNER', to: 'CANCELLED', actor: 'ADMIN', description: 'Admin cancels order while awaiting runner' },
  { from: 'AWAITING_PREFERRED_RUNNER', to: 'CANCELLED', actor: 'ADMIN', description: 'Admin cancels order while awaiting preferred runner' },
  { from: 'DELIVERED', to: 'CANCELLED', actor: 'ADMIN', description: 'Admin force cancels delivered order' },

  // Runner reassignment transitions
  { from: 'ASSIGNED', to: 'AWAITING_RUNNER', actor: 'ADMIN', description: 'Admin returns order to runner pool for reassignment' },
  { from: 'IN_PROGRESS', to: 'ASSIGNED', actor: 'ADMIN', description: 'Admin reverts order to assigned for reassignment' },
  { from: 'AWAITING_RUNNER', to: 'ASSIGNED', actor: 'ADMIN', description: 'Admin assigns runner from pool' },
  { from: 'ASSIGNED', to: 'AWAITING_PREFERRED_RUNNER', actor: 'ADMIN', description: 'Admin routes order to preferred runner queue' },
  { from: 'IN_PROGRESS', to: 'OUT_FOR_DELIVERY', actor: 'ADMIN', description: 'Admin confirms shopping complete' },
];

export const ORDER_STORE_TRANSITIONS: readonly OrderStoreTransition[] = [
  { from: 'PENDING', to: 'PURCHASED', actor: 'RUNNER', description: 'Runner confirms purchase at store' },
  { from: 'PENDING', to: 'SKIPPED', actor: 'RUNNER', description: 'Runner skips store (closed or item unavailable)' },
];

export { ORDER_STATUSES };
export { ORDER_STORE_STATUSES };

export const TERMINAL_ORDER_STATUSES: readonly OrderStatus[] = ['DELIVERED', 'CANCELLED'];
export const TERMINAL_ORDER_STORE_STATUSES: readonly OrderStoreStatus[] = ['PURCHASED', 'SKIPPED'];


