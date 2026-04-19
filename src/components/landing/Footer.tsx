import { Box, Container, Link, Stack, Typography } from '@mui/material'
import { colorPalette } from '@/theme'

const footerLinks = [
  { label: 'Security', href: '#' },
  { label: 'Compliance', href: '#' },
  { label: 'Privacy', href: '#' },
  { label: 'Contact', href: '#' },
]

export default function Footer() {
  return (
    <Box
      sx={{
        bgcolor: colorPalette.surface_container,
        py: 6,
      }}
    >
      <Container maxWidth="lg">
        <Stack sx={{ gap: 3 }}>
          {/* Top Row - Logo & Links */}
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', md: 'center' }}
            sx={{ gap: 3, pb: 3 }}
          >
            <Typography
              variant="h5"
              sx={{
                fontWeight: 600,
                color: colorPalette.on_surface,
                fontSize: '1.25rem',
              }}
            >
              OpenIV
            </Typography>

            <Stack direction="row" sx={{ gap: 4 }}>
              {footerLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  sx={{
                    color: colorPalette.on_surface_variant,
                    textDecoration: 'none',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    transition: 'color 0.2s',
                    '&:hover': {
                      color: colorPalette.primary,
                    },
                  }}
                >
                  {link.label}
                </Link>
              ))}
            </Stack>
          </Stack>

          {/* Bottom Row - Copyright */}
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', md: 'center' }}
            sx={{ pt: 3, gap: 1.5 }}
          >
            <Typography
              variant="body2"
              sx={{
                color: colorPalette.on_surface_variant,
                fontSize: '0.75rem',
                opacity: 0.7,
              }}
            >
              © {new Date().getFullYear()} OpenIV Technologies. Fraud intelligence built for African finance.
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: colorPalette.on_surface_variant,
                fontSize: '0.6875rem',
                fontWeight: 600,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                opacity: 0.6,
              }}
            >
              CBN · NFIU · NDPR · ISO 27001
            </Typography>
          </Stack>
        </Stack>
      </Container>
    </Box>
  )
}
