import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { AppUser } from '@/lib/api'
import { ROLE_LABEL } from '@/lib/format'
import { UserRound } from 'lucide-react'

/** Stand-in for login: picks which app_user the X-User-Id header sends. */
export function UserSwitcher({
  users,
  value,
  onChange,
}: {
  users: AppUser[]
  value: number | null
  onChange: (userId: number) => void
}) {
  return (
    <Select
      value={value === null ? undefined : String(value)}
      onValueChange={(v) => onChange(Number(v))}
    >
      <SelectTrigger className="w-72" aria-label="เลือกผู้ใช้">
        <UserRound />
        <SelectValue placeholder="เลือกผู้ใช้" />
      </SelectTrigger>
      <SelectContent>
        {users.map((u) => (
          <SelectItem key={u.id} value={String(u.id)}>
            {u.fullName} · {ROLE_LABEL[u.role]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
