import test from 'node:test';
import assert from 'node:assert/strict';
import { AxiosError } from 'axios';
import {
  toUserMessage,
  isNetworkError,
  GENERIC_ERROR_MESSAGE,
  NETWORK_ERROR_MESSAGE,
} from './errorMessage.ts';

test('isNetworkError: accurately detects network errors', () => {
  const axiosNetworkErr = new AxiosError('Network Error', 'ERR_NETWORK');
  assert.strictEqual(isNetworkError(axiosNetworkErr), true);

  const axiosTimeoutErr = new AxiosError('timeout of 5000ms exceeded', 'ECONNABORTED');
  assert.strictEqual(isNetworkError(axiosTimeoutErr), true);

  const fetchErr = new Error('Failed to fetch');
  assert.strictEqual(isNetworkError(fetchErr), true);

  const abortErr = new Error('The user aborted a request');
  abortErr.name = 'AbortError';
  assert.strictEqual(isNetworkError(abortErr), true);

  const standardErr = new Error('Something broke in runtime');
  assert.strictEqual(isNetworkError(standardErr), false);

  const nullErr = null;
  assert.strictEqual(isNetworkError(nullErr), false);
});

test('toUserMessage: logs raw error to console.error and returns Arabic generic message', () => {
  const originalConsoleError = console.error;
  let loggedContext = '';
  let loggedErr: unknown = null;

  console.error = (context?: unknown, ...rest: unknown[]) => {
    loggedContext = String(context);
    loggedErr = rest[0];
  };

  try {
    const rawError = new Error('SyntaxError: Unexpected token < in JSON at position 0');
    const userMessage = toUserMessage(rawError);

    assert.strictEqual(loggedContext, '[API Error]');
    assert.strictEqual(loggedErr, rawError);
    assert.strictEqual(userMessage, GENERIC_ERROR_MESSAGE);
    assert.strictEqual(userMessage, 'حدث خطأ، حاول مرة أخرى');
    assert.strictEqual(userMessage.includes('SyntaxError'), false);
    assert.strictEqual(userMessage.includes('JSON'), false);
  } finally {
    console.error = originalConsoleError;
  }
});

test('toUserMessage: returns network-specific Arabic message for network failures', () => {
  const originalConsoleError = console.error;
  let logged = false;

  console.error = () => {
    logged = true;
  };

  try {
    const networkError = new AxiosError('Network Error', 'ERR_NETWORK');
    const userMessage = toUserMessage(networkError);

    assert.strictEqual(logged, true);
    assert.strictEqual(userMessage, NETWORK_ERROR_MESSAGE);
    assert.strictEqual(userMessage, 'تحقق من اتصالك بالإنترنت');
    assert.strictEqual(userMessage.includes('Network Error'), false);
  } finally {
    console.error = originalConsoleError;
  }
});

test('toUserMessage: supports custom fallback message when not network error', () => {
  const originalConsoleError = console.error;
  console.error = () => {};

  try {
    const customFallback = 'فشل تسجيل الدخول. يرجى التحقق من صحة البيانات.';
    const rawError = new Error('Invalid credentials technical message');
    const userMessage = toUserMessage(rawError, customFallback);

    assert.strictEqual(userMessage, customFallback);
  } finally {
    console.error = originalConsoleError;
  }
});

test('toUserMessage: preserves 403 login lockout message completely without truncation (BF-6)', () => {
  const originalConsoleError = console.error;
  console.error = () => {};

  try {
    const lockoutMsg = 'لقد تجاوزت الحد المسموح من محاولات تسجيل الدخول. يرجى التواصل مع إدارة فَوْراً عبر واتساب لإعادة تفعيل الدخول.';
    const lockoutErr = new AxiosError('Request failed with status code 403');
    lockoutErr.response = {
      data: { statusCode: 403, error: 'Forbidden', message: lockoutMsg },
      status: 403,
      statusText: 'Forbidden',
      headers: {},
      config: { headers: {} as any },
    };

    const result = toUserMessage(lockoutErr);
    assert.strictEqual(result, lockoutMsg);
  } finally {
    console.error = originalConsoleError;
  }
});
