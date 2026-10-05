'use client';
/* eslint-disable @next/next/no-img-element */

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import api from '@/lib/api';
import { useToast } from '@/components/Toast';
import { OrderMap } from '@/components/OrderMap';

import type {
  AdminOrderDetails,
  AdminOrderAuditEntry,
  AvailableRunner,
  OrderStatus,
  OrderStoreStatus,
  RunnerStatus,
  FeePreviewResponse,
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

const ORDER_STORE_STATUS_LABEL: Record<OrderStoreStatus, string> = {
  PENDING: 'قيد الانتظار',
  PURCHASED: 'تم الشراء',
  SKIPPED: 'تم التخطي',
};

const RUNNER_STATUS_LABEL: Record<RunnerStatus, string> = {
  AVAILABLE: 'متاح',
  ON_MISSION: 'في مهمة',
  UNAVAILABLE: 'غير متاح',
};

const CANCELLABLE_STATUSES: OrderStatus[] = ['ASSIGNED', 'IN_PROGRESS', 'OUT_FOR_DELIVERY'];

type AuditLogEntry = AdminOrderAuditEntry;

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const orderId = params.id;
  const { showToast } = useToast();

  const [order, setOrder] = useState<AdminOrderDetails | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [availableRunners, setAvailableRunners] = useState<AvailableRunner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Action states
  const [actionLoading, setActionLoading] = useState(false);
  const [isPeripheralChecked, setIsPeripheralChecked] = useState(false);
  const [baseFeeInput, setBaseFeeInput] = useState<number | string>('');
  const [customFeeInput, setCustomFeeInput] = useState<number | string>(0);
  const [customFeeReasonInput, setCustomFeeReasonInput] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewResult, setPreviewResult] = useState<FeePreviewResponse | null>(null);

  const [rejectReason, setRejectReason] = useState('');
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [selectedRunnerId, setSelectedRunnerId] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const fetchOrderData = useCallback(async () => {
    if (!orderId) return;
    try {
      setLoading(true);
      setError(null);
      const [orderRes, auditRes, runnersRes] = await Promise.all([
        api.get<AdminOrderDetails>(`/admin/orders/${orderId}`),
        api.get<AuditLogEntry[]>(`/admin/orders/${orderId}/audit`),
        api.get<{ data: AvailableRunner[] }>('/admin/runners', { params: { limit: 100 } }),
      ]);

      const data = orderRes.data;
      setOrder(data);
      setIsPeripheralChecked(data.isPeripheral);
      setBaseFeeInput(data.baseFee);
      setCustomFeeInput(data.customFee ?? 0);
      setCustomFeeReasonInput(data.customFeeReason ?? '');

      setAuditLogs(auditRes.data);
      const runners = runnersRes.data?.data || [];
      setAvailableRunners(runners.filter((r) => r.status === 'AVAILABLE'));
    } catch {
      setError('تعذّر تحميل الطلب');
      showToast('تعذر تحميل تفاصيل الطلب، يرجى المحاولة لاحقاً', 'error');
    } finally {
      setLoading(false);
    }
  }, [orderId, showToast]);

  useEffect(() => {
    fetchOrderData();
  }, [fetchOrderData]);

  const orderStatus = order?.status;

  // Live fee preview with 400ms debounce during PENDING_REVIEW and UNDER_REVIEW
  useEffect(() => {
    if (!orderId || !orderStatus) return;
    if (orderStatus !== 'PENDING_REVIEW' && orderStatus !== 'UNDER_REVIEW') {
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setPreviewLoading(true);
        setPreviewError(null);
        const parsedBase =
          baseFeeInput !== '' && !isNaN(Number(baseFeeInput))
            ? Number(baseFeeInput)
            : undefined;
        const parsedCustom =
          customFeeInput !== '' && !isNaN(Number(customFeeInput))
            ? Number(customFeeInput)
            : 0;

        const res = await api.post<FeePreviewResponse>(
          `/admin/orders/${orderId}/fee-preview`,
          {
            isPeripheral: isPeripheralChecked,
            baseFee: parsedBase,
            customFee: parsedCustom,
            customFeeReason:
              parsedCustom > 0 ? customFeeReasonInput.trim() : undefined,
          },
        );
        setPreviewResult(res.data);
      } catch (err: unknown) {
        const axiosError = err as {
          response?: { data?: { message?: string } };
        };
        setPreviewError(
          axiosError?.response?.data?.message || 'تعذر حساب معاينة الرسوم',
        );
      } finally {
        setPreviewLoading(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [
    orderId,
    orderStatus,
    baseFeeInput,
    isPeripheralChecked,
    customFeeInput,
    customFeeReasonInput,
  ]);

  const handleApprove = async () => {
    try {
      setActionLoading(true);
      const parsedBase =
        baseFeeInput !== '' && !isNaN(Number(baseFeeInput))
          ? Number(baseFeeInput)
          : undefined;
      const parsedCustom =
        customFeeInput !== '' && !isNaN(Number(customFeeInput))
          ? Number(customFeeInput)
          : 0;

      if (parsedCustom > 0 && !customFeeReasonInput.trim()) {
        showToast('يجب إدخال سبب عند تحديد رسم إضافي للطلب', 'info');
        setActionLoading(false);
        return;
      }

      await api.put(`/admin/orders/${orderId}/approve`, {
        isPeripheral: isPeripheralChecked,
        baseFee: parsedBase,
        customFee: parsedCustom,
        customFeeReason:
          parsedCustom > 0 ? customFeeReasonInput.trim() : undefined,
      });
      showToast('تم اعتماد الطلب وتحويله للبحث عن مندوب', 'success');
      fetchOrderData();
    } catch (err: unknown) {
      const axiosError = err as {
        response?: { data?: { message?: string } };
      };
      showToast(
        axiosError?.response?.data?.message || 'فشل في اعتماد الطلب',
        'error',
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      showToast('يرجى كتابة سبب الرفض', 'info');
      return;
    }
    try {
      setActionLoading(true);
      await api.put(`/admin/orders/${orderId}/reject`, {
        reason: rejectReason.trim(),
      });
      showToast('تم رفض الطلب', 'info');
      setIsRejectOpen(false);
      fetchOrderData();
    } catch {
      showToast('فشل في رفض الطلب', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssignRunner = async () => {
    if (!selectedRunnerId) {
      showToast('يرجى اختيار مندوب أولاً', 'info');
      return;
    }
    try {
      setActionLoading(true);
      await api.put(`/admin/orders/${orderId}/assign-runner`, {
        runnerId: selectedRunnerId,
      });
      showToast('تم تعيين المندوب وإرسال إشعار الطلب بنجاح', 'success');
      setSelectedRunnerId('');
      fetchOrderData();
    } catch {
      showToast('فشل في تعيين المندوب للطلب', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelOrder = async () => {
    try {
      setActionLoading(true);
      await api.put(`/admin/orders/${orderId}/cancel`, {
        cancelReason: cancelReason.trim() || undefined,
      });
      showToast('تم إلغاء الطلب بنجاح', 'info');
      setIsCancelOpen(false);
      fetchOrderData();
    } catch {
      showToast('فشل في إلغاء الطلب', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ar-SY', {
      style: 'currency',
      currency: 'SYP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr: string | Date) => {
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

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-3">
        <span className="w-6 h-6 border-2 border-[#7DDDD4] border-t-transparent rounded-full animate-spin"></span>
        <span className="text-xs font-bold text-slate-500">جاري تحميل تفاصيل الطلب...</span>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-4 text-center">
        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center text-xl font-bold">
          ⚠️
        </div>
        <p className="text-sm font-bold text-slate-800">
          {error || 'تعذّر تحميل الطلب'}
        </p>
<button
              onClick={fetchOrderData}
              className="px-4 py-2 bg-[#7DDDD4] hover:bg-[#5CCFC5] text-white font-bold rounded-xl text-xs transition-colors shadow-xs"
            >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Status Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <Link href="/orders" className="hover:text-slate-900 font-bold">
              ← قائمة الطلبات
            </Link>
            <span>/</span>
            <span className="text-slate-700 font-extrabold" dir="ltr">
              #{order.orderNumber}
            </span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <h1 className="text-xl font-black text-slate-900" dir="ltr">
              طلب #{order.orderNumber}
            </h1>
            <span className={`px-3 py-1 rounded-full text-xs font-extrabold border w-fit ${ORDER_STATUS_STYLE[order.status]}`}>
              {ORDER_STATUS_LABEL[order.status]}
            </span>
          </div>
        </div>

        {/* Dynamic Action Buttons based on Status */}
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 w-full sm:w-auto">
          {(order.status === 'PENDING_REVIEW' || order.status === 'UNDER_REVIEW') && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 bg-slate-50 p-2 rounded-xl border border-slate-200 w-full sm:w-auto">
              <label className="flex items-center justify-center sm:justify-start gap-1.5 text-xs font-bold text-slate-700 cursor-pointer py-1">
                <input
                  type="checkbox"
                  checked={isPeripheralChecked}
                  onChange={(e) => setIsPeripheralChecked(e.target.checked)}
                  className="rounded text-[#7DDDD4] focus:ring-[#7DDDD4]"
                />
                <span>منطقة نائية (طرفية)</span>
              </label>

              <button
                onClick={handleApprove}
                disabled={actionLoading}
                className="w-full sm:w-auto inline-flex items-center justify-center px-3.5 py-2 sm:py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs shadow-xs disabled:opacity-50"
              >
                اعتماد الطلب
              </button>

              <button
                onClick={() => setIsRejectOpen(true)}
                disabled={actionLoading}
                className="w-full sm:w-auto inline-flex items-center justify-center px-3.5 py-2 sm:py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold rounded-lg text-xs disabled:opacity-50"
              >
                رفض
              </button>
            </div>
          )}

          {(order.status === 'AWAITING_RUNNER' ||
            order.status === 'AWAITING_PREFERRED_RUNNER') && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              <select
                value={selectedRunnerId}
                onChange={(e) => setSelectedRunnerId(e.target.value)}
                className="w-full sm:w-auto px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-hidden focus:border-[#7DDDD4]"
              >
                <option value="">-- اختيار مندوب للتعيين --</option>
                {availableRunners.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({RUNNER_STATUS_LABEL[r.status as RunnerStatus] ?? r.status})
                  </option>
                ))}
              </select>

              <button
                onClick={handleAssignRunner}
                disabled={actionLoading || !selectedRunnerId}
                className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 bg-[#7DDDD4] hover:bg-[#5CCFC5] text-white font-bold rounded-xl text-xs shadow-md disabled:opacity-50"
              >
                تعيين المندوب
              </button>
            </div>
          )}

          {CANCELLABLE_STATUSES.includes(order.status) && (
            <button
              onClick={() => setIsCancelOpen(true)}
              disabled={actionLoading}
              className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold rounded-xl text-xs transition-all disabled:opacity-50"
            >
              إلغاء الطلب إدارياً
            </button>
          )}
        </div>
      </div>

      {/* Fee Review & Live Preview Card (Sprint 6A-8) */}
      {(order.status === 'PENDING_REVIEW' || order.status === 'UNDER_REVIEW') && (
        <div className="bg-white rounded-2xl border-2 border-[#7DDDD4]/40 p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-slate-100 gap-2">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#7DDDD4] inline-block animate-pulse"></span>
                مراجعة وتعديل رسوم الطلب والمعاينة المباشرة
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                يمكنك تعديل الرسم الأساسي أو تعيين المنطقة الطرفية أو إضافة رسم إضافي مع المعاينة الفورية قبل الاعتماد.
              </p>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 w-fit">
              {ORDER_STATUS_LABEL[order.status]}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Base Fee Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                الرسم الأساسي (ل.س)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={1}
                  max={1000}
                  step={1}
                  value={baseFeeInput}
                  onChange={(e) => setBaseFeeInput(e.target.value)}
                  placeholder={String(order.baseFee)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-hidden focus:border-[#7DDDD4] focus:bg-white"
                />
                <span className="absolute left-3 top-2 text-[11px] text-slate-400 font-bold pointer-events-none">
                  ل.س
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                الافتراضي للطلب: {order.baseFee} ل.س
              </p>
            </div>

            {/* Peripheral Area Checkbox */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                المنطقة الجغرافية
              </label>
              <label className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-300 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                <input
                  type="checkbox"
                  checked={isPeripheralChecked}
                  onChange={(e) => setIsPeripheralChecked(e.target.checked)}
                  className="rounded text-[#7DDDD4] focus:ring-[#7DDDD4] w-4 h-4"
                />
                <span className="text-xs font-bold text-slate-700">
                  منطقة نائية (طرفية)
                </span>
              </label>
              <p className="text-[11px] text-slate-400">
                تضيف رسم المنطقة الطرفية إن كانت الوجهة خارج المدينة
              </p>
            </div>

            {/* Custom Fee Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                رسم إضافي خاص (customFee)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={500}
                  step={1}
                  value={customFeeInput}
                  onChange={(e) => setCustomFeeInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-hidden focus:border-[#7DDDD4] focus:bg-white"
                />
                <span className="absolute left-3 top-2 text-[11px] text-slate-400 font-bold pointer-events-none">
                  ل.س
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                الحد الأقصى: 500 ل.س (يتطلب توضيح السبب)
              </p>
            </div>
          </div>

          {/* Custom Fee Reason Input (Shown ONLY if customFee > 0) */}
          {Number(customFeeInput) > 0 && (
            <div className="space-y-1.5 p-3.5 bg-amber-50/50 border border-amber-200 rounded-xl">
              <label className="block text-xs font-bold text-amber-900">
                سبب الرسم الإضافي (إلزامي للعميل)
                <span className="text-rose-500 mr-1">*</span>
              </label>
              <input
                type="text"
                maxLength={200}
                value={customFeeReasonInput}
                onChange={(e) => setCustomFeeReasonInput(e.target.value)}
                placeholder="مثال: حمولة ثقيلة أو طلب بعد منتصف الليل أو منطقة وعرة..."
                required
                className="w-full px-3.5 py-2 bg-white border border-amber-300 rounded-xl text-xs font-bold text-slate-800 outline-hidden focus:border-amber-500"
              />
              <p className="text-[11px] text-amber-700">
                يظهر هذا السبب في تفاصيل الطلب لدى العميل لتبرير الزيادة.
              </p>
            </div>
          )}

          {/* Live Preview Display Box */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span className="flex items-center gap-2">
                <span>معاينة الرسوم الحية المباشرة (Live Preview):</span>
                {previewLoading && (
                  <span className="text-slate-400 font-normal flex items-center gap-1">
                    <span className="w-3 h-3 border-2 border-[#7DDDD4] border-t-transparent rounded-full animate-spin"></span>
                    جاري الحساب...
                  </span>
                )}
              </span>
              {previewResult && (
                <span className="text-slate-400 font-normal text-[11px]">
                  متاجر الطلب: {order.orderStores.length}
                </span>
              )}
            </div>

            {previewError ? (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs font-bold">
                ⚠️ {previewError}
              </div>
            ) : previewResult ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[11px] text-slate-400 block font-medium">إجمالي الرسم</span>
                  <span className="text-base font-black text-[#3ABFB5]">
                    {formatCurrency(previewResult.totalFee)}
                  </span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[11px] text-slate-400 block font-medium">حصة الكابتن (75%)</span>
                  <span className="text-sm font-black text-emerald-600">
                    {formatCurrency(previewResult.runnerShare)}
                  </span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[11px] text-slate-400 block font-medium">حصة المنصة (25%)</span>
                  <span className="text-sm font-black text-slate-700">
                    {formatCurrency(previewResult.platformShare)}
                  </span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-center text-[11px] text-slate-500 font-medium space-y-0.5">
                  <div>أساسي: {previewResult.baseFee} ل.س</div>
                  <div>طرفي: {previewResult.peripheralFee} ل.س | إضافي: {previewResult.customFee} ل.س</div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-400">جاري إعداد المعاينة...</div>
            )}
          </div>

          {/* Action Buttons in Card */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-1">
            <button
              onClick={() => setIsRejectOpen(true)}
              disabled={actionLoading}
              className="w-full sm:w-auto px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold rounded-xl text-xs transition-colors disabled:opacity-50"
            >
              رفض الطلب
            </button>
            <button
              onClick={handleApprove}
              disabled={actionLoading || previewLoading}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs shadow-md transition-all disabled:opacity-50"
            >
              {actionLoading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>جاري الاعتماد...</span>
                </>
              ) : (
                <span>اعتماد الطلب بالرسوم المعروضة</span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Grid: Order Info & Map */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Order & Parties Metadata */}
        <div className="lg:col-span-1 space-y-6">
          {/* Customer & Runner Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2.5">
              الأطراف المعنية
            </h2>

            {/* Customer */}
            <div>
              <span className="text-[11px] font-bold text-slate-400 block mb-1">العميل</span>
              <div className="font-bold text-slate-800 text-sm">{order.customer.name}</div>
              <div className="text-xs text-slate-500 font-mono mt-0.5" dir="ltr">
                {order.customer.whatsapp}
              </div>
            </div>

            {/* Runner */}
            <div className="pt-2 border-t border-slate-100">
              <span className="text-[11px] font-bold text-slate-400 block mb-1">
                المندوب المعين
              </span>
              {order.runner ? (
                <div>
                  <div className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                    <span>🏃 {order.runner.name}</span>
                    <span className="text-amber-500 text-xs">
                      ★ {order.runner.avgRating ? order.runner.avgRating.toFixed(1) : 'جديد'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    الحالة: {RUNNER_STATUS_LABEL[order.runner.status as RunnerStatus] ?? order.runner.status}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-400 italic">لم يتم تعيين مندوب بعد</div>
              )}
            </div>

            {/* Preferred Runner Details */}
            {(order.preferredRunnerId || order.waitForPreferred) && (
              <div className="pt-2 border-t border-slate-100 bg-purple-50/50 p-2.5 rounded-xl border text-xs">
                <span className="text-[11px] font-bold text-purple-700 block mb-1">
                  ⭐ تفضيل المندوب
                </span>
                <div className="text-purple-900 space-y-0.5">
                  {order.preferredRunnerId && (
                    <div>
                      المندوب المفضل:{' '}
                      <span className="font-bold">
                        {order.preferredRunner?.name || '—'}
                      </span>
                    </div>
                  )}
                  <div>
                    الانتظار: {order.waitForPreferred ? 'العميل فضّل انتظار كابتنه المفضل' : 'لا ينتظر (أي كابتن متاح)'}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Fees Breakdown Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2.5">
              تفاصيل الرسوم المالية
            </h2>

            <div className="flex justify-between text-xs text-slate-600">
              <span>الرسوم الأساسية:</span>
              <span className="font-bold">{formatCurrency(order.baseFee)}</span>
            </div>

            <div className="flex justify-between text-xs text-slate-600">
              <span>رسوم المنطقة الطرفية:</span>
              <span className="font-bold">{formatCurrency(order.peripheralFee)}</span>
            </div>

            <div className="flex justify-between text-xs text-slate-600">
              <span>رسوم المتاجر الإضافية:</span>
              <span className="font-bold">{formatCurrency(order.extraStoresFee)}</span>
            </div>

            {order.customFee !== undefined && order.customFee !== null && order.customFee > 0 && (
              <div className="flex justify-between text-xs text-amber-800 bg-amber-50 p-2 rounded-lg border border-amber-200">
                <span>رسم إضافي خاص:</span>
                <span className="font-bold">+{formatCurrency(order.customFee)}</span>
              </div>
            )}

            {order.customFeeReason && (
              <div className="text-[11px] text-amber-800 bg-amber-50/50 p-2 rounded-lg">
                <span className="font-bold">سبب الرسم الإضافي: </span>
                {order.customFeeReason}
              </div>
            )}

            <div className="flex justify-between text-sm font-black text-slate-900 pt-3 border-t border-slate-100">
              <span>الإجمالي:</span>
              <span className="text-[#3ABFB5]">{formatCurrency(order.totalFee)}</span>
            </div>
          </div>
        </div>

        {/* Map & Delivery Address Card */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div className="mb-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">موقع وعنوان التسليم</h2>
              <span className="text-xs text-slate-400 font-mono" dir="ltr">
                {order.deliveryLat.toFixed(5)}, {order.deliveryLng.toFixed(5)}
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-1.5 font-medium">
              📍 {order.deliveryDesc || 'لا يوجد وصف تفصيلي للعنوان'}
            </p>
            {order.notes && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 p-2.5 rounded-xl mt-2">
                ملاحظة العميل: {order.notes}
              </p>
            )}
          </div>

          <OrderMap
            lat={order.deliveryLat}
            lng={order.deliveryLng}
            description={order.deliveryDesc}
          />
        </div>
      </div>

      {/* Stores & Items List */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
          المتاجر والأصناف المطلوبة
        </h2>

        {order.orderStores && order.orderStores.length > 0 ? (
          <div className="space-y-4">
            {order.orderStores.map((store) => (
              <div
                key={store.id}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">🏪 {store.storeName}</span>
                    {store.isAnyStore && (
                      <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-medium">
                        أي متجر متاح
                      </span>
                    )}
                    {store.isExtra && (
                      <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-medium">
                        متجر إضافي (+رسوم)
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-white border border-slate-200 text-slate-700">
                    {ORDER_STORE_STATUS_LABEL[store.status]}
                  </span>
                </div>

                {/* Items in store */}
                <div className="divide-y divide-slate-200/60 bg-white rounded-xl border border-slate-200/80 px-4 py-2 overflow-x-auto">
                  {store.items.map((item) => (
                    <div
                      key={item.id}
                      className="py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs"
                    >
                      <div>
                        <span className={`font-bold ${item.isCancelled ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                          {item.itemName}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`font-mono font-bold ${item.isCancelled ? 'text-slate-400' : 'text-slate-700'}`}>
                          الكمية: {item.quantity}
                        </span>
                        {item.isCancelled && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                              ملغي
                            </span>
                            {item.cancelNote && (
                              <span className="text-[11px] text-rose-600">
                                ({item.cancelNote})
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Store Receipts */}
                {store.receipts && store.receipts.length > 0 && (
                  <div className="pt-2">
                    <span className="text-xs font-bold text-slate-600 block mb-2">
                      صور الإيصالات المرفوعة من المندوب:
                    </span>
                    <div className="flex items-center gap-3 overflow-x-auto pb-1">
                      {store.receipts.map((rec) => (
                        <div
                          key={rec.id}
                          onClick={() => setPreviewImage(rec.imageUrl)}
                          className="w-20 h-20 rounded-xl overflow-hidden border border-slate-300 hover:border-[#7DDDD4] cursor-pointer shadow-xs shrink-0 transition-all"
                        >
                          <img
                            src={rec.imageUrl}
                            alt="Receipt"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          /* Fallback if items are directly on order */
          <div className="divide-y divide-slate-100 bg-slate-50 rounded-xl p-4 overflow-x-auto">
            {order.items.map((item) => (
              <div key={item.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className={`font-bold ${item.isCancelled ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                  {item.itemName}
                </span>
                <div className="flex items-center gap-3">
                  <span className={`font-mono ${item.isCancelled ? 'text-slate-400' : 'text-slate-600'}`}>
                    {item.quantity}
                  </span>
                  {item.isCancelled && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                        ملغي
                      </span>
                      {item.cancelNote && (
                        <span className="text-[11px] text-rose-600">({item.cancelNote})</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ratings Section */}
      {order.ratings && order.ratings.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 flex flex-wrap items-center justify-between gap-2">
            <span>تقييمات الطلب (Customer Ratings)</span>
            <span className="text-amber-500 font-bold text-xs">
              ★ {order.ratings.length} تقييم
            </span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {order.ratings.map((rating) => (
              <div
                key={rating.id}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-slate-800 text-xs">
                    {rating.storeNameRated ? `🏪 تقييم متجر: ${rating.storeNameRated}` : '🏃 تقييم المندوب'}
                  </span>
                  <span className="text-amber-500 font-bold text-xs">
                    {'★'.repeat(rating.stars)}{'☆'.repeat(Math.max(0, 5 - rating.stars))} ({rating.stars}/5)
                  </span>
                </div>
                {rating.note && (
                  <p className="text-xs text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200/80">
                    &ldquo;{rating.note}&rdquo;
                  </p>
                )}
                <div className="text-[10px] text-slate-400 font-mono">
                  {formatDate(rating.createdAt)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Audit Log Timeline */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
          السجل التاريخي للطلب (Audit Timeline)
        </h2>

        {auditLogs.length === 0 ? (
          <p className="text-xs text-slate-400">لا توجد سجلات بعد لهذا الطلب.</p>
        ) : (
          <div className="relative pl-4 space-y-4 border-r-2 border-slate-200 pr-4 mr-2">
            {auditLogs.map((log) => (
              <div key={log.id} className="relative">
                <span className="absolute -right-[23px] top-1 w-3 h-3 rounded-full bg-[#7DDDD4] border-2 border-white shadow-xs"></span>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-slate-800">{log.event}</span>
                  <span className="text-slate-400 font-mono text-[11px]">
                    {formatDate(log.createdAt)}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-1">
                  <span>بواسطة:</span>
                  <span className="font-semibold text-slate-700">{log.actorRole}</span>
                  {log.fromStatus && log.toStatus && (
                    <span className="mr-2">
                      ({log.fromStatus} → {log.toStatus})
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {isRejectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4" dir="rtl">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-slate-900 mb-3">رفض الطلب</h3>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="اكتب سبب الرفض لتوضيحه للعميل..."
              rows={3}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 text-xs text-slate-900 outline-hidden resize-none"
            />
            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setIsRejectOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={actionLoading}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs disabled:opacity-50"
              >
                تأكيد الرفض
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {isCancelOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4" dir="rtl">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-slate-900 mb-3">إلغاء الطلب إدارياً</h3>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="اكتب سبب الإلغاء الإداري..."
              rows={3}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 text-xs text-slate-900 outline-hidden resize-none"
            />
            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setIsCancelOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100"
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={handleCancelOrder}
                disabled={actionLoading}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs disabled:opacity-50"
              >
                تأكيد الإلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Image Lightbox Preview Modal */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 cursor-pointer"
        >
          <div className="max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl bg-white p-2">
            <img
              src={previewImage}
              alt="Receipt Preview"
              className="max-h-[80vh] w-auto object-contain rounded-xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}
