import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, resetDatabase, USERS } from './helpers/test-app.js';

describe('Users, equipment and X-User-Id (HTTP)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createTestApp();
    await resetDatabase(app);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('X-User-Id guard', () => {
    it('401 when the header is missing', async () => {
      const res = await http().get('/me').expect(401);
      expect(res.body.message).toMatch(/X-User-Id/);
    });

    it.each(['abc', '0', '-1', '1.5', '99999999999'])(
      '401 when the header is malformed (%s)',
      async (value) => {
        await http().get('/me').set('X-User-Id', value).expect(401);
      },
    );

    it('401 when the user does not exist', async () => {
      const res = await http().get('/me').set('X-User-Id', '999').expect(401);
      expect(res.body.message).toMatch(/does not exist/);
    });

    it('identifies the user and reads the role from app_user', async () => {
      const res = await http()
        .get('/me')
        .set('X-User-Id', String(USERS.supervisor))
        .expect(200);
      expect(res.body).toEqual({
        id: 3,
        username: 'wichai.k',
        fullName: 'Wichai Kaewsri',
        role: 'supervisor',
      });
    });
  });

  describe('GET /users', () => {
    it('is public and lists the 5 seed users', async () => {
      const res = await http().get('/users').expect(200);
      expect(res.body).toHaveLength(5);
      expect(res.body.map((u: { role: string }) => u.role)).toEqual([
        'requester',
        'requester',
        'supervisor',
        'supervisor',
        'department_manager',
      ]);
    });
  });

  describe('GET /equipment', () => {
    it('requires X-User-Id', async () => {
      await http().get('/equipment').expect(401);
    });

    it('lists all equipment, most urgent first, dates as YYYY-MM-DD', async () => {
      const res = await http()
        .get('/equipment')
        .set('X-User-Id', String(USERS.requester))
        .expect(200);

      const dates: string[] = res.body.map(
        (e: { nextDueDate: string }) => e.nextDueDate,
      );
      expect(res.body.length).toBeGreaterThanOrEqual(20);
      expect(dates.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))).toBe(true);
      expect([...dates].sort()).toEqual(dates);
      expect(res.body[0]).toEqual(
        expect.objectContaining({
          id: expect.any(Number),
          tagNo: expect.any(String),
          name: expect.any(String),
          location: expect.any(String),
          criticality: expect.stringMatching(/^[ABC]$/),
        }),
      );
    });

    it('GET /equipment/:id returns one item', async () => {
      const res = await http()
        .get('/equipment/1')
        .set('X-User-Id', String(USERS.requester))
        .expect(200);
      expect(res.body).toEqual(
        expect.objectContaining({ id: 1, tagNo: 'PSV-1001', criticality: 'A' }),
      );
    });

    it.each(['9999', 'abc', '99999999999'])(
      'GET /equipment/%s -> 404',
      async (id) => {
        await http()
          .get(`/equipment/${id}`)
          .set('X-User-Id', String(USERS.requester))
          .expect(404);
      },
    );
  });
});
