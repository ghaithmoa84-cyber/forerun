'use client';

import React, { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { useToast } from '@/components/Toast';
import type { PlatformPricingResponse } from '@forerun/shared-types';

export default function PricingSettingsPage() {
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflictOccurred, setConflictOccurred] = useState(false);

  const [baseFee, setBaseFee] = useState<number>(60);
  const [extraStoreFee, setExtraStoreFee] = useState<number>(20);
  const [peripheralFee, setPeripheralFee] = useState<number>(40);
  const [updatedAt, setUpdatedAt] = useState<Date | string | null>(null);
  const [updatedByUserId, setUpdatedByUserId] = useState<string | null>(null);

  const fetchPricing = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setConflictOccurred(false);
      const res = await api.get<PlatformPricingResponse>('/admin/pricing');
      setBaseFee(res.data.baseFee);
      setExtraStoreFee(res.data.extraStoreFee);
      setPeripheralFee(res.data.peripheralFee);
      setUpdatedAt(res.data.updatedAt);
      setUpdatedByUserId(res.data.updatedByUserId);
    } catch {
      setError('تعذر تحميل إعدادات الأسعار الحالية، يرجى المحاولة لاحقاً');
      showToast('تعذر تحميل إعدادات الأسعار', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchPricing();
  }, [fetchPricing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (baseFee < 1 || baseFee > 1000) {
      showToast('الرسم الأساسي يجب أن يكون بين 1 و 1000 ل.س', 'info');
      return;
    }
    if (extraStoreFee < 0 || extraStoreFee > 500) {
      showToast('رسم المتجر الإضافي يجب أن يكون بين 0 و 500 ل.س', 'info');
      return;
    }
    if (peripheralFee < 0 || peripheralFee > 500) {
      showToast('رسم المنطقة الطرفية يجب أن يكون بين 0 و 500 ل.س', 'info');
      return;
    }

    try {
      setSaving(true);
      setConflictOccurred(false);

      const res = await api.put<PlatformPricingResponse>('/admin/pricing', {
        baseFee: Number(baseFee),
        extraStoreFee: Number(extraStoreFee),
        peripheralFee: Number(peripheralFee),
        updatedAt: updatedAt ?? undefined,
      });

      setBaseFee(res.data.baseFee);
      setExtraStoreFee(res.data.extraStoreFee);
      setPeripheralFee(res.data.peripheralFee);
      setUpdatedAt(res.data.updatedAt);
      setUpdatedByUserId(res.data.updatedByUserId);

      showToast('تم حفظ وتحديث أسعار المنصة بنجاح', 'success');
    } catch (err: unknown) {
      const axiosError = err as { response?: { status?: number; data?: { message?: string } } };
      if (axiosError?.response?.status === 409) {
        setConflictOccurred(true);
        showToast('تعارض: تم تعديل الأسعار من جلسة أخرى، يرجى إعادة التحميل', 'error');
      } else {
        const msg = axiosError?.response?.data?.message || 'فشل في حفظ الأسعار الجديدة';
        showToast(msg, 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateStr: string | Date | null) => {
    if (!dateStr) return 'القيم الافتراضية الأولية';
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

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            إعدادات أسعار المنصة
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            إدارة وتعديل رسوم التوصيل الافتراضية لكافة الطلبات في النظام
          </p>
        </div>

        <button
          type="button"
          onClick={fetchPricing}
          disabled={loading || saving}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors shadow-xs disabled:opacity-50"
        >
          <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>تحديث البيانات</span>
        </button>
      </div>

      {/* D20 Notice Banner */}
      <div className="p-4 bg-amber-50 border-r-4 border-amber-500 rounded-xl flex items-start gap-3 shadow-xs">
        <svg className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <div className="text-xs text-amber-900 leading-relaxed font-medium">
          <span className="font-bold block mb-0.5">تنبيه إرشادي هام (القرار D16 & D20):</span>
          تغيير الأسعار يؤثر على رسوم المتاجر الإضافية في الطلبات الجارية. يُنصح بالتعديل حين لا توجد طلبات جارية.
        </div>
      </div>

      {/* 409 Conflict Banner if triggered */}
      {conflictOccurred && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between gap-3 text-rose-800 text-xs font-bold">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-rose-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>تعارض: تم تعديل الأسعار من جلسة أخرى، يرجى إعادة التحميل لمطابقة أحدث البيانات.</span>
          </div>
          <button
            type="button"
            onClick={fetchPricing}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs shrink-0"
          >
            إعادة التحميل
          </button>
        </div>
      )}

      {/* Main Settings Form */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm font-bold flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-3 border-[#7DDDD4] border-t-transparent rounded-full animate-spin"></div>
            <span>جاري قراءة إعدادات الأسعار من الخادم...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center space-y-3">
            <p className="text-rose-600 text-sm font-bold">{error}</p>
            <button
              onClick={fetchPricing}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
            >
              إعادة المحاولة
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Base Fee */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  الرسم الأساسي (ل.س)
                  <span className="text-rose-500 mr-1">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    step={1}
                    value={baseFee}
                    onChange={(e) => setBaseFee(Number(e.target.value))}
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-800 outline-hidden focus:border-[#7DDDD4] focus:bg-white transition-colors"
                  />
                  <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold pointer-events-none">
                    ل.س
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-medium">
                  الرسم الأدنى للتوصيل (متجر واحد). الحد: 1 - 1000 ل.س.
                </p>
              </div>

              {/* Extra Store Fee */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  رسم المتجر الإضافي (ل.س)
                  <span className="text-rose-500 mr-1">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    max={500}
                    step={1}
                    value={extraStoreFee}
                    onChange={(e) => setExtraStoreFee(Number(e.target.value))}
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-800 outline-hidden focus:border-[#7DDDD4] focus:bg-white transition-colors"
                  />
                  <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold pointer-events-none">
                    ل.س
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-medium">
                  يُضاف لكل متجر إضافي بعد المتجر الأول. الحد: 0 - 500 ل.س.
                </p>
              </div>

              {/* Peripheral Area Fee */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  رسم المنطقة الطرفية (ل.س)
                  <span className="text-rose-500 mr-1">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    max={500}
                    step={1}
                    value={peripheralFee}
                    onChange={(e) => setPeripheralFee(Number(e.target.value))}
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-800 outline-hidden focus:border-[#7DDDD4] focus:bg-white transition-colors"
                  />
                  <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold pointer-events-none">
                    ل.س
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-medium">
                  يُضاف للطلبات الواقعة خارج نطاق المدينة. الحد: 0 - 500 ل.س.
                </p>
              </div>
            </div>

            {/* Metadata info */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 gap-2">
              <div>
                <span className="font-bold">آخر تحديث: </span>
                <span className="font-mono">{formatDate(updatedAt)}</span>
              </div>
              {updatedByUserId && (
                <div className="text-[11px] text-slate-400">
                  معرّف المشرف: {updatedByUserId}
                </div>
              )}
            </div>

            {/* Submit Action */}
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-[#7DDDD4] hover:bg-[#5CCFC5] text-white font-extrabold text-xs rounded-xl shadow-md transition-all disabled:opacity-50 min-w-[140px]"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>جاري الحفظ...</span>
                  </>
                ) : (
                  <span>حفظ التعديلات</span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
