import { Box, Typography, Stack, InputBase, Chip, IconButton, Popover, Button } from '@mui/material'
import { colorPalette } from '@/theme'
// import { colorPalette } from '@/theme'
import DateRangeFilter, { type DateRange } from '@/components/dashboard/DateRangeFilter'
import { useState, useEffect, useCallback, useRef } from 'react'
import { beamApi, type BeamRecord } from '@/api/beam'
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined'
import FilterListRoundedIcon from '@mui/icons-material/FilterListRounded'
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import InteractionDetailPanel from '@/components/dashboard/InteractionDetailPanel'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useNavigate } from 'react-router-dom'

const PAGE_SIZE = 20

const GRID = '32px 100px 1.5fr 1.5fr 100px 110px 110px 32px'

const STREAMS = ['logins', 'activity', 'location', 'devices', 'otps'] as const

type RiskFilter = 'any' | 'high' | 'medium' | 'low'
const RISK_OPTIONS: { key: RiskFilter; label: string }[] = [
  { key: 'any', label: 'Any' },
  { key: 'high', label: 'High ≥70' },
  { key: 'medium', label: 'Med 40–69' },
  { key: 'low', label: 'Low <40' },
]

function determineStatus(record: BeamRecord) {
  let score: number | null = null
  try {
    const payload = JSON.parse(record.payload)
    score = payload.risk_score ?? payload.riskScore ?? payload.score ?? payload.fraud_score ?? null
  } catch { }

  if (score === null) {
    return { label: 'UNSCORED', bg: '#f8fafc', color: '#94a3b8', score: 0 }
  }
  if (score >= 70) {
    return { label: 'FRAUDULENT', bg: '#fef2f2', color: '#dc2626', score }
  }
  if (score >= 40) {
    return { label: 'SUSPICIOUS', bg: '#fffbeb', color: '#f59e0b', score }
  }
  return { label: 'NORMAL', bg: '#f0fdf4', color: '#10b981', score }
}

export default function BehavioralPatternsPage() {
  const user = useCurrentUser()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [range, setRange] = useState<DateRange>('30d')
  const [rows, setRows] = useState<BeamRecord[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [detailBeam, setDetailBeam] = useState<BeamRecord | null>(null)

  // Filters
  const [activeStatus, setActiveStatus] = useState<string>('All')
  const [streamFilter, setStreamFilter] = useState<string | null>(null)
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('any')

  const [filterOpen, setFilterOpen] = useState(false)
  const filterBtnRef = useRef<HTMLButtonElement | null>(null)
  const [draftStream, setDraftStream] = useState<string | null>(null)
  const [draftRisk, setDraftRisk] = useState<RiskFilter>('any')

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1) }, 300)
    return () => clearTimeout(t)
  }, [search])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await beamApi.listRecords({
        stream: streamFilter,
        q: debouncedSearch,
        range,
        page,
        pageSize: PAGE_SIZE,
      })
      const refined = res.records.filter(r => {
        const statusCfg = determineStatus(r)
        if (activeStatus !== 'All' && statusCfg.label !== activeStatus.toUpperCase()) return false
        // Hide UNSCORED records from risk filters (only show in "All" or explicit "Unscored" filter)
        if (riskFilter !== 'any' && statusCfg.label === 'UNSCORED') return false
        if (riskFilter === 'high' && statusCfg.score < 70) return false
        if (riskFilter === 'medium' && (statusCfg.score < 40 || statusCfg.score >= 70)) return false
        if (riskFilter === 'low' && statusCfg.score >= 40) return false
        return true
      })
      setRows(refined)
      // Estimate the total accurately based on client filtering vs server total
      setTotal(res.total === res.records.length ? refined.length : res.total)
    } catch {
      console.error('Failed to load interaction beams')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, page, range, streamFilter, activeStatus, riskFilter])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [activeStatus, range, streamFilter, riskFilter])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const openFilter = () => { setDraftStream(streamFilter); setDraftRisk(riskFilter); setFilterOpen(true) }
  const applyFilter = () => { setStreamFilter(draftStream); setRiskFilter(draftRisk); setPage(1); setFilterOpen(false) }
  const clearFilter = () => { setDraftStream(null); setDraftRisk('any') }

  const filterCount = (streamFilter ? 1 : 0) + (riskFilter !== 'any' ? 1 : 0)

  return (
    <>
      <Box sx={{ p: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: colorPalette.primary, letterSpacing: '0.14em', textTransform: 'uppercase', mb: 0.75 }}>
            Interaction Monitor
          </Typography>
          <Typography sx={{ fontSize: '1.625rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost', letterSpacing: '-0.015em', mb: 0.5 }}>
            Behavioral Patterns
          </Typography>
          <Typography sx={{ fontSize: '0.9375rem', color: '#64748b' }}>
            Real-time feed of user interactions, sessions, and activity beams scored for anomalies
          </Typography>
        </Box>
      </Box>

      {/* Filters & Search */}
      <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', display: 'flex', alignItems: 'center', gap: 2, px: 2, py: 1.5, mb: 0, borderBottom: 'none' }}>
        <Stack direction="row" gap={0.5}>
          {['All', 'Normal', 'Suspicious', 'Fraudulent', 'Unscored'].map(f => (
            <Box
              key={f}
              onClick={() => setActiveStatus(f)}
              sx={{ px: 1.75, py: 0.875, fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', color: activeStatus === f ? colorPalette.primary : '#64748b', bgcolor: activeStatus === f ? `${colorPalette.primary}0a` : 'transparent', fontFamily: 'Jost', transition: 'all 0.15s', '&:hover': { bgcolor: activeStatus === f ? `${colorPalette.primary}0f` : '#f8fafc' } }}
            >
              {f}
            </Box>
          ))}
        </Stack>
        <Box sx={{ flex: 1 }} />
        <DateRangeFilter value={range} onChange={setRange} compact />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#f8fafc', px: 1.5, height: 32, maxWidth: 300, flex: 1, border: '1px solid transparent', transition: 'all 0.18s', '&:focus-within': { bgcolor: '#ffffff', borderColor: colorPalette.primary }, borderRadius: 0 }}>
          <SearchOutlinedIcon sx={{ fontSize: '1rem', color: '#94a3b8' }} />
          <InputBase
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search payloads or IDs…"
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
          {streamFilter && (
            <Chip label={`Stream: ${streamFilter}`} size="small" onDelete={() => { setStreamFilter(null); setPage(1) }} deleteIcon={<CloseRoundedIcon />}
              sx={{ bgcolor: `${colorPalette.primary}0f`, color: colorPalette.primary, fontWeight: 600, fontSize: '0.6875rem', borderRadius: 0, height: 20, '& .MuiChip-label': { px: 1 }, '& .MuiChip-deleteIcon': { fontSize: '0.75rem', color: colorPalette.primary } }} />
          )}
          {riskFilter !== 'any' && (
            <Chip label={`Risk: ${RISK_OPTIONS.find(r => r.key === riskFilter)?.label}`} size="small" onDelete={() => { setRiskFilter('any'); setPage(1) }} deleteIcon={<CloseRoundedIcon />}
              sx={{ bgcolor: `${colorPalette.primary}0f`, color: colorPalette.primary, fontWeight: 600, fontSize: '0.6875rem', borderRadius: 0, height: 20, '& .MuiChip-label': { px: 1 }, '& .MuiChip-deleteIcon': { fontSize: '0.75rem', color: colorPalette.primary } }} />
          )}
          <Box sx={{ flex: 1 }} />
          <Box onClick={() => { setStreamFilter(null); setRiskFilter('any'); setPage(1) }} sx={{ fontSize: '0.6875rem', color: '#94a3b8', cursor: 'pointer', '&:hover': { color: '#475569' } }}>
            Clear all
          </Box>
        </Box>
      )}

      {/* Table */}
      <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', overflowX: 'auto', borderRadius: 0 }}>
        <Box sx={{ minWidth: 1000 }}>
          {/* Header */}
          <Box sx={{ display: 'grid', gridTemplateColumns: GRID, gap: 2, px: 2, py: 1.5, bgcolor: '#fafbfc', borderBottom: '1px solid #eef0f4', alignItems: 'center' }}>
            <Box />
            {['Ref ID', 'User / IP', 'Action / Context', 'Risk', 'Status', 'Date / Time', ''].map(h => (
              <Typography key={h} sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: h === 'Risk' ? 'right' : 'left' }}>
                {h}
              </Typography>
            ))}
          </Box>

          {/* Loading skeleton */}
          {loading && Array.from({ length: 8 }).map((_, i) => (
            <Box key={i} sx={{ display: 'grid', gridTemplateColumns: GRID, gap: 2, px: 2, py: 2, borderBottom: '1px solid #f4f5f7', alignItems: 'center' }}>
              {Array.from({ length: 8 }).map((_, j) => (
                <Box key={j} sx={{ height: 12, bgcolor: '#f1f5f9', borderRadius: 0, animation: 'pulse 1.5s ease-in-out infinite', '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } } }} />
              ))}
            </Box>
          ))}

          {/* Empty state */}
          {!loading && rows.length === 0 && (
            <Box sx={{ p: 6, textAlign: 'center' }}>
              <Typography sx={{ fontSize: '0.875rem', color: '#94a3b8' }}>No interaction beams found for the selected filters.</Typography>
            </Box>
          )}

          {/* Rows */}
          {!loading && rows.map(r => {
            let parsed: any = {}
            try { parsed = JSON.parse(r.payload) } catch { }

            const userId = parsed.user_id || parsed.customer_id || 'Unknown User'
            const userName = parsed.user_name || null

            const actionName = parsed.activity_name || parsed.action || parsed.event || 'Interaction'
            const actionNote = parsed.note || null

            // Extract human-readable context fallback
            const deviceName = parsed.device_name || parsed.os || ''
            const location = parsed.location || ''
            let contextParts = []
            if (deviceName) contextParts.push(`Device: ${deviceName}`)
            if (location) contextParts.push(`Loc: ${location}`)
            const fallbackContext = contextParts.length > 0 ? contextParts.join(' · ') : 'No additional context'

            const finalContext = actionNote || fallbackContext

            // Use occurred_at field (from database), fallback to payload, then receivedAt
            const timestamp = r.occurredAt || parsed.occurred_at || parsed.occurredAt || r.receivedAt

            const statusCfg = determineStatus(r)

            return (
              <Box
                key={r.id}
                onClick={() => setDetailBeam(r)}
                data-ai-analyzable="true"
                data-ai-description={`Interaction Beam ${r.id} from ${userName || userId}. Status: ${statusCfg.label}.`}
                sx={{ display: 'grid', gridTemplateColumns: GRID, gap: 2, px: 2, py: 1.75, alignItems: 'center', borderBottom: '1px solid #f4f5f7', transition: 'background 0.15s', cursor: 'pointer', '&:hover': { bgcolor: '#fafbfc' }, '&:last-child': { borderBottom: 'none' } }}
              >
                <Box />

                {/* Ref ID */}
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#0f172a', fontFamily: 'SF Mono, Monaco, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.id}
                </Typography>

                {/* User / IP */}
                <Box sx={{ overflow: 'hidden' }}>
                  <Typography
                    onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/users/${encodeURIComponent(userId)}`) }}
                    sx={{ fontSize: '0.8125rem', fontWeight: 600, color: colorPalette.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                  >
                    {userName || userId}
                  </Typography>
                  <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', fontFamily: 'SF Mono, Monaco, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', mt: 0.25 }}>
                    {r.ip || parsed.ip_address || 'IP hidden'}
                  </Typography>
                </Box>

                {/* Action / Context */}
                <Box sx={{ overflow: 'hidden' }}>
                  <Typography sx={{ fontSize: '0.8125rem', color: '#475569', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textTransform: 'capitalize' }}>
                    {String(actionName).replace(/_/g, ' ')}
                  </Typography>
                  <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', mt: 0.25 }}>
                    {finalContext.length > 60 ? finalContext.substring(0, 60) + '...' : finalContext}
                  </Typography>
                </Box>

                {/* Risk bar */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.75 }}>
                  <Box sx={{ width: 32, height: 4, bgcolor: '#f1f5f9', position: 'relative', flexShrink: 0 }}>
                    <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${statusCfg.score}%`, bgcolor: statusCfg.score >= 70 ? '#dc2626' : statusCfg.score >= 40 ? '#f59e0b' : '#10b981' }} />
                  </Box>
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#0f172a', minWidth: 20, textAlign: 'right' }}>
                    {statusCfg.score}
                  </Typography>
                </Box>

                {/* Status */}
                <Box>
                  <Chip label={statusCfg.label} size="small" sx={{ bgcolor: statusCfg.bg, color: statusCfg.color, fontWeight: 700, fontSize: '0.5625rem', letterSpacing: '0.08em', textTransform: 'uppercase', borderRadius: 0, height: 18, '& .MuiChip-label': { px: 0.75 } }} />
                </Box>

                {/* Date / Time */}
                <Box sx={{ overflow: 'hidden' }}>
                  <Typography sx={{ fontSize: '0.75rem', color: '#0f172a', fontWeight: 500, whiteSpace: 'nowrap' }}>
                    {new Intl.DateTimeFormat('en-NG', { day: '2-digit', month: 'short', year: 'numeric', timeZone: user?.timezone ?? 'Africa/Lagos' }).format(new Date(timestamp))}
                  </Typography>
                  <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', fontFamily: 'SF Mono, Monaco, monospace', whiteSpace: 'nowrap', mt: 0.125 }}>
                    {new Intl.DateTimeFormat('en-NG', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: user?.timezone ?? 'Africa/Lagos' }).format(new Date(timestamp))}
                  </Typography>
                </Box>

                {/* Detail button */}
                <IconButton
                  size="small" disableRipple
                  onClick={(e) => { e.stopPropagation(); setDetailBeam(r); }}
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
              {loading ? 'Loading…' : `Showing ${rows.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total.toLocaleString()} beams`}
            </Typography>
            <Stack direction="row" gap={0.5}>
              <PageBtn label="Previous" disabled={page <= 1} onClick={() => setPage(p => p - 1)} active={false} />
              {pageNumbers(page, totalPages).map((p, i) =>
                p === '…'
                  ? <Box key={`ellipsis-${i}`} sx={{ px: 1.25, py: 0.5, fontSize: '0.75rem', color: '#94a3b8', border: '1px solid #e5e7eb', borderRadius: 0 }}>…</Box>
                  : <PageBtn key={p} label={String(p)} active={p === page} disabled={false} onClick={() => setPage(Number(p))} />
              )}
              <PageBtn label="Next" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} active={false} />
            </Stack>
          </Box>
        </Box>
      </Box>
    </Box>

      {/* Filter Panel */ }
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
        <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>Filter Beams</Typography>
        <IconButton size="small" disableRipple onClick={() => setFilterOpen(false)} sx={{ borderRadius: 0, color: '#94a3b8', '&:hover': { color: '#475569' }, mr: -0.5 }}>
          <CloseRoundedIcon sx={{ fontSize: '1rem' }} />
        </IconButton>
      </Box>
      <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 1 }}>Stream</Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.625, mb: 2.5 }}>
        {STREAMS.map(st => {
          const on = draftStream === st
          return (
            <Box key={st} onClick={() => setDraftStream(on ? null : st)} sx={{ px: 1.25, py: 0.5, fontSize: '0.75rem', fontWeight: 600, fontFamily: 'Jost', cursor: 'pointer', border: '1px solid', borderColor: on ? colorPalette.primary : '#e2e8f0', color: on ? colorPalette.primary : '#64748b', bgcolor: on ? `${colorPalette.primary}0a` : 'transparent', transition: 'all 0.15s', '&:hover': { borderColor: colorPalette.primary, color: colorPalette.primary } }}>
              {st}
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
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, pt: 1.5, borderTop: '1px solid #f1f5f9' }}>
        <Button disableRipple onClick={clearFilter} sx={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600, fontFamily: 'Jost', textTransform: 'none', borderRadius: 0, px: 1.5, minWidth: 0 }}>Clear</Button>
        <Button disableRipple onClick={applyFilter} sx={{ bgcolor: colorPalette.primary, color: '#fff', fontSize: '0.75rem', fontWeight: 600, fontFamily: 'Jost', textTransform: 'none', borderRadius: 0, px: 2, '&:hover': { bgcolor: colorPalette.primary } }}>Apply</Button>
      </Box>
    </Box>
  </Popover>

  {/* Interaction Detail Drawer */ }
  <InteractionDetailPanel
    beam={detailBeam}
    open={!!detailBeam}
    onClose={() => setDetailBeam(null)}
  />
    </>
  )
}

function PageBtn({ label, active, disabled, onClick }: { label: string; active: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <Box onClick={disabled ? undefined : onClick} sx={{ px: 1.25, py: 0.5, fontSize: '0.75rem', fontWeight: 600, color: active ? '#ffffff' : disabled ? '#cbd5e1' : '#475569', bgcolor: active ? colorPalette.primary : 'transparent', border: '1px solid', borderColor: active ? colorPalette.primary : '#e5e7eb', cursor: disabled ? 'not-allowed' : 'pointer', transition: 'all 0.15s', borderRadius: 0, '&:hover': disabled || active ? {} : { borderColor: colorPalette.primary, color: colorPalette.primary } }}>
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
