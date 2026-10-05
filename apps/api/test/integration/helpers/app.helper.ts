import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../../src/app.module';
import supertest from 'supertest';
import { getStorageToken } from '@nestjs/throttler';

let app: INestApplication;

export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(getStorageToken())
    .useValue({
      increment: async () => ({
        totalHits: 1,
        timeToExpire: 0,
        isBlocked: false,
        timeToBlockExpire: 0,
      }),
    })
    .compile();

  app = moduleRef.createNestApplication();
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
