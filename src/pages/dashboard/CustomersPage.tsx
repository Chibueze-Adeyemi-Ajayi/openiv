import {
  Box, Typography, Stack, InputBase, CircularProgress, Button,
  Tabs, Tab, Skeleton,
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

// ── Shared helpers ─────────────────────────────────────────────────────────────

function kycScoreColor(score: number) {
  if (score < 35) return { bg: '#dcfce7', fg: '#15803d' }
  if (score < 75) return { bg: '#fef9c3', fg: '#854d0e' }
  return { bg: '#fee2e2', fg: '#b91c1c' }
}

function TierBars({ tier }: { tier: number | null }) {
  if (tier == null) return <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>—</Typography>
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.625 }}>
      {[1, 2, 3].map(t => (
        <Box key={t} sx={{ width: 8, height: 16, bgcolor: t <= tier ? colorPalette.primary : '#e5e7eb' }} />
      ))}
      <Typography sx={{ fontSize: '0.75rem', color: '#64748b', ml: 0.5 }}>T{tier}</Typography>
    </Box>
  )
}

// ── Skeleton rows ──────────────────────────────────────────────────────────────

const KYC_GRID = '2.5fr 1fr 1fr 200px'

function KycSkeletonRow() {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: KYC_GRID, gap: 2, px: 3, py: 2, alignItems: 'center', borderBottom: '1px solid #f4f5f7' }}>
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
      <Box sx={{ display: 'flex', gap: 0.625 }}>
        {[0, 1, 2, 3].map(i => <Skeleton key={i} variant="rectangular" width={40} height={36} />)}
      </Box>
    </Box>
  )
}

function StatCardSkeleton() {
  return (
    <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', p: 2.25 }}>
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
        borderBottom: '1px solid #f4f5f7', cursor: 'pointer', transition: 'background 0.12s',
        '&:hover': { bgcolor: '#f8fafc' }, '&:last-child': { borderBottom: 'none' },
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
        <TierBars tier={customer.kycTier} />
      </Box>

      <Box>
        <Box sx={{ display: 'inline-flex', px: 1.25, py: 0.375, bgcolor: action.bg, fontSize: '0.6875rem', fontWeight: 700, color: action.fg }}>
          {action.label}
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 0.625 }}>
        {[
          { label: 'BVN', score: customer.bvnNinScore },
          { label: 'Phone', score: customer.phoneScore },
          { label: 'Face', score: customer.livenessScore },
          { label: 'PEP', score: customer.pepScore },
        ].map(({ label, score }) => {
          const c = score == null ? { bg: '#f1f5f9', fg: '#94a3b8' } : kycScoreColor(score)
          return (
            <Box key={label} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', px: 0.875, py: 0.5, bgcolor: c.bg, minWidth: 40 }}>
              <Typography sx={{ fontSize: '0.5rem', fontWeight: 700, color: c.fg, textTransform: 'uppercase', letterSpacing: '0.06em', lineHeight: 1.2 }}>{label}</Typography>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 800, color: c.fg, lineHeight: 1.2 }}>{score ?? '—'}</Typography>
            </Box>
          )
        })}
      </Box>
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
              <Box key={s.label} sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', p: 2.25 }}>
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
      <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4' }}>
        <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid #eef0f4', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost' }}>Customer Records</Typography>
          <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>One record per customer — click a row to open the full profile.</Typography>
        </Box>

        <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid #eef0f4', display: 'flex', alignItems: 'center', gap: 2 }}>
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
            display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#f8fafc',
            px: 1.5, height: 32, minWidth: 260, border: '1px solid transparent',
            transition: 'all 0.18s', '&:focus-within': { bgcolor: '#ffffff', borderColor: colorPalette.primary },
          }}>
            <SearchOutlinedIcon sx={{ fontSize: '1rem', color: '#94a3b8' }} />
            <InputBase
              value={search}
              onChange={e => handleSearchChange(e.target.value)}
              placeholder="Search by name or customer ID…"
              sx={{ flex: 1, fontSize: '0.8125rem', fontFamily: 'Jost', color: '#00288e' }}
            />
            {listLoading && search && (
              <CircularProgress size={12} sx={{ color: colorPalette.primary, flexShrink: 0 }} />
            )}
          </Box>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: KYC_GRID, gap: 2, px: 3, py: 1.375, bgcolor: '#fafbfc', borderBottom: '1px solid #eef0f4' }}>
          {['Customer · Account', 'Risk Score', 'Action', 'Step Scores'].map(h => (
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
                  <Typography sx={{ fontSize: '0.9375rem', fontWeight: 600, color: '#00288e', mb: 0.75 }}>No KYC records yet</Typography>
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
      <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', mb: 3 }}>
        <Box sx={{ p: 3, borderBottom: '1px solid #eef0f4' }}>
          <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost', mb: 0.5 }}>PEP & Sanctions Screening</Typography>
          <Typography sx={{ fontSize: '0.8125rem', color: '#64748b' }}>Search the global Politically Exposed Persons database to identify high-risk individuals.</Typography>
        </Box>
        <Box sx={{ p: 3, display: 'flex', gap: 2 }}>
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1.5, bgcolor: '#f8fafc', px: 2, height: 44, border: '1px solid #eef0f4', transition: 'all 0.18s', '&:focus-within': { bgcolor: '#ffffff', borderColor: colorPalette.primary } }}>
            <SearchOutlinedIcon sx={{ fontSize: '1.25rem', color: '#94a3b8' }} />
            <InputBase value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Enter full name (e.g. Bola Tinubu)..."
              sx={{ flex: 1, fontSize: '0.9375rem', fontFamily: 'Jost', color: '#00288e' }} />
          </Box>
          <Button variant="contained" disableElevation onClick={handleSearch} disabled={loading}
            sx={{ borderRadius: 0, px: 4, textTransform: 'none', fontFamily: 'Jost', fontWeight: 600, bgcolor: colorPalette.primary, '&:hover': { bgcolor: '#1e293b' }, '&.Mui-disabled': { bgcolor: '#94a3b8', color: '#ffffff' } }}>
            {loading ? 'Searching...' : 'Run Screening'}
          </Button>
        </Box>
      </Box>

      {searched && (
        <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4' }}>
          <Box sx={{ px: 3, py: 2, bgcolor: '#fafbfc', borderBottom: '1px solid #eef0f4' }}>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {loading ? 'Screening AML database...' : `Search Results (${results.length})`}
            </Typography>
          </Box>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress size={26} sx={{ color: colorPalette.primary }} /></Box>
          ) : results.length === 0 ? (
            <Box sx={{ py: 8, textAlign: 'center' }}>
              <CheckCircleOutlineRoundedIcon sx={{ fontSize: '3rem', color: '#10b981', mb: 2, opacity: 0.5 }} />
              <Typography sx={{ fontSize: '1rem', fontWeight: 600, color: '#00288e', mb: 0.5 }}>No Direct PEP Matches Found</Typography>
              <Typography sx={{ fontSize: '0.8125rem', color: '#64748b' }}>No PEP or sanctions matches found for "{query}".</Typography>
            </Box>
          ) : (
            results.map((person, i) => (
              <Box key={person.id} sx={{ p: 3, display: 'flex', alignItems: 'flex-start', gap: 3, borderBottom: i === results.length - 1 ? 'none' : '1px solid #f4f5f7' }}>
                <Box sx={{ width: 48, height: 48, bgcolor: person.riskLevel === 'High' ? '#fef2f2' : '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <PublicOutlinedIcon sx={{ color: person.riskLevel === 'High' ? '#dc2626' : '#f59e0b' }} />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 0.5 }}>
                    <Typography sx={{ fontSize: '1.0625rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost' }}>{person.name}</Typography>
                    <Box sx={{ px: 1, py: 0.25, bgcolor: person.riskLevel === 'High' ? '#dc2626' : '#f59e0b', color: '#ffffff', fontSize: '0.625rem', fontWeight: 800, letterSpacing: '0.05em' }}>
                      {person.riskLevel.toUpperCase()} RISK
                    </Box>
                  </Box>
                  <Typography sx={{ fontSize: '0.875rem', color: '#475569', fontWeight: 500 }}>{person.position} at {person.organization}</Typography>
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
        <Box sx={{ bgcolor: '#f8fafc', border: '1px dashed #cbd5e1', p: 8, textAlign: 'center' }}>
          <WarningAmberRoundedIcon sx={{ fontSize: '2.5rem', color: '#94a3b8', mb: 2 }} />
          <Typography sx={{ fontSize: '0.9375rem', color: '#64748b' }}>Enter a customer's name above to cross-reference against the PEP database.</Typography>
        </Box>
      )}
    </Box>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

const TAB_LABELS = ['All Customers', 'PEP Screening']

export default function CustomersPage() {
  const [searchParams] = useSearchParams()
  const filterParam = searchParams.get('filter') ?? ''

  const initialTab = filterParam === 'pep' ? 1 : 0
  const [tab, setTab] = useState(initialTab)

  return (
    <Box sx={{ p: 4 }}>
      <Box sx={{ mb: 3 }}>
        <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: colorPalette.primary, letterSpacing: '0.14em', textTransform: 'uppercase', mb: 0.75 }}>
          Investigate
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
          <BadgeOutlinedIcon sx={{ color: colorPalette.primary, fontSize: '1.625rem' }} />
          <Typography sx={{ fontSize: '1.625rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost', letterSpacing: '-0.015em' }}>
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
          borderBottom: '1px solid #eef0f4', mb: 3, minHeight: 36,
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
      {tab === 1 && <PEPScreeningView />}
    </Box>
  )
}
