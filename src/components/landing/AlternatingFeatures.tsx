import { Box, Container, Grid, Stack, Typography, Link } from '@mui/material'
import { colorPalette } from '@/theme/palette'
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

interface FeatureProps {
  title: string
  description: string
  image: string
  reversed?: boolean
}

const FeatureSection = ({ title, description, image, reversed }: FeatureProps) => {
  const { ref, isVisible } = useIntersectionAnimation()

  return (
    <Box ref={ref} sx={{ bgcolor: '#00288e', py: { xs: 8, md: 12 }, color: '#ffffff' }}>
      <Container maxWidth="lg">
        <Grid container spacing={8} sx={{ alignItems: 'center', flexDirection: reversed ? 'row-reverse' : 'row' }}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Box sx={{ animation: isVisible ? `${bounceIn} 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) both` : 'none' }}>
              <img
                src={`/assets/landing/${image}`}
                alt={title}
                style={{
                  width: '100%',
                  borderRadius: 0,
                  border: '1px solid rgba(255,255,255,0.1)',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
                }}
              />
            </Box>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Stack sx={{ gap: 3 }}>
              <Typography
                sx={{
                  fontSize: { xs: '2rem', md: '3rem' },
                  fontWeight: 600,
                  lineHeight: 1.1,
                  fontFamily: 'Jost',
                  animation: isVisible ? `${slideInLine} 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) both` : 'none',
                }}
              >
                {title}
              </Typography>
              <Typography
                sx={{
                  fontSize: '1.125rem',
                  color: '#94a3b8',
                  lineHeight: 1.6,
                  animation: isVisible ? `${slideInLine} 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s both` : 'none',
                }}
              >
                {description}
              </Typography>
              <Link 
                href="#" 
                sx={{ 
                    color: '#d9f99d', 
                    fontWeight: 700, 
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    animation: isVisible ? `${slideInLine} 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) 0.4s both` : 'none',
                    '&:hover': { color: '#bef264' }
                }}
              >
                View Documentation →
              </Link>
            </Stack>
          </Grid>
        </Grid>
      </Container>
    </Box>
  )
}

export default function AlternatingFeatures() {
  return (
    <Box sx={{ bgcolor: '#00288e' }}>
      <FeatureSection
        title="Comprehensive Surveillance Coverage"
        description="Build reliable fraud orchestration pipelines with structured risk signals from across your network. Our surveillance engine processes thousands of rules in sub-14ms, ensuring total institutional integrity."
        image="fraud_prevention.png"
      />
      <FeatureSection
        title="Zero-Friction Integration"
        description="Integrate our developer-first API key to start building your defense today. Engineered for RAG pipelines and advanced compliance tools, OpenIV connects to your stack in minutes."
        image="speed.png"
        reversed
      />
      <FeatureSection
        title="Autonomous Governance & Control"
        description="Scale your institution with confidence using automated SAR/STR filings and granular risk policy management. Built to align with CBN, NFIU, and NDPR standards automatically."
        image="compliance.png"
      />
    </Box>
  )
}
