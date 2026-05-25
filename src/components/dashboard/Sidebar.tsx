import { Box, Typography, Tooltip, Chip, Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material'
import { colorPalette } from '@/theme'
import { useState, useRef, useCallback, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import SidebarAIBubble from './SidebarAIBubble'
import { useAiEnabled } from '@/hooks/useAiEnabled'
import { usePlan, type PlanFeature } from '@/hooks/usePlan'
import { usePlanModal } from '@/contexts/PlanContext'
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined'
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined'
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined'
import GridOnOutlinedIcon from '@mui/icons-material/GridOnOutlined'
import PolicyOutlinedIcon from '@mui/icons-material/PolicyOutlined'
import WebhookOutlinedIcon from '@mui/icons-material/WebhookOutlined'
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined'
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined'
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined'
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined'
import WorkspacePremiumOutlinedIcon from '@mui/icons-material/WorkspacePremiumOutlined'
import KeyOutlinedIcon from '@mui/icons-material/KeyOutlined'
import PsychologyOutlinedIcon from '@mui/icons-material/PsychologyOutlined'
import RssFeedOutlinedIcon from '@mui/icons-material/RssFeedOutlined'
import CallMadeIcon from '@mui/icons-material/CallMade'
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined'
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import { authApi } from '@/api/auth'
import { caseApi } from '@/api/cases'
import { transactionApi } from '@/api/transactions'
import { clearOnboardingState } from '@/onboarding/state'
import { useNavigate } from 'react-router-dom'
import { useEureka } from '@/contexts/EurekaContext'
import { useDashboardEvents } from '@/contexts/DashboardEventsContext'
import { useProfile } from '@/contexts/ProfileContext'
import { useRbac } from '@/contexts/RbacContext'
import { isBuildOne, COMING_SOON_ROUTES } from '@/utils/build'
import { resolveMediaUrl } from '@/api/client'
import type { Permission } from '@/rbac/permissions'

interface NavItem {
  to: string
  icon: React.ReactNode
  label: string
  badge?: string
  permission?: Permission
  planFeature?: PlanFeature
}

const FEATURE_REQUIRED_PLAN: Record<PlanFeature, string> = {
  kyc:            'growth',
  webhooks:       'growth',
  network:        'growth',
  behavioral:     'growth',
  reports_export: 'growth',
  ai:             'growth',
}

interface ActiveNavItem {
  navItem: NavItem
  rect: DOMRect
}

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: 'Monitor',
    items: [
      { to: '/dashboard',              icon: <DashboardOutlinedIcon sx={{ fontSize: '1.25rem' }} />,    label: 'Overview',             permission: 'dashboard.view' },
      { to: '/dashboard/transactions', icon: <ReceiptLongOutlinedIcon sx={{ fontSize: '1.25rem' }} />, label: 'Transactions',         permission: 'transactions.view' },
      { to: '/dashboard/otp-alerts',   icon: <KeyOutlinedIcon sx={{ fontSize: '1.25rem' }} />,         label: 'OTP Defense',          permission: 'transactions.view' },
      { to: '/dashboard/patterns',     icon: <PsychologyOutlinedIcon sx={{ fontSize: '1.25rem' }} />,  label: 'Behavioral Patterns',  permission: 'transactions.view', planFeature: 'behavioral' },
      { to: '/dashboard/heatmaps',     icon: <GridOnOutlinedIcon sx={{ fontSize: '1.25rem' }} />,      label: 'Heatmaps',             permission: 'dashboard.view' },
    ],
  },
  {
    label: 'Investigate',
    items: [
      { to: '/dashboard/aml',       icon: <GavelOutlinedIcon sx={{ fontSize: '1.25rem' }} />,  label: 'AML & Cases', permission: 'cases.view' },
      { to: '/dashboard/customers', icon: <BadgeOutlinedIcon sx={{ fontSize: '1.25rem' }} />,  label: 'Customers',   permission: 'customers.view' },
    ],
  },
  {
    label: 'Compliance',
    items: [
      { to: '/dashboard/cbn',     icon: <VerifiedUserOutlinedIcon sx={{ fontSize: '1.25rem' }} />, label: 'CBN Compliance',   badge: '52d', permission: 'reports.view' },
      { to: '/dashboard/reports', icon: <AssessmentOutlinedIcon sx={{ fontSize: '1.25rem' }} />,   label: 'Reports & Filings',              permission: 'reports.view' },
    ],
  },
  {
    label: 'Integrate',
    items: [
      { to: '/dashboard/beam',       icon: <CallMadeIcon sx={{ fontSize: '1.25rem' }} />,        label: 'Beam to OpenIV', permission: 'integrations.view' },
      { to: '/dashboard/thresholds', icon: <PolicyOutlinedIcon sx={{ fontSize: '1.25rem' }} />,  label: 'Rules',          permission: 'rules.view' },
      { to: '/dashboard/webhooks',   icon: <WebhookOutlinedIcon sx={{ fontSize: '1.25rem' }} />, label: 'Webhooks',       permission: 'integrations.view', planFeature: 'webhooks' },
      { to: '/dashboard/network',    icon: <RssFeedOutlinedIcon sx={{ fontSize: '1.25rem' }} />, label: 'Network',        permission: 'integrations.view', planFeature: 'network'   },
    ],
  },
  {
    label: 'Workspace',
    items: [
      { to: '/dashboard/team',         icon: <GroupOutlinedIcon sx={{ fontSize: '1.25rem' }} />,                label: 'Team & Roles',    permission: 'team.view' },
      { to: '/dashboard/billing',      icon: <AccountBalanceWalletOutlinedIcon sx={{ fontSize: '1.25rem' }} />, label: 'Billing & Usage', permission: 'billing.view' },
      { to: '/dashboard/subscription', icon: <WorkspacePremiumOutlinedIcon sx={{ fontSize: '1.25rem' }} />,    label: 'Subscription',    permission: 'billing.view' },
      { to: '/dashboard/settings',     icon: <SettingsOutlinedIcon sx={{ fontSize: '1.25rem' }} />,             label: 'Settings',        permission: 'settings.view' },
    ],
  },
]

function getInitials(fullName: string | null | undefined, email: string | null | undefined): string {
  if (fullName && fullName.trim()) {
    const words = fullName.trim().split(/\s+/)
    if (words.length === 1) return words[0][0].toUpperCase()
    return (words[0][0] + words[words.length - 1][0]).toUpperCase()
  }
  if (email) return email[0].toUpperCase()
  return '?'
}

export default function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { profile } = useProfile()
  const { can } = useRbac()
  const { eurekaEnabled, setEurekaBuddyOpen } = useEureka()
  const isAiEnabled = useAiEnabled()
  const plan = usePlan()
  const { triggerUpgrade } = usePlanModal()
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false)
  const [unseenTransactionCount, setUnseenTransactionCount] = useState(0)
  const [unassignedCasesCount,   setUnassignedCasesCount]   = useState(0)

  // AI bubble hover tracking
  const [activeNavItem,   setActiveNavItem]   = useState<ActiveNavItem | null>(null)
  const [isBubbleClosing, setIsBubbleClosing] = useState(false)
  const [hoveringItemTo,  setHoveringItemTo]  = useState<string | null>(null)
  const hoverTimerRef       = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bubbleCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { notifications } = useDashboardEvents()

  const fetchUnseenTransactions = useCallback(async () => {
    try {
      const data = await transactionApi.unseenCount()
      setUnseenTransactionCount(data.count)
    } catch { /* ignore */ }
  }, [])

  const fetchUnseenCases = useCallback(async () => {
    try {
      const data = await caseApi.unassignedCount()
      setUnassignedCasesCount(data.count)
    } catch { /* ignore */ }
  }, [])

  // Initial fetch
  useEffect(() => {
    fetchUnseenTransactions()
    fetchUnseenCases()
  }, [fetchUnseenTransactions, fetchUnseenCases])

  // Real-time: refresh counts when SSE pushes new notifications
  useEffect(() => {
    if (notifications.length > 0) {
      fetchUnseenTransactions()
      fetchUnseenCases()
    }
  }, [notifications, fetchUnseenTransactions, fetchUnseenCases])

  // Decrement transaction badge immediately when user opens a transaction
  useEffect(() => {
    const handler = () => setUnseenTransactionCount((n: number) => Math.max(0, n - 1))
    window.addEventListener('transaction:seen', handler)
    return () => window.removeEventListener('transaction:seen', handler)
  }, [])

  // Decrement case badge immediately when a case gets assigned
  useEffect(() => {
    const handler = () => setUnassignedCasesCount((n: number) => Math.max(0, n - 1))
    window.addEventListener('case:seen', handler)
    return () => window.removeEventListener('case:seen', handler)
  }, [])

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
        bgcolor: '#00288e',
        borderRight: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        flexDirection: 'column',
        py: 2.5,
      }}
    >
      {/* Brand */}
      <Box sx={{ px: 3, pb: 2.5, mb: 1.5, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <Box sx={{ position: 'relative' }}>
            <Box
              sx={{
                position: 'absolute',
                top: -4,
                left: 0,
                width: 24,
                height: '2px',
                bgcolor: '#ffffff',
                borderRadius: '1px',
              }}
            />
            <Typography
              sx={{
                fontSize: '1rem',
                fontWeight: 700,
                fontFamily: 'Jost',
                letterSpacing: '0.1em',
                color: '#ffffff',
              }}
            >
              OPENIV
            </Typography>
          </Box>
        </Box>
        <Typography
          sx={{
            fontSize: '0.6875rem',
            fontWeight: 600,
            color: 'rgba(255,255,255,0.5)',
            mt: 1,
            letterSpacing: '0.04em',
          }}
        >
          {profile?.institutionName ?? '—'}
        </Typography>
      </Box>

      {/* Nav */}
      <Box sx={{ flex: 1, minHeight: 0 }}>
      <Box sx={{
        height: '100%', overflowY: 'scroll', px: 1.5,
        scrollbarWidth: 'thin',
        scrollbarColor: '#d9f99d transparent',
        '&::-webkit-scrollbar': { width: 4 },
        '&::-webkit-scrollbar-track': { background: 'transparent' },
        '&::-webkit-scrollbar-thumb': { background: '#d9f99d', borderRadius: 2 },
        '&::-webkit-scrollbar-thumb:hover': { background: '#bef264' },
      }}>
        {navGroups
          .map((group) => ({
            ...group,
            items: group.items.filter((item) => {
              if (isBuildOne && COMING_SOON_ROUTES.includes(item.to)) return false
              if (item.permission && !can(item.permission)) return false
              return true
            }),
          }))
          .filter((group) => group.items.length > 0)
          .map((group) => (
            <Box key={group.label} sx={{ mb: 2.5 }}>
            <Typography
              sx={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                color: 'rgba(255,255,255,0.4)',
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
              const isLocked = !!(item.planFeature && plan.isLoaded && !plan.canUse(item.planFeature))

              const itemContent = (
                <Box
                  onMouseEnter={e => !isLocked && handleNavMouseEnter(item, e)}
                  onMouseLeave={!isLocked ? handleNavMouseLeave : undefined}
                  data-ai-analyzable={!isLocked ? 'true' : undefined}
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
                    color: isLocked ? 'rgba(255,255,255,0.35)' : (active ? '#d9f99d' : 'rgba(255,255,255,0.7)'),
                    bgcolor: active && !isLocked ? 'rgba(255,255,255,0.06)' : 'transparent',
                    transition: 'all 0.18s ease',
                    '&:hover': {
                      bgcolor: isLocked ? 'rgba(255,255,255,0.03)' : (active ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)'),
                      color: isLocked ? 'rgba(255,255,255,0.5)' : (active ? '#d9f99d' : '#ffffff'),
                    },
                    '&::before': active && !isLocked
                      ? {
                          content: '""',
                          position: 'absolute',
                          left: 0,
                          top: 6,
                          bottom: 6,
                          width: '3px',
                          bgcolor: '#d9f99d',
                        }
                      : {},
                  }}
                >
                  {!isLocked && hoveringItemTo === item.to && (
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
                      fontWeight: active && !isLocked ? 600 : 500,
                      fontFamily: 'Jost',
                      flex: 1,
                    }}
                  >
                    {item.label}
                  </Typography>
                  {isLocked ? (
                    <LockOutlinedIcon sx={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
                  ) : (
                    (() => {
                      let badgeValue = item.badge;
                      if (item.to === '/dashboard/transactions' && unseenTransactionCount > 0) {
                        badgeValue = unseenTransactionCount.toString();
                      } else if (item.to === '/dashboard/aml' && unassignedCasesCount > 0) {
                        badgeValue = unassignedCasesCount.toString();
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
                    })()
                  )}
                </Box>
              )

              return isLocked ? (
                <Box
                  key={item.to}
                  onClick={() => triggerUpgrade({
                    feature: item.planFeature!,
                    currentPlan: plan.slug ?? 'starter',
                    requiredPlan: FEATURE_REQUIRED_PLAN[item.planFeature!],
                  })}
                >
                  {itemContent}
                </Box>
              ) : (
                <NavLink
                  key={item.to}
                  to={item.to}
                  style={{ textDecoration: 'none' }}
                >
                  {itemContent}
                </NavLink>
              )
            })}
          </Box>
        ))}
      </Box>
      </Box>

      {/* User Block */}
      <Box sx={{ px: 1.5, pt: 2, borderTop: '1px solid rgba(255,255,255,0.1)', mx: 1.5 }}>
        <Box
          onClick={() => navigate('/dashboard/profile')}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.25,
            px: 1,
            py: 1,
            cursor: 'pointer',
            transition: 'background 0.18s ease',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
          }}
        >
          <Box sx={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
            {resolveMediaUrl(profile?.avatarUrl) ? (
              <Box component="img" src={resolveMediaUrl(profile?.avatarUrl)!} alt={profile?.fullName ?? ''} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <Box sx={{ width: '100%', height: '100%', bgcolor: '#d9f99d', color: '#00288e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8125rem', fontWeight: 700, fontFamily: 'Jost' }}>
                {getInitials(profile?.fullName, profile?.email)}
              </Box>
            )}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: '#ffffff', lineHeight: 1.2 }}>
              {profile?.fullName ?? profile?.email ?? 'Loading…'}
            </Typography>
            <Typography sx={{ fontSize: '0.6875rem', color: 'rgba(255,255,255,0.5)' }}>
              {profile?.jobTitle ?? profile?.role ?? ''}
            </Typography>
          </Box>
          <Tooltip title="Sign out" placement="top">
            <LogoutOutlinedIcon
              onClick={(e) => { e.stopPropagation(); setLogoutDialogOpen(true) }}
              sx={{
                fontSize: '1.125rem',
                color: 'rgba(255,255,255,0.4)',
                transition: 'color 0.18s',
                '&:hover': { color: '#d9f99d' },
              }}
            />
          </Tooltip>
        </Box>
      </Box>

      {/* AI hover bubble */}
      {isAiEnabled && activeNavItem && (
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
              '&:hover': { bgcolor: '#1e293b' }
            }}
          >
            Sign Out
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
