import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../modules/users/users.service.js';
import { SOCKET_SERVERS } from './socket-registry.js';
import { getCorsOrigins } from './cors-origins.js';
import { CONFIG } from '@forerun/shared-constants';

@WebSocketGateway({
  namespace: '/admin',
  cors: {
    origin: getCorsOrigins(),
    credentials: true,
  },
})
export class AdminGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  io: Server;

  private readonly logger = new Logger(AdminGateway.name);
  private readonly activeConnections = new Map<string, number>();

  getActiveConnections(userId: string): number {
    return this.activeConnections.get(userId) ?? 0;
  }

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    SOCKET_SERVERS.admin = null;
  }

  async afterInit(server: Server) {
    SOCKET_SERVERS.admin = server;
  }

  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.toString().split(' ')[1];

    if (!token) {
      client.disconnect(true);
      return;
    }

    let userId: string;
    try {
      const jwtConfig = this.configService.get('jwt');
      const publicKey = jwtConfig?.publicKey;
      const payload = this.jwtService.verify(token, {
        publicKey: publicKey || undefined,
        algorithms: ['RS256'],
      });
      userId = payload.sub;
    } catch (err) {
      this.logger.warn('[handleConnection] JWT verification failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      client.disconnect(true);
      return;
    }

    const currentConnections = this.activeConnections.get(userId) ?? 0;
    const maxAllowed = CONFIG.MAX_CONCURRENT_WS_CONNECTIONS;

    if (currentConnections >= maxAllowed) {
      this.logger.warn(`[handleConnection] connection rejected: admin user ${userId} reached maximum concurrent socket limit (${currentConnections}/${maxAllowed})`);
      client.disconnect(true);
      return;
    }

    this.activeConnections.set(userId, currentConnections + 1);
    client.data.counted = true;
    client.data.userId = userId;

    let user: { id: string; role: string; status: string; isDeleted: boolean } | null;
    try {
      user = await this.usersService.findLeanById(userId);
    } catch (err) {
      this.logger.warn('[handleConnection] user lookup failed', {
        error: err instanceof Error ? err.message : String(err),
        userId,
      });
      client.disconnect(true);
      return;
    }

    if (!user || user.isDeleted || user.status !== 'VERIFIED') {
      client.disconnect(true);
      return;
    }

    if (user.role !== 'ADMIN') {
      client.disconnect(true);
      return;
    }

    client.data.role = user.role;
    client.join('admin:all');
  }

  handleDisconnect(client: Socket) {
    if (client.data?.counted && client.data?.userId) {
      const userId = client.data.userId;
      const current = this.activeConnections.get(userId) ?? 0;
      if (current <= 1) {
        this.activeConnections.delete(userId);
      } else {
        this.activeConnections.set(userId, current - 1);
      }
      client.data.counted = false;
    }
  }
}
