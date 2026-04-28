import { apiRequest } from './client'

export interface GeoPoint { lat: number; lng: number }

export interface GeoFenceConfig {
  enabled:       boolean
  polygon:       GeoPoint[]
  calLatOffset:  number
  calLngOffset:  number
  updatedAt?:    string
}

export interface GeoFencedUser {
  userId:   number
  addedBy?: number
  addedAt?: string
}

export interface GeoAccessRequest {
  id:           number
  userId:       number
  userEmail:    string
  userFullName: string | null
  rawLat:       number | null
  rawLng:       number | null
  ip:           string | null
  userAgent:    string | null
  deviceId:     string | null
  status:       'pending' | 'approved' | 'rejected'
  expiresAt:    string | null
  createdAt:    string
}

export const geoFenceApi = {
  getConfig: () =>
    apiRequest<GeoFenceConfig>('/api/v1/settings/geo-fence'),

  saveConfig: (payload: GeoFenceConfig & { totpCode: string }) =>
    apiRequest<GeoFenceConfig>('/api/v1/settings/geo-fence', {
      method: 'PUT',
      body: payload,
    }),

  listFencedUsers: () =>
    apiRequest<{ users: GeoFencedUser[] }>('/api/v1/settings/geo-fence/users'),

  addFencedUser: (userId: number) =>
    apiRequest<{ ok: boolean }>('/api/v1/settings/geo-fence/users', {
      body: { userId: String(userId) },
    }),

  removeFencedUser: (userId: number) =>
    apiRequest<{ ok: boolean }>(`/api/v1/settings/geo-fence/users/${userId}`, {
      method: 'DELETE',
    }),

  listPendingRequests: () =>
    apiRequest<{ requests: GeoAccessRequest[] }>('/api/v1/geo-access/requests'),

  reviewRequest: (id: number, status: 'approved' | 'rejected', totpCode: string) =>
    apiRequest<{ ok: boolean }>(`/api/v1/geo-access/requests/${id}`, {
      method: 'PATCH',
      body: { status, totpCode },
    }),
}
