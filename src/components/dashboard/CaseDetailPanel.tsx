import { useState, useEffect, useCallback } from 'react'
import { Box, Typography, Stack, IconButton, InputBase } from '@mui/material'
import ActionEvidenceDialog, { type EvidencePayload } from '@/components/dashboard/ActionEvidenceDialog'
import { colorPalette } from '@/theme'
import { caseApi, type Case, type CaseDetail, type CaseStatus, type CaseResolution } from '@/api/cases'
import type { Transaction } from '@/api/transactions'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined'

interface Props {
  caseId: string | null
  open: boolean
  onClose: () => void
  onUpdated: () => void
  onTransactionClick?: (txn: Transaction) => void
}

const STATUS_CFG: Record<string, { color: string; bg: string; label: string }> = {
  open:          { color: '#f59e0b', bg: '#fffbeb',                               label: 'Open'          },
  investigating: { color: colorPalette.primary, bg: `${colorPalette.primary}0f`,  label: 'Investigating' },
  escalated:     { color: '#dc2626', bg: '#fef2f2',                               label: 'Escalated'     },
  closed:        { color: '#64748b', bg: '#f8fafc',                               label: 'Closed'        },
}

const PRIORITY_CFG: Record<string, { color: string; bg: string; label: string }> = {
  low:      { color: '#64748b', bg: '#f8fafc', label: 'Low'      },
  medium:   { color: '#f59e0b', bg: '#fffbeb', label: 'Medium'   },
  high:     { color: '#ea580c', bg: '#fff7ed', label: 'High'     },
  critical: { color: '#dc2626', bg: '#fef2f2', label: 'Critical' },
}

const ACTION_LABELS: Record<string, string> = {
  opened:             'Case opened',
  status_changed:     'Status updated',
  note_added:         'Note added',
  transaction_linked: 'Transaction linked',
  assigned:           'Case assigned',
  closed:             'Case closed',
}

function slaInfo(deadline: string, status: CaseStatus) {
  if (status === 'closed') return { label: 'Closed', color: '#10b981', pct: 100 }
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
  { key: 'cleared',  label: 'Cleared — false positive', color: '#10b981' },
  { key: 'sar_filed', label: 'SAR / STR filed',          color: '#f59e0b' },
  { key: 'referred', label: 'Referred to law enforcement', color: '#dc2626' },
]

export default function CaseDetailPanel({ caseId, open, onClose, onUpdated, onTransactionClick }: Props) {
  const [data,          setData]          = useState<CaseDetail | null>(null)
  const [loading,       setLoading]       = useState(false)
  const [actioning,     setActioning]     = useState(false)
  const [note,          setNote]          = useState('')
  const [submittingNote, setSubmittingNote] = useState(false)
  const [closePickerOpen, setClosePickerOpen] = useState(false)
  const [localStatus,   setLocalStatus]   = useState<CaseStatus | null>(null)

  // Evidence gate — set when an action button is clicked; cleared after evidence confirmed or cancelled
  const [evidenceTarget, setEvidenceTarget] = useState<{
    status: CaseStatus; resolution?: CaseResolution; label: string; color: string
  } | null>(null)

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
    if (open && caseId) { setData(null); setNote(''); setClosePickerOpen(false); setLocalStatus(null); loadDetail() }
  }, [open, caseId, loadDetail])

  const requestTransition = (status: CaseStatus, resolution: CaseResolution | undefined,
      label: string, color: string) => {
    if (!cas || actioning) return
    setClosePickerOpen(false)
    setEvidenceTarget({ status, resolution, label, color })
  }

  const transition = useCallback(async (newStatus: CaseStatus, resolution: CaseResolution | undefined,
      reason: string, documentId: number) => {
    if (!cas || actioning) return
    setActioning(true)
    try {
      await caseApi.updateStatus(cas.id, newStatus, resolution, reason, documentId)
      setLocalStatus(newStatus)
      onUpdated()
      await loadDetail()
    } finally {
      setActioning(false)
    }
  }, [cas, actioning, onUpdated, loadDetail])

  const handleEvidenceConfirm = useCallback((payload: EvidencePayload) => {
    if (!evidenceTarget) return
    const { status, resolution } = evidenceTarget
    setEvidenceTarget(null)
    transition(status, resolution, payload.reason, payload.documentId)
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

  if (!open) return null

  const sCfg  = currentStatus ? STATUS_CFG[currentStatus]   : STATUS_CFG.open
  const pCfg  = cas ? PRIORITY_CFG[cas.priority] : PRIORITY_CFG.medium
  const sla   = cas ? slaInfo(cas.slaDeadline, currentStatus ?? cas.status) : null

  return (
    <>
      <Box onClick={onClose} sx={{ position: 'fixed', inset: 0, bgcolor: 'rgba(15,23,42,0.3)', zIndex: 1200 }} />

      <Box sx={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 500,
        bgcolor: '#ffffff', zIndex: 1201,
        boxShadow: '-8px 0 40px rgba(15,23,42,0.14)',
        display: 'flex', flexDirection: 'column',
        animation: 'slidePanel 0.24s cubic-bezier(0.4,0,0.2,1)',
        '@keyframes slidePanel': { from: { transform: 'translateX(100%)' }, to: { transform: 'translateX(0)' } },
      }}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <Box sx={{ flexShrink: 0, borderBottom: '1px solid #eef0f4' }}>

          {/* Row 1: ID + badges + close */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2.5, pt: 2.25, pb: 1 }}>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 0.25 }}>
                Case
              </Typography>
              <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: '#0f172a', fontFamily: 'SF Mono, Monaco, monospace' }}>
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
            <IconButton disableRipple size="small" onClick={onClose} sx={{ borderRadius: 0, color: '#94a3b8', '&:hover': { color: '#475569' } }}>
              <CloseRoundedIcon sx={{ fontSize: '1.125rem' }} />
            </IconButton>
          </Box>

          {/* Row 2: Title + typology */}
          <Box sx={{ px: 2.5, pb: 1.25 }}>
            <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost', lineHeight: 1.3 }}>
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
              <Box sx={{ height: 4, bgcolor: '#f1f5f9', position: 'relative' }}>
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
              <Stack direction="row" gap={1} flexWrap="wrap">
                {currentStatus === 'open' && (
                  <ActionBtn label="Start Investigation" color={colorPalette.primary} disabled={actioning}
                    onClick={() => requestTransition('investigating', undefined, 'Start Investigation', colorPalette.primary)} />
                )}
                {currentStatus === 'investigating' && (
                  <ActionBtn label="Escalate" color="#f59e0b" disabled={actioning}
                    onClick={() => requestTransition('escalated', undefined, 'Escalate', '#f59e0b')} />
                )}
                <Box sx={{ position: 'relative' }}>
                  <ActionBtn label="Close Case" color="#64748b" disabled={actioning}
                    onClick={() => setClosePickerOpen(v => !v)} />
                  {closePickerOpen && (
                    <Box sx={{
                      position: 'absolute', top: '110%', left: 0, bgcolor: '#ffffff', zIndex: 10,
                      border: '1px solid #e2e8f0', boxShadow: '0 8px 24px rgba(15,23,42,0.12)', width: 240,
                    }}>
                      <Typography sx={{ px: 1.5, pt: 1.25, pb: 0.75, fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                        Resolution
                      </Typography>
                      {RESOLUTION_OPTIONS.map(r => (
                        <Box key={r.key}
                          onClick={() => requestTransition('closed', r.key, r.label, r.color)}
                          sx={{ px: 1.5, py: 0.875, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1,
                            '&:hover': { bgcolor: '#f8fafc' } }}>
                          <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: r.color, flexShrink: 0 }} />
                          <Typography sx={{ fontSize: '0.8125rem', color: '#0f172a', fontFamily: 'Jost' }}>{r.label}</Typography>
                        </Box>
                      ))}
                    </Box>
                  )}
                </Box>
              </Stack>
            </Box>
          )}
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

          {/* Case details */}
          {cas && !loading && (
            <Section title="Details">
              <Field label="Typology"   value={cas.typology} />
              <Field label="Risk Score" value={String(cas.riskScore)} />
              {cas.assigneeName && <Field label="Assigned To" value={cas.assigneeName} />}
              <Field label="Opened By"  value={cas.createdByName} />
              <Field label="Opened"     value={fmtDate(cas.createdAt)} />
              {cas.closedAt && <Field label="Closed"  value={fmtDate(cas.closedAt)} />}
              {cas.resolution && <Field label="Resolution" value={cas.resolution.replace('_', ' ')} />}
              {cas.notes && <Field label="Notes" value={cas.notes} />}
            </Section>
          )}

          {/* Linked transactions */}
          {!loading && (
            <Box>
              <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.14em', mb: 1 }}>
                Linked Transactions ({data?.transactions.length ?? 0})
              </Typography>
              <Box sx={{ border: '1px solid #eef0f4' }}>
                {(!data?.transactions || data.transactions.length === 0) ? (
                  <Box sx={{ p: 2, textAlign: 'center' }}>
                    <Typography sx={{ fontSize: '0.8125rem', color: '#94a3b8' }}>No transactions linked yet</Typography>
                  </Box>
                ) : data.transactions.map((t, i) => (
                  <Box key={t.id} onClick={() => onTransactionClick?.(t)} sx={{
                    display: 'grid', gridTemplateColumns: '1fr auto', gap: 1,
                    px: 1.5, py: 1.25, borderBottom: i < data.transactions.length - 1 ? '1px solid #f4f5f7' : 'none',
                    cursor: onTransactionClick ? 'pointer' : 'default',
                    '&:hover': onTransactionClick ? { bgcolor: '#fafbfc' } : {},
                  }}>
                    <Box sx={{ overflow: 'hidden' }}>
                      <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#0f172a', fontFamily: 'SF Mono, Monaco, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.id}
                      </Typography>
                      <Typography sx={{ fontSize: '0.6875rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', mt: 0.25 }}>
                        {t.customer} · {t.channel}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                      <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0f172a', fontFamily: 'SF Mono, Monaco, monospace' }}>
                        {t.amount.toLocaleString()}
                      </Typography>
                      <Typography sx={{ fontSize: '0.625rem', color: t.risk >= 70 ? '#dc2626' : t.risk >= 40 ? '#f59e0b' : '#10b981', fontWeight: 700, mt: 0.25 }}>
                        Risk {t.risk}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          {/* Activity timeline */}
          {!loading && (
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
                          <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: '#0f172a', fontFamily: 'Jost' }}>
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
                          <Box sx={{ mt: 0.5, p: 1, bgcolor: '#f8fafc', border: '1px solid #f1f5f9' }}>
                            <Typography sx={{ fontSize: '0.8125rem', color: '#475569', lineHeight: 1.5 }}>
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
          )}
        </Box>

        {/* ── Add note footer ──────────────────────────────────────────────── */}
        {cas && !loading && (
          <Box sx={{ flexShrink: 0, borderTop: '1px solid #eef0f4', p: 2 }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
              <Box sx={{
                flex: 1, border: '1px solid #e2e8f0', px: 1.25, py: 0.875, minHeight: 60,
                display: 'flex', alignItems: 'flex-start',
                '&:focus-within': { borderColor: colorPalette.primary },
              }}>
                <InputBase
                  multiline
                  minRows={2}
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Add a note for the audit trail…"
                  sx={{ flex: 1, fontSize: '0.8125rem', fontFamily: 'Jost', color: '#0f172a', '& textarea': { resize: 'none' } }}
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
        />
      )}
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box>
      <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.14em', mb: 1 }}>
        {title}
      </Typography>
      <Box sx={{ border: '1px solid #eef0f4', p: 1.5 }}>{children}</Box>
    </Box>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '112px 1fr', gap: 1, mb: 0.875, '&:last-child': { mb: 0 } }}>
      <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', fontWeight: 600, lineHeight: 1.4 }}>{label}</Typography>
      <Typography sx={{ fontSize: '0.8125rem', color: '#0f172a', fontFamily: 'Jost', lineHeight: 1.4 }}>{value}</Typography>
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
