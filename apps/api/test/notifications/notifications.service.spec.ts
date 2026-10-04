import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationsService } from '../../src/modules/notifications/notifications.service.js';
import type { FcmService } from '../../src/modules/notifications/fcm.service.js';
import { SOCKET_SERVERS } from '../../src/websocket/gateways/socket-registry.js';
import type { Server } from 'socket.io';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let mockFcmService: {
    sendToUser: ReturnType<typeof vi.fn>;
  };
  let mockOrdersServer: {
    to: ReturnType<typeof vi.fn>;
    emit: ReturnType<typeof vi.fn>;
  };
  let mockAdminServer: {
    to: ReturnType<typeof vi.fn>;
    emit: ReturnType<typeof vi.fn>;
  };
  let mockRoomEmitter: {
    emit: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockRoomEmitter = {
      emit: vi.fn(),
    };

    mockOrdersServer = {
      to: vi.fn().mockReturnValue(mockRoomEmitter),
      emit: vi.fn(),
    };

    mockAdminServer = {
      to: vi.fn().mockReturnValue(mockRoomEmitter),
      emit: vi.fn(),
    };

    SOCKET_SERVERS.orders = mockOrdersServer as unknown as Server;
    SOCKET_SERVERS.admin = mockAdminServer as unknown as Server;

    mockFcmService = {
      sendToUser: vi.fn().mockResolvedValue(undefined),
    };

    service = new NotificationsService(mockFcmService as unknown as FcmService);
  });

  describe('emitToCustomer', () => {
    it('should emit socket event and await fcm push', async () => {
      const data = {
        orderId: 'order-1',
        orderNumber: 'FW-000001',
        newStatus: 'ASSIGNED',
      };

      await service.emitToCustomer('cust-1', 'order:status_changed', data, 'urgent');

      expect(mockOrdersServer.to).toHaveBeenCalledWith('customer:cust-1');
      expect(mockRoomEmitter.emit).toHaveBeenCalledWith('order:status_changed', {
        ...data,
        sound: 'urgent',
      });
      expect(mockFcmService.sendToUser).toHaveBeenCalledWith('cust-1', expect.objectContaining({
        orderId: 'order-1',
        type: 'order:status_changed',
        title: expect.stringContaining('تم تعيين مندوب'),
      }));
    });

    it('should handle fcm rejection gracefully without throwing', async () => {
      mockFcmService.sendToUser.mockRejectedValueOnce(new Error('FCM error'));

      const data = { orderId: 'order-1', newStatus: 'DELIVERED' };
      await expect(
        service.emitToCustomer('cust-1', 'order:status_changed', data),
      ).resolves.not.toThrow();
    });
  });

  describe('emitToRunner', () => {
    it('should emit socket event to runner room asynchronously', async () => {
      const data = { orderId: 'order-1' };
      await service.emitToRunner('runner-1', 'order:assigned', data);

      expect(mockOrdersServer.to).toHaveBeenCalledWith('runner:runner-1');
      expect(mockRoomEmitter.emit).toHaveBeenCalledWith('order:assigned', data);
    });
  });

  describe('emitToAdmin', () => {
    it('should emit socket event to admin:all room asynchronously', async () => {
      const data = { orderId: 'order-1', reason: 'Dispute' };
      await service.emitToAdmin('order:needs_attention', data, 'urgent');

      expect(mockAdminServer.to).toHaveBeenCalledWith('admin:all');
      expect(mockRoomEmitter.emit).toHaveBeenCalledWith('order:needs_attention', {
        ...data,
        sound: 'urgent',
      });
    });
  });

  describe('emitToAll', () => {
    it('should broadcast socket event to all clients in orders namespace', async () => {
      const data = { msg: 'system wide' };
      await service.emitToAll('system:alert', data);

      expect(mockOrdersServer.emit).toHaveBeenCalledWith('system:alert', data);
    });
  });
});
