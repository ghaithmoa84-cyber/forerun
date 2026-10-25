'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { SyrianPhoneSchema, type LoginResponse } from '@forerun/shared-types';
import { toAdminErrorMessage } from '@/lib/errorMessage';

export default function LoginPage() {
  const router = useRouter();
  const [whatsapp, setWhatsapp] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // F8: توحيد تحقق الهاتف (BUG-012)
    const trimmedPhone = whatsapp.trim();
    const phoneResult = SyrianPhoneSchema.safeParse(trimmedPhone);
    if (!phoneResult.success) {
      setError(phoneResult.error.errors[0].message);
      return;
    }

if (!password) {
      setError('يرجى إدخال كلمة المرور');
      return;
    }

    try {
      setLoading(true);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
      const response = await axios.post<LoginResponse>(`${apiUrl}/auth/login`, {
        whatsapp: trimmedPhone,
        password,
      });

      const { accessToken, refreshToken, user } = response.data;

      // Ensure user is an ADMIN
      if (user.role !== 'ADMIN') {
        setError('هذا الحساب لا يملك صلاحيات وصول إدارية.');
        setLoading(false);
        return;
      }

      // Store in localStorage
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('adminName', user.name);
      localStorage.setItem('userName', user.name);
      localStorage.setItem('userId', user.id);
      localStorage.setItem('userRole', user.role);

      let expiryMs: number | null = null;
      try {
        const parts = accessToken.split('.');
        if (parts[1]) {
          const payload = JSON.parse(atob(parts[1]));
          if (typeof payload.exp === 'number') {
            expiryMs = payload.exp * 1000;
            localStorage.setItem('tokenExpiry', expiryMs.toString());
          }
        }
      } catch {
        // ignore token parsing error
      }

      // Store in cookies for middleware
if (typeof document !== 'undefined') {
          const secure = process.env.NODE_ENV === 'production' ? ' Secure;' : '';
          const maxAge = 7 * 24 * 60 * 60; // 7 days
          document.cookie = `accessToken=${accessToken}; path=/; max-age=${maxAge}; SameSite=Lax;${secure}`;
          if (expiryMs) {
            document.cookie = `tokenExpiry=${expiryMs}; path=/; max-age=${maxAge}; SameSite=Lax;${secure}`;
          }
        }

// Redirect to dashboard
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(
        toAdminErrorMessage(err, 'بيانات الاعتماد غير صحيحة، يرجى المحاولة ثانية.'),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans" dir="rtl">
      {/* Ambient background decoration */}
      <div className="absolute inset-0 pointer-events-none opacity-40">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-[#7DDDD4]/20 blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-blue-500/10 blur-3xl"></div>
      </div>

      <div className="relative w-full max-w-md">
        {/* System operational badge */}
        <div className="mb-6 mx-auto w-fit flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-slate-200 shadow-xs">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#7DDDD4] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#7DDDD4]"></span>
          </span>
          <span className="text-xs font-semibold text-slate-600">بوابة إدارة العمليات اللوجستية</span>
        </div>

        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-[#7DDDD4] flex items-center justify-center text-white text-2xl font-black shadow-md mb-3">
            ⚡
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">FORERUN</h1>
            <span className="text-sm bg-[#7DDDD4]/10 text-[#3ABFB5] font-bold px-2 py-0.5 rounded">فَوْراً</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">لوحة القيادة المركزية والتحكم اللوجستي</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-8">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-900">تسجيل الدخول</h2>
            <p className="text-xs text-slate-500 mt-1">أدخل بيانات الحساب الإداري المعتمد للمتابعة</p>
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-start gap-2">
              <span className="text-sm font-bold">⚠️</span>
              <span className="flex-1 leading-relaxed">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* WhatsApp field */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5" htmlFor="whatsapp">
                رقم الواتساب الإداري
              </label>
              <div className="relative flex rounded-xl border border-slate-300 focus-within:border-[#7DDDD4] focus-within:ring-2 focus-within:ring-[#7DDDD4]/20 transition-all overflow-hidden bg-slate-50/50">
                <input
                  id="whatsapp"
                  type="text"
                  dir="ltr"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="0912345678"
                  className="w-full px-3.5 py-2.5 text-sm bg-transparent outline-hidden text-slate-900 placeholder:text-slate-400 font-medium"
                  required
/>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">أدخل رقم الواتساب بالصيغة السورية (مثال: 0912345678)</p>
            </div>

            {/* Password field */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5" htmlFor="password">
                كلمة المرور
              </label>
              <div className="relative flex items-center rounded-xl border border-slate-300 focus-within:border-[#7DDDD4] focus-within:ring-2 focus-within:ring-[#7DDDD4]/20 transition-all bg-slate-50/50">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 text-sm bg-transparent outline-hidden text-slate-900 placeholder:text-slate-400 font-medium"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="px-3 text-slate-400 hover:text-slate-600 text-xs font-semibold select-none"
                >
                  {showPassword ? 'إخفاء' : 'إظهار'}
                </button>
              </div>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 bg-[#7DDDD4] hover:bg-[#5CCFC5] active:bg-[#3ABFB5] text-white font-bold rounded-xl text-sm shadow-md shadow-[#7DDDD4]/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  <span>جاري التحقق...</span>
                </>
              ) : (
                <span>دخول لوحة الإدارة</span>
              )}
            </button>
          </form>
        </div>

        {/* Security watermark */}
        <div className="mt-6 text-center text-[11px] text-slate-400">
          منصة FORERUN — تشفير تام ومراقبة صلاحيات صارمة
        </div>
      </div>
    </div>
  );
}













