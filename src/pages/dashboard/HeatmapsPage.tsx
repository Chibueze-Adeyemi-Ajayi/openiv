import { Box, Typography, Stack, Chip } from '@mui/material'
import { colorPalette } from '@/theme'
import DashboardLayout from '@/components/dashboard/DashboardLayout'
import DateRangeFilter, { type DateRange } from '@/components/dashboard/DateRangeFilter'
import { useState } from 'react'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'

const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const hours = Array.from({ length: 24 }, (_, i) => i)

// Seeded heatmap data — looks realistic
function gen(seed: number) {
  const grid: number[][] = []
  for (let d = 0; d < 7; d++) {
    grid[d] = []
    for (let h = 0; h < 24; h++) {
      // Business hours pattern
      const businessFactor = h >= 9 && h <= 17 ? 1 : h >= 6 && h <= 22 ? 0.6 : 0.15
      const weekdayFactor = d > 0 && d < 6 ? 1 : 0.5
      const noise = Math.sin(seed * (d + 1) * (h + 1) * 0.7) * 0.3 + 0.5
      grid[d][h] = Math.max(0, Math.min(1, businessFactor * weekdayFactor * noise * 1.5))
    }
  }
  return grid
}

const txnHeatmap = gen(7.2)
const userHeatmap = gen(3.7)

const colorScale = (v: number, mode: 'tx' | 'user') => {
  if (v < 0.05) return '#f4f5f7'
  const base = mode === 'tx' ? '30, 64, 175' : '220, 38, 38'
  const opacity = Math.max(0.08, Math.min(1, v))
  return `rgba(${base}, ${opacity})`
}

interface CellTooltip {
  day: number
  hour: number
  value: number
}

export default function HeatmapsPage() {
  const [activeTab, setActiveTab] = useState<'tx' | 'user'>('tx')
  const [hovered, setHovered] = useState<CellTooltip | null>(null)
  const [range, setRange] = useState<DateRange>('7d')

  const data = activeTab === 'tx' ? txnHeatmap : userHeatmap

  const rangeLabel: Record<DateRange, string> = {
    '24h': 'Last 24 hours',
    '7d': 'Last 7 days',
    '30d': 'Last 30 days',
    '90d': 'Last 90 days',
    ytd: 'Year to date',
    custom: 'Custom range',
  }

  return (
    <DashboardLayout>
      <Box sx={{ p: 4 }}>
        <Box sx={{ mb: 4 }}>
          <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: colorPalette.primary, letterSpacing: '0.14em', textTransform: 'uppercase', mb: 0.75 }}>
            Behavioral Analytics
          </Typography>
          <Typography sx={{ fontSize: '1.625rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost', letterSpacing: '-0.015em', mb: 0.5 }}>
            Heatmaps
          </Typography>
          <Typography sx={{ fontSize: '0.9375rem', color: '#64748b' }}>
            Visualize when transactions and users are most active — and when something looks off
          </Typography>
        </Box>

        {/* Tab switcher */}
        <Box sx={{ display: 'flex', gap: 0.5, mb: 3 }}>
          {[
            { id: 'tx' as const, label: 'Transaction Density' },
            { id: 'user' as const, label: 'User Activity' },
          ].map((tab) => (
            <Box
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              sx={{
                px: 2.5,
                py: 1.25,
                fontSize: '0.8125rem',
                fontWeight: 600,
                fontFamily: 'Jost',
                cursor: 'pointer',
                color: activeTab === tab.id ? colorPalette.primary : '#64748b',
                bgcolor: activeTab === tab.id ? '#ffffff' : 'transparent',
                border: '1px solid',
                borderColor: activeTab === tab.id ? '#eef0f4' : 'transparent',
                borderBottom: activeTab === tab.id ? '1px solid #ffffff' : '1px solid #eef0f4',
                position: 'relative',
                marginBottom: '-1px',
                transition: 'all 0.15s',
                '&:hover': { color: colorPalette.primary },
              }}
            >
              {tab.label}
            </Box>
          ))}
          <Box sx={{ flex: 1, borderBottom: '1px solid #eef0f4' }} />
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 360px' }, gap: 3 }}>
          {/* Heatmap */}
          <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4' }}>
            <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid #eef0f4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
                  {activeTab === 'tx' ? 'Transactions per hour' : 'Active sessions per hour'}
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
                  {rangeLabel[range]} · hover any cell for details
                </Typography>
              </Box>
              <Stack direction="row" gap={2} alignItems="center">
                <DateRangeFilter value={range} onChange={setRange} />
                <Stack direction="row" gap={1.25} alignItems="center">
                  <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600, color: '#94a3b8' }}>
                    Less
                  </Typography>
                  <Stack direction="row" gap={0.25}>
                    {[0.1, 0.3, 0.5, 0.7, 0.9].map((v) => (
                      <Box key={v} sx={{ width: 12, height: 12, bgcolor: colorScale(v, activeTab) }} />
                    ))}
                  </Stack>
                  <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600, color: '#94a3b8' }}>
                    More
                  </Typography>
                </Stack>
              </Stack>
            </Box>

            <Box sx={{ p: 3 }}>
              <Box sx={{ width: '100%', overflowX: 'auto', overflowY: 'hidden' }}>
                <Box sx={{ minWidth: 560 }}>
                  {/* Hour labels */}
                  <Box sx={{ display: 'grid', gridTemplateColumns: '40px repeat(24, 1fr)', gap: 0.375, mb: 0.5 }}>
                    <Box />
                    {hours.map((h) => (
                      <Typography
                        key={h}
                        sx={{
                          fontSize: '0.625rem',
                          fontWeight: 600,
                          color: '#94a3b8',
                          textAlign: 'center',
                        }}
                      >
                        {h % 3 === 0 ? `${h}` : ''}
                      </Typography>
                    ))}
                  </Box>

                  {/* Day rows */}
                  {days.map((d, di) => (
                    <Box
                      key={d}
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: '40px repeat(24, 1fr)',
                        gap: 0.375,
                        mb: 0.375,
                      }}
                    >
                      <Typography
                        sx={{
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          color: '#475569',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        {d}
                      </Typography>
                      {hours.map((h) => {
                        const v = data[di][h]
                        const isHovered = hovered && hovered.day === di && hovered.hour === h
                        return (
                          <Box
                            key={h}
                            onMouseEnter={() => setHovered({ day: di, hour: h, value: v })}
                            onMouseLeave={() => setHovered(null)}
                            sx={{
                              aspectRatio: '1',
                              bgcolor: colorScale(v, activeTab),
                              cursor: 'pointer',
                              transition: 'box-shadow 0.15s, outline-color 0.15s',
                              outline: isHovered ? `2px solid ${colorPalette.primary}` : '2px solid transparent',
                              outlineOffset: '-1px',
                              boxShadow: isHovered ? `0 0 0 3px ${colorPalette.primary}25` : 'none',
                              position: 'relative',
                              zIndex: isHovered ? 2 : 1,
                            }}
                          />
                        )
                      })}
                    </Box>
                  ))}
                </Box>
              </Box>

              {/* Inline hover stats — fixed height so the container never resizes */}
              <Box
                sx={{
                  mt: 2.5,
                  px: 2,
                  bgcolor: hovered ? '#0f172a' : '#fafbfc',
                  color: hovered ? '#ffffff' : '#94a3b8',
                  border: '1px solid',
                  borderColor: hovered ? '#0f172a' : '#eef0f4',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                  transition: 'background 0.18s ease, color 0.18s ease, border-color 0.18s ease',
                  height: 60,
                  flexShrink: 0,
                }}
              >
                {hovered ? (
                  <>
                    <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, fontFamily: 'Jost' }}>
                      {days[hovered.day]} · {hovered.hour.toString().padStart(2, '0')}:00 – {((hovered.hour + 1) % 24).toString().padStart(2, '0')}:00
                    </Typography>
                    <Box sx={{ width: '1px', height: 22, bgcolor: 'rgba(255,255,255,0.18)' }} />
                    <Box>
                      <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                        {activeTab === 'tx' ? 'Transactions' : 'Active Users'}
                      </Typography>
                      <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, fontFamily: 'SF Mono, Monaco, monospace' }}>
                        {activeTab === 'tx'
                          ? `${Math.round(hovered.value * 4500)} transactions`
                          : `${Math.round(hovered.value * 1200)} active users`}
                      </Typography>
                    </Box>
                  </>
                ) : (
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, fontFamily: 'Jost' }}>
                    Hover any cell to see details
                  </Typography>
                )}
              </Box>
            </Box>

            {/* Bottom stats */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderTop: '1px solid #eef0f4' }}>
              {[
                { label: 'Peak hour', value: activeTab === 'tx' ? 'Wed 12:00' : 'Tue 14:00' },
                { label: activeTab === 'tx' ? 'Total volume' : 'Total sessions', value: activeTab === 'tx' ? '186K' : '47.2K' },
                { label: 'Anomaly cells', value: activeTab === 'tx' ? '4' : '7' },
                { label: 'vs last week', value: activeTab === 'tx' ? '+12%' : '+4%' },
              ].map((s, i) => (
                <Box key={s.label} sx={{ p: 2, borderRight: i < 3 ? '1px solid #eef0f4' : 'none' }}>
                  <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.5 }}>
                    {s.label}
                  </Typography>
                  <Typography sx={{ fontSize: '1.125rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
                    {s.value}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>

          {/* Insights */}
          <Stack gap={2}>
            <Box sx={{ bgcolor: colorPalette.primary, color: '#ffffff', p: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <AutoAwesomeOutlinedIcon sx={{ fontSize: '1rem' }} />
                <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  Eureka insight
                </Typography>
              </Box>
              <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, lineHeight: 1.5, mb: 1 }}>
                {activeTab === 'tx'
                  ? "Unusual spike at Tuesday 03:00 — typically a quiet hour. 4× normal volume coming from 7 unique customer IDs."
                  : "Active sessions spiking at unusual hours from accounts in Lagos & Sokoto regions. Pattern suggests credential testing."}
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', opacity: 0.9, lineHeight: 1.55 }}>
                Recommended: open an investigation for the affected customer IDs and check device fingerprints.
              </Typography>
            </Box>

            <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', p: 2.5 }}>
              <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost', mb: 1.5 }}>
                Anomaly cells
              </Typography>
              <Stack gap={1.5}>
                {[
                  { time: 'Tue 03:00', score: 94, type: 'Volume spike' },
                  { time: 'Sat 01:00', score: 87, type: 'Off-hours wire' },
                  { time: 'Sun 04:00', score: 76, type: 'Velocity burst' },
                  { time: 'Wed 23:00', score: 68, type: 'New device' },
                ].map((a) => (
                  <Box
                    key={a.time}
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      pb: 1.5,
                      borderBottom: '1px solid #f4f5f7',
                      cursor: 'pointer',
                      '&:hover': { '& .anomaly-time': { color: colorPalette.primary } },
                      '&:last-child': { borderBottom: 'none', pb: 0 },
                    }}
                  >
                    <Box>
                      <Typography
                        className="anomaly-time"
                        sx={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost', transition: 'color 0.15s' }}
                      >
                        {a.time}
                      </Typography>
                      <Typography sx={{ fontSize: '0.6875rem', color: '#64748b' }}>
                        {a.type}
                      </Typography>
                    </Box>
                    <Chip
                      label={`${a.score}`}
                      size="small"
                      sx={{
                        bgcolor: a.score >= 80 ? '#fef2f2' : '#fffbeb',
                        color: a.score >= 80 ? '#dc2626' : '#f59e0b',
                        fontWeight: 700,
                        fontSize: '0.6875rem',
                        borderRadius: 0,
                        height: 22,
                        minWidth: 36,
                      }}
                    />
                  </Box>
                ))}
              </Stack>
            </Box>
          </Stack>
        </Box>
      </Box>
    </DashboardLayout>
  )
}
