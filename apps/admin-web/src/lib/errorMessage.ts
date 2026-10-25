import axios from 'axios';

export const GENERIC_ERROR_MESSAGE = 'حدث خطأ، يرجى المحاولة مرة أخرى';
export const NETWORK_ERROR_MESSAGE = 'تعذر الاتصال بالخادم، يرجى التحقق من اتصالك بالإنترنت';

const ARABIC_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;

/**
 * Checks whether a text contains at least one Arabic character.
 */
export function containsArabic(text: string): boolean {
  return ARABIC_REGEX.test(text);
}

/**
 * Determines whether the given error represents an offline or network-connectivity failure.
 */
export function isNetworkError(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return true;
  }

  if (axios.isAxiosError(err)) {
    if (err.code === 'ERR_NETWORK' || err.code === 'ECONNABORTED') {
      return true;
    }
    if (err.message && err.message.toLowerCase().includes('network error')) {
      return true;
    }
    if (Boolean(err.request) && !err.response) {
      return true;
    }
  }

  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (
      msg.includes('network error') ||
      msg.includes('networkerror') ||
      msg.includes('failed to fetch') ||
      err.name === 'AbortError'
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Extracts a candidate error message from an error object or response.
 */
export function extractErrorMessage(err: unknown): string | null {
  if (!err) return null;

  if (axios.isAxiosError(err)) {
    const data = err.response?.data;
    if (data && typeof data === 'object') {
      const res = data as { message?: unknown; error?: unknown };
      if (Array.isArray(res.message)) {
        const joined = res.message
          .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
          .join('، ');
        if (joined) return joined;
      } else if (typeof res.message === 'string' && res.message.trim().length > 0) {
        return res.message.trim();
      } else if (typeof res.error === 'string' && res.error.trim().length > 0) {
        return res.error.trim();
      }
    } else if (typeof data === 'string' && data.trim().length > 0) {
      return data.trim();
    }
  }

  if (typeof err === 'object' && err !== null && 'message' in err) {
    const msg = (err as { message: unknown }).message;
    if (Array.isArray(msg)) {
      const joined = msg
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .join('، ');
      if (joined) return joined;
    } else if (typeof msg === 'string' && msg.trim().length > 0) {
      return msg.trim();
    }
  }

  if (typeof err === 'string' && err.trim().length > 0) {
    return err.trim();
  }

  return null;
}

/**
 * Central admin error-to-message converter:
 * 1. Always logs the raw error to console.error for internal debugging/telemetry.
 * 2. If it is a network connectivity failure, returns the Arabic network error message.
 * 3. If a backend error message exists and contains Arabic characters, returns it directly
 *    (preserving localized backend validation or business rule explanations).
 * 4. If missing, English, or technical raw error, safely returns the Arabic fallback message.
 */
export function toAdminErrorMessage(
  err: unknown,
  fallbackMessage: string = GENERIC_ERROR_MESSAGE,
): string {
  console.error('[Admin API Error]', err);

  if (isNetworkError(err)) {
    return NETWORK_ERROR_MESSAGE;
  }

  const rawMsg = extractErrorMessage(err);
  if (rawMsg && containsArabic(rawMsg)) {
    return rawMsg;
  }

  return fallbackMessage;
}
