import { Box, Typography, Stack, Button, Chip } from '@mui/material'
import { colorPalette } from '@/theme'
import DashboardLayout from '@/components/dashboard/DashboardLayout'
import TOTPConfirmation from '@/components/dashboard/TOTPConfirmation'
import { useState } from 'react'
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import RemoveRoundedIcon from '@mui/icons-material/RemoveRounded'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined'
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded'

interface Pillar {
  id: string
  number: number
  title: string
  cbnRequirement: string
  openIVCapability: string
  status: 'covered' | 'partial' | 'gap'
  evidence: string[]
  gaps?: string[]
}

const pillars: Pillar[] = [
  {
    id: 'realtime',
    number: 1,
    title: 'Real-time Monitoring',
    cbnRequirement: 'Behavioral analytics that flag anomalies in seconds, not days. Institutions must demonstrate transaction inspection latency below industry baselines.',
    openIVCapability: 'OpenIV inspects every transaction in <14ms via the live stream. Behavioral anomalies surface to the case queue within the same SLA.',
    status: 'covered',
    evidence: [
      'Median transaction-scoring latency: 11ms (last 30 days)',
      '6 behavioral signal streams active (Transactions, Logins, Activity, Location, Devices, Webhooks)',
      'Live alert feed with severity classification operational',
    ],
  },
  {
    id: 'risk-scoring',
    number: 2,
    title: 'Dynamic Risk Assessment',
    cbnRequirement: "Real-time recalibration of customer risk scores based on evolving behavior. Static periodic reviews are no longer sufficient.",
    openIVCapability: 'Every customer holds a continuously-updated risk score driven by 200+ behavioral signals. Score decays and recovers based on live activity.',
    status: 'covered',
    evidence: [
      '847,219 customer profiles with live risk scoring',
      'Score recalculation triggered on every event (transaction, login, KYC change)',
      'High-risk profiles auto-routed to enhanced due diligence queue',
    ],
  },
  {
    id: 'screening',
    number: 3,
    title: 'Automated Sanctions & PEP Screening',
    cbnRequirement: 'Continuous checking against global and domestic Sanctions and PEP lists — at onboarding and on every transaction touching a counterparty.',
    openIVCapability: 'OpenIV integrates OFAC, UN, EU, NFIU, and CBN-maintained PEP/sanctions lists. Counterparty screening fires on every wire over ₦100k.',
    status: 'partial',
    evidence: [
      'OFAC and UN consolidated lists synced hourly',
      'NFIU domestic PEP list integrated',
      'Counterparty screening enabled on all wire transactions',
    ],
    gaps: [
      'Pending: EU sanctions list daily refresh hook',
      'Pending: Adverse media screening integration (NewsRoom feed)',
    ],
  },
  {
    id: 'kyc',
    number: 4,
    title: 'Integrated KYC / CDD',
    cbnRequirement: 'Onboarding flows that connect identity verification (BVN/NIN) directly to ongoing transaction monitoring — no manual handoffs.',
    openIVCapability: 'NIBSS BVN and NIMC NIN verification feed directly into the customer profile. KYC tier changes trigger automatic risk re-scoring.',
    status: 'covered',
    evidence: [
      'NIBSS BVN verification integrated (NIBSS-eBVN-API v3)',
      'NIMC NIN verification integrated',
      'Tier-1/2/3 customer classification with auto-risk inheritance',
      '142 EDD profiles under enhanced monitoring',
    ],
  },
  {
    id: 'reporting',
    number: 5,
    title: 'Automated NFIU Reporting',
    cbnRequirement: 'Auto-generation of STRs and SARs in NFIU-prescribed digital formats. The new Standards specifically prohibit manual entry for institutions above MFB-2 tier.',
    openIVCapability: 'STRs are auto-drafted by Eureka the moment a case crosses the regulatory threshold. NFIU electronic-filing format is the default output.',
    status: 'covered',
    evidence: [
      '847 reports filed YTD (NFIU + CBN combined)',
      '99.7% NFIU acknowledgement rate',
      'Average filing time: 3.2 minutes from flag to submission',
      'CBN Risk-Based Supervision Return template active',
    ],
  },
]

const statusConfig: Record<Pillar['status'], { color: string; bg: string; icon: React.ReactNode; label: string }> = {
  covered: { color: '#10b981', bg: '#f0fdf4', icon: <CheckRoundedIcon sx={{ fontSize: '0.875rem' }} />, label: 'Covered' },
  partial: { color: '#f59e0b', bg: '#fffbeb', icon: <WarningAmberRoundedIcon sx={{ fontSize: '0.875rem' }} />, label: 'Partial' },
  gap: { color: '#dc2626', bg: '#fef2f2', icon: <RemoveRoundedIcon sx={{ fontSize: '0.875rem' }} />, label: 'Gap' },
}

const today = new Date('2026-04-19')
const deadline = new Date('2026-06-10')
const daysRemaining = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

export default function CBNCompliancePage() {
  const [planGenerated, setPlanGenerated] = useState(false)
  const [submitOpen, setSubmitOpen] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const coveredCount = pillars.filter((p) => p.status === 'covered').length
  const score = Math.round((coveredCount / pillars.length) * 100)

  return (
    <DashboardLayout>
      <Box sx={{ p: 4 }}>
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
            <GavelOutlinedIcon sx={{ fontSize: '0.875rem', color: colorPalette.primary }} />
            <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: colorPalette.primary, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
              Regulatory Filing
            </Typography>
          </Box>
          <Typography sx={{ fontSize: '1.625rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost', letterSpacing: '-0.015em', mb: 0.5 }}>
            CBN Implementation Plan · June 10, 2026
          </Typography>
          <Typography sx={{ fontSize: '0.9375rem', color: '#64748b', maxWidth: 760 }}>
            Per the CBN Baseline Standards for Automated AML Solutions (March 10, 2026), every CBN-licensed institution must submit an implementation plan declaring how it will move from manual to AI-driven compliance.
          </Typography>
        </Box>

        {/* Deadline banner */}
        <Box
          sx={{
            bgcolor: daysRemaining < 30 ? '#dc2626' : daysRemaining < 60 ? '#f59e0b' : colorPalette.primary,
            color: '#ffffff',
            p: 3,
            mb: 3,
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              width: 96,
              height: 96,
              bgcolor: 'rgba(255,255,255,0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              flexShrink: 0,
            }}
          >
            <Typography sx={{ fontSize: '2.25rem', fontWeight: 700, lineHeight: 1, fontFamily: 'Jost' }}>
              {daysRemaining}
            </Typography>
            <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.15em', mt: 0.5 }}>
              DAYS LEFT
            </Typography>
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', opacity: 0.85, mb: 0.5 }}>
              Submission deadline
            </Typography>
            <Typography sx={{ fontSize: '1.375rem', fontWeight: 700, fontFamily: 'Jost', mb: 0.75 }}>
              Wednesday, 10 June 2026
            </Typography>
            <Typography sx={{ fontSize: '0.875rem', opacity: 0.9, lineHeight: 1.55, maxWidth: 640 }}>
              Implementation plans must be filed via the CBN Compliance Portal, signed by the Chief Compliance Officer, with timelines and KPIs for each of the five pillars.
            </Typography>
          </Box>

          {/* Score gauge */}
          <Box
            sx={{
              textAlign: 'center',
              borderLeft: '1px solid rgba(255,255,255,0.2)',
              pl: 3,
              minWidth: 140,
            }}
          >
            <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.15em', opacity: 0.85, mb: 0.5 }}>
              READINESS
            </Typography>
            <Typography sx={{ fontSize: '2.5rem', fontWeight: 700, lineHeight: 1, fontFamily: 'Jost' }}>
              {score}%
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', opacity: 0.85, mt: 0.5 }}>
              {coveredCount} of {pillars.length} pillars covered
            </Typography>
          </Box>
        </Box>

        {/* 5 Pillars */}
        <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', mb: 3 }}>
          <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid #eef0f4' }}>
            <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
              The five pillars
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
              CBN Baseline Standards · §3.1 — §3.5 · OpenIV's coverage status against each
            </Typography>
          </Box>

          {pillars.map((p, i) => {
            const cfg = statusConfig[p.status]
            return (
              <Box
                key={p.id}
                sx={{
                  px: 3,
                  py: 3,
                  borderBottom: i === pillars.length - 1 ? 'none' : '1px solid #f4f5f7',
                  display: 'grid',
                  gridTemplateColumns: '60px 1fr 1fr 130px',
                  gap: 3,
                  alignItems: 'flex-start',
                }}
              >
                {/* Number */}
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    bgcolor: cfg.bg,
                    color: cfg.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '1.125rem',
                    fontFamily: 'Jost',
                  }}
                >
                  {p.number}
                </Box>

                {/* CBN side */}
                <Box>
                  <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 0.5 }}>
                    CBN requires
                  </Typography>
                  <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost', mb: 0.875 }}>
                    {p.title}
                  </Typography>
                  <Typography sx={{ fontSize: '0.8125rem', color: '#475569', lineHeight: 1.6 }}>
                    {p.cbnRequirement}
                  </Typography>
                </Box>

                {/* OpenIV side */}
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.625, mb: 0.5 }}>
                    <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: colorPalette.primary, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                      OpenIV provides
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a', fontFamily: 'Jost', mb: 1, lineHeight: 1.5 }}>
                    {p.openIVCapability}
                  </Typography>

                  {/* Evidence */}
                  <Stack gap={0.5}>
                    {p.evidence.map((e, ei) => (
                      <Box key={ei} sx={{ display: 'flex', gap: 0.875, alignItems: 'flex-start' }}>
                        <CheckRoundedIcon sx={{ fontSize: '0.875rem', color: '#10b981', mt: 0.25, flexShrink: 0 }} />
                        <Typography sx={{ fontSize: '0.75rem', color: '#475569' }}>{e}</Typography>
                      </Box>
                    ))}
                    {p.gaps?.map((g, gi) => (
                      <Box key={gi} sx={{ display: 'flex', gap: 0.875, alignItems: 'flex-start' }}>
                        <WarningAmberRoundedIcon sx={{ fontSize: '0.875rem', color: '#f59e0b', mt: 0.25, flexShrink: 0 }} />
                        <Typography sx={{ fontSize: '0.75rem', color: '#475569' }}>{g}</Typography>
                      </Box>
                    ))}
                  </Stack>
                </Box>

                {/* Status */}
                <Box sx={{ textAlign: 'right' }}>
                  <Chip
                    icon={cfg.icon as any}
                    label={cfg.label.toUpperCase()}
                    size="small"
                    sx={{
                      bgcolor: cfg.bg,
                      color: cfg.color,
                      fontWeight: 700,
                      fontSize: '0.625rem',
                      letterSpacing: '0.1em',
                      borderRadius: 0,
                      height: 24,
                      '& .MuiChip-icon': { color: cfg.color, ml: 0.875 },
                      '& .MuiChip-label': { px: 0.875 },
                    }}
                  />
                </Box>
              </Box>
            )
          })}
        </Box>

        {/* Generate plan card */}
        <Box
          sx={{
            bgcolor: planGenerated ? '#ffffff' : colorPalette.primary,
            color: planGenerated ? '#0f172a' : '#ffffff',
            border: planGenerated ? '1px solid #eef0f4' : 'none',
            p: 3,
            position: 'relative',
            overflow: 'hidden',
            transition: 'all 0.3s ease',
            '&::before': planGenerated ? {} : {
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
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 3, position: 'relative', zIndex: 1 }}>
            <Box sx={{ flex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                {planGenerated ? (
                  <VerifiedOutlinedIcon sx={{ fontSize: '1.125rem', color: '#10b981' }} />
                ) : (
                  <AutoAwesomeOutlinedIcon sx={{ fontSize: '1.125rem' }} />
                )}
                <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', opacity: planGenerated ? 1 : 0.85, color: planGenerated ? '#10b981' : 'inherit' }}>
                  {planGenerated ? 'Plan ready for review' : 'Eureka can draft this for you'}
                </Typography>
              </Box>
              <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, mb: 1, fontFamily: 'Jost', letterSpacing: '-0.01em', maxWidth: '85%' }}>
                {planGenerated
                  ? 'CBN Implementation Plan — First City Monument Bank, drafted 19 April 2026'
                  : 'Generate a CBN-ready implementation plan in under 60 seconds'}
              </Typography>
              <Typography sx={{ fontSize: '0.875rem', opacity: planGenerated ? 0.7 : 0.85, maxWidth: '80%', lineHeight: 1.6 }}>
                {planGenerated
                  ? '24-page document including pillar-by-pillar coverage, gap-closure timeline, KPIs, and signature block for the Chief Compliance Officer.'
                  : 'Eureka drafts a pillar-by-pillar plan based on your live OpenIV configuration, with timelines for closing the 2 partial gaps before the deadline. Output is the exact format CBN expects.'}
              </Typography>
            </Box>
            <Stack direction="row" gap={1.25} sx={{ flexShrink: 0 }}>
              {planGenerated ? (
                <>
                  <Button
                    sx={{
                      bgcolor: '#ffffff',
                      color: '#475569',
                      border: '1px solid #e5e7eb',
                      px: 2.25,
                      py: 1.25,
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      fontFamily: 'Jost',
                      borderRadius: 0,
                      textTransform: 'none',
                      '&:hover': { bgcolor: '#f8fafc' },
                    }}
                  >
                    Edit Sections
                  </Button>
                  <Button
                    startIcon={<FileDownloadOutlinedIcon sx={{ fontSize: '1rem !important' }} />}
                    sx={{
                      bgcolor: colorPalette.primary,
                      color: '#ffffff',
                      px: 2.25,
                      py: 1.25,
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      fontFamily: 'Jost',
                      borderRadius: 0,
                      textTransform: 'none',
                      boxShadow: 'none',
                      '&:hover': { bgcolor: '#1a3896' },
                    }}
                  >
                    Download PDF
                  </Button>
                  <Button
                    onClick={() => setSubmitOpen(true)}
                    disabled={submitted}
                    sx={{
                      bgcolor: submitted ? '#94a3b8' : '#10b981',
                      color: '#ffffff',
                      px: 2.25,
                      py: 1.25,
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      fontFamily: 'Jost',
                      borderRadius: 0,
                      textTransform: 'none',
                      boxShadow: 'none',
                      '&:hover:not(:disabled)': { bgcolor: '#059669' },
                    }}
                  >
                    {submitted ? 'Submitted ✓' : 'Submit to CBN'}
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => setPlanGenerated(true)}
                  startIcon={<AutoAwesomeOutlinedIcon sx={{ fontSize: '1rem !important' }} />}
                  sx={{
                    bgcolor: '#ffffff',
                    color: colorPalette.primary,
                    px: 2.5,
                    py: 1.25,
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    fontFamily: 'Jost',
                    borderRadius: 0,
                    textTransform: 'none',
                    '&:hover': { bgcolor: '#f8fafc' },
                  }}
                >
                  Generate Plan with Eureka
                </Button>
              )}
            </Stack>
          </Box>

          {planGenerated && (
            <Box
              sx={{
                mt: 2.5,
                pt: 2.5,
                borderTop: '1px solid #eef0f4',
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 2,
              }}
            >
              {[
                { label: 'Drafted', value: 'Today, 14:32', icon: <ScheduleRoundedIcon /> },
                { label: 'Sections', value: '24 pages · 5 pillars' },
                { label: 'Timeline closure', value: '2 gaps by 1 June 2026' },
                { label: 'CCO sign-off', value: 'Pending — Adaeze C.' },
              ].map((s) => (
                <Box key={s.label}>
                  <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 0.5 }}>
                    {s.label}
                  </Typography>
                  <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
                    {s.value}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      </Box>

      <TOTPConfirmation
        open={submitOpen}
        onClose={() => setSubmitOpen(false)}
        onConfirm={() => {
          setSubmitOpen(false)
          setSubmitted(true)
        }}
        operation="create"
        title="Submit implementation plan to CBN"
        description="This action submits the 24-page implementation plan to the CBN Compliance Portal under your CCO sign-off. Once submitted, the plan cannot be retracted — only superseded by a new submission."
        resourceType="CBN Implementation Plan"
        resourceName="First City Monument Bank · Drafted 19 April 2026"
        itemsAffected={[
          'Plan submitted to CBN Compliance Portal',
          'CCO digital signature applied (Adaeze Chukwu)',
          'NFIU notified of plan submission',
          'Internal audit log entry created',
        ]}
      />
    </DashboardLayout>
  )
}
