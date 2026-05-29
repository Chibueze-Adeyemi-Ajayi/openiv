import {
  Box, Typography, Stack, InputBase, CircularProgress, Button,
  Tabs, Tab, Skeleton, Tooltip, Popover,
} from '@mui/material'
import { colorPalette } from '@/theme'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { kycApi, type KycCustomer } from '@/api/kyc'
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined'
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined'
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'
import PublicOutlinedIcon from '@mui/icons-material/PublicOutlined'
import FingerprintOutlinedIcon from '@mui/icons-material/FingerprintOutlined'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined'
import PortraitOutlinedIcon from '@mui/icons-material/PortraitOutlined'
import PolicyOutlinedIcon from '@mui/icons-material/PolicyOutlined'
import PhoneAndroidOutlinedIcon from '@mui/icons-material/PhoneAndroidOutlined'
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined'

// ── Shared helpers ─────────────────────────────────────────────────────────────

function kycScoreColor(score: number) {
  if (score < 35) return { bg: '#dcfce7', fg: '#15803d' }
  if (score < 75) return { bg: '#fef9c3', fg: '#854d0e' }
  return { bg: '#fee2e2', fg: '#b91c1c' }
}

const KL_INT: Record<string, number> = { t1: 1, t2: 2, t3: 3 }
const KL_SHORT: Record<string, string> = { t1: 'T1', t2: 'T2', t3: 'T3' }

function TierBars({ level }: { level: string | null | undefined }) {
  if (!level) return <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>—</Typography>
  const n = KL_INT[level] ?? 1
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.625 }}>
      {[1, 2, 3].map(t => (
        <Box key={t} sx={{ width: 8, height: 16, bgcolor: t <= n ? colorPalette.primary : '#e5e7eb' }} />
      ))}
      <Typography sx={{ fontSize: '0.75rem', color: '#64748b', ml: 0.5 }}>{KL_SHORT[level] ?? level}</Typography>
    </Box>
  )
}

// ── Verification pipeline step metadata ────────────────────────────────────────

const VERIFICATION_STEPS = [
  {
    label: 'Identity',
    fullName: 'BVN / NIN Identity Check',
    getStatus: (c: KycCustomer) => c.bvnNinStatus,
    getScore:  (c: KycCustomer) => c.bvnNinScore,
    context: {
      pass: { note: "The customer's Bank Verification Number (BVN) and National Identification Number (NIN) match records held by the national identity database. This customer's identity has been confirmed.", action: null },
      fail: { note: "Identity could not be confirmed. The BVN or NIN supplied does not match any record, or the details are inconsistent. This is a strong indicator of a synthetic identity, document forgery, or impersonation.", action: "Do not proceed. Request original government-issued documents, escalate to the compliance manager, and place the account on hold pending manual review." },
      warn: { note: "A partial match was found — some identity details are consistent but others could not be confirmed. This may indicate data-entry errors or mismatched records.", action: "Request supplementary identification (e.g. passport, driver's licence) and reconcile the discrepancy before approving the account." },
      none: { note: "The identity check has not been run for this customer — BVN/NIN data may be missing.", action: "Submit the customer's BVN and NIN to complete identity verification before onboarding." },
    },
  },
  {
    label: 'Phone Match',
    fullName: 'Phone Number Verification',
    getStatus: (c: KycCustomer) => c.phoneStatus,
    getScore:  (c: KycCustomer) => c.phoneScore,
    context: {
      pass: { note: "The phone number on record is confirmed as linked to this customer's verified identity. No anomalies detected.", action: null },
      fail: { note: "The phone number does not match the identity on record. This is a common indicator of a SIM-swap attack, where a fraudster transfers someone's phone number to a device they control.", action: "Contact the customer through an alternative channel to verify ownership. Check for recent SIM-swap activity with the telco and suspend account transfers until resolved." },
      warn: { note: "Phone ownership is unclear — the number could not be definitively linked to this identity.", action: "Request direct call-back verification from the customer to confirm phone ownership before high-value transactions are permitted." },
      none: { note: "No phone number was provided for this customer, so this check was skipped.", action: "Collect a phone number and re-run verification." },
    },
  },
  {
    label: 'Liveness',
    fullName: 'Biometric Liveness Check',
    getStatus: (c: KycCustomer) => c.livenessStatus,
    getScore:  (c: KycCustomer) => c.livenessScore,
    context: {
      pass: { note: "The biometric check confirmed that the submitted photo is of a real, live person — not a printed photo, deepfake, or screen replay. The face matches the identity documents.", action: null },
      fail: { note: "The liveness check failed. The submitted image did not pass anti-spoofing tests. This may indicate a photo attack, deepfake, or that someone is attempting to register using another person's photograph.", action: "Reject the biometric submission. Require the customer to attend an in-person verification or submit a live video call with a compliance officer before the account can be activated." },
      warn: { note: "Liveness confidence is low — the check is inconclusive. The image was not definitively flagged as spoofed, but it does not meet the confidence threshold for approval.", action: "Request a fresh selfie taken under good lighting, or escalate to a video call verification. Do not approve high-risk transactions until re-verification is complete." },
      none: { note: "No biometric photo was submitted, so liveness verification could not be performed.", action: "Request a selfie from the customer to enable biometric verification." },
    },
  },
  {
    label: 'PEP Screen',
    fullName: 'Politically Exposed Person (PEP) Screening',
    getStatus: (c: KycCustomer) => c.pepStatus,
    getScore:  (c: KycCustomer) => c.pepScore,
    context: {
      pass: { note: "No matches found in global Politically Exposed Person (PEP) or sanctions databases. The customer has no known political connections that require enhanced scrutiny.", action: null },
      fail: { note: "This customer has been flagged as a Politically Exposed Person (PEP) — they are, or are closely associated with, a current or former government official, senior executive of a state-owned enterprise, or a family member of one. PEPs carry elevated risk of corruption and money laundering under FATF guidelines and CBN regulations.", action: "Enhanced Due Diligence (EDD) is mandatory. Document the source of wealth and source of funds, obtain written approval from a senior compliance officer, and schedule periodic account reviews at least every 12 months. File a Suspicious Activity Report (SAR) if you cannot satisfy these requirements." },
      warn: { note: "A possible PEP match was found but could not be confirmed. The customer's name or profile is similar to a known PEP.", action: "Research the customer's background, political connections, and public records before proceeding. If there is reasonable doubt, apply the same enhanced due diligence required for a confirmed PEP." },
      none: { note: "PEP screening was not performed for this customer.", action: "Run PEP screening before completing onboarding. This is a regulatory requirement." },
    },
  },
] as const

type StepContextKey = 'pass' | 'fail' | 'warn' | 'none'

function resolveStatus(raw: string | null | undefined): StepContextKey {
  if (raw === 'pass') return 'pass'
  if (raw === 'fail') return 'fail'
  if (raw === 'warn') return 'warn'
  return 'none'
}

function VerificationPipeline({ customer }: { customer: KycCustomer }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      {VERIFICATION_STEPS.map(step => {
        const key = resolveStatus(step.getStatus(customer))
        const score = step.getScore(customer)
        const ctx = step.context[key]

        const isFail = key === 'fail'
        const isWarn = key === 'warn'
        const isPass = key === 'pass'

        const dotColor = isFail ? '#dc2626' : isWarn ? '#d97706' : isPass ? '#16a34a' : '#94a3b8'
        const dotBg    = isFail ? '#fee2e2' : isWarn ? '#fef9c3' : isPass ? '#dcfce7' : '#f1f5f9'
        const statusWord = isFail ? 'FAILED' : isWarn ? 'REVIEW' : isPass ? 'PASS' : '—'

        const tooltipContent = (
          <Box sx={{ p: 0.25, maxWidth: 300 }}>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: dotColor, mb: 0.75, lineHeight: 1.3 }}>
              {step.fullName}
              <Box component="span" sx={{ ml: 0.75, fontSize: '0.6rem', letterSpacing: '0.08em', opacity: 0.85 }}>
                — {statusWord}
              </Box>
            </Typography>
            <Typography sx={{ fontSize: '0.6875rem', lineHeight: 1.6, color: '#e2e8f0' }}>
              {ctx.note}
            </Typography>
            {ctx.action && (
              <>
                <Box sx={{ mt: 1.25, mb: 0.5, height: '1px', bgcolor: 'rgba(255,255,255,0.1)' }} />
                <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#fbbf24', mb: 0.5 }}>
                  Recommended action
                </Typography>
                <Typography sx={{ fontSize: '0.6875rem', lineHeight: 1.6, color: '#fde68a' }}>
                  {ctx.action}
                </Typography>
              </>
            )}
            {score != null && (
              <Box sx={{ mt: 1, pt: 0.75, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Typography sx={{ fontSize: '0.5625rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Risk score</Typography>
                <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: dotColor, fontFamily: 'SF Mono, Monaco, monospace' }}>{score}/100</Typography>
              </Box>
            )}
          </Box>
        )

        return (
          <Tooltip
            key={step.label}
            title={tooltipContent}
            placement="left"
            arrow
            componentsProps={{
              tooltip: { sx: { bgcolor: 'var(--on-surface)', borderRadius: 0, boxShadow: '0 12px 32px rgba(0,0,0,0.3)', maxWidth: 320, p: 1.5 } },
              arrow: { sx: { color: 'var(--on-surface)' } },
            }}
          >
            <Box
              onClick={e => e.stopPropagation()}
              sx={{ display: 'flex', alignItems: 'center', gap: 0.875, cursor: 'default' }}
            >
              <Box sx={{
                width: 18, height: 18, borderRadius: '50%', bgcolor: dotBg,
                flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Typography sx={{ fontSize: '0.5625rem', fontWeight: 900, color: dotColor, lineHeight: 1, userSelect: 'none' }}>
                  {isFail ? '✗' : isWarn ? '!' : isPass ? '✓' : '·'}
                </Typography>
              </Box>

              <Typography sx={{
                fontSize: '0.6875rem', flex: 1,
                fontWeight: isFail ? 700 : 500,
                color: isFail ? '#b91c1c' : isWarn ? '#92400e' : isPass ? '#334155' : '#94a3b8',
              }}>
                {step.label}
              </Typography>

              {(isFail || isWarn) && (
                <Box sx={{
                  px: 0.625, py: 0.125,
                  bgcolor: isFail ? '#fee2e2' : '#fef9c3',
                  flexShrink: 0,
                }}>
                  <Typography sx={{
                    fontSize: '0.4375rem', fontWeight: 800, letterSpacing: '0.08em',
                    color: isFail ? '#dc2626' : '#d97706', lineHeight: 1.4,
                  }}>
                    {statusWord}
                  </Typography>
                </Box>
              )}
            </Box>
          </Tooltip>
        )
      })}
    </Box>
  )
}

// ── Skeleton rows ──────────────────────────────────────────────────────────────

const KYC_GRID = '2fr 0.9fr 0.85fr 1.1fr'

function KycSkeletonRow() {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: KYC_GRID, gap: 2, px: 3, py: 2, alignItems: 'center', borderBottom: '1px solid var(--border-col)' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75 }}>
        <Skeleton variant="circular" width={48} height={48} />
        <Box>
          <Skeleton variant="text" width={140} height={18} />
          <Skeleton variant="text" width={90} height={14} sx={{ mt: 0.5 }} />
        </Box>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <Skeleton variant="circular" width={44} height={44} />
        <Skeleton variant="rectangular" width={48} height={24} />
      </Box>
      <Skeleton variant="rectangular" width={72} height={22} />
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {[0, 1, 2, 3].map(i => <Skeleton key={i} variant="rectangular" height={16} width={i % 2 === 0 ? '90%' : '70%'} />)}
      </Box>
    </Box>
  )
}

function StatCardSkeleton() {
  return (
    <Box sx={{ bgcolor: 'var(--card-bg)', border: '1px solid var(--border-col)', p: 2.25 }}>
      <Skeleton variant="text" width={110} height={14} sx={{ mb: 0.75 }} />
      <Skeleton variant="text" width={56} height={34} sx={{ mb: 0.5 }} />
      <Skeleton variant="text" width={80} height={14} />
    </Box>
  )
}

// ── KYC Customers tab ──────────────────────────────────────────────────────────

type RiskFilter = 'All' | 'High Risk' | 'Low Risk' | 'Verified'
const RISK_FILTERS: RiskFilter[] = ['All', 'High Risk', 'Low Risk', 'Verified']

const FILTER_TO_PARAM: Record<RiskFilter, string | undefined> = {
  'All':       undefined,
  'High Risk': 'high-risk',
  'Low Risk':  'low-risk',
  'Verified':  'verified',
}

function KycCustomerRow({ customer, onNavigate }: { customer: KycCustomer; onNavigate: (id: string) => void }) {
  const displayScore = customer.totalRiskScore ?? customer.overallRiskScore
  const sc = kycScoreColor(displayScore)
  const photo = customer.identityPhoto
  const photoSrc = photo ? (photo.startsWith('data:') ? photo : `data:image/jpeg;base64,${photo}`) : null
  const fullName = [customer.firstName, customer.lastName].filter(Boolean).join(' ')
  const actionMap: Record<string, { label: string; bg: string; fg: string }> = {
    clear:       { label: 'Clear',       bg: '#dcfce7', fg: '#15803d' },
    flagged:     { label: 'Flagged',     bg: '#fef9c3', fg: '#854d0e' },
    case_opened: { label: 'Case Opened', bg: '#fee2e2', fg: '#b91c1c' },
  }
  const action = actionMap[customer.actionTaken] ?? { label: customer.actionTaken, bg: '#f1f5f9', fg: '#475569' }

  return (
    <Box
      onClick={() => onNavigate(customer.customerId)}
      sx={{
        display: 'grid', gridTemplateColumns: KYC_GRID, gap: 2, px: 3, py: 2, alignItems: 'center',
        borderBottom: '1px solid var(--border-col)', cursor: 'pointer', transition: 'background 0.12s',
        '&:hover': { bgcolor: 'var(--section-bg)' }, '&:last-child': { borderBottom: 'none' },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75, minWidth: 0 }}>
        <Box sx={{
          width: 48, height: 48, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
          bgcolor: sc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {photoSrc
            ? <Box component="img" src={photoSrc} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <Typography sx={{ fontSize: '1.125rem', fontWeight: 700, color: sc.fg }}>{(fullName || customer.customerId)[0]?.toUpperCase()}</Typography>
          }
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: fullName ? '#0f172a' : '#94a3b8', fontFamily: 'Jost', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {fullName || '—'}
          </Typography>
          <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600, color: colorPalette.primary, fontFamily: 'SF Mono, Monaco, monospace', mt: 0.25 }}>
            {customer.customerId}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <Box sx={{ width: 44, height: 44, borderRadius: '50%', bgcolor: sc.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <Typography sx={{ fontSize: '0.875rem', fontWeight: 800, color: sc.fg, lineHeight: 1 }}>{displayScore}</Typography>
          <Typography sx={{ fontSize: '0.4375rem', fontWeight: 700, color: sc.fg, textTransform: 'uppercase', letterSpacing: '0.06em' }}>risk</Typography>
        </Box>
        <TierBars level={customer.knowledgeLevel} />
      </Box>

      <Box>
        <Box sx={{ display: 'inline-flex', px: 1.25, py: 0.375, bgcolor: action.bg, fontSize: '0.6875rem', fontWeight: 700, color: action.fg }}>
          {action.label}
        </Box>
      </Box>

      <VerificationPipeline customer={customer} />
    </Box>
  )
}

interface KycStats {
  total: number; highRisk: number; lowRisk: number; verified: number; flagged: number
}

function KycCustomersView({ initialFilter }: { initialFilter?: string }) {
  const navigate = useNavigate()
  const [customers, setCustomers]     = useState<KycCustomer[]>([])
  const [stats, setStats]             = useState<KycStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [listLoading, setListLoading] = useState(true)
  const [search, setSearch]           = useState('')
  const [riskFilter, setRiskFilter]   = useState<RiskFilter>(
    initialFilter === 'high-risk' ? 'High Risk' : initialFilter === 'low-risk' ? 'Low Risk' : initialFilter === 'verified' ? 'Verified' : 'All'
  )
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fetch stats once (for cards + tab badges)
  useEffect(() => {
    kycApi.getStats()
      .then(s => setStats(s))
      .catch(() => {})
      .finally(() => setStatsLoading(false))
  }, [])

  // Fetch list whenever filter changes
  const fetchList = useCallback((filter: RiskFilter, q: string) => {
    setListLoading(true)
    kycApi.listCustomers(FILTER_TO_PARAM[filter], q.trim() || undefined)
      .then(r => setCustomers(r.customers))
      .catch(() => {})
      .finally(() => setListLoading(false))
  }, [])

  useEffect(() => {
    fetchList(riskFilter, search)
  }, [riskFilter, fetchList]) // search handled by debounce below

  // Debounce search → backend
  const handleSearchChange = (value: string) => {
    setSearch(value)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => fetchList(riskFilter, value), 350)
  }

  const filterCounts: Record<RiskFilter, number> = {
    'All':       stats?.total    ?? 0,
    'High Risk': stats?.highRisk ?? 0,
    'Low Risk':  stats?.lowRisk  ?? 0,
    'Verified':  stats?.verified ?? 0,
  }

  return (
    <>
      {/* ── Stat cards ── */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, mb: 3 }}>
        {statsLoading
          ? [0, 1, 2, 3].map(i => <StatCardSkeleton key={i} />)
          : ([
              { label: 'Total Customers', value: stats?.total    ?? 0, sub: 'KYC verified',   color: colorPalette.primary },
              { label: 'High Risk',       value: stats?.highRisk ?? 0, sub: 'score ≥ 75',     color: '#dc2626' },
              { label: 'Low Risk',        value: stats?.lowRisk  ?? 0, sub: 'score < 35',     color: '#10b981' },
              { label: 'Verified',        value: stats?.verified ?? 0, sub: 'full clearance', color: '#0891b2' },
            ] as const).map(s => (
              <Box key={s.label} sx={{ bgcolor: 'var(--card-bg)', border: '1px solid var(--border-col)', p: 2.25 }}>
                <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 0.75 }}>{s.label}</Typography>
                <Typography sx={{ fontSize: '1.625rem', fontWeight: 700, color: s.color, fontFamily: 'Jost', lineHeight: 1.1, mb: 0.5 }}>
                  {s.value.toLocaleString()}
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>{s.sub}</Typography>
              </Box>
            ))
        }
      </Box>

      {/* ── Customer records table ── */}
      <Box sx={{ bgcolor: 'var(--card-bg)', border: '1px solid var(--border-col)' }}>
        <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid var(--border-col)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost' }}>Customer Records</Typography>
          <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>One record per customer — click a row to open the full profile.</Typography>
        </Box>

        <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid var(--border-col)', display: 'flex', alignItems: 'center', gap: 2 }}>
          <Stack direction="row" gap={0.5}>
            {RISK_FILTERS.map(f => {
              const count   = filterCounts[f]
              const isThreat = f === 'High Risk' && count > 0
              const isActive = riskFilter === f
              return (
                <Box
                  key={f}
                  onClick={() => { setRiskFilter(f); setSearch('') }}
                  sx={{
                    px: 1.375, py: 0.625, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                    fontFamily: 'Jost', display: 'flex', alignItems: 'center', gap: 0.5,
                    color: isActive
                      ? (isThreat ? '#b91c1c' : colorPalette.primary)
                      : (isThreat ? '#dc2626' : '#64748b'),
                    bgcolor: isActive
                      ? (isThreat ? '#fee2e2' : `${colorPalette.primary}0a`)
                      : (isThreat ? '#fef2f2' : 'transparent'),
                    border: isThreat ? '1px solid #fecaca' : '1px solid transparent',
                    transition: 'all 0.15s',
                    '&:hover': {
                      bgcolor: isThreat ? '#fee2e2' : (isActive ? `${colorPalette.primary}0f` : '#f8fafc'),
                    },
                  }}
                >
                  {isThreat && <ErrorOutlineIcon sx={{ fontSize: '0.875rem' }} />}
                  {f}
                  {!statsLoading && (
                    <Box sx={{
                      ml: 0.25, px: 0.625, py: 0.125, minWidth: 18, textAlign: 'center',
                      bgcolor: isThreat
                        ? (isActive ? '#dc2626' : '#fecaca')
                        : (isActive ? colorPalette.primary : '#e5e7eb'),
                      color: isThreat
                        ? (isActive ? '#ffffff' : '#991b1b')
                        : (isActive ? '#ffffff' : '#64748b'),
                      fontSize: '0.6rem', fontWeight: 800, borderRadius: '2px',
                    }}>
                      {count}
                    </Box>
                  )}
                </Box>
              )
            })}
          </Stack>
          <Box sx={{ flex: 1 }} />
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 1, bgcolor: 'var(--card-bg)',
            px: 1.5, height: 32, minWidth: 260, border: '1px solid transparent',
            transition: 'all 0.18s', '&:focus-within': { bgcolor: 'var(--card-bg)', borderColor: colorPalette.primary },
          }}>
            <SearchOutlinedIcon sx={{ fontSize: '1rem', color: '#94a3b8' }} />
            <InputBase
              value={search}
              onChange={e => handleSearchChange(e.target.value)}
              placeholder="Search by name or customer ID…"
              sx={{ flex: 1, fontSize: '0.8125rem', fontFamily: 'Jost', color: 'var(--heading-color)' }}
            />
            {listLoading && search && (
              <CircularProgress size={12} sx={{ color: colorPalette.primary, flexShrink: 0 }} />
            )}
          </Box>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: KYC_GRID, gap: 2, px: 3, py: 1.375, bgcolor: 'var(--card-bg)', borderBottom: '1px solid var(--border-col)' }}>
          {['Customer · Account', 'Risk Score', 'Action', 'Verification Checks'].map(h => (
            <Typography key={h} sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{h}</Typography>
          ))}
        </Box>

        {listLoading ? (
          [0, 1, 2, 3, 4].map(i => <KycSkeletonRow key={i} />)
        ) : customers.length === 0 ? (
          <Box sx={{ py: 8, textAlign: 'center' }}>
            {riskFilter === 'All' && !search
              ? <>
                  <FingerprintOutlinedIcon sx={{ fontSize: 36, color: '#cbd5e1', mb: 1.5 }} />
                  <Typography sx={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--heading-color)', mb: 0.75 }}>No KYC records yet</Typography>
                  <Typography sx={{ fontSize: '0.8125rem', color: '#64748b' }}>Beam customer data (BVN, NIN, photo) via the <strong>kyc</strong> stream to get started.</Typography>
                </>
              : <Typography sx={{ fontSize: '0.875rem', color: '#94a3b8' }}>No customers match the current filter.</Typography>
            }
          </Box>
        ) : (
          customers.map(c => (
            <KycCustomerRow key={c.customerId} customer={c} onNavigate={id => navigate(`/dashboard/users/${id}`)} />
          ))
        )}
      </Box>
    </>
  )
}

// ── PEP Screening tab ──────────────────────────────────────────────────────────

interface PEPPerson {
  id: string; name: string; position: string; organization: string
  country: string; riskLevel: 'Low' | 'Medium' | 'High'; lastUpdated: string
}

function PEPScreeningView() {
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState<PEPPerson[]>([])
  const [searched, setSearched] = useState(false)
  const [loading, setLoading]   = useState(false)

  const handleSearch = async () => {
    if (!query) return
    setLoading(true)
    setSearched(true)
    try {
      const res = await kycApi.searchPEP(query)
      setResults(res.results)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box>
      <Box sx={{ bgcolor: 'var(--card-bg)', border: '1px solid var(--border-col)', mb: 3 }}>
        <Box sx={{ p: 3, borderBottom: '1px solid var(--border-col)' }}>
          <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost', mb: 0.5 }}>PEP & Sanctions Screening</Typography>
          <Typography sx={{ fontSize: '0.8125rem', color: '#64748b' }}>Search the global Politically Exposed Persons database to identify high-risk individuals.</Typography>
        </Box>
        <Box sx={{ p: 3, display: 'flex', gap: 2 }}>
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1.5, bgcolor: 'var(--card-bg)', px: 2, height: 44, border: '1px solid var(--border-col)', transition: 'all 0.18s', '&:focus-within': { bgcolor: 'var(--card-bg)', borderColor: colorPalette.primary } }}>
            <SearchOutlinedIcon sx={{ fontSize: '1.25rem', color: '#94a3b8' }} />
            <InputBase value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Enter full name (e.g. Bola Tinubu)..."
              sx={{ flex: 1, fontSize: '0.9375rem', fontFamily: 'Jost', color: 'var(--heading-color)' }} />
          </Box>
          <Button variant="contained" disableElevation onClick={handleSearch} disabled={loading}
            sx={{ borderRadius: 0, px: 4, textTransform: 'none', fontFamily: 'Jost', fontWeight: 600, bgcolor: colorPalette.primary, '&:hover': { bgcolor: 'var(--on-surface)' }, '&.Mui-disabled': { bgcolor: '#94a3b8', color: '#ffffff' } }}>
            {loading ? 'Searching...' : 'Run Screening'}
          </Button>
        </Box>
      </Box>

      {searched && (
        <Box sx={{ bgcolor: 'var(--card-bg)', border: '1px solid var(--border-col)' }}>
          <Box sx={{ px: 3, py: 2, bgcolor: 'var(--card-bg)', borderBottom: '1px solid var(--border-col)' }}>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {loading ? 'Screening AML database...' : `Search Results (${results.length})`}
            </Typography>
          </Box>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress size={26} sx={{ color: colorPalette.primary }} /></Box>
          ) : results.length === 0 ? (
            <Box sx={{ py: 8, textAlign: 'center' }}>
              <CheckCircleOutlineRoundedIcon sx={{ fontSize: '3rem', color: '#10b981', mb: 2, opacity: 0.5 }} />
              <Typography sx={{ fontSize: '1rem', fontWeight: 600, color: 'var(--heading-color)', mb: 0.5 }}>No Direct PEP Matches Found</Typography>
              <Typography sx={{ fontSize: '0.8125rem', color: '#64748b' }}>No PEP or sanctions matches found for "{query}".</Typography>
            </Box>
          ) : (
            results.map((person, i) => (
              <Box key={person.id} sx={{ p: 3, display: 'flex', alignItems: 'flex-start', gap: 3, borderBottom: i === results.length - 1 ? 'none' : '1px solid var(--border-col)' }}>
                <Box sx={{ width: 48, height: 48, bgcolor: person.riskLevel === 'High' ? '#fef2f2' : '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <PublicOutlinedIcon sx={{ color: person.riskLevel === 'High' ? '#dc2626' : '#f59e0b' }} />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 0.5 }}>
                    <Typography sx={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost' }}>{person.name}</Typography>
                    <Box sx={{ px: 1, py: 0.25, bgcolor: person.riskLevel === 'High' ? '#dc2626' : '#f59e0b', color: '#ffffff', fontSize: '0.625rem', fontWeight: 800, letterSpacing: '0.05em' }}>
                      {person.riskLevel.toUpperCase()} RISK
                    </Box>
                  </Box>
                  <Typography sx={{ fontSize: '0.875rem', color: 'var(--on-surface-variant)', fontWeight: 500 }}>{person.position} at {person.organization}</Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8', mt: 1 }}>Location: {person.country} • ID: {person.id} • Verified: {person.lastUpdated}</Typography>
                </Box>
                <Button variant="outlined" size="small"
                  sx={{ borderRadius: 0, textTransform: 'none', fontFamily: 'Jost', color: '#dc2626', borderColor: '#dc2626', '&:hover': { bgcolor: '#fef2f2', borderColor: '#dc2626' } }}>
                  Escalate to Case
                </Button>
              </Box>
            ))
          )}
        </Box>
      )}

      {!searched && (
        <Box sx={{ bgcolor: 'var(--section-bg)', border: '1px dashed #cbd5e1', p: 8, textAlign: 'center' }}>
          <WarningAmberRoundedIcon sx={{ fontSize: '2.5rem', color: '#94a3b8', mb: 2 }} />
          <Typography sx={{ fontSize: '0.9375rem', color: '#64748b' }}>Enter a customer's name above to cross-reference against the PEP database.</Typography>
        </Box>
      )}
    </Box>
  )
}

// ── KYC Workflow tab ───────────────────────────────────────────────────────────

interface FlowBlockDef {
  id: string
  label: string
  description: string
  tag: string
  icon: React.ReactNode
  color: string
  bg: string
  required?: boolean
}

const BLOCK_DEFS: Record<string, FlowBlockDef> = {
  bvn_nin: {
    id: 'bvn_nin',
    label: 'BVN / NIN Lookup',
    description: 'Verify customer identity against the CBN BVN registry and NIMC NIN database',
    tag: 'doja.io',
    icon: <FingerprintOutlinedIcon sx={{ fontSize: '1.25rem' }} />,
    color: 'var(--heading-color)',
    bg: '#eff6ff',
    required: true,
  },
  phone_match: {
    id: 'phone_match',
    label: 'Phone Number Match',
    description: 'Cross-reference the submitted phone number against the number on the BVN/NIN record',
    tag: 'doja.io',
    icon: <PhoneOutlinedIcon sx={{ fontSize: '1.25rem' }} />,
    color: '#7c3aed',
    bg: '#f5f3ff',
  },
  liveness: {
    id: 'liveness',
    label: 'Liveness + Face Match',
    description: 'Compare a live selfie against the biometric photo stored on the identity record',
    tag: 'doja.io',
    icon: <PortraitOutlinedIcon sx={{ fontSize: '1.25rem' }} />,
    color: '#0891b2',
    bg: '#ecfeff',
  },
  pep_check: {
    id: 'pep_check',
    label: 'PEP & Sanctions Check',
    description: 'Screen customer against global politically exposed persons and sanctions lists',
    tag: 'OpenSanctions',
    icon: <PolicyOutlinedIcon sx={{ fontSize: '1.25rem' }} />,
    color: '#dc2626',
    bg: '#fef2f2',
  },
  phone_screening: {
    id: 'phone_screening',
    label: 'Phone Number Screening',
    description: 'Carrier validation, SIM swap detection, line age, and porting status verification',
    tag: 'doja.io',
    icon: <PhoneAndroidOutlinedIcon sx={{ fontSize: '1.25rem' }} />,
    color: '#d97706',
    bg: '#fffbeb',
  },
  email_verify: {
    id: 'email_verify',
    label: 'Email Verification',
    description: 'Check email deliverability, domain reputation, and detect disposable addresses',
    tag: 'doja.io',
    icon: <EmailOutlinedIcon sx={{ fontSize: '1.25rem' }} />,
    color: '#059669',
    bg: '#f0fdf4',
  },
}

const DEFAULT_PIPELINE = ['bvn_nin', 'phone_match', 'liveness', 'pep_check']

function ConnectorArrow() {
  return (
    <Box sx={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', height: 28,
      pointerEvents: 'none', flexShrink: 0,
    }}>
      <Box sx={{ width: '1.5px', flex: 1, bgcolor: '#b0bbd4' }} />
      <Box sx={{
        width: 0, height: 0,
        borderLeft: '4px solid transparent',
        borderRight: '4px solid transparent',
        borderTop: '6px solid #b0bbd4',
      }} />
    </Box>
  )
}

function KycWorkflowView() {
  const pipeline = DEFAULT_PIPELINE
  const [learnMore, setLearnMore] = useState<{ el: HTMLElement; id: string } | null>(null)

  return (
    <Box>
      {/* Header */}
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        bgcolor: 'var(--card-bg)', border: '1px solid #dde3ee', borderBottom: 'none',
        px: 3, py: 1.75,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box>
            <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost' }}>
              Verification Pipeline
            </Typography>
            <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', mt: 0.125 }}>
              Default workflow · {pipeline.length} steps
            </Typography>
          </Box>
          <Box sx={{ width: '1px', height: 28, bgcolor: '#eef0f4' }} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.25, py: 0.5, bgcolor: `${colorPalette.primary}08`, border: `1px solid ${colorPalette.primary}18` }}>
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#10b981', boxShadow: '0 0 0 2px #d1fae5' }} />
            <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: colorPalette.primary, letterSpacing: '0.1em' }}>
              {pipeline.length} ACTIVE STEPS
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Canvas + Process Library */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 240px', border: '1px solid #dde3ee', overflow: 'hidden' }}>

        {/* Diagram canvas */}
        <Box sx={{
          position: 'relative',
          bgcolor: '#f3f5fb',
          backgroundImage: 'radial-gradient(circle, #c0cadd 1px, transparent 1px)',
          backgroundSize: '22px 22px',
          py: 5, px: 4,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}>
          <Box sx={{ position: 'absolute', top: 10, left: 14, display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Box sx={{ width: 5, height: 5, bgcolor: '#10b981', borderRadius: '50%' }} />
            <Typography sx={{ fontSize: '0.5rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.14em', fontFamily: 'monospace' }}>
              PIPELINE CANVAS
            </Typography>
          </Box>

          {/* START terminal */}
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 1.25, px: 3, py: 1,
            bgcolor: 'var(--card-bg)', border: '1.5px solid #c8d0df', borderRadius: '100px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          }}>
            <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#10b981', boxShadow: '0 0 0 2px #d1fae580' }} />
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--on-surface-variant)', fontFamily: 'Jost' }}>
              Customer Beam
            </Typography>
            <Box sx={{ px: 0.75, py: 0.2, bgcolor: 'var(--section-bg)', border: '1px solid var(--border-col)', fontSize: '0.4375rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.12em', fontFamily: 'monospace' }}>
              INPUT
            </Box>
          </Box>

          <ConnectorArrow />

          {pipeline.map((id, i) => {
            const def = BLOCK_DEFS[id]
            const isRequired = !!def.required
            return (
              <Box key={id} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                <Box
                  sx={{
                    width: 340,
                    bgcolor: 'var(--card-bg)',
                    border: '1px solid #dde3ee',
                    borderTop: `2.5px solid ${def.color}`,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 3px 10px rgba(0,0,0,0.04)',
                    display: 'flex', alignItems: 'center', gap: 1.25,
                    px: 2, py: 1.125,
                    transition: 'box-shadow 0.18s',
                    '&:hover': { boxShadow: '0 2px 10px rgba(0,0,0,0.08), 0 6px 20px rgba(0,40,142,0.07)' },
                  }}
                >
                  <Box sx={{ p: 0.75, bgcolor: def.bg, color: def.color, display: 'flex', flexShrink: 0 }}>
                    {def.icon}
                  </Box>
                  <Typography sx={{ fontWeight: 700, color: 'var(--on-surface)', fontFamily: 'Jost', fontSize: '0.875rem', flex: 1, lineHeight: 1.2 }}>
                    {def.label}
                  </Typography>
                  {isRequired && (
                    <Box sx={{ px: 0.75, py: 0.2, bgcolor: `${colorPalette.primary}0e`, border: `1px solid ${colorPalette.primary}22`, fontSize: '0.4375rem', fontWeight: 700, color: colorPalette.primary, letterSpacing: '0.1em', flexShrink: 0 }}>
                      REQUIRED
                    </Box>
                  )}
                  <Typography
                    onClick={(e) => setLearnMore({ el: e.currentTarget as HTMLElement, id })}
                    sx={{ fontSize: '0.6875rem', fontWeight: 600, color: colorPalette.primary, cursor: 'pointer', flexShrink: 0, '&:hover': { textDecoration: 'underline' } }}
                  >
                    Learn more
                  </Typography>
                </Box>
                {i < pipeline.length - 1 && <ConnectorArrow />}
              </Box>
            )
          })}

          <ConnectorArrow />

          {/* END terminal — Risk Scoring */}
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 1.25, px: 3, py: 1,
            bgcolor: `${colorPalette.primary}0a`, border: `1.5px solid ${colorPalette.primary}30`,
            borderRadius: '100px', boxShadow: '0 1px 4px rgba(0,40,142,0.1)',
          }}>
            <Box sx={{ width: 7, height: 7, borderRadius: '1px', bgcolor: colorPalette.primary, transform: 'rotate(45deg)', flexShrink: 0 }} />
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: colorPalette.primary, fontFamily: 'Jost' }}>
              Risk Scoring
            </Typography>
            <Box sx={{ px: 0.75, py: 0.2, bgcolor: `${colorPalette.primary}12`, border: `1px solid ${colorPalette.primary}25`, fontSize: '0.4375rem', fontWeight: 700, color: colorPalette.primary, letterSpacing: '0.12em', fontFamily: 'monospace' }}>
              NEXT
            </Box>
          </Box>
          <Typography sx={{ mt: 1, fontSize: '0.5rem', color: '#b0bbc8', fontFamily: 'monospace', letterSpacing: '0.06em' }}>
            emits kyc.verified · kyc.partial · kyc.flagged
          </Typography>
        </Box>

        {/* Process Library sidebar */}
        <Box sx={{ borderLeft: '1px solid #dde3ee', bgcolor: 'var(--card-bg)', display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid var(--border-col)' }}>
            <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--on-surface-variant)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Process Library
            </Typography>
            <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', mt: 0.25 }}>
              Additional checks
            </Typography>
          </Box>
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 3, textAlign: 'center' }}>
            <Box sx={{ width: 32, height: 32, borderRadius: '50%', bgcolor: 'var(--section-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1.5 }}>
              <Box sx={{ width: 10, height: 2, bgcolor: '#cbd5e1', borderRadius: '1px' }} />
            </Box>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', fontFamily: 'Jost' }}>
              Coming soon
            </Typography>
            <Typography sx={{ fontSize: '0.6875rem', color: '#cbd5e1', mt: 0.5, lineHeight: 1.5 }}>
              Custom process blocks will appear here
            </Typography>
          </Box>
          <Box sx={{ p: 2, borderTop: '1px solid var(--border-col)', bgcolor: `${colorPalette.primary}04` }}>
            <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: colorPalette.primary, letterSpacing: '0.12em', mb: 0.75 }}>
              HOW IT WORKS
            </Typography>
            <Typography sx={{ fontSize: '0.6875rem', color: '#64748b', lineHeight: 1.6 }}>
              Customer data flows through each check in order. Results feed into the Risk Scoring engine.
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Learn more popover */}
      <Popover
        open={Boolean(learnMore)}
        anchorEl={learnMore?.el}
        onClose={() => setLearnMore(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{ paper: { sx: { mt: 0.75, p: 2.5, maxWidth: 300, boxShadow: '0 8px 32px rgba(0,0,0,0.12)', borderRadius: 0, border: '1px solid var(--border-col)' } } }}
      >
        {learnMore && (() => {
          const def = BLOCK_DEFS[learnMore.id]
          return (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1.25 }}>
                <Box sx={{ p: 0.75, bgcolor: def.bg, color: def.color, display: 'flex' }}>
                  {def.icon}
                </Box>
                <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--on-surface)', fontFamily: 'Jost' }}>
                  {def.label}
                </Typography>
              </Box>
              <Typography sx={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)', lineHeight: 1.65 }}>
                {def.description}
              </Typography>
            </Box>
          )
        })()}
      </Popover>
    </Box>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

const TAB_LABELS = ['All Customers', 'KYC Workflow', 'PEP Screening']

export default function CustomersPage() {
  const [searchParams] = useSearchParams()
  const filterParam = searchParams.get('filter') ?? ''

  const initialTab = filterParam === 'pep' ? 2 : filterParam === 'kyc-workflow' ? 1 : 0
  const [tab, setTab] = useState(initialTab)

  return (
    <Box sx={{ p: 4 }}>
      <Box sx={{ mb: 3 }}>
        <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: colorPalette.primary, letterSpacing: '0.14em', textTransform: 'uppercase', mb: 0.75 }}>
          Investigate
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
          <BadgeOutlinedIcon sx={{ color: colorPalette.primary, fontSize: '1.625rem' }} />
          <Typography sx={{ fontSize: '1.625rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost', letterSpacing: '-0.015em' }}>
            Customers
          </Typography>
        </Box>
        <Typography sx={{ fontSize: '0.9375rem', color: '#64748b' }}>
          Browse all KYC-verified customers, flag high-risk accounts, and screen against the global PEP database.
        </Typography>
      </Box>

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{
          borderBottom: '1px solid var(--border-col)', mb: 3, minHeight: 36,
          '& .MuiTabs-indicator': { bgcolor: colorPalette.primary, height: 2 },
          '& .MuiTab-root': {
            fontFamily: 'Jost', fontSize: '0.75rem', fontWeight: 600,
            textTransform: 'none', minHeight: 36, py: 0, px: 2.5,
            color: '#94a3b8', '&.Mui-selected': { color: colorPalette.primary },
          },
        }}
      >
        {TAB_LABELS.map(l => <Tab key={l} label={l} />)}
      </Tabs>

      {tab === 0 && <KycCustomersView initialFilter={filterParam} />}
      {tab === 1 && <KycWorkflowView />}
      {tab === 2 && <PEPScreeningView />}
    </Box>
  )
}
