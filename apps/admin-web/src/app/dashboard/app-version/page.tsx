'use client';

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import api from '@/lib/api';
import { toAdminErrorMessage, isNetworkError } from '@/lib/errorMessage';
import { useToast } from '@/components/Toast';
import type {
  AdminAppVersionResponse,
  UpdatePlatformAppVersionDto,
} from '@forerun/shared-types';

export default function AppVersionSettingsPage() {
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflictOccurred, setConflictOccurred] = useState(false);

  // Server state (Source of Truth & Concurrency Token)
  const [currentData, setCurrentData] = useState<AdminAppVersionResponse | null>(null);

  // Form input states
  const [latestCode, setLatestCode] = useState<number | ''>('');
  const [latestName, setLatestName] = useState<string>('');
  const [minCode, setMinCode] = useState<number | ''>('');
  const [downloadUrl, setDownloadUrl] = useState<string>('');
  const [releaseNotes, setReleaseNotes] = useState<string>('');

  // Per-field validation error messages
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const fetchVersion = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setConflictOccurred(false);
      setFieldErrors({});

      const res = await api.get<AdminAppVersionResponse>('/admin/app-version', {
        params: { platform: 'android' },
      });

      setCurrentData(res.data);
      setLatestCode(res.data.latestVersionCode);
      setLatestName(res.data.latestVersionName);
      setMinCode(res.data.minSupportedVersionCode);
      setDownloadUrl(res.data.downloadUrl);
      setReleaseNotes(res.data.releaseNotes ?? '');
    } catch (err: unknown) {
      if (isNetworkError(err)) {
        setError('تعذر الاتصال بالخادم، يرجى التحقق من اتصالك بالإنترنت');
        showToast('تعذر الاتصال بالخادم', 'error');
      } else {
        setError('تعذر تحميل إعدادات إصدار التطبيق، يرجى المحاولة لاحقاً');
        showToast('تعذر تحميل إعدادات الإصدار', 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchVersion();
  }, [fetchVersion]);

  const parseServerErrors = (err: unknown): Record<string, string> => {
    const errors: Record<string, string> = {};
    if (!axios.isAxiosError(err) || !err.response?.data) return errors;

    const rawMessage = (err.response.data as { message?: unknown }).message;
    const messages: string[] = [];

    if (Array.isArray(rawMessage)) {
      messages.push(...rawMessage.filter((m): m is string => typeof m === 'string'));
    } else if (typeof rawMessage === 'string') {
      messages.push(...rawMessage.split('، '));
    }

    for (const msg of messages) {
      const trimmed = msg.trim();
      if (!trimmed) continue;

      const match = trimmed.match(/^([a-zA-Z0-9_]+):\s*(.+)$/);
      if (match) {
        const [, field, text] = match;
        errors[field] = text;
        continue;
      }

      if (trimmed.includes('الحد الأدنى للإصدار')) {
        errors.minSupportedVersionCode = trimmed;
      } else if (trimmed.includes('رقم الإصدار الأحدث')) {
        errors.latestVersionCode = trimmed;
      } else if (trimmed.includes('اسم الإصدار')) {
        errors.latestVersionName = trimmed;
      } else if (trimmed.includes('رابط التحميل')) {
        errors.downloadUrl = trimmed;
      } else if (trimmed.includes('ملاحظات')) {
        errors.releaseNotes = trimmed;
      } else {
        errors.general = trimmed;
      }
    }

    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});

    // Client-side visual validation
    const clientErrors: Record<string, string> = {};

    const numericLatestCode = Number(latestCode);
    if (!latestCode || numericLatestCode <= 0 || !Number.isInteger(numericLatestCode)) {
      clientErrors.latestVersionCode = 'يجب أن يكون رقم الإصدار الأحدث عدداً صحيحاً موجباً';
    }

    if (!latestName.trim()) {
      clientErrors.latestVersionName = 'اسم الإصدار لا يمكن أن يكون فارغاً';
    }

    const numericMinCode = Number(minCode);
    if (!minCode || numericMinCode <= 0 || !Number.isInteger(numericMinCode)) {
      clientErrors.minSupportedVersionCode = 'يجب أن يكون الحد الأدنى للإصدار عدداً صحيحاً موجباً';
    } else if (numericLatestCode && numericMinCode > numericLatestCode) {
      clientErrors.minSupportedVersionCode = 'الحد الأدنى للإصدار المدعوم يجب ألا يتجاوز رقم الإصدار الأحدث';
    }

    const trimmedUrl = downloadUrl.trim();
    if (!trimmedUrl) {
      clientErrors.downloadUrl = 'رابط التحميل إلزامي';
    } else if (!trimmedUrl.startsWith('https://faow.run') && !trimmedUrl.startsWith('https://www.faow.run')) {
      clientErrors.downloadUrl = 'رابط التحميل يجب أن يبدأ بـ https://faow.run أو https://www.faow.run';
    } else {
      try {
        const parsed = new URL(trimmedUrl);
        if (
          parsed.protocol !== 'https:' ||
          !['https://faow.run', 'https://www.faow.run'].includes(parsed.origin)
        ) {
          clientErrors.downloadUrl = 'رابط التحميل يجب أن يكون من نطاق موثوق حصراً (https://faow.run أو https://www.faow.run)';
        }
      } catch {
        clientErrors.downloadUrl = 'صيغة رابط التحميل غير صالحة';
      }
    }

    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      return;
    }

    if (!currentData?.updatedAt) {
      showToast('بيانات الإصدار غير مكتملة، يرجى تحديث الصفحة', 'error');
      return;
    }

    try {
      setSaving(true);
      setConflictOccurred(false);

      // Concurrency Lock: updatedAt comes strictly from currentData (server state)
      const payload: UpdatePlatformAppVersionDto = {
        platform: 'android',
        latestVersionCode: numericLatestCode,
        latestVersionName: latestName.trim(),
        minSupportedVersionCode: numericMinCode,
        downloadUrl: trimmedUrl,
        releaseNotes: releaseNotes.trim() ? releaseNotes.trim() : null,
        updatedAt: currentData.updatedAt,
      };

      const res = await api.put<AdminAppVersionResponse>('/admin/app-version', payload);

      // Update state with newly returned server entity & fresh updatedAt
      setCurrentData(res.data);
      setLatestCode(res.data.latestVersionCode);
      setLatestName(res.data.latestVersionName);
      setMinCode(res.data.minSupportedVersionCode);
      setDownloadUrl(res.data.downloadUrl);
      setReleaseNotes(res.data.releaseNotes ?? '');
      setFieldErrors({});

      showToast('تم تحديث إعدادات الإصدار بنجاح', 'success');
    } catch (err: unknown) {
      if (isNetworkError(err)) {
        showToast('تعذر الاتصال بالخادم', 'error');
        return;
      }

      const axiosError = err as { response?: { status?: number } };
      if (axiosError?.response?.status === 409) {
        setConflictOccurred(true);
        showToast('تم تعديل الإعدادات من جلسة أخرى، يرجى تحديث الصفحة', 'error');
      } else if (axiosError?.response?.status === 400) {
        const parsedErrors = parseServerErrors(err);
        setFieldErrors(parsedErrors);
        const generalMsg = parsedErrors.general || toAdminErrorMessage(err, 'بيانات الإدخال غير صالحة');
        showToast(generalMsg, 'error');
      } else {
        showToast(toAdminErrorMessage(err, 'فشل في حفظ إعدادات الإصدار'), 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateStr: string | Date | null | undefined) => {
    if (!dateStr) return 'غير محدد';
    try {
      return new Intl.DateTimeFormat('ar-SY', {
        timeZone: 'Asia/Damascus',
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
            إدارة إصدارات التطبيق
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            التحكم في الإصدار الأدنى والأحدث وروابط التحديث لتطبيق أندرويد
          </p>
        </div>

        <button
          type="button"
          onClick={fetchVersion}
          disabled={loading || saving}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors shadow-xs disabled:opacity-50"
        >
          <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>تحديث البيانات</span>
        </button>
      </div>

      {/* 409 Conflict Banner if triggered */}
      {conflictOccurred && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between gap-3 text-rose-800 text-xs font-bold">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-rose-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>تم تعديل الإعدادات من جلسة أخرى، يرجى تحديث الصفحة لمطابقة أحدث البيانات.</span>
          </div>
          <button
            type="button"
            onClick={fetchVersion}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs shrink-0"
          >
            تحديث الصفحة
          </button>
        </div>
      )}

      {/* Section 1: Read-Only Card (Current Status) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <h2 className="text-sm font-bold text-slate-800">الحالة الحالية في النظام</h2>
          </div>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
            أندرويد (Android)
          </span>
        </div>

        {loading ? (
          <div className="p-10 text-center text-slate-400 text-sm font-bold flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-3 border-[#7DDDD4] border-t-transparent rounded-full animate-spin"></div>
            <span>جاري قراءة إعدادات الإصدار من الخادم...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center space-y-3">
            <p className="text-rose-600 text-sm font-bold">{error}</p>
            <button
              onClick={fetchVersion}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
            >
              إعادة المحاولة
            </button>
          </div>
        ) : currentData ? (
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Latest Version */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                <span className="text-[11px] font-bold text-slate-500">رقم الإصدار الأحدث:</span>
                <p className="text-sm font-black text-slate-800">
                  {currentData.latestVersionCode} — <span className="font-mono text-teal-600">{currentData.latestVersionName}</span>
                </p>
              </div>

              {/* Min Supported Version */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                <span className="text-[11px] font-bold text-slate-500">الحد الأدنى المدعوم:</span>
                <p className="text-sm font-black text-slate-800 font-mono">
                  {currentData.minSupportedVersionCode}
                </p>
              </div>

              {/* Updated At */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-1 sm:col-span-2 lg:col-span-1">
                <span className="text-[11px] font-bold text-slate-500">آخر تحديث (بتوقيت دمشق):</span>
                <p className="text-xs font-bold text-slate-700 font-mono">
                  {formatDate(currentData.updatedAt)}
                </p>
                {currentData.updatedByUserId && (
                  <span className="text-[10px] text-slate-400 block truncate">
                    بواسطة المشرف: {currentData.updatedByUserId}
                  </span>
                )}
              </div>
            </div>

            {/* Download URL */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5">
              <span className="text-[11px] font-bold text-slate-500">رابط التحميل:</span>
              <div>
                <a
                  href={currentData.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-teal-600 hover:text-teal-700 underline font-mono text-xs break-all inline-flex items-center gap-1.5"
                  dir="ltr"
                >
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  <span>{currentData.downloadUrl}</span>
                </a>
              </div>
            </div>

            {/* Release Notes */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
              <span className="text-[11px] font-bold text-slate-500">ملاحظات الإصدار:</span>
              <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                {currentData.releaseNotes?.trim() ? currentData.releaseNotes : 'لا توجد ملاحظات'}
              </p>
            </div>
          </div>
        ) : null}
      </div>

      {/* Section 2: Edit Form */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-sm font-bold text-slate-800">تعديل إعدادات الإصدار</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            يتم تطبيق القفل التفاؤلي تلقائياً لضمان عدم الكتابة فوق تعديل مشرف آخر
          </p>
        </div>

        {!loading && !error && (
          <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Latest Version Code */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  رقم الإصدار الأحدث (Version Code)
                  <span className="text-rose-500 mr-1">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={latestCode}
                  onChange={(e) => {
                    const val = e.target.value === '' ? '' : Number(e.target.value);
                    setLatestCode(val);
                    if (fieldErrors.latestVersionCode) {
                      setFieldErrors((prev) => ({ ...prev, latestVersionCode: '' }));
                    }
                  }}
                  required
                  className={`w-full px-3.5 py-2.5 bg-slate-50 border ${
                    fieldErrors.latestVersionCode ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300'
                  } rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-[#7DDDD4] focus:bg-white transition-colors`}
                />
                {fieldErrors.latestVersionCode ? (
                  <p className="text-[11px] text-rose-600 font-bold">{fieldErrors.latestVersionCode}</p>
                ) : (
                  <p className="text-[11px] text-slate-400 font-medium">
                    رقم صحيح متزايد مع كل إصدار جديد (مثال: 12)
                  </p>
                )}
              </div>

              {/* Latest Version Name */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  اسم الإصدار الأحدث (Version Name)
                  <span className="text-rose-500 mr-1">*</span>
                </label>
                <input
                  type="text"
                  value={latestName}
                  onChange={(e) => {
                    setLatestName(e.target.value);
                    if (fieldErrors.latestVersionName) {
                      setFieldErrors((prev) => ({ ...prev, latestVersionName: '' }));
                    }
                  }}
                  placeholder="مثال: 1.2.0"
                  required
                  className={`w-full px-3.5 py-2.5 bg-slate-50 border ${
                    fieldErrors.latestVersionName ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300'
                  } rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-[#7DDDD4] focus:bg-white transition-colors`}
                />
                {fieldErrors.latestVersionName ? (
                  <p className="text-[11px] text-rose-600 font-bold">{fieldErrors.latestVersionName}</p>
                ) : (
                  <p className="text-[11px] text-slate-400 font-medium">
                    الاسم الدلالي للإصدار الظاهر للمستخدمين (مثال: 1.2.0)
                  </p>
                )}
              </div>

              {/* Min Supported Version Code */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  الحد الأدنى للإصدار المدعوم (Min Supported Code)
                  <span className="text-rose-500 mr-1">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={minCode}
                  onChange={(e) => {
                    const val = e.target.value === '' ? '' : Number(e.target.value);
                    setMinCode(val);
                    if (fieldErrors.minSupportedVersionCode) {
                      setFieldErrors((prev) => ({ ...prev, minSupportedVersionCode: '' }));
                    }
                  }}
                  required
                  className={`w-full px-3.5 py-2.5 bg-slate-50 border ${
                    fieldErrors.minSupportedVersionCode ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300'
                  } rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-[#7DDDD4] focus:bg-white transition-colors`}
                />
                {fieldErrors.minSupportedVersionCode ? (
                  <p className="text-[11px] text-rose-600 font-bold">{fieldErrors.minSupportedVersionCode}</p>
                ) : (
                  <p className="text-[11px] text-slate-400 font-medium">
                    الإصدارات الأقل من هذا الرقم ستُجبر على التحديث. يجب ألا يتجاوز رقم الإصدار الأحدث.
                  </p>
                )}
              </div>

              {/* Download URL */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  رابط التحميل المباشر (APK Download URL)
                  <span className="text-rose-500 mr-1">*</span>
                </label>
                <input
                  type="url"
                  value={downloadUrl}
                  onChange={(e) => {
                    setDownloadUrl(e.target.value);
                    if (fieldErrors.downloadUrl) {
                      setFieldErrors((prev) => ({ ...prev, downloadUrl: '' }));
                    }
                  }}
                  placeholder="https://faow.run/..."
                  required
                  dir="ltr"
                  className={`w-full px-3.5 py-2.5 bg-slate-50 border ${
                    fieldErrors.downloadUrl ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300'
                  } rounded-xl text-sm font-mono text-slate-800 outline-none focus:border-[#7DDDD4] focus:bg-white transition-colors`}
                />
                {fieldErrors.downloadUrl ? (
                  <p className="text-[11px] text-rose-600 font-bold">{fieldErrors.downloadUrl}</p>
                ) : (
                  <p className="text-[11px] text-slate-400 font-medium">
                    يجب أن يبدأ حصراً بـ <span className="font-mono text-slate-600">https://faow.run</span> أو <span className="font-mono text-slate-600">https://www.faow.run</span>
                  </p>
                )}
              </div>
            </div>

            {/* Release Notes */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                ملاحظات الإصدار (Release Notes)
                <span className="text-slate-400 font-normal mr-1">(اختياري)</span>
              </label>
              <textarea
                rows={3}
                value={releaseNotes}
                onChange={(e) => {
                  setReleaseNotes(e.target.value);
                  if (fieldErrors.releaseNotes) {
                    setFieldErrors((prev) => ({ ...prev, releaseNotes: '' }));
                  }
                }}
                placeholder="اكتب تفاصيل التحديث أو الميزات الجديدة..."
                className={`w-full px-3.5 py-2.5 bg-slate-50 border ${
                  fieldErrors.releaseNotes ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300'
                } rounded-xl text-sm font-medium text-slate-800 outline-none focus:border-[#7DDDD4] focus:bg-white transition-colors`}
              />
              {fieldErrors.releaseNotes ? (
                <p className="text-[11px] text-rose-600 font-bold">{fieldErrors.releaseNotes}</p>
              ) : (
                <p className="text-[11px] text-slate-400 font-medium">
                  نص توضيحي يظهر للمستخدم في شاشة التحديث
                </p>
              )}
            </div>

            {/* Submit Action */}
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={saving || loading}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-[#7DDDD4] hover:bg-[#5CCFC5] text-white font-extrabold text-xs rounded-xl shadow-md transition-all disabled:opacity-50 min-w-[140px]"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>جاري الحفظ...</span>
                  </>
                ) : (
                  <span>حفظ التغييرات</span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

