import { useState } from 'react'
import { Box, Typography, Stack, IconButton, CircularProgress } from '@mui/material'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined'
import BlockRoundedIcon from '@mui/icons-material/BlockRounded'
import { colorPalette } from '@/theme'
import { authApi } from '@/api/auth'
import type { SecurityEvent } from '@/contexts/DashboardEventsContext'

function parseUA(ua: string | null): string {
  if (!ua) return 'Unknown browser'
  if (/Chrome/.test(ua) && /Edg/.test(ua)) return 'Edge'
  if (/Chrome/.test(ua) && !/Chromium|OPR/.test(ua)) return 'Chrome'
  if (/Firefox/.test(ua)) return 'Firefox'
  if (/Safari/.test(ua) && !/Chrome/.test(ua)) return 'Safari'
  if (/OPR|Opera/.test(ua)) return 'Opera'
  return 'Browser'
}

function parseOS(ua: string | null): string {
  if (!ua) return ''
  if (/Windows NT/.test(ua)) return 'Windows'
  if (/Mac OS X/.test(ua)) return 'macOS'
  if (/Linux/.test(ua)) return 'Linux'
  if (/Android/.test(ua)) return 'Android'
  if (/iPhone|iPad/.test(ua)) return 'iOS'
  return ''
}

function fmtTime(iso: string) {
  try {
    return new Intl.DateTimeFormat('en-NG', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }).format(new Date(iso))
  } catch { return iso }
}

interface Props {
  event: SecurityEvent
  onDismiss: () => void
}

export default function LoginAttemptAlert({ event, onDismiss }: Props) {
  const [blocking,  setBlocking]  = useState(false)
  const [blocked,   setBlocked]   = useState(false)
  const [blockErr,  setBlockErr]  = useState<string | null>(null)

  const browser = parseUA(event.userAgent)
  const os      = parseOS(event.userAgent)

  const handleBlock = async () => {
    if (!event.deviceId || blocking || blocked) return
    setBlocking(true)
    setBlockErr(null)
    try {
      await authApi.blockDevice(event.deviceId, event.ip, event.userAgent)
      setBlocked(true)
    } catch {
      setBlockErr('Failed to block device. Please try again.')
    } finally {
      setBlocking(false)
    }
  }

  return (
    <Box sx={{
      position: 'fixed', bottom: 24, right: 24, width: 360,
      bgcolor: '#ffffff', border: '1px solid #fef2f2',
      boxShadow: '0 16px 48px rgba(220,38,38,0.14)',
      zIndex: 1500,
      animation: 'alertSlideIn 0.3s cubic-bezier(0.34,1.56,0.64,1)',
      '@keyframes alertSlideIn': {
        from: { opacity: 0, transform: 'translateY(24px) scale(0.97)' },
        to:   { opacity: 1, transform: 'translateY(0) scale(1)' },
      },
    }}>
      {/* Header */}
      <Box sx={{ px: 2, pt: 2, pb: 1.25, display: 'flex', alignItems: 'flex-start', gap: 1.25,
        borderBottom: '1px solid #fef2f2' }}>
        <Box sx={{ width: 32, height: 32, bgcolor: '#fef2f2', display: 'flex',
          alignItems: 'center', justifyContent: 'center', flexShrink: 0, mt: 0.125 }}>
          <ShieldOutlinedIcon sx={{ fontSize: '1rem', color: '#dc2626' }} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
            Login attempt detected
          </Typography>
          <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', mt: 0.25 }}>
            Someone tried to sign in to your account
          </Typography>
        </Box>
        <IconButton disableRipple size="small" onClick={onDismiss}
          sx={{ color: '#94a3b8', borderRadius: 0, p: 0.25, '&:hover': { color: '#475569' } }}>
          <CloseRoundedIcon sx={{ fontSize: '0.9375rem' }} />
        </IconButton>
      </Box>

      {/* Details */}
      <Box sx={{ px: 2, py: 1.75 }}>
        <Stack gap={0.875}>
          <Detail label="IP Address" value={event.ip ?? 'Unknown'} mono />
          <Detail label="Browser"    value={[browser, os].filter(Boolean).join(' · ') || 'Unknown'} />
          <Detail label="Time"       value={fmtTime(event.at)} mono />
          {event.deviceId && (
            <Detail label="Device ID" value={event.deviceId.slice(0, 18) + '…'} mono />
          )}
        </Stack>
      </Box>

      {/* Actions */}
      <Box sx={{ px: 2, pb: 2, display: 'flex', gap: 1 }}>
        {blocked ? (
          <Box sx={{ flex: 1, py: 0.875, bgcolor: '#f0fdf4', border: '1px solid #86efac',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75 }}>
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#10b981' }} />
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981', fontFamily: 'Jost' }}>
              Device blocked
            </Typography>
          </Box>
        ) : event.deviceId ? (
          <Box
            onClick={handleBlock}
            sx={{
              flex: 1, py: 0.875, bgcolor: '#fef2f2', border: '1px solid #fca5a5',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75,
              cursor: blocking ? 'not-allowed' : 'pointer',
              opacity: blocking ? 0.7 : 1,
              transition: 'all 0.15s',
              '&:hover': { bgcolor: '#fee2e2', borderColor: '#dc2626' },
            }}
          >
            {blocking
              ? <CircularProgress size={12} sx={{ color: '#dc2626' }} />
              : <BlockRoundedIcon sx={{ fontSize: '0.875rem', color: '#dc2626' }} />}
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#dc2626', fontFamily: 'Jost' }}>
              Block this device
            </Typography>
          </Box>
        ) : null}

        <Box
          onClick={onDismiss}
          sx={{
            px: 1.5, py: 0.875, border: '1px solid #e2e8f0', cursor: 'pointer',
            display: 'flex', alignItems: 'center',
            transition: 'all 0.15s', '&:hover': { borderColor: '#94a3b8' },
          }}
        >
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', fontFamily: 'Jost' }}>
            Dismiss
          </Typography>
        </Box>
      </Box>

      {blockErr && (
        <Box sx={{ px: 2, pb: 1.5 }}>
          <Typography sx={{ fontSize: '0.6875rem', color: '#dc2626' }}>{blockErr}</Typography>
        </Box>
      )}
    </Box>
  )
}

function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'baseline' }}>
      <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8',
        textTransform: 'uppercase', letterSpacing: '0.08em', minWidth: 76, flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: '0.75rem', color: '#0f172a', fontFamily: mono ? 'SF Mono, Monaco, monospace' : 'Jost',
        fontWeight: mono ? 500 : 400, wordBreak: 'break-all' }}>
        {value}
      </Typography>
    </Box>
  )
}
