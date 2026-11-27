import { DeferralForm } from '@/components/app/deferral-form'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { Equipment } from '@/lib/api'

/** Shortcut from an equipment row: the request form for that equipment. */
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
  if (!equipment) return null

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>ยื่นคำขอเลื่อนกำหนดตรวจสอบ</DialogTitle>
          <DialogDescription>
            {equipment.tagNo} · {equipment.name}
          </DialogDescription>
        </DialogHeader>
        <DeferralForm
          userId={userId}
          equipment={equipment}
          onSubmitted={onSubmitted}
          onCancel={onClose}
        />
      </DialogContent>
    </Dialog>
  )
}
