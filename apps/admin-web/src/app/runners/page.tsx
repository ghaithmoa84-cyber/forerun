'use client';

import React, { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { toAdminErrorMessage } from '@/lib/errorMessage';
import { useToast } from '@/components/Toast';
import { WhatsAppButton } from '@/components/WhatsAppButton';

import {
  type RunnerProfileResponse,
  type PaginatedResponse,
  type RunnerStatus,
} from '@forerun/shared-types';

type Runner = RunnerProfileResponse;
type RunnersApiResponse = PaginatedResponse<Runner>;

export default function RunnersPage() {
  const { showToast } = useToast();
  const [runners, setRunners] = useState<Runner[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [loading, setLoading] = useState<boolean>(true);

  // Create Modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    whatsapp: '',
    password: '',
  });
  const [createLoading, setCreateLoading] = useState(false);

  // Edit Modal state
  const [editRunner, setEditRunner] = useState<Runner | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    password: '',
    notes: '',
  });
  const [editLoading, setEditLoading] = useState(false);

  // Visibility toggle loading state per runner
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchRunners = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const res = await api.get<RunnersApiResponse>('/admin/runners', {
        params: { page, limit: 20 },
      });
      setRunners(res.data.data);
      setMeta(res.data.meta);
    } catch {
      showToast('تعذر تحميل بيانات المندوبين، يرجى المحاولة لاحقاً', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchRunners(1);
  }, [fetchRunners]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedPhone = createForm.whatsapp.trim();

    if (!createForm.name || createForm.name.length < 2) {
      showToast('يرجى إدخال اسم المندوب بشكل صحيح (حرفين على الأقل)', 'info');
      return;
    }
if (!trimmedPhone || !/^09\d{8}$/.test(trimmedPhone)) {
      showToast('يرجى إدخل رقم واتساب صحيح (مثال: 0912345678)', 'info');
      return;
    }
    if (!createForm.password || createForm.password.length < 8) {
      showToast('كلمة المرور يجب أن تكون 8 محارف على الأقل', 'info');
      return;
    }

    try {
      setCreateLoading(true);
      await api.post('/admin/runners', {
        name: createForm.name.trim(),
        whatsapp: trimmedPhone,
        password: createForm.password,
      });

      showToast(`تمت إضافة المندوب "${createForm.name}" بنجاح`, 'success');
      setIsCreateOpen(false);
      setCreateForm({ name: '', whatsapp: '', password: '' });
      fetchRunners(meta.page);
    } catch (err: unknown) {
      showToast(toAdminErrorMessage(err, 'فشل في إضافة المندوب'), 'error');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleOpenEdit = (runner: Runner) => {
    setEditRunner(runner);
    setEditForm({
      name: runner.name,
      password: '',
      notes: runner.notes || '',
    });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRunner) return;

    try {
      setEditLoading(true);
      const payload: { name: string; notes?: string; password?: string } = {
        name: editForm.name.trim(),
        notes: editForm.notes ? editForm.notes.trim() : undefined,
      };

      if (editForm.password && editForm.password.length >= 8) {
        payload.password = editForm.password;
      }

      await api.put(`/admin/runners/${editRunner.id}`, payload);
      showToast(`تم تحديث بيانات المندوب "${editForm.name}" بنجاح`, 'success');
      setEditRunner(null);
      fetchRunners(meta.page);
    } catch (err: unknown) {
      showToast(toAdminErrorMessage(err, 'فشل في تعديل بيانات المندوب'), 'error');
    } finally {
      setEditLoading(false);
    }
  };

  const handleToggleVisibility = async (runner: Runner) => {
    const newVisibility = !runner.isVisible;

    // Optimistic update
    setRunners((prev) =>
      prev.map((r) => (r.id === runner.id ? { ...r, isVisible: newVisibility } : r)),
    );
    setTogglingId(runner.id);

    try {
      await api.put(`/admin/runners/${runner.id}/visibility`, {
        isVisible: newVisibility,
      });
      showToast(
        `تم ${newVisibility ? 'تفعيل ظهور' : 'إخفاء'} المندوب "${runner.name}"`,
        'success',
      );
    } catch {
      // Revert optimistic update
      setRunners((prev) =>
        prev.map((r) => (r.id === runner.id ? { ...r, isVisible: !newVisibility } : r)),
      );
      showToast(`فشل في تحديث حالة ظهور المندوب "${runner.name}"`, 'error');
    } finally {
      setTogglingId(null);
    }
  };

const RUNNER_STATUS_LABEL: Record<RunnerStatus, string> = {
  AVAILABLE: 'متاح (Available)',
  ON_MISSION: 'في مهمة (On Mission)',
  UNAVAILABLE: 'غير متاح (Offline)',
};

const RUNNER_STATUS_STYLE: Record<RunnerStatus, string> = {
  AVAILABLE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  ON_MISSION: 'bg-amber-50 text-amber-700 border-amber-200',
  UNAVAILABLE: 'bg-slate-100 text-slate-600 border-slate-200',
};

const RUNNER_STATUS_DOT: Record<RunnerStatus, string> = {
  AVAILABLE: 'bg-emerald-500 animate-pulse',
  ON_MISSION: 'bg-amber-500',
  UNAVAILABLE: 'bg-slate-400',
};

  const getStatusBadge = (status: RunnerStatus) => {
    const label = RUNNER_STATUS_LABEL[status] ?? status;
    const style = RUNNER_STATUS_STYLE[status] ?? 'bg-slate-100 text-slate-600 border-slate-200';
    const dot = RUNNER_STATUS_DOT[status] ?? 'bg-slate-400';
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
          <h1 className="text-2xl font-black text-slate-900">إدارة المندوبين</h1>
          <p className="text-xs text-slate-500 mt-1">متابعة جاهزية الأسطول، التقييمات، والظهور في التطبيق</p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#7DDDD4] hover:bg-[#5CCFC5] text-white font-bold rounded-xl text-xs shadow-md shadow-[#7DDDD4]/20 transition-all cursor-pointer"
        >
          <span className="text-base font-black">+</span>
          <span>إضافة مندوب جديد</span>
        </button>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Mobile Cards View (sm:hidden) */}
        <div className="sm:hidden p-4 space-y-3">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
              <span className="w-5 h-5 border-2 border-[#7DDDD4] border-t-transparent rounded-full animate-spin"></span>
              <span>جاري تحميل بيانات أسطول المندوبين...</span>
            </div>
          ) : runners.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-xs">
              لا يوجد مناديب مسجلين في المنصة حتى الآن.
            </div>
          ) : (
            runners.map((r) => (
              <div key={r.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
                {/* السطر الأول: الاسم + مفتاح الظهور */}
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <span className="min-w-0 break-words font-bold text-slate-900 text-sm">{r.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">
                      {r.isVisible ? 'ظاهر' : 'مخفي'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleToggleVisibility(r)}
                      disabled={togglingId === r.id}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden disabled:opacity-50 ${
                        r.isVisible ? 'bg-[#7DDDD4]' : 'bg-slate-300'
                      }`}
                      title={r.isVisible ? 'ظاهر للعملاء' : 'مخفي عن العملاء'}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                          r.isVisible ? '-translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* WhatsApp */}
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">واتساب:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-medium text-slate-800" dir="ltr">{r.whatsapp}</span>
                    <WhatsAppButton phone={r.whatsapp} size="xs" />
                  </div>
                </div>

                {/* الحالة التشغيلية */}
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">الحالة:</span>
                  <div>{getStatusBadge(r.status)}</div>
                </div>

                {/* التقييم */}
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">التقييم:</span>
                  <div className="flex items-center gap-1 text-slate-700 font-bold">
                    <span className="text-amber-400 text-sm">★</span>
                    <span>{r.avgRating ? r.avgRating.toFixed(1) : 'جديد'}</span>
                    <span className="text-slate-400 font-normal text-[11px]">
                      ({r.totalRatings} تقييم)
                    </span>
                  </div>
                </div>

                {/* زر التعديل */}
                <button
                  type="button"
                  onClick={() => handleOpenEdit(r)}
                  className="w-full py-2 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors text-center inline-flex items-center justify-center"
                >
                  تعديل البيانات
                </button>
              </div>
            ))
          )}
        </div>

        {/* Desktop Table (hidden sm:block) */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50/75 border-b border-slate-200 text-slate-600 font-bold">
              <tr>
                <th className="px-5 py-3.5">اسم المندوب</th>
                <th className="px-5 py-3.5">رقم WhatsApp</th>
                <th className="px-5 py-3.5">الحالة التشغيلية</th>
                <th className="px-5 py-3.5">متوسط التقييم</th>
                <th className="px-5 py-3.5 text-center">الظهور في التطبيق</th>
                <th className="px-5 py-3.5 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-[#7DDDD4] border-t-transparent rounded-full animate-spin"></span>
                      <span>جاري تحميل بيانات أسطول المندوبين...</span>
                    </div>
                  </td>
                </tr>
              ) : runners.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                    لا يوجد مناديب مسجلين في المنصة حتى الآن.
                  </td>
                </tr>
              ) : (
                runners.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-4 font-bold text-slate-900">{r.name}</td>
                    <td className="px-5 py-4 font-medium text-slate-700">
                      <div className="flex items-center gap-2">
                        <span dir="ltr" className="font-mono">{r.whatsapp}</span>
                        <WhatsAppButton phone={r.whatsapp} size="xs" />
                      </div>
                    </td>
                    <td className="px-5 py-4">{getStatusBadge(r.status)}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1 text-slate-700 font-bold">
                        <span className="text-amber-400 text-sm">★</span>
                        <span>{r.avgRating ? r.avgRating.toFixed(1) : 'جديد'}</span>
                        <span className="text-slate-400 font-normal text-[11px]">
                          ({r.totalRatings} تقييم)
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleVisibility(r)}
                        disabled={togglingId === r.id}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden disabled:opacity-50 ${
                          r.isVisible ? 'bg-[#7DDDD4]' : 'bg-slate-300'
                        }`}
                        title={r.isVisible ? 'ظاهر للعملاء' : 'مخفي عن العملاء'}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                            r.isVisible ? '-translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <button
                        onClick={() => handleOpenEdit(r)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors text-xs border border-slate-200"
                      >
                        تعديل
                      </button>
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
            إجمالي المندوبين: <span className="font-bold text-slate-800">{meta.total}</span> (صفحة{' '}
            <span className="font-bold text-slate-800">{meta.page}</span> من{' '}
            <span className="font-bold text-slate-800">{meta.totalPages || 1}</span>)
          </div>

          <div className="flex items-center justify-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => fetchRunners(meta.page - 1)}
              disabled={meta.page <= 1 || loading}
              className="w-full sm:w-auto px-4 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed justify-center inline-flex items-center"
            >
              السابق
            </button>
            <button
              onClick={() => fetchRunners(meta.page + 1)}
              disabled={meta.page >= meta.totalPages || loading}
              className="w-full sm:w-auto px-4 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed justify-center inline-flex items-center"
            >
              التالي
            </button>
          </div>
        </div>
      </div>

      {/* Modal: New Runner */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4" dir="rtl">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">إضافة مندوب جديد</h3>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  اسم المندوب
                </label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder="الاسم الثلاثي"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-[#7DDDD4] focus:ring-2 focus:ring-[#7DDDD4]/20 text-xs text-slate-900 outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  رقم الواتساب
                </label>
                <div className="relative flex rounded-xl border border-slate-300 focus-within:border-[#7DDDD4] focus-within:ring-2 focus-within:ring-[#7DDDD4]/20 overflow-hidden">
                  <input
                    type="text"
                    dir="ltr"
                    value={createForm.whatsapp}
                    onChange={(e) => setCreateForm({ ...createForm, whatsapp: e.target.value })}
                    placeholder="0912345678"
                    className="w-full px-3.5 py-2.5 text-xs text-slate-900 outline-hidden bg-transparent"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  كلمة المرور
                </label>
                <input
                  type="password"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  placeholder="8 محارف على الأقل"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-[#7DDDD4] focus:ring-2 focus:ring-[#7DDDD4]/20 text-xs text-slate-900 outline-hidden"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  disabled={createLoading}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="px-4 py-2 bg-[#7DDDD4] hover:bg-[#5CCFC5] text-white text-xs font-bold rounded-xl shadow-md disabled:opacity-50 flex items-center gap-1.5"
                >
                  {createLoading && (
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  )}
                  <span>إضافة المندوب</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Runner */}
      {editRunner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4" dir="rtl">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">تعديل بيانات المندوب</h3>
              <button
                onClick={() => setEditRunner(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  اسم المندوب
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-[#7DDDD4] focus:ring-2 focus:ring-[#7DDDD4]/20 text-xs text-slate-900 outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  كلمة المرور الجديدة (اتركها فارغة للإبقاء على الحالية)
                </label>
                <input
                  type="password"
                  value={editForm.password}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-[#7DDDD4] focus:ring-2 focus:ring-[#7DDDD4]/20 text-xs text-slate-900 outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  ملاحظات إدارية
                </label>
                <textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  rows={3}
                  placeholder="ملاحظات حول المندوب، المنطقة، أو الدراجة/المركبة..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-[#7DDDD4] focus:ring-2 focus:ring-[#7DDDD4]/20 text-xs text-slate-900 outline-hidden resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditRunner(null)}
                  disabled={editLoading}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-4 py-2 bg-[#7DDDD4] hover:bg-[#5CCFC5] text-white text-xs font-bold rounded-xl shadow-md disabled:opacity-50 flex items-center gap-1.5"
                >
                  {editLoading && (
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  )}
                  <span>حفظ التعديلات</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}






