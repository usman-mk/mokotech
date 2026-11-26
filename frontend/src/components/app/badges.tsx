import { Badge } from '@/components/ui/badge'
import type { ApproverRole, Criticality, DeferralStatus } from '@/lib/api'
import {
  APPROVER_LABEL,
  CRITICALITY_VARIANT,
  daysBetween,
  STATUS_LABEL,
  todayLocal,
} from '@/lib/format'
import { CircleCheck, CircleX, Clock, ShieldAlert, UserCheck } from 'lucide-react'

export function CriticalityBadge({ value }: { value: Criticality }) {
  return <Badge variant={CRITICALITY_VARIANT[value]}>{value}</Badge>
}

/** "เลยกำหนด 12 วัน" / "วันนี้" / "อีก 5 วัน" relative to the browser's today. */
export function DueBadge({ date }: { date: string }) {
  const days = daysBetween(todayLocal(), date)
  if (days < 0) return <Badge variant="destructive">เลยกำหนด {-days} วัน</Badge>
  if (days === 0) return <Badge variant="destructive">ครบกำหนดวันนี้</Badge>
  if (days <= 7) return <Badge variant="secondary">อีก {days} วัน</Badge>
  return <Badge variant="outline">อีก {days} วัน</Badge>
}

export function StatusBadge({ value }: { value: DeferralStatus }) {
  const icon = {
    pending: <Clock />,
    approved: <CircleCheck />,
    rejected: <CircleX />,
  }[value]
  const variant = { pending: 'secondary', approved: 'default', rejected: 'destructive' } as const
  return (
    <Badge variant={variant[value]}>
      {icon}
      {STATUS_LABEL[value]}
    </Badge>
  )
}

export function ApproverBadge({ value }: { value: ApproverRole }) {
  return value === 'department_manager' ? (
    <Badge variant="destructive">
      <ShieldAlert />
      {APPROVER_LABEL[value]}
    </Badge>
  ) : (
    <Badge variant="outline">
      <UserCheck />
      {APPROVER_LABEL[value]}
    </Badge>
  )
}
