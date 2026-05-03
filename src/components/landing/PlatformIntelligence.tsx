import { Box, Container, Grid, Stack, Typography } from '@mui/material'
import { colorPalette } from '@/theme'
import { styled } from '@mui/material/styles'
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

const StepBox = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
  transition: 'all 0.3s ease',
  '&:hover': {
    transform: 'translateX(8px)',
  },
}))

const StepNumber = styled(Box)(({ theme }) => ({
  width: 60,
  height: 60,
  borderRadius: 0,
  backgroundColor: colorPalette.primary,
  color: '#ffffff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 700,
  fontSize: '1.5rem',
  flexShrink: 0,
  transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
  boxShadow: `0 4px 12px rgba(0, 40, 142, 0.2)`,
  '&:hover': {
    transform: 'scale(1.1)',
    boxShadow: `0 8px 20px rgba(0, 40, 142, 0.3)`,
  },
}))

export default function PlatformIntelligence() {
  const { ref, isVisible } = useIntersectionAnimation()

  return (
    <Box ref={ref} sx={{ bgcolor: '#f8fafc', py: { xs: 8, md: 12 }, borderBottom: '1px solid #e5e7eb', overflow: 'hidden' }}>
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
              How It Works
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
              From transaction to decision in milliseconds.
            </Typography>
          </Stack>

          {/* Process Steps Grid */}
          <Grid container spacing={4}>
            {/* Left - Steps */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Stack sx={{ gap: 4 }}>
                {[
                  {
                    num: '1',
                    title: 'Ingest',
                    desc: 'All transactions stream to OpenIV in real time. No code changes needed. Works with your existing payments infrastructure.',
                  },
                  {
                    num: '2',
                    title: 'Analyze',
                    desc: 'Behavioral patterns, device signals, network effects, and AML rules trigger in <14ms per transaction. No delays.',
                  },
                  {
                    num: '3',
                    title: 'Act',
                    desc: 'Approve, challenge, or escalate. Auto-generate compliance reports. Integrate webhook responses directly into your workflow.',
                  },
                ].map((step, idx) => (
                  <StepBox
                    key={idx}
                    sx={{
                      animation: isVisible ? `${fadeInUp} 0.8s ease-out ${0.2 + idx * 0.12}s both` : 'none',
                    }}
                  >
                    <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start' }}>
                      <StepNumber>{step.num}</StepNumber>
                      <Stack sx={{ gap: 1, py: 1 }}>
                        <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: colorPalette.on_surface, fontFamily: 'Jost' }}>
                          {step.title}
                        </Typography>
                        <Typography sx={{ fontSize: '0.95rem', color: '#64748b', lineHeight: 1.6 }}>
                          {step.desc}
                        </Typography>
                      </Stack>
                    </Box>
                  </StepBox>
                ))}
              </Stack>
            </Grid>

            {/* Right - Diagram/Visual */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Box
                sx={{
                  width: '100%',
                  height: '500px',
                  backgroundColor: '#ffffff',
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
                      transform: 'scale(1.05)',
                    },
                  },
                }}
              >
                <img
                  alt="OpenIV transaction flow diagram: transaction ingestion → behavioral analysis → risk decision → compliance reporting"
                  src="https://via.placeholder.com/500x500/ffffff/cbd5e1?text=Transaction+Flow+Diagram"
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
        </Stack>
      </Container>
    </Box>
  )
}
