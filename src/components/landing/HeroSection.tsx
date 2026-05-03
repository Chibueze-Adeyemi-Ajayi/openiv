import { Box, Button, Container, Grid, Stack, Typography } from '@mui/material'
import { colorPalette } from '@/theme'
import { keyframes } from '@mui/system'
import { useState, useEffect } from 'react'
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

const fadeInRight = keyframes`
  from {
    opacity: 0;
    transform: translateX(40px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
`

const StatCounter = ({ target, shouldCount }: { target: number; shouldCount: boolean }) => {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!shouldCount || count >= target) return
    const increment = Math.ceil(target / 30)
    const timer = setTimeout(() => setCount(prev => Math.min(prev + increment, target)), 30)
    return () => clearTimeout(timer)
  }, [count, target, shouldCount])

  return <>{count.toLocaleString()}</>
}

export default function HeroSection() {
  const { ref, isVisible } = useIntersectionAnimation()

  return (
    <Box ref={ref} sx={{ bgcolor: '#ffffff', py: { xs: 6, md: 10 }, borderBottom: '1px solid #e5e7eb', overflow: 'hidden' }}>
      <Container maxWidth="lg">
        <Grid container spacing={6} sx={{ alignItems: 'center' }}>
          {/* Left - Text */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Stack sx={{ gap: 4 }}>
              <Typography
                sx={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  letterSpacing: '0.15em',
                  color: colorPalette.primary,
                  textTransform: 'uppercase',
                  animation: isVisible ? `${fadeInUp} 0.8s ease-out 0.1s both` : 'none',
                }}
              >
                Real-Time Intelligence
              </Typography>

              <Typography
                sx={{
                  fontSize: { xs: '2.5rem', md: '3.25rem' },
                  fontWeight: 700,
                  color: colorPalette.on_surface,
                  lineHeight: 1.15,
                  letterSpacing: '-0.02em',
                  fontFamily: 'Jost',
                  animation: isVisible ? `${fadeInUp} 0.8s ease-out 0.2s both` : 'none',
                }}
              >
                Catch fraud before it costs millions. Automate AML.
              </Typography>

              <Typography
                sx={{
                  fontSize: '1.05rem',
                  color: '#64748b',
                  lineHeight: 1.7,
                  animation: isVisible ? `${fadeInUp} 0.8s ease-out 0.3s both` : 'none',
                }}
              >
                OpenIV analyzes every transaction in real time. Detect behavioral anomalies, block account takeovers, and auto-generate SAR/STR filings—all in milliseconds.
              </Typography>

              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                sx={{ gap: 2, pt: 2, animation: isVisible ? `${fadeInUp} 0.8s ease-out 0.4s both` : 'none' }}
              >
                <Button
                  sx={{
                    bgcolor: colorPalette.primary,
                    color: '#ffffff',
                    textTransform: 'none',
                    fontSize: '1rem',
                    fontWeight: 600,
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
                  Request Demo
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
                  Learn More
                </Button>
              </Stack>

              {/* Animated Stats */}
              <Stack
                direction="row"
                spacing={4}
                sx={{
                  pt: 4,
                  borderTop: '1px solid #e5e7eb',
                  animation: isVisible ? `${fadeInUp} 0.8s ease-out 0.5s both` : 'none',
                }}
              >
                <Box>
                  <Typography
                    sx={{
                      fontSize: '1.75rem',
                      fontWeight: 700,
                      color: colorPalette.primary,
                      mb: 0.5,
                    }}
                  >
                    &lt;14ms
                  </Typography>
                  <Typography sx={{ fontSize: '0.8rem', color: '#94a3b8' }}>Detection latency</Typography>
                </Box>
                <Box>
                  <Typography
                    sx={{
                      fontSize: '1.75rem',
                      fontWeight: 700,
                      color: colorPalette.primary,
                      mb: 0.5,
                    }}
                  >
                    {isVisible && <StatCounter target={62} shouldCount={isVisible} />}%
                  </Typography>
                  <Typography sx={{ fontSize: '0.8rem', color: '#94a3b8' }}>False positives reduced</Typography>
                </Box>
                <Box>
                  <Typography
                    sx={{
                      fontSize: '1.75rem',
                      fontWeight: 700,
                      color: colorPalette.primary,
                      mb: 0.5,
                    }}
                  >
                    {isVisible && <StatCounter target={50} shouldCount={isVisible} />}M+
                  </Typography>
                  <Typography sx={{ fontSize: '0.8rem', color: '#94a3b8' }}>Daily transactions</Typography>
                </Box>
              </Stack>
            </Stack>
          </Grid>

          {/* Right - Image with hover animation */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Box
              sx={{
                width: '100%',
                height: '450px',
                bgcolor: '#f8fafc',
                border: '1px solid #e5e7eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                position: 'relative',
                animation: isVisible ? `${fadeInRight} 0.8s ease-out 0.3s both` : 'none',
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
                alt="OpenIV dashboard showing real-time transaction analysis with fraud detection metrics, risk scores, and case management interface"
                src="https://via.placeholder.com/600x450/f8fafc/94a3b8?text=Dashboard+Screenshot"
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
