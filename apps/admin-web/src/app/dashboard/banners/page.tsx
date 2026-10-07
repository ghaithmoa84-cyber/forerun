/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '@/lib/api';
import { useToast } from '@/components/Toast';
import {
  BANNER_ACTION_TYPES,
  MAX_ACTIVE_BANNERS,
  BANNER_IN_APP_ROUTES,
  type BannerActionType,
  type BannerInAppRoute,
} from '@forerun/shared-constants';
import type {
  AdminBannerResponse,
  CreateBannerDto,
  UpdateBannerDto,
} from '@forerun/shared-types';

const IN_APP_ROUTE_LABELS: Record<BannerInAppRoute, string> = {
  '/create-order': 'إنشاء طلب جديد (اطلب الآن)',
  '/orders': 'قائمة وتتبع الطلبات',
  '/account': 'حساب العميل والملف الشخصي',
  '/support': 'الدعم الفني والمساعدة',
  '/home': 'الصفحة الرئيسية',
};

const ACTION_TYPE_LABELS: Record<BannerActionType, string> = {
  [BANNER_ACTION_TYPES.NONE]: 'بدون إجراء (عرض فقط)',
  [BANNER_ACTION_TYPES.EXTERNAL_URL]: 'رابط خارجي (موقع ويب)',
  [BANNER_ACTION_TYPES.IN_APP_ROUTE]: 'شاشة داخل التطبيق',
  [BANNER_ACTION_TYPES.WHATSAPP_ADMIN]: 'محادثة واتساب الإدارة',
};

interface BannerFormData {
  title: string;
  headline: string;
  subtitle: string;
  imageUrl: string;
  ctaLabel: string;
  actionType: BannerActionType;
  actionValue: string;
  startsAt: string; // datetime-local string
  endsAt: string; // datetime-local string
  isActive: boolean;
}

const INITIAL_FORM_DATA: BannerFormData = {
  title: '',
  headline: '',
  subtitle: '',
  imageUrl: '',
  ctaLabel: '',
  actionType: BANNER_ACTION_TYPES.NONE,
  actionValue: '',
  startsAt: '',
  endsAt: '',
  isActive: true,
};

const DAMASCUS_OFFSET_HOURS = 3;

/**
 * تحويل تاريخ UTC ISO إلى صيغة datetime-local بتوقيت دمشق (UTC+3) حصراً
 * بغض النظر عن المنطقة الزمنية لمتصفح الأدمن
 */
function toDateTimeLocalString(isoString?: string | null): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  // إضافة إزاحة دمشق (UTC+3) الثابتة
  const damascusTime = new Date(d.getTime() + DAMASCUS_OFFSET_HOURS * 3600 * 1000);
  const year = damascusTime.getUTCFullYear();
  const month = String(damascusTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(damascusTime.getUTCDate()).padStart(2, '0');
  const hours = String(damascusTime.getUTCHours()).padStart(2, '0');
  const minutes = String(damascusTime.getUTCMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * تحويل مدخلات datetime-local (بتوقيت دمشق) إلى UTC ISO String
 * بإضافة إزاحة +03:00 صريحة لتفادي أي انحراف بسبب توقيت متصفح المستخدم
 */
function fromDateTimeLocalToUtc(dateTimeLocal: string): string | null {
  if (!dateTimeLocal || !dateTimeLocal.trim()) return null;
  const normalized =
    dateTimeLocal.length === 16 ? `${dateTimeLocal}:00+03:00` : `${dateTimeLocal}+03:00`;
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function formatDamascusDateTime(isoString?: string | null): string {
  if (!isoString) return 'غير محدد';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return 'غير صالح';
    return new Intl.DateTimeFormat('ar-SY', {
      timeZone: 'Asia/Damascus',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return String(isoString);
  }
}

function isPastDate(isoString?: string | null): boolean {
  if (!isoString) return false;
  const d = new Date(isoString);
  return !isNaN(d.getTime()) && d.getTime() < Date.now();
}

function isFutureDate(isoString?: string | null): boolean {
  if (!isoString) return false;
  const d = new Date(isoString);
  return !isNaN(d.getTime()) && d.getTime() > Date.now();
}

export default function BannersManagementPage() {
  const { showToast } = useToast();

  const [banners, setBanners] = useState<AdminBannerResponse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [hasOrderChanges, setHasOrderChanges] = useState<boolean>(false);
  const [savingOrder, setSavingOrder] = useState<boolean>(false);

  // Modal State
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editingBannerId, setEditingBannerId] = useState<string | null>(null);
  const [formData, setFormData] = useState<BannerFormData>(INITIAL_FORM_DATA);
  const [formImageError, setFormImageError] = useState<boolean>(false);

  // Delete Confirm State
  const [deleteConfirmBanner, setDeleteConfirmBanner] = useState<AdminBannerResponse | null>(null);

  const fetchBanners = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get<AdminBannerResponse[]>('/admin/banners');
      setBanners(res.data);
      setHasOrderChanges(false);
    } catch {
      showToast('تعذر تحميل الشرائح الإعلانية، يرجى المحاولة لاحقاً', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void fetchBanners();
  }, [fetchBanners]);

  const activeBannersCount = useMemo(() => {
    return banners.filter((b) => b.isActive).length;
  }, [banners]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingBannerId(null);
    setFormData({
      ...INITIAL_FORM_DATA,
      isActive: activeBannersCount < MAX_ACTIVE_BANNERS,
    });
    setFormImageError(false);
    setModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (banner: AdminBannerResponse) => {
    setEditingBannerId(banner.id);
    setFormData({
      title: banner.title,
      headline: banner.headline || '',
      subtitle: banner.subtitle || '',
      imageUrl: banner.imageUrl,
      ctaLabel: banner.ctaLabel || '',
      actionType: banner.actionType as BannerActionType,
      actionValue: banner.actionValue || '',
      startsAt: toDateTimeLocalString(banner.startsAt),
      endsAt: toDateTimeLocalString(banner.endsAt),
      isActive: banner.isActive,
    });
    setFormImageError(false);
    setModalOpen(true);
  };

  // Form Field Change Handler
  const handleFormChange = (
    field: keyof BannerFormData,
    value: string | boolean,
  ) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'imageUrl') {
        setFormImageError(false);
      }
      if (field === 'actionType') {
        if (value === BANNER_ACTION_TYPES.IN_APP_ROUTE) {
          next.actionValue = BANNER_IN_APP_ROUTES[0];
        } else if (
          value === BANNER_ACTION_TYPES.NONE ||
          value === BANNER_ACTION_TYPES.WHATSAPP_ADMIN
        ) {
          next.actionValue = '';
        }
      }
      return next;
    });
  };

  // Form Submit Handler
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validations
    if (!formData.title.trim()) {
      showToast('يرجى إدخال العنوان الإداري الداخلي', 'error');
      return;
    }
    if (!formData.headline.trim()) {
      showToast('يرجى إدخال عنوان الشريحة المعروض للعميل', 'error');
      return;
    }
    if (!formData.imageUrl.trim() || !formData.imageUrl.startsWith('https://')) {
      showToast('رابط الصورة يجب أن يكون رابطاً آمناً يبدأ بـ https://', 'error');
      return;
    }

    if (formData.actionType === BANNER_ACTION_TYPES.EXTERNAL_URL) {
      if (!formData.actionValue.trim() || !formData.actionValue.startsWith('https://')) {
        showToast('الرابط الخارجي يجب أن يبدأ بـ https://', 'error');
        return;
      }
    }

    if (formData.actionType === BANNER_ACTION_TYPES.IN_APP_ROUTE) {
      if (
        !BANNER_IN_APP_ROUTES.includes(
          formData.actionValue as BannerInAppRoute,
        )
      ) {
        showToast('يرجى اختيار مسار داخلي صالح من القائمة المعتمدة', 'error');
        return;
      }
    }

    // Proactive Active Cap Check
    if (formData.isActive) {
      const isAlreadyActiveInList = editingBannerId
        ? banners.find((b) => b.id === editingBannerId)?.isActive
        : false;

      if (!isAlreadyActiveInList && activeBannersCount >= MAX_ACTIVE_BANNERS) {
        showToast(
          `وصلت للحد الأقصى للشرائح النشطة (${MAX_ACTIVE_BANNERS} شرائح). يرجى تعطيل شريحة أخرى أولاً.`,
          'error',
        );
        return;
      }
    }

    try {
      setActionLoading(true);

      const payload: CreateBannerDto | UpdateBannerDto = {
        title: formData.title.trim(),
        headline: formData.headline.trim(),
        subtitle: formData.subtitle.trim() || undefined,
        imageUrl: formData.imageUrl.trim(),
        ctaLabel: formData.ctaLabel.trim() || undefined,
        actionType: formData.actionType,
        actionValue:
          formData.actionType === BANNER_ACTION_TYPES.EXTERNAL_URL ||
          formData.actionType === BANNER_ACTION_TYPES.IN_APP_ROUTE
            ? formData.actionValue.trim()
            : null,
        startsAt: fromDateTimeLocalToUtc(formData.startsAt),
        endsAt: fromDateTimeLocalToUtc(formData.endsAt),
        isActive: formData.isActive,
      };

      if (editingBannerId) {
        await api.patch(`/admin/banners/${editingBannerId}`, payload);
        showToast('تم تحديث الشريحة الإعلانية بنجاح', 'success');
      } else {
        await api.post('/admin/banners', payload);
        showToast('تم إنشاء الشريحة الإعلانية بنجاح', 'success');
      }

      setModalOpen(false);
      await fetchBanners();
    } catch (err: unknown) {
      const axiosError = err as {
        response?: { data?: { message?: string } };
      };
      const msg =
        axiosError?.response?.data?.message || 'حدث خطأ أثناء حفظ الشريحة الإعلانية';
      showToast(msg, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle Active Switch with Proactive Cap Guard
  const handleToggleActive = async (banner: AdminBannerResponse) => {
    if (!banner.isActive && activeBannersCount >= MAX_ACTIVE_BANNERS) {
      showToast(
        `لا يمكن التفعيل: تم الوصول للحد الأقصى (${MAX_ACTIVE_BANNERS} شرائح نشطة). عطل شريحة أخرى أولاً.`,
        'error',
      );
      return;
    }

    try {
      setActionLoading(true);
      await api.patch(`/admin/banners/${banner.id}`, {
        isActive: !banner.isActive,
      });
      showToast(
        banner.isActive
          ? `تم تعطيل الشريحة "${banner.headline}"`
          : `تم تفعيل الشريحة "${banner.headline}" بنجاح`,
        'success',
      );
      await fetchBanners();
    } catch (err: unknown) {
      const axiosError = err as {
        response?: { data?: { message?: string } };
      };
      const msg =
        axiosError?.response?.data?.message || 'تعذر تغيير حالة تفعيل الشريحة';
      showToast(msg, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Reorder Item Up
  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    const updated = [...banners];
    const temp = updated[index - 1];
    updated[index - 1] = updated[index];
    updated[index] = temp;
    setBanners(updated);
    setHasOrderChanges(true);
  };

  // Reorder Item Down
  const handleMoveDown = (index: number) => {
    if (index >= banners.length - 1) return;
    const updated = [...banners];
    const temp = updated[index + 1];
    updated[index + 1] = updated[index];
    updated[index] = temp;
    setBanners(updated);
    setHasOrderChanges(true);
  };

  // Save Reorder: EXACTLY ONE HTTP REQUEST
  const handleSaveReorder = async () => {
    if (!hasOrderChanges) return;

    try {
      setSavingOrder(true);
      const bannerIds = banners.map((b) => b.id);
      // Calls PATCH /admin/banners/reorder in a single batch call
      await api.patch('/admin/banners/reorder', { bannerIds });
      showToast('تم حفظ الترتيب الجديد للشرائح بنجاح', 'success');
      setHasOrderChanges(false);
      await fetchBanners();
    } catch (err: unknown) {
      const axiosError = err as {
        response?: { data?: { message?: string } };
      };
      const msg =
        axiosError?.response?.data?.message || 'فشل في حفظ الترتيب الجديد للشرائح';
      showToast(msg, 'error');
    } finally {
      setSavingOrder(false);
    }
  };

  // Soft Delete Banner
  const handleConfirmDelete = async () => {
    if (!deleteConfirmBanner) return;

    try {
      setActionLoading(true);
      await api.delete(`/admin/banners/${deleteConfirmBanner.id}`);
      showToast(`تم حذف الشريحة "${deleteConfirmBanner.headline}" بنجاح`, 'success');
      setDeleteConfirmBanner(null);
      await fetchBanners();
    } catch (err: unknown) {
      const axiosError = err as {
        response?: { data?: { message?: string } };
      };
      const msg =
        axiosError?.response?.data?.message || 'فشل في حذف الشريحة الإعلانية';
      showToast(msg, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-12" dir="rtl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              الشرائح الإعلانية (Banners)
            </h1>
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                activeBannersCount >= MAX_ACTIVE_BANNERS
                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
              }`}
            >
              النشطة: {activeBannersCount} / {MAX_ACTIVE_BANNERS}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            إدارة وترتيب شرائح العروض الترويجية على الشاشة الرئيسية للزبون (روابط مباشرة HTTPS)
          </p>
        </div>

        <div className="flex items-center gap-2">
          {hasOrderChanges && (
            <button
              type="button"
              onClick={handleSaveReorder}
              disabled={savingOrder}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors shadow-xs disabled:opacity-50"
            >
              {savingOrder ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              )}
              <span>حفظ الترتيب الجديد</span>
            </button>
          )}

          <button
            type="button"
            onClick={fetchBanners}
            disabled={loading || savingOrder}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors shadow-xs disabled:opacity-50"
          >
            <svg
              className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>تحديث</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreate}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-[#00C1A7] rounded-xl hover:bg-[#009b86] transition-colors shadow-xs"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            <span>إضافة شريحة جديدة</span>
          </button>
        </div>
      </div>

      {/* Reorder Notification Banner */}
      {hasOrderChanges && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between text-amber-800 text-xs">
          <div className="flex items-center gap-2 font-medium">
            <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>تم تعديل ترتيب الشرائح محلياً. اضغط على "حفظ الترتيب الجديد" لتثبيت الترتيب على الخادم كطلب واحد.</span>
          </div>
          <button
            type="button"
            onClick={handleSaveReorder}
            disabled={savingOrder}
            className="px-3 py-1 bg-amber-600 text-white rounded-lg font-bold hover:bg-amber-700 transition-colors"
          >
            حفظ الآن
          </button>
        </div>
      )}

      {/* Banners List / Table */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <div className="inline-block w-8 h-8 border-3 border-[#00C1A7] border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-sm text-slate-500 font-medium">جاري تحميل الشرائح الإعلانية...</p>
        </div>
      ) : banners.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-base font-bold text-slate-800 mb-1">لا توجد شرائح إعلانية حالياً</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mb-5">
            قم بإضافة شريحة ترويجية جديدة لعرضها على الصفحة الرئيسية لزبائن تطبيق فَوْراً
          </p>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-[#00C1A7] rounded-xl hover:bg-[#009b86] transition-colors shadow-xs"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            <span>إضافة الشريحة الأولى</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {banners.map((banner, index) => {
            const expired = isPastDate(banner.endsAt);
            const future = isFutureDate(banner.startsAt);

            return (
              <div
                key={banner.id}
                className={`bg-white rounded-xl border transition-all p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  !banner.isActive || expired
                    ? 'border-slate-200 opacity-80 bg-slate-50/50'
                    : 'border-slate-200 hover:border-slate-300 shadow-xs'
                }`}
              >
                {/* Right section: Thumbnail + Details */}
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  {/* Reorder Buttons */}
                  <div className="flex flex-col gap-1 items-center shrink-0">
                    <button
                      type="button"
                      disabled={index === 0 || savingOrder}
                      onClick={() => handleMoveUp(index)}
                      className="p-1 rounded-md text-slate-400 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-20 transition-colors"
                      title="تقديم لأعلى"
                      aria-label="تقديم لأعلى"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <span className="text-[11px] font-mono text-slate-400 font-bold">
                      {banner.sortOrder}
                    </span>
                    <button
                      type="button"
                      disabled={index === banners.length - 1 || savingOrder}
                      onClick={() => handleMoveDown(index)}
                      className="p-1 rounded-md text-slate-400 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-20 transition-colors"
                      title="تأخير لأسفل"
                      aria-label="تأخير لأسفل"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>

                  {/* Thumbnail (16:7 preview) */}
                  <div className="w-28 sm:w-36 aspect-[16/7] rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0 relative flex items-center justify-center">
                    <img
                      src={banner.imageUrl}
                      alt={banner.headline || banner.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = 'none';
                        const parent = e.currentTarget.parentElement;
                        if (parent) {
                          parent.innerHTML =
                            '<span class="text-[10px] text-rose-500 font-bold p-1 text-center">تعذر التحميل</span>';
                        }
                      }}
                    />
                  </div>

                  {/* Text Details */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-extrabold text-sm text-slate-900 truncate">
                        {banner.headline}
                      </h3>
                      <span className="text-xs text-slate-400 font-medium truncate">
                        ({banner.title})
                      </span>
                    </div>

                    {banner.subtitle && (
                      <p className="text-xs text-slate-500 truncate mb-2">
                        {banner.subtitle}
                      </p>
                    )}

                    {/* Metadata & Badges */}
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      {/* Action Badge */}
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium text-[11px]">
                        <span>{ACTION_TYPE_LABELS[banner.actionType as BannerActionType] || banner.actionType}</span>
                        {banner.actionValue && (
                          <span className="text-slate-400 font-mono text-[10px]">
                            : {banner.actionValue}
                          </span>
                        )}
                      </span>

                      {/* CTA label */}
                      {banner.ctaLabel && (
                        <span className="px-2 py-0.5 rounded-md bg-teal-50 text-teal-700 border border-teal-200 font-semibold text-[11px]">
                          زر: {banner.ctaLabel}
                        </span>
                      )}

                      {/* Date Status Badge */}
                      {expired ? (
                        <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 font-bold text-[11px]">
                          منتهية الصلاحية
                        </span>
                      ) : future ? (
                        <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-bold text-[11px]">
                          مجدولة مستقبلاً
                        </span>
                      ) : banner.isActive ? (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[11px]">
                          سارية حالياً
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 font-medium text-[11px]">
                          معطلة
                        </span>
                      )}

                      {/* Date range details (Damascus time) */}
                      {(banner.startsAt || banner.endsAt) && (
                        <span className="text-[11px] text-slate-400">
                          {banner.startsAt ? `من ${formatDamascusDateTime(banner.startsAt)}` : ''}
                          {banner.endsAt ? ` إلى ${formatDamascusDateTime(banner.endsAt)}` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Left section: Controls */}
                <div className="flex items-center gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                  {/* Active Toggle Switch */}
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <span className="text-xs font-semibold text-slate-600">
                      {banner.isActive ? 'نشطة' : 'معطلة'}
                    </span>
                    <input
                      type="checkbox"
                      checked={banner.isActive}
                      onChange={() => handleToggleActive(banner)}
                      disabled={actionLoading}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00C1A7]" />
                  </label>

                  {/* Edit Button */}
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(banner)}
                    disabled={actionLoading}
                    className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-slate-200"
                    title="تعديل الشريحة"
                    aria-label="تعديل الشريحة"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>

                  {/* Delete Button */}
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmBanner(banner)}
                    disabled={actionLoading}
                    className="p-2 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-slate-200"
                    title="حذف الشريحة"
                    aria-label="حذف الشريحة"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full overflow-hidden border border-slate-200 my-8">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-lg font-black text-slate-900">
                {editingBannerId ? 'تعديل الشريحة الإعلانية' : 'إنشاء شريحة إعلانية جديدة'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
                aria-label="إغلاق"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitForm} className="p-6 space-y-5">
              {/* Internal Title & Public Headline */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    العنوان الداخلي للإدارة <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => handleFormChange('title', e.target.value)}
                    placeholder="مثال: حملة تخفيضات الخضار - نهاية الأسبوع"
                    className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00C1A7] focus:border-transparent outline-hidden"
                  />
                  <span className="text-[11px] text-slate-400 mt-0.5 block">
                    يظهر للأدمن فقط لتنظيم الحملات داخلياً
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    عنوان الشريحة للعميل (Headline) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.headline}
                    onChange={(e) => handleFormChange('headline', e.target.value)}
                    placeholder="مثال: خصم 20% على الخضار والفواكه"
                    className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00C1A7] focus:border-transparent outline-hidden font-bold"
                  />
                  <span className="text-[11px] text-slate-400 mt-0.5 block">
                    النص البارز المعروض على الشريحة في التطبيق
                  </span>
                </div>
              </div>

              {/* Subtitle & CTA Label */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    الوصف الفرعي (Subtitle)
                  </label>
                  <input
                    type="text"
                    value={formData.subtitle}
                    onChange={(e) => handleFormChange('subtitle', e.target.value)}
                    placeholder="مثال: طازجة يومياً من أفضل المزارع وبأسرع توصيل"
                    className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00C1A7] focus:border-transparent outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    نص زر الإجراء (CTA Label)
                  </label>
                  <input
                    type="text"
                    value={formData.ctaLabel}
                    onChange={(e) => handleFormChange('ctaLabel', e.target.value)}
                    placeholder="مثال: اطلب الآن / استكشف العروض"
                    className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00C1A7] focus:border-transparent outline-hidden"
                  />
                </div>
              </div>

              {/* Image URL with HTTPS validation */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  رابط صورة الشريحة (HTTPS Image URL) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="url"
                  required
                  value={formData.imageUrl}
                  onChange={(e) => handleFormChange('imageUrl', e.target.value)}
                  placeholder="https://images.unsplash.com/... أو أي رابط صورة HTTPS مباشر"
                  className="w-full px-3.5 py-2 text-xs font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00C1A7] focus:border-transparent outline-hidden text-left"
                  dir="ltr"
                />
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  مرحلة 7A: روابط صور مباشرة تعمل عبر بروتوكول HTTPS فقط (النسبة المثالية 16:7)
                </span>
              </div>

              {/* LIVE 16:7 PREVIEW CARD */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-[#00C1A7]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    معاينة حية لشاشة الزبون (نسبة 16:7)
                  </span>
                  <span className="text-[11px] text-slate-400">تحاكي عرض الشريحة في تطبيق الهاتف</span>
                </div>

                {/* 16:7 Simulated Container */}
                <div className="w-full max-w-lg mx-auto aspect-[16/7] rounded-xl overflow-hidden relative shadow-md bg-slate-800 border border-slate-300 flex items-center justify-center">
                  {formData.imageUrl ? (
                    <>
                      <img
                        src={formData.imageUrl}
                        alt="معاينة"
                        className="w-full h-full object-cover"
                        onError={() => setFormImageError(true)}
                        onLoad={() => setFormImageError(false)}
                      />
                      {/* Gradient overlay for readability */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 flex flex-col justify-end text-white">
                        <h4 className="font-extrabold text-sm sm:text-base drop-shadow-xs line-clamp-1">
                          {formData.headline || 'عنوان العرض الترويجي'}
                        </h4>
                        {formData.subtitle && (
                          <p className="text-xs text-white/90 drop-shadow-xs line-clamp-1 mt-0.5">
                            {formData.subtitle}
                          </p>
                        )}
                        {formData.ctaLabel && (
                          <div className="mt-2">
                            <span className="inline-block bg-[#00C1A7] text-white text-[11px] font-bold px-3 py-1 rounded-lg shadow-xs">
                              {formData.ctaLabel}
                            </span>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="text-center p-4 text-slate-400 text-xs">
                      أدخل رابط صورة HTTPS لمعاينة المظهر المباشر
                    </div>
                  )}
                </div>

                {/* Live Image Error Warning */}
                {formImageError && (
                  <div className="mt-2.5 p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
                    <svg className="w-4 h-4 shrink-0 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>
                      ⚠️ تعذر تحميل الصورة من الرابط المدخل. تأكد أن الرابط مباشر وصالح ويعمل عبر HTTPS قبل الحفظ.
                    </span>
                  </div>
                )}
              </div>

              {/* Action Type & Action Value */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    نوع الإجراء عند الضغط <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.actionType}
                    onChange={(e) =>
                      handleFormChange('actionType', e.target.value as BannerActionType)
                    }
                    className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00C1A7] focus:border-transparent outline-hidden bg-white"
                  >
                    <option value={BANNER_ACTION_TYPES.NONE}>
                      {ACTION_TYPE_LABELS[BANNER_ACTION_TYPES.NONE]}
                    </option>
                    <option value={BANNER_ACTION_TYPES.IN_APP_ROUTE}>
                      {ACTION_TYPE_LABELS[BANNER_ACTION_TYPES.IN_APP_ROUTE]}
                    </option>
                    <option value={BANNER_ACTION_TYPES.EXTERNAL_URL}>
                      {ACTION_TYPE_LABELS[BANNER_ACTION_TYPES.EXTERNAL_URL]}
                    </option>
                    <option value={BANNER_ACTION_TYPES.WHATSAPP_ADMIN}>
                      {ACTION_TYPE_LABELS[BANNER_ACTION_TYPES.WHATSAPP_ADMIN]}
                    </option>
                  </select>
                </div>

                <div>
                  {formData.actionType === BANNER_ACTION_TYPES.IN_APP_ROUTE ? (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        الشاشة الداخلية المستهدفة <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={formData.actionValue}
                        onChange={(e) => handleFormChange('actionValue', e.target.value)}
                        className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00C1A7] focus:border-transparent outline-hidden bg-white font-medium"
                      >
                        {BANNER_IN_APP_ROUTES.map((route) => (
                          <option key={route} value={route}>
                            {IN_APP_ROUTE_LABELS[route]} ({route})
                          </option>
                        ))}
                      </select>
                      <span className="text-[11px] text-slate-400 mt-0.5 block">
                        مسارات حقيقية معتمدة حصرياً في تطبيقي العميل
                      </span>
                    </div>
                  ) : formData.actionType === BANNER_ACTION_TYPES.EXTERNAL_URL ? (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        الرابط الخارجي (HTTPS URL) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="url"
                        required
                        value={formData.actionValue}
                        onChange={(e) => handleFormChange('actionValue', e.target.value)}
                        placeholder="https://example.com/promo"
                        className="w-full px-3.5 py-2 text-xs font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00C1A7] focus:border-transparent outline-hidden text-left"
                        dir="ltr"
                      />
                      <span className="text-[11px] text-slate-400 mt-0.5 block">
                        يفتح المتصفح الخارجي للعميل
                      </span>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1">
                        قيمة الإجراء
                      </label>
                      <input
                        type="text"
                        disabled
                        value={
                          formData.actionType === BANNER_ACTION_TYPES.WHATSAPP_ADMIN
                            ? 'سيتم التوجيه تلقائياً إلى واتساب الإدارة'
                            : 'لا توجد قيمة إضافية مطلوبة'
                        }
                        className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl bg-slate-100 text-slate-400 outline-hidden"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Date Scheduling (Damascus Time Display & Input) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    تاريخ ووقت بدء العرض (اختياري)
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.startsAt}
                    onChange={(e) => handleFormChange('startsAt', e.target.value)}
                    className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00C1A7] focus:border-transparent outline-hidden bg-white text-left font-mono"
                  />
                  <span className="text-[11px] text-slate-400 mt-0.5 block">
                    اتركه فارغاً لبدء العرض فوراً
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    تاريخ ووقت انتهاء العرض (اختياري)
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.endsAt}
                    onChange={(e) => handleFormChange('endsAt', e.target.value)}
                    className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00C1A7] focus:border-transparent outline-hidden bg-white text-left font-mono"
                  />
                  <span className="text-[11px] text-slate-400 mt-0.5 block">
                    اتركه فارغاً ليبقى العرض دائماً بلا نهاية
                  </span>
                </div>
              </div>

              {/* Expired Date Warning in Form */}
              {formData.endsAt && isPastDate(fromDateTimeLocalToUtc(formData.endsAt)) && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-center gap-2">
                  <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>
                    تنبيه: تاريخ الانتهاء المحدد هو في الماضي! هذه الشريحة لن تظهر للعملاء على الشاشة الرئيسية حتى لو كانت نشطة.
                  </span>
                </div>
              )}

              {/* Active Toggle & Proactive 10-Cap Warning */}
              <div className="pt-2 border-t border-slate-200">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => handleFormChange('isActive', e.target.checked)}
                    className="w-4 h-4 text-[#00C1A7] rounded border-slate-300 focus:ring-[#00C1A7]"
                  />
                  <span className="text-xs font-extrabold text-slate-800">
                    تفعيل هذه الشريحة فور الحفظ
                  </span>
                </label>

                {formData.isActive &&
                  !editingBannerId &&
                  activeBannersCount >= MAX_ACTIVE_BANNERS && (
                    <div className="mt-2 p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
                      <svg className="w-4 h-4 text-rose-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <span>
                        تنبيه سقف الأعمال: يوجد حالياً {activeBannersCount} شرائح نشطة (الحد الأقصى هو {MAX_ACTIVE_BANNERS}). لن تتمكن من الحفظ كشريحة نشطة حتى تعطل شريحة أخرى أولاً.
                      </span>
                    </div>
                  )}
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={actionLoading}
                  className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-[#00C1A7] hover:bg-[#009b86] rounded-xl transition-colors shadow-xs disabled:opacity-50"
                >
                  {actionLoading && (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  <span>{editingBannerId ? 'حفظ التعديلات' : 'إنشاء الشريحة'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmBanner && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-base font-black text-slate-900 mb-2">
              تأكيد حذف الشريحة الإعلانية
            </h3>
            <p className="text-xs text-slate-500 mb-6">
              هل أنت متأكد من حذف الشريحة "{deleteConfirmBanner.headline}"؟ سيتم حذفها ناعماً (Soft Delete) وتعطيلها فوراً ولن تظهر للعملاء.
            </p>

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmBanner(null)}
                disabled={actionLoading}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={actionLoading}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors shadow-xs disabled:opacity-50"
              >
                {actionLoading && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                <span>تأكيد الحذف</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
