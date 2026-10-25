import { useState, type ChangeEvent } from 'react';
import api from '../api/client';
import type {
  CreateReceiptResponse,
  PresignedUrlResponse,
} from '@forerun/shared-types';
import axios from 'axios';
import { toUserMessage } from '../lib/errorMessage';

interface ReceiptUploaderProps {
  orderId: string;
  storeId: string;
  onUploadComplete?: (receipt: CreateReceiptResponse) => void;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const VALID_TYPES = ['image/jpeg', 'image/png'];

export function ReceiptUploader({
  orderId,
  storeId,
  onUploadComplete,
}: ReceiptUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Defensive flow state: preserve r2Key if PUT to R2 succeeded but POST confirmation failed
  const [pendingR2Key, setPendingR2Key] = useState<string | null>(null);

  const confirmReceiptCreation = async (key: string) => {
    setIsConfirming(true);
    setError(null);
    try {
      const createRes = await api.post<CreateReceiptResponse>(
        `/runner/orders/${orderId}/stores/${storeId}/receipts`,
        { r2Key: key },
      );
      setPendingR2Key(null);
      onUploadComplete?.(createRes.data);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        const msg = err.response.data.message;
        setError(
          `تم رفع الصورة لكن فشل التسجيل — حاول مرة أخرى (${Array.isArray(msg) ? msg.join(' - ') : msg})`,
        );
      } else {
        setError('تم رفع الصورة لكن فشل التسجيل — حاول مرة أخرى');
      }
    } finally {
      setIsConfirming(false);
    }
  };

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!VALID_TYPES.includes(file.type)) {
      setError('نوع الملف غير مدعوم. يُسمح فقط بصور من نوع JPG أو PNG.');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError(`حجم الصورة يتجاوز الحد المسموح (5 ميغابايت).`);
      return;
    }

    setError(null);
    setIsUploading(true);

    let uploadedKey: string | null = null;

    try {
      const fileType = file.type === 'image/jpeg' ? 'jpg' : 'png';

      // 1. Get presigned upload URL
      const presignedRes = await api.post<PresignedUrlResponse>(
        `/runner/orders/${orderId}/stores/${storeId}/receipts/presigned-url`,
        { fileType, fileSize: file.size },
      );

      const { presignedUrl, r2Key } = presignedRes.data;

      // 2. Direct upload to R2
      const uploadRes = await fetch(presignedUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });

      if (!uploadRes.ok) {
        throw new Error('فشل رفع ملف الإيصال إلى التخزين السحابي.');
      }

      uploadedKey = r2Key;
      setPendingR2Key(r2Key);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        const msg = err.response.data.message;
        setError(Array.isArray(msg) ? msg.join(' - ') : msg);
      } else if (err instanceof Error) {
        setError(toUserMessage(err));
      } else {
        setError('حدث خطأ أثناء رفع الإيصال. يرجى المحاولة مرة أخرى.');
      }
      setIsUploading(false);
      return;
    }

    setIsUploading(false);

    // 3. Confirm receipt creation with backend
    if (uploadedKey) {
      await confirmReceiptCreation(uploadedKey);
    }
  };

  const handleRetryConfirm = async () => {
    if (!pendingR2Key) return;
    await confirmReceiptCreation(pendingR2Key);
  };

  return (
    <div className="receipt-uploader">
      {pendingR2Key ? (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-warning btn-small"
            onClick={handleRetryConfirm}
            disabled={isConfirming}
          >
            {isConfirming ? 'جارٍ تسجيل الإيصال...' : '🔄 إعادة محاولة تسجيل الإيصال'}
          </button>
          <button
            type="button"
            className="btn-text"
            style={{ fontSize: '12px', color: 'var(--text-muted)' }}
            onClick={() => setPendingR2Key(null)}
          >
            إلغاء ورفع ملف جديد
          </button>
        </div>
      ) : (
        <label className="btn btn-outline btn-small upload-btn">
          {isUploading ? 'جارٍ رفع الإيصال...' : '📷 رفع إيصال'}
          <input
            type="file"
            accept="image/jpeg,image/png"
            onChange={handleFileSelect}
            disabled={isUploading || isConfirming}
            style={{ display: 'none' }}
          />
        </label>
      )}

      {error && (
        <div className="error-msg" style={{ marginTop: '8px' }}>
          {error}
        </div>
      )}
    </div>
  );
}
