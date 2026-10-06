import { useEffect, useState, useCallback } from 'react';
import api from '../api/client';
import type { SettlementStatus } from '@forerun/shared-constants';
import type {
  PaginatedMeta,
  RunnerCurrentSettlement,
  RunnerSettlement,
  RunnerSettlementListResponse,
} from '@forerun/shared-types';
import axios from 'axios';

const SETTLEMENT_STATUS_LABEL: Record<SettlementStatus, string> = {
  PENDING: 'معلقة (بانتظار التسوية)',
  SETTLED: 'مسواة (تم الدفع)',
};

const SETTLEMENT_STATUS_BADGE: Record<SettlementStatus, string> = {
  PENDING: 'status-pending',
  SETTLED: 'status-delivered',
};

export function SettlementsPage() {
  const [current, setCurrent] = useState<RunnerCurrentSettlement | null>(null);
  const [settlements, setSettlements] = useState<RunnerSettlement[]>([]);
  const [meta, setMeta] = useState<PaginatedMeta | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettlements = useCallback(async (targetPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const [currentRes, listRes] = await Promise.all([
        api.get<RunnerCurrentSettlement>('/runner/settlements/current'),
        api.get<RunnerSettlementListResponse>('/runner/settlements', {
          params: { page: targetPage, limit: 10 },
        }),
      ]);

      setCurrent(currentRes.data);
      setSettlements(listRes.data.data);
      setMeta(listRes.data.meta);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        const msg = err.response.data.message;
        setError(Array.isArray(msg) ? msg.join(' - ') : msg);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('فشل في تحميل بيانات التسويات المالية');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSettlements(page);
  }, [page, fetchSettlements]);

  const handlePrevPage = () => {
    if (page > 1) {
      setPage((p) => p - 1);
    }
  };

  const handleNextPage = () => {
    if (meta && page < meta.totalPages) {
      setPage((p) => p + 1);
    }
  };

  if (loading && !current && settlements.length === 0) {
    return (
      <div className="container" style={{ paddingTop: '32px' }}>
        <div className="card text-center">
          <div className="spinner" style={{ margin: '16px auto' }} />
          <p>جارٍ تحميل بيانات التسويات المالية...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: '20px' }}>
      <div className="page-header" style={{ marginBottom: '16px' }}>
        <h2>التسويات المالية</h2>
        <p style={{ color: 'var(--text)', fontSize: '14px', marginTop: '4px' }}>
          متابعة تسليماتك اليومية وتاريخ تسوياتك السابقة
        </p>
      </div>

      {error && (
        <div className="error-msg" style={{ marginBottom: '16px' }}>
          {error}
        </div>
      )}

      {/* Today's ongoing settlement */}
      {current && (
        <div className="card settlement-card settlement-card--current">
          <div className="settlement-card__header">
            <div>
              <span className="badge badge--today">اليوم</span>
              <h3 style={{ marginTop: '4px' }}>تسوية {current.operationalDate}</h3>
            </div>
            <span className="status-badge status-on-mission">
              جارية (غير مغلقة)
            </span>
          </div>

          <div className="settlement-stats-grid">
            <div className="settlement-stat">
              <span className="label">الطلبات المنجزة:</span>
              <span className="val">{current.totalOrders} طلب</span>
            </div>
            <div className="settlement-stat settlement-stat--highlight">
              <span className="label">إجمالي الرسوم:</span>
              <span className="val highlight">{current.totalFees} ل.س</span>
            </div>
          </div>

          {current.orders && current.orders.length > 0 && (
            <div className="settlement-orders" style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
              <h4 style={{ fontSize: '14px', marginBottom: '8px' }}>تفاصيل طلبات اليوم:</h4>
              <ul className="settlement-order-list">
                {current.orders.map((o) => (
                  <li key={o.orderNumber} className="settlement-order-item">
                    <span>طلب #{o.orderNumber}</span>
                    <span>{o.totalFee} ل.س</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Past settlements history */}
      <div className="card" style={{ marginTop: '20px' }}>
        <h3 style={{ marginBottom: '14px' }}>سجل التسويات السابقة</h3>

        {settlements.length === 0 ? (
          <p style={{ color: 'var(--text)', textAlign: 'center', padding: '16px 0' }}>
            لا توجد تسويات سابقة مسجلة حتى الآن.
          </p>
        ) : (
          <div className="settlements-list">
            {settlements.map((s) => (
              <div key={s.operationalDate} className="settlement-history-item">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>{s.operationalDate}</strong>
                  <span className={`status-badge ${SETTLEMENT_STATUS_BADGE[s.status]}`}>
                    {SETTLEMENT_STATUS_LABEL[s.status]}
                  </span>
                </div>

                <div className="history-details" style={{ marginTop: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                    <span>الطلبات المنجزة:</span>
                    <span>{s.totalOrders} طلب</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 'bold', marginTop: '4px', color: 'var(--accent)' }}>
                    <span>إجمالي الرسوم:</span>
                    <span>{s.totalFees} ل.س</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination controls */}
        {meta && meta.totalPages > 1 && (
          <div className="pagination" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
            <button
              type="button"
              className="btn btn-outline btn-small"
              onClick={handlePrevPage}
              disabled={page <= 1 || loading}
            >
              السابق
            </button>
            <span style={{ fontSize: '14px', color: 'var(--text)' }}>
              صفحة {meta.page} من {meta.totalPages}
            </span>
            <button
              type="button"
              className="btn btn-outline btn-small"
              onClick={handleNextPage}
              disabled={page >= meta.totalPages || loading}
            >
              التالي
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
