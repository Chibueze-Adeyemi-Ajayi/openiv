import { Box, Container, Grid, Stack, Typography, Button } from '@mui/material'
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

export default function IntelligentSurveillance() {
  const { ref, isVisible } = useIntersectionAnimation()

  return (
    <Box ref={ref} sx={{ bgcolor: '#00288e', py: { xs: 12, md: 20 }, color: '#ffffff', overflow: 'hidden' }}>
      <Container maxWidth="lg">
        <Grid container spacing={8} sx={{ alignItems: 'center' }}>
          {/* Left - Visual */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Box
              sx={{
                position: 'relative',
                animation: isVisible ? `${fadeInUp} 0.8s ease-out both` : 'none',
              }}
            >
              {/* Abstract Engine Visual */}
              <Box
                sx={{
                  width: '100%',
                  aspectRatio: '1/1',
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(0, 40, 142, 0.4) 0%, rgba(15, 23, 42, 0) 70%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                }}
              >
                <img
                  src="/assets/landing/speed.png"
                  alt="OpenIV Intelligent Engine visualization"
                  style={{
                    width: '90%',
                    height: '90%',
                    objectFit: 'contain',
                    borderRadius: '24px',
                    boxShadow: '0 0 40px rgba(0, 40, 142, 0.3)',
                  }}
                />
                
                {/* Ping Animation Dots */}
                {[...Array(3)].map((_, i) => (
                    <Box
                        key={i}
                        sx={{
                            position: 'absolute',
                            width: 20,
                            height: 20,
                            bgcolor: colorPalette.primary,
                            borderRadius: '50%',
                            boxShadow: `0 0 20px ${colorPalette.primary}`,
                            animation: `pulse 2s infinite ${i * 0.5}s`,
                            '@keyframes pulse': {
                                '0%': { transform: 'scale(1)', opacity: 1 },
                                '100%': { transform: 'scale(3)', opacity: 0 }
                            },
                            top: `${20 + i * 30}%`,
                            left: `${70 - i * 10}%`,
                        }}
                    />
                ))}
              </Box>
            </Box>
          </Grid>

          {/* Right - Content */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Stack sx={{ gap: 4 }}>
              <Typography
                sx={{
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  letterSpacing: '0.2em',
                  color: colorPalette.primary,
                  textTransform: 'uppercase',
                  animation: isVisible ? `${fadeInUp} 0.8s ease-out 0.1s both` : 'none',
                }}
              >
                Beyond Rules
              </Typography>
              <Typography
                sx={{
                  fontSize: { xs: '2.5rem', md: '4rem' },
                  fontWeight: 900,
                  lineHeight: 1,
                  letterSpacing: '-0.04em',
                  fontFamily: 'Jost',
                  animation: isVisible ? `${fadeInUp} 0.8s ease-out 0.2s both` : 'none',
                }}
              >
                The Engine that Powers Africa's Safest Banks.
              </Typography>
              <Typography
                sx={{
                  fontSize: '1.25rem',
                  color: '#94a3b8',
                  lineHeight: 1.6,
                  fontWeight: 500,
                  animation: isVisible ? `${fadeInUp} 0.8s ease-out 0.3s both` : 'none',
                }}
              >
                OpenIV isn't just a database. It's an active orchestrator that processes millions of signals to make sub-14ms risk decisions. While others audit history, you secure the present.
              </Typography>
              
              <Stack direction="row" spacing={3} sx={{ pt: 2, animation: isVisible ? `${fadeInUp} 0.8s ease-out 0.4s both` : 'none' }}>
                <Button
                    variant="contained"
                    sx={{
                        bgcolor: '#ffffff',
                        color: '#00288e',
                        fontWeight: 700,
                        px: 4,
                        py: 2,
                        borderRadius: '8px',
                        '&:hover': { bgcolor: '#f1f5f9' }
                    }}
                >
                    Book a Private Briefing
                </Button>
              </Stack>
            </Stack>
          </Grid>
        </Grid>
      </Container>
    </Box>
  )
}
