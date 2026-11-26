import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { CircleAlert, Inbox, Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'

export function Loading() {
  return (
    <div className="flex items-center gap-2 py-10 text-muted-foreground">
      <Loader2 className="size-4 animate-spin" /> กำลังโหลด…
    </div>
  )
}

export function LoadError({ message }: { message: string }) {
  return (
    <Alert variant="destructive">
      <CircleAlert />
      <AlertTitle>โหลดข้อมูลไม่สำเร็จ</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
      <Inbox className="size-8" />
      {children}
    </div>
  )
}
