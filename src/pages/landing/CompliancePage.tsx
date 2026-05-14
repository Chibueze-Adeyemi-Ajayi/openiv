import { Box, Container, Stack, Typography, Grid } from '@mui/material'
import Navbar from '@/components/landing/Navbar'
import Footer from '@/components/landing/Footer'
import { keyframes } from '@mui/system'
import { useIntersectionAnimation } from '@/hooks/useIntersectionAnimation'

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

export default function CompliancePage() {
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
              CBN & NFIU Compliance. Automated.
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
              Eliminate the manual burden of regulatory reporting. OpenIV automates SAR, STR, and Risk-Based Supervision filings directly aligned with Nigerian regulatory standards.
            </Typography>
          </Stack>
        </Container>
      </Box>

      {/* Solutions Grid */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: 'rgba(255,255,255,0.02)' }}>
        <Container maxWidth="lg">
          <Stack sx={{ gap: 12 }}>
            {/* Block 1 */}
            <Grid container spacing={12} sx={{ alignItems: 'center' }}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Stack sx={{ gap: 4 }}>
                  <Typography sx={{ color: '#d9f99d', fontWeight: 700, letterSpacing: '0.1em', fontSize: '0.875rem' }}>
                    NFIU REPORTING
                  </Typography>
                  <Typography sx={{ fontSize: '2.5rem', fontWeight: 600, fontFamily: 'Jost', lineHeight: 1.1 }}>
                    Automated SAR & STR Filing Engine
                  </Typography>
                  <Typography sx={{ fontSize: '1.125rem', color: '#94a3b8', lineHeight: 1.8 }}>
                    Eliminate the risk of missing NFIU filing windows. Our engine continuously scans transaction streams against goAML-aligned thresholds, automatically flagging Suspicious Activity (SAR) and Suspicious Transactions (STR) for immediate review.
                  </Typography>
                  <Box sx={{ p: 4, borderLeft: '4px solid #d9f99d', bgcolor: 'rgba(255,255,255,0.02)' }}>
                    <Typography sx={{ fontWeight: 700, color: '#ffffff', mb: 1 }}>Solution Outcome:</Typography>
                    <Typography sx={{ color: '#94a3b8' }}>Achieve 100% filing accuracy with a system designed to handle the complexity of Nigeria's rapid transaction growth.</Typography>
                  </Box>
                </Stack>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Box sx={{ p: 2, border: '1px solid rgba(255,255,255,0.1)', bgcolor: 'rgba(255,255,255,0.03)' }}>
                  <img src="/assets/landing/compliance_report.png" alt="NFIU Reporting" style={{ width: '100%', borderRadius: 0 }} />
                </Box>
              </Grid>
            </Grid>

            {/* Block 2 */}
            <Grid container spacing={12} sx={{ alignItems: 'center', flexDirection: 'row-reverse' }}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Stack sx={{ gap: 4 }}>
                  <Typography sx={{ color: '#d9f99d', fontWeight: 700, letterSpacing: '0.1em', fontSize: '0.875rem' }}>
                    CBN SUPERVISION
                  </Typography>
                  <Typography sx={{ fontSize: '2.5rem', fontWeight: 600, fontFamily: 'Jost', lineHeight: 1.1 }}>
                    Risk-Based Supervision (RBS) Framework
                  </Typography>
                  <Typography sx={{ fontSize: '1.125rem', color: '#94a3b8', lineHeight: 1.8 }}>
                    Align your internal controls with the CBN’s Risk-Based Supervision requirements. OpenIV provides real-time heatmaps of institutional risk exposure, broken down by customer segment, geography, and product type.
                  </Typography>
                  <Box sx={{ p: 4, borderLeft: '4px solid #d9f99d', bgcolor: 'rgba(255,255,255,0.02)' }}>
                    <Typography sx={{ fontWeight: 700, color: '#ffffff', mb: 1 }}>Solution Outcome:</Typography>
                    <Typography sx={{ color: '#94a3b8' }}>Present an audit-ready risk profile to CBN examiners at any moment, with full drill-down capabilities into every flagged transaction.</Typography>
                  </Box>
                </Stack>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Box sx={{ p: 2, border: '1px solid rgba(255,255,255,0.1)', bgcolor: 'rgba(255,255,255,0.03)' }}>
                  <img src="/assets/landing/security.png" alt="CBN RBS" style={{ width: '100%', borderRadius: 0 }} />
                </Box>
              </Grid>
            </Grid>
          </Stack>
        </Container>
      </Box>

      {/* Regulatory Matrix */}
      <Box sx={{ py: { xs: 8, md: 12 }, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <Container maxWidth="lg">
          <Typography sx={{ fontSize: '2rem', fontWeight: 600, mb: 6, textAlign: 'center', fontFamily: 'Jost' }}>
            Regulatory Alignment Matrix
          </Typography>
          <Grid container spacing={3}>
            {[
              { reg: 'CBN AML/CFT Regulations 2022', solution: 'Real-time transaction monitoring & risk-based thresholds' },
              { reg: 'NFIU goAML Standards', solution: 'Direct XML export of SAR/STR reports for seamless filing' },
              { reg: 'NDPR (Data Protection)', solution: 'On-soil data residency and encrypted multi-tenant isolation' },
              { reg: 'BOFIA 2020', solution: 'Comprehensive governance stack for institutional integrity' }
            ].map((item, idx) => (
              <Grid size={{ xs: 12, md: 6 }} key={idx}>
                <Box sx={{ p: 4, border: '1px solid rgba(255,255,255,0.05)', bgcolor: 'rgba(255,255,255,0.02)' }}>
                  <Typography sx={{ fontWeight: 700, color: '#d9f99d', mb: 1 }}>{item.reg}</Typography>
                  <Typography sx={{ color: '#94a3b8' }}>{item.solution}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      <Footer />
    </Box>
  )
}
