import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Typography, Stack, IconButton } from '@mui/material'
import { colorPalette } from '@/theme'
import { transactionApi, type Transaction, type FlaggedStatus } from '@/api/transactions'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import BlockRoundedIcon from '@mui/icons-material/BlockRounded'
import FlagRoundedIcon from '@mui/icons-material/FlagRounded'
import HourglassEmptyRoundedIcon from '@mui/icons-material/HourglassEmptyRounded'
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined'

interface Props {
  transaction: Transaction | null
  open: boolean
  onClose: () => void
  onStatusChange: () => void
}

const PAYMENT_STATUS_CFG: Record<string, { color: string; bg: string; label: string }> = {
  pending:    { color: '#f59e0b', bg: '#fffbeb', label: 'Pending'    },
  successful: { color: '#10b981', bg: '#f0fdf4', label: 'Successful' },
  failed:     { color: '#dc2626', bg: '#fef2f2', label: 'Failed'     },
}

const FLAGGED_STATUS_CFG: Record<FlaggedStatus, { color: string; bg: string; label: string }> = {
  flagged: { color: '#f59e0b', bg: '#fffbeb',                              label: 'Flagged'   },
  blocked: { color: '#dc2626', bg: '#fef2f2',                              label: 'Blocked'   },
  cleared: { color: '#10b981', bg: '#f0fdf4',                              label: 'Cleared'   },
  review:  { color: colorPalette.primary, bg: `${colorPalette.primary}0f`, label: 'In Review' },
}

function riskColor(score: number) {
  return score >= 70 ? '#dc2626' : score >= 40 ? '#f59e0b' : '#10b981'
}

function riskLabel(score: number) {
  return score >= 70 ? 'HIGH' : score >= 40 ? 'MEDIUM' : 'LOW'
}

function fmtDate(iso?: string) {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('en-NG', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      timeZoneName: 'short',
    }).format(new Date(iso))
  } catch { return iso }
}

function fmtAmount(amount: number, currency = 'NGN') {
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency', currency,
      minimumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `₦${amount.toLocaleString()}`
  }
}

const TYPOLOGIES = [
  'BDC Structuring',
  'Layering',
  'Velocity Breach',
  'Cross-border Anomaly',
  'Smurfing',
  'Insider Threat',
  'Account Takeover',
  'Other',
]

export default function TransactionDetailPanel({ transaction: txn, open, onClose, onStatusChange }: Props) {
  const navigate = useNavigate()
  const [actionFlaggedStatus, setActionFlaggedStatus] = useState<FlaggedStatus | null>(null)
  const [actioning, setActioning] = useState(false)

  const [caseModalOpen,  setCaseModalOpen]  = useState(false)
  const [caseTypology,   setCaseTypology]   = useState(TYPOLOGIES[0])
  const [caseNotes,      setCaseNotes]      = useState('')
  const [caseConfirmed,  setCaseConfirmed]  = useState(false)

  const openCaseModal  = () => { setCaseTypology(TYPOLOGIES[0]); setCaseNotes(''); setCaseConfirmed(false); setCaseModalOpen(true) }
  const closeCaseModal = () => setCaseModalOpen(false)

  const confirmCase = () => {
    setCaseConfirmed(true)
    setTimeout(() => {
      setCaseModalOpen(false)
      onClose()
      navigate('/dashboard/aml')
    }, 1200)
  }

  const currentFlagged = (actionFlaggedStatus ?? txn?.flaggedStatus ?? null) as FlaggedStatus | null
  const flaggedCfg = currentFlagged ? FLAGGED_STATUS_CFG[currentFlagged] : null
  const paymentCfg = PAYMENT_STATUS_CFG[txn?.status ?? 'pending'] ?? PAYMENT_STATUS_CFG.pending

  const changeFlag = useCallback(async (newFlag: FlaggedStatus) => {
    if (!txn || actioning || newFlag === currentFlagged) return
    setActioning(true)
    try {
      await transactionApi.bulkFlaggedStatus([txn.id], newFlag)
      setActionFlaggedStatus(newFlag)
      onStatusChange()
    } finally {
      setActioning(false)
    }
  }, [txn, actioning, currentFlagged, onStatusChange])

  if (!open || !txn) return null

  const risk = txn.risk ?? 0
  const rc   = riskColor(risk)

  return (
    <>
      {/* Backdrop */}
      <Box
        onClick={onClose}
        sx={{ position: 'fixed', inset: 0, bgcolor: 'rgba(15,23,42,0.3)', zIndex: 1200 }}
      />

      {/* Panel */}
      <Box sx={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 440, bgcolor: '#ffffff', zIndex: 1201,
        boxShadow: '-8px 0 40px rgba(15,23,42,0.14)',
        display: 'flex', flexDirection: 'column',
        animation: 'slideInPanel 0.24s cubic-bezier(0.4,0,0.2,1)',
        '@keyframes slideInPanel': {
          from: { transform: 'translateX(100%)' },
          to:   { transform: 'translateX(0)' },
        },
      }}>

        {/* ── Sticky header ─────────────────────────────────────────────── */}
        <Box sx={{ flexShrink: 0, borderBottom: '1px solid #eef0f4' }}>

          {/* Row 1: ID + status badges + close */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2.5, pt: 2.5, pb: 1.25 }}>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 0.25 }}>
                Transaction
              </Typography>
              <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', fontFamily: 'SF Mono, Monaco, monospace', letterSpacing: '-0.01em' }}>
                {txn.id}
              </Typography>
            </Box>
            {/* Payment status */}
            <Box sx={{ px: 1, py: 0.375, bgcolor: paymentCfg.bg, flexShrink: 0 }}>
              <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: paymentCfg.color, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {paymentCfg.label}
              </Typography>
            </Box>
            {/* Investigation status if set */}
            {flaggedCfg && (
              <Box sx={{ px: 1, py: 0.375, bgcolor: flaggedCfg.bg, border: `1px solid ${flaggedCfg.color}30`, flexShrink: 0 }}>
                <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: flaggedCfg.color, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  {flaggedCfg.label}
                </Typography>
              </Box>
            )}
            <IconButton disableRipple size="small" onClick={onClose} sx={{ borderRadius: 0, color: '#94a3b8', '&:hover': { color: '#475569' } }}>
              <CloseRoundedIcon sx={{ fontSize: '1.125rem' }} />
            </IconButton>
          </Box>

          {/* Row 2: Amount summary */}
          <Box sx={{ px: 2.5, pb: 1.5 }}>
            <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost', letterSpacing: '-0.02em' }}>
              {fmtAmount(txn.amount, txn.currency)}
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
              {[txn.channel, txn.currency ?? 'NGN', txn.location].filter(Boolean).join(' · ')}
            </Typography>
          </Box>

          {/* Row 3: Investigation action buttons */}
          <Box sx={{ px: 2.5, pb: 1.25 }}>
            <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 0.875 }}>
              Investigation
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ActionBtn label="Clear"    icon={<CheckRoundedIcon          sx={{ fontSize: '0.875rem !important' }} />} color="#10b981"            active={currentFlagged === 'cleared'} disabled={actioning} onClick={() => changeFlag('cleared')} />
              <ActionBtn label="Review"   icon={<HourglassEmptyRoundedIcon sx={{ fontSize: '0.875rem !important' }} />} color={colorPalette.primary} active={currentFlagged === 'review'}  disabled={actioning} onClick={() => changeFlag('review')}  />
              <ActionBtn label="Escalate" icon={<FlagRoundedIcon           sx={{ fontSize: '0.875rem !important' }} />} color="#f59e0b"            active={currentFlagged === 'flagged'} disabled={actioning} onClick={() => changeFlag('flagged')} />
              <ActionBtn label="Block"    icon={<BlockRoundedIcon          sx={{ fontSize: '0.875rem !important' }} />} color="#dc2626"            active={currentFlagged === 'blocked'} disabled={actioning} onClick={() => changeFlag('blocked')} />
            </Box>
          </Box>

          {/* Row 4: Open Case */}
          <Box sx={{ px: 2.5, pb: 1.75, borderTop: '1px solid #f1f5f9', pt: 1.25 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1} onClick={openCaseModal} sx={{
              px: 1.5, py: 0.875, border: '1px solid #e2e8f0', cursor: 'pointer',
              transition: 'all 0.15s',
              '&:hover': { borderColor: colorPalette.primary, bgcolor: `${colorPalette.primary}06` },
            }}>
              <Stack direction="row" alignItems="center" gap={0.75}>
                <GavelOutlinedIcon sx={{ fontSize: '0.9375rem', color: colorPalette.primary }} />
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
                  Open Case
                </Typography>
              </Stack>
              <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8' }}>
                Escalate to AML & Cases →
              </Typography>
            </Stack>
          </Box>
        </Box>

        {/* ── Scrollable body ────────────────────────────────────────────── */}
        <Box sx={{ flex: 1, overflowY: 'auto', p: 2.5 }}>

          {/* Risk score */}
          <Box sx={{ mb: 2.5, p: 1.5, border: '1px solid #eef0f4', bgcolor: `${rc}04` }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1 }}>
              <Typography sx={{ fontSize: '2.25rem', fontWeight: 800, color: rc, fontFamily: 'Jost', lineHeight: 1 }}>
                {risk}
              </Typography>
              <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: rc, textTransform: 'uppercase', letterSpacing: '0.14em' }}>
                {riskLabel(risk)} RISK
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8', ml: 'auto' }}>/100</Typography>
            </Box>
            <Box sx={{ height: 6, bgcolor: '#f1f5f9', position: 'relative' }}>
              <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${risk}%`, bgcolor: rc, transition: 'width 0.6s ease' }} />
            </Box>
          </Box>

          <Section title="Sender">
            <Field label="Name"        value={txn.customer} />
            <Field label="Customer ID" value={txn.customerId}    mono />
            <Field label="Account No." value={txn.senderAccount} mono />
            <Field label="Bank"        value={txn.senderBank} />
            <Field label="Location"    value={txn.location} />
          </Section>

          <Section title="Destination / Recipient">
            <Field label="Name"        value={txn.recipientName ?? txn.counterparty} />
            <Field label="Account No." value={txn.recipientAccount} mono />
            <Field label="Bank"        value={txn.recipientBank} />
            {txn.recipientName && txn.recipientName !== txn.counterparty && (
              <Field label="Counterparty" value={txn.counterparty} />
            )}
          </Section>

          <Section title="Transaction Details">
            <Field label="Reference"   value={txn.id}                   mono />
            <Field label="Channel"     value={txn.channel} />
            <Field label="Currency"    value={txn.currency ?? 'NGN'} />
            <Field label="Narration"   value={txn.narration} />
            <Field label="Payment"     value={paymentCfg.label} />
            <Field label="Date & Time" value={fmtDate(txn.occurredAt)} />
          </Section>

          <Section title="Fraud Signals">
            <Field label="Device ID"  value={txn.deviceId}  mono />
            <Field label="IP Address" value={txn.ipAddress} mono />
          </Section>

          <Section title="Audit Trail">
            <Field label="Created" value={fmtDate(txn.createdAt)} />
            <Field label="Updated" value={fmtDate(txn.updatedAt)} />
          </Section>
        </Box>
      </Box>
      {/* ── Open Case modal ───────────────────────────────────────────── */}
      {caseModalOpen && (
        <>
          <Box onClick={closeCaseModal} sx={{ position: 'fixed', inset: 0, bgcolor: 'rgba(15,23,42,0.45)', zIndex: 1300 }} />
          <Box sx={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            width: 440, bgcolor: '#ffffff', zIndex: 1301,
            boxShadow: '0 24px 64px rgba(15,23,42,0.18)',
            animation: 'fadeInCase 0.18s ease',
            '@keyframes fadeInCase': {
              from: { opacity: 0, transform: 'translate(-50%, -53%)' },
              to:   { opacity: 1, transform: 'translate(-50%, -50%)' },
            },
          }}>
            {/* Modal header */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2.5, pt: 2.25, pb: 1.75, borderBottom: '1px solid #eef0f4' }}>
              <GavelOutlinedIcon sx={{ fontSize: '1.125rem', color: colorPalette.primary }} />
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
                  Open Investigation Case
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.125 }}>
                  Linked to {txn.id}
                </Typography>
              </Box>
              <IconButton disableRipple size="small" onClick={closeCaseModal} sx={{ borderRadius: 0, color: '#94a3b8', '&:hover': { color: '#475569' } }}>
                <CloseRoundedIcon sx={{ fontSize: '1.125rem' }} />
              </IconButton>
            </Box>

            {/* Modal body */}
            {caseConfirmed ? (
              <Box sx={{ px: 2.5, py: 3.5, textAlign: 'center' }}>
                <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 1.5 }}>
                  <CheckRoundedIcon sx={{ fontSize: '1.25rem', color: '#10b981' }} />
                </Box>
                <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost', mb: 0.5 }}>
                  Case opened
                </Typography>
                <Typography sx={{ fontSize: '0.8125rem', color: '#64748b' }}>
                  Redirecting to AML & Cases…
                </Typography>
              </Box>
            ) : (
              <Box sx={{ px: 2.5, pt: 2, pb: 2.5 }}>
                {/* Subject (read-only) */}
                <Box sx={{ mb: 2 }}>
                  <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.75 }}>Subject</Typography>
                  <Box sx={{ px: 1.25, py: 0.875, bgcolor: '#f8fafc', border: '1px solid #eef0f4' }}>
                    <Typography sx={{ fontSize: '0.8125rem', color: '#0f172a', fontFamily: 'SF Mono, Monaco, monospace', fontWeight: 500 }}>
                      {txn.id} · {txn.customer}
                    </Typography>
                  </Box>
                </Box>

                {/* Typology */}
                <Box sx={{ mb: 2 }}>
                  <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.75 }}>Typology</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.625 }}>
                    {TYPOLOGIES.map(t => {
                      const on = caseTypology === t
                      return (
                        <Box key={t} onClick={() => setCaseTypology(t)} sx={{
                          px: 1.125, py: 0.5, fontSize: '0.75rem', fontWeight: 600, fontFamily: 'Jost',
                          cursor: 'pointer', border: '1px solid',
                          borderColor: on ? colorPalette.primary : '#e2e8f0',
                          color: on ? colorPalette.primary : '#64748b',
                          bgcolor: on ? `${colorPalette.primary}0a` : 'transparent',
                          transition: 'all 0.12s',
                        }}>
                          {t}
                        </Box>
                      )
                    })}
                  </Box>
                </Box>

                {/* Risk summary */}
                <Box sx={{ mb: 2, display: 'flex', gap: 2 }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.75 }}>Risk Score</Typography>
                    <Box sx={{ px: 1.25, py: 0.875, bgcolor: '#f8fafc', border: '1px solid #eef0f4', display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Typography sx={{ fontSize: '1rem', fontWeight: 800, color: riskColor(txn.risk ?? 0), fontFamily: 'Jost' }}>{txn.risk ?? 0}</Typography>
                      <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: riskColor(txn.risk ?? 0), textTransform: 'uppercase' }}>{riskLabel(txn.risk ?? 0)}</Typography>
                    </Box>
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.75 }}>Amount</Typography>
                    <Box sx={{ px: 1.25, py: 0.875, bgcolor: '#f8fafc', border: '1px solid #eef0f4' }}>
                      <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0f172a', fontFamily: 'SF Mono, Monaco, monospace' }}>
                        {fmtAmount(txn.amount, txn.currency)}
                      </Typography>
                    </Box>
                  </Box>
                </Box>

                {/* Notes */}
                <Box sx={{ mb: 0 }}>
                  <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.75 }}>Notes (optional)</Typography>
                  <Box
                    component="textarea"
                    value={caseNotes}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCaseNotes(e.target.value)}
                    placeholder="Add context for the investigating analyst…"
                    rows={3}
                    sx={{
                      width: '100%', display: 'block', resize: 'none',
                      border: '1px solid #e2e8f0', px: 1.25, py: 0.875,
                      fontSize: '0.8125rem', fontFamily: 'Jost, sans-serif', color: '#0f172a',
                      bgcolor: '#ffffff', outline: 'none', boxSizing: 'border-box',
                      '&:focus': { borderColor: colorPalette.primary },
                      '&::placeholder': { color: '#94a3b8' },
                    }}
                  />
                </Box>
              </Box>
            )}

            {/* Modal footer */}
            {!caseConfirmed && (
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, px: 2.5, pb: 2.25, pt: 0 }}>
                <Box onClick={closeCaseModal} sx={{ px: 2, py: 0.875, fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Jost', color: '#64748b', border: '1px solid #e2e8f0', cursor: 'pointer', transition: 'all 0.15s', '&:hover': { borderColor: '#94a3b8', color: '#475569' } }}>
                  Cancel
                </Box>
                <Box onClick={confirmCase} sx={{ px: 2, py: 0.875, fontSize: '0.8125rem', fontWeight: 700, fontFamily: 'Jost', color: '#ffffff', bgcolor: colorPalette.primary, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 0.75, transition: 'opacity 0.15s', '&:hover': { opacity: 0.9 } }}>
                  <GavelOutlinedIcon sx={{ fontSize: '0.9375rem' }} />
                  Open Case
                </Box>
              </Box>
            )}
          </Box>
        </>
      )}
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box sx={{ mb: 2.25 }}>
      <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.14em', mb: 1 }}>
        {title}
      </Typography>
      <Box sx={{ border: '1px solid #eef0f4', p: 1.5 }}>{children}</Box>
    </Box>
  )
}

function Field({ label, value, mono = false }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '108px 1fr', gap: 1, mb: 0.875, '&:last-child': { mb: 0 }, alignItems: 'start' }}>
      <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', fontWeight: 600, pt: 0.125, lineHeight: 1.4 }}>
        {label}
      </Typography>
      <Typography sx={{
        fontSize: '0.8125rem', color: value ? '#0f172a' : '#cbd5e1',
        fontFamily: mono ? 'SF Mono, Monaco, monospace' : 'Jost, sans-serif',
        fontWeight: mono ? 500 : 400, lineHeight: 1.4, wordBreak: 'break-all',
      }}>
        {value || '—'}
      </Typography>
    </Box>
  )
}

function ActionBtn({ label, icon, color, active, disabled, onClick }: {
  label: string; icon: React.ReactNode; color: string
  active: boolean; disabled: boolean; onClick: () => void
}) {
  return (
    <Stack direction="row" alignItems="center" gap={0.5} onClick={disabled ? undefined : onClick} sx={{
      px: 1.25, py: 0.625,
      border: '1px solid', borderColor: active ? color : '#e2e8f0',
      color: active ? color : '#64748b',
      bgcolor: active ? `${color}0f` : 'transparent',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.6 : 1,
      transition: 'all 0.15s',
      '&:hover': disabled ? {} : { borderColor: color, color, bgcolor: `${color}0a` },
    }}>
      {icon}
      <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, fontFamily: 'Jost', lineHeight: 1 }}>{label}</Typography>
    </Stack>
  )
}
