import { LoadError, Loading } from '@/components/app/load-state'
import { UserSwitcher } from '@/components/app/user-switcher'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Toaster } from '@/components/ui/sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api } from '@/lib/api'
import { ROLE_LABEL } from '@/lib/format'
import { useLoad } from '@/lib/use-load'
import { EquipmentPage } from '@/pages/equipment-page'
import { PendingApprovalsPage } from '@/pages/pending-approvals-page'
import { RequestsPage } from '@/pages/requests-page'
import { SubmitRequestPage } from '@/pages/submit-request-page'
import { ClipboardCheck, ClipboardList, FilePlus, Wrench } from 'lucide-react'
import { useState } from 'react'

const USER_KEY = 'inspection.userId'

export default function App() {
  const { data: users, error } = useLoad(() => api.users(), 'users')
  const [storedId, setStoredId] = useState<number | null>(() => {
    const saved = Number(localStorage.getItem(USER_KEY))
    return Number.isInteger(saved) && saved > 0 ? saved : null
  })
  // Bumped after any change so every screen refetches.
  const [refreshKey, setRefreshKey] = useState(0)
  const refresh = () => setRefreshKey((k) => k + 1)
  const [tab, setTab] = useState('equipment')

  const user = users?.find((u) => u.id === storedId) ?? users?.[0] ?? null

  const switchUser = (id: number) => {
    localStorage.setItem(USER_KEY, String(id))
    setStoredId(id)
  }

  return (
    <div className="min-h-svh bg-muted/40">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold">ระบบขอเลื่อนกำหนดตรวจสอบอุปกรณ์</h1>
            <p className="text-sm text-muted-foreground">Equipment Inspection Deferral</p>
          </div>
          {users && user && (
            <div className="flex items-center gap-3">
              <Badge variant="secondary">{ROLE_LABEL[user.role]}</Badge>
              <UserSwitcher users={users} value={user.id} onChange={switchUser} />
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6">
        {error && <LoadError message={error} />}
        {!error && !user && <Loading />}
        {user && (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="equipment">
                <Wrench />
                รายการอุปกรณ์
              </TabsTrigger>
              <TabsTrigger value="submit">
                <FilePlus />
                ยื่นคำขอ
              </TabsTrigger>
              <TabsTrigger value="approvals">
                <ClipboardCheck />
                รออนุมัติ
              </TabsTrigger>
              <TabsTrigger value="requests">
                <ClipboardList />
                คำขอทั้งหมด
              </TabsTrigger>
            </TabsList>

            <Card className="mt-4">
              <CardContent>
                <TabsContent value="equipment">
                  <EquipmentPage
                    userId={user.id}
                    refreshKey={refreshKey}
                    onChanged={refresh}
                    onRequestNew={() => setTab('submit')}
                  />
                </TabsContent>
                <TabsContent value="submit">
                  <SubmitRequestPage
                    userId={user.id}
                    refreshKey={refreshKey}
                    onChanged={refresh}
                  />
                </TabsContent>
                <TabsContent value="approvals">
                  <PendingApprovalsPage
                    user={user}
                    refreshKey={refreshKey}
                    onChanged={refresh}
                  />
                </TabsContent>
                <TabsContent value="requests">
                  <RequestsPage userId={user.id} refreshKey={refreshKey} />
                </TabsContent>
              </CardContent>
            </Card>
          </Tabs>
        )}
      </main>

      <Toaster richColors position="top-right" />
    </div>
  )
}
