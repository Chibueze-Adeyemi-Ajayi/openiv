import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { Box, Typography, Stack, Divider, IconButton, Tooltip } from '@mui/material'
import InboxRoundedIcon from '@mui/icons-material/InboxRounded'
import BusinessRoundedIcon from '@mui/icons-material/BusinessRounded'
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded'
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded'
import { authApi } from '@/api/auth'

const NAV = [
  { to: '/superadmin/requests', label: 'Access Requests', icon: <InboxRoundedIcon fontSize="small" /> },
  { to: '/superadmin/institutions', label: 'Institutions', icon: <BusinessRoundedIcon fontSize="small" /> },
]

const navLinkSx = (active: boolean) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 1.25,
  px: 2,
  py: 1.25,
  borderRadius: 0,
  textDecoration: 'none',
  fontSize: '0.875rem',
  fontFamily: 'Jost',
  fontWeight: active ? 600 : 500,
  color: active ? '#00288e' : '#475569',
  bgcolor: active ? 'rgba(0,40,142,0.06)' : 'transparent',
  borderLeft: active ? '3px solid #00288e' : '3px solid transparent',
  transition: 'all 0.15s',
  '&:hover': { bgcolor: 'rgba(0,40,142,0.04)', color: '#00288e' },
})

export default function SuperAdminLayout() {
  const navigate = useNavigate()
  const [signingOut, setSigningOut] = useState(false)

  const handleSignOut = async () => {
    if (signingOut) return
    setSigningOut(true)
    try { await authApi.logout() } catch {}
    navigate('/auth/login')
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#f8fafc' }}>
      {/* Sidebar */}
      <Box
        sx={{
          width: 240,
          flexShrink: 0,
          bgcolor: '#ffffff',
          borderRight: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          zIndex: 100,
        }}
      >
        {/* Logo */}
        <Box sx={{ px: 2.5, py: 2.5, borderBottom: '1px solid #f1f5f9' }}>
          <Stack direction="row" alignItems="center" gap={1}>
            <Box
              sx={{
                width: 32, height: 32,
                bgcolor: '#00288e',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <ShieldRoundedIcon sx={{ color: '#d9f99d', fontSize: '1rem' }} />
            </Box>
            <Box>
              <Typography sx={{ fontFamily: 'Jost', fontWeight: 700, fontSize: '0.9375rem', color: '#00288e', lineHeight: 1.2 }}>
                OpenIV
              </Typography>
              <Typography sx={{ fontFamily: 'Jost', fontWeight: 500, fontSize: '0.6875rem', color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Super Admin
              </Typography>
            </Box>
          </Stack>
        </Box>

        {/* Nav */}
        <Box sx={{ flex: 1, py: 1.5, overflow: 'auto' }}>
          <Typography sx={{ px: 2.5, pb: 1, fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'Jost' }}>
            Management
          </Typography>
          <Stack>
            {NAV.map(({ to, label, icon }) => (
              <NavLink key={to} to={to} style={{ textDecoration: 'none' }}>
                {({ isActive }) => (
                  <Box sx={navLinkSx(isActive)}>
                    <Box sx={{ color: 'inherit', display: 'flex', alignItems: 'center' }}>{icon}</Box>
                    {label}
                  </Box>
                )}
              </NavLink>
            ))}
          </Stack>
        </Box>

        {/* Footer */}
        <Box sx={{ px: 2, py: 2, borderTop: '1px solid #f1f5f9' }}>
          <Divider sx={{ mb: 1.5 }} />
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8', fontFamily: 'Jost' }}>
              Platform Owner
            </Typography>
            <Tooltip title="Sign out">
              <IconButton size="small" onClick={handleSignOut} sx={{ color: '#94a3b8', '&:hover': { color: '#ef4444' } }}>
                <LogoutRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>
      </Box>

      {/* Main content */}
      <Box sx={{ flex: 1, ml: '240px', minWidth: 0 }}>
        <Outlet />
      </Box>
    </Box>
  )
}
