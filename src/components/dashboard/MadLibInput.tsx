/**
 * MadLibInput.tsx
 *
 * Extracted from ThresholdsPage.tsx — inline styled text field used inside
 * behavioural rule "mad-lib" sentences (e.g. "Flag when [N] accounts …").
 */

import { Box, TextField } from '@mui/material'
import { colorPalette } from '@/theme'

interface Props {
  value: any
  onChange: (val: any) => void
  width?: number
  type?: string
  readOnly?: boolean
}

export default function MadLibInput({ value, onChange, width = 60, type = 'number', readOnly = false }: Props) {
  return (
    <Box sx={{ display: 'inline-block', mx: 0.75, verticalAlign: 'middle' }}>
      <TextField
        value={value}
        onChange={(e) => !readOnly && onChange(type === 'number' ? Number(e.target.value) : e.target.value)}
        type={type}
        variant="standard"
        slotProps={{ input: { disableUnderline: true, readOnly } }}
        sx={{
          bgcolor: `${colorPalette.primary}15`,
          border: `1px solid ${colorPalette.primary}30`,
          borderRadius: 0,
          width,
          '& input': {
            textAlign: 'center',
            p: 0.5,
            fontSize: '0.875rem',
            fontWeight: 700,
            color: colorPalette.primary,
            fontFamily: 'SF Mono, Monaco, monospace',
          },
          '&:hover': { bgcolor: `${colorPalette.primary}20` },
          '&:focus-within': { borderColor: colorPalette.primary, bgcolor: 'var(--card-bg)', boxShadow: `0 0 0 2px ${colorPalette.primary}20` },
        }}
      />
    </Box>
  )
}
