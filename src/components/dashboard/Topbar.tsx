import { Box, InputBase, IconButton, Typography, Badge, Popover, Stack, Chip, Divider } from '@mui/material'
import { colorPalette } from '@/theme'
import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined'
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined'
import HelpOutlineOutlinedIcon from '@mui/icons-material/HelpOutlineOutlined'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined'
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded'
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined'
import KeyboardOutlinedIcon from '@mui/icons-material/KeyboardOutlined'
import PsychologyIcon from '@mui/icons-material/Psychology'
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import NotificationsOffOutlinedIcon from '@mui/icons-material/NotificationsOffOutlined'
import { useEureka } from '@/contexts/EurekaContext'
import { useSandbox } from '@/contexts/SandboxContext'
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined'
import { useDashboardEvents, useDashboardEventsMut } from '@/contexts/DashboardEventsContext'
import { notificationsApi, notifSeverity, type NotificationItem } from '@/api/notifications'

interface TopbarProps {
  onOpenEureka?: () => void
}

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

export default function Topbar({ onOpenEureka }: TopbarProps) {
  const { eurekaEnabled, setEurekaEnabled, isLoading } = useEureka()
  const { sandboxEnabled } = useSandbox()
  const { notifications } = useDashboardEvents()
  const { markNotifRead, markAllNotifsRead } = useDashboardEventsMut()
  const navigate = useNavigate()
  const location = useLocation()
  const [notifAnchor, setNotifAnchor] = useState<HTMLElement | null>(null)
  const [helpAnchor, setHelpAnchor] = useState<HTMLElement | null>(null)
  const unreadCount = notifications.filter((n) => n.status === 'unread').length

  const handleMarkAllRead = async () => {
    markAllNotifsRead()
    await notificationsApi.markAllRead().catch(() => {})
  }

  const handleNotifClick = async (n: NotificationItem) => {
    setNotifAnchor(null)
    navigate('/dashboard/notifications', {
      state: { from: location.pathname, openNotifId: n.id },
    })
    if (n.status === 'unread') {
      markNotifRead(n.id)
      await notificationsApi.markRead(n.id).catch(() => {})
    }
  }

  const handleViewAll = () => {
    setNotifAnchor(null)
    navigate('/dashboard/notifications', {
      state: { from: location.pathname, scrollY: window.scrollY },
    })
  }

  const iconBtn = {
    color: '#475569',
    width: 38,
    height: 38,
    borderRadius: 0,
    transition: 'all 0.18s',
    '&:hover': { bgcolor: '#f1f5f9', color: '#00288e' },
  }

  return (
    <Box
      sx={{
        height: 64,
        px: 4,
        bgcolor: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        position: 'sticky',
        top: 0,
        zIndex: 10,
        color: '#0f172a',
      }}
    >
      {/* Search */}
      <Box
        data-ai-analyzable="true"
        data-ai-description="Intelligent Search: Find transactions, customers, or cases instantly using semantic search logic."
        sx={{
          flex: 1,
          maxWidth: 480,
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          bgcolor: '#f1f5f9',
          px: 2,
          height: 38,
          transition: 'all 0.18s ease',
          '&:focus-within': {
            bgcolor: '#ffffff',
            boxShadow: `0 0 0 3px rgba(0, 40, 142, 0.05)`,
            borderColor: '#00288e',
          },
          border: '1px solid transparent',
          '&:hover': { borderColor: '#e2e8f0' },
        }}
      >
        <SearchOutlinedIcon sx={{ fontSize: '1.125rem', color: '#64748b' }} />
        <InputBase
          placeholder="Search transactions, customers, cases…"
          sx={{
            flex: 1,
            fontSize: '0.875rem',
            fontFamily: 'Jost',
            color: '#000000',
            '& input::placeholder': { color: '#94a3b8', opacity: 1 },
          }}
        />
          <Box
            sx={{
              display: { xs: 'none', md: 'flex' },
              alignItems: 'center',
              gap: 0.5,
              px: 1,
              py: 0.25,
              border: '1px solid #e2e8f0',
              bgcolor: '#ffffff',
              fontSize: '0.6875rem',
              color: '#94a3b8',
              fontWeight: 600,
              borderRadius: '4px',
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

      {/* Eureka AI Companion Indicator */}
      <Box
        onClick={() => setEurekaEnabled(!eurekaEnabled)}
        data-ai-analyzable="true"
        data-ai-description={`Eureka Realtime Buddy Control. Status: ${eurekaEnabled ? 'Active' : 'Inactive'}. When active, hovering sidebar items triggers AI insights.`}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          cursor: 'pointer',
          userSelect: 'none',
          opacity: isLoading ? 0.6 : 1,
          pointerEvents: isLoading ? 'none' : 'auto',
          px: 1.75,
          py: 1,
          borderRadius: '10px',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          position: 'relative',
          '&:hover': {
            bgcolor: '#f1f5f9'
          },
        }}
      >
        {/* AI Companion Avatar */}
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            bgcolor: eurekaEnabled ? '#d9f99d' : '#f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            position: 'relative',
            boxShadow: eurekaEnabled ? `0 0 0 2px rgba(217, 249, 157, 0.2), 0 2px 8px rgba(217, 249, 157, 0.15)` : 'none',
            '&::after': eurekaEnabled ? {
              content: '""',
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: `2px solid #d9f99d`,
              opacity: 0.3,
              animation: 'pulse-ring 2s ease-in-out infinite',
            } : 'none',
          }}
        >
          <PsychologyIcon sx={{ fontSize: '1.125rem', color: eurekaEnabled ? '#00288e' : '#94a3b8' }} />
        </Box>

        {/* Status Label */}
        <Stack direction="column" spacing={0.25} alignItems="flex-start">
          <Typography
            sx={{
              fontSize: '0.6875rem',
              fontWeight: 700,
              color: '#94a3b8',
              fontFamily: 'Jost',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            AI Helper
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box
              sx={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                bgcolor: eurekaEnabled ? '#10b981' : 'rgba(255,255,255,0.2)',
                animation: eurekaEnabled ? 'pulse 2s ease-in-out infinite' : 'none',
              }}
            />
            <Typography
              sx={{
                fontSize: '0.625rem',
                fontWeight: 600,
                color: eurekaEnabled ? '#10b981' : '#94a3b8',
                fontFamily: 'Jost',
                letterSpacing: '0.05em',
              }}
            >
              {eurekaEnabled ? 'ACTIVE' : 'OFF'}
            </Typography>
          </Box>
        </Stack>
      </Box>

      {/* Eureka Trigger */}
      <Box
        onClick={onOpenEureka}
        data-ai-analyzable="true"
        data-ai-description="Instant Eureka Insight: Click to get context-aware analysis of the current screen and active security events."
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.75,
          height: 38,
          bgcolor: '#d9f99d',
          border: `1px solid #d9f99d`,
          cursor: 'pointer',
          transition: 'all 0.18s ease',
          '&:hover': {
            bgcolor: '#bef264',
            boxShadow: `0 4px 12px rgba(217, 249, 157, 0.3)`,
            transform: 'translateY(-1px)',
          },
        }}
      >
        <AutoAwesomeOutlinedIcon sx={{ fontSize: '1rem', color: '#00288e' }} />
        <Typography
          sx={{
            fontSize: '0.8125rem',
            fontWeight: 800,
            color: '#00288e',
            fontFamily: 'Jost',
          }}
        >
          Ask Eureka
        </Typography>
      </Box>

      {/* Info / Help */}
      <IconButton
        disableRipple
        onClick={(e) => setHelpAnchor(e.currentTarget)}
        sx={iconBtn}
      >
        <HelpOutlineOutlinedIcon sx={{ fontSize: '1.25rem' }} />
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
        slotProps={{ paper: { sx: { mt: 1, width: 380, maxHeight: 520, borderRadius: 0, border: '1px solid #eef0f4', boxShadow: '0 16px 48px rgba(15,23,42,0.12)' } } }}
      >
        {/* Header */}
        <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid #eef0f4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost' }}>Notifications</Typography>
            <Typography sx={{ fontSize: '0.6875rem', color: '#64748b' }}>
              {unreadCount} unread · {notifications.length} total
            </Typography>
          </Box>
          {unreadCount > 0 && (
            <Typography
              onClick={handleMarkAllRead}
              sx={{ fontSize: '0.75rem', fontWeight: 600, color: colorPalette.primary, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
            >
              Mark all read
            </Typography>
          )}
        </Box>

        {/* List */}
        <Box sx={{ overflowY: 'auto', maxHeight: 400 }}>
          {notifications.length === 0 && (
            <Box sx={{ py: 5, textAlign: 'center', color: '#94a3b8' }}>
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
                  borderBottom: '1px solid #f4f5f7', position: 'relative',
                  bgcolor: unread ? `${colorPalette.primary}04` : 'transparent',
                  transition: 'background 0.15s',
                  '&:hover': { bgcolor: '#fafbfc' },
                  '&:last-child': { borderBottom: 'none' },
                }}
              >
                {unread && (
                  <Box sx={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', width: 6, height: 6, borderRadius: '50%', bgcolor: colorPalette.primary }} />
                )}
                <Box sx={{ width: 28, height: 28, bgcolor: cfg.bg, color: cfg.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {cfg.icon}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <Typography sx={{ fontSize: '0.8125rem', fontWeight: unread ? 700 : 500, color: '#00288e', fontFamily: 'Jost', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {n.title}
                    </Typography>
                    <Typography sx={{ fontSize: '0.625rem', color: '#94a3b8', flexShrink: 0, ml: 1, fontWeight: 500 }}>
                      {timeAgo(n.createdAt)}
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {n.body}
                  </Typography>
                </Box>
              </Box>
            )
          })}
        </Box>

        {/* Footer */}
        <Box sx={{ px: 2.5, py: 1.5, borderTop: '1px solid #eef0f4', textAlign: 'center', bgcolor: '#fafbfc' }}>
          <Typography onClick={handleViewAll} sx={{ fontSize: '0.75rem', fontWeight: 600, color: colorPalette.primary, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}>
            View all activity
          </Typography>
        </Box>
      </Popover>

      {/* === Help / Info Popover === */}
      <Popover
        open={!!helpAnchor}
        anchorEl={helpAnchor}
        onClose={() => setHelpAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              mt: 1,
              width: 320,
              borderRadius: 0,
              border: '1px solid #eef0f4',
              boxShadow: '0 16px 48px rgba(15,23,42,0.12)',
            },
          },
        }}
      >
        <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid #eef0f4' }}>
          <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost' }}>
            Help & resources
          </Typography>
          <Typography sx={{ fontSize: '0.6875rem', color: '#64748b', mt: 0.25 }}>
            OpenIV v2.4.1 · Build 8429
          </Typography>
        </Box>

        <Stack>
          {[
            { icon: <MenuBookOutlinedIcon sx={{ fontSize: '1.125rem' }} />, label: 'Documentation', sub: 'API reference, guides, recipes' },
            { icon: <ChatBubbleOutlineRoundedIcon sx={{ fontSize: '1.125rem' }} />, label: 'Contact support', sub: 'Reply within 30 minutes' },
            { icon: <CampaignOutlinedIcon sx={{ fontSize: '1.125rem' }} />, label: "What's new", sub: 'Latest releases & changes', badge: 'NEW' },
            { icon: <KeyboardOutlinedIcon sx={{ fontSize: '1.125rem' }} />, label: 'Keyboard shortcuts', sub: 'Press ? anywhere' },
          ].map((item) => (
            <Box
              key={item.label}
              sx={{
                px: 2.5,
                py: 1.5,
                display: 'flex',
                gap: 1.25,
                cursor: 'pointer',
                borderBottom: '1px solid #f4f5f7',
                transition: 'background 0.15s',
                '&:hover': { bgcolor: '#fafbfc' },
                '&:last-child': { borderBottom: 'none' },
              }}
            >
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  bgcolor: `${colorPalette.primary}10`,
                  color: colorPalette.primary,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {item.icon}
              </Box>
              <Box sx={{ flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: '#00288e', fontFamily: 'Jost' }}>
                    {item.label}
                  </Typography>
                  {item.badge && (
                    <Chip
                      label={item.badge}
                      size="small"
                      sx={{
                        bgcolor: '#dc2626',
                        color: '#ffffff',
                        fontWeight: 700,
                        fontSize: '0.5625rem',
                        letterSpacing: '0.08em',
                        borderRadius: 0,
                        height: 14,
                        '& .MuiChip-label': { px: 0.5 },
                      }}
                    />
                  )}
                </Box>
                <Typography sx={{ fontSize: '0.6875rem', color: '#64748b', mt: 0.125 }}>
                  {item.sub}
                </Typography>
              </Box>
              <OpenInNewRoundedIcon sx={{ fontSize: '0.875rem', color: '#cbd5e1', alignSelf: 'center' }} />
            </Box>
          ))}
        </Stack>

        <Divider />

        <Box sx={{ px: 2.5, py: 1.5, bgcolor: '#fafbfc' }}>
          <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', textAlign: 'center', lineHeight: 1.6 }}>
            CBN · NFIU · NDPR · ISO 27001 aligned
          </Typography>
        </Box>
      </Popover>
    </Box>
  )
}
