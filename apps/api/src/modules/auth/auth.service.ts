import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../database/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { TelegramService } from '../notifications/telegram.service.js';
import { CONFIG, ACCOUNT_SUSPENDED_MESSAGE } from '@forerun/shared-constants';
import type { RegisterRequest, LoginRequest, RefreshRequest, LogoutDto } from '@forerun/shared-types';

function generateSelector(): string {
  return randomBytes(16).toString('hex');
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly telegramService: TelegramService,
  ) {}

  async register(dto: RegisterRequest) {
    const existing = await this.prisma.user.findUnique({
      where: { whatsapp: dto.whatsapp },
    });

    if (existing) {
      // F6c: تعريب رسالة التسجيل المكرر (BUG-025)
      throw new ConflictException('رقم الواتساب هذا مسجل مسبقًا');
    }

    const passwordHash = await bcrypt.hash(dto.password, CONFIG.BCRYPT_ROUNDS);

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: dto.name,
          whatsapp: dto.whatsapp,
          altPhone: dto.altPhone,
          passwordHash,
          role: 'CUSTOMER',
          status: 'PENDING_VERIFICATION',
        },
      });

      const customer = await tx.customer.create({
        data: {
          userId: user.id,
        },
      });

      await tx.customerAddress.create({
        data: {
          customerId: customer.id,
          lat: dto.address.lat,
          lng: dto.address.lng,
          description: dto.address.description,
        },
      });

      await this.auditService.log(
        {
          orderId: undefined,
          actorId: user.id,
          actorRole: 'CUSTOMER',
          event: 'USER_REGISTERED',
          fromStatus: undefined,
          toStatus: 'PENDING_VERIFICATION',
          meta: { userId: user.id, role: 'CUSTOMER' },
        },
        tx,
      );

      return user;
    });

    try {
      await this.notificationsService.emitToAdmin('user:new_registration', {
        userId: result.id,
        userName: result.name,
        whatsapp: result.whatsapp,
      });
    } catch (err) {
      // WebSocket emit is best-effort; log but don't fail registration
      this.logger.warn('[register] admin notification failed silently', {
        error: err instanceof Error ? err.message : String(err),
        userId: result.id,
      });
    }

    try {
      await this.telegramService.sendMessage(
        `👤 <b>مستخدم جديد — بانتظار الموافقة</b>\n` +
        `الاسم: ${result.name ?? 'غير محدد'}\n` +
        `الهاتف: ${result.whatsapp}\n` +
        `التاريخ: ${new Date().toLocaleString('ar-SY', { timeZone: 'Asia/Damascus' })}`
      );
    } catch (err) {
      // Telegram notification is best-effort; don't fail registration
      this.logger.warn('[register] telegram notification failed silently', {
        error: err instanceof Error ? err.message : String(err),
        userId: result.id,
      });
    }

    return {
      statusCode: 201,
      message: 'Account created successfully. Please verify via WhatsApp.',
      userId: result.id,
    };
  }

  async login(dto: LoginRequest, deviceInfo?: string) {
    const user = await this.prisma.user.findUnique({
      where: { whatsapp: dto.whatsapp },
    });

    if (!user || user.isDeleted) {
      // F6: تعريب رسالة المصادقة (BUG-014)
      throw new UnauthorizedException('رقم الواتساب أو كلمة المرور غير صحيحة');
    }

    if (user.status === 'SUSPENDED') {
      throw new UnauthorizedException(ACCOUNT_SUSPENDED_MESSAGE);
    }

    if (user.status === 'REJECTED') {
      // F6b: تعريب رسالة REJECTED (BUG-024)
      throw new UnauthorizedException('حسابك غير مفعّل — يرجى التواصل مع الإدارة');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!passwordValid) {
      // F6: تعريب رسالة المصادقة (BUG-014)
      throw new UnauthorizedException('رقم الواتساب أو كلمة المرور غير صحيحة');
    }

    const accessToken = this.jwtService.sign(
      { sub: user.id, role: user.role, status: user.status },
      {
        algorithm: 'RS256',
        expiresIn: CONFIG.ACCESS_TOKEN_EXPIRY,
      },
    );

    const refreshTokenSecret = randomBytes(32).toString('hex');
    const selector = generateSelector();
    const tokenHash = await bcrypt.hash(refreshTokenSecret, CONFIG.BCRYPT_ROUNDS);

    await this.prisma.$transaction(async (tx) => {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 90);

      await tx.refreshToken.create({
        data: {
          userId: user.id,
          selector,
          tokenHash,
          deviceInfo,
          isRevoked: false,
          expiresAt,
        },
      });

      await this.auditService.log(
        {
          actorId: user.id,
          actorRole: user.role,
          event: 'TOKEN_ISSUED',
          meta: { method: 'login' },
        },
        tx,
      );
    });

    return {
      accessToken,
      refreshToken: `${selector}:${refreshTokenSecret}`,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        status: user.status,
      },
    };
  }

  async refresh(dto: RefreshRequest) {
    // Extract selector from the refresh token (first 32 chars = 16 bytes hex)
    // Format: selector:secret
    const [selector, secret] = dto.refreshToken.split(':');
    if (!selector || !secret) {
      // F6c: تعريب رسالة صيغة الرمز (BUG-025)
      throw new UnauthorizedException('صيغة رمز التجديد غير صحيحة');
    }

    return await this.prisma.$transaction(async (tx) => {
      const token = await tx.refreshToken.findUnique({
        where: { selector, isRevoked: false, expiresAt: { gt: new Date() } },
        include: { user: true },
      });

      if (!token) {
        // F6c: تعريب رسالة رمز التجديد (BUG-025)
        throw new UnauthorizedException('رمز التجديد غير صالح أو منتهي الصلاحية');
      }

      const isValid = await bcrypt.compare(secret, token.tokenHash);
      if (!isValid) {
        throw new UnauthorizedException('رمز التجديد غير صالح أو منتهي الصلاحية');
      }

      const user = token.user;

      if (user.status === 'SUSPENDED') {
        throw new UnauthorizedException(ACCOUNT_SUSPENDED_MESSAGE);
      }

      if (user.isDeleted || user.status === 'REJECTED') {
        // F6c: تعريب رسالة REJECTED في refresh (BUG-025)
        throw new UnauthorizedException('حسابك غير مفعّل — يرجى التواصل مع الإدارة');
      }

      const updateResult = await tx.refreshToken.updateMany({
        where: { id: token.id, isRevoked: false },
        data: { isRevoked: true, revokedAt: new Date() },
      });

      if (updateResult.count !== 1) {
        throw new UnauthorizedException('رمز التجديد غير صالح أو منتهي الصلاحية');
      }

      const newSecret = randomBytes(32).toString('hex');
      const newSelector = generateSelector();
      const newTokenHash = await bcrypt.hash(newSecret, CONFIG.BCRYPT_ROUNDS);
      const newExpiresAt = new Date();
      newExpiresAt.setDate(newExpiresAt.getDate() + 90);

      await tx.refreshToken.create({
        data: {
          userId: user.id,
          selector: newSelector,
          tokenHash: newTokenHash,
          deviceInfo: token.deviceInfo,
          isRevoked: false,
          expiresAt: newExpiresAt,
        },
      });

      await this.auditService.log(
        {
          actorId: user.id,
          actorRole: user.role,
          event: 'TOKEN_REFRESHED',
          fromStatus: 'ISSUED',
          toStatus: 'ROTATED',
          meta: { selector: newSelector },
        },
        tx,
      );

      const accessToken = this.jwtService.sign(
        { sub: user.id, role: user.role, status: user.status },
        {
          algorithm: 'RS256',
          expiresIn: CONFIG.ACCESS_TOKEN_EXPIRY,
        },
      );

      return {
        accessToken,
        refreshToken: `${newSelector}:${newSecret}`,
        user: {
          id: user.id,
          name: user.name,
          role: user.role,
          status: user.status,
        },
      };
    });
  }

  async logout(dto: LogoutDto) {
    const [selector, secret] = dto.refreshToken.split(':');
    if (!selector || !secret) {
      return {
        statusCode: 200,
        message: 'Logged out successfully',
      };
    }

    const token = await this.prisma.refreshToken.findUnique({
      where: { selector, isRevoked: false, expiresAt: { gt: new Date() } },
    });

    if (token) {
      const isValid = await bcrypt.compare(secret, token.tokenHash);
      if (isValid) {
        await this.prisma.refreshToken.update({
          where: { id: token.id },
          data: { isRevoked: true, revokedAt: new Date() },
        });
      }
    }

    return {
      statusCode: 200,
      message: 'Logged out successfully',
    };
  }
}
