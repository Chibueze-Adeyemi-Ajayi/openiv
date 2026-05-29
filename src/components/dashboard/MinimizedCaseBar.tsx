import { Box, Typography, IconButton, Tooltip } from '@mui/material'
import { colorPalette } from '@/theme'
import { useActiveCase } from '@/contexts/ActiveCaseContext'
import OpenInFullRoundedIcon from '@mui/icons-material/OpenInFullRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined'

const PRIORITY_COLOR: Record<string, string> = {
  critical: '#dc2626',
  high:     '#ea580c',
  medium:   '#f59e0b',
  low:      '#64748b',
}

const STATUS_LABEL: Record<string, string> = {
  open:           'Open',
  investigating:  'Investigating',
  pending_review: 'Pending Review',
  escalated:      'Escalated',
  closed:         'Closed',
}

export default function MinimizedCaseBar() {
  const { caseSnap, isMinimized, expandCase, closeCase } = useActiveCase()

  if (!isMinimized || !caseSnap) return null

  const priorityColor = PRIORITY_COLOR[caseSnap.priority] ?? '#64748b'
  const statusLabel   = STATUS_LABEL[caseSnap.status] ?? caseSnap.status

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 100,
        right: 28,
        width: 308,
        zIndex: 1200,
        bgcolor: 'var(--card-bg)',
        border: '1px solid var(--border-col)',
        boxShadow: '0 12px 40px rgba(15,23,42,0.18)',
        display: 'flex',
        flexDirection: 'column',
        animation: 'caseSlideUp 0.22s cubic-bezier(0.34,1.56,0.64,1)',
        '@keyframes caseSlideUp': {
          from: { opacity: 0, transform: 'translateY(20px) scale(0.97)' },
          to:   { opacity: 1, transform: 'translateY(0) scale(1)' },
        },
      }}
    >
      {/* Title bar — click to expand */}
      <Box
        onClick={expandCase}
        sx={{
          px: 1.5, py: 1,
          bgcolor: colorPalette.primary,
          display: 'flex', alignItems: 'center', gap: 1,
          cursor: 'pointer',
          userSelect: 'none',
          transition: 'background 0.15s',
          '&:hover': { bgcolor: '#1e3a8a' },
        }}
      >
        <GavelOutlinedIcon sx={{ fontSize: '0.875rem', color: '#d9f99d', flexShrink: 0 }} />
        <Typography
          sx={{
            flex: 1, fontSize: '0.8125rem', fontWeight: 600, color: '#ffffff',
            fontFamily: 'Jost', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
        >
          {caseSnap.title}
        </Typography>
        <Tooltip title="Expand case" placement="top">
          <IconButton
            size="small" disableRipple
            onClick={e => { e.stopPropagation(); expandCase() }}
            sx={{ p: 0.375, color: 'rgba(255,255,255,0.6)', borderRadius: 0, '&:hover': { color: '#ffffff', bgcolor: 'rgba(255,255,255,0.12)' } }}
          >
            <OpenInFullRoundedIcon sx={{ fontSize: '0.875rem' }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Close case" placement="top">
          <IconButton
            size="small" disableRipple
            onClick={e => { e.stopPropagation(); closeCase() }}
            sx={{ p: 0.375, color: 'rgba(255,255,255,0.6)', borderRadius: 0, '&:hover': { color: '#ffffff', bgcolor: 'rgba(255,255,255,0.12)' } }}
          >
            <CloseRoundedIcon sx={{ fontSize: '0.875rem' }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Info row */}
      <Box
        onClick={expandCase}
        sx={{
          px: 1.5, py: 0.875,
          display: 'flex', alignItems: 'center', gap: 1.25,
          cursor: 'pointer',
          '&:hover': { bgcolor: 'var(--section-bg)' },
          transition: 'background 0.15s',
        }}
      >
        <Box
          sx={{
            width: 8, height: 8, borderRadius: '50%',
            bgcolor: priorityColor, flexShrink: 0,
            boxShadow: `0 0 0 2px ${priorityColor}30`,
          }}
        />
        <Typography sx={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', fontFamily: 'Jost', fontWeight: 500, flex: 1 }}>
          {caseSnap.priority.charAt(0).toUpperCase() + caseSnap.priority.slice(1)} priority &middot; {statusLabel}
        </Typography>
        <Box sx={{ px: 0.75, py: 0.25, bgcolor: `${colorPalette.primary}0f`, border: `1px solid ${colorPalette.primary}20` }}>
          <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: colorPalette.primary, fontFamily: 'Jost', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Minimized
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}
