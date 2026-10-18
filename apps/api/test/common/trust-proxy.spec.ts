import { describe, it, expect } from 'vitest';
import { ExpressAdapter } from '@nestjs/platform-express';
import { resolveTrustProxySetting } from '../../src/common/utils/trust-proxy.util.js';

describe('TRUST_PROXY resolution and Express IP extraction', () => {
  describe('resolveTrustProxySetting', () => {
    it('should parse numeric string "1" to number 1', () => {
      const result = resolveTrustProxySetting('1');
      expect(result).toBe(1);
      expect(typeof result).toBe('number');
    });

    it('should parse numeric string "2" to number 2', () => {
      const result = resolveTrustProxySetting('2');
      expect(result).toBe(2);
      expect(typeof result).toBe('number');
    });

    it('should preserve IP string or subnet when non-numeric', () => {
      expect(resolveTrustProxySetting('127.0.0.1')).toBe('127.0.0.1');
      expect(resolveTrustProxySetting('10.0.0.0/8')).toBe('10.0.0.0/8');
      expect(resolveTrustProxySetting('loopback')).toBe('loopback');
    });

    it('should return false when "false", empty, or undefined', () => {
      expect(resolveTrustProxySetting('false')).toBe(false);
      expect(resolveTrustProxySetting('')).toBe(false);
      expect(resolveTrustProxySetting(undefined)).toBe(false);
    });
  });

  describe('Express req.ip extraction proof with TRUST_PROXY="1"', () => {
    it('correctly resolves client IP from X-Forwarded-For when parsed to number 1', () => {
      const adapter = new ExpressAdapter();
      const app = adapter.getInstance();

      const rawSetting = '1'; // Simulating process.env.TRUST_PROXY = '1'
      const resolvedSetting = resolveTrustProxySetting(rawSetting);
      app.set('trust proxy', resolvedSetting);

      // Create a mock request object attached to the Express app prototype
      const req = {
        headers: { 'x-forwarded-for': '203.0.113.195' },
        socket: { remoteAddress: '10.0.0.1' }, // Internal proxy address (e.g. Railway)
        app,
      };
      Object.setPrototypeOf(req, app.request);

      const clientIp = (req as unknown as { ip: string }).ip;
      expect(clientIp).toBe('203.0.113.195');
    });

    it('demonstrates that unparsed string "1" fails to trust proxy hop and leaks proxy IP', () => {
      const adapter = new ExpressAdapter();
      const app = adapter.getInstance();

      // Flawed legacy behavior: string "1" passed directly
      app.set('trust proxy', '1');

      const req = {
        headers: { 'x-forwarded-for': '203.0.113.195' },
        socket: { remoteAddress: '10.0.0.1' },
        app,
      };
      Object.setPrototypeOf(req, app.request);

      const clientIp = (req as unknown as { ip: string }).ip;
      // Express treats string "1" as an IP address to match, fails, and returns remote socket address
      expect(clientIp).toBe('10.0.0.1');
    });
  });
});
