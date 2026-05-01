import { Box, InputBase, IconButton, Typography, Badge, Popover, Stack, Chip, Divider, Button } from '@mui/material'
import { colorPalette } from '@/theme'
import { useState } from 'react'
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined'
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined'
import HelpOutlineOutlinedIcon from '@mui/icons-material/HelpOutlineOutlined'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined'
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded'
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined'
import KeyboardOutlinedIcon from '@mui/icons-material/KeyboardOutlined'
import BlockRoundedIcon from '@mui/icons-material/BlockRounded'
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined'
import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined'
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined'
import FlashOnOutlinedIcon from '@mui/icons-material/FlashOnOutlined'
import FlashOffOutlinedIcon from '@mui/icons-material/FlashOffOutlined'
import PsychologyOutlinedIcon from '@mui/icons-material/PsychologyOutlined'
import PsychologyIcon from '@mui/icons-material/Psychology'
import { useEureka } from '@/contexts/EurekaContext'
import { useSandbox } from '@/contexts/SandboxContext'
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'

interface TopbarProps {
  onOpenEureka?: () => void
}

type Severity = 'critical' | 'warning' | 'info' | 'success'

const sevConfig: Record<Severity, { color: string; bg: string }> = {
  critical: { color: '#dc2626', bg: '#fef2f2' },
  warning: { color: '#f59e0b', bg: '#fffbeb' },
  info: { color: colorPalette.primary, bg: `${colorPalette.primary}10` },
  success: { color: '#10b981', bg: '#f0fdf4' },
}

const notifications: { id: number; severity: Severity; icon: React.ReactNode; title: string; detail: string; time: string; unread: boolean }[] = [
  { id: 1, severity: 'critical', icon: <BlockRoundedIcon sx={{ fontSize: '0.9rem' }} />, title: 'OTP hold · Adamu Ibrahim', detail: '₦14.2M flagged · awaiting your call', time: '2 min', unread: true },
  { id: 2, severity: 'critical', icon: <FlagOutlinedIcon sx={{ fontSize: '0.9rem' }} />, title: 'Pattern · same-IP cluster', detail: '4 unrelated accounts in Lagos', time: '14 min', unread: true },
  { id: 3, severity: 'warning', icon: <FlagOutlinedIcon sx={{ fontSize: '0.9rem' }} />, title: 'BDC threshold breached', detail: 'Sokoto · ₦14.2M to single beneficiary', time: '34 min', unread: true },
  { id: 4, severity: 'info', icon: <GavelOutlinedIcon sx={{ fontSize: '0.9rem' }} />, title: 'NFIU STR filed · #4827', detail: 'Awaiting senior sign-off', time: '1 hr', unread: true },
  { id: 5, severity: 'success', icon: <VerifiedOutlinedIcon sx={{ fontSize: '0.9rem' }} />, title: 'Account #ACC-9281 cleared', detail: 'False positive · payroll cycle confirmed', time: '2 hr', unread: false },
]

export default function Topbar({ onOpenEureka }: TopbarProps) {
  const { eurekaEnabled, setEurekaEnabled, isLoading } = useEureka()
  const { sandboxEnabled, isDevOrAdmin } = useSandbox()
  const [notifAnchor, setNotifAnchor] = useState<HTMLElement | null>(null)
  const [helpAnchor, setHelpAnchor] = useState<HTMLElement | null>(null)
  const unreadCount = notifications.filter((n) => n.unread).length

  const iconBtn = {
    color: '#64748b',
    width: 38,
    height: 38,
    borderRadius: 0,
    transition: 'all 0.18s',
    '&:hover': { bgcolor: '#f8fafc', color: colorPalette.primary },
  }

  return (
    <Box
      sx={{
        height: 64,
        px: 4,
        bgcolor: '#ffffff',
        borderBottom: '1px solid #eef0f4',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        position: 'sticky',
        top: 0,
        zIndex: 10,
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
          bgcolor: '#f8fafc',
          px: 2,
          height: 38,
          transition: 'all 0.18s ease',
          '&:focus-within': {
            bgcolor: '#ffffff',
            boxShadow: `0 0 0 3px ${colorPalette.primary}15`,
            borderColor: colorPalette.primary,
          },
          border: '1px solid transparent',
          '&:hover': { borderColor: '#e5e7eb' },
        }}
      >
        <SearchOutlinedIcon sx={{ fontSize: '1.125rem', color: '#94a3b8' }} />
        <InputBase
          placeholder="Search transactions, customers, cases…"
          sx={{
            flex: 1,
            fontSize: '0.875rem',
            fontFamily: 'Jost',
            color: '#0f172a',
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
            border: '1px solid #e5e7eb',
            bgcolor: '#ffffff',
            fontSize: '0.6875rem',
            color: '#94a3b8',
            fontWeight: 600,
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
            bgcolor: eurekaEnabled ? `${colorPalette.primary}08` : '#f1f5f9'
          },
        }}
      >
        {/* AI Companion Avatar */}
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            bgcolor: eurekaEnabled ? colorPalette.primary : '#e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            position: 'relative',
            boxShadow: eurekaEnabled ? `0 0 0 2px ${colorPalette.primary}20, 0 2px 8px ${colorPalette.primary}15` : 'none',
            '&::after': eurekaEnabled ? {
              content: '""',
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: `2px solid ${colorPalette.primary}`,
              opacity: 0.3,
              animation: 'pulse-ring 2s ease-in-out infinite',
              '@keyframes pulse-ring': {
                '0%': {
                  boxShadow: `0 0 0 0 ${colorPalette.primary}60`,
                },
                '70%': {
                  boxShadow: `0 0 0 10px ${colorPalette.primary}00`,
                },
                '100%': {
                  boxShadow: `0 0 0 0 ${colorPalette.primary}00`,
                },
              },
            } : 'none',
          }}
        >
          <PsychologyIcon sx={{ fontSize: '1.125rem', color: eurekaEnabled ? '#fff' : '#94a3b8' }} />
        </Box>

        {/* Status Label */}
        <Stack direction="column" spacing={0.25} alignItems="flex-start">
          <Typography
            sx={{
              fontSize: '0.6875rem',
              fontWeight: 700,
              color: '#64748b',
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
                bgcolor: eurekaEnabled ? '#10b981' : '#cbd5e1',
                animation: eurekaEnabled ? 'pulse 2s ease-in-out infinite' : 'none',
                '@keyframes pulse': {
                  '0%, 100%': { opacity: 1 },
                  '50%': { opacity: 0.4 },
                },
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
          bgcolor: colorPalette.primary,
          border: `1px solid ${colorPalette.primary}`,
          cursor: 'pointer',
          transition: 'all 0.18s ease',
          '&:hover': {
            bgcolor: '#1a3896',
            boxShadow: `0 4px 12px ${colorPalette.primary}30`,
            transform: 'translateY(-1px)',
          },
        }}
      >
        <AutoAwesomeOutlinedIcon sx={{ fontSize: '1rem', color: '#fff' }} />
        <Typography
          sx={{
            fontSize: '0.8125rem',
            fontWeight: 600,
            color: '#fff',
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
        slotProps={{
          paper: {
            sx: {
              mt: 1,
              width: 380,
              maxHeight: 520,
              borderRadius: 0,
              border: '1px solid #eef0f4',
              boxShadow: '0 16px 48px rgba(15,23,42,0.12)',
            },
          },
        }}
      >
        <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid #eef0f4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
              Notifications
            </Typography>
            <Typography sx={{ fontSize: '0.6875rem', color: '#64748b' }}>
              {unreadCount} unread · {notifications.length} total
            </Typography>
          </Box>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: colorPalette.primary, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}>
            Mark all read
          </Typography>
        </Box>

        <Box sx={{ overflowY: 'auto', maxHeight: 400 }}>
          {notifications.map((n) => {
            const cfg = sevConfig[n.severity]
            return (
              <Box
                key={n.id}
                sx={{
                  px: 2.5,
                  py: 1.75,
                  display: 'flex',
                  gap: 1.25,
                  cursor: 'pointer',
                  borderBottom: '1px solid #f4f5f7',
                  bgcolor: n.unread ? `${colorPalette.primary}04` : 'transparent',
                  transition: 'background 0.15s',
                  '&:hover': { bgcolor: '#fafbfc' },
                  '&:last-child': { borderBottom: 'none' },
                  position: 'relative',
                }}
              >
                {n.unread && (
                  <Box
                    sx={{
                      position: 'absolute',
                      left: 8,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      bgcolor: colorPalette.primary,
                    }}
                  />
                )}
                <Box
                  sx={{
                    width: 28,
                    height: 28,
                    bgcolor: cfg.bg,
                    color: cfg.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {n.icon}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: '#0f172a', fontFamily: 'Jost', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {n.title}
                    </Typography>
                    <Typography sx={{ fontSize: '0.625rem', color: '#94a3b8', flexShrink: 0, ml: 1, fontWeight: 500 }}>
                      {n.time}
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
                    {n.detail}
                  </Typography>
                </Box>
              </Box>
            )
          })}
        </Box>

        <Box sx={{ px: 2.5, py: 1.5, borderTop: '1px solid #eef0f4', textAlign: 'center', bgcolor: '#fafbfc' }}>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: colorPalette.primary, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}>
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
          <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
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
                  <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: '#0f172a', fontFamily: 'Jost' }}>
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
