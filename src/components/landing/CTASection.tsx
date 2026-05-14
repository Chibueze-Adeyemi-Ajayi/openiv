import { Box, Button, Container, Grid, Stack, Typography } from '@mui/material'
import { colorPalette } from '@/theme'
import { keyframes } from '@mui/system'
import { useIntersectionAnimation } from '@/hooks/useIntersectionAnimation'

const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: translateY(0); }
`

export default function CTASection() {
  const { ref, isVisible } = useIntersectionAnimation()

  return (
    <Box 
      ref={ref} 
      sx={{ 
        bgcolor: '#d9f99d', 
        py: { xs: 10, md: 14 }, 
        textAlign: 'center'
      }}
    >
      <Container maxWidth="md">
        <Stack sx={{ gap: 4, alignItems: 'center', animation: isVisible ? `${fadeInUp} 0.8s ease-out both` : 'none' }}>
          <Typography
            sx={{
              fontSize: { xs: '2.5rem', md: '4rem' },
              fontWeight: 900,
              color: '#00288e',
              lineHeight: 1,
              letterSpacing: '-0.04em',
              fontFamily: 'Jost',
            }}
          >
            Find the right plan for your team.
          </Typography>
          <Typography
            sx={{
              fontSize: '1.25rem',
              color: 'rgba(15, 23, 42, 0.7)',
              maxWidth: '600px',
              fontWeight: 500,
            }}
          >
            Secure your institution with Africa's most advanced orchestration engine.
          </Typography>
          <Button
            sx={{
              bgcolor: '#00288e',
              color: '#ffffff',
              px: 6,
              py: 2,
              borderRadius: 0,
              fontWeight: 800,
              fontSize: '1.125rem',
              '&:hover': { bgcolor: '#1e293b' }
            }}
          >
            Get Started Now
          </Button>
        </Stack>
      </Container>
    </Box>
  )
}
