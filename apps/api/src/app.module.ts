import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import * as crypto from 'crypto';
import { PrismaModule } from './database/prisma.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { RunnersModule } from './modules/runners/runners.module.js';
import { OrdersModule } from './modules/orders/orders.module.js';
import { CustomersModule } from './modules/customers/customers.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { WebsocketModule } from './websocket/websocket.module.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { LedgerModule } from './modules/ledger/ledger.module.js';
import { ReceiptsModule } from './modules/receipts/receipts.module.js';
import { SettlementsModule } from './modules/settlements/settlements.module.js';
import { RatingsModule } from './modules/ratings/ratings.module.js';
import { PricingModule } from './modules/pricing/pricing.module.js';
import { BannersModule } from './modules/banners/banners.module.js';
import { SystemModule } from './modules/system/system.module.js';
import { RolesGuard } from './common/guards/roles.guard.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { jwtConfig } from './config/jwt.config.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: 'default',
          ttl: 60000,
          limit: 300,
        },
        {
          name: 'login',
          ttl: 900000,
          limit: 1000,
        },
        {
          name: 'register',
          ttl: 3600000,
          limit: 1000,
        },
      ],
    }),
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule.forFeature(jwtConfig)],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const jwtSettings = configService.get('jwt');
        const privateKey = jwtSettings?.privateKey?.trim() || '';
        const publicKey = jwtSettings?.publicKey?.trim() || '';

        if (!privateKey || !publicKey) {
          throw new Error(
            'JWT RS256 keys are required: both privateKey and publicKey must be configured',
          );
        }

        // Parse and reject malformed keys
        let parsedPrivateKey: crypto.KeyObject;
        let parsedPublicKey: crypto.KeyObject;
        try {
          parsedPrivateKey = crypto.createPrivateKey(privateKey);
          parsedPublicKey = crypto.createPublicKey(publicKey);
        } catch (err) {
          throw new Error(`JWT key parsing failed: ${(err as Error).message}`);
        }

        // Verify that private and public keys form a matching pair
        try {
          const testPayload = Buffer.from('key-pair-verification', 'utf8');
          const signature = crypto.sign(
            'sha256',
            testPayload,
            parsedPrivateKey,
          );
          const matched = crypto.verify(
            'sha256',
            testPayload,
            parsedPublicKey,
            signature,
          );
          if (!matched) {
            throw new Error(
              'JWT private and public keys do not form a matching pair',
            );
          }
        } catch (err) {
          if (
            err instanceof Error &&
            err.message.includes('do not form a matching pair')
          ) {
            throw err;
          }
          throw new Error(
            `JWT key pair verification failed: ${(err as Error).message}`,
          );
        }

        return {
          privateKey,
          publicKey,
          signOptions: {
            algorithm: 'RS256' as const,
            expiresIn: jwtSettings?.accessTokenExpiry ?? '2h',
          },
          verifyOptions: { algorithms: ['RS256' as const] },
        };
      },
    }),
    PrismaModule,
    AuditModule,
    LedgerModule,
    NotificationsModule,
    WebsocketModule.registerAsync(),
    ScheduleModule.forRoot(),
    AuthModule,
    UsersModule,
    RunnersModule,
    OrdersModule,
    CustomersModule,
    ReceiptsModule,
     SettlementsModule,
     RatingsModule,
     PricingModule,
     BannersModule,
     SystemModule,
   ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
