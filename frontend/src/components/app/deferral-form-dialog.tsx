import { CriticalityBadge } from '@/components/app/badges'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { api, ApiError, type Equipment } from '@/lib/api'
import {
  addDays,
  APPROVER_LABEL,
  daysBetween,
  formatDate,
  todayLocal,
} from '@/lib/format'
import { CircleAlert, Info, Loader2, Send } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'

/**
 * Form to request a new inspection due date. Policy 4.2 is decided by the
 * server; the form only explains it and shows the routing it returns.
 */
export function DeferralFormDialog({
  equipment,
  userId,
  onClose,
  onSubmitted,
}: {
  equipment: Equipment | null
  userId: number
  onClose: () => void
  onSubmitted: () => void
}) {
  const [requestedDueDate, setRequestedDueDate] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const reset = () => {
    setRequestedDueDate('')
    setReason('')
    setError(null)
  }

  const close = () => {
    reset()
    onClose()
  }

  if (!equipment) return null

  // Earliest allowed: the day after the current due date, and not in the past.
  const minDate = [addDays(equipment.nextDueDate, 1), todayLocal()].sort().at(-1)!
  const days = requestedDueDate
    ? daysBetween(equipment.nextDueDate, requestedDueDate)
    : null

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const created = await api.submitDeferral(userId, {
        equipmentId: equipment.id,
        requestedDueDate,
        reason,
      })
      if (created.requiredApproverRole === 'department_manager') {
        toast.warning(`ส่งคำขอ ${equipment.tagNo} แล้ว — ต้องให้ผู้จัดการฝ่ายอนุมัติ`, {
          description: created.policyNote ?? undefined,
        })
      } else {
        toast.success(`ส่งคำขอ ${equipment.tagNo} แล้ว — รอหัวหน้างานอนุมัติ`)
      }
      reset()
      onSubmitted()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>ขอเลื่อนกำหนดตรวจสอบ</DialogTitle>
            <DialogDescription>
              {equipment.tagNo} · {equipment.name}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 rounded-lg border p-3 text-sm">
            <div className="text-muted-foreground">ตำแหน่ง</div>
            <div>{equipment.location}</div>
            <div className="text-muted-foreground">Criticality</div>
            <div>
              <CriticalityBadge value={equipment.criticality} />
            </div>
            <div className="text-muted-foreground">กำหนดตรวจปัจจุบัน</div>
            <div className="font-medium">{formatDate(equipment.nextDueDate)}</div>
          </div>

          {equipment.criticality === 'A' && (
            <Alert>
              <Info />
              <AlertTitle>นโยบายหมวด 4.2 (Criticality A)</AlertTitle>
              <AlertDescription>
                เลื่อนรวมได้ไม่เกิน 30 วันจากกำหนดเดิมของรอบ และเลื่อนซ้ำได้ 1 ครั้ง
                ถ้าเกิน คำขอจะถูกส่งให้{APPROVER_LABEL.department_manager}อนุมัติแทน
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-2">
            <Label htmlFor="requestedDueDate">วันที่ใหม่</Label>
            <Input
              id="requestedDueDate"
              type="date"
              required
              min={minDate}
              value={requestedDueDate}
              onChange={(e) => setRequestedDueDate(e.target.value)}
            />
            {days !== null && days > 0 && (
              <p className="text-sm text-muted-foreground">
                เลื่อนออกไป {days} วันจากกำหนดปัจจุบัน
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="reason">เหตุผล</Label>
            <Textarea
              id="reason"
              required
              maxLength={1000}
              placeholder="เช่น รออะไหล่จากผู้ผลิต"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertTitle>ส่งคำขอไม่สำเร็จ</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              ยกเลิก
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="animate-spin" /> : <Send />}
              ส่งคำขอ
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
