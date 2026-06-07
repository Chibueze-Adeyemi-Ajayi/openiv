import { Box, Typography, Skeleton, Tooltip } from '@mui/material'
import { colorPalette } from '@/theme'
import ComingSoonOverlay from '@/components/dashboard/ComingSoonOverlay'
import { useState, useEffect, useMemo, useRef } from 'react'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { heatmapApi, type HeatmapDayCell, type HeatmapMode } from '@/api/heatmap'

// ── Constants ─────────────────────────────────────────────────────────────────

const CELL = 14   // px — max cell size (shrinks responsively)
const GAP = 3    // px — gap between cells
const DOW_COL = 28   // px — width of day-label column

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

type ActiveTab = 'tx' | 'user'
type ViewMode = 'rolling' | number   // number = calendar year

// ── Types ─────────────────────────────────────────────────────────────────────

interface GridDay {
  dateStr: string
  count: number
  avgRisk: number | null
}

interface WeekGrid {
  weeks: (GridDay | null)[][]
  monthLabels: { weekIndex: number; label: string }[]
  maxCount: number
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function fmtIso(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

function viewRange(mode: ViewMode): { fromStr: string; toStr: string; label: string } {
  const today = new Date()
  if (mode === 'rolling') {
    const from = new Date(today)
    from.setDate(from.getDate() - 364)
    return { fromStr: fmtIso(from), toStr: fmtIso(today), label: 'Last 365 days' }
  }
  return {
    fromStr: `${mode}-01-01`,
    toStr: `${mode}-12-31`,
    label: String(mode),
  }
}

function buildRangeGrid(
  fromStr: string,
  toStr: string,
  cellMap: Map<string, { count: number; avgRisk: number | null }>
): WeekGrid {
  const weeks: (GridDay | null)[][] = []
  const monthLabels: { weekIndex: number; label: string }[] = []
  const seenMonths = new Set<number>()
  let maxCount = 0

  const fromDate = new Date(fromStr + 'T00:00:00')
  const toDate = new Date(toStr + 'T00:00:00')

  // Start on the Sunday on or before fromDate
  const cursor = new Date(fromDate)
  cursor.setDate(fromDate.getDate() - fromDate.getDay())

  // End on the Saturday on or after toDate
  const lastDay = new Date(toDate)
  lastDay.setDate(toDate.getDate() + (6 - toDate.getDay()))

  let weekIdx = 0
  while (cursor <= lastDay) {
    const week: (GridDay | null)[] = []
    for (let d = 0; d < 7; d++) {
      const inRange = cursor >= fromDate && cursor <= toDate
      if (inRange) {
        const m = cursor.getMonth()
        if (!seenMonths.has(m)) {
          seenMonths.add(m)
          monthLabels.push({ weekIndex: weekIdx, label: MONTH_LABELS[m] })
        }
        const dateStr = fmtIso(cursor)
        const cell = cellMap.get(dateStr)
        const count = cell?.count ?? 0
        if (count > maxCount) maxCount = count
        week.push({ dateStr, count, avgRisk: cell?.avgRisk ?? null })
      } else {
        week.push(null)
      }
      cursor.setDate(cursor.getDate() + 1)
    }
    weeks.push(week)
    weekIdx++
  }

  return { weeks, monthLabels, maxCount }
}

function cellColor(count: number, max: number, tab: ActiveTab, mode: HeatmapMode): string {
  if (count === 0 || max === 0) return '#eef0f4'
  const [r, g, b] =
    tab === 'tx'
      ? mode === 'normal' ? [30, 64, 175] : [234, 88, 12]
      : mode === 'normal' ? [16, 185, 129] : [220, 38, 38]
  const alpha = Math.max(0.18, Math.min(1, (count / max) * 0.82 + 0.18))
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function peakMonth(cells: HeatmapDayCell[]): { label: string; count: number } | null {
  if (cells.length === 0) return null
  const monthly: Record<number, number> = {}
  for (const c of cells) {
    const m = parseInt(c.date.slice(5, 7), 10) - 1
    monthly[m] = (monthly[m] ?? 0) + c.count
  }
  const [idx, count] = Object.entries(monthly).sort(([, a], [, b]) => b - a)[0] ?? []
  return idx != null ? { label: MONTH_LABELS[parseInt(idx, 10)], count } : null
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonGrid({ size }: { size: number }) {
  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'inline-flex', flexDirection: 'column' }}>
        <Box sx={{ height: 10, mb: '4px', display: 'flex', pl: `${DOW_COL}px`, gap: `${GAP}px` }}>
          {Array.from({ length: 53 }, (_, wi) => (
            <Box key={wi} sx={{ width: size, flexShrink: 0 }}>
              {wi % 4 === 0 && (
                <Skeleton variant="text" width={size * 2} height={8} sx={{ borderRadius: 0 }} />
              )}
            </Box>
          ))}
        </Box>
        <Box sx={{ display: 'flex', gap: `${GAP}px` }}>
          <Box sx={{ width: DOW_COL, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: `${GAP}px` }}>
            {DOW_LABELS.map((_, di) => <Box key={di} sx={{ height: size }} />)}
          </Box>
          {Array.from({ length: 53 }, (_, wi) => (
            <Box key={wi} sx={{ display: 'flex', flexDirection: 'column', gap: `${GAP}px` }}>
              {Array.from({ length: 7 }, (_, di) => (
                <Skeleton key={di} variant="rectangular" width={size} height={size}
                  sx={{ borderRadius: 0, animationDelay: `${(wi * 7 + di) * 2}ms` }} />
              ))}
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HeatmapsPage() {
  const currentYear = new Date().getFullYear()

  const [activeTab, setActiveTab] = useState<ActiveTab>('tx')
  const [mode, setMode] = useState<HeatmapMode>('normal')
  const [viewMode, setViewMode] = useState<ViewMode>('rolling')   // default: last 365 days
  const [hovered, setHovered] = useState<string | null>(null)

  const [cells, setCells] = useState<HeatmapDayCell[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)

  // Responsive cell size: fills container width exactly, capped at CELL max
  const containerRef = useRef<HTMLDivElement>(null)
  const [dynCell, setDynCell] = useState(CELL)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const compute = () => {
      const size = Math.max(6, Math.floor((el.clientWidth - DOW_COL - 53 * GAP) / 53))
      setDynCell(Math.min(size, CELL))
    }
    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const { fromStr, toStr } = useMemo(() => viewRange(viewMode), [viewMode])

  useEffect(() => {
    setLoading(true)
    setCells([])
    const fn = activeTab === 'tx' ? heatmapApi.transactions : heatmapApi.activity
    fn(mode, fromStr, toStr)
      .then(d => { setCells(d.cells); setTotalCount(d.totalCount) })
      .catch(() => { })
      .finally(() => setLoading(false))
  }, [activeTab, mode, fromStr, toStr])

  const cellMap = useMemo(() => {
    const m = new Map<string, { count: number; avgRisk: number | null }>()
    for (const c of cells) m.set(c.date, { count: c.count, avgRisk: c.avgRisk })
    return m
  }, [cells])

  const { weeks, monthLabels, maxCount } = useMemo(
    () => buildRangeGrid(fromStr, toStr, cellMap),
    [fromStr, toStr, cellMap]
  )

  const bestMonth = useMemo(() => peakMonth(cells), [cells])
  const activeDays = cells.filter(c => c.count > 0).length
  const totalDays = viewMode === 'rolling' ? 365
    : new Date(Number(viewMode), 1, 29).getMonth() === 1 ? 366 : 365

  const modeStyle: Record<HeatmapMode, { bg: string; color: string }> = {
    normal: { bg: '#f0fdf4', color: '#10b981' },
    abnormal: { bg: '#fef2f2', color: '#dc2626' },
  }

  const txLabel = mode === 'normal' ? 'Normal transactions' : 'Flagged transactions'
  const actLabel = mode === 'normal' ? 'Successful logins' : 'Failed logins'
  const dataLabel = activeTab === 'tx' ? txLabel : actLabel
  const itemWord = activeTab === 'tx' ? 'transactions' : 'logins'

  return (
    <Box sx={{ p: 4 }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <Box sx={{ mb: 4 }}>
        <Typography sx={{
          fontSize: '0.6875rem', fontWeight: 700, color: colorPalette.primary,
          letterSpacing: '0.14em', textTransform: 'uppercase', mb: 0.75
        }}>
          Behavioral Analytics
        </Typography>
        <Typography sx={{
          fontSize: '1.625rem', fontWeight: 700, color: 'var(--heading-color)',
          fontFamily: 'Jost', letterSpacing: '-0.015em', mb: 0.5
        }}>
          Heatmaps
        </Typography>
        <Typography sx={{ fontSize: '0.9375rem', color: '#64748b' }}>
          A full-year view of transaction and login activity — spot seasonal patterns at a glance
        </Typography>
      </Box>

      {/* ── Tab row + mode toggle ────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'flex-end', mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {([
            { id: 'tx' as const, label: 'Transaction Density' },
            { id: 'user' as const, label: 'User Activity' },
          ] as const).map(tab => (
            <Box
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              data-ai-analyzable="true"
              data-ai-description={`View behavioral heatmap for: ${tab.label}. currently active: ${activeTab === tab.id}.`}
              sx={{
                px: 2.5, py: 1.25, cursor: 'pointer',
                fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Jost',
                color: activeTab === tab.id ? colorPalette.primary : '#64748b',
                bgcolor: activeTab === tab.id ? 'var(--card-bg)' : 'transparent',
                border: '1px solid',
                borderColor: activeTab === tab.id ? '#eef0f4' : 'transparent',
                borderBottom: activeTab === tab.id ? '1px solid #ffffff' : '1px solid var(--border-col)',
                position: 'relative', marginBottom: '-1px',
                transition: 'all 0.15s',
                '&:hover': { color: colorPalette.primary },
              }}>
              {tab.label}
            </Box>
          ))}
        </Box>

        <Box sx={{
          flex: 1, borderBottom: '1px solid var(--border-col)',
          display: 'flex', justifyContent: 'flex-end', pb: '1px', px: 1
        }}>
          <Box sx={{ display: 'flex', border: '1px solid var(--border-col)', overflow: 'hidden', mb: '1px' }}>
            {(['normal', 'abnormal'] as HeatmapMode[]).map(m => (
              <Box
                key={m}
                onClick={() => setMode(m)}
                data-ai-analyzable="true"
                data-ai-description={`Switch heatmap to ${m} mode. currently selected: ${mode === m}.`}
                sx={{
                  px: 2, py: 0.75, cursor: 'pointer',
                  fontSize: '0.75rem', fontWeight: 600, fontFamily: 'Jost',
                  bgcolor: mode === m ? modeStyle[m].bg : '#ffffff',
                  color: mode === m ? modeStyle[m].color : '#94a3b8',
                  borderRight: m === 'normal' ? '1px solid var(--border-col)' : 'none',
                  transition: 'all 0.15s',
                  '&:hover': { bgcolor: mode === m ? modeStyle[m].bg : '#f8fafc' },
                }}>
                {m === 'normal' ? 'Normal' : 'Abnormal'}
              </Box>
            ))}
          </Box>
        </Box>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: 3, position: 'relative' }}>

        {activeTab === 'user' && (
          <ComingSoonOverlay
            title="User Activity Heatmap"
            description="Login and session-level behavioral density mapping is coming in the next release. Transaction density is live now."
          />
        )}

        {/* ── Heatmap panel ─────────────────────────────────────────────── */}
        <Box sx={{ bgcolor: 'var(--card-bg)', border: '1px solid var(--border-col)' }}>

          {/* Panel header */}
          <Box sx={{
            px: 3, py: 2.25, borderBottom: '1px solid var(--border-col)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2
          }}>
            <Box>
              <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost' }}>
                {dataLabel}
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
                {loading ? 'Loading…'
                  : `${activeDays} active ${activeDays === 1 ? 'day' : 'days'} · ${totalCount.toLocaleString()} total`}
              </Typography>
            </Box>

            {/* Range selector: Last 365 days + year pills + prev/next */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
              <Box onClick={() => setViewMode(y => typeof y === 'number' ? Math.max(y - 1, currentYear - 4) : currentYear - 1)}
                sx={{
                  width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: viewMode === currentYear - 4 ? 'default' : 'pointer',
                  color: viewMode === currentYear - 4 ? '#cbd5e1' : '#64748b',
                  transition: 'color 0.15s',
                  '&:hover': { color: viewMode === currentYear - 4 ? '#cbd5e1' : colorPalette.primary },
                }}>
                <ChevronLeftIcon sx={{ fontSize: '1rem' }} />
              </Box>

              {/* "Last 365 days" rolling pill */}
              <Box
                onClick={() => setViewMode('rolling')}
                data-ai-analyzable="true"
                data-ai-description={`View rolling 365-day heatmap. currently selected: ${viewMode === 'rolling'}.`}
                sx={{
                  px: 1.5, py: 0.5, cursor: 'pointer',
                  fontSize: '0.75rem', fontWeight: 700, fontFamily: 'Jost',
                  color: viewMode === 'rolling' ? colorPalette.primary : '#64748b',
                  bgcolor: viewMode === 'rolling' ? `${colorPalette.primary}12` : 'transparent',
                  border: '1px solid',
                  borderColor: viewMode === 'rolling' ? `${colorPalette.primary}40` : 'transparent',
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                  '&:hover': { color: colorPalette.primary, bgcolor: `${colorPalette.primary}0a` },
                }}>
                Last 365 days
              </Box>

              {[currentYear - 2, currentYear - 1, currentYear].map(y => (
                <Box
                  key={y}
                  onClick={() => setViewMode(y)}
                  data-ai-analyzable="true"
                  data-ai-description={`View calendar year heatmap for: ${y}. currently selected: ${viewMode === y}.`}
                  sx={{
                    px: 1.25, py: 0.5, cursor: 'pointer',
                    fontSize: '0.75rem', fontWeight: 700, fontFamily: 'Jost',
                    color: viewMode === y ? colorPalette.primary : '#64748b',
                    bgcolor: viewMode === y ? `${colorPalette.primary}12` : 'transparent',
                    border: '1px solid',
                    borderColor: viewMode === y ? `${colorPalette.primary}40` : 'transparent',
                    transition: 'all 0.15s',
                    '&:hover': { color: colorPalette.primary, bgcolor: `${colorPalette.primary}0a` },
                  }}>
                  {y}
                </Box>
              ))}

              <Box onClick={() => setViewMode(y => typeof y === 'number' ? Math.min(y + 1, currentYear) : currentYear)}
                sx={{
                  width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: viewMode === currentYear ? 'default' : 'pointer',
                  color: viewMode === currentYear ? '#cbd5e1' : '#64748b',
                  transition: 'color 0.15s',
                  '&:hover': { color: viewMode === currentYear ? '#cbd5e1' : colorPalette.primary },
                }}>
                <ChevronRightIcon sx={{ fontSize: '1rem' }} />
              </Box>
            </Box>
          </Box>

          {/* Contribution graph */}
          <Box ref={containerRef} sx={{ px: 3, pt: 2.5, pb: 1, overflow: 'hidden' }}>
            {loading ? <SkeletonGrid size={dynCell} /> : (
              <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%', overflow: 'hidden' }}>

                {/* Month labels */}
                <Box sx={{ display: 'flex', pl: `${DOW_COL}px`, gap: `${GAP}px`, mb: '4px' }}>
                  {weeks.map((_, wi) => {
                    const ml = monthLabels.find(m => m.weekIndex === wi)
                    return (
                      <Box key={wi} sx={{ width: dynCell, flexShrink: 0, overflow: 'visible', whiteSpace: 'nowrap' }}>
                        {ml && (
                          <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: '#94a3b8', lineHeight: 1 }}>
                            {ml.label}
                          </Typography>
                        )}
                      </Box>
                    )
                  })}
                </Box>

                {/* DOW labels + week columns */}
                <Box sx={{ display: 'flex', gap: `${GAP}px` }}>
                  <Box sx={{ width: DOW_COL, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: `${GAP}px` }}>
                    {DOW_LABELS.map((label, di) => (
                      <Box key={di} sx={{ height: dynCell, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', pr: '4px' }}>
                        {di % 2 === 1 && (
                          <Typography sx={{ fontSize: '0.5rem', fontWeight: 600, color: '#94a3b8', lineHeight: 1 }}>
                            {label}
                          </Typography>
                        )}
                      </Box>
                    ))}
                  </Box>

                  {weeks.map((week, wi) => (
                    <Box key={wi} sx={{ display: 'flex', flexDirection: 'column', gap: `${GAP}px` }}>
                      {week.map((day, di) =>
                        day === null ? (
                          <Box key={di} sx={{ width: dynCell, height: dynCell }} />
                        ) : (
                          <Tooltip key={di} arrow placement="top"
                            title={
                              <Box>
                                <Typography sx={{ fontSize: '0.75rem', fontWeight: 700 }}>
                                  {formatDate(day.dateStr)}
                                </Typography>
                                <Typography sx={{ fontSize: '0.6875rem', opacity: 0.85, mt: 0.25 }}>
                                  {day.count === 0
                                    ? `No ${itemWord}`
                                    : `${day.count.toLocaleString()} ${itemWord}`}
                                  {day.avgRisk != null && ` · avg risk ${day.avgRisk.toFixed(1)}`}
                                </Typography>
                              </Box>
                            }>
                            <Box
                              onMouseEnter={() => setHovered(day.dateStr)}
                              onMouseLeave={() => setHovered(null)}
                              data-ai-analyzable="true"
                              data-ai-description={`Heatmap cell for ${formatDate(day.dateStr)}. activity: ${day.count === 0 ? 'none' : day.count + ' ' + itemWord}.${day.avgRisk != null ? ' average risk: ' + day.avgRisk.toFixed(1) : ''}`}
                              sx={{
                                width: dynCell, height: dynCell,
                                bgcolor: cellColor(day.count, maxCount, activeTab, mode),
                                cursor: day.count > 0 ? 'pointer' : 'default',
                                outline: hovered === day.dateStr
                                  ? `1.5px solid ${colorPalette.primary}`
                                  : '1.5px solid transparent',
                                transition: 'transform 0.1s, outline-color 0.1s',
                                '&:hover': { transform: 'scale(1.35)', zIndex: 10, position: 'relative' },
                              }}
                            />
                          </Tooltip>
                        )
                      )}
                    </Box>
                  ))}
                </Box>
              </Box>
            )}

            {/* Legend */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 2, justifyContent: 'flex-end' }}>
              <Typography sx={{ fontSize: '0.5625rem', fontWeight: 600, color: '#94a3b8' }}>Less</Typography>
              {[0, 0.25, 0.5, 0.75, 1].map((v, i) => (
                <Box key={i} sx={{
                  width: dynCell, height: dynCell,
                  bgcolor: v === 0 ? '#eef0f4' : cellColor(v * 100, 100, activeTab, mode),
                }} />
              ))}
              <Typography sx={{ fontSize: '0.5625rem', fontWeight: 600, color: '#94a3b8' }}>More</Typography>
            </Box>
          </Box>

          {/* Bottom stats */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', borderTop: '1px solid var(--border-col)' }}>
            {[
              { label: dataLabel, value: totalCount.toLocaleString() },
              { label: 'Active days', value: `${activeDays} / ${totalDays}` },
              { label: 'Peak month', value: bestMonth ? `${bestMonth.label} · ${bestMonth.count.toLocaleString()}` : '—' },
            ].map((s, i) => (
              <Box
                key={s.label}
                data-ai-analyzable="true"
                data-ai-description={`Summary Statistic: ${s.label}. Value: ${s.value}.`}
                sx={{ p: 2, borderRight: i < 2 ? '1px solid var(--border-col)' : 'none' }}>
                <Typography sx={{
                  fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8',
                  textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.5
                }}>
                  {s.label}
                </Typography>
                {loading
                  ? <Skeleton variant="text" width={64} height={28} sx={{ borderRadius: 0 }} />
                  : <Typography sx={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost' }}>
                    {s.value}
                  </Typography>
                }
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
