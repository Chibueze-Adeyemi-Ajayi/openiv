import { Alert, Box, Button, Stack, TextField, Typography } from '@mui/material'
import { colorPalette } from '@/theme'
import { useState } from 'react'
import QrCodeScannerOutlinedIcon from '@mui/icons-material/QrCodeScannerOutlined'
import PhoneAndroidOutlinedIcon from '@mui/icons-material/PhoneAndroidOutlined'
import ArrowBackIcon from '@mui/icons-material/ArrowBackRounded'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined'
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded'
import { QRCodeSVG } from 'qrcode.react'
import FormLoadingOverlay from './FormLoadingOverlay'

interface Setup2FAFormProps {
  /** Emits the entered 6-digit TOTP code. */
  onSubmit?: (code: string) => void
  /** Triggered when the user first selects "Authenticator App" — the page should call enroll. */
  onEnroll?: () => void
  /** Base32 TOTP secret from /totp/enroll. */
  secret?: string
  /** otpauth:// URI from /totp/enroll — render as QR or copy for manual entry. */
  otpauthUri?: string
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
    bgcolor: '#1e293b',
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

const backButtonSx = {
  color: '#94a3b8',
  textTransform: 'none' as const,
  fontSize: '0.875rem',
  fontFamily: 'Jost',
  fontWeight: 600,
  p: 0,
  alignSelf: 'flex-start',
  transition: 'color 0.2s ease',
  '&:hover': { bgcolor: 'transparent', color: colorPalette.primary },
}

export default function Setup2FAForm({
  onSubmit,
  onEnroll,
  secret,
  otpauthUri,
  submitting = false,
  errorMessage = null,
}: Setup2FAFormProps) {
  const [selectedMethod, setSelectedMethod] = useState<'authenticator' | null>(null)
  const [showCodeInput, setShowCodeInput] = useState(false)
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [copied, setCopied] = useState(false)

  const displaySecret = secret ? formatSecret(secret) : '— — — —'

  const handleSelectAuthenticator = () => {
    setSelectedMethod('authenticator')
    if (!secret) onEnroll?.()
  }

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

  const handleCopySecret = () => {
    if (!secret) return
    navigator.clipboard.writeText(secret)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleCopyUri = () => {
    if (!otpauthUri) return
    navigator.clipboard.writeText(otpauthUri)
  }

  const isFilled = code.every((d) => d !== '')

  return (
    <Stack
      sx={{
        gap: 4,
        width: '100%',
        position: 'relative',
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
            color: '#00288e',
            letterSpacing: '-0.015em',
            mb: 0.75,
          }}
        >
          Secure Your Account
        </Typography>
        <Typography sx={{ fontSize: '0.9375rem', color: '#64748b', lineHeight: 1.6 }}>
          {!selectedMethod && 'Add an extra layer of security with two-factor authentication.'}
          {selectedMethod && !showCodeInput && 'Scan the QR code with your authenticator app.'}
          {selectedMethod && showCodeInput && 'Enter the 6-digit code from your authenticator app.'}
        </Typography>
      </Box>

      <form onSubmit={handleSubmit}>
        <Stack sx={{ gap: 2.5 }}>
          {!selectedMethod ? (
            <Stack sx={{ gap: 1.25, animation: 'slideIn 0.3s ease' }}>
              <Box
                onClick={handleSelectAuthenticator}
                sx={{
                  p: 2.25,
                  bgcolor: '#f5f3fb',
                  border: '1px solid transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    borderColor: colorPalette.primary,
                    bgcolor: '#ede9f5',
                    transform: 'translateY(-1px)',
                  },
                }}
              >
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    bgcolor: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <QrCodeScannerOutlinedIcon sx={{ color: colorPalette.primary, fontSize: '1.375rem' }} />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontWeight: 600, color: '#00288e', fontSize: '1rem', fontFamily: 'Jost', mb: 0.25 }}>
                    Authenticator App
                  </Typography>
                  <Typography sx={{ fontSize: '0.8125rem', color: '#64748b' }}>
                    Google Authenticator, Authy, 1Password
                  </Typography>
                </Box>
                <ChevronRightRoundedIcon sx={{ color: '#94a3b8', fontSize: '1.25rem' }} />
              </Box>

              <Box
                sx={{
                  p: 2.25,
                  bgcolor: '#fafafa',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  opacity: 0.6,
                }}
              >
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    bgcolor: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <PhoneAndroidOutlinedIcon sx={{ color: '#94a3b8', fontSize: '1.375rem' }} />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontWeight: 600, color: '#475569', fontSize: '1rem', fontFamily: 'Jost', mb: 0.25 }}>
                    SMS Text Message
                  </Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>
                    Coming Soon
                  </Typography>
                </Box>
              </Box>
            </Stack>
          ) : !showCodeInput ? (
            <Stack sx={{ gap: 2.5, animation: 'slideIn 0.3s ease' }}>
              <Button
                size="small"
                onClick={() => setSelectedMethod(null)}
                startIcon={<ArrowBackIcon sx={{ fontSize: '1.125rem !important' }} />}
                sx={backButtonSx}
              >
                Back
              </Button>

              {otpauthUri ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
                  <Box
                    sx={{
                      p: 2,
                      bgcolor: '#ffffff',
                      border: '1px solid #e4dff2',
                      display: 'inline-flex',
                    }}
                  >
                    <QRCodeSVG
                      value={otpauthUri}
                      size={192}
                      level="M"
                      marginSize={0}
                      fgColor={colorPalette.primary}
                      bgColor="#ffffff"
                    />
                  </Box>
                </Box>
              ) : (
                <Alert severity="info" sx={{ borderRadius: 0 }}>
                  Preparing your authenticator setup…
                </Alert>
              )}
              <Typography sx={{ fontSize: '0.8125rem', color: '#64748b', textAlign: 'center' }}>
                Scan with Google Authenticator, Authy, 1Password, or any TOTP app. If you can't
                scan, use the manual setup key below.
              </Typography>

              <Box>
                <Typography sx={labelSx}>Manual Setup Key</Typography>
                <Box
                  sx={{
                    bgcolor: '#f5f3fb',
                    p: '16px 18px',
                    fontFamily: 'SF Mono, Monaco, monospace',
                    fontSize: '0.9375rem',
                    fontWeight: 600,
                    letterSpacing: '0.08em',
                    color: '#00288e',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1,
                    border: '1px solid transparent',
                    transition: 'border-color 0.2s ease',
                    '&:hover': { borderColor: '#e4dff2' },
                  }}
                >
                  <Box component="span" sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {displaySecret}
                  </Box>
                  <Button
                    size="small"
                    onClick={handleCopySecret}
                    startIcon={
                      copied ? (
                        <CheckRoundedIcon sx={{ fontSize: '0.9rem !important' }} />
                      ) : (
                        <ContentCopyOutlinedIcon sx={{ fontSize: '0.9rem !important' }} />
                      )
                    }
                    sx={{
                      color: copied ? colorPalette.success : colorPalette.primary,
                      textTransform: 'none',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      fontFamily: 'Jost',
                      minWidth: 'auto',
                      p: '4px 8px',
                      transition: 'color 0.2s ease',
                      '&:hover': { bgcolor: 'transparent' },
                    }}
                  >
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                </Box>
              </Box>

              <Button
                fullWidth
                onClick={() => setShowCodeInput(true)}
                disabled={!secret}
                sx={primaryButtonSx}
              >
                {secret ? "I've Added The Account" : 'Preparing…'}
              </Button>
              {otpauthUri && (
                <Typography
                  component="button"
                  type="button"
                  onClick={handleCopyUri}
                  sx={{
                    fontSize: '0.8125rem',
                    color: colorPalette.primary,
                    fontWeight: 600,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'center',
                    fontFamily: 'Jost',
                  }}
                >
                  Copy otpauth:// URI (advanced)
                </Typography>
              )}
            </Stack>
          ) : (
            <Stack sx={{ gap: 2.5, animation: 'slideIn 0.3s ease' }}>
              <Button
                size="small"
                onClick={() => setShowCodeInput(false)}
                startIcon={<ArrowBackIcon sx={{ fontSize: '1.125rem !important' }} />}
                sx={backButtonSx}
              >
                Back
              </Button>

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
                          color: '#00288e',
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
                {submitting ? 'Verifying…' : 'Verify & Continue'}
              </Button>
            </Stack>
          )}
        </Stack>
      </form>

      {submitting && <FormLoadingOverlay />}
    </Stack>
  )
}

/** Format a base32 secret as four-char groups for readability. */
function formatSecret(secret: string): string {
  return secret.toUpperCase().match(/.{1,4}/g)?.join(' ') ?? secret
}
