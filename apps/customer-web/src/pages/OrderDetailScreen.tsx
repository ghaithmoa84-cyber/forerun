import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/client';
import { useCustomerWebSocket, CLIENT_EVENTS } from '../hooks/useCustomerWebSocket';
import { ORDER_STATUS } from '@forerun/shared-constants';
import type { OrderStatus } from '@forerun/shared-constants';
import type {
  CustomerOrderDetails,
  OrderFeeUpdatedPayload,
  OrderStatusChangedPayload,
  OrderDeliveredPayload,
  OrderCancelledPayload,
  OrderOutForDeliveryPayload,
} from '@forerun/shared-types';
import { formatWhatsappUrl, formatTelUrl } from '../lib/phone';
import { ORDER_STATUS_LABEL, ORDER_STATUS_BADGE } from './HomeScreen';

// Ordered 4-stage progression for the visual stepper
interface ProgressStage {
  id: number;
  label: string;
}

const ORDER_4_STAGES: ProgressStage[] = [
  { id: 1, label: 'مراجعة الطلب' },
  { id: 2, label: 'تعيين المندوب' },
  { id: 3, label: 'تجهيز الطلب' },
  { id: 4, label: 'التوصيل والتسليم' },
];

// Never surface the server `message` — it may contain internal identifiers
// (state machine names, SQL fragments). Map the stable error code instead.
const CANCEL_ERROR_BY_STATUS: Record<number, string> = {
  404: 'الطلب غير موجود.',
  409: 'تغيّرت حالة الطلب أثناء المحاولة. يرجى تحديث الطلب والمحاولة مجدداً.',
  422: 'لا يمكن إلغاء الطلب في هذه المرحلة.',
};

const CANCEL_ERROR_FALLBACK = 'تعذر إلغاء الطلب. يرجى المحاولة لاحقاً.';

function getCancelErrorMessage(err: unknown): string {
  const status = (err as { response?: { status?: number } } | undefined)?.response?.status;
  return (status !== undefined && CANCEL_ERROR_BY_STATUS[status]) || CANCEL_ERROR_FALLBACK;
}

function getStageIndex(status: OrderStatus): number {
  if (
    status === ORDER_STATUS.DRAFT ||
    status === ORDER_STATUS.PENDING_REVIEW ||
    status === ORDER_STATUS.UNDER_REVIEW
  ) {
    return 0;
  }
  if (
    status === ORDER_STATUS.AWAITING_RUNNER ||
    status === ORDER_STATUS.AWAITING_PREFERRED_RUNNER ||
    status === ORDER_STATUS.ASSIGNED
  ) {
    return 1;
  }
  if (status === ORDER_STATUS.IN_PROGRESS) {
    return 2;
  }
  if (
    status === ORDER_STATUS.OUT_FOR_DELIVERY ||
    status === ORDER_STATUS.DELIVERED
  ) {
    return 3;
  }
  return 0;
}

export function OrderDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { on } = useCustomerWebSocket();

  const [order, setOrder] = useState<CustomerOrderDetails | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Cancellation Dialog State
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);
  const [cancelling, setCancelling] = useState<boolean>(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Real-time Fee update notification banner
  const [feeNotification, setFeeNotification] = useState<{
    oldFee: number;
    newFee: number;
    reason: string;
  } | null>(null);

  // Out for Delivery banner state
  const [outForDeliveryBanner, setOutForDeliveryBanner] = useState<boolean>(false);

  // Delivered or Cancelled banners
  const [deliveredMessage, setDeliveredMessage] = useState<string | null>(null);
  const [cancelledMessage, setCancelledMessage] = useState<string | null>(null);

  const fetchOrderDetails = useCallback(async () => {
    if (!id) return;
    try {
      const res = await api.get<CustomerOrderDetails>(`/customer/orders/${id}`);
      setOrder(res.data);
    } catch (err) {
      console.error('Failed to load order details:', err);
      setError('تعذر تحميل تفاصيل الطلب. يرجى المحاولة لاحقاً.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchOrderDetails();
  }, [fetchOrderDetails]);

  // WebSocket real-time event listeners for this specific order
  useEffect(() => {
    if (!id) return;

    // 1. Status Changed
    const unsubStatus = on<OrderStatusChangedPayload>(
      CLIENT_EVENTS.ORDER_STATUS_CHANGED,
      (payload) => {
        if (payload.orderId === id) {
          void fetchOrderDetails();
        }
      },
    );

    // 2. Runner Assigned
    const unsubRunner = on<{ orderId: string; runnerName: string }>(
      CLIENT_EVENTS.ORDER_RUNNER_ASSIGNED,
      (payload) => {
        if (payload.orderId === id) {
          void fetchOrderDetails();
        }
      },
    );

    // 3. Fee Updated: Displays alert with old and new fee
    const unsubFee = on<OrderFeeUpdatedPayload>(
      CLIENT_EVENTS.ORDER_FEE_UPDATED,
      (payload) => {
        if (payload.orderId === id) {
          setFeeNotification({
            oldFee: payload.oldFee,
            newFee: payload.newFee,
            reason: payload.reason,
          });
          void fetchOrderDetails();
        }
      },
    );

    // 4. Out for Delivery: Refetch details and display persistent top banner
    const unsubOutForDelivery = on<OrderOutForDeliveryPayload>(
      CLIENT_EVENTS.ORDER_OUT_FOR_DELIVERY,
      (payload) => {
        if (payload.orderId === id) {
          setOutForDeliveryBanner(true);
          void fetchOrderDetails();
        }
      },
    );

    // 5. Delivered
    const unsubDelivered = on<OrderDeliveredPayload>(
      CLIENT_EVENTS.ORDER_DELIVERED,
      (payload) => {
        if (payload.orderId === id) {
          setDeliveredMessage('تهانينا، تم تسليم طلبك بنجاح');
          void fetchOrderDetails();
        }
      },
    );

    // 6. Cancelled
    const unsubCancelled = on<OrderCancelledPayload>(
      CLIENT_EVENTS.ORDER_CANCELLED,
      (payload) => {
        if (payload.orderId === id) {
          setCancelledMessage(`تم إلغاء الطلب، السبب: ${payload.reason || 'إلغاء الطلب'}`);
          void fetchOrderDetails();
        }
      },
    );

    return () => {
      unsubStatus();
      unsubRunner();
      unsubFee();
      unsubOutForDelivery();
      unsubDelivered();
      unsubCancelled();
    };
  }, [id, on, fetchOrderDetails]);

  // Handle Cancel Order Confirmation
  const handleConfirmCancel = async () => {
    if (!id) return;
    setCancelling(true);
    setCancelError(null);

    try {
      await api.delete(`/customer/orders/${id}`);
      setShowCancelModal(false);
      void fetchOrderDetails();
    } catch (err: unknown) {
      setCancelError(getCancelErrorMessage(err));
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>جاري تحميل تفاصيل الطلب...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="card empty-state">
        <p style={{ color: 'var(--danger)', fontWeight: 700, marginBottom: '16px' }}>
          {error ?? 'الطلب غير موجود'}
        </p>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => navigate('/orders')}
        >
          العودة لقائمة الطلبات
        </button>
      </div>
    );
  }

  const currentStatus = order.status as OrderStatus;

  // Strict State Machine Check: mirrors ORDER_TRANSITIONS for the CUSTOMER actor
  const canCancelOrder =
    currentStatus === ORDER_STATUS.PENDING_REVIEW ||
    currentStatus === ORDER_STATUS.AWAITING_RUNNER ||
    currentStatus === ORDER_STATUS.AWAITING_PREFERRED_RUNNER ||
    currentStatus === ORDER_STATUS.ASSIGNED;

  // Rating CTA: Only when DELIVERED and no rating exists
  const canRateOrder =
    currentStatus === ORDER_STATUS.DELIVERED && !order.rating;

  // 4-stage stepper state
  const activeStageIdx = getStageIndex(currentStatus);
  const isDelivered = currentStatus === ORDER_STATUS.DELIVERED;

  const isOutForDelivery =
    (outForDeliveryBanner || currentStatus === ORDER_STATUS.OUT_FOR_DELIVERY) &&
    currentStatus !== ORDER_STATUS.DELIVERED &&
    currentStatus !== ORDER_STATUS.CANCELLED;

  return (
    <div className="order-detail-screen">
      {/* Header Info */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>تفاصيل الطلب</span>
          <h1 className="page-title" style={{ marginBottom: 0 }}>طلب رقم {order.orderNumber}</h1>
        </div>
        <span className={`badge ${ORDER_STATUS_BADGE[currentStatus]}`} style={{ padding: '6px 14px', fontSize: '13px' }}>
          <span className="badge-dot" />
          {ORDER_STATUS_LABEL[currentStatus]}
        </span>
      </div>

      {/* Out For Delivery Persistent Top Banner */}
      {isOutForDelivery && (
        <div
          className="card"
          style={{
            backgroundColor: 'var(--success-bg)',
            borderColor: 'var(--success)',
            color: '#166534',
            fontWeight: 700,
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '16px',
          }}
        >
          <span>مندوب التوصيل في طريقه إليك، يرجى الاستعداد للاستلام</span>
        </div>
      )}

      {/* Real-time Fee Update Alert Banner */}
      {feeNotification && (
        <div
          className="card"
          style={{
            backgroundColor: 'var(--warning-bg)',
            borderColor: 'var(--warning)',
            color: '#92400e',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontWeight: 800, fontSize: '14px', marginBottom: '2px' }}>
              تنبيه: تم تحديث رسوم الطلب
            </div>
            <div style={{ fontSize: '13px' }}>
              تغيرت الرسوم من <strong>{feeNotification.oldFee} ليرة سورية</strong> إلى{' '}
              <strong>{feeNotification.newFee} ليرة سورية</strong>، السبب: {feeNotification.reason}
            </div>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-outline"
            style={{ borderColor: '#92400e', color: '#92400e' }}
            onClick={() => setFeeNotification(null)}
          >
            حسناً
          </button>
        </div>
      )}

      {/* Delivered Notification */}
      {deliveredMessage && (
        <div
          className="card"
          style={{
            backgroundColor: 'var(--success-bg)',
            borderColor: 'var(--success)',
            color: '#166534',
            fontWeight: 700,
            fontSize: '14px',
          }}
        >
          {deliveredMessage}
        </div>
      )}

      {/* Cancelled / Rejected Banner with Cancel Reason */}
      {(cancelledMessage || currentStatus === ORDER_STATUS.CANCELLED) && (
        <div
          className="card"
          style={{
            backgroundColor: 'var(--danger-bg)',
            borderColor: 'var(--danger)',
            color: 'var(--danger)',
          }}
        >
          <div style={{ fontWeight: 800, fontSize: '15px', marginBottom: '6px' }}>
            الطلب ملغي
          </div>
          <div style={{ fontSize: '13px', marginBottom: order.cancelReason ? '10px' : '0' }}>
            {cancelledMessage ||
              `تم إلغاء هذا الطلب بتاريخ ${order.cancelledAt ? new Date(order.cancelledAt).toLocaleDateString('ar-SY') : ''}`}
          </div>
          {order.cancelReason && (
            <div
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '13px',
                color: 'var(--danger)',
                fontWeight: 700,
              }}
            >
              سبب الرفض: {order.cancelReason}
            </div>
          )}
        </div>
      )}

      {/* Visual Status Stepper (Condensed to 4 steps) */}
      {currentStatus !== ORDER_STATUS.CANCELLED && (
        <div className="card" style={{ padding: '20px 14px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-h)', marginBottom: '14px' }}>
            مراحل تنفيذ الطلب
          </h2>
          <div className="stepper">
            {ORDER_4_STAGES.map((stage, idx) => {
              const isCompleted = activeStageIdx > idx || (idx === 3 && isDelivered);
              const isCurrent = activeStageIdx === idx && !isDelivered;

              let itemClass = '';
              if (isCompleted) itemClass = 'step-item--completed';
              else if (isCurrent) itemClass = 'step-item--current';

              return (
                <div key={stage.id} className={`step-item ${itemClass}`}>
                  <div className="step-node">
                    {isCompleted ? (
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      stage.id
                    )}
                  </div>
                  <span className="step-label">
                    {stage.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Assigned Runner Details with WhatsApp and Call buttons */}
      {order.runner && (
        <div className="card">
          <h2 className="section-title">الكابتن المندوب</h2>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: (order.runner.whatsapp || order.runner.phone) ? '12px' : 0 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-h)' }}>
                {order.runner.name}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                {order.runner.avgRating
                  ? `تقييم المندوب: ${order.runner.avgRating.toFixed(1)} من 5 (${order.runner.totalRatings} تقييم)`
                  : 'كابتن معتمد جديد'}
              </div>
            </div>
            <span className="badge badge-assigned">مُعيّن للطلب</span>
          </div>

          {(currentStatus === ORDER_STATUS.ASSIGNED ||
            currentStatus === ORDER_STATUS.IN_PROGRESS ||
            currentStatus === ORDER_STATUS.OUT_FOR_DELIVERY) &&
            order.runner.whatsapp && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '10px' }}>
                <a
                  href={formatWhatsappUrl(
                    order.runner.whatsapp,
                    `مرحباً كابتن ${order.runner.name}، بخصوص طلبي رقم ${order.orderNumber}`,
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline btn-sm"
                  style={{ borderColor: '#25D366', color: '#25D366', textAlign: 'center', justifyContent: 'center' }}
                >
                  واتساب المندوب
                </a>
                <a
                  href={formatTelUrl(order.runner.phone || order.runner.whatsapp)}
                  className="btn btn-outline btn-sm"
                  style={{ borderColor: 'var(--primary)', color: 'var(--primary)', textAlign: 'center', justifyContent: 'center' }}
                >
                  اتصال بالمندوب
                </a>
              </div>
            )}
        </div>
      )}

      {/* Items List */}
      <div className="card">
        <h2 className="section-title">المواد المطلوبة ({order.items.length})</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {order.items.map((item) => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 0',
                borderBottom: '1px solid var(--border)',
                opacity: item.isCancelled ? 0.6 : 1,
              }}
            >
              <div>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: '14px',
                    color: item.isCancelled ? 'var(--danger)' : 'var(--text-h)',
                    textDecoration: item.isCancelled ? 'line-through' : 'none',
                  }}
                >
                  {item.itemName}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  المتجر: {item.anyStore ? 'أي متجر' : (item.customStoreName || 'متجر غير محدد')}
                </div>
                {item.isCancelled && item.cancelNote && (
                  <div style={{ fontSize: '11px', color: 'var(--danger)', marginTop: '2px' }}>
                    سبب الإلغاء: {item.cancelNote}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text)' }}>
                  {item.quantity}
                </span>
                {item.isCancelled && (
                  <span className="badge badge-cancelled" style={{ fontSize: '11px', padding: '2px 6px' }}>
                    ملغى
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pricing Breakdown */}
      <div className="card">
        <h2 className="section-title">تفاصيل الرسوم والتسعير</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>رسم التوصيل الأساسي:</span>
            <span>{order.baseFee} ل.س</span>
          </div>
          {order.peripheralFee > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>رسم المناطق البعيدة / الطرفية:</span>
              <span>{order.peripheralFee} ل.س</span>
            </div>
          )}
          {order.extraStoresFee > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>رسم المتاجر الإضافية:</span>
              <span>{order.extraStoresFee} ل.س</span>
            </div>
          )}
          {order.customFee && order.customFee > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>رسم إضافي:</span>
              <span>{order.customFee} ل.س</span>
            </div>
          )}
          {order.customFeeReason && (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              السبب: {order.customFeeReason}
            </div>
          )}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              paddingTop: '10px',
              marginTop: '4px',
              borderTop: '1px dashed var(--border)',
              fontWeight: 800,
              fontSize: '16px',
            }}
          >
            <span>إجمالي الرسوم:</span>
            <span style={{ color: 'var(--primary)' }}>
              {order.totalFee > 0 ? `${order.totalFee} ل.س` : 'قيد التقدير'}
            </span>
          </div>
        </div>
      </div>

      {/* Existing Rating Display */}
      {order.rating && (
        <div className="card">
          <h2 className="section-title">تقييمك للطلب</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '20px', color: '#f59e0b' }}>
            {'★'.repeat(order.rating.stars)}
            <span style={{ fontSize: '13px', color: 'var(--text-muted)', marginRight: '8px' }}>
              ({order.rating.stars} من 5 نجوم)
            </span>
          </div>
        </div>
      )}

      {/* Action Buttons: Cancel and Rate */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px', marginBottom: '24px' }}>
        {canRateOrder && (
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={() => navigate(`/orders/${order.id}/rating`)}
          >
            تقييم تجربة التوصيل والمندوب
          </button>
        )}

        {/* Cancel Button strictly governed by State Machine */}
        {canCancelOrder && (
          <button
            type="button"
            className="btn btn-danger-outline btn-block"
            onClick={() => setShowCancelModal(true)}
          >
            إلغاء الطلب
          </button>
        )}
      </div>

      {/* Cancel Order Confirmation Modal */}
      {showCancelModal && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <h3 className="modal-title">هل أنت متأكد من إلغاء الطلب؟</h3>
            <p className="modal-body">
              عند تأكيد الإلغاء، سيتم إيقاف معالجة هذا الطلب فوراً. هذه العملية لا يمكن التراجع عنها.
            </p>

            {cancelError && (
              <div
                style={{
                  backgroundColor: 'var(--danger-bg)',
                  color: 'var(--danger)',
                  padding: '10px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '13px',
                  fontWeight: 600,
                  marginBottom: '14px',
                }}
              >
                {cancelError}
              </div>
            )}

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setShowCancelModal(false)}
                disabled={cancelling}
              >
                تراجع
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => void handleConfirmCancel()}
                disabled={cancelling}
              >
                {cancelling ? 'جارٍ الإلغاء...' : 'نعم، إلغاء الطلب'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
