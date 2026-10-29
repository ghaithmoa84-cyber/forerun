import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { CONFIG } from '@forerun/shared-constants';
import {
  type AvailableRunner,
  type CustomerAddressResponse,
  type CustomerProfile,
  type DeviceTokenRequest,
  type DeviceTokenResponse,
  type UpdateCustomerAddressRequest,
  type UpdateCustomerRequest,
} from '@forerun/shared-types';
import { PrismaService } from '../../database/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async getProfile(customerId: string): Promise<CustomerProfile> {
    const customer = await this.prisma.customer.findUnique({
      where: { userId: customerId },
      include: {
        user: true,
        address: true,
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return {
      id: customer.user.id,
      name: customer.user.name,
      whatsapp: customer.user.whatsapp,
      altPhone: customer.user.altPhone,
      status: customer.user.status,
      completedOrders: customer.completedOrders,
      totalFeesPaid: customer.totalFeesPaid,
      freeOrdersRemaining: customer.user.freeOrdersRemaining,
      createdAt: customer.createdAt,
    };
  }

  async updateProfile(
    customerId: string,
    dto: UpdateCustomerRequest,
  ): Promise<CustomerProfile> {
    const customer = await this.prisma.customer.findUnique({
      where: { userId: customerId },
      include: { user: true },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const updateData: Prisma.UserUpdateInput = {};
    if (dto.name !== undefined) {
      updateData.name = dto.name;
    }
    if (dto.altPhone !== undefined) {
      updateData.altPhone = dto.altPhone;
    }
    if (dto.password !== undefined) {
      if (!dto.currentPassword) {
        throw new BadRequestException('currentPassword is required when updating password');
      }

      const isCurrentValid = await bcrypt.compare(
        dto.currentPassword,
        customer.user.passwordHash,
      );

      if (!isCurrentValid) {
        throw new UnauthorizedException('Current password is incorrect');
      }

      updateData.passwordHash = await bcrypt.hash(
        dto.password,
        CONFIG.BCRYPT_ROUNDS,
      );
    }

    const updatedUser = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: customer.userId },
        data: updateData,
      });

      if (dto.password !== undefined) {
        await tx.refreshToken.updateMany({
          where: { userId: customer.userId, isRevoked: false },
          data: { isRevoked: true },
        });
      }

      await this.auditService.log(
        {
          actorId: customer.userId,
          actorRole: 'CUSTOMER',
          event: 'CUSTOMER_PROFILE_UPDATED',
          meta: {
            customerId: customer.id,
            changedFields: Object.keys(updateData),
          },
        },
        tx,
      );

      return user;
    });

    return {
      id: updatedUser.id,
      name: updatedUser.name,
      whatsapp: updatedUser.whatsapp,
      altPhone: updatedUser.altPhone,
      status: updatedUser.status,
      completedOrders: customer.completedOrders,
      totalFeesPaid: customer.totalFeesPaid,
      freeOrdersRemaining: updatedUser.freeOrdersRemaining,
      createdAt: customer.createdAt,
    };
  }

  async getAddress(customerId: string): Promise<CustomerAddressResponse> {
    const customer = await this.prisma.customer.findUnique({
      where: { userId: customerId },
      include: { address: true },
    });

    if (!customer?.address) {
      throw new NotFoundException('Customer address not found');
    }

    return {
      lat: customer.address.lat,
      lng: customer.address.lng,
      description: customer.address.description,
    };
  }

  async updateAddress(
    customerId: string,
    dto: UpdateCustomerAddressRequest,
  ): Promise<CustomerAddressResponse> {
    const customer = await this.prisma.customer.findUnique({
      where: { userId: customerId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const address = await this.prisma.$transaction(async (tx) => {
      const updatedAddress = await tx.customerAddress.upsert({
        where: { customerId: customer.id },
        create: {
          customerId: customer.id,
          lat: dto.lat,
          lng: dto.lng,
          description: dto.description,
        },
        update: {
          lat: dto.lat,
          lng: dto.lng,
          description: dto.description,
        },
      });

      await this.auditService.log(
        {
          actorId: customerId,
          actorRole: 'CUSTOMER',
          event: 'CUSTOMER_ADDRESS_UPDATED',
          meta: { customerId: customer.id },
        },
        tx,
      );

      return updatedAddress;
    });

    return {
      lat: address.lat,
      lng: address.lng,
      description: address.description,
    };
  }

  async listAvailableRunners(): Promise<AvailableRunner[]> {
    const runners = await this.prisma.runner.findMany({
      where: {
        isVisible: true,
        status: 'AVAILABLE',
        user: {
          isDeleted: false,
          status: 'VERIFIED',
        },
      },
      include: {
        user: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return runners.map((runner) => ({
      id: runner.id,
      name: runner.user.name,
      avgRating: 5,
      totalRatings: runner.totalRatings,
      status: runner.status,
    }));
  }

  async registerDeviceToken(
    userId: string,
    dto: DeviceTokenRequest,
  ): Promise<DeviceTokenResponse> {
    await this.prisma.deviceToken.upsert({
      where: { token: dto.token },
      create: {
        userId,
        token: dto.token,
        platform: dto.platform,
      },
      update: {
        userId,
        platform: dto.platform,
      },
    });

    return { success: true };
  }

  async unregisterDeviceToken(
    userId: string,
    dto: DeviceTokenRequest,
  ): Promise<DeviceTokenResponse> {
    await this.prisma.deviceToken.deleteMany({
      where: {
        userId,
        token: dto.token,
      },
    });

    return { success: true };
  }
}
