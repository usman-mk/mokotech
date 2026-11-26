import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';

/**
 * Boots the real AppModule against the test database (see test/setup).
 * Migrations run on init, so an empty database works.
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

/** Seed equipment used by the tests (seed.sql). */
export const EQUIPMENT = {
  psv1001A: 1, // criticality A, due CURRENT_DATE - 12 (overdue)
  psv1003A: 3, // criticality A, due CURRENT_DATE + 5
  pmp2001A: 4, // criticality A, due CURRENT_DATE + 9
  pmp2002B: 5, // criticality B, due CURRENT_DATE + 14
  hvc6001C: 12, // criticality C, due CURRENT_DATE + 7
} as const;

// next_due_date offsets from CURRENT_DATE, as in seed.sql.
const SEED_DUE_OFFSETS: [id: number, days: number][] = [
  [1, -12],
  [2, -3],
  [3, 5],
  [4, 9],
  [5, 14],
  [6, 21],
  [7, 45],
  [8, 2],
  [9, 60],
  [10, 30],
  [11, 33],
  [12, 7],
  [13, 70],
  [14, -6],
  [15, 18],
  [16, 11],
  [17, 27],
  [18, 4],
  [19, 52],
  [20, 1],
];

/** Removes all requests and puts every due date back to its seed value. */
export async function resetDatabase(app: INestApplication): Promise<void> {
  const db = app.get(DataSource);
  await db.query('DELETE FROM deferral_request');
  const values = SEED_DUE_OFFSETS.map(([id, days]) => `(${id}, ${days})`);
  await db.query(`
    UPDATE equipment e
       SET next_due_date = CURRENT_DATE + v.days
      FROM (VALUES ${values.join(', ')}) AS v(id, days)
     WHERE e.id = v.id
  `);
}

/** Simulates something outside this app changing the due date (e.g. an inspection). */
export async function setDueDate(
  app: INestApplication,
  equipmentId: number,
  date: string,
): Promise<void> {
  await app
    .get(DataSource)
    .query('UPDATE equipment SET next_due_date = $1 WHERE id = $2', [
      date,
      equipmentId,
    ]);
}
