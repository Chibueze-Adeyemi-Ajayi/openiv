import { Box, Typography, Button, Divider } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { colorPalette } from '@/theme'
import { usePlanModal } from '@/contexts/PlanContext'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import WorkspacePremiumOutlinedIcon from '@mui/icons-material/WorkspacePremiumOutlined'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'

const PLAN_ACCENT: Record<string, string> = {
  starter:    '#3b82f6',
  growth:     colorPalette.primary,
  scale:      '#0ea5e9',
  enterprise: '#7c3aed',
}

const FEATURE_META: Record<string, {
  label: string
  description: string
  perks: string[]
  icon: React.ReactNode
}> = {
  kyc: {
    label:       'KYC Lookup',
    description: 'Verify identities, run PEP checks, and access full KYC pipeline results for your customers.',
    perks:       ['BVN & NIN verification', 'PEP / sanctions screening', 'Pipeline result history', 'Customer KYC profiles'],
    icon:        <AutoAwesomeOutlinedIcon sx={{ fontSize: '1.5rem' }} />,
  },
  webhooks: {
    label:       'Webhooks',
    description: 'Push real-time events to your systems as transactions, flags, and cases are processed.',
    perks:       ['Custom endpoint management', 'Event delivery logs', 'HMAC signing & security rules', 'Retry & failure tracking'],
    icon:        <WorkspacePremiumOutlinedIcon sx={{ fontSize: '1.5rem' }} />,
  },
  network: {
    label:       'Network Logs',
    description: 'Unified view of all beam and webhook traffic flowing through your institution.',
    perks:       ['Inbound beam traffic', 'Webhook delivery history', 'Latency & error metrics', 'Full request payloads'],
    icon:        <WorkspacePremiumOutlinedIcon sx={{ fontSize: '1.5rem' }} />,
  },
  behavioral: {
    label:       'Behavioral Patterns',
    description: 'Configure and monitor advanced behavioral anomaly rules beyond threshold-based detection.',
    perks:       ['Micro-timing anomaly detection', 'Pattern rule configuration', 'Cross-session profiling', 'Risk contribution breakdown'],
    icon:        <AutoAwesomeOutlinedIcon sx={{ fontSize: '1.5rem' }} />,
  },
  reports_export: {
    label:       'Report Export',
    description: 'Download transaction exports and generate GoAML-formatted NFIU submission files.',
    perks:       ['CSV / Excel transaction export', 'GoAML XML generation', 'Batch filing support', 'Audit trail download'],
    icon:        <WorkspacePremiumOutlinedIcon sx={{ fontSize: '1.5rem' }} />,
  },
  active_cases: {
    label:       'Case Limit Reached',
    description: 'You\'ve reached the maximum number of active cases allowed on your current plan.',
    perks:       ['Unlimited active cases', 'Higher transaction volumes', 'More team members', 'Enterprise SLA'],
    icon:        <LockOutlinedIcon sx={{ fontSize: '1.5rem' }} />,
  },
  txn_cap: {
    label:       'Monthly Transaction Limit Reached',
    description: 'Your institution has used all monthly transaction slots included in your current plan. Usage resets after 30 days.',
    perks:       ['Higher monthly transaction volume', 'Unlimited ingest on Enterprise', 'Real-time usage dashboard', 'Overage alerts'],
    icon:        <LockOutlinedIcon sx={{ fontSize: '1.5rem' }} />,
  },
  kyc_cap: {
    label:       'Monthly KYC Step Limit Reached',
    description: 'Your institution has used all KYC steps included in your current plan. Each Dojah call (BVN/NIN lookup, phone basic, phone fraud, liveness, PEP) counts as one step. Usage resets after 30 days.',
    perks:       ['Higher monthly KYC step volume', 'Unlimited steps on Enterprise', 'BVN / NIN + phone fraud + liveness', 'PEP screening'],
    icon:        <LockOutlinedIcon sx={{ fontSize: '1.5rem' }} />,
  },
  nfiu_cap: {
    label:       'Monthly NFIU Filing Limit Reached',
    description: 'Your institution has used all monthly NFIU filings included in your current plan. Usage resets after 30 days.',
    perks:       ['Higher monthly filing volume', 'Unlimited filings on Enterprise', 'STR / CTR support', 'GoAML export'],
    icon:        <LockOutlinedIcon sx={{ fontSize: '1.5rem' }} />,
  },
  case_cap: {
    label:       'Monthly Case Limit Reached',
    description: 'Your institution has opened the maximum cases allowed this month. Usage resets after 30 days.',
    perks:       ['Higher monthly case volume', 'Unlimited cases on Enterprise', 'Faster analyst throughput', 'More team seats'],
    icon:        <LockOutlinedIcon sx={{ fontSize: '1.5rem' }} />,
  },
  team_seats: {
    label:       'Team Seat Limit Reached',
    description: 'Your institution has used all team seats included in your current plan. Upgrade to invite more analysts and reviewers.',
    perks:       ['More team seats', 'Unlimited seats on Enterprise', 'Granular custom roles', 'Higher monthly volumes across the platform'],
    icon:        <LockOutlinedIcon sx={{ fontSize: '1.5rem' }} />,
  },
}

const PLAN_LABEL: Record<string, string> = {
  starter:    'Starter',
  growth:     'Growth',
  scale:      'Scale',
  enterprise: 'Enterprise',
}

export default function UpgradeModal() {
  const { upgradeModal, closeUpgrade } = usePlanModal()
  const navigate = useNavigate()

  if (!upgradeModal) return null

  const { feature, currentPlan, requiredPlan, detail } = upgradeModal
  const meta      = FEATURE_META[feature] ?? FEATURE_META['active_cases']
  const accent    = PLAN_ACCENT[requiredPlan] ?? colorPalette.primary
  const isLimit   = feature === 'active_cases'

  const handleViewPlans = () => {
    closeUpgrade()
    navigate('/dashboard/subscription')
  }

  return (
    // Backdrop
    <Box
      onClick={closeUpgrade}
      sx={{
        position: 'fixed', inset: 0, zIndex: 1500,
        bgcolor: 'rgba(15,23,42,0.55)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        p: 2,
        animation: 'fadeIn 0.18s ease',
        '@keyframes fadeIn': { from: { opacity: 0 }, to: { opacity: 1 } },
      }}
    >
      {/* Card */}
      <Box
        onClick={(e) => e.stopPropagation()}
        sx={{
          width: '100%', maxWidth: 480,
          bgcolor: 'var(--card-bg)',
          display: 'flex', flexDirection: 'column',
          animation: 'slideUp 0.22s cubic-bezier(0.34,1.56,0.64,1)',
          '@keyframes slideUp': {
            from: { opacity: 0, transform: 'translateY(24px) scale(0.97)' },
            to:   { opacity: 1, transform: 'translateY(0) scale(1)' },
          },
        }}
      >
        {/* Coloured header band */}
        <Box sx={{
          bgcolor: accent, px: 3, pt: 3, pb: 2.5,
          display: 'flex', alignItems: 'flex-start', gap: 2,
          position: 'relative',
        }}>
          <Box sx={{ width: 44, height: 44, bgcolor: 'rgba(255,255,255,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, color: '#ffffff' }}>
            {meta.icon}
          </Box>
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
              {isLimit
                ? <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)',
                    textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'Jost' }}>
                    Limit Reached
                  </Typography>
                : <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)',
                    textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'Jost' }}>
                    Upgrade Required
                  </Typography>
              }
            </Box>
            <Typography sx={{ fontSize: '1.125rem', fontWeight: 800, color: '#ffffff',
              fontFamily: 'Jost', lineHeight: 1.25 }}>
              {meta.label}
            </Typography>
          </Box>
          <Box onClick={closeUpgrade} sx={{ cursor: 'pointer', color: 'rgba(255,255,255,0.7)',
            '&:hover': { color: '#ffffff' }, mt: '-2px' }}>
            <CloseRoundedIcon sx={{ fontSize: '1.1rem' }} />
          </Box>
        </Box>

        {/* Body */}
        <Box sx={{ px: 3, py: 2.5 }}>
          {/* Plan pill */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
            <Box sx={{ px: 1.25, py: 0.375, bgcolor: 'var(--section-bg)', border: '1px solid var(--border-col)' }}>
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b',
                fontFamily: 'Jost', letterSpacing: '0.06em' }}>
                YOUR PLAN: {PLAN_LABEL[currentPlan]?.toUpperCase() ?? currentPlan.toUpperCase()}
              </Typography>
            </Box>
            <ArrowForwardRoundedIcon sx={{ fontSize: '0.875rem', color: '#94a3b8' }} />
            <Box sx={{ px: 1.25, py: 0.375, bgcolor: `${accent}12`, border: `1px solid ${accent}30` }}>
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: accent,
                fontFamily: 'Jost', letterSpacing: '0.06em' }}>
                REQUIRES: {PLAN_LABEL[requiredPlan]?.toUpperCase() ?? requiredPlan.toUpperCase()}
              </Typography>
            </Box>
          </Box>

          <Typography sx={{ fontSize: '0.9375rem', color: 'var(--on-surface-variant)', lineHeight: 1.6,
            fontFamily: 'Jost', mb: 2.5 }}>
            {detail || meta.description}
          </Typography>

          <Divider sx={{ mb: 2 }} />

          {/* Perks */}
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b',
            textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'Jost', mb: 1.5 }}>
            What you'll unlock
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 3 }}>
            {meta.perks.map((perk) => (
              <Box key={perk} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CheckCircleOutlinedIcon sx={{ fontSize: '0.9rem', color: accent, flexShrink: 0 }} />
                <Typography sx={{ fontSize: '0.875rem', color: 'var(--on-surface-variant)', fontFamily: 'Jost' }}>
                  {perk}
                </Typography>
              </Box>
            ))}
          </Box>

          {/* Actions */}
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Button
              fullWidth
              variant="contained"
              onClick={handleViewPlans}
              endIcon={<ArrowForwardRoundedIcon sx={{ fontSize: '0.875rem !important' }} />}
              sx={{
                bgcolor: accent, borderRadius: 0, textTransform: 'none',
                fontFamily: 'Jost', fontWeight: 700, py: 1.25, fontSize: '0.9375rem',
                boxShadow: 'none',
                '&:hover': { bgcolor: accent, filter: 'brightness(0.9)', boxShadow: 'none' },
              }}
            >
              View Plans & Upgrade
            </Button>
            <Button
              onClick={closeUpgrade}
              sx={{
                borderRadius: 0, textTransform: 'none', fontFamily: 'Jost',
                fontWeight: 600, color: '#64748b', px: 2, flexShrink: 0,
                '&:hover': { bgcolor: 'var(--section-bg)' },
              }}
            >
              Later
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
