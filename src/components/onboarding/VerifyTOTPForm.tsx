import { Alert, Box, Button, Stack, TextField, Typography } from '@mui/material'
import { colorPalette } from '@/theme'
import { useState } from 'react'
import FormLoadingOverlay from './FormLoadingOverlay'

interface VerifyTOTPFormProps {
  onSubmit?: (code: string) => void
  submitting?: boolean
  errorMessage?: string | null
}

const primaryButtonSx = {
  bgcolor: colorPalette.primary,
  color: '#ffffff',
  py: '20px',
  fontSize: '0.9375rem',
  fontWeight: 600,
  fontFamily: 'Jost',
  borderRadius: 0,
  textTransform: 'none' as const,
  letterSpacing: '0.02em',
  boxShadow: 'none',
  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
  '&:hover:not(:disabled)': {
    bgcolor: '#1a3896',
    boxShadow: `0 8px 24px ${colorPalette.primary}35`,
    transform: 'translateY(-1px)',
  },
  '&:active:not(:disabled)': { transform: 'translateY(0)' },
  '&:disabled': { bgcolor: '#e2e8f0', color: '#94a3b8' },
}

const labelSx = {
  fontSize: '0.875rem',
  fontWeight: 600,
  color: '#475569',
  mb: 1,
  fontFamily: 'Jost',
}

export default function VerifyTOTPForm({
  onSubmit,
  submitting = false,
  errorMessage = null,
}: VerifyTOTPFormProps) {
  const [code, setCode] = useState(['', '', '', '', '', ''])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (code.every((d) => d !== '')) onSubmit?.(code.join(''))
  }

  const handleCodeChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return
    const newCode = [...code]
    newCode[index] = value.slice(-1)
    setCode(newCode)
    if (value && index < 5) {
      setTimeout(() => {
        const inputs = document.querySelectorAll('[data-2fa-input]')
        ;(inputs[index + 1] as HTMLInputElement)?.focus()
      }, 0)
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      const inputs = document.querySelectorAll('[data-2fa-input]')
      ;(inputs[index - 1] as HTMLInputElement)?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted) {
      const newCode = [...code]
      pasted.split('').forEach((d, i) => (newCode[i] = d))
      setCode(newCode)
    }
  }

  const isFilled = code.every((d) => d !== '')

  return (
    <Stack sx={{ gap: 4, width: '100%', position: 'relative' }}>
      <Box>
        <Typography
          sx={{
            fontSize: '1.625rem',
            fontWeight: 700,
            fontFamily: 'Jost',
            color: '#0f172a',
            letterSpacing: '-0.015em',
            mb: 0.75,
          }}
        >
          Two-Factor Authentication
        </Typography>
        <Typography sx={{ fontSize: '0.9375rem', color: '#64748b', lineHeight: 1.6 }}>
          Please enter the 6-digit verification code from your authenticator app to continue.
        </Typography>
      </Box>

      <form onSubmit={handleSubmit}>
        <Stack sx={{ gap: 2.5 }}>
          <Box>
            <Typography sx={labelSx}>Authentication Code</Typography>
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'space-between' }}>
              {code.map((digit, index) => (
                <TextField
                  key={index}
                  inputRef={(el) => el && el.setAttribute('data-2fa-input', 'true')}
                  type="text"
                  inputProps={{
                    maxLength: 1,
                    inputMode: 'numeric',
                    style: {
                      textAlign: 'center',
                      fontSize: '1.5rem',
                      fontWeight: 600,
                      padding: '24px 0',
                      color: '#0f172a',
                    },
                  }}
                  value={digit}
                  onChange={(e) => handleCodeChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={handlePaste}
                  autoFocus={index === 0}
                  sx={{
                    flex: 1,
                    '& .MuiOutlinedInput-root': {
                      bgcolor: digit ? '#ffffff' : '#f5f3fb',
                      borderRadius: 0,
                      transition: 'all 0.2s ease',
                      '& fieldset': {
                        border: digit ? `1px solid ${colorPalette.primary}` : '1px solid transparent',
                        transition: 'all 0.2s ease',
                      },
                      '&:hover fieldset': { borderColor: digit ? colorPalette.primary : '#e4dff2' },
                      '&.Mui-focused fieldset': { borderColor: colorPalette.primary, borderWidth: '1px' },
                      '&.Mui-focused': { bgcolor: '#ffffff', boxShadow: `0 0 0 3px ${colorPalette.primary}14` },
                    },
                  }}
                />
              ))}
            </Box>
          </Box>

          {errorMessage && (
            <Alert severity="error" sx={{ borderRadius: 0 }}>
              {errorMessage}
            </Alert>
          )}

          <Button fullWidth type="submit" disabled={!isFilled || submitting} sx={primaryButtonSx}>
            {submitting ? 'Verifying…' : 'Verify & Sign In'}
          </Button>
        </Stack>
      </form>

      {submitting && <FormLoadingOverlay />}
    </Stack>
  )
}
