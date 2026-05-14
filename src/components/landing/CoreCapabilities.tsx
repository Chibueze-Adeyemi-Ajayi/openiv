import { Box, Container, Grid, Stack, Typography } from '@mui/material'
import { colorPalette } from '@/theme/palette'
import { keyframes } from '@mui/system'
import { useIntersectionAnimation } from '@/hooks/useIntersectionAnimation'
import SecurityIcon from '@mui/icons-material/Security'
import StorageIcon from '@mui/icons-material/Storage'
import GavelIcon from '@mui/icons-material/Gavel'

const slideInLine = keyframes`
  from { opacity: 0; transform: translateX(-30px); }
  to { opacity: 1; transform: translateX(0); }
`

const features = [
  {
    title: 'Real-Time Surveillance',
    description: 'Intercept suspicious patterns with sub-14ms orchestration. Our engine analyzes 12,000+ variables per transaction to block fraud before it reaches your ledger.',
    icon: SecurityIcon
  },
  {
    title: 'Behavioral Orchestration',
    description: 'Go beyond basic KYC. Integrate deep behavioral profiling and device fingerprinting to reduce false positives by 62% while scaling your user base.',
    icon: StorageIcon
  },
  {
    title: 'Automated Compliance',
    description: 'Ensure 100% CBN and NFIU alignment. Automate SAR/STR filing workflows and risk-based supervision reports with zero operational friction.',
    icon: GavelIcon
  }
]

export default function CoreCapabilities() {
  const { ref, isVisible } = useIntersectionAnimation()

  return (
    <Box ref={ref} sx={{ bgcolor: '#00288e', py: { xs: 8, md: 12 }, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <Container maxWidth="lg">
        <Grid container spacing={4}>
          {features.map((feature, idx) => (
            <Grid 
                size={{ xs: 12, md: 4 }} 
                key={idx}
            >
              <Box
                sx={{
                  p: 4,
                  bgcolor: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: 0,
                  height: '100%',
                  transition: 'all 0.3s ease',
                  animation: isVisible ? `${slideInLine} 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) ${idx * 0.15}s both` : 'none',
                  '&:hover': {
                    bgcolor: 'rgba(255,255,255,0.05)',
                    borderColor: '#d9f99d'
                  }
                }}
              >
                <Stack sx={{ gap: 3 }}>
                  <Box sx={{ width: 48, height: 48, bgcolor: 'rgba(217, 249, 157, 0.1)', borderRadius: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <feature.icon sx={{ color: '#d9f99d' }} />
                  </Box>
                  <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: '#ffffff', fontFamily: 'Jost' }}>
                    {feature.title}
                  </Typography>
                  <Typography sx={{ fontSize: '1rem', color: '#94a3b8', lineHeight: 1.6 }}>
                    {feature.description}
                  </Typography>
                </Stack>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  )
}
