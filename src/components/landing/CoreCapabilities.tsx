import { Box, Container, Grid, Stack, Typography } from '@mui/material'
import { colorPalette, shadows } from '@/theme'
import { styled } from '@mui/material/styles'

const CapabilityCard = styled(Box)(({ theme }) => ({
  backgroundColor: '#F0EBFC',
  borderRadius: '0.75rem',
  padding: theme.spacing(3),
  boxShadow: 'none',
  transition: 'all 0.3s ease',
}))

const BlueHighlightCard = styled(Box)(({ theme }) => ({
  backgroundColor: colorPalette.primary_container,
  color: '#ffffff',
  borderRadius: '0.75rem',
  padding: theme.spacing(3),
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  minHeight: '100%',
  boxShadow: shadows.md,
}))

const ImagePlaceholder = styled(Box)(({ theme }) => ({
  backgroundColor: '#1a1a1a',
  borderRadius: '0.5rem',
  height: 250,
  marginBottom: theme.spacing(2),
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: colorPalette.on_surface_variant,
  fontSize: '0.875rem',
  overflow: 'hidden',
}))

const capabilities = [
  {
    id: 'user-pattern',
    title: 'User Pattern Analysis',
    description: 'Map the digital fingerprint of every legitimate user — device, cadence, geo, channel — and detect account takeovers the moment a session deviates.',
    icon: '👤',
  },
  {
    id: 'otp-abuse',
    title: 'OTP Abuse Engine',
    description: 'Defend against SIM-swap, OTP harvesting, and social engineering with AI-driven scoring on every authentication request.',
    icon: '🔐',
  },
  {
    id: 'sar-generation',
    title: 'SAR/STR Generation',
    description: 'Auto-generate NFIU-ready Suspicious Activity and Transaction Reports — and CBN risk-based supervision returns — in seconds.',
    icon: '📋',
  },
]

export default function CoreCapabilities() {
  return (
    <Box sx={{ bgcolor: '#FBF8FF', py: { xs: 6, md: 12 } }}>
      <Container maxWidth="lg">
        {/* Header */}
        <Stack sx={{ mb: 6, gap: 2 }}>
          <Typography
            sx={{
              color: colorPalette.primary,
              fontSize: '0.75rem',
              fontWeight: 700,
              letterSpacing: '0.1em',
            }}
          >
            CORE CAPABILITIES
          </Typography>
          <Typography
            sx={{
              color: colorPalette.on_surface,
              fontWeight: 600,
              fontSize: { xs: '1.75rem', md: '2.25rem' },
              fontFamily: 'Jost',
              letterSpacing: '-0.015em',
              lineHeight: 1.15,
              maxWidth: '720px',
            }}
          >
            One platform. Every layer of defense.
          </Typography>
        </Stack>

        {/* Bento Grid */}
        <Grid container spacing={2}>
          {/* Large Feature 1 - Geo-spatial (8 cols on md) */}
          <Grid size={{ xs: 12, md: 8 }}>
            <CapabilityCard sx={{ height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: '#FBF8FF' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                <Box sx={{ color: colorPalette.primary, fontSize: '1.5rem' }}>◉</Box>
                <Typography sx={{ mb: 0, fontWeight: 600, fontSize: '1.25rem', fontFamily: 'Jost' }}>
                  Geo-spatial Intelligence
                </Typography>
              </Box>
              <ImagePlaceholder>
                <img alt="Geo-spatial visualization" src="https://via.placeholder.com/600x300/1a1a1a/ffffff?text=Geo-spatial+Map" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </ImagePlaceholder>
              <Typography variant="body2" sx={{ color: colorPalette.on_surface_variant, mb: 2, fontSize: '0.9rem' }}>
                Visualize risk across every state, LGA, and corridor. Our engine ingests location signals in real time to surface geographic anomalies, mule corridors, and emerging fraud rings before they scale.
              </Typography>
            </CapabilityCard>
          </Grid>

          {/* Feature 2 - Transaction Monitoring (4 cols on md) */}
          <Grid size={{ xs: 12, md: 4 }}>
            <BlueHighlightCard>
              <Box>
                <Typography
                  variant="h5"
                  sx={{
                    mb: 1.5,
                    fontWeight: 600,
                    fontSize: '1.5rem',
                    color: '#ffffff',
                  }}
                >
                  ⚡ Transaction Monitoring
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                  Inspect every transaction before it settles. Pattern-recognition models intercept fraudulent flows mid-flight — without slowing legitimate ones.
                </Typography>
              </Box>
              <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 600 }}>
                    Latency
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: '0.875rem', fontWeight: 600 }}>
                    {`<`} 14ms
                  </Typography>
                </Stack>
              </Box>
            </BlueHighlightCard>
          </Grid>

          {/* Features 3, 4, 5 - 4 cols each on md */}
          {capabilities.map((cap) => (
            <Grid size={{ xs: 12, md: 4 }} key={cap.id}>
              <CapabilityCard sx={{ height: '100%' }}>
                <Box sx={{ color: colorPalette.primary, fontSize: '2rem', mb: 2, width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {cap.icon}
                </Box>
                <Typography sx={{ mb: 1, fontWeight: 600, fontSize: '1rem', fontFamily: 'Jost' }}>
                  {cap.title}
                </Typography>
                <Typography variant="body2" sx={{ color: colorPalette.on_surface_variant, fontSize: '0.875rem' }}>
                  {cap.description}
                </Typography>
              </CapabilityCard>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  )
}
