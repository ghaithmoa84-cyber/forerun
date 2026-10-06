'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/Toast';
import api from '@/lib/api';
import {
  ADMIN_EVENTS,
  type SettlementReminderPayload,
  type Settlement,
  type SettlementListResponse,
  type LedgerEntry,
  type LedgerEntryListResult,
  type SettlementStatus,
  type LedgerEntryType,
  SETTLEMENT_STATUS_VALUES,
} from '@forerun/shared-types';
import { useAdminWebSocket } from '@/hooks/useAdminWebSocket';

const SETTLEMENT_STATUS_LABEL: Record<SettlementStatus, string> = {
  PENDING: 'معلقة',
  SETTLED: 'مُسَوّاة',
};

const SETTLEMENT_STATUS_STYLE: Record<SettlementStatus, string> = {
  PENDING: 'badge-pending',
  SETTLED: 'badge-settled',
};

const LEDGER_ENTRY_TYPE_LABEL: Record<LedgerEntryType, string> = {
  ORDER_FEE_TOTAL: 'رسوم طلب',
  RUNNER_SHARE: 'حصة المندوب',
  PLATFORM_SHARE: 'حصة المنصة',
  SETTLEMENT_PAID: 'تسوية مدفوعة',
  ADMIN_ADJUSTMENT: 'تعديل إداري',
};

const LEDGER_ENTRY_TYPE_STYLE: Record<LedgerEntryType, string> = {
  ORDER_FEE_TOTAL: 'badge-on-mission',
  RUNNER_SHARE: 'badge-pending',
  PLATFORM_SHARE: 'badge-settled',
  SETTLEMENT_PAID: 'badge-available',
  ADMIN_ADJUSTMENT: 'badge-unavailable',
};

interface PendingSettlement extends Settlement {
  runner?: {
    id: string;
    userId: string;
    user?: {
      name: string;
      whatsapp: string;
      phone?: string;
    };
  };
}

interface PendingSettlementsResponse {
  data: PendingSettlement[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface Filters {
  status?: SettlementStatus;
  runnerId?: string;
  dateFrom?: string;
  dateTo?: string;
  page: number;
  limit: number;
}

export default function SettlementsPage() {
  const { showToast } = useToast();
  const { on, isConnected } = useAdminWebSocket();

  const [activeTab, setActiveTab] = useState<'settlements' | 'ledger'>('settlements');

  // Settlements state
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({
    status: undefined,
    runnerId: '',
    dateFrom: '',
    dateTo: '',
    page: 1,
    limit: 20,
  });

  // Pending settlements state
  const [pendingSettlements, setPendingSettlements] = useState<PendingSettlement[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);

  // Ledger state
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [ledgerMeta, setLedgerMeta] = useState({ total: 0, page: 1, limit: 20, totalPages: 0 });
  const [ledgerLoading, setLedgerLoading] = useState(false);

  // Close day modal state
  const [closeDayModal, setCloseDayModal] = useState<{ open: boolean; date: string }>({ open: false, date: '' });
  const [closeDayLoading, setCloseDayLoading] = useState(false);
  const [closeDayNotes, setCloseDayNotes] = useState('');
  const [markSettledLoading, setMarkSettledLoading] = useState<string | null>(null);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ar-SY', {
      style: 'currency',
      currency: 'SYP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateVal: string | Date | null | undefined) => {
    if (!dateVal) return '-';
    return new Date(dateVal).toLocaleDateString('ar-SY', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const formatDateTime = (dateVal: string | Date | null | undefined) => {
    if (!dateVal) return '-';
    return new Date(dateVal).toLocaleString('ar-SY', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const fetchSettlements = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.runnerId) params.append('runnerId', filters.runnerId);
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.append('dateTo', filters.dateTo);
      params.append('page', filters.page.toString());
      params.append('limit', filters.limit.toString());

      const res = await api.get<SettlementListResponse>(`/admin/settlements?${params.toString()}`);
      setSettlements(res.data.data);
      setMeta(res.data.meta);
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      showToast(axiosError.response?.data?.message || 'فشل في تحميل التسويات', 'error');
    } finally {
      setLoading(false);
    }
  }, [filters, showToast]);

  const fetchPendingSettlements = useCallback(async () => {
    try {
      setPendingLoading(true);
      const res = await api.get<PendingSettlementsResponse>('/admin/settlements/pending');
      setPendingSettlements(res.data.data);
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      showToast(axiosError.response?.data?.message || 'فشل في تحميل التسويات المعلقة', 'error');
    } finally {
      setPendingLoading(false);
    }
  }, [showToast]);

  const fetchLedger = useCallback(async (page = 1) => {
    try {
      setLedgerLoading(true);
      const res = await api.get<LedgerEntryListResult>('/admin/ledger', {
        params: { page, limit: 20 },
      });
      setLedgerEntries(res.data.data);
      setLedgerMeta(res.data.meta);
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      showToast(axiosError.response?.data?.message || 'فشل في تحميل السجل المالي', 'error');
    } finally {
      setLedgerLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchSettlements();
    fetchPendingSettlements();
  }, [fetchSettlements, fetchPendingSettlements]);

  useEffect(() => {
    if (activeTab === 'ledger') {
      fetchLedger(ledgerMeta.page);
    }
  }, [activeTab, fetchLedger, ledgerMeta.page]);

  useEffect(() => {
    if (!isConnected) return;

    const cleanup = on<SettlementReminderPayload>(ADMIN_EVENTS.SETTLEMENT_REMINDER, (data) => {
      showToast(`لديك ${data.pendingRunnerCount} مندوب بتسوية معلقة (${data.date})`, 'urgent');
      fetchPendingSettlements();
    });

    return cleanup;
  }, [isConnected, on, showToast, fetchPendingSettlements]);

  const handleCloseDay = async () => {
    if (!closeDayModal.date) {
      showToast('الرجاء اختيار تاريخ', 'error');
      return;
    }

    try {
      setCloseDayLoading(true);
      await api.post('/admin/settlements/close-day', {
        operationalDate: closeDayModal.date,
        notes: closeDayNotes || null,
      });
      showToast('تم إغلاق اليوم وإنشاء التسويات بنجاح', 'success');
      setCloseDayModal({ open: false, date: '' });
      setCloseDayNotes('');
      fetchSettlements();
      fetchPendingSettlements();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      showToast(axiosError.response?.data?.message || 'فشل في إغلاق اليوم', 'error');
    } finally {
      setCloseDayLoading(false);
    }
  };

  const handleMarkSettled = async (settlementId: string) => {
    try {
      setMarkSettledLoading(settlementId);
      await api.put(`/admin/settlements/${settlementId}/mark-settled`);
      showToast('تم تأكيد التسوية بنجاح', 'success');
      fetchPendingSettlements();
      fetchSettlements();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      showToast(axiosError.response?.data?.message || 'فشل في تأكيد التسوية', 'error');
    } finally {
      setMarkSettledLoading(null);
    }
  };

  const handleFilterChange = (key: keyof Filters, value: string | number | undefined) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  const handlePageChange = (page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  };

  const getStatusBadge = (status: SettlementStatus) => (
    <span className={`badge ${SETTLEMENT_STATUS_STYLE[status] ?? 'badge-pending'}`}>
      {SETTLEMENT_STATUS_LABEL[status] ?? status}
    </span>
  );

  const getLedgerTypeBadge = (type: LedgerEntryType) => (
    <span className={`badge ${LEDGER_ENTRY_TYPE_STYLE[type] ?? ''}`}>
      {LEDGER_ENTRY_TYPE_LABEL[type] ?? type}
    </span>
  );

  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Damascus',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  return (
    <div className="container">
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 className="page-title">التسويات والمالية</h1>
            <p className="page-subtitle">إدارة تسويات المندوبين اليومية والسجل المالي للمنصة</p>
          </div>
          <button
            className="btn btn-primary w-full sm:w-auto"
            onClick={() => setCloseDayModal({ open: true, date: today })}
          >
            إغلاق يوم
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="overflow-x-auto" style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
        <button
          className={`btn ${activeTab === 'settlements' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('settlements')}
        >
          التسويات اليومية
          {pendingSettlements.length > 0 && (
            <span style={{
              background: '#ef4444',
              color: '#fff',
              borderRadius: '9999px',
              padding: '2px 8px',
              fontSize: '11px',
              marginRight: '6px'
            }}>
              {pendingSettlements.length}
            </span>
          )}
        </button>
        <button
          className={`btn ${activeTab === 'ledger' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('ledger')}
        >
          السجل المالي (Ledger)
        </button>
      </div>

      {activeTab === 'settlements' && (
        <>
          {/* القسم الأول: التسويات المعلقة */}
          <div className="card" style={{ marginBottom: '24px', border: '1px solid #fed7aa', background: '#fffaf0' }}>
            <div className="card-header" style={{ borderBottomColor: '#fed7aa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 className="card-title" style={{ color: '#9a3412', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>⚠️</span>
                  <span>التسويات المعلقة</span>
                  <span className="badge badge-pending" style={{ fontSize: '12px' }}>
                    {pendingSettlements.length} معلقة
                  </span>
                </h2>
                <p style={{ fontSize: '13px', color: '#c2410c', marginTop: '4px' }}>
                  تسويات تم إغلاق أيامها التشغيلية وتنتظر تأكيد الدفع للمندوب
                </p>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={fetchPendingSettlements}
                disabled={pendingLoading}
              >
                {pendingLoading ? 'جاري التحديث...' : 'تحديث القائمة'}
              </button>
            </div>

            {pendingLoading ? (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                جاري تحميل التسويات المعلقة...
              </div>
            ) : pendingSettlements.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: '#15803d', fontWeight: 500 }}>
                ✓ لا توجد تسويات معلقة حالياً، جميع التسويات مُسَوّاة!
              </div>
            ) : (
              <div className="table-container overflow-x-auto">
                <table>
                  <thead>
                    <tr>
                      <th>اسم المندوب</th>
                      <th>التاريخ التشغيلي</th>
                      <th>عدد الطلبات</th>
                      <th>إجمالي الرسوم</th>
                      <th>الإجراء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingSettlements.map((settlement) => (
                      <tr key={settlement.id}>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {settlement.runner?.user?.name || `مندوب #${settlement.runnerId.slice(0, 8)}`}
                          </div>
                          {settlement.runner?.user?.whatsapp && (
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                              {settlement.runner.user.whatsapp}
                            </div>
                          )}
                        </td>
                        <td>{formatDate(settlement.operationalDate)}</td>
                        <td>{settlement.totalOrders}</td>
                        <td>{formatCurrency(settlement.totalFees)}</td>
                        <td>
                          <button
                            className="btn btn-success btn-sm"
                            onClick={() => handleMarkSettled(settlement.id)}
                            disabled={markSettledLoading === settlement.id}
                          >
                            {markSettledLoading === settlement.id ? 'جاري التأكيد...' : 'تأكيد التسوية'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* فلاتر التسويات */}
          <div className="filters flex-wrap">
            <div className="filter-group" style={{ flex: '0 0 150px' }}>
              <label className="label">الحالة</label>
              <select
                className="input"
                value={filters.status || ''}
                onChange={(e) => handleFilterChange('status', (e.target.value as SettlementStatus) || undefined)}
              >
                <option value="">الكل</option>
                {SETTLEMENT_STATUS_VALUES.map((st) => (
                  <option key={st} value={st}>
                    {SETTLEMENT_STATUS_LABEL[st]}
                  </option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <label className="label">معرف المندوب</label>
              <input
                className="input"
                type="text"
                placeholder="أدخل معرف المندوب"
                value={filters.runnerId}
                onChange={(e) => handleFilterChange('runnerId', e.target.value)}
              />
            </div>
            <div className="filter-group" style={{ flex: '0 0 180px' }}>
              <label className="label">من تاريخ</label>
              <input
                className="input"
                type="date"
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              />
            </div>
            <div className="filter-group" style={{ flex: '0 0 180px' }}>
              <label className="label">إلى تاريخ</label>
              <input
                className="input"
                type="date"
                value={filters.dateTo}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              />
            </div>
            <div className="filter-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setFilters({ status: undefined, runnerId: '', dateFrom: '', dateTo: '', page: 1, limit: 20 })}
              >
                مسح الفلاتر
              </button>
            </div>
          </div>

          {/* جدول التسويات الرئيسي */}
          <div className="card">
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                جاري التحميل...
              </div>
            ) : settlements.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📋</div>
                <p>لا توجد تسويات مطابقة للفلاتر</p>
              </div>
            ) : (
              <>
                <div className="table-container overflow-x-auto">
                  <table>
                    <thead>
                      <tr>
                        <th>التاريخ</th>
                        <th>المندوب</th>
                        <th>الحالة</th>
                        <th>الطلبات</th>
                        <th>إجمالي الرسوم</th>
                        <th>تاريخ الإغلاق</th>
                        <th>الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {settlements.map((settlement) => (
                        <tr key={settlement.id}>
                          <td>{formatDate(settlement.operationalDate)}</td>
                          <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{settlement.runnerId.slice(0, 12)}...</td>
                          <td>{getStatusBadge(settlement.status)}</td>
                          <td>{settlement.totalOrders}</td>
                          <td>{formatCurrency(settlement.totalFees)}</td>
                          <td>{settlement.closedAt ? formatDate(settlement.closedAt) : '-'}</td>
                          <td>
                            {settlement.status === 'PENDING' && (
                              <button
                                className="btn btn-success btn-sm"
                                onClick={() => handleMarkSettled(settlement.id)}
                                disabled={markSettledLoading === settlement.id}
                              >
                                {markSettledLoading === settlement.id ? 'جاري...' : 'تأكيد التسوية'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {meta.totalPages > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '24px' }}>
                    <button
                      className="btn btn-secondary btn-sm min-w-[80px]"
                      onClick={() => handlePageChange(meta.page - 1)}
                      disabled={meta.page === 1}
                    >
                      السابق
                    </button>
                    <span style={{ display: 'flex', alignItems: 'center', padding: '0 16px', color: 'var(--text-secondary)' }}>
                      صفحة {meta.page} من {meta.totalPages} (إجمالي: {meta.total})
                    </span>
                    <button
                      className="btn btn-secondary btn-sm min-w-[80px]"
                      onClick={() => handlePageChange(meta.page + 1)}
                      disabled={meta.page === meta.totalPages}
                    >
                      التالي
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* القسم الثاني: سجل Ledger */}
      {activeTab === 'ledger' && (
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">السجل المالي (Ledger)</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                سجل القيود المالية غير القابل للتعديل لجميع العمليات في النظام
              </p>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => fetchLedger(ledgerMeta.page)}
              disabled={ledgerLoading}
            >
              {ledgerLoading ? 'جاري التحديث...' : 'تحديث'}
            </button>
          </div>

          {ledgerLoading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              جاري تحميل قيود السجل المالي...
            </div>
          ) : ledgerEntries.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📊</div>
              <p>لا توجد قيود مالية مسجلة حتى الآن</p>
            </div>
          ) : (
            <>
              <div className="table-container overflow-x-auto">
                <table>
                  <thead>
                    <tr>
                      <th>التاريخ والوقت</th>
                      <th>النوع</th>
                      <th>المبلغ</th>
                      <th>الوصف</th>
                      <th>رقم الطلب المرتبط</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerEntries.map((entry) => (
                      <tr key={entry.id}>
                        <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(entry.createdAt)}</td>
                        <td>{getLedgerTypeBadge(entry.type)}</td>
                        <td style={{ fontWeight: 600, color: entry.type === 'PLATFORM_SHARE' ? '#166534' : 'var(--text-primary)' }}>
                          {formatCurrency(entry.amount)}
                        </td>
                        <td>{entry.description}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                          {entry.orderId ? (
                            <a
                              href={`/orders/${entry.orderId}`}
                              style={{ color: 'var(--primary)', textDecoration: 'underline' }}
                            >
                              {entry.orderId.slice(0, 10)}...
                            </a>
                          ) : (
                            '-'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {ledgerMeta.totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '24px' }}>
                  <button
                    className="btn btn-secondary btn-sm min-w-[80px]"
                    onClick={() => setLedgerMeta((prev) => ({ ...prev, page: prev.page - 1 }))}
                    disabled={ledgerMeta.page === 1}
                  >
                    السابق
                  </button>
                  <span style={{ display: 'flex', alignItems: 'center', padding: '0 16px', color: 'var(--text-secondary)' }}>
                    صفحة {ledgerMeta.page} من {ledgerMeta.totalPages} (إجمالي: {ledgerMeta.total})
                  </span>
                  <button
                    className="btn btn-secondary btn-sm min-w-[80px]"
                    onClick={() => setLedgerMeta((prev) => ({ ...prev, page: prev.page + 1 }))}
                    disabled={ledgerMeta.page === ledgerMeta.totalPages}
                  >
                    التالي
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Modal إغلاق اليوم */}
      {closeDayModal.open && (
        <div className="modal-overlay" onClick={() => setCloseDayModal({ open: false, date: '' })}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">إغلاق يوم تشغيلي</h3>
              <button className="modal-close" onClick={() => setCloseDayModal({ open: false, date: '' })}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="label">التاريخ التشغيلي</label>
                <input
                  className="input"
                  type="date"
                  value={closeDayModal.date}
                  onChange={(e) => setCloseDayModal({ open: true, date: e.target.value })}
                  max={today}
                />
              </div>
              <div className="form-group">
                <label className="label">ملاحظات (اختياري)</label>
                <textarea
                  className="input"
                  rows={3}
                  placeholder="أية ملاحظات حول إغلاق اليوم..."
                  value={closeDayNotes}
                  onChange={(e) => setCloseDayNotes(e.target.value)}
                />
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '16px' }}>
                سيتم إنشاء تسويات لجميع المندوبين الذين لديهم طلبات مكتملة (DELIVERED) في التاريخ المحدد.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setCloseDayModal({ open: false, date: '' })}>
                إلغاء
              </button>
              <button
                className="btn btn-primary"
                onClick={handleCloseDay}
                disabled={closeDayLoading}
              >
                {closeDayLoading ? 'جاري الإغلاق...' : 'إغلاق اليوم'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}




