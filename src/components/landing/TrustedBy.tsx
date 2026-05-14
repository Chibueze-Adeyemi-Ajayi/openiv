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

const scroll = keyframes`
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
`

export default function TrustedBy() {
  const { ref, isVisible } = useIntersectionAnimation()

  return (
    <Box ref={ref} sx={{ bgcolor: '#ffffff', py: { xs: 8, md: 10 }, borderBottom: '1px solid #f1f5f9', overflow: 'hidden' }}>
      <Container maxWidth="lg">
        <Stack sx={{ gap: 6 }}>
          {/* Trust Bar / Scrolling Logos */}
          <Stack sx={{ gap: 4, alignItems: 'center' }}>
            <Typography
              sx={{
                fontSize: '0.75rem',
                fontWeight: 800,
                letterSpacing: '0.25em',
                color: '#94a3b8',
                textTransform: 'uppercase',
                animation: isVisible ? `${fadeInUp} 0.8s ease-out both` : 'none',
              }}
            >
              The Standard for Trusted Institutions
            </Typography>
            
            <Box 
                sx={{ 
                    width: '100%', 
                    overflow: 'hidden', 
                    position: 'relative',
                    animation: isVisible ? `${fadeInUp} 0.8s ease-out 0.1s both` : 'none',
                    '&::before, &::after': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        width: '100px',
                        height: '100%',
                        zIndex: 2,
                    },
                    '&::before': {
                        left: 0,
                        background: 'linear-gradient(to right, #ffffff, rgba(255,255,255,0))',
                    },
                    '&::after': {
                        right: 0,
                        background: 'linear-gradient(to left, #ffffff, rgba(255,255,255,0))',
                    }
                }}
            >
                <Stack 
                    direction="row" 
                    spacing={10} 
                    sx={{ 
                        width: 'max-content',
                        animation: `${scroll} 30s linear infinite`,
                        opacity: 0.5,
                        filter: 'grayscale(1)',
                        py: 2
                    }}
                >
                    {[...Array(2)].map((_, i) => (
                        <Stack key={i} direction="row" spacing={10}>
                            {['WEMA', 'ACCESS', 'ZENITH', 'GTCO', 'VFD', 'FAIRMONEY', 'KUDA', 'OPAY'].map(bank => (
                                <Typography key={bank} sx={{ fontWeight: 900, fontSize: '1.25rem', fontFamily: 'Jost', letterSpacing: '0.1em' }}>
                                    {bank}
                                </Typography>
                            ))}
                        </Stack>
                    ))}
                </Stack>
            </Box>
          </Stack>

          {/* Core Metrics */}
          <Grid container spacing={4} sx={{ pt: 4, borderTop: '1px solid #f1f5f9' }}>
            {[
              { label: 'Secure Volume', target: 1.5, suffix: 'B+', isNum: true, desc: 'Naira protected monthly' },
              { label: 'Institutional Trust', target: 400, suffix: '+', isNum: true, desc: 'Connected institutions' },
              { label: 'Detection Speed', target: 14, suffix: 'ms', isNum: true, desc: 'Real-time orchestration' },
            ].map((item, idx) => (
              <Grid
                size={{ xs: 12, md: 4 }}
                key={idx}
                sx={{
                  animation: isVisible ? `${fadeInUp} 0.8s ease-out ${0.2 + idx * 0.1}s both` : 'none',
                }}
              >
                <Stack sx={{ gap: 0.5, textAlign: 'center' }}>
                  <Typography
                    sx={{
                      fontSize: '3rem',
                      fontWeight: 900,
                      color: '#00288e',
                      fontFamily: 'Jost',
                      letterSpacing: '-0.04em'
                    }}
                  >
                    {isVisible && item.isNum ? (
                      <StatCounter target={item.target} suffix={item.suffix} shouldCount={isVisible} />
                    ) : (
                      `${item.target}${item.suffix}`
                    )}
                  </Typography>
                  <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#00288e' }}>
                    {item.label}
                  </Typography>
                  <Typography sx={{ fontSize: '0.875rem', color: '#64748b' }}>
                    {item.desc}
                  </Typography>
                </Stack>
              </Grid>
            ))}
          </Grid>
        </Stack>
      </Container>
    </Box>
  )
}
