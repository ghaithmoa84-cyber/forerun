/**
 * HTTP Client Wrapper for FAWRUN Load Testing
 */
import crypto from 'crypto';
import { apiUrl } from '../config.js';

export class ApiClient {
  /**
   * General HTTP request with latency timing
   */
  static async rawRequest(path, options = {}) {
    const url = apiUrl(path);
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    const fetchOptions = {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    };

    const start = performance.now();
    try {
      const response = await fetch(url, fetchOptions);
      const durationMs = performance.now() - start;
      let data = null;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await response.json().catch(() => null);
      } else {
        data = await response.text().catch(() => null);
      }

      return {
        status: response.status,
        ok: response.ok,
        data,
        durationMs,
        headers: response.headers,
      };
    } catch (error) {
      const durationMs = performance.now() - start;
      return {
        status: 0,
        ok: false,
        data: null,
        error: error.message,
        durationMs,
      };
    }
  }

  // Auth Endpoints
  static mintToken(userId, role, status = 'VERIFIED') {
    const rawKey = process.env.JWT_PRIVATE_KEY;
    if (!rawKey) return null;
    const privateKey = rawKey.replace(/\\n/g, '\n');

    try {
      const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
      const now = Math.floor(Date.now() / 1000);
      const payload = Buffer.from(
        JSON.stringify({
          sub: userId,
          role,
          status,
          iat: now,
          exp: now + 7200,
        })
      ).toString('base64url');

      const data = `${header}.${payload}`;
      const sign = crypto.createSign('RSA-SHA256');
      sign.update(data);
      const signature = sign.sign(privateKey, 'base64url');
      return `${data}.${signature}`;
    } catch {
      return null;
    }
  }

  static async getAuthToken(user) {
    if (user.token) return user.token;

    // 1. Fast direct minting if JWT key is available
    const minted = this.mintToken(user.userId, user.role || 'CUSTOMER', user.status || 'VERIFIED');
    if (minted) {
      user.token = minted;
      return minted;
    }

    // 2. HTTP login fallback
    const res = await this.login(user.whatsapp, user.password);
    if (!res.ok || !res.token) {
      throw new Error(`Auth failed for ${user.whatsapp}: ${res.status} ${JSON.stringify(res.data)}`);
    }
    user.token = res.token;
    return res.token;
  }

  static async login(whatsapp, password) {
    const res = await this.rawRequest('/auth/login', {
      method: 'POST',
      body: { whatsapp, password },
    });
    return {
      token: res.data?.accessToken,
      refreshToken: res.data?.refreshToken,
      user: res.data?.user,
      ...res,
    };
  }

  static async register(dto) {
    return this.rawRequest('/auth/register', {
      method: 'POST',
      body: dto,
    });
  }

  // Customer Endpoints
  static async createOrder(token, items, options = {}) {
    return this.rawRequest('/customer/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: {
        items,
        notes: options.notes ?? 'Load test order',
        preferredRunnerId: options.preferredRunnerId ?? null,
        waitForPreferred: options.waitForPreferred ?? false,
        deliveryAddress: options.deliveryAddress ?? {
          lat: 33.5138,
          lng: 36.2765,
          description: 'Damascus Load Test Address',
        },
      },
    });
  }

  static async getCustomerOrders(token, page = 1, limit = 10) {
    return this.rawRequest(`/customer/orders?page=${page}&limit=${limit}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  static async getCustomerOrder(token, orderId) {
    return this.rawRequest(`/customer/orders/${orderId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  static async cancelOrderCustomer(token, orderId) {
    return this.rawRequest(`/customer/orders/${orderId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  // Admin Endpoints
  static async startReview(token, orderId) {
    return this.rawRequest(`/admin/orders/${orderId}/start-review`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  static async approveOrder(token, orderId, customFee = 0) {
    return this.rawRequest(`/admin/orders/${orderId}/approve`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: {
        isPeripheral: false,
        customFee,
      },
    });
  }

  static async assignRunner(token, orderId, runnerId) {
    return this.rawRequest(`/admin/orders/${orderId}/assign-runner`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: { runnerId },
    });
  }

  static async cancelOrderAdmin(token, orderId, cancelReason = 'Load test admin cancel') {
    return this.rawRequest(`/admin/orders/${orderId}/cancel`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: { cancelReason },
    });
  }

  static async verifyUser(token, userId) {
    return this.rawRequest(`/admin/users/${userId}/verify`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  static async createRunner(token, dto) {
    return this.rawRequest('/admin/runners', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: dto,
    });
  }

  static async getAdminLedger(token, orderId) {
    const query = orderId ? `?orderId=${orderId}` : '';
    return this.rawRequest(`/admin/ledger${query}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  // Runner Endpoints
  static async getActiveOrder(token) {
    return this.rawRequest('/runner/orders/active', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  static async getRunnerStores(token, orderId) {
    return this.rawRequest(`/runner/orders/${orderId}/stores`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  static async startOrder(token, orderId) {
    return this.rawRequest(`/runner/orders/${orderId}/start`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  static async purchaseStore(token, orderId, storeId) {
    return this.rawRequest(`/runner/orders/${orderId}/stores/${storeId}/purchase`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  static async deleteOrderStore(token, orderId, storeId) {
    return this.rawRequest(`/runner/orders/${orderId}/stores/${storeId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  static async proceedToDelivery(token, orderId) {
    return this.rawRequest(`/runner/orders/${orderId}/proceed-to-delivery`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  static async deliverOrder(token, orderId, idempotencyKey) {
    return this.rawRequest(`/runner/orders/${orderId}/deliver`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: { idempotencyKey },
    });
  }

  // Public Endpoints
  static async getActiveBanners() {
    return this.rawRequest('/banners/active', {
      method: 'GET',
    });
  }
}
