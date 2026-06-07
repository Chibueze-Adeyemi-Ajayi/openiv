import { Box, InputBase, IconButton, Typography, Badge, Popover, useTheme } from '@mui/material'
import { colorPalette } from '@/theme'
import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import CommandPalette from './CommandPalette'
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined'
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined'
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import { useSandbox } from '@/contexts/SandboxContext'
import { useProfile } from '@/contexts/ProfileContext'
import { resolveMediaUrl } from '@/api/client'
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined'
import { useDashboardEvents, useDashboardEventsMut } from '@/contexts/DashboardEventsContext'
import { notificationsApi, notifSeverity, type NotificationItem } from '@/api/notifications'

const sevConfig: Record<string, { color: string; bg: string; icon: React.ReactNode }> = {
  critical: { color: '#dc2626', bg: '#fef2f2', icon: <ErrorOutlineRoundedIcon sx={{ fontSize: '0.9rem' }} /> },
  warning:  { color: '#f59e0b', bg: '#fffbeb', icon: <WarningAmberRoundedIcon sx={{ fontSize: '0.9rem' }} /> },
  info:     { color: colorPalette.primary, bg: `${colorPalette.primary}10`, icon: <InfoOutlinedIcon sx={{ fontSize: '0.9rem' }} /> },
  success:  { color: '#10b981', bg: '#f0fdf4', icon: <InfoOutlinedIcon sx={{ fontSize: '0.9rem' }} /> },
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diffMs / 60_000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function getInitials(fullName: string | null | undefined, email: string | null | undefined): string {
  if (fullName && fullName.trim()) {
    const words = fullName.trim().split(/\s+/)
    if (words.length === 1) return words[0][0].toUpperCase()
    return (words[0][0] + words[words.length - 1][0]).toUpperCase()
  }
  if (email) return email[0].toUpperCase()
  return '?'
}

export default function Topbar(_props?: Record<string, unknown>) {
  const muiTheme = useTheme()
  const isDark = muiTheme.palette.mode === 'dark'
  const { sandboxEnabled } = useSandbox()
  const { notifications } = useDashboardEvents()
  const { markNotifRead, markAllNotifsRead } = useDashboardEventsMut()
  const { profile } = useProfile()
  const navigate = useNavigate()
  const location = useLocation()
  const initials = getInitials(profile?.fullName, profile?.email)
  const [notifAnchor, setNotifAnchor] = useState<HTMLElement | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const unreadCount = notifications.filter((n) => n.status === 'unread').length

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setPaletteOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleMarkAllRead = async () => {
    markAllNotifsRead()
    await notificationsApi.markAllRead().catch(() => {})
  }

  const handleNotifClick = async (n: NotificationItem) => {
    setNotifAnchor(null)
    if (n.status === 'unread') {
      markNotifRead(n.id)
      notificationsApi.markRead(n.id).catch(() => {})
    }
    navigate('/dashboard/notifications', {
      state: { from: location.pathname, openNotifId: n.id },
    })
  }

  const handleEntityClick = (e: React.MouseEvent, n: NotificationItem) => {
    e.stopPropagation()
    if (!n.entityId || !n.entityType) return
    setNotifAnchor(null)
    if (n.status === 'unread') {
      markNotifRead(n.id)
      notificationsApi.markRead(n.id).catch(() => {})
    }
    const dest = n.entityType === 'transaction'
      ? `/dashboard/transactions?tx=${encodeURIComponent(n.entityId)}`
      : `/dashboard/aml?case=${encodeURIComponent(n.entityId)}`
    navigate(dest, {
      state: { breadcrumbs: [{ label: 'Notifications', path: '/dashboard/notifications' }] },
    })
  }

  const handleViewAll = () => {
    setNotifAnchor(null)
    navigate('/dashboard/notifications', {
      state: { from: location.pathname, scrollY: window.scrollY },
    })
  }

  const surface = isDark ? '#111114' : '#ffffff'
  const surfaceLow = isDark ? '#181818' : '#f1f5f9'
  const border = isDark ? '#2c2c30' : '#e2e8f0'
  const textPrimary = muiTheme.palette.text.primary
  const textMuted = muiTheme.palette.text.secondary

  const iconBtn = {
    color: textMuted,
    width: 38,
    height: 38,
    borderRadius: 0,
    transition: 'all 0.18s',
    '&:hover': { bgcolor: surfaceLow, color: muiTheme.palette.primary.main },
  }

  return (
    <Box
      sx={{
        height: 64,
        px: 4,
        bgcolor: surface,
        borderBottom: `1px solid ${border}`,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        position: 'sticky',
        top: 0,
        zIndex: 10,
        color: textPrimary,
      }}
    >
      {/* Search — click or ⌘K to open command palette */}
      <Box
        data-ai-analyzable="true"
        data-ai-description="Intelligent Search: Find transactions, customers, or cases instantly using semantic search logic."
        onClick={() => setPaletteOpen(true)}
        sx={{
          flex: 1,
          maxWidth: 480,
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          bgcolor: surfaceLow,
          px: 2,
          height: 38,
          cursor: 'pointer',
          transition: 'all 0.18s ease',
          border: '1px solid transparent',
          '&:hover': { borderColor: border, bgcolor: isDark ? '#202536' : '#e8eef5' },
        }}
      >
        <SearchOutlinedIcon sx={{ fontSize: '1.125rem', color: textMuted }} />
        <InputBase
          placeholder="Search transactions, customers, cases…"
          readOnly
          inputProps={{ style: { cursor: 'pointer' } }}
          sx={{
            flex: 1,
            fontSize: '0.875rem',
            fontFamily: 'Jost',
            color: textPrimary,
            pointerEvents: 'none',
            '& input::placeholder': { color: textMuted, opacity: 1 },
          }}
        />
        <Box
          sx={{
            display: { xs: 'none', md: 'flex' },
            alignItems: 'center',
            gap: 0.5,
            px: 1,
            py: 0.25,
            border: `1px solid ${border}`,
            bgcolor: surface,
            fontSize: '0.6875rem',
            color: textMuted,
            fontWeight: 600,
            borderRadius: '4px',
            flexShrink: 0,
          }}
        >
          ⌘K
        </Box>
      </Box>

      <Box sx={{ flex: 1 }} />
      
      {/* Sandbox Indicator */}
      {sandboxEnabled && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 1.5,
            py: 0.5,
            bgcolor: '#fff7ed',
            border: '1px solid #ffedd5',
            borderRadius: '4px',
            color: '#c2410c',
            animation: 'pulseSandbox 2s infinite',
            '@keyframes pulseSandbox': {
              '0%, 100%': { opacity: 1 },
              '50%': { opacity: 0.7 },
            }
          }}
        >
          <ScienceOutlinedIcon sx={{ fontSize: '1rem' }} />
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 800, fontFamily: 'Jost', letterSpacing: '0.05em' }}>
            SANDBOX ACTIVE
          </Typography>
        </Box>
      )}

      {/* Profile Avatar */}
      <IconButton
        disableRipple
        onClick={() => navigate('/dashboard/profile')}
        title={profile?.fullName ?? profile?.email ?? 'My Profile'}
        sx={{ width: 38, height: 38, borderRadius: 0, p: 0, '&:hover': { bgcolor: surfaceLow } }}
      >
        <Box sx={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
          {resolveMediaUrl((profile as { avatarUrl?: string } | null)?.avatarUrl) ? (
            <Box
              component="img"
              src={resolveMediaUrl((profile as { avatarUrl?: string }).avatarUrl)!}
              alt={profile?.fullName ?? 'Avatar'}
              sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <Box sx={{
              width: '100%', height: '100%',
              bgcolor: colorPalette.primary, color: '#ffffff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.75rem', fontWeight: 700, fontFamily: 'Jost',
            }}>
              {initials}
            </Box>
          )}
        </Box>
      </IconButton>

      {/* Notifications */}
      <IconButton
        disableRipple
        onClick={(e) => setNotifAnchor(e.currentTarget)}
        sx={iconBtn}
      >
        <Badge
          badgeContent={unreadCount}
          sx={{
            '& .MuiBadge-badge': {
              bgcolor: '#dc2626',
              color: '#ffffff',
              fontSize: '0.625rem',
              fontWeight: 700,
              minWidth: 16,
              height: 16,
            },
          }}
        >
          <NotificationsNoneOutlinedIcon sx={{ fontSize: '1.25rem' }} />
        </Badge>
      </IconButton>

      {/* === Notifications Popover === */}
      <Popover
        open={!!notifAnchor}
        anchorEl={notifAnchor}
        onClose={() => setNotifAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { mt: 1, width: 380, maxHeight: 520, borderRadius: 0, border: `1px solid ${border}`, boxShadow: '0 16px 48px rgba(15,23,42,0.18)' } } }}
      >
        {/* Header */}
        <Box sx={{ px: 2.5, py: 2, borderBottom: `1px solid ${border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: muiTheme.palette.primary.main, fontFamily: 'Jost' }}>Notifications</Typography>
            <Typography sx={{ fontSize: '0.6875rem', color: textMuted }}>
              {unreadCount} unread · {notifications.length} total
            </Typography>
          </Box>
          {unreadCount > 0 && (
            <Typography
              onClick={handleMarkAllRead}
              sx={{ fontSize: '0.75rem', fontWeight: 600, color: muiTheme.palette.primary.main, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
            >
              Mark all read
            </Typography>
          )}
        </Box>

        {/* List */}
        <Box sx={{ overflowY: 'auto', maxHeight: 400 }}>
          {notifications.length === 0 && (
            <Box sx={{ py: 5, textAlign: 'center', color: textMuted }}>
              <NotificationsNoneOutlinedIcon sx={{ fontSize: '2rem', mb: 1, display: 'block', mx: 'auto' }} />
              <Typography sx={{ fontSize: '0.8125rem' }}>No notifications yet</Typography>
            </Box>
          )}
          {notifications.slice(0, 20).map((n) => {
            const sev = notifSeverity(n.type)
            const cfg = sevConfig[sev]
            const unread = n.status === 'unread'
            return (
              <Box
                key={n.id}
                onClick={() => handleNotifClick(n)}
                sx={{
                  px: 2.5, py: 1.75, display: 'flex', gap: 1.25, cursor: 'pointer',
                  borderBottom: `1px solid ${border}`, position: 'relative',
                  bgcolor: unread ? `${muiTheme.palette.primary.main}08` : 'transparent',
                  transition: 'background 0.15s',
                  '&:hover': { bgcolor: surfaceLow },
                  '&:last-child': { borderBottom: 'none' },
                }}
              >
                {unread && (
                  <Box sx={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', width: 6, height: 6, borderRadius: '50%', bgcolor: muiTheme.palette.primary.main }} />
                )}
                <Box sx={{ width: 28, height: 28, bgcolor: cfg.bg, color: cfg.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {cfg.icon}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <Typography sx={{ fontSize: '0.8125rem', fontWeight: unread ? 700 : 500, color: muiTheme.palette.primary.main, fontFamily: 'Jost', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {n.title}
                    </Typography>
                    <Typography sx={{ fontSize: '0.625rem', color: textMuted, flexShrink: 0, ml: 1, fontWeight: 500 }}>
                      {timeAgo(n.createdAt)}
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: '0.75rem', color: textMuted, mt: 0.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {n.body}
                  </Typography>
                  {n.entityId && n.entityType && (
                    <Box
                      onClick={(e) => handleEntityClick(e, n)}
                      sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mt: 0.75, px: 1, py: 0.25, bgcolor: `${muiTheme.palette.primary.main}0c`, border: `1px solid ${muiTheme.palette.primary.main}20`, borderRadius: '3px', cursor: 'pointer', '&:hover': { bgcolor: `${muiTheme.palette.primary.main}18` } }}>
                      {n.entityType === 'transaction'
                        ? <ReceiptLongOutlinedIcon sx={{ fontSize: '0.625rem', color: muiTheme.palette.primary.main }} />
                        : <GavelOutlinedIcon sx={{ fontSize: '0.625rem', color: muiTheme.palette.primary.main }} />
                      }
                      <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: muiTheme.palette.primary.main, fontFamily: 'Jost', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        View {n.entityType === 'transaction' ? 'Transaction' : 'Case'}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Box>
            )
          })}
        </Box>

        {/* Footer */}
        <Box sx={{ px: 2.5, py: 1.5, borderTop: `1px solid ${border}`, textAlign: 'center', bgcolor: surfaceLow }}>
          <Typography onClick={handleViewAll} sx={{ fontSize: '0.75rem', fontWeight: 600, color: muiTheme.palette.primary.main, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}>
            View all activity
          </Typography>
        </Box>
      </Popover>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />

    </Box>
  )
}
