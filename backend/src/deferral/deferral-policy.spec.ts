import type { Criticality } from '../equipment/equipment.entity.js';
import type { UserRole } from '../users/app-user.entity.js';
import type { ApproverRole } from './deferral-request.entity.js';
import {
  canDecide,
  evaluateDeferralPolicy,
  resolveCycle,
  validateRequestedDate,
} from './deferral-policy.js';

const BASE = '2026-06-01'; // original due date of the cycle

describe('Policy 4.2 — evaluateDeferralPolicy', () => {
  type Row = [
    label: string,
    criticality: Criticality,
    approvedCount: number,
    requested: string,
    expected: ApproverRole,
  ];

  it.each<Row>([
    // --- Criticality A: 30-day limit (cumulative from the original date) ---
    ['A, first deferral +1 day', 'A', 0, '2026-06-02', 'supervisor'],
    [
      'A, first deferral +30 days (exactly at limit)',
      'A',
      0,
      '2026-07-01',
      'supervisor',
    ],
    ['A, first deferral +31 days', 'A', 0, '2026-07-02', 'department_manager'],
    ['A, repeat deferral, total 30 days', 'A', 1, '2026-07-01', 'supervisor'],
    [
      'A, repeat deferral, total 35 days (20 + 15)',
      'A',
      1,
      '2026-07-06',
      'department_manager',
    ],
    // --- Criticality A: number of deferrals per cycle ---
    [
      'A, 2nd deferral (the one allowed repeat)',
      'A',
      1,
      '2026-06-10',
      'supervisor',
    ],
    [
      'A, 3rd deferral within 30 days',
      'A',
      2,
      '2026-06-15',
      'department_manager',
    ],
    ['A, 4th deferral', 'A', 3, '2026-06-16', 'department_manager'],
    // --- Criticality B / C: no limits ---
    ['B, +90 days', 'B', 0, '2026-08-30', 'supervisor'],
    ['B, 5th deferral', 'B', 4, '2026-06-20', 'supervisor'],
    ['C, +365 days', 'C', 0, '2027-06-01', 'supervisor'],
  ])('%s -> %s', (_label, criticality, approvedCount, requested, expected) => {
    const decision = evaluateDeferralPolicy({
      criticality,
      cycle: { baseDueDate: BASE, approvedCount },
      requestedDueDate: requested,
    });
    expect(decision.requiredApproverRole).toBe(expected);
    expect(decision.reasons.length > 0).toBe(expected === 'department_manager');
  });

  it('reports total days and deferral number', () => {
    const decision = evaluateDeferralPolicy({
      criticality: 'A',
      cycle: { baseDueDate: BASE, approvedCount: 1 },
      requestedDueDate: '2026-07-06',
    });
    expect(decision.totalDaysDeferred).toBe(35);
    expect(decision.deferralNumber).toBe(2);
    expect(decision.reasons).toEqual([expect.stringContaining('35 days')]);
  });

  it('gives both reasons when both limits are exceeded', () => {
    const decision = evaluateDeferralPolicy({
      criticality: 'A',
      cycle: { baseDueDate: BASE, approvedCount: 2 },
      requestedDueDate: '2026-08-01',
    });
    expect(decision.requiredApproverRole).toBe('department_manager');
    expect(decision.reasons).toHaveLength(2);
  });

  it('counts the 30 days across month and year boundaries', () => {
    const cycle = { baseDueDate: '2026-12-15', approvedCount: 0 };
    expect(
      evaluateDeferralPolicy({
        criticality: 'A',
        cycle,
        requestedDueDate: '2027-01-14',
      }).requiredApproverRole,
    ).toBe('supervisor'); // 30 days
    expect(
      evaluateDeferralPolicy({
        criticality: 'A',
        cycle,
        requestedDueDate: '2027-01-15',
      }).requiredApproverRole,
    ).toBe('department_manager'); // 31 days
  });
});

describe('Policy 4.2 — resolveCycle', () => {
  it('no approved deferrals: new cycle at the current due date', () => {
    expect(resolveCycle('2026-06-01', [])).toEqual({
      baseDueDate: '2026-06-01',
      approvedCount: 0,
    });
  });

  it('latest approval produced the current date: same cycle, keeps base', () => {
    const approved = [
      { requestedDueDate: '2026-06-25', cycleBaseDueDate: '2026-06-01' },
      { requestedDueDate: '2026-06-10', cycleBaseDueDate: '2026-06-01' },
    ];
    expect(resolveCycle('2026-06-25', approved)).toEqual({
      baseDueDate: '2026-06-01',
      approvedCount: 2,
    });
  });

  it('only counts approvals of the current cycle', () => {
    const approved = [
      { requestedDueDate: '2026-12-20', cycleBaseDueDate: '2026-12-10' },
      { requestedDueDate: '2026-06-25', cycleBaseDueDate: '2026-06-01' },
      { requestedDueDate: '2026-06-10', cycleBaseDueDate: '2026-06-01' },
    ];
    expect(resolveCycle('2026-12-20', approved)).toEqual({
      baseDueDate: '2026-12-10',
      approvedCount: 1,
    });
  });

  it('due date changed outside deferrals (e.g. inspected): new cycle', () => {
    const approved = [
      { requestedDueDate: '2026-06-25', cycleBaseDueDate: '2026-06-01' },
    ];
    expect(resolveCycle('2026-12-01', approved)).toEqual({
      baseDueDate: '2026-12-01',
      approvedCount: 0,
    });
  });
});

describe('validateRequestedDate', () => {
  const today = '2026-06-01';

  it('accepts a date later than the current due date and not in the past', () => {
    expect(
      validateRequestedDate({
        requestedDueDate: '2026-06-11',
        currentDueDate: '2026-06-10',
        today,
      }),
    ).toBeNull();
  });

  it('accepts today for overdue equipment', () => {
    expect(
      validateRequestedDate({
        requestedDueDate: today,
        currentDueDate: '2026-05-20',
        today,
      }),
    ).toBeNull();
  });

  it.each([
    ['equal to the current due date', '2026-06-10', '2026-06-10', /later than/],
    [
      'earlier than the current due date',
      '2026-06-09',
      '2026-06-10',
      /later than/,
    ],
    ['in the past (overdue equipment)', '2026-05-25', '2026-05-20', /past/],
  ])('rejects a date %s', (_label, requested, current, message) => {
    expect(
      validateRequestedDate({
        requestedDueDate: requested,
        currentDueDate: current,
        today,
      }),
    ).toMatch(message);
  });
});

describe('canDecide', () => {
  it.each<[UserRole, ApproverRole, boolean]>([
    ['supervisor', 'supervisor', true],
    ['supervisor', 'department_manager', false],
    ['department_manager', 'supervisor', true],
    ['department_manager', 'department_manager', true],
    ['requester', 'supervisor', false],
    ['requester', 'department_manager', false],
  ])('%s deciding a request for %s -> %s', (role, required, expected) => {
    expect(canDecide(role, required)).toBe(expected);
  });
});
