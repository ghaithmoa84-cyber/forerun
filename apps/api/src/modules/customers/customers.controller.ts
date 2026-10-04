import { Body, Controller, Delete, Get, Post, Put, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  DeviceTokenSchema,
  UpdateCustomerAddressSchema,
  UpdateCustomerSchema,
} from '@forerun/shared-types';
import type {
  DeviceTokenRequest,
  UpdateCustomerAddressRequest,
  UpdateCustomerRequest,
} from '@forerun/shared-types';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { VerifiedUserGuard } from '../../common/guards/verified-user.guard.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CustomersService } from './customers.service.js';

@Controller()
@UseGuards(RolesGuard)
@Roles('CUSTOMER')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get('customer/me')
  @UseGuards(VerifiedUserGuard)
  async getProfile(
    @CurrentUser() user: { userId: string; role: string; status: string },
  ) {
    return this.customersService.getProfile(user.userId);
  }

  @Put('customer/me')
  @UseGuards(VerifiedUserGuard)
  async updateProfile(
    @Body(new ZodValidationPipe(UpdateCustomerSchema))
    dto: UpdateCustomerRequest,
    @CurrentUser() user: { userId: string; role: string; status: string },
  ) {
    return this.customersService.updateProfile(user.userId, dto);
  }

  @Get('customer/me/address')
  @UseGuards(VerifiedUserGuard)
  async getAddress(
    @CurrentUser() user: { userId: string; role: string; status: string },
  ) {
    return this.customersService.getAddress(user.userId);
  }

  @Put('customer/me/address')
  @UseGuards(VerifiedUserGuard)
  async updateAddress(
    @Body(new ZodValidationPipe(UpdateCustomerAddressSchema))
    dto: UpdateCustomerAddressRequest,
    @CurrentUser() user: { userId: string; role: string; status: string },
  ) {
    return this.customersService.updateAddress(user.userId, dto);
  }

  @Get('customer/runners')
  @UseGuards(VerifiedUserGuard)
  async listAvailableRunners() {
    return this.customersService.listAvailableRunners();
  }

  @Post('customer/me/device-token')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async registerDeviceToken(
    @CurrentUser() user: { userId: string; role: string; status: string },
    @Body(new ZodValidationPipe(DeviceTokenSchema)) dto: DeviceTokenRequest,
  ) {
    return this.customersService.registerDeviceToken(user.userId, dto);
  }

  @Delete('customer/me/device-token')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async unregisterDeviceToken(
    @CurrentUser() user: { userId: string; role: string; status: string },
    @Body(new ZodValidationPipe(DeviceTokenSchema)) dto: DeviceTokenRequest,
  ) {
    return this.customersService.unregisterDeviceToken(user.userId, dto);
  }
}
