import { Box, Typography, Stack, Button, InputBase, Chip, IconButton } from '@mui/material'
import { colorPalette } from '@/theme'
import DashboardLayout from '@/components/dashboard/DashboardLayout'
import DateRangeFilter, { type DateRange } from '@/components/dashboard/DateRangeFilter'
import { useState } from 'react'
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined'
import FilterListRoundedIcon from '@mui/icons-material/FilterListRounded'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import BlockRoundedIcon from '@mui/icons-material/BlockRounded'

type Status = 'flagged' | 'blocked' | 'cleared' | 'review'

const statusConfig: Record<Status, { color: string; bg: string; label: string }> = {
  flagged: { color: '#f59e0b', bg: '#fffbeb', label: 'Flagged' },
  blocked: { color: '#dc2626', bg: '#fef2f2', label: 'Blocked' },
  cleared: { color: '#10b981', bg: '#f0fdf4', label: 'Cleared' },
  review: { color: colorPalette.primary, bg: `${colorPalette.primary}08`, label: 'In Review' },
}

const transactions = [
  { id: 'TXN-48721', customer: 'Adamu Ibrahim', amount: 14250000, channel: 'Wire', counterparty: 'Sokoto BDC Ltd', time: '14:22', risk: 92, status: 'flagged' as Status, location: 'Sokoto' },
  { id: 'TXN-48720', customer: 'Folake Adesanya', amount: 480000, channel: 'Mobile', counterparty: 'PiggyVest Wallet', time: '14:21', risk: 12, status: 'cleared' as Status, location: 'Lagos' },
  { id: 'TXN-48719', customer: 'Chinedu Okeke', amount: 7800000, channel: 'Wire', counterparty: 'Anonymous · Aba', time: '14:19', risk: 88, status: 'blocked' as Status, location: 'Onitsha' },
  { id: 'TXN-48718', customer: 'Aisha Bello', amount: 2400000, channel: 'PoS', counterparty: 'Shoprite Lekki', time: '14:18', risk: 8, status: 'cleared' as Status, location: 'Lagos' },
  { id: 'TXN-48717', customer: 'Emeka Nwosu', amount: 18500000, channel: 'Wire', counterparty: 'Cayman Holdings', time: '14:15', risk: 95, status: 'review' as Status, location: 'Port Harcourt' },
  { id: 'TXN-48716', customer: 'Mariam Yusuf', amount: 320000, channel: 'Mobile', counterparty: 'MTN Topup', time: '14:13', risk: 4, status: 'cleared' as Status, location: 'Kano' },
  { id: 'TXN-48715', customer: 'Tunde Bakare', amount: 6200000, channel: 'Wire', counterparty: 'Ade Ventures', time: '14:11', risk: 64, status: 'review' as Status, location: 'Ibadan' },
  { id: 'TXN-48714', customer: 'Ifeoma Eze', amount: 1850000, channel: 'PoS', counterparty: 'Slot Mall', time: '14:09', risk: 22, status: 'cleared' as Status, location: 'Enugu' },
  { id: 'TXN-48713', customer: 'Bashir Mohammed', amount: 9400000, channel: 'Wire', counterparty: 'Katsina FX Bureau', time: '14:07', risk: 76, status: 'flagged' as Status, location: 'Katsina' },
  { id: 'TXN-48712', customer: 'Grace Williams', amount: 540000, channel: 'Mobile', counterparty: 'Bolt Driver Payout', time: '14:05', risk: 6, status: 'cleared' as Status, location: 'Abuja' },
]

const filters = ['All', 'Flagged', 'Blocked', 'In Review', 'Cleared']

export default function TransactionsPage() {
  const [active, setActive] = useState('All')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [range, setRange] = useState<DateRange>('24h')

  const filtered = transactions.filter((t) => {
    if (active !== 'All' && statusConfig[t.status].label !== active) return false
    if (search && !t.id.toLowerCase().includes(search.toLowerCase()) && !t.customer.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const toggleSelect = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  return (
    <DashboardLayout>
      <Box sx={{ p: 4 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
          <Box>
            <Typography
              sx={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                color: colorPalette.primary,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                mb: 0.75,
              }}
            >
              Real-Time Monitor
            </Typography>
            <Typography sx={{ fontSize: '1.625rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost', letterSpacing: '-0.015em', mb: 0.5 }}>
              Transactions
            </Typography>
            <Typography sx={{ fontSize: '0.9375rem', color: '#64748b' }}>
              Every transaction scored against your active rules and AI baselines
            </Typography>
          </Box>

          <Stack direction="row" gap={1.25}>
            <Button
              startIcon={<FileDownloadOutlinedIcon sx={{ fontSize: '1rem !important' }} />}
              sx={{
                bgcolor: '#ffffff',
                color: '#475569',
                border: '1px solid #e5e7eb',
                px: 2.25,
                py: 1.125,
                fontSize: '0.8125rem',
                fontWeight: 600,
                fontFamily: 'Jost',
                borderRadius: 0,
                textTransform: 'none',
                '&:hover': { bgcolor: '#f8fafc', borderColor: '#cbd5e1' },
              }}
            >
              Export CSV
            </Button>
          </Stack>
        </Box>

        {/* Filters & Search */}
        <Box
          sx={{
            bgcolor: '#ffffff',
            border: '1px solid #eef0f4',
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            px: 2,
            py: 1.5,
            mb: 0,
            borderBottom: 'none',
          }}
        >
          <Stack direction="row" gap={0.5}>
            {filters.map((f) => (
              <Box
                key={f}
                onClick={() => setActive(f)}
                sx={{
                  px: 1.75,
                  py: 0.875,
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  color: active === f ? colorPalette.primary : '#64748b',
                  bgcolor: active === f ? `${colorPalette.primary}0a` : 'transparent',
                  fontFamily: 'Jost',
                  transition: 'all 0.15s',
                  '&:hover': { bgcolor: active === f ? `${colorPalette.primary}0f` : '#f8fafc' },
                }}
              >
                {f}
              </Box>
            ))}
          </Stack>

          <Box sx={{ flex: 1 }} />

          <DateRangeFilter value={range} onChange={setRange} compact />

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              bgcolor: '#f8fafc',
              px: 1.5,
              height: 32,
              minWidth: 240,
              border: '1px solid transparent',
              transition: 'all 0.18s',
              '&:focus-within': { bgcolor: '#ffffff', borderColor: colorPalette.primary },
            }}
          >
            <SearchOutlinedIcon sx={{ fontSize: '1rem', color: '#94a3b8' }} />
            <InputBase
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by ID or customer…"
              sx={{ flex: 1, fontSize: '0.8125rem', fontFamily: 'Jost', color: '#0f172a' }}
            />
          </Box>

          <IconButton disableRipple sx={{ borderRadius: 0, color: '#64748b', '&:hover': { color: colorPalette.primary } }}>
            <FilterListRoundedIcon sx={{ fontSize: '1.125rem' }} />
          </IconButton>
        </Box>

        {/* Bulk Action Bar (when items selected) */}
        {selected.length > 0 && (
          <Box
            sx={{
              bgcolor: colorPalette.primary,
              color: '#ffffff',
              px: 2,
              py: 1.25,
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              animation: 'slideDown 0.2s ease',
              '@keyframes slideDown': { from: { opacity: 0, transform: 'translateY(-4px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
            }}
          >
            <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600 }}>
              {selected.length} transaction{selected.length > 1 ? 's' : ''} selected
            </Typography>
            <Box sx={{ flex: 1 }} />
            <Button
              startIcon={<CheckRoundedIcon sx={{ fontSize: '1rem !important' }} />}
              sx={{
                color: '#ffffff',
                bgcolor: 'rgba(255,255,255,0.12)',
                px: 1.75,
                py: 0.625,
                fontSize: '0.75rem',
                fontWeight: 600,
                borderRadius: 0,
                textTransform: 'none',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
              }}
            >
              Clear
            </Button>
            <Button
              startIcon={<BlockRoundedIcon sx={{ fontSize: '1rem !important' }} />}
              sx={{
                color: '#ffffff',
                bgcolor: 'rgba(255,255,255,0.12)',
                px: 1.75,
                py: 0.625,
                fontSize: '0.75rem',
                fontWeight: 600,
                borderRadius: 0,
                textTransform: 'none',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
              }}
            >
              Escalate
            </Button>
          </Box>
        )}

        {/* Table */}
        <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4' }}>
          {/* Table Header */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '32px 130px 1fr 120px 100px 1fr 80px 90px 110px 32px',
              gap: 2,
              px: 2,
              py: 1.5,
              bgcolor: '#fafbfc',
              borderBottom: '1px solid #eef0f4',
              alignItems: 'center',
            }}
          >
            <Box />
            <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              ID
            </Typography>
            <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Customer
            </Typography>
            <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'right' }}>
              Amount (₦)
            </Typography>
            <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Channel
            </Typography>
            <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Counterparty
            </Typography>
            <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'right' }}>
              Risk
            </Typography>
            <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Status
            </Typography>
            <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Time
            </Typography>
            <Box />
          </Box>

          {/* Rows */}
          {filtered.map((t) => {
            const isSelected = selected.includes(t.id)
            const cfg = statusConfig[t.status]
            return (
              <Box
                key={t.id}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '32px 130px 1fr 120px 100px 1fr 80px 90px 110px 32px',
                  gap: 2,
                  px: 2,
                  py: 1.75,
                  alignItems: 'center',
                  borderBottom: '1px solid #f4f5f7',
                  bgcolor: isSelected ? `${colorPalette.primary}06` : 'transparent',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                  '&:hover': { bgcolor: isSelected ? `${colorPalette.primary}0a` : '#fafbfc' },
                  '&:last-child': { borderBottom: 'none' },
                }}
              >
                <Box
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleSelect(t.id)
                  }}
                  sx={{
                    width: 16,
                    height: 16,
                    border: `1.5px solid ${isSelected ? colorPalette.primary : '#cbd5e1'}`,
                    bgcolor: isSelected ? colorPalette.primary : '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s',
                  }}
                >
                  {isSelected && <CheckRoundedIcon sx={{ fontSize: '0.875rem', color: '#ffffff' }} />}
                </Box>
                <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: '#0f172a', fontFamily: 'SF Mono, Monaco, monospace' }}>
                  {t.id}
                </Typography>
                <Box>
                  <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a' }}>
                    {t.customer}
                  </Typography>
                  <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8' }}>
                    {t.location}
                  </Typography>
                </Box>
                <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a', textAlign: 'right', fontFamily: 'SF Mono, Monaco, monospace' }}>
                  {t.amount.toLocaleString()}
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: '#475569', fontWeight: 500 }}>
                  {t.channel}
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.8125rem',
                    color: '#475569',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t.counterparty}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.75 }}>
                  <Box
                    sx={{
                      width: 36,
                      height: 4,
                      bgcolor: '#f1f5f9',
                      position: 'relative',
                    }}
                  >
                    <Box
                      sx={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: `${t.risk}%`,
                        bgcolor: t.risk >= 70 ? '#dc2626' : t.risk >= 40 ? '#f59e0b' : '#10b981',
                      }}
                    />
                  </Box>
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#0f172a', minWidth: 24 }}>
                    {t.risk}
                  </Typography>
                </Box>
                <Chip
                  label={cfg.label}
                  size="small"
                  sx={{
                    bgcolor: cfg.bg,
                    color: cfg.color,
                    fontWeight: 700,
                    fontSize: '0.625rem',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    borderRadius: 0,
                    height: 20,
                    '& .MuiChip-label': { px: 0.875 },
                  }}
                />
                <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500 }}>
                  {t.time}
                </Typography>
                <IconButton size="small" disableRipple sx={{ borderRadius: 0, color: '#94a3b8', '&:hover': { color: colorPalette.primary } }}>
                  <MoreHorizRoundedIcon sx={{ fontSize: '1.125rem' }} />
                </IconButton>
              </Box>
            )
          })}

          {/* Pagination */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              px: 2,
              py: 1.5,
              borderTop: '1px solid #eef0f4',
            }}
          >
            <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>
              Showing {filtered.length} of 84,219 transactions
            </Typography>
            <Stack direction="row" gap={0.5}>
              {['Previous', '1', '2', '3', '…', '8,422', 'Next'].map((p) => (
                <Box
                  key={p}
                  sx={{
                    px: 1.25,
                    py: 0.5,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: p === '1' ? '#ffffff' : '#475569',
                    bgcolor: p === '1' ? colorPalette.primary : 'transparent',
                    border: '1px solid',
                    borderColor: p === '1' ? colorPalette.primary : '#e5e7eb',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    '&:hover': { borderColor: colorPalette.primary, color: p === '1' ? '#ffffff' : colorPalette.primary },
                  }}
                >
                  {p}
                </Box>
              ))}
            </Stack>
          </Box>
        </Box>
      </Box>
    </DashboardLayout>
  )
}
