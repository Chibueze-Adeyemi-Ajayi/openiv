import { Box, Typography, Stack, Button, Chip, IconButton } from '@mui/material'
import { colorPalette } from '@/theme'
import DashboardLayout from '@/components/dashboard/DashboardLayout'
import TOTPConfirmation from '@/components/dashboard/TOTPConfirmation'
import DateRangeFilter, { type DateRange } from '@/components/dashboard/DateRangeFilter'
import { useState } from 'react'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded'
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded'
import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined'
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined'

const templates = [
  { id: 'str', icon: <DescriptionOutlinedIcon />, name: 'Suspicious Transaction Report (STR)', regulator: 'NFIU', desc: 'Auto-filed when transactions match defined typologies', cadence: 'On-demand' },
  { id: 'sar', icon: <GavelOutlinedIcon />, name: 'Suspicious Activity Report (SAR)', regulator: 'NFIU', desc: 'Aggregated activity reports for ongoing investigations', cadence: 'On-demand' },
  { id: 'rbs', icon: <AccountBalanceOutlinedIcon />, name: 'Risk-Based Supervision Return', regulator: 'CBN', desc: 'Quarterly risk profile submission', cadence: 'Quarterly' },
  { id: 'aml', icon: <VerifiedOutlinedIcon />, name: 'AML Compliance Summary', regulator: 'Internal', desc: 'Board-ready compliance posture summary', cadence: 'Monthly' },
]

const filings = [
  { id: 'STR-4827', type: 'STR', filed: '2026-04-19 14:32', regulator: 'NFIU', status: 'Acknowledged', filedBy: 'Eureka', amount: '₦14.2M', case: 'Case-0921' },
  { id: 'STR-4826', type: 'STR', filed: '2026-04-19 11:18', regulator: 'NFIU', status: 'Acknowledged', filedBy: 'Adaeze C.', amount: '₦8.4M', case: 'Case-0918' },
  { id: 'SAR-1248', type: 'SAR', filed: '2026-04-18 16:44', regulator: 'NFIU', status: 'Submitted', filedBy: 'Eureka', amount: '—', case: 'Case-0908' },
  { id: 'STR-4825', type: 'STR', filed: '2026-04-18 09:21', regulator: 'NFIU', status: 'Acknowledged', filedBy: 'Tunde B.', amount: '₦18.5M', case: 'Case-0902' },
  { id: 'RBS-Q1', type: 'CBN Return', filed: '2026-04-15 08:00', regulator: 'CBN', status: 'Acknowledged', filedBy: 'Adaeze C.', amount: '—', case: '—' },
  { id: 'STR-4824', type: 'STR', filed: '2026-04-17 22:09', regulator: 'NFIU', status: 'Pending Review', filedBy: 'Eureka', amount: '₦6.2M', case: 'Case-0894' },
]

const statusColors: Record<string, { bg: string; color: string }> = {
  Acknowledged: { bg: '#f0fdf4', color: '#10b981' },
  Submitted: { bg: `${colorPalette.primary}10`, color: colorPalette.primary },
  'Pending Review': { bg: '#fffbeb', color: '#f59e0b' },
}

const filingTypes = ['All', 'STR', 'SAR', 'CBN Return']

export default function ReportsPage() {
  const [fileOpen, setFileOpen] = useState(false)
  const [range, setRange] = useState<DateRange>('30d')
  const [typeFilter, setTypeFilter] = useState('All')
  return (
    <DashboardLayout>
      <Box sx={{ p: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
          <Box>
            <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: colorPalette.primary, letterSpacing: '0.14em', textTransform: 'uppercase', mb: 0.75 }}>
              Compliance
            </Typography>
            <Typography sx={{ fontSize: '1.625rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost', letterSpacing: '-0.015em', mb: 0.5 }}>
              Reports & Filings
            </Typography>
            <Typography sx={{ fontSize: '0.9375rem', color: '#64748b' }}>
              NFIU, CBN, and internal compliance reports — auto-generated and audit-ready
            </Typography>
          </Box>

          <Stack direction="row" gap={1.25}>
            <Button
              startIcon={<ScheduleRoundedIcon sx={{ fontSize: '1rem !important' }} />}
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
                '&:hover': { bgcolor: '#f8fafc' },
              }}
            >
              Schedule Report
            </Button>
            <Button
              onClick={() => setFileOpen(true)}
              startIcon={<AddRoundedIcon sx={{ fontSize: '1rem !important' }} />}
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
              File New Report
            </Button>
          </Stack>
        </Box>

        {/* KPIs */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, mb: 3 }}>
          {[
            { label: 'Reports filed (YTD)', value: '847', sub: 'NFIU + CBN combined' },
            { label: 'Pending review', value: '4', sub: 'Awaiting senior sign-off' },
            { label: 'Avg. file time', value: '3.2 min', sub: 'From flag to submission' },
            { label: 'Acknowledgement rate', value: '99.7%', sub: 'NFIU acceptance' },
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

        {/* Templates */}
        <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', mb: 3 }}>
          <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid #eef0f4' }}>
            <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
              Report templates
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
              Pre-configured to match regulator specifications
            </Typography>
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 0 }}>
            {templates.map((t, i) => (
              <Box
                key={t.id}
                sx={{
                  px: 3,
                  py: 2.5,
                  display: 'flex',
                  gap: 2,
                  cursor: 'pointer',
                  borderRight: i % 2 === 0 ? '1px solid #f4f5f7' : 'none',
                  borderBottom: i < templates.length - 2 ? '1px solid #f4f5f7' : 'none',
                  transition: 'background 0.15s',
                  '&:hover': { bgcolor: '#fafbfc' },
                }}
              >
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    bgcolor: `${colorPalette.primary}10`,
                    color: colorPalette.primary,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {t.icon}
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
                      {t.name}
                    </Typography>
                    <Chip
                      label={t.regulator}
                      size="small"
                      sx={{
                        bgcolor: '#f8fafc',
                        color: '#475569',
                        fontWeight: 700,
                        fontSize: '0.625rem',
                        letterSpacing: '0.1em',
                        borderRadius: 0,
                        height: 18,
                        '& .MuiChip-label': { px: 0.75 },
                      }}
                    />
                  </Box>
                  <Typography sx={{ fontSize: '0.8125rem', color: '#64748b', mb: 0.75 }}>
                    {t.desc}
                  </Typography>
                  <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    Cadence · {t.cadence}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>

        {/* Filings table */}
        <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4' }}>
          <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid #eef0f4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
              Recent filings
            </Typography>
            <Stack direction="row" gap={1.5} alignItems="center">
              <Stack direction="row" gap={0.5}>
                {filingTypes.map((f) => (
                  <Box
                    key={f}
                    onClick={() => setTypeFilter(f)}
                    sx={{
                      px: 1.5,
                      py: 0.625,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      color: typeFilter === f ? colorPalette.primary : '#64748b',
                      bgcolor: typeFilter === f ? `${colorPalette.primary}0a` : 'transparent',
                      fontFamily: 'Jost',
                      transition: 'all 0.15s',
                      '&:hover': { color: colorPalette.primary },
                    }}
                  >
                    {f}
                  </Box>
                ))}
              </Stack>
              <DateRangeFilter value={range} onChange={setRange} compact />
            </Stack>
          </Box>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '120px 100px 1fr 130px 130px 100px 130px 32px',
              gap: 2,
              px: 3,
              py: 1.5,
              bgcolor: '#fafbfc',
              borderBottom: '1px solid #eef0f4',
            }}
          >
            {['Filing ID', 'Type', 'Filed', 'Status', 'Filed by', 'Amount', 'Case ref', ''].map((h) => (
              <Typography key={h} sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {h}
              </Typography>
            ))}
          </Box>
          {filings.map((f, i) => {
            const cfg = statusColors[f.status]
            return (
              <Box
                key={f.id}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '120px 100px 1fr 130px 130px 100px 130px 32px',
                  gap: 2,
                  px: 3,
                  py: 1.75,
                  alignItems: 'center',
                  borderBottom: i === filings.length - 1 ? 'none' : '1px solid #f4f5f7',
                  '&:hover': { bgcolor: '#fafbfc' },
                }}
              >
                <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0f172a', fontFamily: 'SF Mono, Monaco, monospace' }}>
                  {f.id}
                </Typography>
                <Chip
                  label={f.type}
                  size="small"
                  sx={{
                    bgcolor: '#f8fafc',
                    color: '#475569',
                    fontWeight: 700,
                    fontSize: '0.625rem',
                    letterSpacing: '0.08em',
                    borderRadius: 0,
                    height: 20,
                    width: 'fit-content',
                  }}
                />
                <Typography sx={{ fontSize: '0.8125rem', color: '#475569', fontFamily: 'SF Mono, Monaco, monospace' }}>
                  {f.filed}
                </Typography>
                <Chip
                  label={f.status}
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
                    width: 'fit-content',
                  }}
                />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  {f.filedBy === 'Eureka' && (
                    <Box sx={{ width: 16, height: 16, bgcolor: colorPalette.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Typography sx={{ fontSize: '0.625rem', color: '#ffffff', fontWeight: 700 }}>E</Typography>
                    </Box>
                  )}
                  <Typography sx={{ fontSize: '0.8125rem', color: '#475569', fontWeight: 500 }}>
                    {f.filedBy}
                  </Typography>
                </Box>
                <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0f172a', fontFamily: 'SF Mono, Monaco, monospace' }}>
                  {f.amount}
                </Typography>
                <Typography sx={{ fontSize: '0.8125rem', color: colorPalette.primary, fontFamily: 'SF Mono, Monaco, monospace', fontWeight: 600, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}>
                  {f.case}
                </Typography>
                <IconButton size="small" disableRipple sx={{ borderRadius: 0, color: '#94a3b8', '&:hover': { color: colorPalette.primary } }}>
                  <FileDownloadOutlinedIcon sx={{ fontSize: '1.125rem' }} />
                </IconButton>
              </Box>
            )
          })}
        </Box>
      </Box>

      <TOTPConfirmation
        open={fileOpen}
        onClose={() => setFileOpen(false)}
        onConfirm={() => setFileOpen(false)}
        operation="create"
        title="File new regulatory report"
        description="Filing a report submits it directly to NFIU or CBN with your CCO sign-off. The submission is final and audit-logged."
        resourceType="Regulatory filing"
        resourceName="New STR/SAR/CBN return"
      />
    </DashboardLayout>
  )
}
