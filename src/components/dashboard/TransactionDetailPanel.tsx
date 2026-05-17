import { useState, useCallback, useEffect } from 'react'
import { Box, Typography, Stack, IconButton, Button } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { colorPalette } from '@/theme'
import { transactionApi, type Transaction, type FlaggedStatus } from '@/api/transactions'
import { authApi } from '@/api/auth'
import { caseApi, type Case } from '@/api/cases'
import { customerApi } from '@/api/customers'
import CaseIntakeDrawer, { type CaseIntakePayload } from '@/components/dashboard/CaseIntakeDrawer'
import InvestigationWorkspace from '@/components/dashboard/InvestigationWorkspace'
import ActionEvidenceDialog, { type EvidencePayload } from '@/components/dashboard/ActionEvidenceDialog'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import BlockRoundedIcon from '@mui/icons-material/BlockRounded'
import FlagRoundedIcon from '@mui/icons-material/FlagRounded'
import HourglassEmptyRoundedIcon from '@mui/icons-material/HourglassEmptyRounded'
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import AccountCircleOutlinedIcon from '@mui/icons-material/AccountCircleOutlined'
import { getDisplayTimezone } from '@/utils/dateTime'

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

const CASE_ELIGIBLE_FLAGS = new Set<FlaggedStatus>(['flagged', 'blocked', 'review'])

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
      timeZone: getDisplayTimezone(),
      timeZoneName: 'short',
    }).format(new Date(iso))
  } catch { return iso }
}

function fmtAmount(amount: number, currency = 'NGN') {
  try {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount)
  } catch { return `₦${amount.toLocaleString()}` }
}

export default function TransactionDetailPanel({ transaction: txn, open, onClose, onStatusChange }: Props) {
  const [actionFlaggedStatus, setActionFlaggedStatus] = useState<FlaggedStatus | null>(null)
  const [actioning,           setActioning]           = useState(false)

  // Step 1: evidence dialog
  const [evidencePending, setEvidencePending] = useState<FlaggedStatus | null>(null)
  const [pendingReason,   setPendingReason]   = useState('')
  const [pendingDocId,    setPendingDocId]    = useState<number | null>(null)

  // Step 2: OTP dialog
  const [otpPending,  setOtpPending]  = useState<FlaggedStatus | null>(null)
  const [otpCode,     setOtpCode]     = useState('')
  const [otpError,    setOtpError]    = useState<string | null>(null)
  const [otpLoading,  setOtpLoading]  = useState(false)

  const [existingCase,    setExistingCase]    = useState<Case | null>(null)
  const [checkingCase,    setCheckingCase]    = useState(false)
  const [intakeOpen,      setIntakeOpen]      = useState(false)
  const [workspaceOpen,   setWorkspaceOpen]   = useState(false)
  const [activeCaseId,    setActiveCaseId]    = useState<string | null>(null)
  const [creating,        setCreating]        = useState(false)
  const [createErr,       setCreateErr]       = useState<string | null>(null)
  const [watchlisted,     setWatchlisted]     = useState(false)

  const navigate = useNavigate()

  const currentFlagged = (actionFlaggedStatus ?? txn?.flaggedStatus ?? null) as FlaggedStatus | null
  const flaggedCfg     = currentFlagged ? FLAGGED_STATUS_CFG[currentFlagged] : null
  const paymentCfg     = PAYMENT_STATUS_CFG[txn?.status ?? 'pending'] ?? PAYMENT_STATUS_CFG.pending

  const canOpenCase = currentFlagged != null && CASE_ELIGIBLE_FLAGS.has(currentFlagged)

  // Check for existing case and customer watchlist status whenever the transaction changes
  useEffect(() => {
    if (!open || !txn) return
    setExistingCase(null)
    setActionFlaggedStatus(null)
    setWatchlisted(false)
    setCheckingCase(true)
    caseApi.forTransaction(txn.id)
      .then(res => setExistingCase(res.case))
      .catch(() => {})
      .finally(() => setCheckingCase(false))
    customerApi.getCustomer(txn.customerId)
      .then(c => setWatchlisted(c.watchlisted))
      .catch(() => {})
  }, [open, txn?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const requestFlag = (flag: FlaggedStatus) => {
    if (!txn || actioning || flag === currentFlagged) return
    setEvidencePending(flag)
  }

  const handleEvidenceConfirm = (payload: EvidencePayload) => {
    if (!evidencePending) return
    setPendingReason(payload.reason)
    setPendingDocId(payload.documentId)
    setEvidencePending(null)
    setOtpPending(evidencePending)
    setOtpCode('')
    setOtpError(null)
  }

  const confirmOtp = useCallback(async () => {
    if (!otpPending || otpLoading || !txn || pendingDocId === null) return
    setOtpLoading(true)
    setOtpError(null)
    try {
      await authApi.stepUpTotp(otpCode)
      setActioning(true)
      await transactionApi.bulkFlaggedStatus([txn.id], otpPending, pendingReason, pendingDocId)
      setActionFlaggedStatus(otpPending)
      onStatusChange()
      setOtpPending(null)
      setOtpCode('')
    } catch {
      setOtpError('Invalid code — please try again.')
    } finally {
      setOtpLoading(false)
      setActioning(false)
    }
  }, [otpPending, otpLoading, otpCode, txn, pendingReason, pendingDocId, onStatusChange])

  const handleIntakeSubmit = useCallback(async (payload: CaseIntakePayload) => {
    if (creating) return
    setCreating(true)
    setCreateErr(null)
    try {
      const result = await caseApi.create(payload.caseInput)
      await caseApi.addEvidence(result.case.id, payload.evidence)
      setExistingCase(result.case)
      setActiveCaseId(result.case.id)
      setWorkspaceOpen(true)
      onStatusChange()
    } catch (e) {
      setCreateErr(e instanceof Error ? e.message : 'Failed to open case')
    } finally {
      setCreating(false)
    }
  }, [creating, onStatusChange])

  // Keep component alive while intake or workspace is open
  if (!open && !intakeOpen && !workspaceOpen) return null

  const risk = txn?.risk ?? 0
  const rc   = riskColor(risk)

  return (
    <>
      {/* ── Transaction detail panel ──────────────────────────────────────── */}
      {open && txn && (
        <>
          <Box onClick={onClose} sx={{ position: 'fixed', inset: 0, bgcolor: 'rgba(15,23,42,0.3)', zIndex: 1200 }} />
          <Box sx={{
            position: 'fixed', top: 0, right: 0, bottom: 0,
            width: 440, bgcolor: '#ffffff', zIndex: 1201,
            boxShadow: '-8px 0 40px rgba(15,23,42,0.14)',
            display: 'flex', flexDirection: 'column',
            animation: 'slideInPanel 0.24s cubic-bezier(0.4,0,0.2,1)',
            '@keyframes slideInPanel': { from: { transform: 'translateX(100%)' }, to: { transform: 'translateX(0)' } },
          }}>

            {/* ── Sticky header ───────────────────────────────────────── */}
            <Box sx={{ flexShrink: 0, borderBottom: '1px solid #eef0f4' }}>

              {/* Row 1: ID + status badges + close */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2.5, pt: 2.5, pb: 1.25 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 0.25 }}>
                    Transaction
                  </Typography>
                  <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#00288e', fontFamily: 'SF Mono, Monaco, monospace', letterSpacing: '-0.01em' }}>
                    {txn.id}
                  </Typography>
                </Box>
                <Box sx={{ px: 1, py: 0.375, bgcolor: paymentCfg.bg, flexShrink: 0 }}>
                  <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: paymentCfg.color, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    {paymentCfg.label}
                  </Typography>
                </Box>
                {flaggedCfg && (
                  <Box sx={{ px: 1, py: 0.375, bgcolor: flaggedCfg.bg, border: `1px solid ${flaggedCfg.color}30`, flexShrink: 0 }}>
                    <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: flaggedCfg.color, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                      {flaggedCfg.label}
                    </Typography>
                  </Box>
                )}
                {watchlisted && (
                  <Box sx={{ px: 1, py: 0.375, bgcolor: '#fef3c7', border: '1px solid #fde68a', flexShrink: 0 }}>
                    <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                      Watchlisted
                    </Typography>
                  </Box>
                )}
                <Button
                  size="small"
                  startIcon={<AccountCircleOutlinedIcon sx={{ fontSize: '1rem !important' }} />}
                  onClick={() => navigate(`/dashboard/users/${txn.customerId}`)}
                  sx={{
                    ml: 1,
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    color: colorPalette.primary,
                    textTransform: 'none',
                    fontFamily: 'Jost',
                    '&:hover': { bgcolor: `${colorPalette.primary}0a` }
                  }}
                >
                  View Profile
                </Button>
                <IconButton disableRipple size="small" onClick={onClose} sx={{ borderRadius: 0, color: '#94a3b8', '&:hover': { color: '#475569' } }}>
                  <CloseRoundedIcon sx={{ fontSize: '1.125rem' }} />
                </IconButton>
              </Box>

              {/* Row 2: Amount */}
              <Box sx={{ px: 2.5, pb: 1.5 }}>
                <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost', letterSpacing: '-0.02em' }}>
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
                  <ActionBtn label="Clear"    icon={<CheckRoundedIcon          sx={{ fontSize: '0.875rem !important' }} />} color="#10b981"            active={currentFlagged === 'cleared'} disabled={actioning} onClick={() => requestFlag('cleared')} />
                  <ActionBtn label="Review"   icon={<HourglassEmptyRoundedIcon sx={{ fontSize: '0.875rem !important' }} />} color={colorPalette.primary} active={currentFlagged === 'review'}  disabled={actioning} onClick={() => requestFlag('review')}  />
                  <ActionBtn label="Escalate" icon={<FlagRoundedIcon           sx={{ fontSize: '0.875rem !important' }} />} color="#f59e0b"            active={currentFlagged === 'flagged'} disabled={actioning} onClick={() => requestFlag('flagged')} />
                  <ActionBtn label="Block"    icon={<BlockRoundedIcon          sx={{ fontSize: '0.875rem !important' }} />} color="#dc2626"            active={currentFlagged === 'blocked'} disabled={actioning} onClick={() => requestFlag('blocked')} />
                </Box>
              </Box>

              {/* Row 4: Case CTA */}
              <Box sx={{ px: 2.5, pb: 1.75, borderTop: '1px solid #f1f5f9', pt: 1.25 }}>
                {checkingCase ? (
                  <Box sx={{ height: 40, bgcolor: '#f8fafc', border: '1px solid #eef0f4', display: 'flex', alignItems: 'center', px: 1.5 }}>
                    <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>Checking investigation status…</Typography>
                  </Box>
                ) : existingCase ? (
                  <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}
                    onClick={() => { setActiveCaseId(existingCase.id); setWorkspaceOpen(true) }}
                    sx={{ px: 1.5, py: 0.875, border: `1px solid ${colorPalette.primary}40`, cursor: 'pointer', bgcolor: `${colorPalette.primary}06`, transition: 'all 0.15s', '&:hover': { bgcolor: `${colorPalette.primary}0e` } }}>
                    <Stack direction="row" alignItems="center" gap={0.75}>
                      <GavelOutlinedIcon sx={{ fontSize: '0.9375rem', color: colorPalette.primary }} />
                      <Box>
                        <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: colorPalette.primary, fontFamily: 'Jost' }}>
                          View Investigation
                        </Typography>
                        <Typography sx={{ fontSize: '0.625rem', color: '#64748b' }}>{existingCase.id}</Typography>
                      </Box>
                    </Stack>
                    <OpenInNewRoundedIcon sx={{ fontSize: '0.875rem', color: colorPalette.primary }} />
                  </Stack>
                ) : canOpenCase ? (
                  <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}
                    onClick={() => setIntakeOpen(true)}
                    sx={{ px: 1.5, py: 0.875, border: '1px solid #e2e8f0', cursor: 'pointer', transition: 'all 0.15s', '&:hover': { borderColor: colorPalette.primary, bgcolor: `${colorPalette.primary}06` } }}>
                    <Stack direction="row" alignItems="center" gap={0.75}>
                      <GavelOutlinedIcon sx={{ fontSize: '0.9375rem', color: colorPalette.primary }} />
                      <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost' }}>
                        Open Investigation Case
                      </Typography>
                    </Stack>
                    <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8' }}>Escalate to AML →</Typography>
                  </Stack>
                ) : (
                  <Box sx={{ px: 1.5, py: 0.875, border: '1px solid #eef0f4', bgcolor: '#fafbfc', display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <GavelOutlinedIcon sx={{ fontSize: '0.9375rem', color: '#cbd5e1' }} />
                    <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                      Flag or escalate the transaction to open a case
                    </Typography>
                  </Box>
                )}
                {createErr && (
                  <Typography sx={{ fontSize: '0.75rem', color: '#dc2626', mt: 0.75 }}>{createErr}</Typography>
                )}
              </Box>
            </Box>

            {/* ── Scrollable body ───────────────────────────────────────── */}
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

              {/* ── Flag reasons ─────────────────────────────────────────── */}
              {(txn.flagReasons?.length || txn.flagReason) && (
                <Box sx={{ mb: 2.5, p: 1.75, border: '1px solid #fde68a', bgcolor: '#fffbeb' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
                    <FlagRoundedIcon sx={{ fontSize: '0.875rem', color: '#d97706' }} />
                    <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                      Why this transaction was flagged
                    </Typography>
                  </Box>
                  {txn.flagReasons?.length ? (
                    <Box component="ul" sx={{ m: 0, pl: 2.25, '& li': { fontSize: '0.8125rem', color: '#78350f', lineHeight: 1.65, mb: 0.5, '&:last-child': { mb: 0 } } }}>
                      {txn.flagReasons.map((r, i) => <li key={i}>{r}</li>)}
                    </Box>
                  ) : (
                    <Typography sx={{ fontSize: '0.8125rem', color: '#78350f', lineHeight: 1.65 }}>
                      {txn.flagReason}
                    </Typography>
                  )}
                </Box>
              )}

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
        </>
      )}

      {/* ── Case intake drawer ─────────────────────────────────────────────── */}
      <CaseIntakeDrawer
        open={intakeOpen}
        onClose={() => setIntakeOpen(false)}
        onSubmit={handleIntakeSubmit}
        initialTransaction={txn ?? undefined}
      />

      {/* ── Investigation workspace ────────────────────────────────────────── */}
      <InvestigationWorkspace
        caseId={activeCaseId}
        open={workspaceOpen}
        onClose={() => setWorkspaceOpen(false)}
        onUpdated={onStatusChange}
      />

      {/* ── Step 1: Evidence + reason dialog ──────────────────────────────── */}
      {evidencePending && (
        <ActionEvidenceDialog
          open
          onClose={() => setEvidencePending(null)}
          onConfirm={handleEvidenceConfirm}
          title="Confirm Status Change"
          actionLabel={FLAGGED_STATUS_CFG[evidencePending].label}
          actionColor={FLAGGED_STATUS_CFG[evidencePending].color}
        />
      )}

      {/* ── Step 2: OTP step-up confirmation ──────────────────────────────── */}
      {otpPending && (
        <>
          <Box onClick={() => { setOtpPending(null); setOtpCode(''); setOtpError(null) }}
            sx={{ position: 'fixed', inset: 0, bgcolor: 'rgba(15,23,42,0.45)', zIndex: 1400 }} />
          <Box sx={{
            position: 'fixed', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 380, bgcolor: '#ffffff', zIndex: 1401,
            boxShadow: '0 24px 60px rgba(15,23,42,0.18)',
            animation: 'otpFadeIn 0.2s ease',
            '@keyframes otpFadeIn': { from: { opacity: 0, transform: 'translate(-50%, -48%)' }, to: { opacity: 1, transform: 'translate(-50%, -50%)' } },
          }}>
            {/* Dialog header */}
            <Box sx={{ px: 2.5, pt: 2.5, pb: 1.75, borderBottom: '1px solid #eef0f4', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <Box>
                <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost' }}>
                  Confirm Status Change
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.375 }}>
                  Marking as{' '}
                  <Box component="span" sx={{ fontWeight: 700, color: FLAGGED_STATUS_CFG[otpPending].color }}>
                    {FLAGGED_STATUS_CFG[otpPending].label}
                  </Box>
                  {' '}requires verification.
                </Typography>
              </Box>
              <IconButton disableRipple size="small"
                onClick={() => { setOtpPending(null); setOtpCode(''); setOtpError(null) }}
                sx={{ borderRadius: 0, color: '#94a3b8', mt: -0.25, '&:hover': { color: '#475569' } }}>
                <CloseRoundedIcon sx={{ fontSize: '1rem' }} />
              </IconButton>
            </Box>

            {/* Dialog body */}
            <Box sx={{ px: 2.5, py: 2 }}>
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 1.25 }}>
                Authenticator Code
              </Typography>
              <Box
                component="input"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                value={otpCode}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setOtpError(null)
                  setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                }}
                onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter') confirmOtp() }}
                autoFocus
                sx={{
                  width: '100%', boxSizing: 'border-box',
                  border: `1px solid ${otpError ? '#dc2626' : '#e2e8f0'}`,
                  bgcolor: '#fafbfc',
                  px: 1.75, py: 1.25,
                  fontSize: '1.5rem', fontWeight: 700, letterSpacing: '0.35em',
                  fontFamily: 'SF Mono, Monaco, monospace',
                  color: '#00288e', outline: 'none',
                  textAlign: 'center',
                  transition: 'border-color 0.15s',
                  '&:focus': { borderColor: colorPalette.primary, bgcolor: '#ffffff' },
                  '&::placeholder': { color: '#cbd5e1', letterSpacing: '0.2em' },
                }}
              />
              {otpError && (
                <Typography sx={{ fontSize: '0.6875rem', color: '#dc2626', mt: 0.75, fontWeight: 600 }}>
                  {otpError}
                </Typography>
              )}
              <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', mt: 1 }}>
                Enter the 6-digit code from your authenticator app.
              </Typography>
            </Box>

            {/* Dialog footer */}
            <Box sx={{ px: 2.5, pb: 2.5, display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
              <Box
                onClick={() => { setOtpPending(null); setOtpCode(''); setOtpError(null) }}
                sx={{
                  px: 2, py: 0.875, border: '1px solid #e2e8f0', cursor: 'pointer',
                  color: '#64748b', fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Jost',
                  transition: 'all 0.15s', '&:hover': { borderColor: '#94a3b8', color: '#334155' },
                }}
              >
                Cancel
              </Box>
              <Box
                onClick={confirmOtp}
                sx={{
                  px: 2, py: 0.875, cursor: otpLoading || otpCode.length < 6 ? 'not-allowed' : 'pointer',
                  bgcolor: otpCode.length < 6 ? '#e2e8f0' : FLAGGED_STATUS_CFG[otpPending].color,
                  color: otpCode.length < 6 ? '#94a3b8' : '#ffffff',
                  fontSize: '0.8125rem', fontWeight: 700, fontFamily: 'Jost',
                  opacity: otpLoading ? 0.7 : 1,
                  transition: 'all 0.15s',
                }}
              >
                {otpLoading ? 'Verifying…' : `Confirm ${FLAGGED_STATUS_CFG[otpPending].label}`}
              </Box>
            </Box>
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
        fontSize: '0.8125rem', color: value ? '#00288e' : '#cbd5e1',
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
