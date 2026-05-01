import { Box, Typography, Stack, Chip, Skeleton } from '@mui/material'
import { colorPalette } from '@/theme'
import { useActivityStream, type ActivityEventItem } from '@/hooks/useActivityStream'
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined'
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined'
import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined'

type Severity = 'critical' | 'warning' | 'info' | 'resolved'

interface ActivityFeedProps {
  events?: ActivityEventItem[]
  connected?: boolean
}

const severityConfig: Record<Severity, { color: string; bg: string; label: string }> = {
  critical: { color: '#dc2626', bg: '#fef2f2', label: 'Critical' },
  warning:  { color: '#f59e0b', bg: '#fffbeb', label: 'Warning' },
  info:     { color: colorPalette.primary, bg: `${colorPalette.primary}08`, label: 'Info' },
  resolved: { color: '#10b981', bg: '#f0fdf4', label: 'Resolved' },
}

function eventIcon(e: ActivityEventItem) {
  const sz = { fontSize: '1rem' }
  if (e.severity === 'critical')  return <BlockOutlinedIcon sx={sz} />
  if (e.severity === 'resolved')  return <VerifiedOutlinedIcon sx={sz} />
  if (e.entityType === 'case')    return <GavelOutlinedIcon sx={sz} />
  if (e.source === 'transaction') return <FlagOutlinedIcon sx={sz} />
  return <DescriptionOutlinedIcon sx={sz} />
}

function relativeTime(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60)    return `${Math.round(diff)}s ago`
  if (diff < 3600)  return `${Math.round(diff / 60)} min ago`
  if (diff < 86400) return `${Math.round(diff / 3600)} hr ago`
  return `${Math.round(diff / 86400)}d ago`
}

export default function ActivityFeed({ events: propEvents, connected: propConnected }: ActivityFeedProps = {}) {
  const { events: hookEvents, connected: hookConnected } = useActivityStream()
  const events = propEvents ?? hookEvents
  const connected = propConnected ?? hookConnected

  return (
    <Box
      data-ai-analyzable="true"
      data-ai-description="Live activity stream monitoring real-time transaction flags, compliance alerts, and automated investigator actions."
      sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', height: 708, display: 'flex', flexDirection: 'column' }}
    >
      {/* Header */}
      <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid #eef0f4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
            Live Activity
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
            Real-time alerts and case events
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Box sx={{
            width: 6, height: 6, borderRadius: '50%',
            bgcolor: connected ? '#10b981' : '#f59e0b',
            animation: connected ? 'pulse 2s infinite' : 'none',
            '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } },
          }} />
          <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: connected ? '#10b981' : '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            {connected ? 'Live' : 'Connecting'}
          </Typography>
        </Box>
      </Box>

      <Stack sx={{ flex: 1, overflowY: 'auto' }}>
        {/* Skeleton while first load */}
        {events.length === 0 && !connected && (
          Array.from({ length: 5 }).map((_, i) => (
            <Box key={i} sx={{ px: 3, py: 1.75, borderBottom: '1px solid #f4f5f7', display: 'flex', gap: 1.5 }}>
              <Skeleton variant="rectangular" width={32} height={32} />
              <Box sx={{ flex: 1 }}>
                <Skeleton width="70%" height={18} sx={{ mb: 0.5 }} />
                <Skeleton width="50%" height={14} />
              </Box>
            </Box>
          ))
        )}

        {events.map((e) => {
          const cfg = severityConfig[e.severity] ?? severityConfig.info
          return (
            <Box
              key={e.id}
              data-ai-analyzable="true"
              data-ai-description={`Compliance Event: ${e.title}. ${e.detail ? `Details: ${e.detail}. ` : ''}Severity: ${e.severity}. Action by: ${e.actor}.`}
              sx={{
                px: 3, py: 1.75,
                borderBottom: '1px solid #f4f5f7',
                display: 'flex', gap: 1.5,
                cursor: 'pointer',
                transition: 'background 0.15s',
                '&:hover': { bgcolor: '#fafbfc' },
                '&:last-child': { borderBottom: 'none' },
                animation: 'fadeIn 0.3s ease',
                '@keyframes fadeIn': { from: { opacity: 0, transform: 'translateY(-4px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
              }}
            >
              <Box sx={{ width: 32, height: 32, bgcolor: cfg.bg, color: cfg.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {eventIcon(e)}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 1 }}>
                  <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a', fontFamily: 'Jost', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.title}
                  </Typography>
                  <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', flexShrink: 0, fontWeight: 500 }}>
                    {relativeTime(e.occurredAt)}
                  </Typography>
                </Box>
                {e.detail && (
                  <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mb: 0.75, mt: 0.25 }}>
                    {e.detail}
                  </Typography>
                )}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip
                    label={cfg.label}
                    size="small"
                    sx={{ bgcolor: cfg.bg, color: cfg.color, fontWeight: 700, fontSize: '0.625rem', letterSpacing: '0.1em', textTransform: 'uppercase', borderRadius: 0, height: 18, '& .MuiChip-label': { px: 0.75 } }}
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
