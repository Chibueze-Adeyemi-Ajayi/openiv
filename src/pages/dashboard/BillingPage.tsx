import {
  Box, Typography, Stack, Button, Chip, IconButton, CircularProgress, Divider,
} from '@mui/material'
import { colorPalette } from '@/theme'
import TOTPConfirmation from '@/components/dashboard/TOTPConfirmation'
import DateRangeFilter, { type DateRange } from '@/components/dashboard/DateRangeFilter'
import FundWalletDialog from '@/components/dashboard/FundWalletDialog'
import AddCardDialog from '@/components/dashboard/AddCardDialog'
import { useState, useEffect, useCallback } from 'react'
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'
import WebhookOutlinedIcon from '@mui/icons-material/WebhookOutlined'
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined'
import StreamOutlinedIcon from '@mui/icons-material/StreamOutlined'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'
import AssignmentTurnedInOutlinedIcon from '@mui/icons-material/AssignmentTurnedInOutlined'
import {
  billingApi,
  type BillingSummary,
  type LedgerEntry,
  type BillingUsageSummary,
  type CategoryUsage,
  type PaymentMethod,
} from '@/api/billing'

// ── constants ─────────────────────────────────────────────────────────────────

const UNITS_PER_NGN = 10_000
const WELCOME_NGN   = 500_000

const CATEGORY_META: Record<string, {
  label: string; sub: string; rate: string; icon: React.ReactNode; color: string
}> = {
  beam_ingest:         { label: 'Beam data ingests',      sub: 'Data streaming events',      rate: '₦0.10 / event',      icon: <StreamOutlinedIcon sx={{ fontSize: '1.1rem' }} />,              color: colorPalette.primary },
  kyc_lookup:          { label: 'KYC / identity lookups', sub: 'Customer identity checks',   rate: '₦100.00 / lookup',    icon: <VerifiedUserOutlinedIcon sx={{ fontSize: '1.1rem' }} />,        color: '#7c3aed' },
  kyc_pep_lookup:      { label: 'KYC PEP look-ups',       sub: 'Politically exposed persons', rate: '₦2,500.00 / look-up',  icon: <VerifiedUserOutlinedIcon sx={{ fontSize: '1.1rem' }} />,        color: '#be185d' },
  webhook_delivery:    { label: 'Webhook deliveries',     sub: 'Outbound event callbacks',   rate: '₦0.0001 / delivery', icon: <WebhookOutlinedIcon sx={{ fontSize: '1.1rem' }} />,             color: '#0891b2' },
  ai_token:            { label: 'Eureka AI tokens',       sub: 'Intelligence tokens used',   rate: '₦0.05 / token',      icon: <AutoAwesomeOutlinedIcon sx={{ fontSize: '1.1rem' }} />,         color: '#d97706' },
  nfiu_return:         { label: 'NFIU returns',           sub: 'Regulatory compliance filings', rate: '₦10,000.00 / filing', icon: <AssignmentTurnedInOutlinedIcon sx={{ fontSize: '1.1rem' }} />, color: '#92400e' },
}

// ── helpers ───────────────────────────────────────────────────────────────────

function unitsToNgn(units: number) { return units / UNITS_PER_NGN }

function fmtNgn(ngn: number, decimals = 0) {
  if (ngn >= 1_000_000) return `₦${(ngn / 1_000_000).toFixed(2)}M`
  if (ngn >= 1_000)     return `₦${(ngn / 1_000).toFixed(1)}k`
  return `₦${ngn.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`
}

function fmtSign(ngn: number) {
  const abs = Math.abs(ngn)
  return `${ngn < 0 ? '−' : '+'}₦${abs.toLocaleString()}`
}

function daysUntil(isoStr: string) {
  const ms = new Date(isoStr).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / 86_400_000))
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const [fundOpen, setFundOpen]       = useState(false)
  const [addCardOpen, setAddCardOpen] = useState(false)
  const [pendingPlan, setPendingPlan] = useState<string | null>(null)
  const [range, setRange]         = useState<DateRange>('30d')

  const [summary, setSummary]           = useState<BillingSummary | null>(null)
  const [usage, setUsage]               = useState<BillingUsageSummary | null>(null)
  const [ledger, setLedger]             = useState<LedgerEntry[]>([])
  const [methods, setMethods]           = useState<PaymentMethod[]>([])
  const [paystackKey, setPaystackKey]   = useState('')
  const [loading, setLoading]           = useState(true)
  const [deletingId, setDeletingId]     = useState<number | null>(null)

  const loadData = useCallback(() => {
    setLoading(true)
    Promise.all([
      billingApi.getSummary(),
      billingApi.getUsage(),
      billingApi.getLedger(),
      billingApi.getConfig(),
      billingApi.listPaymentMethods(),
    ]).then(([s, u, l, c, m]) => {
      setSummary(s)
      setUsage(u)
      setLedger(l.entries)
      setPaystackKey(c.paystackPublicKey)
      setMethods(m.paymentMethods)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadData() }, [loadData])

  async function deleteMethod(id: number) {
    setDeletingId(id)
    try {
      await billingApi.deletePaymentMethod(id)
      setMethods(prev => prev.filter(m => m.id !== id))
    } catch { /* ignore */ }
    finally { setDeletingId(null) }
  }

  const balanceNgn      = summary?.balanceNgn ?? 0
  const creditExpires   = usage?.creditExpiresAt
  const inFreePeriod    = usage?.isInFreePeriod ?? false
  const daysLeft        = creditExpires ? daysUntil(creditExpires) : 0
  const creditUsedNgn   = unitsToNgn(usage?.totalDebitUnits ?? 0)
  const creditPct       = Math.min(100, (creditUsedNgn / WELCOME_NGN) * 100)
  const lowBalance      = !inFreePeriod && balanceNgn < 5_000
  const noPaymentMethod = methods.length === 0

  return (
    <>
      <Box sx={{ p: 4, maxWidth: 1200 }}>

        {/* ── Header ── */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
              <LockOutlinedIcon sx={{ fontSize: '0.875rem', color: colorPalette.primary }} />
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: colorPalette.primary, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                Admin only
              </Typography>
            </Box>
            <Typography sx={{ fontSize: '1.625rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost', letterSpacing: '-0.015em', mb: 0.5 }}>
              Billing & Usage
            </Typography>
            <Typography sx={{ fontSize: '0.9375rem', color: '#64748b' }}>
              Pay as you go · ₦500,000 welcome credit · usage charged per event
            </Typography>
          </Box>
          <Button
            onClick={() => setFundOpen(true)}
            startIcon={<AddRoundedIcon sx={{ fontSize: '1rem !important' }} />}
            sx={{
              bgcolor: colorPalette.primary, color: '#fff',
              px: 2.25, py: 1.125, fontSize: '0.8125rem', fontWeight: 700,
              fontFamily: 'Jost', borderRadius: 0, textTransform: 'none',
              boxShadow: 'none', '&:hover': { bgcolor: '#1a3896' },
            }}
          >
            Fund Wallet
          </Button>
        </Box>

        {/* ── Balance + credit status ── */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2.5, mb: 3 }}>

          {/* Balance card */}
          <Box 
            data-ai-analyzable="true"
            data-ai-description={`Wallet Balance: ${fmtNgn(balanceNgn)}. status: ${inFreePeriod ? 'Welcome credit active' : lowBalance ? 'Low balance alert' : 'Healthy'}.`}
            sx={{
            bgcolor: colorPalette.primary, color: '#fff', p: 3, position: 'relative', overflow: 'hidden',
            '&::before': { content: '""', position: 'absolute', top: '-40%', right: '-8%', width: 300, height: 300, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' },
          }}>
            <Box sx={{ position: 'relative', zIndex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <AccountBalanceWalletOutlinedIcon sx={{ fontSize: '1.125rem' }} />
                <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', opacity: 0.85 }}>
                  Wallet balance
                </Typography>
              </Box>

              {loading ? (
                <CircularProgress size={32} sx={{ color: '#fff', my: 1 }} />
              ) : (
                <Typography sx={{ fontSize: '2.75rem', fontWeight: 700, fontFamily: 'Jost', lineHeight: 1, letterSpacing: '-0.02em', mb: 1 }}>
                  {fmtNgn(balanceNgn)}
                </Typography>
              )}

              {/* Credit / low balance badge */}
              {inFreePeriod ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <CheckCircleOutlineRoundedIcon sx={{ fontSize: '0.875rem', opacity: 0.85 }} />
                  <Typography sx={{ fontSize: '0.8125rem', opacity: 0.9 }}>
                    Welcome credit active · {daysLeft} day{daysLeft !== 1 ? 's' : ''} remaining
                  </Typography>
                </Box>
              ) : lowBalance ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, bgcolor: 'rgba(245,158,11,0.2)', px: 1.5, py: 0.75, width: 'fit-content' }}>
                  <WarningAmberRoundedIcon sx={{ fontSize: '0.875rem', color: '#fbbf24' }} />
                  <Typography sx={{ fontSize: '0.8125rem', color: '#fbbf24', fontWeight: 600 }}>
                    Low balance — add funds to avoid interruption
                  </Typography>
                </Box>
              ) : !inFreePeriod ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Typography sx={{ fontSize: '0.8125rem', opacity: 0.75 }}>
                    Pay as you go · usage deducted in real-time
                  </Typography>
                </Box>
              ) : null}

              <Stack direction="row" gap={1}>
                <Button
                  onClick={() => setFundOpen(true)}
                  startIcon={<AddRoundedIcon sx={{ fontSize: '1rem !important' }} />}
                  sx={{ bgcolor: '#fff', color: colorPalette.primary, px: 2, py: 0.875, fontSize: '0.8125rem', fontWeight: 700, fontFamily: 'Jost', borderRadius: 0, textTransform: 'none', '&:hover': { bgcolor: '#f8fafc' } }}
                >
                  Fund Wallet
                </Button>
              </Stack>
            </Box>
          </Box>

          {/* Credit usage / pay-as-you-go status */}
          <Box 
            data-ai-analyzable="true"
            data-ai-description={inFreePeriod ? `Welcome Credit Status: ${fmtNgn(creditUsedNgn, 2)} used of ₦500k. expires: ${creditExpires ? new Date(creditExpires).toLocaleDateString() : 'N/A'}.` : `Pay-as-you-go Status: ${fmtNgn(unitsToNgn(usage?.totalDebitUnits ?? 0), 2)} spent this billing cycle.`}
            sx={{ bgcolor: '#fff', border: '1px solid #eef0f4', p: 3 }}>
            {inFreePeriod ? (
              <>
                <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 0.5 }}>
                  Welcome credit usage
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 0.75 }}>
                  <Typography sx={{ fontSize: '1.375rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
                    {fmtNgn(creditUsedNgn, 2)} used
                  </Typography>
                  <Typography sx={{ fontSize: '0.875rem', color: '#64748b', fontWeight: 600 }}>
                    of ₦500,000
                  </Typography>
                </Box>
                <Box sx={{ width: '100%', height: 8, bgcolor: '#f1f5f9', mb: 0.75 }}>
                  <Box sx={{ width: `${creditPct}%`, height: '100%', bgcolor: creditPct > 80 ? '#f59e0b' : colorPalette.primary, transition: 'width 0.5s' }} />
                </Box>
                <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mb: 2 }}>
                  {(100 - creditPct).toFixed(1)}% credit remaining · expires {creditExpires ? new Date(creditExpires).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
                </Typography>
                <Box sx={{ bgcolor: '#f0fdf4', border: '1px solid #d1fae5', p: 1.5 }}>
                  <Typography sx={{ fontSize: '0.75rem', color: '#047857', fontWeight: 500, lineHeight: 1.5 }}>
                    After your credit expires, usage is charged against your wallet balance. Add a card now so we can auto-debit and keep you running.
                  </Typography>
                </Box>
              </>
            ) : (
              <>
                <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 0.5 }}>
                  Pay as you go
                </Typography>
                <Typography sx={{ fontSize: '1.375rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost', mb: 0.5 }}>
                  {fmtNgn(unitsToNgn(usage?.totalDebitUnits ?? 0), 2)} this month
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mb: 2 }}>
                  {usage?.periodStart} – {usage?.periodEnd} · Day {usage?.dayOfPeriod ?? '—'} of {usage?.daysInPeriod ?? '—'}
                </Typography>
                {noPaymentMethod && (
                  <Box sx={{ bgcolor: '#fffbeb', border: '1px solid #fde68a', p: 1.5 }}>
                    <Typography sx={{ fontSize: '0.75rem', color: '#92400e', fontWeight: 500, lineHeight: 1.5 }}>
                      No card on file — your service will stop when the wallet hits ₦0. Add a card for seamless auto-debit.
                    </Typography>
                  </Box>
                )}
              </>
            )}
          </Box>
        </Box>

        {/* ── Usage tiles — always 4 categories ── */}
        <Box sx={{ bgcolor: '#fff', border: '1px solid #eef0f4', mb: 3 }}>
          <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid #eef0f4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
                Usage this billing period
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
                {usage
                  ? `${usage.periodStart} – ${usage.periodEnd} · Day ${usage.dayOfPeriod} of ${usage.daysInPeriod}`
                  : '…'}
              </Typography>
            </Box>
            {!loading && usage && (
              <Box sx={{ textAlign: 'right' }}>
                <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Total spend
                </Typography>
                <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
                  {fmtNgn(unitsToNgn(usage.totalDebitUnits), 2)}
                </Typography>
              </Box>
            )}
          </Box>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={28} sx={{ color: colorPalette.primary }} />
            </Box>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
              {(usage?.categories ?? []).filter(c => c.category in CATEGORY_META).map((cat: CategoryUsage, idx: number, arr: CategoryUsage[]) => {
                const meta       = CATEGORY_META[cat.category] ?? { label: cat.category, sub: '', rate: '', icon: null, color: '#64748b' }
                const costNgn    = unitsToNgn(cat.totalAmountUnits)
                const total      = usage?.totalDebitUnits ?? 0
                const pct        = total > 0 ? (cat.totalAmountUnits / total) * 100 : 0
                const isEmpty    = cat.eventCount === 0
                const N          = arr.length
                const isRightCol = (idx + 1) % 3 === 0 || idx === N - 1
                const isLastRow  = idx >= N - ((N % 3) || 3)

                return (
                  <Box
                    key={cat.category}
                    data-ai-analyzable="true"
                    data-ai-description={`Billing Category: ${meta.label}. event count: ${cat.eventCount.toLocaleString()}. total cost: ${fmtNgn(costNgn, 2)}. unit rate: ${meta.rate}. percentage of spend: ${pct.toFixed(1)}%.`}
                    sx={{
                      p: 2.5, minWidth: 0,
                      borderRight: isRightCol ? 'none' : '1px solid #eef0f4',
                      borderBottom: isLastRow ? 'none' : '1px solid #eef0f4',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, color: isEmpty ? '#94a3b8' : meta.color }}>
                      {meta.icon}
                      <Box>
                        <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: isEmpty ? '#94a3b8' : '#475569', fontFamily: 'Jost', lineHeight: 1.2 }}>
                          {meta.label}
                        </Typography>
                        <Typography sx={{ fontSize: '0.625rem', color: '#94a3b8', lineHeight: 1.2 }}>
                          {meta.sub}
                        </Typography>
                      </Box>
                    </Box>

                    <Typography sx={{ fontSize: '1.625rem', fontWeight: 700, color: isEmpty ? '#cbd5e1' : '#0f172a', fontFamily: 'Jost', lineHeight: 1, mb: 0.25 }}>
                      {cat.eventCount.toLocaleString()}
                    </Typography>
                    <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', mb: 1.25 }}>
                      events · {meta.rate}
                    </Typography>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                      <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', fontWeight: 600 }}>
                        {isEmpty ? 'No usage' : `${pct.toFixed(0)}% of spend`}
                      </Typography>
                      <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: isEmpty ? '#cbd5e1' : '#0f172a', fontFamily: 'Jost' }}>
                        {isEmpty ? '₦0' : fmtNgn(costNgn, 2)}
                      </Typography>
                    </Box>
                    <Box sx={{ width: '100%', height: 3, bgcolor: '#f1f5f9' }}>
                      <Box sx={{ width: `${pct}%`, height: '100%', bgcolor: meta.color, transition: 'width 0.4s' }} />
                    </Box>
                  </Box>
                )
              })}
            </Box>
          )}
        </Box>

        {/* ── Payment methods ── */}
        <Box sx={{ bgcolor: '#fff', border: '1px solid #eef0f4', mb: 3 }}>
          <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid #eef0f4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
                Payment methods
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
                Saved cards for one-click top-up and auto-debit
              </Typography>
            </Box>
            <Button
              onClick={() => setAddCardOpen(true)}
              startIcon={<AddRoundedIcon sx={{ fontSize: '1rem !important' }} />}
              sx={{
                bgcolor: '#fff', color: colorPalette.primary,
                border: `1px solid ${colorPalette.primary}40`,
                px: 2, py: 0.875, fontSize: '0.8125rem', fontWeight: 700,
                fontFamily: 'Jost', borderRadius: 0, textTransform: 'none',
                '&:hover': { bgcolor: `${colorPalette.primary}06`, borderColor: colorPalette.primary },
              }}
            >
              Add card
            </Button>
          </Box>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={24} sx={{ color: colorPalette.primary }} />
            </Box>
          ) : methods.length === 0 ? (
            <Box sx={{ px: 3, py: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
              <CreditCardOutlinedIcon sx={{ fontSize: '2rem', color: '#cbd5e1' }} />
              <Box>
                <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#475569' }}>
                  No payment methods yet
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  Add a card via the Fund Wallet dialog — we'll save it for future top-ups and auto-debit.
                </Typography>
              </Box>
            </Box>
          ) : (
            <Box>
              {methods.map((m, i) => (
                <Box
                  key={m.id}
                  data-ai-analyzable="true"
                  data-ai-description={`Saved Payment Method: ${m.displayName}. last 4 digits: ${m.last4 || 'N/A'}. status: ${m.isDefault ? 'Default auto-debit card' : 'Backup card'}. added: ${new Date(m.createdAt).toLocaleDateString()}.`}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 2, px: 3, py: 1.75,
                    borderBottom: i === methods.length - 1 ? 'none' : '1px solid #f4f5f7',
                    '&:hover': { bgcolor: '#fafbfc' },
                  }}
                >
                  <CreditCardOutlinedIcon sx={{ fontSize: '1.375rem', color: '#64748b', flexShrink: 0 }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a' }}>
                      {m.displayName}
                      {m.isDefault && (
                        <Chip label="default" size="small" sx={{ ml: 1, height: 18, fontSize: '0.625rem', fontWeight: 700, bgcolor: `${colorPalette.primary}12`, color: colorPalette.primary, borderRadius: 0 }} />
                      )}
                    </Typography>
                    {m.last4 && (
                      <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', fontFamily: 'SF Mono, Monaco, monospace' }}>
                        ···· {m.last4}
                      </Typography>
                    )}
                  </Box>
                  <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8' }}>
                    Added {new Date(m.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </Typography>
                  <IconButton
                    size="small"
                    disabled={deletingId === m.id}
                    onClick={() => deleteMethod(m.id)}
                    sx={{ borderRadius: 0, color: '#94a3b8', '&:hover': { color: '#dc2626' } }}
                  >
                    {deletingId === m.id
                      ? <CircularProgress size={14} sx={{ color: '#94a3b8' }} />
                      : <DeleteOutlineRoundedIcon sx={{ fontSize: '1rem' }} />}
                  </IconButton>
                </Box>
              ))}
            </Box>
          )}
        </Box>

        {/* ── Wallet ledger ── */}
        <Box sx={{ bgcolor: '#fff', border: '1px solid #eef0f4' }}>
          <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid #eef0f4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ReceiptLongOutlinedIcon sx={{ fontSize: '1.125rem', color: '#475569' }} />
              <Box>
                <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
                  Wallet ledger
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.125 }}>
                  Every charge and top-up · audit-grade trail
                </Typography>
              </Box>
            </Box>
            <DateRangeFilter value={range} onChange={setRange} compact options={['7d', '30d', '90d', 'ytd']} />
          </Box>

          {/* Table header */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '120px 1fr 120px 130px 100px', gap: 2, px: 3, py: 1.5, bgcolor: '#fafbfc', borderBottom: '1px solid #eef0f4' }}>
            {['Date', 'Description', 'Amount (₦)', 'Balance (₦)', 'Type'].map(h => (
              <Typography key={h} sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {h}
              </Typography>
            ))}
          </Box>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={28} sx={{ color: colorPalette.primary }} />
            </Box>
          ) : ledger.length === 0 ? (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <Typography sx={{ fontSize: '0.875rem', color: '#94a3b8' }}>No ledger entries yet</Typography>
            </Box>
          ) : ledger.map((row, i) => {
            const amountNgn  = Math.round(unitsToNgn(row.totalAmountUnits))
            const balNgn     = Math.round(unitsToNgn(row.endingBalanceUnits))
            const isCredit   = row.type === 'credit'
            return (
              <Box
                key={`${row.dayStr}-${row.type}`}
                data-ai-analyzable="true"
                data-ai-description={`Ledger Record: ${isCredit ? 'Wallet funding' : 'Service usage charge'}. amount: ${fmtSign(isCredit ? amountNgn : -amountNgn)}. final balance: ${fmtNgn(balNgn)}. date: ${row.dayStr}.`}
                sx={{
                  display: 'grid', gridTemplateColumns: '120px 1fr 120px 130px 100px',
                  gap: 2, px: 3, py: 1.75, alignItems: 'center',
                  borderBottom: i === ledger.length - 1 ? 'none' : '1px solid #f4f5f7',
                  '&:hover': { bgcolor: '#fafbfc' },
                }}
              >
                <Typography sx={{ fontSize: '0.75rem', color: '#475569', fontFamily: 'SF Mono, Monaco, monospace' }}>
                  {row.dayStr}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: isCredit ? '#10b981' : colorPalette.primary, flexShrink: 0 }} />
                  <Typography sx={{ fontSize: '0.8125rem', color: '#0f172a' }}>
                    {isCredit ? 'Credit' : 'Usage charges'} · {row.dayStr}
                    {row.eventCount > 1 && (
                      <Typography component="span" sx={{ fontSize: '0.6875rem', color: '#94a3b8', ml: 0.75 }}>
                        {row.eventCount.toLocaleString()} events
                      </Typography>
                    )}
                  </Typography>
                </Box>
                <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: isCredit ? '#10b981' : '#0f172a', fontFamily: 'SF Mono, Monaco, monospace', textAlign: 'right' }}>
                  {fmtSign(isCredit ? amountNgn : -amountNgn)}
                </Typography>
                <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: balNgn < 0 ? '#dc2626' : '#475569', fontFamily: 'SF Mono, Monaco, monospace', textAlign: 'right' }}>
                  ₦{Math.abs(balNgn).toLocaleString()}{balNgn < 0 ? ' (negative)' : ''}
                </Typography>
                <Chip
                  label={row.type}
                  size="small"
                  sx={{
                    borderRadius: 0, height: 20, fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.08em',
                    bgcolor: isCredit ? '#f0fdf4' : '#eff6ff',
                    color: isCredit ? '#10b981' : colorPalette.primary,
                  }}
                />
              </Box>
            )
          })}

          <Box sx={{ px: 3, py: 1.5, borderTop: '1px solid #eef0f4' }}>
            <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              {ledger.length > 0 ? `${ledger.length} entries shown · last 90 days` : ''}
            </Typography>
          </Box>
        </Box>

      {/* ── Add Card dialog ── */}
      <AddCardDialog
        open={addCardOpen}
        onClose={() => setAddCardOpen(false)}
        onCardAdded={(method) => {
          setMethods(prev => [...prev, method])
          setAddCardOpen(false)
        }}
      />

      {/* ── Fund Wallet dialog ── */}
      <FundWalletDialog
        open={fundOpen}
        onClose={() => setFundOpen(false)}
        paystackPublicKey={paystackKey}
        onSuccess={(newBalance) => {
          setSummary(prev => prev ? { ...prev, balanceNgn: newBalance } : null)
          loadData()
        }}
      />

      {/* ── TOTP — plan change (kept for future use) ── */}
      <TOTPConfirmation
        open={!!pendingPlan}
        onClose={() => setPendingPlan(null)}
        onConfirm={() => setPendingPlan(null)}
        operation="update"
        title="Change plan"
        description="Plan changes apply immediately."
        resourceType="Subscription"
        resourceName=""
      />
      </Box>
    </>
  )
}
