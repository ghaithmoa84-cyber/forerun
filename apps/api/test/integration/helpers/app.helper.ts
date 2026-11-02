import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../../src/app.module';
import supertest from 'supertest';
import { getStorageToken } from '@nestjs/throttler';
import { CUSTOM_FEE_LIMIT } from '../../../src/modules/orders/services/admin-order-command.service.js';

let app: INestApplication;

export interface TestAppOptions {
  customFeeLimit?: number;
  enableThrottler?: boolean;
}

export async function createTestApp(options?: TestAppOptions): Promise<INestApplication> {
  let builder = Test.createTestingModule({
    imports: [AppModule],
  });

  if (!options?.enableThrottler) {
    builder = builder.overrideProvider(getStorageToken()).useValue({
      increment: async () => ({
        totalHits: 1,
        timeToExpire: 0,
        isBlocked: false,
        timeToBlockExpire: 0,
      }),
    });
  }

  if (options?.customFeeLimit !== undefined) {
    builder = builder
      .overrideProvider(CUSTOM_FEE_LIMIT)
      .useValue(options.customFeeLimit);
  }

  const moduleRef = await builder.compile();

  app = moduleRef.createNestApplication();
  (app as any).set('trust proxy', true);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  app.setGlobalPrefix('api/v1');
  await app.init();
  return app;
}

export async function closeTestApp(): Promise<void> {
  await app?.close();
}

export function getRequest() {
  return supertest(app.getHttpServer());
}

export function getTestApp(): INestApplication {
  return app;
}
