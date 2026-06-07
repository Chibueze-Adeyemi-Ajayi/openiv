import React, { useRef } from 'react'
import { Box, Typography } from '@mui/material'

const C = {
  normal: '#10b981',
  flagged: '#f59e0b',
  case: '#dc2626',
}

const THUMB = 34
const TRACK = 12
const MIN_GAP = 1

interface RiskSeekbarProps {
  values: [number, number]
  onChange: (v: [number, number]) => void
  disabled?: boolean
  zoneLabels?: [string, string, string]
}

export default function RiskSeekbar({
  values,
  onChange,
  disabled = false,
  zoneLabels = ['Normal', 'Flagged', 'Case'],
}: RiskSeekbarProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const active = useRef<0 | 1 | null>(null)

  const v0 = Number.isFinite(values[0]) ? values[0] : 45
  const v1 = Number.isFinite(values[1]) ? values[1] : 85

  const toPct = (clientX: number): number => {
    if (!trackRef.current) return 0
    const { left, width } = trackRef.current.getBoundingClientRect()
    if (width === 0) return 0
    return Math.max(0, Math.min(100, Math.round(((clientX - left) / width) * 100)))
  }

  const onPtrDown = (i: 0 | 1) => (e: React.PointerEvent) => {
    if (disabled) return
    e.stopPropagation()
    active.current = i
    // Capture on the TRACK so onPointerMove on the track fires during drag
    trackRef.current?.setPointerCapture(e.pointerId)
  }

  const onPtrMove = (e: React.PointerEvent) => {
    if (active.current === null) return
    const p = toPct(e.clientX)
    const next: [number, number] = [v0, v1]
    if (active.current === 0) next[0] = Math.min(p, v1 - MIN_GAP)
    else next[1] = Math.max(p, v0 + MIN_GAP)
    onChange(next)
  }

  const onPtrUp = () => { active.current = null }

  const zones = [
    { label: zoneLabels[0], color: C.normal, flex: v0 },
    { label: zoneLabels[1], color: C.flagged, flex: Math.max(0, v1 - v0) },
    { label: zoneLabels[2], color: C.case, flex: Math.max(0, 100 - v1) },
  ]

  const floatingLabels = [
    { label: zoneLabels[0], color: C.normal, center: v0 / 2 },
    { label: zoneLabels[1], color: C.flagged, center: v0 + (v1 - v0) / 2 },
    { label: zoneLabels[2], color: C.case, center: v1 + (100 - v1) / 2 },
  ]

  const handles: { val: number; color: string; i: 0 | 1; sub: string }[] = [
    { val: v0, color: C.normal, i: 0, sub: 'Flag boundary' },
    { val: v1, color: C.case, i: 1, sub: 'Case boundary' },
  ]

  return (
    <Box sx={{ userSelect: 'none', py: 1 }}>
      {/* Zone labels — float centered above each zone */}
      <Box sx={{ position: 'relative', height: 26, mb: 2 }}>
        {floatingLabels.map(({ label, color, center }) => (
          <Box
            key={label}
            sx={{
              position: 'absolute',
              left: `${center}%`,
              transform: 'translateX(-50%)',
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              pointerEvents: 'none',
            }}
          >
            <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
            <Typography sx={{
              fontSize: '0.6875rem',
              fontWeight: 800,
              color,
              fontFamily: 'Jost',
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              whiteSpace: 'nowrap',
            }}>
              {label}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Track + handles — pointer events live here */}
      <Box
        ref={trackRef}
        onPointerMove={onPtrMove}
        onPointerUp={onPtrUp}
        onPointerCancel={onPtrUp}
        sx={{
          position: 'relative',
          height: THUMB + 8,
          cursor: disabled ? 'default' : 'pointer',
        }}
      >
        {/* Colored track segments */}
        <Box sx={{
          position: 'absolute',
          top: '50%',
          left: 0,
          right: 0,
          height: TRACK,
          transform: 'translateY(-50%)',
          borderRadius: TRACK / 2,
          overflow: 'hidden',
          display: 'flex',
          boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.12)',
        }}>
          {zones.map(({ label, flex, color }) => (
            <Box
              key={label}
              sx={{
                flex,
                bgcolor: color,
                opacity: disabled ? 0.4 : 1,
                minWidth: 0,
              }}
            />
          ))}
        </Box>

        {/* White divider lines at handle positions */}
        {[v0, v1].map((pos, idx) => (
          <Box
            key={idx}
            sx={{
              position: 'absolute',
              top: '50%',
              left: `${pos}%`,
              transform: 'translate(-50%, -50%)',
              width: 2,
              height: TRACK + 6,
              bgcolor: 'rgba(255,255,255,0.85)',
              zIndex: 1,
              pointerEvents: 'none',
            }}
          />
        ))}

        {/* Handles */}
        {handles.map(({ val, color, i }) => {
          const glow = `${color}22`
          const glowActive = `${color}16`
          return (
            <Box
              key={i}
              onPointerDown={onPtrDown(i)}
              sx={{
                position: 'absolute',
                top: '50%',
                left: `calc(${val}% - ${THUMB / 2}px)`,
                transform: 'translateY(-50%)',
                width: THUMB,
                height: THUMB,
                borderRadius: '50%',
                bgcolor: 'var(--card-bg)',
                border: `2.5px solid ${color}`,
                cursor: disabled ? 'default' : 'grab',
                boxShadow: '0 2px 6px rgba(0,0,0,0.1), 0 1px 3px rgba(0,0,0,0.08)',
                zIndex: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                touchAction: 'none',
                '&:hover': !disabled ? {
                  boxShadow: `0 0 0 10px ${glow}, 0 2px 8px rgba(0,0,0,0.14)`,
                } : {},
                '&:active': !disabled ? {
                  cursor: 'grabbing',
                  boxShadow: `0 0 0 16px ${glowActive}, 0 2px 10px rgba(0,0,0,0.16)`,
                } : {},
              }}
            >
              <Typography sx={{
                fontSize: val >= 100 ? '0.5rem' : '0.5625rem',
                fontWeight: 900,
                color,
                lineHeight: 1,
                fontFamily: 'SF Mono, Monaco, Consolas, monospace',
                letterSpacing: '-0.02em',
                pointerEvents: 'none',
              }}>
                {val}
              </Typography>
            </Box>
          )
        })}
      </Box>

      {/* Handle sub-labels */}
      <Box sx={{ position: 'relative', mt: 0.5, height: 28 }}>
        {handles.map(({ val, color, sub }) => {
          const clamped = Math.max(6, Math.min(94, val))
          return (
            <Box
              key={sub}
              sx={{
                position: 'absolute',
                left: `${clamped}%`,
                transform: 'translateX(-50%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 0.25,
                pointerEvents: 'none',
              }}
            >
              <Box sx={{ width: 1.5, height: 6, bgcolor: `${color}50` }} />
              <Typography sx={{
                fontSize: '0.625rem',
                fontWeight: 700,
                color: `${color}bb`,
                fontFamily: 'Jost',
                whiteSpace: 'nowrap',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                {sub}
              </Typography>
            </Box>
          )
        })}
      </Box>

      {/* Scale */}
      <Box sx={{ position: 'relative', mt: 0.75, height: 18 }}>
        {[0, 25, 50, 75, 100].map(m => (
          <Box
            key={m}
            sx={{
              position: 'absolute',
              left: `${m}%`,
              transform: 'translateX(-50%)',
              textAlign: 'center',
            }}
          >
            <Box sx={{ width: 1, height: 3, bgcolor: '#e2e8f0', mx: 'auto', mb: 0.25 }} />
            <Typography sx={{
              fontSize: '0.6875rem',
              color: '#b0bec5',
              fontWeight: 600,
              fontFamily: 'Jost',
            }}>
              {m}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  )
}
