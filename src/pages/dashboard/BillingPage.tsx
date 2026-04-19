import { Box, Typography, Stack, Button, Chip, IconButton } from '@mui/material'
import { colorPalette } from '@/theme'
import DashboardLayout from '@/components/dashboard/DashboardLayout'
import TOTPConfirmation from '@/components/dashboard/TOTPConfirmation'
import DateRangeFilter, { type DateRange } from '@/components/dashboard/DateRangeFilter'
import { useState } from 'react'
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined'
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import RocketLaunchOutlinedIcon from '@mui/icons-material/RocketLaunchOutlined'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'

interface UsageMetric {
  label: string
  used: number
  limit: number
  unit: string
  rate: string
}

const usageMetrics: UsageMetric[] = [
  { label: 'Transactions monitored', used: 84219000, limit: 100000000, unit: '', rate: '₦0.0008 each' },
  { label: 'Customer profiles', used: 847219, limit: 1000000, unit: '', rate: '₦12 / profile / month' },
  { label: 'Webhook deliveries', used: 4280000, limit: 10000000, unit: '', rate: '₦0.0001 each' },
  { label: 'Eureka AI requests', used: 12480, limit: 50000, unit: '', rate: '₦25 / request' },
  { label: 'NFIU filings (auto)', used: 847, limit: 5000, unit: '', rate: 'Included' },
  { label: 'Storage', used: 412, limit: 1000, unit: 'GB', rate: '₦80 / GB / month' },
]

const ledger = [
  { id: 'INV-2026-0419', date: '2026-04-19 14:32', type: 'usage', description: 'Daily usage charge · 19 Apr', amount: -842500, balance: 4218000, ref: 'auto-debit' },
  { id: 'TOP-2026-0418', date: '2026-04-18 09:15', type: 'topup', description: 'Wallet top-up · GTB Transfer', amount: 5000000, balance: 5060500, ref: 'GT/REF/8X29F' },
  { id: 'INV-2026-0418', date: '2026-04-18 14:32', type: 'usage', description: 'Daily usage charge · 18 Apr', amount: -794200, balance: 60500, ref: 'auto-debit' },
  { id: 'INV-2026-0417', date: '2026-04-17 14:32', type: 'usage', description: 'Daily usage charge · 17 Apr', amount: -812400, balance: 854700, ref: 'auto-debit' },
  { id: 'INV-2026-0416', date: '2026-04-16 14:32', type: 'usage', description: 'Daily usage charge · 16 Apr', amount: -728900, balance: 1667100, ref: 'auto-debit' },
  { id: 'TOP-2026-0415', date: '2026-04-15 11:08', type: 'topup', description: 'Wallet top-up · Paystack', amount: 3000000, balance: 2396000, ref: 'ps_T62V8M2P' },
  { id: 'INV-2026-0415', date: '2026-04-15 14:32', type: 'usage', description: 'Daily usage charge · 15 Apr', amount: -901300, balance: -604000, ref: 'auto-debit' },
  { id: 'INV-2026-0414', date: '2026-04-14 14:32', type: 'usage', description: 'Daily usage charge · 14 Apr', amount: -782450, balance: 297300, ref: 'auto-debit' },
]

const plans = [
  {
    id: 'starter',
    name: 'Starter',
    price: '₦480k',
    period: '/month',
    description: 'For MFBs and early-stage fintechs',
    features: ['Up to 5M transactions/month', '100k customer profiles', 'Standard rules engine', 'Email support'],
    current: false,
  },
  {
    id: 'growth',
    name: 'Growth',
    price: '₦2.4M',
    period: '/month',
    description: 'For mid-tier banks and scaling fintechs',
    features: ['Up to 50M transactions/month', '1M customer profiles', 'Eureka AI included', 'NFIU auto-filing', 'Priority support'],
    current: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'For Tier-1 banks and complex regulators',
    features: ['Unlimited transactions', 'Dedicated infrastructure', 'On-premise option', 'CBN-aligned SLA', 'Named CSM'],
    current: false,
  },
]

function fmt(amount: number) {
  const abs = Math.abs(amount)
  return `${amount < 0 ? '−' : ''}₦${abs.toLocaleString()}`
}

export default function BillingPage() {
  const [topUpOpen, setTopUpOpen] = useState(false)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [pendingPlan, setPendingPlan] = useState<string | null>(null)
  const [range, setRange] = useState<DateRange>('30d')
  const balance = 4218000
  const lowBalance = balance < 5000000

  return (
    <DashboardLayout>
      <Box sx={{ p: 4 }}>
        {/* Header */}
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
              Wallet, plan, and a complete ledger of every charge and top-up
            </Typography>
          </Box>
          <Stack direction="row" gap={1.25}>
            <Button
              startIcon={<FileDownloadOutlinedIcon sx={{ fontSize: '1rem !important' }} />}
              sx={{
                bgcolor: '#ffffff',
                color: '#475569',
                border: '1px solid #e5e7eb',
                px: 2.25,
                py: 1.125,
                fontSize: '0.8125rem',
                fontWeight: 600,
                fontFamily: 'Jost',
                borderRadius: 0,
                textTransform: 'none',
                '&:hover': { bgcolor: '#f8fafc' },
              }}
            >
              Download Invoices
            </Button>
            <Button
              onClick={() => setTopUpOpen(true)}
              startIcon={<AddRoundedIcon sx={{ fontSize: '1rem !important' }} />}
              sx={{
                bgcolor: colorPalette.primary,
                color: '#ffffff',
                px: 2.25,
                py: 1.125,
                fontSize: '0.8125rem',
                fontWeight: 600,
                fontFamily: 'Jost',
                borderRadius: 0,
                textTransform: 'none',
                boxShadow: 'none',
                '&:hover': { bgcolor: '#1a3896' },
              }}
            >
              Fund Wallet
            </Button>
          </Stack>
        </Box>

        {/* Wallet + Plan summary */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3, mb: 3 }}>
          {/* Wallet card */}
          <Box
            sx={{
              bgcolor: colorPalette.primary,
              color: '#ffffff',
              p: 3,
              position: 'relative',
              overflow: 'hidden',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: '-30%',
                right: '-5%',
                width: 280,
                height: 280,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.06)',
              },
            }}
          >
            <Box sx={{ position: 'relative', zIndex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <AccountBalanceWalletOutlinedIcon sx={{ fontSize: '1.125rem' }} />
                <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', opacity: 0.85 }}>
                  Wallet balance
                </Typography>
              </Box>
              <Typography sx={{ fontSize: '2.75rem', fontWeight: 700, fontFamily: 'Jost', lineHeight: 1, letterSpacing: '-0.02em', mb: 1 }}>
                ₦{balance.toLocaleString()}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
                <Typography sx={{ fontSize: '0.8125rem', opacity: 0.85 }}>
                  ≈ {Math.round(balance / 800000)} days remaining at current daily burn
                </Typography>
                {lowBalance && (
                  <Chip
                    label="LOW BALANCE"
                    size="small"
                    sx={{
                      bgcolor: 'rgba(245, 158, 11, 0.2)',
                      color: '#fbbf24',
                      fontWeight: 700,
                      fontSize: '0.625rem',
                      letterSpacing: '0.1em',
                      borderRadius: 0,
                      height: 20,
                    }}
                  />
                )}
              </Box>

              <Stack direction="row" gap={1.25}>
                <Button
                  onClick={() => setTopUpOpen(true)}
                  startIcon={<AddRoundedIcon sx={{ fontSize: '1rem !important' }} />}
                  sx={{
                    bgcolor: '#ffffff',
                    color: colorPalette.primary,
                    px: 2.25,
                    py: 1,
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    fontFamily: 'Jost',
                    borderRadius: 0,
                    textTransform: 'none',
                    '&:hover': { bgcolor: '#f8fafc' },
                  }}
                >
                  Fund Wallet
                </Button>
                <Button
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.12)',
                    color: '#ffffff',
                    px: 2.25,
                    py: 1,
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    fontFamily: 'Jost',
                    borderRadius: 0,
                    textTransform: 'none',
                    border: '1px solid rgba(255,255,255,0.2)',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
                  }}
                >
                  Auto-recharge: Off
                </Button>
              </Stack>
            </Box>
          </Box>

          {/* Plan card */}
          <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
              <Box>
                <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                  Current plan
                </Typography>
                <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost', mt: 0.5 }}>
                  Growth
                </Typography>
              </Box>
              <Chip
                label="ACTIVE"
                size="small"
                sx={{
                  bgcolor: '#f0fdf4',
                  color: '#10b981',
                  fontWeight: 700,
                  fontSize: '0.625rem',
                  letterSpacing: '0.1em',
                  borderRadius: 0,
                  height: 22,
                }}
              />
            </Box>
            <Typography sx={{ fontSize: '0.875rem', color: '#475569', lineHeight: 1.6, mb: 2 }}>
              ₦2.4M base · billed monthly · usage charges separate. Renews 1 May 2026.
            </Typography>
            <Stack direction="row" gap={3} sx={{ mb: 2 }}>
              <Box>
                <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.5 }}>
                  Spend this month
                </Typography>
                <Typography sx={{ fontSize: '1.125rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
                  ₦14.8M
                </Typography>
              </Box>
              <Box>
                <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.5 }}>
                  vs last month
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <TrendingUpRoundedIcon sx={{ fontSize: '1rem', color: colorPalette.primary }} />
                  <Typography sx={{ fontSize: '1.125rem', fontWeight: 700, color: colorPalette.primary, fontFamily: 'Jost' }}>
                    +18%
                  </Typography>
                </Box>
              </Box>
            </Stack>
            <Button
              onClick={() => setUpgradeOpen(true)}
              startIcon={<RocketLaunchOutlinedIcon sx={{ fontSize: '1rem !important' }} />}
              sx={{
                bgcolor: '#ffffff',
                color: colorPalette.primary,
                border: `1px solid ${colorPalette.primary}40`,
                px: 2.25,
                py: 1,
                fontSize: '0.8125rem',
                fontWeight: 700,
                fontFamily: 'Jost',
                borderRadius: 0,
                textTransform: 'none',
                '&:hover': { bgcolor: `${colorPalette.primary}06`, borderColor: colorPalette.primary },
              }}
            >
              Upgrade Plan
            </Button>
          </Box>
        </Box>

        {/* Usage section */}
        <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', mb: 3 }}>
          <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid #eef0f4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
                Usage this billing period
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
                1 April – 30 April 2026 · Day 19 of 30
              </Typography>
            </Box>
            <DateRangeFilter value={range} onChange={setRange} compact options={['7d', '30d', '90d', 'ytd']} />
          </Box>
          <Box sx={{ p: 3, display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' }, gap: 2 }}>
            {usageMetrics.map((m) => {
              const pct = (m.used / m.limit) * 100
              const overSoft = pct > 80
              return (
                <Box key={m.label} sx={{ p: 2, border: '1px solid #eef0f4' }}>
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', mb: 0.5, fontFamily: 'Jost' }}>
                    {m.label}
                  </Typography>
                  <Typography sx={{ fontSize: '1.375rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost', lineHeight: 1.1 }}>
                    {m.used.toLocaleString()}
                    {m.unit && ` ${m.unit}`}
                  </Typography>
                  <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', mb: 1.25 }}>
                    of {m.limit.toLocaleString()}
                    {m.unit && ` ${m.unit}`} · {m.rate}
                  </Typography>
                  <Box sx={{ width: '100%', height: 4, bgcolor: '#f1f5f9' }}>
                    <Box
                      sx={{
                        width: `${Math.min(100, pct)}%`,
                        height: '100%',
                        bgcolor: overSoft ? '#f59e0b' : colorPalette.primary,
                        transition: 'width 0.4s',
                      }}
                    />
                  </Box>
                  <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600, color: overSoft ? '#f59e0b' : '#64748b', mt: 0.625 }}>
                    {pct.toFixed(1)}% used
                  </Typography>
                </Box>
              )
            })}
          </Box>
        </Box>

        {/* Plans (expandable section) */}
        {upgradeOpen && (
          <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', mb: 3, animation: 'slideDown 0.25s ease', '@keyframes slideDown': { from: { opacity: 0, transform: 'translateY(-8px)' }, to: { opacity: 1, transform: 'translateY(0)' } } }}>
            <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid #eef0f4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
                  Choose your plan
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
                  Upgrades take effect immediately · downgrades at next renewal
                </Typography>
              </Box>
              <IconButton size="small" onClick={() => setUpgradeOpen(false)} sx={{ borderRadius: 0, color: '#94a3b8' }}>
                ✕
              </IconButton>
            </Box>
            <Box sx={{ p: 3, display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2 }}>
              {plans.map((p) => (
                <Box
                  key={p.id}
                  sx={{
                    p: 2.5,
                    border: '1px solid',
                    borderColor: p.current ? colorPalette.primary : '#eef0f4',
                    bgcolor: p.current ? `${colorPalette.primary}06` : '#ffffff',
                    position: 'relative',
                  }}
                >
                  {p.current && (
                    <Chip
                      label="CURRENT"
                      size="small"
                      sx={{
                        position: 'absolute',
                        top: 12,
                        right: 12,
                        bgcolor: colorPalette.primary,
                        color: '#ffffff',
                        fontWeight: 700,
                        fontSize: '0.5625rem',
                        letterSpacing: '0.1em',
                        borderRadius: 0,
                        height: 18,
                      }}
                    />
                  )}
                  <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: colorPalette.primary, fontFamily: 'Jost', mb: 1 }}>
                    {p.name}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, mb: 1 }}>
                    <Typography sx={{ fontSize: '1.875rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost', letterSpacing: '-0.02em', lineHeight: 1 }}>
                      {p.price}
                    </Typography>
                    <Typography sx={{ fontSize: '0.8125rem', color: '#94a3b8', fontWeight: 600 }}>
                      {p.period}
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mb: 1.75, lineHeight: 1.5 }}>
                    {p.description}
                  </Typography>
                  <Stack gap={0.625} sx={{ mb: 2 }}>
                    {p.features.map((f) => (
                      <Box key={f} sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.875 }}>
                        <CheckRoundedIcon sx={{ fontSize: '0.875rem', color: '#10b981', mt: 0.25, flexShrink: 0 }} />
                        <Typography sx={{ fontSize: '0.75rem', color: '#475569' }}>{f}</Typography>
                      </Box>
                    ))}
                  </Stack>
                  <Button
                    fullWidth
                    onClick={() => !p.current && setPendingPlan(p.id)}
                    disabled={p.current}
                    sx={{
                      bgcolor: p.current ? '#e2e8f0' : colorPalette.primary,
                      color: p.current ? '#94a3b8' : '#ffffff',
                      py: 1,
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      fontFamily: 'Jost',
                      borderRadius: 0,
                      textTransform: 'none',
                      boxShadow: 'none',
                      '&:hover:not(:disabled)': { bgcolor: '#1a3896' },
                    }}
                  >
                    {p.current ? 'Current Plan' : p.id === 'enterprise' ? 'Contact Sales' : 'Upgrade'}
                  </Button>
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {/* Ledger */}
        <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4' }}>
          <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid #eef0f4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ReceiptLongOutlinedIcon sx={{ fontSize: '1.125rem', color: '#475569' }} />
                <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
                  Wallet ledger
                </Typography>
              </Box>
              <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
                Every charge and top-up · audit-grade trail
              </Typography>
            </Box>
            <DateRangeFilter value={range} onChange={setRange} compact options={['7d', '30d', '90d', 'ytd']} />
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: '140px 160px 1fr 130px 130px 120px', gap: 2, px: 3, py: 1.5, bgcolor: '#fafbfc', borderBottom: '1px solid #eef0f4' }}>
            {['Reference', 'Date', 'Description', 'Amount (₦)', 'Balance (₦)', 'Source'].map((h) => (
              <Typography key={h} sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {h}
              </Typography>
            ))}
          </Box>
          {ledger.map((row, i) => (
            <Box
              key={row.id}
              sx={{
                display: 'grid',
                gridTemplateColumns: '140px 160px 1fr 130px 130px 120px',
                gap: 2,
                px: 3,
                py: 1.75,
                alignItems: 'center',
                borderBottom: i === ledger.length - 1 ? 'none' : '1px solid #f4f5f7',
                '&:hover': { bgcolor: '#fafbfc' },
              }}
            >
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#0f172a', fontFamily: 'SF Mono, Monaco, monospace' }}>
                {row.id}
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: '#475569', fontFamily: 'SF Mono, Monaco, monospace' }}>
                {row.date}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                  sx={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    bgcolor: row.type === 'topup' ? '#10b981' : colorPalette.primary,
                  }}
                />
                <Typography sx={{ fontSize: '0.8125rem', color: '#0f172a' }}>
                  {row.description}
                </Typography>
              </Box>
              <Typography
                sx={{
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  color: row.amount > 0 ? '#10b981' : '#0f172a',
                  fontFamily: 'SF Mono, Monaco, monospace',
                  textAlign: 'right',
                }}
              >
                {fmt(row.amount)}
              </Typography>
              <Typography
                sx={{
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: row.balance < 0 ? '#dc2626' : '#475569',
                  fontFamily: 'SF Mono, Monaco, monospace',
                  textAlign: 'right',
                }}
              >
                {fmt(row.balance)}
              </Typography>
              <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', fontFamily: 'SF Mono, Monaco, monospace' }}>
                {row.ref}
              </Typography>
            </Box>
          ))}
          <Box sx={{ px: 3, py: 1.5, borderTop: '1px solid #eef0f4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>
              Showing 8 of 240 entries
            </Typography>
            <Stack direction="row" gap={0.5}>
              {['Previous', '1', '2', '3', '…', '30', 'Next'].map((p) => (
                <Box
                  key={p}
                  sx={{
                    px: 1.25,
                    py: 0.5,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: p === '1' ? '#ffffff' : '#475569',
                    bgcolor: p === '1' ? colorPalette.primary : 'transparent',
                    border: '1px solid',
                    borderColor: p === '1' ? colorPalette.primary : '#e5e7eb',
                    cursor: 'pointer',
                  }}
                >
                  {p}
                </Box>
              ))}
            </Stack>
          </Box>
        </Box>
      </Box>

      {/* TOTP — fund wallet */}
      <TOTPConfirmation
        open={topUpOpen}
        onClose={() => setTopUpOpen(false)}
        onConfirm={() => setTopUpOpen(false)}
        operation="create"
        title="Fund OpenIV wallet"
        description="Authorize a transfer from your linked bank account to your OpenIV wallet. Funds appear instantly via Paystack/Flutterwave settlement."
        resourceType="Wallet top-up"
        resourceName="₦5,000,000 from FCMB ··· 1729"
      />

      {/* TOTP — change plan */}
      <TOTPConfirmation
        open={!!pendingPlan}
        onClose={() => setPendingPlan(null)}
        onConfirm={() => {
          setPendingPlan(null)
          setUpgradeOpen(false)
        }}
        operation="update"
        title="Change subscription plan"
        description={
          pendingPlan === 'enterprise'
            ? 'This will route a request to our sales team. A Customer Success Manager will reach out within one business day.'
            : 'Plan changes apply immediately. Usage charges remain on top of base subscription.'
        }
        resourceType="Subscription plan"
        resourceName={`Growth → ${plans.find((p) => p.id === pendingPlan)?.name || ''}`}
        changes={
          pendingPlan && pendingPlan !== 'enterprise'
            ? [
                { field: 'Plan', from: 'Growth', to: plans.find((p) => p.id === pendingPlan)?.name || '' },
                { field: 'Base price', from: '₦2.4M / mo', to: plans.find((p) => p.id === pendingPlan)?.price + plans.find((p) => p.id === pendingPlan)?.period || '' },
              ]
            : undefined
        }
      />
    </DashboardLayout>
  )
}
