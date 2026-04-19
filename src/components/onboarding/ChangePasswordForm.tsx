import { Box, Button, Stack, TextField, Typography, IconButton } from '@mui/material'
import { colorPalette } from '@/theme'
import { useState } from 'react'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'

interface ChangePasswordFormProps {
  onSubmit?: (currentPassword: string, newPassword: string, confirmPassword: string) => void
}

const inputSx = {
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
    fontFamily: 'Jost',
    py: '22px',
    px: '22px',
    color: '#0f172a',
    '&::placeholder': { color: '#9ca3af', opacity: 1 },
  },
}

const labelSx = {
  fontSize: '0.875rem',
  fontWeight: 600,
  color: '#475569',
  mb: 1,
  fontFamily: 'Jost',
}

function passwordStrength(pwd: string) {
  let score = 0
  if (pwd.length >= 8) score++
  if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++
  if (/\d/.test(pwd)) score++
  if (/[^A-Za-z0-9]/.test(pwd)) score++
  if (pwd.length >= 12) score++
  return Math.min(score, 4)
}

const strengthLabels = ['Too Weak', 'Weak', 'Fair', 'Strong', 'Very Strong']
const strengthColors = ['#cbd5e1', '#f59e0b', '#3b82f6', colorPalette.primary, colorPalette.primary_container]

export default function ChangePasswordForm({ onSubmit }: ChangePasswordFormProps) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const passwordMatch = newPassword && confirmPassword && newPassword === confirmPassword
  const strength = passwordStrength(newPassword)
  const isValid = currentPassword && passwordMatch && newPassword.length >= 8

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isValid) onSubmit?.(currentPassword, newPassword, confirmPassword)
  }

  const eyeAdornment = (shown: boolean, toggle: () => void) => (
    <IconButton
      edge="end"
      onClick={toggle}
      disableRipple
      sx={{
        color: '#94a3b8',
        mr: 1.5,
        transition: 'color 0.2s ease',
        '&:hover': { color: colorPalette.primary, bgcolor: 'transparent' },
      }}
      tabIndex={-1}
    >
      {shown ? (
        <VisibilityOffOutlinedIcon sx={{ fontSize: '1.25rem' }} />
      ) : (
        <VisibilityOutlinedIcon sx={{ fontSize: '1.25rem' }} />
      )}
    </IconButton>
  )

  return (
    <Stack sx={{ gap: 4, width: '100%' }}>
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
          Change Your Password
        </Typography>
        <Typography sx={{ fontSize: '0.9375rem', color: '#64748b', lineHeight: 1.6 }}>
          Update your password to keep your account secure.
        </Typography>
      </Box>

      <form onSubmit={handleSubmit}>
        <Stack sx={{ gap: 2.5 }}>
          <Box>
            <Typography sx={labelSx}>Current Password</Typography>
            <TextField
              fullWidth
              type={showCurrent ? 'text' : 'password'}
              placeholder="Enter Current Password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              InputProps={{
                endAdornment: eyeAdornment(showCurrent, () => setShowCurrent(!showCurrent)),
              }}
              sx={inputSx}
            />
          </Box>

          <Box>
            <Typography sx={labelSx}>New Password</Typography>
            <TextField
              fullWidth
              type={showNew ? 'text' : 'password'}
              placeholder="Enter New Password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              InputProps={{
                endAdornment: eyeAdornment(showNew, () => setShowNew(!showNew)),
              }}
              sx={inputSx}
            />
            {newPassword && (
              <Box sx={{ mt: 1.5 }}>
                <Box sx={{ display: 'flex', gap: 0.5, mb: 0.75 }}>
                  {[0, 1, 2, 3].map((i) => (
                    <Box
                      key={i}
                      sx={{
                        flex: 1,
                        height: '3px',
                        bgcolor: i < strength ? strengthColors[strength] : '#e5e7eb',
                        transition: 'all 0.3s ease',
                      }}
                    />
                  ))}
                </Box>
                <Typography
                  sx={{
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    color: strength >= 3 ? colorPalette.primary : '#64748b',
                  }}
                >
                  {strengthLabels[strength]}
                </Typography>
              </Box>
            )}
          </Box>

          <Box>
            <Typography sx={labelSx}>Confirm New Password</Typography>
            <TextField
              fullWidth
              type={showConfirm ? 'text' : 'password'}
              placeholder="Re-enter New Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              InputProps={{
                endAdornment: (
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    {passwordMatch && (
                      <CheckRoundedIcon sx={{ color: colorPalette.success, fontSize: '1.25rem', mr: 0.5 }} />
                    )}
                    {eyeAdornment(showConfirm, () => setShowConfirm(!showConfirm))}
                  </Box>
                ),
              }}
              sx={inputSx}
            />
          </Box>

          <Button
            fullWidth
            type="submit"
            disabled={!isValid}
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
              mt: 1,
              '&:hover:not(:disabled)': {
                bgcolor: '#1a3896',
                boxShadow: `0 8px 24px ${colorPalette.primary}35`,
                transform: 'translateY(-1px)',
              },
              '&:active:not(:disabled)': { transform: 'translateY(0)' },
              '&:disabled': { bgcolor: '#e2e8f0', color: '#94a3b8' },
            }}
          >
            Update Password
          </Button>
        </Stack>
      </form>
    </Stack>
  )
}
