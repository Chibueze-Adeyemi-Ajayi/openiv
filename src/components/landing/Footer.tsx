import { Box, Container, Link, Stack, Typography } from '@mui/material'
import { colorPalette } from '@/theme'

export default function Footer() {
  return (
    <Box sx={{ bgcolor: '#f8fafc', borderTop: '1px solid #e5e7eb', py: 6 }}>
      <Container maxWidth="lg">
        <Stack sx={{ gap: 4 }}>
          {/* Top Section */}
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" sx={{ gap: 4 }}>
            <Stack sx={{ gap: 2, maxWidth: '300px' }}>
              <Typography sx={{ fontWeight: 700, fontSize: '1.25rem', color: colorPalette.on_surface, fontFamily: 'Jost' }}>
                OpenIV
              </Typography>
              <Typography sx={{ fontSize: '0.875rem', color: '#64748b', lineHeight: 1.6 }}>
                Real-time fraud detection and AML compliance for financial institutions across Africa.
              </Typography>
            </Stack>

            <Stack sx={{ gap: 3, display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr 1fr' }, gap: 4 }}>
              <Stack sx={{ gap: 1.5 }}>
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Product
                </Typography>
                {['Features', 'Pricing', 'Security'].map((link) => (
                  <Link
                    key={link}
                    href="#"
                    sx={{
                      fontSize: '0.875rem',
                      color: colorPalette.on_surface,
                      textDecoration: 'none',
                      transition: 'color 0.2s',
                      '&:hover': { color: colorPalette.primary },
                    }}
                  >
                    {link}
                  </Link>
                ))}
              </Stack>
              <Stack sx={{ gap: 1.5 }}>
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Company
                </Typography>
                {['About', 'Blog', 'Contact'].map((link) => (
                  <Link
                    key={link}
                    href="#"
                    sx={{
                      fontSize: '0.875rem',
                      color: colorPalette.on_surface,
                      textDecoration: 'none',
                      transition: 'color 0.2s',
                      '&:hover': { color: colorPalette.primary },
                    }}
                  >
                    {link}
                  </Link>
                ))}
              </Stack>
            </Stack>
          </Stack>

          {/* Bottom Section */}
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} sx={{ pt: 4, borderTop: '1px solid #e5e7eb', gap: 2 }}>
            <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              © {new Date().getFullYear()} OpenIV. All rights reserved.
            </Typography>
            <Stack direction="row" spacing={3}>
              {['Privacy', 'Terms', 'Security'].map((link) => (
                <Link
                  key={link}
                  href="#"
                  sx={{
                    fontSize: '0.75rem',
                    color: '#94a3b8',
                    textDecoration: 'none',
                    transition: 'color 0.2s',
                    '&:hover': { color: colorPalette.on_surface },
                  }}
                >
                  {link}
                </Link>
              ))}
            </Stack>
          </Stack>
        </Stack>
      </Container>
    </Box>
  )
}
