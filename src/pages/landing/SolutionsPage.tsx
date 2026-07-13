import { Box, Container, Stack, Typography, Grid, Link } from '@mui/material'
import Navbar from '@/components/landing/Navbar'
import Footer from '@/components/landing/Footer'
import { keyframes } from '@mui/system'
import { useIntersectionAnimation } from '@/hooks/useIntersectionAnimation'
import { useSEO } from '@/hooks/useSEO'

const bounceIn = keyframes`
  0% { opacity: 0; transform: scale(0.3) translateY(20px); }
  50% { opacity: 1; transform: scale(1.05) translateY(-5px); }
  70% { transform: scale(0.9) translateY(2px); }
  100% { transform: scale(1) translateY(0); }
`

const slideInLine = keyframes`
  from { opacity: 0; transform: translateX(-30px); }
  to { opacity: 1; transform: translateX(0); }
`

export default function SolutionsPage() {
  useSEO({
    title: 'Solutions – AML, KYC & Fraud Detection for Banks & Fintechs',
    description: "Explore OpenIV's full suite: real-time transaction monitoring, 360° KYC profiling, behavioural analytics, and automated regulatory reporting — all in one platform.",
    canonical: '/solutions',
    ogImage: 'https://openiv.ng/assets/landing/aml_dashboard_mockup.png',
  })
  const { ref: heroRef, isVisible: heroVisible } = useIntersectionAnimation()

  return (
    <Box sx={{ bgcolor: '#00288e', minHeight: '100vh', color: '#ffffff' }}>
      <Navbar />
      
      {/* Hero Section */}
      <Box 
        ref={heroRef}
        sx={{ 
          pt: { xs: 12, md: 20 }, 
          pb: { xs: 10, md: 16 },
          borderBottom: '1px solid rgba(255,255,255,0.1)' 
        }}
      >
        <Container maxWidth="lg">
          <Stack sx={{ gap: 4, maxWidth: '900px' }}>
            <Typography
              sx={{
                fontSize: { xs: '2.5rem', md: '4.5rem' },
                fontWeight: 600,
                lineHeight: 1,
                letterSpacing: '-0.04em',
                fontFamily: 'Jost',
                animation: heroVisible ? `${bounceIn} 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) both` : 'none',
              }}
            >
              Unified Risk Orchestration for Modern Finance
            </Typography>
            <Typography
              sx={{
                fontSize: '1.25rem',
                color: '#94a3b8',
                lineHeight: 1.6,
                maxWidth: '720px',
                animation: heroVisible ? `${slideInLine} 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) 0.4s both` : 'none',
              }}
            >
              One platform. Infinite signals. OpenIV orchestrates transaction monitoring, behavioral analytics, and identity verification into a single, real-time risk decision engine.
            </Typography>
          </Stack>
        </Container>
      </Box>

      {/* Solutions Grid */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: 'rgba(255,255,255,0.02)' }}>
        <Container maxWidth="lg">
          <Stack sx={{ gap: 12 }}>
            {/* Block 1: Monitoring */}
            <Grid container spacing={12} sx={{ alignItems: 'center' }}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Stack sx={{ gap: 4 }}>
                  <Typography sx={{ color: '#d9f99d', fontWeight: 700, letterSpacing: '0.1em', fontSize: '0.875rem' }}>
                    REAL-TIME MONITORING
                  </Typography>
                  <Typography sx={{ fontSize: '2.5rem', fontWeight: 600, fontFamily: 'Jost', lineHeight: 1.1 }}>
                    Sub-14ms Transaction Orchestration
                  </Typography>
                  <Typography sx={{ fontSize: '1.125rem', color: '#94a3b8', lineHeight: 1.8 }}>
                    Intercept suspicious patterns before they settle. Our engine analyzes 12,000+ variables per transaction, providing instant risk decisions across your entire digital ecosystem.
                  </Typography>
                  <Box sx={{ p: 4, borderLeft: '4px solid #d9f99d', bgcolor: 'rgba(255,255,255,0.02)' }}>
                    <Typography sx={{ fontWeight: 700, color: '#ffffff', mb: 1 }}>Solution Outcome:</Typography>
                    <Typography sx={{ color: '#94a3b8' }}>Immediate fraud prevention with zero impact on legitimate user experience.</Typography>
                  </Box>
                </Stack>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Box sx={{ p: 2, border: '1px solid rgba(255,255,255,0.1)', bgcolor: 'rgba(255,255,255,0.03)' }}>
                  <img src="/assets/landing/aml_dashboard_mockup.png" alt="Transaction Monitoring" style={{ width: '100%', borderRadius: 0 }} />
                </Box>
              </Grid>
            </Grid>

            {/* Block 2: Case Filing */}
            <Grid container spacing={12} sx={{ alignItems: 'center', flexDirection: 'row-reverse' }}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Stack sx={{ gap: 4 }}>
                  <Typography sx={{ color: '#d9f99d', fontWeight: 700, letterSpacing: '0.1em', fontSize: '0.875rem' }}>
                    CASE MANAGEMENT
                  </Typography>
                  <Typography sx={{ fontSize: '2.5rem', fontWeight: 600, fontFamily: 'Jost', lineHeight: 1.1 }}>
                    Automated Case Filing & Workflows
                  </Typography>
                  <Typography sx={{ fontSize: '1.125rem', color: '#94a3b8', lineHeight: 1.8 }}>
                    Stop manual SAR/STR preparation. Our system automatically collates all evidence, transaction histories, and behavioral signals into audit-ready case files for direct NFIU submission.
                  </Typography>
                  <Box sx={{ p: 4, borderLeft: '4px solid #d9f99d', bgcolor: 'rgba(255,255,255,0.02)' }}>
                    <Typography sx={{ fontWeight: 700, color: '#ffffff', mb: 1 }}>Solution Outcome:</Typography>
                    <Typography sx={{ color: '#94a3b8' }}>Reduce case preparation time by 85% while ensuring 100% regulatory accuracy.</Typography>
                  </Box>
                </Stack>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Box sx={{ p: 2, border: '1px solid rgba(255,255,255,0.1)', bgcolor: 'rgba(255,255,255,0.03)' }}>
                  <img src="/assets/landing/fraud_leakage.png" alt="Case Filing" style={{ width: '100%', borderRadius: 0 }} />
                </Box>
              </Grid>
            </Grid>

            {/* Block 3: Reporting */}
            <Grid container spacing={12} sx={{ alignItems: 'center' }}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Stack sx={{ gap: 4 }}>
                  <Typography sx={{ color: '#d9f99d', fontWeight: 700, letterSpacing: '0.1em', fontSize: '0.875rem' }}>
                    GOVERNANCE
                  </Typography>
                  <Typography sx={{ fontSize: '2.5rem', fontWeight: 600, fontFamily: 'Jost', lineHeight: 1.1 }}>
                    Institutional Reporting & RBS
                  </Typography>
                  <Typography sx={{ fontSize: '1.125rem', color: '#94a3b8', lineHeight: 1.8 }}>
                    Generate comprehensive Risk-Based Supervision reports for the CBN in one click. Monitor institutional exposure across customer risk, geographic risk, and channel-specific vectors.
                  </Typography>
                  <Box sx={{ p: 4, borderLeft: '4px solid #d9f99d', bgcolor: 'rgba(255,255,255,0.02)' }}>
                    <Typography sx={{ fontWeight: 700, color: '#ffffff', mb: 1 }}>Solution Outcome:</Typography>
                    <Typography sx={{ color: '#94a3b8' }}>Maintain total visibility and an always-on audit posture for regulatory examinations.</Typography>
                  </Box>
                </Stack>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Box sx={{ p: 2, border: '1px solid rgba(255,255,255,0.1)', bgcolor: 'rgba(255,255,255,0.03)' }}>
                  <img src="/assets/landing/compliance_report.png" alt="Institutional Reporting" style={{ width: '100%', borderRadius: 0 }} />
                </Box>
              </Grid>
            </Grid>
          </Stack>
        </Container>
      </Box>

      <Footer />
    </Box>
  )
}
