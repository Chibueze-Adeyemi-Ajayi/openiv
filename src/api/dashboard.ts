import { apiRequest } from './client'

export interface DashboardStats {
  totalToday: number
  flaggedToday: number
  totalYesterday: number
  flaggedYesterday: number
  openCases: number
}

export interface RiskPoint {
  lat: number
  lng: number
  count: number
  avgRisk: number | null
  hasFlag: boolean
}

export interface RiskMapData {
  points: RiskPoint[]
  from: string
  to: string
}

export const dashboardApi = {
  stats: () =>
    apiRequest<DashboardStats>('/api/v1/dashboard/stats'),

  riskMap: (from: string, to: string) =>
    apiRequest<RiskMapData>(`/api/v1/dashboard/risk-map?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
}
