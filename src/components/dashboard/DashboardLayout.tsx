import { Box, Tooltip } from '@mui/material'
import { useState } from 'react'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import EurekaAssistant from './EurekaAssistant'
import InactivityGuard from './InactivityGuard'
import { colorPalette } from '@/theme'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'

interface DashboardLayoutProps {
  children: React.ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [eurekaOpen, setEurekaOpen] = useState(false)

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'var(--app-bg)' }}>
      <Sidebar />
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Topbar onOpenEureka={() => setEurekaOpen(true)} />
        <Box sx={{ flex: 1, overflowY: 'auto' }}>{children}</Box>
      </Box>
      <EurekaAssistant open={eurekaOpen} onClose={() => setEurekaOpen(false)} />
      <InactivityGuard />

      {/* Floating Eureka FAB */}
      {!eurekaOpen && (
        <Tooltip title="Ask Eureka" placement="left">
          <Box
            onClick={() => setEurekaOpen(true)}
            sx={{
              position: 'fixed',
              bottom: 28,
              right: 28,
              width: 60,
              height: 60,
              borderRadius: '50%',
              bgcolor: colorPalette.primary,
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              zIndex: 1100,
              boxShadow: `0 12px 28px ${colorPalette.primary}45`,
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              animation: 'fabFadeIn 0.4s ease',
              '@keyframes fabFadeIn': {
                from: { opacity: 0, transform: 'scale(0.85)' },
                to: { opacity: 1, transform: 'scale(1)' },
              },
              '&:hover': {
                bgcolor: '#1a3896',
                transform: 'translateY(-2px)',
                boxShadow: `0 16px 36px ${colorPalette.primary}55`,
              },
              '&::before': {
                content: '""',
                position: 'absolute',
                inset: -4,
                borderRadius: '50%',
                bgcolor: colorPalette.primary,
                opacity: 0.18,
                animation: 'pulseRing 2.4s ease-in-out infinite',
                zIndex: -1,
              },
              '@keyframes pulseRing': {
                '0%, 100%': { opacity: 0.18, transform: 'scale(1)' },
                '50%': { opacity: 0, transform: 'scale(1.25)' },
              },
            }}
          >
            <AutoAwesomeOutlinedIcon sx={{ fontSize: '1.625rem' }} />
            <Box
              sx={{
                position: 'absolute',
                top: 4,
                right: 4,
                width: 10,
                height: 10,
                borderRadius: '50%',
                bgcolor: '#10b981',
                border: '2px solid #ffffff',
              }}
            />
          </Box>
        </Tooltip>
      )}
    </Box>
  )
}
