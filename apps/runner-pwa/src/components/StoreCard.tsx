import { useState, type FormEvent } from 'react';
import api from '../api/client';
import type { OrderStoreStatus } from '@forerun/shared-constants';
import type {
  ActiveOrderStore,
  ActiveOrderStoreReceipt,
  CreateRunnerOrderItemRequest,
} from '@forerun/shared-types';
import { ItemsList } from './ItemsList';
import { ReceiptUploader } from './ReceiptUploader';
import axios from 'axios';
import { toUserMessage } from '../lib/errorMessage';

const ORDER_STORE_STATUS_LABEL: Record<OrderStoreStatus, string> = {
  PENDING: 'معلّق',
  PURCHASED: 'تم الشراء',
  SKIPPED: 'تم التخطي',
};

const ORDER_STORE_STATUS_BADGE: Record<OrderStoreStatus, string> = {
  PENDING: 'status-pending',
  PURCHASED: 'status-purchased',
  SKIPPED: 'status-skipped',
};

interface StoreCardProps {
  store: ActiveOrderStore;
  orderId: string;
  orderStatus: string;
  onStoreUpdated: () => void;
}

export function StoreCard({
  store,
  orderId,
  orderStatus,
  onStoreUpdated,
}: StoreCardProps) {
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Add Item state
  const [showAddItem, setShowAddItem] = useState(false);
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [isAddingItem, setIsAddingItem] = useState(false);

  // Delete Receipt state
  const [deletingReceiptId, setDeletingReceiptId] = useState<string | null>(null);

  const handlePurchase = async () => {
    setIsActionLoading(true);
    setActionError(null);
    try {
      await api.put(`/runner/orders/${orderId}/stores/${store.id}/purchase`);
      onStoreUpdated();
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        const msg = err.response.data.message;
        setActionError(Array.isArray(msg) ? msg.join(' - ') : msg);
      } else if (err instanceof Error) {
        setActionError(toUserMessage(err));
      } else {
        setActionError('فشل تأكيد شراء المتجر');
      }
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleSkip = async () => {
    setIsActionLoading(true);
    setActionError(null);
    try {
      await api.put(`/runner/orders/${orderId}/stores/${store.id}/skip`, {
        reason: 'تخطي من قبل المندوب',
      });
      onStoreUpdated();
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        const msg = err.response.data.message;
        setActionError(Array.isArray(msg) ? msg.join(' - ') : msg);
      } else if (err instanceof Error) {
        setActionError(toUserMessage(err));
      } else {
        setActionError('فشل تخطي المتجر');
      }
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleAddItem = async (e: FormEvent) => {
    e.preventDefault();
    if (!itemName.trim() || !quantity.trim()) return;

    setIsAddingItem(true);
    setActionError(null);
    try {
      const payload: CreateRunnerOrderItemRequest = {
        itemName: itemName.trim(),
        quantity: quantity.trim(),
        orderStoreId: store.id,
      };

      await api.post(`/runner/orders/${orderId}/items`, payload);
      setItemName('');
      setQuantity('');
      setShowAddItem(false);
      onStoreUpdated();
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        const msg = err.response.data.message;
        setActionError(Array.isArray(msg) ? msg.join(' - ') : msg);
      } else if (err instanceof Error) {
        setActionError(toUserMessage(err));
      } else {
        setActionError('فشل إضافة المادة للمتجر');
      }
    } finally {
      setIsAddingItem(false);
    }
  };

  const handleDeleteReceipt = async (receiptId: string) => {
    setDeletingReceiptId(receiptId);
    setActionError(null);
    try {
      await api.delete(
        `/runner/orders/${orderId}/stores/${store.id}/receipts/${receiptId}`,
      );
      onStoreUpdated();
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        const msg = err.response.data.message;
        setActionError(Array.isArray(msg) ? msg.join(' - ') : msg);
      } else if (err instanceof Error) {
        setActionError(toUserMessage(err));
      } else {
        setActionError('فشل حذف الإيصال');
      }
    } finally {
      setDeletingReceiptId(null);
    }
  };

  const storeStatus = store.status as OrderStoreStatus;
  const isPending = storeStatus === 'PENDING';
  const isPurchased = storeStatus === 'PURCHASED';
  const canModify = orderStatus === 'IN_PROGRESS';

  return (
    <div className={`store-card ${isPurchased ? 'store-card--purchased' : storeStatus === 'SKIPPED' ? 'store-card--skipped' : 'store-card--pending'}`}>
      <div className="store-card__header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h3 className="store-title">{store.storeName}</h3>
          {store.isExtra && <span className="badge badge--extra">+ إضافي</span>}
        </div>
        <span className={`status-badge ${ORDER_STORE_STATUS_BADGE[storeStatus] ?? 'status-pending'}`}>
          {ORDER_STORE_STATUS_LABEL[storeStatus] ?? storeStatus}
        </span>
      </div>

      {/* Item List */}
      <div className="store-card__body">
        <ItemsList items={store.items} />

        {/* Add Item form */}
        {canModify && isPending && showAddItem && (
          <form onSubmit={handleAddItem} className="add-item-form">
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <input
                type="text"
                className="input input-small"
                placeholder="اسم المادة"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                required
                style={{ flex: 2 }}
              />
              <input
                type="text"
                className="input input-small"
                placeholder="الكمية"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
                style={{ flex: 1 }}
              />
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="submit"
                className="btn btn-primary btn-small"
                disabled={isAddingItem || !itemName.trim() || !quantity.trim()}
              >
                {isAddingItem ? 'جارٍ الإضافة...' : 'حفظ المادة'}
              </button>
              <button
                type="button"
                className="btn btn-outline btn-small"
                onClick={() => {
                  setShowAddItem(false);
                  setItemName('');
                  setQuantity('');
                }}
              >
                إلغاء
              </button>
            </div>
          </form>
        )}

        {canModify && isPending && !showAddItem && (
          <button
            type="button"
            className="btn-text"
            style={{ marginTop: '6px', fontSize: '13px' }}
            onClick={() => setShowAddItem(true)}
          >
            ➕ إضافة مادة للمتجر
          </button>
        )}
      </div>

      {/* Receipts section */}
      {store.receipts && store.receipts.length > 0 && (
        <div className="store-card__receipts">
          <span className="receipts-label">الإيصالات المرفوعة:</span>
          <div className="receipts-grid">
            {store.receipts.map((receipt: ActiveOrderStoreReceipt) => (
              <div key={receipt.id} className="receipt-container">
                <img
                  src={receipt.imageUrl}
                  alt="Receipt"
                  className="receipt-thumb"
                  onClick={() => window.open(receipt.imageUrl, '_blank')}
                />
                {canModify && (
                  <button
                    type="button"
                    className="receipt-delete-btn"
                    onClick={() => handleDeleteReceipt(receipt.id)}
                    disabled={deletingReceiptId === receipt.id}
                    title="حذف الإيصال"
                  >
                    {deletingReceiptId === receipt.id ? '...' : '✕'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions (Purchase / Skip / Receipt) */}
      {canModify && isPending && (
        <div className="store-card__actions">
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-success btn-small"
              onClick={handlePurchase}
              disabled={isActionLoading}
            >
              {isActionLoading ? 'جارٍ التحديث...' : '✓ تم الشراء'}
            </button>
            <button
              type="button"
              className="btn btn-outline btn-small"
              onClick={handleSkip}
              disabled={isActionLoading}
            >
              تخطي المتجر
            </button>
          </div>

          <div style={{ marginTop: '8px' }}>
            <ReceiptUploader
              orderId={orderId}
              storeId={store.id}
              onUploadComplete={onStoreUpdated}
            />
          </div>
        </div>
      )}

      {canModify && isPurchased && (
        <div style={{ marginTop: '10px' }}>
          <ReceiptUploader
            orderId={orderId}
            storeId={store.id}
            onUploadComplete={onStoreUpdated}
          />
        </div>
      )}

      {actionError && <div className="error-msg" style={{ marginTop: '8px' }}>{actionError}</div>}
    </div>
  );
}
