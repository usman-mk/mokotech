import { ApproverBadge, StatusBadge } from '@/components/app/badges'
import { Empty, LoadError, Loading } from '@/components/app/load-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { api } from '@/lib/api'
import { formatDate, formatDateTime } from '@/lib/format'
import { useLoad } from '@/lib/use-load'

/** All requests and their outcome, newest first (so requesters see results). */
export function RequestsPage({
  userId,
  refreshKey,
}: {
  userId: number
  refreshKey: number
}) {
  const { data, error } = useLoad(
    () => api.deferrals(userId),
    `${userId}:${refreshKey}`,
  )

  if (error) return <LoadError message={error} />
  if (!data) return <Loading />
  if (data.length === 0) return <Empty>ยังไม่มีคำขอ</Empty>

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>สถานะ</TableHead>
          <TableHead>อุปกรณ์</TableHead>
          <TableHead>กำหนดเดิม → ใหม่</TableHead>
          <TableHead>ผู้ยื่น</TableHead>
          <TableHead>ผู้มีอำนาจอนุมัติ</TableHead>
          <TableHead>ผลการพิจารณา</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((r) => (
          <TableRow key={r.id} className="align-top">
            <TableCell>
              <StatusBadge value={r.status} />
            </TableCell>
            <TableCell className="font-mono font-medium">{r.equipment.tagNo}</TableCell>
            <TableCell className="whitespace-nowrap">
              {formatDate(r.previousDueDate)} → {formatDate(r.requestedDueDate)}
            </TableCell>
            <TableCell>
              {r.requestedBy.fullName}
              <div className="max-w-64 whitespace-normal text-xs text-muted-foreground">
                {r.reason}
              </div>
            </TableCell>
            <TableCell>
              <ApproverBadge value={r.requiredApproverRole} />
            </TableCell>
            <TableCell className="max-w-64 whitespace-normal">
              {r.decidedBy ? (
                <>
                  {r.decidedBy.fullName}
                  <span className="text-xs text-muted-foreground">
                    {' '}
                    · {formatDateTime(r.decidedAt!)}
                  </span>
                  {r.decisionNote && (
                    <div className="text-xs text-muted-foreground">{r.decisionNote}</div>
                  )}
                </>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
