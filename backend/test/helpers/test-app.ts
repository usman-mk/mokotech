import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';

/**
 * Boots the real AppModule against DATABASE_URL (docker locally, the Postgres
 * service in CI). Migrations run on init, so an empty database works.
 */
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return app;
}

/** Seed users (seed.sql). */
export const USERS = {
  requester: 1, // somchai.t
  requester2: 2, // nattaya.p
  supervisor: 3, // wichai.k
  supervisor2: 4, // pensri.m
  manager: 5, // anan.s
} as const;
