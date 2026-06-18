import { apiRequest, BASE_URL as API_BASE } from './client'

export type RuleStatus =
  | 'draft'
  | 'pending_approval'         // legacy
  | 'pending_dev_review'
  | 'pending_cco_approval'
  | 'pending_it_vetting'
  | 'active'
  | 'retired'

export interface RuleActions {
  holdTransaction: boolean
  openCase:        { enabled: boolean; severity: 'low' | 'medium' | 'high' | 'critical' }
  fileReport:      { enabled: boolean; reportType: 'STR' | 'CTR' | 'SAR' }
  notifyRoles:     string[]
}

export interface RuleComprehension {
  summary:    string
  conditions: { field: string; op: string; value: string | number | boolean }[]
  logic:      'AND' | 'OR'
}

export interface TestScenario {
  label: string
  txn: {
    amount:          number
    currency?:       string
    type?:           string
    recipientId?:    string
    channel?:        string
    timestamp?:      number
  }
  customer: {
    accountAgeDays?: number
    riskScore?:      number
    tier?:           string
    totalTxnCount?:  number
    kycLevel?:       string
  }
  context: {
    recipientFirstTime?: boolean
    ipCountryCode?:      string
    deviceId?:           string
  }
}

export interface TestResult {
  label:     string
  triggered: boolean
  reason:    string
}

export interface RuleTemplate {
  category:     string
  tag:          string
  name:         string
  policy:       string
  ruleType:     'person' | 'location' | 'timing' | 'series' | 'composite'
  needsHistory: boolean
  priority:     'critical' | 'high' | 'medium'
  cbkRef:       string | null
  dataGaps:     string[]
}

export interface InstitutionRule {
  id:              number
  name:            string
  policyStatement: string
  comprehension:   RuleComprehension | null
  functionSource:  string | null
  devEditedSource: string | null
  devReviewedBy:   string | null
  reviewNote:      string | null
  itVettedBy:      string | null
  testResults:     { results: TestResult[] } | null
  actions:         RuleActions
  status:          RuleStatus
  createdBy:       string | null
  approvedBy:      string | null
  createdAt:       string
  updatedAt:       string
}

export const defaultActions = (): RuleActions => ({
  holdTransaction: true,
  openCase:        { enabled: false, severity: 'medium' },
  fileReport:      { enabled: false, reportType: 'STR' },
  notifyRoles:     [],
})

export const DEFAULT_TEST_SCENARIOS: TestScenario[] = [
  {
    label: 'Normal small transfer',
    txn:      { amount: 50_000, currency: 'NGN', type: 'transfer', channel: 'mobile' },
    customer: { accountAgeDays: 365, riskScore: 10, tier: 'tier2', totalTxnCount: 200 },
    context:  { recipientFirstTime: false, ipCountryCode: 'NG' },
  },
  {
    label: 'Large amount — new account — first-time recipient',
    txn:      { amount: 60_000_000, currency: 'NGN', type: 'transfer', channel: 'web' },
    customer: { accountAgeDays: 5, riskScore: 75, tier: 'tier1', totalTxnCount: 3 },
    context:  { recipientFirstTime: true, ipCountryCode: 'NG' },
  },
  {
    label: 'High-risk customer, overseas IP',
    txn:      { amount: 25_000_000, currency: 'NGN', type: 'transfer', channel: 'ussd' },
    customer: { accountAgeDays: 90, riskScore: 90, tier: 'tier1', totalTxnCount: 45 },
    context:  { recipientFirstTime: false, ipCountryCode: 'KP' },
  },
]

async function* _sseStream(
  url: string,
  body: object | null,
  signal?: AbortSignal,
): AsyncGenerator<{ event: string; data: string }> {
  const isPost = body !== null
  const res = await fetch(url, {
    method: isPost ? 'POST' : 'GET',
    headers: isPost
      ? { 'Content-Type': 'application/json', Accept: 'text/event-stream' }
      : { Accept: 'text/event-stream' },
    credentials: 'include',
    body: isPost ? JSON.stringify(body) : undefined,
    signal,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as Record<string, string>).error ?? `HTTP ${res.status}`)
  }
  const reader  = res.body!.getReader()
  const decoder = new TextDecoder()
  let buf   = ''
  let event = 'message'
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop()!
      for (const line of lines) {
        if (line.startsWith('event: '))      { event = line.slice(7).trim(); continue }
        if (line.startsWith('data: '))       { yield { event, data: line.slice(6) }; event = 'message' }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

export const institutionRuleApi = {
  list: () =>
    apiRequest<{ rules: InstitutionRule[] }>('/api/v1/nomos/rules'),

  get: (id: number) =>
    apiRequest<{ rule: InstitutionRule }>(`/api/v1/nomos/rules/${id}`),

  create: (name: string, policyStatement: string,
           comprehension?: RuleComprehension, functionSource?: string) =>
    apiRequest<{ rule: InstitutionRule }>('/api/v1/nomos/rules', {
      method: 'POST',
      body: { name, policyStatement, comprehension, functionSource },
    }),

  delete: (id: number) =>
    apiRequest<{ ok: boolean }>(`/api/v1/nomos/rules/${id}`, { method: 'DELETE' }),

  reprocessDraft: (id: number, name: string, policyStatement: string,
                   comprehension: RuleComprehension, functionSource: string) =>
    apiRequest<{ rule: InstitutionRule }>(`/api/v1/nomos/rules/${id}/reprocess`, {
      method: 'POST',
      body: { name, policyStatement, comprehension, functionSource },
    }),

  comprehendStream: (policy: string, signal?: AbortSignal) =>
    _sseStream(`${API_BASE}/api/v1/nomos/comprehend`, { policy }, signal),

  generateStream: (comprehension: RuleComprehension, signal?: AbortSignal) =>
    _sseStream(`${API_BASE}/api/v1/nomos/generate`, { comprehension }, signal),

  updateActions: (id: number, actions: RuleActions) =>
    apiRequest<{ ok: boolean }>(`/api/v1/nomos/rules/${id}/actions`, {
      method: 'PATCH',
      body: actions,
    }),

  // ── Workflow ───────────────────────────────────────────────────────────────

  submitForDevReview: (id: number) =>
    apiRequest<{ ok: boolean }>(`/api/v1/nomos/rules/${id}/submit-for-review`, { method: 'POST' }),

  devAccept: (id: number) =>
    apiRequest<{ ok: boolean }>(`/api/v1/nomos/rules/${id}/dev-accept`, { method: 'POST' }),

  devSubmit: (id: number, editedSource: string, note: string) =>
    apiRequest<{ ok: boolean }>(`/api/v1/nomos/rules/${id}/dev-submit`, {
      method: 'POST',
      body: { editedSource, note },
    }),

  ccoApproveEdits: (id: number) =>
    apiRequest<{ ok: boolean }>(`/api/v1/nomos/rules/${id}/cco-approve-edits`, { method: 'POST' }),

  ccoRejectEdits: (id: number, note: string) =>
    apiRequest<{ ok: boolean }>(`/api/v1/nomos/rules/${id}/cco-reject-edits`, {
      method: 'POST',
      body: { note },
    }),

  runTests: (id: number, scenarios: TestScenario[]) =>
    apiRequest<{ results: TestResult[] }>(`/api/v1/nomos/rules/${id}/test`, {
      method: 'POST',
      body: { scenarios },
    }),

  deploy: (id: number) =>
    apiRequest<{ ok: boolean }>(`/api/v1/nomos/rules/${id}/deploy`, { method: 'POST' }),

  approve: (id: number) =>
    apiRequest<{ ok: boolean }>(`/api/v1/nomos/rules/${id}/approve`, { method: 'POST' }),

  retire: (id: number) =>
    apiRequest<{ ok: boolean }>(`/api/v1/nomos/rules/${id}/retire`, { method: 'POST' }),

  /** AI-generated rule templates based on current CBN regulations + institution's existing rules.
   *  Uses SSE so keepalive pings prevent the 30 s idle-connection timeout on long AI calls. */
  suggestTemplates: (): Promise<{ templates: RuleTemplate[] }> =>
    new Promise((resolve, reject) => {
      const ac = new AbortController()
      ;(async () => {
        try {
          for await (const { event, data } of _sseStream(
            `${API_BASE}/api/v1/nomos/templates`, null, ac.signal,
          )) {
            if (event === 'templates') {
              resolve(JSON.parse(data) as { templates: RuleTemplate[] })
              ac.abort(); return
            }
            if (event === 'error') {
              const msg = (JSON.parse(data) as { message?: string }).message ?? 'Failed to load templates'
              reject(new Error(msg))
              ac.abort(); return
            }
            // 'keepalive' events are intentionally ignored
          }
          reject(new Error('Stream closed without templates'))
        } catch (e) {
          if ((e as DOMException).name !== 'AbortError') reject(e as Error)
        }
      })()
    }),

  /** Create multiple rules as drafts in one call. */
  createBatch: (rules: { name: string; policyStatement: string }[]) =>
    apiRequest<{ created: number; rules: InstitutionRule[] }>('/api/v1/nomos/rules/batch', {
      method: 'POST',
      body: { rules },
    }),

}

// Auto-complete template phrases for rule authoring (zero-latency, client-side)
export const RULE_COMPLETIONS: string[] = [
  'Flag transactions where amount exceeds ₦',
  'Flag transfers to first-time recipients from accounts under ',
  'Hold transactions where the same device is used by more than ',
  'Alert when a customer makes more than ',
  'Flag outbound transfers between midnight and 4am exceeding ₦',
  'Hold transactions where recipient account was created less than ',
  'Flag when cumulative daily outflow exceeds ₦',
  'Alert on transfers to accounts in high-risk states',
  'Flag when transaction amount is exactly ₦',
  'Hold all transactions above KYC tier limit for unverified customers',
  "Flag when a customer's risk score exceeds ",
  'Alert when BVN mismatch is detected on a transaction above ₦',
  'Flag rapid successive transfers within ',
  'Hold transactions where sender IP country differs from registration country',
  'Alert when monthly transaction volume exceeds ',
]
