import { Box, CircularProgress } from '@mui/material'
import { colorPalette } from '@/theme'

/**
 * Full-form loading overlay. Rendered as an absolutely-positioned sibling inside a
 * {@code position: relative} parent (each onboarding form's outer Stack). Covers only the
 * form, not the whole page.
 *
 * - Translucent white backdrop so the form beneath stays faintly visible.
 * - MUI {@code CircularProgress} centered; the rotation is built-in.
 * - {@code pointer-events: auto} absorbs any stray clicks on the form while a request is in
 *   flight, backing up the already-disabled submit button.
 */
export default function FormLoadingOverlay() {
  return (
    <Box
      aria-live="polite"
      aria-busy="true"
      sx={{
        position: 'absolute',
        inset: 0,
        bgcolor: 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
        pointerEvents: 'auto',
      }}
    >
      <CircularProgress
        size={44}
        thickness={4}
        sx={{ color: colorPalette.primary }}
      />
    </Box>
  )
}
