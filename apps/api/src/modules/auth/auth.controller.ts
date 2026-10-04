import { Body, Controller, Post, Headers, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { RegisterSchema, LoginSchema, RefreshSchema } from '@forerun/shared-types';
import type { RegisterRequest, LoginRequest, RefreshRequest } from '@forerun/shared-types';
import { LogoutSchema } from './dto/logout.dto.js';
import type { LogoutDto } from './dto/logout.dto.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { Throttle } from '@nestjs/throttler';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Public()
  @Throttle({ register: { limit: 3, ttl: 3600000 } })
  register(@Body(new ZodValidationPipe(RegisterSchema)) dto: RegisterRequest) {
    return this.authService.register(dto);
  }

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ login: { limit: 10, ttl: 900000 } })
  login(
    @Body(new ZodValidationPipe(LoginSchema)) dto: LoginRequest,
    @Headers('user-agent') deviceInfo?: string,
  ) {
    return this.authService.login(dto, deviceInfo);
  }

  // F11b: إرجاع 200 OK بدلاً من 201 Created لنقاط تجديد الجلسة
  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ refresh: { limit: 30, ttl: 60000 } })
  refresh(@Body(new ZodValidationPipe(RefreshSchema)) dto: RefreshRequest) {
    return this.authService.refresh(dto);
  }

  @Post('logout')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ logout: { limit: 30, ttl: 60000 } })
  logout(@Body(new ZodValidationPipe(LogoutSchema)) dto: LogoutDto) {
    return this.authService.logout(dto);
  }
}
