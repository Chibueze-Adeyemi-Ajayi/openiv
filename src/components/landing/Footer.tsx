import { Box, Container, Typography, Stack, Grid } from '@mui/material'
import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <Box sx={{ bgcolor: '#0a0f1e', py: 6, borderTop: '1px solid #1e293b' }}>
      <Container maxWidth="lg">
        <Grid container spacing={4} sx={{ alignItems: 'flex-start' }}>

          {/* Brand */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Box component={Link} to="/landing" sx={{ textDecoration: 'none', display: 'inline-block', mb: 2 }}>
              <Box sx={{ position: 'relative' }}>
                <Box sx={{ position: 'absolute', top: -4, left: 0, width: 22, height: '2px', bgcolor: '#ffffff', borderRadius: '1px' }} />
                <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff', fontFamily: 'Jost', letterSpacing: '0.1em' }}>
                  OPENIV
                </Typography>
              </Box>
            </Box>
            <Typography sx={{ fontSize: '0.875rem', color: '#475569', lineHeight: 1.7, maxWidth: 280 }}>
              Strategic AML/CFT intelligence and fraud detection for Nigerian financial institutions.
            </Typography>
          </Grid>

          {/* Product */}
          <Grid size={{ xs: 6, md: 2 }}>
            <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 2 }}>
              Product
            </Typography>
            {([['Dashboard', '/dashboard'], ['Developers', '/developers'], ['Request Access', '/request-access']] as const).map(([label, to]) => (
              <Box key={label} component={Link} to={to} sx={{ display: 'block', mb: 1.25, textDecoration: 'none', fontSize: '0.875rem', color: '#64748b', '&:hover': { color: '#ffffff' } }}>
                {label}
              </Box>
            ))}
          </Grid>

          {/* Legal */}
          <Grid size={{ xs: 6, md: 2 }}>
            <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 2 }}>
              Legal
            </Typography>
            {([['Privacy Policy', '/privacy'], ['Terms of Use', '/terms'], ['Security', '/security']] as const).map(([label, to]) => (
              <Box key={label} component={Link} to={to} sx={{ display: 'block', mb: 1.25, textDecoration: 'none', fontSize: '0.875rem', color: '#64748b', '&:hover': { color: '#ffffff' } }}>
                {label}
              </Box>
            ))}
          </Grid>

          {/* Contact + Compliance */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 2 }}>
              Contact
            </Typography>
            <Stack sx={{ gap: 1, mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5 }}>
                <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>Support</Typography>
                <Box component="a" href="mailto:support@openiv.ng" sx={{ textDecoration: 'none', fontSize: '0.875rem', color: '#64748b', '&:hover': { color: '#ffffff' } }}>
                  support@openiv.ng
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5 }}>
                <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>Compliance</Typography>
                <Box component="a" href="mailto:compliance@openiv.ng" sx={{ textDecoration: 'none', fontSize: '0.875rem', color: '#64748b', '&:hover': { color: '#ffffff' } }}>
                  compliance@openiv.ng
                </Box>
              </Box>
            </Stack>
            <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 1.5 }}>
              Compliance
            </Typography>
            <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
              {['CBN', 'NFIU', 'NDPR', 'FATF'].map(badge => (
                <Box key={badge} sx={{ px: 1.25, py: 0.375, border: '1px solid #1e293b', color: '#475569', fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.06em' }}>
                  {badge}
                </Box>
              ))}
            </Stack>
          </Grid>

        </Grid>

        <Box sx={{ mt: 6, pt: 4, borderTop: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Typography sx={{ fontSize: '0.8125rem', color: '#334155' }}>© 2026 OpenIV Technologies. All rights reserved.</Typography>
          <Typography sx={{ fontSize: '0.8125rem', color: '#334155' }}>Built for Nigeria's financial future.</Typography>
        </Box>
      </Container>
    </Box>
  )
}
