import { useState } from 'react';
import { usePwaInstall } from '../hooks/usePwaInstall';

const DISMISS_KEY = 'forerun_pwa_banner_dismissed';

export function InstallPromptBanner() {
  const { isInstallable, isInstalling, installError, clearInstallError, installApp } = usePwaInstall();
  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem(DISMISS_KEY) === 'true';
  });

  const handleDismiss = () => {
    setIsDismissed(true);
    sessionStorage.setItem(DISMISS_KEY, 'true');
  };

  if ((!isInstallable && !installError) || isDismissed) {
    return null;
  }

  return (
    <aside className="pwa-install-banner" aria-label="تثبيت التطبيق">
      <div className="pwa-install-banner__main">
        <div className="pwa-install-banner__content">
          <div className="pwa-install-banner__icon">
            <svg
              viewBox="0 0 24 24"
              width="22"
              height="22"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
              <line x1="12" y1="18" x2="12.01" y2="18" />
            </svg>
          </div>
          <div className="pwa-install-banner__text">
            <strong>ثبّت تطبيق فَوْراً للمندوب</strong>
            <span>استلم الطلبات والإشعارات فوراً من شاشتك الرئيسية</span>
          </div>
        </div>

        <div className="pwa-install-banner__actions">
          <button
            type="button"
            className="btn-pwa-install"
            onClick={() => void installApp()}
            disabled={isInstalling}
          >
            {isInstalling ? (
              'جاري التثبيت...'
            ) : (
              <>
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>تثبيت الآن</span>
              </>
            )}
          </button>

          <button
            type="button"
            className="btn-pwa-dismiss"
            onClick={handleDismiss}
            aria-label="إغلاق التنويه"
            title="إغلاق"
          >
            ✕
          </button>
        </div>
      </div>

      {installError && (
        <div className="pwa-install-banner__error" role="alert">
          <span className="pwa-error-text">⚠️ {installError}</span>
          <button
            type="button"
            className="btn-pwa-error-close"
            onClick={clearInstallError}
            title="إغلاق رسالة التنبيه"
          >
            ✕
          </button>
        </div>
      )}
    </aside>
  );
}

export function HeaderInstallButton() {
  const { isInstallable, isInstalling, installApp } = usePwaInstall();

  if (!isInstallable) {
    return null;
  }

  return (
    <button
      type="button"
      className="btn-install-header"
      onClick={() => void installApp()}
      disabled={isInstalling}
      title="تثبيت تطبيق فَوْراً على جهازك"
    >
      <svg
        viewBox="0 0 24 24"
        width="15"
        height="15"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      <span>تثبيت التطبيق</span>
    </button>
  );
}
