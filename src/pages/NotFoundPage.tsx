import { Box, Typography, Button } from '@mui/material'
import { Link } from 'react-router-dom'
import { colorPalette } from '@/theme'

export default function NotFoundPage() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 2, textAlign: 'center', px: 3 }}>
      <Typography sx={{ fontSize: '4.5rem', fontWeight: 800, color: colorPalette.primary, fontFamily: 'Jost', lineHeight: 1 }}>
        404
      </Typography>
      <Typography sx={{ fontSize: '1.125rem', fontWeight: 700, fontFamily: 'Jost', color: 'var(--heading-color)' }}>
        Page not found
      </Typography>
      <Typography sx={{ fontSize: '0.9375rem', color: '#64748b', maxWidth: 380 }}>
        The page you're looking for doesn't exist or has moved.
      </Typography>
      <Button component={Link} to="/" variant="contained"
        sx={{ mt: 1, bgcolor: colorPalette.primary, color: '#fff', textTransform: 'none', fontWeight: 700, fontFamily: 'Jost', borderRadius: 0, boxShadow: 'none', '&:hover': { bgcolor: colorPalette.primary, filter: 'brightness(0.9)', boxShadow: 'none' } }}>
        Go home
      </Button>
    </Box>
  )
}
