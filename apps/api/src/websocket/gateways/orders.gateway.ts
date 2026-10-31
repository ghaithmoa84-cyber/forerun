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
import { PrismaService } from '../../database/prisma.service.js';
import { SOCKET_SERVERS } from './socket-registry.js';
import { getCorsOrigins } from './cors-origins.js';
import { CONFIG } from '@forerun/shared-constants';

@WebSocketGateway({
  namespace: '/orders',
  cors: {
    origin: getCorsOrigins(),
    credentials: true,
  },
})
export class OrdersGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  io: Server;

  private readonly logger = new Logger(OrdersGateway.name);
  private readonly activeConnections = new Map<string, number>();

  getActiveConnections(userId: string): number {
    return this.activeConnections.get(userId) ?? 0;
  }

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    SOCKET_SERVERS.orders = null;
  }

  async afterInit(server: Server) {
    SOCKET_SERVERS.orders = server;
  }

  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.toString().split(' ')[1];

    if (!token) {
      client.disconnect(true);
      return;
    }

    try {
      const jwtConfig = this.configService.get('jwt');
      const publicKey = jwtConfig?.publicKey;
      const payload = this.jwtService.verify(token, {
        publicKey: publicKey || undefined,
        algorithms: ['RS256'],
      });

      const userId = payload.sub;
      const currentConnections = this.activeConnections.get(userId) ?? 0;
      const maxAllowed = CONFIG.MAX_CONCURRENT_WS_CONNECTIONS;

      if (currentConnections >= maxAllowed) {
        this.logger.warn(`[handleConnection] connection rejected: user ${userId} reached maximum concurrent socket limit (${currentConnections}/${maxAllowed})`);
        client.disconnect(true);
        return;
      }

      this.activeConnections.set(userId, currentConnections + 1);
      client.data.counted = true;
      client.data.userId = userId;
      client.data.role = payload.role;

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { status: true, isDeleted: true, role: true },
      });

      if (!user || user.isDeleted) {
        client.disconnect(true);
        return;
      }

      if (user.status === 'SUSPENDED') {
        client.disconnect(true);
        return;
      }

      if (user.role === 'CUSTOMER') {
        client.join(`customer:${userId}`);
      } else if (user.role === 'RUNNER') {
        client.join(`runner:${userId}`);
      } else if (user.role === 'ADMIN') {
        client.join(`admin:all`);
      }
    } catch (err) {
      this.logger.warn('[handleConnection] connection setup failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      client.disconnect(true);
    }
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
