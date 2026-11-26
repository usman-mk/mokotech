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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { api, ApiError, type DeferralRequest } from '@/lib/api'
import { formatDate } from '@/lib/format'
import { Check, CircleAlert, Loader2, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'

export type Decision = 'approve' | 'reject'

/** Approve (note optional) or reject (note required) one request. */
export function DecisionDialog({
  request,
  decision,
  userId,
  onClose,
  onDecided,
}: {
  request: DeferralRequest
  decision: Decision
  userId: number
  onClose: () => void
  onDecided: () => void
}) {
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const approving = decision === 'approve'
  const tag = request.equipment.tagNo

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      if (approving) {
        await api.approve(userId, request.id, note.trim() || undefined)
        toast.success(
          `อนุมัติ ${tag} แล้ว — กำหนดตรวจใหม่ ${formatDate(request.requestedDueDate)}`,
        )
      } else {
        await api.reject(userId, request.id, note)
        toast.success(`ปฏิเสธคำขอ ${tag} แล้ว`)
      }
      onDecided()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{approving ? 'อนุมัติคำขอ' : 'ปฏิเสธคำขอ'}</DialogTitle>
            <DialogDescription>
              {tag}: {formatDate(request.previousDueDate)} →{' '}
              {formatDate(request.requestedDueDate)}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <Label htmlFor="note">
              {approving ? 'หมายเหตุ (ไม่บังคับ)' : 'เหตุผลที่ปฏิเสธ'}
            </Label>
            <Textarea
              id="note"
              required={!approving}
              maxLength={1000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertTitle>ทำรายการไม่สำเร็จ</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              ยกเลิก
            </Button>
            <Button
              type="submit"
              variant={approving ? 'default' : 'destructive'}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="animate-spin" />
              ) : approving ? (
                <Check />
              ) : (
                <X />
              )}
              {approving ? 'อนุมัติ' : 'ปฏิเสธ'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
