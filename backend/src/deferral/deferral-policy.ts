/**
 * Company policy section 4.2 — pure functions, no database access.
 *
 *   "Criticality A equipment may be deferred by at most 30 days from the
 *    original due date, and re-deferred at most once per inspection cycle.
 *    Anything beyond that must be approved by the department manager
 *    instead of the supervisor."
 *
 * Interpretation (see DECISIONS.docx):
 * - 30 days is cumulative, counted from the cycle's original due date
 *   (before any deferral), not from the current (already deferred) date.
 * - "re-deferred at most once" = at most 2 approved deferrals per cycle
 *   (the first one + one repeat); the 3rd onwards needs the manager.
 * - Exceeding the limits does not block the request; it re-routes it.
 * - Criticality B and C have no limits: the supervisor approves.
 */
import { daysBetween } from '../common/date-only.js';
import type { Criticality } from '../equipment/equipment.entity.js';
import type { UserRole } from '../users/app-user.entity.js';
import type { ApproverRole } from './deferral-request.entity.js';

export const CRITICALITY_A_MAX_TOTAL_DAYS = 30;
export const CRITICALITY_A_MAX_DEFERRALS_PER_CYCLE = 2;

/** One inspection cycle: its original due date and deferrals approved so far. */
export interface InspectionCycle {
  baseDueDate: string;
  approvedCount: number;
}

export interface ApprovedDeferral {
  requestedDueDate: string;
  cycleBaseDueDate: string;
}

/**
 * Works out the current cycle from the equipment's due date and its approved
 * deferrals (newest first).
 *
 * If the newest approved deferral produced the current due date, we are still
 * in that cycle: keep its base date and count the consecutive approvals that
 * share it. Otherwise the due date was changed by something else (e.g. an
 * inspection was done) and a new cycle starts at the current due date.
 */
export function resolveCycle(
  currentDueDate: string,
  approvedNewestFirst: ApprovedDeferral[],
): InspectionCycle {
  const latest = approvedNewestFirst[0];
  if (!latest || latest.requestedDueDate !== currentDueDate) {
    return { baseDueDate: currentDueDate, approvedCount: 0 };
  }

  let approvedCount = 0;
  for (const deferral of approvedNewestFirst) {
    if (deferral.cycleBaseDueDate !== latest.cycleBaseDueDate) break;
    approvedCount++;
  }
  return { baseDueDate: latest.cycleBaseDueDate, approvedCount };
}

/** Basic sanity of the requested date; returns an error message or null. */
export function validateRequestedDate(input: {
  requestedDueDate: string;
  currentDueDate: string;
  today: string;
}): string | null {
  if (input.requestedDueDate <= input.currentDueDate) {
    return `requestedDueDate must be later than the current due date (${input.currentDueDate})`;
  }
  if (input.requestedDueDate < input.today) {
    return `requestedDueDate must not be in the past (today is ${input.today})`;
  }
  return null;
}

export interface PolicyDecision {
  requiredApproverRole: ApproverRole;
  /** Why the manager is needed; empty when the supervisor may approve. */
  reasons: string[];
  /** Days from the cycle's original due date to the requested date. */
  totalDaysDeferred: number;
  /** 1 for the first deferral in the cycle, 2 for the repeat, ... */
  deferralNumber: number;
}

/** Decides who must approve a deferral to `requestedDueDate`. */
export function evaluateDeferralPolicy(input: {
  criticality: Criticality;
  cycle: InspectionCycle;
  requestedDueDate: string;
}): PolicyDecision {
  const { criticality, cycle, requestedDueDate } = input;
  const totalDaysDeferred = daysBetween(cycle.baseDueDate, requestedDueDate);
  const deferralNumber = cycle.approvedCount + 1;
  const reasons: string[] = [];

  if (criticality === 'A') {
    if (totalDaysDeferred > CRITICALITY_A_MAX_TOTAL_DAYS) {
      reasons.push(
        `Criticality A: deferred ${totalDaysDeferred} days in total from the original due date ${cycle.baseDueDate} (limit ${CRITICALITY_A_MAX_TOTAL_DAYS})`,
      );
    }
    if (deferralNumber > CRITICALITY_A_MAX_DEFERRALS_PER_CYCLE) {
      reasons.push(
        `Criticality A: deferral #${deferralNumber} in this inspection cycle (limit ${CRITICALITY_A_MAX_DEFERRALS_PER_CYCLE}: first + 1 repeat)`,
      );
    }
  }

  return {
    requiredApproverRole:
      reasons.length > 0 ? 'department_manager' : 'supervisor',
    reasons,
    totalDaysDeferred,
    deferralNumber,
  };
}

/**
 * The department manager may decide any request; a supervisor only those
 * routed to a supervisor; requesters none.
 */
export function canDecide(userRole: UserRole, required: ApproverRole): boolean {
  if (userRole === 'department_manager') return true;
  if (userRole === 'supervisor') return required === 'supervisor';
  return false;
}
