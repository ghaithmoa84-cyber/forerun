import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { usePwaInstall } from '../hooks/usePwaInstall';
import axios from 'axios';
import { ACCOUNT_SUSPENDED_MESSAGE } from '@forerun/shared-constants';
import { SyrianPhoneSchema } from '@forerun/shared-types';

export function LoginPage() {
  const navigate = useNavigate();
  const { user, login, isAuthenticated, isLoading } = useAuth();
  const { isInstallable, isInstalling, installApp } = usePwaInstall();
  useEffect(() => {
    if (isAuthenticated) {
      if (user?.status === 'SUSPENDED') {
        navigate('/suspended', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    }
  }, [isAuthenticated, user?.status, navigate]);
  const [whatsapp, setWhatsapp] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const whatsappTrim = whatsapp.trim();
    const phoneResult = SyrianPhoneSchema.safeParse(whatsappTrim);
    if (!phoneResult.success) {
      setError(phoneResult.error.errors[0].message);
      return;
    }

    if (password.length < 8) {
      setError('كلمة المرور يجب أن لا تقل عن 8 أحرف');
      return;
    }

    try {
      await login(whatsappTrim, password);
      navigate('/', { replace: true });
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        const msg = err.response.data.message;
        if (msg === ACCOUNT_SUSPENDED_MESSAGE) {
          navigate('/suspended', { replace: true });
          return;
        }
        setError(Array.isArray(msg) ? msg.join(' - ') : msg);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('فشل تسجيل الدخول. يرجى التحقق من صحة البيانات.');
      }
    }
  };

  return (
    <div className="login-container">
      <div className="login-card card">
        <div className="login-brand" style={{ textAlign: 'center', marginBottom: '24px' }}>
          <img
            src="/logo.png"
            alt="FORERUN"
            style={{ height: '100px', width: 'auto', objectFit: 'contain', marginBottom: '12px' }}
          />
          <h1 className="brand-title">فَوْراً — تطبيق المندوب</h1>
          <p className="brand-subtitle">تسجيل الدخول لمتابعة واستلام الطلبات</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label className="label" htmlFor="whatsapp">
              رقم الواتساب
            </label>
            <input
              id="whatsapp"
              type="tel"
              className="input"
              dir="ltr"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="0912345678"
              required
              autoComplete="tel"
            />
          </div>

          <div className="form-group" style={{ marginTop: '16px' }}>
            <label className="label" htmlFor="password">
              كلمة المرور
            </label>
            <input
              id="password"
              type="password"
              className="input"
              dir="ltr"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="error-msg" style={{ marginTop: '14px' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '22px' }}
            disabled={isLoading}
          >
            {isLoading ? 'جارٍ تسجيل الدخول...' : 'تسجيل الدخول'}
          </button>
        </form>

        {isInstallable && (
          <div className="login-install-section" style={{ marginTop: '20px', textAlign: 'center' }}>
            <div className="login-install-divider" />
            <button
              type="button"
              className="btn-pwa-login-install"
              onClick={() => void installApp()}
              disabled={isInstalling}
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                <line x1="12" y1="18" x2="12.01" y2="18" />
              </svg>
              <span>{isInstalling ? 'جاري تثبيت التطبيق...' : 'تثبيت التطبيق على هاتفك'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
