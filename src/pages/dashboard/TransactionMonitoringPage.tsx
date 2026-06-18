import { useState, useEffect, useCallback, useRef, type MouseEvent } from 'react'
import {
  Box, Typography, Stack, Button, IconButton, Chip,
  TextField, Select, MenuItem, Switch, Tooltip,
  CircularProgress, Divider, FormControl, InputLabel,
  ToggleButton, ToggleButtonGroup, Collapse,
} from '@mui/material'
import AddRoundedIcon            from '@mui/icons-material/AddRounded'
import DeleteOutlineRoundedIcon  from '@mui/icons-material/DeleteOutlineRounded'
import EditOutlinedIcon          from '@mui/icons-material/EditOutlined'
import CloseRoundedIcon          from '@mui/icons-material/CloseRounded'
import ShieldOutlinedIcon        from '@mui/icons-material/ShieldOutlined'
import CheckCircleRoundedIcon    from '@mui/icons-material/CheckCircleRounded'
import PauseCircleOutlineRoundedIcon from '@mui/icons-material/PauseCircleOutlineRounded'
import CodeRoundedIcon           from '@mui/icons-material/CodeRounded'
import ContentCopyRoundedIcon    from '@mui/icons-material/ContentCopyRounded'
import ExpandMoreRoundedIcon     from '@mui/icons-material/ExpandMoreRounded'
import ExpandLessRoundedIcon     from '@mui/icons-material/ExpandLessRounded'
import AccountTreeOutlinedIcon   from '@mui/icons-material/AccountTreeOutlined'
import TuneRoundedIcon           from '@mui/icons-material/TuneRounded'
import AutoAwesomeRoundedIcon    from '@mui/icons-material/AutoAwesomeRounded'
import TuneOutlinedIcon          from '@mui/icons-material/TuneOutlined'

import { colorPalette } from '@/theme'
import {
  monitoringApi, buildPayloadSchema, buildExamplePayload,
  FIELD_META, FIELD_GROUPS, OP_LABELS, opsForType,
  type MonitoringPipeline, type MonitoringRule,
  type PipelineLogic, type PipelineStatus, type RuleOp, type FieldType,
} from '@/api/monitoringPipeline'
import { institutionRuleApi, type RuleTemplate } from '@/api/institutionRules'
import TemplateHoverPopup, { type HoveredCard } from '@/components/dashboard/TemplateHoverPopup'
import { useRbac } from '@/contexts/RbacContext'

const PRIORITY_COL: Record<string, string> = { critical: '#dc2626', high: '#d97706', medium: '#2563eb' }
const RULE_TYPE_COL: Record<string, string> = {
  person: '#7c3aed', location: '#0f766e', timing: '#d97706', series: '#0369a1', composite: '#475569',
}

// ── PDF step types ────────────────────────────────────────────────────────────

type PdfStepStatus = 'pending' | 'active' | 'done'
type PdfStep = { id: string; label: string; detail: string; status: PdfStepStatus; startedAt?: number; meta?: string }

const PDF_STEPS_INIT: PdfStep[] = [
  { id: 'extract',   label: 'Reading document',    detail: 'Extracting text from PDF',         status: 'pending' },
  { id: 'summarise', label: 'Summarising content', detail: 'Identifying rules and thresholds', status: 'pending' },
  { id: 'generate',  label: 'Generating rules',    detail: 'Mapping to transaction schema',    status: 'pending' },
]

function setPdfStepStatus(steps: PdfStep[], id: string, status: PdfStepStatus, meta?: string): PdfStep[] {
  return steps.map(s => s.id === id
    ? { ...s, status, startedAt: status === 'active' ? Date.now() : s.startedAt, ...(meta !== undefined ? { meta } : {}) }
    : s
  )
}

function PdfElapsedTimer({ startedAt }: { startedAt?: number }) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!startedAt) return
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 500)
    return () => clearInterval(t)
  }, [startedAt])
  return <>{elapsed}s</>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatValue(field: string, value: string): string {
  const meta = FIELD_META[field]
  if (!meta) return value
  if (field === 'txn.amount' || field.endsWith('Volume')) {
    const n = parseInt(value, 10)
    if (!isNaN(n)) return '₦' + n.toLocaleString('en-NG')
  }
  if (meta.type === 'boolean') return value === 'true' ? 'Yes' : 'No'
  return value
}

function autoName(field: string, op: RuleOp, value: string): string {
  const meta = FIELD_META[field]
  if (!meta) return `${field} ${op} ${value}`
  const label = meta.label
  const opLabel = OP_LABELS[op] ?? op
  const display = formatValue(field, value)
  return `${label} ${opLabel} ${display}`
}

function generateRuleCode(field: string, op: RuleOp, value: string): string {
  const [ns, ...rest] = field.split('.')
  const jsNs  = ns === 'txn' ? 'transaction' : ns
  const path  = `${jsNs}.${rest.join('.')}`
  const meta  = FIELD_META[field]
  const isBool = meta?.type === 'boolean'
  const isNum  = meta?.type === 'number'
  const jsVal  = isBool ? value : isNum ? value : `'${value}'`

  let expr: string
  switch (op) {
    case 'GT':           expr = `${path} > ${jsVal}`;                               break
    case 'LT':           expr = `${path} < ${jsVal}`;                               break
    case 'GTE':          expr = `${path} >= ${jsVal}`;                              break
    case 'LTE':          expr = `${path} <= ${jsVal}`;                              break
    case 'EQ':           expr = `${path} === ${jsVal}`;                             break
    case 'NEQ':          expr = `${path} !== ${jsVal}`;                             break
    case 'CONTAINS':     expr = `${path}.includes(${jsVal})`;                       break
    case 'NOT_CONTAINS': expr = `!${path}.includes(${jsVal})`;                      break
    case 'IN':           expr = `[${value.split(',').map(v => `'${v.trim()}'`).join(', ')}].includes(${path})`; break
    case 'NOT_IN':       expr = `![${value.split(',').map(v => `'${v.trim()}'`).join(', ')}].includes(${path})`; break
    default:             expr = `${path} ${op} ${jsVal}`
  }

  const comment = meta?.unit === 'NGN' ? ` // ₦${parseInt(value).toLocaleString('en-NG')}` : ''
  return `function evaluate({ transaction, customer, context }) {\n  return ${expr};${comment}\n}`
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: PipelineStatus }) {
  return (
    <Box sx={{
      width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
      bgcolor: status === 'active' ? '#10b981' : '#94a3b8',
    }} />
  )
}

function LogicBadge({ logic }: { logic: PipelineLogic }) {
  return (
    <Chip
      label={logic}
      size="small"
      sx={{
        bgcolor: logic === 'AND' ? '#eff6ff' : '#fdf4ff',
        color:   logic === 'AND' ? '#2563eb' : '#9333ea',
        fontWeight: 700, fontSize: '0.625rem', letterSpacing: '0.12em',
        height: 18, borderRadius: 0,
      }}
    />
  )
}

const NS_PALETTE: Record<string, { color: string; bg: string; label: string }> = {
  transaction: { color: '#0369a1', bg: '#e0f2fe', label: 'Transaction' },
  customer:    { color: '#7c3aed', bg: '#ede9fe', label: 'Customer' },
  context:     { color: '#0f766e', bg: '#ccfbf1', label: 'Context' },
}

function RuleRow({
  rule, pipelineId, canModify, onToggle, onEdit, onDelete,
}: {
  rule:       MonitoringRule
  pipelineId: number
  canModify:  boolean
  onToggle:   (r: MonitoringRule, enabled: boolean) => void
  onEdit:     (r: MonitoringRule) => void
  onDelete:   (r: MonitoringRule) => void
}) {
  const meta   = FIELD_META[rule.field]
  const ns     = meta?.namespace ?? 'transaction'
  const pal    = NS_PALETTE[ns] ?? NS_PALETTE.transaction
  const subKey = rule.field.split('.').slice(1).join('.')

  return (
    <Box sx={{
      display: 'flex', alignItems: 'stretch',
      borderBottom: '1px solid var(--border-col)',
      transition: 'background 0.12s',
      opacity: rule.enabled ? 1 : 0.45,
      '&:hover': {
        bgcolor: 'var(--section-bg)',
        '& .rule-actions': { opacity: 1 },
      },
    }}>
      {/* Namespace accent strip */}
      <Box sx={{ width: 3, flexShrink: 0, bgcolor: rule.enabled ? pal.color : '#cbd5e1' }} />

      {/* Main content */}
      <Box sx={{ flex: 1, minWidth: 0, px: 2, py: 1.5 }}>
        {/* Top row: name + condition chain */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mb: 0.625 }}>
          <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, fontFamily: 'Jost', color: 'var(--heading-color)', lineHeight: 1.2 }}>
            {rule.name}
          </Typography>

          {/* Condition pill chain */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
            {/* Field */}
            <Box sx={{
              display: 'inline-flex', alignItems: 'center',
              px: 0.875, py: 0.25,
              bgcolor: pal.bg, color: pal.color,
              fontSize: '0.6875rem', fontWeight: 700, fontFamily: 'SF Mono, Monaco, monospace',
              letterSpacing: '0.02em', lineHeight: 1,
            }}>
              {subKey}
            </Box>

            {/* Operator */}
            <Typography sx={{ fontSize: '0.6875rem', color: '#64748b', fontWeight: 500, px: 0.25 }}>
              {OP_LABELS[rule.op] ?? rule.op}
            </Typography>

            {/* Value */}
            <Box sx={{
              display: 'inline-flex', alignItems: 'center',
              px: 0.875, py: 0.25,
              bgcolor: 'var(--section-bg)', border: '1px solid var(--border-col)',
              fontSize: '0.6875rem', fontWeight: 700, fontFamily: 'SF Mono, Monaco, monospace',
              color: 'var(--heading-color)', lineHeight: 1,
            }}>
              {formatValue(rule.field, rule.value)}
            </Box>
          </Box>
        </Box>

        {/* Bottom row: namespace label + field path + risk impact badge */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
          <Typography sx={{ fontSize: '0.5625rem', fontWeight: 800, color: pal.color, textTransform: 'uppercase', letterSpacing: '0.14em' }}>
            {pal.label}
          </Typography>
          <Box sx={{ width: 2, height: 2, borderRadius: '50%', bgcolor: '#cbd5e1' }} />
          <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', fontFamily: 'SF Mono, Monaco, monospace' }}>
            {rule.field}
          </Typography>
          <Box sx={{ width: 2, height: 2, borderRadius: '50%', bgcolor: '#cbd5e1' }} />
          <Box sx={{
            display: 'inline-flex', alignItems: 'center', gap: 0.375,
            px: 0.75, py: 0.25,
            bgcolor: '#fef3c7', color: '#92400e',
            fontSize: '0.5625rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em',
            lineHeight: 1,
          }}>
            <ShieldOutlinedIcon sx={{ fontSize: '0.6rem' }} />
            Flags transaction · updates customer risk profile
          </Box>
        </Box>
      </Box>

      {/* Right controls */}
      {canModify && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, pr: 1, flexShrink: 0 }}>
          <Box className="rule-actions" sx={{
            display: 'flex', alignItems: 'center', gap: 0,
            opacity: 0, transition: 'opacity 0.15s',
          }}>
            <Tooltip title="Edit rule">
              <IconButton size="small" onClick={() => onEdit(rule)}
                sx={{ borderRadius: 0, color: '#94a3b8', '&:hover': { color: colorPalette.primary, bgcolor: 'transparent' } }}>
                <EditOutlinedIcon sx={{ fontSize: '0.875rem' }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete rule">
              <IconButton size="small" onClick={() => onDelete(rule)}
                sx={{ borderRadius: 0, color: '#94a3b8', '&:hover': { color: '#dc2626', bgcolor: 'transparent' } }}>
                <DeleteOutlineRoundedIcon sx={{ fontSize: '0.875rem' }} />
              </IconButton>
            </Tooltip>
            <Box sx={{ width: 1, height: 18, bgcolor: 'var(--border-col)', mx: 0.5 }} />
          </Box>
          <Switch
            size="small"
            checked={rule.enabled}
            onChange={e => onToggle(rule, e.target.checked)}
            sx={{
              '& .MuiSwitch-switchBase.Mui-checked': { color: '#10b981' },
              '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#10b981' },
            }}
          />
        </Box>
      )}
    </Box>
  )
}

// ── Nomos-style rule creation helpers ────────────────────────────────────────

const RULE_TEMPLATE_CATEGORIES: { category: string; color: string; items: { tag: string; name: string; policy: string }[] }[] = [
  {
    category: 'Transaction Volume',
    color: '#0369a1',
    items: [
      { tag: 'High Value',      name: 'High-value transaction',       policy: 'Flag any transaction above ₦1,000,000 regardless of the sending account or recipient.' },
      { tag: 'Large Withdrawal',name: 'Large withdrawal',             policy: 'Flag any cash withdrawal or debit above ₦2,000,000 in a single transaction.' },
      { tag: 'Daily Volume',    name: 'High daily volume',            policy: "Flag when a customer's total outbound transaction volume for the current day exceeds ₦5,000,000." },
      { tag: 'Micro Spam',      name: 'Micro-transaction structuring', policy: 'Flag when a customer initiates more than 10 transactions below ₦50,000 within a single day, which may indicate structuring to avoid thresholds.' },
      { tag: 'Round Amount',    name: 'Suspiciously round amount',    policy: 'Flag any transfer that is an exact round number above ₦500,000 (e.g. ₦1,000,000 exactly), as these are common in structuring.' },
    ],
  },
  {
    category: 'Location & Origin',
    color: '#0f766e',
    items: [
      { tag: 'Foreign IP',      name: 'Non-Nigerian origin',          policy: 'Flag transactions where the originating IP address is from outside Nigeria.' },
      { tag: 'High-Risk Country', name: 'High-risk country origin',   policy: 'Flag any transaction initiated from an IP address associated with a FATF high-risk or grey-listed country.' },
      { tag: 'Night Transfer',  name: 'Late-night transaction',       policy: 'Flag all outbound transfers initiated between midnight and 5am local time.' },
      { tag: 'Weekend Large',   name: 'Large weekend transfer',       policy: 'Flag any transfer above ₦500,000 initiated on a Saturday or Sunday when normal banking oversight is reduced.' },
    ],
  },
  {
    category: 'Behavioural',
    color: '#7c3aed',
    items: [
      { tag: 'New Device',      name: 'Unrecognised device',          policy: 'Flag transactions initiated from a device that has not been seen on this account before.' },
      { tag: 'First Recipient', name: 'First-time recipient',         policy: 'Flag transfers to a recipient who has never received funds from this account before.' },
      { tag: 'New Account',     name: 'New account transaction',      policy: 'Flag any transaction from an account that was opened less than 30 days ago.' },
      { tag: 'Rapid Transfers', name: 'Rapid consecutive transfers',  policy: 'Flag when a customer initiates more than 5 outbound transfers within any 30-minute window, which may indicate account compromise or money mule activity.' },
      { tag: 'Channel Switch',  name: 'Unusual channel for amount',   policy: 'Flag any transaction above ₦300,000 initiated via USSD, as large transfers over unstructured channels are atypical.' },
    ],
  },
  {
    category: 'Risk Indicators',
    color: '#dc2626',
    items: [
      { tag: 'PEP',             name: 'Politically exposed person',   policy: 'Flag any transaction involving a customer who is tagged as a Politically Exposed Person (PEP).' },
      { tag: 'Risk Score',      name: 'High-risk customer',           policy: 'Flag transactions from customers whose internal risk score exceeds 75 out of 100.' },
      { tag: 'Tier 1',          name: 'Low KYC tier',                 policy: 'Flag any transaction from a customer who has not completed enhanced KYC verification and remains on Tier 1.' },
      { tag: 'Watchlisted',     name: 'Watchlisted customer',         policy: 'Flag any transaction from a customer who appears on an internal or regulatory watchlist.' },
      { tag: 'No KYC',          name: 'Basic KYC only',               policy: 'Flag transactions above ₦100,000 from customers who have only completed basic KYC and have not provided government-issued ID.' },
    ],
  },
]

// Flat list for backward compatibility
const RULE_TEMPLATES = RULE_TEMPLATE_CATEGORIES.flatMap(c => c.items)

const RULE_COMPLETIONS = [
  'Flag any transaction above ₦500,000',
  'Flag all transfers above ₦1,000,000 to a first-time recipient',
  'Flag transactions from accounts less than 30 days old',
  'Flag when customer risk score exceeds 75',
  'Flag transactions from a new or unrecognised device',
  'Flag transfers to first-time recipients above ₦200,000',
  'Flag transactions initiated between midnight and 5am',
  'Flag all transactions from Tier 1 KYC customers',
  'Flag any transaction involving a politically exposed person',
  'Flag when cumulative daily transaction volume exceeds ₦5,000,000',
  'Flag transactions originating from outside Nigeria',
  'Flag large withdrawals above ₦2,000,000',
]

function RuleSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.75 }}>
      {children}
    </Typography>
  )
}

function RulePolicyQuote({ text }: { text: string }) {
  return (
    <Box sx={{ p: 2, bgcolor: `${colorPalette.primary}08`, border: `1px solid ${colorPalette.primary}25`, fontSize: '0.875rem', color: 'var(--on-surface)', lineHeight: 1.75, fontStyle: 'italic' }}>
      "{text}"
    </Box>
  )
}

function RuleCodeBlockRaw({ children, maxH = 240 }: { children: React.ReactNode; maxH?: number }) {
  return (
    <Box sx={{ p: 2, bgcolor: '#0f172a', fontFamily: 'SF Mono, Monaco, monospace', fontSize: '0.75rem', color: '#e2e8f0', lineHeight: 1.8, whiteSpace: 'pre-wrap', maxHeight: maxH, overflowY: 'auto', borderRadius: 0 }}>
      {children}
    </Box>
  )
}

function RuleComprehensionPills({ field, op, value }: { field: string; op: RuleOp; value: string }) {
  const meta = FIELD_META[field]
  return (
    <Stack gap={1.5}>
      <Box sx={{ fontSize: '0.875rem', color: 'var(--on-surface)', lineHeight: 1.65, p: 1.5, bgcolor: `${colorPalette.primary}0d`, border: `1px solid ${colorPalette.primary}30` }}>
        {autoName(field, op, value)}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Chip label={meta?.label ?? field} size="small" sx={{ fontFamily: 'SF Mono, Monaco, monospace', fontSize: '0.6875rem', borderRadius: 0, bgcolor: '#e0f2fe', color: '#0369a1', height: 24 }} />
        <Typography sx={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', fontWeight: 600 }}>{OP_LABELS[op] ?? op}</Typography>
        <Chip label={formatValue(field, value)} size="small" sx={{ fontFamily: 'SF Mono, Monaco, monospace', fontSize: '0.6875rem', borderRadius: 0, bgcolor: '#fef3c7', color: '#92400e', height: 24 }} />
      </Box>
    </Stack>
  )
}

// ── Rule plain-language summary ───────────────────────────────────────────────

function RuleSummaryView({
  policy,
  comprehension,
}: {
  policy:        string
  comprehension: { field: string; op: RuleOp; value: string; code: string | null } | null
}) {
  const code      = comprehension?.code ?? null
  const isComplex = !!code && code.split('\n').length > 5
  const hasOr     = !!code?.includes(' || ')

  // Collect all field keys referenced in the code (JS uses 'transaction.' for 'txn.')
  const referencedFields = (() => {
    const base = comprehension ? [comprehension.field] : []
    if (!code) return base
    return Object.keys(FIELD_META).filter(key => {
      const jsKey = key.replace(/^txn\./, 'transaction.')
      return code.includes(jsKey)
    })
  })()

  // Group by namespace for the data-points section
  const byNs: Record<string, string[]> = {}
  referencedFields.forEach(f => {
    const ns = FIELD_META[f]?.namespace ?? 'transaction'
    if (!byNs[ns]) byNs[ns] = []
    if (!byNs[ns].includes(f)) byNs[ns].push(f)
  })

  const primaryMeta = comprehension ? FIELD_META[comprehension.field] : null
  const primaryNs   = primaryMeta?.namespace ?? 'transaction'
  const primaryPal  = NS_PALETTE[primaryNs] ?? NS_PALETTE.transaction

  return (
    <Box sx={{ border: '1px solid var(--border-col)', overflow: 'hidden' }}>

      {/* ── Policy quote ─────────────────────────────────────────────── */}
      {policy && (
        <Box sx={{
          px: 2.5, py: 2,
          borderLeft: `4px solid ${colorPalette.primary}`,
          borderBottom: '1px solid var(--border-col)',
          bgcolor: `${colorPalette.primary}06`,
        }}>
          <Typography sx={{ fontSize: '0.5625rem', fontWeight: 800, color: colorPalette.primary, textTransform: 'uppercase', letterSpacing: '0.16em', mb: 0.75 }}>
            Compliance Policy
          </Typography>
          <Typography sx={{ fontSize: '0.9375rem', color: 'var(--heading-color)', lineHeight: 1.75, fontStyle: 'italic', fontWeight: 500 }}>
            "{policy}"
          </Typography>
        </Box>
      )}

      {/* ── Data points checked ───────────────────────────────────────── */}
      <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid var(--border-col)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Typography sx={{ fontSize: '0.5625rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.16em' }}>
            Data points evaluated
          </Typography>
          {isComplex && (
            <Chip
              label={hasOr ? 'OR — any condition' : 'AND — all conditions'}
              size="small"
              sx={{ height: 18, fontSize: '0.5625rem', fontWeight: 700, borderRadius: 0,
                    bgcolor: hasOr ? '#fdf4ff' : '#eff6ff',
                    color:   hasOr ? '#9333ea'  : '#2563eb' }}
            />
          )}
        </Box>

        {/* Simple rule — single condition pill row */}
        {!isComplex && comprehension && (
          <Box sx={{
            display: 'inline-flex', alignItems: 'center', gap: 0,
            border: `1px solid ${primaryPal.color}40`,
            overflow: 'hidden',
          }}>
            {/* Namespace accent */}
            <Box sx={{ width: 3, alignSelf: 'stretch', bgcolor: primaryPal.color, flexShrink: 0 }} />
            {/* Field */}
            <Box sx={{ px: 1.5, py: 1, bgcolor: primaryPal.bg }}>
              <Typography sx={{ fontSize: '0.5625rem', fontWeight: 800, color: primaryPal.color, textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.25 }}>
                {primaryPal.label}
              </Typography>
              <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: primaryPal.color, fontFamily: 'Jost' }}>
                {primaryMeta?.label ?? comprehension.field}
              </Typography>
            </Box>
            {/* Operator */}
            <Box sx={{ px: 1.75, py: 1, bgcolor: 'var(--section-bg)', borderLeft: `1px solid ${primaryPal.color}30`, borderRight: `1px solid ${primaryPal.color}30` }}>
              <Typography sx={{ fontSize: '0.6875rem', color: '#64748b', fontWeight: 600, fontStyle: 'italic' }}>
                {OP_LABELS[comprehension.op] ?? comprehension.op}
              </Typography>
            </Box>
            {/* Value */}
            <Box sx={{ px: 1.5, py: 1, bgcolor: '#fef9ec' }}>
              <Typography sx={{ fontSize: '0.8125rem', fontWeight: 800, color: '#92400e', fontFamily: 'Jost' }}>
                {formatValue(comprehension.field, comprehension.value)}
              </Typography>
            </Box>
          </Box>
        )}

        {/* Complex rule — namespace-grouped field cards */}
        {isComplex && (
          <Stack gap={1.25}>
            {Object.entries(byNs).map(([ns, fields]) => {
              const pal = NS_PALETTE[ns] ?? NS_PALETTE.transaction
              return (
                <Box key={ns} sx={{ border: `1px solid ${pal.color}28`, overflow: 'hidden' }}>
                  <Box sx={{ px: 1.5, py: 0.625, bgcolor: `${pal.color}12`, borderBottom: `1px solid ${pal.color}20`, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 3, height: 10, bgcolor: pal.color, flexShrink: 0 }} />
                    <Typography sx={{ fontSize: '0.5625rem', fontWeight: 800, color: pal.color, textTransform: 'uppercase', letterSpacing: '0.14em' }}>
                      {pal.label}
                    </Typography>
                  </Box>
                  <Box sx={{ px: 1.5, py: 1.125, display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                    {fields.map(f => (
                      <Box key={f} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.375, bgcolor: `${pal.color}10`, border: `1px solid ${pal.color}30` }}>
                        <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: pal.color, flexShrink: 0 }} />
                        <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: pal.color }}>
                          {FIELD_META[f]?.label ?? f}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              )
            })}
          </Stack>
        )}
      </Box>

      {/* ── Outcome ───────────────────────────────────────────────────── */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
        {/* FLAG */}
        <Box sx={{ px: 2, py: 1.75, borderRight: '1px solid var(--border-col)', bgcolor: '#fff8f8' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
            <Box sx={{ px: 1, py: 0.25, bgcolor: '#dc2626', color: '#fff', fontSize: '0.5625rem', fontWeight: 800, letterSpacing: '0.12em', fontFamily: 'Jost' }}>
              FLAG
            </Box>
            <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {hasOr ? 'Any condition true' : 'Condition true'}
            </Typography>
          </Box>
          <Typography sx={{ fontSize: '0.8125rem', color: '#7f1d1d', lineHeight: 1.6 }}>
            Transaction is held and sent to the compliance queue for manual review.
          </Typography>
        </Box>
        {/* PASS */}
        <Box sx={{ px: 2, py: 1.75, bgcolor: '#f8fff9' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
            <Box sx={{ px: 1, py: 0.25, bgcolor: '#16a34a', color: '#fff', fontSize: '0.5625rem', fontWeight: 800, letterSpacing: '0.12em', fontFamily: 'Jost' }}>
              PASS
            </Box>
            <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {hasOr ? 'No conditions true' : 'Condition false'}
            </Typography>
          </Box>
          <Typography sx={{ fontSize: '0.8125rem', color: '#14532d', lineHeight: 1.6 }}>
            Transaction clears this rule and continues to the next check.
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}

type RuleStep = 'write' | 'comprehend' | 'generate'

function RuleForm({
  initial, pipelineId, ruleCount, onSave, onBatchSaved, onCancel,
}: {
  initial?:       MonitoringRule
  pipelineId:     number
  ruleCount:      number
  onSave:         (name: string, field: string, op: RuleOp, value: string, policy: string | null, code: string | null, position: number) => Promise<void>
  onBatchSaved?:  (count: number) => Promise<void>
  onCancel:       () => void
}) {
  const isEdit = !!initial
  const [step,         setStep]         = useState<RuleStep>(isEdit ? 'generate' : 'write')
  const [name,         setName]         = useState(initial?.name  ?? '')
  const [policy,       setPolicy]       = useState('')
  const [suggestions,  setSuggestions]  = useState<string[]>([])
  const [comprehension, setComprehension] = useState<{ field: string; op: RuleOp; value: string; code: string | null } | null>(
    initial ? { field: initial.field, op: initial.op, value: initial.value, code: initial.code ?? null } : null
  )
  const [streamedText,   setStreamedText]   = useState('')
  const [functionSource, setFunctionSource] = useState(initial ? generateRuleCode(initial.field, initial.op, initial.value) : '')
  const [functionReady,  setFunctionReady]  = useState(isEdit)
  const [error,          setError]          = useState<string | null>(null)
  const [saving,         setSaving]         = useState(false)

  // Edit-mode field overrides (allow changing field/op/value directly)
  const [editField, setEditField] = useState(initial?.field ?? '')
  const [editOp,    setEditOp]    = useState<RuleOp>(initial?.op ?? 'GT')
  const [editValue, setEditValue] = useState(initial?.value ?? '')

  const [inputTab,  setInputTab]  = useState<'write' | 'templates' | 'import'>('write')
  // AI dynamic templates
  const [aiTemplates,   setAiTemplates]   = useState<RuleTemplate[] | null>(null)
  const [aiTplLoading,  setAiTplLoading]  = useState(false)
  const [aiTplError,    setAiTplError]    = useState<string | null>(null)
  const [selectedTpl,   setSelectedTpl]   = useState<Set<string>>(new Set())
  const [selectedPdf,   setSelectedPdf]   = useState<Set<string>>(new Set())
  const [batchCreating, setBatchCreating] = useState(false)
  const [batchProgress, setBatchProgress] = useState<{done: number; total: number} | null>(null)
  const [hoveredCard,   setHoveredCard]   = useState<HoveredCard | null>(null)
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // PDF import
  const [pdfSteps,     setPdfSteps]     = useState<PdfStep[] | null>(null)
  const [pdfError,     setPdfError]     = useState<string | null>(null)
  const [pdfTemplates, setPdfTemplates] = useState<RuleTemplate[] | null>(null)
  const pdfInputRef = useRef<HTMLInputElement>(null)

  const abortRef = useRef<AbortController | null>(null)
  useEffect(() => () => { abortRef.current?.abort() }, [])

  const handleCardEnter = (t: RuleTemplate, e: MouseEvent<HTMLDivElement>) => {
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current)
    setHoveredCard({ tpl: t, rect: e.currentTarget.getBoundingClientRect() })
  }
  const handleCardLeave = () => {
    leaveTimerRef.current = setTimeout(() => setHoveredCard(null), 120)
  }

  // Animate code generation when entering 'generate' step (new rules only)
  useEffect(() => {
    if (step !== 'generate' || isEdit || !comprehension) return
    const { field: f, op: o, value: v, code: aiCode } = comprehension
    // Prefer AI-generated code (complex rules); fall back to client-side generator for simple rules
    const fullCode = aiCode?.trim() || generateRuleCode(f, o, v)
    let i = 0
    setStreamedText('')
    setFunctionReady(false)
    setFunctionSource(fullCode)
    const interval = setInterval(() => {
      i += 4
      if (i >= fullCode.length) {
        setStreamedText(fullCode)
        setFunctionReady(true)
        clearInterval(interval)
      } else {
        setStreamedText(fullCode.slice(0, i))
      }
    }, 18)
    return () => clearInterval(interval)
  }, [step, isEdit])

  // Recompute code when edit fields change
  useEffect(() => {
    if (!isEdit || !editField || !editOp || !editValue) return
    setFunctionSource(generateRuleCode(editField, editOp, editValue))
  }, [isEdit, editField, editOp, editValue])

  const fetchAiTemplates = async () => {
    if (aiTemplates !== null || aiTplLoading) return
    setAiTplLoading(true); setAiTplError(null)
    try {
      const { templates } = await institutionRuleApi.suggestTemplates()
      setAiTemplates(templates)
    } catch (e) {
      setAiTplError(e instanceof Error ? e.message : 'Failed to load suggestions')
    } finally { setAiTplLoading(false) }
  }

  const handleTabClick = (id: 'write' | 'templates' | 'import') => {
    setInputTab(id)
    if (id === 'templates') fetchAiTemplates()
  }

  const toggleTpl = (n: string) => setSelectedTpl(prev => {
    const s = new Set(prev); s.has(n) ? s.delete(n) : s.add(n); return s
  })
  const togglePdf = (n: string) => setSelectedPdf(prev => {
    const s = new Set(prev); s.has(n) ? s.delete(n) : s.add(n); return s
  })

  const handleBatchCreate = async (items: { name: string; policy: string }[]) => {
    if (!items.length) return
    setBatchCreating(true); setBatchProgress({ done: 0, total: items.length }); setError(null)
    let succeeded = 0
    for (let i = 0; i < items.length; i++) {
      const t = items[i]
      try {
        const comp = await monitoringApi.comprehendRule(t.policy)
        const m    = FIELD_META[comp.field]
        const ops  = m ? opsForType(m.type) : []
        const op   = ops.includes(comp.op) ? comp.op : (ops[0] ?? 'EQ') as RuleOp
        await monitoringApi.addRule(pipelineId, t.name || comp.name, comp.field, op, comp.value, t.policy, comp.code, ruleCount + succeeded)
        succeeded++
      } catch { /* skip failed rule */ }
      setBatchProgress({ done: i + 1, total: items.length })
    }
    await onBatchSaved?.(succeeded)
    setBatchCreating(false); setBatchProgress(null)
  }

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setPdfError(null)
    setPdfTemplates(null)
    setPdfSteps(PDF_STEPS_INIT)

    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/v1/nomos/suggest', { method: 'POST', credentials: 'include', body: form })

      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? `Failed (${res.status})`)
      }

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let lineBuffer = '', eventType = '', dataLines: string[] = []

      const dispatchSse = (type: string, dataStr: string) => {
        if (type === 'keepalive' || !dataStr) return
        const payload = JSON.parse(dataStr)
        if (type === 'step') {
          const { step: sid, status, chars, words, count } = payload as { step: string; status: PdfStepStatus; chars?: number; words?: number; count?: number }
          const meta = status === 'done'
            ? sid === 'extract'   ? `${chars?.toLocaleString() ?? '?'} chars extracted`
            : sid === 'summarise' ? `${words?.toLocaleString() ?? '?'} word summary`
            : sid === 'generate'  ? `${count ?? '?'} rule${count !== 1 ? 's' : ''} generated`
            : undefined
            : undefined
          setPdfSteps(prev => prev ? setPdfStepStatus(prev, sid, status, meta) : prev)
        } else if (type === 'result') {
          setPdfTemplates((payload as { templates: RuleTemplate[] }).templates)
          setSelectedPdf(new Set())
          setPdfSteps(null)
        } else if (type === 'error') {
          throw new Error((payload as { error: string }).error)
        }
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        lineBuffer += decoder.decode(value, { stream: true })
        const lines = lineBuffer.split('\n')
        lineBuffer  = lines.pop() ?? ''
        for (const raw of lines) {
          const line = raw.replace(/\r$/, '')
          if (line === '') {
            if (dataLines.length > 0) dispatchSse(eventType || 'message', dataLines.join('\n'))
            eventType = ''; dataLines = []
          } else if (line.startsWith('event:')) {
            eventType = line.slice(6).trim()
          } else if (line.startsWith('data:')) {
            const val = line.slice(5)
            dataLines.push(val.startsWith(' ') ? val.slice(1) : val)
          }
        }
      }
    } catch (e2) {
      setPdfSteps(null)
      setPdfError(e2 instanceof Error ? e2.message : 'Failed to analyse document')
    }
  }

  const handlePolicyChange = (val: string) => {
    setPolicy(val)
    if (val.length < 3) { setSuggestions([]); return }
    const lower = val.toLowerCase()
    setSuggestions(RULE_COMPLETIONS.filter(c => c.toLowerCase().startsWith(lower) && c !== val).slice(0, 4))
  }

  const handleSubmitPolicy = async () => {
    const trimName   = name.trim()
    const trimPolicy = policy.trim()
    if (!trimName || !trimPolicy) return
    setError(null)
    setStep('comprehend')
    setStreamedText('')
    setComprehension(null)
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    try {
      const result = await monitoringApi.comprehendRule(trimPolicy)
      const m = FIELD_META[result.field]
      const validOps = m ? opsForType(m.type) : []
      const safeOp = validOps.includes(result.op) ? result.op : (validOps[0] ?? 'EQ') as RuleOp
      setComprehension({ field: result.field, op: safeOp, value: result.value, code: result.code ?? null })
      if (!name.trim()) setName(result.name)
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== 'AbortError')
        setError(e instanceof Error ? e.message : 'Failed to analyse policy')
    }
  }

  const handleApproveComprehension = () => {
    if (!comprehension) return
    setStep('generate')
  }

  const handleEditFieldChange = (f: string) => {
    setEditField(f)
    const m = FIELD_META[f]
    if (m) {
      const validOps = opsForType(m.type)
      if (!validOps.includes(editOp)) setEditOp(validOps[0])
      setEditValue('')
    }
  }

  const handleSave = async () => {
    const effectiveName = name.trim()
    if (isEdit) {
      const derived = editField && editOp && editValue ? autoName(editField, editOp, editValue) : ''
      if (!editField || !editOp || !editValue || !effectiveName) return
      setSaving(true)
      try { await onSave(effectiveName || derived, editField, editOp, editValue, initial!.policy ?? null, initial!.code ?? null, initial!.position) }
      finally { setSaving(false) }
    } else {
      if (!comprehension || !effectiveName) return
      setSaving(true)
      try { await onSave(effectiveName, comprehension.field, comprehension.op, comprehension.value, policy.trim() || null, functionSource || null, ruleCount) }
      finally { setSaving(false) }
    }
  }

  const STEPS: RuleStep[] = isEdit ? ['generate'] : ['write', 'comprehend', 'generate']
  const LABELS = isEdit ? ['Edit rule'] : ['Describe', 'Verify', 'Generate']
  const cur = STEPS.indexOf(step)

  const editMeta      = FIELD_META[editField]
  const editFieldType = editMeta?.type ?? 'string' as FieldType
  const editOps       = editField ? opsForType(editFieldType) : []

  return (
    <Box sx={{ bgcolor: 'var(--section-bg)', borderBottom: '1px solid var(--border-col)' }}>
      {/* Step indicator — matches Nomos exactly */}
      <Box sx={{ px: 2.5, pt: 1.75, pb: 1.5, borderBottom: '1px solid var(--border-col)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {STEPS.map((s, i) => {
            const past = cur > i; const active = cur === i
            return (
              <Box key={s} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6875rem', fontWeight: 700, bgcolor: past || active ? colorPalette.primary : 'var(--border-col)', color: past || active ? '#fff' : '#94a3b8' }}>
                  {past ? '✓' : i + 1}
                </Box>
                <Typography sx={{ fontSize: '0.75rem', fontWeight: active ? 700 : 500, color: active ? 'var(--heading-color)' : '#94a3b8', fontFamily: 'Jost' }}>{LABELS[i]}</Typography>
                {i < STEPS.length - 1 && <Box sx={{ width: 24, height: 1, bgcolor: 'var(--border-col)' }} />}
              </Box>
            )
          })}
        </Box>
        <IconButton size="small" onClick={onCancel} sx={{ color: '#94a3b8', p: 0.375 }}>
          <CloseRoundedIcon sx={{ fontSize: '1rem' }} />
        </IconButton>
      </Box>

      <Box sx={{ px: 3, py: 3 }}>
        {error && (
          <Box sx={{ mb: 2, px: 2, py: 1.25, bgcolor: '#fef2f2', border: '1px solid #fecaca' }}>
            <Typography sx={{ fontSize: '0.8125rem', color: '#dc2626' }}>{error}</Typography>
          </Box>
        )}

        {/* ── Step 1: write ─────────────────────────────────────── */}
        {step === 'write' && (
          <Stack gap={2}>
            {/* Tab bar */}
            <Box sx={{ border: '1px solid var(--border-col)', bgcolor: 'var(--card-bg)' }}>
              {/* Tab strip */}
              <Box sx={{ display: 'flex', borderBottom: '1px solid var(--border-col)' }}>
                {([
                  { id: 'write',     label: 'Write' },
                  { id: 'templates', label: 'Templates' },
                  { id: 'import',    label: 'Import PDF' },
                ] as const).map(tab => (
                  <Box key={tab.id} onClick={() => handleTabClick(tab.id)}
                    sx={{
                      px: 2, py: 1.125, cursor: 'pointer', fontFamily: 'Jost',
                      fontSize: '0.8125rem', fontWeight: inputTab === tab.id ? 700 : 500,
                      color: inputTab === tab.id ? '#2563eb' : 'var(--on-surface-variant)',
                      borderBottom: inputTab === tab.id ? '2px solid #2563eb' : '2px solid transparent',
                      mb: '-1px',
                      transition: 'color 0.15s, border-color 0.15s',
                      '&:hover': { color: '#2563eb' },
                    }}>
                    {tab.label}
                  </Box>
                ))}
              </Box>

              {/* Tab: Write */}
              {inputTab === 'write' && (
                <Box sx={{ p: 2 }}>
                  <Typography sx={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', mb: 1.5, lineHeight: 1.6 }}>
                    Describe your rule in plain English. Be specific about amounts, time windows, and conditions.
                  </Typography>
                  <Box sx={{ position: 'relative' }}>
                    <textarea rows={6}
                      autoFocus
                      placeholder="e.g. Flag all transfers above ₦500,000 to first-time recipients from accounts less than 30 days old…"
                      value={policy} onChange={e => handlePolicyChange(e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', fontSize: '0.875rem', lineHeight: 1.7, padding: '10px 12px', border: '1px solid var(--border-col)', outline: 'none', color: 'var(--on-surface)', backgroundColor: 'var(--section-bg)', display: 'block' }} />
                    {suggestions.length > 0 && (
                      <Box sx={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, bgcolor: 'var(--card-bg)', border: '1px solid var(--border-col)', borderTop: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }}>
                        {suggestions.map(s => (
                          <Box key={s} onClick={() => { setPolicy(s); setSuggestions([]) }}
                            sx={{ px: 2, py: 1.25, fontSize: '0.8125rem', color: 'var(--on-surface)', cursor: 'pointer', '&:hover': { bgcolor: 'var(--section-bg)' }, borderBottom: '1px solid var(--border-col)', '&:last-child': { borderBottom: 'none' } }}>
                            <Box component="span" sx={{ fontWeight: 600, color: '#2563eb' }}>{policy}</Box>{s.slice(policy.length)}
                          </Box>
                        ))}
                      </Box>
                    )}
                  </Box>
                </Box>
              )}

              {/* Tab: Templates (AI-generated) */}
              {inputTab === 'templates' && (
                <Box>
                  {aiTplLoading && (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <CircularProgress size={22} sx={{ color: '#2563eb', mb: 1 }} />
                      <Typography sx={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)' }}>
                        Analysing CBN regulations and your existing rules…
                      </Typography>
                    </Box>
                  )}
                  {aiTplError && <Box sx={{ p: 2, color: '#dc2626', fontSize: '0.75rem' }}>{aiTplError}</Box>}
                  {aiTemplates && (() => {
                    const groups = aiTemplates.reduce<Record<string, RuleTemplate[]>>((acc, t) => {
                      const cat = t.category || 'Other';
                      (acc[cat] = acc[cat] || []).push(t); return acc
                    }, {})
                    return (
                      <Box>
                        {Object.entries(groups).map(([cat, items], gi) => (
                          <Box key={cat} sx={{ borderTop: gi === 0 ? 'none' : '1px solid var(--border-col)' }}>
                            <Box sx={{ px: 1.5, py: 0.75, bgcolor: 'var(--section-bg)', display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography sx={{ flex: 1, fontSize: '0.6875rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{cat}</Typography>
                              <Typography sx={{ fontSize: '0.625rem', color: '#94a3b8' }}>{items.length}</Typography>
                            </Box>
                            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.75, p: 0.75, bgcolor: 'var(--section-bg)' }}>
                              {items.map(t => {
                                const sel   = selectedTpl.has(t.name)
                                const prio  = t.priority ? PRIORITY_COL[t.priority] : undefined
                                const rtCol = RULE_TYPE_COL[t.ruleType] || '#475569'
                                return (
                                  <Box key={t.name}
                                    onClick={() => toggleTpl(t.name)}
                                    onMouseEnter={e => handleCardEnter(t, e)}
                                    onMouseLeave={handleCardLeave}
                                    sx={{ p: 1.25, border: `1px solid ${sel ? '#2563eb' : 'var(--border-col)'}`, bgcolor: sel ? '#eff6ff' : 'var(--card-bg)', position: 'relative', transition: 'border-color 0.15s, background 0.15s', cursor: 'pointer', '&:hover': { borderColor: sel ? '#2563eb' : '#94a3b8' }, ...(hoveredCard?.tpl.name === t.name ? { zIndex: 1201 } : {}) }}>
                                    {/* Selection indicator */}
                                    <Box sx={{ position: 'absolute', top: 6, right: 6, width: 14, height: 14, border: `1.5px solid ${sel ? '#2563eb' : '#cbd5e1'}`, bgcolor: sel ? '#2563eb' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                      {sel && <Box component="span" sx={{ fontSize: 9, color: '#fff', lineHeight: 1 }}>✓</Box>}
                                    </Box>
                                    <Box sx={{ display: 'flex', gap: 0.5, mb: 0.5, pr: 2 }}>
                                      <Chip label={t.tag} size="small" sx={{ fontSize: '0.5625rem', fontWeight: 700, borderRadius: 0, height: 15, bgcolor: `${rtCol}18`, color: rtCol, '& .MuiChip-label': { px: 0.5 } }} />
                                      {prio && <Chip label={t.priority} size="small" sx={{ fontSize: '0.5625rem', fontWeight: 700, borderRadius: 0, height: 15, bgcolor: `${prio}15`, color: prio, '& .MuiChip-label': { px: 0.5 } }} />}
                                    </Box>
                                    <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--heading-color)', fontFamily: 'Jost', lineHeight: 1.4 }}>
                                      {t.name}
                                    </Typography>
                                    {t.cbkRef && <Typography sx={{ fontSize: '0.6875rem', color: '#64748b', mt: 0.25 }}>{t.cbkRef}</Typography>}
                                    {t.dataGaps && t.dataGaps.length > 0 && (
                                      <Typography sx={{ fontSize: '0.5625rem', color: '#d97706', mt: 0.375, fontWeight: 600 }}>
                                        ⚠ {t.dataGaps.length} field{t.dataGaps.length > 1 ? 's' : ''} not captured
                                      </Typography>
                                    )}
                                  </Box>
                                )
                              })}
                            </Box>
                          </Box>
                        ))}
                        {batchProgress && (
                          <Box sx={{ px: 2, py: 1.25, borderTop: '1px solid var(--border-col)', display: 'flex', alignItems: 'center', gap: 1 }}>
                            <CircularProgress size={14} sx={{ color: '#2563eb' }} />
                            <Typography sx={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: 600 }}>
                              Creating {batchProgress.done}/{batchProgress.total}…
                            </Typography>
                          </Box>
                        )}
                        {selectedTpl.size > 0 && !batchProgress && (
                          <Box sx={{ p: 1.5, borderTop: '1px solid var(--border-col)', bgcolor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#2563eb' }}>
                              {selectedTpl.size} rule{selectedTpl.size > 1 ? 's' : ''} selected
                            </Typography>
                            <Button variant="contained" size="small" disabled={batchCreating}
                              onClick={() => handleBatchCreate(
                                aiTemplates.filter(t => selectedTpl.has(t.name)).map(t => ({ name: t.name, policy: t.policy }))
                              )}
                              sx={{ textTransform: 'none', fontWeight: 700, fontFamily: 'Jost', borderRadius: 0, boxShadow: 'none', bgcolor: '#2563eb', fontSize: '0.75rem', '&:hover': { boxShadow: 'none' } }}>
                              Create {selectedTpl.size} rule{selectedTpl.size > 1 ? 's' : ''}
                            </Button>
                          </Box>
                        )}
                      </Box>
                    )
                  })()}
                </Box>
              )}

              {/* Tab: Import PDF */}
              {inputTab === 'import' && (
                <Box>
                  <Box sx={{ p: 2 }}>
                    {!pdfTemplates && !pdfSteps && (
                      <Box sx={{ textAlign: 'center', py: 3 }}>
                        <AutoAwesomeRoundedIcon sx={{ fontSize: '2rem', color: '#ddd6fe', mb: 1 }} />
                        <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--heading-color)', mb: 0.5 }}>
                          Upload a CBN policy document
                        </Typography>
                        <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8', mb: 2, lineHeight: 1.6, maxWidth: 320, mx: 'auto' }}>
                          Eureka maps the document against the transaction schema and extracts implementable rules — data gaps flagged automatically.
                        </Typography>
                        <Box component="button" onClick={() => pdfInputRef.current?.click()}
                          sx={{ px: 2.5, py: 1, fontSize: '0.8125rem', fontWeight: 700, fontFamily: 'Jost', color: '#fff', bgcolor: '#7c3aed', border: 'none', cursor: 'pointer', '&:hover': { bgcolor: '#6d28d9' } }}>
                          ↑ Upload PDF / TXT
                        </Box>
                        <input ref={pdfInputRef} type="file" accept=".pdf,.txt,.md" style={{ display: 'none' }} onChange={handlePdfUpload} />
                      </Box>
                    )}
                    {pdfSteps && (
                      <Box sx={{ py: 2, px: 1 }}>
                        <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#6b7280', mb: 2, textAlign: 'center', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                          Analysing document
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
                          {pdfSteps.map((s, i) => {
                            const isDone    = s.status === 'done'
                            const isActive  = s.status === 'active'
                            const isPending = s.status === 'pending'
                            const isLast    = i === pdfSteps.length - 1
                            return (
                              <Box key={s.id} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                                {/* Left connector */}
                                {i > 0 && <Box sx={{ position: 'absolute', top: 13, right: '50%', left: 0, height: 2, bgcolor: pdfSteps[i - 1].status === 'done' ? '#16a34a' : '#e5e7eb', transition: 'background-color 0.4s ease' }} />}
                                {/* Right connector */}
                                {!isLast && <Box sx={{ position: 'absolute', top: 13, left: '50%', right: 0, height: 2, bgcolor: isDone ? '#16a34a' : '#e5e7eb', transition: 'background-color 0.4s ease' }} />}
                                {/* Icon */}
                                <Box sx={{ position: 'relative', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 0.75, zIndex: 1 }}>
                                  {isActive  && <CircularProgress size={32} thickness={2.5} sx={{ color: '#eab308', position: 'absolute', top: -2, left: -2 }} />}
                                  {isDone    && <CheckCircleRoundedIcon sx={{ fontSize: '1.375rem', color: '#16a34a' }} />}
                                  {isActive  && <Box sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: '#eab308' }} />}
                                  {isPending && <Box sx={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid #d1d5db' }} />}
                                </Box>
                                {/* Label */}
                                <Typography sx={{ fontSize: '0.6875rem', fontWeight: isActive ? 700 : 500, color: isDone ? '#16a34a' : isActive ? '#ca8a04' : '#9ca3af', textAlign: 'center', lineHeight: 1.3 }}>
                                  {s.label}
                                </Typography>
                                {/* Sub-label */}
                                <Typography sx={{ fontSize: '0.5625rem', color: isDone ? '#16a34a' : isActive ? '#d97706' : '#d1d5db', textAlign: 'center', mt: 0.25, lineHeight: 1.3 }}>
                                  {isActive ? <PdfElapsedTimer startedAt={s.startedAt} /> : isDone && s.meta ? s.meta : s.detail}
                                </Typography>
                              </Box>
                            )
                          })}
                        </Box>
                      </Box>
                    )}
                    {pdfError && (
                      <Box sx={{ mb: 1.5, px: 1.5, py: 1, bgcolor: '#fef2f2', border: '1px solid #fecaca' }}>
                        <Typography sx={{ fontSize: '0.75rem', color: '#dc2626' }}>{pdfError}</Typography>
                      </Box>
                    )}
                    {pdfTemplates && (
                      <>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.25 }}>
                          <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#7c3aed' }}>
                            {pdfTemplates.length} rules extracted — select to batch-create or click name to write
                          </Typography>
                          <Box component="button" onClick={() => { setPdfTemplates(null); setPdfError(null); setSelectedPdf(new Set()); setTimeout(() => pdfInputRef.current?.click(), 50) }}
                            sx={{ fontSize: '0.6875rem', fontWeight: 600, fontFamily: 'Jost', color: '#7c3aed', bgcolor: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                            Upload different
                          </Box>
                          <input ref={pdfInputRef} type="file" accept=".pdf,.txt,.md" style={{ display: 'none' }} onChange={handlePdfUpload} />
                        </Box>
                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.75 }}>
                          {pdfTemplates.map(t => {
                            const sel   = selectedPdf.has(t.name)
                            const prio  = t.priority ? PRIORITY_COL[t.priority] : undefined
                            const rtCol = RULE_TYPE_COL[t.ruleType] || '#475569'
                            return (
                              <Box key={t.name}
                                onClick={() => togglePdf(t.name)}
                                onMouseEnter={e => handleCardEnter(t, e)}
                                onMouseLeave={handleCardLeave}
                                sx={{ p: 1.25, border: `1px solid ${sel ? '#7c3aed' : '#ddd6fe'}`, bgcolor: sel ? '#f5f3ff' : '#faf5ff', position: 'relative', transition: 'border-color 0.15s, background 0.15s', cursor: 'pointer', '&:hover': { borderColor: sel ? '#7c3aed' : '#a78bfa' }, ...(hoveredCard?.tpl.name === t.name ? { zIndex: 1201 } : {}) }}>
                                {/* Selection tick */}
                                <Box sx={{ position: 'absolute', top: 6, right: 6, width: 14, height: 14, border: `1.5px solid ${sel ? '#7c3aed' : '#c4b5fd'}`, bgcolor: sel ? '#7c3aed' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  {sel && <Box component="span" sx={{ fontSize: 9, color: '#fff', lineHeight: 1 }}>✓</Box>}
                                </Box>
                                {/* Badges */}
                                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 0.5, pr: 2 }}>
                                  <Chip label={t.tag} size="small" sx={{ fontSize: '0.5625rem', fontWeight: 700, borderRadius: 0, height: 15, bgcolor: '#ede9fe', color: '#7c3aed', '& .MuiChip-label': { px: 0.5 } }} />
                                  {t.ruleType && <Chip label={t.ruleType} size="small" sx={{ fontSize: '0.5625rem', fontWeight: 700, borderRadius: 0, height: 15, bgcolor: `${rtCol}15`, color: rtCol, '& .MuiChip-label': { px: 0.5 } }} />}
                                  {prio && <Chip label={t.priority} size="small" sx={{ fontSize: '0.5625rem', fontWeight: 700, borderRadius: 0, height: 15, bgcolor: `${prio}15`, color: prio, '& .MuiChip-label': { px: 0.5 } }} />}
                                </Box>
                                {/* Name */}
                                <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--heading-color)', fontFamily: 'Jost', lineHeight: 1.4 }}>
                                  {t.name}
                                </Typography>
                                {/* CBN ref */}
                                {t.cbkRef && (
                                  <Typography sx={{ fontSize: '0.6875rem', color: '#64748b', mt: 0.25 }}>{t.cbkRef}</Typography>
                                )}
                                {t.dataGaps && t.dataGaps.length > 0 && (
                                  <Typography sx={{ fontSize: '0.5625rem', color: '#d97706', mt: 0.375, fontWeight: 600 }}>
                                    ⚠ {t.dataGaps.length} field{t.dataGaps.length > 1 ? 's' : ''} not captured
                                  </Typography>
                                )}
                              </Box>
                            )
                          })}
                        </Box>
                      </>
                    )}
                  </Box>
                  {selectedPdf.size > 0 && pdfTemplates && !batchProgress && (
                    <Box sx={{ px: 2, py: 1.5, borderTop: '1px solid #ddd6fe', bgcolor: '#faf5ff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#7c3aed' }}>
                        {selectedPdf.size} rule{selectedPdf.size > 1 ? 's' : ''} selected
                      </Typography>
                      <Button variant="contained" size="small" disabled={batchCreating}
                        onClick={() => handleBatchCreate(
                          pdfTemplates.filter(t => selectedPdf.has(t.name)).map(t => ({ name: t.name, policy: t.policy }))
                        )}
                        sx={{ textTransform: 'none', fontWeight: 700, fontFamily: 'Jost', borderRadius: 0, boxShadow: 'none', bgcolor: '#7c3aed', fontSize: '0.75rem', '&:hover': { bgcolor: '#6d28d9', boxShadow: 'none' } }}>
                        Create {selectedPdf.size} rule{selectedPdf.size > 1 ? 's' : ''}
                      </Button>
                    </Box>
                  )}
                  {batchProgress && (
                    <Box sx={{ px: 2, py: 1.25, borderTop: '1px solid #ddd6fe', display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CircularProgress size={14} sx={{ color: '#7c3aed' }} />
                      <Typography sx={{ fontSize: '0.75rem', color: '#7c3aed', fontWeight: 600 }}>
                        Creating {batchProgress.done}/{batchProgress.total}…
                      </Typography>
                    </Box>
                  )}
                </Box>
              )}
            </Box>

            {/* Rule name — always visible */}
            <TextField label="Rule name" size="small" fullWidth value={name} onChange={e => setName(e.target.value)}
              InputProps={{ sx: { borderRadius: 0, fontFamily: 'Jost' } }} InputLabelProps={{ sx: { fontFamily: 'Jost' } }} />

            <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'flex-end' }}>
              <Button onClick={onCancel} sx={{ textTransform: 'none', fontWeight: 600, fontFamily: 'Jost', borderRadius: 0, color: 'var(--on-surface-variant)', border: '1px solid var(--border-col)' }}>Cancel</Button>
              <Button variant="contained" disabled={!name.trim() || !policy.trim()} onClick={handleSubmitPolicy}
                sx={{ bgcolor: '#2563eb', color: '#fff', textTransform: 'none', fontWeight: 700, fontFamily: 'Jost', boxShadow: 'none', borderRadius: 0, '&:hover': { bgcolor: '#1d4ed8', boxShadow: 'none' }, '&.Mui-disabled': { bgcolor: '#2563eb', color: '#fff', opacity: 0.45 } }}>
                Analyse policy →
              </Button>
            </Box>
          </Stack>
        )}

        {/* ── Step 2: comprehend ────────────────────────────────── */}
        {step === 'comprehend' && (
          <Stack gap={2.5}>
            <Box>
              <Typography sx={{ fontSize: '1.125rem', fontWeight: 700, fontFamily: 'Jost', color: 'var(--heading-color)', mb: 0.5 }}>Verify understanding</Typography>
              <Typography sx={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)', lineHeight: 1.6 }}>Review what the engine understood from your policy. Confirm or go back to edit.</Typography>
            </Box>
            <RulePolicyQuote text={policy} />
            {!comprehension ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 2 }}>
                <CircularProgress size={18} sx={{ color: colorPalette.primary }} />
                <Typography sx={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)', fontFamily: 'Jost' }}>Analysing…</Typography>
              </Box>
            ) : (
              <Stack gap={2}>
                <RuleComprehensionPills field={comprehension.field} op={comprehension.op} value={comprehension.value} />
                <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'flex-end', mt: 1 }}>
                  <Button onClick={() => { abortRef.current?.abort(); setStep('write'); setComprehension(null) }}
                    sx={{ textTransform: 'none', fontWeight: 600, fontFamily: 'Jost', borderRadius: 0, color: 'var(--on-surface-variant)', border: '1px solid var(--border-col)' }}>
                    Edit policy
                  </Button>
                  <Button variant="contained" onClick={handleApproveComprehension}
                    sx={{ bgcolor: colorPalette.primary, color: '#fff', textTransform: 'none', fontWeight: 700, fontFamily: 'Jost', boxShadow: 'none', borderRadius: 0, '&:hover': { bgcolor: colorPalette.primary, filter: 'brightness(0.9)', boxShadow: 'none' } }}>
                    Correct — generate function →
                  </Button>
                </Box>
              </Stack>
            )}
          </Stack>
        )}

        {/* ── Step 3: generate ──────────────────────────────────── */}
        {step === 'generate' && (
          <Stack gap={2.5}>
            {!isEdit && (
              <Box>
                <Typography sx={{ fontSize: '1.125rem', fontWeight: 700, fontFamily: 'Jost', color: 'var(--heading-color)', mb: 0.5 }}>Rule summary</Typography>
                <Typography sx={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)' }}>Review what this rule will enforce before saving.</Typography>
              </Box>
            )}

            {isEdit && (
              <Box>
                <Typography sx={{ fontSize: '1.125rem', fontWeight: 700, fontFamily: 'Jost', color: 'var(--heading-color)', mb: 0.5 }}>Edit rule</Typography>
              </Box>
            )}

            {/* Edit mode: editable condition fields */}
            {isEdit && (
              <Stack gap={1.5}>
                <FormControl size="small" fullWidth>
                  <InputLabel sx={{ fontSize: '0.8125rem' }}>Field</InputLabel>
                  <Select value={editField} label="Field" onChange={e => handleEditFieldChange(e.target.value)} sx={{ borderRadius: 0, fontSize: '0.8125rem' }}>
                    {FIELD_GROUPS.map(group => [
                      <MenuItem key={group.label} disabled sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em', py: 0.5 }}>{group.label}</MenuItem>,
                      ...group.fields.map(f => (
                        <MenuItem key={f} value={f} sx={{ fontSize: '0.8125rem', pl: 3, fontFamily: 'SF Mono, Monaco, monospace' }}>
                          <Box><Box>{FIELD_META[f]?.label ?? f}</Box><Box sx={{ fontSize: '0.625rem', color: '#94a3b8' }}>{f}</Box></Box>
                        </MenuItem>
                      )),
                    ])}
                  </Select>
                </FormControl>
                {editField && (
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                    <FormControl size="small" fullWidth>
                      <InputLabel sx={{ fontSize: '0.8125rem' }}>Condition</InputLabel>
                      <Select value={editOp} label="Condition" onChange={e => setEditOp(e.target.value as RuleOp)} sx={{ borderRadius: 0, fontSize: '0.8125rem' }}>
                        {editOps.map(o => <MenuItem key={o} value={o} sx={{ fontSize: '0.8125rem' }}>{OP_LABELS[o]}</MenuItem>)}
                      </Select>
                    </FormControl>
                    {editFieldType === 'boolean' ? (
                      <FormControl size="small" fullWidth>
                        <InputLabel sx={{ fontSize: '0.8125rem' }}>Value</InputLabel>
                        <Select value={editValue} label="Value" onChange={e => setEditValue(e.target.value)} sx={{ borderRadius: 0, fontSize: '0.8125rem' }}>
                          <MenuItem value="true">Yes (true)</MenuItem>
                          <MenuItem value="false">No (false)</MenuItem>
                        </Select>
                      </FormControl>
                    ) : editMeta?.enum ? (
                      <FormControl size="small" fullWidth>
                        <InputLabel sx={{ fontSize: '0.8125rem' }}>Value</InputLabel>
                        <Select value={editValue} label="Value" onChange={e => setEditValue(e.target.value)} sx={{ borderRadius: 0, fontSize: '0.8125rem' }}>
                          {editMeta.enum.map(v => <MenuItem key={v} value={v} sx={{ fontSize: '0.8125rem' }}>{v}</MenuItem>)}
                        </Select>
                      </FormControl>
                    ) : (
                      <TextField size="small" label={editMeta?.unit ? `Value (${editMeta.unit})` : 'Value'}
                        type={editFieldType === 'number' ? 'number' : 'text'}
                        value={editValue} onChange={e => setEditValue(e.target.value)}
                        placeholder={String(editMeta?.example ?? '')}
                        InputProps={{ sx: { borderRadius: 0, fontSize: '0.8125rem', fontFamily: 'SF Mono, Monaco, monospace' } }}
                        InputLabelProps={{ sx: { fontSize: '0.8125rem' } }}
                      />
                    )}
                  </Box>
                )}
              </Stack>
            )}

            {/* Rule summary — plain language, no code exposed */}
            {functionReady
              ? <RuleSummaryView policy={policy} comprehension={comprehension} />
              : <Box sx={{ p: 2.5, border: '1px solid var(--border-col)', bgcolor: 'var(--section-bg)', display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <CircularProgress size={14} sx={{ color: colorPalette.primary }} />
                  <Typography sx={{ fontSize: '0.8125rem', color: '#94a3b8', fontFamily: 'Jost' }}>Building rule summary…</Typography>
                </Box>
            }

            {/* Name + save — shown once code is ready */}
            {functionReady && (
              <Stack gap={1.5}>
                <TextField label="Rule name" size="small" fullWidth value={name} onChange={e => setName(e.target.value)}
                  InputProps={{ sx: { borderRadius: 0, fontFamily: 'Jost' } }} InputLabelProps={{ sx: { fontFamily: 'Jost' } }} />
                <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'flex-end' }}>
                  {!isEdit && (
                    <Button onClick={() => { setStep('comprehend') }}
                      sx={{ textTransform: 'none', fontWeight: 600, fontFamily: 'Jost', borderRadius: 0, color: 'var(--on-surface-variant)', border: '1px solid var(--border-col)' }}>
                      Back
                    </Button>
                  )}
                  {isEdit && (
                    <Button onClick={onCancel} disabled={saving}
                      sx={{ textTransform: 'none', fontWeight: 600, fontFamily: 'Jost', borderRadius: 0, color: 'var(--on-surface-variant)', border: '1px solid var(--border-col)' }}>
                      Cancel
                    </Button>
                  )}
                  <Button variant="contained" disabled={saving || (isEdit && (!editField || !editOp || !editValue)) || (!isEdit && !comprehension) || !name.trim()} onClick={handleSave}
                    sx={{ bgcolor: colorPalette.primary, color: '#fff', textTransform: 'none', fontWeight: 700, fontFamily: 'Jost', boxShadow: 'none', borderRadius: 0, '&:hover': { bgcolor: colorPalette.primary, filter: 'brightness(0.9)', boxShadow: 'none' } }}>
                    {saving ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : (isEdit ? 'Save changes' : 'Add rule')}
                  </Button>
                </Box>
              </Stack>
            )}
          </Stack>
        )}
      </Box>

      <TemplateHoverPopup
        hoveredCard={hoveredCard}
        selected={hoveredCard ? (inputTab === 'import' ? selectedPdf : selectedTpl).has(hoveredCard.tpl.name) : false}
        primaryColor={inputTab === 'import' ? '#7c3aed' : '#2563eb'}
        onPopupEnter={() => { if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current) }}
        onPopupLeave={() => setHoveredCard(null)}
        onClose={() => setHoveredCard(null)}
        onToggleSelect={() => hoveredCard && (inputTab === 'import' ? togglePdf : toggleTpl)(hoveredCard.tpl.name)}
        onUseTemplate={tpl => { setName(tpl.name); handlePolicyChange(tpl.policy); setInputTab('write') }}
      />
    </Box>
  )
}

const DEFAULT_RULE_PREVIEWS = [
  { field: 'txn.amount',               op: 'GT',  value: '1000000', label: 'Amount > ₦1,000,000' },
  { field: 'customer.riskScore',       op: 'GT',  value: '80',      label: 'Risk score > 80' },
  { field: 'customer.accountAgeDays',  op: 'LT',  value: '30',      label: 'Account age < 30 days' },
  { field: 'context.recipientFirstTime', op: 'EQ', value: 'true',   label: 'First-time recipient' },
  { field: 'context.ipCountryCode',    op: 'NEQ', value: 'NG',      label: 'IP origin ≠ Nigeria' },
]

const nsColors: Record<string, { bg: string; color: string }> = {
  transaction: { bg: '#f0f9ff', color: '#0369a1' },
  customer:    { bg: '#faf5ff', color: '#7c3aed' },
  context:     { bg: '#f0fdfa', color: '#0f766e' },
}

function PipelineModal({
  initial, onSave, onClose,
}: {
  initial?: MonitoringPipeline
  onSave:   (name: string, desc: string, logic: PipelineLogic, withDefaults: boolean) => Promise<void>
  onClose:  () => void
}) {
  const [name,      setName]      = useState(initial?.name        ?? '')
  const [desc,      setDesc]      = useState(initial?.description ?? '')
  const [logic,     setLogic]     = useState<PipelineLogic>(initial?.logic ?? 'OR')
  const [saving,    setSaving]    = useState(false)
  const [nameError, setNameError] = useState(false)

  const isEdit = !!initial

  const handleSave = async () => {
    if (!name.trim()) { setNameError(true); return }
    setSaving(true)
    try { await onSave(name.trim(), desc.trim(), logic, false) }
    finally { setSaving(false) }
  }

  const logicOptions: { value: PipelineLogic; title: string; subtitle: string; detail: string; icon: string }[] = [
    {
      value: 'AND',
      title: 'ALL rules match',
      subtitle: 'AND logic',
      detail: 'The pipeline fires only when every enabled rule is satisfied. More precise — fewer false positives.',
      icon: '⊕',
    },
    {
      value: 'OR',
      title: 'ANY rule matches',
      subtitle: 'OR logic',
      detail: 'The pipeline fires when at least one rule is satisfied. More sensitive — catches broader risk patterns.',
      icon: '⊗',
    },
  ]

  return (
    <>
      {/* Backdrop */}
      <Box
        onClick={onClose}
        sx={{
          position: 'fixed', inset: 0, zIndex: 1300,
          bgcolor: 'rgba(15,23,42,0.6)',
          backdropFilter: 'blur(3px)',
          animation: 'fadeIn 0.2s ease',
          '@keyframes fadeIn': { from: { opacity: 0 }, to: { opacity: 1 } },
        }}
      />

      {/* Modal */}
      <Box sx={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '100%', maxWidth: 640,
        maxHeight: '90vh', overflowY: 'auto',
        bgcolor: 'var(--card-bg)',
        zIndex: 1301,
        boxShadow: '0 32px 80px rgba(15,23,42,0.22), 0 0 0 1px rgba(15,23,42,0.06)',
        animation: 'modalIn 0.25s cubic-bezier(0.34,1.56,0.64,1)',
        '@keyframes modalIn': {
          from: { opacity: 0, transform: 'translate(-50%, -48%) scale(0.95)' },
          to:   { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' },
        },
      }}>
        {/* Header */}
        <Box sx={{ px: 3, pt: 3, pb: 2.5, borderBottom: '1px solid var(--border-col)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
            <Box sx={{
              width: 40, height: 40, flexShrink: 0,
              bgcolor: `${colorPalette.primary}14`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <ShieldOutlinedIcon sx={{ fontSize: '1.25rem', color: colorPalette.primary }} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: '0.5625rem', fontWeight: 800, color: colorPalette.primary, textTransform: 'uppercase', letterSpacing: '0.16em', mb: 0.25 }}>
                {isEdit ? 'Editing pipeline' : 'New pipeline'}
              </Typography>
              <Typography sx={{ fontSize: '1.0625rem', fontWeight: 700, fontFamily: 'Jost', color: 'var(--heading-color)', lineHeight: 1.2 }}>
                {isEdit ? `Update "${initial.name}"` : 'Set up a monitoring pipeline'}
              </Typography>
              {!isEdit && (
                <Typography sx={{ fontSize: '0.8125rem', color: '#64748b', mt: 0.375 }}>
                  A pipeline groups rules that evaluate every incoming transaction.
                </Typography>
              )}
            </Box>
          </Box>
          <IconButton size="small" onClick={onClose} disabled={saving}
            sx={{ borderRadius: 0, color: '#94a3b8', mt: -0.5, mr: -0.5, '&:hover': { color: colorPalette.primary, bgcolor: 'transparent' } }}>
            <CloseRoundedIcon sx={{ fontSize: '1.125rem' }} />
          </IconButton>
        </Box>

        {/* Body */}
        <Box sx={{ px: 3, py: 3 }}>
          <Stack gap={3}>
            {/* Name */}
            <Box>
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.875 }}>
                Pipeline name <Box component="span" sx={{ color: '#ef4444' }}>*</Box>
              </Typography>
              <TextField
                fullWidth size="small" autoFocus
                value={name} onChange={e => { setName(e.target.value); setNameError(false) }}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                placeholder="e.g. Transaction Monitor"
                error={nameError}
                helperText={nameError ? 'Pipeline name is required' : ''}
                InputProps={{ sx: { borderRadius: 0, fontSize: '0.9375rem', fontFamily: 'Jost', fontWeight: 600 } }}
              />
            </Box>

            {/* Description */}
            <Box>
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.875 }}>
                Description <Box component="span" sx={{ color: '#94a3b8', fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: '0.75rem' }}>(optional)</Box>
              </Typography>
              <TextField
                fullWidth size="small" multiline rows={2}
                value={desc} onChange={e => setDesc(e.target.value)}
                placeholder="Describe what this pipeline does"
                InputProps={{ sx: { borderRadius: 0, fontSize: '0.875rem' } }}
              />
            </Box>

            {/* Logic selector */}
            <Box>
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 1 }}>
                How should rules combine?
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                {logicOptions.map(opt => {
                  const selected = logic === opt.value
                  return (
                    <Box
                      key={opt.value}
                      onClick={() => setLogic(opt.value)}
                      sx={{
                        px: 2, py: 1.75, cursor: 'pointer',
                        border: `2px solid ${selected ? colorPalette.primary : 'var(--border-col)'}`,
                        bgcolor: selected ? `${colorPalette.primary}08` : 'var(--section-bg)',
                        transition: 'all 0.15s',
                        '&:hover': { borderColor: colorPalette.primary, bgcolor: `${colorPalette.primary}06` },
                        position: 'relative',
                      }}>
                      {selected && (
                        <Box sx={{
                          position: 'absolute', top: 8, right: 8,
                          width: 16, height: 16, borderRadius: '50%',
                          bgcolor: colorPalette.primary,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#fff' }} />
                        </Box>
                      )}
                      <Chip label={opt.subtitle} size="small" sx={{
                        mb: 1, height: 18, fontSize: '0.5625rem', fontWeight: 800,
                        letterSpacing: '0.12em', borderRadius: 0,
                        bgcolor: selected ? colorPalette.primary : 'var(--border-col)',
                        color:   selected ? '#fff' : '#64748b',
                        textTransform: 'uppercase',
                      }} />
                      <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, fontFamily: 'Jost', color: 'var(--heading-color)', mb: 0.5 }}>
                        {opt.title}
                      </Typography>
                      <Typography sx={{ fontSize: '0.75rem', color: '#64748b', lineHeight: 1.5 }}>
                        {opt.detail}
                      </Typography>
                    </Box>
                  )
                })}
              </Box>
            </Box>

          </Stack>
        </Box>

        {/* Footer */}
        <Box sx={{ px: 3, py: 2.5, borderTop: '1px solid var(--border-col)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: 'var(--section-bg)' }}>
          <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            {isEdit ? 'Changes apply immediately.' : 'You can add rules after creation.'}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button onClick={onClose} disabled={saving}
              sx={{ borderRadius: 0, border: '1px solid var(--border-col)', color: 'var(--on-surface-variant)', textTransform: 'none', fontWeight: 600, fontFamily: 'Jost', px: 2.5 }}>
              Cancel
            </Button>
            <Button variant="contained" onClick={handleSave} disabled={saving || !name.trim()}
              sx={{ borderRadius: 0, bgcolor: colorPalette.primary, color: '#fff !important', boxShadow: 'none', textTransform: 'none', fontWeight: 700, fontFamily: 'Jost', px: 3, whiteSpace: 'nowrap',
                    '&:hover': { bgcolor: colorPalette.primary, filter: 'brightness(0.9)', boxShadow: 'none' } }}>
              {saving
                ? <><CircularProgress size={13} sx={{ color: '#fff', mr: 1 }} /> Saving…</>
                : isEdit ? 'Save changes' : 'Create pipeline'
              }
            </Button>
          </Box>
        </Box>
      </Box>
    </>
  )
}

function DeleteConfirmModal({
  pipeline, onConfirm, onClose, deleting,
}: {
  pipeline:  MonitoringPipeline
  onConfirm: () => void
  onClose:   () => void
  deleting:  boolean
}) {
  return (
    <>
      <Box onClick={onClose}
        sx={{ position: 'fixed', inset: 0, zIndex: 1300, bgcolor: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(2px)',
              animation: 'fadeIn 0.18s ease', '@keyframes fadeIn': { from: { opacity: 0 }, to: { opacity: 1 } } }} />
      <Box sx={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        width: '100%', maxWidth: 420,
        bgcolor: 'var(--card-bg)',
        zIndex: 1301,
        boxShadow: '0 24px 64px rgba(15,23,42,0.18), 0 0 0 1px rgba(15,23,42,0.07)',
        animation: 'modalIn 0.22s cubic-bezier(0.34,1.4,0.64,1)',
        '@keyframes modalIn': {
          from: { opacity: 0, transform: 'translate(-50%,-48%) scale(0.95)' },
          to:   { opacity: 1, transform: 'translate(-50%,-50%) scale(1)' },
        },
      }}>
        {/* Icon + heading */}
        <Box sx={{ px: 3, pt: 3, pb: 2.5 }}>
          <Box sx={{ width: 40, height: 40, bgcolor: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
            <DeleteOutlineRoundedIcon sx={{ fontSize: '1.25rem', color: '#dc2626' }} />
          </Box>
          <Typography sx={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'Jost', color: 'var(--heading-color)', mb: 0.625 }}>
            Delete pipeline?
          </Typography>
          <Typography sx={{ fontSize: '0.875rem', color: '#64748b', lineHeight: 1.6 }}>
            <Box component="span" sx={{ fontWeight: 700, color: 'var(--on-surface)' }}>"{pipeline.name}"</Box>
            {' '}and all {pipeline.rules.length} rule{pipeline.rules.length !== 1 ? 's' : ''} inside it will be permanently removed. This cannot be undone.
          </Typography>
        </Box>

        {/* Footer */}
        <Box sx={{ px: 3, pb: 3, display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          <Button onClick={onClose} disabled={deleting}
            sx={{ borderRadius: 0, border: '1px solid var(--border-col)', color: 'var(--on-surface-variant)', textTransform: 'none', fontWeight: 600, fontFamily: 'Jost', px: 2.5 }}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={deleting}
            sx={{ borderRadius: 0, bgcolor: '#dc2626', color: '#fff', textTransform: 'none', fontWeight: 700, fontFamily: 'Jost', px: 2.5, boxShadow: 'none',
                  '&:hover': { bgcolor: '#b91c1c' }, '&.Mui-disabled': { bgcolor: '#fca5a5', color: '#fff' } }}>
            {deleting
              ? <><CircularProgress size={13} sx={{ color: '#fff', mr: 1 }} />Deleting…</>
              : 'Delete pipeline'}
          </Button>
        </Box>
      </Box>
    </>
  )
}

function JsonPre({ content }: { content: string }) {
  return (
    <Box component="pre" sx={{ m: 0, p: 2, fontSize: '0.75rem', lineHeight: 1.7, fontFamily: 'SF Mono, Monaco, Consolas, monospace', color: 'var(--on-surface)', bgcolor: 'var(--card-bg)', overflowX: 'auto', maxHeight: 380, overflowY: 'auto', whiteSpace: 'pre' }}>
      {content.split('\n').map((line, i) => {
        const isSection = /^  "[a-z]+":\s*\{/.test(line)
        const isKey     = /"[^"]+":/.test(line) && !['type','required','description','example','enum','range','unit'].some(k => line.trim().startsWith(`"${k}"`))
        return (
          <Box component="span" key={i} sx={{ display: 'block' }}>
            <Box component="span" sx={{ color: isSection ? colorPalette.primary : isKey ? '#7c3aed' : line.includes(': true') ? '#10b981' : line.includes(': false') ? '#ef4444' : line.includes('"string"') || line.includes('"number"') || line.includes('"boolean"') ? '#0369a1' : /:\s*\d/.test(line) ? '#d97706' : /:\s*"/.test(line) ? '#15803d' : 'var(--on-surface)' }}>
              {line}
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}

function DeveloperPanel({ pipeline }: { pipeline: MonitoringPipeline }) {
  const [tab,        setTab]        = useState<'schema' | 'example' | 'try'>('try')
  const [copied,     setCopied]     = useState(false)
  const [reqBody,    setReqBody]    = useState(() => JSON.stringify(buildExamplePayload(pipeline), null, 2))
  const [sending,    setSending]    = useState(false)
  const [response,   setResponse]   = useState<object | null>(null)
  const [reqError,   setReqError]   = useState<string | null>(null)

  // Reset request body when pipeline changes
  useEffect(() => {
    setReqBody(JSON.stringify(buildExamplePayload(pipeline), null, 2))
    setResponse(null)
    setReqError(null)
  }, [pipeline.id])

  const schema  = buildPayloadSchema(pipeline)
  const example = buildExamplePayload(pipeline)
  const refContent = JSON.stringify(tab === 'schema' ? schema : example, null, 2)

  const copy = () => {
    const text = tab === 'try' ? reqBody : refContent
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const sendRequest = async () => {
    setReqError(null)
    setResponse(null)
    setSending(true)
    try {
      const parsed = JSON.parse(reqBody)
      const result = await monitoringApi.evaluatePipeline(pipeline.id, parsed)
      setResponse(result)
    } catch (e: any) {
      setReqError(e.message ?? 'Request failed')
    } finally {
      setSending(false)
    }
  }

  const enabledCount = pipeline.rules.filter(r => r.enabled).length
  const verdict = response && 'verdict' in response ? (response as any).verdict as string : null

  const TABS = [
    { key: 'try',     label: 'Try it' },
    { key: 'schema',  label: 'Schema' },
    { key: 'example', label: 'Example' },
  ] as const

  return (
    <Box sx={{ border: '1px solid var(--border-col)' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1, borderBottom: '1px solid var(--border-col)', bgcolor: 'var(--section-bg)' }}>
        <Chip label={`${enabledCount} active rule${enabledCount !== 1 ? 's' : ''}`} size="small"
          sx={{ height: 18, fontSize: '0.5625rem', fontWeight: 700, bgcolor: enabledCount > 0 ? '#eff6ff' : 'var(--border-col)', color: enabledCount > 0 ? '#2563eb' : '#94a3b8', borderRadius: 0 }} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ display: 'flex', border: '1px solid var(--border-col)', overflow: 'hidden' }}>
            {TABS.map(t => (
              <Box key={t.key} onClick={() => setTab(t.key)} sx={{ px: 1.5, py: 0.5, cursor: 'pointer', fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', bgcolor: tab === t.key ? colorPalette.primary : 'transparent', color: tab === t.key ? '#fff' : 'var(--on-surface-variant)', transition: 'all 0.15s', borderRight: '1px solid var(--border-col)', '&:last-child': { borderRight: 'none' } }}>
                {t.label}
              </Box>
            ))}
          </Box>
          <Tooltip title={copied ? 'Copied!' : 'Copy'}>
            <IconButton size="small" onClick={copy} sx={{ borderRadius: 0, color: '#94a3b8', '&:hover': { color: colorPalette.primary } }}>
              <ContentCopyRoundedIcon sx={{ fontSize: '0.875rem' }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Try it tab */}
      {tab === 'try' && (
        <Box>
          {/* Endpoint + headers */}
          <Box sx={{ bgcolor: '#0f172a', borderBottom: '1px solid var(--border-col)' }}>
            {/* Method + path */}
            <Box sx={{ px: 2, py: 1.25, borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Chip label="POST" size="small" sx={{ height: 20, fontSize: '0.625rem', fontWeight: 800, borderRadius: 0, bgcolor: '#16a34a', color: '#fff', '& .MuiChip-label': { px: 1 } }} />
              <Typography sx={{ fontSize: '0.75rem', fontFamily: 'SF Mono, Monaco, monospace', color: '#94a3b8' }}>
                /api/v1/monitoring/pipelines/<Box component="span" sx={{ color: '#fde68a' }}>{pipeline.id}</Box>/evaluate
              </Typography>
            </Box>
            {/* Headers */}
            <Box sx={{ px: 2, py: 1.25 }}>
              <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.75 }}>Headers</Typography>
              {[
                { key: 'Content-Type',   val: 'application/json' },
                { key: 'Authorization',  val: 'Bearer <your-api-key>' },
              ].map(({ key, val }) => (
                <Box key={key} sx={{ display: 'flex', gap: 2, fontFamily: 'SF Mono, Monaco, monospace', fontSize: '0.6875rem', lineHeight: 1.9 }}>
                  <Box component="span" sx={{ color: '#7dd3fc', minWidth: 140 }}>{key}</Box>
                  <Box component="span" sx={{ color: '#94a3b8' }}>{val}</Box>
                </Box>
              ))}
            </Box>
          </Box>

          {/* Request body editor */}
          <Box sx={{ position: 'relative' }}>
            <Box sx={{ px: 2, pt: 1, pb: 0.5, bgcolor: 'var(--section-bg)', borderBottom: '1px solid var(--border-col)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Request body</Typography>
            </Box>
            <textarea
              value={reqBody}
              onChange={e => setReqBody(e.target.value)}
              rows={14}
              spellCheck={false}
              style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'SF Mono, Monaco, Consolas, monospace', fontSize: '0.75rem', lineHeight: 1.7, padding: '12px 16px', border: 'none', borderBottom: '1px solid var(--border-col)', outline: 'none', color: 'var(--on-surface)', backgroundColor: 'var(--card-bg)' }}
            />
          </Box>

          {/* Send button */}
          <Box sx={{ px: 2, py: 1.25, bgcolor: 'var(--section-bg)', borderBottom: '1px solid var(--border-col)', display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="contained" disabled={sending} onClick={sendRequest}
              startIcon={sending ? <CircularProgress size={13} sx={{ color: '#fff' }} /> : undefined}
              sx={{ borderRadius: 0, bgcolor: colorPalette.primary, color: '#fff', textTransform: 'none', fontWeight: 700, fontFamily: 'Jost', boxShadow: 'none', fontSize: '0.8125rem', '&:hover': { bgcolor: colorPalette.primary, filter: 'brightness(0.9)', boxShadow: 'none' } }}>
              {sending ? 'Sending…' : 'Send →'}
            </Button>
          </Box>

          {/* Error */}
          {reqError && (
            <Box sx={{ px: 2, py: 1.5, bgcolor: '#fef2f2', borderBottom: '1px solid #fecaca' }}>
              <Typography sx={{ fontSize: '0.8125rem', color: '#dc2626', fontFamily: 'SF Mono, Monaco, monospace' }}>{reqError}</Typography>
            </Box>
          )}

          {/* Response */}
          {response && (() => {
            const res     = response as any
            const action  = res.action  as 'HOLD' | 'RELEASE'
            const reason  = res.reason  as string | null
            const isHold  = action === 'HOLD'
            return (
              <Box>
                {/* Action banner */}
                <Box sx={{ px: 2.5, py: 2, bgcolor: isHold ? '#fef2f2' : '#f0fdf4', borderBottom: '1px solid var(--border-col)', display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Box sx={{ px: 1.25, py: 0.375, fontSize: '0.75rem', fontWeight: 800, fontFamily: 'Jost', letterSpacing: '0.08em', color: '#fff', bgcolor: isHold ? '#dc2626' : '#16a34a' }}>
                        {action}
                      </Box>
                      <Chip label={res.verdict} size="small" sx={{ height: 18, fontSize: '0.5625rem', fontWeight: 700, borderRadius: 0, bgcolor: isHold ? '#fee2e2' : '#dcfce7', color: isHold ? '#b91c1c' : '#15803d', '& .MuiChip-label': { px: 0.75 } }} />
                      <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', fontFamily: 'Jost' }}>
                        {res.triggered}/{res.total} rule{res.total !== 1 ? 's' : ''} triggered · {res.logic} logic
                      </Typography>
                    </Box>
                    {isHold && reason && (
                      <Typography sx={{ fontSize: '0.8125rem', color: '#7f1d1d', lineHeight: 1.65, mt: 0.5 }}>
                        {reason}
                      </Typography>
                    )}
                    {!isHold && (
                      <Typography sx={{ fontSize: '0.8125rem', color: '#14532d', lineHeight: 1.65, mt: 0.5 }}>
                        No rules triggered. Transaction may proceed.
                      </Typography>
                    )}
                  </Box>
                </Box>

                {/* Rule-by-rule breakdown */}
                {res.rules?.length > 0 && (
                  <Box sx={{ borderBottom: '1px solid var(--border-col)' }}>
                    {res.rules.map((r: any) => (
                      <Box key={r.id} sx={{ px: 2, py: 1.125, borderBottom: '1px solid var(--border-col)', '&:last-child': { borderBottom: 'none' }, bgcolor: r.matched ? '#f0fdf4' : 'var(--card-bg)' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: r.matched && r.reason ? 0.375 : 0 }}>
                          <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: r.matched ? '#16a34a' : '#d1d5db', flexShrink: 0 }} />
                          <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--heading-color)', fontFamily: 'Jost', flex: 1 }}>{r.name}</Typography>
                          <Typography sx={{ fontSize: '0.6875rem', fontFamily: 'SF Mono, Monaco, monospace', color: '#94a3b8' }}>
                            {r.field} {r.op} {r.value}
                          </Typography>
                          <Typography sx={{ fontSize: '0.6875rem', fontFamily: 'SF Mono, Monaco, monospace', color: r.matched ? '#16a34a' : '#94a3b8', minWidth: 80, textAlign: 'right' }}>
                            actual: {r.actual ?? '—'}
                          </Typography>
                        </Box>
                        {r.matched && r.reason && (
                          <Typography sx={{ fontSize: '0.6875rem', color: '#15803d', ml: 2.5, lineHeight: 1.5 }}>{r.reason}</Typography>
                        )}
                      </Box>
                    ))}
                  </Box>
                )}

                <JsonPre content={JSON.stringify(response, null, 2)} />
              </Box>
            )
          })()}
        </Box>
      )}

      {/* Schema / Example tabs */}
      {(tab === 'schema' || tab === 'example') && (
        <Box>
          <Box sx={{ px: 2, pt: 1, pb: 0.5, bgcolor: 'var(--section-bg)', borderBottom: '1px solid var(--border-col)' }}>
            <Typography sx={{ fontSize: '0.6875rem', color: '#64748b', lineHeight: 1.6 }}>
              {tab === 'schema'
                ? `Fields required by the "${pipeline.name}" pipeline.`
                : `Example payload for "${pipeline.name}". Use this as a starting point in Try it.`}
            </Typography>
          </Box>
          <JsonPre content={refContent} />
          <Box sx={{ px: 2, py: 1, borderTop: '1px solid var(--border-col)', bgcolor: 'var(--section-bg)' }}>
            <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8' }}>
              Schema updates automatically as you add or remove rules.
            </Typography>
          </Box>
        </Box>
      )}
    </Box>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TransactionMonitoringPage() {
  const { role } = useRbac()
  const canModify = role === 'cco' || role === 'admin'

  const [pipelines,    setPipelines]    = useState<MonitoringPipeline[]>([])
  const [selected,     setSelected]     = useState<MonitoringPipeline | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [showNewPipeline, setShowNewPipeline] = useState(false)
  const [editingPipeline, setEditingPipeline] = useState<MonitoringPipeline | null>(null)
  const [addingRule,   setAddingRule]   = useState(false)
  const [editingRule,  setEditingRule]  = useState<MonitoringRule | null>(null)
  const [devOpen,        setDevOpen]        = useState(false)
  const [deletingPipeline, setDeletingPipeline] = useState<MonitoringPipeline | null>(null)
  const [deleteInProgress, setDeleteInProgress] = useState(false)
  const [error,          setError]          = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { pipelines: ps } = await monitoringApi.listPipelines()
      setPipelines(ps)
      setSelected(prev => prev ? (ps.find(p => p.id === prev.id) ?? ps[0] ?? null) : (ps[0] ?? null))
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleCreatePipeline = async (name: string, desc: string, logic: PipelineLogic, withDefaults: boolean) => {
    const { pipeline } = await monitoringApi.createPipeline(name, desc, logic, withDefaults)
    setShowNewPipeline(false)
    await load()
    setSelected(pipeline)
  }

  const handleUpdatePipeline = async (name: string, desc: string, logic: PipelineLogic, _: boolean) => {
    if (!editingPipeline) return
    await monitoringApi.updatePipeline(editingPipeline.id, name, desc, logic, editingPipeline.status)
    setEditingPipeline(null)
    await load()
  }

  const handleDeletePipeline = (p: MonitoringPipeline) => {
    setDeletingPipeline(p)
  }

  const confirmDeletePipeline = async () => {
    if (!deletingPipeline) return
    setDeleteInProgress(true)
    try {
      await monitoringApi.deletePipeline(deletingPipeline.id)
      setDeletingPipeline(null)
      await load()
    } finally {
      setDeleteInProgress(false)
    }
  }

  const handleToggleStatus = async (p: MonitoringPipeline) => {
    const next: PipelineStatus = p.status === 'active' ? 'inactive' : 'active'
    await monitoringApi.updatePipeline(p.id, p.name, p.description ?? '', p.logic, next)
    await load()
  }

  const handleAddRule = async (name: string, field: string, op: RuleOp, value: string, policy: string | null, code: string | null, position: number) => {
    if (!selected) return
    await monitoringApi.addRule(selected.id, name, field, op, value, policy, code, position)
    setAddingRule(false)
    await load()
  }

  const handleUpdateRule = async (name: string, field: string, op: RuleOp, value: string, _policy: string | null, _code: string | null, position: number) => {
    if (!selected || !editingRule) return
    await monitoringApi.updateRule(selected.id, editingRule.id, name, field, op, value, editingRule.enabled, position)
    setEditingRule(null)
    await load()
  }

  const handleToggleRule = async (rule: MonitoringRule, enabled: boolean) => {
    if (!selected) return
    await monitoringApi.updateRule(selected.id, rule.id, rule.name, rule.field, rule.op, rule.value, enabled, rule.position)
    await load()
  }

  const handleDeleteRule = async (rule: MonitoringRule) => {
    if (!selected) return
    await monitoringApi.deleteRule(selected.id, rule.id)
    await load()
  }

  if (loading) return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <CircularProgress size={28} sx={{ color: colorPalette.primary }} />
    </Box>
  )

  if (error) return (
    <Box sx={{ p: 4 }}>
      <Typography sx={{ color: '#dc2626' }}>{error}</Typography>
      <Button onClick={load} sx={{ mt: 1, borderRadius: 0, textTransform: 'none' }}>Retry</Button>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', height: '100%', minHeight: 0 }}>
      {/* ── Left panel: pipeline list ─────────────────────────────────── */}
      <Box sx={{
        width: 264, flexShrink: 0,
        borderRight: '1px solid var(--border-col)',
        display: 'flex', flexDirection: 'column',
        bgcolor: 'var(--card-bg)',
      }}>
        <Box sx={{ px: 2, pt: 2.5, pb: 1.5, borderBottom: '1px solid var(--border-col)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ShieldOutlinedIcon sx={{ fontSize: '1rem', color: colorPalette.primary }} />
              <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost' }}>
                Pipelines
              </Typography>
            </Box>
            <Chip label={pipelines.length} size="small" sx={{ height: 18, fontSize: '0.625rem', fontWeight: 700, bgcolor: 'var(--section-bg)', borderRadius: 0 }} />
          </Box>
          <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8' }}>
            Each pipeline is a named set of rules
          </Typography>
        </Box>

        <Box sx={{ flex: 1, overflowY: 'auto', py: 1 }}>
          {pipelines.length === 0 ? (
            <Box sx={{ px: 2, py: 3, textAlign: 'center' }}>
              <AccountTreeOutlinedIcon sx={{ fontSize: '2rem', color: '#cbd5e1', mb: 1 }} />
              <Typography sx={{ fontSize: '0.8125rem', color: '#94a3b8' }}>No pipelines yet</Typography>
            </Box>
          ) : pipelines.map(p => (
            <Box key={p.id} onClick={() => { setSelected(p); setAddingRule(false); setEditingRule(null) }}
              sx={{
                px: 2, py: 1.25, cursor: 'pointer',
                borderLeft: selected?.id === p.id ? `3px solid ${colorPalette.primary}` : '3px solid transparent',
                bgcolor: selected?.id === p.id ? `${colorPalette.primary}08` : 'transparent',
                '&:hover': { bgcolor: selected?.id === p.id ? `${colorPalette.primary}08` : 'var(--section-bg)' },
                transition: 'all 0.1s',
              }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                <Box sx={{ pt: 0.375 }}>
                  <StatusDot status={p.status} />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{
                    fontSize: '0.8125rem', fontWeight: selected?.id === p.id ? 700 : 600,
                    fontFamily: 'Jost', color: 'var(--heading-color)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {p.name}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.25 }}>
                    <LogicBadge logic={p.logic} />
                    <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8' }}>
                      {p.rules.length} rule{p.rules.length !== 1 ? 's' : ''}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Box>
          ))}
        </Box>

        {canModify && (
          <Box sx={{ p: 1.5, borderTop: '1px solid var(--border-col)' }}>
            <Button fullWidth startIcon={<AddRoundedIcon />} onClick={() => setShowNewPipeline(true)}
              sx={{ borderRadius: 0, border: '1px dashed var(--border-col)', color: colorPalette.primary, textTransform: 'none', fontWeight: 600, fontFamily: 'Jost', fontSize: '0.8125rem', '&:hover': { bgcolor: `${colorPalette.primary}08` } }}>
              New pipeline
            </Button>
          </Box>
        )}
      </Box>

      {/* ── Right panel: pipeline detail ──────────────────────────────── */}
      <Box sx={{ flex: 1, overflowY: 'auto', bgcolor: 'var(--card-bg)' }}>
        {!selected ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', gap: 2 }}>
            <TuneRoundedIcon sx={{ fontSize: '3rem', color: '#e2e8f0' }} />
            <Typography sx={{ fontSize: '0.9375rem', color: '#94a3b8', fontFamily: 'Jost' }}>
              Select a pipeline to view and manage its rules
            </Typography>
            {canModify && (
              <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setShowNewPipeline(true)}
                disableElevation
                sx={{ borderRadius: 0, bgcolor: colorPalette.primary, color: '#fff !important', textTransform: 'none', fontWeight: 700, fontFamily: 'Jost',
                      '&:hover': { bgcolor: colorPalette.primary, filter: 'brightness(0.9)', boxShadow: 'none' } }}>
                Create your first pipeline
              </Button>
            )}
          </Box>
        ) : (
          <Box>
            {/* Pipeline header */}
            <Box sx={{ px: 3, py: 2.5, borderBottom: '1px solid var(--border-col)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
              <Box sx={{ flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                  <Typography sx={{ fontSize: '1.125rem', fontWeight: 700, fontFamily: 'Jost', color: 'var(--heading-color)' }}>
                    {selected.name}
                  </Typography>
                  <LogicBadge logic={selected.logic} />
                  <Chip
                    icon={selected.status === 'active'
                      ? <CheckCircleRoundedIcon sx={{ fontSize: '0.75rem !important' }} />
                      : <PauseCircleOutlineRoundedIcon sx={{ fontSize: '0.75rem !important' }} />}
                    label={selected.status === 'active' ? 'Active' : 'Inactive'}
                    size="small"
                    sx={{
                      height: 20, fontSize: '0.6875rem', fontWeight: 700, borderRadius: 0,
                      bgcolor: selected.status === 'active' ? '#f0fdf4' : '#f8fafc',
                      color:   selected.status === 'active' ? '#15803d' : '#64748b',
                    }}
                  />
                </Box>
                {selected.description && (
                  <Typography sx={{ fontSize: '0.8125rem', color: '#64748b', mt: 0.5, lineHeight: 1.5 }}>
                    {selected.description}
                  </Typography>
                )}
                <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8', mt: 0.5 }}>
                  {selected.rules.filter(r => r.enabled).length} of {selected.rules.length} rule{selected.rules.length !== 1 ? 's' : ''} active
                  {selected.createdBy && ` · created by ${selected.createdBy}`}
                </Typography>
              </Box>
              {canModify && (
                <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                  <Tooltip title={selected.status === 'active' ? 'Pause pipeline' : 'Activate pipeline'}>
                    <Button size="small" onClick={() => handleToggleStatus(selected)}
                      sx={{ borderRadius: 0, border: '1px solid var(--border-col)', color: 'var(--on-surface-variant)', textTransform: 'none', fontSize: '0.75rem', fontFamily: 'Jost', minWidth: 'unset', px: 1.25 }}>
                      {selected.status === 'active' ? 'Pause' : 'Activate'}
                    </Button>
                  </Tooltip>
                  <Tooltip title="Edit pipeline">
                    <IconButton size="small" onClick={() => setEditingPipeline(selected)}
                      sx={{ borderRadius: 0, color: '#94a3b8', '&:hover': { color: colorPalette.primary } }}>
                      <EditOutlinedIcon sx={{ fontSize: '1rem' }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete pipeline">
                    <IconButton size="small" onClick={() => handleDeletePipeline(selected)}
                      sx={{ borderRadius: 0, color: '#94a3b8', '&:hover': { color: '#dc2626' } }}>
                      <DeleteOutlineRoundedIcon sx={{ fontSize: '1rem' }} />
                    </IconButton>
                  </Tooltip>
                </Box>
              )}
            </Box>

            {/* Rules section */}
            <Box sx={{ px: 3, pt: 2.5, pb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                <Box>
                  <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, fontFamily: 'Jost', color: 'var(--heading-color)' }}>
                    Rules
                  </Typography>
                  <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', mt: 0.125 }}>
                    Trigger when <strong>{selected.logic === 'AND' ? 'ALL' : 'ANY'}</strong> enabled rules match
                  </Typography>
                </Box>
                {canModify && !addingRule && !editingRule && (
                  <Button variant="contained" disableElevation size="small" startIcon={<AddRoundedIcon />} onClick={() => setAddingRule(true)}
                    sx={{ borderRadius: 0, bgcolor: colorPalette.primary, color: '#fff', textTransform: 'none', fontWeight: 700, fontFamily: 'Jost', fontSize: '0.75rem', boxShadow: 'none', '&:hover': { bgcolor: colorPalette.primary, filter: 'brightness(0.9)', boxShadow: 'none' } }}>
                    Add rule
                  </Button>
                )}
              </Box>

              {/* Rules list */}
              <Box sx={{ borderTop: '1px solid var(--border-col)', borderBottom: '1px solid var(--border-col)', mb: 2, overflow: 'hidden' }}>
                {/* New rule form always appears at top */}
                {addingRule && (
                  <RuleForm
                    pipelineId={selected.id}
                    ruleCount={selected.rules.length}
                    onSave={handleAddRule}
                    onBatchSaved={async () => { setAddingRule(false); await load() }}
                    onCancel={() => setAddingRule(false)}
                  />
                )}
                {selected.rules.length === 0 && !addingRule ? (
                  <Box sx={{ py: 5, textAlign: 'center' }}>
                    <TuneRoundedIcon sx={{ fontSize: '2rem', color: '#e2e8f0', mb: 1 }} />
                    <Typography sx={{ fontSize: '0.875rem', color: '#94a3b8' }}>No rules yet — add one above to get started</Typography>
                  </Box>
                ) : (
                  selected.rules
                    .sort((a, b) => a.position - b.position || a.id - b.id)
                    .map(rule => editingRule?.id === rule.id ? (
                      <Box key={rule.id} sx={{ p: 0 }}>
                        <RuleForm
                          initial={editingRule}
                          pipelineId={selected.id}
                          ruleCount={selected.rules.length}
                          onSave={handleUpdateRule}
                          onCancel={() => setEditingRule(null)}
                        />
                      </Box>
                    ) : (
                      <RuleRow key={rule.id} rule={rule} pipelineId={selected.id}
                        canModify={canModify}
                        onToggle={handleToggleRule}
                        onEdit={r => { setEditingRule(r); setAddingRule(false) }}
                        onDelete={handleDeleteRule}
                      />
                    ))
                )}
              </Box>

              {/* Developer panel */}
              <Box>
                <Box
                  onClick={() => setDevOpen(o => !o)}
                  sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer', mb: 1, userSelect: 'none', width: 'fit-content' }}>
                  <CodeRoundedIcon sx={{ fontSize: '0.875rem', color: colorPalette.primary }} />
                  <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, fontFamily: 'Jost', color: 'var(--heading-color)' }}>
                    Developer
                  </Typography>
                  {devOpen
                    ? <ExpandLessRoundedIcon sx={{ fontSize: '1rem', color: '#94a3b8' }} />
                    : <ExpandMoreRoundedIcon sx={{ fontSize: '1rem', color: '#94a3b8' }} />}
                </Box>
                <Collapse in={devOpen}>
                  <DeveloperPanel pipeline={selected} />
                </Collapse>
              </Box>
            </Box>
          </Box>
        )}
      </Box>

      {/* ── Pipeline modals ────────────────────────────────────────────── */}
      {showNewPipeline && (
        <PipelineModal
          onSave={handleCreatePipeline}
          onClose={() => setShowNewPipeline(false)}
        />
      )}
      {editingPipeline && (
        <PipelineModal
          initial={editingPipeline}
          onSave={handleUpdatePipeline}
          onClose={() => setEditingPipeline(null)}
        />
      )}
      {deletingPipeline && (
        <DeleteConfirmModal
          pipeline={deletingPipeline}
          deleting={deleteInProgress}
          onConfirm={confirmDeletePipeline}
          onClose={() => !deleteInProgress && setDeletingPipeline(null)}
        />
      )}
    </Box>
  )
}
