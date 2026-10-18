import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppModule } from './app.module.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { arabicErrorMap } from './common/pipes/zod-validation.pipe.js';
import helmet from 'helmet';
import * as Sentry from '@sentry/nestjs';
import { nestIntegration } from '@sentry/nestjs';

async function bootstrap(): Promise<void> {
  z.setErrorMap(arabicErrorMap);

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: true,
    rawBody: true,
  });

  // Trust proxy must be explicitly configured. Defaulting to `true` lets the
  // client choose the left-most X-Forwarded-For value, which Nest's
  // ThrottlerGuard uses as its tracker, allowing per-IP throttling to be
  // bypassed on login/registration. Set TRUST_PROXY to the actual trusted
  // proxy address or subnet (e.g. "127.0.0.1" or "10.0.0.0/8"); leave it
  // unset or "false" when the API is directly exposed.
  const trustProxy = process.env.TRUST_PROXY;
  if (trustProxy && trustProxy !== 'false') {
    app.set('trust proxy', trustProxy);
  } else {
    app.set('trust proxy', false);
  }

  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      integrations: [nestIntegration()],
      tracesSampleRate: 1.0,
    });
  }

  app.use(helmet());

  // F11a: Permissions-Policy (BUG-024 ملاحظة معمارية)
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    );
    next();
  });

  const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
    : [];

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  app.setGlobalPrefix('api/v1');

  app.useGlobalFilters(new AllExceptionsFilter());

  app.enableShutdownHooks();

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`FAWRUN API listening on http://localhost:${port}/api/v1`);
}

void bootstrap();