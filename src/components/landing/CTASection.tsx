import { Box, Button, Container, Grid, Stack, Typography } from '@mui/material'
import { colorPalette } from '@/theme'
import { keyframes } from '@mui/system'
import { useIntersectionAnimation } from '@/hooks/useIntersectionAnimation'

const fadeInUp = keyframes`
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`

const fadeInLeft = keyframes`
  from {
    opacity: 0;
    transform: translateX(-40px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
`

export default function CTASection() {
  const { ref, isVisible } = useIntersectionAnimation()

  return (
    <Box ref={ref} sx={{ bgcolor: '#ffffff', py: { xs: 8, md: 12 }, borderBottom: '1px solid #e5e7eb', overflow: 'hidden' }}>
      <Container maxWidth="lg">
        <Grid container spacing={6} sx={{ alignItems: 'center' }}>
          {/* Left - Content */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Stack sx={{ gap: 4 }}>
              <Typography
                sx={{
                  fontSize: { xs: '2rem', md: '2.75rem' },
                  fontWeight: 700,
                  color: colorPalette.on_surface,
                  lineHeight: 1.2,
                  letterSpacing: '-0.01em',
                  fontFamily: 'Jost',
                  animation: isVisible ? `${fadeInUp} 0.8s ease-out both` : 'none',
                }}
              >
                Ready to eliminate fraud losses?
              </Typography>

              <Typography
                sx={{
                  fontSize: '1.05rem',
                  color: '#64748b',
                  lineHeight: 1.7,
                  animation: isVisible ? `${fadeInUp} 0.8s ease-out 0.1s both` : 'none',
                }}
              >
                See how OpenIV protects hundreds of institutions. Get started in 2 weeks with zero operational friction.
              </Typography>

              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                sx={{ gap: 2, animation: isVisible ? `${fadeInUp} 0.8s ease-out 0.2s both` : 'none' }}
              >
                <Button
                  sx={{
                    bgcolor: colorPalette.primary,
                    color: '#ffffff',
                    textTransform: 'none',
                    fontSize: '1rem',
                    fontWeight: 700,
                    fontFamily: 'Jost',
                    borderRadius: 0,
                    px: 4,
                    py: 1.5,
                    transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    '&:hover': {
                      bgcolor: '#001a4d',
                      transform: 'translateY(-4px)',
                      boxShadow: '0 12px 24px rgba(0, 40, 142, 0.2)',
                    },
                  }}
                >
                  Start Free Trial
                </Button>
                <Button
                  variant="outlined"
                  sx={{
                    borderColor: '#cbd5e1',
                    color: colorPalette.on_surface,
                    textTransform: 'none',
                    fontSize: '1rem',
                    fontWeight: 600,
                    fontFamily: 'Jost',
                    borderRadius: 0,
                    px: 4,
                    py: 1.5,
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      borderColor: colorPalette.primary,
                      bgcolor: '#f8fafc',
                      transform: 'translateY(-2px)',
                    },
                  }}
                >
                  Schedule Demo
                </Button>
              </Stack>

              {/* Trust Indicators */}
              <Stack
                direction="row"
                spacing={3}
                sx={{
                  pt: 4,
                  borderTop: '1px solid #e5e7eb',
                  animation: isVisible ? `${fadeInUp} 0.8s ease-out 0.3s both` : 'none',
                }}
              >
                <Box>
                  <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: colorPalette.on_surface, mb: 0.5 }}>
                    ✓ No credit card required
                  </Typography>
                </Box>
                <Box>
                  <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: colorPalette.on_surface }}>
                    ✓ Full feature access
                  </Typography>
                </Box>
              </Stack>
            </Stack>
          </Grid>

          {/* Right - Visual */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Box
              sx={{
                width: '100%',
                height: '400px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e5e7eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                animation: isVisible ? `${fadeInLeft} 0.8s ease-out 0.2s both` : 'none',
                transition: 'all 0.3s ease',
                '&:hover': {
                  borderColor: colorPalette.primary,
                  boxShadow: '0 20px 40px rgba(0, 40, 142, 0.12)',
                  '& img': {
                    transform: 'scale(1.02)',
                  },
                },
              }}
            >
              <img
                alt="OpenIV case management dashboard showing active fraud investigations, risk scores, and compliance status"
                src="https://via.placeholder.com/500x400/f8fafc/cbd5e1?text=Case+Management+View"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  transition: 'transform 0.3s ease',
                }}
              />
            </Box>
          </Grid>
        </Grid>
      </Container>
    </Box>
  )
}
