import { useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Box, Typography, Stack, IconButton, InputBase, Tooltip } from '@mui/material'
import NavigationBreadcrumb from '@/components/dashboard/NavigationBreadcrumb'
import ActionEvidenceDialog, { type EvidencePayload } from '@/components/dashboard/ActionEvidenceDialog'
import FileReportDialog, { type ReportPrefill } from '@/components/dashboard/FileReportDialog'
import AssignCaseModal from '@/components/dashboard/AssignCaseModal'
import TOTPConfirmation from '@/components/dashboard/TOTPConfirmation'
import type { TeamMember } from '@/api/team'
import { colorPalette } from '@/theme'
import { caseApi, type Case, type CaseDetail, type CaseStatus, type CaseResolution, type CaseInterest } from '@/api/cases'
import { customerApi } from '@/api/customers'
import type { NfiuReport } from '@/api/nfiu'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useRbac } from '@/contexts/RbacContext'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined'
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded'
import VerifiedRoundedIcon from '@mui/icons-material/VerifiedRounded'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'

// ── Config ────────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { color: string; bg: string; label: string }> = {
  open:           { color: '#f59e0b',           bg: '#fffbeb',                             label: 'Open'           },
  investigating:  { color: colorPalette.primary, bg: `${colorPalette.primary}0f`,           label: 'Investigating'  },
  pending_review: { color: '#7c3aed',            bg: '#f5f3ff',                             label: 'Pending Review' },
  escalated:      { color: '#dc2626',            bg: '#fef2f2',                             label: 'Escalated'      },
  closed:         { color: '#64748b',            bg: '#f8fafc',                             label: 'Closed'         },
}

const PRIORITY_CFG: Record<string, { color: string; bg: string; label: string }> = {
  low:      { color: '#64748b', bg: '#f8fafc', label: 'Low'      },
  medium:   { color: '#f59e0b', bg: '#fffbeb', label: 'Medium'   },
  high:     { color: '#ea580c', bg: '#fff7ed', label: 'High'     },
  critical: { color: '#dc2626', bg: '#fef2f2', label: 'Critical' },
}

const L2_ROLES = new Set(['admin', 'cco'])

const ACTION_LABELS: Record<string, string> = {
  opened:               'Case opened',
  status_changed:       'Status updated',
  submitted_for_review: 'Submitted for L2 review',
  note_added:           'Note added',
  transaction_linked:   'Transaction linked',
  evidence_added:       'Evidence added',
  assigned:             'Case assigned',
  closed:               'Case closed',
  nfiu_report_linked:   'NFIU report filed & linked',
  escalated:            'Case escalated',
  investigating:        'Investigation started',
}

const RESOLUTION_OPTIONS: { key: CaseResolution; label: string; color: string }[] = [
  { key: 'cleared',  label: 'Cleared — false positive',    color: '#10b981' },
  { key: 'referred', label: 'Referred to law enforcement', color: '#dc2626' },
]

const EVIDENCE_CATEGORY_CFG: Record<string, { color: string; label: string }> = {
  transaction: { color: colorPalette.primary, label: 'Transaction'  },
  kyc:         { color: '#7c3aed',            label: 'KYC'          },
  behavior:    { color: '#ea580c',            label: 'Behavioral'   },
  device:      { color: '#0891b2',            label: 'Device'       },
  otp:         { color: '#d97706',            label: 'OTP'          },
  document:    { color: '#64748b',            label: 'Document'     },
  other:       { color: '#94a3b8',            label: 'Other'        },
}

const AVATAR_COLORS = ['#1e40af', '#0891b2', '#7c3aed', '#be123c', '#b45309', '#065f46']

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  try {
    return new Intl.DateTimeFormat('en-NG', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
  } catch { return iso }
}

function fmtDateShort(iso: string) {
  try {
    return new Intl.DateTimeFormat('en-NG', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
  } catch { return iso }
}

function initials(name?: string) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function slaInfo(deadline: string, status: CaseStatus) {
  if (status === 'closed') return { label: 'Closed', color: '#10b981', pct: 100 }
  if (status === 'pending_review') return { label: 'Pending Review', color: '#7c3aed', pct: 60 }
  const now = Date.now()
  const end = new Date(deadline).getTime()
  const diff = end - now
  if (diff <= 0) return { label: 'Overdue', color: '#dc2626', pct: 0 }
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  const label = h > 0 ? `${h}h ${m}m` : `${m}m`
  const color = h < 2 ? '#dc2626' : h < 12 ? '#f59e0b' : '#10b981'
  return { label, color, pct: Math.min(100, Math.round((diff / 86_400_000) * 100)) }
}

function Avatar({ name, size = 32 }: { name?: string; size?: number }) {
  const idx = (name?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length
  return (
    <Box sx={{ width: size, height: size, borderRadius: '50%', bgcolor: AVATAR_COLORS[idx], display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Typography sx={{ fontSize: size * 0.34, fontWeight: 700, color: '#fff', lineHeight: 1 }}>{initials(name)}</Typography>
    </Box>
  )
}

function ActionBtn({ label, color, disabled, onClick }: { label: string; color: string; disabled: boolean; onClick: () => void }) {
  return (
    <Box onClick={disabled ? undefined : onClick} sx={{
      px: 2, py: 0.875, border: `1px solid ${color}`, color,
      cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1,
      fontSize: '0.8125rem', fontWeight: 700, fontFamily: 'Jost',
      transition: 'all 0.15s', '&:hover': disabled ? {} : { bgcolor: `${color}0a` },
    }}>
      {label}
    </Box>
  )
}

function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
      <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
        {title}
      </Typography>
      {action}
    </Box>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CasePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const currentUser = useCurrentUser()
  const { can } = useRbac()
  const isPrivileged = currentUser?.role ? L2_ROLES.has(currentUser.role) : false
  const isL2 = isPrivileged  // kept for action-button logic below
  const canAssignOrReassign = isPrivileged

  const [data,          setData]          = useState<CaseDetail | null>(null)
  const [loading,       setLoading]       = useState(true)
  const [actioning,     setActioning]     = useState(false)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)
  const [note,          setNote]          = useState('')
  const [submittingNote, setSubmittingNote] = useState(false)
  const [activityFilter, setActivityFilter] = useState<string>('all')
  const [closePickerOpen, setClosePickerOpen] = useState(false)
  const [localStatus,   setLocalStatus]   = useState<CaseStatus | null>(null)
  const [assignOpen,      setAssignOpen]      = useState(false)
  const [pendingAssignee, setPendingAssignee] = useState<TeamMember | null>(null)
  const [totpOpen,        setTotpOpen]        = useState(false)
  const [customerPhoto,   setCustomerPhoto]   = useState<string | null>(null)
  const [myInterest,      setMyInterest]      = useState<CaseInterest | null | undefined>(undefined)
  const [caseInterests,   setCaseInterests]   = useState<CaseInterest[]>([])
  const [interestLoading, setInterestLoading] = useState(false)

  // NFIU filing
  const [nfiuOpen,    setNfiuOpen]    = useState(false)
  const [nfiuPrefill, setNfiuPrefill] = useState<ReportPrefill | undefined>()

  // Evidence gate
  const [evidenceTarget, setEvidenceTarget] = useState<{
    status: CaseStatus; resolution?: CaseResolution; label: string; color: string; skipDoc?: boolean
  } | null>(null)

  const cas: Case | null = data?.case ?? null
  const currentStatus = localStatus ?? cas?.status ?? null

  const loadDetail = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const d = await caseApi.detail(id)
      setData(d)
      setLocalStatus(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadDetail()
    if (id) caseApi.markSeen(id).catch(() => {})
  }, [id, loadDetail])

  // Fetch customer photo once we know the customerId
  useEffect(() => {
    const cid = data?.case?.customerId
    if (!cid) { setCustomerPhoto(null); return }
    customerApi.getCustomer(cid)
      .then(c => setCustomerPhoto(c.photo ?? null))
      .catch(() => setCustomerPhoto(null))
  }, [data?.case?.customerId])

  // Load interest state when case is available
  useEffect(() => {
    if (!id) return
    caseApi.myInterest(id).then(r => setMyInterest(r.interest)).catch(() => setMyInterest(null))
    if (isPrivileged) {
      caseApi.listInterests(id).then(r => setCaseInterests(r.interests)).catch(() => {})
    }
  }, [id, isPrivileged])

  const openNfiuDialog = useCallback(() => {
    if (!cas) return
    const tx = data?.transactions?.[0] ?? null
    const today = new Date().toISOString().split('T')[0]
    const prefill: ReportPrefill = {
      reportType: 'STR',
      title: `STR — ${cas.title}`,
      subjectName: tx?.customer ?? cas.customerName ?? undefined,
      subjectExternalId: cas.customerId ?? tx?.customerId ?? undefined,
      subjectAccount: tx?.senderAccount,
      subjectType: 'individual',
      amountNgn: tx ? String(tx.amount) : undefined,
      transactionType: tx?.channel,
      transactionDate: tx?.occurredAt ? tx.occurredAt.split('T')[0] : undefined,
      linkedTransactionId: tx?.id,
      transactionSenderAccount: tx?.senderAccount,
      transactionSenderBank: tx?.senderBank,
      transactionRecipientName: tx?.recipientName,
      transactionRecipientAccount: tx?.recipientAccount,
      transactionRecipientBank: tx?.recipientBank,
      transactionCurrency: tx?.currency,
      transactionNarration: tx?.narration,
      narrative: cas.notes
        ? `Case: ${cas.title}\nTypology: ${cas.typology}\n\n${cas.notes}`
        : `Case: ${cas.title}\nTypology: ${cas.typology}\n\nSuspicious transaction detected on ${today}. Risk score: ${cas.riskScore}.`,
    }
    setNfiuPrefill(prefill)
    setNfiuOpen(true)
  }, [cas, data])

  const requestTransition = (status: CaseStatus, resolution: CaseResolution | undefined, label: string, color: string, skipDoc = false) => {
    if (!cas || actioning) return
    setClosePickerOpen(false)
    setEvidenceTarget({ status, resolution, label, color, skipDoc })
  }

  const transition = useCallback(async (newStatus: CaseStatus, resolution: CaseResolution | undefined, reason: string, documentId: number | null) => {
    if (!cas || actioning) return
    setActioning(true)
    try {
      await caseApi.updateStatus(cas.id, newStatus, resolution, reason, documentId)
      setLocalStatus(newStatus)
      window.dispatchEvent(new CustomEvent('case:updated'))

      if (newStatus === 'closed') {
        if (resolution === 'referred') {
          setActionSuccess('Case closed and customer watchlisted.')
          const txnCustId = data?.transactions?.[0]?.customerId ?? null
          if (txnCustId) customerApi.watchlist(txnCustId, `Case ${cas.id} closed: referred`).catch(() => {})
        } else {
          setActionSuccess('Case closed successfully.')
        }
      } else if (newStatus === 'pending_review') {
        setActionSuccess('Case submitted for L2 review.')
      } else if (newStatus === 'investigating') {
        setActionSuccess('Investigation started.')
      } else if (newStatus === 'escalated') {
        setActionSuccess('Case escalated.')
      }

      await loadDetail()
    } finally {
      setActioning(false)
    }
  }, [cas, actioning, loadDetail, data])

  const handleEvidenceConfirm = useCallback((payload: EvidencePayload) => {
    if (!evidenceTarget) return
    const { status, resolution } = evidenceTarget
    setEvidenceTarget(null)
    transition(status, resolution, payload.reason, payload.documentId ?? null)
  }, [evidenceTarget, transition])

  const submitNote = useCallback(async () => {
    if (!cas || !note.trim() || submittingNote) return
    setSubmittingNote(true)
    try {
      await caseApi.addNote(cas.id, note.trim())
      setNote('')
      await loadDetail()
    } finally { setSubmittingNote(false) }
  }, [cas, note, submittingNote, loadDetail])

  const fileSar = useCallback(async () => {
    if (!cas || actioning) return
    setActioning(true)
    try {
      if (currentStatus !== 'investigating') {
        await caseApi.updateStatus(cas.id, 'investigating', undefined, 'SAR/STR filing initiated', null)
        setLocalStatus('investigating')
        window.dispatchEvent(new CustomEvent('case:updated'))
      }
    } finally { setActioning(false) }
    setActionSuccess('Opening NFIU STR/SAR filing form…')
    openNfiuDialog()
    loadDetail().catch(() => {})
  }, [cas, actioning, currentStatus, openNfiuDialog, loadDetail])

  // Filter activity by type
  const filteredActivity = (data?.activity ?? []).filter(a => {
    if (activityFilter === 'all') return true
    if (activityFilter === 'notes') return a.action === 'note_added'
    if (activityFilter === 'status') return ['opened', 'status_changed', 'submitted_for_review', 'closed', 'escalated', 'investigating'].includes(a.action)
    if (activityFilter === 'evidence') return a.action === 'evidence_added'
    if (activityFilter === 'assign') return a.action === 'assigned'
    return true
  })

  if (loading && !data) {
    return (
      <Box sx={{ p: 4 }}>
        <NavigationBreadcrumb currentLabel="Loading case…" />
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 3, maxWidth: 600 }}>
          {[280, 180, 320, 240].map((w, i) => (
            <Box key={i} sx={{ height: 14, width: w, bgcolor: 'var(--section-bg)', borderRadius: 0.5, animation: 'pulse 1.5s ease-in-out infinite', '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } }, animationDelay: `${i * 80}ms` }} />
          ))}
        </Box>
      </Box>
    )
  }

  if (!loading && !cas) {
    return (
      <Box sx={{ p: 4 }}>
        <NavigationBreadcrumb currentLabel="Case not found" />
        <Box sx={{ mt: 4, textAlign: 'center' }}>
          <GavelOutlinedIcon sx={{ fontSize: '2.5rem', color: '#e2e8f0', mb: 1.5 }} />
          <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#94a3b8', fontFamily: 'Jost', mb: 0.5 }}>Case not found</Typography>
          <Typography sx={{ fontSize: '0.875rem', color: '#cbd5e1', mb: 2.5 }}>The case "{id}" does not exist or you don't have access.</Typography>
          <Box onClick={() => navigate('/dashboard/aml')} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, color: colorPalette.primary, cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, '&:hover': { textDecoration: 'underline' } }}>
            <ArrowBackRoundedIcon sx={{ fontSize: '1rem' }} /> Back to Cases
          </Box>
        </Box>
      </Box>
    )
  }

  const sCfg  = currentStatus ? (STATUS_CFG[currentStatus] ?? STATUS_CFG.open) : STATUS_CFG.open
  const pCfg  = cas ? (PRIORITY_CFG[cas.priority] ?? PRIORITY_CFG.medium) : PRIORITY_CFG.medium
  const sla   = cas ? slaInfo(cas.slaDeadline, currentStatus ?? cas.status) : null

  // Privileged roles see everything; otherwise only the assignee sees the full case
  const isAssignedToMe = cas?.assignedTo != null && currentUser?.userId != null && cas.assignedTo === currentUser.userId
  const canSeeFullCase = isPrivileged || isAssignedToMe

  // Group evidence by category
  const evidenceByCategory = (data?.evidence ?? []).reduce<Record<string, NonNullable<typeof data>['evidence']>>((acc, e) => {
    if (!acc[e.category]) acc[e.category] = []
    acc[e.category].push(e)
    return acc
  }, {})

  return (
    <Box sx={{ p: 4, pb: 8 }}>
      <NavigationBreadcrumb currentLabel={cas?.id ?? id ?? ''} />

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <Box sx={{ mb: 3 }}>
        {/* Back + case ID row */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
          <Box onClick={() => navigate('/dashboard/aml')} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: '#64748b', cursor: 'pointer', '&:hover': { color: colorPalette.primary }, transition: 'color 0.15s', flexShrink: 0 }}>
            <ArrowBackRoundedIcon sx={{ fontSize: '1rem' }} />
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 600 }}>Cases</Typography>
          </Box>
          <Box sx={{ width: 1, height: 12, bgcolor: '#e2e8f0' }} />
          <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'SF Mono, Monaco, monospace' }}>
            {cas?.id}
          </Typography>
          <Box sx={{ px: 0.875, py: 0.25, bgcolor: pCfg.bg, border: `1px solid ${pCfg.color}30` }}>
            <Typography sx={{ fontSize: '0.5rem', fontWeight: 700, color: pCfg.color, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{pCfg.label}</Typography>
          </Box>
          <Box sx={{ px: 0.875, py: 0.25, bgcolor: sCfg.bg }}>
            <Typography sx={{ fontSize: '0.5rem', fontWeight: 700, color: sCfg.color, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{sCfg.label}</Typography>
          </Box>
        </Box>

        {/* Title + typology */}
        <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost', letterSpacing: '-0.015em', mb: 0.375, lineHeight: 1.25 }}>
          {cas?.title}
        </Typography>
        <Typography sx={{ fontSize: '0.875rem', color: '#64748b', mb: 1.75 }}>
          {cas?.typology}
        </Typography>

        {/* SLA bar */}
        {sla && currentStatus !== 'closed' && (
          <Box sx={{ mb: 2, maxWidth: 480 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>SLA Deadline</Typography>
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: sla.color }}>{sla.label}</Typography>
            </Box>
            <Box sx={{ height: 4, bgcolor: 'var(--section-bg)', position: 'relative' }}>
              <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${sla.pct}%`, bgcolor: sla.color, transition: 'width 0.4s' }} />
            </Box>
          </Box>
        )}

        {/* Action success flash */}
        {actionSuccess && (
          <Box sx={{ mb: 1.5, bgcolor: '#f0fdf4', border: '1px solid #86efac', px: 2, py: 1.125, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, maxWidth: 560 }}>
            <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: '#166534' }}>{actionSuccess}</Typography>
            <Box onClick={() => setActionSuccess(null)} sx={{ fontSize: '0.6875rem', color: '#4ade80', cursor: 'pointer', '&:hover': { color: '#166534' } }}>✕</Box>
          </Box>
        )}

        {/* Action buttons — only shown to privileged roles or the assigned investigator */}
        {cas && currentStatus !== 'closed' && canSeeFullCase && (
          <Box>
            <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 1 }}>
              Actions
            </Typography>
            {currentStatus === 'pending_review' ? (
              <Box>
                <Box sx={{ p: 1.5, mb: 1, bgcolor: '#f5f3ff', border: '1px solid #ddd6fe', display: 'flex', alignItems: 'center', gap: 1, maxWidth: 480 }}>
                  <VerifiedRoundedIcon sx={{ fontSize: '0.9375rem', color: '#7c3aed', flexShrink: 0 }} />
                  <Typography sx={{ fontSize: '0.75rem', color: '#5b21b6', lineHeight: 1.4 }}>
                    {isL2 ? 'This case is awaiting your review.' : 'This case has been submitted for L2 review. Only compliance/MLRO officers may act on it now.'}
                  </Typography>
                </Box>
                {isL2 && (
                  <Stack direction="row" gap={1} flexWrap="wrap">
                    <Box sx={{ position: 'relative' }}>
                      <ActionBtn label="Close with Resolution" color="#64748b" disabled={actioning} onClick={() => setClosePickerOpen(v => !v)} />
                      {closePickerOpen && <ClosePickerMenu onSelect={(k, l, c) => requestTransition('closed', k, l, c)} onClose={() => setClosePickerOpen(false)} />}
                    </Box>
                    <ActionBtn label="Return to Investigation" color={colorPalette.primary} disabled={actioning}
                      onClick={() => requestTransition('investigating', undefined, 'Return to Investigation', colorPalette.primary, true)} />
                  </Stack>
                )}
              </Box>
            ) : (
              <Stack direction="row" gap={1} flexWrap="wrap">
                {currentStatus === 'open' && (
                  <ActionBtn label="Start Investigation" color={colorPalette.primary} disabled={actioning}
                    onClick={() => requestTransition('investigating', undefined, 'Start Investigation', colorPalette.primary, true)} />
                )}
                {currentStatus === 'investigating' && (
                  <ActionBtn label="Submit for Review" color="#7c3aed" disabled={actioning}
                    onClick={() => requestTransition('pending_review', undefined, 'Submit for Review', '#7c3aed')} />
                )}
                {(currentStatus === 'open' || currentStatus === 'investigating') && (
                  <ActionBtn label="Escalate" color="#dc2626" disabled={actioning}
                    onClick={() => requestTransition('escalated', undefined, 'Escalate', '#dc2626')} />
                )}
                {!cas.linkedNfiuReportId && (
                  <ActionBtn label="File SAR / STR" color="#d97706" disabled={actioning} onClick={fileSar} />
                )}
                {(currentStatus === 'escalated' || isL2) && (
                  <Box sx={{ position: 'relative' }}>
                    <ActionBtn label="Close Case" color="#64748b" disabled={actioning} onClick={() => setClosePickerOpen(v => !v)} />
                    {closePickerOpen && <ClosePickerMenu onSelect={(k, l, c) => requestTransition('closed', k, l, c)} onClose={() => setClosePickerOpen(false)} />}
                  </Box>
                )}
              </Stack>
            )}
          </Box>
        )}
      </Box>

      {/* ── 2-column body ─────────────────────────────────────────────────── */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 3, alignItems: 'start' }}>

        {/* ── Main column ──────────────────────────────────────────────────── */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>

          {/* Overview card */}
          <Box sx={{ bgcolor: 'var(--card-bg)', border: '1px solid var(--border-col)' }}>
            <Box sx={{ px: 2.5, py: 1.75, borderBottom: '1px solid var(--border-col)' }}>
              <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost' }}>Case Overview</Typography>
            </Box>
            <Box sx={{ p: 2.5, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <MetaRow label="Opened by"   value={cas?.createdByName ?? '—'} />
              <MetaRow label="Opened"      value={cas?.createdAt ? fmtDate(cas.createdAt) : '—'} />
              <MetaRow label="Risk score"  value={cas ? `${cas.riskScore}/100` : '—'} highlight={cas?.riskScore ?? 0 >= 70 ? '#dc2626' : cas?.riskScore ?? 0 >= 40 ? '#f59e0b' : '#10b981'} />
              <MetaRow label="Typology"    value={cas?.typology ?? '—'} />
              {cas?.closedAt    && <MetaRow label="Closed"     value={fmtDate(cas.closedAt)} />}
              {cas?.resolution  && <MetaRow label="Resolution" value={cas.resolution.replace(/_/g, ' ')} />}
              {cas?.linkedNfiuReportId && <MetaRow label="NFIU Report" value={`Report #${cas.linkedNfiuReportId}`} highlight={colorPalette.primary} />}
            </Box>
            {cas?.notes && (
              <Box sx={{ px: 2.5, pb: 2 }}>
                <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 0.75 }}>Notes</Typography>
                <Box sx={{ p: 1.5, bgcolor: 'var(--card-bg)', border: '1px solid var(--border-col)' }}>
                  <Typography sx={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{cas.notes}</Typography>
                </Box>
              </Box>
            )}
          </Box>

          {/* Restricted-view notice for non-privileged, non-assigned users */}
          {!canSeeFullCase && (
            <Box sx={{ bgcolor: 'var(--section-bg)', border: '1px solid var(--border-col)', px: 2.5, py: 2, display: 'flex', alignItems: 'center', gap: 1.25 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#f59e0b', flexShrink: 0 }} />
              <Typography sx={{ fontSize: '0.8125rem', color: '#64748b', lineHeight: 1.5 }}>
                This case is assigned to another investigator. You can view the overview only. Accept the case or contact your admin to gain full access.
              </Typography>
            </Box>
          )}

          {/* Linked transactions */}
          {canSeeFullCase && <Box sx={{ bgcolor: 'var(--card-bg)', border: '1px solid var(--border-col)' }}>
            <Box sx={{ px: 2.5, py: 1.75, borderBottom: '1px solid var(--border-col)' }}>
              <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost' }}>
                Linked Transactions <Typography component="span" sx={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 400, ml: 0.75 }}>({data?.transactions?.length ?? 0})</Typography>
              </Typography>
            </Box>
            {!data?.transactions?.length ? (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography sx={{ fontSize: '0.8125rem', color: '#94a3b8' }}>No transactions linked</Typography>
              </Box>
            ) : (
              <>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 72px 120px', gap: 2, px: 2.5, py: 1, bgcolor: 'var(--card-bg)', borderBottom: '1px solid var(--border-col)' }}>
                  {['Transaction ID', 'Amount', 'Risk', 'Channel', 'Date'].map(h => (
                    <Typography key={h} sx={{ fontSize: '0.5625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{h}</Typography>
                  ))}
                </Box>
                {data.transactions.map((t, i) => (
                  <Box key={t.id} sx={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 72px 120px', gap: 2, px: 2.5, py: 1.5, borderBottom: i < (data.transactions.length - 1) ? '1px solid var(--border-col)' : 'none', alignItems: 'center' }}>
                    <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: colorPalette.primary, fontFamily: 'SF Mono, Monaco, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.id}</Typography>
                    <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'SF Mono, Monaco, monospace' }}>{t.amount.toLocaleString()}</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Box sx={{ width: 24, height: 4, bgcolor: 'var(--section-bg)', position: 'relative', flexShrink: 0 }}>
                        <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${t.risk}%`, bgcolor: t.risk >= 70 ? '#dc2626' : t.risk >= 40 ? '#f59e0b' : '#10b981' }} />
                      </Box>
                      <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: t.risk >= 70 ? '#dc2626' : t.risk >= 40 ? '#f59e0b' : '#10b981' }}>{t.risk}</Typography>
                    </Box>
                    <Typography sx={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'capitalize' }}>{t.channel}</Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>{t.occurredAt ? fmtDateShort(t.occurredAt) : '—'}</Typography>
                  </Box>
                ))}
              </>
            )}
          </Box>}

          {/* Evidence locker */}
          {canSeeFullCase && <Box sx={{ bgcolor: 'var(--card-bg)', border: '1px solid var(--border-col)' }}>
            <Box sx={{ px: 2.5, py: 1.75, borderBottom: '1px solid var(--border-col)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost' }}>
                Evidence Locker <Typography component="span" sx={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 400, ml: 0.75 }}>({data?.evidence?.length ?? 0})</Typography>
              </Typography>
              {cas && currentStatus !== 'closed' && (
                <Tooltip title="Add Evidence" placement="left">
                  <IconButton size="small" disableRipple
                    onClick={() => setEvidenceTarget({ status: currentStatus ?? 'open', label: 'Add Evidence', color: colorPalette.primary, skipDoc: false })}
                    sx={{ borderRadius: 0, color: colorPalette.primary, bgcolor: `${colorPalette.primary}0a`, '&:hover': { bgcolor: `${colorPalette.primary}14` } }}>
                    <AddRoundedIcon sx={{ fontSize: '1rem' }} />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
            {!data?.evidence?.length ? (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography sx={{ fontSize: '0.8125rem', color: '#94a3b8' }}>No evidence added yet</Typography>
              </Box>
            ) : (
              <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {Object.entries(evidenceByCategory).map(([cat, items]) => {
                  const cfg = EVIDENCE_CATEGORY_CFG[cat] ?? EVIDENCE_CATEGORY_CFG.other
                  return (
                    <Box key={cat}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.875 }}>
                        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: cfg.color }} />
                        <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: cfg.color, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{cfg.label}</Typography>
                      </Box>
                      {items.map(e => (
                        <Box key={e.id} sx={{ ml: 1.75, mb: 1, p: 1.5, bgcolor: 'var(--card-bg)', border: '1px solid var(--border-col)', '&:last-child': { mb: 0 } }}>
                          <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mb: 0.25 }}>
                            <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--heading-color)', fontFamily: 'Jost' }}>{e.title}</Typography>
                            <Typography sx={{ fontSize: '0.625rem', color: '#94a3b8', ml: 1, flexShrink: 0 }}>{fmtDateShort(e.createdAt)}</Typography>
                          </Box>
                          {e.detail && <Typography sx={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', lineHeight: 1.5, mt: 0.25 }}>{e.detail}</Typography>}
                          {e.refId && <Typography sx={{ fontSize: '0.625rem', color: colorPalette.primary, fontFamily: 'SF Mono, Monaco, monospace', mt: 0.25 }}>ref: {e.refId}</Typography>}
                          <Typography sx={{ fontSize: '0.625rem', color: '#94a3b8', mt: 0.5 }}>Added by {e.addedByName}</Typography>
                        </Box>
                      ))}
                    </Box>
                  )
                })}
              </Box>
            )}
          </Box>}

          {/* Activity timeline */}
          {canSeeFullCase && <Box sx={{ bgcolor: 'var(--card-bg)', border: '1px solid var(--border-col)' }}>
            <Box sx={{ px: 2.5, py: 1.75, borderBottom: '1px solid var(--border-col)' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost' }}>Activity Timeline</Typography>
              </Box>
              <Stack direction="row" gap={0.5} mt={1.25} flexWrap="wrap">
                {[
                  { key: 'all',      label: 'All' },
                  { key: 'notes',    label: 'Notes' },
                  { key: 'status',   label: 'Status' },
                  { key: 'evidence', label: 'Evidence' },
                  { key: 'assign',   label: 'Assignment' },
                ].map(f => (
                  <Box key={f.key} onClick={() => setActivityFilter(f.key)} sx={{
                    px: 1.25, py: 0.375, fontSize: '0.6875rem', fontWeight: 600, fontFamily: 'Jost', cursor: 'pointer',
                    border: '1px solid', borderColor: activityFilter === f.key ? colorPalette.primary : '#e2e8f0',
                    color: activityFilter === f.key ? colorPalette.primary : '#64748b',
                    bgcolor: activityFilter === f.key ? `${colorPalette.primary}0a` : 'transparent',
                    transition: 'all 0.15s',
                    '&:hover': { borderColor: colorPalette.primary, color: colorPalette.primary },
                  }}>
                    {f.label}
                  </Box>
                ))}
              </Stack>
            </Box>

            <Box sx={{ p: 2.5 }}>
              {filteredActivity.length === 0 ? (
                <Typography sx={{ fontSize: '0.8125rem', color: '#94a3b8' }}>No activity matching this filter</Typography>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {filteredActivity.map((a, i) => (
                    <Box key={a.id} sx={{ display: 'flex', gap: 1.5, pb: i < filteredActivity.length - 1 ? 2 : 0, position: 'relative' }}>
                      {i < filteredActivity.length - 1 && (
                        <Box sx={{ position: 'absolute', left: 15, top: 32, bottom: 0, width: 1, bgcolor: '#e2e8f0' }} />
                      )}
                      <Avatar name={a.actorName} size={32} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, flexWrap: 'wrap' }}>
                          <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--heading-color)', fontFamily: 'Jost' }}>{a.actorName}</Typography>
                          <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>{ACTION_LABELS[a.action] ?? a.action}</Typography>
                          <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', ml: 'auto' }}>{fmtDate(a.createdAt)}</Typography>
                        </Box>
                        {a.detail && (
                          <Box sx={{ mt: 0.5, p: 1, bgcolor: 'var(--card-bg)', border: '1px solid var(--border-col)' }}>
                            <Typography sx={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{a.detail}</Typography>
                          </Box>
                        )}
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}

              {/* Add note */}
              {cas && currentStatus !== 'closed' && (
                <Box sx={{ mt: 2.5, pt: 2, borderTop: '1px solid var(--border-col)' }}>
                  <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 1 }}>Add Note</Typography>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
                    <Box sx={{ flex: 1, border: '1px solid var(--border-col)', px: 1.25, py: 0.875, minHeight: 64, display: 'flex', alignItems: 'flex-start', '&:focus-within': { borderColor: colorPalette.primary } }}>
                      <InputBase multiline minRows={2} value={note} onChange={e => setNote(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submitNote() }}
                        placeholder="Add an investigation note…"
                        sx={{ flex: 1, fontSize: '0.8125rem', fontFamily: 'Jost', color: 'var(--heading-color)', '& textarea': { resize: 'none' } }} />
                    </Box>
                    <Box onClick={submitNote} sx={{
                      px: 1.75, py: 0.875, bgcolor: note.trim() && !submittingNote ? colorPalette.primary : '#e2e8f0',
                      color: note.trim() && !submittingNote ? '#ffffff' : '#94a3b8',
                      cursor: note.trim() && !submittingNote ? 'pointer' : 'not-allowed',
                      fontSize: '0.8125rem', fontWeight: 700, fontFamily: 'Jost', transition: 'all 0.15s', flexShrink: 0,
                    }}>
                      {submittingNote ? '…' : 'Post'}
                    </Box>
                  </Box>
                </Box>
              )}
            </Box>
          </Box>}
        </Box>

        {/* ── Right sidebar ──────────────────────────────────────────────────── */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

          {/* Customer panel */}
          {cas?.customerId && (
            <Box sx={{ bgcolor: 'var(--card-bg)', border: '1px solid var(--border-col)' }}>
              <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid var(--border-col)' }}>
                <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Customer</Typography>
              </Box>
              <Box sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1.5 }}>
                  {customerPhoto ? (
                    <Box component="img" src={customerPhoto} alt={cas.customerName ?? ''}
                      sx={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, display: 'block' }} />
                  ) : (
                    <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: `${colorPalette.primary}1a`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <PersonOutlineRoundedIcon sx={{ fontSize: '1.25rem', color: colorPalette.primary }} />
                    </Box>
                  )}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {cas.customerName ?? 'Unknown Customer'}
                    </Typography>
                    <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', fontFamily: 'SF Mono, Monaco, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {cas.customerId}
                    </Typography>
                  </Box>
                </Box>
                <Box onClick={() => navigate(`/dashboard/users/${cas.customerId}`)}
                  sx={{ display: 'flex', alignItems: 'center', gap: 0.625, color: colorPalette.primary, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, '&:hover': { textDecoration: 'underline' } }}>
                  <OpenInNewRoundedIcon sx={{ fontSize: '0.875rem' }} /> View Profile
                </Box>
              </Box>
            </Box>
          )}

          {/* Assignment panel */}
          <Box sx={{ bgcolor: 'var(--card-bg)', border: '1px solid var(--border-col)' }}>
            <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid var(--border-col)' }}>
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Assignment</Typography>
            </Box>
            <Box sx={{ p: 2 }}>
              {cas?.assignedTo ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1.25 }}>
                  <Avatar name={cas.assigneeName} size={36} />
                  <Box>
                    <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--heading-color)', fontFamily: 'Jost' }}>{cas.assigneeName}</Typography>
                    <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8' }}>Assigned investigator</Typography>
                  </Box>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25 }}>
                  <Box sx={{ width: 36, height: 36, borderRadius: '50%', bgcolor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>—</Typography>
                  </Box>
                  <Typography sx={{ fontSize: '0.8125rem', color: '#94a3b8', fontStyle: 'italic' }}>Unassigned</Typography>
                </Box>
              )}
              {cas && currentStatus !== 'closed' && canAssignOrReassign && (
                <Box onClick={() => setAssignOpen(true)} sx={{
                  px: 1.5, py: 0.625, border: `1px solid ${colorPalette.primary}`, color: colorPalette.primary,
                  cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, fontFamily: 'Jost',
                  transition: 'all 0.15s', '&:hover': { bgcolor: `${colorPalette.primary}0a` }, width: 'fit-content',
                }}>
                  {cas.assignedTo ? 'Reassign' : 'Assign'}
                </Box>
              )}

              {/* Express interest — visible only to confirmed non-privileged, non-assigned users */}
              {cas && currentStatus !== 'closed' && currentUser != null && !canAssignOrReassign && !isAssignedToMe && (
                <Box sx={{ mt: cas?.assignedTo ? 1.5 : 0, pt: cas?.assignedTo ? 1.5 : 0, borderTop: cas?.assignedTo ? '1px solid var(--border-col)' : 'none' }}>
                  {myInterest == null ? (
                    <Box
                      onClick={async () => {
                        if (!id || interestLoading) return
                        setInterestLoading(true)
                        try {
                          await caseApi.expressInterest(id)
                          const r = await caseApi.myInterest(id)
                          setMyInterest(r.interest)
                          if (isPrivileged) {
                            caseApi.listInterests(id).then(lr => setCaseInterests(lr.interests)).catch(() => {})
                          }
                        } catch { /* ignore */ } finally { setInterestLoading(false) }
                      }}
                      sx={{
                        px: 1.5, py: 0.625,
                        border: '1px solid var(--border-col)', color: 'var(--on-surface-variant)',
                        cursor: interestLoading ? 'not-allowed' : 'pointer',
                        opacity: interestLoading ? 0.6 : 1,
                        fontSize: '0.75rem', fontWeight: 700, fontFamily: 'Jost',
                        transition: 'all 0.15s', '&:hover': { borderColor: colorPalette.primary, color: colorPalette.primary },
                        width: 'fit-content',
                      }}
                    >
                      {interestLoading ? 'Submitting…' : 'Express Interest'}
                    </Box>
                  ) : myInterest.status === 'pending' ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#f59e0b', flexShrink: 0 }} />
                      <Box>
                        <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#92400e' }}>Interest Pending</Typography>
                        <Typography sx={{ fontSize: '0.625rem', color: '#94a3b8', mt: 0.125 }}>Awaiting admin approval</Typography>
                      </Box>
                    </Box>
                  ) : (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#10b981', flexShrink: 0 }} />
                      <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#065f46' }}>Interest Accepted</Typography>
                    </Box>
                  )}
                </Box>
              )}

              {/* Interest requests — visible to confirmed privileged users */}
              {cas && currentStatus !== 'closed' && currentUser != null && isPrivileged && caseInterests.length > 0 && (
                <Box sx={{ mt: 1.75, pt: 1.5, borderTop: '1px solid var(--border-col)' }}>
                  <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 1 }}>
                    Interest Requests ({caseInterests.filter(i => i.status === 'pending').length})
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.875 }}>
                    {caseInterests.map(interest => (
                      <Box key={interest.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar name={interest.userName} size={26} />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--heading-color)', fontFamily: 'Jost', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {interest.userName}
                          </Typography>
                          {interest.status === 'accepted' && (
                            <Typography sx={{ fontSize: '0.5625rem', color: '#10b981', fontWeight: 700 }}>Accepted</Typography>
                          )}
                        </Box>
                        {interest.status === 'pending' && (
                          <Box
                            onClick={async () => {
                              if (!id) return
                              try {
                                await caseApi.acceptInterest(id, interest.userId)
                                setActionSuccess(`Case assigned to ${interest.userName}.`)
                                setCaseInterests(prev => prev.map(i => i.id === interest.id ? { ...i, status: 'accepted' as const } : i))
                                loadDetail()
                              } catch { /* ignore */ }
                            }}
                            sx={{
                              px: 1, py: 0.375, bgcolor: colorPalette.primary, color: '#fff',
                              fontSize: '0.625rem', fontWeight: 700, fontFamily: 'Jost',
                              cursor: 'pointer', flexShrink: 0,
                              '&:hover': { opacity: 0.88 },
                            }}
                          >
                            Accept
                          </Box>
                        )}
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
          </Box>

          {/* NFIU compliance */}
          {cas && currentStatus !== 'closed' && canSeeFullCase && (
            <Box sx={{ bgcolor: '#fffbeb', border: '1px solid #fde68a', p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1.25 }}>
                <GavelOutlinedIcon sx={{ fontSize: '1rem', color: '#d97706', mt: 0.125, flexShrink: 0 }} />
                <Typography sx={{ fontSize: '0.6875rem', color: '#92400e', lineHeight: 1.55 }}>
                  Suspicious transactions must be reported to the <strong>NFIU within 24 hours</strong> per the Terrorism (Prevention &amp; Prohibition) Act 2022.
                </Typography>
              </Box>
              {cas.linkedNfiuReportId ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: '#10b981' }}>
                  <VerifiedRoundedIcon sx={{ fontSize: '0.875rem' }} />
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 700 }}>Report #{cas.linkedNfiuReportId} filed</Typography>
                </Box>
              ) : (
                <Box onClick={openNfiuDialog} sx={{
                  display: 'inline-flex', px: 1.375, py: 0.5, bgcolor: '#d97706', color: '#fff',
                  fontSize: '0.6875rem', fontWeight: 700, fontFamily: 'Jost', cursor: 'pointer',
                  '&:hover': { bgcolor: '#b45309' },
                }}>
                  File STR →
                </Box>
              )}
            </Box>
          )}

          {/* Case metadata */}
          <Box sx={{ bgcolor: 'var(--card-bg)', border: '1px solid var(--border-col)' }}>
            <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid var(--border-col)' }}>
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Metadata</Typography>
            </Box>
            <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
              <SidebarMetaRow label="Opened" value={cas?.createdAt ? fmtDate(cas.createdAt) : '—'} />
              <SidebarMetaRow label="Last updated" value={cas?.updatedAt ? fmtDate(cas.updatedAt) : '—'} />
              {cas?.closedAt && <SidebarMetaRow label="Closed" value={fmtDate(cas.closedAt)} />}
              <SidebarMetaRow label="SLA deadline" value={cas?.slaDeadline ? fmtDate(cas.slaDeadline) : '—'} />
              {cas?.resolution && <SidebarMetaRow label="Resolution" value={cas.resolution.replace(/_/g, ' ')} />}
            </Box>
          </Box>

        </Box>
      </Box>

      {/* ── Dialogs ───────────────────────────────────────────────────────────── */}
      {evidenceTarget && (
        <ActionEvidenceDialog
          open
          onClose={() => setEvidenceTarget(null)}
          onConfirm={handleEvidenceConfirm}
          title="Case Action"
          actionLabel={evidenceTarget.label}
          actionColor={evidenceTarget.color}
          allowSkipDocument={!!evidenceTarget.skipDoc || evidenceTarget.status === 'closed'}
        />
      )}

      <FileReportDialog
        open={nfiuOpen}
        onClose={() => setNfiuOpen(false)}
        onFiled={(r: NfiuReport) => {
          setNfiuOpen(false)
          if (cas && r.id) {
            caseApi.linkNfiuReport(cas.id, r.id).catch(() => {})
            setActionSuccess('NFIU STR/SAR report filed and linked to this case.')
            loadDetail().catch(() => {})
          }
        }}
        defaultType="STR"
        prefill={nfiuPrefill}
        prefillLocked={!!nfiuPrefill}
      />

      {cas && assignOpen && (
        <AssignCaseModal
          caseId={cas.id}
          open={assignOpen}
          interests={caseInterests}
          onClose={() => setAssignOpen(false)}
          onSelect={member => {
            setAssignOpen(false)
            setPendingAssignee(member)
            setTotpOpen(true)
          }}
        />
      )}

      {cas && totpOpen && pendingAssignee && (
        <TOTPConfirmation
          open
          title="Confirm Case Assignment"
          description={`You are assigning case ${cas.id} to ${pendingAssignee.name}. Verify your identity to proceed.`}
          operation="update"
          resourceType="Case"
          resourceName={`${cas.id} → ${pendingAssignee.name}`}
          onConfirm={async () => {
            setTotpOpen(false)
            try {
              await caseApi.assignCase(cas.id, pendingAssignee.id)
              setActionSuccess(`Case assigned to ${pendingAssignee.name}.`)
              loadDetail()
            } catch { /* ignore */ } finally {
              setPendingAssignee(null)
            }
          }}
          onClose={() => { setTotpOpen(false); setPendingAssignee(null) }}
        />
      )}
    </Box>
  )
}

// ── Small helper components ────────────────────────────────────────────────────

function ClosePickerMenu({ onSelect, onClose }: {
  onSelect: (key: CaseResolution, label: string, color: string) => void
  onClose: () => void
}) {
  return (
    <Box sx={{ position: 'absolute', top: '110%', left: 0, bgcolor: 'var(--card-bg)', zIndex: 10, border: '1px solid var(--border-col)', boxShadow: '0 8px 24px rgba(15,23,42,0.12)', width: 260 }}>
      <Typography sx={{ px: 1.5, pt: 1.25, pb: 0.75, fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        Resolution
      </Typography>
      {RESOLUTION_OPTIONS.map(r => (
        <Box key={r.key} onClick={() => { onClose(); onSelect(r.key, r.label, r.color) }}
          sx={{ px: 1.5, py: 0.875, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1, '&:hover': { bgcolor: 'var(--section-bg)' } }}>
          <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: r.color, flexShrink: 0 }} />
          <Box>
            <Typography sx={{ fontSize: '0.8125rem', color: 'var(--heading-color)', fontFamily: 'Jost', fontWeight: 600 }}>{r.label}</Typography>
            {r.key === 'referred' && <Typography sx={{ fontSize: '0.625rem', color: '#f59e0b' }}>Customer will be watchlisted</Typography>}
          </Box>
        </Box>
      ))}
    </Box>
  )
}

function MetaRow({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  return (
    <Box>
      <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.25 }}>{label}</Typography>
      <Typography sx={{ fontSize: '0.8125rem', color: highlight ?? '#00288e', fontFamily: 'Jost', fontWeight: highlight ? 700 : 500 }}>{value}</Typography>
    </Box>
  )
}

function SidebarMetaRow({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '96px 1fr', gap: 1 }}>
      <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', fontWeight: 600 }}>{label}</Typography>
      <Typography sx={{ fontSize: '0.6875rem', color: 'var(--on-surface-variant)' }}>{value}</Typography>
    </Box>
  )
}
