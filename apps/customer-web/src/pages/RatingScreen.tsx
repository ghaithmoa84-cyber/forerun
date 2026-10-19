import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/client';
import type { CustomerOrderDetails } from '@forerun/shared-types';
import axios from 'axios';

export function RatingScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [order, setOrder] = useState<CustomerOrderDetails | null>(null);
  const [stars, setStars] = useState<number>(5);
  const [hoveredStars, setHoveredStars] = useState<number>(0);
  const [note, setNote] = useState<string>('');
  const [isExisting, setIsExisting] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api
      .get<CustomerOrderDetails>(`/customer/orders/${id}`)
      .then((res) => {
        setOrder(res.data);
        if (res.data.rating) {
          setStars(res.data.rating.stars);
          setIsExisting(true);
        }
      })
      .catch((err) => {
        console.error('Failed to load order details for rating:', err);
        setError('تعذر تحميل تفاصيل الطلب.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    if (stars < 1 || stars > 5) {
      setError('يرجى اختيار تقييم بين 1 و 5 نجوم');
      return;
    }

    setSubmitting(true);
    setError(null);

    const payload = {
      stars,
      note: note.trim() || null,
    };

    try {
      if (isExisting) {
        await api.put(`/customer/orders/${id}/ratings`, payload);
      } else {
        await api.post(`/customer/orders/${id}/ratings`, payload);
      }
      navigate(`/orders/${id}`, { replace: true });
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        const msg = err.response.data.message;
        setError(Array.isArray(msg) ? msg.join(' - ') : String(msg));
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('تعذر حفظ التقييم. يرجى المحاولة لاحقاً.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>جاري التحميل...</p>
      </div>
    );
  }

  return (
    <div className="rating-screen">
      <div style={{ marginBottom: '20px' }}>
        <h1 className="page-title">تقييم تجربة التوصيل</h1>
        <p className="page-subtitle">
          {order ? `طلب #${order.orderNumber}` : ''} — رأيك يساعدنا على تحسين الجودة وتقدير مندوبينا
        </p>
      </div>

      <div className="card" style={{ padding: '24px' }}>
        {order?.runner && (
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'var(--primary-bg)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '28px',
                margin: '0 auto 10px',
                fontWeight: 800,
              }}
            >
              {order.runner.name.charAt(0)}
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-h)', marginBottom: '2px' }}>
              المندوب {order.runner.name}
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              كيف كانت سرعة ولطافة التوصيل؟
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* 5 Interactive Stars */}
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <div className="star-rating">
              {[1, 2, 3, 4, 5].map((starValue) => {
                const isActive = (hoveredStars || stars) >= starValue;
                return (
                  <button
                    key={starValue}
                    type="button"
                    className={`star-btn ${isActive ? 'star-btn--active' : ''}`}
                    onClick={() => setStars(starValue)}
                    onMouseEnter={() => setHoveredStars(starValue)}
                    onMouseLeave={() => setHoveredStars(0)}
                    aria-label={`${starValue} نجوم`}
                  >
                    ★
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--primary)' }}>
              {stars === 5 && 'ممتاز جداً 🌟'}
              {stars === 4 && 'جيد جداً 👍'}
              {stars === 3 && 'مقبول 🙂'}
              {stars === 2 && 'أقل من المتوقع 😕'}
              {stars === 1 && 'سيء 😞'}
            </div>
          </div>

          <div className="form-group">
            <label className="label">ملاحظات أو تعليق (اختياري)</label>
            <textarea
              className="textarea"
              placeholder="اكتب أي ملاحظة حول التوصيل أو حالة المواد..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={1000}
            />
          </div>

          {error && (
            <div
              style={{
                backgroundColor: 'var(--danger-bg)',
                color: 'var(--danger)',
                padding: '12px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '13px',
                fontWeight: 600,
                marginBottom: '16px',
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button
              type="button"
              className="btn btn-outline"
              style={{ flex: 1 }}
              onClick={() => navigate(`/orders/${id}`)}
              disabled={submitting}
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ flex: 2 }}
              disabled={submitting}
            >
              {submitting
                ? 'جارٍ الحفظ...'
                : isExisting
                ? 'تحديث التقييم'
                : 'إرسال التقييم'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
