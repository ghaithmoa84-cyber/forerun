import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useEffect, useState, useCallback } from 'react';
import api from '../api/client';
import type { ActiveOrderResponse } from '@forerun/shared-types';
import { InstallPromptBanner, HeaderInstallButton } from './InstallPromptBanner';

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [hasActiveOrder, setHasActiveOrder] = useState<boolean>(false);

  const checkActiveOrder = useCallback(async () => {
    try {
      const res = await api.get<ActiveOrderResponse | null>('/runner/orders/active');
      setHasActiveOrder(!!res.data);
    } catch {
      setHasActiveOrder(false);
    }
  }, []);

  useEffect(() => {
    void checkActiveOrder();
    const interval = setInterval(checkActiveOrder, 30000);
    return () => clearInterval(interval);
  }, [checkActiveOrder, location.pathname]);

  const handleMainTabClick = () => {
    if (hasActiveOrder) {
      navigate('/active-order');
    } else {
      navigate('/available');
    }
  };

  const isMainActive =
    location.pathname === '/available' || location.pathname === '/active-order';
  const isSettlementsActive = location.pathname === '/settlements';

  return (
    <div className="app-shell">
      {/* Top Header */}
      <header className="app-header">
        <div className="app-header__brand">
          <img
            src="/logo.png"
            alt="FORERUN"
            style={{ height: '44px', width: 'auto', objectFit: 'contain' }}
          />
        </div>

        <div className="app-header__actions">
          <HeaderInstallButton />

          {user && (
            <div className="app-header__user">
              <span className="user-name">{user.name}</span>
              <button
                type="button"
                className="btn-logout"
                onClick={logout}
                title="تسجيل الخروج"
              >
                خروج
              </button>
            </div>
          )}
        </div>
      </header>

      {/* PWA Install Notification Banner */}
      <InstallPromptBanner />

      {/* Main Page Content */}
      <main className="app-content">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="bottom-nav">
        <button
          type="button"
          className={`bottom-nav__item ${isMainActive ? 'bottom-nav__item--active' : ''}`}
          onClick={handleMainTabClick}
        >
          <svg
            className="nav-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          <span className="nav-label">
            {hasActiveOrder ? 'الطلب النشط' : 'الرئيسية'}
          </span>
          {hasActiveOrder && <span className="active-dot" />}
        </button>

        <NavLink
          to="/settlements"
          className={`bottom-nav__item ${isSettlementsActive ? 'bottom-nav__item--active' : ''}`}
        >
          <svg
            className="nav-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <line x1="12" y1="8" x2="12" y2="16" />
            <line x1="8" y1="12" x2="16" y2="12" />
          </svg>
          <span className="nav-label">التسويات</span>
        </NavLink>
      </nav>
    </div>
  );
}
