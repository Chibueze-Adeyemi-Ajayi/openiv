import { Box, Button, Container, Stack, Typography, AppBar, Toolbar, Link as MuiLink } from '@mui/material'
import { colorPalette, Z_INDEX } from '@/theme'
import { Link as RouterLink } from 'react-router-dom'

export default function Navbar() {

  return (
    <AppBar
      position="sticky"
      sx={{
        bgcolor: '#ffffff',
        borderBottom: '1px solid #f1f5f9',
        boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
        zIndex: Z_INDEX.sticky,
      }}
    >
      <Container maxWidth="lg">
        <Toolbar sx={{ justifyContent: 'space-between', height: '80px', px: { xs: 0 } }}>
          {/* Logo */}
          <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
            <Box sx={{ position: 'relative' }}>
              <Typography
                component={RouterLink}
                to="/"
                sx={{
                  fontSize: '1.75rem',
                  fontWeight: 900,
                  color: '#1A46B8',
                  fontFamily: 'Jost',
                  letterSpacing: '0.05em',
                  cursor: 'pointer',
                  textDecoration: 'none',
                }}
              >
                OPENIV
              </Typography>
            </Box>
          </Stack>

          {/* Navigation */}
          <Stack direction="row" sx={{ gap: 4, display: { xs: 'none', md: 'flex' }, alignItems: 'center' }}>
            <Button
              href="#waitlist"
              sx={{
                bgcolor: '#1A46B8',
                color: '#ffffff',
                px: 3,
                py: 1,
                borderRadius: '4px',
                fontWeight: 600,
                fontSize: '0.875rem',
                textTransform: 'none',
                fontFamily: 'Jost',
                '&:hover': { 
                  bgcolor: '#2563EB',
                },
              }}
            >
              Join Waitlist
            </Button>
          </Stack>
        </Toolbar>
      </Container>
    </AppBar>
  )
}
