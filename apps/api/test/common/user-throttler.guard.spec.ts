import { describe, it, expect } from 'vitest';
import { normalizeSyrianPhone } from '../../src/common/guards/user-throttler.guard.js';

describe('normalizeSyrianPhone (D66)', () => {
  it('preserves standard local format 09XXXXXXXX', () => {
    expect(normalizeSyrianPhone('0912345678')).toBe('0912345678');
  });

  it('normalizes international format with + prefix (+9639XXXXXXXX -> 09XXXXXXXX)', () => {
    expect(normalizeSyrianPhone('+963912345678')).toBe('0912345678');
  });

  it('normalizes international format with 00 prefix (009639XXXXXXXX -> 09XXXXXXXX)', () => {
    expect(normalizeSyrianPhone('00963912345678')).toBe('0912345678');
  });

  it('normalizes international format without prefix (9639XXXXXXXX -> 09XXXXXXXX)', () => {
    expect(normalizeSyrianPhone('963912345678')).toBe('0912345678');
  });

  it('strips whitespace, dashes, parentheses, and dots', () => {
    expect(normalizeSyrianPhone(' 09 1234 5678 ')).toBe('0912345678');
    expect(normalizeSyrianPhone('09-1234-5678')).toBe('0912345678');
    expect(normalizeSyrianPhone('(09) 12345678')).toBe('0912345678');
    expect(normalizeSyrianPhone('+963 9 1234 5678')).toBe('0912345678');
    expect(normalizeSyrianPhone('+963-9.1234.5678')).toBe('0912345678');
  });

  it('safely handles non-string, empty, null, and undefined values', () => {
    expect(normalizeSyrianPhone('')).toBe('');
    expect(normalizeSyrianPhone('   ')).toBe('');
    expect(normalizeSyrianPhone(null)).toBe('');
    expect(normalizeSyrianPhone(undefined)).toBe('');
    expect(normalizeSyrianPhone(12345)).toBe('');
    expect(normalizeSyrianPhone({})).toBe('');
  });
});
