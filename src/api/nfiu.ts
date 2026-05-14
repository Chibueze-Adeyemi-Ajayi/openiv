import { apiRequest } from './client'

export type ReportType = 'STR' | 'CTR' | 'SAR' | 'ITF' | 'PEP' | 'AML_RETURN'
export type ReportStatus = 'draft' | 'pending_approval' | 'filed' | 'acknowledged' | 'rejected'
export type ReportPriority = 'low' | 'medium' | 'high'
export type ScheduleFrequency = 'monthly' | 'quarterly' | 'annually'

export interface NfiuReport {
  id: number
  reportType: ReportType
  reference: string
  title: string
  periodStart: string
  periodEnd: string
  status: ReportStatus
  priority: ReportPriority
  filingDate: string | null
  officerUserId: number | null
  officerName: string | null
  subjectName: string | null
  subjectAccount: string | null
  subjectBvn: string | null
  subjectType: 'individual' | 'corporate' | null
  subjectDob: string | null
  subjectAddress: string | null
  amountNgn: number | null
  transactionCount: number
  transactionType: string | null
  transactionDate: string | null
  linkedTransactionId: string | null
  transactionLocation: string | null
  transactionLat: number | null
  transactionLng: number | null
  transactionSenderAccount: string | null
  transactionSenderBank: string | null
  transactionRecipientName: string | null
  transactionRecipientAccount: string | null
  transactionRecipientBank: string | null
  transactionCurrency: string | null
  transactionNarration: string | null
  narrative: string | null
  filedByName: string | null
  acknowledgementRef: string | null
  rejectionReason: string | null
  createdAt: string
  submittedByUserId: number | null
  submittedByName: string | null
  submittedAt: string | null
}

export interface NfiuSchedule {
  id: number
  reportType: ReportType
  name: string
  frequency: ScheduleFrequency
  nextDue: string
  lastFiledAt: string | null
  isActive: boolean
  autoFile: boolean
  createdAt: string
}

export interface NfiuMetrics {
  totalFiled: number
  totalDraft: number
  totalAcknowledged: number
  totalRejected: number
  dueThisWeek: number
  filedThisMonth: number
}

export interface CreateReportRequest {
  reportType: ReportType
  title: string
  periodStart: string
  periodEnd: string
  priority?: ReportPriority
  officerUserId?: number
  officerName?: string
  subjectName?: string
  subjectAccount?: string
  subjectBvn?: string
  subjectType?: 'individual' | 'corporate'
  subjectDob?: string
  subjectAddress?: string
  amountNgn?: number
  transactionCount?: number
  transactionType?: string
  transactionDate?: string
  linkedTransactionId?: string
  transactionLocation?: string
  transactionLat?: number
  transactionLng?: number
  transactionSenderAccount?: string
  transactionSenderBank?: string
  transactionRecipientName?: string
  transactionRecipientAccount?: string
  transactionRecipientBank?: string
  transactionCurrency?: string
  transactionNarration?: string
  narrative?: string
}

export interface CreateScheduleRequest {
  reportType: ReportType
  name: string
  frequency: ScheduleFrequency
  nextDue: string
  autoFile?: boolean
}

export const nfiuApi = {
  getMetrics: () =>
    apiRequest<NfiuMetrics>('/api/v1/nfiu/metrics'),

  listReports: (type?: ReportType, status?: ReportStatus) => {
    const params = new URLSearchParams()
    if (type)   params.set('type', type)
    if (status) params.set('status', status)
    const qs = params.toString()
    return apiRequest<{ reports: NfiuReport[] }>(`/api/v1/nfiu/reports${qs ? '?' + qs : ''}`)
  },

  getReport: (id: number) =>
    apiRequest<NfiuReport>(`/api/v1/nfiu/reports/${id}`),

  createReport: (req: CreateReportRequest) =>
    apiRequest<NfiuReport>('/api/v1/nfiu/reports', { body: req }),

  updateReport: (id: number, req: Partial<CreateReportRequest>) =>
    apiRequest<NfiuReport>(`/api/v1/nfiu/reports/${id}`, { method: 'PATCH', body: req }),

  fileReport: (id: number) =>
    apiRequest<NfiuReport>(`/api/v1/nfiu/reports/${id}/file`, { method: 'POST', body: {} }),

  deleteReport: (id: number) =>
    apiRequest<{ ok: boolean }>(`/api/v1/nfiu/reports/${id}`, { method: 'DELETE' }),

  approveReport: (id: number) =>
    apiRequest<NfiuReport>(`/api/v1/nfiu/reports/${id}/approve`, { method: 'POST', body: {} }),

  listSchedules: () =>
    apiRequest<{ schedules: NfiuSchedule[] }>('/api/v1/nfiu/schedules'),

  createSchedule: (req: CreateScheduleRequest) =>
    apiRequest<NfiuSchedule>('/api/v1/nfiu/schedules', { body: req }),

  updateSchedule: (id: number, req: Partial<CreateScheduleRequest & { isActive: boolean }>) =>
    apiRequest<NfiuSchedule>(`/api/v1/nfiu/schedules/${id}`, { method: 'PATCH', body: req }),

  deleteSchedule: (id: number) =>
    apiRequest<{ ok: boolean }>(`/api/v1/nfiu/schedules/${id}`, { method: 'DELETE' }),
}
