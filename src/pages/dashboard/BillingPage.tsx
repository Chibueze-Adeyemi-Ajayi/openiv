import { Box, Typography, Button } from '@mui/material'
import { colorPalette } from '@/theme'
import { useNavigate } from 'react-router-dom'
import { usePlan } from '@/hooks/usePlan'
import { useProfile } from '@/contexts/ProfileContext'
import WorkspacePremiumOutlinedIcon from '@mui/icons-material/WorkspacePremiumOutlined'
import SwapVertOutlinedIcon from '@mui/icons-material/SwapVertOutlined'
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined'
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import PolicyOutlinedIcon from '@mui/icons-material/PolicyOutlined'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined'
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined'
import MailOutlineRoundedIcon from '@mui/icons-material/MailOutlineRounded'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'

// ── helpers ───────────────────────────────────────────────────────────────────

function pct(used: number, max: number): number {
  if (max === -1 || max === 0) return 0
  return Math.min(100, (used / max) * 100)
}

function fmtNum(n: number | undefined | null): string {
  if (n == null) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`
  return n.toLocaleString()
}

function fmtNgn(n: number): string {
  if (n === 0) return 'Custom'
  return '₦' + n.toLocaleString('en-NG')
}

function daysUntilReset(periodStart: string | null): number | null {
  if (!periodStart) return null
  const elapsed = (Date.now() - new Date(periodStart).getTime()) / 86_400_000
  return Math.max(0, Math.ceil(30 - elapsed))
}

function periodEndDate(periodStart: string | null): Date | null {
  if (!periodStart) return null
  return new Date(new Date(periodStart).getTime() + 30 * 86_400_000)
}

function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null
  const ms = new Date(iso).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / 86_400_000))
}

const PLAN_ACCENT: Record<string, string> = {
  starter:    '#3b82f6',
  growth:     colorPalette.primary,
  enterprise: '#7c3aed',
}

const STATUS_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  trial:     { label: 'Trial',     bg: '#fef9c3', color: '#92400e' },
  active:    { label: 'Active',    bg: '#dcfce7', color: '#166534' },
  past_due:  { label: 'Past Due',  bg: '#fee2e2', color: '#991b1b' },
  cancelled: { label: 'Cancelled', bg: '#f1f5f9', color: '#64748b' },
}

// ── sub-components ────────────────────────────────────────────────────────────

function StatusChip({ status }: { status: string }) {
  const cfg = STATUS_BADGE[status] ?? STATUS_BADGE.active
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', px: 1.25, py: 0.375,
      bgcolor: cfg.bg, border: `1px solid ${cfg.color}30` }}>
      <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: cfg.color,
        letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'Jost' }}>
        {cfg.label}
      </Typography>
    </Box>
  )
}

interface UsageRowProps {
  icon: React.ReactNode
  label: string
  used: number
  max: number
  color: string
  unit?: string
}

function UsageRow({ icon, label, used, max, color, unit = '' }: UsageRowProps) {
  const unlimited = max === -1
  const p         = pct(used, max)
  const isDanger  = p >= 95
  const isWarn    = p >= 80 && !isDanger
  const barColor  = isDanger ? '#dc2626' : isWarn ? '#f59e0b' : color
  const remaining = unlimited ? null : max - used

  return (
    <Box sx={{ py: 2.5, borderBottom: '1px solid var(--border-col)', '&:last-child': { borderBottom: 'none' } }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <Box sx={{ color: unlimited ? '#94a3b8' : color, mt: '1px' }}>{icon}</Box>
          <Box>
            <Typography sx={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--on-surface)', fontFamily: 'Jost', lineHeight: 1.25 }}>
              {label}
            </Typography>
            {unlimited ? (
              <Typography sx={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>Unlimited</Typography>
            ) : (
              <Typography sx={{ fontSize: '0.75rem', color: isDanger ? '#dc2626' : isWarn ? '#d97706' : '#64748b' }}>
                {remaining != null ? `${fmtNum(remaining)}${unit} remaining` : ''}
              </Typography>
            )}
          </Box>
        </Box>
        <Box sx={{ textAlign: 'right' }}>
          <Typography sx={{ fontSize: '1.125rem', fontWeight: 800, color: isDanger ? '#dc2626' : '#0f172a', fontFamily: 'Jost', lineHeight: 1 }}>
            {fmtNum(used)}
          </Typography>
          <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8' }}>
            {unlimited ? 'used' : `of ${fmtNum(max)}`}
          </Typography>
        </Box>
      </Box>
      {!unlimited && (
        <Box sx={{ width: '100%', height: 5, bgcolor: 'var(--section-bg)', overflow: 'hidden' }}>
          <Box sx={{ width: `${p}%`, height: '100%', bgcolor: barColor, transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)' }} />
        </Box>
      )}
    </Box>
  )
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const plan     = usePlan()
  const { profile } = useProfile()
  const navigate = useNavigate()

  const accent     = PLAN_ACCENT[plan.slug ?? 'growth'] ?? colorPalette.primary
  const isTrial    = profile?.subscriptionStatus === 'trial'
  const isEnterprise = plan.slug === 'enterprise'

  const renewsAt   = profile?.subscriptionRenewsAt ?? null
  const trialEndsAt = profile?.trialEndsAt ?? null
  const renewDays  = isTrial ? daysUntil(trialEndsAt) : daysUntil(renewsAt)
  const resetDays  = daysUntilReset(plan.usagePeriodStart)
  const periodEnd  = periodEndDate(plan.usagePeriodStart)

  return (
    <Box sx={{ width: '100%', px: { xs: 2, md: 4 }, py: 4 }}>

      {/* ── Header ── */}
      <Box sx={{ mb: 4 }}>
        <Typography sx={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--heading-color)',
          fontFamily: 'Jost', letterSpacing: '-0.01em' }}>
          Billing & Subscription
        </Typography>
        <Typography sx={{ fontSize: '0.9375rem', color: '#64748b', mt: 0.5 }}>
          Your current plan, monthly usage, and limits.
        </Typography>
      </Box>

      {/* ── Top row: plan card + period card ── */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 340px' }, gap: 2.5, mb: 2.5 }}>

        {/* Current plan card */}
        <Box sx={{ border: `2px solid ${accent}`, bgcolor: `${accent}05`, p: 0, display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ bgcolor: accent, px: 3, py: 2.5, display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ width: 40, height: 40, bgcolor: 'rgba(255,255,255,0.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <WorkspacePremiumOutlinedIcon sx={{ fontSize: '1.25rem', color: '#fff' }} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)',
                letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'Jost' }}>
                Current Plan
              </Typography>
              <Typography sx={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', fontFamily: 'Jost', lineHeight: 1.2 }}>
                {plan.name ?? '—'}
              </Typography>
            </Box>
            {profile?.subscriptionStatus && (
              <StatusChip status={profile.subscriptionStatus} />
            )}
          </Box>

          <Box sx={{ px: 3, py: 2.5, flex: 1 }}>
            {/* Price */}
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, mb: 0.5 }}>
              <Typography sx={{ fontSize: '2rem', fontWeight: 800, color: accent, fontFamily: 'Jost', lineHeight: 1 }}>
                {plan.slug ? fmtNgn(plan.slug === 'starter' ? 500000 : plan.slug === 'growth' ? 750000 : 0) : '—'}
              </Typography>
              {!isEnterprise && (
                <Typography sx={{ fontSize: '0.875rem', color: '#94a3b8', fontFamily: 'Jost' }}> / month</Typography>
              )}
            </Box>

            {/* Renewal / trial notice */}
            {isTrial && renewDays !== null && (
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, mb: 2,
                px: 1.25, py: 0.5, bgcolor: renewDays <= 5 ? '#fef2f2' : '#fffbeb',
                border: `1px solid ${renewDays <= 5 ? '#fecaca' : '#fde68a'}` }}>
                <AccessTimeOutlinedIcon sx={{ fontSize: '0.875rem', color: renewDays <= 5 ? '#dc2626' : '#92400e' }} />
                <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700,
                  color: renewDays <= 5 ? '#dc2626' : '#92400e', fontFamily: 'Jost' }}>
                  {renewDays === 0 ? 'Trial expires today' : `${renewDays} day${renewDays === 1 ? '' : 's'} left in trial`}
                </Typography>
              </Box>
            )}

            {/* Key inclusions */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mb: 3 }}>
              {[
                `${plan.maxMonthlyTransactions === -1 ? 'Unlimited' : fmtNum(plan.maxMonthlyTransactions)} transactions / month`,
                `${plan.maxMonthlyKycLookups === -1 ? 'Unlimited' : fmtNum(plan.maxMonthlyKycLookups)} KYC lookups / month`,
                `${plan.maxActiveCases === -1 ? 'Unlimited' : fmtNum(plan.maxActiveCases)} concurrent active cases`,
                `${plan.maxUsers === -1 ? 'Unlimited' : plan.maxUsers} team members`,
                plan.maxAmlRules === 29 ? '29-rule AML engine' : `${plan.maxAmlRules}-rule AML engine`,
              ].map(line => (
                <Box key={line} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CheckCircleOutlinedIcon sx={{ fontSize: '0.875rem', color: accent, flexShrink: 0 }} />
                  <Typography sx={{ fontSize: '0.875rem', color: 'var(--on-surface-variant)', fontFamily: 'Jost' }}>{line}</Typography>
                </Box>
              ))}
            </Box>

            {/* Actions */}
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                onClick={() => navigate('/dashboard/subscription')}
                endIcon={<ArrowForwardRoundedIcon sx={{ fontSize: '0.875rem !important' }} />}
                sx={{
                  bgcolor: accent, color: '#fff', borderRadius: 0, textTransform: 'none',
                  fontFamily: 'Jost', fontWeight: 700, px: 2.5, py: 1, fontSize: '0.875rem',
                  boxShadow: 'none', '&:hover': { bgcolor: accent, filter: 'brightness(0.9)', boxShadow: 'none' },
                }}
              >
                {isEnterprise ? 'Manage Plan' : 'View Plans'}
              </Button>
              {isEnterprise && (
                <Button
                  href="mailto:support@openiv.com"
                  startIcon={<MailOutlineRoundedIcon sx={{ fontSize: '1rem !important' }} />}
                  sx={{
                    border: `1px solid ${accent}40`, color: accent, borderRadius: 0,
                    textTransform: 'none', fontFamily: 'Jost', fontWeight: 600,
                    px: 2, py: 1, fontSize: '0.875rem',
                    '&:hover': { bgcolor: `${accent}06`, borderColor: accent },
                  }}
                >
                  Contact Us
                </Button>
              )}
            </Box>
          </Box>
        </Box>

        {/* Billing period card */}
        <Box sx={{ border: '1px solid var(--border-col)', bgcolor: 'var(--card-bg)', p: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <Box>
            <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8',
              letterSpacing: '0.12em', textTransform: 'uppercase', mb: 1 }}>
              Billing Period
            </Typography>
            {isTrial ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75,
                px: 1.25, py: 0.625, bgcolor: '#fef9c3', border: '1px solid #fde68a', mb: 1 }}>
                <AccessTimeOutlinedIcon sx={{ fontSize: '0.875rem', color: '#92400e' }} />
                <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: '#92400e', fontFamily: 'Jost' }}>
                  Trial period
                </Typography>
              </Box>
            ) : (
              <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--on-surface)', fontFamily: 'Jost' }}>
                Renews {renewsAt
                  ? new Date(renewsAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
                  : '—'}
              </Typography>
            )}
          </Box>

          <Box sx={{ width: '100%', height: '1px', bgcolor: 'var(--border-col)' }} />

          <Box>
            <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8',
              letterSpacing: '0.12em', textTransform: 'uppercase', mb: 1 }}>
              Usage Window
            </Typography>
            <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--on-surface)', fontFamily: 'Jost', mb: 0.5 }}>
              {plan.usagePeriodStart
                ? new Date(plan.usagePeriodStart).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                : '—'}{' '}
              –{' '}
              {periodEnd
                ? periodEnd.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                : '—'}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <AccessTimeOutlinedIcon sx={{ fontSize: '0.8125rem', color: '#64748b' }} />
              <Typography sx={{ fontSize: '0.8125rem', color: '#64748b' }}>
                {resetDays != null
                  ? resetDays === 0 ? 'Resets today' : `Resets in ${resetDays} day${resetDays === 1 ? '' : 's'}`
                  : '—'}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ width: '100%', height: '1px', bgcolor: 'var(--border-col)' }} />

          <Box>
            <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8',
              letterSpacing: '0.12em', textTransform: 'uppercase', mb: 1 }}>
              Billing
            </Typography>
            {isEnterprise ? (
              <Typography sx={{ fontSize: '0.875rem', color: '#64748b' }}>
                Managed contract · invoiced separately
              </Typography>
            ) : (
              <Typography sx={{ fontSize: '0.875rem', color: '#64748b' }}>
                Monthly flat rate · auto-renews
              </Typography>
            )}
            <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8', mt: 0.5 }}>
              Limits reset every 30 days
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* ── Usage this period ── */}
      <Box sx={{ border: '1px solid var(--border-col)', bgcolor: 'var(--card-bg)', mb: 2.5 }}>
        <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid var(--border-col)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost' }}>
              Usage This Period
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
              {plan.usagePeriodStart
                ? `Started ${new Date(plan.usagePeriodStart).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`
                : 'Tracking monthly consumption against your plan limits'}
            </Typography>
          </Box>
          {resetDays != null && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75,
              px: 1.5, py: 0.625, bgcolor: 'var(--card-bg)', border: '1px solid var(--border-col)' }}>
              <AccessTimeOutlinedIcon sx={{ fontSize: '0.875rem', color: '#64748b' }} />
              <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--on-surface-variant)', fontFamily: 'Jost' }}>
                Resets in {resetDays} day{resetDays === 1 ? '' : 's'}
              </Typography>
            </Box>
          )}
        </Box>

        <Box sx={{ px: 3, py: 0.5 }}>
          <UsageRow
            icon={<SwapVertOutlinedIcon sx={{ fontSize: '1.1rem' }} />}
            label="Transactions Ingested"
            used={plan.monthlyTxnUsed}
            max={plan.maxMonthlyTransactions}
            color={colorPalette.primary}
            unit=" transactions"
          />
          <UsageRow
            icon={<BadgeOutlinedIcon sx={{ fontSize: '1.1rem' }} />}
            label="KYC Lookups"
            used={plan.monthlyKycUsed}
            max={plan.maxMonthlyKycLookups}
            color="#7c3aed"
            unit=" lookups"
          />
        </Box>
      </Box>

      {/* ── Plan limits summary ── */}
      <Box sx={{ border: '1px solid var(--border-col)', bgcolor: 'var(--card-bg)', mb: 2.5 }}>
        <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid var(--border-col)' }}>
          <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost' }}>
            Plan Limits
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
            Fixed entitlements included in your subscription
          </Typography>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 0 }}>
          {[
            { icon: <GavelOutlinedIcon sx={{ fontSize: '1rem' }} />,         label: 'Active Cases',    value: plan.maxActiveCases === -1 ? 'Unlimited' : fmtNum(plan.maxActiveCases),   sub: 'concurrent open cases' },
            { icon: <GroupsOutlinedIcon sx={{ fontSize: '1rem' }} />,        label: 'Team Members',   value: plan.maxUsers === -1 ? 'Unlimited' : String(plan.maxUsers),                sub: 'seats included' },
            { icon: <PolicyOutlinedIcon sx={{ fontSize: '1rem' }} />,        label: 'AML Rules',      value: String(plan.maxAmlRules),                                                  sub: 'detection rules active' },
            { icon: <AutoAwesomeOutlinedIcon sx={{ fontSize: '1rem' }} />,   label: 'Eureka AI',      value: plan.canUse('ai') ? 'Enabled' : 'Not included',                            sub: plan.canUse('ai') ? 'AI investigation assistant' : 'Upgrade to unlock' },
            { icon: <LockOutlinedIcon sx={{ fontSize: '1rem' }} />,          label: 'Behavioral Rules', value: plan.canUse('behavioral') ? 'Enabled' : 'Not included',                 sub: plan.canUse('behavioral') ? 'Anomaly detection active' : 'Upgrade to unlock' },
            { icon: <WorkspacePremiumOutlinedIcon sx={{ fontSize: '1rem' }} />, label: 'KYC Pipeline', value: plan.canUse('kyc') ? 'Enabled' : 'Not included',                         sub: plan.canUse('kyc') ? 'BVN, NIN, PEP checks' : 'Upgrade to unlock' },
          ].map(({ icon, label, value, sub }, i, arr) => {
            const isDisabled = value === 'Not included'
            const isLast = i === arr.length - 1
            return (
              <Box
                key={label}
                sx={{
                  px: 3, py: 2.25,
                  borderRight: (i + 1) % 3 === 0 || isLast ? 'none' : '1px solid var(--border-col)',
                  borderBottom: i < arr.length - 3 ? '1px solid var(--border-col)' : 'none',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: isDisabled ? '#cbd5e1' : '#64748b', mb: 0.75 }}>
                  {icon}
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: isDisabled ? '#cbd5e1' : '#64748b',
                    textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'Jost' }}>
                    {label}
                  </Typography>
                </Box>
                <Typography sx={{ fontSize: '1.125rem', fontWeight: 800, fontFamily: 'Jost',
                  color: isDisabled ? '#cbd5e1' : value === 'Unlimited' || value === 'Enabled' ? '#10b981' : '#0f172a',
                  lineHeight: 1.2, mb: 0.25 }}>
                  {value}
                </Typography>
                <Typography sx={{ fontSize: '0.6875rem', color: isDisabled ? '#cbd5e1' : '#94a3b8' }}>
                  {sub}
                </Typography>
              </Box>
            )
          })}
        </Box>
      </Box>

      {/* ── Upgrade banner — hidden for Enterprise ── */}
      {!isEnterprise && plan.isLoaded && (
        <Box sx={{ border: '1px solid #e0e7ff', bgcolor: '#f0f4ff', p: 3,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#1e40af', fontFamily: 'Jost', mb: 0.375 }}>
              {plan.slug === 'starter' ? 'Unlock Growth — more capacity, KYC, webhooks, and AI' : 'Enterprise — unlimited everything, dedicated SLA'}
            </Typography>
            <Typography sx={{ fontSize: '0.875rem', color: '#3b82f6' }}>
              {plan.slug === 'starter'
                ? '500k transactions/mo · 5k KYC lookups · full 29-rule AML engine'
                : 'Unlimited transactions, lookups, and cases · white-label option available'}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
            {plan.slug === 'starter' ? (
              <Button
                onClick={() => navigate('/dashboard/subscription')}
                endIcon={<ArrowForwardRoundedIcon sx={{ fontSize: '0.875rem !important' }} />}
                sx={{
                  bgcolor: '#1e40af', color: '#fff', borderRadius: 0, textTransform: 'none',
                  fontFamily: 'Jost', fontWeight: 700, px: 2.5, py: 1, fontSize: '0.875rem',
                  boxShadow: 'none', '&:hover': { bgcolor: '#1e3a8a', boxShadow: 'none' },
                }}
              >
                Upgrade to Growth
              </Button>
            ) : (
              <Button
                href="mailto:sales@openiv.com"
                startIcon={<MailOutlineRoundedIcon sx={{ fontSize: '1rem !important' }} />}
                sx={{
                  bgcolor: '#1e40af', color: '#fff', borderRadius: 0, textTransform: 'none',
                  fontFamily: 'Jost', fontWeight: 700, px: 2.5, py: 1, fontSize: '0.875rem',
                  boxShadow: 'none', '&:hover': { bgcolor: '#1e3a8a', boxShadow: 'none' },
                }}
              >
                Contact Enterprise Sales
              </Button>
            )}
          </Box>
        </Box>
      )}

    </Box>
  )
}
