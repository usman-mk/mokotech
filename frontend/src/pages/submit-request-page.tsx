import { DeferralForm } from '@/components/app/deferral-form'
import { LoadError, Loading } from '@/components/app/load-state'
import { api } from '@/lib/api'
import { useLoad } from '@/lib/use-load'

/** Screen 2: the deferral request form on its own (pick any equipment). */
export function SubmitRequestPage({
  userId,
  refreshKey,
  onChanged,
}: {
  userId: number
  refreshKey: number
  onChanged: () => void
}) {
  const { data, error } = useLoad(
    () => Promise.all([api.equipment(userId), api.deferrals(userId)]),
    `${userId}:${refreshKey}`,
  )

  if (error) return <LoadError message={error} />
  if (!data) return <Loading />

  const [equipment, deferrals] = data
  const pendingIds = new Set(
    deferrals.filter((d) => d.status === 'pending').map((d) => d.equipmentId),
  )

  return (
    <div className="mx-auto grid max-w-xl gap-4 py-2">
      <div>
        <h2 className="text-base font-semibold">ยื่นคำขอเลื่อนกำหนดตรวจสอบ</h2>
        <p className="text-sm text-muted-foreground">
          เลือกอุปกรณ์ ระบุวันที่ใหม่และเหตุผล — ระบบจะส่งคำขอให้ผู้มีอำนาจอนุมัติตามนโยบายหมวด 4.2
        </p>
      </div>
      <DeferralForm
        key={userId}
        userId={userId}
        choices={equipment.map((e) => ({ equipment: e, pending: pendingIds.has(e.id) }))}
        onSubmitted={onChanged}
      />
    </div>
  )
}
