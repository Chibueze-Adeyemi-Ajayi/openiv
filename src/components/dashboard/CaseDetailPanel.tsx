import { useState, useEffect, useCallback } from 'react'
import { Box, Typography, Stack, IconButton, InputBase, Tabs, Tab } from '@mui/material'
import ActionEvidenceDialog, { type EvidencePayload } from '@/components/dashboard/ActionEvidenceDialog'
import FileReportDialog, { type ReportPrefill } from '@/components/dashboard/FileReportDialog'
import { colorPalette } from '@/theme'
import { caseApi, type Case, type CaseDetail, type CaseStatus, type CaseResolution } from '@/api/cases'
import { customerApi } from '@/api/customers'
import type { Transaction } from '@/api/transactions'
import type { NfiuReport } from '@/api/nfiu'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined'
import VerifiedRoundedIcon from '@mui/icons-material/VerifiedRounded'
import { useCurrentUser } from '@/hooks/useCurrentUser'

interface Props {
  caseId: string | null
  open: boolean
  onClose: () => void
  onUpdated: () => void
  onTransactionClick?: (txn: Transaction) => void
}

const STATUS_CFG: Record<string, { color: string; bg: string; label: string }> = {
  open:           { color: '#f59e0b',           bg: '#fffbeb',                              label: 'Open'           },
  investigating:  { color: colorPalette.primary, bg: `${colorPalette.primary}0f`,            label: 'Investigating'  },
  pending_review: { color: '#7c3aed',            bg: '#f5f3ff',                              label: 'Pending Review' },
  escalated:      { color: '#dc2626',            bg: '#fef2f2',                              label: 'Escalated'      },
  closed:         { color: '#64748b',            bg: '#f8fafc',                              label: 'Closed'         },
}

const L2_ROLES = new Set(['owner', 'admin', 'compliance', 'cmlco', 'mlro'])

const PRIORITY_CFG: Record<string, { color: string; bg: string; label: string }> = {
  low:      { color: '#64748b', bg: '#f8fafc', label: 'Low'      },
  medium:   { color: '#f59e0b', bg: '#fffbeb', label: 'Medium'   },
  high:     { color: '#ea580c', bg: '#fff7ed', label: 'High'     },
  critical: { color: '#dc2626', bg: '#fef2f2', label: 'Critical' },
}

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

function fmtDate(iso: string) {
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

function Avatar({ name, size = 28 }: { name?: string; size?: number }) {
  const colors = ['#1e40af', '#0891b2', '#7c3aed', '#be123c', '#b45309', '#065f46']
  const idx = (name?.charCodeAt(0) ?? 0) % colors.length
  return (
    <Box sx={{
      width: size, height: size, borderRadius: '50%', bgcolor: colors[idx],
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <Typography sx={{ fontSize: size * 0.35, fontWeight: 700, color: '#fff', lineHeight: 1 }}>
        {initials(name)}
      </Typography>
    </Box>
  )
}

const RESOLUTION_OPTIONS: { key: CaseResolution; label: string; color: string }[] = [
  { key: 'cleared',  label: 'Cleared — false positive',     color: '#10b981' },
  { key: 'referred', label: 'Referred to law enforcement',  color: '#dc2626' },
]

// Dismissed transaction IDs are stored per-session in sessionStorage
const SESSION_KEY = 'dismissed_case_txns'
function getDismissed(): Set<string> {
  try { return new Set(JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? '[]')) }
  catch { return new Set() }
}
function saveDismissed(s: Set<string>) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify([...s])) } catch {}
}

export default function CaseDetailPanel({ caseId, open, onClose, onUpdated, onTransactionClick }: Props) {
  const currentUser = useCurrentUser()
  const isL2 = currentUser?.role ? L2_ROLES.has(currentUser.role) : false

  const [data,          setData]          = useState<CaseDetail | null>(null)
  const [loading,       setLoading]       = useState(false)
  const [actioning,     setActioning]     = useState(false)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)
  const [note,          setNote]          = useState('')
  const [submittingNote, setSubmittingNote] = useState(false)
  const [closePickerOpen, setClosePickerOpen] = useState(false)
  const [localStatus,   setLocalStatus]   = useState<CaseStatus | null>(null)

  // NFIU filing dialog
  const [nfiuOpen,    setNfiuOpen]    = useState(false)
  const [nfiuPrefill, setNfiuPrefill] = useState<ReportPrefill | undefined>()

  // Per-session dismissed transaction IDs
  const [dismissedTxns, setDismissedTxns] = useState<Set<string>>(getDismissed)
  const [showAllTxns,   setShowAllTxns]   = useState(false)

  // Evidence gate — set when an action button is clicked; cleared after evidence confirmed or cancelled
  const [evidenceTarget, setEvidenceTarget] = useState<{
    status: CaseStatus; resolution?: CaseResolution; label: string; color: string; skipDoc?: boolean
  } | null>(null)

  // Tab management
  const [tabIndex, setTabIndex] = useState(0)

  const cas: Case | null = data?.case ?? null
  const currentStatus = localStatus ?? cas?.status ?? null

  const loadDetail = useCallback(async () => {
    if (!caseId) return
    setLoading(true)
    try {
      const d = await caseApi.detail(caseId)
      setData(d)
      setLocalStatus(null)
    } finally {
      setLoading(false)
    }
  }, [caseId])

  useEffect(() => {
    if (open && caseId) { setData(null); setNote(''); setClosePickerOpen(false); setLocalStatus(null); setTabIndex(0); loadDetail() }
  }, [open, caseId, loadDetail])

  const openNfiuDialog = useCallback(() => {
    if (!cas) return
    const tx = data?.transactions?.[0] ?? null
    const today = new Date().toISOString().split('T')[0]
    const prefill: ReportPrefill = {
      reportType: 'STR',
      title: `STR — ${cas.title}`,
      subjectName: tx?.customer,
      subjectAccount: tx?.senderAccount,
      subjectType: 'individual',
      amountNgn: tx ? String(tx.amount) : undefined,
      transactionType: tx?.channel,
      transactionDate: tx?.occurredAt ? tx.occurredAt.split('T')[0] : undefined,
      transactionLocation: tx?.location || undefined,
      transactionLat: tx?.lat,
      transactionLng: tx?.lng,
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

  // File SAR/STR: if the case is still open, nudge it to investigating first;
  // for escalated/investigating cases skip the transition and open the dialog directly.
  // Always open the dialog — a failed status transition must not block filing.
  const fileSarStr = useCallback(async () => {
    if (!cas) return
    if (currentStatus === 'open') {
      setActioning(true)
      try {
        await caseApi.updateStatus(cas.id, 'investigating', undefined, 'SAR/STR filing initiated', null)
        setLocalStatus('investigating')
        onUpdated()
      } catch {
        // transition failed — continue to open dialog anyway
      } finally {
        setActioning(false)
      }
    }
    openNfiuDialog()
    loadDetail().catch(() => {})
  }, [cas, currentStatus, onUpdated, openNfiuDialog, loadDetail])

  const requestTransition = (status: CaseStatus, resolution: CaseResolution | undefined,
      label: string, color: string, skipDoc = false) => {
    if (!cas || actioning) return
    setClosePickerOpen(false)
    setEvidenceTarget({ status, resolution, label, color, skipDoc })
  }

  const transition = useCallback(async (newStatus: CaseStatus, resolution: CaseResolution | undefined,
      reason: string, documentId: number | null) => {
    if (!cas || actioning) return
    setActioning(true)
    const caseId_ = cas.id
    const txnCustId = data?.transactions?.[0]?.customerId ?? null
    try {
      await caseApi.updateStatus(caseId_, newStatus, resolution, reason, documentId)
      setLocalStatus(newStatus)
      onUpdated()

      if (newStatus === 'closed') {
        if (resolution === 'referred') {
          setActionSuccess('Case closed and customer watchlisted.')
          if (txnCustId) {
            customerApi.watchlist(txnCustId, `Case ${caseId_} closed: referred`).catch(() => {})
          }
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
  }, [cas, actioning, onUpdated, loadDetail, data])

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
    } finally {
      setSubmittingNote(false)
    }
  }, [cas, note, submittingNote, loadDetail])

  const dismissTxn = useCallback((id: string) => {
    setDismissedTxns(prev => {
      const next = new Set(prev); next.add(id); saveDismissed(next); return next
    })
  }, [])

  if (!open) return null

  const sCfg  = currentStatus ? STATUS_CFG[currentStatus]   : STATUS_CFG.open
  const pCfg  = cas ? PRIORITY_CFG[cas.priority] : PRIORITY_CFG.medium
  const sla   = cas ? slaInfo(cas.slaDeadline, currentStatus ?? cas.status) : null

  return (
    <>
      <Box onClick={onClose} sx={{ position: 'fixed', inset: 0, bgcolor: 'rgba(15,23,42,0.3)', zIndex: 1200 }} />

      <Box sx={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 500,
        bgcolor: 'var(--card-bg)', zIndex: 1201,
        boxShadow: '-8px 0 40px rgba(15,23,42,0.14)',
        display: 'flex', flexDirection: 'column',
        animation: 'slidePanel 0.24s cubic-bezier(0.4,0,0.2,1)',
        '@keyframes slidePanel': { from: { transform: 'translateX(100%)' }, to: { transform: 'translateX(0)' } },
      }}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <Box sx={{ flexShrink: 0, borderBottom: '1px solid var(--border-col)' }}>

          {/* Row 1: ID + badges + close */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2.5, pt: 2.25, pb: 1 }}>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 0.25 }}>
                Case
              </Typography>
              <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'SF Mono, Monaco, monospace' }}>
                {loading ? '—' : (cas?.id ?? '—')}
              </Typography>
            </Box>
            <Box sx={{ px: 1, py: 0.375, bgcolor: pCfg.bg, border: `1px solid ${pCfg.color}30`, flexShrink: 0 }}>
              <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: pCfg.color, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {pCfg.label}
              </Typography>
            </Box>
            <Box sx={{ px: 1, py: 0.375, bgcolor: sCfg.bg, flexShrink: 0 }}>
              <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: sCfg.color, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {sCfg.label}
              </Typography>
            </Box>
            <IconButton disableRipple size="small" onClick={onClose} sx={{ borderRadius: 0, color: '#94a3b8', '&:hover': { color: 'var(--on-surface-variant)' } }}>
              <CloseRoundedIcon sx={{ fontSize: '1.125rem' }} />
            </IconButton>
          </Box>

          {/* Row 2: Title + typology */}
          <Box sx={{ px: 2.5, pb: 1.25 }}>
            <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost', lineHeight: 1.3 }}>
              {loading ? '—' : (cas?.title ?? '—')}
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
              {cas?.typology ?? ''}
            </Typography>
          </Box>

          {/* Row 3: SLA bar */}
          {sla && currentStatus !== 'closed' && (
            <Box sx={{ px: 2.5, pb: 1.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>SLA</Typography>
                <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: sla.color }}>{sla.label}</Typography>
              </Box>
              <Box sx={{ height: 4, bgcolor: 'var(--section-bg)', position: 'relative' }}>
                <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${sla.pct}%`, bgcolor: sla.color, transition: 'width 0.4s' }} />
              </Box>
            </Box>
          )}

          {/* Row 4: Action buttons */}
          {cas && currentStatus !== 'closed' && (
            <Box sx={{ px: 2.5, pb: 1.75 }}>
              <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 0.875 }}>
                Actions
              </Typography>

              {/* pending_review — L2 decision panel */}
              {currentStatus === 'pending_review' ? (
                <Box>
                  <Box sx={{ p: 1.5, mb: 1, bgcolor: '#f5f3ff', border: '1px solid #ddd6fe', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <VerifiedRoundedIcon sx={{ fontSize: '0.9375rem', color: '#7c3aed', flexShrink: 0 }} />
                    <Typography sx={{ fontSize: '0.75rem', color: '#5b21b6', lineHeight: 1.4 }}>
                      {isL2
                        ? 'This case is awaiting your review. Approve by closing with a resolution, or return it to investigation.'
                        : 'This case has been submitted for L2 review. Only compliance/MLRO officers may act on it now.'}
                    </Typography>
                  </Box>
                  {isL2 && (
                    <Stack direction="row" gap={1} flexWrap="wrap">
                      <Box sx={{ position: 'relative' }}>
                        <ActionBtn label="Close with Resolution" color="#64748b" disabled={actioning}
                          onClick={() => setClosePickerOpen(v => !v)} />
                        {closePickerOpen && (
                          <Box sx={{
                            position: 'absolute', top: '110%', left: 0, bgcolor: 'var(--card-bg)', zIndex: 10,
                            border: '1px solid var(--border-col)', boxShadow: '0 8px 24px rgba(15,23,42,0.12)', width: 260,
                          }}>
                            <Typography sx={{ px: 1.5, pt: 1.25, pb: 0.75, fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                              Resolution
                            </Typography>
                            {RESOLUTION_OPTIONS.map(r => (
                              <Box key={r.key}
                                onClick={() => requestTransition('closed', r.key, r.label, r.color)}
                                sx={{ px: 1.5, py: 0.875, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1,
                                  '&:hover': { bgcolor: 'var(--section-bg)' } }}>
                                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: r.color, flexShrink: 0 }} />
                                <Box>
                                  <Typography sx={{ fontSize: '0.8125rem', color: 'var(--heading-color)', fontFamily: 'Jost', fontWeight: 600 }}>{r.label}</Typography>
                                  {r.key === 'referred' && <Typography sx={{ fontSize: '0.625rem', color: '#f59e0b' }}>Customer will be watchlisted</Typography>}
                                </Box>
                              </Box>
                            ))}
                          </Box>
                        )}
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
                  {/* SAR/STR filing — shown while case is active and no report is linked yet */}
                  {!cas.linkedNfiuReportId && (
                    <ActionBtn label="File SAR / STR" color="#d97706" disabled={actioning}
                      onClick={fileSarStr} />
                  )}
                  {(currentStatus === 'escalated' || isL2) && (
                    <Box sx={{ position: 'relative' }}>
                      <ActionBtn label="Close Case" color="#64748b" disabled={actioning}
                        onClick={() => setClosePickerOpen(v => !v)} />
                      {closePickerOpen && (
                        <Box sx={{
                          position: 'absolute', top: '110%', left: 0, bgcolor: 'var(--card-bg)', zIndex: 10,
                          border: '1px solid var(--border-col)', boxShadow: '0 8px 24px rgba(15,23,42,0.12)', width: 260,
                        }}>
                          <Typography sx={{ px: 1.5, pt: 1.25, pb: 0.75, fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                            Resolution
                          </Typography>
                          {RESOLUTION_OPTIONS.map(r => (
                            <Box key={r.key}
                              onClick={() => requestTransition('closed', r.key, r.label, r.color)}
                              sx={{ px: 1.5, py: 0.875, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1,
                                '&:hover': { bgcolor: 'var(--section-bg)' } }}>
                              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: r.color, flexShrink: 0 }} />
                              <Box>
                                <Typography sx={{ fontSize: '0.8125rem', color: 'var(--heading-color)', fontFamily: 'Jost', fontWeight: 600 }}>{r.label}</Typography>
                                {r.key === 'referred' && <Typography sx={{ fontSize: '0.625rem', color: '#f59e0b' }}>Customer will be watchlisted</Typography>}
                              </Box>
                            </Box>
                          ))}
                        </Box>
                      )}
                    </Box>
                  )}
                </Stack>
              )}
            </Box>
          )}
        </Box>

        {/* ── Action success flash ────────────────────────────────────────── */}
        {actionSuccess && (
          <Box sx={{ flexShrink: 0, bgcolor: '#f0fdf4', borderBottom: '1px solid #86efac', px: 2.5, py: 1.25, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
            <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: '#166534' }}>
              {actionSuccess}
            </Typography>
            <Box onClick={() => setActionSuccess(null)} sx={{ fontSize: '0.6875rem', color: '#4ade80', cursor: 'pointer', flexShrink: 0, '&:hover': { color: '#166534' } }}>✕</Box>
          </Box>
        )}

        {/* ── NFIU compliance banner ──────────────────────────────────────── */}
        {cas && currentStatus !== 'closed' && (
          <Box sx={{ flexShrink: 0, bgcolor: '#fffbeb', borderBottom: '1px solid #fde68a', px: 2.5, py: 1.5, display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
            <GavelOutlinedIcon sx={{ fontSize: '1rem', color: '#d97706', mt: 0.125, flexShrink: 0 }} />
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: '0.6875rem', color: '#92400e', lineHeight: 1.55 }}>
                Suspicious transactions must be reported to the NFIU within <strong>24 hours</strong> of the suspicion, according to the <em>Terrorism (Prevention &amp; Prohibition) Act of 2022</em>.
              </Typography>
            </Box>
            <Box onClick={openNfiuDialog} sx={{
              flexShrink: 0, px: 1.375, py: 0.5,
              bgcolor: '#d97706', color: '#fff',
              fontSize: '0.6875rem', fontWeight: 700, fontFamily: 'Jost',
              cursor: 'pointer', whiteSpace: 'nowrap',
              '&:hover': { bgcolor: '#b45309' },
            }}>
              File STR →
            </Box>
          </Box>
        )}

        {/* ── Tab header ──────────────────────────────────────────────────── */}
        <Box sx={{ flexShrink: 0, borderBottom: '1px solid var(--border-col)' }}>
          <Tabs
            value={tabIndex}
            onChange={(_, v) => setTabIndex(v)}
            sx={{
              px: 2.5,
              '& .MuiTabs-indicator': { bgcolor: colorPalette.primary },
              '& .MuiTab-root': {
                fontSize: '0.8125rem',
                fontWeight: 600,
                fontFamily: 'Jost',
                color: '#94a3b8',
                textTransform: 'none',
                minHeight: 44,
                px: 0,
                mr: 2.5,
                '&.Mui-selected': { color: colorPalette.primary },
              },
            }}
          >
            <Tab label="Details & Notes" />
            <Tab label="Activity & Evidence" />
          </Tabs>
        </Box>

        {/* ── Scrollable body ─────────────────────────────────────────────── */}
        <Box sx={{ flex: 1, overflowY: 'auto', p: 2.5, display: 'flex', flexDirection: 'column', gap: 2.5 }}>

          {loading && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {[120, 80, 200, 160].map((w, i) => (
                <Box key={i} sx={{ height: 12, width: `${w}px`, bgcolor: '#f1f5f9', borderRadius: 0.5, animation: 'pulse 1.5s ease-in-out infinite', '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } } }} />
              ))}
            </Box>
          )}

          {/* TAB 0: Details & Notes */}
          {tabIndex === 0 && cas && !loading && (
            <>
              <Section title="Details">
                <Field label="Typology"   value={cas.typology} />
                <Field label="Risk Score" value={String(cas.riskScore)} />
                {cas.assigneeName && <Field label="Assigned To" value={cas.assigneeName} />}
                <Field label="Opened By"  value={cas.createdByName} />
                <Field label="Opened"     value={fmtDate(cas.createdAt)} />
                {cas.closedAt && <Field label="Closed"  value={fmtDate(cas.closedAt)} />}
                {cas.resolution && <Field label="Resolution" value={cas.resolution.replace(/_/g, ' ')} />}
                {cas.linkedNfiuReportId && (
                  <Field label="NFIU Report" value={`Report #${cas.linkedNfiuReportId}`} />
                )}
              </Section>

              {/* Watchlisted notice when customer was watchlisted on case close */}
              {cas.resolution && (cas.resolution === 'sar_filed' || cas.resolution === 'referred') && cas.status === 'closed' && (
                <Box sx={{ p: 1.5, bgcolor: '#fef3c7', border: '1px solid #fde68a', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#d97706', flexShrink: 0 }} />
                  <Typography sx={{ fontSize: '0.75rem', color: '#92400e', lineHeight: 1.45 }}>
                    Customer has been <strong>watchlisted</strong> based on this case resolution.
                  </Typography>
                </Box>
              )}

              {cas.notes && (
                <Box>
                  <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.14em', mb: 1 }}>
                    Notes
                  </Typography>
                  <Box sx={{ p: 1.5, bgcolor: 'var(--card-bg)', border: '1px solid var(--border-col)', borderRadius: 0.5 }}>
                    <Typography sx={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {cas.notes}
                    </Typography>
                  </Box>
                </Box>
              )}
            </>
          )}

          {/* TAB 1: Activity & Evidence */}
          {tabIndex === 1 && !loading && (
            <>
              {/* Linked transactions */}
              {(() => {
                const allTxns = data?.transactions ?? []
                const visible = showAllTxns
                  ? allTxns
                  : allTxns.filter(t => !dismissedTxns.has(t.id))
                const hiddenCount = allTxns.length - visible.length
                return (
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                      <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.14em' }}>
                        Linked Transactions ({allTxns.length})
                      </Typography>
                      {hiddenCount > 0 && (
                        <Typography onClick={() => setShowAllTxns(v => !v)} sx={{ fontSize: '0.625rem', color: colorPalette.primary, fontWeight: 600, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}>
                          {showAllTxns ? 'Hide dismissed' : `Show ${hiddenCount} dismissed`}
                        </Typography>
                      )}
                    </Box>
                    <Box sx={{ border: '1px solid var(--border-col)' }}>
                      {allTxns.length === 0 ? (
                        <Box sx={{ p: 2, textAlign: 'center' }}>
                          <Typography sx={{ fontSize: '0.8125rem', color: '#94a3b8' }}>No transactions linked yet</Typography>
                        </Box>
                      ) : visible.length === 0 ? (
                        <Box sx={{ p: 2, textAlign: 'center' }}>
                          <Typography sx={{ fontSize: '0.8125rem', color: '#94a3b8' }}>All transactions dismissed this session</Typography>
                          <Typography onClick={() => setShowAllTxns(true)} sx={{ fontSize: '0.75rem', color: colorPalette.primary, fontWeight: 600, cursor: 'pointer', mt: 0.5 }}>Show all</Typography>
                        </Box>
                      ) : visible.map((t, i) => {
                        const isDismissed = dismissedTxns.has(t.id)
                        return (
                          <Box key={t.id} sx={{
                            display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 1, alignItems: 'center',
                            px: 1.5, py: 1.25, borderBottom: i < visible.length - 1 ? '1px solid var(--border-col)' : 'none',
                            opacity: isDismissed ? 0.45 : 1,
                            transition: 'opacity 0.15s',
                          }}>
                            <Box sx={{ overflow: 'hidden', cursor: onTransactionClick ? 'pointer' : 'default', '&:hover': onTransactionClick ? { opacity: 0.8 } : {} }}
                              onClick={() => onTransactionClick?.(t)}>
                              <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--heading-color)', fontFamily: 'SF Mono, Monaco, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {t.id}
                              </Typography>
                              <Typography sx={{ fontSize: '0.6875rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', mt: 0.25 }}>
                                {t.customer} · {t.channel}
                              </Typography>
                            </Box>
                            <Box sx={{ textAlign: 'right', flexShrink: 0, cursor: onTransactionClick ? 'pointer' : 'default' }} onClick={() => onTransactionClick?.(t)}>
                              <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'SF Mono, Monaco, monospace' }}>
                                {t.amount.toLocaleString()}
                              </Typography>
                              <Typography sx={{ fontSize: '0.625rem', color: t.risk >= 70 ? '#dc2626' : t.risk >= 40 ? '#f59e0b' : '#10b981', fontWeight: 700, mt: 0.25 }}>
                                Risk {t.risk}
                              </Typography>
                            </Box>
                            <IconButton size="small" disableRipple
                              title={isDismissed ? 'Dismissed this session' : 'Dismiss from view (this session)'}
                              onClick={() => isDismissed
                                ? setDismissedTxns(prev => { const n = new Set(prev); n.delete(t.id); saveDismissed(n); return n })
                                : dismissTxn(t.id)}
                              sx={{ borderRadius: 0, color: isDismissed ? '#10b981' : '#cbd5e1', '&:hover': { color: isDismissed ? '#059669' : '#94a3b8' }, flexShrink: 0 }}>
                              <CloseRoundedIcon sx={{ fontSize: '0.875rem' }} />
                            </IconButton>
                          </Box>
                        )
                      })}
                    </Box>
                  </Box>
                )
              })()}

              {/* Activity timeline */}
              <Box>
                <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.14em', mb: 1 }}>
                  Activity Timeline
                </Typography>
                {(!data?.activity || data.activity.length === 0) ? (
                  <Typography sx={{ fontSize: '0.8125rem', color: '#94a3b8' }}>No activity yet</Typography>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {data.activity.map((a, i) => (
                      <Box key={a.id} sx={{ display: 'flex', gap: 1.5, pb: i < data.activity.length - 1 ? 2 : 0, position: 'relative' }}>
                        {/* Vertical connector */}
                        {i < data.activity.length - 1 && (
                          <Box sx={{ position: 'absolute', left: 13, top: 28, bottom: 0, width: 1, bgcolor: '#e2e8f0' }} />
                        )}
                        <Avatar name={a.actorName} size={28} />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, flexWrap: 'wrap' }}>
                            <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--heading-color)', fontFamily: 'Jost' }}>
                              {a.actorName}
                            </Typography>
                            <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>
                              {ACTION_LABELS[a.action] ?? a.action}
                            </Typography>
                            <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', ml: 'auto' }}>
                              {fmtDate(a.createdAt)}
                            </Typography>
                          </Box>
                          {a.detail && (
                            <Box sx={{ mt: 0.5, p: 1, bgcolor: 'var(--card-bg)', border: '1px solid var(--border-col)' }}>
                              <Typography sx={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                {a.detail}
                              </Typography>
                            </Box>
                          )}
                        </Box>
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>
            </>
          )}
        </Box>

        {/* ── Add note footer ──────────────────────────────────────────────── */}
        {cas && !loading && tabIndex === 0 && (
          <Box sx={{ flexShrink: 0, borderTop: '1px solid var(--border-col)', p: 2 }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
              <Box sx={{
                flex: 1, border: '1px solid var(--border-col)', px: 1.25, py: 0.875, minHeight: 60,
                display: 'flex', alignItems: 'flex-start',
                '&:focus-within': { borderColor: colorPalette.primary },
              }}>
                <InputBase
                  multiline
                  minRows={2}
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Add a note for the audit trail…"
                  sx={{ flex: 1, fontSize: '0.8125rem', fontFamily: 'Jost', color: 'var(--heading-color)', '& textarea': { resize: 'none' } }}
                />
              </Box>
              <Box onClick={submitNote} sx={{
                px: 1.75, py: 0.875, bgcolor: note.trim() && !submittingNote ? colorPalette.primary : '#e2e8f0',
                color: note.trim() && !submittingNote ? '#ffffff' : '#94a3b8',
                cursor: note.trim() && !submittingNote ? 'pointer' : 'not-allowed',
                fontSize: '0.8125rem', fontWeight: 700, fontFamily: 'Jost',
                transition: 'all 0.15s', flexShrink: 0,
              }}>
                {submittingNote ? '…' : 'Post'}
              </Box>
            </Box>
          </Box>
        )}
      </Box>

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
      />
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box>
      <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.14em', mb: 1 }}>
        {title}
      </Typography>
      <Box sx={{ border: '1px solid var(--border-col)', p: 1.5 }}>{children}</Box>
    </Box>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '112px 1fr', gap: 1, mb: 0.875, '&:last-child': { mb: 0 } }}>
      <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', fontWeight: 600, lineHeight: 1.4 }}>{label}</Typography>
      <Typography sx={{ fontSize: '0.8125rem', color: 'var(--heading-color)', fontFamily: 'Jost', lineHeight: 1.4 }}>{value}</Typography>
    </Box>
  )
}

function ActionBtn({ label, color, disabled, onClick }: { label: string; color: string; disabled: boolean; onClick: () => void }) {
  return (
    <Box onClick={disabled ? undefined : onClick} sx={{
      px: 1.5, py: 0.625, border: '1px solid', borderColor: color,
      color, cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.6 : 1, transition: 'all 0.15s',
      '&:hover': disabled ? {} : { bgcolor: `${color}0a` },
    }}>
      <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, fontFamily: 'Jost' }}>{label}</Typography>
    </Box>
  )
}
