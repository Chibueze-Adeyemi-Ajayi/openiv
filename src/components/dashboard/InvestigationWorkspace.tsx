import { useState, useEffect, useCallback, useRef } from 'react'
import { Box, Typography, Stack, InputBase, Button } from '@mui/material'
import { colorPalette } from '@/theme'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import {
  caseApi,
  type Case, type CaseDetail, type CaseStatus, type CaseResolution,
  type EvidenceCategory, type AddEvidenceInput,
} from '@/api/cases'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import TOTPConfirmation, { type TOTPOperation } from '@/components/dashboard/TOTPConfirmation'
import ActionEvidenceDialog, { type EvidencePayload } from '@/components/dashboard/ActionEvidenceDialog'

interface Props {
  caseId: string | null
  open: boolean
  onClose: () => void
  onUpdated?: () => void
}

const STATUS_CFG: Record<string, { color: string; bg: string; label: string }> = {
  open:          { color: '#f59e0b',           bg: '#fffbeb',                             label: 'Open'          },
  investigating: { color: colorPalette.primary, bg: `${colorPalette.primary}0f`,          label: 'Investigating' },
  escalated:     { color: '#dc2626',           bg: '#fef2f2',                             label: 'Escalated'     },
  closed:        { color: '#94a3b8',           bg: '#f1f5f9',                             label: 'Closed'        },
}

const PRIORITY_CFG: Record<string, { color: string; label: string }> = {
  low:      { color: '#64748b', label: 'Low'      },
  medium:   { color: '#f59e0b', label: 'Medium'   },
  high:     { color: '#ea580c', label: 'High'     },
  critical: { color: '#dc2626', label: 'Critical' },
}

const CATEGORY_CFG: Record<EvidenceCategory, { label: string; color: string; bg: string; icon: string }> = {
  transaction: { label: 'Transaction',     color: '#1d4ed8', bg: '#eff6ff', icon: '💳' },
  kyc:         { label: 'KYC',             color: '#0891b2', bg: '#ecfeff', icon: '🪪' },
  behavior:    { label: 'Behavior',        color: '#7c3aed', bg: '#f5f3ff', icon: '📊' },
  device:      { label: 'Device / IP',     color: '#b45309', bg: '#fefce8', icon: '💻' },
  otp:         { label: 'OTP / Fingerprint', color: '#be123c', bg: '#fff1f2', icon: '🔐' },
  document:    { label: 'Document',        color: '#475569', bg: '#f8fafc', icon: '📄' },
  other:       { label: 'Other',           color: '#64748b', bg: '#f8fafc', icon: '📝' },
}

const EVIDENCE_CATEGORIES = Object.entries(CATEGORY_CFG) as [EvidenceCategory, typeof CATEGORY_CFG[EvidenceCategory]][]

const ACTION_LABELS: Record<string, string> = {
  opened:             'Case opened',
  status_changed:     'Status updated',
  note_added:         'Note added',
  transaction_linked: 'Transaction linked',
  assigned:           'Case assigned',
  closed:             'Case closed',
  evidence_added:     'Evidence added',
}

const RESOLUTION_OPTIONS: { key: CaseResolution; label: string; color: string }[] = [
  { key: 'cleared',   label: 'Cleared — false positive',     color: '#10b981' },
  { key: 'sar_filed', label: 'SAR / STR filed',              color: '#f59e0b' },
  { key: 'referred',  label: 'Referred to law enforcement',  color: '#dc2626' },
]

function slaInfo(deadline: string, status: CaseStatus) {
  if (status === 'closed') return { label: 'Closed', color: '#94a3b8', pct: 100 }
  const diff = new Date(deadline).getTime() - Date.now()
  if (diff <= 0) return { label: 'Overdue', color: '#dc2626', pct: 0 }
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  return {
    label: h > 0 ? `${h}h ${m}m left` : `${m}m left`,
    color: h < 2 ? '#dc2626' : h < 12 ? '#f59e0b' : '#10b981',
    pct: Math.min(100, Math.round((diff / 86_400_000) * 100)),
  }
}

function fmtDate(iso?: string | null) {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('en-NG', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso))
  } catch { return iso }
}

function initials(name?: string) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

const AVATAR_COLORS = ['#1e40af', '#0891b2', '#7c3aed', '#be123c', '#b45309', '#065f46']

function Avatar({ name, size = 26 }: { name?: string; size?: number }) {
  const idx = (name?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length
  return (
    <Box sx={{ width: size, height: size, borderRadius: '50%', bgcolor: AVATAR_COLORS[idx], display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Typography sx={{ fontSize: size * 0.36, fontWeight: 700, color: '#fff', lineHeight: 1 }}>{initials(name)}</Typography>
    </Box>
  )
}

type PendingAction =
  | { type: 'status'; to: CaseStatus; resolution?: CaseResolution }
  | { type: 'assign' }
  | { type: 'sar' }
  | { type: 'freeze' }

function actionTotp(a: PendingAction, caseId: string): { operation: TOTPOperation; title: string; description: string; resourceName: string } {
  switch (a.type) {
    case 'status':
      if (a.to === 'closed') return {
        operation: 'delete',
        title: 'Close Investigation Case',
        description: `Closing with resolution "${a.resolution?.replace(/_/g, ' ') ?? ''}" creates an immutable final audit entry under CBN AML records. This cannot be reversed.`,
        resourceName: caseId,
      }
      if (a.to === 'investigating') return {
        operation: 'update',
        title: 'Start Investigation',
        description: 'Formally opens an active investigation, activates SLA tracking, and notifies the assigned analyst.',
        resourceName: caseId,
      }
      return {
        operation: 'update',
        title: 'Escalate Case',
        description: 'Escalating flags this case for senior AML review and triggers compliance team notifications.',
        resourceName: caseId,
      }
    case 'assign':
      return {
        operation: 'create',
        title: 'Assign Case to Yourself',
        description: 'You will be recorded as the responsible investigator. This is logged permanently in the case audit trail.',
        resourceName: caseId,
      }
    case 'sar':
      return {
        operation: 'delete',
        title: 'Flag for SAR / STR Filing',
        description: 'Creates an immutable record of Suspicious Activity Report intent under CBN AML guidelines. Once set, this cannot be undone.',
        resourceName: caseId,
      }
    case 'freeze':
      return {
        operation: 'delete',
        title: 'Request Account Freeze',
        description: 'A freeze request will be logged and routed immediately to the Compliance desk for action. Confirm your identity.',
        resourceName: caseId,
      }
  }
}

export default function InvestigationWorkspace({ caseId, open, onClose, onUpdated }: Props) {
  const [data,          setData]          = useState<CaseDetail | null>(null)
  const [loading,       setLoading]       = useState(false)
  const [activeTab,     setActiveTab]     = useState<'evidence' | 'timeline'>('evidence')
  const [localStatus,   setLocalStatus]   = useState<CaseStatus | null>(null)
  const [actioning,     setActioning]     = useState(false)
  const [addEvOpen,     setAddEvOpen]     = useState(false)
  const [evCategory,    setEvCategory]    = useState<EvidenceCategory>('transaction')
  const [evTitle,       setEvTitle]       = useState('')
  const [evDetail,      setEvDetail]      = useState('')
  const [evRefId,       setEvRefId]       = useState('')
  const [submittingEv,  setSubmittingEv]  = useState(false)

  const [note,          setNote]          = useState('')
  const [submittingNote, setSubmittingNote] = useState(false)

  const [mainTab,      setMainTab]      = useState<'details' | 'evidence' | 'timeline'>('details')
  const [evidenceOpen,     setEvidenceOpen]     = useState(false)
  const [totpOpen,         setTotpOpen]         = useState(false)
  const [closeSideOpen,    setCloseSideOpen]    = useState(false)
  const pendingRef   = useRef<PendingAction | null>(null)
  const pendingEvRef = useRef<EvidencePayload | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const cas: Case | null = data?.case ?? null
  const currentStatus = (localStatus ?? cas?.status ?? null) as CaseStatus | null

  const loadDetail = useCallback(async () => {
    if (!caseId) return
    setLoading(true)
    try {
      setData(await caseApi.detail(caseId))
      setLocalStatus(null)
    } finally { setLoading(false) }
  }, [caseId])

  // State persistence: save and restore scroll position and tab selection
  useEffect(() => {
    if (!open && caseId) {
      // Save state when closing
      const state = { mainTab, scrollPos: scrollRef.current?.scrollTop ?? 0 }
      sessionStorage.setItem(`case-workspace-${caseId}`, JSON.stringify(state))
    }
  }, [open, caseId, mainTab])

  useEffect(() => {
    if (open && caseId) {
      setData(null)
      setNote('')
      setAddEvOpen(false)
      setCloseSideOpen(false)
      setActiveTab('evidence')

      // Restore saved state
      const saved = sessionStorage.getItem(`case-workspace-${caseId}`)
      if (saved) {
        try {
          const { mainTab: savedTab } = JSON.parse(saved)
          setMainTab(savedTab ?? 'details')
        } catch {}
      } else {
        setMainTab('details')
      }

      loadDetail()

      // Restore scroll position after content loads
      if (scrollRef.current) {
        setTimeout(() => {
          const saved = sessionStorage.getItem(`case-workspace-${caseId}`)
          if (saved) {
            try {
              const { scrollPos } = JSON.parse(saved)
              scrollRef.current!.scrollTop = scrollPos
            } catch {}
          }
        }, 50)
      }
    }
  }, [open, caseId, loadDetail])

  const triggerAction = useCallback((action: PendingAction) => {
    pendingRef.current = action
    setCloseSideOpen(false)
    // Status changes require a reason + document before TOTP
    if (action.type === 'status') {
      setEvidenceOpen(true)
    } else {
      setTotpOpen(true)
    }
  }, [])

  const handleEvidenceConfirm = useCallback((ev: EvidencePayload) => {
    pendingEvRef.current = ev
    setEvidenceOpen(false)
    setTotpOpen(true)
  }, [])

  const afterTotpConfirmed = useCallback(async () => {
    const action = pendingRef.current
    if (!action || !cas) return
    setTotpOpen(false)
    setActioning(true)
    try {
      if (action.type === 'status') {
        const ev = pendingEvRef.current
        if (!ev) return
        await caseApi.updateStatus(cas.id, action.to, action.resolution, ev.reason, ev.documentId)
        pendingEvRef.current = null
        setLocalStatus(action.to)
        onUpdated?.()
      } else {
        const note =
          action.type === 'assign'  ? '[ASSIGNED] Case self-assigned — investigator formally on record'
        : action.type === 'sar'    ? '[SAR/STR] Case flagged for Suspicious Activity Report — pending compliance review'
        :                            '[FREEZE] Account freeze requested — routed to Compliance for immediate action'
        await caseApi.addNote(cas.id, note)
      }
      await loadDetail()
    } finally {
      setActioning(false)
    }
  }, [cas, onUpdated, loadDetail])

  const submitEvidence = useCallback(async () => {
    if (!cas || !evTitle.trim() || submittingEv) return
    setSubmittingEv(true)
    try {
      const ev: AddEvidenceInput = {
        category: evCategory,
        title: evTitle.trim(),
        detail: evDetail.trim() || undefined,
        refId: evRefId.trim() || undefined,
      }
      await caseApi.addEvidence(cas.id, ev)
      setEvTitle(''); setEvDetail(''); setEvRefId('')
      setAddEvOpen(false)
      await loadDetail()
    } finally { setSubmittingEv(false) }
  }, [cas, evCategory, evTitle, evDetail, evRefId, submittingEv, loadDetail])

  const submitNote = useCallback(async () => {
    if (!cas || !note.trim() || submittingNote) return
    setSubmittingNote(true)
    try {
      await caseApi.addNote(cas.id, note.trim())
      setNote('')
      await loadDetail()
    } finally { setSubmittingNote(false) }
  }, [cas, note, submittingNote, loadDetail])

  if (!open) return null

  const sCfg  = currentStatus ? STATUS_CFG[currentStatus] : STATUS_CFG.open
  const pCfg  = cas ? PRIORITY_CFG[cas.priority] : PRIORITY_CFG.medium
  const sla   = cas ? slaInfo(cas.slaDeadline, currentStatus ?? cas.status) : null
  const evCount  = data?.evidence.length ?? 0
  const actCount = data?.activity.length ?? 0

  return (
    <Box sx={{ position: 'fixed', inset: 0, zIndex: 1300, display: 'flex', flexDirection: 'column', bgcolor: '#f1f5f9' }}>

      {/* ── Header bar ─────────────────────────────────────────────────────── */}
      <Box sx={{ flexShrink: 0, bgcolor: '#ffffff', borderBottom: '1px solid #eef0f4', display: 'flex', alignItems: 'center', gap: 2, px: 3, height: 56 }}>

        {/* Back button */}
        <Box onClick={onClose} sx={{
          display: 'flex', alignItems: 'center', gap: 0.75, cursor: 'pointer',
          color: '#64748b', flexShrink: 0, transition: 'color 0.15s',
          '&:hover': { color: colorPalette.primary },
        }}>
          <ArrowBackRoundedIcon sx={{ fontSize: '1.125rem' }} />
          <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Jost' }}>
            AML &amp; Cases
          </Typography>
        </Box>

        {/* Case ID + title */}
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.25, minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: colorPalette.primary, fontFamily: 'SF Mono, Monaco, monospace', flexShrink: 0 }}>
            {loading ? '—' : (cas?.id ?? '—')}
          </Typography>
          <Typography sx={{ fontSize: '0.875rem', color: '#475569', fontFamily: 'Jost', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {cas?.title ?? ''}
          </Typography>
        </Box>

        {/* Close X */}
        <Box onClick={onClose} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, cursor: 'pointer', color: '#94a3b8', flexShrink: 0, transition: 'color 0.15s', '&:hover': { color: '#0f172a' } }}>
          <CloseRoundedIcon sx={{ fontSize: '1.125rem' }} />
        </Box>
      </Box>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Left sidebar */}
        <Box sx={{ width: 284, flexShrink: 0, bgcolor: '#ffffff', borderRight: '1px solid #eef0f4', overflowY: 'auto', p: 2.5 }}>

          {loading ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              {[100, 160, 80, 120, 160].map((w, i) => (
                <Box key={i} sx={{ height: 10, width: `${w}px`, bgcolor: '#f1f5f9', borderRadius: 0.5, animation: 'pulse 1.5s ease-in-out infinite', '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } } }} />
              ))}
            </Box>
          ) : cas ? (
            <>
              {/* Risk score */}
              <Box sx={{ mb: 2.5, p: 1.5, border: '1px solid #eef0f4', bgcolor: cas.riskScore >= 70 ? '#fef2f200' : '#fafbfc' }}>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.875, mb: 0.875 }}>
                  <Typography sx={{ fontSize: '2rem', fontWeight: 800, color: cas.riskScore >= 70 ? '#dc2626' : cas.riskScore >= 40 ? '#f59e0b' : '#10b981', fontFamily: 'Jost', lineHeight: 1 }}>
                    {cas.riskScore}
                  </Typography>
                  <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: cas.riskScore >= 70 ? '#dc2626' : cas.riskScore >= 40 ? '#f59e0b' : '#10b981', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    {cas.riskScore >= 70 ? 'HIGH' : cas.riskScore >= 40 ? 'MEDIUM' : 'LOW'} RISK
                  </Typography>
                  <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', ml: 'auto' }}>/100</Typography>
                </Box>
                <Box sx={{ height: 5, bgcolor: '#f1f5f9', position: 'relative' }}>
                  <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${cas.riskScore}%`, bgcolor: cas.riskScore >= 70 ? '#dc2626' : cas.riskScore >= 40 ? '#f59e0b' : '#10b981', transition: 'width 0.5s ease' }} />
                </Box>
              </Box>

              {/* SLA bar */}
              {sla && currentStatus !== 'closed' && (
                <Box sx={{ mb: 2.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <SideLabel>SLA Deadline</SideLabel>
                    <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: sla.color }}>{sla.label}</Typography>
                  </Box>
                  <Box sx={{ height: 4, bgcolor: '#f1f5f9', position: 'relative' }}>
                    <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${sla.pct}%`, bgcolor: sla.color }} />
                  </Box>
                  <Typography sx={{ fontSize: '0.625rem', color: '#94a3b8', mt: 0.5 }}>
                    Due {fmtDate(cas.slaDeadline)}
                  </Typography>
                </Box>
              )}

              {/* Actions */}
              {currentStatus !== 'closed' && (
                <Box sx={{ mb: 2.5 }}>
                  <SideLabel>Actions</SideLabel>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.625 }}>
                    {currentStatus === 'open' && (
                      <SideActionBtn label="Start Investigation" color={colorPalette.primary} disabled={actioning}
                        onClick={() => triggerAction({ type: 'status', to: 'investigating' })} />
                    )}
                    {currentStatus === 'investigating' && (
                      <SideActionBtn label="Escalate Case" color="#f59e0b" disabled={actioning}
                        onClick={() => triggerAction({ type: 'status', to: 'escalated' })} />
                    )}
                    <SideActionBtn label="Assign to Me" color="#475569" disabled={actioning}
                      onClick={() => triggerAction({ type: 'assign' })} />
                    <SideActionBtn label="Flag SAR / STR" color="#7c3aed" disabled={actioning}
                      onClick={() => triggerAction({ type: 'sar' })} />
                    <SideActionBtn label="Request Account Freeze" color="#dc2626" disabled={actioning}
                      onClick={() => triggerAction({ type: 'freeze' })} />
                    <Box sx={{ position: 'relative' }}>
                      <SideActionBtn label="Close Case ▾" color="#64748b" disabled={actioning}
                        onClick={() => setCloseSideOpen(v => !v)} />
                      {closeSideOpen && (
                        <Box sx={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, bgcolor: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 12px 36px rgba(15,23,42,0.14)', zIndex: 10 }}>
                          <Typography sx={{ px: 1.5, pt: 1.25, pb: 0.75, fontSize: '0.5625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                            Select Resolution
                          </Typography>
                          {RESOLUTION_OPTIONS.map(r => (
                            <Box key={r.key} onClick={() => { setCloseSideOpen(false); triggerAction({ type: 'status', to: 'closed', resolution: r.key }) }} sx={{ px: 1.5, py: 0.875, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1, '&:hover': { bgcolor: '#f8fafc' } }}>
                              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: r.color, flexShrink: 0 }} />
                              <Typography sx={{ fontSize: '0.8125rem', color: '#0f172a', fontFamily: 'Jost' }}>{r.label}</Typography>
                            </Box>
                          ))}
                        </Box>
                      )}
                    </Box>
                  </Box>
                </Box>
              )}

              {/* Case fields */}
              <Box sx={{ mb: 2.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
                <SideLabel>Case Details</SideLabel>
                <SideField label="Typology"  value={cas.typology} />
                <SideField label="Priority"  value={pCfg.label} valueColor={pCfg.color} />
                {cas.assigneeName && <SideField label="Analyst" value={cas.assigneeName} />}
                <SideField label="Opened by" value={cas.createdByName} />
                <SideField label="Opened"    value={fmtDate(cas.createdAt)} />
                {cas.closedAt && <SideField label="Closed" value={fmtDate(cas.closedAt)} />}
                {cas.resolution && (
                  <SideField label="Resolution" value={cas.resolution.replace('_', ' ')} />
                )}
              </Box>

              {/* Notes */}
              {cas.notes && (
                <Box sx={{ mb: 2.5 }}>
                  <SideLabel>Case Notes</SideLabel>
                  <Box sx={{ mt: 0.75, p: 1.25, bgcolor: '#f8fafc', border: '1px solid #eef0f4' }}>
                    <Typography sx={{ fontSize: '0.8125rem', color: '#475569', fontFamily: 'Jost', lineHeight: 1.5 }}>
                      {cas.notes}
                    </Typography>
                  </Box>
                </Box>
              )}

              {/* Linked transactions */}
              <Box>
                <SideLabel>Linked Transactions ({data?.transactions.length ?? 0})</SideLabel>
                <Box sx={{ mt: 0.75, border: '1px solid #eef0f4' }}>
                  {!data?.transactions.length ? (
                    <Box sx={{ p: 1.5, textAlign: 'center' }}>
                      <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>None linked</Typography>
                    </Box>
                  ) : data!.transactions.map((t, i) => (
                    <Box key={t.id} sx={{ px: 1.25, py: 1, borderBottom: i < data!.transactions.length - 1 ? '1px solid #f4f5f7' : 'none' }}>
                      <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: colorPalette.primary, fontFamily: 'SF Mono, Monaco, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.id}
                      </Typography>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.25 }}>
                        <Typography sx={{ fontSize: '0.6875rem', color: '#64748b' }}>{t.customer}</Typography>
                        <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#0f172a', fontFamily: 'SF Mono, Monaco, monospace' }}>
                          {t.amount.toLocaleString()}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Box>
            </>
          ) : null}
        </Box>

        {/* Right: tabbed content */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Tab bar */}
          <Box sx={{ flexShrink: 0, bgcolor: '#ffffff', borderBottom: '1px solid #eef0f4', display: 'flex', alignItems: 'center', px: 3 }}>
            {([['details', 'Details & Notes', '📋'], ['evidence', `Evidence (${evCount})`, '🔍'], ['timeline', `Timeline (${actCount})`, '⏱']] as const).map(([tab, label, icon]) => (
              <Box key={tab} onClick={() => setMainTab(tab)} sx={{
                display: 'flex', alignItems: 'center', gap: 0.75, px: 0.25, py: 1.5, mr: 3,
                cursor: 'pointer', borderBottom: '2px solid',
                borderBottomColor: mainTab === tab ? colorPalette.primary : 'transparent',
                color: mainTab === tab ? colorPalette.primary : '#64748b',
                transition: 'all 0.15s',
              }}>
                <Typography sx={{ fontSize: '0.875rem', lineHeight: 1 }}>{icon}</Typography>
                <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, fontFamily: 'Jost' }}>{label}</Typography>
              </Box>
            ))}
          </Box>

          {/* ── Details & Notes tab ───────────────────────────────────── */}
          {mainTab === 'details' && (
            <Box ref={scrollRef} sx={{ flex: 1, overflowY: 'auto', p: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              {loading ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                  {[100, 160, 80, 120, 160].map((w, i) => (
                    <Box key={i} sx={{ height: 10, width: `${w}px`, bgcolor: '#f1f5f9', borderRadius: 0.5, animation: 'pulse 1.5s ease-in-out infinite', '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } } }} />
                  ))}
                </Box>
              ) : cas ? (
                <>
                  {/* Brief summary */}
                  {cas.brief && (
                    <Box sx={{ p: 2, bgcolor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 0.5 }}>
                      <Typography sx={{ fontSize: '0.875rem', color: '#0369a1', lineHeight: 1.6, fontWeight: 500, fontFamily: 'Jost' }}>
                        {cas.brief}
                      </Typography>
                    </Box>
                  )}

                  {/* Risk score */}
                  <Box sx={{ p: 1.5, border: '1px solid #eef0f4', bgcolor: cas.riskScore >= 70 ? '#fef2f200' : '#fafbfc' }}>
                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.875, mb: 0.875 }}>
                      <Typography sx={{ fontSize: '2rem', fontWeight: 800, color: cas.riskScore >= 70 ? '#dc2626' : cas.riskScore >= 40 ? '#f59e0b' : '#10b981', fontFamily: 'Jost', lineHeight: 1 }}>
                        {cas.riskScore}
                      </Typography>
                      <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: cas.riskScore >= 70 ? '#dc2626' : cas.riskScore >= 40 ? '#f59e0b' : '#10b981', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                        {cas.riskScore >= 70 ? 'HIGH' : cas.riskScore >= 40 ? 'MEDIUM' : 'LOW'} RISK
                      </Typography>
                      <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', ml: 'auto' }}>/100</Typography>
                    </Box>
                    <Box sx={{ height: 5, bgcolor: '#f1f5f9', position: 'relative' }}>
                      <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${cas.riskScore}%`, bgcolor: cas.riskScore >= 70 ? '#dc2626' : cas.riskScore >= 40 ? '#f59e0b' : '#10b981', transition: 'width 0.5s ease' }} />
                    </Box>
                  </Box>

                  {/* Details */}
                  <Box sx={{ border: '1px solid #eef0f4', p: 1.5 }}>
                    <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.14em', mb: 1 }}>
                      Case Details
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <DetailField label="Typology"  value={cas.typology} />
                      <DetailField label="Priority"  value={PRIORITY_CFG[cas.priority]?.label ?? cas.priority} valueColor={PRIORITY_CFG[cas.priority]?.color} />
                      {cas.assigneeName && <DetailField label="Analyst" value={cas.assigneeName} />}
                      <DetailField label="Opened by" value={cas.createdByName} />
                      <DetailField label="Opened"    value={fmtDate(cas.createdAt)} />
                      {cas.closedAt && <DetailField label="Closed" value={fmtDate(cas.closedAt)} />}
                      {cas.resolution && <DetailField label="Resolution" value={cas.resolution.replace('_', ' ')} />}
                    </Box>
                  </Box>

                  {/* Notes - Parse and display in sections */}
                  {cas.notes && <CaseNotesSection notes={cas.notes} customerId={cas.id} />}

                  {/* Linked Transactions */}
                  <Box>
                    <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.14em', mb: 1 }}>
                      Linked Transactions ({data?.transactions.length ?? 0})
                    </Typography>
                    <Box sx={{ border: '1px solid #eef0f4' }}>
                      {!data?.transactions.length ? (
                        <Box sx={{ p: 1.5, textAlign: 'center' }}>
                          <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>None linked</Typography>
                        </Box>
                      ) : data!.transactions.map((t, i) => (
                        <Box key={t.id} sx={{ px: 1.25, py: 1, borderBottom: i < data!.transactions.length - 1 ? '1px solid #f4f5f7' : 'none' }}>
                          <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: colorPalette.primary, fontFamily: 'SF Mono, Monaco, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {t.id}
                          </Typography>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.25 }}>
                            <Typography sx={{ fontSize: '0.6875rem', color: '#64748b' }}>{t.customer}</Typography>
                            <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#0f172a', fontFamily: 'SF Mono, Monaco, monospace' }}>
                              {t.amount.toLocaleString()}
                            </Typography>
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                </>
              ) : null}
            </Box>
          )}

          {/* ── Evidence tab ──────────────────────────────────────────── */}
          {mainTab === 'evidence' && (
            <Box sx={{ flex: 1, overflowY: 'auto', p: 3 }}>

              {/* Add evidence button / form */}
              {cas && currentStatus !== 'closed' && (
                <Box sx={{ mb: 2.5 }}>
                  {!addEvOpen ? (
                    <Box onClick={() => setAddEvOpen(true)} sx={{
                      display: 'flex', alignItems: 'center', gap: 1,
                      px: 1.75, py: 1, border: '1px dashed #cbd5e1', cursor: 'pointer',
                      color: '#64748b', transition: 'all 0.15s',
                      '&:hover': { borderColor: colorPalette.primary, color: colorPalette.primary, bgcolor: `${colorPalette.primary}06` },
                    }}>
                      <AddRoundedIcon sx={{ fontSize: '1rem' }} />
                      <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, fontFamily: 'Jost' }}>Add Evidence</Typography>
                    </Box>
                  ) : (
                    <Box sx={{ border: '1px solid #e2e8f0', bgcolor: '#ffffff', p: 2 }}>
                      <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 1.25 }}>
                        New Evidence
                      </Typography>

                      {/* Category chips */}
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
                        {EVIDENCE_CATEGORIES.map(([cat, cfg]) => {
                          const on = evCategory === cat
                          return (
                            <Box key={cat} onClick={() => setEvCategory(cat)} sx={{
                              display: 'flex', alignItems: 'center', gap: 0.5,
                              px: 1, py: 0.375, cursor: 'pointer', border: '1px solid',
                              borderColor: on ? cfg.color : '#e2e8f0',
                              bgcolor:     on ? cfg.bg    : 'transparent',
                              transition: 'all 0.12s',
                            }}>
                              <Typography sx={{ fontSize: '0.75rem', lineHeight: 1 }}>{cfg.icon}</Typography>
                              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: on ? cfg.color : '#64748b', fontFamily: 'Jost' }}>
                                {cfg.label}
                              </Typography>
                            </Box>
                          )
                        })}
                      </Box>

                      {/* Form fields */}
                      <Stack gap={1}>
                        <Box>
                          <MiniLabel>Title *</MiniLabel>
                          <Box sx={{ border: '1px solid #e2e8f0', px: 1.25, py: 0.75, '&:focus-within': { borderColor: colorPalette.primary } }}>
                            <InputBase value={evTitle} onChange={e => setEvTitle(e.target.value)} placeholder="Brief title for this evidence" fullWidth sx={{ fontSize: '0.8125rem', fontFamily: 'Jost' }} />
                          </Box>
                        </Box>
                        <Box>
                          <MiniLabel>Detail</MiniLabel>
                          <Box component="textarea" value={evDetail} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEvDetail(e.target.value)}
                            placeholder="Full description, amounts, context…" rows={2}
                            sx={{ width: '100%', display: 'block', resize: 'none', border: '1px solid #e2e8f0', px: 1.25, py: 0.75, fontSize: '0.8125rem', fontFamily: 'Jost, sans-serif', color: '#0f172a', bgcolor: '#ffffff', outline: 'none', boxSizing: 'border-box', '&:focus': { borderColor: colorPalette.primary }, '&::placeholder': { color: '#94a3b8' } }}
                          />
                        </Box>
                        <Box>
                          <MiniLabel>Reference ID</MiniLabel>
                          <Box sx={{ border: '1px solid #e2e8f0', px: 1.25, py: 0.75, '&:focus-within': { borderColor: colorPalette.primary } }}>
                            <InputBase value={evRefId} onChange={e => setEvRefId(e.target.value)} placeholder="TXN-ID, DOC-REF, AUTH-ID…" fullWidth sx={{ fontSize: '0.8125rem', fontFamily: 'SF Mono, Monaco, monospace' }} />
                          </Box>
                        </Box>
                      </Stack>

                      <Stack direction="row" gap={1} justifyContent="flex-end" mt={1.5}>
                        <Box onClick={() => { setAddEvOpen(false); setEvTitle(''); setEvDetail(''); setEvRefId('') }} sx={{ px: 1.75, py: 0.75, fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Jost', color: '#64748b', border: '1px solid #e2e8f0', cursor: 'pointer', '&:hover': { borderColor: '#94a3b8' } }}>
                          Cancel
                        </Box>
                        <Box onClick={submitEvidence} sx={{
                          px: 1.75, py: 0.75, fontSize: '0.8125rem', fontWeight: 700, fontFamily: 'Jost',
                          color:   evTitle.trim() && !submittingEv ? '#ffffff' : '#94a3b8',
                          bgcolor: evTitle.trim() && !submittingEv ? colorPalette.primary : '#e2e8f0',
                          cursor:  evTitle.trim() && !submittingEv ? 'pointer' : 'not-allowed',
                          display: 'flex', alignItems: 'center', gap: 0.75,
                        }}>
                          {submittingEv ? '…' : <><CheckRoundedIcon sx={{ fontSize: '0.875rem' }} /> Attach Evidence</>}
                        </Box>
                      </Stack>
                    </Box>
                  )}
                </Box>
              )}

              {/* Evidence list */}
              {loading ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                  {[...Array(3)].map((_, i) => (
                    <Box key={i} sx={{ height: 72, bgcolor: '#ffffff', border: '1px solid #eef0f4', animation: 'pulse 1.5s ease-in-out infinite', '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } } }} />
                  ))}
                </Box>
              ) : !data?.evidence.length ? (
                <Box sx={{ textAlign: 'center', py: 5 }}>
                  <Typography sx={{ fontSize: '1.5rem', mb: 1 }}>🔍</Typography>
                  <Typography sx={{ fontSize: '0.9375rem', fontWeight: 600, color: '#64748b', fontFamily: 'Jost', mb: 0.5 }}>No evidence attached</Typography>
                  <Typography sx={{ fontSize: '0.8125rem', color: '#94a3b8' }}>Use the button above to add the first piece of evidence</Typography>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                  {data!.evidence.map(ev => {
                    const cfg = CATEGORY_CFG[ev.category as EvidenceCategory] ?? CATEGORY_CFG.other
                    return (
                      <Box key={ev.id} sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', p: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25 }}>
                          {/* Category badge */}
                          <Box sx={{ px: 1, py: 0.375, bgcolor: cfg.bg, border: `1px solid ${cfg.color}30`, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Typography sx={{ fontSize: '0.75rem', lineHeight: 1 }}>{cfg.icon}</Typography>
                            <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: cfg.color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                              {cfg.label}
                            </Typography>
                          </Box>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost', mb: 0.25 }}>
                              {ev.title}
                            </Typography>
                            {ev.detail && (
                              <Typography sx={{ fontSize: '0.8125rem', color: '#475569', lineHeight: 1.5, whiteSpace: 'pre-line', mb: 0.5 }}>
                                {ev.detail}
                              </Typography>
                            )}
                            {ev.refId && (
                              <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', fontFamily: 'SF Mono, Monaco, monospace' }}>
                                ref: {ev.refId}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.25, pt: 1, borderTop: '1px solid #f4f5f7' }}>
                          <Avatar name={ev.addedByName} size={18} />
                          <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8' }}>
                            {ev.addedByName} · {fmtDate(ev.createdAt)}
                          </Typography>
                        </Box>
                      </Box>
                    )
                  })}
                </Box>
              )}
            </Box>
          )}

          {/* ── Timeline tab ──────────────────────────────────────────── */}
          {mainTab === 'timeline' && (
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <Box sx={{ flex: 1, overflowY: 'auto', p: 3 }}>
                {loading ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {[...Array(4)].map((_, i) => (
                      <Box key={i} sx={{ height: 48, bgcolor: '#ffffff', border: '1px solid #eef0f4', animation: 'pulse 1.5s ease-in-out infinite', '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } } }} />
                    ))}
                  </Box>
                ) : !data?.activity.length ? (
                  <Box sx={{ textAlign: 'center', py: 5 }}>
                    <Typography sx={{ fontSize: '0.9375rem', fontWeight: 600, color: '#64748b', fontFamily: 'Jost' }}>No activity yet</Typography>
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {data!.activity.map((a, i) => (
                      <Box key={a.id} sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', p: 1.75 }}>
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25 }}>
                          <Avatar name={a.actorName} size={28} />
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, flexWrap: 'wrap', mb: 0.25 }}>
                              <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
                                {a.actorName}
                              </Typography>
                              <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>
                                {ACTION_LABELS[a.action] ?? a.action}
                              </Typography>
                              <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', ml: 'auto', flexShrink: 0 }}>
                                {fmtDate(a.createdAt)}
                              </Typography>
                            </Box>
                            {a.detail && (
                              <Typography sx={{ fontSize: '0.8125rem', color: '#475569', lineHeight: 1.6, whiteSpace: 'pre-wrap', mt: 0.375 }}>
                                {a.detail}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>

              {/* Note input */}
              {cas && (
                <Box sx={{ flexShrink: 0, borderTop: '1px solid #eef0f4', bgcolor: '#ffffff', p: 2 }}>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
                    <Box sx={{
                      flex: 1, border: '1px solid #e2e8f0', px: 1.25, py: 0.875, minHeight: 56,
                      '&:focus-within': { borderColor: colorPalette.primary },
                    }}>
                      <InputBase
                        multiline minRows={2}
                        value={note}
                        onChange={e => setNote(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submitNote() }}
                        placeholder="Add a note for the audit trail… (Ctrl+Enter to submit)"
                        sx={{ flex: 1, width: '100%', fontSize: '0.8125rem', fontFamily: 'Jost', color: '#0f172a', '& textarea': { resize: 'none' } }}
                      />
                    </Box>
                    <Box onClick={submitNote} sx={{
                      px: 1.75, py: 0.875, flexShrink: 0,
                      bgcolor: note.trim() && !submittingNote ? colorPalette.primary : '#e2e8f0',
                      color:   note.trim() && !submittingNote ? '#ffffff' : '#94a3b8',
                      cursor:  note.trim() && !submittingNote ? 'pointer' : 'not-allowed',
                      fontSize: '0.8125rem', fontWeight: 700, fontFamily: 'Jost', transition: 'all 0.15s',
                    }}>
                      {submittingNote ? '…' : 'Post'}
                    </Box>
                  </Box>
                </Box>
              )}
            </Box>
          )}
        </Box>
      </Box>

      {/* Evidence + reason gate for status transitions */}
      {cas && evidenceOpen && pendingRef.current?.type === 'status' && (() => {
        const action = pendingRef.current as { type: 'status'; to: CaseStatus; resolution?: CaseResolution }
        const cfg = actionTotp(action, cas.id)
        return (
          <ActionEvidenceDialog
            open
            onClose={() => { setEvidenceOpen(false); pendingRef.current = null }}
            onConfirm={handleEvidenceConfirm}
            title={cfg.title}
            actionLabel={action.to.replace(/_/g, ' ')}
            actionColor={STATUS_CFG[action.to]?.color ?? colorPalette.primary}
          />
        )
      })()}

      {/* TOTP gate for all workspace actions */}
      {cas && (() => {
        const action = pendingRef.current
        if (!action) return null
        const cfg = actionTotp(action, cas.id)
        return (
          <TOTPConfirmation
            open={totpOpen}
            onClose={() => setTotpOpen(false)}
            onConfirm={afterTotpConfirmed}
            operation={cfg.operation}
            title={cfg.title}
            description={cfg.description}
            resourceType="Investigation Case"
            resourceName={cfg.resourceName}
          />
        )
      })()}
    </Box>
  )
}

function HdrBtn({ label, color, disabled, onClick }: { label: string; color: string; disabled: boolean; onClick: () => void }) {
  return (
    <Box onClick={disabled ? undefined : onClick} sx={{
      px: 1.25, py: 0.5,
      bgcolor: `${color}12`,
      color, cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.45 : 1, transition: 'all 0.15s',
      '&:hover': disabled ? {} : { bgcolor: `${color}20` },
    }}>
      <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, fontFamily: 'Jost' }}>{label}</Typography>
    </Box>
  )
}

function SideActionBtn({ label, color, disabled, onClick }: { label: string; color: string; disabled: boolean; onClick: () => void }) {
  return (
    <Box onClick={disabled ? undefined : onClick} sx={{
      display: 'flex', alignItems: 'center', px: 1.25, py: 0.875,
      border: '1px solid', borderColor: `${color}28`,
      bgcolor: `${color}08`,
      color, cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1, transition: 'all 0.15s',
      '&:hover': disabled ? {} : { bgcolor: `${color}14`, borderColor: `${color}50` },
    }}>
      <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, fontFamily: 'Jost', lineHeight: 1 }}>{label}</Typography>
    </Box>
  )
}

function SideLabel({ children }: { children: React.ReactNode }) {
  return <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 0.625 }}>{children}</Typography>
}

function SideField({ label, value, valueColor }: { label: string; value?: string | null; valueColor?: string }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '88px 1fr', gap: 1 }}>
      <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', fontWeight: 600, lineHeight: 1.4 }}>{label}</Typography>
      <Typography sx={{ fontSize: '0.8125rem', color: valueColor ?? '#0f172a', fontFamily: 'Jost', lineHeight: 1.4 }}>{value ?? '—'}</Typography>
    </Box>
  )
}

function MiniLabel({ children }: { children: React.ReactNode }) {
  return <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.625 }}>{children}</Typography>
}

function DetailField({ label, value, valueColor }: { label: string; value?: string | null; valueColor?: string }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 1.5 }}>
      <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', fontWeight: 600, lineHeight: 1.4 }}>{label}</Typography>
      <Typography sx={{ fontSize: '0.8125rem', color: valueColor ?? '#0f172a', fontFamily: 'Jost', lineHeight: 1.4 }}>{value ?? '—'}</Typography>
    </Box>
  )
}

function CaseNotesSection({ notes, customerId }: { notes: string; customerId: string }) {
  const sections = notes.split('\n\n').map(s => s.trim()).filter(s => s.length > 0)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {sections.map((section, idx) => {
        const lines = section.split('\n')
        const header = lines[0]
        const isHeader = header.includes('WHY') || header.includes('WHAT') || header.includes('TRANSACTION') || header.includes('RISK') || header.includes('NEXT')

        if (!isHeader) {
          return (
            <Box key={idx} sx={{ p: 1.5, bgcolor: '#f8fafc', border: '1px solid #eef0f4', borderRadius: 0.5 }}>
              <Typography sx={{ fontSize: '0.8125rem', color: '#475569', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {section}
              </Typography>
            </Box>
          )
        }

        return (
          <Box key={idx}>
            <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 1 }}>
              {header}
            </Typography>

            {header.includes('WHY THIS CASE') && (
              <Box sx={{ p: 1.5, bgcolor: '#fef2f2', border: '1px solid #fecaca', borderRadius: 0.5, mb: 1.5 }}>
                <Typography sx={{ fontSize: '0.875rem', color: '#b91c1c', lineHeight: 1.6, fontWeight: 500 }}>
                  {lines.slice(2).join('\n')}
                </Typography>
              </Box>
            )}

            {header.includes('WHAT OUR SYSTEM DETECTED') && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mb: 1.5 }}>
                {lines.slice(2).map((line, i) => (
                  line.trim() && (
                    <Box key={i} sx={{ p: 1, bgcolor: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 0.5 }}>
                      <Typography sx={{ fontSize: '0.8125rem', color: '#92400e', lineHeight: 1.5 }}>
                        {line.replace('• ', '')}
                      </Typography>
                    </Box>
                  )
                ))}
              </Box>
            )}

            {header.includes('TRANSACTION DETAILS') && (
              <Box sx={{ p: 1.5, bgcolor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 0.5, mb: 1.5 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  {lines.slice(2).map((line, i) => (
                    line.trim() && (
                      <Typography key={i} sx={{ fontSize: '0.8125rem', color: '#15803d', lineHeight: 1.4 }}>
                        {line}
                      </Typography>
                    )
                  ))}
                </Box>
              </Box>
            )}

            {header.includes('RISK LEVEL') && (
              <Box sx={{ p: 1.5, bgcolor: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 0.5, mb: 1.5 }}>
                <Typography sx={{ fontSize: '0.8125rem', color: '#5b21b6', lineHeight: 1.6, fontWeight: 500 }}>
                  {lines.slice(2).join('\n')}
                </Typography>
              </Box>
            )}

            {header.includes('NEXT STEPS') && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {lines.slice(2).map((line, i) => (
                  line.trim() && (
                    <ActionableStep key={i} step={line} customerId={customerId} />
                  )
                ))}
              </Box>
            )}
          </Box>
        )
      })}
    </Box>
  )
}

function ActionableStep({ step, customerId }: { step: string; customerId: string }) {
  const isCustomerStep = step.toLowerCase().includes('profile') || step.toLowerCase().includes('kyc')
  const isHistoryStep = step.toLowerCase().includes('history') || step.toLowerCase().includes('recent')

  return (
    <Box sx={{ p: 1.25, bgcolor: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5 }}>
      <Typography sx={{ fontSize: '0.8125rem', color: '#047857', flex: 1, lineHeight: 1.4 }}>
        {step}
      </Typography>
      {(isCustomerStep || isHistoryStep) && (
        <Button
          size="small"
          endIcon={<OpenInNewRoundedIcon sx={{ fontSize: '0.875rem !important' }} />}
          href={isCustomerStep ? `/dashboard/customers?id=${customerId}` : `/dashboard/transactions?customer=${customerId}`}
          target="_blank"
          rel="noopener noreferrer"
          sx={{
            flexShrink: 0,
            fontSize: '0.75rem',
            fontWeight: 700,
            fontFamily: 'Jost',
            textTransform: 'none',
            color: '#047857',
            borderColor: '#a7f3d0',
            '&:hover': { bgcolor: '#d1fae5' },
          }}
          variant="outlined"
        >
          Go
        </Button>
      )}
    </Box>
  )
}
