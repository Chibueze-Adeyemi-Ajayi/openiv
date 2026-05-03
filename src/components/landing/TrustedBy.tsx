import { Box, Container, Grid, Stack, Typography } from '@mui/material'
import { colorPalette } from '@/theme'
import { styled } from '@mui/material/styles'
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

const StatCounter = ({ target, suffix, shouldCount }: { target: number; suffix: string; shouldCount: boolean }) => {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!shouldCount || count >= target) return
    const increment = Math.ceil(target / 30)
    const timer = setTimeout(() => setCount(prev => Math.min(prev + increment, target)), 30)
    return () => clearTimeout(timer)
  }, [count, target, shouldCount])

  return (
    <>
      {count.toLocaleString()}
      {suffix}
    </>
  )
}

const StatCard = styled(Box)(({ theme }) => ({
  padding: theme.spacing(3),
  backgroundColor: '#ffffff',
  border: '1px solid #e5e7eb',
  transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
  '&:hover': {
    borderColor: colorPalette.primary,
    boxShadow: '0 12px 24px rgba(0, 40, 142, 0.08)',
    transform: 'translateY(-6px)',
  },
}))

export default function TrustedBy() {
  const { ref, isVisible } = useIntersectionAnimation()

  return (
    <Box ref={ref} sx={{ bgcolor: '#ffffff', py: { xs: 8, md: 12 }, borderBottom: '1px solid #e5e7eb', overflow: 'hidden' }}>
      <Container maxWidth="lg">
        <Stack sx={{ gap: 8 }}>
          {/* Header */}
          <Stack sx={{ maxWidth: '600px', gap: 3 }}>
            <Typography
              sx={{
                fontSize: '0.75rem',
                fontWeight: 700,
                letterSpacing: '0.15em',
                color: colorPalette.primary,
                textTransform: 'uppercase',
                animation: isVisible ? `${fadeInUp} 0.8s ease-out both` : 'none',
              }}
            >
              Trusted by Global Institutions
            </Typography>
            <Typography
              sx={{
                fontSize: { xs: '2rem', md: '2.75rem' },
                fontWeight: 700,
                color: colorPalette.on_surface,
                lineHeight: 1.2,
                letterSpacing: '-0.01em',
                fontFamily: 'Jost',
                animation: isVisible ? `${fadeInUp} 0.8s ease-out 0.1s both` : 'none',
              }}
            >
              Battle-tested at scale.
            </Typography>
          </Stack>

          {/* Stats Grid */}
          <Grid container spacing={3}>
            {[
              { label: 'Daily Transactions', desc: 'Analyzed in real time', target: 50, suffix: 'M+', isNum: true },
              { label: 'Fraud Prevented', desc: 'Year to date', target: 18, suffix: 'B+', isNum: true },
              { label: 'System Uptime', desc: 'Enterprise SLA', target: 99, suffix: '.98%', isNum: true },
              { label: 'Faster Case Resolution', desc: 'With KYC integration', target: 37, suffix: '%', isNum: true },
              { label: 'Fewer False Positives', desc: 'ML-driven precision', target: 62, suffix: '%', isNum: true },
              { label: 'Compliance Coverage', desc: 'CBN + NFIU aligned', target: 100, suffix: '%', isNum: true },
            ].map((item, idx) => (
              <Grid
                size={{ xs: 12, sm: 6, md: 4 }}
                key={idx}
                sx={{
                  animation: isVisible ? `${fadeInUp} 0.8s ease-out ${0.2 + idx * 0.08}s both` : 'none',
                }}
              >
                <StatCard>
                  <Stack sx={{ gap: 1, textAlign: 'center' }}>
                    <Typography
                      sx={{
                        fontSize: '2.5rem',
                        fontWeight: 700,
                        color: colorPalette.primary,
                        fontFamily: 'Jost',
                      }}
                    >
                      {isVisible && item.isNum ? (
                        <StatCounter target={item.target} suffix={item.suffix} shouldCount={isVisible} />
                      ) : (
                        `${item.target}${item.suffix}`
                      )}
                    </Typography>
                    <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: colorPalette.on_surface, fontFamily: 'Jost' }}>
                      {item.label}
                    </Typography>
                    <Typography sx={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                      {item.desc}
                    </Typography>
                  </Stack>
                </StatCard>
              </Grid>
            ))}
          </Grid>

          {/* Certifications */}
          <Box sx={{ pt: 4, borderTop: '1px solid #e5e7eb' }}>
            <Typography
              sx={{
                fontSize: '0.75rem',
                fontWeight: 700,
                letterSpacing: '0.15em',
                color: '#94a3b8',
                textTransform: 'uppercase',
                mb: 3,
                animation: isVisible ? `${fadeInUp} 0.8s ease-out both` : 'none',
              }}
            >
              Certifications & Compliance
            </Typography>
            <Grid container spacing={2}>
              {['CBN Aligned', 'NFIU SAR/STR', 'ISO 27001', 'NDPR Ready', 'PCI DSS', 'SOC 2 Type II'].map((cert, idx) => (
                <Grid
                  size={{ xs: 6, sm: 4, md: 2 }}
                  key={cert}
                  sx={{
                    animation: isVisible ? `${fadeInUp} 0.8s ease-out ${0.1 + idx * 0.08}s both` : 'none',
                  }}
                >
                  <Box
                    sx={{
                      p: 2,
                      bgcolor: '#f8fafc',
                      border: '1px solid #e5e7eb',
                      textAlign: 'center',
                      transition: 'all 0.3s ease',
                      cursor: 'pointer',
                      '&:hover': {
                        borderColor: colorPalette.primary,
                        bgcolor: '#ffffff',
                      },
                    }}
                  >
                    <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: colorPalette.primary }}>
                      {cert}
                    </Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Box>
        </Stack>
      </Container>
    </Box>
  )
}
