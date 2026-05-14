import { Box, Container, Grid, Typography, Stack } from '@mui/material'
import { keyframes } from '@mui/system'
import { useIntersectionAnimation } from '@/hooks/useIntersectionAnimation'

const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`

const stats = [
  { label: 'Detection Latency', value: '<14ms', description: 'Industry-leading orchestration speed' },
  { label: 'False Positive Reduction', value: '62%', description: 'Powered by behavioral intelligence' },
  { label: 'Filing Efficiency', value: '85%', description: 'Reduction in manual SAR/STR overhead' },
  { label: 'Fraud Prevention Rate', value: '94%', description: 'Eliminating leakage at the source' }
]

export default function InstitutionalMetrics() {
  const { ref, isVisible } = useIntersectionAnimation()

  return (
    <Box ref={ref} sx={{ bgcolor: 'rgba(217, 249, 157, 0.05)', py: 6, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <Container maxWidth="lg">
        <Grid container spacing={4}>
          {stats.map((stat, idx) => (
            <Grid size={{ xs: 12, sm: 6, md: 3 }} key={idx}>
              <Stack 
                sx={{ 
                    alignItems: 'center', 
                    textAlign: 'center',
                    animation: isVisible ? `${fadeInUp} 0.6s ease-out ${idx * 0.1}s both` : 'none'
                }}
              >
                <Typography sx={{ color: '#d9f99d', fontSize: '2.5rem', fontWeight: 800, fontFamily: 'Jost', lineHeight: 1 }}>
                  {stat.value}
                </Typography>
                <Typography sx={{ color: '#ffffff', fontWeight: 700, mt: 1, fontSize: '0.875rem', letterSpacing: '0.05em' }}>
                  {stat.label.toUpperCase()}
                </Typography>
                <Typography sx={{ color: '#94a3b8', fontSize: '0.75rem', mt: 0.5 }}>
                  {stat.description}
                </Typography>
              </Stack>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  )
}
