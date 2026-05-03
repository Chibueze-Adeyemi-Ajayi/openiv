import { apiRequest } from './client'

export interface UserHeatmapResponse {
  behavioral: number[][]
  transactions: number[][]
}

export const analyticsApi = {
  getUserHeatmap: (userId: string, range?: string) =>
    apiRequest<UserHeatmapResponse>(`/api/v1/analytics/users/${encodeURIComponent(userId)}/heatmap?range=${range || '90d'}`),
}
