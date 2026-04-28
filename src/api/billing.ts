import { apiRequest } from './client'

export interface BillingSummary {
  balanceUnits: number
  balanceNgn: number
  creditExpiresAt: string | null
}

export interface LedgerEntry {
  dayStr: string
  type: 'credit' | 'debit'
  totalAmountUnits: number
  endingBalanceUnits: number
  eventCount: number
  lastRef: string | null
}

export interface PaymentMethod {
  id: number
  provider: string
  type: string
  displayName: string
  last4: string | null
  isDefault: boolean
  createdAt: string
}

export interface BillingConfig {
  paystackPublicKey: string
}

export interface InitializePaymentResponse {
  accessCode: string
  reference: string
  authorizationUrl: string
}

export interface VerifyPaymentResponse {
  balanceNgn: number
  cardSaved: boolean
  paymentMethod?: {
    id: number
    displayName: string
    last4: string | null
    type: string
  }
}

export interface TopupResponse {
  balanceNgn: number
  reference: string
}

export interface CategoryUsage {
  category: 'beam_ingest' | 'kyc_lookup' | 'webhook_delivery' | string
  eventCount: number
  totalAmountUnits: number
  rateUnitsEach: number
}

export interface CardChargeRequest {
  cardNumber: string
  cvv: string
  expiryMonth: string
  expiryYear: string
  amountNgn: number
  email: string
  saveCard: boolean
}

export interface CardChallengeRequest {
  reference: string
  type: 'pin' | 'otp'
  value: string
  amountNgn: number
  email: string
  saveCard: boolean
}

export interface CardChargeResponse {
  status: 'success' | 'send_pin' | 'send_otp' | 'open_url'
  reference?: string
  displayText?: string
  balanceNgn?: number
  cardSaved?: boolean
  paymentMethod?: { id: number; displayName: string; last4: string | null; type: string }
}

export interface BillingUsageSummary {
  periodStart: string       // "2026-04-01"
  periodEnd: string         // "2026-04-30"
  dayOfPeriod: number
  daysInPeriod: number
  totalDebitUnits: number
  creditExpiresAt: string | null
  isInFreePeriod: boolean
  categories: CategoryUsage[]
}

export const billingApi = {
  getConfig: () =>
    apiRequest<BillingConfig>('/api/v1/billing/config'),

  getSummary: () =>
    apiRequest<BillingSummary>('/api/v1/billing/summary'),

  getUsage: () =>
    apiRequest<BillingUsageSummary>('/api/v1/billing/usage'),

  getLedger: () =>
    apiRequest<{ entries: LedgerEntry[] }>('/api/v1/billing/ledger'),

  listPaymentMethods: () =>
    apiRequest<{ paymentMethods: PaymentMethod[] }>('/api/v1/billing/payment-methods'),

  deletePaymentMethod: (id: number) =>
    apiRequest<{ ok: boolean }>(`/api/v1/billing/payment-methods/${id}`, { method: 'DELETE' }),

  initializePayment: (amountNgn: number, email: string) =>
    apiRequest<InitializePaymentResponse>('/api/v1/billing/payment/initialize', {
      body: { amountNgn, email },
    }),

  verifyPayment: (reference: string, saveCard: boolean) =>
    apiRequest<VerifyPaymentResponse>('/api/v1/billing/payment/verify', {
      body: { reference, saveCard },
    }),

  topup: (paymentMethodId: number, amountNgn: number, email: string) =>
    apiRequest<TopupResponse>('/api/v1/billing/topup', {
      body: { paymentMethodId, amountNgn, email },
    }),

  chargeCard: (req: CardChargeRequest) =>
    apiRequest<CardChargeResponse>('/api/v1/billing/card/charge', { body: req }),

  submitChallenge: (req: CardChallengeRequest) =>
    apiRequest<CardChargeResponse>('/api/v1/billing/card/challenge', { body: req }),
}
