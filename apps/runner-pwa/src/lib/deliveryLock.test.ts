import test from 'node:test';
import assert from 'node:assert/strict';
import { AxiosError, type AxiosResponse } from 'axios';
import {
  isDeliveryRequestSuccessful,
  executeDeliverOrder,
  type DeliverOrderContext,
} from './deliveryLock.ts';
import { NETWORK_ERROR_MESSAGE } from './errorMessage.ts';

test('isDeliveryRequestSuccessful: correctly distinguishes server delivery success vs network/request failure', () => {
  // Case 1: Delivery request completed successfully (2xx)
  assert.strictEqual(isDeliveryRequestSuccessful(true, null), true);

  // Case 2: Network failure during delivery request
  const networkError = new AxiosError('Network Error', 'ERR_NETWORK');
  assert.strictEqual(isDeliveryRequestSuccessful(false, networkError), false);

  // Case 3: Connection timeout during delivery request
  const timeoutError = new AxiosError('Timeout', 'ECONNABORTED');
  assert.strictEqual(isDeliveryRequestSuccessful(false, timeoutError), false);

  // Case 4: Server explicitly rejected request with 4xx / 5xx
  const badRequestError = new AxiosError('Bad Request', 'ERR_BAD_REQUEST', undefined, undefined, {
    status: 400,
    data: { message: 'Order is not ready for delivery' },
  } as AxiosResponse);
  assert.strictEqual(isDeliveryRequestSuccessful(false, badRequestError), false);

  const serverError = new AxiosError('Internal Server Error', 'ERR_BAD_RESPONSE', undefined, undefined, {
    status: 500,
    data: { message: 'DB Error' },
  } as AxiosResponse);
  assert.strictEqual(isDeliveryRequestSuccessful(false, serverError), false);

  // Case 5: Server returned 200 OK, but client threw error during response processing
  const responseParsingError = new AxiosError('Transform error', undefined, undefined, undefined, {
    status: 200,
    data: null,
  } as AxiosResponse);
  assert.strictEqual(isDeliveryRequestSuccessful(false, responseParsingError), true);
});

test('executeDeliverOrder: releases idempotency lock on network failure and allows immediate retry without page reload', async () => {
  const orderId = 'order-field-test-123';
  const deliveryIdempotencyKeyRef = { current: null as string | null };
  const deliveredOrderRef = { current: null as string | null };
  let actionLoading = false;
  let actionError: string | null = null;
  let deliverCalls = 0;
  let lastReceivedKey: string | null = null;
  let shouldSimulateNetworkFailure = true;
  let fetchActiveOrderCalled = false;

  const context: DeliverOrderContext = {
    orderId,
    deliveryIdempotencyKeyRef,
    deliveredOrderRef,
    deliverFn: async (idempotencyKey: string) => {
      deliverCalls++;
      lastReceivedKey = idempotencyKey;
      if (shouldSimulateNetworkFailure) {
        throw new AxiosError('Network Error', 'ERR_NETWORK');
      }
      return { success: true };
    },
    onSuccess: async () => {
      fetchActiveOrderCalled = true;
    },
    setActionLoading: (loading: boolean) => {
      actionLoading = loading;
    },
    setActionError: (error: string | null) => {
      actionError = error;
    },
  };

  // --- ATTEMPT 1: Delivery fails due to network disconnection ---
  const firstAttemptResult = await executeDeliverOrder(context);

  // Assertions for failed attempt:
  assert.strictEqual(firstAttemptResult, false, 'First attempt must return false on network failure');
  assert.strictEqual(deliverCalls, 1, 'API deliverFn was called once');
  assert.strictEqual(actionLoading, false, 'Action loading spinner is cleared');
  assert.strictEqual(actionError, NETWORK_ERROR_MESSAGE, 'User receives Arabic network error message');
  assert.strictEqual(fetchActiveOrderCalled, false, 'onSuccess not called on failure');

  // CRITICAL CHECK: Lock MUST be released (null) so the runner can retry immediately!
  assert.strictEqual(
    deliveryIdempotencyKeyRef.current,
    null,
    'deliveryIdempotencyKeyRef.current MUST be reset to null upon network failure',
  );

  // --- ATTEMPT 2: Immediate retry without reloading page (simulating runner tapping button again) ---
  shouldSimulateNetworkFailure = false; // Network restored
  const secondAttemptResult = await executeDeliverOrder(context);

  // Assertions for successful retry:
  assert.strictEqual(secondAttemptResult, true, 'Immediate retry must succeed without reload');
  assert.strictEqual(deliverCalls, 2, 'API deliverFn was called a second time');
  assert.strictEqual(actionLoading, false, 'Action loading spinner is cleared');
  assert.strictEqual(actionError, null, 'Action error is cleared on success');
  assert.strictEqual(fetchActiveOrderCalled, true, 'fetchActiveOrder called on successful delivery');
  assert.notStrictEqual(lastReceivedKey, null, 'Valid idempotencyKey was generated and sent');

  // CRITICAL CHECK: Lock MUST be preserved after successful delivery to prevent duplicate submissions
  assert.notStrictEqual(
    deliveryIdempotencyKeyRef.current,
    null,
    'deliveryIdempotencyKeyRef.current MUST remain set after successful delivery',
  );
  assert.strictEqual(
    deliveryIdempotencyKeyRef.current,
    lastReceivedKey,
    'Locked key matches the successful idempotency key',
  );

  // --- ATTEMPT 3: Subsequent accidental tap after delivery is locked ---
  const thirdAttemptResult = await executeDeliverOrder(context);

  assert.strictEqual(thirdAttemptResult, false, 'Duplicate delivery tap must be blocked');
  assert.strictEqual(deliverCalls, 2, 'deliverFn must NOT be called again');
  assert.strictEqual(
    actionError,
    '⏳ جارٍ تسجيل التسليم، يرجى الانتظار...',
    'Runner is informed that delivery is already registered/in-progress',
  );
});

test('executeDeliverOrder: preserves lock if server accepted delivery (2xx) but subsequent fetchActiveOrder fails', async () => {
  const orderId = 'order-server-success-test-456';
  const deliveryIdempotencyKeyRef = { current: null as string | null };
  const deliveredOrderRef = { current: null as string | null };
  let deliverCalls = 0;
  let actionError: string | null = null;

  const context: DeliverOrderContext = {
    orderId,
    deliveryIdempotencyKeyRef,
    deliveredOrderRef,
    deliverFn: async () => {
      deliverCalls++;
      // Delivery API call completes successfully on server
      return { success: true };
    },
    onSuccess: async () => {
      // Simulate network blip immediately after server delivery completion
      throw new AxiosError('Network Error during refresh', 'ERR_NETWORK');
    },
    setActionLoading: () => {},
    setActionError: (error) => {
      actionError = error;
    },
  };

  const result = await executeDeliverOrder(context);

  assert.strictEqual(result, false, 'Returns false because refresh threw an error');
  assert.strictEqual(deliverCalls, 1, 'Deliver call was completed on server');
  assert.strictEqual(actionError, NETWORK_ERROR_MESSAGE, 'Displays error message to user');

  // CRITICAL DISTINCTION: Because delivery succeeded on the server, the lock MUST NOT be cleared
  assert.notStrictEqual(
    deliveryIdempotencyKeyRef.current,
    null,
    'Lock MUST be preserved when server already processed the delivery',
  );
});
