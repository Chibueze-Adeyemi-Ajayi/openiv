import {
  Drawer, Box, Typography, CircularProgress, Chip, Button, Stack, Divider,
  IconButton, Snackbar, Alert, ToggleButtonGroup, ToggleButton,
} from '@mui/material'
import { colorPalette } from '@/theme'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { transactionApi, type Transaction } from '@/api/transactions'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined'
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined'
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded'
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'

// ── Cluster mode (Nigeria map) ────────────────────────────────────────────────
export interface ClusterSource {
  type: 'cluster'
  lat: number
  lng: number
  radiusKm?: number
  range: string       // '24h' | '7d' | '30d' etc — matches NigeriaRiskMap range
  count: number
  avgRisk: number | null
  hasFlag: boolean
}

// ── Date mode (Heatmap cell click) ───────────────────────────────────────────
export interface DateSource {
  type: 'date'
  date: string        // YYYY-MM-DD
  label: string       // e.g. "Monday, 5 May 2026"
}

export type ClusterDrawerSource = ClusterSource | DateSource

interface Props {
  source: ClusterDrawerSource | null
  onClose: () => void
}

// ── Haversine distance ────────────────────────────────────────────────────────
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ── Risk helpers ──────────────────────────────────────────────────────────────
function riskColor(score: number) {
  if (score >= 70) return '#dc2626'
  if (score >= 40) return '#f59e0b'
  return '#10b981'
}
function riskLabel(score: number) {
  if (score >= 70) return 'High risk'
  if (score >= 40) return 'Suspicious'
  return 'Normal'
}
function riskBg(score: number) {
  if (score >= 70) return '#fef2f2'
  if (score >= 40) return '#fffbeb'
  return '#f0fdf4'
}

function fmt(n: number) {
  return n.toLocaleString('en-NG')
}
function fmtAmt(amount: number) {
  if (amount >= 1_000_000) return `₦${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000)     return `₦${(amount / 1_000).toFixed(0)}k`
  return `₦${fmt(amount)}`
}

// ── Fuzzy-logic flag reason generator ────────────────────────────────────────
function generateFlagReason(txn: Transaction): string {
  const risk     = txn.risk    ?? 0
  const amount   = txn.amount  ?? 0
  const channel  = (txn.channel  ?? '').toLowerCase()
  const narration = (txn.narration ?? '').toLowerCase()

  const signals: string[] = []

  // Amount — gradual membership escalation
  if (amount >= 10_000_000)
    signals.push(`the transfer amount of ${fmtAmt(amount)} is exceptionally large and well above routine thresholds for this channel`)
  else if (amount >= 5_000_000)
    signals.push(`the transaction value of ${fmtAmt(amount)} substantially exceeds the expected range for this account type`)
  else if (amount >= 2_000_000)
    signals.push(`the amount of ${fmtAmt(amount)} is above average for this channel and warrants closer review`)

  // Risk score — fuzzy membership: high peaks above 70, medium between 40–70
  const highMembership = risk >= 70 ? Math.min(1, (risk - 70) / 20 + 0.5) : 0
  const medMembership  = risk >= 40 && risk < 70 ? 1 - Math.abs(risk - 55) / 30 : 0
  if (highMembership > 0.4)
    signals.push(`the automated risk engine assigned a score of ${risk} out of 100, indicating a high probability of suspicious activity`)
  else if (medMembership > 0.4)
    signals.push(`the risk engine scored this transaction at ${risk} out of 100, placing it in the elevated-risk range that requires manual verification`)

  // Channel signals
  if (channel.includes('ussd'))
    signals.push(`the USSD channel was used, which is frequently associated with SIM-swap and unattended device fraud`)
  else if (channel.includes('pos'))
    signals.push(`the point-of-sale channel showed an activity pattern inconsistent with the customer's usual behaviour`)

  // Narration keyword signals — first match wins
  const narrationRules: { keywords: string[]; reason: string }[] = [
    { keywords: ['emergency', 'urgent', 'immediately', 'asap'], reason: 'the transaction narration contains urgency markers commonly used in social engineering attacks' },
    { keywords: ['investment', 'profit', 'return', 'dividend', 'roi'], reason: 'the narration references investment returns, a pattern frequently linked to advance-fee fraud' },
    { keywords: ['loan', 'advance', 'repay', 'borrow'], reason: 'the narration indicates a loan or advance arrangement that may obscure the true purpose of the funds' },
    { keywords: ['gift card', 'voucher', 'recharge'], reason: 'the narration references gift cards or vouchers, a hallmark of online scam payments' },
  ]
  for (const rule of narrationRules) {
    if (rule.keywords.some(kw => narration.includes(kw))) {
      signals.push(rule.reason)
      break
    }
  }

  // Graceful fallback — always produce a reason
  if (signals.length === 0) {
    return `This transaction was reviewed by the automated risk engine and flagged based on a combination of behavioural signals. The risk score of ${risk} out of 100 for a ${fmtAmt(amount)} transfer via ${txn.channel || 'this channel'} falls outside normal parameters and warrants manual review before the activity is cleared.`
  }

  if (signals.length === 1) {
    return `This transaction was flagged because ${signals[0]}. Our compliance system recommends a manual review before this activity is cleared.`
  }

  const [primary, ...rest] = signals
  const joined = rest.length === 1
    ? `and ${rest[0]}`
    : `${rest.slice(0, -1).join(', ')}, and ${rest[rest.length - 1]}`
  return `This transaction was flagged because ${primary}, ${joined}. Our compliance system recommends a manual review before this activity is cleared.`
}

// ── AI Flag dialog ────────────────────────────────────────────────────────────
function AiFlagDialog({
  open,
  txn,
  onClose,
  onConfirm,
}: {
  open: boolean
  txn: Transaction | null
  onClose: () => void
  onConfirm: (reason: string) => Promise<void>
}) {
  const [reason,    setReason]    = useState('')
  const [loading,   setLoading]   = useState(false)
  const [analysing, setAnalysing] = useState(true)

  useEffect(() => {
    if (open && txn) {
      setAnalysing(true)
      setReason('')
      const t = setTimeout(() => {
        setReason(generateFlagReason(txn))
        setAnalysing(false)
      }, 800)
      return () => clearTimeout(t)
    }
  }, [open, txn])

  const handleConfirm = async () => {
    if (!reason.trim() || loading) return
    setLoading(true)
    try {
      await onConfirm(reason.trim())
    } finally {
      setLoading(false)
    }
  }

  if (!open || !txn) return null

  return (
    <>
      <Box
        onClick={onClose}
        sx={{ position: 'fixed', inset: 0, bgcolor: 'rgba(15,23,42,0.5)', zIndex: 1500 }}
      />
      <Box sx={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 480, bgcolor: 'var(--card-bg)', zIndex: 1501,
        boxShadow: '0 24px 64px rgba(15,23,42,0.2)',
        animation: 'aiFlagIn 0.2s ease',
        '@keyframes aiFlagIn': {
          from: { opacity: 0, transform: 'translate(-50%, -47%)' },
          to:   { opacity: 1, transform: 'translate(-50%, -50%)' },
        },
      }}>
        {/* Header */}
        <Box sx={{
          px: 2.5, pt: 2.25, pb: 1.75,
          borderBottom: '1px solid var(--border-col)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          bgcolor: 'var(--card-bg)',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{
              width: 32, height: 32,
              bgcolor: colorPalette.primary, display: 'flex',
              alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <AutoAwesomeOutlinedIcon sx={{ color: '#fff', fontSize: '1rem' }} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost' }}>
                AI Risk Analysis
              </Typography>
              <Typography sx={{ fontSize: '0.6875rem', color: '#64748b' }}>
                Automated flag reason generated from transaction signals
              </Typography>
            </Box>
          </Box>
          <Box
            onClick={onClose}
            sx={{ cursor: 'pointer', color: '#94a3b8', mt: 0.25, display: 'flex', '&:hover': { color: 'var(--on-surface-variant)' } }}
          >
            <CloseRoundedIcon sx={{ fontSize: '1rem' }} />
          </Box>
        </Box>

        {/* Body */}
        <Box sx={{ px: 2.5, py: 2 }}>
          {/* Risk summary chip */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Box sx={{
              px: 1.25, py: 0.375,
              bgcolor: riskBg(txn.risk ?? 0),
              border: `1px solid ${riskColor(txn.risk ?? 0)}30`,
              display: 'flex', alignItems: 'center', gap: 0.75,
            }}>
              {(txn.risk ?? 0) >= 70
                ? <ErrorOutlineRoundedIcon sx={{ fontSize: '0.875rem', color: riskColor(txn.risk ?? 0) }} />
                : <WarningAmberRoundedIcon sx={{ fontSize: '0.875rem', color: riskColor(txn.risk ?? 0) }} />}
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: riskColor(txn.risk ?? 0), fontFamily: 'Jost' }}>
                Risk {txn.risk ?? 0}/100 · {riskLabel(txn.risk ?? 0)}
              </Typography>
            </Box>
            <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8' }}>
              {fmtAmt(txn.amount)} · {txn.channel}
            </Typography>
          </Box>

          {/* AI-generated reason */}
          <Box sx={{ mb: 0.75 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>
              <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Flag Reason
              </Typography>
              {!analysing && (
                <Box sx={{
                  px: 0.75, py: 0.125,
                  bgcolor: `${colorPalette.primary}12`,
                  border: `1px solid ${colorPalette.primary}25`,
                  display: 'flex', alignItems: 'center', gap: 0.5,
                }}>
                  <AutoAwesomeOutlinedIcon sx={{ fontSize: '0.625rem', color: colorPalette.primary }} />
                  <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: colorPalette.primary, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    AI Generated
                  </Typography>
                </Box>
              )}
            </Box>

            {analysing ? (
              <Box sx={{
                minHeight: 88, border: '1px solid var(--border-col)', bgcolor: 'var(--section-bg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5,
              }}>
                <CircularProgress size={16} sx={{ color: colorPalette.primary }} />
                <Typography sx={{ fontSize: '0.8125rem', color: '#64748b', fontFamily: 'Jost' }}>
                  Analysing transaction signals…
                </Typography>
              </Box>
            ) : (
              <Box
                component="textarea"
                value={reason}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)}
                rows={5}
                sx={{
                  width: '100%', boxSizing: 'border-box', display: 'block', resize: 'vertical',
                  border: '1px solid var(--border-col)', px: 1.25, py: 0.875,
                  fontSize: '0.8125rem', fontFamily: 'Jost, sans-serif',
                  color: 'var(--heading-color)', bgcolor: 'var(--card-bg)', outline: 'none', lineHeight: 1.65,
                  '&:focus': { borderColor: colorPalette.primary, bgcolor: '#fff' },
                }}
              />
            )}
          </Box>
          <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', mt: 0.5 }}>
            You may edit the reason before confirming. This will be recorded in the audit trail.
          </Typography>
        </Box>

        {/* Footer */}
        <Box sx={{ px: 2.5, pb: 2.25, display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          <Box
            onClick={onClose}
            sx={{
              px: 2, py: 0.875, border: '1px solid var(--border-col)', cursor: 'pointer',
              color: '#64748b', fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Jost',
              transition: 'all 0.15s', '&:hover': { borderColor: '#94a3b8', color: 'var(--on-surface-variant)' },
            }}
          >
            Cancel
          </Box>
          <Box
            onClick={handleConfirm}
            sx={{
              px: 2.25, py: 0.875,
              cursor: (!analysing && reason.trim() && !loading) ? 'pointer' : 'not-allowed',
              bgcolor: (!analysing && reason.trim() && !loading) ? '#dc2626' : '#e2e8f0',
              color:   (!analysing && reason.trim() && !loading) ? '#fff'     : '#94a3b8',
              fontSize: '0.8125rem', fontWeight: 700, fontFamily: 'Jost',
              display: 'flex', alignItems: 'center', gap: 0.75,
              transition: 'all 0.15s', '&:hover': (!analysing && reason.trim() && !loading) ? { opacity: 0.88 } : {},
            }}
          >
            {loading && <CircularProgress size={12} sx={{ color: 'inherit' }} />}
            <FlagOutlinedIcon sx={{ fontSize: '0.875rem' }} />
            Confirm Flag
          </Box>
        </Box>
      </Box>
    </>
  )
}

// ── Transaction row ───────────────────────────────────────────────────────────
function TxnRow({
  txn,
  onView,
}: {
  txn: Transaction
  onView: (txn: Transaction) => void
}) {
  const risk = txn.risk ?? 0
  return (
    <Box
      onClick={() => onView(txn)}
      sx={{
        px: 2.5, py: 1.75, cursor: 'pointer',
        borderBottom: '1px solid var(--border-col)',
        display: 'flex', alignItems: 'flex-start', gap: 1.5,
        transition: 'background 0.15s',
        '&:hover': { bgcolor: 'var(--card-bg)' },
        '&:last-child': { borderBottom: 'none' },
      }}
    >
      {/* Risk badge */}
      <Box
        sx={{
          width: 36, height: 36, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          bgcolor: riskBg(risk),
          color: riskColor(risk),
        }}
      >
        {risk >= 70
          ? <ErrorOutlineRoundedIcon sx={{ fontSize: '1.125rem' }} />
          : risk >= 40
            ? <WarningAmberRoundedIcon sx={{ fontSize: '1.125rem' }} />
            : <FlagOutlinedIcon sx={{ fontSize: '1.125rem' }} />}
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
          <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {txn.customer || txn.customerId}
          </Typography>
          <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'SF Mono, Monaco, monospace', flexShrink: 0, ml: 1 }}>
            {fmtAmt(txn.amount)}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>
            {txn.channel} · {txn.location || 'Unknown location'}
          </Typography>
          <Chip
            label={`${risk} · ${riskLabel(risk)}`}
            size="small"
            sx={{
              height: 18, fontSize: '0.5625rem', fontWeight: 700,
              bgcolor: riskBg(risk), color: riskColor(risk),
              borderRadius: 0, fontFamily: 'Jost',
              '& .MuiChip-label': { px: 0.75 },
            }}
          />
        </Box>
      </Box>
    </Box>
  )
}

// ── Transaction detail panel ──────────────────────────────────────────────────
function TxnDetail({
  txn,
  onBack,
  onClose,
  onUpdated,
}: {
  txn: Transaction
  onBack: () => void
  onClose: () => void
  onUpdated?: () => void
}) {
  const navigate = useNavigate()
  const [flagDialogOpen, setFlagDialogOpen] = useState(false)
  const [flagged,  setFlagged]  = useState(txn.flaggedStatus === 'flagged')
  const [snackbar, setSnackbar] = useState(false)

  const handleFlagConfirm = async (reason: string) => {
    await transactionApi.bulkFlaggedStatus([txn.id], 'flagged', reason)
    setFlagged(true)
    setFlagDialogOpen(false)
    setSnackbar(true)
    onUpdated?.()
  }

  const risk = txn.risk ?? 0
  const rows: { label: string; value: string | number | undefined }[] = [
    { label: 'Transaction ID', value: txn.id },
    { label: 'Customer', value: txn.customer || txn.customerId },
    { label: 'Amount', value: fmtAmt(txn.amount) },
    { label: 'Channel', value: txn.channel },
    { label: 'Status', value: txn.status },
    { label: 'Counterparty', value: txn.counterparty },
    { label: 'Sender Account', value: txn.senderAccount },
    { label: 'Sender Bank', value: txn.senderBank },
    { label: 'Recipient', value: txn.recipientName },
    { label: 'Recipient Account', value: txn.recipientAccount },
    { label: 'Recipient Bank', value: txn.recipientBank },
    { label: 'Narration', value: txn.narration },
    { label: 'Location', value: txn.location },
    { label: 'IP Address', value: txn.ipAddress },
    { label: 'Device ID', value: txn.deviceId },
  ].filter(r => r.value !== undefined && r.value !== null && r.value !== '')

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid var(--border-col)', bgcolor: 'var(--card-bg)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }} onClick={onBack}>
          <ArrowForwardRoundedIcon sx={{ fontSize: '0.875rem', color: '#64748b', transform: 'rotate(180deg)' }} />
          <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: '#64748b', fontFamily: 'Jost' }}>
            Back to list
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ color: '#64748b', borderRadius: 0 }}>
          <CloseRoundedIcon sx={{ fontSize: '1.125rem' }} />
        </IconButton>
      </Box>

      {/* Risk banner */}
      <Box sx={{ px: 3, py: 2, bgcolor: riskBg(risk), borderBottom: `1px solid ${riskColor(risk)}22`, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box sx={{ width: 44, height: 44, bgcolor: '#fff', border: `1px solid ${riskColor(risk)}30`, color: riskColor(risk), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {risk >= 70 ? <ErrorOutlineRoundedIcon sx={{ fontSize: '1.5rem' }} /> : <WarningAmberRoundedIcon sx={{ fontSize: '1.5rem' }} />}
        </Box>
        <Box>
          <Typography sx={{ fontSize: '1.25rem', fontWeight: 800, color: riskColor(risk), fontFamily: 'Jost', lineHeight: 1 }}>
            Risk {risk}/100
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', color: riskColor(risk), opacity: 0.75, fontWeight: 600 }}>
            {riskLabel(risk)}
          </Typography>
        </Box>
        <Box sx={{ ml: 'auto' }}>
          {txn.flaggedStatus && (
            <Chip label={txn.flaggedStatus.toUpperCase()} size="small" sx={{ fontSize: '0.6rem', fontWeight: 700, borderRadius: 0, bgcolor: '#fef2f2', color: '#dc2626', '& .MuiChip-label': { px: 1 } }} />
          )}
        </Box>
      </Box>

      {/* Fields */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 3, py: 2.5 }}>
        <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 1.5 }}>
          Transaction Details
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {rows.map(({ label, value }) => (
            <Box key={label} sx={{ display: 'flex', py: 1, borderBottom: '1px solid var(--border-col)', '&:last-child': { borderBottom: 'none' } }}>
              <Typography sx={{ width: 140, flexShrink: 0, fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>
                {label}
              </Typography>
              <Typography sx={{ fontSize: '0.8125rem', color: 'var(--heading-color)', wordBreak: 'break-all', fontFamily: label === 'Transaction ID' || label === 'Device ID' || label.includes('Account') ? 'SF Mono, Monaco, monospace' : 'inherit' }}>
                {String(value)}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Actions */}
      <Box sx={{ px: 3, py: 2.25, borderTop: '1px solid var(--border-col)', display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
        <Button
          size="small"
          startIcon={<FlagOutlinedIcon sx={{ fontSize: '0.875rem !important' }} />}
          onClick={() => setFlagDialogOpen(true)}
          disabled={flagged}
          sx={{
            bgcolor: '#fef2f2', color: '#dc2626',
            border: '1px solid #fecaca', borderRadius: 0,
            textTransform: 'none', fontFamily: 'Jost',
            fontSize: '0.8125rem', fontWeight: 600, px: 2,
            '&:hover': { bgcolor: '#fee2e2' },
            '&:disabled': { opacity: 0.6 },
          }}
        >
          {flagged ? 'Already Flagged' : 'Flag for Review'}
        </Button>

        <Button
          size="small"
          onClick={() => navigate(`/dashboard/transactions?q=${txn.id}`)}
          sx={{
            bgcolor: 'var(--section-bg)', color: 'var(--on-surface-variant)',
            border: '1px solid var(--border-col)', borderRadius: 0,
            textTransform: 'none', fontFamily: 'Jost',
            fontSize: '0.8125rem', fontWeight: 600, px: 2,
            '&:hover': { bgcolor: '#f1f5f9' },
          }}
        >
          Open in Transactions
        </Button>
      </Box>

      <AiFlagDialog
        open={flagDialogOpen}
        txn={txn}
        onClose={() => setFlagDialogOpen(false)}
        onConfirm={handleFlagConfirm}
      />

      <Snackbar
        open={snackbar}
        autoHideDuration={4000}
        onClose={() => setSnackbar(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar(false)}
          severity="success"
          variant="filled"
          sx={{ borderRadius: 0, fontFamily: 'Jost', fontSize: '0.8125rem', fontWeight: 600 }}
        >
          Transaction flagged — compliance team has been notified
        </Alert>
      </Snackbar>
    </Box>
  )
}

// ── Main drawer ───────────────────────────────────────────────────────────────
export default function ClusterTransactionsDrawer({ source, onClose }: Props) {
  const navigate = useNavigate()
  const [txns, setTxns]           = useState<Transaction[]>([])
  const [loading, setLoading]     = useState(false)
  const [selected, setSelected]   = useState<Transaction | null>(null)
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest')

  const fetchTxns = (src: ClusterDrawerSource) => {
    setLoading(true)
    // Clusters always load the last 24 h; date cells load their specific day
    const range = src.type === 'date' ? `custom:${src.date}:${src.date}` : '1d'
    transactionApi.list({ pageSize: 500, range })
      .then(page => {
        let filtered = page.transactions
        if (src.type === 'cluster') {
          const { lat, lng, radiusKm = 8 } = src
          filtered = filtered.filter(
            t => t.lat != null && t.lng != null &&
              haversineKm(lat, lng, t.lat!, t.lng!) <= radiusKm
          )
        }
        setTxns(filtered)
      })
      .catch(() => setTxns([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!source) { setTxns([]); setSelected(null); return }
    setSelected(null)
    setSortOrder('newest')
    fetchTxns(source)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source])

  // Apply sort client-side
  const sortedTxns = [...txns].sort((a, b) => {
    const aTime = new Date(a.occurredAt ?? a.time ?? '').getTime()
    const bTime = new Date(b.occurredAt ?? b.time ?? '').getTime()
    return sortOrder === 'newest' ? bTime - aTime : aTime - bTime
  })

  const drawerTitle = source?.type === 'cluster'
    ? `Cluster · last 24 hours`
    : source?.type === 'date' ? source.label : ''

  const drawerSub = source?.type === 'cluster'
    ? `${source.lat.toFixed(2)}°N, ${source.lng.toFixed(2)}°E · ${txns.length} transaction${txns.length !== 1 ? 's' : ''}`
    : source?.type === 'date'
      ? `${txns.length} transaction${txns.length !== 1 ? 's' : ''} on this day`
      : ''

  return (
    <Drawer
      anchor="right"
      open={!!source}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: {
            width: { xs: '100%', sm: 480 },
            borderLeft: '1px solid var(--border-col)',
            borderRadius: 0,
            boxShadow: '-8px 0 40px rgba(15,23,42,0.1)',
          },
        },
      }}
    >
      {selected ? (
        <TxnDetail
          txn={selected}
          onBack={() => setSelected(null)}
          onClose={onClose}
          onUpdated={() => { if (source) fetchTxns(source) }}
        />
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Header */}
          <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid var(--border-col)', bgcolor: 'var(--card-bg)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                {source?.type === 'cluster'
                  ? <LocationOnOutlinedIcon sx={{ fontSize: '1rem', color: colorPalette.primary }} />
                  : <CalendarTodayOutlinedIcon sx={{ fontSize: '1rem', color: colorPalette.primary }} />}
                <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost' }}>
                  {drawerTitle}
                </Typography>
              </Box>
              <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>{drawerSub}</Typography>
            </Box>
            <IconButton size="small" onClick={onClose} sx={{ color: '#64748b', borderRadius: 0 }}>
              <CloseRoundedIcon sx={{ fontSize: '1.125rem' }} />
            </IconButton>
          </Box>

          {/* Cluster risk summary + sort toggle */}
          {source?.type === 'cluster' && (
            <Box sx={{ px: 3, py: 1.5, borderBottom: '1px solid var(--border-col)', display: 'flex', alignItems: 'center', gap: 3 }}>
              <Box>
                <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.25 }}>
                  Avg Risk
                </Typography>
                <Typography sx={{ fontSize: '1.125rem', fontWeight: 800, fontFamily: 'Jost', color: source.avgRisk != null ? riskColor(source.avgRisk) : '#94a3b8' }}>
                  {source.avgRisk != null ? source.avgRisk.toFixed(0) : '—'}
                </Typography>
              </Box>
              <Divider orientation="vertical" flexItem />
              <Box>
                <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.25 }}>
                  Flagged
                </Typography>
                <Typography sx={{ fontSize: '1.125rem', fontWeight: 800, fontFamily: 'Jost', color: source.hasFlag ? '#dc2626' : '#10b981' }}>
                  {source.hasFlag ? 'Yes' : 'None'}
                </Typography>
              </Box>
              <Divider orientation="vertical" flexItem />
              <Box>
                <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.25 }}>
                  High Risk
                </Typography>
                <Typography sx={{ fontSize: '1.125rem', fontWeight: 800, fontFamily: 'Jost', color: '#dc2626' }}>
                  {txns.filter(t => t.risk >= 70).length}
                </Typography>
              </Box>

              {/* Sort toggle — pushed to the right */}
              <Box sx={{ ml: 'auto' }}>
                <ToggleButtonGroup
                  value={sortOrder}
                  exclusive
                  onChange={(_, v) => { if (v) setSortOrder(v) }}
                  size="small"
                  sx={{
                    '& .MuiToggleButton-root': {
                      borderRadius: 0, border: '1px solid var(--border-col)',
                      px: 1, py: 0.375,
                      fontSize: '0.6875rem', fontWeight: 600, fontFamily: 'Jost',
                      color: '#64748b', textTransform: 'none',
                      '&.Mui-selected': { bgcolor: `${colorPalette.primary}0f`, color: colorPalette.primary, borderColor: `${colorPalette.primary}40` },
                    },
                  }}
                >
                  <ToggleButton value="newest">
                    <ArrowDownwardRoundedIcon sx={{ fontSize: '0.75rem', mr: 0.5 }} />
                    Newest
                  </ToggleButton>
                  <ToggleButton value="oldest">
                    <ArrowUpwardRoundedIcon sx={{ fontSize: '0.75rem', mr: 0.5 }} />
                    Oldest
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>
            </Box>
          )}

          {/* List */}
          <Box sx={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <Box sx={{ py: 8, textAlign: 'center' }}>
                <CircularProgress size={24} sx={{ color: colorPalette.primary }} />
                <Typography sx={{ mt: 1.5, fontSize: '0.8125rem', color: '#64748b' }}>
                  Loading transactions…
                </Typography>
              </Box>
            ) : sortedTxns.length === 0 ? (
              <Box sx={{ py: 8, textAlign: 'center', px: 3 }}>
                <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--on-surface-variant)', fontFamily: 'Jost', mb: 0.5 }}>
                  No transactions found
                </Typography>
                <Typography sx={{ fontSize: '0.8125rem', color: '#94a3b8' }}>
                  No transactions with location data in this cluster in the last 24 hours.
                </Typography>
              </Box>
            ) : (
              sortedTxns.map(t => (
                <TxnRow key={t.id} txn={t} onView={setSelected} />
              ))
            )}
          </Box>

          {/* Footer — hint + view all */}
          <Box sx={{ px: 3, py: 2, borderTop: '1px solid var(--border-col)', bgcolor: 'var(--card-bg)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
            <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              {sortedTxns.length > 0 ? 'Click a transaction to view details and take action' : ''}
            </Typography>
            <Button
              size="small"
              endIcon={<OpenInNewRoundedIcon sx={{ fontSize: '0.875rem !important' }} />}
              onClick={() => { onClose(); navigate('/dashboard/transactions') }}
              sx={{
                flexShrink: 0,
                bgcolor: colorPalette.primary, color: '#fff',
                borderRadius: 0, textTransform: 'none',
                fontFamily: 'Jost', fontSize: '0.75rem', fontWeight: 700,
                px: 2, py: 0.875, boxShadow: 'none',
                '&:hover': { bgcolor: 'var(--on-surface)', boxShadow: 'none' },
              }}
            >
              View All Transactions
            </Button>
          </Box>
        </Box>
      )}
    </Drawer>
  )
}
