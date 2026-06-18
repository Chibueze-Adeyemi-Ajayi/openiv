import { Box, Typography, Button, Stack, IconButton, Chip } from '@mui/material'
import { colorPalette } from '@/theme'
import { useState } from 'react'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined'
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'
import FingerprintIcon from '@mui/icons-material/Fingerprint'
import { verifyBiometric, webAuthnSupported } from '@/api/webauthn'

export type TOTPOperation = 'create' | 'update' | 'delete'

interface TOTPConfirmationProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  operation: TOTPOperation
  title: string
  description: string | React.ReactNode
  resourceName?: string
  resourceType?: string
  changes?: { field: string; from: string; to: string }[]
  itemsAffected?: string[]
}

const operationConfig: Record<TOTPOperation, { color: string; bg: string; label: string; verb: string }> = {
  create: { color: '#10b981', bg: '#f0fdf4', label: 'Create', verb: 'creating' },
  update: { color: colorPalette.primary, bg: `${colorPalette.primary}10`, label: 'Update', verb: 'updating' },
  delete: { color: '#dc2626', bg: '#fef2f2', label: 'Delete', verb: 'deleting' },
}

const AUTH_CODE_PHRASES = [
  /[. ]*confirm with your authenticator code[. ]*/gi,
  /[. ]*verify with your authenticator code to \w+[. ]*/gi,
  /[. ]*enter your authenticator code to proceed[. ]*/gi,
  /[. ]*enter your authenticator code[. ]*/gi,
  /[. ]*enter the 6-digit code from your authenticator app[. ]*/gi,
]

function stripAuthInstruction(desc: string | React.ReactNode): string | React.ReactNode {
  if (typeof desc !== 'string') return desc
  let result = desc
  for (const re of AUTH_CODE_PHRASES) result = result.replace(re, ' ')
  return result.trim()
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
  const [confirmed, setConfirmed] = useState(false)
  const [biometricError, setBiometricError] = useState(false)
  const cfg = operationConfig[operation]
  const useBiometric = webAuthnSupported()
  const displayDescription = useBiometric ? stripAuthInstruction(description) : description

  const handleConfirm = async () => {
    setBiometricError(false)
    if (useBiometric) {
      try {
        await verifyBiometric()
      } catch {
        setBiometricError(true)
        return
      }
    }
    setConfirmed(true)
    setTimeout(() => {
      onConfirm()
      setConfirmed(false)
    }, 500)
  }

  if (!open) return null

  return (
    <>
      <Box
        onClick={onClose}
        sx={{
          position: 'fixed', inset: 0,
          bgcolor: 'rgba(15, 23, 42, 0.55)',
          backdropFilter: 'blur(2px)',
          zIndex: 1300,
          animation: 'fadeIn 0.2s ease',
          '@keyframes fadeIn': { from: { opacity: 0 }, to: { opacity: 1 } },
        }}
      />
      <Box
        sx={{
          position: 'fixed', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '100%', maxWidth: 460,
          bgcolor: 'var(--card-bg)',
          zIndex: 1301,
          boxShadow: '0 24px 64px rgba(15,23,42,0.18)',
          animation: 'modalIn 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          '@keyframes modalIn': {
            from: { opacity: 0, transform: 'translate(-50%, -48%) scale(0.96)' },
            to:   { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' },
          },
        }}
      >
        {/* Header */}
        <Box sx={{ px: 3, py: 2.5, borderBottom: '1px solid var(--border-col)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ width: 36, height: 36, bgcolor: cfg.bg, color: cfg.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldOutlinedIcon sx={{ fontSize: '1.125rem' }} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: cfg.color, textTransform: 'uppercase', letterSpacing: '0.14em' }}>
                Confirm action · {cfg.label}
              </Typography>
              <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost', mt: 0.125 }}>
                {title}
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={onClose} disableRipple disabled={confirmed}
            sx={{ color: '#94a3b8', borderRadius: 0, '&:hover': { color: colorPalette.primary, bgcolor: 'transparent' } }}>
            <CloseRoundedIcon sx={{ fontSize: '1.25rem' }} />
          </IconButton>
        </Box>

        {/* Body */}
        <Box sx={{ px: 3, py: 3 }}>
          {confirmed ? (
            <Stack alignItems="center" gap={1.5} sx={{ py: 3 }}>
              <Box sx={{ width: 48, height: 48, borderRadius: '50%', bgcolor: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center',
                animation: 'checkPop 0.4s cubic-bezier(0.4,0,0.2,1)',
                '@keyframes checkPop': { '0%': { transform: 'scale(0.5)', opacity: 0 }, '60%': { transform: 'scale(1.1)' }, '100%': { transform: 'scale(1)', opacity: 1 } } }}>
                <CheckCircleOutlineRoundedIcon sx={{ fontSize: '1.75rem', color: '#10b981' }} />
              </Box>
              <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--heading-color)', fontFamily: 'Jost' }}>Confirmed</Typography>
            </Stack>
          ) : (
            <>
              {displayDescription && (
                <Typography sx={{ fontSize: '0.875rem', color: 'var(--on-surface-variant)', lineHeight: 1.6, mb: 2 }}>
                  {displayDescription}
                </Typography>
              )}

              {useBiometric && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: `${colorPalette.primary}08`, border: `1px solid ${colorPalette.primary}28`, px: 1.5, py: 1, mb: 2 }}>
                  <FingerprintIcon sx={{ fontSize: '1.125rem', color: colorPalette.primary, flexShrink: 0 }} />
                  <Typography sx={{ fontSize: '0.8125rem', color: colorPalette.primary, fontWeight: 600, fontFamily: 'Jost' }}>
                    Use your biometric — Touch ID or Face ID — to authorize.
                  </Typography>
                </Box>
              )}

              {biometricError && (
                <Box sx={{ bgcolor: '#fef2f2', border: '1px solid #fecaca', px: 1.5, py: 1, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <FingerprintIcon sx={{ fontSize: '1rem', color: '#dc2626', flexShrink: 0 }} />
                  <Typography sx={{ fontSize: '0.8125rem', color: '#7f1d1d' }}>
                    Biometric verification failed. Please try again.
                  </Typography>
                </Box>
              )}

              {resourceName && (
                <Box sx={{ bgcolor: 'var(--card-bg)', border: '1px solid var(--border-col)', p: 1.5, mb: 2, display: 'flex', alignItems: 'center', gap: 1.25 }}>
                  <Chip label={cfg.label.toUpperCase()} size="small" sx={{ bgcolor: cfg.bg, color: cfg.color, fontWeight: 700, fontSize: '0.625rem', letterSpacing: '0.1em', borderRadius: 0, height: 20 }} />
                  <Box sx={{ flex: 1 }}>
                    {resourceType && (
                      <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{resourceType}</Typography>
                    )}
                    <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost', mt: 0.125 }}>{resourceName}</Typography>
                  </Box>
                </Box>
              )}

              {changes && changes.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 0.875 }}>Changes</Typography>
                  <Stack gap={0.75}>
                    {changes.map((c, i) => (
                      <Box key={i} sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, alignItems: 'center' }}>
                        <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--on-surface-variant)' }}>{c.field}</Typography>
                        <Box sx={{ bgcolor: '#fef2f2', color: '#7f1d1d', px: 1, py: 0.5, fontFamily: 'SF Mono, Monaco, monospace', textDecoration: 'line-through', fontSize: '0.6875rem', textAlign: 'center' }}>{c.from}</Box>
                        <Box sx={{ bgcolor: '#f0fdf4', color: '#14532d', px: 1, py: 0.5, fontFamily: 'SF Mono, Monaco, monospace', fontSize: '0.6875rem', textAlign: 'center', fontWeight: 700 }}>{c.to}</Box>
                      </Box>
                    ))}
                  </Stack>
                </Box>
              )}

              {itemsAffected && itemsAffected.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 0.875 }}>
                    {itemsAffected.length} item{itemsAffected.length > 1 ? 's' : ''} affected
                  </Typography>
                  <Box sx={{ bgcolor: '#fef2f2', border: '1px solid #fecaca', maxHeight: 120, overflowY: 'auto' }}>
                    {itemsAffected.map((item, i) => (
                      <Typography key={i} sx={{ px: 1.5, py: 0.875, fontSize: '0.75rem', color: '#7f1d1d', fontFamily: 'SF Mono, Monaco, monospace', borderBottom: i === itemsAffected.length - 1 ? 'none' : '1px solid #fecaca' }}>
                        {item}
                      </Typography>
                    ))}
                  </Box>
                </Box>
              )}
            </>
          )}
        </Box>

        {/* Footer */}
        {!confirmed && (
          <Box sx={{ px: 3, py: 2, borderTop: '1px solid var(--border-col)', display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button onClick={onClose}
              sx={{ bgcolor: 'var(--card-bg)', color: 'var(--on-surface-variant)', border: '1px solid #e5e7eb', px: 2.25, py: 1, fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Jost', borderRadius: 0, textTransform: 'none', '&:hover': { bgcolor: 'var(--section-bg)' } }}>
              Cancel
            </Button>
            <Button onClick={handleConfirm}
              sx={{ bgcolor: cfg.color, color: '#fff', px: 2.25, py: 1, fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Jost', borderRadius: 0, textTransform: 'none', boxShadow: 'none', '&:hover': { bgcolor: cfg.color, opacity: 0.88 }, display: 'flex', alignItems: 'center', gap: 0.75 }}>
              {useBiometric && <FingerprintIcon sx={{ fontSize: '1rem' }} />}
              {useBiometric ? `Verify & ${cfg.label}` : `Confirm ${cfg.label}`}
            </Button>
          </Box>
        )}
      </Box>
    </>
  )
}
