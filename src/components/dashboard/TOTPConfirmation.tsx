import { Box, Typography, Button, TextField, Stack, IconButton, Chip } from '@mui/material'
import { colorPalette } from '@/theme'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '@/api/auth'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined'
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'

export type TOTPOperation = 'create' | 'update' | 'delete'

interface TOTPConfirmationProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  operation: TOTPOperation
  title: string
  description: string
  resourceName?: string
  resourceType?: string
  /** Show changes for update operations */
  changes?: { field: string; from: string; to: string }[]
  /** Items being deleted */
  itemsAffected?: string[]
}

const operationConfig: Record<TOTPOperation, { color: string; bg: string; label: string; verb: string }> = {
  create: { color: '#10b981', bg: '#f0fdf4', label: 'Create', verb: 'creating' },
  update: { color: colorPalette.primary, bg: `${colorPalette.primary}10`, label: 'Update', verb: 'updating' },
  delete: { color: '#dc2626', bg: '#fef2f2', label: 'Delete', verb: 'deleting' },
}

export default function TOTPConfirmation({
  open,
  onClose,
  onConfirm,
  operation,
  title,
  description,
  resourceName,
  resourceType,
  changes,
  itemsAffected,
}: TOTPConfirmationProps) {
  const navigate = useNavigate()
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [verifying, setVerifying] = useState(false)
  const [verified, setVerified] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lockedOut, setLockedOut] = useState(false)
  const failedAttemptsRef = useRef(0)

  const cfg = operationConfig[operation]

  // Reset state when opening
  useEffect(() => {
    if (open) {
      setCode(['', '', '', '', '', ''])
      setVerifying(false)
      setVerified(false)
      setError(null)
      setLockedOut(false)
      failedAttemptsRef.current = 0
      setTimeout(() => {
        const first = document.querySelector('[data-totp-input]') as HTMLInputElement
        first?.focus()
      }, 100)
    }
  }, [open])

  const handleCodeChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return
    setError(null)
    const newCode = [...code]
    newCode[index] = value.slice(-1)
    setCode(newCode)
    if (value && index < 5) {
      setTimeout(() => {
        const inputs = document.querySelectorAll('[data-totp-input]')
        ;(inputs[index + 1] as HTMLInputElement)?.focus()
      }, 0)
    }
    // Auto-submit when filled
    if (value && index === 5 && newCode.every((d) => d !== '')) {
      verify(newCode.join(''))
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      const inputs = document.querySelectorAll('[data-totp-input]')
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
      if (newCode.every((d) => d !== '')) {
        verify(newCode.join(''))
      }
    }
  }

  const verify = useCallback(async (full: string) => {
    if (full.length !== 6 || !/^\d{6}$/.test(full)) return
    setVerifying(true)
    setError(null)
    try {
      await authApi.stepUpTotp(full.trim())
      setVerifying(false)
      setVerified(true)
      setTimeout(() => onConfirm(), 700)
    } catch {
      setVerifying(false)
      const attempts = failedAttemptsRef.current + 1
      failedAttemptsRef.current = attempts
      if (attempts >= 3) {
        setLockedOut(true)
        authApi.stepUpLockout().catch(() => {})
        authApi.logout().catch(() => {})
        setTimeout(() => navigate('/'), 1500)
        return
      }
      const remaining = 3 - attempts
      setError(`Invalid code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`)
      setCode(['', '', '', '', '', ''])
      setTimeout(() => {
        const first = document.querySelector('[data-totp-input]') as HTMLInputElement
        first?.focus()
      }, 0)
    }
  }, [onConfirm, navigate])

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <Box
        onClick={onClose}
        sx={{
          position: 'fixed',
          inset: 0,
          bgcolor: 'rgba(15, 23, 42, 0.55)',
          backdropFilter: 'blur(2px)',
          zIndex: 1300,
          animation: 'fadeIn 0.2s ease',
          '@keyframes fadeIn': { from: { opacity: 0 }, to: { opacity: 1 } },
        }}
      />

      {/* Modal */}
      <Box
        data-ai-analyzable="true"
        data-ai-description={`Security step-up authentication required to ${cfg.verb} ${resourceType || 'resource'} "${resourceName || title}". This action is protected by Google Authenticator TOTP.`}
        sx={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '100%',
          maxWidth: 460,
          bgcolor: '#ffffff',
          zIndex: 1301,
          boxShadow: '0 24px 64px rgba(15,23,42,0.18)',
          animation: 'modalIn 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          '@keyframes modalIn': {
            from: { opacity: 0, transform: 'translate(-50%, -48%) scale(0.96)' },
            to: { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' },
          },
        }}
      >
        {/* Header */}
        <Box
          sx={{
            px: 3,
            py: 2.5,
            borderBottom: '1px solid #eef0f4',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                bgcolor: cfg.bg,
                color: cfg.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ShieldOutlinedIcon sx={{ fontSize: '1.125rem' }} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: cfg.color, textTransform: 'uppercase', letterSpacing: '0.14em' }}>
                Authentication required · {cfg.label}
              </Typography>
              <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost', mt: 0.125 }}>
                {title}
              </Typography>
            </Box>
          </Box>
          <IconButton
            onClick={onClose}
            disableRipple
            disabled={verifying || verified || lockedOut}
            sx={{
              color: '#94a3b8',
              borderRadius: 0,
              '&:hover': { color: colorPalette.primary, bgcolor: 'transparent' },
            }}
          >
            <CloseRoundedIcon sx={{ fontSize: '1.25rem' }} />
          </IconButton>
        </Box>

        {/* Body */}
        <Box sx={{ px: 3, py: 3 }}>
          {lockedOut ? (
            <Stack alignItems="center" gap={1.5} sx={{ py: 4 }}>
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  bgcolor: '#fef2f2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  animation: 'checkPop 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  '@keyframes checkPop': {
                    '0%': { transform: 'scale(0.5)', opacity: 0 },
                    '60%': { transform: 'scale(1.1)' },
                    '100%': { transform: 'scale(1)', opacity: 1 },
                  },
                }}
              >
                <WarningAmberRoundedIcon sx={{ fontSize: '1.875rem', color: '#dc2626' }} />
              </Box>
              <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
                Session terminated
              </Typography>
              <Typography sx={{ fontSize: '0.8125rem', color: '#64748b', textAlign: 'center', maxWidth: 320, lineHeight: 1.6 }}>
                3 failed verification attempts detected. Your session has been terminated and a security alert has been sent. Redirecting…
              </Typography>
            </Stack>
          ) : verified ? (
            <Stack alignItems="center" gap={1.5} sx={{ py: 4 }}>
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  bgcolor: '#f0fdf4',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  animation: 'checkPop 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  '@keyframes checkPop': {
                    '0%': { transform: 'scale(0.5)', opacity: 0 },
                    '60%': { transform: 'scale(1.1)' },
                    '100%': { transform: 'scale(1)', opacity: 1 },
                  },
                }}
              >
                <CheckCircleOutlineRoundedIcon sx={{ fontSize: '1.875rem', color: '#10b981' }} />
              </Box>
              <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
                Identity verified
              </Typography>
              <Typography sx={{ fontSize: '0.8125rem', color: '#64748b' }}>
                Proceeding with {cfg.label.toLowerCase()}…
              </Typography>
            </Stack>
          ) : (
            <>
              <Typography sx={{ fontSize: '0.875rem', color: '#475569', lineHeight: 1.6, mb: 2 }}>
                {description}
              </Typography>

              {/* Resource being affected */}
              {resourceName && (
                <Box
                  sx={{
                    bgcolor: '#fafbfc',
                    border: '1px solid #eef0f4',
                    p: 1.5,
                    mb: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.25,
                  }}
                >
                  <Chip
                    label={cfg.label.toUpperCase()}
                    size="small"
                    sx={{
                      bgcolor: cfg.bg,
                      color: cfg.color,
                      fontWeight: 700,
                      fontSize: '0.625rem',
                      letterSpacing: '0.1em',
                      borderRadius: 0,
                      height: 20,
                    }}
                  />
                  <Box sx={{ flex: 1 }}>
                    {resourceType && (
                      <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                        {resourceType}
                      </Typography>
                    )}
                    <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost', mt: 0.125 }}>
                      {resourceName}
                    </Typography>
                  </Box>
                </Box>
              )}

              {/* Changes diff for updates */}
              {changes && changes.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 0.875 }}>
                    Changes
                  </Typography>
                  <Stack gap={0.75}>
                    {changes.map((c, i) => (
                      <Box key={i} sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, alignItems: 'center', fontSize: '0.75rem' }}>
                        <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>
                          {c.field}
                        </Typography>
                        <Box sx={{ bgcolor: '#fef2f2', color: '#7f1d1d', px: 1, py: 0.5, fontFamily: 'SF Mono, Monaco, monospace', textDecoration: 'line-through', fontSize: '0.6875rem', textAlign: 'center' }}>
                          {c.from}
                        </Box>
                        <Box sx={{ bgcolor: '#f0fdf4', color: '#14532d', px: 1, py: 0.5, fontFamily: 'SF Mono, Monaco, monospace', fontSize: '0.6875rem', textAlign: 'center', fontWeight: 700 }}>
                          {c.to}
                        </Box>
                      </Box>
                    ))}
                  </Stack>
                </Box>
              )}

              {/* Items being deleted */}
              {itemsAffected && itemsAffected.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 0.875 }}>
                    {itemsAffected.length} item{itemsAffected.length > 1 ? 's' : ''} affected
                  </Typography>
                  <Box sx={{ bgcolor: '#fef2f2', border: '1px solid #fecaca', maxHeight: 120, overflowY: 'auto' }}>
                    {itemsAffected.map((item, i) => (
                      <Typography
                        key={i}
                        sx={{
                          px: 1.5,
                          py: 0.875,
                          fontSize: '0.75rem',
                          color: '#7f1d1d',
                          fontFamily: 'SF Mono, Monaco, monospace',
                          borderBottom: i === itemsAffected.length - 1 ? 'none' : '1px solid #fecaca',
                        }}
                      >
                        {item}
                      </Typography>
                    ))}
                  </Box>
                </Box>
              )}

              {/* TOTP code input */}
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
                    Enter the 6-digit code from Google Authenticator
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <LockOutlinedIcon sx={{ fontSize: '0.875rem', color: '#94a3b8' }} />
                    <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', fontWeight: 600 }}>
                      adaeze.chukwu@fcmb.com
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'space-between' }}>
                  {code.map((digit, index) => (
                    <TextField
                      key={index}
                      inputRef={(el) => el && el.setAttribute('data-totp-input', 'true')}
                      type="text"
                      disabled={verifying}
                      inputProps={{
                        maxLength: 1,
                        inputMode: 'numeric',
                        style: {
                          textAlign: 'center',
                          fontSize: '1.5rem',
                          fontWeight: 700,
                          padding: '20px 0',
                          color: error ? '#dc2626' : '#0f172a',
                        },
                      }}
                      value={digit}
                      onChange={(e) => handleCodeChange(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      onPaste={handlePaste}
                      sx={{
                        flex: 1,
                        '& .MuiOutlinedInput-root': {
                          bgcolor: error ? '#fef2f2' : digit ? '#ffffff' : '#f5f3fb',
                          borderRadius: 0,
                          transition: 'all 0.18s ease',
                          '& fieldset': {
                            border: error
                              ? '1px solid #dc2626'
                              : digit
                              ? `1px solid ${colorPalette.primary}`
                              : '1px solid transparent',
                          },
                          '&:hover fieldset': { borderColor: error ? '#dc2626' : digit ? colorPalette.primary : '#e4dff2' },
                          '&.Mui-focused fieldset': { borderColor: error ? '#dc2626' : colorPalette.primary, borderWidth: '1px' },
                          '&.Mui-focused': {
                            bgcolor: '#ffffff',
                            boxShadow: error ? '0 0 0 3px rgba(220, 38, 38, 0.12)' : `0 0 0 3px ${colorPalette.primary}14`,
                          },
                        },
                      }}
                    />
                  ))}
                </Box>

                {error && (
                  <Typography sx={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 600, mt: 1 }}>
                    {error}
                  </Typography>
                )}

                {verifying && (
                  <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box
                      sx={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        border: `2px solid ${colorPalette.primary}30`,
                        borderTopColor: colorPalette.primary,
                        animation: 'spin 0.8s linear infinite',
                        '@keyframes spin': { to: { transform: 'rotate(360deg)' } },
                      }}
                    />
                    <Typography sx={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
                      Verifying with Google Authenticator…
                    </Typography>
                  </Box>
                )}

                <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', mt: 1.5, lineHeight: 1.5 }}>
                  This action requires step-up authentication per CBN Baseline Standards §3.4. The 6-digit code refreshes every 30 seconds in your Google Authenticator app.
                </Typography>
              </Box>
            </>
          )}
        </Box>

        {/* Footer */}
        {!verified && !lockedOut && (
          <Box sx={{ px: 3, py: 2, borderTop: '1px solid #eef0f4', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
            <Typography
              sx={{
                fontSize: '0.6875rem',
                color: colorPalette.primary,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'Jost',
                '&:hover': { textDecoration: 'underline' },
              }}
            >
              Lost device? Use a recovery code
            </Typography>
            <Stack direction="row" gap={1}>
              <Button
                onClick={onClose}
                disabled={verifying}
                sx={{
                  bgcolor: '#ffffff',
                  color: '#475569',
                  border: '1px solid #e5e7eb',
                  px: 2.25,
                  py: 1,
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  fontFamily: 'Jost',
                  borderRadius: 0,
                  textTransform: 'none',
                  '&:hover': { bgcolor: '#f8fafc' },
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => verify(code.join(''))}
                disabled={code.some((d) => d === '') || verifying}
                sx={{
                  bgcolor: cfg.color,
                  color: '#ffffff',
                  px: 2.25,
                  py: 1,
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  fontFamily: 'Jost',
                  borderRadius: 0,
                  textTransform: 'none',
                  boxShadow: 'none',
                  '&:hover:not(:disabled)': { opacity: 0.9 },
                  '&:disabled': { bgcolor: '#e2e8f0', color: '#94a3b8' },
                }}
              >
                Authorize {cfg.label}
              </Button>
            </Stack>
          </Box>
        )}
      </Box>
    </>
  )
}
