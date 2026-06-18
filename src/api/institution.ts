import { apiRequest } from './client'

export type InstitutionIndustry =
  | 'commercial_bank'
  | 'microfinance_bank'
  | 'fintech_psb'
  | 'crypto_exchange'
  | 'digital_assets'
  | 'insurance'
  | 'investment_securities'
  | 'mortgage_bank'
  | 'bureau_de_change'
  | 'other'

export const INDUSTRY_OPTIONS: { value: InstitutionIndustry; label: string }[] = [
  { value: 'commercial_bank',      label: 'Commercial Bank' },
  { value: 'microfinance_bank',    label: 'Microfinance Bank (MFB)' },
  { value: 'fintech_psb',          label: 'Fintech / Payment Service Bank' },
  { value: 'crypto_exchange',      label: 'Crypto Exchange' },
  { value: 'digital_assets',       label: 'Digital Assets / DeFi' },
  { value: 'insurance',            label: 'Insurance' },
  { value: 'investment_securities',label: 'Investment & Securities' },
  { value: 'mortgage_bank',        label: 'Mortgage Bank' },
  { value: 'bureau_de_change',     label: 'Bureau de Change (BDC)' },
  { value: 'other',                label: 'Other Financial Services' },
]

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
  logoUrl: string | null
  industry: InstitutionIndustry | null
}

export interface UpdateProfileRequest {
  cbnCode?: string
  address?: string
  contactPhone?: string
  industry?: string
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

  uploadLogo: async (file: File): Promise<{ logoUrl: string }> => {
    const fd = new FormData()
    fd.append('logo', file)
    const res = await fetch('/api/v1/institution/logo', {
      method: 'POST',
      credentials: 'include',
      body: fd,
    })
    if (!res.ok) throw new Error(`Logo upload failed: ${res.status}`)
    return res.json()
  },
}
