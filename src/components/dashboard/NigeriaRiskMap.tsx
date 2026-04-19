import { Box, Typography, Stack, Chip, IconButton } from '@mui/material'
import { colorPalette } from '@/theme'
import { useMemo, useState } from 'react'
import nigeriaUrl from '@/assets/nigeria.svg'
import DateRangeFilter, { type DateRange } from './DateRangeFilter'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined'

type RiskLevel = 'high' | 'medium' | 'normal'

// nigeria.svg native viewport
const SVG_W = 744.24
const SVG_H = 599.93
const DOT_SPACING = 11
const DOT_RADIUS = 2.8

// Risk hotspot centers (in nigeria.svg coordinate space)
// Approximate locations of major Nigerian cities/risk zones
const riskHotspots: { x: number; y: number; level: RiskLevel; radius: number; name: string; insight: string; topAction: string }[] = [
  // Lagos / SW
  {
    x: 175, y: 480, level: 'high', radius: 32, name: 'Lagos Mainland',
    insight: 'ATO cluster: 12 mule accounts identified across 3 fintech wallets. Recommend STR filing for cluster #4827.',
    topAction: 'Freeze affected accounts · Open joint case',
  },
  {
    x: 215, y: 462, level: 'high', radius: 22, name: 'Ikorodu LGA',
    insight: '4 SIM-swap attempts detected after midnight. Same IP cluster across all events.',
    topAction: 'Hold transactions · Call customers',
  },
  // Sokoto / NW
  {
    x: 110, y: 130, level: 'high', radius: 36, name: 'Sokoto BDC corridor',
    insight: 'Cross-border BDC anomalies — pattern matches structuring (smurfing). 7 entities recommended for EDD.',
    topAction: 'Enhanced due diligence · Notify CBN',
  },
  {
    x: 200, y: 140, level: 'medium', radius: 30, name: 'Katsina border',
    insight: 'Velocity slightly above baseline for cross-border activity.',
    topAction: 'Add to weekly review queue',
  },
  // Onitsha / SE
  {
    x: 320, y: 470, level: 'high', radius: 26, name: 'Onitsha Bridgehead',
    insight: 'Mule corridor detected — funds layered through 7 accounts originating in this fence.',
    topAction: 'Open investigation · Freeze cluster',
  },
  // Port Harcourt / SS
  {
    x: 410, y: 510, level: 'high', radius: 24, name: 'Port Harcourt',
    insight: 'PoS-skimming reports elevated. 4 merchant accounts flagged for chargeback patterns.',
    topAction: 'Merchant review · Tighten PoS thresholds',
  },
  // Medium clusters
  {
    x: 280, y: 130, level: 'medium', radius: 36, name: 'Kano commercial',
    insight: 'Above-baseline transaction velocity in Kano commercial district.',
    topAction: 'Continue monitoring',
  },
  {
    x: 380, y: 290, level: 'medium', radius: 38, name: 'FCT Abuja',
    insight: 'Government salary cycles drove 14 false-positive flags. Consider raising payroll-window threshold.',
    topAction: 'Tune threshold to ₦750k for FCT',
  },
  {
    x: 500, y: 165, level: 'medium', radius: 32, name: 'Maiduguri humanitarian',
    insight: 'Humanitarian transfers under enhanced monitoring per CBN Circular 2024/14. All flows legitimate.',
    topAction: 'Maintain current monitoring',
  },
  {
    x: 250, y: 410, level: 'medium', radius: 28, name: 'Ibadan',
    insight: 'New device fingerprints clustering. Worth monitoring for ATO precursors.',
    topAction: 'Watch for 48h',
  },
  {
    x: 380, y: 440, level: 'medium', radius: 24, name: 'Benin axis',
    insight: 'Cross-channel velocity above 30-day average.',
    topAction: 'Routine review',
  },
  {
    x: 510, y: 400, level: 'medium', radius: 28, name: 'Calabar trade',
    insight: 'Trade-finance transactions showing unusual hour-of-day patterns.',
    topAction: 'Compliance team review',
  },
  {
    x: 590, y: 250, level: 'medium', radius: 26, name: 'Yola corridor',
    insight: 'Border-trade activity slightly above seasonal baseline.',
    topAction: 'Continue monitoring',
  },
  {
    x: 320, y: 340, level: 'medium', radius: 26, name: 'Plateau',
    insight: 'Mining-sector deposits showing elevated activity.',
    topAction: 'Sector-level review',
  },
]

const riskColors: Record<RiskLevel, { fill: string; bg: string; label: string }> = {
  high: { fill: '#ef4444', bg: '#fef2f2', label: 'High risk' },
  medium: { fill: '#fbbf24', bg: '#fffbeb', label: 'Medium risk' },
  normal: { fill: '#86efac', bg: '#f0fdf4', label: 'Normal' },
}

interface Dot {
  x: number
  y: number
  level: RiskLevel
  fenceId: string
  hotspot?: typeof riskHotspots[number]
}

interface FenceData {
  id: string
  level: RiskLevel
  hotspot?: typeof riskHotspots[number]
  signals: number
  insight: string
  topAction: string
}

function seeded(seed: number) {
  return ((Math.sin(seed) * 10000) % 1 + 1) % 1
}

interface NigeriaRiskMapProps {
  onFenceSelect?: (fence: FenceData) => void
}

export default function NigeriaRiskMap({ onFenceSelect }: NigeriaRiskMapProps) {
  const [hoveredFence, setHoveredFence] = useState<string | null>(null)
  const [selectedFence, setSelectedFence] = useState<FenceData | null>(null)
  const [range, setRange] = useState<DateRange>('custom')

  // Generate dots in a regular grid covering the whole map area.
  // The SVG mask will show only those falling on the country shape.
  const dots = useMemo(() => {
    const result: Dot[] = []
    for (let y = 0; y < SVG_H; y += DOT_SPACING) {
      for (let x = 0; x < SVG_W; x += DOT_SPACING) {
        // Risk inheritance from nearest hotspot
        let level: RiskLevel = 'normal'
        let owningHotspot: (typeof riskHotspots)[number] | undefined
        for (const h of riskHotspots) {
          const dx = x - h.x
          const dy = y - h.y
          const d = Math.sqrt(dx * dx + dy * dy)
          if (d < h.radius) {
            const intensity = 1 - d / h.radius
            const r = seeded(x * 13 + y * 7)
            if (r < intensity * 0.9) {
              level = h.level
              owningHotspot = h
              break
            }
          }
        }

        const fenceX = Math.floor(x / 22)
        const fenceY = Math.floor(y / 22)
        result.push({
          x,
          y,
          level,
          fenceId: `F-${fenceX}-${fenceY}`,
          hotspot: owningHotspot,
        })
      }
    }
    return result
  }, [])

  const handleDotClick = (dot: Dot) => {
    const insight = dot.hotspot?.insight || (dot.level === 'normal'
      ? 'Within normal behavioral baseline. No active alerts in this geofence.'
      : 'Activity slightly above baseline — worth monitoring.')
    const topAction = dot.hotspot?.topAction || (dot.level === 'normal' ? 'No action required' : 'Continue monitoring')
    const fence: FenceData = {
      id: dot.fenceId,
      level: dot.level,
      hotspot: dot.hotspot,
      signals: dot.level === 'high' ? 18 + Math.floor(seeded(dot.x) * 32) : dot.level === 'medium' ? 4 + Math.floor(seeded(dot.x) * 12) : Math.floor(seeded(dot.x) * 3),
      insight,
      topAction,
    }
    setSelectedFence(fence)
    onFenceSelect?.(fence)
  }

  const highCount = dots.filter((d) => d.level === 'high').length
  const mediumCount = dots.filter((d) => d.level === 'medium').length

  return (
    <Box sx={{ position: 'relative', bgcolor: '#ffffff', border: '1px solid #eef0f4', overflow: 'hidden' }}>
      {/* Header */}
      <Box
        sx={{
          px: 3,
          py: 2.25,
          borderBottom: '1px solid #eef0f4',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Box>
          <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
            Risk Map · Nigeria
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
            Each dot is a geofence · click for AI insight on that area
          </Typography>
        </Box>

        <Stack direction="row" gap={2} alignItems="center">
          <Stack direction="row" gap={1.5}>
            {(['high', 'medium', 'normal'] as RiskLevel[]).map((level) => (
              <Box key={level} sx={{ display: 'flex', alignItems: 'center', gap: 0.625 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: riskColors[level].fill }} />
                <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600, color: '#475569' }}>
                  {riskColors[level].label}
                </Typography>
              </Box>
            ))}
          </Stack>
          <DateRangeFilter value={range} onChange={setRange} compact options={['custom']} />
        </Stack>
      </Box>

      <Box sx={{ position: 'relative', p: 2, height: 540, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Box
          component="svg"
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          sx={{ width: '100%', height: '100%', display: 'block', maxHeight: 520 }}
        >
          <defs>
            {/* Use the nigeria.svg as an alpha mask. The black country areas
                are opaque (visible) in the mask, transparent areas are hidden.
                mask-type: alpha is required — the default (luminance) treats
                black as "dark" and would hide everything. */}
            <mask
              id="nigeriaMask"
              maskContentUnits="userSpaceOnUse"
              maskUnits="userSpaceOnUse"
              style={{ maskType: 'alpha' }}
            >
              <image
                href={nigeriaUrl}
                x="0"
                y="0"
                width={SVG_W}
                height={SVG_H}
                preserveAspectRatio="none"
              />
            </mask>
          </defs>

          {/* All dots clipped to the country shape via the mask */}
          <g mask="url(#nigeriaMask)">
            {dots.map((dot, i) => {
              const isInHoveredFence = hoveredFence === dot.fenceId
              const isInSelectedFence = selectedFence?.id === dot.fenceId
              const opacity = isInHoveredFence || isInSelectedFence
                ? 1
                : dot.level === 'high'
                ? 1
                : dot.level === 'medium'
                ? 0.9
                : 0.55 // normal — recedes into the background
              const r = isInHoveredFence || isInSelectedFence ? DOT_RADIUS + 0.6 : DOT_RADIUS

              return (
                <circle
                  key={i}
                  cx={dot.x}
                  cy={dot.y}
                  r={r}
                  fill={riskColors[dot.level].fill}
                  opacity={opacity}
                  onMouseEnter={() => setHoveredFence(dot.fenceId)}
                  onMouseLeave={() => setHoveredFence(null)}
                  onClick={() => handleDotClick(dot)}
                  style={{ cursor: 'pointer', transition: 'all 0.18s ease' }}
                />
              )
            })}
          </g>

          {/* Pulse rings on high-risk hotspots — also masked so they stay inside the country */}
          <g mask="url(#nigeriaMask)">
            {riskHotspots
              .filter((h) => h.level === 'high')
              .map((h, i) => (
                <circle
                  key={`pulse-${i}`}
                  cx={h.x}
                  cy={h.y}
                  r="14"
                  fill="none"
                  stroke="#dc2626"
                  strokeWidth="1.5"
                  opacity="0.5"
                  style={{ pointerEvents: 'none' }}
                >
                  <animate attributeName="r" values="10;28;10" dur="2.4s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.5;0;0.5" dur="2.4s" repeatCount="indefinite" />
                </circle>
              ))}
          </g>
        </Box>

        {/* Insight Popup */}
        {selectedFence && (
          <Box
            sx={{
              position: 'absolute',
              top: 16,
              right: 16,
              width: 320,
              bgcolor: '#ffffff',
              border: '1px solid #eef0f4',
              boxShadow: '0 14px 40px rgba(15,23,42,0.1)',
              p: 2.5,
              animation: 'slideInRight 0.25s ease',
              '@keyframes slideInRight': {
                from: { opacity: 0, transform: 'translateX(8px)' },
                to: { opacity: 1, transform: 'translateX(0)' },
              },
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.875, mb: 0.5 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: riskColors[selectedFence.level].fill }} />
                  <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                    Geofence
                  </Typography>
                </Box>
                <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
                  {selectedFence.hotspot?.name || `Fence ${selectedFence.id}`}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
                  <LocationOnOutlinedIcon sx={{ fontSize: '0.875rem', color: '#94a3b8' }} />
                  <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', fontFamily: 'SF Mono, Monaco, monospace' }}>
                    {selectedFence.id}
                  </Typography>
                </Box>
              </Box>
              <IconButton
                size="small"
                onClick={() => setSelectedFence(null)}
                disableRipple
                sx={{
                  color: '#94a3b8',
                  borderRadius: 0,
                  p: 0.25,
                  '&:hover': { color: colorPalette.primary, bgcolor: 'transparent' },
                }}
              >
                <CloseRoundedIcon sx={{ fontSize: '1rem' }} />
              </IconButton>
            </Box>

            <Stack direction="row" gap={1.5} sx={{ mb: 2 }}>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.5 }}>
                  Active Signals
                </Typography>
                <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', lineHeight: 1, fontFamily: 'Jost' }}>
                  {selectedFence.signals}
                </Typography>
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.5 }}>
                  Risk Level
                </Typography>
                <Chip
                  label={riskColors[selectedFence.level].label.toUpperCase()}
                  size="small"
                  sx={{
                    bgcolor: riskColors[selectedFence.level].bg,
                    color: riskColors[selectedFence.level].fill,
                    fontWeight: 700,
                    fontSize: '0.6875rem',
                    letterSpacing: '0.06em',
                    borderRadius: 0,
                    height: 24,
                  }}
                />
              </Box>
            </Stack>

            <Box
              sx={{
                bgcolor: `${colorPalette.primary}06`,
                border: `1px solid ${colorPalette.primary}15`,
                p: 1.5,
                display: 'flex',
                gap: 1,
                mb: 1.5,
              }}
            >
              <AutoAwesomeOutlinedIcon
                sx={{ fontSize: '0.9375rem', color: colorPalette.primary, mt: 0.125, flexShrink: 0 }}
              />
              <Typography sx={{ fontSize: '0.75rem', color: '#334155', lineHeight: 1.55 }}>
                {selectedFence.insight}
              </Typography>
            </Box>

            <Box>
              <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.5 }}>
                Suggested Action
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: '#475569', lineHeight: 1.5, fontWeight: 500 }}>
                {selectedFence.topAction}
              </Typography>
            </Box>
          </Box>
        )}
      </Box>

      {/* Summary footer */}
      <Box sx={{ px: 3, py: 1.75, borderTop: '1px solid #eef0f4', display: 'flex', gap: 4, bgcolor: '#fafbfc' }}>
        {[
          { level: 'high' as RiskLevel, count: highCount },
          { level: 'medium' as RiskLevel, count: mediumCount },
          { level: 'normal' as RiskLevel, count: dots.length - highCount - mediumCount },
        ].map(({ level, count }) => (
          <Box key={level} sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.625, mb: 0.25 }}>
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: riskColors[level].fill }} />
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {riskColors[level].label} fences
              </Typography>
            </Box>
            <Typography sx={{ fontSize: '1.125rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
              {count}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  )
}
