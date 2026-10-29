'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { useToast } from '@/components/Toast';
import { WhatsAppButton } from '@/components/WhatsAppButton';
import { toAdminErrorMessage } from '@/lib/errorMessage';
import type {
  AdminCustomerDetailsResponse,
  UserAuditLogEntry,
  AdminUpdateCustomerProfileRequest,
} from '@forerun/shared-types';

interface CustomerDetailsDrawerProps {
  userId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onCustomerUpdated?: () => void;
  onResetPasswordClick?: (user: { id: string; name: string; whatsapp: string }) => void;
  onSoftDeleteClick?: (user: { id: string; name: string }) => void;
}

function formatDate(date: string | Date | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleString('ar-SY', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'VERIFIED':
      return (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          مفعّل
        </span>
      );
    case 'PENDING_VERIFICATION':
      return (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
          بانتظار التفعيل
        </span>
      );
    case 'SUSPENDED':
      return (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
          معلّق
        </span>
      );
    case 'REJECTED':
      return (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
          مرفوض
        </span>
      );
    default:
      return (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
          {status}
        </span>
      );
  }
}

function getOrderStatusBadge(status: string) {
  switch (status) {
    case 'DELIVERED':
      return (
        <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          تم التسليم
        </span>
      );
    case 'CANCELLED':
      return (
        <span className="px-2 py-0.5 rounded text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
          ملغي
        </span>
      );
    case 'DRAFT':
      return <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-600">مسودة</span>;
    case 'SUBMITTED':
      return (
        <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
          بانتظار المراجعة
        </span>
      );
    case 'APPROVED':
      return (
        <span className="px-2 py-0.5 rounded text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
          معتمد
        </span>
      );
    case 'ASSIGNED':
      return (
        <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
          مُسنَد لمندوب
        </span>
      );
    case 'IN_PROGRESS':
    case 'OUT_FOR_DELIVERY':
      return (
        <span className="px-2 py-0.5 rounded text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
          قيد التوصيل
        </span>
      );
    default:
      return <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-700">{status}</span>;
  }
}

function formatAuditEvent(event: string): { label: string; bgClass: string; textClass: string } {
  switch (event) {
    case 'USER_REGISTERED':
      return { label: 'تسجيل الحساب', bgClass: 'bg-blue-50 border-blue-200', textClass: 'text-blue-700' };
    case 'USER_VERIFIED':
      return { label: 'تفعيل الحساب بواسطة الإدارة', bgClass: 'bg-emerald-50 border-emerald-200', textClass: 'text-emerald-700' };
    case 'USER_REJECTED':
      return { label: 'رفض الحساب بواسطة الإدارة', bgClass: 'bg-rose-50 border-rose-200', textClass: 'text-rose-700' };
    case 'USER_SUSPENDED':
      return { label: 'تعليق الحساب بواسطة الإدارة', bgClass: 'bg-amber-50 border-amber-200', textClass: 'text-amber-700' };
    case 'USER_UNSUSPENDED':
      return { label: 'فك تعليق الحساب بواسطة الإدارة', bgClass: 'bg-sky-50 border-sky-200', textClass: 'text-sky-700' };
    case 'USER_PASSWORD_RESET_BY_ADMIN':
      return { label: 'إعادة تعيين كلمة المرور', bgClass: 'bg-purple-50 border-purple-200', textClass: 'text-purple-700' };
    case 'USER_PROFILE_UPDATED_BY_ADMIN':
      return { label: 'تعديل بيانات الحساب إدارياً', bgClass: 'bg-indigo-50 border-indigo-200', textClass: 'text-indigo-700' };
    case 'USER_SOFT_DELETED':
      return { label: 'أرشفة الحساب إدارياً', bgClass: 'bg-rose-100 border-rose-300', textClass: 'text-rose-800' };
    case 'ORDER_CREATED':
      return { label: 'إنشاء طلب جديد', bgClass: 'bg-teal-50 border-teal-200', textClass: 'text-teal-700' };
    case 'ORDER_SUBMITTED':
      return { label: 'إرسال طلب للمراجعة', bgClass: 'bg-teal-50 border-teal-200', textClass: 'text-teal-700' };
    case 'ORDER_CANCELLED':
      return { label: 'إلغاء طلب', bgClass: 'bg-rose-50 border-rose-200', textClass: 'text-rose-700' };
    default:
      return { label: event, bgClass: 'bg-slate-50 border-slate-200', textClass: 'text-slate-700' };
  }
}

export function CustomerDetailsDrawer({
  userId,
  isOpen,
  onClose,
  onCustomerUpdated,
  onResetPasswordClick,
  onSoftDeleteClick,
}: CustomerDetailsDrawerProps) {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'audit' | 'edit'>('overview');
  const [loading, setLoading] = useState<boolean>(false);
  const [data, setData] = useState<AdminCustomerDetailsResponse | null>(null);
  const [auditLogs, setAuditLogs] = useState<UserAuditLogEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState<boolean>(false);

  // Edit form state
  const [editName, setEditName] = useState<string>('');
  const [editAltPhone, setEditAltPhone] = useState<string>('');
  const [savingProfile, setSavingProfile] = useState<boolean>(false);

  const fetchDetails = useCallback(async (id: string) => {
    try {
      setLoading(true);
      const res = await api.get<AdminCustomerDetailsResponse>(`/admin/users/${id}`);
      setData(res.data);
      setEditName(res.data.name);
      setEditAltPhone(res.data.altPhone ?? '');
    } catch (err: unknown) {
      showToast(toAdminErrorMessage(err, 'تعذر تحميل تفاصيل العميل'), 'error');
      onClose();
    } finally {
      setLoading(false);
    }
  }, [showToast, onClose]);

  const fetchAuditLogs = useCallback(async (id: string) => {
    try {
      setAuditLoading(true);
      const res = await api.get<UserAuditLogEntry[]>(`/admin/users/${id}/audit-logs`);
      setAuditLogs(res.data);
    } catch {
      showToast('تعذر تحميل سجل الحركات الرقابية', 'error');
    } finally {
      setAuditLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (isOpen && userId) {
      setActiveTab('overview');
      fetchDetails(userId);
      fetchAuditLogs(userId);
    } else {
      setData(null);
      setAuditLogs([]);
    }
  }, [isOpen, userId, fetchDetails, fetchAuditLogs]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    const trimmedName = editName.trim();
    const trimmedAltPhone = editAltPhone.trim();

    if (!trimmedName && !trimmedAltPhone) {
      showToast('يرجى إدخال الاسم أو رقم الهاتف البديل', 'error');
      return;
    }

    if (trimmedName && trimmedName.length < 2) {
      showToast('الاسم يجب ألا يقل عن حرفين', 'error');
      return;
    }

    if (trimmedAltPhone && !/^09\d{8}$/.test(trimmedAltPhone)) {
      showToast('رقم الهاتف البديل يجب أن يكون بصيغة 09XXXXXXXX', 'error');
      return;
    }

    try {
      setSavingProfile(true);
      const payload: AdminUpdateCustomerProfileRequest = {
        name: trimmedName ? trimmedName : undefined,
        altPhone: trimmedAltPhone ? trimmedAltPhone : null,
      };

      await api.put(`/admin/users/${userId}/profile`, payload);
      showToast('تم تحديث بيانات العميل بنجاح', 'success');

      // Refresh data
      await fetchDetails(userId);
      await fetchAuditLogs(userId);
      if (onCustomerUpdated) onCustomerUpdated();
      setActiveTab('overview');
    } catch (err: unknown) {
      showToast(toAdminErrorMessage(err, 'فشل تحديث بيانات العميل'), 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" dir="rtl">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 left-0 max-w-full flex pl-0 sm:pl-10">
        <div className="w-screen max-w-md sm:max-w-xl bg-white shadow-2xl flex flex-col h-full border-r border-slate-200 animate-in slide-in-from-left duration-200">
          {/* Header */}
          <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#1A3B5C] text-[#7DDDD4] flex items-center justify-center font-bold text-lg shadow-xs">
                {data?.name ? data.name.charAt(0) : '؟'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900">{data?.name ?? 'تفاصيل العميل'}</h2>
                  {data && getStatusBadge(data.status)}
                </div>
                {data && (
                  <p className="text-xs text-slate-500 font-mono mt-0.5" dir="ltr">
                    {data.whatsapp}
                  </p>
                )}
              </div>
            </div>

            <button
              onClick={onClose}
              title="إغلاق"
              className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200 bg-white px-5 text-sm font-medium">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-3 px-3 border-b-2 font-bold transition-colors ${
                activeTab === 'overview'
                  ? 'border-[#1A3B5C] text-[#1A3B5C]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              نظرة عامة
            </button>
            <button
              onClick={() => setActiveTab('orders')}
              className={`py-3 px-3 border-b-2 font-bold transition-colors flex items-center gap-1.5 ${
                activeTab === 'orders'
                  ? 'border-[#1A3B5C] text-[#1A3B5C]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>الطلبات</span>
              {data?.stats?.totalOrders ? (
                <span className="text-xs px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-700 font-mono">
                  {data.stats.totalOrders}
                </span>
              ) : null}
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              className={`py-3 px-3 border-b-2 font-bold transition-colors flex items-center gap-1.5 ${
                activeTab === 'audit'
                  ? 'border-[#1A3B5C] text-[#1A3B5C]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>سجل التدقيق</span>
              {auditLogs.length > 0 && (
                <span className="text-xs px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-700 font-mono">
                  {auditLogs.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('edit')}
              className={`py-3 px-3 border-b-2 font-bold transition-colors ${
                activeTab === 'edit'
                  ? 'border-[#1A3B5C] text-[#1A3B5C]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              تعديل البيانات
            </button>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {loading ? (
              <div className="py-20 text-center text-slate-400">
                <span className="inline-block w-6 h-6 border-2 border-[#1A3B5C] border-t-transparent rounded-full animate-spin mb-3"></span>
                <p className="text-sm">جاري تحميل البيانات...</p>
              </div>
            ) : data ? (
              <>
                {/* TAB 1: OVERVIEW */}
                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    {/* Stats Grid */}
                    <div>
                      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                        إحصائيات الطلبات
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                          <p className="text-xs text-slate-500 mb-1">إجمالي الطلبات</p>
                          <p className="text-lg font-bold text-slate-900 font-mono">
                            {data.stats.totalOrders}
                          </p>
                        </div>
                        <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3 text-center">
                          <p className="text-xs text-emerald-700 mb-1">المكتملة</p>
                          <p className="text-lg font-bold text-emerald-800 font-mono">
                            {data.stats.completedOrders}
                          </p>
                        </div>
                        <div className="bg-rose-50/60 border border-rose-200 rounded-xl p-3 text-center">
                          <p className="text-xs text-rose-700 mb-1">الملغاة</p>
                          <p className="text-lg font-bold text-rose-800 font-mono">
                            {data.stats.cancelledOrders}
                          </p>
                        </div>
                        <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-3 text-center">
                          <p className="text-xs text-blue-700 mb-1">إجمالي المدفوع</p>
                          <p className="text-lg font-bold text-blue-800 font-mono">
                            {data.stats.totalFeesPaid}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Contact & Profile Info */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        بيانات التواصل
                      </h3>
                      <div className="flex items-center justify-between text-sm py-1 border-b border-slate-200">
                        <span className="text-slate-500">رقم الواتساب الرئيسي</span>
                        <div className="flex items-center gap-2">
                          <span dir="ltr" className="font-mono font-medium text-slate-900">
                            {data.whatsapp}
                          </span>
                          <WhatsAppButton phone={data.whatsapp} size="xs" />
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-sm py-1 border-b border-slate-200">
                        <span className="text-slate-500">رقم الهاتف البديل</span>
                        <span dir="ltr" className="font-mono font-medium text-slate-900">
                          {data.altPhone ?? 'غير مسجل'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm py-1 border-b border-slate-200">
                        <span className="text-slate-500">تاريخ الانضمام</span>
                        <span className="text-slate-800">{formatDate(data.createdAt)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm py-1">
                        <span className="text-slate-500">آخر تعديل</span>
                        <span className="text-slate-800">{formatDate(data.updatedAt)}</span>
                      </div>
                    </div>

                    {/* Address Card */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                        العنوان المسجل
                      </h3>
                      {data.address ? (
                        <div>
                          <p className="text-sm font-medium text-slate-900 mb-1">
                            {data.address.description}
                          </p>
                          <p className="text-xs text-slate-400 font-mono" dir="ltr">
                            {data.address.lat.toFixed(6)}, {data.address.lng.toFixed(6)}
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm text-slate-400">لا يوجد عنوان مسجل لهذا العميل حتى الآن.</p>
                      )}
                    </div>

                    {/* Quick Operations */}
                    <div className="pt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (onResetPasswordClick && data) {
                            onResetPasswordClick({
                              id: data.id,
                              name: data.name,
                              whatsapp: data.whatsapp,
                            });
                          }
                        }}
                        className="flex-1 py-2 px-3 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </svg>
                        <span>إعادة تعيين كلمة المرور</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (onSoftDeleteClick && data) {
                            onSoftDeleteClick({ id: data.id, name: data.name });
                          }
                        }}
                        className="py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span>أرشفة الحساب</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* TAB 2: RECENT ORDERS */}
                {activeTab === 'orders' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-800">آخر 5 طلبات للعميل</h3>
                      <Link
                        href={`/orders?search=${encodeURIComponent(data.name)}`}
                        className="text-xs font-bold text-[#1A3B5C] hover:underline"
                      >
                        عرض في صفحة الطلبات &larr;
                      </Link>
                    </div>

                    {data.recentOrders.length === 0 ? (
                      <div className="text-center py-12 text-slate-400 bg-slate-50 border border-slate-200 rounded-xl">
                        لم يقم هذا العميل بإنشاء أي طلبات حتى الآن.
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {data.recentOrders.map((ord) => (
                          <div
                            key={ord.id}
                            className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-3.5 transition-all shadow-2xs flex items-center justify-between"
                          >
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-mono font-bold text-sm text-slate-900">
                                  {ord.orderNumber ?? ord.id.slice(0, 8)}
                                </span>
                                {getOrderStatusBadge(ord.status)}
                              </div>
                              <p className="text-xs text-slate-400">{formatDate(ord.createdAt)}</p>
                            </div>

                            <div className="text-left font-mono">
                              <span className="text-sm font-bold text-slate-900">{ord.totalFee}</span>
                              <span className="text-xs text-slate-500 mr-1">ل.س</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 3: AUDIT LOG */}
                {activeTab === 'audit' && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-800">سجل الحركات والتدقيق الرقابي</h3>

                    {auditLoading ? (
                      <div className="py-12 text-center text-slate-400">
                        <span className="inline-block w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin mb-2"></span>
                        <p className="text-xs">جاري تحميل سجل التدقيق...</p>
                      </div>
                    ) : auditLogs.length === 0 ? (
                      <div className="text-center py-12 text-slate-400 bg-slate-50 border border-slate-200 rounded-xl">
                        لا توجد حركات مسجلة في سجل التدقيق لهذا الحساب.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {auditLogs.map((log) => {
                          const ev = formatAuditEvent(log.event);
                          return (
                            <div
                              key={log.id}
                              className={`border rounded-xl p-3.5 text-sm transition-all ${ev.bgClass}`}
                            >
                              <div className="flex items-center justify-between mb-1.5">
                                <span className={`font-bold text-xs ${ev.textClass}`}>{ev.label}</span>
                                <span className="text-xs text-slate-400 font-mono">
                                  {formatDate(log.createdAt)}
                                </span>
                              </div>

                              <div className="text-xs text-slate-600 flex items-center gap-2">
                                <span>المنفّذ:</span>
                                <span className="font-medium text-slate-800">
                                  {log.actorName ? log.actorName : log.actorRole === 'ADMIN' ? 'مسؤول النظام' : 'العميل'}
                                </span>
                                {log.actorRole && (
                                  <span className="text-2xs px-1.5 py-0.2 rounded bg-slate-200/60 font-mono">
                                    {log.actorRole}
                                  </span>
                                )}
                              </div>

                              {Boolean(log.meta && typeof log.meta === 'object' && Object.keys(log.meta as object).length > 0) && (
                                <div className="mt-2 pt-2 border-t border-slate-200/60 text-xs text-slate-500 font-mono space-y-0.5">
                                  {Boolean((log.meta as Record<string, unknown>).reason) && (
                                    <p className="font-sans">
                                      <span className="font-bold">السبب:</span> {String((log.meta as Record<string, unknown>).reason)}
                                    </p>
                                  )}
                                  {Boolean((log.meta as Record<string, unknown>).newName) && (
                                    <p className="font-sans">
                                      <span className="font-bold">الاسم المعدل:</span> {String((log.meta as Record<string, unknown>).newName)}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 4: EDIT PROFILE */}
                {activeTab === 'edit' && (
                  <form onSubmit={handleProfileSubmit} className="space-y-4">
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 leading-relaxed">
                      <strong>تنبيه إداري:</strong> يُسمح بتعديل اسم العميل ورقم هاتفه البديل فقط بطلب موثق منه. رقم الواتساب الأساسي لا يمكن تعديله لحماية هوية الحساب والجلسات.
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        اسم العميل <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        required
                        minLength={2}
                        maxLength={50}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-[#7DDDD4] focus:border-transparent font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        رقم الهاتف البديل (اختياري)
                      </label>
                      <input
                        type="text"
                        value={editAltPhone}
                        onChange={(e) => setEditAltPhone(e.target.value)}
                        placeholder="09XXXXXXXX"
                        dir="ltr"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-[#7DDDD4] focus:border-transparent"
                      />
                      <p className="text-xs text-slate-400 mt-1">
                        الصيغة المحلية المعتمدة: 09XXXXXXXX (10 أرقام تبدأ بـ 09).
                      </p>
                    </div>

                    <div className="pt-3">
                      <button
                        type="submit"
                        disabled={savingProfile}
                        className="w-full py-2.5 px-4 bg-[#1A3B5C] hover:bg-[#15304B] text-white font-bold rounded-lg text-sm transition-colors shadow-xs disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {savingProfile ? (
                          <>
                            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                            <span>جاري الحفظ وتوثيق الحركة...</span>
                          </>
                        ) : (
                          <span>حفظ التعديلات وتوثيقها</span>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
