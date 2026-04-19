import { Box, Typography, Stack } from '@mui/material'
import { colorPalette } from '@/theme'
import { useState } from 'react'

interface TransactionFlowChartProps {
  title?: string
}

// 24h hourly data: total flow, flagged, blocked
const data = [
  { h: '00', total: 1240, flagged: 18, blocked: 4 },
  { h: '01', total: 980, flagged: 12, blocked: 2 },
  { h: '02', total: 720, flagged: 9, blocked: 3 },
  { h: '03', total: 510, flagged: 14, blocked: 6 },
  { h: '04', total: 480, flagged: 22, blocked: 11 },
  { h: '05', total: 690, flagged: 16, blocked: 5 },
  { h: '06', total: 1480, flagged: 28, blocked: 7 },
  { h: '07', total: 2240, flagged: 31, blocked: 8 },
  { h: '08', total: 3680, flagged: 42, blocked: 9 },
  { h: '09', total: 4920, flagged: 55, blocked: 12 },
  { h: '10', total: 5840, flagged: 61, blocked: 14 },
  { h: '11', total: 6320, flagged: 68, blocked: 17 },
  { h: '12', total: 7180, flagged: 74, blocked: 19 },
  { h: '13', total: 7420, flagged: 71, blocked: 16 },
  { h: '14', total: 6890, flagged: 65, blocked: 13 },
  { h: '15', total: 6240, flagged: 58, blocked: 12 },
  { h: '16', total: 5680, flagged: 52, blocked: 11 },
  { h: '17', total: 4920, flagged: 49, blocked: 14 },
  { h: '18', total: 3840, flagged: 41, blocked: 10 },
  { h: '19', total: 3120, flagged: 36, blocked: 9 },
  { h: '20', total: 2680, flagged: 33, blocked: 8 },
  { h: '21', total: 2240, flagged: 28, blocked: 7 },
  { h: '22', total: 1840, flagged: 22, blocked: 5 },
  { h: '23', total: 1480, flagged: 19, blocked: 4 },
]

const W = 700
const H = 220
const PAD_L = 36
const PAD_R = 16
const PAD_T = 16
const PAD_B = 28

export default function TransactionFlowChart({ title = '24h Transaction Flow' }: TransactionFlowChartProps) {
  const [hover, setHover] = useState<number | null>(null)

  const maxTotal = Math.max(...data.map((d) => d.total))
  const innerW = W - PAD_L - PAD_R
  const innerH = H - PAD_T - PAD_B

  const xScale = (i: number) => PAD_L + (i / (data.length - 1)) * innerW
  const yScale = (v: number) => PAD_T + innerH - (v / maxTotal) * innerH

  const totalArea = `M ${xScale(0)} ${yScale(0)} ${data
    .map((d, i) => `L ${xScale(i)} ${yScale(d.total)}`)
    .join(' ')} L ${xScale(data.length - 1)} ${yScale(0)} Z`

  const totalLine = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(d.total)}`).join(' ')

  return (
    <Box
      sx={{
        bgcolor: '#ffffff',
        border: '1px solid #eef0f4',
      }}
    >
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
            {title}
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
            Hourly volume across all monitored channels
          </Typography>
        </Box>

        <Stack direction="row" gap={2.5}>
          {[
            { label: 'Total', color: colorPalette.primary },
            { label: 'Flagged', color: '#f59e0b' },
            { label: 'Blocked', color: '#dc2626' },
          ].map((s) => (
            <Box key={s.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Box sx={{ width: 10, height: 2, bgcolor: s.color, borderRadius: '2px' }} />
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600, color: '#475569' }}>
                {s.label}
              </Typography>
            </Box>
          ))}
        </Stack>
      </Box>

      <Box sx={{ p: 2 }}>
        <Box
          component="svg"
          viewBox={`0 0 ${W} ${H}`}
          sx={{ width: '100%', height: 'auto', display: 'block' }}
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id="totalGrad" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={colorPalette.primary} stopOpacity="0.15" />
              <stop offset="100%" stopColor={colorPalette.primary} stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Y gridlines */}
          {[0, 0.25, 0.5, 0.75, 1].map((p) => (
            <g key={p}>
              <line
                x1={PAD_L}
                x2={W - PAD_R}
                y1={PAD_T + innerH * (1 - p)}
                y2={PAD_T + innerH * (1 - p)}
                stroke="#eef0f4"
                strokeWidth="1"
                strokeDasharray={p === 0 ? '' : '2 3'}
              />
              <text
                x={PAD_L - 8}
                y={PAD_T + innerH * (1 - p) + 3}
                textAnchor="end"
                style={{ fontSize: '9px', fill: '#94a3b8', fontWeight: 600 }}
              >
                {Math.round(maxTotal * p / 1000)}k
              </text>
            </g>
          ))}

          {/* X labels */}
          {data
            .filter((_, i) => i % 4 === 0)
            .map((d, idx) => {
              const i = idx * 4
              return (
                <text
                  key={d.h}
                  x={xScale(i)}
                  y={H - 8}
                  textAnchor="middle"
                  style={{ fontSize: '9px', fill: '#94a3b8', fontWeight: 600 }}
                >
                  {d.h}:00
                </text>
              )
            })}

          {/* Area fill */}
          <path d={totalArea} fill="url(#totalGrad)" />

          {/* Total line */}
          <path d={totalLine} fill="none" stroke={colorPalette.primary} strokeWidth="2" strokeLinejoin="round" />

          {/* Flagged bars */}
          {data.map((d, i) => (
            <rect
              key={`f-${i}`}
              x={xScale(i) - 1.5}
              y={yScale(d.flagged * 80)}
              width="3"
              height={innerH - (yScale(d.flagged * 80) - PAD_T)}
              fill="#f59e0b"
              opacity="0.5"
            />
          ))}

          {/* Blocked dots */}
          {data.map((d, i) => (
            <circle key={`b-${i}`} cx={xScale(i)} cy={yScale(d.blocked * 200)} r="2" fill="#dc2626" />
          ))}

          {/* Hover layer */}
          {data.map((d, i) => (
            <rect
              key={`hover-${i}`}
              x={xScale(i) - innerW / data.length / 2}
              y={PAD_T}
              width={innerW / data.length}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              style={{ cursor: 'crosshair' }}
            />
          ))}

          {/* Hover indicator */}
          {hover !== null && (
            <g style={{ pointerEvents: 'none' }}>
              <line
                x1={xScale(hover)}
                x2={xScale(hover)}
                y1={PAD_T}
                y2={PAD_T + innerH}
                stroke={colorPalette.primary}
                strokeWidth="1"
                strokeDasharray="2 2"
                opacity="0.5"
              />
              <circle cx={xScale(hover)} cy={yScale(data[hover].total)} r="4" fill={colorPalette.primary} />
              <circle cx={xScale(hover)} cy={yScale(data[hover].total)} r="6" fill={colorPalette.primary} opacity="0.2" />
            </g>
          )}
        </Box>

        {hover !== null && (
          <Box
            sx={{
              mt: 1,
              px: 1.5,
              py: 1.25,
              bgcolor: '#f8fafc',
              display: 'flex',
              gap: 3,
              alignItems: 'center',
            }}
          >
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#0f172a' }}>
              {data[hover].h}:00
            </Typography>
            <Box>
              <Typography sx={{ fontSize: '0.625rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Total</Typography>
              <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a' }}>
                {data[hover].total.toLocaleString()}
              </Typography>
            </Box>
            <Box>
              <Typography sx={{ fontSize: '0.625rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Flagged</Typography>
              <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#f59e0b' }}>
                {data[hover].flagged}
              </Typography>
            </Box>
            <Box>
              <Typography sx={{ fontSize: '0.625rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Blocked</Typography>
              <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#dc2626' }}>
                {data[hover].blocked}
              </Typography>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  )
}
