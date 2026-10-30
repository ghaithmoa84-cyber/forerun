import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdminGateway } from '../../src/websocket/gateways/admin.gateway.js';
import type { JwtService } from '@nestjs/jwt';
import type { ConfigService } from '@nestjs/config';
import type { UsersService } from '../../src/modules/users/users.service.js';
import type { Socket } from 'socket.io';

describe('AdminGateway (BF-4)', () => {
  let gateway: AdminGateway;
  let jwtService: Partial<JwtService>;
  let configService: Partial<ConfigService>;
  let usersService: {
    findLeanById: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    jwtService = {
      verify: vi.fn(),
    };
    configService = {
      get: vi.fn().mockReturnValue({ publicKey: 'test-public-key' }),
    };
    usersService = {
      findLeanById: vi.fn(),
    };
    gateway = new AdminGateway(
      jwtService as JwtService,
      configService as ConfigService,
      usersService as unknown as UsersService,
    );
  });

  it('allows up to 5 concurrent connections for admin, rejects 6th, and allows reconnect after disconnect', async () => {
    (jwtService.verify as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'admin-concurrent-1',
      role: 'ADMIN',
    });
    usersService.findLeanById.mockResolvedValue({
      id: 'admin-concurrent-1',
      role: 'ADMIN',
      status: 'VERIFIED',
      isDeleted: false,
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
        handshake: { auth: { token: 'valid-admin-token' } },
        data: {},
        disconnect: vi.fn(),
        join: vi.fn(),
      };
      sockets.push(s);
      await gateway.handleConnection(s as unknown as Socket);
      expect(s.disconnect).not.toHaveBeenCalled();
      expect(s.join).toHaveBeenCalledWith('admin:all');
    }

    expect(gateway.getActiveConnections('admin-concurrent-1')).toBe(5);

    // 2. 6th connection should be rejected immediately
    const socket6 = {
      handshake: { auth: { token: 'valid-admin-token' } },
      data: {},
      disconnect: vi.fn(),
      join: vi.fn(),
    };
    await gateway.handleConnection(socket6 as unknown as Socket);
    expect(socket6.disconnect).toHaveBeenCalledWith(true);
    expect(gateway.getActiveConnections('admin-concurrent-1')).toBe(5);

    // Disconnecting socket6 (which was rejected) should NOT decrement counter
    gateway.handleDisconnect(socket6 as unknown as Socket);
    expect(gateway.getActiveConnections('admin-concurrent-1')).toBe(5);

    // 3. Disconnect one active socket
    gateway.handleDisconnect(sockets[0] as unknown as Socket);
    expect(gateway.getActiveConnections('admin-concurrent-1')).toBe(4);

    // 4. Connect a new socket
    const socket7 = {
      handshake: { auth: { token: 'valid-admin-token' } },
      data: {},
      disconnect: vi.fn(),
      join: vi.fn(),
    };
    await gateway.handleConnection(socket7 as unknown as Socket);
    expect(socket7.disconnect).not.toHaveBeenCalled();
    expect(socket7.join).toHaveBeenCalledWith('admin:all');
    expect(gateway.getActiveConnections('admin-concurrent-1')).toBe(5);
  });
});
