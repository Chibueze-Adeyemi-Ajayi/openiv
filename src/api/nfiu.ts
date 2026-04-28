import { apiRequest } from './client'

export type ReportType = 'STR' | 'CTR' | 'SAR' | 'ITF' | 'PEP' | 'AML_RETURN'
export type ReportStatus = 'draft' | 'filed' | 'acknowledged' | 'rejected'
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
  subjectName: string | null
  subjectAccount: string | null
  subjectBvn: string | null
  subjectType: 'individual' | 'corporate' | null
  amountNgn: number | null
  transactionCount: number
  narrative: string | null
  filedByName: string | null
  acknowledgementRef: string | null
  rejectionReason: string | null
  createdAt: string
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
  subjectName?: string
  subjectAccount?: string
  subjectBvn?: string
  subjectType?: 'individual' | 'corporate'
  amountNgn?: number
  transactionCount?: number
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

  listSchedules: () =>
    apiRequest<{ schedules: NfiuSchedule[] }>('/api/v1/nfiu/schedules'),

  createSchedule: (req: CreateScheduleRequest) =>
    apiRequest<NfiuSchedule>('/api/v1/nfiu/schedules', { body: req }),

  updateSchedule: (id: number, req: Partial<CreateScheduleRequest & { isActive: boolean }>) =>
    apiRequest<NfiuSchedule>(`/api/v1/nfiu/schedules/${id}`, { method: 'PATCH', body: req }),

  deleteSchedule: (id: number) =>
    apiRequest<{ ok: boolean }>(`/api/v1/nfiu/schedules/${id}`, { method: 'DELETE' }),
}
