import { Box, Button, Container, Stack, Typography } from '@mui/material'
import { colorPalette, Z_INDEX } from '@/theme'

export default function Navbar() {
  return (
    <Box
      component="nav"
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: Z_INDEX.sticky,
        bgcolor: '#ffffff',
        borderBottom: '1px solid #e5e7eb',
        height: 70,
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <Container maxWidth="lg" sx={{ width: '100%' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ height: '100%' }}>
          {/* Logo */}
          <Typography
            sx={{
              fontWeight: 700,
              fontSize: '1.25rem',
              color: colorPalette.on_surface,
              fontFamily: 'Jost',
              letterSpacing: '-0.01em',
            }}
          >
            OpenIV
          </Typography>

          {/* CTAs */}
          <Stack direction="row" spacing={2}>
            <Button
              href="https://app.openiv.io/login"
              target="_blank"
              sx={{
                color: colorPalette.on_surface,
                textTransform: 'none',
                fontSize: '0.95rem',
                fontWeight: 600,
                fontFamily: 'Jost',
                '&:hover': { color: colorPalette.primary },
              }}
            >
              Sign In
            </Button>
            <Button
              href="https://app.openiv.io/signup"
              target="_blank"
              sx={{
                bgcolor: colorPalette.primary,
                color: '#ffffff',
                textTransform: 'none',
                fontSize: '0.95rem',
                fontWeight: 700,
                fontFamily: 'Jost',
                borderRadius: 0,
                px: 3,
                py: '10px',
                '&:hover': { opacity: 0.95 },
              }}
            >
              Get Started
            </Button>
          </Stack>
        </Stack>
      </Container>
    </Box>
  )
}
