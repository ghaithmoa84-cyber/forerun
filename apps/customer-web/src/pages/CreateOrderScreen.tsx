import { useState, useEffect, useMemo, useRef, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import api from '../lib/client';
import {
  CreateOrderSchema,
  type CreateOrderRequest,
  type CreateOrderResponse,
  type AvailableRunner,
  type CustomerAddressResponse,
} from '@forerun/shared-types';
import axios from 'axios';

// Leaflet custom marker with Fawrun brand color #00C1A7
const pinIcon = L.divIcon({
  className: 'fawrun-map-pin',
  html: `<div style="background-color: #00C1A7; width: 30px; height: 30px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 3px solid #ffffff; box-shadow: 0 4px 10px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center;"><div style="width: 9px; height: 9px; background: #ffffff; border-radius: 50%;"></div></div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 30],
});

interface ItemFormState {
  itemName: string;
  quantity: string;
  customStoreName: string;
  anyStore: boolean;
}

const DEFAULT_CENTER: [number, number] = [33.5138, 36.2765]; // Damascus center

function MapEventsHandler({ onLocationChange }: { onLocationChange: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onLocationChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function RecenterMap({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom());
  }, [lat, lng, map]);
  return null;
}

export function CreateOrderScreen() {
  const navigate = useNavigate();
  const orderIdempotencyKeyRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      orderIdempotencyKeyRef.current = null;
    };
  }, []);

  // Item Entry Mode State: Default is 'quick'
  const [entryMode, setEntryMode] = useState<'quick' | 'structured'>('quick');
  const [quickText, setQuickText] = useState<string>('');

  // Structured Items State
  const [items, setItems] = useState<ItemFormState[]>([
    { itemName: '', quantity: '', customStoreName: '', anyStore: true },
  ]);
  const [expandedItemIndex, setExpandedItemIndex] = useState<number | null>(null);

  // Delivery Location State
  const [lat, setLat] = useState<number>(DEFAULT_CENTER[0]);
  const [lng, setLng] = useState<number>(DEFAULT_CENTER[1]);
  const [addressDesc, setAddressDesc] = useState<string>('');
  const [savedAddress, setSavedAddress] = useState<CustomerAddressResponse | null>(null);
  const [hasLoadedAddress, setHasLoadedAddress] = useState<boolean>(false);

  // Modal State for Location Editing
  const [showLocationModal, setShowLocationModal] = useState<boolean>(false);
  const [tempLat, setTempLat] = useState<number>(DEFAULT_CENTER[0]);
  const [tempLng, setTempLng] = useState<number>(DEFAULT_CENTER[1]);
  const [tempDesc, setTempDesc] = useState<string>('');

  // Additional Fields
  const [notes, setNotes] = useState<string>('');
  const [runners, setRunners] = useState<AvailableRunner[]>([]);
  const [preferredRunnerId, setPreferredRunnerId] = useState<string>('');
  const [waitForPreferred, setWaitForPreferred] = useState<boolean>(false);

  // Status & Errors
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Fetch address and available runners on mount
  useEffect(() => {
    // 1. Fetch customer default address
    api
      .get<CustomerAddressResponse>('/customer/me/address')
      .then((res) => {
        if (res.data && res.data.description) {
          setSavedAddress(res.data);
          setLat(res.data.lat);
          setLng(res.data.lng);
          setAddressDesc(res.data.description);
          setTempLat(res.data.lat);
          setTempLng(res.data.lng);
          setTempDesc(res.data.description);
        } else {
          setSavedAddress(null);
        }
      })
      .catch(() => {
        setSavedAddress(null);
      })
      .finally(() => {
        setHasLoadedAddress(true);
      });

    // 2. Fetch available runners
    api
      .get<AvailableRunner[]>('/customer/runners')
      .then((res) => {
        setRunners(res.data ?? []);
      })
      .catch((err) => {
        console.error('Failed to load runners:', err);
      });
  }, []);

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      { itemName: '', quantity: '', customStoreName: '', anyStore: true },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
    if (expandedItemIndex === index) {
      setExpandedItemIndex(null);
    }
  };

  const handleItemChange = (index: number, field: keyof ItemFormState, value: string | boolean) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      if (field === 'anyStore' && value === true) {
        next[index].customStoreName = '';
      }
      return next;
    });
  };

  const handleGetCurrentLocationForModal = () => {
    if (!navigator.geolocation) {
      alert('خدمة تحديد الموقع الجغرافي غير مدعومة في متصفحك.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setTempLat(pos.coords.latitude);
        setTempLng(pos.coords.longitude);
      },
      (err) => {
        console.warn('Geolocation error:', err);
        alert('تعذر تحديد موقعك الحالي تلقائياً. يمكنك النقر على الخريطة لتحديده يدوياً.');
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handleConfirmLocationChange = () => {
    if (!tempDesc.trim()) {
      alert('يرجى إدخال وصف العنوان بالتفصيل.');
      return;
    }
    setLat(tempLat);
    setLng(tempLng);
    setAddressDesc(tempDesc.trim());
    setShowLocationModal(false);
  };

  const openLocationModal = () => {
    setTempLat(lat);
    setTempLng(lng);
    setTempDesc(addressDesc);
    setShowLocationModal(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setGeneralError(null);

    if (!addressDesc.trim()) {
      setGeneralError('يرجى تحديد عنوان التسليم لهذا الطلب');
      openLocationModal();
      return;
    }

    let orderItems: CreateOrderRequest['items'];
    let finalNotes: string | null = null;

    if (entryMode === 'quick') {
      const trimmedQuick = quickText.trim();
      if (!trimmedQuick) {
        setGeneralError('يرجى كتابة مشترياتك في حقل الإدخال السريع');
        return;
      }

      // Parse lines into items to satisfy backend schema
      const lines = trimmedQuick.split('\n').map((l) => l.trim()).filter(Boolean);
      orderItems = lines.length > 0
        ? lines.map((line) => ({
            itemName: line,
            quantity: '1',
            customStoreName: null,
            anyStore: true,
          }))
        : [
            {
              itemName: 'طلب شراء حر',
              quantity: '1',
              customStoreName: null,
              anyStore: true,
            },
          ];

      // Quick input content is sent in notes
      finalNotes = trimmedQuick + (notes.trim() ? `\n\nملاحظات إضافية: ${notes.trim()}` : '');
    } else {
      // Structured mode
      const hasEmpty = items.some((it) => !it.itemName.trim() || !it.quantity.trim());
      if (hasEmpty) {
        setGeneralError('يرجى إدخال اسم المادة والكمية لجميع المواد');
        return;
      }

      orderItems = items.map((it) => ({
        itemName: it.itemName.trim(),
        quantity: it.quantity.trim(),
        customStoreName: it.anyStore ? null : it.customStoreName.trim() || null,
        anyStore: it.anyStore,
      }));

      finalNotes = notes.trim() || null;
    }

    if (!orderIdempotencyKeyRef.current) {
      orderIdempotencyKeyRef.current = crypto.randomUUID();
    }
    const idempotencyKey = orderIdempotencyKeyRef.current;

    const payload: CreateOrderRequest = {
      items: orderItems,
      notes: finalNotes,
      preferredRunnerId: preferredRunnerId || null,
      waitForPreferred: preferredRunnerId ? waitForPreferred : false,
      deliveryAddress: {
        lat,
        lng,
        description: addressDesc.trim(),
      },
      idempotencyKey,
    };

    // Client-side Zod validation
    const validation = CreateOrderSchema.safeParse(payload);
    if (!validation.success) {
      setGeneralError(
        validation.error.issues.map((i) => i.message).join(' - ') ||
          'يرجى التحقق من صحة الحقول المدخلة',
      );
      return;
    }

    setSubmitting(true);
    try {
      const response = await api.post<CreateOrderResponse>('/customer/orders', payload);
      orderIdempotencyKeyRef.current = null;
      const newOrderId = response.data.id;
      navigate(`/orders/${newOrderId}`);
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        const msg = err.response.data.message;
        setGeneralError(Array.isArray(msg) ? msg.join(' - ') : String(msg));
      } else if (err instanceof Error) {
        setGeneralError(err.message);
      } else {
        setGeneralError('حدث خطأ أثناء إرسال الطلب. يرجى المحاولة مرة أخرى.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const modalMapCenter = useMemo((): [number, number] => [tempLat, tempLng], [tempLat, tempLng]);

  return (
    <div className="create-order-screen">
      <div style={{ marginBottom: '18px' }}>
        <h1 className="page-title">إنشاء طلب بقالة جديد</h1>
        <p className="page-subtitle">أدخل تفاصيل المواد والموقع لإرسال طلبك فوراً</p>
      </div>

      {generalError && (
        <div
          style={{
            backgroundColor: 'var(--danger-bg)',
            color: 'var(--danger)',
            padding: '12px 16px',
            borderRadius: 'var(--radius)',
            fontSize: '14px',
            fontWeight: 700,
            marginBottom: '18px',
          }}
        >
          {generalError}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Section 1: Items Section with Tab Switcher */}
        <div className="card" style={{ marginBottom: '20px' }}>
          {/* Tab Switcher */}
          <div
            style={{
              display: 'flex',
              gap: '8px',
              backgroundColor: 'var(--bg)',
              padding: '4px',
              borderRadius: 'var(--radius)',
              marginBottom: '16px',
              border: '1px solid var(--border)',
            }}
          >
            <button
              type="button"
              onClick={() => setEntryMode('quick')}
              className="btn btn-sm"
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 800,
                fontSize: '14px',
                backgroundColor: entryMode === 'quick' ? 'var(--primary)' : 'transparent',
                color: entryMode === 'quick' ? '#ffffff' : 'var(--text-muted)',
                boxShadow: entryMode === 'quick' ? '0 2px 6px rgba(0, 193, 167, 0.3)' : 'none',
                border: 'none',
              }}
            >
              إدخال سريع ✏️
            </button>
            <button
              type="button"
              onClick={() => setEntryMode('structured')}
              className="btn btn-sm"
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 800,
                fontSize: '14px',
                backgroundColor: entryMode === 'structured' ? 'var(--primary)' : 'transparent',
                color: entryMode === 'structured' ? '#ffffff' : 'var(--text-muted)',
                boxShadow: entryMode === 'structured' ? '0 2px 6px rgba(0, 193, 167, 0.3)' : 'none',
                border: 'none',
              }}
            >
              إدخال منظّم 📋
            </button>
          </div>

          {/* Quick Input Tab */}
          {entryMode === 'quick' && (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="label" htmlFor="quick-order-textarea">
                اكتب مشترياتك بشكل حر وسريع:
              </label>
              <textarea
                id="quick-order-textarea"
                rows={6}
                className="textarea"
                placeholder={`اكتب مشترياتك بشكل حر، مثال:
حليب 2 لتر
خبز 3 أرغفة
دجاج 1 كغ من عند الجزار`}
                value={quickText}
                onChange={(e) => setQuickText(e.target.value)}
                style={{
                  width: '100%',
                  lineHeight: '1.6',
                  fontSize: '14px',
                  minHeight: '150px',
                  fontFamily: 'inherit',
                }}
              />
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                سيقوم المندوب بقراءة مشترياتك وتأمينها بأفضل جودة وسرعة.
              </p>
            </div>
          )}

          {/* Structured Input Tab */}
          {entryMode === 'structured' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)' }}>
                  المواد المطلوبة ({items.length})
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {items.map((item, index) => {
                  const isExpanded = expandedItemIndex === index;
                  return (
                    <div
                      key={index}
                      style={{
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius)',
                        padding: '10px',
                        backgroundColor: 'var(--bg)',
                      }}
                    >
                      {/* Compact Horizontal Row: [اسم المادة] [الكمية] [⚙] [✕] */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="text"
                          className="input"
                          placeholder="اسم المادة *"
                          value={item.itemName}
                          onChange={(e) => handleItemChange(index, 'itemName', e.target.value)}
                          style={{ flex: 3 }}
                          required
                        />
                        <input
                          type="text"
                          className="input"
                          placeholder="الكمية *"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                          style={{ flex: 1.5 }}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setExpandedItemIndex(isExpanded ? null : index)}
                          className={`btn btn-sm ${isExpanded ? 'btn-primary' : 'btn-outline'}`}
                          title="خيارات المتجر"
                          style={{
                            minWidth: '38px',
                            height: '38px',
                            padding: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '16px',
                          }}
                        >
                          ⚙
                        </button>
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            className="btn btn-outline btn-sm"
                            title="حذف المادة"
                            style={{
                              minWidth: '38px',
                              height: '38px',
                              padding: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'var(--danger)',
                              borderColor: 'var(--danger)',
                              fontSize: '14px',
                            }}
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      {/* Expandable Store Settings */}
                      {isExpanded && (
                        <div
                          style={{
                            marginTop: '10px',
                            paddingTop: '10px',
                            borderTop: '1px dashed var(--border)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                              type="checkbox"
                              id={`anyStore-${index}`}
                              checked={item.anyStore}
                              onChange={(e) => handleItemChange(index, 'anyStore', e.target.checked)}
                              style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }}
                            />
                            <label
                              htmlFor={`anyStore-${index}`}
                              style={{ fontSize: '13px', fontWeight: 600, cursor: 'pointer', color: 'var(--text)' }}
                            >
                              من أي متجر متاح (أسرع وأوفر)
                            </label>
                          </div>

                          {!item.anyStore && (
                            <input
                              type="text"
                              className="input"
                              placeholder="اسم المتجر أو السوق المفضل..."
                              value={item.customStoreName}
                              onChange={(e) => handleItemChange(index, 'customStoreName', e.target.value)}
                              style={{ fontSize: '13px' }}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Prominent Add Item Button */}
              <button
                type="button"
                className="btn btn-outline btn-block"
                onClick={handleAddItem}
                style={{
                  marginTop: '12px',
                  borderColor: 'var(--primary)',
                  color: 'var(--primary)',
                  fontWeight: 700,
                  padding: '10px',
                }}
              >
                ＋ إضافة مادة أخرى
              </button>
            </div>
          )}
        </div>

        {/* Section 2: Delivery Location Card (Item 3) */}
        <div className="card" style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>📍</span>
              <h2 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: 'var(--text-h)' }}>
                عنوان التسليم
              </h2>
            </div>
            {hasLoadedAddress && savedAddress && (
              <span style={{ fontSize: '11px', color: 'var(--success)', fontWeight: 700, backgroundColor: 'var(--success-bg)', padding: '3px 8px', borderRadius: '12px' }}>
                العنوان المحفوظ
              </span>
            )}
          </div>

          {/* Saved / Current Delivery Address Display */}
          <div style={{ marginBottom: '12px' }}>
            <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', margin: '0 0 12px 0' }}>
              {addressDesc || 'لم يتم تحديد عنوان بعد، اضغط على زر تحديد موقعي'}
            </p>

            {/* Set / Change Location Button - Opens the interactive map modal */}
            <button
              type="button"
              className="btn btn-outline btn-block"
              onClick={openLocationModal}
              style={{ fontWeight: 700, fontSize: '13px' }}
            >
              تحديد موقعي على الخريطة
            </button>
          </div>
        </div>

        {/* Section 3: Additional Options & Preferred Runner */}
        <div className="card" style={{ marginBottom: '24px' }}>
          <h2 className="section-title" style={{ fontSize: '15px', marginBottom: '14px' }}>
            خيارات إضافية
          </h2>

          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label className="label">ملاحظات للمندوب (اختياري)</label>
            <textarea
              className="textarea"
              placeholder="أي تعليمات خاصة بالتسليم، موعد محدد، أو رقم شقة..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="label">اختيار مندوب مفضل (اختياري)</label>
            <select
              className="select"
              value={preferredRunnerId}
              onChange={(e) => setPreferredRunnerId(e.target.value)}
            >
              <option value="">أي مندوب متاح (توصيل أسرع)</option>
              {runners.map((runner) => (
                <option key={runner.id} value={runner.id}>
                  {runner.name} {runner.avgRating ? `(★ ${runner.avgRating.toFixed(1)})` : ''}
                </option>
              ))}
            </select>
          </div>

          {preferredRunnerId && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
              <input
                type="checkbox"
                id="waitForPreferred"
                checked={waitForPreferred}
                onChange={(e) => setWaitForPreferred(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }}
              />
              <label htmlFor="waitForPreferred" style={{ fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                انتظر المندوب المفضل (لا تحوّل الطلب لمندوب آخر)
              </label>
            </div>
          )}
        </div>

        {/* Submit Action */}
        <button
          type="submit"
          className="btn btn-primary btn-block"
          disabled={submitting}
          style={{ padding: '16px', fontSize: '16px', fontWeight: 800, marginBottom: '24px' }}
        >
          {submitting ? 'جارٍ إرسال الطلب...' : 'أرسل الطلب الآن 🚀'}
        </button>
      </form>

      {/* Location Modal for Temporary Order Override (Item 3) */}
      {showLocationModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            className="card"
            style={{
              maxWidth: '560px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px',
              borderRadius: 'var(--radius)',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-h)', margin: 0 }}>
                {savedAddress ? 'تغيير موقع التسليم لهذا الطلب' : 'تحديد موقع التسليم'}
              </h3>
              {savedAddress && (
                <button
                  type="button"
                  onClick={() => setShowLocationModal(false)}
                  style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-muted)' }}
                >
                  ✕
                </button>
              )}
            </div>

            {!savedAddress && (
              <div
                style={{
                  backgroundColor: 'var(--warning-bg)',
                  color: '#92400e',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '13px',
                  fontWeight: 600,
                  marginBottom: '14px',
                }}
              >
                لم تُحدّد موقعاً افتراضياً. حدّد موقعك لهذا الطلب.
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                اسحب المؤشر أو انقر لتحديد الموقع الدقيق
              </span>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={handleGetCurrentLocationForModal}
                style={{ fontSize: '12px', padding: '4px 10px' }}
              >
                موقعي الحالي
              </button>
            </div>

            {/* Interactive Full Map */}
            <div
              style={{
                height: '240px',
                width: '100%',
                borderRadius: 'var(--radius)',
                overflow: 'hidden',
                border: '1px solid var(--border)',
                marginBottom: '14px',
              }}
            >
              <MapContainer
                center={modalMapCenter}
                zoom={14}
                scrollWheelZoom={false}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Marker
                  position={modalMapCenter}
                  icon={pinIcon}
                  draggable={true}
                  eventHandlers={{
                    dragend: (e) => {
                      const marker = e.target;
                      const pos = marker.getLatLng();
                      setTempLat(pos.lat);
                      setTempLng(pos.lng);
                    },
                  }}
                />
                <MapEventsHandler
                  onLocationChange={(newLat, newLng) => {
                    setTempLat(newLat);
                    setTempLng(newLng);
                  }}
                />
                <RecenterMap lat={tempLat} lng={tempLng} />
              </MapContainer>
            </div>

            {/* Address Description Input */}
            <div className="form-group" style={{ marginBottom: '18px' }}>
              <label className="label">وصف العنوان لهذا الطلب *</label>
              <input
                type="text"
                className="input"
                placeholder="مثال: دمشق - المزة - جانب جامع الهدى - طابق 3"
                value={tempDesc}
                onChange={(e) => setTempDesc(e.target.value)}
                required
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                * هذا التغيير مؤقت لهذا الطلب فقط ولن يغير عنوانك الدائم في حسابك.
              </span>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmLocationChange}
                style={{ flex: 1, padding: '12px', fontWeight: 800 }}
              >
                تأكيد الموقع لهذا الطلب ✓
              </button>
              {savedAddress && (
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowLocationModal(false)}
                  style={{ padding: '12px 18px' }}
                >
                  إلغاء
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
