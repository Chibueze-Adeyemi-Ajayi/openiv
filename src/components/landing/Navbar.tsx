import { Box, Button, Container, Stack, Typography } from '@mui/material'
import { colorPalette, Z_INDEX, shadows } from '@/theme'
import { useState } from 'react'

const navLinks = ['Solutions', 'Intelligence', 'Pricing', 'Resources']

export default function Navbar() {
  const [activeLink, setActiveLink] = useState('Solutions')

  return (
    <Box
      component="nav"
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: Z_INDEX.sticky,
        bgcolor: colorPalette.surface,
        height: 80,
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <Container maxWidth="lg" sx={{ width: '100%' }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{ height: '100%' }}
        >
          {/* Logo */}
          <Typography
            variant="h5"
            sx={{
              fontWeight: 600,
              color: colorPalette.on_surface,
              letterSpacing: '-0.01em',
            }}
          >
            OpenIV
          </Typography>

          {/* Nav Links - Center Aligned */}
          <Stack direction="row" sx={{ gap: 6, flex: 1, justifyContent: 'center' }}>
            {navLinks.map((link) => (
              <Box
                key={link}
                onClick={() => setActiveLink(link)}
                sx={{
                  position: 'relative',
                  cursor: 'pointer',
                }}
              >
                <Typography
                  sx={{
                    color: colorPalette.on_surface,
                    fontSize: '0.75rem',
                    fontWeight: 400,
                    fontFamily: 'Jost',
                    transition: 'color 0.2s',
                    '&:hover': {
                      color: colorPalette.primary,
                    },
                  }}
                >
                  {link}
                </Typography>
                {activeLink === link && (
                  <Box
                    sx={{
                      position: 'absolute',
                      bottom: -8,
                      left: 0,
                      right: 0,
                      height: '2px',
                      backgroundColor: colorPalette.primary,
                    }}
                  />
                )}
              </Box>
            ))}
          </Stack>

          {/* Sign In + Get Started */}
          <Stack direction="row" sx={{ gap: 2, alignItems: 'center' }}>
            <Button
              sx={{
                color: colorPalette.on_surface,
                textTransform: 'none',
                fontSize: '0.75rem',
                fontWeight: 400,
                fontFamily: 'Jost',
                '&:hover': {
                  backgroundColor: 'transparent',
                  color: colorPalette.primary,
                },
              }}
            >
              Sign In
            </Button>
            <Button
              sx={{
                background: `linear-gradient(90deg, ${colorPalette.primary} 0%, ${colorPalette.primary_container} 100%)`,
                color: '#ffffff',
                textTransform: 'none',
                fontSize: '0.75rem',
                fontWeight: 400,
                fontFamily: 'Jost',
                borderRadius: '4px',
                px: '32px',
                py: '12px',
                boxShadow: '0 4px 12px rgba(0, 40, 142, 0.25)',
                '&:hover': {
                  background: `linear-gradient(90deg, ${colorPalette.primary} 0%, ${colorPalette.primary_container} 100%)`,
                  opacity: 0.9,
                },
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
