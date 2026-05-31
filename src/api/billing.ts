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

// ── Subscription ─────────────────────────────────────────────────────────────

export type PlanSlug = 'starter' | 'growth' | 'scale' | 'enterprise'

export interface SubscriptionPlan {
  id: string
  name: string
  slug: PlanSlug
  monthlyPriceNgn: number
  maxUsers: number                   // -1 = unlimited
  maxMonthlyTransactions: number     // -1 = unlimited
  maxActiveCases: number             // -1 = unlimited
  apiRateLimitPerMin: number
  includedTransactionUnits: number
  features: string[]
  sortOrder: number
  featureKycEnabled: boolean
  featureWebhooksEnabled: boolean
  featureNetworkEnabled: boolean
  featureBehavioralEnabled: boolean
  featureReportsExport: boolean
  maxAmlRules: number
  maxMonthlyKycLookups: number        // -1 = unlimited
  maxMonthlyNfiuFilings: number       // -1 = unlimited
  maxMonthlyCases: number             // -1 = unlimited
}

export interface InstitutionSubscription {
  plan: SubscriptionPlan
  status: 'trial' | 'active' | 'past_due' | 'cancelled'
  startsAt: string | null
  trialEndsAt: string | null
  renewsAt: string | null
}

export interface ActiveDiscount {
  discountPercent: number
  couponCode: string
  couponExpiresAt: string
  amountNgn: number
  discountedAmountNgn: number
}

export interface InitiatePaymentResult {
  invoiceId: string
  reference: string
  accessCode: string | null   // null = dev mode, use authorizationUrl fallback
  authorizationUrl: string
  amountNgn: number
  discountedAmountNgn: number
  discountPercent: number
  invoiceType: string
}

export const subscriptionApi = {
  listPlans: () =>
    apiRequest<{ plans: SubscriptionPlan[] }>('/api/v1/subscription/plans'),

  getCurrent: () =>
    apiRequest<InstitutionSubscription>('/api/v1/subscription/current'),

  upgrade: (planId: string) =>
    apiRequest<{ ok: boolean }>('/api/v1/subscription/upgrade', {
      method: 'POST',
      body: { planId },
    }),

  initiatePayment: (planId: string, couponCode?: string) =>
    apiRequest<InitiatePaymentResult>('/api/v1/subscription/initiate', {
      method: 'POST',
      body: { planId, couponCode },
    }),

  verifyPayment: (reference: string) =>
    apiRequest<{ ok: boolean; planId: string }>('/api/v1/subscription/verify', {
      method: 'POST',
      body: { reference },
    }),

  getActiveDiscount: () =>
    apiRequest<ActiveDiscount | null>('/api/v1/subscription/active-discount'),
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
