import { Box, Tooltip, Typography, Button } from '@mui/material'
import { useState, useEffect } from 'react'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import EurekaAssistant from './EurekaAssistant'
import InactivityGuard from './InactivityGuard'
import EurekaCompanionGlow from './EurekaCompanionGlow'
import MinimizedCaseBar from './MinimizedCaseBar'
import InvestigationWorkspace from './InvestigationWorkspace'
import { DashboardEventsProvider, useDashboardEvents } from '@/contexts/DashboardEventsContext'
import { EurekaProvider, useEureka } from '@/contexts/EurekaContext'
import { SessionSocketProvider } from '@/contexts/SessionSocketContext'
import { ProfileProvider, useProfile } from '@/contexts/ProfileContext'
import { RbacProvider } from '@/contexts/RbacContext'
import { ActiveCaseProvider, useActiveCase } from '@/contexts/ActiveCaseContext'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import LoginAttemptAlert from './LoginAttemptAlert'
import GeoAccessNotification from './GeoAccessNotification'
import { Outlet, useNavigate } from 'react-router-dom'
import { PlanProvider } from '@/contexts/PlanContext'
import UpgradeModal from './UpgradeModal'
import { useThemeMode } from './ThemeContext'

function ThemeSyncer() {
  const { profile } = useProfile()
  const { setMode } = useThemeMode()
  useEffect(() => {
    if (profile?.theme === 'light' || profile?.theme === 'dark') {
      setMode(profile.theme)
    }
  }, [profile?.theme, setMode])
  return null
}

interface DashboardLayoutProps {
  children?: React.ReactNode
}

function GlobalCaseWorkspace() {
  const { caseId, isWorkspaceOpen, minimizeCase, closeCase, updateSnap } = useActiveCase()

  useEffect(() => {
    const handler = (e: Event) => updateSnap((e as CustomEvent).detail)
    window.addEventListener('case:snap', handler)
    return () => window.removeEventListener('case:snap', handler)
  }, [updateSnap])

  const handleClose = () => {
    closeCase()
    window.dispatchEvent(new CustomEvent('case:updated'))
  }

  const handleUpdated = () => {
    window.dispatchEvent(new CustomEvent('case:updated'))
  }

  return (
    <>
      <InvestigationWorkspace
        caseId={caseId}
        open={isWorkspaceOpen}
        onClose={handleClose}
        onMinimize={minimizeCase}
        onUpdated={handleUpdated}
      />
      <MinimizedCaseBar />
    </>
  )
}

function DashboardContent({ children, eurekaOpen, setEurekaOpen }: {
  children: React.ReactNode
  eurekaOpen: boolean
  setEurekaOpen: (v: boolean) => void
}) {
  const { eurekaEnabled } = useEureka()
  const { securityEvents, geoAccessRequests, notifications } = useDashboardEvents()
  const navigate = useNavigate()
  const [dismissed,       setDismissed]       = useState<Set<string>>(new Set())
  const [dismissedGeo,    setDismissedGeo]    = useState<Set<number>>(new Set())
  const [dismissedRiskId, setDismissedRiskId] = useState<string>(
    () => localStorage.getItem('openiv.riskNotifDismissed') ?? ''
  )

  const visible    = securityEvents.filter(e => !dismissed.has(e.at))
  const latest     = visible[0] ?? null

  const pendingGeo = geoAccessRequests.filter(
    r => r.status === 'pending' && !dismissedGeo.has(r.id)
  )
  const latestGeo  = pendingGeo[0] ?? null

  const today = new Date().toISOString().slice(0, 10)
  const riskNotif = notifications.find(n => n.type === 'risk_report_daily' && n.createdAt.slice(0, 10) === today) ?? null
  const showRiskBanner = riskNotif !== null && String(riskNotif.id) !== dismissedRiskId

  const dismissRisk = () => {
    if (!riskNotif) return
    const id = String(riskNotif.id)
    localStorage.setItem('openiv.riskNotifDismissed', id)
    setDismissedRiskId(id)
  }

  return (
    <>
      <ThemeSyncer />
      <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'var(--app-bg)' }}>
        <Sidebar />
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <Topbar onOpenEureka={() => setEurekaOpen(true)} />

          <Box sx={{ flex: 1, overflowY: 'auto' }}>
            {/* Daily Risk Alert — sticky inside scroll container, pins just below the Topbar */}
            {showRiskBanner && (
              <Box
                sx={{
                  position: 'sticky',
                  top: 0,
                  zIndex: 9,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  px: 3,
                  py: 1.25,
                  bgcolor: '#fef2f2',
                  borderBottom: '1px solid #fecaca',
                }}
              >
                <WarningAmberRoundedIcon sx={{ fontSize: '1.125rem', color: '#dc2626', flexShrink: 0 }} />
                <Box sx={{ flex: 1, minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                  <Typography
                    component="span"
                    sx={{ fontSize: '0.8125rem', fontWeight: 700, color: '#991b1b', fontFamily: 'Jost', mr: 1 }}
                  >
                    {riskNotif.title}
                  </Typography>
                  <Typography
                    component="span"
                    sx={{ fontSize: '0.8125rem', color: '#7f1d1d' }}
                  >
                    {riskNotif.body}
                  </Typography>
                </Box>
                <Button
                  size="small"
                  endIcon={<ArrowForwardRoundedIcon sx={{ fontSize: '0.75rem !important' }} />}
                  onClick={() => { dismissRisk(); navigate('/dashboard/high-risk') }}
                  sx={{
                    bgcolor: '#dc2626', color: '#fff', borderRadius: 0,
                    textTransform: 'none', fontFamily: 'Jost',
                    fontSize: '0.75rem', fontWeight: 700,
                    px: 1.75, py: 0.625, flexShrink: 0, boxShadow: 'none',
                    '&:hover': { bgcolor: '#b91c1c', boxShadow: 'none' },
                  }}
                >
                  Review Now
                </Button>
                <Box
                  onClick={dismissRisk}
                  sx={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 26, height: 26, cursor: 'pointer', color: '#dc2626',
                    borderRadius: '4px', flexShrink: 0,
                    '&:hover': { bgcolor: '#fecaca' },
                  }}
                >
                  <CloseRoundedIcon sx={{ fontSize: '0.9rem' }} />
                </Box>
              </Box>
            )}
            {children}
          </Box>
        </Box>
        <EurekaAssistant open={eurekaOpen} onClose={() => setEurekaOpen(false)} />
        <InactivityGuard />
        {eurekaEnabled && import.meta.env.VITE_AI_FEATURES !== 'false' && <EurekaCompanionGlow />}
        <GlobalCaseWorkspace />
        <UpgradeModal />

        {!eurekaOpen && (
          <Tooltip title="Ask Eureka" placement="left">
            <Box
              onClick={() => setEurekaOpen(true)}
              data-ai-analyzable="true"
              data-ai-description="Eureka AI Companion: Click to open the full chat assistant for deep investigation and system analysis."
              sx={{
                position: 'fixed', bottom: 28, right: 28, width: 60, height: 60,
                borderRadius: '50%', bgcolor: '#d9f99d', color: 'var(--heading-color)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', zIndex: 1100,
                boxShadow: `0 12px 28px rgba(217, 249, 157, 0.45)`,
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                animation: 'fabFadeIn 0.4s ease',
                '@keyframes fabFadeIn': {
                  from: { opacity: 0, transform: 'scale(0.85)' },
                  to:   { opacity: 1, transform: 'scale(1)' },
                },
                '&:hover': { bgcolor: '#bef264', transform: 'translateY(-2px)',
                  boxShadow: `0 16px 36px rgba(217, 249, 157, 0.55)` },
                '&::before': {
                  content: '""', position: 'absolute', inset: -4, borderRadius: '50%',
                  bgcolor: '#d9f99d', opacity: 0.18,
                  animation: 'pulseRing 2.4s ease-in-out infinite', zIndex: -1,
                },
                '@keyframes pulseRing': {
                  '0%, 100%': { opacity: 0.18, transform: 'scale(1)' },
                  '50%':       { opacity: 0,    transform: 'scale(1.25)' },
                },
              }}
            >
              <AutoAwesomeOutlinedIcon sx={{ fontSize: '1.625rem' }} />
              <Box sx={{ position: 'absolute', top: 4, right: 4, width: 10, height: 10,
                borderRadius: '50%', bgcolor: '#10b981', border: '2px solid #ffffff' }} />
            </Box>
          </Tooltip>
        )}
      </Box>

      {latest && (
        <LoginAttemptAlert
          event={latest}
          onDismiss={() => setDismissed(prev => new Set([...prev, latest.at]))}
        />
      )}

      {latestGeo && (
        <GeoAccessNotification
          request={latestGeo}
          onDismiss={() => setDismissedGeo(prev => new Set([...prev, latestGeo.id]))}
        />
      )}
    </>
  )
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [eurekaOpen, setEurekaOpen] = useState(false)

  return (
    <SessionSocketProvider>
      <EurekaProvider>
        <DashboardEventsProvider>
          <ProfileProvider>
            <RbacProvider>
              <PlanProvider>
                <ActiveCaseProvider>
                  <DashboardContent eurekaOpen={eurekaOpen} setEurekaOpen={setEurekaOpen}>
                    {children || <Outlet />}
                  </DashboardContent>
                </ActiveCaseProvider>
              </PlanProvider>
            </RbacProvider>
          </ProfileProvider>
        </DashboardEventsProvider>
      </EurekaProvider>
    </SessionSocketProvider>
  )
}
