import { Box, Typography, Stack, Chip, Button, IconButton, InputBase } from '@mui/material'
import { colorPalette } from '@/theme'
import DashboardLayout from '@/components/dashboard/DashboardLayout'
import TOTPConfirmation from '@/components/dashboard/TOTPConfirmation'
import DateRangeFilter, { type DateRange } from '@/components/dashboard/DateRangeFilter'
import { useState } from 'react'
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined'
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded'

const cases = [
  { id: 'CASE-0921', subject: 'Adamu Ibrahim · ACC-1729', typology: 'BDC structuring', risk: 92, opened: '2 hours ago', assignee: 'Adaeze C.', status: 'open', sla: '6h' },
  { id: 'CASE-0920', subject: 'Onitsha mule cluster', typology: 'Layering — 7 accounts', risk: 88, opened: '4 hours ago', assignee: 'Bashir M.', status: 'investigating', sla: '12h' },
  { id: 'CASE-0918', subject: 'Folake Adesanya · ACC-2840', typology: 'Velocity breach', risk: 76, opened: '6 hours ago', assignee: 'Ifeoma E.', status: 'investigating', sla: '18h' },
  { id: 'CASE-0917', subject: 'Cayman Holdings inflow', typology: 'Cross-border anomaly', risk: 95, opened: '8 hours ago', assignee: 'Adaeze C.', status: 'escalated', sla: '4h' },
  { id: 'CASE-0915', subject: 'Sokoto FX Bureau pattern', typology: 'Smurfing', risk: 84, opened: 'Yesterday', assignee: 'Tunde B.', status: 'open', sla: 'Overdue' },
]

const statusColors: Record<string, { bg: string; color: string }> = {
  open: { bg: '#fffbeb', color: '#f59e0b' },
  investigating: { bg: `${colorPalette.primary}10`, color: colorPalette.primary },
  escalated: { bg: '#fef2f2', color: '#dc2626' },
}

const statusFilters = ['All', 'Open', 'Investigating', 'Escalated']

export default function AMLPage() {
  const [openCaseModal, setOpenCaseModal] = useState(false)
  const [range, setRange] = useState<DateRange>('7d')
  const [statusFilter, setStatusFilter] = useState('All')
  const [search, setSearch] = useState('')
  return (
    <DashboardLayout>
      <Box sx={{ p: 4 }}>
        <Box sx={{ mb: 4 }}>
          <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: colorPalette.primary, letterSpacing: '0.14em', textTransform: 'uppercase', mb: 0.75 }}>
            Investigations
          </Typography>
          <Typography sx={{ fontSize: '1.625rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost', letterSpacing: '-0.015em', mb: 0.5 }}>
            AML & Cases
          </Typography>
          <Typography sx={{ fontSize: '0.9375rem', color: '#64748b' }}>
            Active investigations, SLA tracking, and case-management workflow
          </Typography>
        </Box>

        {/* Stats */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, mb: 3 }}>
          {[
            { label: 'Open cases', value: '34', color: '#f59e0b' },
            { label: 'Escalated', value: '7', color: '#dc2626' },
            { label: 'Closed today', value: '12', color: '#10b981' },
            { label: 'Avg. resolution', value: '4.2h', color: colorPalette.primary },
          ].map((s) => (
            <Box key={s.label} sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', p: 2.25 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: s.color }} />
                <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                  {s.label}
                </Typography>
              </Box>
              <Typography sx={{ fontSize: '1.625rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
                {s.value}
              </Typography>
            </Box>
          ))}
        </Box>

        {/* Case list */}
        <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4' }}>
          <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid #eef0f4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
                Active investigations
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
                Sorted by risk score · click any case for full timeline
              </Typography>
            </Box>
            <Button
              onClick={() => setOpenCaseModal(true)}
              startIcon={<GavelOutlinedIcon sx={{ fontSize: '1rem !important' }} />}
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
              Open Case
            </Button>
          </Box>

          {/* Filter bar */}
          <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid #eef0f4', display: 'flex', alignItems: 'center', gap: 2 }}>
            <Stack direction="row" gap={0.5}>
              {statusFilters.map((f) => (
                <Box
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  sx={{
                    px: 1.75,
                    py: 0.875,
                    fontSize: '0.8125rem',
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
                minWidth: 220,
                border: '1px solid transparent',
                transition: 'all 0.18s',
                '&:focus-within': { bgcolor: '#ffffff', borderColor: colorPalette.primary },
              }}
            >
              <SearchOutlinedIcon sx={{ fontSize: '1rem', color: '#94a3b8' }} />
              <InputBase
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by case ID or subject…"
                sx={{ flex: 1, fontSize: '0.8125rem', fontFamily: 'Jost', color: '#0f172a' }}
              />
            </Box>
          </Box>

          {cases.map((c, i) => {
            const cfg = statusColors[c.status]
            const isOverdue = c.sla === 'Overdue'
            return (
              <Box
                key={c.id}
                sx={{
                  px: 3,
                  py: 2.25,
                  borderBottom: i === cases.length - 1 ? 'none' : '1px solid #f4f5f7',
                  display: 'grid',
                  gridTemplateColumns: '110px 1fr 200px 80px 120px 130px 120px 32px 32px',
                  gap: 2,
                  alignItems: 'center',
                  transition: 'background 0.15s',
                  cursor: 'pointer',
                  '&:hover': { bgcolor: '#fafbfc' },
                }}
              >
                <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: colorPalette.primary, fontFamily: 'SF Mono, Monaco, monospace' }}>
                  {c.id}
                </Typography>
                <Box>
                  <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a', fontFamily: 'Jost' }}>
                    {c.subject}
                  </Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
                    Opened {c.opened}
                  </Typography>
                </Box>
                <Typography sx={{ fontSize: '0.8125rem', color: '#475569', fontWeight: 500 }}>
                  {c.typology}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Box sx={{ width: 36, height: 4, bgcolor: '#f1f5f9', position: 'relative' }}>
                    <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${c.risk}%`, bgcolor: c.risk >= 80 ? '#dc2626' : '#f59e0b' }} />
                  </Box>
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#0f172a' }}>{c.risk}</Typography>
                </Box>
                <Chip
                  label={c.status.toUpperCase()}
                  size="small"
                  sx={{
                    bgcolor: cfg.bg,
                    color: cfg.color,
                    fontWeight: 700,
                    fontSize: '0.625rem',
                    letterSpacing: '0.1em',
                    borderRadius: 0,
                    height: 20,
                    width: 'fit-content',
                  }}
                />
                <Typography sx={{ fontSize: '0.8125rem', color: '#475569' }}>
                  {c.assignee}
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: isOverdue ? '#dc2626' : c.sla === '4h' || c.sla === '6h' ? '#f59e0b' : '#10b981',
                  }}
                >
                  SLA · {c.sla}
                </Typography>
                <IconButton size="small" disableRipple sx={{ borderRadius: 0, color: '#94a3b8' }}>
                  <ArrowForwardRoundedIcon sx={{ fontSize: '1rem' }} />
                </IconButton>
                <IconButton size="small" disableRipple sx={{ borderRadius: 0, color: '#94a3b8' }}>
                  <MoreHorizRoundedIcon sx={{ fontSize: '1.125rem' }} />
                </IconButton>
              </Box>
            )
          })}
        </Box>
      </Box>

      <TOTPConfirmation
        open={openCaseModal}
        onClose={() => setOpenCaseModal(false)}
        onConfirm={() => setOpenCaseModal(false)}
        operation="create"
        title="Open new investigation case"
        description="Opening a case logs the investigation in the audit trail and may trigger notifications to the customer per CBN guidelines. Confirm with your authenticator code."
        resourceType="Investigation case"
        resourceName="New case — details after authorization"
      />
    </DashboardLayout>
  )
}
