/**
 * FAWRUN Load Testing Suite - Global Configuration
 * 
 * Target URL is configurable via TARGET_URL or API_BASE_URL environment variable.
 * Default: http://localhost:3000
 */
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env from apps/api/.env natively (Node 20+) if present
const apiEnvPath = join(__dirname, '../../apps/api/.env');
if (fs.existsSync(apiEnvPath) && typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile(apiEnvPath);
  } catch {
    // Ignore if already loaded or unreadable
  }
}

export const CONFIG = {
  // Target API server (overridable via env var for Railway)
  TARGET_URL: (process.env.TARGET_URL || process.env.API_BASE_URL || 'http://localhost:3000').replace(/\/+$/, ''),

  // Database connection (available in local environment)
  DATABASE_URL: process.env.DATABASE_URL,

  // Default credentials for test admin
  ADMIN_WHATSAPP: process.env.LOAD_TEST_ADMIN_WHATSAPP || process.env.ADMIN_WHATSAPP || '0999000001',
  ADMIN_PASSWORD: process.env.LOAD_TEST_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || 'Admin@12345',

  // Standard password for test users
  TEST_PASSWORD: process.env.LOAD_TEST_USER_PASSWORD || 'TestUser@12345',

  // Fixtures cache path
  FIXTURES_PATH: join(__dirname, '.fixtures.json'),
};

/**
 * Constructs a fully qualified API URL under /api/v1
 * @param {string} path - Endpoint path, e.g. '/customer/orders' or 'banners/active'
 * @returns {string}
 */
export function apiUrl(path) {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (cleanPath.startsWith('/api/v1')) {
    return `${CONFIG.TARGET_URL}${cleanPath}`;
  }
  return `${CONFIG.TARGET_URL}/api/v1${cleanPath}`;
}
