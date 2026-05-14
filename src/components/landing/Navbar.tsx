import { Box, Button, Container, Stack, Typography, AppBar, Toolbar, Link as MuiLink } from '@mui/material'
import { colorPalette, Z_INDEX } from '@/theme'
import { Link as RouterLink, useLocation } from 'react-router-dom'

export default function Navbar() {
  const location = useLocation()

  return (
    <AppBar
      position="sticky"
      sx={{
        bgcolor: 'rgba(0, 40, 142, 0.85)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        boxShadow: 'none',
        zIndex: Z_INDEX.sticky,
      }}
    >
      <Container maxWidth="lg">
        <Toolbar sx={{ justifyContent: 'space-between', height: '80px', px: { xs: 0 } }}>
          {/* Logo */}
          <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
            <Box sx={{ position: 'relative' }}>
              <Box
                sx={{
                  position: 'absolute',
                  top: -4,
                  left: 0,
                  width: 30,
                  height: '2.5px',
                  bgcolor: '#ffffff',
                  borderRadius: '1px',
                }}
              />
              <Typography
                component={RouterLink}
                to="/"
                sx={{
                  fontSize: '1.25rem',
                  fontWeight: 900,
                  color: '#ffffff',
                  fontFamily: 'Jost',
                  letterSpacing: '0.05em',
                  cursor: 'pointer',
                  textDecoration: 'none',
                  position: 'relative',
                }}
              >
                OPENIV
              </Typography>
            </Box>
          </Stack>

          {/* Navigation */}
          <Stack direction="row" sx={{ gap: 4, display: { xs: 'none', md: 'flex' }, alignItems: 'center' }}>
            {[
              { label: 'Home', path: '/' },
              { label: 'Solutions', path: '/solutions' },
              { label: 'Network', path: '/network' },
              { label: 'Compliance', path: '/compliance' },
              { label: 'Security', path: '/security' }
            ].map((item) => {
              const isActive = location.pathname === item.path
              return (
                <Typography
                  key={item.label}
                  component={RouterLink}
                  to={item.path}
                  sx={{
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: isActive ? '#ffffff' : '#94a3b8',
                    cursor: 'pointer',
                    textDecoration: 'none',
                    transition: 'all 0.3s ease',
                    position: 'relative',
                    '&:hover': { color: '#ffffff' },
                    '&::after': {
                      content: '""',
                      position: 'absolute',
                      bottom: -4,
                      left: 0,
                      width: isActive ? '100%' : '0%',
                      height: '2px',
                      bgcolor: '#d9f99d',
                      transition: 'all 0.3s ease',
                    }
                  }}
                >
                  {item.label}
                </Typography>
              )
            })}
            
            <Typography
              component={RouterLink}
              to="/auth/login"
              sx={{
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#ffffff',
                cursor: 'pointer',
                textDecoration: 'none',
                ml: 2,
                '&:hover': { color: '#94a3b8' },
              }}
            >
              Sign In
            </Typography>

            <Button
              component={RouterLink}
              to="/request-access"
              sx={{
                bgcolor: 'transparent',
                color: '#ffffff',
                border: '1px solid rgba(255,255,255,0.2)',
                px: 3,
                borderRadius: 0,
                fontWeight: 600,
                fontSize: '0.875rem',
                textTransform: 'none',
                fontFamily: 'Jost',
                '&:hover': { 
                  bgcolor: 'rgba(255,255,255,0.05)',
                  borderColor: '#ffffff'
                },
              }}
            >
              Schedule a Demo
            </Button>
          </Stack>
        </Toolbar>
      </Container>
    </AppBar>
  )
}
