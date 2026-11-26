// Thin client for the NestJS API. Every request carries X-User-Id (the brief
// asks for no login: the backend reads the role from app_user).

export type UserRole = 'requester' | 'supervisor' | 'department_manager'
export type ApproverRole = 'supervisor' | 'department_manager'
export type Criticality = 'A' | 'B' | 'C'
export type DeferralStatus = 'pending' | 'approved' | 'rejected'

export interface AppUser {
  id: number
  username: string
  fullName: string
  role: UserRole
}

export interface Equipment {
  id: number
  tagNo: string
  name: string
  location: string
  criticality: Criticality
  nextDueDate: string // YYYY-MM-DD
}

export interface DeferralRequest {
  id: number
  equipmentId: number
  equipment: Equipment
  requestedById: number
  requestedBy: AppUser
  previousDueDate: string
  cycleBaseDueDate: string
  requestedDueDate: string
  reason: string
  status: DeferralStatus
  requiredApproverRole: ApproverRole
  policyNote: string | null
  decidedById: number | null
  decidedBy: AppUser | null
  decidedAt: string | null
  decisionNote: string | null
  createdAt: string
}

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

/** Error with the HTTP status and the server's message (Nest error body). */
export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(
  path: string,
  userId: number | null,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const headers: Record<string, string> = {}
  if (userId !== null) headers['X-User-Id'] = String(userId)
  if (init.body !== undefined) headers['Content-Type'] = 'application/json'

  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: init.method ?? 'GET',
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    })
  } catch {
    throw new ApiError(0, `เชื่อมต่อ API ไม่ได้ (${API_URL}) — backend รันอยู่หรือไม่?`)
  }

  const data: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    // ValidationPipe sends message as string[]; other errors as string.
    const message = (data as { message?: string | string[] } | null)?.message
    throw new ApiError(
      response.status,
      Array.isArray(message) ? message.join(', ') : (message ?? response.statusText),
    )
  }
  return data as T
}

export const api = {
  users: () => request<AppUser[]>('/users', null),
  equipment: (userId: number) => request<Equipment[]>('/equipment', userId),
  deferrals: (userId: number) =>
    request<DeferralRequest[]>('/deferral-requests', userId),
  pendingApprovals: (userId: number) =>
    request<DeferralRequest[]>('/deferral-requests/pending-approvals', userId),
  submitDeferral: (
    userId: number,
    body: { equipmentId: number; requestedDueDate: string; reason: string },
  ) =>
    request<DeferralRequest>('/deferral-requests', userId, {
      method: 'POST',
      body,
    }),
  approve: (userId: number, id: number, note?: string) =>
    request<DeferralRequest>(`/deferral-requests/${id}/approve`, userId, {
      method: 'POST',
      body: note ? { note } : {},
    }),
  reject: (userId: number, id: number, note: string) =>
    request<DeferralRequest>(`/deferral-requests/${id}/reject`, userId, {
      method: 'POST',
      body: { note },
    }),
}
