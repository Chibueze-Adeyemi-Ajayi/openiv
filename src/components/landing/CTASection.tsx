import { Box, Button, Container, Stack, Typography } from '@mui/material'
import { colorPalette } from '@/theme'

export default function CTASection() {
  return (
    <Box
      sx={{
        background: `linear-gradient(135deg, ${colorPalette.primary} 0%, ${colorPalette.primary_container} 100%)`,
        py: { xs: 6, md: 12 },
        textAlign: 'center',
      }}
    >
      <Container maxWidth="md">
        <Stack sx={{ gap: 3, alignItems: 'center' }}>
          <Typography
            variant="h2"
            sx={{
              color: '#ffffff',
              maxWidth: '92%',
              fontWeight: 700,
              fontSize: { xs: '2rem', md: '2.625rem' },
              letterSpacing: '-0.02em',
              lineHeight: 1.15,
            }}
          >
            Bring fraud losses to zero. Stay ahead of every audit.
          </Typography>

          <Typography
            variant="body1"
            sx={{
              color: 'rgba(255,255,255,0.85)',
              maxWidth: '85%',
              fontSize: '1.0625rem',
              lineHeight: 1.6,
            }}
          >
            See how OpenIV stops account takeovers, SIM-swap fraud, and mule activity — and turns NFIU and CBN reporting into a one-click workflow.
          </Typography>

          {/* CTA Buttons */}
          <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 2, mt: 2 }}>
            <Button
              variant="contained"
              size="large"
              sx={{
                bgcolor: '#ffffff',
                color: colorPalette.primary,
                fontWeight: 600,
                textTransform: 'none',
                fontSize: '1rem',
                px: 4,
                '&:hover': {
                  bgcolor: 'rgba(255,255,255,0.95)',
                },
                borderRadius: '0.375rem',
              }}
            >
              Book a 30-min demo
            </Button>
            <Button
              variant="outlined"
              size="large"
              sx={{
                borderColor: '#ffffff',
                color: '#ffffff',
                fontWeight: 500,
                textTransform: 'none',
                fontSize: '1rem',
                px: 4,
                '&:hover': {
                  bgcolor: 'rgba(255,255,255,0.1)',
                  borderColor: '#ffffff',
                },
                borderRadius: '0.375rem',
              }}
            >
              Talk to sales
            </Button>
          </Stack>
        </Stack>
      </Container>
    </Box>
  )
}
