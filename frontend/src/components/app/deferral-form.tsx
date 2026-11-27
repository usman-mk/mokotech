import { CriticalityBadge } from '@/components/app/badges'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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

export interface EquipmentChoice {
  equipment: Equipment
  /** Already has a pending request (the server allows only one). */
  pending: boolean
}

/**
 * The deferral request form, used on its own screen (pick the equipment from
 * `choices`) and in the per-row dialog (`equipment` fixed). Policy 4.2 is
 * decided by the server; the form explains it and shows the routing it returns.
 */
export function DeferralForm({
  userId,
  equipment,
  choices,
  onSubmitted,
  onCancel,
}: {
  userId: number
  equipment?: Equipment
  choices?: EquipmentChoice[]
  onSubmitted: () => void
  onCancel?: () => void
}) {
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [requestedDueDate, setRequestedDueDate] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const current =
    equipment ??
    choices?.find((c) => c.equipment.id === selectedId)?.equipment ??
    null

  // Earliest allowed: the day after the current due date, and not in the past.
  const minDate = current
    ? [addDays(current.nextDueDate, 1), todayLocal()].sort().at(-1)
    : undefined
  const days =
    current && requestedDueDate
      ? daysBetween(current.nextDueDate, requestedDueDate)
      : null

  const selectEquipment = (id: number) => {
    setSelectedId(id)
    setRequestedDueDate('') // the valid range depends on the equipment
    setError(null)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!current) return
    setSubmitting(true)
    setError(null)
    try {
      const created = await api.submitDeferral(userId, {
        equipmentId: current.id,
        requestedDueDate,
        reason,
      })
      if (created.requiredApproverRole === 'department_manager') {
        toast.warning(
          `ส่งคำขอ ${current.tagNo} แล้ว — ต้องให้ผู้จัดการฝ่ายอนุมัติ`,
          { description: created.policyNote ?? undefined },
        )
      } else {
        toast.success(`ส่งคำขอ ${current.tagNo} แล้ว — รอหัวหน้างานอนุมัติ`)
      }
      setSelectedId(null)
      setRequestedDueDate('')
      setReason('')
      onSubmitted()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      {choices && (
        <div className="grid gap-2">
          <Label htmlFor="equipment">อุปกรณ์</Label>
          <Select
            value={selectedId === null ? '' : String(selectedId)}
            onValueChange={(v) => selectEquipment(Number(v))}
          >
            <SelectTrigger id="equipment" className="w-full">
              <SelectValue placeholder="เลือกอุปกรณ์ที่ต้องการขอเลื่อน" />
            </SelectTrigger>
            <SelectContent>
              {choices.map(({ equipment: e, pending }) => (
                <SelectItem key={e.id} value={String(e.id)} disabled={pending}>
                  {e.tagNo} · {e.name}
                  {pending && ' (มีคำขอรออนุมัติ)'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {current && (
        <div className="grid grid-cols-2 gap-3 rounded-lg border p-3 text-sm">
          <div className="text-muted-foreground">ตำแหน่ง</div>
          <div>{current.location}</div>
          <div className="text-muted-foreground">Criticality</div>
          <div>
            <CriticalityBadge value={current.criticality} />
          </div>
          <div className="text-muted-foreground">กำหนดตรวจปัจจุบัน</div>
          <div className="font-medium">{formatDate(current.nextDueDate)}</div>
        </div>
      )}

      {current?.criticality === 'A' && (
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
          disabled={!current}
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
          disabled={!current}
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

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            ยกเลิก
          </Button>
        )}
        <Button type="submit" disabled={!current || submitting}>
          {submitting ? <Loader2 className="animate-spin" /> : <Send />}
          ส่งคำขอ
        </Button>
      </div>
    </form>
  )
}
