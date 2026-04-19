import { Box, Button, Stack, TextField, Typography, IconButton } from '@mui/material'
import { colorPalette } from '@/theme'
import { useState } from 'react'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined'
import ArrowBackIcon from '@mui/icons-material/ArrowBackRounded'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'

interface ResetPasswordFormProps {
  onSubmit?: (email: string) => void
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

const backButtonSx = {
  color: '#94a3b8',
  textTransform: 'none' as const,
  fontSize: '0.875rem',
  fontFamily: 'Jost',
  fontWeight: 600,
  transition: 'color 0.2s ease',
  '&:hover': { bgcolor: 'transparent', color: colorPalette.primary },
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

export default function ResetPasswordForm({ onSubmit }: ResetPasswordFormProps) {
  const [step, setStep] = useState<'email' | 'code' | 'newpassword'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const stepIndex = step === 'email' ? 0 : step === 'code' ? 1 : 2
  const passwordMatch = newPassword && confirmPassword && newPassword === confirmPassword
  const strength = passwordStrength(newPassword)

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (email) setStep('code')
  }

  const handleCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (code.every((d) => d !== '')) setStep('newpassword')
  }

  const handleResetSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (passwordMatch && newPassword.length >= 8) onSubmit?.(email)
  }

  const handleCodeChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return
    const newCode = [...code]
    newCode[index] = value.slice(-1)
    setCode(newCode)
    if (value && index < 5) {
      setTimeout(() => {
        const inputs = document.querySelectorAll('[data-reset-code]')
        ;(inputs[index + 1] as HTMLInputElement)?.focus()
      }, 0)
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      const inputs = document.querySelectorAll('[data-reset-code]')
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
    <Stack
      sx={{
        gap: 4,
        width: '100%',
        '@keyframes slideIn': {
          from: { opacity: 0, transform: 'translateX(8px)' },
          to: { opacity: 1, transform: 'translateX(0)' },
        },
      }}
    >
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
          Reset Your Password
        </Typography>
        <Typography sx={{ fontSize: '0.9375rem', color: '#64748b', lineHeight: 1.6 }}>
          {step === 'email' && 'Enter your email and we\'ll send you a verification code.'}
          {step === 'code' && `Enter the 6-digit code sent to ${email || 'your email'}.`}
          {step === 'newpassword' && 'Choose a strong new password for your account.'}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', gap: 0.75 }}>
        {[0, 1, 2].map((i) => (
          <Box
            key={i}
            sx={{
              flex: 1,
              height: '3px',
              bgcolor: i <= stepIndex ? colorPalette.primary : '#e5e7eb',
              transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
        ))}
      </Box>

      {step === 'email' && (
        <form onSubmit={handleEmailSubmit} style={{ animation: 'slideIn 0.3s ease' }}>
          <Stack sx={{ gap: 2.5 }}>
            <Box>
              <Typography sx={labelSx}>Institutional Email</Typography>
              <TextField
                fullWidth
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                sx={inputSx}
              />
            </Box>
            <Button fullWidth type="submit" disabled={!email} sx={primaryButtonSx}>
              Send Reset Code
            </Button>
          </Stack>
        </form>
      )}

      {step === 'code' && (
        <form onSubmit={handleCodeSubmit} style={{ animation: 'slideIn 0.3s ease' }}>
          <Stack sx={{ gap: 2.5 }}>
            <Box>
              <Typography sx={labelSx}>Verification Code</Typography>
              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'space-between' }}>
                {code.map((digit, index) => (
                  <TextField
                    key={index}
                    inputRef={(el) => el && el.setAttribute('data-reset-code', 'true')}
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

            <Button fullWidth type="submit" disabled={!code.every((d) => d !== '')} sx={primaryButtonSx}>
              Verify Code
            </Button>

            <Button
              fullWidth
              onClick={() => setStep('email')}
              startIcon={<ArrowBackIcon sx={{ fontSize: '1.125rem !important' }} />}
              sx={backButtonSx}
            >
              Back
            </Button>
          </Stack>
        </form>
      )}

      {step === 'newpassword' && (
        <form onSubmit={handleResetSubmit} style={{ animation: 'slideIn 0.3s ease' }}>
          <Stack sx={{ gap: 2.5 }}>
            <Box>
              <Typography sx={labelSx}>New Password</Typography>
              <TextField
                fullWidth
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter New Password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoFocus
                InputProps={{
                  endAdornment: eyeAdornment(showPassword, () => setShowPassword(!showPassword)),
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
              <Typography sx={labelSx}>Confirm Password</Typography>
              <TextField
                fullWidth
                type={showConfirm ? 'text' : 'password'}
                placeholder="Re-enter Password"
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
              disabled={!passwordMatch || newPassword.length < 8}
              sx={primaryButtonSx}
            >
              Reset Password
            </Button>
          </Stack>
        </form>
      )}
    </Stack>
  )
}
