import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Box, Typography, Stack, Button, Skeleton,
  Select, MenuItem, FormControl, Collapse,
} from '@mui/material'
// import { colorPalette } from '@/theme'
import { colorPalette } from '@/theme'
import { beamApi, type BeamRecord } from '@/api/beam'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import ExpandLessRoundedIcon from '@mui/icons-material/ExpandLessRounded'
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import { useNavigate } from 'react-router-dom'

// ── Helpers ───────────────────────────────────────────────────────────────────

function prettyJson(raw: string): string {
  try { return JSON.stringify(JSON.parse(raw), null, 2) } catch { return raw }
}

function fmtRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const STREAM_LABELS: Record<string, string> = {
  transactions: 'Transactions',
  logins: 'User Logins',
  activity: 'In-app Activity',
  location: 'User Location',
  devices: 'Device Fingerprints',
  otps: 'OTP Events',
}

const STREAM_COLORS: Record<string, { bg: string; color: string }> = {
  transactions: { bg: '#eff6ff', color: '#2563eb' },
  logins: { bg: '#f0fdf4', color: '#16a34a' },
  activity: { bg: '#fdf4ff', color: '#9333ea' },
  location: { bg: '#fff7ed', color: '#ea580c' },
  devices: { bg: '#f8fafc', color: 'var(--on-surface-variant)' },
  otps: { bg: '#fef2f2', color: '#dc2626' },
}

// ── Copy button ───────────────────────────────────────────────────────────────

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }
  return (
    <Button
      size="small"
      startIcon={copied
        ? <CheckRoundedIcon sx={{ fontSize: '0.75rem !important', color: '#10b981' }} />
        : <ContentCopyOutlinedIcon sx={{ fontSize: '0.75rem !important' }} />}
      onClick={copy}
      sx={{
        fontSize: '0.6875rem', fontFamily: 'Jost', fontWeight: 600,
        color: copied ? '#10b981' : '#64748b', textTransform: 'none',
        px: 1, py: 0.375, borderRadius: 0,
        '&:hover': { bgcolor: 'var(--section-bg)' },
        '& .MuiButton-startIcon': { mr: 0.375 },
      }}
    >
      {copied ? 'Copied' : 'Copy'}
    </Button>
  )
}

// ── Stream badge ──────────────────────────────────────────────────────────────

function StreamBadge({ stream }: { stream: string }) {
  const cfg = STREAM_COLORS[stream] ?? { bg: '#f8fafc', color: 'var(--on-surface-variant)' }
  return (
    <Box sx={{ display: 'inline-flex', px: 1, py: 0.375, bgcolor: cfg.bg }}>
      <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.1em', color: cfg.color }}>
        {(STREAM_LABELS[stream] ?? stream).toUpperCase()}
      </Typography>
    </Box>
  )
}

// ── Record row ────────────────────────────────────────────────────────────────

function RecordRow({ record }: { record: BeamRecord }) {
  const [expanded, setExpanded] = useState(false)
  const pretty = useMemo(() => prettyJson(record.payload), [record.payload])

  let preview = ''
  try {
    const obj = JSON.parse(record.payload)
    const keys = Object.keys(obj).slice(0, 3)
    preview = keys.map(k => `"${k}": ${JSON.stringify(obj[k])}`).join(', ')
    if (Object.keys(obj).length > 3) preview += ', …'
  } catch {
    preview = record.payload.slice(0, 80)
  }

  return (
    <Box sx={{ borderBottom: '1px solid var(--border-col)', '&:last-child': { borderBottom: 'none' } }}>
      <Box
        onClick={() => setExpanded(p => !p)}
        sx={{
          px: 3, py: 1.5,
          display: 'grid',
          gridTemplateColumns: '120px 1fr 80px 80px 32px',
          gap: 1.5, alignItems: 'center',
          cursor: 'pointer',
          '&:hover': { bgcolor: 'var(--section-bg)' },
          transition: 'background 0.15s',
        }}
      >
        <StreamBadge stream={record.stream} />
        <Typography sx={{ fontSize: '0.75rem', fontFamily: 'SF Mono, Monaco, monospace', color: 'var(--on-surface-variant)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {'{ ' + preview + ' }'}
        </Typography>
        <Box sx={{ display: 'inline-flex', px: 1, py: 0.375, bgcolor: '#f0fdf4' }}>
          <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.1em', color: '#10b981' }}>
            RECEIVED
          </Typography>
        </Box>
        <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>
          {fmtRelative(record.receivedAt)}
        </Typography>
        <Box sx={{ color: '#94a3b8', display: 'flex', alignItems: 'center' }}>
          {expanded
            ? <ExpandLessRoundedIcon sx={{ fontSize: '1rem' }} />
            : <ExpandMoreRoundedIcon sx={{ fontSize: '1rem' }} />}
        </Box>
      </Box>

      <Collapse in={expanded}>
        <Box sx={{ bgcolor: 'var(--section-bg)', borderTop: '1px solid var(--border-col)', p: 2.5 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2 }}>
            {[
              ['Record ID', String(record.id)],
              ['Stream', record.stream],
              ['Status', record.status],
              ['Idempotency key', record.idempotencyKey ?? '—'],
              ['Received at', new Date(record.receivedAt).toLocaleString()],
            ].map(([label, value]) => (
              <Box key={label}>
                <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600, color: '#94a3b8', letterSpacing: '0.08em', mb: 0.25 }}>
                  {label}
                </Typography>
                <Typography sx={{ fontSize: '0.8125rem', fontFamily: 'SF Mono, Monaco, monospace', color: 'var(--heading-color)' }}>
                  {value}
                </Typography>
              </Box>
            ))}
          </Box>

          <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--on-surface-variant)', letterSpacing: '0.1em', mb: 0.75 }}>
            PAYLOAD
          </Typography>
          <Box sx={{ position: 'relative' }}>
            <Box sx={{ bgcolor: '#0d1117', color: '#e2e8f0', p: 2, fontFamily: 'SF Mono, Monaco, monospace', fontSize: '0.6875rem', lineHeight: 1.7, whiteSpace: 'pre', overflowX: 'auto', maxHeight: 280, overflowY: 'auto' }}>
              {pretty}
            </Box>
            <Box sx={{ position: 'absolute', top: 6, right: 6 }}>
              <CopyBtn text={pretty} />
            </Box>
          </Box>
        </Box>
      </Collapse>
    </Box>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Box sx={{ bgcolor: 'var(--card-bg)', border: '1px solid var(--border-col)', p: 2, flex: 1, minWidth: 0 }}>
      <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.1em', mb: 0.5 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: color ?? '#00288e', fontFamily: 'Jost', letterSpacing: '-0.02em' }}>
        {value}
      </Typography>
    </Box>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function InboundBeamLogPage() {
  const navigate = useNavigate()

  const [records, setRecords] = useState<BeamRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStream, setFilterStream] = useState<string>('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const stream = filterStream !== 'all' ? filterStream : undefined
      const res = await beamApi.listRecords({ stream })
      setRecords(res.records)
    } finally { setLoading(false) }
  }, [filterStream])

  useEffect(() => { load() }, [load])

  // Stats
  const stats = useMemo(() => {
    const total = records.length
    const byStream: Record<string, number> = {}
    records.forEach(r => { byStream[r.stream] = (byStream[r.stream] ?? 0) + 1 })
    const topStream = Object.entries(byStream).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'
    const last = records[0]?.receivedAt ?? null
    return { total, topStream, last }
  }, [records])

  const filtered = useMemo(() =>
    filterStream === 'all' ? records : records.filter(r => r.stream === filterStream),
    [records, filterStream])

  const streams = Object.keys(STREAM_LABELS)

  const selectSx = {
    height: 36, fontSize: '0.8125rem', fontFamily: 'Jost',
    borderRadius: 0, bgcolor: 'var(--card-bg)',
    '& .MuiOutlinedInput-notchedOutline': { border: '1px solid var(--border-col)' },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#cbd5e1' },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: colorPalette.primary, borderWidth: '1px' },
  }

  return (
    <Box sx={{ p: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Button
          startIcon={<ArrowBackRoundedIcon sx={{ fontSize: '0.875rem !important' }} />}
          onClick={() => navigate('/dashboard/beam')}
          sx={{ fontSize: '0.75rem', fontFamily: 'Jost', fontWeight: 600, color: '#64748b', textTransform: 'none', px: 0, mb: 1.5, '&:hover': { bgcolor: 'transparent', color: colorPalette.primary } }}
        >
          Back to Beam to OpenIV
        </Button>
        <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: colorPalette.primary, letterSpacing: '0.14em', textTransform: 'uppercase', mb: 0.75 }}>
          Developer Console
        </Typography>
        <Typography sx={{ fontSize: '1.625rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost', letterSpacing: '-0.015em', mb: 0.5 }}>
          Inbound Beam Log
        </Typography>
        <Typography sx={{ fontSize: '0.9375rem', color: '#64748b' }}>
          Every payload received by OpenIV from your core — inspect, debug, and verify schema compliance
        </Typography>
      </Box>

      {/* Stats */}
      <Stack direction="row" gap={2} sx={{ mb: 3, flexWrap: 'wrap' }}>
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Box key={i} sx={{ flex: 1, minWidth: 120, bgcolor: 'var(--card-bg)', border: '1px solid var(--border-col)', p: 2 }}>
              <Skeleton height={16} width="60%" />
              <Skeleton height={36} width="40%" sx={{ mt: 0.5 }} />
            </Box>
          ))
        ) : (
          <>
            <StatCard label="RECORDS LOADED" value={String(stats.total)} />
            <StatCard label="TOP STREAM" value={STREAM_LABELS[stats.topStream] ?? stats.topStream} />
            <StatCard label="LAST RECEIVED" value={stats.last ? fmtRelative(stats.last) : '—'} />
          </>
        )}
      </Stack>

      {/* Filter toolbar */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <Select
            value={filterStream}
            onChange={e => setFilterStream(e.target.value)}
            sx={selectSx}
            displayEmpty
          >
            <MenuItem value="all" sx={{ fontSize: '0.8125rem', fontFamily: 'Jost' }}>All streams</MenuItem>
            {streams.map(s => (
              <MenuItem key={s} value={s} sx={{ fontSize: '0.8125rem', fontFamily: 'Jost' }}>
                {STREAM_LABELS[s]}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Box sx={{ flex: 1 }} />
        <Button
          startIcon={<RefreshRoundedIcon sx={{ fontSize: '1rem !important' }} />}
          onClick={load}
          disabled={loading}
          sx={{ borderRadius: 0, textTransform: 'none', fontFamily: 'Jost', fontWeight: 600, fontSize: '0.8125rem', color: 'var(--on-surface-variant)', border: '1px solid var(--border-col)', bgcolor: 'var(--card-bg)', px: 2, py: 0.875, '&:hover': { bgcolor: 'var(--section-bg)' } }}
        >
          Refresh
        </Button>
      </Box>

      {/* Record table */}
      <Box sx={{ bgcolor: 'var(--card-bg)', border: '1px solid var(--border-col)' }}>
        {/* Column headers */}
        <Box sx={{ px: 3, py: 1.25, display: 'grid', gridTemplateColumns: '120px 1fr 80px 80px 32px', gap: 1.5, borderBottom: '1px solid var(--border-col)', bgcolor: 'var(--section-bg)' }}>
          {['STREAM', 'PAYLOAD PREVIEW', 'STATUS', 'TIME', ''].map((h, i) => (
            <Typography key={i} sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.1em' }}>{h}</Typography>
          ))}
        </Box>

        {loading ? (
          <Stack>
            {Array.from({ length: 8 }).map((_, i) => (
              <Box key={i} sx={{ px: 3, py: 1.875, borderBottom: '1px solid var(--border-col)', display: 'flex', gap: 2 }}>
                <Skeleton variant="rectangular" width={90} height={18} />
                <Skeleton variant="rectangular" width="60%" height={18} />
                <Skeleton variant="rectangular" width={60} height={18} />
              </Box>
            ))}
          </Stack>
        ) : filtered.length === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography sx={{ fontSize: '0.875rem', color: '#94a3b8' }}>
              {records.length === 0
                ? 'No inbound beams yet — instrument your core and start sending data'
                : 'No records match the selected stream filter'}
            </Typography>
          </Box>
        ) : (
          filtered.map(r => <RecordRow key={r.id} record={r} />)
        )}
      </Box>

      {/* Schema reminder */}
      <Box sx={{ mt: 3, p: 2.5, bgcolor: `${colorPalette.primary}08`, border: `1px solid ${colorPalette.primary}20` }}>
        <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: colorPalette.primary, fontFamily: 'Jost', mb: 0.375 }}>
          Schema validation
        </Typography>
        <Typography sx={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)' }}>
          Payloads that pass schema validation are stored with <Box component="span" sx={{ fontFamily: 'SF Mono, Monaco, monospace', fontSize: '0.7rem', color: '#10b981' }}>status: received</Box>. Rejected payloads (missing required fields, unknown stream) get a{' '}
          <Box component="span" sx={{ fontFamily: 'SF Mono, Monaco, monospace', fontSize: '0.7rem', color: '#dc2626' }}>400</Box>{' '}
          HTTP response and are not stored. Use{' '}
          <Box component="span" sx={{ fontFamily: 'SF Mono, Monaco, monospace', fontSize: '0.7rem', color: colorPalette.primary }}>X-Idempotency-Key</Box>{' '}
          on every request to safely retry without creating duplicate records.
        </Typography>
      </Box>
    </Box>
  )
}
