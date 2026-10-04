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

      client.data.userId = payload.sub;
      client.data.role = payload.role;

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
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
        client.join(`customer:${payload.sub}`);
      } else if (user.role === 'RUNNER') {
        client.join(`runner:${payload.sub}`);
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

  handleDisconnect(_client: Socket) {
    // Cleanup logic if needed
  }
}
