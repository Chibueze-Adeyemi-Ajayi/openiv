import { Box, Typography, Stack, Chip } from '@mui/material'
import { colorPalette } from '@/theme'
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined'
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined'
import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'

type Severity = 'critical' | 'warning' | 'info' | 'resolved'

const severityConfig: Record<Severity, { color: string; bg: string; label: string }> = {
  critical: { color: '#dc2626', bg: '#fef2f2', label: 'Critical' },
  warning: { color: '#f59e0b', bg: '#fffbeb', label: 'Warning' },
  info: { color: colorPalette.primary, bg: `${colorPalette.primary}08`, label: 'Info' },
  resolved: { color: '#10b981', bg: '#f0fdf4', label: 'Resolved' },
}

const events = [
  {
    id: 1,
    severity: 'critical' as Severity,
    icon: <BlockOutlinedIcon sx={{ fontSize: '1rem' }} />,
    title: 'SIM-swap cluster detected · Lagos',
    detail: '4 accounts · matched typology #SST-04',
    time: '2 min ago',
    actor: 'Auto-detection',
  },
  {
    id: 2,
    severity: 'warning' as Severity,
    icon: <FlagOutlinedIcon sx={{ fontSize: '1rem' }} />,
    title: 'Threshold breached · BDC outflow',
    detail: '₦14.2M to single beneficiary in 3h',
    time: '11 min ago',
    actor: 'Sokoto branch',
  },
  {
    id: 3,
    severity: 'info' as Severity,
    icon: <DescriptionOutlinedIcon sx={{ fontSize: '1rem' }} />,
    title: 'NFIU STR filed · Case #4827',
    detail: 'Auto-generated, awaiting senior review',
    time: '34 min ago',
    actor: 'Eureka',
  },
  {
    id: 4,
    severity: 'resolved' as Severity,
    icon: <VerifiedOutlinedIcon sx={{ fontSize: '1rem' }} />,
    title: 'Account #ACC-9281 cleared',
    detail: 'False positive · payroll cycle confirmed',
    time: '1 hr ago',
    actor: 'Adaeze C.',
  },
  {
    id: 5,
    severity: 'critical' as Severity,
    icon: <BlockOutlinedIcon sx={{ fontSize: '1rem' }} />,
    title: 'Mule corridor · Onitsha → Aba',
    detail: '7 accounts, ₦8.4M layered transfers',
    time: '2 hr ago',
    actor: 'Pattern engine',
  },
  {
    id: 6,
    severity: 'warning' as Severity,
    icon: <FlagOutlinedIcon sx={{ fontSize: '1rem' }} />,
    title: 'OTP abuse pattern · Port Harcourt',
    detail: '23 retries in 6 minutes from 4 IPs',
    time: '3 hr ago',
    actor: 'Auto-detection',
  },
]

export default function ActivityFeed() {
  return (
    <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', height: '100%', display: 'flex', flexDirection: 'column' }}>
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
            Live Activity
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
            Real-time alerts and case events
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Box
            sx={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              bgcolor: '#10b981',
              animation: 'pulse 2s infinite',
              '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } },
            }}
          />
          <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Live
          </Typography>
        </Box>
      </Box>

      <Stack sx={{ flex: 1, overflowY: 'auto' }}>
        {events.map((e) => {
          const cfg = severityConfig[e.severity]
          return (
            <Box
              key={e.id}
              sx={{
                px: 3,
                py: 1.75,
                borderBottom: '1px solid #f4f5f7',
                display: 'flex',
                gap: 1.5,
                cursor: 'pointer',
                transition: 'background 0.15s',
                '&:hover': { bgcolor: '#fafbfc' },
                '&:last-child': { borderBottom: 'none' },
              }}
            >
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  bgcolor: cfg.bg,
                  color: cfg.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {e.icon}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 1 }}>
                  <Typography
                    sx={{
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: '#0f172a',
                      fontFamily: 'Jost',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {e.title}
                  </Typography>
                  <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', flexShrink: 0, fontWeight: 500 }}>
                    {e.time}
                  </Typography>
                </Box>
                <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mb: 0.75, mt: 0.25 }}>
                  {e.detail}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip
                    label={cfg.label}
                    size="small"
                    sx={{
                      bgcolor: cfg.bg,
                      color: cfg.color,
                      fontWeight: 700,
                      fontSize: '0.625rem',
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      borderRadius: 0,
                      height: 18,
                      '& .MuiChip-label': { px: 0.75 },
                    }}
                  />
                  <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8' }}>
                    via {e.actor}
                  </Typography>
                </Box>
              </Box>
            </Box>
          )
        })}
      </Stack>
    </Box>
  )
}
