import type {
  ApproverRole,
  Criticality,
  DeferralStatus,
  UserRole,
} from './api'

export const ROLE_LABEL: Record<UserRole, string> = {
  requester: 'ผู้ยื่นคำขอ',
  supervisor: 'หัวหน้างาน',
  department_manager: 'ผู้จัดการฝ่าย',
}

export const APPROVER_LABEL: Record<ApproverRole, string> = {
  supervisor: 'หัวหน้างาน',
  department_manager: 'ผู้จัดการฝ่าย',
}

export const STATUS_LABEL: Record<DeferralStatus, string> = {
  pending: 'รออนุมัติ',
  approved: 'อนุมัติแล้ว',
  rejected: 'ปฏิเสธ',
}

export const CRITICALITY_VARIANT: Record<
  Criticality,
  'destructive' | 'secondary' | 'outline'
> = { A: 'destructive', B: 'secondary', C: 'outline' }

const MS_PER_DAY = 86_400_000

function toUtcMs(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

/** Whole days from `from` to `to` (YYYY-MM-DD strings, no timezone shift). */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / MS_PER_DAY)
}

export function addDays(date: string, days: number): string {
  return new Date(toUtcMs(date) + days * MS_PER_DAY).toISOString().slice(0, 10)
}

/** Today in the browser's local timezone as YYYY-MM-DD. */
export function todayLocal(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** 2026-11-27 -> 27 พ.ย. 2569 */
export function formatDate(date: string): string {
  return new Date(toUtcMs(date)).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('th-TH', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}
