import { apiRequest } from './client'

export type HeatmapMode = 'normal' | 'abnormal'

export interface HeatmapDayCell {
  date: string        // ISO-8601: "2024-03-15"
  count: number
  avgRisk: number | null
}

export interface HeatmapData {
  cells: HeatmapDayCell[]
  totalCount: number
  from: string        // ISO-8601 start date
  to: string          // ISO-8601 end date
}

export const heatmapApi = {
  transactions: (mode: HeatmapMode = 'normal', from: string, to: string) =>
    apiRequest<HeatmapData>(`/api/v1/heatmap/transactions?mode=${mode}&from=${from}&to=${to}`),

  activity: (mode: HeatmapMode = 'normal', from: string, to: string) =>
    apiRequest<HeatmapData>(`/api/v1/heatmap/activity?mode=${mode}&from=${from}&to=${to}`),
}
