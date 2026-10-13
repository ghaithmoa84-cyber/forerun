import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/client';
import { useCustomerWebSocket, CLIENT_EVENTS } from '../hooks/useCustomerWebSocket';
import { ORDER_STATUS } from '@forerun/shared-constants';
import type { OrderStatus } from '@forerun/shared-constants';
import type {
  CustomerOrderListItem,
  CustomerProfile,
  PaginatedResponse,
} from '@forerun/shared-types';
import { formatWhatsappUrl, formatTelUrl } from '../lib/phone';

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  [ORDER_STATUS.DRAFT]: 'مسودة',
  [ORDER_STATUS.PENDING_REVIEW]: 'قيد المراجعة',
  [ORDER_STATUS.UNDER_REVIEW]: 'جاري المراجعة',
  [ORDER_STATUS.AWAITING_RUNNER]: 'بانتظار مندوب',
  [ORDER_STATUS.AWAITING_PREFERRED_RUNNER]: 'بانتظار المندوب المفضل',
  [ORDER_STATUS.ASSIGNED]: 'تم تعيين المندوب',
  [ORDER_STATUS.IN_PROGRESS]: 'جاري الشراء',
  [ORDER_STATUS.OUT_FOR_DELIVERY]: 'جاري التوصيل',
  [ORDER_STATUS.DELIVERED]: 'تم التسليم',
  [ORDER_STATUS.CANCELLED]: 'ملغي',
};

export const ORDER_STATUS_BADGE: Record<OrderStatus, string> = {
  [ORDER_STATUS.DRAFT]: 'badge-draft',
  [ORDER_STATUS.PENDING_REVIEW]: 'badge-pending',
  [ORDER_STATUS.UNDER_REVIEW]: 'badge-review',
  [ORDER_STATUS.AWAITING_RUNNER]: 'badge-awaiting',
  [ORDER_STATUS.AWAITING_PREFERRED_RUNNER]: 'badge-awaiting',
  [ORDER_STATUS.ASSIGNED]: 'badge-assigned',
  [ORDER_STATUS.IN_PROGRESS]: 'badge-in-progress',
  [ORDER_STATUS.OUT_FOR_DELIVERY]: 'badge-out-for-delivery',
  [ORDER_STATUS.DELIVERED]: 'badge-delivered',
  [ORDER_STATUS.CANCELLED]: 'badge-cancelled',
};

const ACTIVE_STATUSES: OrderStatus[] = [
  ORDER_STATUS.PENDING_REVIEW,
  ORDER_STATUS.UNDER_REVIEW,
  ORDER_STATUS.AWAITING_RUNNER,
  ORDER_STATUS.AWAITING_PREFERRED_RUNNER,
  ORDER_STATUS.ASSIGNED,
  ORDER_STATUS.IN_PROGRESS,
  ORDER_STATUS.OUT_FOR_DELIVERY,
];

export function HomeScreen() {
  const navigate = useNavigate();
  const { on } = useCustomerWebSocket();
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [activeOrders, setActiveOrders] = useState<CustomerOrderListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const adminWhatsapp = import.meta.env.VITE_ADMIN_WHATSAPP || '';
  const adminPhone = import.meta.env.VITE_ADMIN_PHONE || import.meta.env.VITE_ADMIN_WHATSAPP || '';

  const fetchHomeData = useCallback(async () => {
    try {
      const [profileRes, ordersRes] = await Promise.all([
        api.get<CustomerProfile>('/customer/me'),
        api.get<PaginatedResponse<CustomerOrderListItem>>('/customer/orders', {
          params: {
            limit: 3,
          },
        }),
      ]);

      setProfile(profileRes.data);
      // Filter non-terminal active orders for home display
      const active = (ordersRes.data?.data ?? []).filter((o) =>
        ACTIVE_STATUSES.includes(o.status as OrderStatus),
      ).slice(0, 3);
      setActiveOrders(active);
    } catch (err) {
      console.error('Failed to load home data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchHomeData();
  }, [fetchHomeData]);

  // WebSocket real-time updates for active orders
  useEffect(() => {
    const unsubStatus = on(CLIENT_EVENTS.ORDER_STATUS_CHANGED, () => {
      void fetchHomeData();
    });
    const unsubRunner = on(CLIENT_EVENTS.ORDER_RUNNER_ASSIGNED, () => {
      void fetchHomeData();
    });

    return () => {
      unsubStatus();
      unsubRunner();
    };
  }, [on, fetchHomeData]);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>جاري تحميل البيانات...</p>
      </div>
    );
  }

  // Active orders with an assigned runner in execution stage
  const executionOrders = activeOrders.filter(
    (o) =>
      (o.status === ORDER_STATUS.ASSIGNED ||
        o.status === ORDER_STATUS.IN_PROGRESS ||
        o.status === ORDER_STATUS.OUT_FOR_DELIVERY) &&
      o.runner,
  );

  return (
    <div className="home-screen">
      {/* Welcome Hero Card */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, #00C1A7 0%, #008f7d 100%)',
          color: '#ffffff',
          padding: '24px 20px',
          border: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '4px' }}>
              مرحباً، {profile?.name ?? 'عزيزنا العميل'}
            </h1>
            <p style={{ fontSize: '14px', opacity: 0.9 }}>
              كل ما تحتاجه من بقالة ومواد غذائية يصلك إلى باب بيتك فَوْراً
            </p>
          </div>
        </div>

        <button
          type="button"
          className="btn"
          style={{
            background: '#ffffff',
            color: 'var(--primary-hover)',
            width: '100%',
            fontWeight: 800,
            fontSize: '16px',
            boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
          }}
          onClick={() => navigate('/create-order')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          اطلب الآن
        </button>
      </div>

      {/* Active Orders Section */}
      <div style={{ marginTop: '24px' }}>
        <div className="section-title">
          <span>طلباتي النشطة ({activeOrders.length})</span>
          {activeOrders.length > 0 && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => navigate('/orders')}
            >
              عرض الكل
            </button>
          )}
        </div>

        {activeOrders.length === 0 ? (
          <div className="card empty-state" style={{ padding: '36px 16px' }}>
            <svg
              className="empty-state-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-h)', marginBottom: '4px' }}>
              لا توجد طلبات نشطة حالياً
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              اضغط على زر "اطلب الآن" لإنشاء طلب بقالة جديد
            </p>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => navigate('/create-order')}
            >
              إنشاء طلب جديد
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {activeOrders.map((order) => {
              const status = order.status as OrderStatus;
              return (
                <div
                  key={order.id}
                  className="card"
                  style={{
                    cursor: 'pointer',
                    padding: '16px',
                    margin: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                  onClick={() => navigate(`/orders/${order.id}`)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 800, fontSize: '15px', color: 'var(--text-h)' }}>
                      طلب رقم {order.orderNumber}
                    </span>
                    <span className={`badge ${ORDER_STATUS_BADGE[status]}`}>
                      <span className="badge-dot" />
                      {ORDER_STATUS_LABEL[status]}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-muted)' }}>
                    <span>{order.itemCount} مواد مطلوبة</span>
                    <span style={{ fontWeight: 700, color: 'var(--primary)' }}>
                      {order.totalFee > 0 ? `${order.totalFee} ليرة سورية` : 'قيد التقدير'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Active Runner Contact Section (Visible after runner assignment & during execution) */}
      {executionOrders.length > 0 && (
        <div style={{ marginTop: '24px' }}>
          <div className="section-title">
            <span>التواصل مع مندوب التوصيل</span>
          </div>
          {executionOrders.map((order) => {
            const runner = order.runner!;
            return (
              <div
                key={`runner-${order.id}`}
                className="card"
                style={{
                  border: '1px solid #00C1A7',
                  backgroundColor: '#f0fdf4',
                  padding: '16px',
                  marginBottom: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>الكابتن المعيّن للطلب رقم {order.orderNumber}</span>
                    <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-h)', margin: '2px 0 0 0' }}>
                      {runner.name}
                    </h3>
                  </div>
                  <span className="badge badge-assigned" style={{ fontSize: '12px' }}>
                    جاري التنفيذ
                  </span>
                </div>

                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  يمكنك التواصل المباشر مع المندوب لمتابعة تفاصيل الشراء والتسليم:
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  {runner.whatsapp && (
                    <a
                      href={formatWhatsappUrl(runner.whatsapp, `مرحباً كابتن ${runner.name}، بخصوص طلبي رقم ${order.orderNumber}`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-outline"
                      style={{
                        borderColor: '#25D366',
                        color: '#25D366',
                        backgroundColor: '#ffffff',
                        fontWeight: 700,
                        fontSize: '13px',
                        textAlign: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      واتساب المندوب
                    </a>
                  )}
                  {(runner.phone || runner.whatsapp) && (
                    <a
                      href={formatTelUrl(runner.phone || runner.whatsapp!)}
                      className="btn btn-outline"
                      style={{
                        borderColor: 'var(--primary)',
                        color: 'var(--primary)',
                        backgroundColor: '#ffffff',
                        fontWeight: 700,
                        fontSize: '13px',
                        textAlign: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      اتصال بالمندوب
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Permanent Administration Support Section */}
      {(adminWhatsapp || adminPhone) && (
        <div className="card" style={{ marginTop: '24px', padding: '16px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-h)', marginBottom: '4px' }}>
            الدعم والمساعدة
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '14px' }}>
            فريق إدارة فَوْراً جاهز دائماً لمساعدتك في أي استفسار أو متابعة للطلبات
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: adminWhatsapp && adminPhone ? '1fr 1fr' : '1fr',
              gap: '10px',
            }}
          >
            {adminWhatsapp && (
              <a
                href={formatWhatsappUrl(adminWhatsapp, 'مرحباً إدارة فَوْراً، لدي استفسار بخصوص خدمتي')}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline"
                style={{
                  borderColor: '#25D366',
                  color: '#15803d',
                  fontWeight: 700,
                  fontSize: '13px',
                  textAlign: 'center',
                  justifyContent: 'center',
                }}
              >
                واتساب الإدارة
              </a>
            )}
            {adminPhone && (
              <a
                href={formatTelUrl(adminPhone)}
                className="btn btn-outline"
                style={{
                  borderColor: 'var(--primary)',
                  color: 'var(--primary)',
                  fontWeight: 700,
                  fontSize: '13px',
                  textAlign: 'center',
                  justifyContent: 'center',
                }}
              >
                اتصال هاتفي بالإدارة
              </a>
            )}
          </div>
        </div>
      )}

      {/* Quick Access Services / Features banner */}
      <div className="card" style={{ marginTop: '24px', backgroundColor: '#ffffff' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-h)', marginBottom: '8px' }}>
          لماذا تطلب عبر فَوْراً؟
        </h3>
        <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', color: 'var(--text)' }}>
          <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--primary)', fontWeight: 800 }}>•</span>
            اختر أي مواد بقالة ترغب بها من أي متجر
          </li>
          <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--primary)', fontWeight: 800 }}>•</span>
            توصيل سريع من قِبل كباتن معتمدين وموثوقين
          </li>
          <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--primary)', fontWeight: 800 }}>•</span>
            متابعة حية لحالة الطلب لحظة بلحظة
          </li>
        </ul>
      </div>
    </div>
  );
}
