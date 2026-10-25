import axios from 'axios';

export const GENERIC_ERROR_MESSAGE = 'حدث خطأ، حاول مرة أخرى';
export const NETWORK_ERROR_MESSAGE = 'تحقق من اتصالك بالإنترنت';

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

export function toUserMessage(err: unknown, fallbackMessage = GENERIC_ERROR_MESSAGE): string {
  console.error('[API Error]', err);

  if (isNetworkError(err)) {
    return NETWORK_ERROR_MESSAGE;
  }

  return fallbackMessage;
}
