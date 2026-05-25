import { Box, Typography, Chip, CircularProgress, Button, Divider } from '@mui/material'
import { useState, useEffect, useCallback } from 'react'

// Paystack inline popup — loaded via index.html script tag
declare const PaystackPop: {
  // Server-side initialized (access_code from /transaction/initialize)
  newTransaction: (opts: {
    key: string
    accessCode: string
    onSuccess: (tx: { reference: string }) => void
    onClose: () => void
  }) => void
  // Client-side initialized (public key + amount + ref)
  setup: (opts: {
    key: string
    email: string
    amount: number   // kobo
    ref: string
    currency?: string
    onSuccess: (tx: { reference: string }) => void
    onClose: () => void
  }) => { openIframe: () => void }
}
import { colorPalette } from '@/theme'
import { subscriptionApi, type SubscriptionPlan, type InstitutionSubscription, type ActiveDiscount } from '@/api/billing'
import { useProfile } from '@/contexts/ProfileContext'
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined'
import WorkspacePremiumOutlinedIcon from '@mui/icons-material/WorkspacePremiumOutlined'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import SwapVertOutlinedIcon from '@mui/icons-material/SwapVertOutlined'
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined'

const PLAN_ACCENT: Record<string, string> = {
  starter:    '#3b82f6',
  growth:     colorPalette.primary,
  enterprise: '#7c3aed',
}

const PLAN_BG: Record<string, string> = {
  starter:    '#eff6ff',
  growth:     `${colorPalette.primary}08`,
  enterprise: '#f5f3ff',
}

function fmtNgn(n: number) {
  return '₦' + n.toLocaleString('en-NG')
}

function fmtLimit(val: number | undefined | null, unit = '') {
  if (val == null || val === -1) return 'Unlimited'
  return val.toLocaleString() + (unit ? ' ' + unit : '')
}

function trialDaysLeft(trialEndsAt: string | null): number | null {
  if (!trialEndsAt) return null
  const diff = new Date(trialEndsAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / 86_400_000))
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { label: string; bg: string; color: string }> = {
    trial:      { label: 'Trial',       bg: '#fef9c3', color: '#92400e' },
    active:     { label: 'Active',      bg: '#dcfce7', color: '#166534' },
    past_due:   { label: 'Past Due',    bg: '#fee2e2', color: '#991b1b' },
    cancelled:  { label: 'Cancelled',  bg: '#f1f5f9', color: '#64748b' },
  }
  const c = cfg[status] ?? cfg.active
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', px: 1.25, py: 0.375,
      bgcolor: c.bg, borderRadius: '4px', border: `1px solid ${c.color}30` }}>
      <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: c.color,
        letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'Jost' }}>
        {c.label}
      </Typography>
    </Box>
  )
}

function PlanCard({
  plan, current, onUpgrade, upgrading, activeDiscount,
}: {
  plan: SubscriptionPlan
  current: InstitutionSubscription | null
  onUpgrade: (plan: SubscriptionPlan) => void
  upgrading: string | null
  activeDiscount?: ActiveDiscount | null
}) {
  const isCurrent  = current?.plan.id === plan.id
  const couponDaysLeft = activeDiscount?.couponExpiresAt
    ? Math.max(0, Math.ceil((new Date(activeDiscount.couponExpiresAt).getTime() - Date.now()) / 86_400_000))
    : 0
  const accent     = PLAN_ACCENT[plan.slug] ?? colorPalette.primary
  const bg         = PLAN_BG[plan.slug] ?? '#f8fafc'
  const isEnterprise = plan.slug === 'enterprise'
  const slugRank: Record<string, number> = { starter: 0, growth: 1, enterprise: 2 }
  const currentRank = current ? (slugRank[current.plan.slug] ?? 0) : 0
  const thisRank    = slugRank[plan.slug] ?? 0
  const isDowngrade = thisRank < currentRank

  return (
    <Box sx={{
      flex: '1 1 280px',
      minWidth: 260,
      maxWidth: 360,
      border: isCurrent ? `2px solid ${accent}` : '2px solid #e2e8f0',
      bgcolor: isCurrent ? bg : '#ffffff',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      transition: 'border-color 0.18s, box-shadow 0.18s',
      '&:hover': { boxShadow: isCurrent ? `0 0 0 4px ${accent}18` : '0 4px 24px rgba(15,23,42,0.08)' },
    }}>
      {/* Current badge */}
      {isCurrent && (
        <Box sx={{ position: 'absolute', top: -13, left: 20,
          px: 1.25, py: 0.25, bgcolor: accent, display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <CheckCircleOutlinedIcon sx={{ fontSize: '0.75rem', color: '#fff' }} />
          <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#fff',
            fontFamily: 'Jost', letterSpacing: '0.06em' }}>
            CURRENT PLAN
          </Typography>
        </Box>
      )}

      {/* Header */}
      <Box sx={{ p: 3, pb: 2, borderBottom: '1px solid #f1f5f9' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Box sx={{ width: 32, height: 32, bgcolor: `${accent}14`, display: 'flex',
            alignItems: 'center', justifyContent: 'center' }}>
            <WorkspacePremiumOutlinedIcon sx={{ fontSize: '1rem', color: accent }} />
          </Box>
          <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
            {plan.name}
          </Typography>
          {plan.aiFeaturesEnabled && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.375,
              px: 0.875, py: 0.25, bgcolor: '#fdf4ff', border: '1px solid #e879f91a' }}>
              <AutoAwesomeOutlinedIcon sx={{ fontSize: '0.7rem', color: '#9333ea' }} />
              <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#9333ea',
                letterSpacing: '0.06em', fontFamily: 'Jost' }}>
                AI
              </Typography>
            </Box>
          )}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
          <Typography sx={{ fontSize: '1.875rem', fontWeight: 800, color: accent, fontFamily: 'Jost', lineHeight: 1 }}>
            {isEnterprise ? 'Custom' : fmtNgn(plan.monthlyPriceNgn)}
          </Typography>
          {!isEnterprise && (
            <Typography sx={{ fontSize: '0.8125rem', color: '#94a3b8', fontFamily: 'Jost' }}>
              / month
            </Typography>
          )}
        </Box>
      </Box>

      {/* Limits */}
      <Box sx={{ p: 3, pb: 2 }}>
        {[
          { icon: <GroupsOutlinedIcon sx={{ fontSize: '0.9rem' }} />, label: 'Team members',      val: fmtLimit(plan.maxUsers) },
          { icon: <SwapVertOutlinedIcon sx={{ fontSize: '0.9rem' }} />, label: 'Transactions / mo', val: fmtLimit(plan.maxMonthlyTransactions) },
          { icon: <GavelOutlinedIcon sx={{ fontSize: '0.9rem' }} />, label: 'Active cases',       val: fmtLimit(plan.maxActiveCases) },
          { icon: <AccessTimeOutlinedIcon sx={{ fontSize: '0.9rem' }} />, label: 'KYC lookups / mo', val: fmtLimit(plan.maxMonthlyKycLookups ?? -1) },
        ].map(({ icon, label, val }) => (
          <Box key={label} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            py: 0.875, borderBottom: '1px solid #f8fafc' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#64748b' }}>
              {icon}
              <Typography sx={{ fontSize: '0.8125rem', fontFamily: 'Jost', color: '#64748b' }}>{label}</Typography>
            </Box>
            <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: val === 'Unlimited' ? accent : '#0f172a', fontFamily: 'Jost' }}>
              {val}
            </Typography>
          </Box>
        ))}
      </Box>

      <Divider sx={{ mx: 3 }} />

      {/* Features */}
      <Box sx={{ p: 3, flex: 1 }}>
        {plan.features.map((f) => (
          <Box key={f} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
            <CheckCircleOutlinedIcon sx={{ fontSize: '0.9rem', color: accent, mt: '2px', flexShrink: 0 }} />
            <Typography sx={{ fontSize: '0.8125rem', color: '#334155', fontFamily: 'Jost', lineHeight: 1.5 }}>{f}</Typography>
          </Box>
        ))}
      </Box>

      {/* CTA */}
      <Box sx={{ p: 3, pt: 0 }}>
        {isCurrent && activeDiscount && activeDiscount.discountPercent > 0 && (
          <Box sx={{ p: 1.5, bgcolor: '#fef9c3', border: '1px solid #fde68a', mb: 1.5 }}>
            <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: '#92400e', fontFamily: 'Jost' }}>
              🏷 {activeDiscount.discountPercent}% early renewal discount
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: '#92400e', mt: 0.25 }}>
              ₦{activeDiscount.discountedAmountNgn.toLocaleString('en-NG')} instead of ₦{activeDiscount.amountNgn.toLocaleString('en-NG')}
              {couponDaysLeft > 0 && ` · Expires in ${couponDaysLeft} day${couponDaysLeft === 1 ? '' : 's'}`}
              {couponDaysLeft === 0 && ' · Expires today'}
            </Typography>
          </Box>
        )}
        {isCurrent ? (
          <Box sx={{ py: 1.25, textAlign: 'center', bgcolor: `${accent}0c`,
            border: `1px solid ${accent}30` }}>
            <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: accent, fontFamily: 'Jost' }}>
              Your current plan
            </Typography>
          </Box>
        ) : isEnterprise ? (
          <Button fullWidth variant="outlined" href="mailto:sales@openiv.com"
            sx={{ borderRadius: 0, textTransform: 'none', fontFamily: 'Jost', fontWeight: 700,
              borderColor: accent, color: accent, py: 1.125, fontSize: '0.875rem',
              '&:hover': { bgcolor: `${accent}08`, borderColor: accent } }}>
            Contact Sales
          </Button>
        ) : (
          <Button
            fullWidth
            variant="contained"
            disabled={upgrading !== null}
            onClick={() => onUpgrade(plan)}
            sx={{ borderRadius: 0, textTransform: 'none', fontFamily: 'Jost', fontWeight: 700,
              bgcolor: accent, py: 1.125, fontSize: '0.875rem',
              '&:hover': { bgcolor: accent, filter: 'brightness(0.9)' },
              '&:disabled': { bgcolor: '#e2e8f0', color: '#94a3b8' } }}>
            {upgrading === plan.id ? (
              <CircularProgress size={16} sx={{ color: '#fff' }} />
            ) : isDowngrade ? 'Downgrade' : 'Upgrade'}
          </Button>
        )}
      </Box>
    </Box>
  )
}

export default function SubscriptionPage() {
  const { profile, refreshProfile } = useProfile()
  const [plans, setPlans]           = useState<SubscriptionPlan[]>([])
  const [sub,   setSub]             = useState<InstitutionSubscription | null>(null)
  const [loading, setLoading]       = useState(true)
  const [upgrading, setUpgrading]   = useState<string | null>(null)
  const [upgradeMsg, setUpgradeMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [activeDiscount, setActiveDiscount] = useState<ActiveDiscount | null>(null)
  const paystackKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY as string ?? ''
  const [devPayment, setDevPayment] = useState<{ reference: string } | null>(null)
  const [verifying, setVerifying] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [plansRes, subRes] = await Promise.all([
        subscriptionApi.listPlans(),
        subscriptionApi.getCurrent(),
      ])
      setPlans(plansRes.plans)
      setSub(subRes)
    } catch {
      // ignore — show empty state
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    subscriptionApi.getActiveDiscount().then(d => setActiveDiscount(d)).catch(() => {})
  }, [])

  const handleVerify = useCallback(async (reference: string) => {
    setVerifying(true)
    try {
      await subscriptionApi.verifyPayment(reference)
      setDevPayment(null)
      setActiveDiscount(null)
      // Refresh subscription data and profile in-place — no page reload
      refreshProfile()
      await load()
      setUpgradeMsg({ type: 'success', text: 'Payment confirmed! Your plan has been updated.' })
    } catch {
      setUpgradeMsg({ type: 'error', text: 'Payment not confirmed yet. Please wait a moment and try again.' })
    } finally {
      setVerifying(false)
    }
  }, [refreshProfile, load])

  const handleSelectPlan = useCallback(async (plan: SubscriptionPlan) => {
    if (plan.slug === 'enterprise') return
    setUpgrading(plan.id)
    setUpgradeMsg(null)
    setDevPayment(null)
    try {
      const result = await subscriptionApi.initiatePayment(plan.id, activeDiscount?.couponCode)
      setUpgrading(null)

      const popupAvailable = typeof PaystackPop !== 'undefined'
      const onSuccess = (tx: { reference: string }) => handleVerify(tx.reference)
      const onClose   = () => setUpgradeMsg({ type: 'error', text: 'Payment cancelled. You can try again when ready.' })

      if (paystackKey && popupAvailable && result.accessCode) {
        // Preferred: server-initialized session (access_code from Paystack)
        PaystackPop.newTransaction({ key: paystackKey, accessCode: result.accessCode, onSuccess, onClose })
      } else if (paystackKey && popupAvailable) {
        // Fallback: client-side initialization using reference + amount (no backend secret needed)
        PaystackPop.setup({
          key: paystackKey,
          email: profile?.email ?? '',
          amount: Math.round(result.discountedAmountNgn * 100),  // NGN → kobo
          ref: result.reference,
          currency: 'NGN',
          onSuccess,
          onClose,
        }).openIframe()
      } else {
        // Dev/local: no Paystack key configured at all — show simulate button
        setDevPayment({ reference: result.reference })
      }
    } catch (err: any) {
      const body = err?.body
      if (body?.error === 'downgrade_window_closed') {
        setUpgradeMsg({ type: 'error', text: 'Downgrade is only available within 3 days of your plan renewal date.' })
      } else {
        setUpgradeMsg({ type: 'error', text: 'Failed to initiate payment. Please try again.' })
      }
      setUpgrading(null)
    }
  }, [activeDiscount, paystackKey, handleVerify, profile])

  const daysLeft   = sub ? trialDaysLeft(sub.trialEndsAt) : null
  const isTrial    = sub?.status === 'trial'
  const accent     = sub ? (PLAN_ACCENT[sub.plan.slug] ?? colorPalette.primary) : colorPalette.primary

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto', px: { xs: 2, md: 4 }, py: 4 }}>

      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography sx={{ fontSize: '1.375rem', fontWeight: 800, color: '#00288e',
          fontFamily: 'Jost', letterSpacing: '-0.01em' }}>
          Subscription
        </Typography>
        <Typography sx={{ fontSize: '0.9375rem', color: '#64748b', mt: 0.5, fontFamily: 'Jost' }}>
          Manage your plan, feature access, and billing cycle.
        </Typography>
      </Box>

      {/* Current plan summary bar */}
      {sub && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, flexWrap: 'wrap',
          p: 2.5, mb: 4, border: `1px solid ${accent}30`, bgcolor: `${accent}06` }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, minWidth: 200 }}>
            <Box sx={{ width: 40, height: 40, bgcolor: `${accent}14`, display: 'flex',
              alignItems: 'center', justifyContent: 'center' }}>
              <WorkspacePremiumOutlinedIcon sx={{ fontSize: '1.25rem', color: accent }} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: '0.75rem', color: '#64748b', fontFamily: 'Jost', fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Current Plan
              </Typography>
              <Typography sx={{ fontSize: '1.0625rem', fontWeight: 800, color: '#0f172a', fontFamily: 'Jost' }}>
                {sub.plan.name}
              </Typography>
            </Box>
          </Box>

          <StatusBadge status={sub.status} />

          {isTrial && daysLeft !== null && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75,
              px: 1.5, py: 0.75, bgcolor: daysLeft <= 5 ? '#fef2f2' : '#fffbeb',
              border: `1px solid ${daysLeft <= 5 ? '#fecaca' : '#fde68a'}` }}>
              <AccessTimeOutlinedIcon sx={{ fontSize: '0.9rem', color: daysLeft <= 5 ? '#dc2626' : '#92400e' }} />
              <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700,
                color: daysLeft <= 5 ? '#dc2626' : '#92400e', fontFamily: 'Jost' }}>
                {daysLeft === 0 ? 'Trial expires today' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left in trial`}
              </Typography>
            </Box>
          )}

          <Box sx={{ textAlign: 'right' }}>
            <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8', fontFamily: 'Jost' }}>
              {isTrial ? 'Trial ends' : 'Renews'}
            </Typography>
            <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
              {new Date(isTrial ? sub.trialEndsAt! : sub.renewsAt!).toLocaleDateString('en-GB',
                { day: 'numeric', month: 'short', year: 'numeric' })}
            </Typography>
          </Box>
        </Box>
      )}

      {/* Upgrade message */}
      {upgradeMsg && (
        <Box sx={{ mb: 3, px: 2.5, py: 1.5,
          bgcolor: upgradeMsg.type === 'success' ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${upgradeMsg.type === 'success' ? '#bbf7d0' : '#fecaca'}` }}>
          <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, fontFamily: 'Jost',
            color: upgradeMsg.type === 'success' ? '#166534' : '#991b1b' }}>
            {upgradeMsg.text}
          </Typography>
        </Box>
      )}

      {/* Plan cards */}
      <Box sx={{ mb: 4 }}>
        <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#64748b',
          textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'Jost', mb: 2.5 }}>
          Available Plans
        </Typography>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress size={32} sx={{ color: colorPalette.primary }} />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'stretch' }}>
            {plans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                current={sub}
                onUpgrade={handleSelectPlan}
                upgrading={upgrading}
                activeDiscount={activeDiscount}
              />
            ))}
          </Box>
        )}

        {/* Dev-mode simulation panel — shown only when Paystack is not configured */}
        {devPayment && (
          <Box sx={{ border: '1px solid #fde68a', bgcolor: '#fef9c3', p: 2.5, mt: 2.5 }}>
            <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#92400e', mb: 0.5, fontFamily: 'Jost' }}>
              Dev mode — Paystack not configured
            </Typography>
            <Typography sx={{ fontSize: '0.8125rem', color: '#92400e', mb: 2 }}>
              No live Paystack key detected. Click below to simulate a successful payment.
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Button
                variant="contained"
                disabled={verifying}
                onClick={() => handleVerify(devPayment.reference)}
                sx={{ borderRadius: 0, textTransform: 'none', fontFamily: 'Jost', fontWeight: 700,
                  bgcolor: '#92400e', boxShadow: 'none',
                  '&:hover': { bgcolor: '#78350f', boxShadow: 'none' } }}
              >
                {verifying ? 'Verifying...' : 'Simulate payment success'}
              </Button>
              <Button
                onClick={() => setDevPayment(null)}
                sx={{ borderRadius: 0, textTransform: 'none', fontFamily: 'Jost', color: '#92400e' }}
              >
                Cancel
              </Button>
            </Box>
          </Box>
        )}
      </Box>

      {/* Usage limits callout */}
      {sub && (
        <Box sx={{ p: 3, border: '1px solid #e2e8f0', bgcolor: '#f8fafc' }}>
          <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a',
            fontFamily: 'Jost', mb: 2 }}>
            Your plan limits
          </Typography>
          <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {[
              { label: 'Team members',      val: fmtLimit(sub.plan.maxUsers),                icon: <GroupsOutlinedIcon sx={{ fontSize: '1.1rem', color: accent }} /> },
              { label: 'Transactions / mo', val: fmtLimit(sub.plan.maxMonthlyTransactions),  icon: <SwapVertOutlinedIcon sx={{ fontSize: '1.1rem', color: accent }} /> },
              { label: 'Active cases',       val: fmtLimit(sub.plan.maxActiveCases),          icon: <GavelOutlinedIcon sx={{ fontSize: '1.1rem', color: accent }} /> },
              { label: 'API rate limit',     val: `${sub.plan.apiRateLimitPerMin} req/min`,   icon: <AutoAwesomeOutlinedIcon sx={{ fontSize: '1.1rem', color: accent }} /> },
              { label: 'Eureka AI',          val: sub.plan.aiFeaturesEnabled ? 'Enabled' : 'Not included',
                icon: <AutoAwesomeOutlinedIcon sx={{ fontSize: '1.1rem', color: sub.plan.aiFeaturesEnabled ? '#9333ea' : '#94a3b8' }} /> },
            ].map(({ label, val, icon }) => (
              <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 180 }}>
                {icon}
                <Box>
                  <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', fontFamily: 'Jost',
                    textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                    {label}
                  </Typography>
                  <Typography sx={{ fontSize: '0.9375rem', fontWeight: 800, color: '#0f172a', fontFamily: 'Jost' }}>
                    {val}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {/* Footer note */}
      <Box sx={{ mt: 3, pt: 3, borderTop: '1px solid #f1f5f9' }}>
        <Typography sx={{ fontSize: '0.8125rem', color: '#94a3b8', fontFamily: 'Jost' }}>
          Plans are billed monthly. Overages on transactions and cases are charged at pay-as-you-go rates from your wallet balance.
          For custom enterprise contracts or volume pricing, contact{' '}
          <Box component="a" href="mailto:sales@openiv.com"
            sx={{ color: colorPalette.primary, textDecoration: 'none', fontWeight: 600,
              '&:hover': { textDecoration: 'underline' } }}>
            sales@openiv.com
          </Box>.
        </Typography>
      </Box>

      {/* Institution name / account label */}
      {profile?.institutionName && (
        <Box sx={{ mt: 1 }}>
          <Chip
            label={profile.institutionName}
            size="small"
            sx={{ bgcolor: '#f1f5f9', color: '#64748b', fontFamily: 'Jost', fontSize: '0.75rem',
              fontWeight: 600, borderRadius: '4px', height: 22 }}
          />
        </Box>
      )}
    </Box>
  )
}
