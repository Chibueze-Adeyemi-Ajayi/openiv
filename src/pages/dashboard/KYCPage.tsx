import { Box, Typography, Stack, Chip, Button, IconButton, InputBase } from '@mui/material'
import { colorPalette } from '@/theme'
import DashboardLayout from '@/components/dashboard/DashboardLayout'
import DateRangeFilter, { type DateRange } from '@/components/dashboard/DateRangeFilter'
import { Link } from 'react-router-dom'
import { useState } from 'react'
import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined'
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded'
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined'

const kycRecords = [
  { name: 'Adamu Ibrahim', bvn: '22148273920', tier: 3, status: 'verified', riskRating: 'High', source: 'NIBSS', updated: '2 days ago' },
  { name: 'Folake Adesanya', bvn: '22148273921', tier: 3, status: 'verified', riskRating: 'Low', source: 'NIBSS', updated: '5 days ago' },
  { name: 'Chinedu Okeke', bvn: '22148273922', tier: 2, status: 'pending', riskRating: 'Medium', source: 'NIBSS', updated: 'Today' },
  { name: 'Aisha Bello', bvn: '22148273923', tier: 3, status: 'verified', riskRating: 'Low', source: 'NIBSS', updated: '1 week ago' },
  { name: 'Emeka Nwosu', bvn: '22148273924', tier: 3, status: 'enhanced', riskRating: 'High', source: 'NIBSS + Manual', updated: '12 hours ago' },
  { name: 'Mariam Yusuf', bvn: '22148273925', tier: 1, status: 'verified', riskRating: 'Low', source: 'NIN', updated: '3 weeks ago' },
  { name: 'Tunde Bakare', bvn: '22148273926', tier: 3, status: 'review', riskRating: 'Medium', source: 'NIBSS', updated: '4 days ago' },
  { name: 'Bashir Mohammed', bvn: '22148273927', tier: 2, status: 'verified', riskRating: 'Medium', source: 'NIN', updated: '1 week ago' },
]

const statusConfig: Record<string, { bg: string; color: string; icon: React.ReactNode }> = {
  verified: { bg: '#f0fdf4', color: '#10b981', icon: <VerifiedOutlinedIcon sx={{ fontSize: '0.875rem' }} /> },
  pending: { bg: '#fffbeb', color: '#f59e0b', icon: <AccessTimeRoundedIcon sx={{ fontSize: '0.875rem' }} /> },
  enhanced: { bg: `${colorPalette.primary}10`, color: colorPalette.primary, icon: <VerifiedOutlinedIcon sx={{ fontSize: '0.875rem' }} /> },
  review: { bg: '#fef2f2', color: '#dc2626', icon: <ErrorOutlineRoundedIcon sx={{ fontSize: '0.875rem' }} /> },
}

const statusFilters = ['All', 'Verified', 'Pending', 'Enhanced', 'Review']
const tierFilters = ['All', 'Tier 1', 'Tier 2', 'Tier 3']

export default function KYCPage() {
  const [statusFilter, setStatusFilter] = useState('All')
  const [tierFilter, setTierFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [range, setRange] = useState<DateRange>('30d')
  return (
    <DashboardLayout>
      <Box sx={{ p: 4 }}>
        <Box sx={{ mb: 4 }}>
          <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: colorPalette.primary, letterSpacing: '0.14em', textTransform: 'uppercase', mb: 0.75 }}>
            Customer Due Diligence
          </Typography>
          <Typography sx={{ fontSize: '1.625rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost', letterSpacing: '-0.015em', mb: 0.5 }}>
            KYC
          </Typography>
          <Typography sx={{ fontSize: '0.9375rem', color: '#64748b' }}>
            BVN/NIN verification, tier assignment, and enhanced due diligence tracking
          </Typography>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, mb: 3 }}>
          {[
            { label: 'Total customers', value: '847,219', sub: 'across all tiers' },
            { label: 'Tier 3 verified', value: '624,108', sub: '73.7%' },
            { label: 'Pending verification', value: '8,420', sub: 'avg wait: 4.2 days' },
            { label: 'EDD active', value: '142', sub: 'high-risk profiles' },
          ].map((s) => (
            <Box key={s.label} sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', p: 2.25 }}>
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 0.75 }}>
                {s.label}
              </Typography>
              <Typography sx={{ fontSize: '1.625rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost', lineHeight: 1.1, mb: 0.5 }}>
                {s.value}
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>{s.sub}</Typography>
            </Box>
          ))}
        </Box>

        <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4' }}>
          <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid #eef0f4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
              Customer KYC records
            </Typography>
            <Button
              sx={{
                bgcolor: colorPalette.primary,
                color: '#ffffff',
                px: 2.25,
                py: 1.125,
                fontSize: '0.8125rem',
                fontWeight: 600,
                fontFamily: 'Jost',
                borderRadius: 0,
                textTransform: 'none',
                boxShadow: 'none',
                '&:hover': { bgcolor: '#1a3896' },
              }}
            >
              Run Bulk Re-verification
            </Button>
          </Box>

          {/* Filter bar */}
          <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid #eef0f4', display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Stack direction="row" gap={0.5}>
              {statusFilters.map((f) => (
                <Box
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  sx={{
                    px: 1.5,
                    py: 0.75,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: statusFilter === f ? colorPalette.primary : '#64748b',
                    bgcolor: statusFilter === f ? `${colorPalette.primary}0a` : 'transparent',
                    fontFamily: 'Jost',
                    transition: 'all 0.15s',
                    '&:hover': { bgcolor: statusFilter === f ? `${colorPalette.primary}0f` : '#f8fafc' },
                  }}
                >
                  {f}
                </Box>
              ))}
            </Stack>
            <Box sx={{ width: '1px', height: 22, bgcolor: '#e5e7eb' }} />
            <Stack direction="row" gap={0.5}>
              {tierFilters.map((f) => (
                <Box
                  key={f}
                  onClick={() => setTierFilter(f)}
                  sx={{
                    px: 1.25,
                    py: 0.75,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: tierFilter === f ? '#0f172a' : '#94a3b8',
                    bgcolor: tierFilter === f ? '#f1f5f9' : 'transparent',
                    fontFamily: 'Jost',
                    border: '1px solid',
                    borderColor: tierFilter === f ? '#cbd5e1' : 'transparent',
                    transition: 'all 0.15s',
                    '&:hover': { color: '#0f172a' },
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
                placeholder="Search by name or BVN…"
                sx={{ flex: 1, fontSize: '0.8125rem', fontFamily: 'Jost', color: '#0f172a' }}
              />
            </Box>
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '1fr 160px 80px 130px 110px 160px 120px 32px',
              gap: 2,
              px: 3,
              py: 1.5,
              bgcolor: '#fafbfc',
              borderBottom: '1px solid #eef0f4',
            }}
          >
            {['Customer', 'BVN', 'Tier', 'Status', 'Risk', 'Source', 'Last update', ''].map((h) => (
              <Typography key={h} sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {h}
              </Typography>
            ))}
          </Box>

          {kycRecords.map((r, i) => {
            const cfg = statusConfig[r.status]
            return (
              <Box
                key={r.bvn}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 160px 80px 130px 110px 160px 120px 32px',
                  gap: 2,
                  px: 3,
                  py: 1.75,
                  alignItems: 'center',
                  borderBottom: i === kycRecords.length - 1 ? 'none' : '1px solid #f4f5f7',
                  cursor: 'pointer',
                  '&:hover': { bgcolor: '#fafbfc' },
                }}
              >
                <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a', fontFamily: 'Jost' }}>
                  {r.name}
                </Typography>
                <Typography sx={{ fontSize: '0.8125rem', color: '#475569', fontFamily: 'SF Mono, Monaco, monospace' }}>
                  {r.bvn}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  {[1, 2, 3].map((t) => (
                    <Box key={t} sx={{ width: 8, height: 16, bgcolor: t <= r.tier ? colorPalette.primary : '#e5e7eb' }} />
                  ))}
                </Box>
                <Chip
                  label={r.status.toUpperCase()}
                  size="small"
                  icon={cfg.icon as any}
                  sx={{
                    bgcolor: cfg.bg,
                    color: cfg.color,
                    fontWeight: 700,
                    fontSize: '0.625rem',
                    letterSpacing: '0.08em',
                    borderRadius: 0,
                    height: 22,
                    width: 'fit-content',
                    '& .MuiChip-icon': { color: cfg.color, ml: 0.75 },
                    '& .MuiChip-label': { px: 0.75 },
                  }}
                />
                <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: r.riskRating === 'High' ? '#dc2626' : r.riskRating === 'Medium' ? '#f59e0b' : '#10b981' }}>
                  {r.riskRating}
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>{r.source}</Typography>
                <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>{r.updated}</Typography>
                <Link to="/dashboard/users/adamu" style={{ textDecoration: 'none' }}>
                  <IconButton size="small" disableRipple sx={{ borderRadius: 0, color: '#94a3b8', '&:hover': { color: colorPalette.primary } }}>
                    <ArrowForwardRoundedIcon sx={{ fontSize: '1.125rem' }} />
                  </IconButton>
                </Link>
              </Box>
            )
          })}
        </Box>
      </Box>
    </DashboardLayout>
  )
}
