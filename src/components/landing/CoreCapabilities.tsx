import { Box, Container, Grid, Stack, Typography } from '@mui/material'
import { colorPalette } from '@/theme'
import { styled } from '@mui/material/styles'
import { keyframes } from '@mui/system'
import SecurityIcon from '@mui/icons-material/Security'
import SpeedIcon from '@mui/icons-material/Speed'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
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

const FeatureBox = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  backgroundColor: '#ffffff',
  border: '1px solid #e5e7eb',
  transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
  '&:hover': {
    borderColor: colorPalette.primary,
    boxShadow: '0 12px 24px rgba(0, 40, 142, 0.08)',
    transform: 'translateY(-8px)',
    '& img': {
      transform: 'scale(1.05)',
    },
  },
}))

const FeatureImage = styled(Box)(({ theme }) => ({
  width: '100%',
  height: '200px',
  backgroundColor: '#f8fafc',
  borderBottom: '1px solid #e5e7eb',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
}))

const FeatureContent = styled(Box)(({ theme }) => ({
  padding: theme.spacing(3),
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1.5),
}))

const features = [
  {
    id: 'fraud-detection',
    title: 'Fraud Detection',
    description: 'Real-time transaction screening across card, wire, and digital channels. Block account takeovers and payment fraud instantly.',
    icon: SecurityIcon,
    image: 'Fraud Detection Dashboard',
  },
  {
    id: 'aml-compliance',
    title: 'AML & Compliance',
    description: 'Automatic SAR/STR filing and risk-based supervision reports for CBN and NFIU. Stay audit-ready year-round.',
    icon: CheckCircleIcon,
    image: 'Compliance Report Generator',
  },
  {
    id: 'speed',
    title: 'Speed & Scale',
    description: '50M+ transactions daily. Sub-14ms analysis. Zero performance impact. Global deployment ready.',
    icon: SpeedIcon,
    image: 'Performance Metrics',
  },
]

export default function CoreCapabilities() {
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
              Core Capabilities
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
              Three pillars of protection.
            </Typography>
          </Stack>

          {/* Feature Grid with staggered animation */}
          <Grid container spacing={3}>
            {features.map((feature, idx) => {
              const IconComponent = feature.icon
              return (
                <Grid
                  size={{ xs: 12, md: 4 }}
                  key={feature.id}
                  sx={{
                    animation: isVisible ? `${fadeInUp} 0.8s ease-out ${0.2 + idx * 0.1}s both` : 'none',
                  }}
                >
                  <FeatureBox>
                    <FeatureImage>
                      <img
                        alt={feature.image}
                        src={`https://via.placeholder.com/400x200/f8fafc/cbd5e1?text=${encodeURIComponent(feature.image)}`}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          transition: 'transform 0.4s ease',
                        }}
                      />
                    </FeatureImage>
                    <FeatureContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <IconComponent
                          sx={{
                            fontSize: '1.5rem',
                            color: colorPalette.primary,
                            transition: 'transform 0.3s ease',
                          }}
                        />
                        <Typography
                          sx={{
                            fontWeight: 700,
                            fontSize: '1.125rem',
                            color: colorPalette.on_surface,
                            fontFamily: 'Jost',
                          }}
                        >
                          {feature.title}
                        </Typography>
                      </Box>
                      <Typography sx={{ fontSize: '0.9rem', color: '#64748b', lineHeight: 1.6 }}>
                        {feature.description}
                      </Typography>
                    </FeatureContent>
                  </FeatureBox>
                </Grid>
              )
            })}
          </Grid>
        </Stack>
      </Container>
    </Box>
  )
}
