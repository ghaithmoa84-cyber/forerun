import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useWebSocket } from '../hooks/useWebSocket';
import { MapView } from '../components/MapView';
import { StoreCard } from '../components/StoreCard';
import type { OrderStatus } from '@forerun/shared-constants';
import type {
  ActiveOrderResponse,
  CreateOrderStoreRequest,
  DeliverOrderRequest,
} from '@forerun/shared-types';
import axios from 'axios';

const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  DRAFT: 'مسودة',
  PENDING_REVIEW: 'بانتظار المراجعة',
  UNDER_REVIEW: 'قيد المراجعة',
  AWAITING_RUNNER: 'بانتظار مندوب',
  AWAITING_PREFERRED_RUNNER: 'بانتظار المندوب المفضل',
  ASSIGNED: 'تم التعيين لك',
  IN_PROGRESS: 'قيد التنفيذ (الشراء)',
  OUT_FOR_DELIVERY: 'في الطريق للتسليم',
  DELIVERED: 'تم التسليم بنجاح',
  CANCELLED: 'ملغي',
};

const ORDER_STATUS_BADGE: Record<OrderStatus, string> = {
  DRAFT: 'status-pending',
  PENDING_REVIEW: 'status-pending',
  UNDER_REVIEW: 'status-pending',
  AWAITING_RUNNER: 'status-pending',
  AWAITING_PREFERRED_RUNNER: 'status-pending',
  ASSIGNED: 'status-available',
  IN_PROGRESS: 'status-on-mission',
  OUT_FOR_DELIVERY: 'status-on-mission',
  DELIVERED: 'status-delivered',
  CANCELLED: 'status-unavailable',
};

export function ActiveOrderPage() {
  const navigate = useNavigate();
  const [order, setOrder] = useState<ActiveOrderResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const deliveryIdempotencyKeyRef = useRef<string | null>(null);
  const deliveredOrderRef = useRef<string | null>(null);

  // Add store state
  const [showAddStore, setShowAddStore] = useState(false);
  const [storeName, setStoreName] = useState('');

  const fetchActiveOrder = useCallback(async () => {
    setIsLoading(true);
    setActionError(null);
    try {
      const response = await api.get<ActiveOrderResponse | null>(
        '/runner/orders/active',
      );
      setOrder(response.data ?? null);
    } catch {
      setOrder(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const { on } = useWebSocket();

  useEffect(() => {
    void fetchActiveOrder();
  }, [fetchActiveOrder]);

  // WebSocket listeners
  useEffect(() => {
    const cleanups = [
      on('order:status_changed', () => {
        void fetchActiveOrder();
      }),
      on('order:fee_updated', () => {
        void fetchActiveOrder();
      }),
      on('order:store_purchased', () => {
        void fetchActiveOrder();
      }),
      on('order:delivered', () => {
        void fetchActiveOrder();
      }),
      on('order:reassigned', () => {
        void fetchActiveOrder();
      }),
      on('order:assignment_cancelled', () => {
        setOrder(null);
        navigate('/available', {
          replace: true,
          state: { notification: 'تم إلغاء تعيين الطلب' },
        });
      }),
    ];
    return () => {
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [on, fetchActiveOrder, navigate]);

  // Phase 1: ASSIGNED -> start order
  const handleStartOrder = async () => {
    if (!order) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await api.put(`/runner/orders/${order.id}/start`);
      await fetchActiveOrder();
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        const msg = err.response.data.message;
        setActionError(Array.isArray(msg) ? msg.join(' - ') : msg);
      } else if (err instanceof Error) {
        setActionError(err.message);
      } else {
        setActionError('فشل بدء تنفيذ الطلب');
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Phase 2: Add Store
  const handleAddStore = async () => {
    if (!order || !storeName.trim()) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const body: CreateOrderStoreRequest = {
        storeName: storeName.trim(),
      };
      await api.post(`/runner/orders/${order.id}/stores`, body);
      setStoreName('');
      setShowAddStore(false);
      await fetchActiveOrder();
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        const msg = err.response.data.message;
        setActionError(Array.isArray(msg) ? msg.join(' - ') : msg);
      } else if (err instanceof Error) {
        setActionError(err.message);
      } else {
        setActionError('فشل إضافة المتجر');
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Phase 2: Proceed to Delivery
  const handleProceedToDelivery = async () => {
    if (!order) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await api.put(`/runner/orders/${order.id}/proceed-to-delivery`);
      await fetchActiveOrder();
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        const msg = err.response.data.message;
        setActionError(Array.isArray(msg) ? msg.join(' - ') : msg);
      } else if (err instanceof Error) {
        setActionError(err.message);
      } else {
        setActionError('فشل الانتقال للتوصيل. تأكد من شراء أو تخطي جميع المتاجر.');
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Phase 3: OUT_FOR_DELIVERY -> deliver order
  const handleDeliver = async () => {
    if (!order) return;
    setActionLoading(true);
    setActionError(null);
    try {
      if (
        deliveryIdempotencyKeyRef.current &&
        deliveredOrderRef.current === order.id
      ) {
        setActionError('⏳ جارٍ تسجيل التسليم، يرجى الانتظار...');
        return;
      }
      if (deliveredOrderRef.current !== order.id) {
        deliveryIdempotencyKeyRef.current = crypto.randomUUID();
        deliveredOrderRef.current = order.id;
      }
      const idempotencyKey = deliveryIdempotencyKeyRef.current ?? crypto.randomUUID();
      deliveryIdempotencyKeyRef.current = idempotencyKey;
      const body: DeliverOrderRequest = { idempotencyKey };
      await api.put(`/runner/orders/${order.id}/deliver`, body);
      await fetchActiveOrder();
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        const msg = err.response.data.message;
        setActionError(Array.isArray(msg) ? msg.join(' - ') : msg);
      } else if (err instanceof Error) {
        setActionError(err.message);
      } else {
        setActionError('فشل تسجيل تسليم الطلب');
      }
    } finally {
      setActionLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container" style={{ paddingTop: '32px' }}>
        <div className="card text-center">
          <div className="spinner" style={{ margin: '16px auto' }} />
          <p>جارٍ تحميل تفاصيل الطلب النشط...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container" style={{ paddingTop: '32px' }}>
        <div className="card text-center">
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📦</div>
          <h2>لا يوجد طلب نشط حالياً</h2>
          <p style={{ color: 'var(--text)', marginTop: '8px' }}>
            يمكنك تفعيل التوافر لاستقبال طلبات جديدة من العملاء.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            style={{ marginTop: '20px' }}
            onClick={() => navigate('/available')}
          >
            الذهاب لشاشة التوافر
          </button>
        </div>
      </div>
    );
  }

  const orderStatus = order.status as OrderStatus;
  const isAssigned = orderStatus === 'ASSIGNED';
  const isInProgress = orderStatus === 'IN_PROGRESS';
  const isOutForDelivery = orderStatus === 'OUT_FOR_DELIVERY';
  const isDelivered = orderStatus === 'DELIVERED';

  const allStoresHandled =
    order.orderStores.length > 0 &&
    order.orderStores.every(
      (s) => s.status === 'PURCHASED' || s.status === 'SKIPPED',
    );

  return (
    <div className="container active-order-container" style={{ paddingTop: '20px' }}>
      {/* Header Info */}
      <div className="card order-header-card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <span className="order-number-badge">#{order.orderNumber}</span>
            <h2 style={{ marginTop: '4px' }}>طلب التوصيل</h2>
          </div>
          <span className={`status-badge ${ORDER_STATUS_BADGE[orderStatus] ?? 'status-pending'}`}>
            {ORDER_STATUS_LABEL[orderStatus] ?? order.status}
          </span>
        </div>

        <div className="customer-info" style={{ marginTop: '16px' }}>
          <div className="customer-item">
            <span className="label">العميل:</span>
            <strong>{order.customerName}</strong>
          </div>
          <div className="customer-item">
            <span className="label">رقم التواصل:</span>
            <a
              href={`https://wa.me/${order.customerWhatsapp.replace('+', '')}`}
              target="_blank"
              rel="noreferrer"
              className="whatsapp-link"
              dir="ltr"
            >
              💬 {order.customerWhatsapp}
            </a>
          </div>
          {order.isPeripheral && (
            <div className="peripheral-badge">
              ⚠️ طلب نطاق حاشي (يشمل رسوم نطاق إضافية)
            </div>
          )}
        </div>
      </div>

      {/* Stage: ASSIGNED */}
      {isAssigned && (
        <div className="card stage-card">
          <div className="stage-banner stage-banner--assigned">
            تم تعيين هذا الطلب لك. اضغط "بدأت" للتوجه للمتاجر والشراء.
          </div>

          <button
            type="button"
            className="btn btn-primary btn-big"
            style={{ width: '100%', marginTop: '16px' }}
            onClick={handleStartOrder}
            disabled={actionLoading}
          >
            {actionLoading ? 'جارٍ البدء...' : '🚀 بدأت (بدء الشراء)'}
          </button>
        </div>
      )}

      {/* Stores Section (Visible in ASSIGNED and IN_PROGRESS) */}
      {(isAssigned || isInProgress) && (
        <div className="card">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
            }}
          >
            <h3>المتاجر والمواد المطلوبة ({order.orderStores.length})</h3>
            {isInProgress && !showAddStore && (
              <button
                type="button"
                className="btn btn-outline btn-small"
                onClick={() => setShowAddStore(true)}
              >
                ➕ إضافة متجر
              </button>
            )}
          </div>

          {/* Add store inline form */}
          {isInProgress && showAddStore && (
            <div className="add-store-form card" style={{ background: '#f8fafc', marginBottom: '16px' }}>
              <h4>إضافة متجر جديد للطلب</h4>
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <input
                  type="text"
                  className="input"
                  placeholder="اسم المتجر (مثال: بقالة النور)"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className="btn btn-primary btn-small"
                  onClick={handleAddStore}
                  disabled={actionLoading || !storeName.trim()}
                >
                  حفظ
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-small"
                  onClick={() => {
                    setShowAddStore(false);
                    setStoreName('');
                  }}
                >
                  إلغاء
                </button>
              </div>
            </div>
          )}

          {order.orderStores.map((store) => (
            <StoreCard
              key={store.id}
              store={store}
              orderId={order.id}
              orderStatus={order.status}
              onStoreUpdated={fetchActiveOrder}
            />
          ))}

          {/* Proceed to Delivery Button */}
          {isInProgress && (
            <div style={{ marginTop: '20px' }}>
              {allStoresHandled ? (
                <button
                  type="button"
                  className="btn btn-primary btn-big"
                  style={{ width: '100%' }}
                  onClick={handleProceedToDelivery}
                  disabled={actionLoading}
                >
                  {actionLoading ? 'جارٍ التحضير...' : '🛵 انتقل للتوصيل'}
                </button>
              ) : (
                <div className="hint-box">
                  ℹ️ يجب شراء أو تخطي جميع المتاجر المتبقية قبل الانتقال للتوصيل.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Stage: OUT_FOR_DELIVERY */}
      {isOutForDelivery && (
        <div className="card stage-card">
          <div className="stage-banner stage-banner--delivery">
            🛵 أنت في الطريق لتسليم الطلب للعميل.
          </div>

          <button
            type="button"
            className="btn btn-success btn-big"
            style={{ width: '100%', marginTop: '16px' }}
            onClick={handleDeliver}
            disabled={actionLoading}
          >
            {actionLoading ? 'جارٍ التأكيد...' : '✅ تم التسليم بنجاح'}
          </button>
        </div>
      )}

      {/* Stage: DELIVERED */}
      {isDelivered && (
        <div className="card text-center" style={{ background: '#ecfdf5', borderColor: '#10b981' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>🎉</div>
          <h3 style={{ color: '#047857' }}>تم تسليم الطلب بنجاح!</h3>
          <p style={{ color: '#065f46', marginTop: '8px' }}>
            تم تسجيل أتعاب التوصيل وإضافتها إلى تسوية اليوم.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            style={{ marginTop: '16px', width: '100%' }}
            onClick={() => navigate('/available')}
          >
            العودة لاستقبال طلبات جديدة
          </button>
        </div>
      )}

      {/* Map of Delivery Address */}
      <div className="card">
        <h3 style={{ marginBottom: '8px' }}>عنوان التسليم</h3>
        <p style={{ color: 'var(--text)', marginBottom: '14px' }}>
          📍 {order.deliveryAddress.description}
        </p>
        <div style={{ height: '260px', borderRadius: '8px', overflow: 'hidden' }}>
          <MapView
            lat={order.deliveryAddress.lat}
            lng={order.deliveryAddress.lng}
            description={order.deliveryAddress.description}
          />
        </div>
      </div>

      {/* Fee Summary (Server is source of truth - displayed only from order.pricing) */}
      {order.pricing && (
        <div className="card fee-card">
          <h3 style={{ marginBottom: '14px' }}>تفاصيل رسوم التوصيل</h3>
          <div className="fee-rows">
            <div className="fee-row">
              <span>الرسم الأساسي:</span>
              <span>{order.pricing.baseFee} ل.س</span>
            </div>
            {order.pricing.peripheralFee > 0 && (
              <div className="fee-row">
                <span>رسم نطاق حاشي:</span>
                <span>{order.pricing.peripheralFee} ل.س</span>
              </div>
            )}
{order.pricing.extraStoresFee > 0 && (
            <div className="fee-row">
              <span>رسم متجر إضافية:</span>
              <span>{order.pricing.extraStoresFee} ل.س</span>
            </div>
          )}
          {order.pricing.customFee && order.pricing.customFee > 0 && (
            <div className="fee-row">
              <span>رسم إضافي:</span>
              <span>{order.pricing.customFee} ل.س</span>
            </div>
          )}
          {order.pricing.customFeeReason && (
            <div className="fee-row" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              <span>السبب:</span>
              <span>{order.pricing.customFeeReason}</span>
            </div>
          )}
            <div className="fee-row fee-row--total">
              <span>إجمالي رسم التوصيل:</span>
              <span className="total-fee">{order.pricing.totalFee} ل.س</span>
            </div>
          </div>
        </div>
      )}

      {actionError && (
        <div className="toast toast-error">
          {actionError}
        </div>
      )}
    </div>
  );
}
