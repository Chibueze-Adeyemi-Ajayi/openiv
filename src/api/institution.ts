import { apiRequest } from './client'

export interface InstitutionProfile {
  id: number
  name: string
  type: string
  status: string
  cbnCode: string | null
  address: string | null
  contactPhone: string | null
  officialStamp: string | null
  officialSignature: string | null
}

export interface UpdateProfileRequest {
  cbnCode?: string
  address?: string
  contactPhone?: string
}

export interface SigningCredentials {
  officialStamp: string | null
  officialSignature: string | null
}

export const institutionApi = {
  getProfile: () =>
    apiRequest<InstitutionProfile>('/api/v1/institution/profile'),

  updateProfile: (req: UpdateProfileRequest) =>
    apiRequest<InstitutionProfile>('/api/v1/institution/profile', { method: 'PATCH', body: req }),

  getSigningCredentials: () =>
    apiRequest<SigningCredentials>('/api/v1/institution/signing-credentials'),

  updateSigningCredentials: (req: Partial<SigningCredentials>) =>
    apiRequest<InstitutionProfile>('/api/v1/institution/signing-credentials', { method: 'PATCH', body: req }),
}
