import { Box, Button, Container, Stack, Typography } from '@mui/material'
import { colorPalette, shadows } from '@/theme'
import { styled } from '@mui/material/styles'

const ImagePlaceholder = styled(Box)({
  backgroundColor: colorPalette.inverse_surface,
  borderRadius: '1rem',
  height: '100%',
  minHeight: 500,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: colorPalette.inverse_surface,
  fontSize: '0.875rem',
  overflow: 'hidden',
  boxShadow: shadows.lg,
})

export default function HeroSection() {
  return (
    <Box sx={{ bgcolor: colorPalette.surface, py: { xs: 6, md: 12 } }}>
      <Container maxWidth="lg">
        <Stack direction={{ xs: 'column', lg: 'row' }} sx={{ gap: 6, alignItems: 'center' }}>
          {/* Left Column - Text & CTAs */}
          <Box sx={{ flex: '1', display: 'flex', flexDirection: 'column' }}>
            {/* <BadgePill>Financial Intelligence Layer</BadgePill> */}

            <Typography
              sx={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                letterSpacing: '0.18em',
                color: colorPalette.primary,
                mb: 2.5,
                textTransform: 'uppercase',
              }}
            >
              Fraud Intelligence for Nigerian Financial Institutions
            </Typography>

            <Typography
              variant="h1"
              sx={{
                color: colorPalette.on_surface,
                mb: 3,
                fontWeight: 700,
                fontSize: { xs: '2rem', md: '3rem' },
                lineHeight: 1.1,
                letterSpacing: '-0.02em',
              }}
            >
              Stop fraud before it settles.
            </Typography>

            <Typography
              variant="body1"
              sx={{
                mb: 4,
                fontSize: '1rem',
                maxWidth: '92%',
                color: '#444653',
                lineHeight: 1.65,
              }}
            >
              OpenIV inspects every transaction in under 14ms — flagging suspicious flows, mapping behavioral fingerprints, and auto-generating CBN- and NFIU-aligned reports. Built for the security teams of Nigeria's banks, fintechs, and MFBs.
            </Typography>

            {/* CTA Buttons */}
            <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 2 }}>
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
                Request Demo
              </Button>
              <Button
                variant="text"
                size="large"
                sx={{
                  bgcolor: colorPalette.surface_container_high,
                  color: colorPalette.on_surface,
                  borderRadius: '0.375rem',
                  textTransform: 'none',
                  fontSize: '1rem',
                  fontWeight: 500,
                  px: 4,
                  '&:hover': {
                    bgcolor: colorPalette.surface_container,
                  },
                }}
              >
                Talk to our team
              </Button>
            </Stack>
          </Box>

          {/* Right Column - Image Placeholder */}
          <Box sx={{ flex: '1' }}>
            <ImagePlaceholder>
              <img
                alt="3D Data Visualization"
                src="https://via.placeholder.com/600x500/2f3037/ffffff?text=3D+Data+Visualization"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </ImagePlaceholder>
          </Box>
        </Stack>
      </Container>
    </Box>
  )
}
