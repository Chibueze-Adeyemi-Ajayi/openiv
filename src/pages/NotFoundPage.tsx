import { Box, Typography, Button, Stack, CircularProgress } from '@mui/material'
import { useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { hydrate, getSessionState } from '@/onboarding/state'
import { colorPalette } from '@/theme'
import ManageSearchRoundedIcon from '@mui/icons-material/ManageSearchRounded'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'

function NotFoundCard() {
  const navigate  = useNavigate()
  const location  = useLocation()

  const [hydrated, setHydrated] = useState(false)
  const [loggedIn, setLoggedIn] = useState(false)

  useEffect(() => {
    hydrate().then(() => {
      setLoggedIn(getSessionState() === 'authenticated')
      setHydrated(true)
    })
  }, [])

  const homeLabel = loggedIn ? 'Go to Dashboard' : 'Go to Home'
  const homePath  = loggedIn ? '/dashboard' : '/'

  const goBack = () => {
    if (window.history.length > 1) navigate(-1)
    else navigate(homePath)
  }

  return (
    <Box
      sx={{
        bgcolor: '#ffffff',
        border: '1px solid #eef0f4',
        p: { xs: 4, sm: 5 },
        maxWidth: 440,
        width: '100%',
        textAlign: 'center',
      }}
    >
      {/* Icon */}
      <Box
        sx={{
          width: 72, height: 72, borderRadius: '50%',
          bgcolor: 'rgba(217, 249, 157, 0.35)',
          border: '1px solid rgba(217, 249, 157, 0.8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          mx: 'auto', mb: 3,
        }}
      >
        <ManageSearchRoundedIcon sx={{ fontSize: '2rem', color: colorPalette.primary }} />
      </Box>

      {/* 404 number */}
      <Typography
        sx={{
          fontSize: '4.5rem',
          fontWeight: 800,
          fontFamily: 'Jost',
          color: colorPalette.primary,
          lineHeight: 1,
          letterSpacing: '-0.04em',
          mb: 0.5,
          position: 'relative',
          display: 'inline-block',
          '&::after': {
            content: '"404"',
            position: 'absolute',
            top: 4,
            left: 4,
            fontSize: 'inherit',
            fontWeight: 'inherit',
            fontFamily: 'inherit',
            color: '#d9f99d',
            zIndex: -1,
          },
        }}
      >
        404
      </Typography>

      <Typography
        sx={{ fontSize: '1.125rem', fontWeight: 700, color: colorPalette.primary, fontFamily: 'Jost', mb: 1, mt: 1.5 }}
      >
        Page Not Found
      </Typography>

      <Typography
        sx={{ fontSize: '0.875rem', color: '#475569', lineHeight: 1.65, mb: 3.5 }}
      >
        The page you're looking for doesn't exist or may have been moved.
        Double-check the URL, or use one of the options below.
      </Typography>

      {/* URL hint */}
      <Box
        sx={{
          bgcolor: '#f8fafc', border: '1px solid #e2e8f0',
          px: 2, py: 1.25, mb: 3.5,
        }}
      >
        <Typography
          sx={{ fontSize: '0.75rem', color: '#64748b', fontFamily: 'monospace', wordBreak: 'break-all' }}
        >
          {location.pathname}
        </Typography>
      </Box>

      {!hydrated ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 1.5 }}>
          <CircularProgress size={22} sx={{ color: colorPalette.primary }} />
        </Box>
      ) : (
        <Stack spacing={1.5}>
          <Button
            fullWidth
            endIcon={<ArrowForwardRoundedIcon sx={{ fontSize: '0.875rem !important' }} />}
            onClick={() => navigate(homePath)}
            sx={{
              bgcolor: colorPalette.primary, color: '#fff', borderRadius: 0,
              textTransform: 'none', fontFamily: 'Jost', fontWeight: 600,
              fontSize: '0.875rem', py: 1.25, boxShadow: 'none',
              '&:hover': { bgcolor: '#001f6e', boxShadow: 'none' },
            }}
          >
            {homeLabel}
          </Button>
          <Button
            fullWidth
            startIcon={<ArrowBackRoundedIcon sx={{ fontSize: '0.875rem !important' }} />}
            onClick={goBack}
            sx={{
              bgcolor: 'transparent', color: '#475569', borderRadius: 0,
              border: '1px solid #e2e8f0',
              textTransform: 'none', fontFamily: 'Jost', fontWeight: 500,
              fontSize: '0.875rem', py: 1.125, boxShadow: 'none',
              '&:hover': { bgcolor: '#f8fafc', boxShadow: 'none' },
            }}
          >
            Go Back
          </Button>
        </Stack>
      )}
    </Box>
  )
}

/** Standalone full-page 404 — used for top-level and auth-scope unknown routes */
export default function NotFoundPage() {
  return (
    <Box
      sx={{
        minHeight: '100vh', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        bgcolor: '#f8fafc', p: 3,
      }}
    >
      <NotFoundCard />
    </Box>
  )
}

/** Dashboard-scoped 404 — rendered inside DashboardLayout's content area */
export function DashboardNotFoundPage() {
  return (
    <Box
      sx={{
        flex: 1, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        minHeight: 'calc(100vh - 64px)', p: 3,
        bgcolor: 'var(--app-bg)',
      }}
    >
      <NotFoundCard />
    </Box>
  )
}
