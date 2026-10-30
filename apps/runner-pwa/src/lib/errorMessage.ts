import axios from 'axios';

export const GENERIC_ERROR_MESSAGE = 'حدث خطأ، حاول مرة أخرى';
export const NETWORK_ERROR_MESSAGE = 'تحقق من اتصالك بالإنترنت';

const ARABIC_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;

/**
 * Checks whether a text contains at least one Arabic character.
 */
export function containsArabic(text: string): boolean {
  return ARABIC_REGEX.test(text);
}

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
 * Extracts candidate error message from response or Error object.
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
          .join(' - ');
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
        .join(' - ');
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

export function toUserMessage(err: unknown, fallbackMessage = GENERIC_ERROR_MESSAGE): string {
  console.error('[API Error]', err);

  if (isNetworkError(err)) {
    return NETWORK_ERROR_MESSAGE;
  }

  const rawMsg = extractErrorMessage(err);
  if (rawMsg && containsArabic(rawMsg)) {
    return rawMsg;
  }

  return fallbackMessage;
}
