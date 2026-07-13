import { Box, Container, Stack, Typography, Grid } from '@mui/material'
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

export default function LandingNetworkPage() {
  useSEO({
    title: 'Intelligence Network – Cross-Border Fraud & AML Intelligence',
    description: "Tap into OpenIV's shared intelligence network. Correlate fraud signals across institutions, flag shared bad actors, and stay ahead of cross-border financial crime.",
    canonical: '/network',
    ogImage: 'https://openiv.ng/assets/landing/high_speed_data_abstract.png',
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
              Collaborative Intelligence. Global Network.
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
              Protect your institution with shared intelligence. OpenIV connects leading financial institutions into a unified defense network to identify cross-institutional fraud patterns instantly.
            </Typography>
          </Stack>
        </Container>
      </Box>

      {/* Solution Blocks */}
      <Box sx={{ py: { xs: 8, md: 12 } }}>
        <Container maxWidth="lg">
          <Grid container spacing={12}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Stack sx={{ gap: 4 }}>
                <Typography sx={{ fontSize: '2.5rem', fontWeight: 600, fontFamily: 'Jost' }}>
                  Cross-Institutional Risk Mapping
                </Typography>
                <Typography sx={{ fontSize: '1.125rem', color: '#94a3b8', lineHeight: 1.8 }}>
                  Fraudsters don't stop at one bank. Our network analysis engine identifies multi-institution shell company structures and money laundering rings by mapping relationships across the entire OpenIV ecosystem.
                </Typography>
                <Box sx={{ p: 4, borderLeft: '4px solid #d9f99d', bgcolor: 'rgba(255,255,255,0.02)' }}>
                  <Typography sx={{ fontWeight: 700, color: '#ffffff', mb: 1 }}>Solution Outcome:</Typography>
                  <Typography sx={{ color: '#94a3b8' }}>Dismantle complex fraud syndicates before they can exploit your institution.</Typography>
                </Box>
              </Stack>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
               <Box sx={{ p: 2, border: '1px solid rgba(255,255,255,0.1)', bgcolor: 'rgba(255,255,255,0.03)' }}>
                  <img src="/assets/landing/fraud_loss_diagram.png" alt="Network Analysis" style={{ width: '100%', borderRadius: 0 }} />
               </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      <Footer />
    </Box>
  )
}
