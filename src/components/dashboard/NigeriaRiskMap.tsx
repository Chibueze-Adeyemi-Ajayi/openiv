import { Box, Typography, Stack, Chip, IconButton, CircularProgress, Button } from '@mui/material'
import { colorPalette } from '@/theme'
import { useMemo, useState, useEffect, useCallback } from 'react'
import nigeriaUrl from '@/assets/nigeria.svg'
import DateRangeFilter, { type DateRange } from './DateRangeFilter'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined'
import TableRowsOutlinedIcon from '@mui/icons-material/TableRowsOutlined'
import type { RiskPoint } from '@/api/dashboard'
import ClusterTransactionsDrawer, { type ClusterDrawerSource } from './ClusterTransactionsDrawer'

type RiskLevel = 'high' | 'medium' | 'low' | 'none'

// nigeria.svg native viewport
const SVG_W = 744.24
const SVG_H = 599.93

// Nigeria geographic bounding box
const LAT_MIN = 4.1
const LAT_MAX = 13.87
const LNG_MIN = 2.67
const LNG_MAX = 14.68

// Background dot grid
const DOT_SPACING = 11
const DOT_RADIUS  = 2.8

const riskColors: Record<RiskLevel, { fill: string; bg: string; label: string }> = {
  high: { fill: '#ef4444', bg: '#fef2f2',  label: 'High risk' },
  medium: { fill: '#fbbf24', bg: '#fffbeb', label: 'Medium risk' },
  low:  { fill: '#86efac', bg: '#f0fdf4',  label: 'Normal' },
  none: { fill: '#cbd5e1', bg: '#f8fafc',  label: 'No activity' },
}

function geoToSvg(lat: number, lng: number) {
  return {
    x: ((lng - LNG_MIN) / (LNG_MAX - LNG_MIN)) * SVG_W,
    y: (1 - (lat - LAT_MIN) / (LAT_MAX - LAT_MIN)) * SVG_H,
  }
}

function classifyRisk(p: RiskPoint): RiskLevel {
  if ((p.avgRisk ?? 0) >= 60) return 'high'
  if ((p.avgRisk ?? 0) >= 25) return 'medium'
  return 'low'
}

function rangeToIso(range: DateRange, customDates?: { from: string; to: string } | null) {
  const now = new Date()
  const to  = now.toISOString()
  if (range === 'custom' && customDates) {
    return { from: customDates.from + 'T00:00:00Z', to: customDates.to + 'T23:59:59Z' }
  }
  const offsets: Partial<Record<DateRange, number>> = {
    '24h': 1,
    '7d': 7,
    '30d': 30,
    '90d': 90,
  }
  if (range === 'ytd') {
    return { from: `${now.getFullYear()}-01-01T00:00:00Z`, to }
  }
  const days = offsets[range] ?? 1
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString()
  return { from, to }
}

interface FenceInfo {
  svgX: number
  svgY: number
  level: RiskLevel
  point: RiskPoint
}

interface NigeriaRiskMapProps {
  onFenceSelect?: (info: FenceInfo) => void
}

export default function NigeriaRiskMap({ onFenceSelect }: NigeriaRiskMapProps) {
  const [range, setRange]               = useState<DateRange>('24h')
  const [customDates, setCustomDates]   = useState<{ from: string; to: string } | null>(null)
  const [points, setPoints]             = useState<RiskPoint[]>([])
  const [loading, setLoading]           = useState(false)
  const [selected, setSelected]         = useState<FenceInfo | null>(null)
  const [hovered, setHovered]           = useState<string | null>(null)
  const [drawerSource, setDrawerSource] = useState<ClusterDrawerSource | null>(null)

  const fetchPoints = useCallback(async () => {
    setLoading(true)
    try {
      const { from, to } = rangeToIso(range, customDates)
      const res = await fetch(
        `/api/v1/dashboard/risk-map?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
        { credentials: 'include' }
      )
      if (!res.ok) return
      const data = await res.json()
      setPoints(data.points ?? [])
    } catch {}
    finally { setLoading(false) }
  }, [range, customDates])

  useEffect(() => {
    fetchPoints()
    if (range === '24h') {
      const id = setInterval(fetchPoints, 30_000)
      return () => clearInterval(id)
    }
  }, [fetchPoints, range])

  // Background grey dot grid (all Nigeria, masked by SVG)
  const gridDots = useMemo(() => {
    const dots: { x: number; y: number }[] = []
    for (let y = 0; y < SVG_H; y += DOT_SPACING) {
      for (let x = 0; x < SVG_W; x += DOT_SPACING) {
        dots.push({ x, y })
      }
    }
    return dots
  }, [])

  // Real transaction points mapped to SVG coordinates
  const txnDots = useMemo<FenceInfo[]>(() => {
    return points
      .filter(p => p.lat >= LAT_MIN && p.lat <= LAT_MAX && p.lng >= LNG_MIN && p.lng <= LNG_MAX)
      .map(p => {
        const { x, y } = geoToSvg(p.lat, p.lng)
        return { svgX: x, svgY: y, level: classifyRisk(p), point: p }
      })
  }, [points])

  const highDots   = txnDots.filter(d => d.level === 'high')
  const mediumDots = txnDots.filter(d => d.level === 'medium')
  const lowDots    = txnDots.filter(d => d.level === 'low')

  const [mousePos, setMousePos] = useState<{ x: number, y: number } | null>(null)

  const handleDotClick = (info: FenceInfo, e: React.MouseEvent) => {
    setSelected(info)
    const svg = (e.currentTarget as any).ownerSVGElement as SVGSVGElement
    if (svg) {
      const rect = svg.getBoundingClientRect()
      // Capture position relative to SVG container
      setMousePos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      })
    }
    onFenceSelect?.(info)
  }

  const handleViewTransactions = () => {
    if (!selected) return
    setDrawerSource({
      type: 'cluster',
      lat: selected.point.lat,
      lng: selected.point.lng,
      range: range,
      count: selected.point.count,
      avgRisk: selected.point.avgRisk ?? null,
      hasFlag: selected.point.hasFlag
    })
  }

  const dotKey = (d: FenceInfo) => `${d.point.lat},${d.point.lng}`

  return (
    <Box
      data-ai-analyzable="true"
      data-ai-description={`Geographic risk distribution across Nigeria. Currently monitoring ${highDots.length} high-risk clusters and ${mediumDots.length} suspicious areas.`}
      sx={{ position: 'relative', bgcolor: '#ffffff', border: '1px solid #eef0f4', overflow: 'hidden' }}
    >
      {/* Header */}
      <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid #eef0f4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost' }}>
            Risk Map · Nigeria
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
            Transactions by geolocation · {range === '24h' ? 'live, refreshes every 30 s' : 'click a dot for details'}
          </Typography>
        </Box>

        <DateRangeFilter
            value={range}
            onChange={setRange}
            compact
            options={['24h', '7d', '30d', '90d', 'custom']}
            customDates={customDates}
            onCustomDatesChange={setCustomDates}
          />
      </Box>

      <Box sx={{ display: 'flex', height: 540 }}>
        {/* SVG area */}
        <Box sx={{ flex: 1, position: 'relative', p: 2, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        {loading && (
          <Box sx={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 10, display: 'flex', alignItems: 'center', gap: 1, bgcolor: 'rgba(255,255,255,0.9)', px: 1.5, py: 0.75, border: '1px solid #eef0f4' }}>
            <CircularProgress size={12} thickness={5} sx={{ color: colorPalette.primary }} />
            <Typography sx={{ fontSize: '0.6875rem', color: '#64748b', fontWeight: 600 }}>Updating…</Typography>
          </Box>
        )}

        <Box
          component="svg"
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          sx={{ width: '100%', height: '100%', display: 'block', maxHeight: 520 }}
        >
          <defs>
            <mask id="nigeriaMask" maskContentUnits="userSpaceOnUse" maskUnits="userSpaceOnUse" style={{ maskType: 'alpha' }}>
              <image href={nigeriaUrl} x="0" y="0" width={SVG_W} height={SVG_H} preserveAspectRatio="none" />
            </mask>
          </defs>

          {/* Grey background dot grid — masked to country shape */}
          <g mask="url(#nigeriaMask)">
            {gridDots.map((d, i) => (
              <circle key={i} cx={d.x} cy={d.y} r={DOT_RADIUS} fill="#cbd5e1" opacity={0.45} />
            ))}
          </g>

          {/* Real transaction dots — low/normal (green) */}
          <g mask="url(#nigeriaMask)">
            {lowDots.map((d) => (
              <circle
                key={dotKey(d)}
                cx={d.svgX} cy={d.svgY}
                r={Math.min(DOT_RADIUS + Math.log1p(d.point.count) * 0.8, 8)}
                fill={riskColors.low.fill}
                opacity={hovered === dotKey(d) ? 1 : 0.8}
                onMouseEnter={() => setHovered(dotKey(d))}
                onMouseLeave={() => setHovered(null)}
                onClick={(e) => handleDotClick(d, e)}
                style={{ cursor: 'pointer' }}
              />
            ))}
          </g>

          {/* Medium risk dots */}
          <g mask="url(#nigeriaMask)">
            {mediumDots.map((d) => (
              <circle
                key={dotKey(d)}
                cx={d.svgX} cy={d.svgY}
                r={Math.min(DOT_RADIUS + Math.log1p(d.point.count) * 0.8, 8)}
                fill={riskColors.medium.fill}
                opacity={hovered === dotKey(d) ? 1 : 0.9}
                onMouseEnter={() => setHovered(dotKey(d))}
                onMouseLeave={() => setHovered(null)}
                onClick={(e) => handleDotClick(d, e)}
                style={{ cursor: 'pointer' }}
              />
            ))}
          </g>

          {/* High risk dots (rendered last = on top) */}
          <g mask="url(#nigeriaMask)">
            {highDots.map((d) => (
              <circle
                key={dotKey(d)}
                cx={d.svgX} cy={d.svgY}
                r={Math.min(DOT_RADIUS + Math.log1p(d.point.count) * 0.8, 10)}
                fill={riskColors.high.fill}
                opacity={1}
                onMouseEnter={() => setHovered(dotKey(d))}
                onMouseLeave={() => setHovered(null)}
                onClick={(e) => handleDotClick(d, e)}
                style={{ cursor: 'pointer' }}
              />
            ))}
          </g>

          {/* Pulse rings on high-risk real dots */}
          <g mask="url(#nigeriaMask)">
            {highDots.map((d) => (
              <circle
                key={`pulse-${dotKey(d)}`}
                cx={d.svgX} cy={d.svgY}
                r="14" fill="none" stroke="#dc2626" strokeWidth="1.5" opacity="0.5"
                style={{ pointerEvents: 'none' }}
              >
                <animate attributeName="r" values="10;28;10" dur="2.4s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.5;0;0.5" dur="2.4s" repeatCount="indefinite" />
              </circle>
            ))}
          </g>
        </Box>

        {/* Detail popup */}
        {selected && mousePos && (
          <Box
            data-ai-analyzable="true"
            data-ai-description={`Detailed analysis of risk cluster at coordinates ${selected.point.lat.toFixed(2)}°N, ${selected.point.lng.toFixed(2)}°E. Cluster includes ${selected.point.count} transactions with an average risk score of ${selected.point.avgRisk?.toFixed(1) || '0'}.`}
            sx={{
              position: 'absolute', 
              top: mousePos.y > 300 ? mousePos.y - 280 : mousePos.y + 12, 
              left: mousePos.x > 500 ? mousePos.x - 270 : mousePos.x + 12,
              width: 260,
              bgcolor: '#ffffff', border: '1px solid #eef0f4',
              boxShadow: '0 20px 50px rgba(15,23,42,0.15)', p: 2.5,
              zIndex: 20,
              animation: 'popIn 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
              '@keyframes popIn': { from: { opacity: 0, transform: 'scale(0.95)' }, to: { opacity: 1, transform: 'scale(1)' } },
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.875, mb: 0.5 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: riskColors[selected.level].fill }} />
                  <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                    Transaction cluster
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <LocationOnOutlinedIcon sx={{ fontSize: '0.875rem', color: '#94a3b8' }} />
                  <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8', fontFamily: 'SF Mono, Monaco, monospace' }}>
                    {selected.point.lat.toFixed(2)}°N, {selected.point.lng.toFixed(2)}°E
                  </Typography>
                </Box>
              </Box>
              <IconButton size="small" onClick={() => setSelected(null)} disableRipple
                sx={{ color: '#94a3b8', borderRadius: 0, p: 0.25, '&:hover': { color: colorPalette.primary, bgcolor: 'transparent' } }}>
                <CloseRoundedIcon sx={{ fontSize: '1rem' }} />
              </IconButton>
            </Box>

            <Stack direction="row" gap={1.5} sx={{ mb: 2 }}>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.5 }}>
                  Transactions
                </Typography>
                <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: '#00288e', lineHeight: 1, fontFamily: 'Jost' }}>
                  {selected.point.count.toLocaleString()}
                </Typography>
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.5 }}>
                  Risk level
                </Typography>
                <Chip
                  label={riskColors[selected.level].label.toUpperCase()}
                  size="small"
                  sx={{ bgcolor: riskColors[selected.level].bg, color: riskColors[selected.level].fill, fontWeight: 700, fontSize: '0.6875rem', letterSpacing: '0.06em', borderRadius: 0, height: 24 }}
                />
              </Box>
            </Stack>

            {selected.point.avgRisk != null && (
              <Box sx={{ bgcolor: `${colorPalette.primary}06`, border: `1px solid ${colorPalette.primary}15`, p: 1.5, display: 'flex', gap: 1, mb: 1.5 }}>
                <AutoAwesomeOutlinedIcon sx={{ fontSize: '0.9375rem', color: colorPalette.primary, mt: 0.125, flexShrink: 0 }} />
                <Typography sx={{ fontSize: '0.75rem', color: '#334155', lineHeight: 1.55 }}>
                  Average risk score: <strong>{selected.point.avgRisk.toFixed(1)}</strong>
                  {selected.point.hasFlag ? ' · Contains flagged transactions.' : ' · No flagged transactions.'}
                </Typography>
              </Box>
            )}

            <Button
              fullWidth
              variant="contained"
              size="small"
              onClick={handleViewTransactions}
              startIcon={<TableRowsOutlinedIcon sx={{ fontSize: '0.875rem !important' }} />}
              sx={{
                bgcolor: colorPalette.primary, color: '#fff',
                borderRadius: 0, textTransform: 'none',
                fontFamily: 'Jost', fontSize: '0.75rem', fontWeight: 700,
                boxShadow: 'none', py: 1,
                '&:hover': { bgcolor: colorPalette.primary, opacity: 0.9, boxShadow: 'none' },
              }}
            >
              View Transactions
            </Button>
          </Box>
        )}
        </Box>{/* /SVG area */}

        {/* Legend panel */}
        <Box sx={{
          width: 156,
          flexShrink: 0,
          borderLeft: '1px solid #eef0f4',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          px: 2.5,
          py: 3,
        }}>
          <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 2.5 }}>
            Legend
          </Typography>

          {([
            { level: 'high'   as RiskLevel, desc: 'Score ≥ 60 or flagged' },
            { level: 'medium' as RiskLevel, desc: 'Score 25 – 59'         },
            { level: 'low'    as RiskLevel, desc: 'Score below 25'        },
            { level: 'none'   as RiskLevel, desc: 'No transactions'       },
          ]).map(({ level, desc }) => (
            <Box key={level} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25, mb: 2.25, '&:last-child': { mb: 0 } }}>
              <Box sx={{
                width: 11, height: 11,
                borderRadius: '50%',
                bgcolor: riskColors[level].fill,
                flexShrink: 0,
                mt: 0.25,
                boxShadow: level === 'high' ? `0 0 0 3px ${riskColors.high.fill}22` : 'none',
              }} />
              <Box>
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#334155', lineHeight: 1.2 }}>
                  {riskColors[level].label}
                </Typography>
                <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', mt: 0.25, lineHeight: 1.4 }}>
                  {desc}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>{/* /map flex row */}

      {/* Summary footer */}
      <Box sx={{ px: 3, py: 1.75, borderTop: '1px solid #eef0f4', display: 'flex', gap: 4, bgcolor: '#fafbfc' }}>
        {[
          { level: 'high' as RiskLevel,   count: highDots.length },
          { level: 'medium' as RiskLevel, count: mediumDots.length },
          { level: 'low' as RiskLevel,    count: lowDots.length },
          { level: 'none' as RiskLevel,   count: points.length === 0 ? 0 : undefined },
        ].filter(x => x.count !== undefined).map(({ level, count }) => (
          <Box key={level} sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.625, mb: 0.25 }}>
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: riskColors[level].fill }} />
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {riskColors[level].label}
              </Typography>
            </Box>
            <Typography sx={{ fontSize: '1.125rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost' }}>
              {(count ?? 0).toLocaleString()}
            </Typography>
          </Box>
        ))}
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.25 }}>
            Total clusters
          </Typography>
          <Typography sx={{ fontSize: '1.125rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost' }}>
            {txnDots.length.toLocaleString()}
          </Typography>
        </Box>
      </Box>

      {/* Drill-down drawer */}
      <ClusterTransactionsDrawer 
        source={drawerSource} 
        onClose={() => setDrawerSource(null)} 
      />
    </Box>
  )
}
