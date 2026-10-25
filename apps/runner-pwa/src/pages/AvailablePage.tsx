import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api/client';
import { useWebSocket } from '../hooks/useWebSocket';
import type { RunnerStatus } from '@forerun/shared-constants';
import type {
  ActiveOrderResponse,
  OrderAssignedPayload,
  RunnerProfileResponse,
  RunnerStatusUpdate,
} from '@forerun/shared-types';
import axios from 'axios';
import { toUserMessage } from '../lib/errorMessage';

const RUNNER_STATUS_LABEL: Record<RunnerStatus, string> = {
  AVAILABLE: 'متاح لاستقبال الطلبات',
  ON_MISSION: 'في مهمة حالياً',
  UNAVAILABLE: 'غير متاح',
};

const RUNNER_STATUS_BADGE: Record<RunnerStatus, string> = {
  AVAILABLE: 'status-available',
  ON_MISSION: 'status-on-mission',
  UNAVAILABLE: 'status-unavailable',
};

let audioCtx: AudioContext | null = null;
function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtxClass) return null;
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new AudioCtxClass();
  }
  return audioCtx;
}

function playSound(soundType?: string): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    if (soundType === 'new_order' || !soundType) {
      // Pleasant double notification chime
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now); // D5
      osc1.frequency.setValueAtTime(880, now + 0.15); // A5

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(880, now);
      osc2.frequency.setValueAtTime(1174.66, now + 0.15); // D6

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.5);
      osc2.stop(now + 0.5);
    } else {
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(440, now);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc1.start(now);
      osc1.stop(now + 0.3);
    }
  } catch {
    // Gracefully handle browser autoplay policies
  }
}

export function AvailablePage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<RunnerProfileResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [toggleLoading, setToggleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { on, isConnected } = useWebSocket();

  // Guard: If runner already has an active order, navigate to ActiveOrderPage immediately!
  const checkActiveOrderAndProfile = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [orderRes, profileRes] = await Promise.all([
        api.get<ActiveOrderResponse | null>('/runner/orders/active'),
        api.get<RunnerProfileResponse>('/runner/me'),
      ]);

      if (orderRes.data) {
        navigate('/active-order', { replace: true });
        return;
      }

      setProfile(profileRes.data);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        const msg = err.response.data.message;
        setError(Array.isArray(msg) ? msg.join(' - ') : msg);
      } else if (err instanceof Error) {
        setError(toUserMessage(err));
      } else {
        setError('فشل في تحميل الملف الشخصي');
      }
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    void checkActiveOrderAndProfile();
  }, [checkActiveOrderAndProfile]);

  const location = useLocation();

  useEffect(() => {
    const state = location.state as { notification?: string } | null;
    if (state?.notification) {
      setError(state.notification);
    }
  }, [location.state]);

  // WebSocket: Listen for order events
  useEffect(() => {
    const unsubAssigned = on<OrderAssignedPayload>(
      'order:assigned',
      (payload) => {
        playSound(payload.sound ?? 'new_order');
        navigate('/active-order');
      },
    );

    const unsubCancelled = on(
      'order:assignment_cancelled',
      () => {
        setError('تم إلغاء تعيين الطلب');
        void checkActiveOrderAndProfile();
      },
    );

    const unsubReassigned = on(
      'order:reassigned',
      () => {
        navigate('/active-order');
      },
    );

    return () => {
      unsubAssigned();
      unsubCancelled();
      unsubReassigned();
    };
  }, [on, navigate, checkActiveOrderAndProfile]);

  const handleToggle = async () => {
    if (!profile || toggleLoading || profile.status === 'ON_MISSION') return;

    const newStatus: RunnerStatus =
      profile.status === 'AVAILABLE' ? 'UNAVAILABLE' : 'AVAILABLE';

    setToggleLoading(true);
    setError(null);

    try {
      const body: RunnerStatusUpdate = { status: newStatus as 'AVAILABLE' | 'UNAVAILABLE' };
      const response = await api.put<{ status: RunnerStatus }>(
        '/runner/me/status',
        body,
      );
      setProfile((prev) =>
        prev
          ? { ...prev, status: response.data.status }
          : null,
      );
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        const msg = err.response.data.message;
        setError(Array.isArray(msg) ? msg.join(' - ') : msg);
      } else if (err instanceof Error) {
        setError(toUserMessage(err));
      } else {
        setError('فشل في تحديث حالة التوافر');
      }
    } finally {
      setToggleLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container" style={{ paddingTop: '32px' }}>
        <div className="card text-center">
          <div className="spinner" style={{ margin: '16px auto' }} />
          <p>جارٍ تحميل بيانات المندوب...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container" style={{ paddingTop: '32px' }}>
        <div className="card">
          <div className="error-msg">{error ?? 'تعذر العثور على بيانات المندوب'}</div>
          <button
            type="button"
            className="btn btn-outline"
            style={{ marginTop: '16px', width: '100%' }}
            onClick={() => void checkActiveOrderAndProfile()}
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  }

  const isAvailable = profile.status === 'AVAILABLE';
  const isOnMission = profile.status === 'ON_MISSION';

  return (
    <div className="container" style={{ paddingTop: '20px' }}>
      {/* Profile summary card */}
      <div className="card profile-card">
        <div className="profile-header">
          <div>
            <h2 className="profile-name">{profile.name}</h2>
            <p className="profile-contact" dir="ltr">{profile.whatsapp}</p>
            {profile.altPhone && (
              <p className="profile-contact" dir="ltr">{profile.altPhone}</p>
            )}
          </div>
          <span className={`status-badge ${RUNNER_STATUS_BADGE[profile.status]}`}>
            {RUNNER_STATUS_LABEL[profile.status]}
          </span>
        </div>

        <div className="profile-stats">
          <div className="stat-box">
            <span className="stat-label">التقييم العام</span>
            <span className="stat-value">
              {profile.avgRating !== null ? `${profile.avgRating} ⭐` : '—'}
            </span>
          </div>
          <div className="stat-box">
            <span className="stat-label">إجمالي التقييمات</span>
            <span className="stat-value">{profile.totalRatings}</span>
          </div>
          <div className="stat-box">
            <span className="stat-label">حالة الاتصال</span>
            <span className={`stat-value ${isConnected ? 'text-success' : 'text-warning'}`}>
              {isConnected ? 'متصل 🟢' : 'منفصل 🟠'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Big Toggle Control */}
      <div className="card toggle-card text-center">
        <h3 style={{ marginBottom: '8px' }}>حالة استقبال الطلبات</h3>
        <p style={{ color: 'var(--text)', marginBottom: '24px', fontSize: '14px' }}>
          {isOnMission
            ? 'لديك طلب نشط قيد التنفيذ حالياً.'
            : isAvailable
              ? 'أنت متاح لاستقبال وتعيين الطلبات الجديدة فوراً.'
              : 'أنت غير متاح. قم بتفعيل التوافر لبدء استقبال الطلبات.'}
        </p>

        {isOnMission ? (
          <button
            type="button"
            className="btn btn-primary btn-big"
            onClick={() => navigate('/active-order')}
          >
            الانتقال للطلب النشط
          </button>
        ) : (
          <button
            type="button"
            className={`btn btn-big ${isAvailable ? 'btn-danger' : 'btn-success'}`}
            onClick={handleToggle}
            disabled={toggleLoading}
          >
            {toggleLoading
              ? 'جارٍ التحديث...'
              : isAvailable
                ? 'إيقاف التوافر (تعطيل)'
                : 'تفعيل التوافر (استقبال الطلبات)'}
          </button>
        )}

        {!isConnected && (
          <p style={{ color: 'var(--warning)', fontSize: '13px', marginTop: '14px' }}>
            تنبيه: الاتصال بالشبكة غير مستقر، جارٍ محاولة إعادة الربط التلقائي...
          </p>
        )}
      </div>

      {error && (
        <div className="toast toast-error">
          {error}
        </div>
      )}
    </div>
  );
}
