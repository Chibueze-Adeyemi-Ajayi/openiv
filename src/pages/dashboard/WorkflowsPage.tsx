import { useState, useEffect, useCallback, type ReactNode } from 'react'
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors,
  DragOverlay,
  type DragOverEvent, type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers'
import {
  SortableContext, verticalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Box, Typography, Stack, Button, Chip, TextField, IconButton, Drawer, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, Collapse,
} from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded'
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded'
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import ExpandLessRoundedIcon from '@mui/icons-material/ExpandLessRounded'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import BadgeRoundedIcon from '@mui/icons-material/BadgeRounded'
import FaceRetouchingNaturalRoundedIcon from '@mui/icons-material/FaceRetouchingNaturalRounded'
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded'
import PhoneRoundedIcon from '@mui/icons-material/PhoneRounded'
import SecurityRoundedIcon from '@mui/icons-material/SecurityRounded'
import ArticleRoundedIcon from '@mui/icons-material/ArticleRounded'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded'
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded'
import ApiRoundedIcon from '@mui/icons-material/ApiRounded'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import KeyRoundedIcon from '@mui/icons-material/KeyRounded'
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded'
import { colorPalette } from '@/theme'
import { getBaseUrl } from '@/api/client'
import { beamApi, type BeamApiKey } from '@/api/beam'
import TOTPConfirmation from '@/components/dashboard/TOTPConfirmation'
import type { TOTPOperation } from '@/components/dashboard/TOTPConfirmation'
import { useRbac } from '@/contexts/RbacContext'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import {
  workflowApi,
  type Workflow, type WorkflowBlock, type WorkflowSchedule,
  type WorkflowRun, type WorkflowRunItem,
} from '@/api/workflows'

// ── Constants ─────────────────────────────────────────────────────────────────

const BLOCK_META: Record<string, {
  label: string
  description: string
  required: string[]
  optional: string[]
  comingSoon?: boolean
}> = {
  identity_verify: {
    label: 'Identity Verification',
    description: 'Looks up BVN and/or NIN — confirms the identifier resolves to a registered identity.',
    required: [],
    optional: ['bvn', 'nin'],
  },
  liveness_match: {
    label: 'Facial Recognition',
    description: 'Biometric facial scan — matches a live selfie against the photo on the BVN or NIN record.',
    required: [],
    optional: ['selfie'],
  },
  pep_sanctions_screen: {
    label: 'PEP & Sanctions',
    description: 'Screens the customer name against global PEP and sanctions watchlists.',
    required: ['name', 'dob'],
    optional: [],
  },
  phone_basic: {
    label: 'Phone Lookup',
    description: 'Confirms the phone number is active and registered with a carrier.',
    required: ['phone'],
    optional: [],
  },
  phone_fraud: {
    label: 'Phone Fraud Screen',
    description: 'Checks for fraud signals — risk score, leaked credentials, spammer, disposable.',
    required: ['phone'],
    optional: [],
  },
  case_history: {
    label: 'Case History',
    description: 'Checks whether this customer has appeared in any previous investigation or flagged case. A history of escalations raises their risk level.',
    required: [],
    optional: [],
  },
  flagged_transactions: {
    label: 'Flagged Transactions',
    description: 'Checks whether this customer has transactions that were previously marked as suspicious. Repeated flagged activity is a strong indicator of risk.',
    required: [],
    optional: [],
  },
  document_verify: {
    label: 'Document Verification',
    description: "Analyses front (and optionally back) of a physical ID — passport, driver's licence, or national ID card.",
    required: [],
    optional: ['doc_front', 'doc_back'],
    comingSoon: true,
  },
}

// These block types are always anchored at the end of the flow — they cannot be
// reordered, cannot be dragged, and nothing can be placed after them.
const TERMINAL_TYPES = new Set(['case_history', 'flagged_transactions'])

const BLOCK_COLORS: Record<string, { color: string; icon: ReactNode }> = {
  identity_verify:      { color: '#1d4ed8', icon: <BadgeRoundedIcon   sx={{ fontSize: '1rem' }} /> },
  liveness_match:       { color: '#7c3aed', icon: <FaceRetouchingNaturalRoundedIcon sx={{ fontSize: '1rem' }} /> },
  pep_sanctions_screen: { color: '#b91c1c', icon: <ShieldRoundedIcon  sx={{ fontSize: '1rem' }} /> },
  phone_basic:          { color: '#0d9488', icon: <PhoneRoundedIcon   sx={{ fontSize: '1rem' }} /> },
  phone_fraud:          { color: '#d97706', icon: <SecurityRoundedIcon sx={{ fontSize: '1rem' }} /> },
  case_history:         { color: '#b45309', icon: <HistoryRoundedIcon   sx={{ fontSize: '1rem' }} /> },
  flagged_transactions: { color: '#dc2626', icon: <SecurityRoundedIcon  sx={{ fontSize: '1rem' }} /> },
  document_verify:      { color: '#4338ca', icon: <ArticleRoundedIcon   sx={{ fontSize: '1rem' }} /> },
}

const DEFAULT_WEIGHTS: Record<string, number> = {
  identity_verify: 35,
  liveness_match: 25,
  pep_sanctions_screen: 20,
  case_history: 20,
  document_verify: 15,
  phone_basic: 12,
  phone_fraud: 8,
  flagged_transactions: 5,
}

const DEFAULT_BLOCKS: WorkflowBlock[] = [
  { type: 'identity_verify',      weight: DEFAULT_WEIGHTS.identity_verify },
  { type: 'pep_sanctions_screen', weight: DEFAULT_WEIGHTS.pep_sanctions_screen },
  { type: 'phone_basic',          weight: DEFAULT_WEIGHTS.phone_basic },
  { type: 'case_history',         weight: DEFAULT_WEIGHTS.case_history },
  { type: 'flagged_transactions', weight: DEFAULT_WEIGHTS.flagged_transactions },
]

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  draft:            { bg: 'var(--section-bg)', color: '#64748b', label: 'Draft' },
  pending_approval: { bg: '#fffbeb',           color: '#d97706', label: 'Pending Approval' },
  active:           { bg: '#f0fdf4',           color: '#15803d', label: 'Active' },
  retired:          { bg: '#fef2f2',           color: '#991b1b', label: 'Retired' },
}

const STATUS_GROUPS = [
  { status: 'active',           label: 'Active',           desc: 'Accepting imports' },
  { status: 'pending_approval', label: 'Pending Approval', desc: 'Awaiting maker-checker approval' },
  { status: 'draft',            label: 'Drafts',           desc: 'Work in progress' },
  { status: 'retired',          label: 'Retired',          desc: 'No longer running' },
] as const

const mono = { fontFamily: 'SF Mono, Monaco, monospace' } as const
const sectionLabel = {
  fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8',
  textTransform: 'uppercase' as const, letterSpacing: '0.1em',
}

// ── Sortable block row ────────────────────────────────────────────────────────

interface SortableBlockItemProps {
  block: WorkflowBlock
  index: number
  isLast: boolean
  isDraft: boolean
  canModify: boolean
  totalWeight: number
  onDelete: () => void
  onWeightChange: (w: number) => void
}

function SortableBlockItem({
  block, index, isLast, isDraft, canModify, totalWeight, onDelete, onWeightChange,
}: SortableBlockItemProps) {
  const isTerminal = TERMINAL_TYPES.has(block.type)
  const locked     = block.type === 'identity_verify' || isTerminal
  const canDrag    = isDraft && canModify && !locked
  const bc      = BLOCK_COLORS[block.type]
  const meta    = BLOCK_META[block.type]
  const weight  = block.weight ?? DEFAULT_WEIGHTS[block.type] ?? 10
  const pct     = totalWeight > 0 ? Math.round((weight / totalWeight) * 100) : 0

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: block.type, disabled: !canDrag })

  return (
    <Box
      ref={setNodeRef}
      {...attributes}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition ?? undefined,
        zIndex: isDragging ? 10 : undefined,
        position: 'relative',
      }}
    >
      <Box
        {...(canDrag ? listeners : {})}
        sx={{
          display: 'flex', alignItems: 'center', gap: 1.5,
          px: 2, py: 1.75,
          bgcolor: 'var(--card-bg)',
          border: '1px solid var(--border-col)',
          borderLeft: `3px solid ${bc?.color ?? '#e2e8f0'}`,
          boxShadow: isDragging ? '0 8px 24px rgba(15,23,42,0.14)' : 'none',
          opacity: isDragging ? 0 : 1,
          transition: 'box-shadow 0.15s, opacity 0.15s',
          cursor: canDrag ? (isDragging ? 'grabbing' : 'grab') : 'default',
          touchAction: 'none',
          userSelect: 'none',
        }}
      >
        {isDraft && canModify && (
          <DragIndicatorRoundedIcon sx={{ fontSize: '1.125rem', color: canDrag ? '#cbd5e1' : 'transparent', flexShrink: 0, mr: -0.5 }} />
        )}
        <Box sx={{
          width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
          bgcolor: locked ? '#94a3b8' : colorPalette.primary, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.6875rem', fontWeight: 800, ...mono,
        }}>
          {index + 1}
        </Box>
        <Box sx={{ width: 30, height: 30, flexShrink: 0, bgcolor: `${bc?.color ?? '#94a3b8'}12`, color: bc?.color ?? '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {bc?.icon}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost' }}>
              {meta?.label ?? block.type}
            </Typography>
            {isTerminal ? (
              <Chip
                icon={<LockOutlinedIcon sx={{ fontSize: '0.5rem !important', ml: '4px !important' }} />}
                label="Anchored · End"
                size="small"
                sx={{ height: 16, fontSize: '0.5625rem', fontWeight: 700, fontFamily: 'Jost', bgcolor: '#fff7ed', color: '#c2410c', borderRadius: '4px', '& .MuiChip-label': { px: 0.75 } }}
              />
            ) : locked ? (
              <Chip label="Fixed" size="small" sx={{ height: 16, fontSize: '0.5625rem', fontWeight: 700, fontFamily: 'Jost', bgcolor: '#f1f5f9', color: '#94a3b8', borderRadius: '4px', '& .MuiChip-label': { px: 0.75 } }} />
            ) : null}
          </Box>
          <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', mt: 0.25, lineHeight: 1.4 }}>
            {meta?.description}
          </Typography>
        </Box>
        {/* Weight chip — editable when draft */}
        <Box sx={{ flexShrink: 0, textAlign: 'center', minWidth: 52 }} onClick={e => e.stopPropagation()}>
          {isDraft && canModify ? (
            <TextField
              type="number"
              size="small"
              value={weight}
              onChange={e => {
                const v = Math.max(1, Math.min(99, Number(e.target.value)))
                onWeightChange(v)
              }}
              inputProps={{ min: 1, max: 99, step: 1 }}
              sx={{
                width: 52,
                '& .MuiOutlinedInput-root': { borderRadius: 0, height: 28 },
                '& .MuiOutlinedInput-input': { p: '4px 6px', fontSize: '0.75rem', fontWeight: 700, ...mono, textAlign: 'center' },
                '& .MuiOutlinedInput-notchedOutline': { borderColor: bc?.color ?? 'var(--border-col)' },
              }}
            />
          ) : (
            <Box sx={{ border: `1px solid ${bc?.color ?? 'var(--border-col)'}`, px: 0.75, py: 0.25, display: 'inline-block' }}>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, ...mono, color: bc?.color ?? '#64748b' }}>{weight}</Typography>
            </Box>
          )}
          <Typography sx={{ fontSize: '0.5rem', color: '#94a3b8', mt: 0.25, letterSpacing: '0.04em' }}>
            {pct}% influence
          </Typography>
        </Box>

        {isDraft && canModify && (
          <Box sx={{ flexShrink: 0 }} onClick={e => e.stopPropagation()}>
            <IconButton size="small" onClick={onDelete} disabled={locked} sx={{ opacity: locked ? 0.3 : 1 }}>
              <DeleteOutlineRoundedIcon sx={{ fontSize: '0.875rem', color: locked ? '#94a3b8' : '#dc2626' }} />
            </IconButton>
          </Box>
        )}
      </Box>
      {!isLast && <Box sx={{ ml: '32px', height: 18, borderLeft: '2px dashed #e2e8f0' }} />}
    </Box>
  )
}

// ── Risk badge helper ──────────────────────────────────────────────────────────

function RiskBadge({ score }: { score: number }) {
  const high   = score >= 70
  const medium = score >= 40
  const color  = high ? '#dc2626' : medium ? '#d97706' : '#15803d'
  const bg     = high ? '#fef2f2' : medium ? '#fffbeb' : '#f0fdf4'
  const label  = high ? 'High Risk' : medium ? 'Medium Risk' : 'Low Risk'
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Box sx={{
        width: 40, height: 40, border: `3px solid ${color}`, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 800, color, ...mono }}>{score}</Typography>
      </Box>
      <Box>
        <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color, fontFamily: 'Jost' }}>{label}</Typography>
        <Typography sx={{ fontSize: '0.625rem', color: '#94a3b8' }}>CDD Risk Score</Typography>
      </Box>
    </Box>
  )
}

// ── Syntax highlighting ────────────────────────────────────────────────────────

type HToken = { text: string; color: string; italic?: boolean }

function jsonTokens(src: string): HToken[] {
  const out: HToken[] = []
  const re = /"(?:[^"\\]|\\.)*"|true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[{}[\],:]|\s+|\/\/[^\n]*/g
  let last = 0, m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) {
    if (m.index > last) out.push({ text: src.slice(last, m.index), color: '#e2e8f0' })
    const tok = m[0]
    if (tok.startsWith('"')) {
      const after = src.slice(m.index + tok.length).trimStart()
      out.push({ text: tok, color: after.startsWith(':') ? '#7dd3fc' : '#86efac' })
    } else if (tok === 'true' || tok === 'false' || tok === 'null') {
      out.push({ text: tok, color: '#c084fc' })
    } else if (/^-?\d/.test(tok)) {
      out.push({ text: tok, color: '#fb923c' })
    } else if (tok === '{' || tok === '}' || tok === '[' || tok === ']') {
      out.push({ text: tok, color: '#e2e8f0' })
    } else if (tok === ':' || tok === ',') {
      out.push({ text: tok, color: '#94a3b8' })
    } else if (tok.startsWith('//')) {
      out.push({ text: tok, color: '#64748b', italic: true })
    } else {
      out.push({ text: tok, color: '#e2e8f0' })
    }
    last = m.index + tok.length
  }
  if (last < src.length) out.push({ text: src.slice(last), color: '#e2e8f0' })
  return out
}

function shellTokens(src: string): HToken[] {
  const out: HToken[] = []
  const lines = src.split('\n')
  for (let li = 0; li < lines.length; li++) {
    let line = lines[li], i = 0
    while (i < line.length) {
      // # comment
      if (line[i] === '#') { out.push({ text: line.slice(i), color: '#64748b', italic: true }); i = line.length; continue }
      // curl
      if (line.slice(i, i + 4) === 'curl' && !/\w/.test(line[i + 4] ?? '')) {
        out.push({ text: 'curl', color: '#f472b6' }); i += 4; continue
      }
      // HTTP methods
      const methMatch = line.slice(i).match(/^(POST|GET|PUT|DELETE|PATCH)(?!\w)/)
      if (methMatch) { out.push({ text: methMatch[0], color: '#fb923c' }); i += methMatch[0].length; continue }
      // flags
      if (line[i] === '-') {
        const fm = line.slice(i).match(/^-{1,2}[\w-]+/)
        if (fm) { out.push({ text: fm[0], color: '#fbbf24' }); i += fm[0].length; continue }
      }
      // URLs
      const um = line.slice(i).match(/^https?:\/\/[^\s"'\\]+/)
      if (um) { out.push({ text: um[0], color: '#34d399' }); i += um[0].length; continue }
      // quoted strings
      if (line[i] === '"' || line[i] === "'") {
        const q = line[i]; let str = q; i++
        while (i < line.length && line[i] !== q) {
          if (line[i] === '\\' && i + 1 < line.length) { str += line[i] + line[i + 1]; i += 2; continue }
          str += line[i++]
        }
        if (i < line.length) { str += q; i++ }
        out.push({ text: str, color: '#86efac' }); continue
      }
      // line continuation
      if (line[i] === '\\' && i === line.length - 1) { out.push({ text: '\\', color: '#94a3b8' }); i++; continue }
      out.push({ text: line[i], color: '#e2e8f0' }); i++
    }
    if (li < lines.length - 1) out.push({ text: '\n', color: '#e2e8f0' })
  }
  return out
}

function sseTokens(src: string): HToken[] {
  const out: HToken[] = []
  for (const line of src.split('\n')) {
    if (line.startsWith('event:')) {
      out.push({ text: 'event:', color: '#94a3b8' })
      out.push({ text: line.slice(6), color: '#7dd3fc' })
    } else if (line.startsWith('data: {') || line.startsWith('data: [')) {
      out.push({ text: 'data: ', color: '#94a3b8' })
      out.push(...jsonTokens(line.slice(6)))
    } else if (line.startsWith('data:')) {
      out.push({ text: 'data:', color: '#94a3b8' })
      out.push({ text: line.slice(5), color: '#e2e8f0' })
    } else if (line.startsWith('  ')) {
      // continuation JSON lines
      out.push(...jsonTokens(line))
    } else {
      out.push({ text: line, color: '#94a3b8' })
    }
    out.push({ text: '\n', color: '#e2e8f0' })
  }
  return out
}

function Highlight({ tokens }: { tokens: HToken[] }) {
  return (
    <>
      {tokens.map((t, i) => (
        <span key={i} style={{ color: t.color, fontStyle: t.italic ? 'italic' : undefined }}>{t.text}</span>
      ))}
    </>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function WorkflowsPage() {
  const { can } = useRbac()
  const canModify = can('workflows.modify')
  const user = useCurrentUser()

  const [workflows, setWorkflows]           = useState<Workflow[]>([])
  const [loading, setLoading]               = useState(true)
  const [editing, setEditing]               = useState<Workflow | null>(null)
  const [enrichmentCount, setEnrichmentCount] = useState<number>(0)

  // view: 'list' | 'editor' | 'api'
  const [view, setView] = useState<'list' | 'editor' | 'api'>('list')

  // Builder state
  const [blocks, setBlocks]                   = useState<WorkflowBlock[]>([])
  const [schedule, setSchedule]               = useState<WorkflowSchedule>({ highDays: 30, mediumDays: 90, lowDays: 365 })
  const [scheduleEnabled, setScheduleEnabled]       = useState(false)
  const [rescheduleDays, setRescheduleDays]         = useState<number | null>(null)
  const [caseRiskThreshold, setCaseRiskThreshold]   = useState(75)
  const [saving, setSaving]                   = useState(false)
  const [estimate, setEstimate]               = useState<number | null>(null)

  // API key state
  const [keyInfo, setKeyInfo]           = useState<BeamApiKey | null>(null)
  const [keyLoaded, setKeyLoaded]       = useState(false)
  const [keyModalOpen, setKeyModalOpen] = useState(false)
  const [keyTotpOpen, setKeyTotpOpen]   = useState(false)
  const [newKey, setNewKey]             = useState<string | null>(null)
  const [keyGenerating, setKeyGenerating] = useState(false)

  const loadKeyInfo = useCallback(async () => {
    if (keyLoaded) return
    try { const r = await beamApi.getApiKeyInfo(); setKeyInfo(r.key); setKeyLoaded(true) }
    catch { /* ignore */ }
  }, [keyLoaded])

  const handleGenerateKey = async () => {
    setKeyGenerating(true)
    try {
      const r = await beamApi.generateApiKey()
      setNewKey(r.apiKey)
      setKeyInfo({ prefix: r.apiKey.slice(0, 14), createdAt: new Date().toISOString(), lastUsedAt: null })
    } finally { setKeyGenerating(false) }
  }

  // Copy-to-clipboard state
  const [copied, setCopied] = useState<string | null>(null)

  const copyText = (key: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(null), 1800)
    })
  }

  // Create modal
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName]       = useState('')
  const [creating, setCreating]     = useState(false)

  // Dirty tracking
  const [draftName, setDraftName]                         = useState('')
  const [origName, setOrigName]                           = useState('')
  const [origBlocks, setOrigBlocks]                       = useState<WorkflowBlock[]>([])
  const [origSchedule, setOrigSchedule]                   = useState<WorkflowSchedule>({ highDays: 30, mediumDays: 90, lowDays: 365 })
  const [origScheduleEnabled, setOrigScheduleEnabled]     = useState(false)
  const [origRescheduleDays, setOrigRescheduleDays]       = useState<number | null>(null)
  const [leavingConfirm, setLeavingConfirm]               = useState(false)

  // List group expand/collapse
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    active: true, pending_approval: true, draft: true, retired: false,
  })

  // Drag-to-reorder (dnd-kit)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 5 } }),
  )

  // TOTP gate
  type PendingAction = { op: TOTPOperation; title: string; description: string; resourceName: string; execute: () => Promise<void> }
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)

  const executePending = async () => {
    if (!pendingAction) return
    try {
      await pendingAction.execute()
    } catch (err: any) {
      alert(err?.detail ?? err?.message ?? 'Action failed')
    } finally {
      setPendingAction(null)
    }
  }

  const [deleting, setDeleting] = useState(false)

  // Run history drawer
  const [runsFor, setRunsFor]   = useState<Workflow | null>(null)
  const [runs, setRuns]         = useState<WorkflowRun[]>([])
  const [runItems, setRunItems] = useState<WorkflowRunItem[] | null>(null)
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set())

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [res, countRes] = await Promise.all([
        workflowApi.list(),
        workflowApi.enrichmentCount(),
      ])
      setWorkflows(res.workflows)
      setEnrichmentCount(countRes.count)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const isDirty = !!editing && editing.status === 'draft' && (
    draftName !== origName ||
    scheduleEnabled !== origScheduleEnabled ||
    rescheduleDays !== origRescheduleDays ||
    JSON.stringify(schedule) !== JSON.stringify(origSchedule) ||
    JSON.stringify(blocks)   !== JSON.stringify(origBlocks)
  )

  useEffect(() => {
    if (!isDirty) return
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [isDirty])

  // ── Builder helpers ────────────────────────────────────────────────────────

  const withDefaultWeights = (bks: WorkflowBlock[]): WorkflowBlock[] =>
    bks.map(b => ({ ...b, weight: b.weight ?? DEFAULT_WEIGHTS[b.type] ?? 10 }))

  const openEditor = (wf: Workflow) => {
    setEditing(wf)
    setView('editor')
    setBlocks(withDefaultWeights(wf.blocks))
    setSchedule(wf.schedule)
    setScheduleEnabled(wf.scheduleEnabled)
    setRescheduleDays(wf.rescheduleDays ?? null)
    setCaseRiskThreshold(wf.caseRiskThreshold ?? 75)
    setEstimate(null)
    setDraftName(wf.name)
    setOrigName(wf.name)
    setOrigBlocks(withDefaultWeights(wf.blocks))
    setOrigSchedule(wf.schedule)
    setOrigScheduleEnabled(wf.scheduleEnabled)
    setOrigRescheduleDays(wf.rescheduleDays ?? null)
    workflowApi.estimate(wf.id)
      .then(e => setEstimate(e.estimatedScreeningsPerMonth))
      .catch(() => {})
  }

  const handleBack = () => {
    if (isDirty) setLeavingConfirm(true)
    else { setEditing(null); setView('list') }
  }

  const usedTypes = new Set(blocks.map(b => b.type))

  const saveDraft = () => {
    if (!editing) return
    const name = draftName.trim() || editing.name
    const snap = { id: editing.id, blocks: [...blocks], schedule: { ...schedule }, scheduleEnabled, rescheduleDays, caseRiskThreshold }
    setPendingAction({
      op: 'update', title: 'Save Draft',
      description: 'Saving changes to this CDD workflow. Confirm with your authenticator code.',
      resourceName: name,
      execute: async () => {
        setSaving(true)
        try {
          const res = await workflowApi.update(snap.id, name, snap.blocks, snap.schedule, snap.scheduleEnabled, snap.rescheduleDays, snap.caseRiskThreshold)
          setEditing(res.workflow)
          setDraftName(res.workflow.name)
          setOrigName(res.workflow.name)
          setOrigBlocks(res.workflow.blocks)
          setOrigSchedule(res.workflow.schedule)
          setOrigScheduleEnabled(res.workflow.scheduleEnabled)
          setOrigRescheduleDays(res.workflow.rescheduleDays ?? null)
          await loadData()
        } finally { setSaving(false) }
      },
    })
  }

  const handleCreate = () => {
    const name = newName.trim()
    if (!name) return
    setPendingAction({
      op: 'create', title: 'Create Workflow',
      description: 'Creating a new CDD workflow draft. Confirm with your authenticator code.',
      resourceName: name,
      execute: async () => {
        setCreating(true)
        try {
          const res = await workflowApi.create(name, DEFAULT_BLOCKS)
          setCreateOpen(false)
          setNewName('')
          await loadData()
          openEditor(res.workflow)
        } finally { setCreating(false) }
      },
    })
  }

  const requestDelete = (wf: Workflow) => {
    setPendingAction({
      op: 'delete', title: 'Delete Workflow',
      description: 'Permanently removes this draft. Active and retired workflows cannot be deleted.',
      resourceName: wf.name,
      execute: async () => {
        setDeleting(true)
        try {
          await workflowApi.delete(wf.id)
          if (editing?.id === wf.id) { setEditing(null); setView('list') }
          await loadData()
        } finally { setDeleting(false) }
      },
    })
  }

  const transition = (action: 'submit' | 'approve' | 'retire' | 'newVersion', wf: Workflow) => {
    const meta: Record<typeof action, { op: TOTPOperation; title: string; description: string }> = {
      submit:     { op: 'update', title: 'Submit for Approval',  description: 'Submit for maker-checker approval. A different officer must approve before it activates.' },
      approve:    { op: 'update', title: 'Approve Workflow',     description: 'Activate this workflow. It will immediately begin accepting import batches.' },
      retire:     { op: 'delete', title: 'Retire Workflow',      description: 'Retire this workflow. The record is retained as audit evidence.' },
      newVersion: { op: 'create', title: 'Create New Version',   description: 'Clone into a new draft. The active version keeps running until the new one is approved.' },
    }
    const { op, title, description } = meta[action]
    const submitSnap = action === 'submit'
      ? { name: draftName.trim() || wf.name, blocks: [...blocks], schedule: { ...schedule }, scheduleEnabled, rescheduleDays, caseRiskThreshold }
      : null
    setPendingAction({
      op, title, description,
      resourceName: wf.name,
      execute: async () => {
        if (action === 'newVersion') {
          const res = await workflowApi.newVersion(wf.id)
          await loadData()
          openEditor(res.workflow)
          return
        }
        if (action === 'submit' && submitSnap) {
          await workflowApi.update(wf.id, submitSnap.name, submitSnap.blocks, submitSnap.schedule, submitSnap.scheduleEnabled, submitSnap.rescheduleDays, submitSnap.caseRiskThreshold)
          await workflowApi.submit(wf.id)
          await loadData()
          if (editing?.id === wf.id) { setEditing(null); setView('list') }
          return
        }
        await workflowApi[action](wf.id)
        await loadData()
        if (editing?.id === wf.id) { setEditing(null); setView('list') }
      },
    })
  }

  const openRuns = async (wf: Workflow) => {
    setRunsFor(wf)
    setRunItems(null)
    setExpandedItems(new Set())
    try {
      const res = await workflowApi.listRuns(wf.id)
      setRuns(res.runs)
    } catch { setRuns([]) }
  }

  const downloadRunItems = (wf: Workflow, items: WorkflowRunItem[]) => {
    const data = items.map(item => ({
      customerId:   item.customerId,
      outcome:      item.outcome,
      cddRiskScore: (item as any).cddRiskScore ?? null,
      concerns:     (item as any).concerns ?? [],
      steps:        item.stepResults.map(s => ({
        block:  BLOCK_META[s.type]?.label ?? s.type,
        status: s.status,
        score:  s.score ?? null,
        detail: s.detail,
      })),
    }))
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `${wf.name.replace(/\s+/g, '_')}_run_results.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const baseUrl = getBaseUrl() || window.location.origin

  // ── Import API doc helpers ─────────────────────────────────────────────────

  const buildApiDocs = (wf: Workflow, wfBlocks: WorkflowBlock[]) => {
    const importUrl    = `${baseUrl}/api/v1/workflows/${wf.id}/import`
    const activeTypes  = wfBlocks.map(b => b.type)
    const hasIdentity  = activeTypes.includes('identity_verify')
    const hasPep       = activeTypes.includes('pep_sanctions_screen')
    const hasPhone     = activeTypes.includes('phone_basic') || activeTypes.includes('phone_fraud')
    const hasLiveness  = activeTypes.includes('liveness_match')
    const hasDoc       = activeTypes.includes('document_verify')

    const sampleCustomer: Record<string, string> = {
      customerId: 'VTG-2024-001',
      firstName:  'Adeyemi',
      lastName:   'Chibueze',
      middleName: 'John',
    }
    if (hasIdentity || hasPep)  sampleCustomer.dob = '1985-04-15'
    if (hasIdentity) { sampleCustomer.id = '22212345678'; sampleCustomer.id_type = 'BVN' }
    if (hasPhone)   sampleCustomer.phone = '+2348012345678'
    if (hasDoc) {
      sampleCustomer.doc_front = '<base64-encoded-front>'
      sampleCustomer.doc_back  = '<base64-encoded-back>'
    }

    const curlCustomers = JSON.stringify([{
      customerId: 'VTG-001', firstName: 'Adeyemi', lastName: 'Chibueze',
      ...(hasIdentity || hasPep ? { dob: '1985-04-15' } : {}),
      ...(hasIdentity ? { id: '22212345678', id_type: 'BVN' } : {}),
      ...(hasPhone    ? { phone: '+2348012345678' } : {}),
    }])

    const jsonBody = JSON.stringify({ customers: [sampleCustomer] }, null, 2)

    const curlJson = [
      `curl -X POST \\`,
      `  "${importUrl}" \\`,
      `  -H "Authorization: Bearer <your-api-key>" \\`,
      `  -H "Content-Type: application/json" \\`,
      `  --no-buffer \\`,
      `  -d '{"customers":${curlCustomers}}'`,
    ].join('\n')

    const curlMultipart = [
      `curl -X POST \\`,
      `  "${importUrl}" \\`,
      `  -H "Authorization: Bearer <your-api-key>" \\`,
      `  --no-buffer \\`,
      `  -F "customerId=VTG-001" \\`,
      `  -F "firstName=Adeyemi" \\`,
      `  -F "lastName=Chibueze" \\`,
      ...(hasIdentity || hasPep ? [`  -F "dob=1985-04-15" \\`] : []),
      ...(hasIdentity ? [`  -F "id=22212345678" \\`, `  -F "id_type=BVN" \\`] : []),
      ...(hasPhone    ? [`  -F "phone=+2348012345678" \\`] : []),
      `  -F "selfie=@/path/to/selfie.jpg"`,
    ].join('\n')

    const sseExample = [
      'event: started',
      `data: {"workflowId":${wf.id},"totalCustomers":1}`,
      '',
      'event: customer',
      `data: {`,
      `  "outcome": "match",`,
      `  "customerId": "VTG-2024-001",`,
      `  "name": "Adeyemi Chibueze",`,
      `  "cddRiskScore": 72,`,
      `  "caseFlagged": true,`,
      `  "concerns": [{"type":"name_mismatch","detail":"Identity name differs from provided name"}],`,
      `  "stepResults": [`,
      `    {"type":"identity_verify","status":"pass","score":95,"detail":"BVN resolved — Adeyemi John Chibueze","ms":340},`,
      `    {"type":"pep_sanctions_screen","status":"match","score":20,"detail":"1 sanctions hit — Low confidence","ms":1820},`,
      `    {"type":"phone_basic","status":"pass","score":90,"detail":"Active — MTN Nigeria","ms":410}`,
      `  ]`,
      `}`,
      '',
      'event: done',
      `data: {"runId":57,"totalCustomers":1}`,
    ].join('\n')

    return { importUrl, jsonBody, curlJson, curlMultipart, sseExample, hasLiveness, hasIdentity }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>

      {/* ══════════════════════════════════ IMPORT API FULL SCREEN ═══════════════════════════════ */}
      {view === 'api' && editing && (() => {
        const { importUrl, jsonBody, curlJson, curlMultipart, sseExample, hasLiveness, hasIdentity } =
          buildApiDocs(editing, blocks)

        const CopyBtn = ({ id, text }: { id: string; text: string }) => (
          <Tooltip title={copied === id ? 'Copied!' : 'Copy'}>
            <IconButton size="small" onClick={() => copyText(id, text)}
              sx={{ color: copied === id ? '#10b981' : '#94a3b8', '&:hover': { color: 'var(--heading-color)' } }}>
              <ContentCopyRoundedIcon sx={{ fontSize: '0.875rem' }} />
            </IconButton>
          </Tooltip>
        )

        const CodeBlock = ({ id, code, label, lang = 'json' }: { id: string; code: string; label?: string; lang?: 'json' | 'shell' | 'sse' }) => {
          const tokens = lang === 'shell' ? shellTokens(code) : lang === 'sse' ? sseTokens(code) : jsonTokens(code)
          return (
            <Box sx={{ mb: 2.5 }}>
              {label && <Typography sx={{ ...sectionLabel, mb: 0.75 }}>{label}</Typography>}
              <Box sx={{ position: 'relative', bgcolor: '#0d1117', border: '1px solid #21262d', borderRadius: '6px' }}>
                {/* Title bar */}
                <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 0.875, borderBottom: '1px solid #21262d', gap: 0.75 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#ff5f57' }} />
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#febc2e' }} />
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#28c840' }} />
                  <Chip label={lang === 'shell' ? 'bash' : lang === 'sse' ? 'event-stream' : 'json'} size="small"
                    sx={{ ml: 'auto', height: 16, fontSize: '0.5625rem', fontWeight: 600, fontFamily: 'Jost',
                      bgcolor: '#21262d', color: '#8b949e', borderRadius: '3px', '& .MuiChip-label': { px: 0.75 } }} />
                  <CopyBtn id={id} text={code} />
                </Box>
                <Box component="pre" sx={{
                  m: 0, p: 2,
                  fontSize: '0.75rem', ...mono, color: '#e2e8f0',
                  overflow: 'auto', whiteSpace: 'pre', lineHeight: 1.75,
                  maxHeight: 420,
                }}>
                  <Highlight tokens={tokens} />
                </Box>
              </Box>
            </Box>
          )
        }

        const ErrorRow = ({ code, msg, reason }: { code: string; msg: string; reason: string }) => (
          <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid var(--border-col)', '&:last-child': { borderBottom: 'none' } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Chip label={code} size="small" sx={{ height: 18, fontSize: '0.5625rem', fontWeight: 700, bgcolor: '#fef2f2', color: '#991b1b', borderRadius: '3px', ...mono, '& .MuiChip-label': { px: 0.75 } }} />
              <Typography sx={{ fontSize: '0.6875rem', ...mono, color: '#dc2626' }}>{msg}</Typography>
            </Box>
            <Typography sx={{ fontSize: '0.75rem', color: '#64748b', lineHeight: 1.55 }}>{reason}</Typography>
          </Box>
        )

        return (
          <>
            {/* Breadcrumb header */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 4, flexWrap: 'wrap' }}>
              <Button onClick={() => { setEditing(null); setView('list') }}
                sx={{ textTransform: 'none', fontFamily: 'Jost', fontWeight: 600, color: '#64748b', px: 1, minWidth: 0, '&:hover': { color: colorPalette.primary } }}>
                Workflows
              </Button>
              <ChevronRightRoundedIcon sx={{ fontSize: '1rem', color: '#cbd5e1' }} />
              <Button onClick={() => setView('editor')}
                sx={{ textTransform: 'none', fontFamily: 'Jost', fontWeight: 600, color: '#64748b', px: 1, minWidth: 0, '&:hover': { color: colorPalette.primary } }}>
                {editing.name}
              </Button>
              <ChevronRightRoundedIcon sx={{ fontSize: '1rem', color: '#cbd5e1' }} />
              <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost', px: 1 }}>
                Import API
              </Typography>
            </Box>

            <Box>
              {/* Title */}
              <Box sx={{ mb: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                  <Box sx={{ width: 36, height: 36, bgcolor: `${colorPalette.primary}12`, color: colorPalette.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ApiRoundedIcon sx={{ fontSize: '1.25rem' }} />
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--heading-color)', fontFamily: 'Jost', letterSpacing: '-0.01em' }}>
                      Import API
                    </Typography>
                    <Typography sx={{ fontSize: '0.8125rem', color: '#64748b' }}>
                      Submit customers into this workflow programmatically. Results stream back in real time.
                    </Typography>
                  </Box>
                </Box>
              </Box>

              {/* Endpoint */}
              <Box sx={{ mb: 3.5 }}>
                <Typography sx={{ ...sectionLabel, mb: 1 }}>Endpoint</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.5, bgcolor: 'var(--section-bg)', border: '1px solid var(--border-col)' }}>
                  <Chip label="POST" size="small" sx={{ bgcolor: `${colorPalette.primary}15`, color: colorPalette.primary, fontWeight: 700, fontSize: '0.6875rem', borderRadius: '3px', height: 22, ...mono }} />
                  <Typography sx={{ fontSize: '0.8125rem', ...mono, color: 'var(--heading-color)', flex: 1, wordBreak: 'break-all' }}>
                    {importUrl}
                  </Typography>
                  <CopyBtn id="url" text={importUrl} />
                </Box>
              </Box>

              {/* Auth */}
              <Box sx={{ mb: 3.5 }}>
                <Typography sx={{ ...sectionLabel, mb: 1 }}>Authentication</Typography>
                <Box sx={{ p: 2, bgcolor: 'var(--section-bg)', border: '1px solid var(--border-col)' }}>
                  <Typography sx={{ fontSize: '0.8125rem', color: '#64748b', mb: 1.25, lineHeight: 1.6 }}>
                    All requests require a Bearer token in the{' '}
                    <Box component="span" sx={{ ...mono, color: 'var(--heading-color)' }}>Authorization</Box> header.
                  </Typography>
                  <Box sx={{ bgcolor: '#0f172a', border: '1px solid #1e293b', px: 2, py: 1, mb: 1.5 }}>
                    <Typography sx={{ fontSize: '0.75rem', ...mono, color: '#94a3b8' }}>
                      Authorization: Bearer <Box component="span" sx={{ color: '#fbbf24' }}>{'<your-api-key>'}</Box>
                    </Typography>
                  </Box>
                  {/* Key status + action */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                    {keyLoaded ? (
                      keyInfo ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#10b981', flexShrink: 0 }} />
                          <Typography sx={{ fontSize: '0.75rem', ...mono, color: 'var(--heading-color)' }}>
                            {keyInfo.prefix}••••••••••••••••••
                          </Typography>
                          <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', ml: 0.5 }}>
                            · {keyInfo.lastUsedAt ? `Last used ${new Date(keyInfo.lastUsedAt).toLocaleDateString()}` : 'Never used'}
                          </Typography>
                        </Box>
                      ) : (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#94a3b8', flexShrink: 0 }} />
                          <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>No API key set</Typography>
                        </Box>
                      )
                    ) : (
                      <Box sx={{ flex: 1 }} />
                    )}
                    <Button
                      size="small"
                      startIcon={<KeyRoundedIcon sx={{ fontSize: '0.875rem' }} />}
                      onClick={() => { loadKeyInfo(); setKeyModalOpen(true) }}
                      sx={{
                        textTransform: 'none', fontFamily: 'Jost', fontWeight: 600, fontSize: '0.8125rem',
                        px: 1.5, borderRadius: 0,
                        bgcolor: keyInfo ? 'var(--section-bg)' : colorPalette.primary,
                        color: keyInfo ? 'var(--heading-color)' : '#fff',
                        border: `1px solid ${keyInfo ? 'var(--border-col)' : colorPalette.primary}`,
                        '&:hover': { bgcolor: keyInfo ? 'var(--border-col)' : colorPalette.primary + 'dd' },
                      }}>
                      {keyLoaded && keyInfo ? 'Regenerate key' : 'Generate API key'}
                    </Button>
                  </Box>
                </Box>
              </Box>

              {/* Active blocks */}
              <Box sx={{ mb: 3.5 }}>
                <Typography sx={{ ...sectionLabel, mb: 1 }}>Blocks active in this workflow</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {blocks.map((b, i) => {
                    const bc   = BLOCK_COLORS[b.type]
                    const meta = BLOCK_META[b.type]
                    return (
                      <Box key={b.type} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.25, py: 0.625, bgcolor: `${bc?.color ?? '#94a3b8'}10`, border: `1px solid ${bc?.color ?? '#94a3b8'}25` }}>
                        <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: '#94a3b8', ...mono }}>{i + 1}</Typography>
                        <Box sx={{ color: bc?.color ?? '#94a3b8', display: 'flex', '& svg': { fontSize: '0.8125rem' } }}>{bc?.icon}</Box>
                        <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: bc?.color ?? '#94a3b8', fontFamily: 'Jost' }}>{meta?.label ?? b.type}</Typography>
                      </Box>
                    )
                  })}
                </Box>
              </Box>

              {/* Request formats */}
              <Box sx={{ mb: 3.5 }}>
                <Typography sx={{ ...sectionLabel, mb: 1.5 }}>Request formats</Typography>

                {/* Option A: JSON */}
                <Box sx={{ mb: 3, pb: 3, borderBottom: '1px solid var(--border-col)' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Chip label="Option A" size="small" sx={{ bgcolor: `${colorPalette.primary}12`, color: colorPalette.primary, fontWeight: 700, fontSize: '0.625rem', borderRadius: '3px', height: 20, fontFamily: 'Jost' }} />
                    <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost' }}>
                      JSON body — batch of one or more customers
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: '0.8125rem', color: '#64748b', mb: 1.5, lineHeight: 1.6 }}>
                    Send <Box component="span" sx={{ ...mono, bgcolor: 'var(--section-bg)', px: 0.5 }}>Content-Type: application/json</Box>.
                    The <Box component="span" sx={{ ...mono }}>customers</Box> array can hold multiple records per request.
                    {hasIdentity && <> Set <Box component="span" sx={{ ...mono }}>id_type</Box> to <Box component="span" sx={{ ...mono }}>BVN</Box> or <Box component="span" sx={{ ...mono }}>NIN</Box>.</>}
                  </Typography>
                  <CodeBlock id="jsonBody" code={jsonBody} label="Request body" lang="json" />
                  <CodeBlock id="curlJson" code={curlJson} label="cURL" lang="shell" />
                </Box>

                {/* Option B: Multipart flat fields */}
                {hasLiveness && (
                  <Box sx={{ mb: 3, pb: 3, borderBottom: '1px solid var(--border-col)' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Chip label="Option B" size="small" sx={{ bgcolor: '#7c3aed12', color: '#7c3aed', fontWeight: 700, fontSize: '0.625rem', borderRadius: '3px', height: 20, fontFamily: 'Jost' }} />
                      <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost' }}>
                        Multipart form — single customer with selfie
                      </Typography>
                    </Box>
                    <Typography sx={{ fontSize: '0.8125rem', color: '#64748b', mb: 1.5, lineHeight: 1.6 }}>
                      Use <Box component="span" sx={{ ...mono, bgcolor: 'var(--section-bg)', px: 0.5 }}>multipart/form-data</Box> when you need to upload a selfie image alongside the customer record.
                      Send each customer field as a separate text field and the image as <Box component="span" sx={{ ...mono }}>selfie</Box>.
                    </Typography>
                    <CodeBlock id="curlMultipart" code={curlMultipart} label="cURL" lang="shell" />
                  </Box>
                )}

                {/* Option C: Batch with selfie base64 */}
                {hasLiveness && (
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Chip label="Option C" size="small" sx={{ bgcolor: '#059669' + '12', color: '#059669', fontWeight: 700, fontSize: '0.625rem', borderRadius: '3px', height: 20, fontFamily: 'Jost' }} />
                      <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost' }}>
                        JSON body — batch with inline base64 selfies
                      </Typography>
                    </Box>
                    <Typography sx={{ fontSize: '0.8125rem', color: '#64748b', mb: 1.5, lineHeight: 1.6 }}>
                      For programmatic batch processing, encode each selfie as base64 and embed it directly in the customer object under the <Box component="span" sx={{ ...mono }}>selfie</Box> key.
                      The <Box component="span" sx={{ ...mono }}>data:image/jpeg;base64,</Box> prefix is optional and will be stripped automatically.
                    </Typography>
                    <CodeBlock id="batchBase64" code={`{\n  "customers": [\n    {\n      "customerId": "ACC001",\n      "firstName": "Ada",\n      "lastName": "Obi",\n      "selfie": "data:image/jpeg;base64,/9j/4AAQSkZJRg..."\n    },\n    {\n      "customerId": "ACC002",\n      "firstName": "Eze",\n      "selfie": "data:image/jpeg;base64,/9j/4AAQSkZJRg..."\n    }\n  ]\n}`} label="Request body" lang="json" />
                  </Box>
                )}
              </Box>

              {/* Response */}
              <Box sx={{ mb: 3.5 }}>
                <Typography sx={{ ...sectionLabel, mb: 1.5 }}>Response — Server-Sent Events (SSE)</Typography>
                <Box sx={{ p: 2, mb: 2, bgcolor: `${colorPalette.primary}08`, border: `1px solid ${colorPalette.primary}25` }}>
                  <Typography sx={{ fontSize: '0.8125rem', color: '#64748b', lineHeight: 1.65 }}>
                    The response streams as <Box component="span" sx={{ fontWeight: 600, color: 'var(--heading-color)' }}>Server-Sent Events</Box>. Keep the connection open to receive one <Box component="span" sx={{ ...mono }}>customer</Box> event per record in real time.
                    Each event carries the full screening result — outcome, risk score, step-by-step details, and any concerns.
                  </Typography>
                </Box>

                <Box sx={{ mb: 2 }}>
                  {[
                    { event: 'started',  desc: 'Sent once immediately. Confirms the run has begun.', color: colorPalette.primary },
                    { event: 'customer', desc: 'Sent after each customer is screened. Contains the full result (see below).', color: '#059669' },
                    { event: 'done',     desc: 'Sent after all customers are processed. Contains the run ID for audit queries.', color: '#64748b' },
                  ].map(e => (
                    <Box key={e.event} sx={{ display: 'flex', gap: 1.5, mb: 1 }}>
                      <Chip label={e.event} size="small" sx={{ ...mono, bgcolor: `${e.color}12`, color: e.color, fontWeight: 700, fontSize: '0.6875rem', borderRadius: '3px', height: 22, flexShrink: 0, '& .MuiChip-label': { px: 1 } }} />
                      <Typography sx={{ fontSize: '0.8125rem', color: '#64748b', lineHeight: 1.55, pt: '2px' }}>{e.desc}</Typography>
                    </Box>
                  ))}
                </Box>

                <CodeBlock id="sseExample" code={sseExample} label="Example stream" lang="sse" />

                {/* customer event fields */}
                <Typography sx={{ ...sectionLabel, mb: 1 }}>customer event — field reference</Typography>
                <Box sx={{ border: '1px solid var(--border-col)' }}>
                  {[
                    { field: 'outcome',      type: 'string',  desc: '"clear" — no flags detected  |  "match" — one or more blocks flagged  |  "error" — processing failed' },
                    { field: 'customerId',   type: 'string',  desc: 'The customer ID you supplied in the request.' },
                    { field: 'name',         type: 'string',  desc: 'Resolved full name from firstName / lastName / middleName.' },
                    { field: 'cddRiskScore', type: 'integer', desc: '0–100. Higher = more risk. Computed as a weighted average across all active blocks, inverted. Stored on the customer profile.' },
                    { field: 'caseFlagged',  type: 'boolean', desc: 'true when outcome is "match" — an investigation case was automatically opened.' },
                    { field: 'concerns',     type: 'array',   desc: 'List of specific issues found — name mismatches, not-found gaps, suspicious signals.' },
                    { field: 'stepResults',  type: 'array',   desc: 'One entry per block: type, status (pass/match/error/not_found), score (0–100), detail message, and duration (ms).' },
                    { field: 'error',        type: 'string?', desc: 'Only present when outcome is "error". Human-readable failure reason.' },
                  ].map((f, i, arr) => (
                    <Box key={f.field} sx={{ display: 'flex', gap: 2, px: 2, py: 1.25, borderBottom: i < arr.length - 1 ? '1px solid var(--border-col)' : 'none', alignItems: 'flex-start' }}>
                      <Box sx={{ flexShrink: 0, width: 130 }}>
                        <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, ...mono, color: 'var(--heading-color)' }}>{f.field}</Typography>
                        <Typography sx={{ fontSize: '0.625rem', color: '#94a3b8', ...mono }}>{f.type}</Typography>
                      </Box>
                      <Typography sx={{ fontSize: '0.8125rem', color: '#64748b', lineHeight: 1.55 }}>{f.desc}</Typography>
                    </Box>
                  ))}
                </Box>
              </Box>

              {/* Error responses */}
              <Box sx={{ mb: 3.5 }}>
                <Typography sx={{ ...sectionLabel, mb: 1 }}>Error responses</Typography>
                <Box sx={{ border: '1px solid var(--border-col)' }}>
                  <ErrorRow code="400" msg="customers[i].customerId is required"
                    reason="A record is missing its customer ID. Every entry must have customerId." />
                  <ErrorRow code="400" msg="customers[0] and customers[3]: duplicate customerId 'ACC001'"
                    reason="The same customer ID appears more than once in a single batch. Each request must have unique IDs." />
                  <ErrorRow code="400" msg="customers[2]: customerId 'ACC001' already registered with a different BVN"
                    reason="This customer exists in your institution but the BVN you sent does not match what is on record. Resubmit with the correct BVN, or contact support to update credentials." />
                  <ErrorRow code="400" msg="customers[2]: customerId 'ACC001' already registered with a different NIN"
                    reason="Same as above but for NIN." />
                  <ErrorRow code="400" msg="Only active workflows accept import batches"
                    reason="The workflow is in draft or pending-approval status. It must be active before it can accept imports." />
                  <ErrorRow code="404" msg="Workflow not found"
                    reason="The workflow ID in the URL does not belong to your institution or does not exist." />
                </Box>
              </Box>

              {/* Tips */}
              <Box sx={{ p: 2.5, bgcolor: 'var(--section-bg)', border: '1px solid var(--border-col)' }}>
                <Typography sx={{ ...sectionLabel, mb: 1 }}>Tips</Typography>
                <Stack gap={0.75}>
                  {[
                    'Pass --no-buffer with curl to see SSE events as they arrive instead of waiting for the full response.',
                    'Unused payload fields are silently ignored — safe to include extra data.',
                    'Each run is stored as audit evidence accessible from the Run History drawer.',
                    'Batches are processed sequentially — one customer at a time — so SSE events arrive in order.',
                  ].map((tip, i) => (
                    <Box key={i} sx={{ display: 'flex', gap: 1 }}>
                      <Typography sx={{ fontSize: '0.75rem', color: colorPalette.primary, fontWeight: 800, flexShrink: 0 }}>→</Typography>
                      <Typography sx={{ fontSize: '0.8125rem', color: '#64748b', lineHeight: 1.55 }}>{tip}</Typography>
                    </Box>
                  ))}
                </Stack>
              </Box>
            </Box>
          </>
        )
      })()}

      {/* ══════════════════════════════════ BUILDER VIEW ══════════════════════════════════ */}
      {view === 'editor' && editing && (() => {
        const st        = STATUS_STYLE[editing.status] ?? STATUS_STYLE.draft
        const isDraft   = editing.status === 'draft'
        const isPending = editing.status === 'pending_approval'
        const isCreator = user?.userId === editing.createdBy

        return (
          <>
            {/* Builder header */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 1.5 }}>
              {/* Breadcrumb */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0, flexWrap: 'wrap' }}>
                <Button startIcon={<ChevronLeftRoundedIcon />} onClick={handleBack}
                  sx={{ textTransform: 'none', fontFamily: 'Jost', fontWeight: 600, color: '#64748b', px: 1, minWidth: 0, '&:hover': { color: colorPalette.primary } }}>
                  Workflows
                </Button>
                <ChevronRightRoundedIcon sx={{ fontSize: '1rem', color: '#cbd5e1' }} />
                <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost', mx: 0.5, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {draftName || editing.name}
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8', mr: 0.5 }}>v{editing.version}</Typography>
                <Chip label={st.label} size="small" sx={{ bgcolor: st.bg, color: st.color, fontWeight: 700, fontSize: '0.625rem', borderRadius: 0, height: 20 }} />
                <Typography sx={{ ...mono, fontSize: '0.6875rem', color: '#94a3b8', ml: 0.5 }}>#{editing.id}</Typography>
              </Box>

              {/* Header actions */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
                {/* Import API button — always visible */}
                <Button startIcon={<ApiRoundedIcon />} onClick={() => { setView('api'); loadKeyInfo() }}
                  sx={{ textTransform: 'none', fontWeight: 600, fontFamily: 'Jost', color: colorPalette.primary, borderRadius: 0, border: `1px solid ${colorPalette.primary}30`, px: 2, fontSize: '0.8125rem' }}>
                  Import API
                </Button>

                {canModify && (isDraft || isPending) && (
                  <Tooltip title={deleting ? 'Deleting…' : 'Delete workflow'}>
                    <IconButton size="small" onClick={() => requestDelete(editing)} disabled={deleting}
                      sx={{ border: '1px solid #fecaca', color: '#dc2626', '&:hover': { bgcolor: '#fef2f2' }, borderRadius: 0 }}>
                      <DeleteOutlineRoundedIcon sx={{ fontSize: '1.125rem' }} />
                    </IconButton>
                  </Tooltip>
                )}
                {canModify && isDraft && (
                  <>
                    <Button disabled={saving || blocks.length === 0} onClick={saveDraft}
                      sx={{ textTransform: 'none', fontWeight: 700, fontFamily: 'Jost', borderRadius: 0, px: 2,
                        border: '1px solid var(--border-col)', color: 'var(--heading-color)',
                        '&:hover': { borderColor: colorPalette.primary, color: colorPalette.primary } }}>
                      {saving ? 'Saving…' : 'Save draft'}
                    </Button>
                    <Button variant="contained" onClick={() => transition('submit', editing)}
                      sx={{ bgcolor: '#d97706', color: '#fff', textTransform: 'none', fontWeight: 700, fontFamily: 'Jost', borderRadius: 0, boxShadow: 'none', px: 2.5, '&:hover': { bgcolor: '#b45309' } }}>
                      Submit for approval
                    </Button>
                  </>
                )}
                {canModify && isPending && (
                  isCreator
                    ? <Chip label="Awaiting approval by another officer" size="small" sx={{ bgcolor: '#fffbeb', color: '#d97706', fontWeight: 600, fontSize: '0.75rem', borderRadius: 0, height: 28, px: 0.5 }} />
                    : <Button variant="contained" onClick={() => transition('approve', editing)}
                        sx={{ bgcolor: '#15803d', color: '#fff', textTransform: 'none', fontWeight: 700, fontFamily: 'Jost', borderRadius: 0, boxShadow: 'none', px: 2.5, '&:hover': { bgcolor: '#166534' } }}>
                        Approve
                      </Button>
                )}
                {canModify && editing.status === 'active' && (
                  <>
                    <Button onClick={() => transition('newVersion', editing)}
                      sx={{ textTransform: 'none', fontWeight: 600, fontFamily: 'Jost', borderRadius: 0, border: '1px solid var(--border-col)', px: 2 }}>
                      New version
                    </Button>
                    <Button onClick={() => transition('retire', editing)}
                      sx={{ textTransform: 'none', fontWeight: 600, fontFamily: 'Jost', color: '#991b1b', borderRadius: 0, border: '1px solid #fecaca', px: 2 }}>
                      Retire
                    </Button>
                  </>
                )}
              </Box>
            </Box>

            {/* 2-col builder grid (palette + sequence) */}
            <Box sx={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 2.5, alignItems: 'start' }}>

              {/* ── Palette ── */}
              <Box sx={{ bgcolor: 'var(--card-bg)', border: '1px solid var(--border-col)', p: 2, position: 'sticky', top: 80 }}>
                <Typography sx={{ ...sectionLabel, mb: 1.5 }}>Add blocks</Typography>
                <Stack gap={0.75}>
                  {Object.entries(BLOCK_META).map(([type, meta]) => {
                    const inUse    = usedTypes.has(type)
                    const bc       = BLOCK_COLORS[type]
                    const canClick = isDraft && canModify && !inUse && !meta.comingSoon
                    const tooltipTitle = meta.comingSoon
                      ? 'Coming soon — not yet available'
                      : inUse ? 'Already in the sequence' : meta.description
                    return (
                      <Tooltip key={type} title={tooltipTitle} placement="right">
                        <Box
                          onClick={() => canClick && setBlocks(
                            type === 'identity_verify'
                              ? [{ type, weight: DEFAULT_WEIGHTS[type] ?? 10 }, ...blocks]
                              : [...blocks, { type, weight: DEFAULT_WEIGHTS[type] ?? 10 }]
                          )}
                          sx={{
                            display: 'flex', alignItems: 'center', gap: 1.25, px: 1.25, py: 1,
                            border: '1px solid var(--border-col)',
                            cursor: canClick ? 'pointer' : 'default',
                            opacity: inUse || meta.comingSoon ? 0.55 : 1,
                            transition: 'border-color 0.15s, background 0.15s',
                            '&:hover': canClick ? { borderColor: bc?.color, bgcolor: `${bc?.color}08` } : {},
                          }}
                        >
                          <Box sx={{
                            width: 26, height: 26, flexShrink: 0,
                            bgcolor: `${bc?.color ?? '#94a3b8'}15`,
                            color: bc?.color ?? '#94a3b8',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            {bc?.icon}
                          </Box>
                          <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Jost', color: inUse || meta.comingSoon ? '#94a3b8' : 'var(--heading-color)', flex: 1, lineHeight: 1.3 }}>
                            {meta.label}
                          </Typography>
                          {meta.comingSoon
                            ? <Chip label="Soon" size="small" sx={{ height: 16, fontSize: '0.5625rem', fontWeight: 700, fontFamily: 'Jost', bgcolor: '#f1f5f9', color: '#94a3b8', borderRadius: '4px', '& .MuiChip-label': { px: 0.75 } }} />
                            : inUse
                              ? <CheckRoundedIcon sx={{ fontSize: '0.875rem', color: '#10b981', flexShrink: 0 }} />
                              : (canModify && isDraft && <AddRoundedIcon sx={{ fontSize: '0.875rem', color: '#cbd5e1', flexShrink: 0 }} />)
                          }
                        </Box>
                      </Tooltip>
                    )
                  })}
                </Stack>
                <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', mt: 1.5, lineHeight: 1.5 }}>
                  Any block match automatically opens an investigation case.
                </Typography>
              </Box>

              {/* ── Sequence ── */}
              <Box>
                {isDraft && canModify && (
                  <Box sx={{ mb: 2.5 }}>
                    <Typography sx={{ ...sectionLabel, mb: 0.75 }}>Workflow name</Typography>
                    <TextField
                      fullWidth size="small" value={draftName}
                      onChange={e => setDraftName(e.target.value)}
                      placeholder={editing.name}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 0, fontSize: '0.9375rem', fontFamily: 'Jost', fontWeight: 700 } }}
                    />
                  </Box>
                )}

                <Typography sx={{ ...sectionLabel, mb: 1.25 }}>Execution sequence</Typography>

                {blocks.length === 0 ? (
                  <Box sx={{ p: 5, textAlign: 'center', border: '2px dashed var(--border-col)', bgcolor: 'var(--section-bg)' }}>
                    <AccountTreeRoundedIcon sx={{ fontSize: 36, color: '#e2e8f0', mb: 1.5 }} />
                    <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#94a3b8', fontFamily: 'Jost' }}>
                      No blocks yet
                    </Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: '#cbd5e1', mt: 0.5 }}>
                      Pick blocks from the palette to build your pipeline.
                    </Typography>
                  </Box>
                ) : (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    modifiers={[restrictToVerticalAxis, restrictToParentElement]}
                    onDragStart={({ active }: DragStartEvent) => setActiveDragId(String(active.id))}
                    onDragOver={({ active, over }: DragOverEvent) => {
                      if (!over || active.id === over.id || !isDraft || !canModify) return
                      // Terminal blocks cannot be moved, and nothing can be dragged over them
                      if (TERMINAL_TYPES.has(String(active.id))) return
                      if (TERMINAL_TYPES.has(String(over.id)))   return
                      setBlocks(prev => {
                        const from = prev.findIndex(b => b.type === active.id)
                        const to   = prev.findIndex(b => b.type === over.id)
                        if (from < 0 || to < 0) return prev
                        if (to === 0 && prev[0]?.type === 'identity_verify') return prev
                        return arrayMove(prev, from, to)
                      })
                    }}
                    onDragEnd={(_e: DragEndEvent) => setActiveDragId(null)}
                  >
                    {(() => {
                      const draggable = blocks.filter(b => !TERMINAL_TYPES.has(b.type))
                      const terminal  = blocks.filter(b =>  TERMINAL_TYPES.has(b.type))
                      const totalWeight = blocks.reduce((s, b) => s + (b.weight ?? DEFAULT_WEIGHTS[b.type] ?? 10), 0)
                      const allBlocks   = [...draggable, ...terminal]
                      return (
                        <>
                          <SortableContext items={draggable.map(b => b.type)} strategy={verticalListSortingStrategy}>
                            <Stack gap={0}>
                              {draggable.map((b) => {
                                const globalIdx = allBlocks.findIndex(x => x.type === b.type)
                                return (
                                  <SortableBlockItem
                                    key={b.type}
                                    block={b}
                                    index={globalIdx}
                                    isLast={false}
                                    isDraft={isDraft}
                                    canModify={canModify}
                                    totalWeight={totalWeight}
                                    onDelete={() => setBlocks(blocks.filter(x => x.type !== b.type))}
                                    onWeightChange={w => setBlocks(prev => prev.map(bl => bl.type === b.type ? { ...bl, weight: w } : bl))}
                                  />
                                )
                              })}
                            </Stack>
                          </SortableContext>

                          {/* Terminal blocks — always last, never draggable */}
                          {terminal.length > 0 && (
                            <>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 0.75, bgcolor: '#fff7ed', borderTop: '1px dashed #fed7aa', borderBottom: '1px dashed #fed7aa' }}>
                                <LockOutlinedIcon sx={{ fontSize: '0.6875rem', color: '#c2410c' }} />
                                <Typography sx={{ fontSize: '0.6rem', fontWeight: 800, color: '#c2410c', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                  Terminal steps — always run last
                                </Typography>
                              </Box>
                              <Stack gap={0}>
                                {terminal.map((b, ti) => {
                                  const globalIdx = allBlocks.findIndex(x => x.type === b.type)
                                  return (
                                    <SortableBlockItem
                                      key={b.type}
                                      block={b}
                                      index={globalIdx}
                                      isLast={ti === terminal.length - 1}
                                      isDraft={isDraft}
                                      canModify={canModify}
                                      totalWeight={totalWeight}
                                      onDelete={() => {}}
                                      onWeightChange={w => setBlocks(prev => prev.map(bl => bl.type === b.type ? { ...bl, weight: w } : bl))}
                                    />
                                  )
                                })}
                              </Stack>
                            </>
                          )}
                        </>
                      )
                    })()}

                    <DragOverlay>
                      {activeDragId && (() => {
                        const b  = blocks.find(b => b.type === activeDragId)
                        if (!b) return null
                        const bc   = BLOCK_COLORS[b.type]
                        const meta = BLOCK_META[b.type]
                        return (
                          <Box sx={{
                            display: 'flex', alignItems: 'center', gap: 1.5,
                            px: 2, py: 1.75,
                            bgcolor: 'var(--card-bg)',
                            border: '1px solid var(--border-col)',
                            borderLeft: `3px solid ${bc?.color ?? '#e2e8f0'}`,
                            boxShadow: '0 12px 32px rgba(15,23,42,0.18)',
                            cursor: 'grabbing',
                          }}>
                            <DragIndicatorRoundedIcon sx={{ fontSize: '1.125rem', color: '#94a3b8' }} />
                            <Box sx={{ width: 30, height: 30, flexShrink: 0, bgcolor: `${bc?.color ?? '#94a3b8'}12`, color: bc?.color ?? '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {bc?.icon}
                            </Box>
                            <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost' }}>
                              {meta?.label ?? b.type}
                            </Typography>
                          </Box>
                        )
                      })()}
                    </DragOverlay>
                  </DndContext>
                )}

                {/* ── Case investigation threshold ── */}
                <Box sx={{ mt: 3, pt: 2.5, borderTop: '1px solid var(--border-col)' }}>
                  <Typography sx={{ ...sectionLabel, mb: 0.5 }}>Case investigation threshold</Typography>
                  <Typography sx={{ fontSize: '0.8125rem', color: '#64748b', mb: 1.5, lineHeight: 1.55 }}>
                    After screening, every customer gets a risk score between 0 and 100. When that score reaches or
                    exceeds this number, the system automatically opens a case for your compliance team to review.
                    Customers who hit a PEP/sanctions match, identity failure, or facial mismatch always get a case
                    regardless of their score.
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <TextField
                      type="number"
                      size="small"
                      disabled={!isDraft || !canModify}
                      value={caseRiskThreshold}
                      onChange={e => {
                        const v = Math.max(30, Math.min(95, Number(e.target.value)))
                        setCaseRiskThreshold(v)
                      }}
                      inputProps={{ min: 30, max: 95, step: 5 }}
                      sx={{ width: 100, '& .MuiOutlinedInput-root': { borderRadius: 0, fontFamily: 'Jost', fontWeight: 700 } }}
                    />
                    <Box>
                      <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Jost',
                        color: caseRiskThreshold >= 75 ? '#16a34a' : caseRiskThreshold >= 55 ? '#d97706' : '#dc2626' }}>
                        {caseRiskThreshold >= 75
                          ? `Only high-risk customers (${caseRiskThreshold}+) get a case — low false-positive rate`
                          : caseRiskThreshold >= 55
                          ? `Medium and above (${caseRiskThreshold}+) get a case — moderate volume`
                          : `Aggressive — most screened customers will trigger a case`}
                      </Typography>
                      <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8', mt: 0.25 }}>
                        Valid range: 30 – 95. Default is 75 (high-risk only).
                      </Typography>
                    </Box>
                  </Box>
                </Box>

              </Box>
            </Box>
          </>
        )
      })()}

      {/* ══════════════════════════════════ LIST VIEW ══════════════════════════════════ */}
      {view === 'list' && (
        <>
          {/* Enrichment alert */}
          {enrichmentCount > 0 && (
            <Box sx={{
              display: 'flex', alignItems: 'flex-start', gap: 1.5,
              p: 2, mb: 3, bgcolor: '#fffbeb',
              border: '1px solid #fde68a', borderLeft: '4px solid #d97706',
            }}>
              <Box sx={{ mt: '1px', color: '#d97706', fontWeight: 800, fontSize: '1rem', lineHeight: 1 }}>!</Box>
              <Box>
                <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#92400e', fontFamily: 'Jost' }}>
                  {enrichmentCount} customer{enrichmentCount !== 1 ? 's' : ''} need re-onboarding
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: '#b45309', mt: 0.25, lineHeight: 1.5 }}>
                  Their CDD workflow was retired. They are excluded from all scheduled re-screenings until
                  re-onboarded through an active workflow that matches their available data.
                </Typography>
              </Box>
            </Box>
          )}

          {/* Page header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3.5 }}>
            <Box>
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: colorPalette.primary, letterSpacing: '0.14em', textTransform: 'uppercase', mb: 0.75 }}>
                Automate
              </Typography>
              <Typography sx={{ fontSize: '1.625rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost', letterSpacing: '-0.015em', mb: 0.5 }}>
                CDD Workflows
              </Typography>
              <Typography sx={{ fontSize: '0.9375rem', color: '#64748b' }}>
                Design customer due-diligence screening pipelines. Every run is audit evidence for CBN continuous-screening requirements.
              </Typography>
            </Box>
            {canModify && (
              <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setCreateOpen(true)}
                sx={{ bgcolor: colorPalette.primary, color: '#ffffff', textTransform: 'none', fontWeight: 700, fontFamily: 'Jost', borderRadius: 0, boxShadow: 'none', px: 3, flexShrink: 0, '&:hover': { bgcolor: '#1539a8' } }}>
                Create workflow
              </Button>
            )}
          </Box>

          {/* Skeleton loaders */}
          {loading && (
            <Stack gap={1.5}>
              {[...Array(3)].map((_, i) => (
                <Box key={i} sx={{ height: 76, bgcolor: 'var(--section-bg)', animation: 'pulse 1.5s ease-in-out infinite', '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } } }} />
              ))}
            </Stack>
          )}

          {/* Empty state */}
          {!loading && workflows.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 10, px: 2 }}>
              <AccountTreeRoundedIcon sx={{ fontSize: 52, color: '#e2e8f0', mb: 2 }} />
              <Typography sx={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost' }}>
                No workflows yet
              </Typography>
              <Typography sx={{ fontSize: '0.875rem', color: '#64748b', mt: 0.5 }}>
                Create your first CDD workflow to start automating customer screenings.
              </Typography>
              {canModify && (
                <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setCreateOpen(true)}
                  sx={{ mt: 3, bgcolor: colorPalette.primary, color: '#fff', textTransform: 'none', fontWeight: 700, fontFamily: 'Jost', borderRadius: 0, boxShadow: 'none', px: 3, '&:hover': { bgcolor: '#1539a8' } }}>
                  Create workflow
                </Button>
              )}
            </Box>
          )}

          {/* Status-grouped workflow list */}
          {!loading && workflows.length > 0 && (
            <Stack gap={2}>
              {STATUS_GROUPS.map(({ status, label, desc }) => {
                const group    = workflows.filter(w => w.status === status)
                if (group.length === 0) return null
                const st       = STATUS_STYLE[status]
                const expanded = expandedGroups[status] !== false

                return (
                  <Box key={status}>
                    <Box
                      onClick={() => setExpandedGroups(g => ({ ...g, [status]: !g[status] }))}
                      sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 1, py: 1, mb: 0.75, cursor: 'pointer', userSelect: 'none', '&:hover': { bgcolor: 'var(--section-bg)' } }}
                    >
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: st.color, flexShrink: 0 }} />
                      <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: st.color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        {label}
                      </Typography>
                      <Chip label={group.length} size="small" sx={{ bgcolor: st.bg, color: st.color, fontWeight: 700, fontSize: '0.6875rem', borderRadius: 0, height: 18, minWidth: 22 }} />
                      <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8' }}>{desc}</Typography>
                      <Box sx={{ ml: 'auto', color: '#cbd5e1', display: 'flex' }}>
                        {expanded ? <ExpandLessRoundedIcon sx={{ fontSize: '1rem' }} /> : <ExpandMoreRoundedIcon sx={{ fontSize: '1rem' }} />}
                      </Box>
                    </Box>

                    <Collapse in={expanded}>
                      <Stack gap={1}>
                        {group.map(wf => {
                          const isCreator = user?.userId === wf.createdBy
                          const wfSt      = STATUS_STYLE[wf.status] ?? STATUS_STYLE.draft
                          return (
                            <Box key={wf.id}
                              onClick={() => openEditor(wf)}
                              sx={{
                                bgcolor: 'var(--card-bg)',
                                border: '1px solid var(--border-col)',
                                borderLeft: `3px solid ${wfSt.color}`,
                                display: 'flex', alignItems: 'center', gap: 2,
                                px: 2.5, py: 1.75, cursor: 'pointer',
                                transition: 'box-shadow 0.15s',
                                '&:hover': { boxShadow: `inset 0 0 0 1px ${colorPalette.primary}40` },
                              }}
                            >
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75, flexWrap: 'wrap' }}>
                                  <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost' }}>
                                    {wf.name}
                                  </Typography>
                                  <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', ...mono }}>#{wf.id}</Typography>
                                  <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8' }}>v{wf.version}</Typography>
                                </Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flexWrap: 'wrap' }}>
                                  {wf.blocks.map((b, bi) => {
                                    const bc = BLOCK_COLORS[b.type]
                                    const bm = BLOCK_META[b.type]
                                    return (
                                      <Box key={b.type} sx={{ display: 'flex', alignItems: 'center' }}>
                                        {bi > 0 && <ChevronRightRoundedIcon sx={{ fontSize: '0.75rem', color: '#cbd5e1', mx: 0.25 }} />}
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 0.75, py: 0.25, bgcolor: `${bc?.color ?? '#94a3b8'}10` }}>
                                          <Box sx={{ color: bc?.color ?? '#94a3b8', display: 'flex', '& .MuiSvgIcon-root': { fontSize: '0.6875rem' } }}>
                                            {bc?.icon}
                                          </Box>
                                          <Typography sx={{ fontSize: '0.625rem', fontWeight: 600, color: bc?.color ?? '#94a3b8', fontFamily: 'Jost' }}>
                                            {bm?.label ?? b.type}
                                          </Typography>
                                        </Box>
                                      </Box>
                                    )
                                  })}
                                </Box>
                              </Box>

                              <Box onClick={e => e.stopPropagation()} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
                                <Tooltip title="Run history">
                                  <IconButton size="small" onClick={() => openRuns(wf)}>
                                    <HistoryRoundedIcon sx={{ fontSize: '1rem' }} />
                                  </IconButton>
                                </Tooltip>

                                {canModify && (wf.status === 'draft' || wf.status === 'pending_approval') && (
                                  <Tooltip title="Delete workflow">
                                    <IconButton size="small" onClick={() => requestDelete(wf)}>
                                      <DeleteOutlineRoundedIcon sx={{ fontSize: '1rem', color: '#dc2626' }} />
                                    </IconButton>
                                  </Tooltip>
                                )}

                                {canModify && wf.status === 'draft' && (
                                  <Button size="small" onClick={() => transition('submit', wf)}
                                    sx={{ textTransform: 'none', fontWeight: 700, fontFamily: 'Jost', color: '#d97706', fontSize: '0.75rem', px: 1.5, py: 0.5, border: '1px solid #fde68a', borderRadius: 0 }}>
                                    Submit
                                  </Button>
                                )}

                                {canModify && wf.status === 'pending_approval' && (
                                  isCreator
                                    ? <Chip label="Awaiting approval" size="small" sx={{ bgcolor: '#fffbeb', color: '#d97706', fontWeight: 600, fontSize: '0.6875rem', borderRadius: 0, height: 24 }} />
                                    : <Button size="small" onClick={() => transition('approve', wf)}
                                        sx={{ textTransform: 'none', fontWeight: 700, fontFamily: 'Jost', color: '#15803d', fontSize: '0.75rem', px: 1.5, py: 0.5, border: '1px solid #bbf7d0', borderRadius: 0 }}>
                                        Approve
                                      </Button>
                                )}

                                {wf.status === 'active' && (
                                  <Tooltip title="View Import API docs">
                                    <IconButton size="small" onClick={() => { openEditor(wf); setTimeout(() => setView('api'), 0) }}>
                                      <ApiRoundedIcon sx={{ fontSize: '1rem', color: colorPalette.primary }} />
                                    </IconButton>
                                  </Tooltip>
                                )}
                              </Box>
                            </Box>
                          )
                        })}
                      </Stack>
                    </Collapse>
                  </Box>
                )
              })}
            </Stack>
          )}
        </>
      )}

      {/* ── Create workflow modal ── */}
      <Dialog open={createOpen} onClose={() => !creating && setCreateOpen(false)} maxWidth="xs" fullWidth
        slotProps={{ paper: { sx: { borderRadius: 0 } } }}>
        <DialogTitle sx={{ fontFamily: 'Jost', fontWeight: 800, fontSize: '1.125rem', color: 'var(--heading-color)' }}>
          Create CDD Workflow
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '0.8125rem', color: '#64748b', mb: 2 }}>
            New workflows start as drafts with the default sequence — identity verification, PEP &amp; sanctions screening, and phone lookup. Add or reorder blocks to match your risk policy.
          </Typography>
          <TextField
            autoFocus fullWidth size="small" placeholder="e.g. Quarterly High-Risk Review"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && newName.trim() && !creating) handleCreate() }}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 0, fontSize: '0.875rem' } }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2.5, pt: 1 }}>
          <Button onClick={() => setCreateOpen(false)} disabled={creating}
            sx={{ textTransform: 'none', fontFamily: 'Jost', fontWeight: 600, color: 'var(--on-surface-variant)' }}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleCreate} disabled={creating || !newName.trim()}
            sx={{ bgcolor: colorPalette.primary, color: '#ffffff', textTransform: 'none', fontWeight: 700, fontFamily: 'Jost', borderRadius: 0, boxShadow: 'none', px: 3, '&:hover': { bgcolor: '#1539a8' } }}>
            {creating ? 'Creating…' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Unsaved changes guard ── */}
      <Dialog open={leavingConfirm} onClose={() => setLeavingConfirm(false)} maxWidth="xs" fullWidth
        slotProps={{ paper: { sx: { borderRadius: 0 } } }}>
        <DialogTitle sx={{ fontFamily: 'Jost', fontWeight: 800, fontSize: '1.125rem', color: 'var(--heading-color)' }}>
          Leave without saving?
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '0.875rem', color: '#64748b' }}>
            You have unsaved changes to <Box component="span" sx={{ fontWeight: 700, color: 'var(--heading-color)' }}>{draftName || editing?.name}</Box>. Leaving now will discard them.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, pt: 1 }}>
          <Button onClick={() => setLeavingConfirm(false)}
            sx={{ textTransform: 'none', fontFamily: 'Jost', fontWeight: 600, color: 'var(--on-surface-variant)' }}>
            Stay &amp; keep editing
          </Button>
          <Button variant="contained" onClick={() => { setLeavingConfirm(false); setEditing(null); setView('list') }}
            sx={{ bgcolor: '#dc2626', color: '#ffffff', textTransform: 'none', fontWeight: 700, fontFamily: 'Jost', borderRadius: 0, boxShadow: 'none', px: 3, '&:hover': { bgcolor: '#b91c1c' } }}>
            Discard changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── API key modal (view-once) ── */}
      <Dialog open={keyModalOpen} onClose={() => { if (!keyGenerating) { setKeyModalOpen(false); setNewKey(null) } }}
        maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 0 } }}>
        <DialogTitle sx={{ fontFamily: 'Jost', fontWeight: 800, fontSize: '1.125rem', color: 'var(--heading-color)', pb: 0.5 }}>
          {newKey ? 'Your API key — copy it now' : keyInfo ? 'Regenerate API key' : 'Generate API key'}
        </DialogTitle>
        <DialogContent>
          {newKey ? (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, p: 1.25, bgcolor: '#fffbeb', border: '1px solid #fbbf24' }}>
                <VisibilityOffRoundedIcon sx={{ fontSize: '1rem', color: '#d97706', flexShrink: 0 }} />
                <Typography sx={{ fontSize: '0.8125rem', color: '#92400e', lineHeight: 1.5 }}>
                  This key will <strong>not be shown again</strong>. Copy it now and store it securely.
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.5, bgcolor: '#0d1117', border: '1px solid #21262d', mb: 1 }}>
                <Typography sx={{ fontSize: '0.8125rem', ...mono, color: '#e2e8f0', flex: 1, wordBreak: 'break-all' }}>
                  {newKey}
                </Typography>
                <Tooltip title={copied === 'newkey' ? 'Copied!' : 'Copy'}>
                  <IconButton size="small" onClick={() => copyText('newkey', newKey)}
                    sx={{ color: copied === 'newkey' ? '#10b981' : '#94a3b8', flexShrink: 0 }}>
                    <ContentCopyRoundedIcon sx={{ fontSize: '0.875rem' }} />
                  </IconButton>
                </Tooltip>
              </Box>
              <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                Use as: <Box component="span" sx={{ ...mono }}>Authorization: Bearer {newKey}</Box>
              </Typography>
            </Box>
          ) : (
            <Box>
              {keyInfo ? (
                <>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, p: 1.25, bgcolor: '#fef2f2', border: '1px solid #fca5a5' }}>
                    <WarningAmberRoundedIcon sx={{ fontSize: '1rem', color: '#dc2626', flexShrink: 0 }} />
                    <Typography sx={{ fontSize: '0.8125rem', color: '#991b1b', lineHeight: 1.5 }}>
                      Regenerating immediately invalidates the current key. Update your servers before regenerating.
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: '0.8125rem', color: '#64748b', mb: 0.5 }}>Current key</Typography>
                  <Box sx={{ p: 1.25, bgcolor: 'var(--section-bg)', border: '1px solid var(--border-col)', ...mono, fontSize: '0.8125rem', color: 'var(--heading-color)' }}>
                    {keyInfo.prefix}••••••••••••••••••
                  </Box>
                </>
              ) : (
                <Typography sx={{ fontSize: '0.8125rem', color: '#64748b', lineHeight: 1.6 }}>
                  Generate an API key to authenticate your server when importing customers into this workflow.
                  The key is shown <strong>once</strong> — store it somewhere safe immediately.
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2.5, pt: 1, gap: 1 }}>
          {newKey ? (
            <Button onClick={() => { setKeyModalOpen(false); setNewKey(null) }}
              variant="contained" disableElevation
              sx={{ borderRadius: 0, textTransform: 'none', fontFamily: 'Jost', fontWeight: 600, bgcolor: colorPalette.primary }}>
              Done — I've copied the key
            </Button>
          ) : (
            <>
              <Button onClick={() => { setKeyModalOpen(false); setNewKey(null) }}
                sx={{ borderRadius: 0, textTransform: 'none', fontFamily: 'Jost', fontWeight: 600, color: '#64748b' }}>
                Cancel
              </Button>
              <Button onClick={() => { setKeyModalOpen(false); setKeyTotpOpen(true) }} variant="contained" disableElevation
                startIcon={<KeyRoundedIcon />}
                sx={{ borderRadius: 0, textTransform: 'none', fontFamily: 'Jost', fontWeight: 600, bgcolor: colorPalette.primary }}>
                {keyInfo ? 'Regenerate' : 'Generate key'}
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      {/* ── API key biometric gate ── */}
      <TOTPConfirmation
        open={keyTotpOpen}
        onClose={() => { setKeyTotpOpen(false); setKeyModalOpen(true) }}
        onConfirm={async () => {
          setKeyTotpOpen(false)
          await handleGenerateKey()
          setKeyModalOpen(true)
        }}
        operation={keyInfo ? 'update' : 'create'}
        title={keyInfo ? 'Regenerate API key' : 'Generate API key'}
        description={keyInfo
          ? 'Regenerating immediately invalidates the existing key. Verify your identity to continue.'
          : 'Verify your identity to generate an API key for this workflow.'}
        resourceType="API Key"
        resourceName="Workflow import API key"
        changes={keyInfo ? [{ field: 'API Key', from: 'Current key', to: 'New generated key (shown once)' }] : undefined}
      />

      {/* ── TOTP step-up ── */}
      <TOTPConfirmation
        open={!!pendingAction}
        onClose={() => setPendingAction(null)}
        onConfirm={executePending}
        operation={pendingAction?.op ?? 'update'}
        title={pendingAction?.title ?? ''}
        description={pendingAction?.description ?? ''}
        resourceType="Workflow"
        resourceName={pendingAction?.resourceName ?? ''}
      />

      {/* ── Run history drawer ── */}
      <Drawer anchor="right" open={!!runsFor} onClose={() => setRunsFor(null)}
        slotProps={{ paper: { sx: { width: 580, borderRadius: 0, p: 3, display: 'flex', flexDirection: 'column' } } }}>
        <Typography sx={{ fontSize: '1.125rem', fontWeight: 800, fontFamily: 'Jost', color: 'var(--heading-color)', mb: 0.25 }}>
          Run History
        </Typography>
        <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: colorPalette.primary, fontFamily: 'Jost', mb: 0.25 }}>
          {runsFor?.name}
        </Typography>
        <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mb: 2.5 }}>
          Every run is retained as screening evidence.
        </Typography>

        {runItems === null ? (
          <Stack gap={1} sx={{ flex: 1, overflowY: 'auto' }}>
            {runs.length === 0 && <Typography sx={{ fontSize: '0.8125rem', color: '#94a3b8' }}>No runs yet.</Typography>}
            {runs.map(r => (
              <Box key={r.id}
                onClick={async () => {
                  const res = await workflowApi.listRunItems(r.id)
                  setRunItems(res.items)
                  setExpandedItems(new Set())
                }}
                sx={{ px: 2, py: 1.5, border: '1px solid var(--border-col)', cursor: 'pointer', '&:hover': { bgcolor: 'var(--section-bg)' } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Chip label={r.trigger} size="small" sx={{ borderRadius: 0, fontSize: '0.625rem', height: 18, textTransform: 'capitalize' }} />
                  <Chip label={r.status} size="small" sx={{ borderRadius: 0, fontSize: '0.625rem', height: 18,
                    bgcolor: r.status === 'completed' ? '#f0fdf4' : '#fffbeb',
                    color:   r.status === 'completed' ? '#15803d' : '#d97706' }} />
                  <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', ml: 'auto' }}>
                    {new Date(r.startedAt).toLocaleString()}
                  </Typography>
                </Box>
                <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>
                  {r.totalCustomers} screened ·{' '}
                  <Box component="span" sx={{ color: '#15803d', fontWeight: 600 }}>{r.clearCount} clear</Box> ·{' '}
                  <Box component="span" sx={{ color: '#dc2626', fontWeight: 700 }}>{r.matchCount} flagged</Box> ·{' '}
                  {r.errorCount} errors
                </Typography>
              </Box>
            ))}
          </Stack>
        ) : (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <Button size="small" startIcon={<ChevronLeftRoundedIcon />} onClick={() => setRunItems(null)}
                sx={{ textTransform: 'none', fontFamily: 'Jost', fontWeight: 600, color: '#64748b' }}>
                Back to runs
              </Button>
              <Box sx={{ ml: 'auto' }}>
                <Tooltip title="Download results as JSON">
                  <IconButton size="small" onClick={() => runsFor && downloadRunItems(runsFor, runItems)}
                    sx={{ border: '1px solid var(--border-col)', borderRadius: 0 }}>
                    <DownloadRoundedIcon sx={{ fontSize: '1rem' }} />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>

            <Stack gap={1} sx={{ flex: 1, overflowY: 'auto' }}>
              {runItems.length === 0 && (
                <Typography sx={{ fontSize: '0.8125rem', color: '#94a3b8' }}>No items in this run.</Typography>
              )}
              {runItems.map((item, idx) => {
                const isMatch  = item.outcome === 'match'
                const isError  = item.outcome === 'error'
                const score    = (item as any).cddRiskScore as number | null
                const concerns = (item as any).concerns as any[] | null
                const expanded = expandedItems.has(idx)
                const accentColor = isMatch ? '#dc2626' : isError ? '#d97706' : '#10b981'

                return (
                  <Box key={item.id} sx={{
                    border: '1px solid var(--border-col)',
                    borderLeft: `3px solid ${accentColor}`,
                    bgcolor: isMatch ? '#fef2f2' : 'var(--card-bg)',
                  }}>
                    {/* Customer header — always visible */}
                    <Box
                      onClick={() => setExpandedItems(prev => {
                        const next = new Set(prev)
                        next.has(idx) ? next.delete(idx) : next.add(idx)
                        return next
                      })}
                      sx={{ px: 2, py: 1.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1.5 }}
                    >
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.375 }}>
                          <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, ...mono, color: 'var(--heading-color)' }}>
                            {item.customerId}
                          </Typography>
                          {(item as any).name && (
                            <Typography sx={{ fontSize: '0.75rem', color: '#64748b', fontFamily: 'Jost' }}>
                              {(item as any).name}
                            </Typography>
                          )}
                          <Chip label={item.outcome} size="small" sx={{ ml: 'auto', borderRadius: 0, fontSize: '0.625rem', height: 20, fontWeight: 700,
                            bgcolor: isMatch ? '#fee2e2' : isError ? '#fffbeb' : '#f0fdf4',
                            color:   isMatch ? '#991b1b' : isError ? '#d97706' : '#15803d' }} />
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          {score !== null && score !== undefined && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Box sx={{
                                width: 28, height: 28, border: `2px solid ${score >= 70 ? '#dc2626' : score >= 40 ? '#d97706' : '#10b981'}`,
                                borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}>
                                <Typography sx={{ fontSize: '0.5625rem', fontWeight: 800, ...mono, color: score >= 70 ? '#dc2626' : score >= 40 ? '#d97706' : '#10b981' }}>
                                  {score}
                                </Typography>
                              </Box>
                              <Typography sx={{ fontSize: '0.6875rem', color: '#64748b' }}>
                                {score >= 70 ? 'High' : score >= 40 ? 'Medium' : 'Low'} risk
                              </Typography>
                            </Box>
                          )}
                          <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8' }}>
                            {item.stepResults.length} step{item.stepResults.length !== 1 ? 's' : ''} ·{' '}
                            {item.stepResults.filter(s => s.status === 'match').length} flagged
                          </Typography>
                        </Box>
                      </Box>
                      {expanded
                        ? <ExpandLessRoundedIcon sx={{ fontSize: '1rem', color: '#94a3b8', flexShrink: 0 }} />
                        : <ExpandMoreRoundedIcon sx={{ fontSize: '1rem', color: '#94a3b8', flexShrink: 0 }} />
                      }
                    </Box>

                    {/* Expanded detail */}
                    <Collapse in={expanded}>
                      <Box sx={{ borderTop: '1px solid var(--border-col)', px: 2, py: 2 }}>

                        {/* Risk score + profile */}
                        {score !== null && score !== undefined && (
                          <Box sx={{ mb: 2, pb: 2, borderBottom: '1px solid var(--border-col)' }}>
                            <RiskBadge score={score} />
                            {[(item as any).bvn && ['BVN', (item as any).bvn],
                              (item as any).nin && ['NIN', (item as any).nin],
                              (item as any).dob && ['DOB', (item as any).dob],
                              (item as any).phone && ['Phone', (item as any).phone],
                            ].filter(Boolean).length > 0 && (
                              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 1.5 }}>
                                {[(item as any).bvn && ['BVN', (item as any).bvn],
                                  (item as any).nin && ['NIN', (item as any).nin],
                                  (item as any).dob && ['DOB', (item as any).dob],
                                  (item as any).phone && ['Phone', (item as any).phone],
                                ].filter(Boolean).map(([label, value]: any) => (
                                  <Box key={label}>
                                    <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</Typography>
                                    <Typography sx={{ fontSize: '0.75rem', ...mono, color: 'var(--heading-color)' }}>{value}</Typography>
                                  </Box>
                                ))}
                              </Box>
                            )}
                          </Box>
                        )}

                        {/* Concerns */}
                        {concerns && concerns.length > 0 && (
                          <Box sx={{ mb: 2, pb: 2, borderBottom: '1px solid var(--border-col)' }}>
                            <Typography sx={{ ...sectionLabel, mb: 1 }}>Concerns</Typography>
                            <Stack gap={0.625}>
                              {concerns.map((c: any, i: number) => (
                                <Box key={i} sx={{ display: 'flex', gap: 0.75, alignItems: 'flex-start' }}>
                                  <WarningAmberRoundedIcon sx={{ fontSize: '0.875rem', color: '#d97706', mt: '2px', flexShrink: 0 }} />
                                  <Typography sx={{ fontSize: '0.75rem', color: '#64748b', lineHeight: 1.5 }}>
                                    {c.detail ?? c.message ?? JSON.stringify(c)}
                                  </Typography>
                                </Box>
                              ))}
                            </Stack>
                          </Box>
                        )}

                        {/* Step-by-step results */}
                        <Typography sx={{ ...sectionLabel, mb: 1 }}>Step results</Typography>
                        <Stack gap={0.75}>
                          {item.stepResults.map((s, i) => {
                            const bc       = BLOCK_COLORS[s.type]
                            const stepColor = s.status === 'match' ? '#dc2626' : s.status === 'error' || s.status === 'not_found' ? '#d97706' : '#10b981'
                            return (
                              <Box key={i} sx={{
                                px: 1.5, py: 1.25, bgcolor: 'var(--section-bg)', border: '1px solid var(--border-col)',
                                borderLeft: `3px solid ${stepColor}`,
                              }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.375 }}>
                                  <Box sx={{ color: bc?.color ?? stepColor, display: 'flex', '& svg': { fontSize: '0.875rem' } }}>{bc?.icon}</Box>
                                  <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost', flex: 1 }}>
                                    {BLOCK_META[s.type]?.label ?? (s.type === 'case' ? 'Case Opened' : s.type)}
                                  </Typography>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                    {s.score !== undefined && s.score !== null && (
                                      <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, ...mono, color: stepColor }}>
                                        {s.score}/100
                                      </Typography>
                                    )}
                                    <Chip label={s.status} size="small" sx={{ borderRadius: '3px', fontSize: '0.5625rem', height: 18, fontWeight: 700,
                                      bgcolor: s.status === 'pass' ? '#f0fdf4' : s.status === 'match' ? '#fef2f2' : '#fffbeb',
                                      color:   s.status === 'pass' ? '#15803d' : s.status === 'match' ? '#991b1b' : '#d97706' }} />
                                    {s.ms !== undefined && (
                                      <Typography sx={{ fontSize: '0.5625rem', color: '#94a3b8', ...mono }}>{s.ms}ms</Typography>
                                    )}
                                  </Box>
                                </Box>
                                <Typography sx={{ fontSize: '0.75rem', color: '#64748b', lineHeight: 1.5 }}>
                                  {s.detail}
                                </Typography>
                              </Box>
                            )
                          })}
                        </Stack>

                        {/* Risk Score Math */}
                        {score !== null && score !== undefined && (() => {
                          // Use backend-stamped weight if present, otherwise fall back to defaults
                          const stepW = (s: any): number =>
                            (s as any).weight ?? DEFAULT_WEIGHTS[s.type] ?? 10
                          const scoredSteps = item.stepResults.filter(
                            s => s.score !== undefined && s.score !== null && (s.type !== 'case'))
                          if (scoredSteps.length === 0) return null
                          let weightSum = 0, weightedSum = 0
                          for (const s of scoredSteps) {
                            const w = stepW(s)
                            weightSum += w
                            weightedSum += (s.score as number) * w
                          }
                          const authenticity = weightSum > 0 ? Math.round(weightedSum / weightSum) : 0
                          const computed = 100 - authenticity
                          return (
                            <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid var(--border-col)' }}>
                              <Typography sx={{ ...sectionLabel, mb: 0.75 }}>Risk Score Breakdown</Typography>
                              <Typography sx={{ fontSize: '0.625rem', color: '#94a3b8', mb: 1.5, ...mono }}>
                                Risk Score = 100 − (Σ authenticity × weight ÷ Σ weight)
                              </Typography>

                              {/* header */}
                              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 48px 64px 80px', gap: 0.5, mb: 0.5, px: 0.5 }}>
                                {['Step', 'Weight', 'Auth.', 'Contribution'].map(h => (
                                  <Typography key={h} sx={{ fontSize: '0.5rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</Typography>
                                ))}
                              </Box>

                              <Stack gap={0.25}>
                                {scoredSteps.map((s, i) => {
                                  const w = stepW(s)
                                  const sc = s.score as number
                                  const contrib = weightSum > 0 ? ((sc * w) / weightSum).toFixed(1) : '—'
                                  const authColor = sc >= 60 ? '#10b981' : sc >= 30 ? '#d97706' : '#dc2626'
                                  return (
                                    <Box key={i} sx={{ display: 'grid', gridTemplateColumns: '1fr 48px 64px 80px', gap: 0.5, px: 0.5, py: 0.375,
                                      bgcolor: 'var(--section-bg)', border: '1px solid var(--border-col)' }}>
                                      <Typography sx={{ fontSize: '0.6875rem', color: 'var(--heading-color)', fontFamily: 'Jost', lineHeight: 1.3 }}>
                                        {BLOCK_META[s.type]?.label ?? s.type}
                                      </Typography>
                                      <Typography sx={{ fontSize: '0.6875rem', ...mono, color: '#94a3b8' }}>{w}</Typography>
                                      <Typography sx={{ fontSize: '0.6875rem', ...mono, color: authColor, fontWeight: 700 }}>{sc}/100</Typography>
                                      <Typography sx={{ fontSize: '0.6875rem', ...mono, color: '#64748b' }}>{contrib}</Typography>
                                    </Box>
                                  )
                                })}
                              </Stack>

                              <Box sx={{ mt: 1, pt: 1, borderTop: '1px dashed var(--border-col)' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.375 }}>
                                  <Typography sx={{ fontSize: '0.6875rem', color: '#64748b', fontFamily: 'Jost' }}>
                                    Weighted authenticity
                                  </Typography>
                                  <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, ...mono, color: 'var(--heading-color)' }}>
                                    {weightedSum} ÷ {weightSum} = {authenticity}/100
                                  </Typography>
                                </Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <Typography sx={{ fontSize: '0.6875rem', color: '#64748b', fontFamily: 'Jost' }}>
                                    100 − {authenticity} = Risk Score
                                  </Typography>
                                  <Typography sx={{ fontSize: '1rem', fontWeight: 800, ...mono,
                                    color: computed >= 75 ? '#dc2626' : computed >= 35 ? '#d97706' : '#10b981' }}>
                                    {computed}
                                  </Typography>
                                </Box>
                              </Box>
                            </Box>
                          )
                        })()}
                      </Box>
                    </Collapse>
                  </Box>
                )
              })}
            </Stack>
          </>
        )}
      </Drawer>
    </Box>
  )
}
