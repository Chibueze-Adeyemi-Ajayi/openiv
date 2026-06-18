import { useState, useEffect, useRef, useCallback, type MouseEvent } from 'react'
import {
  Box, Typography, Stack, Button, Chip, TextField, Switch,
  Select, MenuItem, FormControl, InputLabel, Checkbox, ListItemText,
  CircularProgress, Divider, Tooltip, IconButton, Collapse,
} from '@mui/material'
import AutoFixHighOutlinedIcon      from '@mui/icons-material/AutoFixHighOutlined'
import AddRoundedIcon               from '@mui/icons-material/AddRounded'
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'
import CheckCircleRoundedIcon       from '@mui/icons-material/CheckCircleRounded'
import PendingOutlinedIcon          from '@mui/icons-material/PendingOutlined'
import ArchiveOutlinedIcon          from '@mui/icons-material/ArchiveOutlined'
import EditOutlinedIcon             from '@mui/icons-material/EditOutlined'
import CodeRoundedIcon              from '@mui/icons-material/CodeRounded'
import RateReviewOutlinedIcon       from '@mui/icons-material/RateReviewOutlined'
import BugReportOutlinedIcon        from '@mui/icons-material/BugReportOutlined'
import PlayArrowRoundedIcon         from '@mui/icons-material/PlayArrowRounded'
import RocketLaunchRoundedIcon      from '@mui/icons-material/RocketLaunchRounded'
import ThumbUpOutlinedIcon          from '@mui/icons-material/ThumbUpOutlined'
import ThumbDownOutlinedIcon        from '@mui/icons-material/ThumbDownOutlined'
import AddCircleOutlineRoundedIcon  from '@mui/icons-material/AddCircleOutlineRounded'
import DeleteOutlineRoundedIcon     from '@mui/icons-material/DeleteOutlineRounded'
import ExpandMoreRoundedIcon        from '@mui/icons-material/ExpandMoreRounded'
import ExpandLessRoundedIcon        from '@mui/icons-material/ExpandLessRounded'
import { colorPalette } from '@/theme'
import {
  institutionRuleApi, defaultActions, DEFAULT_TEST_SCENARIOS,
  RULE_COMPLETIONS,
  type InstitutionRule, type RuleActions, type RuleComprehension,
  type TestScenario, type TestResult, type RuleTemplate,
} from '@/api/institutionRules'
import { useRbac } from '@/contexts/RbacContext'
import TOTPConfirmation from '@/components/dashboard/TOTPConfirmation'
import TemplateHoverPopup, { type HoveredCard } from '@/components/dashboard/TemplateHoverPopup'

// ── Constants ────────────────────────────────────────────────────────────────

const ROLES = ['compliance_officer', 'aml_analyst', 'risk_manager', 'cco', 'cro']

const SAMPLE_RULES: { name: string; policy: string; tag: string }[] = [
  { tag: 'Structuring',     name: 'Structuring Detection',           policy: 'Flag accounts that perform 3 or more cash deposits totalling above ₦990,000 within 24 hours where each individual deposit is below ₦500,000, indicating possible deliberate transaction splitting to avoid reporting thresholds.' },
  { tag: 'Large Transfer',  name: 'Large Transfer to New Recipient', policy: 'Flag any transfer above ₦500,000 to a recipient who has never received funds from this account, where the sending account is less than 30 days old.' },
  { tag: 'Rapid Txns',      name: 'Rapid Succession Transfers',      policy: 'Flag accounts that initiate more than 5 outbound transfers within any 60-minute window, regardless of individual amounts, as this may indicate automated layering activity.' },
  { tag: 'Dormant Account', name: 'Dormant Account Reactivation',    policy: 'Flag any transaction on an account that has had no activity for 180 or more days, where the first transaction after reactivation exceeds ₦100,000.' },
  { tag: 'Night-time',      name: 'Night-time High Value Transfer',  policy: 'Flag all outbound transfers above ₦1,000,000 initiated between 22:00 and 05:00 local time, as large night-time transactions carry elevated fraud risk.' },
  { tag: 'Daily Limit',     name: 'Cumulative Daily Limit Breach',   policy: 'Flag any account whose total outbound transfers exceed ₦5,000,000 in a single calendar day across all channels.' },
  { tag: 'Aggregation',     name: 'Third-party Funds Aggregation',   policy: 'Flag accounts that receive funds from more than 10 distinct senders within 24 hours and subsequently transfer 80% or more of the total received amount within 6 hours, which is characteristic of mule account behaviour.' },
  { tag: 'Cross-border',    name: 'High-Value Cross-border Transfer', policy: 'Flag all international transfers above ₦2,000,000 or equivalent where the destination country appears on a FATF grey-list or black-list, or is a known high-risk jurisdiction.' },
  { tag: 'PEP',             name: 'Politically Exposed Person Transaction', policy: 'Flag any transaction involving a customer tagged as a Politically Exposed Person (PEP) or their close associate where the transaction amount exceeds ₦200,000, for enhanced due diligence review.' },
  { tag: 'Round Trips',     name: 'Round-trip Fund Movement',        policy: 'Flag accounts that receive a transfer and send an equivalent amount (within 10%) back to the same counterparty or a related account within 48 hours, which may indicate artificial transaction inflation.' },
]

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  draft:                { label: 'Draft',              color: '#64748b', bg: 'var(--section-bg)', icon: <EditOutlinedIcon sx={{ fontSize: '0.875rem' }} /> },
  pending_approval:     { label: 'Pending approval',   color: '#d97706', bg: '#fffbeb',           icon: <PendingOutlinedIcon sx={{ fontSize: '0.875rem' }} /> },
  pending_dev_review:   { label: 'Dev review',         color: '#7c3aed', bg: '#f5f3ff',           icon: <CodeRoundedIcon sx={{ fontSize: '0.875rem' }} /> },
  pending_cco_approval: { label: 'CCO review',         color: '#d97706', bg: '#fffbeb',           icon: <RateReviewOutlinedIcon sx={{ fontSize: '0.875rem' }} /> },
  pending_it_vetting:   { label: 'IT vetting',         color: '#0369a1', bg: '#e0f2fe',           icon: <BugReportOutlinedIcon sx={{ fontSize: '0.875rem' }} /> },
  active:               { label: 'Active',             color: '#15803d', bg: '#f0fdf4',           icon: <CheckCircleOutlineRoundedIcon sx={{ fontSize: '0.875rem' }} /> },
  retired:              { label: 'Retired',            color: '#94a3b8', bg: 'var(--section-bg)', icon: <ArchiveOutlinedIcon sx={{ fontSize: '0.875rem' }} /> },
}

const OP_LABELS: Record<string, string> = {
  GT: '>', LT: '<', GTE: '≥', LTE: '≤', EQ: '=', NEQ: '≠',
  CONTAINS: 'contains', NOT_CONTAINS: 'does not contain',
}

type Step = 'write' | 'comprehend' | 'generate' | 'actions'

type PdfStepStatus = 'pending' | 'active' | 'done'
type PdfStep = { id: string; label: string; detail: string; status: PdfStepStatus; startedAt?: number; meta?: string }

const PDF_STEPS_INIT: PdfStep[] = [
  { id: 'extract',   label: 'Reading document',    detail: 'Extracting text from PDF',          status: 'pending' },
  { id: 'summarise', label: 'Summarising content', detail: 'Identifying rules and thresholds',  status: 'pending' },
  { id: 'generate',  label: 'Generating rules',    detail: 'Mapping to compliance schema',      status: 'pending' },
]

function setStepStatus(steps: PdfStep[], id: string, status: PdfStepStatus, meta?: string): PdfStep[] {
  return steps.map(s => s.id === id
    ? { ...s, status, startedAt: status === 'active' ? Date.now() : s.startedAt, ...(meta !== undefined ? { meta } : {}) }
    : s
  )
}

function ElapsedTimer({ startedAt }: { startedAt?: number }) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!startedAt) return
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 500)
    return () => clearInterval(t)
  }, [startedAt])
  return <>{elapsed}s</>
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function needsAction(rule: InstitutionRule, role: string | null): boolean {
  if (!role) return false
  if (rule.status === 'pending_dev_review'   && (role === 'developer' || role === 'admin')) return true
  if (rule.status === 'pending_cco_approval' && (role === 'cco'       || role === 'admin')) return true
  if (rule.status === 'pending_it_vetting'   && (role === 'developer' || role === 'admin')) return true
  return false
}

function CodeBlock({ children, maxH = 240 }: { children: React.ReactNode; maxH?: number }) {
  return (
    <Box sx={{ p: 2, bgcolor: '#0f172a', fontFamily: 'SF Mono, Monaco, monospace', fontSize: '0.75rem', color: '#e2e8f0', lineHeight: 1.8, whiteSpace: 'pre-wrap', maxHeight: maxH, overflowY: 'auto', borderRadius: 0 }}>
      {children}
    </Box>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.75 }}>
      {children}
    </Typography>
  )
}


function PolicyQuote({ text }: { text: string }) {
  return (
    <Box sx={{ p: 2, bgcolor: `${colorPalette.primary}08`, border: `1px solid ${colorPalette.primary}25`, fontSize: '0.875rem', color: 'var(--on-surface)', lineHeight: 1.75, fontStyle: 'italic' }}>
      "{text}"
    </Box>
  )
}

function ComprehensionPills({ comp }: { comp: RuleComprehension }) {
  return (
    <Stack gap={1.5}>
      <Box sx={{ fontSize: '0.875rem', color: 'var(--on-surface)', lineHeight: 1.65, p: 1.5, bgcolor: `${colorPalette.primary}0d`, border: `1px solid ${colorPalette.primary}30` }}>
        {comp.summary}
      </Box>
      <Stack gap={0.75}>
        {comp.conditions.map((c, i) => (
          <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Chip label={c.field} size="small" sx={{ fontFamily: 'SF Mono, Monaco, monospace', fontSize: '0.6875rem', borderRadius: 0, bgcolor: '#e0f2fe', color: '#0369a1', height: 24 }} />
            <Typography sx={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', fontWeight: 600 }}>{OP_LABELS[c.op] ?? c.op}</Typography>
            <Chip label={String(c.value)} size="small" sx={{ fontFamily: 'SF Mono, Monaco, monospace', fontSize: '0.6875rem', borderRadius: 0, bgcolor: '#fef3c7', color: '#92400e', height: 24 }} />
          </Box>
        ))}
      </Stack>
    </Stack>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function NomosPage() {
  const { can, role } = useRbac()
  const canModify = can('rules.modify')

  const [rules, setRules]       = useState<InstitutionRule[]>([])
  const [loading, setLoading]   = useState(true)
  const [selected, setSelected] = useState<InstitutionRule | null>(null)
  const [creating, setCreating] = useState(false)
  const [editing,  setEditing]  = useState<InstitutionRule | null>(null)

  const loadRules = useCallback(async () => {
    try {
      const { rules: r } = await institutionRuleApi.list()
      setRules(r)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadRules() }, [loadRules])

  const actionCount = rules.filter(r => needsAction(r, role)).length

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <Box sx={{ width: 288, flexShrink: 0, borderRight: '1px solid var(--border-col)', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid var(--border-col)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AutoFixHighOutlinedIcon sx={{ color: colorPalette.primary, fontSize: '1.125rem' }} />
            <Typography sx={{ fontFamily: 'Jost', fontWeight: 700, fontSize: '0.9375rem', color: 'var(--heading-color)' }}>Rules</Typography>
            {actionCount > 0 && (
              <Box sx={{ ml: 0.5, px: 0.75, py: 0.125, bgcolor: colorPalette.primary, borderRadius: 4, minWidth: 20, textAlign: 'center' }}>
                <Typography sx={{ fontSize: '0.625rem', fontWeight: 800, color: '#fff', lineHeight: 1.6 }}>{actionCount}</Typography>
              </Box>
            )}
          </Box>
          {canModify && (
            <Button size="small" startIcon={<AddRoundedIcon />}
              onClick={() => { setSelected(null); setCreating(true) }}
              sx={{ textTransform: 'none', fontWeight: 700, fontFamily: 'Jost', fontSize: '0.75rem', borderRadius: 0, border: '1px solid var(--border-col)', color: 'var(--heading-color)', minWidth: 0, px: 1.25, '&:hover': { borderColor: colorPalette.primary, color: colorPalette.primary } }}>
              New
            </Button>
          )}
        </Box>

        <Box sx={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', pt: 4 }}><CircularProgress size={22} sx={{ color: colorPalette.primary }} /></Box>
          ) : rules.length === 0 ? (
            <Box sx={{ px: 2.5, py: 4, textAlign: 'center' }}>
              <Typography sx={{ fontSize: '0.8125rem', color: '#94a3b8', lineHeight: 1.6 }}>No rules yet. Create your first institution-defined rule.</Typography>
            </Box>
          ) : rules.map(r => {
            const sc      = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.draft
            const active  = selected?.id === r.id
            const pending = needsAction(r, role)
            return (
              <Box key={r.id} onClick={() => { setCreating(false); setSelected(r) }}
                sx={{ px: 2.5, py: 1.75, borderBottom: '1px solid var(--border-col)', cursor: 'pointer',
                  bgcolor: active ? 'var(--section-bg)' : 'transparent',
                  borderLeft: `3px solid ${pending ? colorPalette.primary : 'transparent'}`,
                  '&:hover': { bgcolor: 'var(--section-bg)' } }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
                  <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--heading-color)', fontFamily: 'Jost', lineHeight: 1.35, flex: 1 }}>
                    {r.name}
                  </Typography>
                  {pending && <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: colorPalette.primary, mt: 0.5, flexShrink: 0 }} />}
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.375, color: sc.color, mt: 0.5 }}>
                  {sc.icon}
                  <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600, color: sc.color }}>{sc.label}</Typography>
                </Box>
              </Box>
            )
          })}
        </Box>
      </Box>

      {/* ── Right panel ─────────────────────────────────────────────────── */}
      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        {(creating || editing) ? (
          <CreateRuleFlow
            existingRules={rules}
            editingRule={editing ?? undefined}
            onCreated={async (rule) => {
              await loadRules()
              setSelected(rule)
              setCreating(false)
              setEditing(null)
            }}
            onBatchCreated={async () => {
              await loadRules()
              setCreating(false)
              setEditing(null)
            }}
            onCancel={() => { setCreating(false); setEditing(null) }}
          />
        ) : selected ? (
          <RuleDetail rule={selected} role={role} canModify={canModify}
            onRefresh={async () => {
              const { rule: updated } = await institutionRuleApi.get(selected.id)
              setSelected(updated)
              await loadRules()
            }}
            onEdit={() => { setEditing(selected); setCreating(false) }}
            onDelete={async () => {
              await institutionRuleApi.delete(selected.id)
              setSelected(null)
              await loadRules()
            }}
          />
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 2, color: '#94a3b8' }}>
            <AutoFixHighOutlinedIcon sx={{ fontSize: '3rem', opacity: 0.3 }} />
            <Typography sx={{ fontSize: '0.875rem', fontFamily: 'Jost' }}>Select a rule or create a new one</Typography>
          </Box>
        )}
      </Box>
    </Box>
  )
}

// ── Create flow ───────────────────────────────────────────────────────────────

const PRIORITY_COLOR: Record<string, string> = {
  critical: '#dc2626', high: '#d97706', medium: '#2563eb',
}
const RULE_TYPE_COLOR: Record<string, string> = {
  person: '#7c3aed', location: '#0f766e', timing: '#d97706', series: '#0369a1', composite: '#475569',
}

function CreateRuleFlow({
  existingRules,
  editingRule,
  onCreated,
  onBatchCreated,
  onCancel,
}: {
  existingRules:    InstitutionRule[]
  editingRule?:     InstitutionRule
  onCreated:        (rule: InstitutionRule) => void
  onBatchCreated?:  (count: number) => void
  onCancel:         () => void
}) {
  const [step, setStep]                     = useState<Step>('write')
  const [name, setName]                     = useState(editingRule?.name ?? '')
  const [policy, setPolicy]                 = useState(editingRule?.policyStatement ?? '')
  const [suggestions, setSuggestions]       = useState<string[]>([])
  const [comprehension, setComprehension]   = useState<RuleComprehension | null>(null)
  const [streamedText, setStreamedText]     = useState('')
  const [functionSource, setFunctionSource] = useState('')
  const [error, setError]                   = useState<string | null>(null)
  const [inputTab, setInputTab]             = useState<'write' | 'templates' | 'import'>('write')
  // AI dynamic templates
  const [aiTemplates, setAiTemplates]           = useState<RuleTemplate[] | null>(null)
  const [aiTplLoading, setAiTplLoading]         = useState(false)
  const [aiTplError,   setAiTplError]           = useState<string | null>(null)
  // Multi-select + hover popup
  const [selectedTpl, setSelectedTpl]           = useState<Set<string>>(new Set())
  const [selectedPdf, setSelectedPdf]           = useState<Set<string>>(new Set())
  const [batchCreating, setBatchCreating]       = useState(false)
  const [hoveredCard,  setHoveredCard]          = useState<HoveredCard | null>(null)
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // PDF import
  const [pdfSteps,     setPdfSteps]     = useState<PdfStep[] | null>(null)
  const [pdfError,     setPdfError]     = useState<string | null>(null)
  const [pdfTemplates, setPdfTemplates] = useState<RuleTemplate[] | null>(null)
  const abortRef    = useRef<AbortController | null>(null)
  const pdfInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => () => { abortRef.current?.abort() }, [])

  // Restore PDF templates from localStorage (valid for 6 hours)
  useEffect(() => {
    try {
      const raw = localStorage.getItem('openiv_pdf_nomos')
      if (raw) {
        const { templates, ts } = JSON.parse(raw) as { templates: RuleTemplate[]; ts: number }
        if (Date.now() - ts < 6 * 60 * 60 * 1000) setPdfTemplates(templates)
        else localStorage.removeItem('openiv_pdf_nomos')
      }
    } catch { /* ignore */ }
  }, [])

  const handleCardEnter = (t: RuleTemplate, e: MouseEvent<HTMLDivElement>) => {
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current)
    setHoveredCard({ tpl: t, rect: e.currentTarget.getBoundingClientRect() })
  }
  const handleCardLeave = () => {
    leaveTimerRef.current = setTimeout(() => setHoveredCard(null), 120)
  }

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
    setBatchCreating(true); setError(null)
    try {
      const { created } = await institutionRuleApi.createBatch(
        items.map(t => ({ name: t.name, policyStatement: t.policy }))
      )
      onBatchCreated?.(created)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create rules')
      setBatchCreating(false)
    }
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

      // SSE spec §9.2.6 parser: accumulate lines, dispatch on blank line.
      let lineBuffer = ''
      let eventType  = ''
      let dataLines: string[] = []

      const dispatchSse = (type: string, dataStr: string) => {
        if (type === 'keepalive' || !dataStr) return
        const payload = JSON.parse(dataStr)
        if (type === 'step') {
          const { step: sid, status: rawStatus, chars, words, count } = payload as { step: string; status: string; chars?: number; words?: number; count?: number }
          const status = (rawStatus === 'in_progress' ? 'active' : rawStatus) as PdfStepStatus
          const meta = status === 'done'
            ? sid === 'extract'   ? `${chars?.toLocaleString() ?? '?'} chars extracted`
            : sid === 'summarise' ? `${words?.toLocaleString() ?? '?'} word summary`
            : sid === 'generate'  ? `${count ?? '?'} rule${count !== 1 ? 's' : ''} generated`
            : undefined
            : undefined
          setPdfSteps(prev => prev ? setStepStatus(prev, sid, status, meta) : prev)
        } else if (type === 'result') {
          const tpls = (payload as { templates: RuleTemplate[] }).templates
          setPdfTemplates(tpls)
          setSelectedPdf(new Set())
          setPdfSteps(null)
          try { localStorage.setItem('openiv_pdf_nomos', JSON.stringify({ templates: tpls, ts: Date.now() })) } catch { /* ignore */ }
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

    // Duplicate name check (skip if editing and name unchanged)
    const dup = existingRules.find(
      r => r.name.trim().toLowerCase() === trimName.toLowerCase() &&
           r.id !== editingRule?.id
    )
    if (dup) { setError(`A rule named "${trimName}" already exists.`); return }

    setError(null)
    setStep('comprehend')
    setStreamedText('')
    setComprehension(null)

    abortRef.current?.abort()
    abortRef.current = new AbortController()

    try {
      for await (const { event, data } of institutionRuleApi.comprehendStream(
        trimPolicy, abortRef.current.signal,
      )) {
        if (event === 'token')         setStreamedText(prev => prev + (JSON.parse(data) as { text: string }).text)
        if (event === 'comprehension') setComprehension(JSON.parse(data) as RuleComprehension)
        if (event === 'error')         { setError((JSON.parse(data) as { message: string }).message); break }
        if (event === 'done')          break
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== 'AbortError')
        setError(e.message ?? 'Failed to analyse policy')
    }
  }

  const handleApproveComprehension = async () => {
    if (!comprehension) return
    setStep('generate')
    setStreamedText('')
    setFunctionSource('')

    abortRef.current?.abort()
    abortRef.current = new AbortController()

    try {
      for await (const { event, data } of institutionRuleApi.generateStream(
        comprehension, abortRef.current.signal,
      )) {
        if (event === 'token')    setStreamedText(prev => prev + (JSON.parse(data) as { text: string }).text)
        if (event === 'function') setFunctionSource((JSON.parse(data) as { source: string }).source)
        if (event === 'error')    { setError((JSON.parse(data) as { message: string }).message); break }
        if (event === 'done')     { setStep('actions'); break }
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== 'AbortError')
        setError(e.message ?? 'Failed to generate function')
    }
  }

  const STEPS: Step[] = ['write', 'comprehend', 'generate', 'actions']
  const LABELS        = ['Describe', 'Verify', 'Generate', 'Actions']

  return (
    <Box sx={{ maxWidth: 680, mx: 'auto', py: 4, px: 3 }}>
      {/* Step indicator */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3.5 }}>
        {STEPS.map((s, i) => {
          const cur  = STEPS.indexOf(step)
          const past = cur > i; const active = cur === i
          return (
            <Box key={s} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6875rem', fontWeight: 700, bgcolor: past || active ? colorPalette.primary : 'var(--border-col)', color: past || active ? '#fff' : '#94a3b8' }}>
                {past ? '✓' : i + 1}
              </Box>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: active ? 700 : 500, color: active ? 'var(--heading-color)' : '#94a3b8', fontFamily: 'Jost' }}>{LABELS[i]}</Typography>
              {i < 3 && <Box sx={{ width: 24, height: 1, bgcolor: 'var(--border-col)' }} />}
            </Box>
          )
        })}
      </Box>

      {error && (
        <Box sx={{ mb: 2, px: 2, py: 1.25, bgcolor: '#fef2f2', border: '1px solid #fecaca' }}>
          <Typography sx={{ fontSize: '0.8125rem', color: '#dc2626' }}>{error}</Typography>
        </Box>
      )}

      {/* Step 1 */}
      {step === 'write' && (
        <Stack gap={2}>
          {/* Editing: simple layout, no tabs needed */}
          {editingRule ? (
            <>
              <Box>
                <Typography sx={{ fontSize: '1.125rem', fontWeight: 700, fontFamily: 'Jost', color: 'var(--heading-color)', mb: 0.5 }}>Edit rule</Typography>
                <Typography sx={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)', lineHeight: 1.6 }}>Modify the policy description. Be specific about amounts, time windows, and conditions.</Typography>
              </Box>
              <TextField label="Rule name" size="small" fullWidth value={name} onChange={e => setName(e.target.value)} InputProps={{ sx: { borderRadius: 0, fontFamily: 'Jost' } }} InputLabelProps={{ sx: { fontFamily: 'Jost' } }} />
              <Box sx={{ position: 'relative' }}>
                <textarea rows={6} placeholder="e.g. Flag all transfers above ₦500,000 to first-time recipients from accounts less than 30 days old…" value={policy} onChange={e => handlePolicyChange(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', fontSize: '0.875rem', lineHeight: 1.7, padding: '10px 12px', border: '1px solid var(--border-col)', borderRadius: 0, outline: 'none', color: 'var(--on-surface)', backgroundColor: 'var(--section-bg)' }} />
                {suggestions.length > 0 && (
                  <Box sx={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, bgcolor: 'var(--card-bg)', border: '1px solid var(--border-col)', borderTop: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }}>
                    {suggestions.map(s => (
                      <Box key={s} onClick={() => { setPolicy(s); setSuggestions([]) }}
                        sx={{ px: 2, py: 1.25, fontSize: '0.8125rem', color: 'var(--on-surface)', cursor: 'pointer', '&:hover': { bgcolor: 'var(--section-bg)' }, borderBottom: '1px solid var(--border-col)', '&:last-child': { borderBottom: 'none' } }}>
                        <Box component="span" sx={{ fontWeight: 600, color: colorPalette.primary }}>{policy}</Box>{s.slice(policy.length)}
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>
            </>
          ) : (
            /* New rule: tab UI */
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

              {/* Tab: Templates (AI-generated, dynamic) */}
              {inputTab === 'templates' && (
                <Box>
                  {aiTplLoading && (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <CircularProgress size={22} sx={{ color: colorPalette.primary, mb: 1 }} />
                      <Typography sx={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)' }}>
                        Analysing CBN regulations and your existing rules…
                      </Typography>
                    </Box>
                  )}
                  {aiTplError && (
                    <Box sx={{ p: 2, color: '#dc2626', fontSize: '0.75rem' }}>{aiTplError}</Box>
                  )}
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
                            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.75, p: 0.75 }}>
                              {items.map(t => {
                                const sel = selectedTpl.has(t.name)
                                const prio = t.priority ? PRIORITY_COLOR[t.priority] : undefined
                                const rtCol = RULE_TYPE_COLOR[t.ruleType] || '#475569'
                                return (
                                  <Box key={t.name}
                                    onClick={() => toggleTpl(t.name)}
                                    onMouseEnter={e => handleCardEnter(t, e)}
                                    onMouseLeave={handleCardLeave}
                                    sx={{ p: 1.25, border: `1px solid ${sel ? colorPalette.primary : 'var(--border-col)'}`, bgcolor: sel ? `${colorPalette.primary}06` : 'var(--card-bg)', position: 'relative', transition: 'border-color 0.15s, background 0.15s', cursor: 'pointer', '&:hover': { borderColor: sel ? colorPalette.primary : '#94a3b8' }, ...(hoveredCard?.tpl.name === t.name ? { zIndex: 1201 } : {}) }}>
                                    {/* Selection indicator */}
                                    <Box sx={{ position: 'absolute', top: 6, right: 6, width: 14, height: 14, border: `1.5px solid ${sel ? colorPalette.primary : '#cbd5e1'}`, bgcolor: sel ? colorPalette.primary : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                      {sel && <Box component="span" sx={{ fontSize: 9, color: '#fff', lineHeight: 1 }}>✓</Box>}
                                    </Box>
                                    {/* Badges row */}
                                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 0.5, pr: 2 }}>
                                      <Chip label={t.tag} size="small" sx={{ fontSize: '0.5625rem', fontWeight: 700, borderRadius: 0, height: 15, bgcolor: `${rtCol}18`, color: rtCol, '& .MuiChip-label': { px: 0.5 } }} />
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
                          </Box>
                        ))}
                        {/* Batch CTA */}
                        {selectedTpl.size > 0 && (
                          <Box sx={{ p: 1.5, borderTop: '1px solid var(--border-col)', bgcolor: `${colorPalette.primary}06`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: colorPalette.primary }}>
                              {selectedTpl.size} rule{selectedTpl.size > 1 ? 's' : ''} selected
                            </Typography>
                            <Button variant="contained" size="small" disabled={batchCreating}
                              onClick={() => handleBatchCreate(
                                aiTemplates.filter(t => selectedTpl.has(t.name)).map(t => ({ name: t.name, policy: t.policy }))
                              )}
                              sx={{ textTransform: 'none', fontWeight: 700, fontFamily: 'Jost', borderRadius: 0, boxShadow: 'none', bgcolor: colorPalette.primary, fontSize: '0.75rem', '&:hover': { boxShadow: 'none' } }}>
                              {batchCreating ? 'Creating…' : `Create ${selectedTpl.size} rule${selectedTpl.size > 1 ? 's' : ''} as drafts`}
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
                        <AutoFixHighOutlinedIcon sx={{ fontSize: '2rem', color: '#ddd6fe', mb: 1 }} />
                        <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--heading-color)', mb: 0.5 }}>
                          Upload a CBN policy document
                        </Typography>
                        <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8', mb: 2, lineHeight: 1.6, maxWidth: 320, mx: 'auto' }}>
                          Eureka maps the document against your data schema, extracts implementable rules, and flags any fields not currently captured.
                        </Typography>
                        <Box component="button" onClick={() => pdfInputRef.current?.click()}
                          sx={{ px: 2.5, py: 1, fontSize: '0.8125rem', fontWeight: 700, fontFamily: 'Jost', color: '#fff', bgcolor: '#7c3aed', border: 'none', cursor: 'pointer', '&:hover': { bgcolor: '#6d28d9' } }}>
                          ↑ Upload PDF / TXT
                        </Box>
                        <input ref={pdfInputRef} type="file" accept=".pdf,.txt,.md" style={{ display: 'none' }} onChange={handlePdfUpload} />
                      </Box>
                    )}
                    {pdfSteps && (
                      <Box sx={{ py: 2, px: 1.5 }}>
                        <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#6b7280', mb: 2.5, textAlign: 'center', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
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
                                {/* Connectors sit behind the icon (zIndex 0) */}
                                {i > 0 && <Box sx={{ position: 'absolute', top: 14, right: '50%', left: 0, height: 2, zIndex: 0, bgcolor: pdfSteps[i - 1].status === 'done' ? '#16a34a' : '#e5e7eb', transition: 'background-color 0.4s ease' }} />}
                                {!isLast && <Box sx={{ position: 'absolute', top: 14, left: '50%', right: 0, height: 2, zIndex: 0, bgcolor: isDone ? '#16a34a' : '#e5e7eb', transition: 'background-color 0.4s ease' }} />}
                                {/* Icon — all visual state on outer container; opaque bg masks the line */}
                                <Box sx={{
                                  position: 'relative', zIndex: 1, mb: 0.75,
                                  width: 28, height: 28, borderRadius: '50%',
                                  boxSizing: 'border-box',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  bgcolor: isDone ? 'var(--card-bg)' : isActive ? '#fef9c3' : '#d1d5db',
                                  border: isActive ? '2px solid #eab308' : isPending ? '2.5px solid white' : 'none',
                                }}>
                                  {isDone   && <CheckCircleRoundedIcon sx={{ fontSize: '1.5rem', color: '#16a34a' }} />}
                                  {isActive && <CircularProgress size={14} thickness={5} sx={{ color: '#ca8a04' }} />}
                                </Box>
                                <Typography sx={{ fontSize: '0.6875rem', fontWeight: isActive ? 700 : 500, color: isDone ? '#16a34a' : isActive ? '#ca8a04' : '#9ca3af', textAlign: 'center', lineHeight: 1.3, px: 0.25 }}>
                                  {s.label}
                                </Typography>
                                <Typography sx={{ fontSize: '0.5625rem', color: isDone ? '#16a34a' : isActive ? '#d97706' : '#d1d5db', textAlign: 'center', mt: 0.25, lineHeight: 1.3 }}>
                                  {isActive ? <ElapsedTimer startedAt={s.startedAt} /> : isDone && s.meta ? s.meta : s.detail}
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
                          <Box component="button" onClick={() => { setPdfTemplates(null); setPdfError(null); setSelectedPdf(new Set()); try { localStorage.removeItem('openiv_pdf_nomos') } catch { /* ignore */ } setTimeout(() => pdfInputRef.current?.click(), 50) }}
                            sx={{ fontSize: '0.6875rem', fontWeight: 600, fontFamily: 'Jost', color: '#7c3aed', bgcolor: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                            Upload different file
                          </Box>
                          <input ref={pdfInputRef} type="file" accept=".pdf,.txt,.md" style={{ display: 'none' }} onChange={handlePdfUpload} />
                        </Box>
                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.75 }}>
                          {pdfTemplates.map(t => {
                            const sel = selectedPdf.has(t.name)
                            const rtCol = RULE_TYPE_COLOR[t.ruleType] || '#475569'
                            return (
                              <Box key={t.name}
                                onClick={() => togglePdf(t.name)}
                                onMouseEnter={e => handleCardEnter(t, e)}
                                onMouseLeave={handleCardLeave}
                                sx={{ p: 1.25, border: `1px solid ${sel ? '#7c3aed' : '#ddd6fe'}`, bgcolor: sel ? '#f5f3ff' : '#faf5ff', position: 'relative', transition: 'border-color 0.15s', cursor: 'pointer', '&:hover': { borderColor: sel ? '#7c3aed' : '#a78bfa' }, ...(hoveredCard?.tpl.name === t.name ? { zIndex: 1201 } : {}) }}>
                                <Box
                                  sx={{ position: 'absolute', top: 6, right: 6, width: 14, height: 14, border: `1.5px solid ${sel ? '#7c3aed' : '#c4b5fd'}`, bgcolor: sel ? '#7c3aed' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  {sel && <Box component="span" sx={{ fontSize: 9, color: '#fff', lineHeight: 1 }}>✓</Box>}
                                </Box>
                                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 0.5, pr: 2 }}>
                                  <Chip label={t.tag} size="small" sx={{ fontSize: '0.5625rem', fontWeight: 700, borderRadius: 0, height: 15, bgcolor: '#ede9fe', color: '#7c3aed', '& .MuiChip-label': { px: 0.5 } }} />
                                  {t.ruleType && <Chip label={t.ruleType} size="small" sx={{ fontSize: '0.5625rem', fontWeight: 700, borderRadius: 0, height: 15, bgcolor: `${rtCol}15`, color: rtCol, '& .MuiChip-label': { px: 0.5 } }} />}
                                </Box>
                                <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--heading-color)', fontFamily: 'Jost', lineHeight: 1.4 }}>
                                  {t.name}
                                </Typography>
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
                  {/* Batch CTA */}
                  {selectedPdf.size > 0 && pdfTemplates && (
                    <Box sx={{ px: 2, py: 1.5, borderTop: '1px solid #ddd6fe', bgcolor: '#faf5ff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#7c3aed' }}>
                        {selectedPdf.size} rule{selectedPdf.size > 1 ? 's' : ''} selected
                      </Typography>
                      <Button variant="contained" size="small" disabled={batchCreating}
                        onClick={() => handleBatchCreate(
                          pdfTemplates.filter(t => selectedPdf.has(t.name)).map(t => ({ name: t.name, policy: t.policy }))
                        )}
                        sx={{ textTransform: 'none', fontWeight: 700, fontFamily: 'Jost', borderRadius: 0, boxShadow: 'none', bgcolor: '#7c3aed', fontSize: '0.75rem', '&:hover': { bgcolor: '#6d28d9', boxShadow: 'none' } }}>
                        {batchCreating ? 'Creating…' : `Create ${selectedPdf.size} as drafts`}
                      </Button>
                    </Box>
                  )}
                </Box>
              )}
            </Box>
          )}

          {/* Rule name — always visible */}
          <TextField label="Rule name" size="small" fullWidth value={name} onChange={e => setName(e.target.value)} InputProps={{ sx: { borderRadius: 0, fontFamily: 'Jost' } }} InputLabelProps={{ sx: { fontFamily: 'Jost' } }} />

          <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'flex-end' }}>
            <Button onClick={onCancel} sx={{ textTransform: 'none', fontWeight: 600, fontFamily: 'Jost', borderRadius: 0, color: 'var(--on-surface-variant)', border: '1px solid var(--border-col)' }}>Cancel</Button>
            <Button variant="contained" disabled={!name.trim() || !policy.trim()} onClick={handleSubmitPolicy}
              sx={{ bgcolor: '#2563eb', color: '#fff', textTransform: 'none', fontWeight: 700, fontFamily: 'Jost', boxShadow: 'none', borderRadius: 0, '&:hover': { bgcolor: '#1d4ed8', boxShadow: 'none' }, '&.Mui-disabled': { bgcolor: '#2563eb', color: '#fff', opacity: 0.45 } }}>
              Analyse policy →
            </Button>
          </Box>
        </Stack>
      )}

      {/* Step 2 */}
      {step === 'comprehend' && (
        <Stack gap={2.5}>
          <Box>
            <Typography sx={{ fontSize: '1.125rem', fontWeight: 700, fontFamily: 'Jost', color: 'var(--heading-color)', mb: 0.5 }}>Verify understanding</Typography>
            <Typography sx={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)', lineHeight: 1.6 }}>Review what the engine understood from your policy. Confirm or go back to edit.</Typography>
          </Box>
          <PolicyQuote text={policy} />
          {!comprehension ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 2 }}>
              <CircularProgress size={18} sx={{ color: colorPalette.primary }} />
              <Typography sx={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)', fontFamily: 'Jost', flex: 1, wordBreak: 'break-word' }}>{streamedText || 'Analysing…'}</Typography>
            </Box>
          ) : (
            <Stack gap={2}>
              <ComprehensionPills comp={comprehension} />
              <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'flex-end', mt: 1 }}>
                <Button onClick={() => { abortRef.current?.abort(); setStep('write'); setComprehension(null); setStreamedText('') }} sx={{ textTransform: 'none', fontWeight: 600, fontFamily: 'Jost', borderRadius: 0, color: 'var(--on-surface-variant)', border: '1px solid var(--border-col)' }}>Edit policy</Button>
                <Button variant="contained" onClick={handleApproveComprehension} sx={{ bgcolor: colorPalette.primary, color: '#fff', textTransform: 'none', fontWeight: 700, fontFamily: 'Jost', boxShadow: 'none', borderRadius: 0 }}>Correct — generate function →</Button>
              </Box>
            </Stack>
          )}
        </Stack>
      )}

      {/* Step 3 */}
      {step === 'generate' && (
        <Stack gap={2.5}>
          <Box>
            <Typography sx={{ fontSize: '1.125rem', fontWeight: 700, fontFamily: 'Jost', color: 'var(--heading-color)', mb: 0.5 }}>Generating rule function</Typography>
            <Typography sx={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)' }}>Building a deterministic function from your verified conditions…</Typography>
          </Box>
          <CodeBlock maxH={180}>
            {streamedText || <Box component="span" sx={{ color: '#64748b' }}>Generating…</Box>}
            <Box component="span" sx={{ display: 'inline-block', width: 8, height: '1em', bgcolor: colorPalette.primary, ml: 0.25, animation: 'blink 1s step-start infinite', '@keyframes blink': { '50%': { opacity: 0 } } }} />
          </CodeBlock>
        </Stack>
      )}

      {/* Step 4 — save happens here, not at step 1 */}
      {step === 'actions' && (
        <ActionsStep functionSource={functionSource}
          onSubmit={async (actions, sendForReview) => {
            const { rule: saved } = editingRule
              ? await institutionRuleApi.reprocessDraft(
                  editingRule.id, name.trim(), policy.trim(), comprehension!, functionSource)
              : await institutionRuleApi.create(
                  name.trim(), policy.trim(), comprehension!, functionSource)
            await institutionRuleApi.updateActions(saved.id, actions)
            if (sendForReview) await institutionRuleApi.submitForDevReview(saved.id)
            const { rule: updated } = await institutionRuleApi.get(saved.id)
            onCreated(updated)
          }} />
      )}

      <TemplateHoverPopup
        hoveredCard={hoveredCard}
        selected={hoveredCard ? (inputTab === 'import' ? selectedPdf : selectedTpl).has(hoveredCard.tpl.name) : false}
        primaryColor={inputTab === 'import' ? '#7c3aed' : colorPalette.primary}
        onPopupEnter={() => { if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current) }}
        onPopupLeave={() => setHoveredCard(null)}
        onClose={() => setHoveredCard(null)}
        onToggleSelect={() => hoveredCard && (inputTab === 'import' ? togglePdf : toggleTpl)(hoveredCard.tpl.name)}
        onUseTemplate={tpl => { setName(tpl.name); handlePolicyChange(tpl.policy); setInputTab('write') }}
      />
    </Box>
  )
}

// ── Actions step ──────────────────────────────────────────────────────────────

function ActionsStep({ functionSource, onSubmit }: {
  functionSource: string
  onSubmit:       (actions: RuleActions, sendForReview: boolean) => Promise<void>
}) {
  const [actions, setActions] = useState<RuleActions>(defaultActions())
  const [saving, setSaving]   = useState<'draft' | 'review' | null>(null)
  const set = (patch: Partial<RuleActions>) => setActions(prev => ({ ...prev, ...patch }))

  const submit = async (sendForReview: boolean) => {
    setSaving(sendForReview ? 'review' : 'draft')
    try { await onSubmit(actions, sendForReview) } finally { setSaving(null) }
  }

  return (
    <Stack gap={3}>
      <Box>
        <Typography sx={{ fontSize: '1.125rem', fontWeight: 700, fontFamily: 'Jost', color: 'var(--heading-color)', mb: 0.5 }}>Configure actions</Typography>
        <Typography sx={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)', lineHeight: 1.6 }}>When this rule triggers, the engine will execute the actions below. Transactions are never rejected — only held or permitted.</Typography>
      </Box>

      <Box>
        <SectionLabel>Generated function (read-only)</SectionLabel>
        <CodeBlock maxH={200}>{functionSource || '—'}</CodeBlock>
      </Box>

      <Divider />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, fontFamily: 'Jost', color: 'var(--heading-color)' }}>Hold transaction</Typography>
          <Typography sx={{ fontSize: '0.8125rem', color: '#64748b', mt: 0.25 }}>Intercepts before settlement. Officer must release or escalate.</Typography>
        </Box>
        <Switch checked={actions.holdTransaction} onChange={e => set({ holdTransaction: e.target.checked })} sx={{ '& .Mui-checked + .MuiSwitch-track': { bgcolor: `${colorPalette.primary} !important`, opacity: '1 !important' } }} />
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
            <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, fontFamily: 'Jost', color: 'var(--heading-color)' }}>Open investigation case</Typography>
            <Switch checked={actions.openCase.enabled} onChange={e => set({ openCase: { ...actions.openCase, enabled: e.target.checked } })} sx={{ '& .Mui-checked + .MuiSwitch-track': { bgcolor: `${colorPalette.primary} !important`, opacity: '1 !important' } }} />
          </Box>
          {actions.openCase.enabled && (
            <FormControl size="small" sx={{ minWidth: 180, mt: 1 }}>
              <InputLabel sx={{ fontFamily: 'Jost' }}>Case severity</InputLabel>
              <Select value={actions.openCase.severity} label="Case severity" onChange={e => set({ openCase: { ...actions.openCase, severity: e.target.value as any } })} sx={{ borderRadius: 0, fontFamily: 'Jost' }}>
                {(['low','medium','high','critical'] as const).map(s => <MenuItem key={s} value={s} sx={{ fontFamily: 'Jost', textTransform: 'capitalize' }}>{s}</MenuItem>)}
              </Select>
            </FormControl>
          )}
        </Box>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
            <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, fontFamily: 'Jost', color: 'var(--heading-color)' }}>File regulatory report</Typography>
            <Switch checked={actions.fileReport.enabled} onChange={e => set({ fileReport: { ...actions.fileReport, enabled: e.target.checked } })} sx={{ '& .Mui-checked + .MuiSwitch-track': { bgcolor: `${colorPalette.primary} !important`, opacity: '1 !important' } }} />
          </Box>
          {actions.fileReport.enabled && (
            <FormControl size="small" sx={{ minWidth: 180, mt: 1 }}>
              <InputLabel sx={{ fontFamily: 'Jost' }}>Report type</InputLabel>
              <Select value={actions.fileReport.reportType} label="Report type" onChange={e => set({ fileReport: { ...actions.fileReport, reportType: e.target.value as any } })} sx={{ borderRadius: 0, fontFamily: 'Jost' }}>
                {(['STR','CTR','SAR'] as const).map(t => <MenuItem key={t} value={t} sx={{ fontFamily: 'Jost' }}>{t}</MenuItem>)}
              </Select>
            </FormControl>
          )}
        </Box>
      </Box>

      <Box>
        <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, fontFamily: 'Jost', color: 'var(--heading-color)', mb: 0.5 }}>Notify roles</Typography>
        <Typography sx={{ fontSize: '0.8125rem', color: '#64748b', mb: 1 }}>These roles receive an in-platform alert when the rule triggers.</Typography>
        <FormControl size="small" fullWidth>
          <InputLabel sx={{ fontFamily: 'Jost' }}>Roles to notify</InputLabel>
          <Select multiple value={actions.notifyRoles} label="Roles to notify"
            onChange={e => set({ notifyRoles: typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value as string[] })}
            renderValue={sel => (sel as string[]).join(', ')} sx={{ borderRadius: 0, fontFamily: 'Jost' }}>
            {ROLES.map(r => (
              <MenuItem key={r} value={r}>
                <Checkbox checked={actions.notifyRoles.includes(r)} size="small" />
                <ListItemText primary={r.replace(/_/g, ' ')} primaryTypographyProps={{ sx: { fontFamily: 'Jost', fontSize: '0.875rem', textTransform: 'capitalize' } }} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'flex-end', pt: 1 }}>
        <Button disabled={saving !== null} onClick={() => submit(false)}
          sx={{ textTransform: 'none', fontWeight: 600, fontFamily: 'Jost', borderRadius: 0, border: '1px solid var(--border-col)', color: 'var(--on-surface-variant)' }}>
          {saving === 'draft' ? 'Saving…' : 'Save draft'}
        </Button>
        <Button variant="contained" disabled={saving !== null} onClick={() => submit(true)} startIcon={<PlayArrowRoundedIcon />}
          sx={{ bgcolor: colorPalette.primary, color: '#fff', textTransform: 'none', fontWeight: 700, fontFamily: 'Jost', boxShadow: 'none', borderRadius: 0, px: 3 }}>
          {saving === 'review' ? 'Submitting…' : 'Submit for developer review'}
        </Button>
      </Box>
    </Stack>
  )
}

// ── Rule detail dispatcher ────────────────────────────────────────────────────

function RuleDetail({ rule, role, canModify, onRefresh, onEdit, onDelete }: {
  rule:      InstitutionRule
  role:      string | null
  canModify: boolean
  onRefresh: () => void
  onEdit?:   () => void
  onDelete?: () => Promise<void>
}) {
  const isDev   = role === 'developer' || role === 'admin'
  const isCco   = role === 'cco'       || role === 'admin'

  if (rule.status === 'pending_dev_review'   && isDev) return <DevReviewPanel   rule={rule} onRefresh={onRefresh} />
  if (rule.status === 'pending_cco_approval' && isCco) return <CcoApprovalPanel rule={rule} onRefresh={onRefresh} />
  if (rule.status === 'pending_it_vetting'   && isDev) return <ItVettingPanel   rule={rule} onRefresh={onRefresh} />

  return <DefaultRuleDetail rule={rule} canModify={canModify} role={role}
           onRefresh={onRefresh} onEdit={onEdit} onDelete={onDelete} />
}

// ── Developer review panel ────────────────────────────────────────────────────

function DevReviewPanel({ rule, onRefresh }: { rule: InstitutionRule; onRefresh: () => void }) {
  const [editing,  setEditing]  = useState(false)
  const [editSrc,  setEditSrc]  = useState(rule.functionSource ?? '')
  const [editNote, setEditNote] = useState('')
  const [busy,     setBusy]     = useState<'accept' | 'submit' | null>(null)

  // Reset editor source if rule changes
  useEffect(() => { setEditSrc(rule.functionSource ?? '') }, [rule.id, rule.functionSource])

  const handleAccept = async () => {
    setBusy('accept')
    try { await institutionRuleApi.devAccept(rule.id); onRefresh() }
    finally { setBusy(null) }
  }

  const handleSubmitEdits = async () => {
    if (!editSrc.trim()) return
    setBusy('submit')
    try { await institutionRuleApi.devSubmit(rule.id, editSrc, editNote); onRefresh() }
    finally { setBusy(null) }
  }

  return (
    <Box sx={{ maxWidth: 760, mx: 'auto', py: 4, px: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Box sx={{ px: 1, py: 0.25, bgcolor: '#f5f3ff', border: '1px solid #ede9fe' }}>
              <Typography sx={{ fontSize: '0.625rem', fontWeight: 800, color: '#7c3aed', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Developer Review</Typography>
            </Box>
          </Box>
          <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'Jost', color: 'var(--heading-color)' }}>{rule.name}</Typography>
          {rule.createdBy && <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8', mt: 0.25 }}>Authored by {rule.createdBy}</Typography>}
        </Box>
      </Box>

      {/* CCO-authored policy — shown prominently */}
      <Box sx={{ mb: 3, p: 2.5, bgcolor: `${colorPalette.primary}06`, border: `1px solid ${colorPalette.primary}20` }}>
        <SectionLabel>Policy statement (as written by CCO)</SectionLabel>
        <Typography sx={{ fontSize: '0.9375rem', color: 'var(--on-surface)', lineHeight: 1.8, fontStyle: 'italic', mt: 0.5 }}>
          "{rule.policyStatement}"
        </Typography>
      </Box>

      {/* Comprehension */}
      {rule.comprehension && (
        <Box sx={{ mb: 3 }}>
          <SectionLabel>Engine understanding</SectionLabel>
          <ComprehensionPills comp={rule.comprehension} />
        </Box>
      )}

      {/* Function */}
      {!editing ? (
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
            <SectionLabel>Generated function</SectionLabel>
            <Button size="small" startIcon={<EditOutlinedIcon />} onClick={() => setEditing(true)}
              sx={{ textTransform: 'none', fontWeight: 600, fontFamily: 'Jost', fontSize: '0.75rem', borderRadius: 0, border: '1px solid var(--border-col)', color: 'var(--on-surface-variant)', '&:hover': { borderColor: colorPalette.primary, color: colorPalette.primary } }}>
              Edit code
            </Button>
          </Box>
          <CodeBlock maxH={300}>{rule.functionSource || '—'}</CodeBlock>
        </Box>
      ) : (
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
            <SectionLabel>Editing generated function</SectionLabel>
            <Button size="small" onClick={() => { setEditing(false); setEditSrc(rule.functionSource ?? '') }}
              sx={{ textTransform: 'none', fontWeight: 600, fontFamily: 'Jost', fontSize: '0.75rem', borderRadius: 0, color: '#94a3b8', border: '1px solid var(--border-col)' }}>
              Cancel edit
            </Button>
          </Box>
          <textarea
            value={editSrc}
            onChange={e => setEditSrc(e.target.value)}
            rows={14}
            spellCheck={false}
            style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'SF Mono, Monaco, monospace', fontSize: '0.75rem', lineHeight: 1.8, padding: '14px 16px', background: '#0f172a', color: '#e2e8f0', border: `2px solid ${colorPalette.primary}`, borderRadius: 0, outline: 'none', resize: 'vertical' }}
          />
          <TextField label="What did you change and why? (optional)" multiline rows={2} fullWidth size="small" value={editNote} onChange={e => setEditNote(e.target.value)} sx={{ mt: 1.5 }}
            InputProps={{ sx: { borderRadius: 0, fontFamily: 'Jost' } }} InputLabelProps={{ sx: { fontFamily: 'Jost' } }} />
        </Box>
      )}

      {/* CTAs */}
      <Box sx={{ display: 'flex', gap: 1.5, pt: 1 }}>
        {!editing ? (
          <>
            <Button variant="contained" disabled={busy !== null} onClick={handleAccept} startIcon={busy === 'accept' ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : <ThumbUpOutlinedIcon />}
              sx={{ bgcolor: '#15803d', color: '#fff', textTransform: 'none', fontWeight: 700, fontFamily: 'Jost', boxShadow: 'none', borderRadius: 0, px: 3, '&:hover': { bgcolor: '#166534' } }}>
              {busy === 'accept' ? 'Accepting…' : 'Accept — looks good'}
            </Button>
            <Button disabled={busy !== null} onClick={() => setEditing(true)} startIcon={<EditOutlinedIcon />}
              sx={{ textTransform: 'none', fontWeight: 600, fontFamily: 'Jost', borderRadius: 0, border: '1px solid var(--border-col)', color: 'var(--on-surface-variant)', '&:hover': { borderColor: '#7c3aed', color: '#7c3aed' } }}>
              Edit before submitting
            </Button>
          </>
        ) : (
          <Button variant="contained" disabled={!editSrc.trim() || busy !== null} onClick={handleSubmitEdits}
            startIcon={busy === 'submit' ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : <PlayArrowRoundedIcon />}
            sx={{ bgcolor: '#7c3aed', color: '#fff', textTransform: 'none', fontWeight: 700, fontFamily: 'Jost', boxShadow: 'none', borderRadius: 0, px: 3, '&:hover': { bgcolor: '#6d28d9' } }}>
            {busy === 'submit' ? 'Submitting…' : 'Submit edits for CCO review'}
          </Button>
        )}
      </Box>
    </Box>
  )
}

// ── CCO edit-approval panel ───────────────────────────────────────────────────

function CcoApprovalPanel({ rule, onRefresh }: { rule: InstitutionRule; onRefresh: () => void }) {
  const [rejectMode, setRejectMode] = useState(false)
  const [rejectNote, setRejectNote] = useState('')
  const [busy, setBusy]             = useState<'approve' | 'reject' | null>(null)

  const handleApprove = async () => {
    setBusy('approve')
    try { await institutionRuleApi.ccoApproveEdits(rule.id); onRefresh() }
    finally { setBusy(null) }
  }
  const handleReject = async () => {
    setBusy('reject')
    try { await institutionRuleApi.ccoRejectEdits(rule.id, rejectNote); onRefresh() }
    finally { setBusy(null) }
  }

  const origLines = (rule.functionSource      ?? '').split('\n')
  const editLines = (rule.devEditedSource      ?? '').split('\n')

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', py: 4, px: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Box sx={{ px: 1, py: 0.25, bgcolor: '#fffbeb', border: '1px solid #fde68a' }}>
            <Typography sx={{ fontSize: '0.625rem', fontWeight: 800, color: '#d97706', letterSpacing: '0.1em', textTransform: 'uppercase' }}>CCO Review Required</Typography>
          </Box>
        </Box>
        <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'Jost', color: 'var(--heading-color)' }}>{rule.name}</Typography>
        {rule.devReviewedBy && <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8', mt: 0.25 }}>Revised by {rule.devReviewedBy}</Typography>}
      </Box>

      {/* Policy */}
      <Box sx={{ mb: 3, p: 2, bgcolor: `${colorPalette.primary}06`, border: `1px solid ${colorPalette.primary}20` }}>
        <SectionLabel>Original policy</SectionLabel>
        <Typography sx={{ fontSize: '0.875rem', color: 'var(--on-surface)', lineHeight: 1.75, fontStyle: 'italic', mt: 0.5 }}>"{rule.policyStatement}"</Typography>
      </Box>

      {/* Developer's note */}
      {rule.reviewNote && (
        <Box sx={{ mb: 3, p: 2, bgcolor: '#f5f3ff', border: '1px solid #ede9fe' }}>
          <SectionLabel>Developer's note</SectionLabel>
          <Typography sx={{ fontSize: '0.875rem', color: '#5b21b6', lineHeight: 1.65, mt: 0.5 }}>"{rule.reviewNote}"</Typography>
        </Box>
      )}

      {/* Side-by-side code diff */}
      <Box sx={{ mb: 3 }}>
        <SectionLabel>Code changes</SectionLabel>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, border: '1px solid var(--border-col)' }}>
          {/* Original */}
          <Box>
            <Box sx={{ px: 2, py: 1, bgcolor: '#fef2f2', borderBottom: '1px solid #fecaca', borderRight: '1px solid var(--border-col)' }}>
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Original (LLM generated)</Typography>
            </Box>
            <Box sx={{ p: 2, bgcolor: '#0f172a', fontFamily: 'SF Mono, Monaco, monospace', fontSize: '0.7rem', color: '#94a3b8', lineHeight: 1.8, whiteSpace: 'pre-wrap', maxHeight: 320, overflowY: 'auto', borderRight: '1px solid #1e293b' }}>
              {origLines.map((line, i) => {
                const changed = editLines[i] !== line
                return (
                  <Box key={i} component="div" sx={{ color: changed ? '#f87171' : '#94a3b8', bgcolor: changed ? 'rgba(220,38,38,0.15)' : 'transparent', px: 0.5, display: 'block' }}>
                    {line || ' '}
                  </Box>
                )
              })}
            </Box>
          </Box>
          {/* Revised */}
          <Box>
            <Box sx={{ px: 2, py: 1, bgcolor: '#f0fdf4', borderBottom: '1px solid #bbf7d0' }}>
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Developer's revision</Typography>
            </Box>
            <Box sx={{ p: 2, bgcolor: '#0f172a', fontFamily: 'SF Mono, Monaco, monospace', fontSize: '0.7rem', color: '#e2e8f0', lineHeight: 1.8, whiteSpace: 'pre-wrap', maxHeight: 320, overflowY: 'auto' }}>
              {editLines.map((line, i) => {
                const changed = origLines[i] !== line
                return (
                  <Box key={i} component="div" sx={{ color: changed ? '#4ade80' : '#e2e8f0', bgcolor: changed ? 'rgba(22,163,74,0.18)' : 'transparent', px: 0.5, display: 'block' }}>
                    {line || ' '}
                  </Box>
                )
              })}
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Reject note input */}
      {rejectMode && (
        <Box sx={{ mb: 2 }}>
          <TextField label="Reason for requesting revision" multiline rows={2} fullWidth size="small" value={rejectNote} onChange={e => setRejectNote(e.target.value)}
            placeholder="Tell the developer what needs to change…"
            InputProps={{ sx: { borderRadius: 0, fontFamily: 'Jost' } }} InputLabelProps={{ sx: { fontFamily: 'Jost' } }} />
        </Box>
      )}

      {/* CTAs */}
      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
        <Button variant="contained" disabled={busy !== null} onClick={handleApprove}
          startIcon={busy === 'approve' ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : <ThumbUpOutlinedIcon />}
          sx={{ bgcolor: '#15803d', color: '#fff', textTransform: 'none', fontWeight: 700, fontFamily: 'Jost', boxShadow: 'none', borderRadius: 0, px: 3, '&:hover': { bgcolor: '#166534' } }}>
          {busy === 'approve' ? 'Approving…' : 'Approve changes'}
        </Button>

        {!rejectMode ? (
          <Button disabled={busy !== null} onClick={() => setRejectMode(true)} startIcon={<ThumbDownOutlinedIcon />}
            sx={{ textTransform: 'none', fontWeight: 600, fontFamily: 'Jost', borderRadius: 0, border: '1px solid #fca5a5', color: '#dc2626', '&:hover': { bgcolor: '#fef2f2', borderColor: '#dc2626' } }}>
            Request revision
          </Button>
        ) : (
          <>
            <Button disabled={busy !== null} onClick={handleReject}
              startIcon={busy === 'reject' ? <CircularProgress size={14} /> : <ThumbDownOutlinedIcon />}
              sx={{ textTransform: 'none', fontWeight: 700, fontFamily: 'Jost', borderRadius: 0, border: '1px solid #dc2626', color: '#dc2626', '&:hover': { bgcolor: '#fef2f2' } }}>
              {busy === 'reject' ? 'Sending…' : 'Send back to developer'}
            </Button>
            <Button onClick={() => { setRejectMode(false); setRejectNote('') }} sx={{ textTransform: 'none', fontFamily: 'Jost', borderRadius: 0, color: '#94a3b8' }}>Cancel</Button>
          </>
        )}
      </Box>
    </Box>
  )
}

// ── IT vetting panel ──────────────────────────────────────────────────────────

function ItVettingPanel({ rule, onRefresh }: { rule: InstitutionRule; onRefresh: () => void }) {
  const [scenarios, setScenarios] = useState<TestScenario[]>(
    rule.testResults ? [] : DEFAULT_TEST_SCENARIOS.map(s => ({ ...s }))
  )
  const [results,   setResults]   = useState<TestResult[]>(
    rule.testResults ? (rule.testResults as any).results ?? [] : []
  )
  const [running,   setRunning]   = useState(false)
  const [deploying, setDeploying] = useState(false)
  const [expanded,  setExpanded]  = useState<number[]>([])

  // If stored results exist and no fresh scenarios, start with defaults
  useEffect(() => {
    if (rule.testResults && scenarios.length === 0) {
      setScenarios(DEFAULT_TEST_SCENARIOS.map(s => ({ ...s })))
    }
  }, [])

  const toggle = (i: number) =>
    setExpanded(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])

  const updateScenario = (i: number, patch: Partial<TestScenario>) =>
    setScenarios(prev => prev.map((s, idx) => idx === i ? { ...s, ...patch } : s))

  const updateTxn  = (i: number, patch: Partial<TestScenario['txn']>)      =>
    setScenarios(prev => prev.map((s, idx) => idx === i ? { ...s, txn: { ...s.txn, ...patch } } : s))

  const updateCust = (i: number, patch: Partial<TestScenario['customer']>) =>
    setScenarios(prev => prev.map((s, idx) => idx === i ? { ...s, customer: { ...s.customer, ...patch } } : s))

  const updateCtx  = (i: number, patch: Partial<TestScenario['context']>)  =>
    setScenarios(prev => prev.map((s, idx) => idx === i ? { ...s, context: { ...s.context, ...patch } } : s))

  const addScenario = () => {
    const i = scenarios.length
    setScenarios(prev => [...prev, {
      label: `Scenario ${i + 1}`,
      txn: { amount: 100_000, currency: 'NGN', type: 'transfer', channel: 'mobile' },
      customer: { accountAgeDays: 180, riskScore: 30, tier: 'tier2', totalTxnCount: 50 },
      context: { recipientFirstTime: false, ipCountryCode: 'NG' },
    }])
    setExpanded(prev => [...prev, i])
  }

  const removeScenario = (i: number) => {
    setScenarios(prev => prev.filter((_, idx) => idx !== i))
    setExpanded(prev => prev.filter(x => x !== i).map(x => x > i ? x - 1 : x))
  }

  const handleRunTests = async () => {
    if (!scenarios.length) return
    setRunning(true)
    try {
      const { results: r } = await institutionRuleApi.runTests(rule.id, scenarios)
      setResults(r)
    } finally { setRunning(false) }
  }

  const handleDeploy = async () => {
    setDeploying(true)
    try { await institutionRuleApi.deploy(rule.id); onRefresh() }
    finally { setDeploying(false) }
  }

  const allPassed  = results.length > 0 && results.every(r => !r.triggered)
  const anyTriggered = results.some(r => r.triggered)

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', py: 4, px: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Box sx={{ px: 1, py: 0.25, bgcolor: '#e0f2fe', border: '1px solid #bae6fd' }}>
            <Typography sx={{ fontSize: '0.625rem', fontWeight: 800, color: '#0369a1', letterSpacing: '0.1em', textTransform: 'uppercase' }}>IT Vetting</Typography>
          </Box>
        </Box>
        <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'Jost', color: 'var(--heading-color)' }}>{rule.name}</Typography>
        <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8', mt: 0.25 }}>
          {rule.approvedBy ? `Approved by ${rule.approvedBy}` : rule.createdBy ? `By ${rule.createdBy}` : ''}
        </Typography>
      </Box>

      {/* Rule summary */}
      <Box sx={{ mb: 3, p: 2, bgcolor: `${colorPalette.primary}06`, border: `1px solid ${colorPalette.primary}20` }}>
        <SectionLabel>Policy</SectionLabel>
        <Typography sx={{ fontSize: '0.875rem', color: 'var(--on-surface)', lineHeight: 1.75, fontStyle: 'italic', mt: 0.5 }}>"{rule.policyStatement}"</Typography>
      </Box>

      {rule.comprehension && (
        <Box sx={{ mb: 3 }}>
          <SectionLabel>Trigger conditions</SectionLabel>
          <ComprehensionPills comp={rule.comprehension} />
        </Box>
      )}

      {rule.functionSource && (
        <Box sx={{ mb: 3 }}>
          <SectionLabel>Function to deploy</SectionLabel>
          <CodeBlock maxH={220}>{rule.functionSource}</CodeBlock>
        </Box>
      )}

      <Divider sx={{ my: 3, borderColor: 'var(--border-col)' }} />

      {/* Test runner */}
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography sx={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'Jost', color: 'var(--heading-color)' }}>Test scenarios</Typography>
          <Typography sx={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)', mt: 0.25 }}>Define inputs to verify the rule behaves as expected before deploying.</Typography>
        </Box>
        <Button size="small" startIcon={<AddCircleOutlineRoundedIcon />} onClick={addScenario}
          sx={{ textTransform: 'none', fontWeight: 600, fontFamily: 'Jost', fontSize: '0.75rem', borderRadius: 0, border: '1px solid var(--border-col)', color: 'var(--on-surface-variant)', '&:hover': { borderColor: colorPalette.primary, color: colorPalette.primary } }}>
          Add scenario
        </Button>
      </Box>

      <Stack gap={1.5} sx={{ mb: 2 }}>
        {scenarios.map((s, i) => {
          const res     = results[i]
          const open    = expanded.includes(i)
          return (
            <Box key={i} sx={{ border: '1px solid var(--border-col)', bgcolor: 'var(--section-bg)' }}>
              {/* Scenario header row */}
              <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer' }} onClick={() => toggle(i)}>
                <Box sx={{ flex: 1 }}>
                  <TextField variant="standard" value={s.label} onChange={e => { e.stopPropagation(); updateScenario(i, { label: e.target.value }) }}
                    onClick={e => e.stopPropagation()}
                    InputProps={{ disableUnderline: true, sx: { fontFamily: 'Jost', fontWeight: 600, fontSize: '0.875rem', color: 'var(--heading-color)' } }} sx={{ width: '100%' }} />
                </Box>
                {res && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.25, py: 0.5,
                    bgcolor: res.triggered ? '#fef2f2' : '#f0fdf4',
                    border: `1px solid ${res.triggered ? '#fca5a5' : '#bbf7d0'}` }}>
                    <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: res.triggered ? '#dc2626' : '#16a34a' }} />
                    <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: res.triggered ? '#dc2626' : '#16a34a' }}>
                      {res.triggered ? 'TRIGGERED' : 'NO MATCH'}
                    </Typography>
                  </Box>
                )}
                <IconButton size="small" onClick={e => { e.stopPropagation(); removeScenario(i) }} sx={{ color: '#94a3b8', '&:hover': { color: '#dc2626' } }}>
                  <DeleteOutlineRoundedIcon sx={{ fontSize: '1rem' }} />
                </IconButton>
                {open ? <ExpandLessRoundedIcon sx={{ fontSize: '1.125rem', color: '#94a3b8' }} /> : <ExpandMoreRoundedIcon sx={{ fontSize: '1.125rem', color: '#94a3b8' }} />}
              </Box>

              <Collapse in={open}>
                <Box sx={{ px: 2, pb: 2, borderTop: '1px solid var(--border-col)' }}>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1.5, mt: 1.5 }}>
                    {/* Transaction */}
                    <Box>
                      <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1 }}>Transaction</Typography>
                      <Stack gap={1}>
                        <TextField label="Amount (₦)" size="small" type="number"
                          value={s.txn.amount / 100}
                          onChange={e => updateTxn(i, { amount: parseFloat(e.target.value || '0') * 100 })}
                          InputProps={{ sx: { borderRadius: 0, fontFamily: 'Jost', fontSize: '0.8125rem' } }} InputLabelProps={{ sx: { fontFamily: 'Jost', fontSize: '0.8125rem' } }} />
                        <FormControl size="small">
                          <InputLabel sx={{ fontFamily: 'Jost', fontSize: '0.8125rem' }}>Channel</InputLabel>
                          <Select value={s.txn.channel ?? 'mobile'} label="Channel" onChange={e => updateTxn(i, { channel: e.target.value })} sx={{ borderRadius: 0, fontFamily: 'Jost', fontSize: '0.8125rem' }}>
                            {['mobile','web','ussd','pos','atm'].map(c => <MenuItem key={c} value={c} sx={{ fontFamily: 'Jost', fontSize: '0.8125rem' }}>{c.toUpperCase()}</MenuItem>)}
                          </Select>
                        </FormControl>
                        <FormControl size="small">
                          <InputLabel sx={{ fontFamily: 'Jost', fontSize: '0.8125rem' }}>Type</InputLabel>
                          <Select value={s.txn.type ?? 'transfer'} label="Type" onChange={e => updateTxn(i, { type: e.target.value })} sx={{ borderRadius: 0, fontFamily: 'Jost', fontSize: '0.8125rem' }}>
                            {['transfer','deposit','withdrawal'].map(t => <MenuItem key={t} value={t} sx={{ fontFamily: 'Jost', fontSize: '0.8125rem', textTransform: 'capitalize' }}>{t}</MenuItem>)}
                          </Select>
                        </FormControl>
                      </Stack>
                    </Box>
                    {/* Customer */}
                    <Box>
                      <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1 }}>Customer</Typography>
                      <Stack gap={1}>
                        <TextField label="Account age (days)" size="small" type="number"
                          value={s.customer.accountAgeDays ?? ''}
                          onChange={e => updateCust(i, { accountAgeDays: parseInt(e.target.value || '0') })}
                          InputProps={{ sx: { borderRadius: 0, fontFamily: 'Jost', fontSize: '0.8125rem' } }} InputLabelProps={{ sx: { fontFamily: 'Jost', fontSize: '0.8125rem' } }} />
                        <TextField label="Risk score (0–100)" size="small" type="number"
                          value={s.customer.riskScore ?? ''}
                          onChange={e => updateCust(i, { riskScore: parseInt(e.target.value || '0') })}
                          InputProps={{ sx: { borderRadius: 0, fontFamily: 'Jost', fontSize: '0.8125rem' } }} InputLabelProps={{ sx: { fontFamily: 'Jost', fontSize: '0.8125rem' } }} />
                        <FormControl size="small">
                          <InputLabel sx={{ fontFamily: 'Jost', fontSize: '0.8125rem' }}>KYC tier</InputLabel>
                          <Select value={s.customer.tier ?? 'tier2'} label="KYC tier" onChange={e => updateCust(i, { tier: e.target.value })} sx={{ borderRadius: 0, fontFamily: 'Jost', fontSize: '0.8125rem' }}>
                            {['tier1','tier2','tier3'].map(t => <MenuItem key={t} value={t} sx={{ fontFamily: 'Jost', fontSize: '0.8125rem' }}>{t}</MenuItem>)}
                          </Select>
                        </FormControl>
                      </Stack>
                    </Box>
                    {/* Context */}
                    <Box>
                      <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1 }}>Context</Typography>
                      <Stack gap={1}>
                        <TextField label="IP country (2-letter)" size="small"
                          value={s.context.ipCountryCode ?? ''}
                          onChange={e => updateCtx(i, { ipCountryCode: e.target.value.toUpperCase().slice(0, 2) })}
                          InputProps={{ sx: { borderRadius: 0, fontFamily: 'Jost', fontSize: '0.8125rem' } }} InputLabelProps={{ sx: { fontFamily: 'Jost', fontSize: '0.8125rem' } }} />
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.5 }}>
                          <Typography sx={{ fontSize: '0.8125rem', color: 'var(--on-surface)', fontFamily: 'Jost' }}>First-time recipient</Typography>
                          <Switch size="small" checked={!!s.context.recipientFirstTime} onChange={e => updateCtx(i, { recipientFirstTime: e.target.checked })}
                            sx={{ '& .Mui-checked + .MuiSwitch-track': { bgcolor: `${colorPalette.primary} !important`, opacity: '1 !important' } }} />
                        </Box>
                      </Stack>
                    </Box>
                  </Box>
                  {res && (
                    <Box sx={{ mt: 1.5, px: 1.5, py: 1, bgcolor: res.triggered ? '#fef2f2' : '#f0fdf4', border: `1px solid ${res.triggered ? '#fecaca' : '#bbf7d0'}` }}>
                      <Typography sx={{ fontSize: '0.75rem', color: res.triggered ? '#991b1b' : '#166534', fontFamily: 'SF Mono, Monaco, monospace' }}>
                        {res.reason}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Collapse>
            </Box>
          )
        })}
      </Stack>

      {/* Run tests button */}
      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', mb: 3 }}>
        <Button variant="contained" disabled={running || !scenarios.length} onClick={handleRunTests}
          startIcon={running ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : <PlayArrowRoundedIcon />}
          sx={{ bgcolor: '#0369a1', color: '#fff', textTransform: 'none', fontWeight: 700, fontFamily: 'Jost', boxShadow: 'none', borderRadius: 0, px: 3, '&:hover': { bgcolor: '#0c4a6e' } }}>
          {running ? 'Running tests…' : 'Run all tests'}
        </Button>
        {results.length > 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <CheckCircleRoundedIcon sx={{ fontSize: '1rem', color: '#16a34a' }} />
              <Typography sx={{ fontSize: '0.8125rem', color: '#16a34a', fontWeight: 600 }}>{results.filter(r => !r.triggered).length} passed</Typography>
            </Box>
            {anyTriggered && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#dc2626' }} />
                <Typography sx={{ fontSize: '0.8125rem', color: '#dc2626', fontWeight: 600 }}>{results.filter(r => r.triggered).length} triggered</Typography>
              </Box>
            )}
          </Box>
        )}
      </Box>

      <Divider sx={{ mb: 3, borderColor: 'var(--border-col)' }} />

      {/* Deploy */}
      <Box sx={{ p: 2.5, bgcolor: results.length === 0 ? 'var(--section-bg)' : allPassed ? '#f0fdf4' : '#fffbeb', border: `1px solid ${results.length === 0 ? 'var(--border-col)' : allPassed ? '#bbf7d0' : '#fde68a'}` }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
          <Box>
            <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, fontFamily: 'Jost', color: 'var(--heading-color)' }}>Deploy to production</Typography>
            <Typography sx={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)', mt: 0.5, lineHeight: 1.6 }}>
              {results.length === 0
                ? 'Run tests first to verify the rule behaves as expected.'
                : allPassed
                ? 'All scenarios passed. The rule is ready to deploy.'
                : `${results.filter(r => r.triggered).length} scenario(s) triggered — review before deploying.`}
            </Typography>
          </Box>
          <Tooltip title={results.length === 0 ? 'Run tests before deploying' : ''}>
            <span>
              <Button variant="contained" disabled={deploying || results.length === 0} onClick={handleDeploy}
                startIcon={deploying ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : <RocketLaunchRoundedIcon />}
                sx={{ bgcolor: '#15803d', color: '#fff', textTransform: 'none', fontWeight: 700, fontFamily: 'Jost', boxShadow: 'none', borderRadius: 0, px: 3, whiteSpace: 'nowrap', '&:hover': { bgcolor: '#166534' }, '&:disabled': { bgcolor: '#94a3b8', color: '#fff' } }}>
                {deploying ? 'Deploying…' : 'Deploy rule'}
              </Button>
            </span>
          </Tooltip>
        </Box>
      </Box>
    </Box>
  )
}

// ── Default read-only detail ──────────────────────────────────────────────────

function DefaultRuleDetail({ rule, canModify, role, onRefresh, onEdit, onDelete }: {
  rule:      InstitutionRule
  canModify: boolean
  role:      string | null
  onRefresh: () => void
  onEdit?:   () => void
  onDelete?: () => Promise<void>
}) {
  const sc = STATUS_CONFIG[rule.status] ?? STATUS_CONFIG.draft
  const [retiring,        setRetiring]        = useState(false)
  const [deleting,        setDeleting]        = useState(false)
  const [submitConfirm,   setSubmitConfirm]   = useState(false)
  const [submitting,      setSubmitting]      = useState(false)

  // Status-contextual banner messages
  const banners: Record<string, { text: string; bg: string; border: string; color: string }> = {
    pending_dev_review:   { text: 'Awaiting developer review.',          bg: '#f5f3ff', border: '#ede9fe', color: '#7c3aed' },
    pending_cco_approval: { text: 'Developer submitted edits for your review.', bg: '#fffbeb', border: '#fde68a', color: '#d97706' },
    pending_it_vetting:   { text: 'Awaiting IT vetting and deployment.',  bg: '#e0f2fe', border: '#bae6fd', color: '#0369a1' },
  }
  const banner = banners[rule.status]

  return (
    <Box sx={{ maxWidth: 680, mx: 'auto', py: 4, px: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'Jost', color: 'var(--heading-color)' }}>{rule.name}</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.375, color: sc.color }}>
              {sc.icon}
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: sc.color }}>{sc.label}</Typography>
            </Box>
            {rule.createdBy && <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>· by {rule.createdBy}</Typography>}
          </Box>
        </Box>
        {canModify && rule.status === 'active' && (
          <Tooltip title="Retire this rule">
            <Button disabled={retiring}
              onClick={async () => { setRetiring(true); try { await institutionRuleApi.retire(rule.id); onRefresh() } finally { setRetiring(false) } }}
              sx={{ textTransform: 'none', fontWeight: 600, fontFamily: 'Jost', borderRadius: 0, border: '1px solid var(--border-col)', color: '#64748b' }}>
              {retiring ? 'Retiring…' : 'Retire'}
            </Button>
          </Tooltip>
        )}
        {canModify && rule.status === 'pending_approval' && (
          <Button variant="contained"
            onClick={async () => { await institutionRuleApi.approve(rule.id); onRefresh() }}
            sx={{ bgcolor: '#15803d', color: '#fff', textTransform: 'none', fontWeight: 700, fontFamily: 'Jost', boxShadow: 'none', borderRadius: 0 }}>
            Approve & activate (legacy)
          </Button>
        )}
        {canModify && rule.status === 'draft' && (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {rule.functionSource && (
              <Button variant="contained" disabled={submitting}
                onClick={() => setSubmitConfirm(true)}
                sx={{ bgcolor: colorPalette.primary, color: '#fff', textTransform: 'none', fontWeight: 700, fontFamily: 'Jost', boxShadow: 'none', borderRadius: 0, fontSize: '0.8125rem' }}>
                {submitting ? 'Submitting…' : 'Submit for review'}
              </Button>
            )}
            {onEdit && (
              <Button onClick={onEdit} startIcon={<EditOutlinedIcon />}
                sx={{ textTransform: 'none', fontWeight: 600, fontFamily: 'Jost', borderRadius: 0, border: '1px solid var(--border-col)', color: 'var(--on-surface-variant)', fontSize: '0.8125rem', '&:hover': { borderColor: colorPalette.primary, color: colorPalette.primary } }}>
                Edit
              </Button>
            )}
            {onDelete && (
              <Button disabled={deleting}
                onClick={async () => {
                  setDeleting(true)
                  try { await onDelete() } finally { setDeleting(false) }
                }}
                startIcon={<DeleteOutlineRoundedIcon />}
                sx={{ textTransform: 'none', fontWeight: 600, fontFamily: 'Jost', borderRadius: 0, border: '1px solid #fca5a5', color: '#dc2626', fontSize: '0.8125rem', '&:hover': { bgcolor: '#fef2f2', borderColor: '#dc2626' } }}>
                {deleting ? 'Deleting…' : 'Delete'}
              </Button>
            )}
          </Box>
        )}
      </Box>

      {banner && (
        <Box sx={{ mb: 3, px: 2, py: 1.5, bgcolor: banner.bg, border: `1px solid ${banner.border}` }}>
          <Typography sx={{ fontSize: '0.875rem', color: banner.color, fontWeight: 600 }}>{banner.text}</Typography>
        </Box>
      )}

      <Stack gap={3}>
        <Box>
          <SectionLabel>Policy</SectionLabel>
          <Typography sx={{ fontSize: '0.875rem', color: 'var(--on-surface)', lineHeight: 1.7, fontStyle: 'italic' }}>"{rule.policyStatement}"</Typography>
        </Box>

        {rule.comprehension && (
          <Box>
            <SectionLabel>Conditions ({rule.comprehension.logic})</SectionLabel>
            <ComprehensionPills comp={rule.comprehension} />
          </Box>
        )}

        {rule.functionSource && (
          <Box>
            <SectionLabel>Function</SectionLabel>
            <CodeBlock maxH={240}>{rule.functionSource}</CodeBlock>
          </Box>
        )}

        {rule.devReviewedBy && (
          <Box sx={{ p: 1.5, bgcolor: '#f5f3ff', border: '1px solid #ede9fe' }}>
            <SectionLabel>Developer review</SectionLabel>
            <Typography sx={{ fontSize: '0.8125rem', color: '#5b21b6' }}>Reviewed by {rule.devReviewedBy}</Typography>
            {rule.reviewNote && <Typography sx={{ fontSize: '0.8125rem', color: '#7c3aed', mt: 0.5 }}>"{rule.reviewNote}"</Typography>}
          </Box>
        )}

        {rule.testResults && (
          <Box>
            <SectionLabel>Test results ({rule.itVettedBy ? `run by ${rule.itVettedBy}` : ''})</SectionLabel>
            <Stack gap={0.75}>
              {((rule.testResults as any).results as TestResult[]).map((r, i) => (
                <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 1, bgcolor: r.triggered ? '#fef2f2' : '#f0fdf4', border: `1px solid ${r.triggered ? '#fecaca' : '#bbf7d0'}` }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: r.triggered ? '#dc2626' : '#16a34a', flexShrink: 0 }} />
                  <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--heading-color)', flex: 1 }}>{r.label}</Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: r.triggered ? '#dc2626' : '#16a34a', fontWeight: 700 }}>{r.triggered ? 'TRIGGERED' : 'PASSED'}</Typography>
                </Box>
              ))}
            </Stack>
          </Box>
        )}

        <Box>
          <SectionLabel>Actions on trigger</SectionLabel>
          <Stack gap={1.5}>
            <ActionRow label="Hold transaction" active={rule.actions.holdTransaction} detail={rule.actions.holdTransaction ? 'Transaction intercepted before settlement' : undefined} />
            <ActionRow label="Open case" active={rule.actions.openCase.enabled} detail={rule.actions.openCase.enabled ? `Severity: ${rule.actions.openCase.severity}` : undefined} />
            <ActionRow label="File report" active={rule.actions.fileReport.enabled} detail={rule.actions.fileReport.enabled ? rule.actions.fileReport.reportType : undefined} />
            <ActionRow label="Notify roles" active={rule.actions.notifyRoles.length > 0} detail={rule.actions.notifyRoles.length > 0 ? rule.actions.notifyRoles.join(', ') : undefined} />
          </Stack>
        </Box>
      </Stack>

      <TOTPConfirmation
        open={submitConfirm}
        onClose={() => setSubmitConfirm(false)}
        onConfirm={async () => {
          setSubmitConfirm(false)
          setSubmitting(true)
          try { await institutionRuleApi.submitForDevReview(rule.id); onRefresh() }
          finally { setSubmitting(false) }
        }}
        operation="update"
        title="Submit rule for developer review"
        description="This will lock the rule from further edits and send it to the development team for code review. Biometric verification is required."
        resourceName={rule.name}
        resourceType="Nomos Rule"
      />
    </Box>
  )
}

function ActionRow({ label, active, detail }: { label: string; active: boolean; detail?: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: active ? '#10b981' : '#cbd5e1', flexShrink: 0 }} />
      <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: active ? 'var(--heading-color)' : '#94a3b8', fontFamily: 'Jost' }}>{label}</Typography>
      {detail && <Typography sx={{ fontSize: '0.8125rem', color: '#64748b' }}>— {detail}</Typography>}
    </Box>
  )
}
