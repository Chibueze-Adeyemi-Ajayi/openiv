import { Box, Typography, InputBase, CircularProgress } from '@mui/material'
import { useState, useEffect, useRef, useCallback, forwardRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { customerApi, type Customer } from '@/api/customers'
import { caseApi, type Case, type CasePriority } from '@/api/cases'
import { transactionApi, type Transaction } from '@/api/transactions'
import { colorPalette } from '@/theme'
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined'
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined'
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import NorthWestRoundedIcon from '@mui/icons-material/NorthWestRounded'

// ── helpers ───────────────────────────────────────────────────────────────────

const PRIORITY_COLOR: Record<CasePriority, string> = {
  critical: '#dc2626',
  high:     '#f59e0b',
  medium:   '#3b82f6',
  low:      '#94a3b8',
}

const FLAGGED_COLOR: Record<string, string> = {
  blocked: '#dc2626',
  flagged: '#f59e0b',
  review:  '#3b82f6',
  cleared: '#10b981',
}

function riskColor(score: number) {
  if (score >= 75) return '#dc2626'
  if (score >= 50) return '#f59e0b'
  if (score >= 25) return '#3b82f6'
  return '#94a3b8'
}

function fmtAmount(amount: number, currency = 'NGN') {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency', currency,
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount)
}

// ── sub-components ────────────────────────────────────────────────────────────

const ResultRow = forwardRef<HTMLDivElement, {
  isActive: boolean
  onClick: () => void
  icon: React.ReactNode
  primary: string
  secondary: string
  meta?: React.ReactNode
}>(({ isActive, onClick, icon, primary, secondary, meta }, ref) => (
  <Box
    ref={ref}
    onClick={onClick}
    sx={{
      display: 'flex', alignItems: 'center', gap: 1.75,
      px: 2.5, py: 1.25,
      bgcolor: isActive ? `${colorPalette.primary}08` : 'transparent',
      cursor: 'pointer',
      transition: 'background 0.1s',
      borderLeft: isActive ? `2px solid ${colorPalette.primary}` : '2px solid transparent',
      '&:hover': { bgcolor: `${colorPalette.primary}06` },
    }}
  >
    <Box sx={{ flexShrink: 0 }}>{icon}</Box>
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography sx={{
        fontSize: '0.875rem', fontWeight: 600, color: 'var(--on-surface)', fontFamily: 'Jost',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.35,
      }}>
        {primary}
      </Typography>
      <Typography sx={{
        fontSize: '0.6875rem', color: '#94a3b8',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', mt: 0.25,
      }}>
        {secondary}
      </Typography>
    </Box>
    {meta && <Box sx={{ flexShrink: 0 }}>{meta}</Box>}
    <NorthWestRoundedIcon sx={{ fontSize: '0.75rem', color: isActive ? colorPalette.primary : '#e2e8f0', flexShrink: 0, transform: 'rotate(90deg)', transition: 'color 0.1s' }} />
  </Box>
))
ResultRow.displayName = 'ResultRow'

function RiskPill({ score }: { score: number }) {
  const c = riskColor(score)
  return (
    <Box sx={{ bgcolor: c + '14', border: `1px solid ${c}30`, borderRadius: '20px', px: 1, py: 0.2, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 30 }}>
      <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: c, lineHeight: 1 }}>{score}</Typography>
    </Box>
  )
}

function StatusChip({ label, color }: { label: string; color: string }) {
  return (
    <Box sx={{ bgcolor: color + '14', color, px: 0.875, py: 0.2, borderRadius: '4px', fontSize: '0.5625rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', lineHeight: 1.6, whiteSpace: 'nowrap' }}>
      {label}
    </Box>
  )
}

function SectionHeader({ label }: { label: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 2.5, pt: 1.75, pb: 0.75 }}>
      <Typography sx={{ fontSize: '0.5625rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.14em', whiteSpace: 'nowrap' }}>
        {label}
      </Typography>
      <Box sx={{ flex: 1, height: '1px', bgcolor: 'var(--border-col)' }} />
    </Box>
  )
}

function KbdHint({ keys, label }: { keys: string[]; label: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      {keys.map(k => (
        <Box key={k} sx={{ px: 0.625, py: 0.2, bgcolor: 'var(--card-bg)', border: '1px solid var(--border-col)', borderRadius: '4px', fontSize: '0.625rem', fontWeight: 600, color: '#64748b', lineHeight: 1.6 }}>
          {k}
        </Box>
      ))}
      <Typography sx={{ fontSize: '0.625rem', color: '#94a3b8', ml: 0.25 }}>{label}</Typography>
    </Box>
  )
}

// ── main component ────────────────────────────────────────────────────────────

interface SearchResults {
  customers: Customer[]
  cases: Case[]
  transactions: Transaction[]
}

export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const [query, setQuery]     = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<SearchResults | null>(null)
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef  = useRef<HTMLInputElement>(null)
  const activeRef = useRef<HTMLDivElement>(null)

  // Reset and focus when opened
  useEffect(() => {
    if (open) {
      setQuery('')
      setResults(null)
      setLoading(false)
      setActiveIdx(0)
      const t = setTimeout(() => inputRef.current?.focus(), 60)
      return () => clearTimeout(t)
    }
  }, [open])

  // Debounced search
  useEffect(() => {
    if (!open) return
    const q = query.trim()
    if (q.length < 2) { setResults(null); setLoading(false); return }

    setLoading(true)
    const t = setTimeout(async () => {
      try {
        const [customerRes, caseRes, txRes] = await Promise.all([
          customerApi.list(q, 4, 1),
          caseApi.list({ q, pageSize: 4 }),
          transactionApi.list({ q, pageSize: 4 }),
        ])
        setResults({
          customers:    customerRes.customers,
          cases:        caseRes.cases,
          transactions: txRes.transactions,
        })
        setActiveIdx(0)
      } catch {
        setResults({ customers: [], cases: [], transactions: [] })
      } finally {
        setLoading(false)
      }
    }, 280)
    return () => clearTimeout(t)
  }, [query, open])

  // Build a flat navigation list for keyboard control
  const flat = useCallback((): Array<() => void> => {
    if (!results) return []
    return [
      ...results.customers.map(c => () => { navigate(`/dashboard/users/${c.externalId}`); onClose() }),
      ...results.cases.map(c => () => { navigate(`/dashboard/cases/${c.id}`); onClose() }),
      ...results.transactions.map(t => () => { navigate(`/dashboard/transactions?tx=${encodeURIComponent(t.id)}`); onClose() }),
    ]
  }, [results, navigate, onClose])

  // Keyboard navigation
  useEffect(() => {
    if (!open) return
    const fns = flat()
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape')    { onClose(); return }
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, fns.length - 1)) }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)) }
      if (e.key === 'Enter' && fns[activeIdx]) { fns[activeIdx]() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, flat, activeIdx, onClose])

  // Scroll active row into view
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' })
  }, [activeIdx])

  if (!open) return null

  // Compute per-section start indices for active tracking
  const customerCount = results?.customers.length ?? 0
  const caseCount     = results?.cases.length ?? 0
  const caseStart     = customerCount
  const txStart       = customerCount + caseCount

  const hasResults = results && (customerCount + caseCount + (results.transactions.length)) > 0

  return (
    <Box
      onClick={onClose}
      sx={{
        position: 'fixed', inset: 0, zIndex: 1400,
        bgcolor: 'rgba(15,23,42,0.48)',
        backdropFilter: 'blur(6px)',
        display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
        pt: '13vh',
        animation: 'backdropIn 0.15s ease',
        '@keyframes backdropIn': { from: { opacity: 0 }, to: { opacity: 1 } },
      }}
    >
      <Box
        onClick={e => e.stopPropagation()}
        sx={{
          width: '100%', maxWidth: 620, mx: 2,
          bgcolor: 'var(--card-bg)',
          boxShadow: '0 8px 16px rgba(15,23,42,0.08), 0 32px 80px rgba(15,23,42,0.2)',
          overflow: 'hidden',
          animation: 'paletteIn 0.18s cubic-bezier(0.22, 1, 0.36, 1)',
          '@keyframes paletteIn': {
            from: { opacity: 0, transform: 'scale(0.96) translateY(-12px)' },
            to:   { opacity: 1, transform: 'scale(1) translateY(0)' },
          },
        }}
      >
        {/* ── Search input row ───────────────────────────────────────────── */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2.5, height: 60, borderBottom: '1px solid var(--border-col)' }}>
          <Box sx={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22 }}>
            {loading
              ? <CircularProgress size={16} thickness={4.5} sx={{ color: colorPalette.primary }} />
              : <SearchOutlinedIcon sx={{ fontSize: '1.125rem', color: query ? colorPalette.primary : '#94a3b8' }} />
            }
          </Box>

          <InputBase
            inputRef={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search transactions, customers, cases…"
            sx={{
              flex: 1,
              fontSize: '0.9375rem',
              fontFamily: 'Jost',
              color: 'var(--on-surface)',
              '& input::placeholder': { color: '#94a3b8', opacity: 1 },
            }}
          />

          {query ? (
            <Box
              onClick={() => { setQuery(''); setResults(null); setLoading(false); inputRef.current?.focus() }}
              sx={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '50%', bgcolor: 'var(--section-bg)', cursor: 'pointer', transition: 'background 0.12s', '&:hover': { bgcolor: 'var(--border-col)' } }}
            >
              <CloseRoundedIcon sx={{ fontSize: '0.875rem', color: '#64748b' }} />
            </Box>
          ) : (
            <Box sx={{ flexShrink: 0, px: 0.875, py: 0.375, border: '1px solid var(--border-col)', borderRadius: '4px' }}>
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600, color: '#94a3b8' }}>⌘K</Typography>
            </Box>
          )}
        </Box>

        {/* ── Results area ───────────────────────────────────────────────── */}
        <Box sx={{ overflowY: 'auto', maxHeight: 420 }}>

          {/* Idle — no query */}
          {!query && (
            <Box sx={{ py: 5, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.75 }}>
              <SearchOutlinedIcon sx={{ fontSize: '1.75rem', color: '#e2e8f0', mb: 0.5 }} />
              <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#94a3b8', fontFamily: 'Jost' }}>
                Search everything
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: '#cbd5e1', textAlign: 'center', maxWidth: 280 }}>
                Customers, transactions, AML cases — minimum 2 characters
              </Typography>
            </Box>
          )}

          {/* Typing — need one more char */}
          {query.trim().length === 1 && (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <Typography sx={{ fontSize: '0.875rem', color: '#94a3b8' }}>Keep typing…</Typography>
            </Box>
          )}

          {/* No results */}
          {!loading && query.trim().length >= 2 && results && !hasResults && (
            <Box sx={{ py: 5, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.75 }}>
              <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#94a3b8', fontFamily: 'Jost' }}>
                No results for "{query}"
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
                Try a name, account number, transaction ID, or case title
              </Typography>
            </Box>
          )}

          {/* Customers */}
          {results && results.customers.length > 0 && (
            <>
              <SectionHeader label="Customers" />
              {results.customers.map((c, i) => {
                const isActive = activeIdx === i
                const score    = c.overallRiskScore ?? c.riskScore
                const isCorp   = c.subjectType === 'corporate'
                return (
                  <ResultRow
                    key={c.id}
                    ref={isActive ? activeRef : undefined}
                    isActive={isActive}
                    onClick={() => { navigate(`/dashboard/users/${c.externalId}`); onClose() }}
                    icon={
                      <Box sx={{ width: 34, height: 34, borderRadius: '50%', bgcolor: colorPalette.primary + '12', border: `1px solid ${colorPalette.primary}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {isCorp
                          ? <BusinessOutlinedIcon sx={{ fontSize: '1rem', color: colorPalette.primary }} />
                          : <PersonOutlinedIcon  sx={{ fontSize: '1rem', color: colorPalette.primary }} />
                        }
                      </Box>
                    }
                    primary={c.name}
                    secondary={[c.externalId, c.accountNumber, c.subjectType].filter(Boolean).join(' · ')}
                    meta={<RiskPill score={score} />}
                  />
                )
              })}
            </>
          )}

          {/* Cases */}
          {results && results.cases.length > 0 && (
            <>
              <SectionHeader label="Cases" />
              {results.cases.map((c, i) => {
                const idx      = caseStart + i
                const isActive = activeIdx === idx
                const pColor   = PRIORITY_COLOR[c.priority]
                return (
                  <ResultRow
                    key={c.id}
                    ref={isActive ? activeRef : undefined}
                    isActive={isActive}
                    onClick={() => { navigate(`/dashboard/cases/${c.id}`); onClose() }}
                    icon={
                      <Box sx={{ width: 34, height: 34, borderRadius: '6px', bgcolor: pColor + '12', border: `1px solid ${pColor}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <GavelOutlinedIcon sx={{ fontSize: '1rem', color: pColor }} />
                      </Box>
                    }
                    primary={c.title}
                    secondary={[c.typology, c.customerName, c.status].filter(Boolean).join(' · ')}
                    meta={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.875 }}>
                        <StatusChip label={c.priority} color={pColor} />
                        <RiskPill score={c.riskScore} />
                      </Box>
                    }
                  />
                )
              })}
            </>
          )}

          {/* Transactions */}
          {results && results.transactions.length > 0 && (
            <>
              <SectionHeader label="Transactions" />
              {results.transactions.map((t, i) => {
                const idx      = txStart + i
                const isActive = activeIdx === idx
                const fStatus  = t.flaggedStatus
                const fColor   = fStatus ? (FLAGGED_COLOR[fStatus] ?? '#64748b') : '#64748b'
                return (
                  <ResultRow
                    key={t.id}
                    ref={isActive ? activeRef : undefined}
                    isActive={isActive}
                    onClick={() => { navigate(`/dashboard/transactions?tx=${encodeURIComponent(t.id)}`); onClose() }}
                    icon={
                      <Box sx={{ width: 34, height: 34, borderRadius: '6px', bgcolor: fColor + '12', border: `1px solid ${fColor}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <ReceiptLongOutlinedIcon sx={{ fontSize: '1rem', color: fColor }} />
                      </Box>
                    }
                    primary={`${t.customer}  ·  ${fmtAmount(t.amount, t.currency)}`}
                    secondary={[t.channel, t.narration || t.counterparty, t.id].filter(Boolean).join(' · ')}
                    meta={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.875 }}>
                        {fStatus && <StatusChip label={fStatus} color={fColor} />}
                        <RiskPill score={t.risk} />
                      </Box>
                    }
                  />
                )
              })}
            </>
          )}

          {/* Bottom padding */}
          {hasResults && <Box sx={{ height: 8 }} />}
        </Box>

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <Box sx={{ px: 2.5, py: 1.25, borderTop: '1px solid var(--border-col)', display: 'flex', alignItems: 'center', gap: 2.5, bgcolor: 'var(--section-bg)' }}>
          <KbdHint keys={['↑', '↓']} label="navigate" />
          <KbdHint keys={['↵']}       label="open" />
          <KbdHint keys={['Esc']}     label="dismiss" />
          <Box sx={{ flex: 1 }} />
          <Typography sx={{ fontSize: '0.625rem', color: '#cbd5e1', fontFamily: 'Jost' }}>
            OpenIV Search
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}
