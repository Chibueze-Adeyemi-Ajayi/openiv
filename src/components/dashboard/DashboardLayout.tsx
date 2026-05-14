import { Box, Tooltip } from '@mui/material'
import { useState } from 'react'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import EurekaAssistant from './EurekaAssistant'
import InactivityGuard from './InactivityGuard'
import EurekaCompanionGlow from './EurekaCompanionGlow'
import { DashboardEventsProvider, useDashboardEvents } from '@/contexts/DashboardEventsContext'
import { EurekaProvider, useEureka } from '@/contexts/EurekaContext'
import { SessionSocketProvider } from '@/contexts/SessionSocketContext'
import { colorPalette } from '@/theme'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'
import LoginAttemptAlert from './LoginAttemptAlert'
import GeoAccessNotification from './GeoAccessNotification'
import { Outlet } from 'react-router-dom'

interface DashboardLayoutProps {
  children?: React.ReactNode
}

function DashboardContent({ children, eurekaOpen, setEurekaOpen }: {
  children: React.ReactNode
  eurekaOpen: boolean
  setEurekaOpen: (v: boolean) => void
}) {
  const { eurekaEnabled } = useEureka()
  const { securityEvents, geoAccessRequests } = useDashboardEvents()
  const [dismissed,    setDismissed]    = useState<Set<string>>(new Set())
  const [dismissedGeo, setDismissedGeo] = useState<Set<number>>(new Set())

  const visible    = securityEvents.filter(e => !dismissed.has(e.at))
  const latest     = visible[0] ?? null

  const pendingGeo = geoAccessRequests.filter(
    r => r.status === 'pending' && !dismissedGeo.has(r.id)
  )
  const latestGeo  = pendingGeo[0] ?? null

  return (
    <>
      <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'var(--app-bg)' }}>
        <Sidebar />
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <Topbar onOpenEureka={() => setEurekaOpen(true)} />
          <Box sx={{ flex: 1, overflowY: 'auto' }}>{children}</Box>
        </Box>
        <EurekaAssistant open={eurekaOpen} onClose={() => setEurekaOpen(false)} />
        <InactivityGuard />
        {eurekaEnabled && <EurekaCompanionGlow />}

        {!eurekaOpen && (
          <Tooltip title="Ask Eureka" placement="left">
            <Box
              onClick={() => setEurekaOpen(true)}
              data-ai-analyzable="true"
              data-ai-description="Eureka AI Companion: Click to open the full chat assistant for deep investigation and system analysis."
              sx={{
                position: 'fixed', bottom: 28, right: 28, width: 60, height: 60,
                borderRadius: '50%', bgcolor: '#d9f99d', color: '#00288e',
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
          <DashboardContent eurekaOpen={eurekaOpen} setEurekaOpen={setEurekaOpen}>
            {children || <Outlet />}
          </DashboardContent>
        </DashboardEventsProvider>
      </EurekaProvider>
    </SessionSocketProvider>
  )
}
