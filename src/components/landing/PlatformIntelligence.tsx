import { Box, Container, Stack, Typography } from '@mui/material'
import { colorPalette, shadows } from '@/theme'
import { styled } from '@mui/material/styles'

const BadgePill = styled(Box)(({ theme }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  backgroundColor: colorPalette.tertiary,
  color: '#ffffff',
  padding: `${theme.spacing(0.5)} ${theme.spacing(1.5)}`,
  borderRadius: '9999px',
  fontSize: '0.75rem',
  fontWeight: 600,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  marginBottom: theme.spacing(2),
  width: 'fit-content',
}))

const FeatureItem = styled(Stack)(({ theme }) => ({
  flexDirection: 'row',
  gap: theme.spacing(2),
  alignItems: 'flex-start',
}))

const CheckIcon = styled(Box)(({ theme }) => ({
  color: colorPalette.primary,
  fontSize: '1.5rem',
  fontWeight: 'bold',
  flexShrink: 0,
  marginTop: theme.spacing(0.25),
}))

const GlassmorphicContainer = styled(Box)(({ theme }) => ({
  background: 'rgba(255, 255, 255, 0.7)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  borderRadius: '0.75rem',
  border: '1px solid rgba(255, 255, 255, 0.4)',
  boxShadow: shadows.xl,
  overflow: 'hidden',
}))

const DashboardHeader = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1.5),
  borderBottom: `1px solid ${colorPalette.outline_variant}33`,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  backgroundColor: colorPalette.surface_container,
}))

const features = [
  {
    id: 'threat-hunting',
    title: 'Autonomous threat hunting',
    description: 'Self-evolving models that adapt to new fraud typologies — no rule-tuning required.',
  },
  {
    id: 'risk-scoring',
    title: 'Predictive risk scoring',
    description: 'Score every customer, account, and transaction in real time against 200+ behavioral signals.',
  },
  {
    id: 'compliance',
    title: 'Compliance on autopilot',
    description: 'Auto-generate SAR/STR filings to NFIU specifications and CBN risk-based supervision returns.',
  },
]

export default function PlatformIntelligence() {
  return (
    <Box sx={{ bgcolor: colorPalette.surface_container_low, py: { xs: 6, md: 12 } }}>
      <Container maxWidth="lg">
        <Stack direction={{ xs: 'column', lg: 'row' }} sx={{ gap: 6, alignItems: 'flex-start' }}>
          {/* Left Column - Text & Features */}
          <Box sx={{ flex: '1', display: 'flex', flexDirection: 'column' }}>
            <BadgePill>Agentic AI</BadgePill>

            <Typography
              variant="h2"
              sx={{
                color: colorPalette.on_surface,
                mb: 3,
                fontWeight: 600,
                fontSize: '2rem',
                letterSpacing: '-0.015em',
                lineHeight: 1.2,
              }}
            >
              AI agents that hunt fraud — 24/7, across every channel.
            </Typography>

            <Typography
              variant="body1"
              sx={{
                color: colorPalette.on_surface_variant,
                mb: 3,
                fontSize: '1rem',
                lineHeight: 1.65,
              }}
            >
              While traditional rule engines wait for thresholds to trip, OpenIV's agents continuously profile your customers, correlate across channels, and surface emerging fraud rings before they reach scale.
            </Typography>

            {/* Feature List */}
            <Stack sx={{ gap: 2 }}>
              {features.map((feature) => (
                <FeatureItem key={feature.id}>
                  <CheckIcon>✓</CheckIcon>
                  <Box>
                    <Typography variant="body1" sx={{ fontWeight: 600, color: colorPalette.on_surface, mb: 0.5 }}>
                      {feature.title}
                    </Typography>
                    <Typography variant="body2" sx={{ color: colorPalette.on_surface_variant, fontSize: '0.875rem' }}>
                      {feature.description}
                    </Typography>
                  </Box>
                </FeatureItem>
              ))}
            </Stack>
          </Box>

          {/* Right Column - Glassmorphic Dashboard */}
          <Box sx={{ flex: '1', minHeight: 450 }}>
            <GlassmorphicContainer>
              <DashboardHeader>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <Box sx={{ display: 'flex', gap: 0.75 }}>
                    <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#ef4444' }} />
                    <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#eab308' }} />
                    <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#22c55e' }} />
                  </Box>
                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      letterSpacing: '0.1em',
                      opacity: 0.6,
                      ml: 1,
                    }}
                  >
                    COMMAND CENTER V2.4
                  </Typography>
                </Stack>
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    bgcolor: colorPalette.primary,
                    color: '#ffffff',
                    px: 1,
                    py: 0.5,
                    borderRadius: '0.25rem',
                  }}
                >
                  LIVE MONITOR
                </Typography>
              </DashboardHeader>

              <Box sx={{ p: 1.5, bgcolor: colorPalette.surface_container_lowest }}>
                {/* Dashboard Chart */}
                <Box
                  sx={{
                    gridColumn: '1 / -1',
                    height: 200,
                    bgcolor: colorPalette.surface_container_low,
                    borderRadius: '0.5rem',
                    mb: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                >
                  <img
                    alt="Dashboard visualization"
                    src="https://via.placeholder.com/500x200/2f3037/ffffff?text=Dashboard+Chart"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }}
                  />
                </Box>

                {/* Metrics Grid */}
                <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                  {/* Threats Metric */}
                  <Box
                    sx={{
                      flex: 1,
                      height: 100,
                      bgcolor: colorPalette.surface_container_low,
                      borderRadius: '0.375rem',
                      p: 1.5,
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        opacity: 0.5,
                        display: 'block',
                        mb: 0.5,
                      }}
                    >
                      Open Investigations
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
                      12
                    </Typography>
                    <Box sx={{ width: '100%', height: 4, bgcolor: colorPalette.outline_variant + '33', borderRadius: '2px' }}>
                      <Box sx={{ width: '45%', height: '100%', bgcolor: colorPalette.error, borderRadius: '2px' }} />
                    </Box>
                  </Box>

                  {/* Health Metric */}
                  <Box
                    sx={{
                      flex: 1,
                      height: 100,
                      bgcolor: colorPalette.surface_container_low,
                      borderRadius: '0.375rem',
                      p: 1.5,
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        opacity: 0.5,
                        display: 'block',
                        mb: 0.5,
                      }}
                    >
                      System Health
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
                      99.98%
                    </Typography>
                    <Box sx={{ width: '100%', height: 4, bgcolor: colorPalette.outline_variant + '33', borderRadius: '2px' }}>
                      <Box sx={{ width: '99%', height: '100%', bgcolor: colorPalette.primary, borderRadius: '2px' }} />
                    </Box>
                  </Box>
                </Stack>

                {/* Alerts */}
                <Stack spacing={0.75}>
                  <Box
                    sx={{
                      p: 1,
                      bgcolor: colorPalette.surface_container_high,
                      borderRadius: '0.25rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flex: 1 }}>
                      <Box
                        sx={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          bgcolor: colorPalette.error,
                          animation: 'pulse 2s infinite',
                          '@keyframes pulse': {
                            '0%, 100%': { opacity: 1 },
                            '50%': { opacity: 0.5 },
                          },
                        }}
                      />
                      <Typography variant="caption" sx={{ fontSize: '0.75rem', fontWeight: 500 }}>
                        SIM-swap risk · 4 accounts · Lagos, NG
                      </Typography>
                    </Stack>
                    <Typography variant="caption" sx={{ fontSize: '0.6rem', opacity: 0.4, fontWeight: 700 }}>
                      2m ago
                    </Typography>
                  </Box>

                  <Box
                    sx={{
                      p: 1,
                      bgcolor: colorPalette.surface_container_low,
                      borderRadius: '0.25rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flex: 1 }}>
                      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: colorPalette.primary }} />
                      <Typography variant="caption" sx={{ fontSize: '0.75rem', fontWeight: 500 }}>
                        NFIU STR filed · Case #4827
                      </Typography>
                    </Stack>
                    <Typography variant="caption" sx={{ fontSize: '0.6rem', opacity: 0.4, fontWeight: 700 }}>
                      15m ago
                    </Typography>
                  </Box>
                </Stack>
              </Box>
            </GlassmorphicContainer>
          </Box>
        </Stack>
      </Container>
    </Box>
  )
}
