import { Box, Container, Stack, Typography } from '@mui/material'
import { colorPalette } from '@/theme'
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

export default function ProblemSection() {
  const { ref, isVisible } = useIntersectionAnimation()

  return (
    <Box ref={ref} sx={{ bgcolor: '#ffffff', py: { xs: 10, md: 16 }, borderBottom: '1px solid #e5e7eb', overflow: 'hidden' }}>
      <Container maxWidth="lg">
        <Stack sx={{ gap: 10, alignItems: 'center', textAlign: 'center' }}>
          {/* Main Problem Header */}
          <Stack sx={{ maxWidth: '900px', gap: 3 }}>
            <Typography
              sx={{
                fontSize: { xs: '2.5rem', md: '4.5rem' },
                fontWeight: 900,
                color: '#00288e',
                lineHeight: 1,
                letterSpacing: '-0.04em',
                fontFamily: 'Jost',
                animation: isVisible ? `${fadeInUp} 0.8s ease-out both` : 'none',
              }}
            >
              Every second unmonitored is a million lost to fraud.
            </Typography>
            <Typography
              sx={{
                fontSize: '1.25rem',
                color: '#64748b',
                lineHeight: 1.6,
                maxWidth: '700px',
                mx: 'auto',
                fontWeight: 500,
                animation: isVisible ? `${fadeInUp} 0.8s ease-out 0.1s both` : 'none',
              }}
            >
              Legacy batch processing leaves windows of opportunity for financial criminals. By the time you detect the leak, the capital is gone.
            </Typography>
          </Stack>

          {/* Diagram Section */}
          <Box
            sx={{
              width: '100%',
              maxWidth: '1000px',
              bgcolor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '24px',
              p: { xs: 2, md: 6 },
              animation: isVisible ? `${fadeInUp} 0.8s ease-out 0.2s both` : 'none',
              position: 'relative',
              overflow: 'hidden',
              '&::after': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,1) 100%)',
                pointerEvents: 'none',
              }
            }}
          >
            <img
              src="/assets/landing/fraud_leakage.png"
              alt="Diagram showing financial leakage through unmonitored network points"
              style={{
                width: '100%',
                height: 'auto',
                display: 'block',
              }}
            />
            
            {/* Overlay Text */}
            <Stack 
                sx={{ 
                    position: 'absolute', 
                    bottom: 40, 
                    left: '50%', 
                    transform: 'translateX(-50%)', 
                    zIndex: 2,
                    alignItems: 'center',
                    gap: 1
                }}
            >
                <Typography sx={{ fontSize: '0.875rem', fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    Critical Vulnerability Detected
                </Typography>
                <Typography sx={{ fontSize: '1.125rem', fontWeight: 600, color: '#00288e' }}>
                    Legacy infrastructure cannot block real-time orchestration.
                </Typography>
            </Stack>
          </Box>
        </Stack>
      </Container>
    </Box>
  )
}
