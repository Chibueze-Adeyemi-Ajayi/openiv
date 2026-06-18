import { apiRequest } from './client'

export type PipelineLogic  = 'AND' | 'OR'
export type PipelineStatus = 'active' | 'inactive'
export type RuleOp = 'GT' | 'LT' | 'GTE' | 'LTE' | 'EQ' | 'NEQ' | 'CONTAINS' | 'NOT_CONTAINS' | 'IN' | 'NOT_IN'

export interface MonitoringRule {
  id:         number
  pipelineId: number
  name:       string
  field:      string
  op:         RuleOp
  value:      string
  policy:     string | null
  code:       string | null
  enabled:    boolean
  position:   number
  createdAt:  string
  updatedAt:  string
}

export interface MonitoringPipeline {
  id:          number
  name:        string
  description: string | null
  logic:       PipelineLogic
  status:      PipelineStatus
  createdBy:   string | null
  rules:       MonitoringRule[]
  createdAt:   string
  updatedAt:   string
}

// ── Field catalog ─────────────────────────────────────────────────────────────

export type FieldType = 'number' | 'string' | 'boolean'
export type FieldNamespace = 'transaction' | 'customer' | 'context'

export interface FieldMeta {
  label:       string
  type:        FieldType
  namespace:   FieldNamespace
  description: string
  enum?:       string[]
  range?:      string
  unit?:       string
  example:     string | number | boolean
}

export const FIELD_META: Record<string, FieldMeta> = {
  'txn.amount':        { label: 'Amount',              type: 'number',  namespace: 'transaction', description: 'Transaction amount in Naira (₦)', unit: 'NGN', example: 1_500_000 },
  'txn.type':          { label: 'Type',                type: 'string',  namespace: 'transaction', description: 'Transaction type', enum: ['transfer','payment','withdrawal','deposit','purchase'], example: 'transfer' },
  'txn.channel':       { label: 'Channel',             type: 'string',  namespace: 'transaction', description: 'Originating channel', enum: ['mobile','web','ussd','atm','pos','branch'], example: 'mobile' },
  'txn.currency':      { label: 'Currency',            type: 'string',  namespace: 'transaction', description: 'ISO 4217 currency code', enum: ['NGN','USD','EUR','GBP'], example: 'NGN' },
  'txn.recipientId':   { label: 'Recipient ID',        type: 'string',  namespace: 'transaction', description: 'Recipient account identifier', example: 'acc_9d2m1q7z' },
  'txn.narration':     { label: 'Narration',           type: 'string',  namespace: 'transaction', description: 'Transaction description or memo', example: 'Payment for services' },
  'txn.timestamp':     { label: 'Timestamp',           type: 'number',  namespace: 'transaction', description: 'Unix timestamp in milliseconds', example: 1_718_380_000_000 },
  'txn.lat':           { label: 'Origin Latitude',     type: 'number',  namespace: 'transaction', description: 'Latitude of the transaction origin (decimal degrees)', range: '-90–90', example: 6.4541 },
  'txn.lng':           { label: 'Origin Longitude',    type: 'number',  namespace: 'transaction', description: 'Longitude of the transaction origin (decimal degrees)', range: '-180–180', example: 3.3947 },

  'customer.accountAgeDays':  { label: 'Account Age',        type: 'number',  namespace: 'customer', description: 'Days since the account was opened', unit: 'days', example: 45 },
  'customer.riskScore':       { label: 'Risk Score',         type: 'number',  namespace: 'customer', description: 'Internal risk score (0–100)', range: '0–100', example: 62 },
  'customer.tier':            { label: 'KYC Tier',           type: 'string',  namespace: 'customer', description: 'Customer KYC tier level', enum: ['tier1','tier2','tier3'], example: 'tier2' },
  'customer.kycLevel':        { label: 'KYC Level',          type: 'string',  namespace: 'customer', description: 'KYC completion level', enum: ['basic','enhanced','full'], example: 'enhanced' },
  'customer.totalTxnCount':   { label: 'Total Transactions', type: 'number',  namespace: 'customer', description: 'Total historical transaction count', example: 247 },
  'customer.dailyTxnCount':   { label: 'Daily Tx Count',     type: 'number',  namespace: 'customer', description: 'Number of transactions completed today', example: 3 },
  'customer.dailyTxnVolume':  { label: 'Daily Volume',       type: 'number',  namespace: 'customer', description: 'Total Naira transacted today (₦)', unit: 'NGN', example: 250_000 },
  'customer.pep':             { label: 'PEP Flag',           type: 'boolean', namespace: 'customer', description: 'Politically Exposed Person indicator', example: false },

  'context.recipientFirstTime':  { label: 'First-Time Recipient', type: 'boolean', namespace: 'context', description: 'True if this is the first transaction to this recipient', example: true },
  'context.ipCountryCode':       { label: 'IP Country Code',      type: 'string',  namespace: 'context', description: 'Two-letter ISO country code of the originating IP', example: 'NG' },
  'context.deviceId':            { label: 'Device ID',            type: 'string',  namespace: 'context', description: 'Originating device identifier', example: 'dev_m3x7k9' },
  'context.deviceFirstSeen':     { label: 'New Device',           type: 'boolean', namespace: 'context', description: 'True if this device has not been seen before', example: false },
  'context.hour':                { label: 'Hour of Day',          type: 'number',  namespace: 'context', description: 'Local hour of the transaction (0–23)', range: '0–23', example: 14 },
  'context.dayOfWeek':           { label: 'Day of Week',          type: 'number',  namespace: 'context', description: 'Day of week (0 = Sunday, 6 = Saturday)', range: '0–6', example: 2 },
}

export const FIELD_GROUPS: { label: string; namespace: FieldNamespace; fields: string[] }[] = [
  {
    label: 'Transaction',
    namespace: 'transaction',
    fields: ['txn.amount','txn.type','txn.channel','txn.currency','txn.recipientId','txn.narration','txn.timestamp','txn.lat','txn.lng'],
  },
  {
    label: 'Customer',
    namespace: 'customer',
    fields: ['customer.riskScore','customer.accountAgeDays','customer.tier','customer.kycLevel',
             'customer.totalTxnCount','customer.dailyTxnCount','customer.dailyTxnVolume','customer.pep'],
  },
  {
    label: 'Context',
    namespace: 'context',
    fields: ['context.recipientFirstTime','context.ipCountryCode','context.deviceId',
             'context.deviceFirstSeen','context.hour','context.dayOfWeek'],
  },
]

export const OP_LABELS: Record<RuleOp, string> = {
  GT:           'is greater than',
  LT:           'is less than',
  GTE:          'is at least',
  LTE:          'is at most',
  EQ:           'equals',
  NEQ:          'does not equal',
  CONTAINS:     'contains',
  NOT_CONTAINS: 'does not contain',
  IN:           'is one of',
  NOT_IN:       'is not one of',
}

export function opsForType(type: FieldType): RuleOp[] {
  switch (type) {
    case 'number':  return ['GT','GTE','LT','LTE','EQ','NEQ']
    case 'boolean': return ['EQ']
    case 'string':  return ['EQ','NEQ','CONTAINS','NOT_CONTAINS','IN','NOT_IN']
  }
}

// Always-required base fields regardless of rules
const BASE_FIELDS = ['txn.amount', 'txn.timestamp', 'txn.type', 'txn.channel', 'customer.riskScore']

/** Scan a code string for every FIELD_META key it references. */
function fieldsFromCode(code: string): string[] {
  return Object.keys(FIELD_META).filter(k => code.includes(k))
}

/** Generates the required payload schema from a pipeline's rules (client-side). */
export function buildPayloadSchema(pipeline: MonitoringPipeline): object {
  const usedFields = new Set<string>(BASE_FIELDS)
  pipeline.rules.filter(r => r.enabled).forEach(r => {
    usedFields.add(r.field)
    if (r.code) fieldsFromCode(r.code).forEach(k => usedFields.add(k))
  })

  const schema: Record<string, Record<string, object>> = {
    transaction: {
      id:        { type: 'string',  required: true,  description: 'Unique transaction ID', example: 'txn_8f3k2p9a' },
    },
    customer: {
      id:        { type: 'string',  required: true,  description: 'Customer account ID',   example: 'cust_4a7b2c1d' },
    },
    context:   {},
  }

  const nsMap: Record<FieldNamespace, string> = {
    transaction: 'transaction',
    customer:    'customer',
    context:     'context',
  }

  for (const fieldKey of usedFields) {
    const meta = FIELD_META[fieldKey]
    if (!meta) continue
    const parts   = fieldKey.split('.')
    const subKey  = parts.slice(1).join('.')
    const nsLabel = nsMap[meta.namespace]
    const entry: Record<string, unknown> = {
      type:        meta.type,
      required:    true,
      description: meta.description,
      example:     meta.example,
    }
    if (meta.enum)  entry.enum  = meta.enum
    if (meta.range) entry.range = meta.range
    if (meta.unit)  entry.unit  = meta.unit
    schema[nsLabel][subKey] = entry
  }

  // Drop context key if empty
  if (Object.keys(schema.context).length === 0) delete schema.context

  return schema
}

/** Builds a realistic example payload from a pipeline's rules. */
export function buildExamplePayload(pipeline: MonitoringPipeline): object {
  const used = new Set<string>(BASE_FIELDS)
  pipeline.rules.filter(r => r.enabled).forEach(r => {
    used.add(r.field)
    if (r.code) fieldsFromCode(r.code).forEach(k => used.add(k))
  })

  const txn: Record<string, unknown> = { id: 'txn_8f3k2p9a' }
  const context: Record<string, unknown> = {}

  for (const fieldKey of used) {
    const meta = FIELD_META[fieldKey]
    if (!meta) continue
    const subKey = fieldKey.split('.').slice(1).join('.')
    if (meta.namespace === 'transaction') txn[subKey]  = meta.example
    if (meta.namespace === 'context')     context[subKey] = meta.example
    // customer fields are resolved server-side from customerId — not included here
  }

  const result: Record<string, unknown> = { transaction: txn, customerId: 'cust_4a7b2c1d' }
  if (Object.keys(context).length > 0) result.context = context
  return result
}

// ── API ───────────────────────────────────────────────────────────────────────

export const monitoringApi = {
  listPipelines: () =>
    apiRequest<{ pipelines: MonitoringPipeline[] }>('/api/v1/monitoring/pipelines'),

  getPipeline: (id: number) =>
    apiRequest<{ pipeline: MonitoringPipeline }>(`/api/v1/monitoring/pipelines/${id}`),

  createPipeline: (name: string, description: string, logic: PipelineLogic, withDefaults: boolean) =>
    apiRequest<{ pipeline: MonitoringPipeline }>('/api/v1/monitoring/pipelines', {
      method: 'POST',
      body: { name, description, logic, withDefaults },
    }),

  updatePipeline: (id: number, name: string, description: string, logic: PipelineLogic, status: PipelineStatus) =>
    apiRequest<{ pipeline: MonitoringPipeline }>(`/api/v1/monitoring/pipelines/${id}`, {
      method: 'PATCH',
      body: { name, description, logic, status },
    }),

  deletePipeline: (id: number) =>
    apiRequest<{ ok: boolean }>(`/api/v1/monitoring/pipelines/${id}`, { method: 'DELETE' }),

  addRule: (pipelineId: number, name: string, field: string, op: RuleOp, value: string,
             policy: string | null, code: string | null, position: number) =>
    apiRequest<{ rule: MonitoringRule }>(`/api/v1/monitoring/pipelines/${pipelineId}/rules`, {
      method: 'POST',
      body: { name, field, op, value, policy, code, position },
    }),

  updateRule: (pipelineId: number, ruleId: number, name: string, field: string, op: RuleOp,
               value: string, enabled: boolean, position: number) =>
    apiRequest<{ rule: MonitoringRule }>(`/api/v1/monitoring/pipelines/${pipelineId}/rules/${ruleId}`, {
      method: 'PATCH',
      body: { name, field, op, value, enabled, position },
    }),

  deleteRule: (pipelineId: number, ruleId: number) =>
    apiRequest<{ ok: boolean }>(`/api/v1/monitoring/pipelines/${pipelineId}/rules/${ruleId}`, {
      method: 'DELETE',
    }),

  comprehendRule: (description: string) =>
    apiRequest<{ name: string; field: string; op: RuleOp; value: string; code: string | null }>(
      '/api/v1/monitoring/rules/comprehend',
      { method: 'POST', body: { description } }
    ),

  evaluatePipeline: (id: number, payload: object) =>
    apiRequest<{
      pipelineId:   number
      pipelineName: string
      verdict:      'FLAGGED' | 'CLEAR'
      logic:        string
      triggered:    number
      total:        number
      rules: {
        id:      number
        name:    string
        field:   string
        op:      string
        value:   string
        matched: boolean
        actual:  string | null
      }[]
    }>(`/api/v1/monitoring/pipelines/${id}/evaluate`, { method: 'POST', body: payload }),
}
