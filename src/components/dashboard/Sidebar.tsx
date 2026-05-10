import { Box, Typography, Tooltip, Chip, Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material'
import { colorPalette } from '@/theme'
import { useState, useRef, useCallback, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import SidebarAIBubble from './SidebarAIBubble'
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined'
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined'
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined'
import GridOnOutlinedIcon from '@mui/icons-material/GridOnOutlined'
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined'
import WebhookOutlinedIcon from '@mui/icons-material/WebhookOutlined'
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined'
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined'
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined'
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined'
import KeyOutlinedIcon from '@mui/icons-material/KeyOutlined'
import PsychologyOutlinedIcon from '@mui/icons-material/PsychologyOutlined'
import RssFeedOutlinedIcon from '@mui/icons-material/RssFeedOutlined'
import CallMadeIcon        from '@mui/icons-material/CallMade'
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined'
import { authApi } from '@/api/auth'
import { clearOnboardingState } from '@/onboarding/state'
import { useNavigate } from 'react-router-dom'
import { useEureka } from '@/contexts/EurekaContext'
import { useDashboardEvents } from '@/contexts/DashboardEventsContext'

interface NavItem {
  to: string
  icon: React.ReactNode
  label: string
  badge?: string
}

interface ActiveNavItem {
  navItem: NavItem
  rect: DOMRect
}

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: 'Monitor',
    items: [
      { to: '/dashboard', icon: <DashboardOutlinedIcon sx={{ fontSize: '1.25rem' }} />, label: 'Overview' },
      { to: '/dashboard/otp-alerts', icon: <KeyOutlinedIcon sx={{ fontSize: '1.25rem' }} />, label: 'OTP Defense' },
      { to: '/dashboard/transactions', icon: <ReceiptLongOutlinedIcon sx={{ fontSize: '1.25rem' }} />, label: 'Transactions' },
      { to: '/dashboard/patterns', icon: <PsychologyOutlinedIcon sx={{ fontSize: '1.25rem' }} />, label: 'Behavioral Patterns' },
      { to: '/dashboard/aml', icon: <GavelOutlinedIcon sx={{ fontSize: '1.25rem' }} />, label: 'AML & Cases' },
      { to: '/dashboard/kyc', icon: <BadgeOutlinedIcon sx={{ fontSize: '1.25rem' }} />, label: 'KYC' },
      { to: '/dashboard/heatmaps', icon: <GridOnOutlinedIcon sx={{ fontSize: '1.25rem' }} />, label: 'Heatmaps' },
    ],
  },
  {
    label: 'Compliance',
    items: [
      { to: '/dashboard/cbn', icon: <VerifiedUserOutlinedIcon sx={{ fontSize: '1.25rem' }} />, label: 'CBN Compliance', badge: '52d' },
      { to: '/dashboard/reports', icon: <AssessmentOutlinedIcon sx={{ fontSize: '1.25rem' }} />, label: 'Reports & Filings' },
    ],
  },
  {
    label: 'Configuration',
    items: [
      { to: '/dashboard/thresholds', icon: <TuneOutlinedIcon sx={{ fontSize: '1.25rem' }} />, label: 'Thresholds' },
      { to: '/dashboard/network',    icon: <RssFeedOutlinedIcon sx={{ fontSize: '1.25rem' }} />, label: 'Network' },
      { to: '/dashboard/beam',       icon: <CallMadeIcon sx={{ fontSize: '1.25rem' }} />, label: 'Beam to OpenIV' },
      { to: '/dashboard/webhooks',   icon: <WebhookOutlinedIcon sx={{ fontSize: '1.25rem' }} />, label: 'Webhooks' },
    ],
  },
  {
    label: 'Manage',
    items: [
      { to: '/dashboard/team', icon: <GroupOutlinedIcon sx={{ fontSize: '1.25rem' }} />, label: 'Team & Roles' },
      { to: '/dashboard/billing', icon: <AccountBalanceWalletOutlinedIcon sx={{ fontSize: '1.25rem' }} />, label: 'Billing & Usage', badge: 'ADMIN' },
      { to: '/dashboard/settings', icon: <SettingsOutlinedIcon sx={{ fontSize: '1.25rem' }} />, label: 'Settings' },
    ],
  },
]

export default function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { eurekaEnabled, setEurekaBuddyOpen } = useEureka()
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false)
  const [unreadCounts, setUnreadCounts] = useState<{ flags: number; cases: number }>({ flags: 0, cases: 0 })

  // AI bubble hover tracking
  const [activeNavItem,   setActiveNavItem]   = useState<ActiveNavItem | null>(null)
  const [isBubbleClosing, setIsBubbleClosing] = useState(false)
  const [hoveringItemTo,  setHoveringItemTo]  = useState<string | null>(null)
  const hoverTimerRef       = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bubbleCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { notifications } = useDashboardEvents()
  
  // Fetch unread counts
  const fetchCounts = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/notifications/unread-counts')
      if (res.ok) {
        const data = await res.json()
        setUnreadCounts(data)
      }
    } catch (err) {
      console.error('Failed to fetch unread counts', err)
    }
  }, [])

  // Initial fetch
  useEffect(() => {
    fetchCounts()
  }, [fetchCounts])

  // Real-time update: refresh counts when notifications array changes (new push)
  useEffect(() => {
    if (notifications.length > 0) {
      fetchCounts()
    }
  }, [notifications, fetchCounts])

  // Auto-clear logic: when user views a page, mark that category as read
  useEffect(() => {
    const markAsRead = async (category: 'flags' | 'cases') => {
      try {
        await fetch(`/api/v1/notifications/read-category/${category}`, { method: 'PATCH' })
        fetchCounts() // update sidebar badges
      } catch (err) {
        // ignore
      }
    }

    if (location.pathname === '/dashboard/transactions' && unreadCounts.flags > 0) {
      markAsRead('flags')
    } else if (location.pathname === '/dashboard/aml' && unreadCounts.cases > 0) {
      markAsRead('cases')
    }
  }, [location.pathname, unreadCounts.flags, unreadCounts.cases, fetchCounts])

  const handleNavMouseEnter = (item: NavItem, e: React.MouseEvent<HTMLElement>) => {
    if (!eurekaEnabled) return
    setHoveringItemTo(item.to)          // start ripple immediately
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
    const elem = e.currentTarget
    hoverTimerRef.current = setTimeout(() => {
      const rect = elem.getBoundingClientRect()
      setHoveringItemTo(null)           // ripple contracts in, bubble appears
      setActiveNavItem({ navItem: item, rect })
      setEurekaBuddyOpen(true)
      hoverTimerRef.current = null
    }, 2000)
  }

  const handleNavMouseLeave = () => {
    setHoveringItemTo(null)             // cancel ripple on leave
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
  }

  // Play ripple-close-in animation, then actually unmount the bubble
  const closeBubble = useCallback(() => {
    if (!activeNavItem) return
    if (bubbleCloseTimerRef.current) clearTimeout(bubbleCloseTimerRef.current)
    setIsBubbleClosing(true)
    bubbleCloseTimerRef.current = setTimeout(() => {
      setActiveNavItem(null)
      setEurekaBuddyOpen(false)
      setIsBubbleClosing(false)
      bubbleCloseTimerRef.current = null
    }, 390) // matches animation duration
  }, [activeNavItem, setEurekaBuddyOpen])

  const handleLogout = async () => {
    try {
      await authApi.logout()
    } catch {
      // ignore
    } finally {
      clearOnboardingState()
      navigate('/auth/login')
    }
  }

  return (
    <Box
      sx={{
        width: 244,
        flexShrink: 0,
        height: '100vh',
        position: 'sticky',
        top: 0,
        bgcolor: '#ffffff',
        borderRight: '1px solid #eef0f4',
        display: 'flex',
        flexDirection: 'column',
        py: 2.5,
      }}
    >
      {/* Brand */}
      <Box sx={{ px: 3, pb: 2.5, mb: 1.5, borderBottom: '1px solid #eef0f4' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <Box
            sx={{
              width: 30,
              height: 30,
              bgcolor: colorPalette.primary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Box sx={{ width: 14, height: 14, bgcolor: '#ffffff' }} />
          </Box>
          <Typography
            sx={{
              fontSize: '1rem',
              fontWeight: 700,
              fontFamily: 'Jost',
              letterSpacing: '0.1em',
              color: '#0f172a',
            }}
          >
            OPENIV
          </Typography>
        </Box>
        <Typography
          sx={{
            fontSize: '0.6875rem',
            fontWeight: 600,
            color: '#94a3b8',
            mt: 1,
            letterSpacing: '0.04em',
          }}
        >
          First City Monument Bank
        </Typography>
      </Box>

      {/* Nav */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 1.5 }}>
        {navGroups.map((group) => (
          <Box key={group.label} sx={{ mb: 2.5 }}>
            <Typography
              sx={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                color: '#94a3b8',
                textTransform: 'uppercase',
                letterSpacing: '0.14em',
                px: 1.5,
                mb: 0.75,
              }}
            >
              {group.label}
            </Typography>
            {group.items.map((item) => {
              const active = location.pathname === item.to
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  style={{ textDecoration: 'none' }}
                >
                  <Box
                    onMouseEnter={e => handleNavMouseEnter(item, e)}
                    onMouseLeave={handleNavMouseLeave}
                    data-ai-analyzable="true"
                    data-ai-description={`Navigate to ${item.label} module. ${item.badge ? `Current attention required: ${item.badge}` : ''}`}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      px: 1.5,
                      py: 1.125,
                      mb: 0.25,
                      cursor: 'pointer',
                      position: 'relative',
                      overflow: 'hidden',
                      color: active ? colorPalette.primary : '#475569',
                      bgcolor: active ? `${colorPalette.primary}0a` : 'transparent',
                      transition: 'all 0.18s ease',
                      '&:hover': {
                        bgcolor: active ? `${colorPalette.primary}0f` : '#f8fafc',
                        color: colorPalette.primary,
                      },
                      '&::before': active
                        ? {
                            content: '""',
                            position: 'absolute',
                            left: 0,
                            top: 6,
                            bottom: 6,
                            width: '2px',
                            bgcolor: colorPalette.primary,
                          }
                        : {},
                    }}
                  >
                    {/* 2-second hover ripple: expands out → contracts in → fades */}
                    {hoveringItemTo === item.to && (
                      <Box
                        sx={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          width: 280,
                          height: 280,
                          borderRadius: '50%',
                          pointerEvents: 'none',
                          border: `1.5px solid ${colorPalette.primary}35`,
                          bgcolor: `${colorPalette.primary}07`,
                          animation: 'navRipple 2s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards',
                          '@keyframes navRipple': {
                            '0%':   { transform: 'translate(-50%, -50%) scale(0)',    opacity: 0.9 },
                            '72%':  { transform: 'translate(-50%, -50%) scale(1)',    opacity: 0.35 },
                            '86%':  { transform: 'translate(-50%, -50%) scale(0.55)', opacity: 0.18 },
                            '100%': { transform: 'translate(-50%, -50%) scale(0)',    opacity: 0 },
                          },
                        }}
                      />
                    )}
                    {item.icon}
                    <Typography
                      sx={{
                        fontSize: '0.875rem',
                        fontWeight: active ? 600 : 500,
                        fontFamily: 'Jost',
                        flex: 1,
                      }}
                    >
                      {item.label}
                    </Typography>
                    {(() => {
                      let badgeValue = item.badge;
                      if (item.to === '/dashboard/transactions' && unreadCounts.flags > 0) {
                        badgeValue = unreadCounts.flags.toString();
                      } else if (item.to === '/dashboard/aml' && unreadCounts.cases > 0) {
                        badgeValue = unreadCounts.cases.toString();
                      }
                      
                      if (!badgeValue) return null;

                      return (
                        <Chip
                          label={badgeValue}
                          size="small"
                          sx={{
                            bgcolor: badgeValue === 'ADMIN' ? '#f1f5f9' : '#dc2626',
                            color: badgeValue === 'ADMIN' ? '#64748b' : '#ffffff',
                            fontWeight: 700,
                            fontSize: '0.5625rem',
                            letterSpacing: '0.08em',
                            borderRadius: 0,
                            height: 18,
                            minWidth: 22,
                            '& .MuiChip-label': { px: 0.625 },
                          }}
                        />
                      );
                    })()}
                  </Box>
                </NavLink>
              )
            })}
          </Box>
        ))}
      </Box>

      {/* User Block */}
      <Box sx={{ px: 1.5, pt: 2, borderTop: '1px solid #eef0f4', mx: 1.5 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.25,
            px: 1,
            py: 1,
            cursor: 'pointer',
            transition: 'background 0.18s ease',
            '&:hover': { bgcolor: '#f8fafc' },
          }}
        >
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              bgcolor: colorPalette.primary,
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.8125rem',
              fontWeight: 700,
              fontFamily: 'Jost',
              flexShrink: 0,
            }}
          >
            AC
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: '#0f172a', lineHeight: 1.2 }}>
              Adaeze Chukwu
            </Typography>
            <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8' }}>
              Head of Compliance
            </Typography>
          </Box>
          <Tooltip title="Sign out" placement="top">
            <LogoutOutlinedIcon
              onClick={() => setLogoutDialogOpen(true)}
              sx={{
                fontSize: '1.125rem',
                color: '#94a3b8',
                transition: 'color 0.18s',
                '&:hover': { color: colorPalette.primary },
              }}
            />
          </Tooltip>
        </Box>
      </Box>

      {/* AI hover bubble */}
      {activeNavItem && (
        <SidebarAIBubble
          anchorRect={activeNavItem.rect}
          navItem={activeNavItem.navItem}
          isClosing={isBubbleClosing}
          onClose={closeBubble}
        />
      )}

      {/* Logout Confirmation Dialog */}
      <Dialog
        open={logoutDialogOpen}
        onClose={() => setLogoutDialogOpen(false)}
        PaperProps={{
          sx: { borderRadius: 0, width: '100%', maxWidth: 360 }
        }}
      >
        <DialogTitle sx={{ fontFamily: 'Jost', fontWeight: 700, pb: 1 }}>
          Confirm Sign Out
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontFamily: 'Jost', fontSize: '0.9375rem', color: '#64748b' }}>
            Are you sure you want to sign out of your session?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button
            onClick={() => setLogoutDialogOpen(false)}
            sx={{
              fontFamily: 'Jost',
              textTransform: 'none',
              color: '#64748b',
              fontWeight: 600,
              '&:hover': { bgcolor: '#f8fafc' }
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleLogout}
            autoFocus
            sx={{
              fontFamily: 'Jost',
              textTransform: 'none',
              bgcolor: colorPalette.primary,
              color: '#ffffff',
              fontWeight: 600,
              px: 3,
              borderRadius: 0,
              '&:hover': { bgcolor: '#1a3896' }
            }}
          >
            Sign Out
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
