import { Box, Typography, Stack, Button, InputBase, Chip, IconButton, Alert, Popover } from '@mui/material'
import { colorPalette } from '@/theme'
import DashboardLayout from '@/components/dashboard/DashboardLayout'
import DateRangeFilter, { type DateRange } from '@/components/dashboard/DateRangeFilter'
import { useState, useEffect, useCallback, useRef } from 'react'
import { transactionApi, type Transaction, type FlaggedStatus, type TransactionStatus } from '@/api/transactions'
import ImportTransactionsModal from '@/components/dashboard/ImportTransactionsModal'
import TransactionDetailPanel from '@/components/dashboard/TransactionDetailPanel'
import ActionEvidenceDialog, { type EvidencePayload } from '@/components/dashboard/ActionEvidenceDialog'
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined'
import FilterListRoundedIcon from '@mui/icons-material/FilterListRounded'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import BlockRoundedIcon from '@mui/icons-material/BlockRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'

const PAGE_SIZE = 20

const paymentStatusCfg: Record<string, { color: string; bg: string; label: string }> = {
  pending:    { color: '#f59e0b', bg: '#fffbeb',                              label: 'Pending'    },
  successful: { color: '#10b981', bg: '#f0fdf4',                              label: 'Successful' },
  failed:     { color: '#dc2626', bg: '#fef2f2',                              label: 'Failed'     },
}

const flaggedStatusCfg: Record<FlaggedStatus, { color: string; bg: string; label: string }> = {
  flagged: { color: '#f59e0b', bg: '#fffbeb',                              label: 'Flagged'   },
  blocked: { color: '#dc2626', bg: '#fef2f2',                              label: 'Blocked'   },
  cleared: { color: '#10b981', bg: '#f0fdf4',                              label: 'Cleared'   },
  review:  { color: colorPalette.primary, bg: `${colorPalette.primary}08`, label: 'In Review' },
}

const FILTERS = ['All', 'Flagged', 'Blocked', 'In Review', 'Cleared'] as const

const filterToFlagged: Record<string, FlaggedStatus | undefined> = {
  'All':       undefined,
  'Flagged':   'flagged',
  'Blocked':   'blocked',
  'In Review': 'review',
  'Cleared':   'cleared',
}

type RiskFilter = 'any' | 'high' | 'medium' | 'low'

const CHANNELS = ['Wire', 'Mobile', 'PoS', 'ATM', 'USSD'] as const

const RISK_OPTIONS: { key: RiskFilter; label: string }[] = [
  { key: 'any',    label: 'Any'       },
  { key: 'high',   label: 'High ≥70'  },
  { key: 'medium', label: 'Med 40–69' },
  { key: 'low',    label: 'Low <40'   },
]

const RISK_TO_RANGE: Record<RiskFilter, { min?: number; max?: number }> = {
  any:    {},
  high:   { min: 70 },
  medium: { min: 40, max: 69 },
  low:    { max: 39 },
}

const GRID = '32px 100px 1fr 1fr 110px 75px 70px 88px 110px 32px'

export default function TransactionsPage() {
  const [active,          setActive]          = useState<string>('All')
  const [search,          setSearch]          = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selected,        setSelected]        = useState<string[]>([])
  const [range,           setRange]           = useState<DateRange>('30d')
  const [page,            setPage]            = useState(1)

  const [channel,              setChannel]              = useState<string | null>(null)
  const [appliedRisk,          setAppliedRisk]          = useState<RiskFilter>('any')
  const [appliedPaymentStatus, setAppliedPaymentStatus] = useState<TransactionStatus | null>(null)

  const [importOpen,   setImportOpen]   = useState(false)
  const [exporting,    setExporting]    = useState(false)
  const [filterOpen,   setFilterOpen]   = useState(false)
  const [draftChannel,       setDraftChannel]       = useState<string | null>(null)
  const [draftRisk,          setDraftRisk]          = useState<RiskFilter>('any')
  const [draftPaymentStatus, setDraftPaymentStatus] = useState<TransactionStatus | null>(null)
  const filterBtnRef = useRef<HTMLButtonElement | null>(null)

  const [detailTxn,  setDetailTxn]  = useState<Transaction | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const [rows,    setRows]    = useState<Transaction[]>([])
  const [total,   setTotal]   = useState(0)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1) }, 300)
    return () => clearTimeout(t)
  }, [search])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const riskRange = RISK_TO_RANGE[appliedRisk]
      const res = await transactionApi.list({
        flaggedStatus: filterToFlagged[active],
        status:        appliedPaymentStatus || undefined,
        q:             debouncedSearch || undefined,
        page,
        pageSize: PAGE_SIZE,
        range,
        channel:  channel || undefined,
        minRisk:  riskRange.min,
        maxRisk:  riskRange.max,
      })
      setRows(res.transactions)
      setTotal(res.total)
    } catch {
      setError('Could not load transactions. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }, [active, debouncedSearch, page, range, channel, appliedRisk, appliedPaymentStatus])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [active, range])

  const toggleSelect = (id: string) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const [bulkEvidenceTarget, setBulkEvidenceTarget] = useState<FlaggedStatus | null>(null)

  const handleBulkClear    = () => setBulkEvidenceTarget('cleared')
  const handleBulkEscalate = () => setBulkEvidenceTarget('flagged')

  const handleBulkEvidenceConfirm = async (ev: EvidencePayload) => {
    if (!bulkEvidenceTarget) return
    const target = bulkEvidenceTarget
    setBulkEvidenceTarget(null)
    await transactionApi.bulkFlaggedStatus(selected, target, ev.reason, ev.documentId)
    setSelected([]); load()
  }

  const openFilter = () => {
    setDraftChannel(channel); setDraftRisk(appliedRisk); setDraftPaymentStatus(appliedPaymentStatus); setFilterOpen(true)
  }

  const applyFilter = () => {
    setChannel(draftChannel); setAppliedRisk(draftRisk); setAppliedPaymentStatus(draftPaymentStatus); setPage(1); setFilterOpen(false)
  }

  const clearFilter = () => { setDraftChannel(null); setDraftRisk('any'); setDraftPaymentStatus(null) }

  const handleExport = async () => {
    setExporting(true)
    try {
      const riskRange = RISK_TO_RANGE[appliedRisk]
      await transactionApi.exportCsv({
        flaggedStatus: filterToFlagged[active],
        status:        appliedPaymentStatus || undefined,
        q:             debouncedSearch || undefined,
        range,
        channel:       channel || undefined,
        minRisk:       riskRange.min,
        maxRisk:       riskRange.max,
      })
    } catch {
      setError('Export failed. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  const openDetail = (t: Transaction) => { setDetailTxn(t); setDetailOpen(true) }

  const filterCount = (channel ? 1 : 0) + (appliedRisk !== 'any' ? 1 : 0) + (appliedPaymentStatus ? 1 : 0)
  const totalPages  = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <DashboardLayout>
      <Box sx={{ p: 4 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
          <Box>
            <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: colorPalette.primary, letterSpacing: '0.14em', textTransform: 'uppercase', mb: 0.75 }}>
              Real-Time Monitor
            </Typography>
            <Typography sx={{ fontSize: '1.625rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost', letterSpacing: '-0.015em', mb: 0.5 }}>
              Transactions
            </Typography>
            <Typography sx={{ fontSize: '0.9375rem', color: '#64748b' }}>
              Every transaction scored against your active rules and AI baselines
            </Typography>
          </Box>
          <Stack direction="row" gap={1.25}>
            <Button
              onClick={() => setImportOpen(true)}
              sx={{ bgcolor: colorPalette.primary, color: '#ffffff', px: 2.25, py: 1.125, fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Jost', borderRadius: 0, textTransform: 'none', '&:hover': { bgcolor: colorPalette.primary, opacity: 0.9 } }}
            >
              Import Transactions
            </Button>
            <Button
              onClick={handleExport}
              disabled={exporting}
              startIcon={<FileDownloadOutlinedIcon sx={{ fontSize: '1rem !important' }} />}
              sx={{ bgcolor: '#ffffff', color: '#475569', border: '1px solid #e5e7eb', px: 2.25, py: 1.125, fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Jost', borderRadius: 0, textTransform: 'none', '&:hover': { bgcolor: '#f8fafc', borderColor: '#cbd5e1' }, '&:disabled': { opacity: 0.6 } }}
            >
              {exporting ? 'Exporting…' : 'Export CSV'}
            </Button>
          </Stack>
        </Box>

        {error && (
          <Alert severity="error" onClose={() => setError(null)} sx={{ borderRadius: 0, mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Filters & Search */}
        <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', display: 'flex', alignItems: 'center', gap: 2, px: 2, py: 1.5, mb: 0, borderBottom: 'none' }}>
          <Stack direction="row" gap={0.5}>
            {FILTERS.map(f => (
              <Box
                key={f}
                onClick={() => setActive(f)}
                sx={{ px: 1.75, py: 0.875, fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', color: active === f ? colorPalette.primary : '#64748b', bgcolor: active === f ? `${colorPalette.primary}0a` : 'transparent', fontFamily: 'Jost', transition: 'all 0.15s', '&:hover': { bgcolor: active === f ? `${colorPalette.primary}0f` : '#f8fafc' } }}
              >
                {f}
              </Box>
            ))}
          </Stack>
          <Box sx={{ flex: 1 }} />
          <DateRangeFilter value={range} onChange={setRange} compact />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#f8fafc', px: 1.5, height: 32, minWidth: 240, border: '1px solid transparent', transition: 'all 0.18s', '&:focus-within': { bgcolor: '#ffffff', borderColor: colorPalette.primary } }}>
            <SearchOutlinedIcon sx={{ fontSize: '1rem', color: '#94a3b8' }} />
            <InputBase
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by ID, customer or customer ID…"
              sx={{ flex: 1, fontSize: '0.8125rem', fontFamily: 'Jost', color: '#0f172a' }}
            />
          </Box>

          <Box sx={{ position: 'relative', display: 'inline-flex' }}>
            <IconButton
              ref={filterBtnRef}
              disableRipple
              onClick={openFilter}
              sx={{ borderRadius: 0, color: filterCount > 0 ? colorPalette.primary : '#64748b', '&:hover': { color: colorPalette.primary } }}
            >
              <FilterListRoundedIcon sx={{ fontSize: '1.125rem' }} />
            </IconButton>
            {filterCount > 0 && (
              <Box sx={{ position: 'absolute', top: 7, right: 7, width: 7, height: 7, bgcolor: colorPalette.primary, borderRadius: '50%', pointerEvents: 'none' }} />
            )}
          </Box>
        </Box>

        {/* Active filter chips */}
        {filterCount > 0 && (
          <Box sx={{ bgcolor: '#f8fafc', border: '1px solid #eef0f4', borderTop: 'none', px: 2, py: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', mr: 0.5 }}>Filters:</Typography>
            {channel && (
              <Chip label={`Channel: ${channel}`} size="small" onDelete={() => { setChannel(null); setPage(1) }} deleteIcon={<CloseRoundedIcon />}
                sx={{ bgcolor: `${colorPalette.primary}0f`, color: colorPalette.primary, fontWeight: 600, fontSize: '0.6875rem', borderRadius: 0, height: 20, '& .MuiChip-label': { px: 1 }, '& .MuiChip-deleteIcon': { fontSize: '0.75rem', color: colorPalette.primary } }} />
            )}
            {appliedRisk !== 'any' && (
              <Chip label={`Risk: ${RISK_OPTIONS.find(r => r.key === appliedRisk)?.label}`} size="small" onDelete={() => { setAppliedRisk('any'); setPage(1) }} deleteIcon={<CloseRoundedIcon />}
                sx={{ bgcolor: `${colorPalette.primary}0f`, color: colorPalette.primary, fontWeight: 600, fontSize: '0.6875rem', borderRadius: 0, height: 20, '& .MuiChip-label': { px: 1 }, '& .MuiChip-deleteIcon': { fontSize: '0.75rem', color: colorPalette.primary } }} />
            )}
            {appliedPaymentStatus && (
              <Chip label={`Payment: ${paymentStatusCfg[appliedPaymentStatus]?.label}`} size="small" onDelete={() => { setAppliedPaymentStatus(null); setPage(1) }} deleteIcon={<CloseRoundedIcon />}
                sx={{ bgcolor: `${paymentStatusCfg[appliedPaymentStatus].color}12`, color: paymentStatusCfg[appliedPaymentStatus].color, fontWeight: 600, fontSize: '0.6875rem', borderRadius: 0, height: 20, '& .MuiChip-label': { px: 1 }, '& .MuiChip-deleteIcon': { fontSize: '0.75rem', color: paymentStatusCfg[appliedPaymentStatus].color } }} />
            )}
            <Box sx={{ flex: 1 }} />
            <Box onClick={() => { setChannel(null); setAppliedRisk('any'); setAppliedPaymentStatus(null); setPage(1) }} sx={{ fontSize: '0.6875rem', color: '#94a3b8', cursor: 'pointer', '&:hover': { color: '#475569' } }}>
              Clear all
            </Box>
          </Box>
        )}

        {/* Bulk Action Bar */}
        {selected.length > 0 && (
          <Box sx={{ bgcolor: colorPalette.primary, color: '#ffffff', px: 2, py: 1.25, display: 'flex', alignItems: 'center', gap: 2, animation: 'slideDown 0.2s ease', '@keyframes slideDown': { from: { opacity: 0, transform: 'translateY(-4px)' }, to: { opacity: 1, transform: 'translateY(0)' } } }}>
            <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600 }}>{selected.length} transaction{selected.length > 1 ? 's' : ''} selected</Typography>
            <Box sx={{ flex: 1 }} />
            <Button onClick={handleBulkClear}    startIcon={<CheckRoundedIcon sx={{ fontSize: '1rem !important' }} />} sx={{ color: '#ffffff', bgcolor: 'rgba(255,255,255,0.12)', px: 1.75, py: 0.625, fontSize: '0.75rem', fontWeight: 600, borderRadius: 0, textTransform: 'none', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' } }}>Clear</Button>
            <Button onClick={handleBulkEscalate} startIcon={<BlockRoundedIcon  sx={{ fontSize: '1rem !important' }} />} sx={{ color: '#ffffff', bgcolor: 'rgba(255,255,255,0.12)', px: 1.75, py: 0.625, fontSize: '0.75rem', fontWeight: 600, borderRadius: 0, textTransform: 'none', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' } }}>Escalate</Button>
          </Box>
        )}

        {/* Table */}
        <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', overflowX: 'auto' }}>
          <Box sx={{ minWidth: 1100 }}>
            {/* Header */}
            <Box sx={{ display: 'grid', gridTemplateColumns: GRID, gap: 2, px: 2, py: 1.5, bgcolor: '#fafbfc', borderBottom: '1px solid #eef0f4', alignItems: 'center' }}>
              <Box />
              {['Reference', 'Sender', 'Recipient', 'Amount (₦)', 'Channel', 'Risk', 'Status', 'Date / Time', ''].map(h => (
                <Typography key={h} sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: ['Amount (₦)', 'Risk'].includes(h) ? 'right' : 'left' }}>
                  {h}
                </Typography>
              ))}
            </Box>

            {/* Loading skeleton */}
            {loading && Array.from({ length: 8 }).map((_, i) => (
              <Box key={i} sx={{ display: 'grid', gridTemplateColumns: GRID, gap: 2, px: 2, py: 2, borderBottom: '1px solid #f4f5f7', alignItems: 'center' }}>
                {Array.from({ length: 10 }).map((_, j) => (
                  <Box key={j} sx={{ height: 12, bgcolor: '#f1f5f9', borderRadius: 0.5, animation: 'pulse 1.5s ease-in-out infinite', '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } } }} />
                ))}
              </Box>
            ))}

            {/* Empty state */}
            {!loading && rows.length === 0 && (
              <Box sx={{ p: 6, textAlign: 'center' }}>
                <Typography sx={{ fontSize: '0.875rem', color: '#94a3b8' }}>No transactions found for the selected filters.</Typography>
              </Box>
            )}

            {/* Rows */}
            {!loading && rows.map(t => {
              const isSelected = selected.includes(t.id)
              const fCfg = t.flaggedStatus ? flaggedStatusCfg[t.flaggedStatus] : null
              const pCfg = paymentStatusCfg[t.status] ?? paymentStatusCfg.pending
              const badgeCfg = fCfg ?? pCfg
              const senderSub  = [t.senderAccount,  t.senderBank].filter(Boolean).join('  ·  ')
              const recipName  = t.recipientName ?? t.counterparty
              const recipSub   = [t.recipientAccount, t.recipientBank].filter(Boolean).join('  ·  ')
              return (
                <Box
                  key={t.id}
                  sx={{ display: 'grid', gridTemplateColumns: GRID, gap: 2, px: 2, py: 1.75, alignItems: 'center', borderBottom: '1px solid #f4f5f7', bgcolor: isSelected ? `${colorPalette.primary}06` : 'transparent', transition: 'background 0.15s', '&:hover': { bgcolor: isSelected ? `${colorPalette.primary}0a` : '#fafbfc' }, '&:last-child': { borderBottom: 'none' } }}
                >
                  {/* Checkbox */}
                  <Box onClick={e => { e.stopPropagation(); toggleSelect(t.id) }} sx={{ width: 16, height: 16, border: `1.5px solid ${isSelected ? colorPalette.primary : '#cbd5e1'}`, bgcolor: isSelected ? colorPalette.primary : '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', flexShrink: 0 }}>
                    {isSelected && <CheckRoundedIcon sx={{ fontSize: '0.875rem', color: '#ffffff' }} />}
                  </Box>

                  {/* Reference */}
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#0f172a', fontFamily: 'SF Mono, Monaco, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.id}
                  </Typography>

                  {/* Sender */}
                  <Box sx={{ overflow: 'hidden' }}>
                    <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.customer}
                    </Typography>
                    {senderSub && (
                      <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', fontFamily: 'SF Mono, Monaco, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', mt: 0.25 }}>
                        {senderSub}
                      </Typography>
                    )}
                    {!senderSub && t.location && (
                      <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', mt: 0.25 }}>
                        {t.location}
                      </Typography>
                    )}
                  </Box>

                  {/* Recipient */}
                  <Box sx={{ overflow: 'hidden' }}>
                    <Typography sx={{ fontSize: '0.8125rem', color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {recipName}
                    </Typography>
                    {recipSub && (
                      <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', fontFamily: 'SF Mono, Monaco, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', mt: 0.25 }}>
                        {recipSub}
                      </Typography>
                    )}
                  </Box>

                  {/* Amount */}
                  <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a', textAlign: 'right', fontFamily: 'SF Mono, Monaco, monospace' }}>
                    {t.amount.toLocaleString()}
                  </Typography>

                  {/* Channel */}
                  <Typography sx={{ fontSize: '0.75rem', color: '#475569', fontWeight: 500 }}>
                    {t.channel}
                  </Typography>

                  {/* Risk bar */}
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.75 }}>
                    <Box sx={{ width: 32, height: 4, bgcolor: '#f1f5f9', position: 'relative', flexShrink: 0 }}>
                      <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${t.risk}%`, bgcolor: t.risk >= 70 ? '#dc2626' : t.risk >= 40 ? '#f59e0b' : '#10b981' }} />
                    </Box>
                    <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#0f172a', minWidth: 20, textAlign: 'right' }}>
                      {t.risk}
                    </Typography>
                  </Box>

                  {/* Status: flaggedStatus (if set) takes priority; otherwise payment status */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.375 }}>
                    <Chip label={badgeCfg.label} size="small" sx={{ bgcolor: badgeCfg.bg, color: badgeCfg.color, fontWeight: 700, fontSize: '0.5625rem', letterSpacing: '0.08em', textTransform: 'uppercase', borderRadius: 0, height: 18, '& .MuiChip-label': { px: 0.75 } }} />
                    {fCfg && (
                      <Chip label={pCfg.label} size="small" sx={{ bgcolor: pCfg.bg, color: pCfg.color, fontWeight: 600, fontSize: '0.5rem', letterSpacing: '0.06em', textTransform: 'uppercase', borderRadius: 0, height: 15, '& .MuiChip-label': { px: 0.625 } }} />
                    )}
                  </Box>

                  {/* Date / Time */}
                  <Box sx={{ overflow: 'hidden' }}>
                    {t.occurredAt ? (
                      <>
                        <Typography sx={{ fontSize: '0.75rem', color: '#0f172a', fontWeight: 500, whiteSpace: 'nowrap' }}>
                          {new Intl.DateTimeFormat('en-NG', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(t.occurredAt))}
                        </Typography>
                        <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', fontFamily: 'SF Mono, Monaco, monospace', whiteSpace: 'nowrap', mt: 0.125 }}>
                          {new Intl.DateTimeFormat('en-NG', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(t.occurredAt))}
                        </Typography>
                      </>
                    ) : (
                      <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>—</Typography>
                    )}
                  </Box>

                  {/* Detail button */}
                  <IconButton
                    size="small" disableRipple
                    onClick={e => { e.stopPropagation(); openDetail(t) }}
                    sx={{ borderRadius: 0, color: '#94a3b8', '&:hover': { color: colorPalette.primary, bgcolor: `${colorPalette.primary}0a` } }}
                  >
                    <MoreHorizRoundedIcon sx={{ fontSize: '1.125rem' }} />
                  </IconButton>
                </Box>
              )
            })}

            {/* Pagination */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, py: 1.5, borderTop: '1px solid #eef0f4' }}>
              <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>
                {loading ? 'Loading…' : `Showing ${rows.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total.toLocaleString()} transactions`}
              </Typography>
              <Stack direction="row" gap={0.5}>
                <PageBtn label="Previous" disabled={page <= 1}         onClick={() => setPage(p => p - 1)} active={false} />
                {pageNumbers(page, totalPages).map((p, i) =>
                  p === '…'
                    ? <Box key={`ellipsis-${i}`} sx={{ px: 1.25, py: 0.5, fontSize: '0.75rem', color: '#94a3b8', border: '1px solid #e5e7eb' }}>…</Box>
                    : <PageBtn key={p} label={String(p)} active={p === page} disabled={false} onClick={() => setPage(Number(p))} />
                )}
                <PageBtn label="Next" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} active={false} />
              </Stack>
            </Box>
          </Box>
        </Box>
      </Box>

      <ImportTransactionsModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={load}
      />

      <TransactionDetailPanel
        transaction={detailTxn}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onStatusChange={load}
      />

      <ActionEvidenceDialog
        open={bulkEvidenceTarget !== null}
        onClose={() => setBulkEvidenceTarget(null)}
        onConfirm={handleBulkEvidenceConfirm}
        title="Bulk Status Change"
        actionLabel={bulkEvidenceTarget === 'cleared' ? 'Clear' : 'Escalate'}
        actionColor={bulkEvidenceTarget === 'cleared' ? '#10b981' : '#f59e0b'}
      />

      {/* Filter Panel */}
      <Popover
        open={filterOpen}
        anchorEl={filterBtnRef.current}
        onClose={() => setFilterOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { borderRadius: 0, boxShadow: '0 8px 32px rgba(15,23,42,0.12)', border: '1px solid #e2e8f0', width: 264 } }}
      >
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>Filter</Typography>
            <IconButton size="small" disableRipple onClick={() => setFilterOpen(false)} sx={{ borderRadius: 0, color: '#94a3b8', '&:hover': { color: '#475569' }, mr: -0.5 }}>
              <CloseRoundedIcon sx={{ fontSize: '1rem' }} />
            </IconButton>
          </Box>
          <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 1 }}>Channel</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.625, mb: 2.5 }}>
            {CHANNELS.map(ch => {
              const on = draftChannel === ch
              return (
                <Box key={ch} onClick={() => setDraftChannel(on ? null : ch)} sx={{ px: 1.25, py: 0.5, fontSize: '0.75rem', fontWeight: 600, fontFamily: 'Jost', cursor: 'pointer', border: '1px solid', borderColor: on ? colorPalette.primary : '#e2e8f0', color: on ? colorPalette.primary : '#64748b', bgcolor: on ? `${colorPalette.primary}0a` : 'transparent', transition: 'all 0.15s', '&:hover': { borderColor: colorPalette.primary, color: colorPalette.primary } }}>
                  {ch}
                </Box>
              )
            })}
          </Box>
          <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 1 }}>Risk Level</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.625, mb: 2.5 }}>
            {RISK_OPTIONS.map(r => {
              const on = draftRisk === r.key
              return (
                <Box key={r.key} onClick={() => setDraftRisk(r.key)} sx={{ px: 1.25, py: 0.5, fontSize: '0.75rem', fontWeight: 600, fontFamily: 'Jost', cursor: 'pointer', border: '1px solid', borderColor: on ? colorPalette.primary : '#e2e8f0', color: on ? colorPalette.primary : '#64748b', bgcolor: on ? `${colorPalette.primary}0a` : 'transparent', transition: 'all 0.15s', '&:hover': { borderColor: colorPalette.primary, color: colorPalette.primary } }}>
                  {r.label}
                </Box>
              )
            })}
          </Box>
          <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 1 }}>Payment Status</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.625, mb: 2.5 }}>
            {(['pending', 'successful', 'failed'] as TransactionStatus[]).map(s => {
              const on  = draftPaymentStatus === s
              const cfg = paymentStatusCfg[s]
              return (
                <Box key={s} onClick={() => setDraftPaymentStatus(on ? null : s)} sx={{ px: 1.25, py: 0.5, fontSize: '0.75rem', fontWeight: 600, fontFamily: 'Jost', cursor: 'pointer', border: '1px solid', borderColor: on ? cfg.color : '#e2e8f0', color: on ? cfg.color : '#64748b', bgcolor: on ? cfg.bg : 'transparent', transition: 'all 0.15s', '&:hover': { borderColor: cfg.color, color: cfg.color } }}>
                  {cfg.label}
                </Box>
              )
            })}
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, pt: 1.5, borderTop: '1px solid #f1f5f9' }}>
            <Button disableRipple onClick={clearFilter} sx={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600, fontFamily: 'Jost', textTransform: 'none', borderRadius: 0, px: 1.5, minWidth: 0 }}>Clear</Button>
            <Button disableRipple onClick={applyFilter} sx={{ bgcolor: colorPalette.primary, color: '#fff', fontSize: '0.75rem', fontWeight: 600, fontFamily: 'Jost', textTransform: 'none', borderRadius: 0, px: 2, '&:hover': { bgcolor: colorPalette.primary } }}>Apply</Button>
          </Box>
        </Box>
      </Popover>
    </DashboardLayout>
  )
}

function PageBtn({ label, active, disabled, onClick }: { label: string; active: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <Box onClick={disabled ? undefined : onClick} sx={{ px: 1.25, py: 0.5, fontSize: '0.75rem', fontWeight: 600, color: active ? '#ffffff' : disabled ? '#cbd5e1' : '#475569', bgcolor: active ? colorPalette.primary : 'transparent', border: '1px solid', borderColor: active ? colorPalette.primary : '#e5e7eb', cursor: disabled ? 'not-allowed' : 'pointer', transition: 'all 0.15s', '&:hover': disabled || active ? {} : { borderColor: colorPalette.primary, color: colorPalette.primary } }}>
      {label}
    </Box>
  )
}

function pageNumbers(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  if (current <= 4) return [1, 2, 3, 4, 5, '…', total]
  if (current >= total - 3) return [1, '…', total - 4, total - 3, total - 2, total - 1, total]
  return [1, '…', current - 1, current, current + 1, '…', total]
}
