import { Box, Container, Typography } from '@mui/material'
import { colorPalette } from '@/theme'
import BoltOutlinedIcon from '@mui/icons-material/BoltOutlined'
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined'
import FingerprintOutlinedIcon from '@mui/icons-material/FingerprintOutlined'

interface AuthLayoutProps {
  children: React.ReactNode
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        minHeight: '100vh',
        bgcolor: '#ffffff',
        '@keyframes fadeInUp': {
          from: { opacity: 0, transform: 'translateY(12px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
      }}
    >
      {/* Left Panel - Brand */}
      <Box
        sx={{
          width: { xs: 0, md: '40%', lg: '38%' },
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          justifyContent: 'space-between',
          p: { md: 5, lg: 6 },
          bgcolor: colorPalette.primary,
          color: '#ffffff',
          position: 'relative',
          flexShrink: 0,
        }}
      >
        <Box sx={{ animation: 'fadeInUp 0.6s ease' }}>
          <Box sx={{ mb: { md: 7, lg: 9 } }}>
            <Typography
              sx={{
                fontSize: '1.125rem',
                fontWeight: 700,
                fontFamily: 'Jost',
                letterSpacing: '0.12em',
                mb: 1,
                color: '#ffffff',
              }}
            >
              OPENIV
            </Typography>
            <Box sx={{ width: 28, height: '2px', bgcolor: '#ffffff', borderRadius: '2px', opacity: 0.9 }} />
          </Box>

          <Typography
            sx={{
              fontSize: '0.6875rem',
              fontWeight: 700,
              letterSpacing: '0.18em',
              color: 'rgba(255,255,255,0.6)',
              mb: 2,
            }}
          >
            FRAUD INTELLIGENCE PLATFORM
          </Typography>

          <Typography
            sx={{
              fontSize: { md: '2rem', lg: '2.375rem' },
              fontWeight: 700,
              fontFamily: 'Jost',
              lineHeight: 1.15,
              mb: 2.5,
              letterSpacing: '-0.015em',
              color: '#ffffff',
            }}
          >
            Defend every transaction, before it settles.
          </Typography>

          <Typography
            sx={{
              fontSize: '0.9375rem',
              lineHeight: 1.65,
              color: 'rgba(255,255,255,0.72)',
              maxWidth: '94%',
              fontWeight: 400,
            }}
          >
            Real-time fraud monitoring, AML surveillance, and CBN-aligned reporting — engineered for Nigeria's banks, fintechs, and microfinance institutions.
          </Typography>
        </Box>

        {/* Operational Indicators */}
        <Box sx={{ animation: 'fadeInUp 0.8s ease' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1.75 }}>
            <BoltOutlinedIcon sx={{ fontSize: '1rem', color: '#ffffff', opacity: 0.95 }} />
            <Typography
              sx={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                letterSpacing: '0.18em',
                color: '#ffffff',
                opacity: 0.95,
              }}
            >
              SUB-14MS TRANSACTION ANALYSIS
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1.75 }}>
            <FingerprintOutlinedIcon sx={{ fontSize: '1rem', color: '#ffffff', opacity: 0.95 }} />
            <Typography
              sx={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                letterSpacing: '0.18em',
                color: '#ffffff',
                opacity: 0.95,
              }}
            >
              BEHAVIORAL FINGERPRINTING
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <GavelOutlinedIcon sx={{ fontSize: '1rem', color: '#ffffff', opacity: 0.95 }} />
            <Typography
              sx={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                letterSpacing: '0.18em',
                color: '#ffffff',
                opacity: 0.95,
              }}
            >
              CBN · NFIU · NDPR ALIGNED
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Right Panel - Form */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: { xs: 3, sm: 5, md: 6, lg: 8 },
          bgcolor: '#ffffff',
        }}
      >
        <Container
          maxWidth="sm"
          sx={{
            width: '100%',
            maxWidth: '560px !important',
            animation: 'fadeInUp 0.5s ease',
          }}
        >
          {children}
        </Container>
      </Box>
    </Box>
  )
}
