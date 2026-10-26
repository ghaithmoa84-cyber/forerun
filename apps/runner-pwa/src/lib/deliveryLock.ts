import axios from 'axios';
import { toUserMessage } from './errorMessage.ts';

export interface DeliverOrderContext {
  orderId: string;
  deliveryIdempotencyKeyRef: { current: string | null };
  deliveredOrderRef: { current: string | null };
  deliverFn: (idempotencyKey: string) => Promise<unknown>;
  onSuccess: () => Promise<void>;
  setActionLoading: (loading: boolean) => void;
  setActionError: (error: string | null) => void;
}

/**
 * Determines whether the delivery request itself succeeded on the server.
 * Returns true if:
 * 1. The delivery API call successfully completed (deliveryRequestSucceeded is true).
 * 2. Or if an error was caught but the server responded with 2xx (e.g. response payload reading/parsing error).
 * Returns false if the request failed to reach the server, timed out, or returned an error status (4xx/5xx).
 */
export function isDeliveryRequestSuccessful(
  deliveryRequestSucceeded: boolean,
  err: unknown,
): boolean {
  if (deliveryRequestSucceeded) {
    return true;
  }
  if (
    axios.isAxiosError(err) &&
    err.response &&
    typeof err.response.status === 'number' &&
    err.response.status >= 200 &&
    err.response.status < 300
  ) {
    return true;
  }
  return false;
}

/**
 * Executes order delivery with strict idempotency and lifecycle-safe retry behavior:
 * - If delivery is already in-flight for this order, blocks duplicate submission.
 * - If the delivery request fails (network error, timeout, server 4xx/5xx rejection),
 *   releases deliveryIdempotencyKeyRef.current to null so the runner can immediately retry
 *   without requiring a full page refresh.
 * - If the delivery request succeeds on the server (2xx) but subsequent client operations
 *   fail (e.g. order re-fetch or response read failure), preserves the lock to avoid duplicate deliveries.
 */
export async function executeDeliverOrder(
  ctx: DeliverOrderContext,
): Promise<boolean> {
  ctx.setActionLoading(true);
  ctx.setActionError(null);
  let deliveryRequestSucceeded = false;
  try {
    if (
      ctx.deliveryIdempotencyKeyRef.current &&
      ctx.deliveredOrderRef.current === ctx.orderId
    ) {
      ctx.setActionError('⏳ جارٍ تسجيل التسليم، يرجى الانتظار...');
      return false;
    }
    if (ctx.deliveredOrderRef.current !== ctx.orderId) {
      ctx.deliveryIdempotencyKeyRef.current = crypto.randomUUID();
      ctx.deliveredOrderRef.current = ctx.orderId;
    }
    const idempotencyKey =
      ctx.deliveryIdempotencyKeyRef.current ?? crypto.randomUUID();
    ctx.deliveryIdempotencyKeyRef.current = idempotencyKey;

    await ctx.deliverFn(idempotencyKey);
    deliveryRequestSucceeded = true;
    await ctx.onSuccess();
    return true;
  } catch (err) {
    const requestSucceededOnServer = isDeliveryRequestSuccessful(
      deliveryRequestSucceeded,
      err,
    );

    if (!requestSucceededOnServer) {
      // فشل طلب التسليم نفسه (انقطاع شبكة أو رفض الخادم للطلب): نحرر القفل للسماح بإعادة المحاولة فوراً
      ctx.deliveryIdempotencyKeyRef.current = null;
    }
    // إذا نجح الطلب في الخادم ولكن فشلت قراءة الرد أو استدعاء التحديث اللاحق،
    // نُبقي القفل مفعّلاً لمنع إرسال طلب تسليم مكرر.

    if (axios.isAxiosError(err) && err.response?.data?.message) {
      const msg = err.response.data.message;
      ctx.setActionError(Array.isArray(msg) ? msg.join(' - ') : msg);
    } else if (err instanceof Error) {
      ctx.setActionError(toUserMessage(err));
    } else {
      ctx.setActionError('فشل تسجيل تسليم الطلب');
    }
    return false;
  } finally {
    ctx.setActionLoading(false);
  }
}
