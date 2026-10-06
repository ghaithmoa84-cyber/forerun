'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { useToast } from '@/components/Toast';
import { useAdminWebSocket } from '@/hooks/useAdminWebSocket';
import {
  ADMIN_EVENTS,
  type Settlement,
  type OrderNewPayload,
  type OrderStatusChangedPayload,
  type UserNewRegistrationPayload,
  type OrderStatus,
  type RunnerStatus,
} from '@forerun/shared-types';

interface PendingOrderItem {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  customerId: string;
  customerName: string;
  itemCount: number;
  totalFee: number;
  createdAt: string;
}

interface DashboardStats {
  todayTotalFees: number;
  pendingSettlements: number;
  runnersAvailable: number;
  runnersOnMission: number;
  runnersUnavailable: number;
  activeOrdersCount: number; // IN_PROGRESS + OUT_FOR_DELIVERY
  totalPendingReviewOrders: number; // PENDING_REVIEW + UNDER_REVIEW
}

const PAGE_SIZE = 100;

interface PaginatedResponse<T> {
  data: T[];
  meta?: {
    total?: number;
    totalPages?: number;
    page?: number;
  };
}

async function fetchAllPages<T>(
  url: string,
  params: Record<string, unknown>,
): Promise<T[]> {
  const result: T[] = [];
  let page = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await api.get<PaginatedResponse<T>>(url, {
      params: { ...params, page, limit: PAGE_SIZE },
    });
    const items = res.data?.data ?? [];
    result.push(...items);
    const totalPages = res.data?.meta?.totalPages ?? 0;
    if (page >= totalPages || items.length < PAGE_SIZE) break;
    page++;
  }
  return result;
}

function playNewOrderSound() {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
    osc.frequency.linearRampToValueAtTime(783.99, ctx.currentTime + 0.25); // G5

    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    // Autoplay policy or audio device unavailable
  }
}

function formatTimeAgo(dateStr: string | Date) {
  try {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'الآن';
    if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `منذ ${diffHours} ساعة`;
    const diffDays = Math.floor(diffHours / 24);
    return `منذ ${diffDays} يوم`;
  } catch {
    return 'مؤخراً';
  }
}

export default function DashboardPage() {
  const { showToast } = useToast();
  const { on, isConnected } = useAdminWebSocket();

  const [pendingOrders, setPendingOrders] = useState<PendingOrderItem[]>([]);
  const [highlightedOrderIds, setHighlightedOrderIds] = useState<Set<string>>(new Set());

  const [stats, setStats] = useState<DashboardStats>({
    todayTotalFees: 0,
    pendingSettlements: 0,
    runnersAvailable: 0,
    runnersOnMission: 0,
    runnersUnavailable: 0,
    activeOrdersCount: 0,
    totalPendingReviewOrders: 0,
  });

  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ar-SY', {
      style: 'currency',
      currency: 'SYP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Fetch pending review orders for Area 1
  const fetchPendingOrders = useCallback(async () => {
    try {
      setOrdersLoading(true);
      const [list1, list2, total1, total2] = await Promise.all([
        fetchAllPages<PendingOrderItem>('/admin/orders', { status: 'PENDING_REVIEW' }),
        fetchAllPages<PendingOrderItem>('/admin/orders', { status: 'UNDER_REVIEW' }),
        api.get('/admin/orders', { params: { status: 'PENDING_REVIEW', limit: 1 } }).then(
          (res) => res.data?.meta?.total ?? 0,
        ),
        api.get('/admin/orders', { params: { status: 'UNDER_REVIEW', limit: 1 } }).then(
          (res) => res.data?.meta?.total ?? 0,
        ),
      ]);

      // Combine and sort oldest first (longest waiting at top)
      const combined = [...list1, ...list2].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );

      setPendingOrders(combined);
      setStats((prev) => ({ ...prev, totalPendingReviewOrders: total1 + total2 }));
    } catch (err) {
      console.error('Failed to fetch pending review orders:', err);
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  // Fetch quick metrics for Area 2
  const fetchStats = useCallback(async () => {
    try {
      setError(null);

      const today = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Damascus',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());

      const [
        settlements,
        runnersList,
        inProgressRes,
        outForDeliveryRes,
        pendingSettlementsRes,
      ] = await Promise.all([
        fetchAllPages<Settlement>('/admin/settlements', {
          dateFrom: today,
          dateTo: today,
        }),
        fetchAllPages<{ id: string; status: RunnerStatus }>('/admin/runners', {}),
        api.get('/admin/orders', {
          params: { status: 'IN_PROGRESS', limit: 1 },
        }),
        api.get('/admin/orders', {
          params: { status: 'OUT_FOR_DELIVERY', limit: 1 },
        }),
        api.get('/admin/settlements/pending', {
          params: { limit: 1 },
        }),
      ]);

      const todayTotalFees = settlements.reduce(
        (sum: number, s: Settlement) => sum + (s.totalFees ?? 0),
        0,
      );
      const pendingSettlements = pendingSettlementsRes.data?.meta?.total ?? 0;

      const runnersAvailable = runnersList.filter(
        (r) => r.status === 'AVAILABLE',
      ).length;
      const runnersOnMission = runnersList.filter(
        (r) => r.status === 'ON_MISSION',
      ).length;
      const runnersUnavailable = runnersList.filter(
        (r) => r.status === 'UNAVAILABLE',
      ).length;

      const inProgressCount = inProgressRes.data?.meta?.total || 0;
      const outForDeliveryCount = outForDeliveryRes.data?.meta?.total || 0;
      const activeOrdersCount = inProgressCount + outForDeliveryCount;

      setStats((prev) => ({
        ...prev,
        todayTotalFees,
        pendingSettlements,
        runnersAvailable,
        runnersOnMission,
        runnersUnavailable,
        activeOrdersCount,
      }));
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      setError(axiosError.response?.data?.message || 'فشل في تحديث بيانات الإحصائيات');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + periodic polling fallback
  useEffect(() => {
    fetchPendingOrders();
    fetchStats();
    const interval = setInterval(() => {
      fetchPendingOrders();
      fetchStats();
    }, 20000);
    return () => clearInterval(interval);
  }, [fetchPendingOrders, fetchStats]);

  // WebSocket real-time event listeners
  useEffect(() => {
    if (!isConnected) return;

    // 1. ORDER_NEW: sound + highlight + instant counter update
    const unbindNewOrder = on<OrderNewPayload>(ADMIN_EVENTS.ORDER_NEW, (payload) => {
      playNewOrderSound();

      // Highlight new order for 5 seconds
      const newId = payload.orderId;
      setHighlightedOrderIds((prev) => new Set(prev).add(newId));
      setTimeout(() => {
        setHighlightedOrderIds((prev) => {
          const next = new Set(prev);
          next.delete(newId);
          return next;
        });
      }, 5000);

      showToast(
        `⚡ طلب جديد #${payload.orderNumber} من ${payload.customerName} (${payload.itemCount} عناصر)`,
        'urgent',
      );

      // Refresh table and counter immediately
      fetchPendingOrders();
      fetchStats();
    });

    // 2. ORDER_STATUS_CHANGED: update tables & stats
    const unbindStatusChanged = on<OrderStatusChangedPayload>(
      ADMIN_EVENTS.ORDER_STATUS_CHANGED,
      (payload) => {
        showToast(
          `تغيرت حالة الطلب #${payload.orderNumber} إلى ${payload.newStatus}`,
          'info',
        );
        fetchPendingOrders();
        fetchStats();
      },
    );

    // 3. USER_NEW_REGISTRATION: toast notification
    const unbindUserReg = on<UserNewRegistrationPayload>(
      ADMIN_EVENTS.USER_NEW_REGISTRATION,
      (payload) => {
        showToast(
          `عميل جديد بانتظار التفعيل: ${payload.userName} (${payload.whatsapp})`,
          'urgent',
        );
      },
    );

    return () => {
      unbindNewOrder();
      unbindStatusChanged();
      unbindUserReg();
    };
  }, [isConnected, on, showToast, fetchPendingOrders, fetchStats]);

  return (
    <div className="space-y-8">
      {/* Top Header & Connection Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">لوحة التحكم المركزية</h1>
          <p className="text-xs text-slate-500 mt-1">
            إدارة مباشرة للطلبات الواردة، متابعة الكباتن، ومراقبة الإيرادات اللحظية
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border ${
              isConnected
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-emerald-500 animate-ping' : 'bg-amber-500'
              }`}
            ></span>
            <span>{isConnected ? 'المراقبة اللحظية متصلة' : 'جاري إعادة الاتصال...'}</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
          {error}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* المنطقة الأولى — "تحتاج إجراءً الآن" (60% من الشاشة، أعلى الصفحة) */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center text-xl font-black">
              ⏳
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">تحتاج إجراءً الآن</h2>
              <p className="text-xs text-slate-500">
                الطلبات بانتظار التدقيق والاعتماد لبدء تعيين الكباتن والتوصيل (الأقدم أولاً)
              </p>
            </div>
          </div>

          {/* Prominent Counter Badge */}
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 px-4 py-2 rounded-xl">
            <span className="text-xs font-bold text-amber-800">
              {stats.totalPendingReviewOrders} طلب ينتظر مراجعتك
            </span>
          </div>
        </div>

        {/* Live Pending Orders Table */}
        <div className="overflow-x-auto">
          {ordersLoading && pendingOrders.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
              <span className="w-6 h-6 border-2 border-[#7DDDD4] border-t-transparent rounded-full animate-spin"></span>
              <span>جاري تحميل الطلبات الواردة...</span>
            </div>
          ) : pendingOrders.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-sm font-medium">
              🎉 رائع! لا توجد أي طلبات معلقة بانتظار المراجعة حالياً.
            </div>
          ) : (
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-bold text-slate-500 bg-slate-50/70">
                  <th className="py-3 px-4 rounded-r-xl">رقم الطلب</th>
                  <th className="py-3 px-4">اسم العميل</th>
                  <th className="py-3 px-4">منذ</th>
                  <th className="py-3 px-4">عدد المواد</th>
                  <th className="py-3 px-4">الحالة</th>
                  <th className="py-3 px-4 text-left rounded-l-xl">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-semibold">
                {pendingOrders.map((order) => {
                  const isHighlighted = highlightedOrderIds.has(order.id);
                  return (
                    <tr
                      key={order.id}
                      className={`transition-colors duration-500 ${
                        isHighlighted
                          ? 'bg-[#7DDDD4]/15 ring-2 ring-[#7DDDD4]'
                          : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-800" dir="ltr">
                        #{order.orderNumber}
                      </td>
                      <td className="py-3.5 px-4 text-slate-900 font-bold">
                        {order.customerName || 'عميل فَوْراً'}
                      </td>
                      <td className="py-3.5 px-4 text-amber-700 font-bold">
                        {formatTimeAgo(order.createdAt)}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {order.itemCount} مواد
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          {order.status === 'PENDING_REVIEW' ? 'بانتظار المراجعة' : 'قيد التدقيق'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-left">
                        <Link
                          href={`/orders/${order.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#7DDDD4] hover:bg-[#5CCFC5] text-white font-bold rounded-lg text-xs shadow-xs transition-transform active:scale-95"
                        >
                          <span>راجع</span>
                          <span>←</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* المنطقة الثانية — إحصائيات سريعة (40% ، أسفل الصفحة)           */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <section className="space-y-4">
        <h2 className="text-base font-bold text-slate-900">إحصائيات سريعة ومباشرة</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Card 1: المندوبون (متاح / في مهمة / غير متاح) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">حالة المندوبين</span>
              <span className="text-lg">🛵</span>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-emerald-600">🟢 متاح:</span>
                <span className="text-slate-900 font-black">{loading ? '-' : stats.runnersAvailable}</span>
              </div>
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-amber-600">🟡 في مهمة:</span>
                <span className="text-slate-900 font-black">{loading ? '-' : stats.runnersOnMission}</span>
              </div>
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-400">⚪ غير متاح:</span>
                <span className="text-slate-900 font-black">{loading ? '-' : stats.runnersUnavailable}</span>
              </div>
            </div>
          </div>

          {/* Card 2: الطلبات الجارية (IN_PROGRESS + OUT_FOR_DELIVERY) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">الطلبات الجارية حالياً</span>
              <span className="text-lg">⚡</span>
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900">
                {loading ? '-' : `${stats.activeOrdersCount} طلب`}
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">
                جاري الشراء أو في الطريق للتسليم
              </span>
            </div>
          </div>

          {/* Card 3: إجمالي رسوم اليوم */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">إجمالي رسوم اليوم</span>
              <span className="text-lg">💰</span>
            </div>
            <div>
              <div className="text-2xl font-black text-emerald-600">
                {loading ? '-' : formatCurrency(stats.todayTotalFees)}
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">
                إجمالي رسوم التوصيل المحققة اليوم
              </span>
            </div>
          </div>

          {/* Card 4: التسويات المعلقة */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">التسويات المعلقة</span>
              <span className="text-lg">📊</span>
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900">
                {loading ? '-' : `${stats.pendingSettlements} تسوية`}
              </div>
              <Link
                href="/settlements"
                className="text-[11px] font-bold text-[#7DDDD4] hover:underline mt-1 inline-block"
              >
                إدارة التسويات المعلقة ←
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}




