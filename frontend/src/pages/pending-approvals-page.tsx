import { ApproverBadge, CriticalityBadge } from '@/components/app/badges'
import { DecisionDialog, type Decision } from '@/components/app/decision-dialog'
import { Empty, LoadError, Loading } from '@/components/app/load-state'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { api, type AppUser, type DeferralRequest } from '@/lib/api'
import { daysBetween, formatDate, formatDateTime, ROLE_LABEL } from '@/lib/format'
import { useLoad } from '@/lib/use-load'
import { Check, Lock, ShieldAlert, X } from 'lucide-react'
import { useState } from 'react'

/** Screen 3: requests the current user may approve or reject. */
export function PendingApprovalsPage({
  user,
  refreshKey,
  onChanged,
}: {
  user: AppUser
  refreshKey: number
  onChanged: () => void
}) {
  if (user.role === 'requester') {
    return (
      <Alert>
        <Lock />
        <AlertTitle>ไม่มีสิทธิ์อนุมัติ</AlertTitle>
        <AlertDescription>
          บทบาท{ROLE_LABEL.requester}ยื่นคำขอได้อย่างเดียว — สลับเป็นหัวหน้างานหรือผู้จัดการฝ่ายเพื่ออนุมัติ
        </AlertDescription>
      </Alert>
    )
  }
  return <ApprovalQueue user={user} refreshKey={refreshKey} onChanged={onChanged} />
}

function ApprovalQueue({
  user,
  refreshKey,
  onChanged,
}: {
  user: AppUser
  refreshKey: number
  onChanged: () => void
}) {
  const [active, setActive] = useState<{
    request: DeferralRequest
    decision: Decision
  } | null>(null)
  const { data, error } = useLoad(
    () => api.pendingApprovals(user.id),
    `${user.id}:${refreshKey}`,
  )

  if (error) return <LoadError message={error} />
  if (!data) return <Loading />
  if (data.length === 0) {
    return <Empty>ไม่มีคำขอที่รอคุณอนุมัติ</Empty>
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>อุปกรณ์</TableHead>
            <TableHead>ผู้ยื่น</TableHead>
            <TableHead>กำหนดเดิม → ใหม่</TableHead>
            <TableHead>เหตุผล</TableHead>
            <TableHead>ผู้มีอำนาจอนุมัติ</TableHead>
            <TableHead className="text-right" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((r) => (
            <TableRow key={r.id} className="align-top">
              <TableCell>
                <div className="flex items-center gap-2 font-mono font-medium">
                  {r.equipment.tagNo}
                  <CriticalityBadge value={r.equipment.criticality} />
                </div>
                <div className="text-xs text-muted-foreground">{r.equipment.name}</div>
              </TableCell>
              <TableCell>
                {r.requestedBy.fullName}
                <div className="text-xs text-muted-foreground">
                  {formatDateTime(r.createdAt)}
                </div>
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {formatDate(r.previousDueDate)} → {formatDate(r.requestedDueDate)}
                <div className="text-xs text-muted-foreground">
                  +{daysBetween(r.previousDueDate, r.requestedDueDate)} วัน
                  {r.cycleBaseDueDate !== r.previousDueDate &&
                    ` (รวม +${daysBetween(r.cycleBaseDueDate, r.requestedDueDate)} วันจากกำหนดเดิม)`}
                </div>
              </TableCell>
              <TableCell className="max-w-64 whitespace-normal">{r.reason}</TableCell>
              <TableCell className="max-w-72 whitespace-normal">
                <ApproverBadge value={r.requiredApproverRole} />
                {r.policyNote && (
                  <p className="mt-1 flex gap-1 text-xs text-destructive">
                    <ShieldAlert className="mt-0.5 size-3 shrink-0" />
                    {r.policyNote}
                  </p>
                )}
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    onClick={() => setActive({ request: r, decision: 'approve' })}
                  >
                    <Check />
                    อนุมัติ
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setActive({ request: r, decision: 'reject' })}
                  >
                    <X />
                    ปฏิเสธ
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {active && (
        <DecisionDialog
          request={active.request}
          decision={active.decision}
          userId={user.id}
          onClose={() => setActive(null)}
          onDecided={() => {
            setActive(null)
            onChanged()
          }}
        />
      )}
    </>
  )
}
