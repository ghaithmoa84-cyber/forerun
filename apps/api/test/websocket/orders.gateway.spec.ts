import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrdersGateway } from '../../src/websocket/gateways/orders.gateway.js';
import type { JwtService } from '@nestjs/jwt';
import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../../src/database/prisma.service.js';
import type { Socket } from 'socket.io';

describe('OrdersGateway', () => {
  let gateway: OrdersGateway;
  let jwtService: Partial<JwtService>;
  let configService: Partial<ConfigService>;
  let prisma: {
    user: {
      findUnique: ReturnType<typeof vi.fn>;
    };
  };
  let mockSocket: {
    handshake: {
      auth?: { token?: string };
      headers?: { authorization?: string };
    };
    data: Record<string, unknown>;
    disconnect: ReturnType<typeof vi.fn>;
    join: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    jwtService = {
      verify: vi.fn(),
    };
    configService = {
      get: vi.fn().mockReturnValue({ publicKey: 'test-public-key' }),
    };
    prisma = {
      user: {
        findUnique: vi.fn(),
      },
    };
    gateway = new OrdersGateway(
      jwtService as JwtService,
      configService as ConfigService,
      prisma as unknown as PrismaService,
    );

    mockSocket = {
      handshake: {
        auth: { token: 'valid-token' },
      },
      data: {},
      disconnect: vi.fn(),
      join: vi.fn(),
    };
  });

  it('should disconnect if no token is provided', async () => {
    mockSocket.handshake = {};
    await gateway.handleConnection(mockSocket as unknown as Socket);

    expect(mockSocket.disconnect).toHaveBeenCalledWith(true);
    expect(jwtService.verify).not.toHaveBeenCalled();
  });

  it('should disconnect if user is not found or is deleted', async () => {
    (jwtService.verify as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'user-1',
      role: 'CUSTOMER',
    });
    prisma.user.findUnique.mockResolvedValue(null);

    await gateway.handleConnection(mockSocket as unknown as Socket);

    expect(mockSocket.disconnect).toHaveBeenCalledWith(true);
    expect(mockSocket.join).not.toHaveBeenCalled();
  });

  it('FIX-06: should disconnect immediately if user is SUSPENDED', async () => {
    (jwtService.verify as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'user-suspended',
      role: 'CUSTOMER',
    });
    prisma.user.findUnique.mockResolvedValue({
      status: 'SUSPENDED',
      isDeleted: false,
      role: 'CUSTOMER',
    });

    await gateway.handleConnection(mockSocket as unknown as Socket);

    expect(mockSocket.disconnect).toHaveBeenCalledWith(true);
    expect(mockSocket.join).not.toHaveBeenCalled();
  });

  it('should join customer room when user is active CUSTOMER', async () => {
    (jwtService.verify as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'cust-1',
      role: 'CUSTOMER',
    });
    prisma.user.findUnique.mockResolvedValue({
      status: 'VERIFIED',
      isDeleted: false,
      role: 'CUSTOMER',
    });

    await gateway.handleConnection(mockSocket as unknown as Socket);

    expect(mockSocket.disconnect).not.toHaveBeenCalled();
    expect(mockSocket.join).toHaveBeenCalledWith('customer:cust-1');
  });

  it('should join runner room when user is active RUNNER', async () => {
    (jwtService.verify as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'runner-1',
      role: 'RUNNER',
    });
    prisma.user.findUnique.mockResolvedValue({
      status: 'VERIFIED',
      isDeleted: false,
      role: 'RUNNER',
    });

    await gateway.handleConnection(mockSocket as unknown as Socket);

    expect(mockSocket.disconnect).not.toHaveBeenCalled();
    expect(mockSocket.join).toHaveBeenCalledWith('runner:runner-1');
  });
  describe('BF-4: Concurrent WebSocket Connections Limiting', () => {
    it('allows up to 5 concurrent connections for same user, rejects 6th, and allows reconnect after disconnect', async () => {
      (jwtService.verify as ReturnType<typeof vi.fn>).mockReturnValue({
        sub: 'concurrent-user-1',
        role: 'CUSTOMER',
      });
      prisma.user.findUnique.mockResolvedValue({
        status: 'VERIFIED',
        isDeleted: false,
        role: 'CUSTOMER',
      });

      const sockets: Array<{
        handshake: { auth?: { token?: string } };
        data: Record<string, unknown>;
        disconnect: ReturnType<typeof vi.fn>;
        join: ReturnType<typeof vi.fn>;
      }> = [];

      // 1. Establish 5 successful connections
      for (let i = 0; i < 5; i++) {
        const s = {
          handshake: { auth: { token: 'valid-token' } },
          data: {},
          disconnect: vi.fn(),
          join: vi.fn(),
        };
        sockets.push(s);
        await gateway.handleConnection(s as unknown as Socket);
        expect(s.disconnect).not.toHaveBeenCalled();
      }

      expect(gateway.getActiveConnections('concurrent-user-1')).toBe(5);

      // 2. 6th connection should be rejected immediately
      const socket6 = {
        handshake: { auth: { token: 'valid-token' } },
        data: {},
        disconnect: vi.fn(),
        join: vi.fn(),
      };
      await gateway.handleConnection(socket6 as unknown as Socket);
      expect(socket6.disconnect).toHaveBeenCalledWith(true);
      expect(socket6.join).not.toHaveBeenCalled();
      expect(gateway.getActiveConnections('concurrent-user-1')).toBe(5);

      // Disconnecting rejected socket should not decrement
      gateway.handleDisconnect(socket6 as unknown as Socket);
      expect(gateway.getActiveConnections('concurrent-user-1')).toBe(5);

      // 3. Disconnect one of the initial 5 sockets
      gateway.handleDisconnect(sockets[0] as unknown as Socket);
      expect(gateway.getActiveConnections('concurrent-user-1')).toBe(4);

      // 4. A new connection should now be accepted
      const socket7 = {
        handshake: { auth: { token: 'valid-token' } },
        data: {},
        disconnect: vi.fn(),
        join: vi.fn(),
      };
      await gateway.handleConnection(socket7 as unknown as Socket);
      expect(socket7.disconnect).not.toHaveBeenCalled();
      expect(socket7.join).toHaveBeenCalledWith('customer:concurrent-user-1');
      expect(gateway.getActiveConnections('concurrent-user-1')).toBe(5);
    });
  });
});