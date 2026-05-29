import {
  Box, Typography, Stack, InputBase,
  CircularProgress, Button, Tabs, Tab, Popover,
  Dialog, IconButton,
} from '@mui/material'
import { colorPalette } from '@/theme'
import { useState, useEffect } from 'react'
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined'
import { kycApi, type KycCustomer } from '@/api/kyc'
import { useNavigate } from 'react-router-dom'
import PublicOutlinedIcon from '@mui/icons-material/PublicOutlined'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import FingerprintOutlinedIcon from '@mui/icons-material/FingerprintOutlined'
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined'
import PortraitOutlinedIcon from '@mui/icons-material/PortraitOutlined'
import PolicyOutlinedIcon from '@mui/icons-material/PolicyOutlined'
import PhoneAndroidOutlinedIcon from '@mui/icons-material/PhoneAndroidOutlined'
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'

export interface PEPPerson {
  id: string
  name: string
  position: string
  organization: string
  country: string
  riskLevel: 'Low' | 'Medium' | 'High'
  lastUpdated: string
}

// ── Shared helpers ────────────────────────────────────────────────────────────

const KL_LABELS: Record<string, string> = { t1: 'T1 — Basic', t2: 'T2 — Intermediate', t3: 'T3 — Full KYC' }
const KL_INT: Record<string, number> = { t1: 1, t2: 2, t3: 3 }

function TierBars({ level }: { level: string | null | undefined }) {
  if (!level) return <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>—</Typography>
  const n = KL_INT[level] ?? 1
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.625 }}>
      {[1, 2, 3].map((t) => (
        <Box key={t} sx={{ width: 8, height: 16, bgcolor: t <= n ? colorPalette.primary : '#e5e7eb' }} />
      ))}
      <Typography sx={{ fontSize: '0.75rem', color: '#64748b', ml: 0.5 }}>{KL_LABELS[level] ?? level}</Typography>
    </Box>
  )
}

function scoreColor(score: number) {
  if (score < 35) return { bg: '#dcfce7', fg: '#15803d' }
  if (score < 75) return { bg: '#fef9c3', fg: '#854d0e' }
  return { bg: '#fee2e2', fg: '#b91c1c' }
}

function StepCard({ label, status, score }: { label: string; status: string | null; score: number | null }) {
  const c = score == null ? { bg: '#f1f5f9', fg: '#94a3b8' } : scoreColor(score)
  const statusColor = status === 'pass' ? '#15803d' : status === 'fail' ? '#b91c1c' : '#94a3b8'
  return (
    <Box sx={{ flex: 1, p: 1.25, border: '1px solid var(--border-col)', borderRadius: 1.5, textAlign: 'center' }}>
      <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.5 }}>
        {label}
      </Typography>
      <Box sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 36, height: 36, borderRadius: '50%', bgcolor: c.bg, mb: 0.5 }}>
        <Typography sx={{ fontSize: '0.8125rem', fontWeight: 800, color: c.fg }}>
          {score == null ? '—' : score}
        </Typography>
      </Box>
      <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: statusColor, textTransform: 'uppercase' }}>
        {status ?? 'n/a'}
      </Typography>
    </Box>
  )
}

function CustomerProfileDialog({ customer, open, onClose }: {
  customer: KycCustomer | null
  open: boolean
  onClose: () => void
}) {
  if (!customer) return null
  const sc = scoreColor(customer.overallRiskScore)
  const photo = customer.identityPhoto
  const photoSrc = photo
    ? (photo.startsWith('data:') ? photo : `data:image/jpeg;base64,${photo}`)
    : null

  const actionMap: Record<string, { label: string; bg: string; fg: string }> = {
    clear:       { label: 'Clear',       bg: '#dcfce7', fg: '#15803d' },
    flagged:     { label: 'Flagged',     bg: '#fef9c3', fg: '#854d0e' },
    case_opened: { label: 'Case Opened', bg: '#fee2e2', fg: '#b91c1c' },
  }
  const action = actionMap[customer.actionTaken] ?? { label: customer.actionTaken, bg: '#f1f5f9', fg: '#475569' }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { borderRadius: 2, overflow: 'hidden' } }}>
      {/* Header */}
      <Box sx={{ bgcolor: colorPalette.primary, px: 3, pt: 3, pb: 2.5, color: '#fff', position: 'relative' }}>
        <IconButton onClick={onClose} size="small"
          sx={{ position: 'absolute', top: 12, right: 12, color: 'rgba(255,255,255,0.7)', '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.1)' } }}>
          <CloseRoundedIcon sx={{ fontSize: '1rem' }} />
        </IconButton>
        <Stack direction="row" spacing={2} alignItems="center">
          {/* Photo or initial */}
          <Box sx={{ width: 60, height: 60, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
            border: '2px solid rgba(255,255,255,0.3)',
            bgcolor: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {photoSrc ? (
              <Box component="img" src={photoSrc} alt="ID photo"
                sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff' }}>
                {customer.customerId[0]?.toUpperCase()}
              </Typography>
            )}
          </Box>
          <Box>
            <Typography sx={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'Jost' }}>{customer.customerId}</Typography>
            <Typography sx={{ fontSize: '0.75rem', opacity: 0.75 }}>
              Last verified: {new Date(customer.runAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
            </Typography>
          </Box>
        </Stack>
      </Box>

      {/* Body */}
      <Box sx={{ p: 3 }}>
        {/* Risk score + meta */}
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
          <Box sx={{ width: 64, height: 64, borderRadius: '50%', bgcolor: sc.bg,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Typography sx={{ fontSize: '1.25rem', fontWeight: 800, color: sc.fg, lineHeight: 1 }}>
              {customer.overallRiskScore}
            </Typography>
            <Typography sx={{ fontSize: '0.5rem', fontWeight: 700, color: sc.fg, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              risk
            </Typography>
          </Box>
          <Box>
            <Stack direction="row" spacing={0.75} flexWrap="wrap" sx={{ mb: 0.5 }}>
              <Box sx={{ px: 1, py: 0.25, bgcolor: 'var(--section-bg)', borderRadius: '4px', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--on-surface-variant)' }}>
                {KL_LABELS[customer.knowledgeLevel ?? ''] ?? customer.knowledgeLevel ?? '—'}
              </Box>
              <Box sx={{ px: 1, py: 0.25, bgcolor: 'var(--section-bg)', borderRadius: '4px', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--on-surface-variant)' }}>
                {customer.overallStatus}
              </Box>
            </Stack>
            <Box sx={{ display: 'inline-flex', px: 1.25, py: 0.25, borderRadius: '4px',
              bgcolor: action.bg, fontSize: '0.6875rem', fontWeight: 700, color: action.fg }}>
              {action.label}
            </Box>
          </Box>
        </Stack>

        {/* Pipeline step scores */}
        <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 1 }}>
          Pipeline results
        </Typography>
        <Stack direction="row" spacing={1} sx={{ mb: 0 }}>
          <StepCard label="BVN / NIN"  status={customer.bvnNinStatus}   score={customer.bvnNinScore} />
          <StepCard label="Phone"      status={customer.phoneStatus}     score={customer.phoneScore} />
          <StepCard label="Liveness"   status={customer.livenessStatus}  score={customer.livenessScore} />
          <StepCard label="PEP Check"  status={customer.pepStatus}       score={customer.pepScore} />
        </Stack>
      </Box>
    </Dialog>
  )
}

// ── Customers view ────────────────────────────────────────────────────────────

type StatusFilter = 'All' | 'Verified' | 'Partial' | 'Flagged'
const STATUS_FILTERS: StatusFilter[] = ['All', 'Verified', 'Partial', 'Flagged']

const GRID_COLS = '2.5fr 1fr 1fr 200px'

function CustomerRow({ customer, onNavigate }: { customer: KycCustomer; onNavigate: (id: string) => void }) {
  const sc = scoreColor(customer.overallRiskScore)
  const photo = customer.identityPhoto
  const photoSrc = photo
    ? (photo.startsWith('data:') ? photo : `data:image/jpeg;base64,${photo}`)
    : null
  const fullName = [customer.firstName, customer.lastName].filter(Boolean).join(' ')

  const actionMap: Record<string, { label: string; bg: string; fg: string }> = {
    clear:       { label: 'Clear',       bg: '#dcfce7', fg: '#15803d' },
    flagged:     { label: 'Flagged',     bg: '#fef9c3', fg: '#854d0e' },
    case_opened: { label: 'Case Opened', bg: '#fee2e2', fg: '#b91c1c' },
  }
  const action = actionMap[customer.actionTaken] ?? { label: customer.actionTaken, bg: '#f1f5f9', fg: '#475569' }

  return (
    <Box
      data-ai-analyzable="true"
      data-ai-description={`KYC Customer ${customer.customerId}. Name: ${fullName || 'unknown'}. Risk: ${customer.overallRiskScore}. Status: ${customer.overallStatus}.`}
      onClick={() => onNavigate(customer.customerId)}
      sx={{
        display: 'grid',
        gridTemplateColumns: GRID_COLS,
        gap: 2, px: 3, py: 2, alignItems: 'center',
        borderBottom: '1px solid var(--border-col)',
        cursor: 'pointer',
        transition: 'background 0.12s',
        '&:hover': { bgcolor: 'var(--section-bg)' },
        '&:last-child': { borderBottom: 'none' },
      }}
    >
      {/* Identity + account details */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75, minWidth: 0 }}>
        <Box sx={{
          width: 48, height: 48, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
          bgcolor: sc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: `2px solid ${sc.bg}`,
        }}>
          {photoSrc ? (
            <Box component="img" src={photoSrc} alt="ID photo"
              sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <Typography sx={{ fontSize: '1.125rem', fontWeight: 700, color: sc.fg }}>
              {(fullName || customer.customerId)[0]?.toUpperCase()}
            </Typography>
          )}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          {/* Name — always shown; falls back to em-dash if not yet available from Dojah */}
          <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: fullName ? '#0f172a' : '#94a3b8', fontFamily: 'Jost', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {fullName || '—'}
          </Typography>
          {/* Account / customer ID */}
          <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600, color: colorPalette.primary, fontFamily: 'SF Mono, Monaco, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', mt: 0.25 }}>
            {customer.customerId}
          </Typography>
          {/* Phone · DOB */}
          <Stack direction="row" divider={<Typography sx={{ color: '#d1d5db', lineHeight: 1, fontSize: '0.6875rem' }}>·</Typography>} spacing={0.75} sx={{ mt: 0.375 }}>
            <Typography sx={{ fontSize: '0.6875rem', color: '#64748b' }}>
              {customer.phone ?? '—'}
            </Typography>
            {customer.dateOfBirth && (
              <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8' }}>
                {customer.dateOfBirth}
              </Typography>
            )}
          </Stack>
        </Box>
      </Box>

      {/* Risk score */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <Box sx={{
          width: 44, height: 44, borderRadius: '50%', bgcolor: sc.bg,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Typography sx={{ fontSize: '0.875rem', fontWeight: 800, color: sc.fg, lineHeight: 1 }}>
            {customer.overallRiskScore}
          </Typography>
          <Typography sx={{ fontSize: '0.4375rem', fontWeight: 700, color: sc.fg, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            risk
          </Typography>
        </Box>
        <Box>
          <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--on-surface-variant)', textTransform: 'capitalize' }}>
            {customer.overallStatus}
          </Typography>
          <TierBars level={customer.knowledgeLevel} />
        </Box>
      </Box>

      {/* Action */}
      <Box>
        <Box sx={{ display: 'inline-flex', px: 1.25, py: 0.375, bgcolor: action.bg, fontSize: '0.6875rem', fontWeight: 700, color: action.fg }}>
          {action.label}
        </Box>
        <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', mt: 0.5 }}>
          {new Date(customer.runAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
        </Typography>
      </Box>

      {/* Step score pills */}
      <Box sx={{ display: 'flex', gap: 0.625 }}>
        {[
          { label: 'BVN', score: customer.bvnNinScore },
          { label: 'Phone', score: customer.phoneScore },
          { label: 'Face', score: customer.livenessScore },
          { label: 'PEP', score: customer.pepScore },
        ].map(({ label, score }) => {
          const c = score == null ? { bg: '#f1f5f9', fg: '#94a3b8' } : scoreColor(score)
          return (
            <Box key={label} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
              px: 0.875, py: 0.5, bgcolor: c.bg, minWidth: 40 }}>
              <Typography sx={{ fontSize: '0.5rem', fontWeight: 700, color: c.fg, textTransform: 'uppercase', letterSpacing: '0.06em', lineHeight: 1.2 }}>
                {label}
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 800, color: c.fg, lineHeight: 1.2 }}>
                {score ?? '—'}
              </Typography>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}

function CustomersView() {
  const navigate = useNavigate()
  const [customers, setCustomers] = useState<KycCustomer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<StatusFilter>('All')

  useEffect(() => {
    kycApi.listCustomers()
      .then(r => setCustomers(r.customers))
      .catch(() => { })
      .finally(() => setLoading(false))
  }, [])

  const stats = {
    total: customers.length,
    verified: customers.filter(c => c.overallStatus === 'verified').length,
    flagged: customers.filter(c => c.overallStatus === 'flagged').length,
    partial: customers.filter(c => c.overallStatus === 'partial').length,
  }

  const filtered = customers.filter(c => {
    if (filter !== 'All' && c.overallStatus !== filter.toLowerCase()) return false
    if (search) {
      const q = search.toLowerCase()
      const name = [c.firstName, c.lastName].filter(Boolean).join(' ').toLowerCase()
      if (!c.customerId.toLowerCase().includes(q) && !name.includes(q)) return false
    }
    return true
  })

  return (
    <>
      {/* Stats row */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, mb: 3 }}>
        {[
          { label: 'Total customers', value: stats.total,    sub: 'KYC verified' },
          { label: 'Verified',        value: stats.verified, sub: 'full verification' },
          { label: 'Partial',         value: stats.partial,  sub: 'incomplete checks' },
          { label: 'Flagged',         value: stats.flagged,  sub: 'require review' },
        ].map((s) => (
          <Box key={s.label} sx={{ bgcolor: 'var(--card-bg)', border: '1px solid var(--border-col)', p: 2.25 }}>
            <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 0.75 }}>{s.label}</Typography>
            <Typography sx={{ fontSize: '1.625rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost', lineHeight: 1.1, mb: 0.5 }}>
              {loading ? '—' : s.value.toLocaleString()}
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>{s.sub}</Typography>
          </Box>
        ))}
      </Box>

      {/* Customer list */}
      <Box sx={{ bgcolor: 'var(--card-bg)', border: '1px solid var(--border-col)' }}>
        {/* Header */}
        <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid var(--border-col)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost' }}>
              KYC Customers
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
              One record per customer — updated on every beam. Click a row to open the full profile.
            </Typography>
          </Box>
        </Box>

        {/* Filters + search */}
        <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid var(--border-col)', display: 'flex', alignItems: 'center', gap: 2 }}>
          <Stack direction="row" gap={0.5}>
            {STATUS_FILTERS.map((f) => (
              <Box key={f} onClick={() => setFilter(f)} sx={{
                px: 1.375, py: 0.625, fontSize: '0.75rem', fontWeight: 600,
                cursor: 'pointer', fontFamily: 'Jost',
                color: filter === f ? colorPalette.primary : '#64748b',
                bgcolor: filter === f ? `${colorPalette.primary}0a` : 'transparent',
                transition: 'all 0.15s',
                '&:hover': { bgcolor: filter === f ? `${colorPalette.primary}0f` : '#f8fafc' },
              }}>{f}</Box>
            ))}
          </Stack>
          <Box sx={{ flex: 1 }} />
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 1, bgcolor: 'var(--section-bg)',
            px: 1.5, height: 32, minWidth: 260, border: '1px solid transparent',
            transition: 'all 0.18s', '&:focus-within': { bgcolor: 'var(--card-bg)', borderColor: colorPalette.primary },
          }}>
            <SearchOutlinedIcon sx={{ fontSize: '1rem', color: '#94a3b8' }} />
            <InputBase value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or customer ID…"
              sx={{ flex: 1, fontSize: '0.8125rem', fontFamily: 'Jost', color: 'var(--heading-color)' }} />
          </Box>
        </Box>

        {/* Column headers */}
        <Box sx={{ display: 'grid', gridTemplateColumns: GRID_COLS, gap: 2, px: 3, py: 1.375, bgcolor: 'var(--card-bg)', borderBottom: '1px solid var(--border-col)' }}>
          {['Customer · Account', 'Risk score', 'Action', 'Step scores'].map((h) => (
            <Typography key={h} sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{h}</Typography>
          ))}
        </Box>

        {/* Rows */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={26} sx={{ color: colorPalette.primary }} />
          </Box>
        ) : filtered.length === 0 ? (
          <Box sx={{ py: 8, textAlign: 'center' }}>
            {customers.length === 0 ? (
              <>
                <FingerprintOutlinedIcon sx={{ fontSize: 36, color: '#cbd5e1', mb: 1.5 }} />
                <Typography sx={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--heading-color)', mb: 0.75 }}>No KYC records yet</Typography>
                <Typography sx={{ fontSize: '0.8125rem', color: '#64748b' }}>
                  Beam customer data (BVN, NIN, photo) via the <strong>kyc</strong> stream to get started.
                </Typography>
              </>
            ) : (
              <Typography sx={{ fontSize: '0.875rem', color: '#94a3b8' }}>No customers match the current filter.</Typography>
            )}
          </Box>
        ) : (
          filtered.map(c => (
            <CustomerRow key={c.customerId} customer={c} onNavigate={(id) => navigate(`/dashboard/users/${id}`)} />
          ))
        )}
      </Box>
    </>
  )
}

function PEPScreeningView() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PEPPerson[]>([])
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSearch = async () => {
    if (!query) return
    setLoading(true)
    setSearched(true)
    try {
      const res = await kycApi.searchPEP(query)
      setResults(res.results)
    } catch (err) {
      console.error(err)
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box>
      <Box sx={{ bgcolor: 'var(--card-bg)', border: '1px solid var(--border-col)', mb: 3 }}>
        <Box sx={{ p: 3, borderBottom: '1px solid var(--border-col)' }}>
          <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost', mb: 0.5 }}>
            PEP & Sanctions Screening
          </Typography>
          <Typography sx={{ fontSize: '0.8125rem', color: '#64748b' }}>
            Search the global Politically Exposed Persons database to identify high-risk individuals.
          </Typography>
        </Box>
        <Box sx={{ p: 3, display: 'flex', gap: 2 }}>
          <Box sx={{
            flex: 1, display: 'flex', alignItems: 'center', gap: 1.5, bgcolor: 'var(--card-bg)',
            px: 2, height: 44, border: '1px solid var(--border-col)',
            transition: 'all 0.18s', '&:focus-within': { bgcolor: 'var(--card-bg)', borderColor: colorPalette.primary }
          }}>
            <SearchOutlinedIcon sx={{ fontSize: '1.25rem', color: '#94a3b8' }} />
            <InputBase value={query} onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
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
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress size={26} sx={{ color: colorPalette.primary }} />
            </Box>
          ) : results.length === 0 ? (
            <Box sx={{ py: 8, textAlign: 'center' }}>
              <CheckCircleOutlineRoundedIcon sx={{ fontSize: '3rem', color: '#10b981', mb: 2, opacity: 0.5 }} />
              <Typography sx={{ fontSize: '1rem', fontWeight: 600, color: 'var(--heading-color)', mb: 0.5 }}>No Direct PEP Matches Found</Typography>
              <Typography sx={{ fontSize: '0.8125rem', color: '#64748b' }}>
                No PEP or sanctions matches found for "{query}".
              </Typography>
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
          <Typography sx={{ fontSize: '0.9375rem', color: '#64748b' }}>
            Enter a customer's name above to cross-reference against the PEP database.
          </Typography>
        </Box>
      )}
    </Box>
  )
}

// ── Verification Flow Builder ─────────────────────────────────────────────────

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

function KycFlowBuilderView() {
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
                {/* Node */}
                <Box
                  data-ai-analyzable="true"
                  data-ai-description={`KYC Pipeline Step ${i + 1}: ${def.label}. ${def.description}.`}
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function KYCPage() {
  const [tabValue, setTabValue] = useState(0)

  return (
    <Box sx={{ p: 4 }}>
      <Box sx={{ mb: 3 }}>
        <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: colorPalette.primary, letterSpacing: '0.14em', textTransform: 'uppercase', mb: 0.75 }}>
          Customer Due Diligence
        </Typography>
        <Typography sx={{ fontSize: '1.625rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost', letterSpacing: '-0.015em', mb: 0.5 }}>
          KYC
        </Typography>
        <Typography sx={{ fontSize: '0.9375rem', color: '#64748b' }}>
          Beam customer KYC data (BVN, NIN, photo) via the Beam API — the platform is the source of truth for identity verification
        </Typography>
      </Box>

      <Tabs
        value={tabValue}
        onChange={(_, v) => setTabValue(v)}
        sx={{
          borderBottom: '1px solid var(--border-col)', mb: 3, minHeight: 36,
          '& .MuiTabs-indicator': { bgcolor: colorPalette.primary, height: 2 },
          '& .MuiTab-root': {
            fontFamily: 'Jost', fontSize: '0.75rem', fontWeight: 600,
            textTransform: 'none', minHeight: 36, py: 0, px: 2.5,
            color: '#94a3b8',
            '&.Mui-selected': { color: colorPalette.primary },
          },
        }}
      >
        <Tab label="Lookup History" />
        <Tab label="PEP Screening" />
        <Tab label="Verification Flow" />
      </Tabs>

      {tabValue === 0 && <CustomersView />}
      {tabValue === 1 && <PEPScreeningView />}
      {tabValue === 2 && <KycFlowBuilderView />}
    </Box>
  )
}
