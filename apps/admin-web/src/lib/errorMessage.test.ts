import test from 'node:test';
import assert from 'node:assert/strict';
import { AxiosError, AxiosHeaders } from 'axios';
import {
  toAdminErrorMessage,
  containsArabic,
  isNetworkError,
  extractErrorMessage,
  GENERIC_ERROR_MESSAGE,
  NETWORK_ERROR_MESSAGE,
} from './errorMessage.ts';

test('containsArabic: accurately identifies strings with Arabic characters', () => {
  assert.strictEqual(containsArabic(''), false);
  assert.strictEqual(containsArabic('Internal server error'), false);
  assert.strictEqual(containsArabic('Validation failed: invalid password'), false);
  assert.strictEqual(containsArabic('500'), false);
  assert.strictEqual(containsArabic('بيانات الاعتماد غير صحيحة'), true);
  assert.strictEqual(containsArabic('الرسم الإضافي (500) يتجاوز الحد الأقصى'), true);
  assert.strictEqual(containsArabic('معرف الشريحة id_123 غير موجود'), true);
});

test('isNetworkError: accurately detects network and offline failures', () => {
  const axiosNetworkErr = new AxiosError('Network Error', 'ERR_NETWORK');
  assert.strictEqual(isNetworkError(axiosNetworkErr), true);

  const axiosTimeoutErr = new AxiosError('timeout of 5000ms exceeded', 'ECONNABORTED');
  assert.strictEqual(isNetworkError(axiosTimeoutErr), true);

  const fetchErr = new Error('Failed to fetch');
  assert.strictEqual(isNetworkError(fetchErr), true);

  const abortErr = new Error('The user aborted a request');
  abortErr.name = 'AbortError';
  assert.strictEqual(isNetworkError(abortErr), true);

  const standardErr = new Error('Business error');
  assert.strictEqual(isNetworkError(standardErr), false);

  assert.strictEqual(isNetworkError(null), false);
});

test('extractErrorMessage: extracts messages from various shapes', () => {
  // AxiosError with string message
  const err1 = new AxiosError('Request failed with status code 400');
  err1.response = {
    data: { message: 'الرسم الأساسي غير صالح' },
    status: 400,
    statusText: 'Bad Request',
    headers: {},
    config: { headers: new AxiosHeaders() },
  };
  assert.strictEqual(extractErrorMessage(err1), 'الرسم الأساسي غير صالح');

  // AxiosError with array of messages
  const err2 = new AxiosError('Request failed with status code 400');
  err2.response = {
    data: { message: ['الاسم مطلوب', 'رقم الهاتف قصير جدًا'] },
    status: 400,
    statusText: 'Bad Request',
    headers: {},
    config: { headers: new AxiosHeaders() },
  };
  assert.strictEqual(extractErrorMessage(err2), 'الاسم مطلوب، رقم الهاتف قصير جدًا');

  // Plain Error
  const err3 = new Error('خطأ محلي مباشر');
  assert.strictEqual(extractErrorMessage(err3), 'خطأ محلي مباشر');

  // String error
  assert.strictEqual(extractErrorMessage('نص خطأ مباشر'), 'نص خطأ مباشر');

  // Null
  assert.strictEqual(extractErrorMessage(null), null);
});

test('toAdminErrorMessage: preserves Arabic localized messages from backend', () => {
  const originalConsoleError = console.error;
  let loggedContext = '';
  let loggedErr: unknown = null;

  console.error = (context?: unknown, ...rest: unknown[]) => {
    loggedContext = String(context);
    loggedErr = rest[0];
  };

  try {
    const arabicBackendErr = new AxiosError('Request failed with status code 400');
    arabicBackendErr.response = {
      data: { message: 'الرسم الأساسي يجب أن يكون عدداً صحيحاً بين 500 و 50000' },
      status: 400,
      statusText: 'Bad Request',
      headers: {},
      config: { headers: new AxiosHeaders() },
    };

    const result = toAdminErrorMessage(arabicBackendErr, 'فشل في حفظ الأسعار');

    assert.strictEqual(loggedContext, '[Admin API Error]');
    assert.strictEqual(loggedErr, arabicBackendErr);
    // Preserved Arabic message because it's valuable to the admin
    assert.strictEqual(result, 'الرسم الأساسي يجب أن يكون عدداً صحيحاً بين 500 و 50000');
  } finally {
    console.error = originalConsoleError;
  }
});

test('toAdminErrorMessage: replaces English technical / 500 backend messages with fallback', () => {
  const originalConsoleError = console.error;
  console.error = () => {};

  try {
    const englishBackendErr = new AxiosError('Request failed with status code 500');
    englishBackendErr.response = {
      data: { message: 'Internal server error' },
      status: 500,
      statusText: 'Internal Server Error',
      headers: {},
      config: { headers: new AxiosHeaders() },
    };

    const result = toAdminErrorMessage(englishBackendErr, 'فشل في تحميل التسويات');

    // Replaced English "Internal server error" with the Arabic fallback
    assert.strictEqual(result, 'فشل في تحميل التسويات');
    assert.strictEqual(result.includes('Internal server error'), false);
  } finally {
    console.error = originalConsoleError;
  }
});

test('toAdminErrorMessage: replaces missing backend message with fallback or default generic', () => {
  const originalConsoleError = console.error;
  console.error = () => {};

  try {
    const emptyErr = new AxiosError('Request failed');
    emptyErr.response = {
      data: {},
      status: 502,
      statusText: 'Bad Gateway',
      headers: {},
      config: { headers: new AxiosHeaders() },
    };

    const withCustomFallback = toAdminErrorMessage(emptyErr, 'فشل في تحديث بيانات الإحصائيات');
    assert.strictEqual(withCustomFallback, 'فشل في تحديث بيانات الإحصائيات');

    const withDefaultFallback = toAdminErrorMessage(emptyErr);
    assert.strictEqual(withDefaultFallback, GENERIC_ERROR_MESSAGE);
    assert.strictEqual(withDefaultFallback, 'حدث خطأ، يرجى المحاولة مرة أخرى');
  } finally {
    console.error = originalConsoleError;
  }
});

test('toAdminErrorMessage: returns network message for network errors', () => {
  const originalConsoleError = console.error;
  console.error = () => {};

  try {
    const networkErr = new AxiosError('Network Error', 'ERR_NETWORK');
    const result = toAdminErrorMessage(networkErr, 'فشل في إضافة المندوب');

    assert.strictEqual(result, NETWORK_ERROR_MESSAGE);
    assert.strictEqual(result, 'تعذر الاتصال بالخادم، يرجى التحقق من اتصالك بالإنترنت');
  } finally {
    console.error = originalConsoleError;
  }
});

test('toAdminErrorMessage: preserves 403 login lockout message completely without truncation (BF-6)', () => {
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
      config: { headers: new AxiosHeaders() },
    };

    const result = toAdminErrorMessage(lockoutErr);
    assert.strictEqual(result, lockoutMsg);
  } finally {
    console.error = originalConsoleError;
  }
});
