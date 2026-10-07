import { Controller, Get } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator.js';
import type { ActiveBannerResponse } from '@forerun/shared-types';
import { BannersService } from './banners.service.js';

@Controller('banners')
export class BannersPublicController {
  constructor(private readonly bannersService: BannersService) {}

  /**
   * استرجاع الشرائح النشطة للمستهلك/التطبيقات (عام، مكوش 30ث، بلا حقول إدارية)
   */
  @Get('active')
  @Public()
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  async getActiveBanners(): Promise<ActiveBannerResponse[]> {
    return this.bannersService.getActiveBanners();
  }
}
