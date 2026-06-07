import { Box, Typography, Stack, InputBase, Chip, IconButton, Popover, Button } from '@mui/material'
import { colorPalette } from '@/theme'
import ComingSoonOverlay from '@/components/dashboard/ComingSoonOverlay'
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

// Columns: spacer | Ref | Customer | Event | Context | Assessment | Timestamp | action
const GRID = '24px 100px 1.5fr 1.8fr 1.2fr 110px 130px 28px'

type RiskFilter = 'any' | 'high' | 'medium' | 'low'
const RISK_OPTIONS: { key: RiskFilter; label: string }[] = [
  { key: 'any',    label: 'Any risk' },
  { key: 'high',   label: 'High ≥ 70' },
  { key: 'medium', label: 'Medium 40–69' },
  { key: 'low',    label: 'Low < 40' },
]

const STREAM_LABELS: Record<string, string> = {
  logins:   'Login',
  activity: 'Activity',
  location: 'Location',
  devices:  'Device',
  otps:     'OTP',
}

function riskAssessment(score: number | null): { label: string; bg: string; color: string; score: number } {
  if (score === null) return { label: 'UNSCORED', bg: '#f8fafc', color: '#94a3b8', score: 0 }
  if (score >= 70)    return { label: 'FRAUDULENT', bg: '#fef2f2', color: '#dc2626', score }
  if (score >= 40)    return { label: 'SUSPICIOUS',  bg: '#fffbeb', color: '#d97706', score }
  return                     { label: 'NORMAL',       bg: '#f0fdf4', color: '#059669', score }
}

function parseBeam(r: BeamRecord): {
  customerId: string
  customerName: string
  ip: string
  event: string
  context: string
  score: number | null
  timestamp: string
} {
  let p: any = {}
  try { p = JSON.parse(r.payload) } catch { /* ignore */ }

  const customerId   = p.customerId   ?? p.customer_id   ?? p.userId ?? p.user_id ?? '—'
  const customerName = p.customerName ?? p.customer_name ?? p.userName ?? p.user_name ?? customerId
  const ip           = r.ip ?? p.ip ?? p.ip_address ?? '—'
  const timestamp    = r.occurredAt ?? p.occurred_at ?? p.occurredAt ?? r.receivedAt

  const score: number | null =
    p.risk_score ?? p.riskScore ?? p.score ?? p.fraud_score ?? null

  let event   = '—'
  let context = '—'

  switch (r.stream) {
    case 'logins': {
      const outcome  = p.outcome  ? String(p.outcome).toUpperCase()  : null
      const channel  = p.channel  ? String(p.channel).toUpperCase()  : null
      const country  = p.country  ?? p.city ?? null
      const device   = p.deviceModel ?? p.device_model ?? null
      event   = outcome ? `Login — ${outcome}` : 'Login attempt'
      context = [channel, country, device].filter(Boolean).join('  ·  ') || ip
      break
    }
    case 'activity': {
      const actType = p.activityType ?? p.activity_type ?? p.action ?? null
      const screen  = p.screen ?? null
      event   = actType && screen
        ? `${String(actType).replace(/_/g, ' ')} — ${screen}`
        : actType ?? 'In-app activity'
      context = [
        p.sessionId ? `Session ${p.sessionId}` : null,
        p.deviceId  ? `Device ${p.deviceId}`   : null,
      ].filter(Boolean).join('  ·  ') || ip
      break
    }
    case 'location': {
      const place = [p.city, p.country].filter(Boolean).join(', ')
      event   = place ? `Location ping — ${place}` : 'Location update'
      context = [
        p.accuracy ? `Accuracy ${p.accuracy}m` : null,
        p.provider ? String(p.provider).toUpperCase() : null,
      ].filter(Boolean).join('  ·  ') || ip
      break
    }
    case 'devices': {
      const model = p.deviceModel ?? p.device_model ?? null
      const os    = [p.deviceOs ?? p.device_os ?? p.os, p.osVersion ?? p.os_version].filter(Boolean).join(' ')
      event   = model ? `${model}${os ? ` — ${os}` : ''}` : 'Device fingerprint'
      const flags = [
        (p.isRooted    || p.is_rooted)    ? 'ROOTED'     : null,
        (p.isJailbroken || p.is_jailbroken) ? 'JAILBROKEN' : null,
        (p.isEmulator  || p.is_emulator)  ? 'EMULATOR'   : null,
      ].filter(Boolean)
      context = flags.length > 0 ? flags.join('  ·  ') : p.appVersion ? `App v${p.appVersion}` : ip
      break
    }
    case 'otps': {
      const otpType = p.otpType   ?? p.otp_type   ?? null
      const outcome = p.outcome                   ?? null
      event   = [
        otpType ? String(otpType).replace(/_/g, ' ').toUpperCase() : null,
        'OTP',
        outcome ? `— ${String(outcome).toUpperCase()}` : null,
      ].filter(Boolean).join(' ')
      const amountStr = p.amount
        ? `NGN ${Number(p.amount / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`
        : null
      context = [
        p.channel   ? String(p.channel).toUpperCase() : null,
        amountStr,
        p.beneficiaryAccount ?? null,
      ].filter(Boolean).join('  ·  ') || ip
      break
    }
    default: {
      event   = r.stream ?? 'Unknown'
      context = ip
    }
  }

  return { customerId, customerName, ip, event, context, score, timestamp }
}

export default function BehavioralPatternsPage() {
  const user    = useCurrentUser()
  const navigate = useNavigate()
  const [search, setSearch]               = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage]                   = useState(1)
  const [range, setRange]                 = useState<DateRange>('30d')
  const [rows, setRows]                   = useState<BeamRecord[]>([])
  const [total, setTotal]                 = useState(0)
  const [loading, setLoading]             = useState(true)
  const [detailBeam, setDetailBeam]       = useState<BeamRecord | null>(null)
  const [activeStatus, setActiveStatus]   = useState<string>('All')
  const [streamFilter, setStreamFilter]   = useState<string | null>(null)
  const [riskFilter, setRiskFilter]       = useState<RiskFilter>('any')
  const [filterOpen, setFilterOpen]       = useState(false)
  const filterBtnRef                      = useRef<HTMLButtonElement | null>(null)
  const [draftRisk, setDraftRisk]         = useState<RiskFilter>('any')

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1) }, 300)
    return () => clearTimeout(t)
  }, [search])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await beamApi.listRecords({ stream: streamFilter, q: debouncedSearch, range, page, pageSize: PAGE_SIZE })
      const refined = res.records.filter(r => {
        let score: number | null = null
        try {
          const p = JSON.parse(r.payload)
          score = p.risk_score ?? p.riskScore ?? p.score ?? p.fraud_score ?? null
        } catch { /* ignore */ }
        const cfg = riskAssessment(score)
        if (activeStatus !== 'All' && cfg.label !== activeStatus.toUpperCase()) return false
        if (riskFilter !== 'any' && cfg.label === 'UNSCORED') return false
        if (riskFilter === 'high'   && cfg.score < 70) return false
        if (riskFilter === 'medium' && (cfg.score < 40 || cfg.score >= 70)) return false
        if (riskFilter === 'low'    && cfg.score >= 40) return false
        return true
      })
      setRows(refined)
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

  const openFilter  = () => { setDraftRisk(riskFilter); setFilterOpen(true) }
  const applyFilter = () => { setRiskFilter(draftRisk); setPage(1); setFilterOpen(false) }
  const clearFilter = () => { setDraftRisk('any') }

  return (
    <Box sx={{ position: 'relative' }}>

      <ComingSoonOverlay
        title="Behavioral Pattern Analysis"
        description="Real-time scoring across login, activity, location, device, and OTP channels is being rolled out in the next release. Transaction risk scoring is live now."
        fullPage
      />

      <Box sx={{ p: 4 }}>

        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
          <Box>
            <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: colorPalette.primary, letterSpacing: '0.14em', textTransform: 'uppercase', mb: 0.75 }}>
              Interaction Monitor
            </Typography>
            <Typography sx={{ fontSize: '1.625rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost', letterSpacing: '-0.015em', mb: 0.5 }}>
              Behavioral Patterns
            </Typography>
            <Typography sx={{ fontSize: '0.9375rem', color: '#64748b' }}>
              Real-time feed of customer interactions across login, activity, location, device, and OTP channels — scored for anomalies
            </Typography>
          </Box>
        </Box>

        {/* Filter row 1 — Status + Type */}
        <Box sx={{ bgcolor: 'var(--card-bg)', border: '1px solid var(--border-col)', display: 'flex', alignItems: 'center', px: 2, py: 1.5, borderBottom: 'none' }}>
          <Stack direction="row" gap={0.5}>
            {['All', 'Normal', 'Suspicious', 'Fraudulent', 'Unscored'].map(f => (
              <Box
                key={f}
                onClick={() => setActiveStatus(f)}
                sx={{ px: 1.75, py: 0.875, fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'Jost', transition: 'all 0.15s', color: activeStatus === f ? colorPalette.primary : '#64748b', bgcolor: activeStatus === f ? `${colorPalette.primary}0a` : 'transparent', '&:hover': { bgcolor: activeStatus === f ? `${colorPalette.primary}0f` : '#f8fafc' } }}
              >
                {f}
              </Box>
            ))}
          </Stack>

          <Box sx={{ flex: 1 }} />

          <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', mr: 1 }}>
            Type
          </Typography>
          <Stack direction="row" gap={0.5}>
            {([null, 'logins', 'activity', 'location', 'devices', 'otps'] as (string | null)[]).map(st => (
              <Box
                key={st ?? 'all'}
                onClick={() => { setStreamFilter(st); setPage(1) }}
                sx={{ px: 1.25, py: 0.5, fontSize: '0.75rem', fontWeight: 600, fontFamily: 'Jost', cursor: 'pointer', border: '1px solid', transition: 'all 0.15s', borderColor: streamFilter === st ? colorPalette.primary : '#e2e8f0', color: streamFilter === st ? colorPalette.primary : '#64748b', bgcolor: streamFilter === st ? `${colorPalette.primary}0a` : 'transparent', '&:hover': { borderColor: colorPalette.primary, color: colorPalette.primary } }}
              >
                {st ? STREAM_LABELS[st] ?? st : 'All'}
              </Box>
            ))}
          </Stack>
        </Box>

        {/* Filter row 2 — Search + date + risk */}
        <Box sx={{ bgcolor: 'var(--card-bg)', border: '1px solid var(--border-col)', borderTop: 'none', display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1 }}>
          <DateRangeFilter value={range} onChange={setRange} compact />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: 'var(--section-bg)', px: 1.5, height: 32, flex: 1, border: '1px solid transparent', transition: 'all 0.18s', '&:focus-within': { bgcolor: 'var(--card-bg)', borderColor: colorPalette.primary } }}>
            <SearchOutlinedIcon sx={{ fontSize: '1rem', color: '#94a3b8' }} />
            <InputBase
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by customer, device, IP, or session…"
              sx={{ flex: 1, fontSize: '0.8125rem', fontFamily: 'Jost', color: 'var(--heading-color)' }}
            />
          </Box>
          <Box sx={{ position: 'relative', display: 'inline-flex' }}>
            <IconButton ref={filterBtnRef} disableRipple onClick={openFilter} sx={{ borderRadius: 0, color: riskFilter !== 'any' ? colorPalette.primary : '#64748b', '&:hover': { color: colorPalette.primary } }}>
              <FilterListRoundedIcon sx={{ fontSize: '1.125rem' }} />
            </IconButton>
            {riskFilter !== 'any' && (
              <Box sx={{ position: 'absolute', top: 7, right: 7, width: 7, height: 7, bgcolor: colorPalette.primary, borderRadius: '50%', pointerEvents: 'none' }} />
            )}
          </Box>
        </Box>

        {/* Active risk filter chip */}
        {riskFilter !== 'any' && (
          <Box sx={{ bgcolor: 'var(--section-bg)', border: '1px solid var(--border-col)', borderTop: 'none', px: 2, py: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Risk filter:</Typography>
            <Chip
              label={RISK_OPTIONS.find(o => o.key === riskFilter)?.label}
              size="small"
              onDelete={() => { setRiskFilter('any'); setPage(1) }}
              deleteIcon={<CloseRoundedIcon />}
              sx={{ bgcolor: `${colorPalette.primary}0f`, color: colorPalette.primary, fontWeight: 600, fontSize: '0.6875rem', borderRadius: 0, height: 20, '& .MuiChip-label': { px: 1 }, '& .MuiChip-deleteIcon': { fontSize: '0.75rem', color: colorPalette.primary } }}
            />
          </Box>
        )}

        {/* Table */}
        <Box sx={{ bgcolor: 'var(--card-bg)', border: '1px solid var(--border-col)', overflowX: 'auto' }}>
          <Box sx={{ minWidth: 1100 }}>

            {/* Header */}
            <Box sx={{ display: 'grid', gridTemplateColumns: GRID, gap: 2, px: 2, py: 1.5, bgcolor: 'var(--card-bg)', borderBottom: '1px solid var(--border-col)', alignItems: 'center' }}>
              <Box />
              {['Ref ID', 'Customer', 'Event', 'Context', 'Assessment', 'Date / Time', ''].map(h => (
                <Typography key={h} sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  {h}
                </Typography>
              ))}
            </Box>

            {/* Loading skeleton */}
            {loading && Array.from({ length: 8 }).map((_, i) => (
              <Box key={i} sx={{ display: 'grid', gridTemplateColumns: GRID, gap: 2, px: 2, py: 2.25, borderBottom: '1px solid var(--border-col)', alignItems: 'center' }}>
                {Array.from({ length: 9 }).map((_, j) => (
                  <Box key={j} sx={{ height: 11, bgcolor: 'var(--section-bg)', animation: 'pulse 1.5s ease-in-out infinite', '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } } }} />
                ))}
              </Box>
            ))}

            {/* Empty state */}
            {!loading && rows.length === 0 && (
              <Box sx={{ p: 6, textAlign: 'center' }}>
                <Typography sx={{ fontSize: '0.875rem', color: '#94a3b8' }}>No interaction records found for the selected filters.</Typography>
              </Box>
            )}

            {/* Rows */}
            {!loading && rows.map(r => {
              const { customerId, customerName, event, context, score, timestamp } = parseBeam(r)
              const cfg = riskAssessment(score)

              return (
                <Box
                  key={r.id}
                  onClick={() => setDetailBeam(r)}
                  data-ai-analyzable="true"
                  data-ai-description={`${r.stream} beam ${r.id} from ${customerName}. Assessment: ${cfg.label}.`}
                  sx={{ display: 'grid', gridTemplateColumns: GRID, gap: 2, px: 2, py: 2, alignItems: 'center', borderBottom: '1px solid var(--border-col)', cursor: 'pointer', transition: 'background 0.15s', '&:hover': { bgcolor: 'var(--card-bg)' }, '&:last-child': { borderBottom: 'none' } }}
                >
                  {/* Left border accent on high-risk rows */}
                  <Box sx={{ width: 3, height: 32, bgcolor: cfg.score >= 70 ? '#dc2626' : cfg.score >= 40 ? '#d97706' : 'transparent', borderRadius: 0 }} />

                  {/* Ref ID */}
                  <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600, color: '#64748b', fontFamily: 'SF Mono, Monaco, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    #{r.id}
                  </Typography>

                  {/* Customer */}
                  <Box sx={{ overflow: 'hidden' }}>
                    <Typography
                      onClick={e => { e.stopPropagation(); navigate(`/dashboard/users/${encodeURIComponent(customerId)}`) }}
                      sx={{ fontSize: '0.8125rem', fontWeight: 600, color: colorPalette.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                    >
                      {customerName}
                    </Typography>
                    <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', fontFamily: 'SF Mono, Monaco, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', mt: 0.25 }}>
                      {customerId !== customerName ? customerId : ''}
                    </Typography>
                  </Box>

                  {/* Event — stream-specific description */}
                  <Box sx={{ overflow: 'hidden' }}>
                    <Typography sx={{ fontSize: '0.8125rem', color: 'var(--heading-color)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {event}
                    </Typography>
                  </Box>

                  {/* Context — device / channel / location / flags */}
                  <Box sx={{ overflow: 'hidden' }}>
                    <Typography sx={{ fontSize: '0.75rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {context}
                    </Typography>
                  </Box>

                  {/* Assessment — score + label */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ flex: 1, height: 3, bgcolor: 'var(--section-bg)', position: 'relative' }}>
                      <Box sx={{ position: 'absolute', inset: 0, right: `${100 - cfg.score}%`, bgcolor: cfg.color }} />
                    </Box>
                    <Chip
                      label={cfg.score > 0 ? `${cfg.label} · ${cfg.score}` : cfg.label}
                      size="small"
                      sx={{ bgcolor: cfg.bg, color: cfg.color, fontWeight: 700, fontSize: '0.5625rem', letterSpacing: '0.06em', borderRadius: 0, height: 18, '& .MuiChip-label': { px: 0.875 } }}
                    />
                  </Box>

                  {/* Date / Time */}
                  <Box sx={{ overflow: 'hidden' }}>
                    <Typography sx={{ fontSize: '0.75rem', color: 'var(--heading-color)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                      {new Intl.DateTimeFormat('en-NG', { day: '2-digit', month: 'short', year: 'numeric', timeZone: user?.timezone ?? 'Africa/Lagos' }).format(new Date(timestamp))}
                    </Typography>
                    <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', fontFamily: 'SF Mono, Monaco, monospace', whiteSpace: 'nowrap', mt: 0.125 }}>
                      {new Intl.DateTimeFormat('en-NG', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: user?.timezone ?? 'Africa/Lagos' }).format(new Date(timestamp))}
                    </Typography>
                  </Box>

                  {/* Detail */}
                  <IconButton size="small" disableRipple onClick={e => { e.stopPropagation(); setDetailBeam(r) }} sx={{ borderRadius: 0, color: '#94a3b8', '&:hover': { color: colorPalette.primary, bgcolor: `${colorPalette.primary}0a` } }}>
                    <MoreHorizRoundedIcon sx={{ fontSize: '1.125rem' }} />
                  </IconButton>
                </Box>
              )
            })}

            {/* Pagination */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, py: 1.5, borderTop: '1px solid var(--border-col)' }}>
              <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>
                {loading ? 'Loading…' : `Showing ${rows.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total.toLocaleString()} records`}
              </Typography>
              <Stack direction="row" gap={0.5}>
                <PageBtn label="Previous" disabled={page <= 1} active={false} onClick={() => setPage(p => p - 1)} />
                {pageNumbers(page, totalPages).map((p, i) =>
                  p === '…'
                    ? <Box key={`ellipsis-${i}`} sx={{ px: 1.25, py: 0.5, fontSize: '0.75rem', color: '#94a3b8', border: '1px solid #e5e7eb' }}>…</Box>
                    : <PageBtn key={p} label={String(p)} active={p === page} disabled={false} onClick={() => setPage(Number(p))} />
                )}
                <PageBtn label="Next" disabled={page >= totalPages} active={false} onClick={() => setPage(p => p + 1)} />
              </Stack>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Risk filter popover */}
      <Popover
        open={filterOpen}
        anchorEl={filterBtnRef.current}
        onClose={() => setFilterOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { borderRadius: 0, boxShadow: '0 8px 32px rgba(15,23,42,0.12)', border: '1px solid var(--border-col)', width: 240 } } }}
      >
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
            <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost' }}>Risk Level</Typography>
            <IconButton size="small" disableRipple onClick={() => setFilterOpen(false)} sx={{ borderRadius: 0, color: '#94a3b8', mr: -0.5 }}>
              <CloseRoundedIcon sx={{ fontSize: '1rem' }} />
            </IconButton>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 2 }}>
            {RISK_OPTIONS.map(o => {
              const on = draftRisk === o.key
              return (
                <Box key={o.key} onClick={() => setDraftRisk(o.key)} sx={{ px: 1.25, py: 0.625, fontSize: '0.8125rem', fontWeight: 500, fontFamily: 'Jost', cursor: 'pointer', border: '1px solid', borderColor: on ? colorPalette.primary : '#e2e8f0', color: on ? colorPalette.primary : '#475569', bgcolor: on ? `${colorPalette.primary}0a` : 'transparent', transition: 'all 0.15s', '&:hover': { borderColor: colorPalette.primary, color: colorPalette.primary } }}>
                  {o.label}
                </Box>
              )
            })}
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, pt: 1.5, borderTop: '1px solid var(--border-col)' }}>
            <Button disableRipple onClick={clearFilter} sx={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600, fontFamily: 'Jost', textTransform: 'none', borderRadius: 0, px: 1.5, minWidth: 0 }}>Clear</Button>
            <Button disableRipple onClick={applyFilter} sx={{ bgcolor: colorPalette.primary, color: '#fff', fontSize: '0.75rem', fontWeight: 600, fontFamily: 'Jost', textTransform: 'none', borderRadius: 0, px: 2, '&:hover': { bgcolor: colorPalette.primary } }}>Apply</Button>
          </Box>
        </Box>
      </Popover>

      {/* Detail drawer */}
      <InteractionDetailPanel beam={detailBeam} open={!!detailBeam} onClose={() => setDetailBeam(null)} />
    </Box>
  )
}

function PageBtn({ label, active, disabled, onClick }: { label: string; active: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <Box onClick={disabled ? undefined : onClick} sx={{ px: 1.25, py: 0.5, fontSize: '0.75rem', fontWeight: 600, borderRadius: 0, border: '1px solid', cursor: disabled ? 'not-allowed' : 'pointer', transition: 'all 0.15s', color: active ? '#fff' : disabled ? '#cbd5e1' : '#475569', bgcolor: active ? colorPalette.primary : 'transparent', borderColor: active ? colorPalette.primary : '#e5e7eb', '&:hover': disabled || active ? {} : { borderColor: colorPalette.primary, color: colorPalette.primary } }}>
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
