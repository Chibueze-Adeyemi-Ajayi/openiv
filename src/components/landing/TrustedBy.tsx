import { Box, Container, Stack, Typography } from '@mui/material'
import { colorPalette } from '@/theme'

const clients = [
  { first: 'TIER-1', second: 'BANK' },
  { first: 'PAY', second: 'STACK' },
  { first: 'RELIANCE', second: 'MFB' },
  { first: 'KUDA', second: 'CORE' },
  { first: 'SAFE', second: 'TRUST' },
]

export default function TrustedBy() {
  return (
    <Box sx={{ bgcolor: '#F4F2FC', py: { xs: 6, md: 8 } }}>
      <Container maxWidth="lg">
        <Stack sx={{ alignItems: 'center', gap: 4 }}>
          <Typography
            sx={{
              fontSize: '0.6875rem',
              fontWeight: 700,
              letterSpacing: '0.18em',
              color: "#0f172a",
            }}
          >
            TRUSTED BY NIGERIA'S LEADING BANKS, FINTECHS &amp; MFBS
          </Typography>

          <Stack
            direction="row"
            sx={{
              gap: { xs: 3, md: 6 },
              flexWrap: 'wrap',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            {clients.map((client) => (
              <Box key={client.first + client.second} sx={{ display: 'flex' }}>
                <Typography
                  sx={{
                    color: '#9CA3AF',
                    fontWeight: 600,
                    letterSpacing: '0.05em',
                    fontSize: '1rem',
                    fontFamily: 'Jost',
                  }}
                >
                  {client.first}
                </Typography>
                <Typography
                  sx={{
                    color: colorPalette.primary,
                    fontWeight: 600,
                    letterSpacing: '0.05em',
                    fontSize: '1rem',
                    fontFamily: 'Jost',
                  }}
                >
                  {client.second}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Stack>
      </Container>
    </Box>
  )
}
