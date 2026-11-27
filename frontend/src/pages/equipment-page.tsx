import { CriticalityBadge, DueBadge, StatusBadge } from '@/components/app/badges'
import { DeferralFormDialog } from '@/components/app/deferral-form-dialog'
import { Empty, LoadError, Loading } from '@/components/app/load-state'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { api, type Equipment } from '@/lib/api'
import { formatDate } from '@/lib/format'
import { useLoad } from '@/lib/use-load'
import { CalendarClock, FilePlus } from 'lucide-react'
import { useState } from 'react'

/** Screen 1: equipment list; each row opens the request form for that item. */
export function EquipmentPage({
  userId,
  refreshKey,
  onChanged,
  onRequestNew,
}: {
  userId: number
  refreshKey: number
  onChanged: () => void
  /** Opens the standalone request form tab. */
  onRequestNew: () => void
}) {
  const [selected, setSelected] = useState<Equipment | null>(null)
  const { data, error } = useLoad(
    () => Promise.all([api.equipment(userId), api.deferrals(userId)]),
    `${userId}:${refreshKey}`,
  )

  if (error) return <LoadError message={error} />
  if (!data) return <Loading />

  const [equipment, deferrals] = data
  if (equipment.length === 0) return <Empty>ไม่มีอุปกรณ์</Empty>

  // Only one pending request per equipment is allowed (server enforces it).
  const pendingIds = new Set(
    deferrals.filter((d) => d.status === 'pending').map((d) => d.equipmentId),
  )

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          กด <span className="font-medium text-foreground">ยื่นคำขอ</span> ท้ายแถว
          หรือปุ่มด้านขวาเพื่อขอเลื่อนกำหนดตรวจสอบ
        </p>
        <Button onClick={onRequestNew}>
          <FilePlus />
          ยื่นคำขอเลื่อนกำหนดตรวจ
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>รหัส</TableHead>
            <TableHead>ชื่ออุปกรณ์</TableHead>
            <TableHead>ตำแหน่งติดตั้ง</TableHead>
            <TableHead>Criticality</TableHead>
            <TableHead>กำหนดตรวจครั้งถัดไป</TableHead>
            <TableHead className="text-right" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {equipment.map((e) => (
            <TableRow key={e.id}>
              <TableCell className="font-mono font-medium">{e.tagNo}</TableCell>
              <TableCell>{e.name}</TableCell>
              <TableCell className="text-muted-foreground">{e.location}</TableCell>
              <TableCell>
                <CriticalityBadge value={e.criticality} />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {formatDate(e.nextDueDate)}
                  <DueBadge date={e.nextDueDate} />
                </div>
              </TableCell>
              <TableCell className="text-right">
                {pendingIds.has(e.id) ? (
                  <StatusBadge value="pending" />
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setSelected(e)}>
                    <CalendarClock />
                    ยื่นคำขอ
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <DeferralFormDialog
        equipment={selected}
        userId={userId}
        onClose={() => setSelected(null)}
        onSubmitted={() => {
          setSelected(null)
          onChanged()
        }}
      />
    </>
  )
}
