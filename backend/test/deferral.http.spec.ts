import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { addDays } from '../src/common/date-only.js';
import {
  createTestApp,
  EQUIPMENT,
  resetDatabase,
  setDueDate,
  USERS,
} from './helpers/test-app.js';

describe('Deferral requests (HTTP + real database)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  const dueDate = async (equipmentId: number): Promise<string> =>
    (
      await http()
        .get(`/equipment/${equipmentId}`)
        .set('X-User-Id', String(USERS.requester))
        .expect(200)
    ).body.nextDueDate;

  const submit = (
    userId: number,
    body: Record<string, unknown>,
    reason = 'Spare parts on back order',
  ) =>
    http()
      .post('/deferral-requests')
      .set('X-User-Id', String(userId))
      .send({ reason, ...body });

  /** Submits a deferral of `days` from the current due date, expecting `status`. */
  const submitDays = async (
    equipmentId: number,
    days: number,
    status: number,
    userId: number = USERS.requester,
  ) =>
    submit(userId, {
      equipmentId,
      requestedDueDate: addDays(await dueDate(equipmentId), days),
    }).expect(status);

  const approve = (userId: number, id: number, note?: string) =>
    http()
      .post(`/deferral-requests/${id}/approve`)
      .set('X-User-Id', String(userId))
      .send(note === undefined ? {} : { note });

  const reject = (userId: number, id: number, note?: string) =>
    http()
      .post(`/deferral-requests/${id}/reject`)
      .set('X-User-Id', String(userId))
      .send(note === undefined ? {} : { note });

  /** Submit + approve in one step; returns the approved request. */
  const deferAndApprove = async (
    equipmentId: number,
    days: number,
    approverId: number = USERS.supervisor,
  ) => {
    const created = await submitDays(equipmentId, days, 201);
    return (await approve(approverId, created.body.id).expect(200)).body;
  };

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(app);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('submit', () => {
    it('creates a pending request routed to the supervisor', async () => {
      const current = await dueDate(EQUIPMENT.psv1003A);
      const res = await submitDays(EQUIPMENT.psv1003A, 10, 201);

      expect(res.body).toEqual(
        expect.objectContaining({
          status: 'pending',
          equipmentId: EQUIPMENT.psv1003A,
          requestedById: USERS.requester,
          previousDueDate: current,
          cycleBaseDueDate: current,
          requestedDueDate: addDays(current, 10),
          reason: 'Spare parts on back order',
          requiredApproverRole: 'supervisor',
          policyNote: null,
          decidedById: null,
        }),
      );
      expect(res.body.equipment.tagNo).toBe('PSV-1003');
      expect(res.body.requestedBy.username).toBe('somchai.t');
      // submitting does not move the due date yet
      expect(await dueDate(EQUIPMENT.psv1003A)).toBe(current);
    });

    it('trims the reason', async () => {
      const current = await dueDate(EQUIPMENT.psv1003A);
      const res = await submit(
        USERS.requester,
        {
          equipmentId: EQUIPMENT.psv1003A,
          requestedDueDate: addDays(current, 1),
        },
        '   Waiting for vendor   ',
      ).expect(201);
      expect(res.body.reason).toBe('Waiting for vendor');
    });

    it.each([
      ['missing reason', { reason: undefined }],
      ['blank reason', { reason: '    ' }],
      ['invalid calendar date', { requestedDueDate: '2026-02-30' }],
      [
        'datetime instead of date',
        { requestedDueDate: '2026-06-01T00:00:00Z' },
      ],
      ['equipmentId as string', { equipmentId: '3' }],
      ['unknown property', { approvedBy: 5 }],
    ])('400 for %s', async (_label, override) => {
      const current = await dueDate(EQUIPMENT.psv1003A);
      await http()
        .post('/deferral-requests')
        .set('X-User-Id', String(USERS.requester))
        .send({
          equipmentId: EQUIPMENT.psv1003A,
          requestedDueDate: addDays(current, 5),
          reason: 'ok',
          ...override,
        })
        .expect(400);
    });

    it('400 when the new date is not later than the current due date', async () => {
      const res = await submitDays(EQUIPMENT.psv1003A, 0, 400);
      expect(res.body.message).toMatch(/later than the current due date/);
      await submitDays(EQUIPMENT.psv1003A, -1, 400);
    });

    it('400 when the new date is still in the past (overdue equipment)', async () => {
      // PSV-1001 is 12 days overdue; +5 days is still 7 days ago
      const res = await submitDays(EQUIPMENT.psv1001A, 5, 400);
      expect(res.body.message).toMatch(/must not be in the past/);
    });

    it('404 for unknown equipment', async () => {
      await submit(USERS.requester, {
        equipmentId: 9999,
        requestedDueDate: '2099-01-01',
      }).expect(404);
    });

    it('401 without X-User-Id', async () => {
      await http()
        .post('/deferral-requests')
        .send({ equipmentId: 3, requestedDueDate: '2099-01-01', reason: 'x' })
        .expect(401);
    });

    it('409 when the equipment already has a pending request', async () => {
      await submitDays(EQUIPMENT.psv1003A, 5, 201);
      const res = await submitDays(
        EQUIPMENT.psv1003A,
        7,
        409,
        USERS.requester2,
      );
      expect(res.body.message).toMatch(/already has a pending/);
    });

    it('allows only one of two simultaneous requests for the same equipment', async () => {
      const date = addDays(await dueDate(EQUIPMENT.psv1003A), 5);
      const body = { equipmentId: EQUIPMENT.psv1003A, requestedDueDate: date };
      const results = await Promise.all([
        submit(USERS.requester, body),
        submit(USERS.requester2, body),
      ]);
      expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([
        201, 409,
      ]);
    });
  });

  describe('approve / reject', () => {
    it('approve moves the equipment due date to the requested date', async () => {
      const created = await submitDays(EQUIPMENT.psv1003A, 10, 201);
      const res = await approve(USERS.supervisor, created.body.id, 'OK').expect(
        200,
      );

      expect(res.body).toEqual(
        expect.objectContaining({
          status: 'approved',
          decidedById: USERS.supervisor,
          decisionNote: 'OK',
          decidedAt: expect.any(String),
        }),
      );
      expect(await dueDate(EQUIPMENT.psv1003A)).toBe(
        created.body.requestedDueDate,
      );
    });

    it('reject keeps the due date and requires a note', async () => {
      const current = await dueDate(EQUIPMENT.psv1003A);
      const created = await submitDays(EQUIPMENT.psv1003A, 10, 201);

      await reject(USERS.supervisor, created.body.id).expect(400);
      await reject(USERS.supervisor, created.body.id, '   ').expect(400);
      const res = await reject(
        USERS.supervisor,
        created.body.id,
        'Inspect now',
      ).expect(200);

      expect(res.body).toEqual(
        expect.objectContaining({
          status: 'rejected',
          decidedById: USERS.supervisor,
          decisionNote: 'Inspect now',
        }),
      );
      expect(await dueDate(EQUIPMENT.psv1003A)).toBe(current);
    });

    it('a rejected request frees the equipment for a new request', async () => {
      const created = await submitDays(EQUIPMENT.psv1003A, 10, 201);
      await reject(USERS.supervisor, created.body.id, 'No').expect(200);
      await submitDays(EQUIPMENT.psv1003A, 5, 201);
    });

    it('409 when deciding a request that is no longer pending', async () => {
      const created = await submitDays(EQUIPMENT.psv1003A, 10, 201);
      await approve(USERS.supervisor, created.body.id).expect(200);
      await approve(USERS.supervisor2, created.body.id).expect(409);
      await reject(USERS.supervisor2, created.body.id, 'late').expect(409);
    });

    it('403 for a requester', async () => {
      const created = await submitDays(EQUIPMENT.psv1003A, 10, 201);
      await approve(USERS.requester2, created.body.id).expect(403);
      await reject(USERS.requester2, created.body.id, 'no').expect(403);
    });

    it('403 when deciding your own request', async () => {
      const created = await submitDays(
        EQUIPMENT.psv1003A,
        10,
        201,
        USERS.supervisor,
      );
      const res = await approve(USERS.supervisor, created.body.id).expect(403);
      expect(res.body.message).toMatch(/your own request/);
      await approve(USERS.supervisor2, created.body.id).expect(200);
    });

    it('404 for an unknown request', async () => {
      await approve(USERS.supervisor, 999999).expect(404);
      await approve(USERS.supervisor, 0).expect(404);
    });

    it('409 when the due date changed after the request was submitted', async () => {
      const created = await submitDays(EQUIPMENT.psv1003A, 10, 201);
      await setDueDate(
        app,
        EQUIPMENT.psv1003A,
        addDays(created.body.previousDueDate, 3),
      );
      const res = await approve(USERS.supervisor, created.body.id).expect(409);
      expect(res.body.message).toMatch(/due date changed/);
    });
  });

  describe('Policy 4.2 enforcement end to end', () => {
    it('A, +30 days: supervisor may approve', async () => {
      const created = await submitDays(EQUIPMENT.psv1003A, 30, 201);
      expect(created.body.requiredApproverRole).toBe('supervisor');
      await approve(USERS.supervisor, created.body.id).expect(200);
    });

    it('A, +31 days: routed to the manager; supervisor gets 403, manager approves', async () => {
      const created = await submitDays(EQUIPMENT.psv1003A, 31, 201);
      expect(created.body.requiredApproverRole).toBe('department_manager');
      expect(created.body.policyNote).toMatch(/31 days/);

      const res = await approve(USERS.supervisor, created.body.id).expect(403);
      expect(res.body.message).toMatch(/Policy 4\.2/);
      await reject(USERS.supervisor, created.body.id, 'no').expect(403);

      await approve(USERS.manager, created.body.id).expect(200);
      expect(await dueDate(EQUIPMENT.psv1003A)).toBe(
        created.body.requestedDueDate,
      );
    });

    it('30 days are cumulative across deferrals in the same cycle', async () => {
      const original = await dueDate(EQUIPMENT.psv1003A);
      await deferAndApprove(EQUIPMENT.psv1003A, 20);

      const second = await submitDays(EQUIPMENT.psv1003A, 15, 201); // total 35
      expect(second.body.cycleBaseDueDate).toBe(original);
      expect(second.body.requiredApproverRole).toBe('department_manager');
      expect(second.body.policyNote).toMatch(/35 days/);
    });

    it('A: the repeat deferral is fine, the 3rd needs the manager', async () => {
      await deferAndApprove(EQUIPMENT.psv1003A, 5);
      const second = await submitDays(EQUIPMENT.psv1003A, 5, 201);
      expect(second.body.requiredApproverRole).toBe('supervisor');
      await approve(USERS.supervisor, second.body.id).expect(200);

      const third = await submitDays(EQUIPMENT.psv1003A, 5, 201); // total 15
      expect(third.body.requiredApproverRole).toBe('department_manager');
      expect(third.body.policyNote).toMatch(/deferral #3/);
    });

    it('rejected requests do not count as deferrals', async () => {
      const first = await submitDays(EQUIPMENT.psv1003A, 5, 201);
      await reject(USERS.supervisor, first.body.id, 'no').expect(200);
      const second = await submitDays(EQUIPMENT.psv1003A, 5, 201);
      await reject(USERS.supervisor, second.body.id, 'no').expect(200);

      await deferAndApprove(EQUIPMENT.psv1003A, 5);
      const next = await submitDays(EQUIPMENT.psv1003A, 5, 201);
      expect(next.body.requiredApproverRole).toBe('supervisor'); // still the 2nd
    });

    it('manager-approved deferrals still count towards the cycle', async () => {
      await deferAndApprove(EQUIPMENT.psv1003A, 31, USERS.manager);
      const next = await submitDays(EQUIPMENT.psv1003A, 1, 201);
      expect(next.body.requiredApproverRole).toBe('department_manager'); // 32 days
    });

    it('a due date changed outside deferrals starts a new cycle', async () => {
      await deferAndApprove(EQUIPMENT.psv1003A, 20);
      await deferAndApprove(EQUIPMENT.psv1003A, 5);

      // e.g. the inspection was done and the next one scheduled
      const nextCycle = addDays(await dueDate(EQUIPMENT.psv1003A), 180);
      await setDueDate(app, EQUIPMENT.psv1003A, nextCycle);

      const res = await submitDays(EQUIPMENT.psv1003A, 30, 201);
      expect(res.body.cycleBaseDueDate).toBe(nextCycle);
      expect(res.body.requiredApproverRole).toBe('supervisor');
    });

    it.each([
      ['B', EQUIPMENT.pmp2002B],
      ['C', EQUIPMENT.hvc6001C],
    ])('criticality %s has no limits', async (_c, equipmentId) => {
      await deferAndApprove(equipmentId, 60);
      await deferAndApprove(equipmentId, 60);
      const third = await submitDays(equipmentId, 90, 201);
      expect(third.body.requiredApproverRole).toBe('supervisor');
      expect(third.body.policyNote).toBeNull();
    });
  });

  describe('lists', () => {
    it('pending-approvals: supervisors see only supervisor-level requests, never their own', async () => {
      const normal = await submitDays(EQUIPMENT.psv1003A, 5, 201);
      const escalated = await submitDays(EQUIPMENT.pmp2001A, 40, 201);
      const ownBySupervisor = await submitDays(
        EQUIPMENT.pmp2002B,
        5,
        201,
        USERS.supervisor,
      );

      const ids = async (userId: number) =>
        (
          await http()
            .get('/deferral-requests/pending-approvals')
            .set('X-User-Id', String(userId))
            .expect(200)
        ).body.map((r: { id: number }) => r.id);

      expect(await ids(USERS.supervisor)).toEqual([normal.body.id]);
      expect(await ids(USERS.supervisor2)).toEqual([
        normal.body.id,
        ownBySupervisor.body.id,
      ]);
      expect(await ids(USERS.manager)).toEqual([
        normal.body.id,
        escalated.body.id,
        ownBySupervisor.body.id,
      ]);

      await http()
        .get('/deferral-requests/pending-approvals')
        .set('X-User-Id', String(USERS.requester))
        .expect(403);
    });

    it('GET /deferral-requests lists all, newest first; GET /:id returns one', async () => {
      const a = await submitDays(EQUIPMENT.psv1003A, 5, 201);
      const b = await submitDays(EQUIPMENT.pmp2002B, 5, 201);

      const list = await http()
        .get('/deferral-requests')
        .set('X-User-Id', String(USERS.requester))
        .expect(200);
      expect(list.body.map((r: { id: number }) => r.id)).toEqual([
        b.body.id,
        a.body.id,
      ]);

      const one = await http()
        .get(`/deferral-requests/${a.body.id}`)
        .set('X-User-Id', String(USERS.requester))
        .expect(200);
      expect(one.body.id).toBe(a.body.id);

      await http()
        .get('/deferral-requests/abc')
        .set('X-User-Id', String(USERS.requester))
        .expect(404);
    });
  });

  describe('edge cases (Phase 4 review)', () => {
    it('A: two deferrals adding up to exactly 30 days stay with the supervisor', async () => {
      await deferAndApprove(EQUIPMENT.psv1003A, 20);
      const second = await submitDays(EQUIPMENT.psv1003A, 10, 201); // 30
      expect(second.body.requiredApproverRole).toBe('supervisor');
      await approve(USERS.supervisor, second.body.id).expect(200);
    });

    // PSV-1001 is 12 days overdue: the 30 days still count from its
    // original (past) due date, not from today.
    it.each([
      ['today (12 days)', 12, 'supervisor'],
      ['today + 18 (30 days)', 30, 'supervisor'],
      ['today + 19 (31 days)', 31, 'department_manager'],
    ])(
      'overdue A equipment, new date %s -> %s',
      async (_label, days, expected) => {
        const res = await submitDays(EQUIPMENT.psv1001A, days, 201);
        expect(res.body.requiredApproverRole).toBe(expected);
      },
    );

    it('re-evaluates policy 4.2 at approval instead of trusting the stored routing', async () => {
      const current = await dueDate(EQUIPMENT.psv1003A);
      const pending = await submitDays(EQUIPMENT.psv1003A, 5, 201);
      expect(pending.body.requiredApproverRole).toBe('supervisor');

      // History changes behind the app's back: two approved deferrals that
      // led to the current due date now exist in this cycle.
      const base = addDays(current, -20);
      const middle = addDays(current, -10);
      await app.get(DataSource).query(
        `INSERT INTO deferral_request
           (equipment_id, requested_by, previous_due_date, cycle_base_due_date,
            requested_due_date, reason, status, required_approver_role,
            decided_by, decided_at)
         VALUES ($1, 1, $2, $2, $3, 'old', 'approved', 'supervisor', 3, now()),
                ($1, 1, $3, $2, $4, 'old', 'approved', 'supervisor', 3, now())`,
        [EQUIPMENT.psv1003A, base, middle, current],
      );

      // The pending request is now the 3rd deferral: the supervisor may not
      // approve it any more, the manager may.
      const res = await approve(USERS.supervisor, pending.body.id).expect(403);
      expect(res.body.message).toMatch(/department_manager/);

      const approved = await approve(USERS.manager, pending.body.id).expect(
        200,
      );
      expect(approved.body).toEqual(
        expect.objectContaining({
          requiredApproverRole: 'department_manager',
          cycleBaseDueDate: base,
          policyNote: expect.stringContaining('deferral #3'),
        }),
      );
    });

    it('two approvers at the same time: exactly one succeeds', async () => {
      const created = await submitDays(EQUIPMENT.psv1003A, 10, 201);
      const results = await Promise.all([
        approve(USERS.supervisor, created.body.id),
        approve(USERS.supervisor2, created.body.id),
      ]);
      expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([
        200, 409,
      ]);
      expect(await dueDate(EQUIPMENT.psv1003A)).toBe(
        created.body.requestedDueDate,
      );
    });

    it('approve and reject at the same time: one wins and the data matches it', async () => {
      const current = await dueDate(EQUIPMENT.psv1003A);
      const created = await submitDays(EQUIPMENT.psv1003A, 10, 201);
      const [approveRes, rejectRes] = await Promise.all([
        approve(USERS.supervisor, created.body.id),
        reject(USERS.supervisor2, created.body.id, 'no'),
      ]);
      expect(
        [approveRes.status, rejectRes.status].sort((a, b) => a - b),
      ).toEqual([200, 409]);

      const final = await http()
        .get(`/deferral-requests/${created.body.id}`)
        .set('X-User-Id', String(USERS.requester))
        .expect(200);
      const expectedDate =
        final.body.status === 'approved'
          ? created.body.requestedDueDate
          : current;
      expect(await dueDate(EQUIPMENT.psv1003A)).toBe(expectedDate);
    });

    it('submit waits for a concurrent change to the equipment row and uses its result', async () => {
      const current = await dueDate(EQUIPMENT.psv1003A);
      const moved = addDays(current, 3);

      // Another transaction (e.g. an approval being committed) holds the
      // equipment row and is about to change the due date.
      const other = app.get(DataSource).createQueryRunner();
      await other.connect();
      await other.startTransaction();
      try {
        await other.query('SELECT id FROM equipment WHERE id = $1 FOR UPDATE', [
          EQUIPMENT.psv1003A,
        ]);

        let settled = false;
        const submission = submit(USERS.requester, {
          equipmentId: EQUIPMENT.psv1003A,
          requestedDueDate: addDays(current, 10),
        }).then((res) => {
          settled = true;
          return res;
        });

        await new Promise((resolve) => setTimeout(resolve, 300));
        expect(settled).toBe(false); // blocked on the row lock

        await other.query(
          'UPDATE equipment SET next_due_date = $1 WHERE id = $2',
          [moved, EQUIPMENT.psv1003A],
        );
        await other.commitTransaction();

        const res = await submission;
        expect(res.status).toBe(201);
        expect(res.body.previousDueDate).toBe(moved); // not the stale date
      } finally {
        if (other.isTransactionActive) await other.rollbackTransaction();
        await other.release();
      }
    });

    it('the department manager may reject', async () => {
      const created = await submitDays(EQUIPMENT.psv1003A, 31, 201);
      await reject(USERS.manager, created.body.id, 'Inspect first').expect(200);
    });

    it('reason: 1000 characters accepted, 1001 rejected', async () => {
      const date = addDays(await dueDate(EQUIPMENT.psv1003A), 5);
      const body = { equipmentId: EQUIPMENT.psv1003A, requestedDueDate: date };
      await submit(USERS.requester, body, 'x'.repeat(1001)).expect(400);
      await submit(USERS.requester, body, 'x'.repeat(1000)).expect(201);
    });

    // Known limitation (DECISIONS): the seed has one department manager, who
    // cannot decide their own request, so their escalated request waits.
    it("the manager's own escalated request cannot be decided by anyone", async () => {
      const created = await submitDays(
        EQUIPMENT.psv1003A,
        31,
        201,
        USERS.manager,
      );
      await approve(USERS.manager, created.body.id).expect(403);
      await approve(USERS.supervisor, created.body.id).expect(403);

      const managerQueue = await http()
        .get('/deferral-requests/pending-approvals')
        .set('X-User-Id', String(USERS.manager))
        .expect(200);
      expect(managerQueue.body).toEqual([]);
    });
  });
});
