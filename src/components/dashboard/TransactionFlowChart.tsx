import { Box, Typography, Stack, Skeleton } from '@mui/material'
import { colorPalette } from '@/theme'
import { useState, useEffect, useCallback } from 'react'

interface Bucket { hour: number; total: number; flagged: number; blocked: number }
interface HourlyLabel { h: string; total: number; flagged: number; blocked: number }

const W = 700
const H = 220
const PAD_L = 36
const PAD_R = 16
const PAD_T = 16
const PAD_B = 28

export default function TransactionFlowChart({ title = '24h Transaction Flow' }: { title?: string }) {
  const [data, setData]     = useState<HourlyLabel[]>([])
  const [loading, setLoading] = useState(true)
  const [hover, setHover]   = useState<number | null>(null)

  const fetch24h = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/dashboard/flow', { credentials: 'include' })
      if (!res.ok) return
      const body = await res.json()
      const buckets: Bucket[] = body.buckets ?? []
      setData(buckets.map(b => ({
        h: String(b.hour).padStart(2, '0'),
        total:   b.total,
        flagged: b.flagged,
        blocked: b.blocked,
      })))
    } catch {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    fetch24h()
    const id = setInterval(fetch24h, 5 * 60_000) // refresh every 5 min
    return () => clearInterval(id)
  }, [fetch24h])

  if (loading) {
    return (
      <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4' }}>
        <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid #eef0f4' }}>
          <Skeleton width={200} height={24} />
          <Skeleton width={280} height={16} sx={{ mt: 0.5 }} />
        </Box>
        <Box sx={{ p: 2 }}>
          <Skeleton variant="rectangular" width="100%" height={220} />
        </Box>
      </Box>
    )
  }

  if (!data.length) return null

  const maxTotal = Math.max(...data.map(d => d.total), 1)
  const innerW   = W - PAD_L - PAD_R
  const innerH   = H - PAD_T - PAD_B
  const xScale   = (i: number) => PAD_L + (i / (data.length - 1)) * innerW
  const yScale   = (v: number) => PAD_T + innerH - (v / maxTotal) * innerH

  const totalArea = `M ${xScale(0)} ${yScale(0)} ${data.map((d, i) => `L ${xScale(i)} ${yScale(d.total)}`).join(' ')} L ${xScale(data.length - 1)} ${yScale(0)} Z`
  const totalLine = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(d.total)}`).join(' ')

  // Flagged bars scaled so they're visible relative to total volume
  const flaggedScale = (n: number) => yScale(n * (maxTotal / Math.max(...data.map(d => d.flagged), 1)) * 0.3)
  const blockedScale = (n: number) => yScale(n * (maxTotal / Math.max(...data.map(d => d.blocked), 1)) * 0.15)

  return (
    <Box
      data-ai-analyzable="true"
      data-ai-description="Hourly transaction volume chart over the last 24 hours, visualizing total system throughput alongside flagged and blocked suspicious activity."
      sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4' }}
    >
      <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid #eef0f4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
            {title}
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
            Hourly volume across all monitored channels · last 24 h
          </Typography>
        </Box>
        <Stack direction="row" gap={2.5}>
          {[
            { label: 'Total',   color: colorPalette.primary },
            { label: 'Flagged', color: '#f59e0b' },
            { label: 'Blocked', color: '#dc2626' },
          ].map(s => (
            <Box key={s.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Box sx={{ width: 10, height: 2, bgcolor: s.color, borderRadius: '2px' }} />
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600, color: '#475569' }}>{s.label}</Typography>
            </Box>
          ))}
        </Stack>
      </Box>

      <Box sx={{ p: 2 }}>
        <Box component="svg" viewBox={`0 0 ${W} ${H}`} sx={{ width: '100%', height: 'auto', display: 'block' }} onMouseLeave={() => setHover(null)}>
          <defs>
            <linearGradient id="totalGrad" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={colorPalette.primary} stopOpacity="0.15" />
              <stop offset="100%" stopColor={colorPalette.primary} stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Y gridlines + labels */}
          {[0, 0.25, 0.5, 0.75, 1].map(p => (
            <g key={p}>
              <line x1={PAD_L} x2={W - PAD_R} y1={PAD_T + innerH * (1 - p)} y2={PAD_T + innerH * (1 - p)} stroke="#eef0f4" strokeWidth="1" strokeDasharray={p === 0 ? '' : '2 3'} />
              <text x={PAD_L - 8} y={PAD_T + innerH * (1 - p) + 3} textAnchor="end" style={{ fontSize: '9px', fill: '#94a3b8', fontWeight: 600 }}>
                {Math.round(maxTotal * p / 1000)}k
              </text>
            </g>
          ))}

          {/* X axis labels every 4 hours */}
          {data.filter((_, i) => i % 4 === 0).map((d, idx) => {
            const i = idx * 4
            return (
              <text key={d.h} x={xScale(i)} y={H - 8} textAnchor="middle" style={{ fontSize: '9px', fill: '#94a3b8', fontWeight: 600 }}>
                {d.h}:00
              </text>
            )
          })}

          {/* Area + line */}
          <path d={totalArea} fill="url(#totalGrad)" />
          <path d={totalLine} fill="none" stroke={colorPalette.primary} strokeWidth="2" strokeLinejoin="round" />

          {/* Flagged bars */}
          {data.map((d, i) => d.flagged > 0 && (
            <rect key={`f-${i}`} x={xScale(i) - 1.5} y={flaggedScale(d.flagged)} width="3"
              height={Math.max(0, innerH - (flaggedScale(d.flagged) - PAD_T))} fill="#f59e0b" opacity="0.55" />
          ))}

          {/* Blocked dots */}
          {data.map((d, i) => d.blocked > 0 && (
            <circle key={`b-${i}`} cx={xScale(i)} cy={blockedScale(d.blocked)} r="2.5" fill="#dc2626" />
          ))}

          {/* Hover hit areas */}
          {data.map((_, i) => (
            <rect key={`h-${i}`} x={xScale(i) - innerW / data.length / 2} y={PAD_T} width={innerW / data.length} height={innerH} fill="transparent" onMouseEnter={() => setHover(i)} style={{ cursor: 'crosshair' }} />
          ))}

          {/* Hover indicator */}
          {hover !== null && (
            <g style={{ pointerEvents: 'none' }}>
              <line x1={xScale(hover)} x2={xScale(hover)} y1={PAD_T} y2={PAD_T + innerH} stroke={colorPalette.primary} strokeWidth="1" strokeDasharray="2 2" opacity="0.5" />
              <circle cx={xScale(hover)} cy={yScale(data[hover].total)} r="4" fill={colorPalette.primary} />
              <circle cx={xScale(hover)} cy={yScale(data[hover].total)} r="7" fill={colorPalette.primary} opacity="0.15" />
            </g>
          )}
        </Box>

        {hover !== null && (
          <Box sx={{ mt: 1, px: 1.5, py: 1.25, bgcolor: '#f8fafc', display: 'flex', gap: 3, alignItems: 'center' }}>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#0f172a' }}>
              {data[hover].h}:00
            </Typography>
            {[
              { label: 'Total',   value: data[hover].total.toLocaleString(),   color: '#0f172a' },
              { label: 'Flagged', value: data[hover].flagged.toLocaleString(), color: '#f59e0b' },
              { label: 'Blocked', value: data[hover].blocked.toLocaleString(), color: '#dc2626' },
            ].map(col => (
              <Box key={col.label}>
                <Typography sx={{ fontSize: '0.625rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{col.label}</Typography>
                <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: col.color }}>{col.value}</Typography>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  )
}
