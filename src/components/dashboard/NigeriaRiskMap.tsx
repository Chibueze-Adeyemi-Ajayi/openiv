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

// Demo seed — green-dominant nationwide coverage, yellow in 5 commercial hubs, red only in 2 hotspots.
const DEMO_SEED: RiskPoint[] = [
  // ══ RED — Lagos Island / Victoria Island cluster (2 hotspots, ~6 dots) ════════
  { lat: 6.433, lng: 3.417, count: 312, avgRisk: 82, hasFlag: true  },
  { lat: 6.428, lng: 3.422, count: 241, avgRisk: 77, hasFlag: true  },
  { lat: 6.437, lng: 3.412, count: 188, avgRisk: 71, hasFlag: true  },
  { lat: 4.820, lng: 7.033, count: 294, avgRisk: 79, hasFlag: true  },  // Port Harcourt
  { lat: 4.814, lng: 7.026, count: 218, avgRisk: 68, hasFlag: true  },
  { lat: 4.828, lng: 7.041, count: 161, avgRisk: 74, hasFlag: true  },

  // ══ YELLOW — 5 commercial hubs (~3 dots each) ════════════════════════════════
  { lat: 12.004, lng: 8.522, count: 387, avgRisk: 42, hasFlag: false }, // Kano
  { lat: 12.010, lng: 8.531, count: 271, avgRisk: 38, hasFlag: false },
  { lat: 11.997, lng: 8.513, count: 198, avgRisk: 45, hasFlag: false },
  { lat: 9.057,  lng: 7.496, count: 341, avgRisk: 36, hasFlag: false }, // Abuja
  { lat: 9.063,  lng: 7.505, count: 253, avgRisk: 31, hasFlag: false },
  { lat: 9.044,  lng: 7.482, count: 189, avgRisk: 39, hasFlag: false },
  { lat: 10.526, lng: 7.443, count: 229, avgRisk: 33, hasFlag: false }, // Kaduna
  { lat: 10.533, lng: 7.452, count: 174, avgRisk: 28, hasFlag: false },
  { lat: 10.518, lng: 7.433, count: 141, avgRisk: 41, hasFlag: false },
  { lat: 6.338,  lng: 5.630, count: 214, avgRisk: 35, hasFlag: false }, // Benin City
  { lat: 6.345,  lng: 5.639, count: 163, avgRisk: 29, hasFlag: false },
  { lat: 6.328,  lng: 5.619, count: 128, avgRisk: 44, hasFlag: false },
  { lat: 6.138,  lng: 6.799, count: 247, avgRisk: 47, hasFlag: false }, // Onitsha
  { lat: 6.146,  lng: 6.808, count: 182, avgRisk: 43, hasFlag: false },
  { lat: 6.129,  lng: 6.789, count: 139, avgRisk: 51, hasFlag: false },

  // ══ GREEN — dense Lagos metro (not hotspot area) ══════════════════════════════
  { lat: 6.457, lng: 3.387, count: 521, avgRisk: 14, hasFlag: false },
  { lat: 6.463, lng: 3.394, count: 398, avgRisk: 11, hasFlag: false },
  { lat: 6.449, lng: 3.377, count: 312, avgRisk: 18, hasFlag: false },
  { lat: 6.608, lng: 3.351, count: 287, avgRisk: 16, hasFlag: false },
  { lat: 6.532, lng: 3.382, count: 244, avgRisk: 12, hasFlag: false },
  { lat: 6.493, lng: 3.366, count: 219, avgRisk: 9,  hasFlag: false },
  { lat: 6.470, lng: 3.594, count: 201, avgRisk: 19, hasFlag: false },
  { lat: 6.634, lng: 3.497, count: 178, avgRisk: 8,  hasFlag: false },
  { lat: 6.403, lng: 3.315, count: 152, avgRisk: 7,  hasFlag: false },
  { lat: 6.575, lng: 3.308, count: 133, avgRisk: 11, hasFlag: false },
  { lat: 6.518, lng: 3.421, count: 124, avgRisk: 14, hasFlag: false },

  // ══ GREEN — Southwest: Ogun, Oyo, Osun, Ondo, Ekiti ══════════════════════════
  { lat: 7.162, lng: 3.348, count: 288, avgRisk: 12, hasFlag: false },
  { lat: 7.154, lng: 3.356, count: 201, avgRisk: 9,  hasFlag: false },
  { lat: 7.392, lng: 3.903, count: 374, avgRisk: 14, hasFlag: false },
  { lat: 7.400, lng: 3.915, count: 263, avgRisk: 11, hasFlag: false },
  { lat: 7.380, lng: 3.892, count: 198, avgRisk: 17, hasFlag: false },
  { lat: 7.253, lng: 5.199, count: 211, avgRisk: 13, hasFlag: false },
  { lat: 7.631, lng: 5.224, count: 174, avgRisk: 10, hasFlag: false },
  { lat: 7.482, lng: 4.034, count: 163, avgRisk: 15, hasFlag: false },
  { lat: 7.065, lng: 4.848, count: 148, avgRisk: 8,  hasFlag: false },
  { lat: 6.856, lng: 4.845, count: 139, avgRisk: 7,  hasFlag: false },
  { lat: 7.773, lng: 4.575, count: 176, avgRisk: 22, hasFlag: false },
  { lat: 8.492, lng: 4.548, count: 194, avgRisk: 19, hasFlag: false },
  { lat: 7.294, lng: 3.731, count: 143, avgRisk: 11, hasFlag: false },
  { lat: 7.052, lng: 3.598, count: 128, avgRisk: 9,  hasFlag: false },

  // ══ GREEN — Southsouth: Delta, Edo, Bayelsa, Akwa Ibom, Cross River ════════════
  { lat: 5.516, lng: 5.749, count: 221, avgRisk: 18, hasFlag: false },
  { lat: 5.525, lng: 5.761, count: 167, avgRisk: 21, hasFlag: false },
  { lat: 5.896, lng: 5.686, count: 158, avgRisk: 12, hasFlag: false },
  { lat: 6.199, lng: 6.738, count: 212, avgRisk: 14, hasFlag: false },
  { lat: 4.923, lng: 6.268, count: 161, avgRisk: 17, hasFlag: false },
  { lat: 5.051, lng: 7.925, count: 183, avgRisk: 13, hasFlag: false },
  { lat: 5.043, lng: 7.916, count: 131, avgRisk: 9,  hasFlag: false },
  { lat: 4.960, lng: 8.334, count: 201, avgRisk: 12, hasFlag: false },
  { lat: 4.968, lng: 8.343, count: 148, avgRisk: 8,  hasFlag: false },
  { lat: 4.800, lng: 7.001, count: 144, avgRisk: 16, hasFlag: false },
  { lat: 5.312, lng: 6.741, count: 122, avgRisk: 11, hasFlag: false },
  { lat: 5.634, lng: 5.982, count: 118, avgRisk: 9,  hasFlag: false },
  { lat: 4.712, lng: 7.491, count: 109, avgRisk: 7,  hasFlag: false },

  // ══ GREEN — Southeast: Anambra, Imo, Enugu, Abia, Ebonyi ══════════════════════
  { lat: 6.015, lng: 6.921, count: 168, avgRisk: 12, hasFlag: false },
  { lat: 6.215, lng: 7.071, count: 181, avgRisk: 10, hasFlag: false },
  { lat: 6.463, lng: 7.551, count: 234, avgRisk: 18, hasFlag: false },
  { lat: 6.470, lng: 7.561, count: 158, avgRisk: 14, hasFlag: false },
  { lat: 5.494, lng: 7.030, count: 187, avgRisk: 16, hasFlag: false },
  { lat: 5.532, lng: 7.496, count: 139, avgRisk: 9,  hasFlag: false },
  { lat: 5.899, lng: 7.894, count: 131, avgRisk: 8,  hasFlag: false },
  { lat: 5.612, lng: 7.214, count: 118, avgRisk: 11, hasFlag: false },
  { lat: 6.303, lng: 7.812, count: 112, avgRisk: 7,  hasFlag: false },

  // ══ GREEN — Northcentral: FCT surrounds, Niger, Kwara, Kogi, Benue, Plateau ════
  { lat: 9.039, lng: 7.469, count: 172, avgRisk: 19, hasFlag: false },
  { lat: 8.984, lng: 7.405, count: 138, avgRisk: 12, hasFlag: false },
  { lat: 9.115, lng: 7.566, count: 144, avgRisk: 10, hasFlag: false },
  { lat: 9.616, lng: 6.556, count: 169, avgRisk: 14, hasFlag: false },
  { lat: 7.805, lng: 6.746, count: 156, avgRisk: 11, hasFlag: false },
  { lat: 7.735, lng: 8.540, count: 164, avgRisk: 13, hasFlag: false },
  { lat: 9.926, lng: 8.899, count: 218, avgRisk: 15, hasFlag: false },
  { lat: 9.933, lng: 8.907, count: 151, avgRisk: 9,  hasFlag: false },
  { lat: 8.538, lng: 7.728, count: 137, avgRisk: 11, hasFlag: false },
  { lat: 8.500, lng: 4.551, count: 188, avgRisk: 17, hasFlag: false },
  { lat: 8.162, lng: 5.195, count: 124, avgRisk: 8,  hasFlag: false },
  { lat: 7.516, lng: 6.116, count: 117, avgRisk: 7,  hasFlag: false },
  { lat: 8.726, lng: 9.234, count: 128, avgRisk: 9,  hasFlag: false },
  { lat: 8.315, lng: 8.137, count: 119, avgRisk: 8,  hasFlag: false },
  { lat: 7.183, lng: 8.315, count: 126, avgRisk: 7,  hasFlag: false },
  { lat: 7.802, lng: 4.893, count: 113, avgRisk: 6,  hasFlag: false },
  { lat: 9.414, lng: 6.105, count: 131, avgRisk: 10, hasFlag: false },

  // ══ GREEN — Northwest: Kano surrounds, Katsina, Zamfara, Kebbi, Sokoto, Jigawa ═
  { lat: 11.084, lng: 7.725, count: 143, avgRisk: 9,  hasFlag: false },
  { lat: 12.983, lng: 7.617, count: 148, avgRisk: 14, hasFlag: false },
  { lat: 12.172, lng: 6.665, count: 127, avgRisk: 10, hasFlag: false },
  { lat: 12.455, lng: 4.200, count: 138, avgRisk: 8,  hasFlag: false },
  { lat: 13.065, lng: 5.240, count: 132, avgRisk: 7,  hasFlag: false },
  { lat: 13.070, lng: 5.247, count: 98,  avgRisk: 6,  hasFlag: false },
  { lat: 11.775, lng: 9.350, count: 124, avgRisk: 8,  hasFlag: false },
  { lat: 10.835, lng: 6.144, count: 119, avgRisk: 7,  hasFlag: false },
  { lat: 12.684, lng: 7.096, count: 108, avgRisk: 5,  hasFlag: false },
  { lat: 11.356, lng: 10.416, count: 97, avgRisk: 6,  hasFlag: false },
  { lat: 13.429, lng: 8.924, count: 88,  avgRisk: 4,  hasFlag: false },
  { lat: 12.491, lng: 6.738, count: 103, avgRisk: 7,  hasFlag: false },
  { lat: 11.641, lng: 5.218, count: 96,  avgRisk: 5,  hasFlag: false },
  { lat: 13.220, lng: 6.691, count: 91,  avgRisk: 4,  hasFlag: false },

  // ══ GREEN — Northeast: Bauchi, Gombe, Borno, Yobe, Adamawa, Taraba ═══════════
  { lat: 10.313, lng: 9.847, count: 178, avgRisk: 12, hasFlag: false },
  { lat: 10.320, lng: 9.856, count: 121, avgRisk: 8,  hasFlag: false },
  { lat: 10.295, lng: 11.169, count: 156, avgRisk: 11, hasFlag: false },
  { lat: 11.833, lng: 13.155, count: 194, avgRisk: 18, hasFlag: false },
  { lat: 11.840, lng: 13.162, count: 142, avgRisk: 15, hasFlag: false },
  { lat: 11.750, lng: 13.108, count: 108, avgRisk: 9,  hasFlag: false },
  { lat: 12.296, lng: 12.007, count: 98,  avgRisk: 7,  hasFlag: false },
  { lat: 9.202, lng: 12.495, count: 162, avgRisk: 11, hasFlag: false },
  { lat: 8.885, lng: 11.365, count: 136, avgRisk: 9,  hasFlag: false },
  { lat: 7.878, lng: 10.004, count: 122, avgRisk: 7,  hasFlag: false },
  { lat: 9.887, lng: 12.216, count: 114, avgRisk: 8,  hasFlag: false },
  { lat: 8.595, lng: 10.484, count: 107, avgRisk: 6,  hasFlag: false },
  { lat: 10.614, lng: 11.832, count: 94,  avgRisk: 5,  hasFlag: false },

  // ══ GREEN — interior / rural fill ════════════════════════════════════════════
  { lat: 6.714, lng: 5.320, count: 101, avgRisk: 8,  hasFlag: false },
  { lat: 5.724, lng: 7.661, count: 94,  avgRisk: 7,  hasFlag: false },
  { lat: 6.094, lng: 6.314, count: 111, avgRisk: 9,  hasFlag: false },
  { lat: 10.146, lng: 5.784, count: 102, avgRisk: 7,  hasFlag: false },
  { lat: 5.295, lng: 6.586, count: 98,  avgRisk: 6,  hasFlag: false },
  { lat: 7.921, lng: 4.110, count: 116, avgRisk: 8,  hasFlag: false },
  { lat: 11.206, lng: 11.806, count: 87, avgRisk: 5,  hasFlag: false },
  { lat: 8.493, lng: 5.913, count: 108, avgRisk: 7,  hasFlag: false },
  { lat: 6.811, lng: 7.987, count: 97,  avgRisk: 8,  hasFlag: false },
  { lat: 9.271, lng: 8.041, count: 113, avgRisk: 9,  hasFlag: false },
  { lat: 7.614, lng: 9.218, count: 104, avgRisk: 7,  hasFlag: false },
  { lat: 10.981, lng: 8.863, count: 91,  avgRisk: 6,  hasFlag: false },
  { lat: 6.508, lng: 8.841, count: 99,  avgRisk: 7,  hasFlag: false },
  { lat: 5.812, lng: 8.491, count: 88,  avgRisk: 5,  hasFlag: false },
  { lat: 8.034, lng: 5.844, count: 107, avgRisk: 8,  hasFlag: false },
  { lat: 9.743, lng: 10.221, count: 93, avgRisk: 6,  hasFlag: false },
  { lat: 7.342, lng: 7.144, count: 118, avgRisk: 9,  hasFlag: false },
  { lat: 11.492, lng: 9.041, count: 86,  avgRisk: 5,  hasFlag: false },
  { lat: 13.614, lng: 8.112, count: 74,  avgRisk: 4,  hasFlag: false },
  { lat: 6.921, lng: 4.491, count: 129, avgRisk: 10, hasFlag: false },
  { lat: 10.512, lng: 9.184, count: 96,  avgRisk: 7,  hasFlag: false },
  { lat: 7.891, lng: 7.341, count: 103, avgRisk: 8,  hasFlag: false },
  { lat: 12.813, lng: 11.214, count: 82, avgRisk: 5,  hasFlag: false },
  { lat: 9.581, lng: 4.882, count: 118, avgRisk: 9,  hasFlag: false },
  { lat: 5.914, lng: 7.043, count: 107, avgRisk: 8,  hasFlag: false },
]

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
const DOT_RADIUS  = 1.6

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
      if (!res.ok) { setPoints(DEMO_SEED); return }
      const data = await res.json()
      const pts: RiskPoint[] = data.points ?? []
      setPoints(pts.length > 0 ? pts : DEMO_SEED)
    } catch { setPoints(DEMO_SEED) }
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
      sx={{ position: 'relative', bgcolor: 'var(--card-bg)', border: '1px solid var(--border-col)', overflow: 'hidden' }}
    >
      {/* Header */}
      <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid var(--border-col)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost' }}>
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
          <Box sx={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 10, display: 'flex', alignItems: 'center', gap: 1, bgcolor: 'rgba(255,255,255,0.9)', px: 1.5, py: 0.75, border: '1px solid var(--border-col)' }}>
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
                r={Math.min(DOT_RADIUS + Math.log1p(d.point.count) * 0.35, 4.5)}
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
                r={Math.min(DOT_RADIUS + Math.log1p(d.point.count) * 0.35, 4.5)}
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
              bgcolor: 'var(--card-bg)', border: '1px solid var(--border-col)',
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
                <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--heading-color)', lineHeight: 1, fontFamily: 'Jost' }}>
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
                <Typography sx={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', lineHeight: 1.55 }}>
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
          borderLeft: '1px solid var(--border-col)',
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
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--on-surface-variant)', lineHeight: 1.2 }}>
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
      <Box sx={{ px: 3, py: 1.75, borderTop: '1px solid var(--border-col)', display: 'flex', gap: 4, bgcolor: 'var(--card-bg)' }}>
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
            <Typography sx={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost' }}>
              {(count ?? 0).toLocaleString()}
            </Typography>
          </Box>
        ))}
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.25 }}>
            Total clusters
          </Typography>
          <Typography sx={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost' }}>
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
