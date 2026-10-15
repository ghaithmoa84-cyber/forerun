'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useToast } from '@/components/Toast';

import {
  ORDER_STATUS_VALUES,
  type AdminOrderListItem,
  type PaginatedResponse,
  type OrderStatus,
} from '@forerun/shared-types';

const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  DRAFT: 'مسودة',
  PENDING_REVIEW: 'بانتظار المراجعة',
  UNDER_REVIEW: 'قيد التدقيق',
  AWAITING_RUNNER: 'بانتظار كابتن',
  AWAITING_PREFERRED_RUNNER: 'بانتظار كابتن مفضل',
  ASSIGNED: 'معين لمندوب',
  IN_PROGRESS: 'جاري التنفيذ',
  OUT_FOR_DELIVERY: 'في الطريق للتسليم',
  DELIVERED: 'تم التسليم',
  CANCELLED: 'ملغي',
};

const ORDER_STATUS_STYLE: Record<OrderStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-700 border-slate-200',
  PENDING_REVIEW: 'bg-amber-50 text-amber-700 border-amber-200',
  UNDER_REVIEW: 'bg-sky-50 text-sky-700 border-sky-200',
  AWAITING_RUNNER: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  AWAITING_PREFERRED_RUNNER: 'bg-purple-50 text-purple-700 border-purple-200',
  ASSIGNED: 'bg-blue-50 text-blue-700 border-blue-200',
  IN_PROGRESS: 'bg-teal-50 text-teal-700 border-teal-200',
  OUT_FOR_DELIVERY: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  DELIVERED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELLED: 'bg-rose-50 text-rose-700 border-rose-200',
};

const ORDER_STATUS_DOT: Record<OrderStatus, string> = {
  DRAFT: 'bg-slate-400',
  PENDING_REVIEW: 'bg-amber-500 animate-pulse',
  UNDER_REVIEW: 'bg-sky-500',
  AWAITING_RUNNER: 'bg-indigo-500',
  AWAITING_PREFERRED_RUNNER: 'bg-purple-500',
  ASSIGNED: 'bg-blue-500',
  IN_PROGRESS: 'bg-teal-500',
  OUT_FOR_DELIVERY: 'bg-cyan-500',
  DELIVERED: 'bg-emerald-500',
  CANCELLED: 'bg-rose-500',
};

type OrdersApiResponse = PaginatedResponse<AdminOrderListItem>;

function toDamascusDateRange(dateStr: string) {
  // dateStr مثل "2026-09-21"
  const startDamascus = new Date(`${dateStr}T00:00:00+03:00`);
  const endDamascus = new Date(`${dateStr}T23:59:59.999+03:00`);
  return {
    from: startDamascus.toISOString(),
    to: endDamascus.toISOString(),
  };
}

export default function OrdersPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [orders, setOrders] = useState<AdminOrderListItem[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');

  // Debounce search query by 350ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 350);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const fetchOrders = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const params: Record<string, string | number> = { page, limit: 20 };
      if (statusFilter !== 'ALL') {
        params.status = statusFilter;
      }
      if (dateFilter) {
        const { from, to } = toDamascusDateRange(dateFilter);
        params.dateFrom = from;
        params.dateTo = to;
      }
      if (debouncedSearch.trim()) {
        params.search = debouncedSearch.trim();
      }

      const res = await api.get<OrdersApiResponse>('/admin/orders', { params });
      setOrders(res.data.data);
      setMeta(res.data.meta);
    } catch {
      showToast('تعذر تحميل قائمة الطلبات، يرجى التحقق من الخادم', 'error');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, dateFilter, debouncedSearch, showToast]);

  useEffect(() => {
    fetchOrders(1);
  }, [fetchOrders]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ar-SY', {
      style: 'currency',
      currency: 'SYP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr: string | Date): string => {
    try {
      return new Intl.DateTimeFormat('ar-SY', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(dateStr));
    } catch {
      return String(dateStr);
    }
  };

  const getStatusBadge = (status: OrderStatus) => {
    const label = ORDER_STATUS_LABEL[status] ?? status;
    const style = ORDER_STATUS_STYLE[status] ?? 'bg-slate-100 text-slate-700 border-slate-200';
    const dot = ORDER_STATUS_DOT[status] ?? 'bg-slate-400';
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${style}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${dot}`}></span>
        {label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">إدارة الطلبات والعمليات</h1>
          <p className="text-xs text-slate-500 mt-1">
            متابعة حالة الطلبات اللحظية، الرسوم، وتعيين المناديب
          </p>
        </div>
      </div>

      {/* Omni-Search & Controls Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Omni-Search Input */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="البحث برقم الطلب (مثال: FW-000001)، اسم العميل، أو رقم الهاتف..."
            className="w-full pr-10 pl-10 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 outline-hidden focus:border-[#7DDDD4] focus:ring-2 focus:ring-[#7DDDD4]/20 transition-all shadow-2xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
              aria-label="مسح البحث"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Date Filter */}
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-hidden focus:border-[#7DDDD4] shadow-2xs w-full sm:w-auto"
          />
          {dateFilter && (
            <button
              onClick={() => setDateFilter('')}
              className="text-xs text-slate-500 hover:text-slate-800 underline font-semibold whitespace-nowrap"
            >
              إلغاء التاريخ
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs derived directly from ORDER_STATUS_VALUES */}
      <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 text-xs font-medium shadow-xs overflow-x-auto">
        <button
          onClick={() => setStatusFilter('ALL')}
          className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
            statusFilter === 'ALL'
              ? 'bg-[#7DDDD4] text-white font-bold shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          كافة الطلبات
        </button>
        {ORDER_STATUS_VALUES.filter((s) => s !== 'DRAFT').map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
              statusFilter === status
                ? 'bg-[#7DDDD4] text-white font-bold shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            {ORDER_STATUS_LABEL[status]}
          </button>
        ))}
      </div>

      {/* Orders Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Mobile Cards (sm:hidden) */}
        <div className="sm:hidden p-4 space-y-3">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
              <span className="w-5 h-5 border-2 border-[#7DDDD4] border-t-transparent rounded-full animate-spin"></span>
              <span>جاري تحميل سجل الطلبات...</span>
            </div>
          ) : orders.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-xs">
              لا توجد طلبات تطابق معايير البحث الحالية.
            </div>
          ) : (
            orders.map((order) => (
              <div
                key={order.id}
                className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3"
              >
                {/* السطر الأول: رقم الطلب + شارة الحالة */}
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-slate-900 text-sm" dir="ltr">
                    #{order.orderNumber}
                  </span>
                  <div>{getStatusBadge(order.status)}</div>
                </div>

                {/* السطر الثاني: العميل */}
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">العميل</span>
                  <span className="font-bold text-slate-800">{order.customerName || 'عميل'}</span>
                </div>

                {/* السطر الثالث: المندوب */}
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">المندوب</span>
                  <span className="font-semibold text-slate-700">
                    {order.runnerName ? (
                      `🏃 ${order.runnerName}`
                    ) : order.preferredRunner?.name ? (
                      <span className="text-purple-600 font-medium">⭐ المفضل: {order.preferredRunner.name}</span>
                    ) : (
                      <span className="text-slate-400 italic">لم يُعيّن</span>
                    )}
                  </span>
                </div>

                {/* السطر الرابع: الرسوم + التاريخ */}
                <div className="flex justify-between items-center text-xs pt-2 border-t border-slate-100">
                  <span className="font-bold text-slate-900">{formatCurrency(order.totalFee)}</span>
                  <span className="text-slate-400 text-[11px] font-mono">{formatDate(order.createdAt)}</span>
                </div>

                {/* زر التفاصيل */}
                <Link
                  href={`/orders/${order.id}`}
                  className="w-full inline-flex items-center justify-center px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-lg border border-slate-200 transition-colors"
                >
                  <span>عرض التفاصيل</span>
                  <span className="text-xs mr-1">←</span>
                </Link>
              </div>
            ))
          )}
        </div>

        {/* Desktop Table (hidden sm:block) */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50/75 border-b border-slate-200 text-slate-600 font-bold">
              <tr>
                <th className="px-5 py-3.5">رقم الطلب</th>
                <th className="px-5 py-3.5">العميل</th>
                <th className="px-5 py-3.5">المندوب المعين</th>
                <th className="px-5 py-3.5">الحالة</th>
                <th className="px-5 py-3.5">الرسوم الإجمالية</th>
                <th className="px-5 py-3.5">تاريخ الطلب</th>
                <th className="px-5 py-3.5 text-center">التفاصيل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-[#7DDDD4] border-t-transparent rounded-full animate-spin"></span>
                      <span>جاري تحميل سجل الطلبات...</span>
                    </div>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                    لا توجد طلبات تطابق معايير البحث الحالية.
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr
                    key={order.id}
                    onClick={() => router.push(`/orders/${order.id}`)}
                    className="hover:bg-slate-50/70 transition-colors cursor-pointer group"
                  >
                    <td className="px-5 py-4 font-extrabold text-slate-900 group-hover:text-[#7DDDD4] transition-colors" dir="ltr">
                      {order.orderNumber}
                    </td>
                    <td className="px-5 py-4 font-bold text-slate-800">
                      {order.customerName || 'عميل'}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {order.runnerName ? (
                        <span className="font-semibold text-slate-800">🏃 {order.runnerName}</span>
                      ) : order.preferredRunner?.name ? (
                        <div className="flex flex-col">
                          <span className="text-slate-400 italic">لم يُعيّن</span>
                          <span className="text-[11px] text-purple-600 font-medium">
                            ⭐ المفضل: {order.preferredRunner.name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">لم يُعيّن</span>
                      )}
                    </td>
                    <td className="px-5 py-4">{getStatusBadge(order.status)}</td>
                    <td className="px-5 py-4 font-bold text-slate-900">
                      {formatCurrency(order.totalFee)}
                    </td>
                    <td className="px-5 py-4 text-slate-500">{formatDate(order.createdAt)}</td>
                    <td className="px-5 py-4 text-center">
                      <span className="inline-flex items-center gap-1 text-[#7DDDD4] font-bold group-hover:underline">
                        عرض التفاصيل
                        <span className="text-xs">←</span>
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-5 py-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 bg-slate-50/50">
          <div className="text-center sm:text-right w-full sm:w-auto">
            إجمالي الطلبات: <span className="font-bold text-slate-800">{meta.total}</span> (صفحة{' '}
            <span className="font-bold text-slate-800">{meta.page}</span> من{' '}
            <span className="font-bold text-slate-800">{meta.totalPages || 1}</span>)
          </div>

          <div className="flex items-center justify-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => fetchOrders(meta.page - 1)}
              disabled={meta.page <= 1 || loading}
              className="w-full sm:w-auto px-4 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed justify-center inline-flex items-center"
            >
              السابق
            </button>
            <button
              onClick={() => fetchOrders(meta.page + 1)}
              disabled={meta.page >= meta.totalPages || loading}
              className="w-full sm:w-auto px-4 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed justify-center inline-flex items-center"
            >
              التالي
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}





