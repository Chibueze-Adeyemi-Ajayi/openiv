import { Box, Popover, Typography, Stack, Button } from '@mui/material'
import { colorPalette } from '@/theme'
import { useState, useMemo } from 'react'
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined'

export type DateRange = '24h' | '7d' | '30d' | '90d' | 'ytd' | 'custom'

interface DateRangeFilterProps {
  value: DateRange
  onChange: (value: DateRange) => void
  options?: DateRange[]
  compact?: boolean
  /** Selected custom dates (controlled) */
  customDates?: { from: string; to: string } | null
  onCustomDatesChange?: (dates: { from: string; to: string } | null) => void
}

const presetLabels: Record<Exclude<DateRange, 'custom'>, string> = {
  '24h': '24h',
  '7d': '7 days',
  '30d': '30 days',
  '90d': '90 days',
  ytd: 'YTD',
}

const defaultOptions: DateRange[] = ['24h', '7d', '30d', '90d', 'custom']

function fmtDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

function daysAgoISO(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().split('T')[0]
}

export default function DateRangeFilter({
  value,
  onChange,
  options = defaultOptions,
  compact,
  customDates: controlledDates,
  onCustomDatesChange,
}: DateRangeFilterProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [internalDates, setInternalDates] = useState<{ from: string; to: string } | null>(null)
  const [draftFrom, setDraftFrom] = useState(() => daysAgoISO(7))
  const [draftTo, setDraftTo] = useState(() => todayISO())

  const dates = controlledDates !== undefined ? controlledDates : internalDates
  const setDates = (d: { from: string; to: string } | null) => {
    if (onCustomDatesChange) onCustomDatesChange(d)
    else setInternalDates(d)
  }

  const customLabel = useMemo(() => {
    if (dates && dates.from && dates.to) {
      return `${fmtDate(dates.from)} – ${fmtDate(dates.to)}`
    }
    return 'Custom'
  }, [dates])

  const openPicker = (e: React.MouseEvent<HTMLElement>) => {
    if (dates) {
      setDraftFrom(dates.from)
      setDraftTo(dates.to)
    }
    setAnchor(e.currentTarget)
  }

  const apply = () => {
    if (!draftFrom || !draftTo) return
    setDates({ from: draftFrom, to: draftTo })
    onChange('custom')
    setAnchor(null)
  }

  const clear = () => {
    setDates(null)
    if (value === 'custom') {
      onChange(options.find((o) => o !== 'custom') || '24h')
    }
    setAnchor(null)
  }

  return (
    <>
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'stretch',
          border: '1px solid #e5e7eb',
          bgcolor: 'var(--card-bg)',
          height: compact ? 30 : 34,
        }}
      >
        {options.map((opt, i) => {
          const isActive = value === opt
          const isCustom = opt === 'custom'
          return (
            <Box
              key={opt}
              onClick={(e) => (isCustom ? openPicker(e) : (onChange(opt), setDates(null)))}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                px: compact ? 1.25 : 1.5,
                fontSize: compact ? '0.6875rem' : '0.75rem',
                fontWeight: 600,
                fontFamily: 'Jost',
                color: isActive ? '#ffffff' : '#475569',
                bgcolor: isActive ? colorPalette.primary : 'transparent',
                cursor: 'pointer',
                borderLeft: i === 0 ? 'none' : '1px solid var(--border-col)',
                transition: 'all 0.15s ease',
                userSelect: 'none',
                '&:hover': {
                  bgcolor: isActive ? colorPalette.primary : '#f8fafc',
                  color: isActive ? '#ffffff' : colorPalette.primary,
                },
              }}
            >
              {isCustom && (
                <CalendarTodayOutlinedIcon sx={{ fontSize: compact ? '0.75rem' : '0.875rem' }} />
              )}
              {isCustom ? customLabel : presetLabels[opt as Exclude<DateRange, 'custom'>]}
            </Box>
          )
        })}
      </Box>

      <Popover
        open={!!anchor}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              mt: 1,
              p: 0,
              borderRadius: 0,
              border: '1px solid var(--border-col)',
              boxShadow: '0 16px 48px rgba(15,23,42,0.12)',
              minWidth: 320,
            },
          },
        }}
      >
        <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid var(--border-col)' }}>
          <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost' }}>
            Custom date range
          </Typography>
          <Typography sx={{ fontSize: '0.6875rem', color: '#64748b', mt: 0.25 }}>
            Pick the start and end of the period you want to analyze
          </Typography>
        </Box>

        <Box sx={{ px: 2.5, py: 2.5 }}>
          <Stack gap={2}>
            <Box>
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.875, fontFamily: 'Jost' }}>
                From
              </Typography>
              <Box
                component="input"
                type="date"
                value={draftFrom}
                max={draftTo || todayISO()}
                onChange={(e: any) => setDraftFrom(e.target.value)}
                sx={{
                  width: '100%',
                  bgcolor: 'var(--section-bg)',
                  border: '1px solid transparent',
                  py: '12px',
                  px: '14px',
                  fontSize: '0.875rem',
                  fontFamily: 'Jost',
                  color: 'var(--heading-color)',
                  outline: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.18s',
                  '&:focus': { bgcolor: 'var(--card-bg)', borderColor: colorPalette.primary, boxShadow: `0 0 0 3px ${colorPalette.primary}14` },
                }}
              />
            </Box>
            <Box>
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.875, fontFamily: 'Jost' }}>
                To
              </Typography>
              <Box
                component="input"
                type="date"
                value={draftTo}
                min={draftFrom}
                max={todayISO()}
                onChange={(e: any) => setDraftTo(e.target.value)}
                sx={{
                  width: '100%',
                  bgcolor: 'var(--section-bg)',
                  border: '1px solid transparent',
                  py: '12px',
                  px: '14px',
                  fontSize: '0.875rem',
                  fontFamily: 'Jost',
                  color: 'var(--heading-color)',
                  outline: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.18s',
                  '&:focus': { bgcolor: 'var(--card-bg)', borderColor: colorPalette.primary, boxShadow: `0 0 0 3px ${colorPalette.primary}14` },
                }}
              />
            </Box>

            {/* Quick shortcuts inside the picker */}
            <Box>
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.875, fontFamily: 'Jost' }}>
                Quick presets
              </Typography>
              <Stack direction="row" gap={0.75} flexWrap="wrap">
                {[
                  { label: 'Last 7 days', from: daysAgoISO(7) },
                  { label: 'Last 30 days', from: daysAgoISO(30) },
                  { label: 'Last 90 days', from: daysAgoISO(90) },
                  { label: 'Year to date', from: `${new Date().getFullYear()}-01-01` },
                ].map((s) => (
                  <Box
                    key={s.label}
                    onClick={() => {
                      setDraftFrom(s.from)
                      setDraftTo(todayISO())
                    }}
                    sx={{
                      px: 1.25,
                      py: 0.5,
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      color: 'var(--on-surface-variant)',
                      border: '1px solid #e5e7eb',
                      cursor: 'pointer',
                      fontFamily: 'Jost',
                      transition: 'all 0.15s',
                      '&:hover': { borderColor: colorPalette.primary, color: colorPalette.primary },
                    }}
                  >
                    {s.label}
                  </Box>
                ))}
              </Stack>
            </Box>
          </Stack>
        </Box>

        <Box sx={{ px: 2.5, py: 1.5, borderTop: '1px solid var(--border-col)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
          <Button
            onClick={clear}
            sx={{
              fontSize: '0.75rem',
              fontWeight: 600,
              color: '#94a3b8',
              fontFamily: 'Jost',
              textTransform: 'none',
              p: 0,
              '&:hover': { bgcolor: 'transparent', color: '#dc2626' },
            }}
          >
            Clear
          </Button>
          <Stack direction="row" gap={1}>
            <Button
              onClick={() => setAnchor(null)}
              sx={{
                bgcolor: 'var(--card-bg)',
                color: 'var(--on-surface-variant)',
                border: '1px solid #e5e7eb',
                px: 2,
                py: 0.75,
                fontSize: '0.75rem',
                fontWeight: 600,
                fontFamily: 'Jost',
                borderRadius: 0,
                textTransform: 'none',
                '&:hover': { bgcolor: 'var(--section-bg)' },
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={apply}
              disabled={!draftFrom || !draftTo}
              sx={{
                bgcolor: colorPalette.primary,
                color: '#ffffff',
                px: 2,
                py: 0.75,
                fontSize: '0.75rem',
                fontWeight: 700,
                fontFamily: 'Jost',
                borderRadius: 0,
                textTransform: 'none',
                boxShadow: 'none',
                '&:hover:not(:disabled)': { bgcolor: 'var(--on-surface)' },
                '&:disabled': { bgcolor: '#e2e8f0', color: '#94a3b8' },
              }}
            >
              Apply
            </Button>
          </Stack>
        </Box>
      </Popover>
    </>
  )
}
