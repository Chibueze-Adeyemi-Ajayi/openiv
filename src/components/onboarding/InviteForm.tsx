import { Alert, Box, Button, Stack, TextField, Typography } from '@mui/material'
import { colorPalette } from '@/theme'
import { useState } from 'react'
import MarkEmailReadOutlinedIcon from '@mui/icons-material/MarkEmailReadOutlined'
import FormLoadingOverlay from './FormLoadingOverlay'

interface InviteFormProps {
  onSubmit?: (inviteCode: string) => void
  submitting?: boolean
  errorMessage?: string | null
}

export default function InviteForm({ onSubmit, submitting = false, errorMessage = null }: InviteFormProps) {
  const [inviteCode, setInviteCode] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit?.(inviteCode)
  }

  return (
    <Stack sx={{ gap: 4, width: '100%', position: 'relative' }}>
      <Box>
        <Typography
          sx={{
            fontSize: '1.625rem',
            fontWeight: 700,
            fontFamily: 'Jost',
            color: '#00288e',
            letterSpacing: '-0.015em',
            mb: 0.75,
          }}
        >
          Accept Your Invitation
        </Typography>
        <Typography sx={{ fontSize: '0.9375rem', color: '#64748b', lineHeight: 1.6 }}>
          Enter the invitation code sent by your administrator.
        </Typography>
      </Box>

      <Box
        sx={{
          p: 2,
          bgcolor: '#f5f3fb',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1.5,
        }}
      >
        <MarkEmailReadOutlinedIcon
          sx={{ color: colorPalette.primary, fontSize: '1.25rem', mt: 0.125, flexShrink: 0 }}
        />
        <Box>
          <Typography
            sx={{
              fontSize: '0.875rem',
              fontWeight: 700,
              color: '#00288e',
              mb: 0.5,
            }}
          >
            Check Your Inbox
          </Typography>
          <Typography sx={{ fontSize: '0.8125rem', color: '#64748b', lineHeight: 1.5 }}>
            Your invitation code was sent to the email registered by your institution administrator.
          </Typography>
        </Box>
      </Box>

      {errorMessage && (
        <Alert severity="error" sx={{ borderRadius: 0 }}>
          {errorMessage}
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <Stack sx={{ gap: 2.5 }}>
          <Box>
            <Typography
              sx={{
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#475569',
                mb: 1,
                fontFamily: 'Jost',
              }}
            >
              Invitation Code
            </Typography>
            <TextField
              fullWidth
              autoFocus
              placeholder="XXXX-XXXX-XXXX-XXXX"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              sx={{
                '& .MuiOutlinedInput-root': {
                  bgcolor: '#f5f3fb',
                  borderRadius: 0,
                  transition: 'all 0.2s ease',
                  '& fieldset': {
                    border: '1px solid transparent',
                    transition: 'all 0.2s ease',
                  },
                  '&:hover fieldset': { borderColor: '#e4dff2' },
                  '&.Mui-focused fieldset': { borderColor: colorPalette.primary, borderWidth: '1px' },
                  '&.Mui-focused': { bgcolor: '#ffffff', boxShadow: `0 0 0 3px ${colorPalette.primary}14` },
                },
                '& .MuiOutlinedInput-input': {
                  fontSize: '1rem',
                  fontFamily: 'SF Mono, Monaco, monospace',
                  letterSpacing: '0.1em',
                  py: '22px',
                  px: '22px',
                  color: '#00288e',
                  '&::placeholder': { color: '#9ca3af', opacity: 1, letterSpacing: '0.06em' },
                },
              }}
            />
          </Box>

          <Button
            fullWidth
            type="submit"
            disabled={!inviteCode || submitting}
            sx={{
              bgcolor: colorPalette.primary,
              color: '#ffffff',
              py: '20px',
              fontSize: '0.9375rem',
              fontWeight: 600,
              fontFamily: 'Jost',
              borderRadius: 0,
              textTransform: 'none',
              letterSpacing: '0.02em',
              boxShadow: 'none',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover:not(:disabled)': {
                bgcolor: '#1e293b',
                boxShadow: `0 8px 24px ${colorPalette.primary}35`,
                transform: 'translateY(-1px)',
              },
              '&:active:not(:disabled)': { transform: 'translateY(0)' },
              '&:disabled': { bgcolor: '#e2e8f0', color: '#94a3b8' },
            }}
          >
            {submitting ? 'Verifying…' : 'Continue'}
          </Button>
        </Stack>
      </form>

      {submitting && <FormLoadingOverlay />}
    </Stack>
  )
}
