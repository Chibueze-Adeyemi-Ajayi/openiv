import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, TextField, Stack, CircularProgress,
} from '@mui/material'
import { useState, useEffect } from 'react'
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined'
import { colorPalette } from '@/theme'
import { billingApi, type PaymentMethod } from '@/api/billing'
import { authApi } from '@/api/auth'

interface Props {
  open: boolean
  onClose: () => void
  onCardAdded: (method: PaymentMethod) => void
}

type Step = 'form' | 'challenge' | 'processing' | 'done'

// ── formatters ────────────────────────────────────────────────────────────────

function fmtCard(v: string) {
  return v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim()
}
function fmtExpiry(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 4)
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d
}
function cardBrand(num: string): 'visa' | 'mastercard' | null {
  const d = num.replace(/\s/g, '')
  if (/^4/.test(d)) return 'visa'
  if (/^5[1-5]/.test(d) || /^2[2-7]/.test(d)) return 'mastercard'
  return null
}

export default function AddCardDialog({ open, onClose, onCardAdded }: Props) {
  const [step, setStep]           = useState<Step>('form')
  const [cardNumber, setCardNumber] = useState('')
  const [expiry, setExpiry]       = useState('')
  const [cvv, setCvv]             = useState('')
  const [email, setEmail]         = useState('')
  const [error, setError]         = useState<string | null>(null)

  // challenge
  const [challengeType, setChallengeType] = useState<'pin' | 'otp'>('pin')
  const [challengeRef, setChallengeRef]   = useState('')
  const [challengeText, setChallengeText] = useState('')
  const [challengeVal, setChallengeVal]   = useState('')

  // result
  const [savedCard, setSavedCard] = useState<PaymentMethod | null>(null)

  useEffect(() => {
    if (!open) return
    setStep('form')
    setCardNumber(''); setExpiry(''); setCvv(''); setError(null); setChallengeVal('')
    authApi.session().then(s => setEmail(s.email ?? '')).catch(() => {})
  }, [open])

  const expiryParts  = expiry.replace('/', '').padEnd(4, '0')
  const expiryMonth  = expiryParts.slice(0, 2)
  const expiryYear   = '20' + expiryParts.slice(2, 4)
  const rawCard      = cardNumber.replace(/\s/g, '')
  const formValid    = rawCard.length === 16 && expiry.length === 5 && cvv.length >= 3

  async function handleSubmit() {
    if (!formValid) { setError('Please fill in all card details'); return }
    setError(null)
    setStep('processing')
    try {
      const res = await billingApi.chargeCard({
        cardNumber, cvv, expiryMonth, expiryYear,
        amountNgn: 100,   // ₦100 verification charge goes into wallet
        email, saveCard: true,
      })
      handleResponse(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Card charge failed')
      setStep('form')
    }
  }

  async function handleChallenge() {
    if (!challengeVal.trim()) return
    setError(null)
    setStep('processing')
    try {
      const res = await billingApi.submitChallenge({
        reference: challengeRef, type: challengeType,
        value: challengeVal, amountNgn: 100, email, saveCard: true,
      })
      handleResponse(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed')
      setStep('challenge')
    }
  }

  function handleResponse(res: Awaited<ReturnType<typeof billingApi.chargeCard>>) {
    if (res.status === 'success') {
      if (res.paymentMethod) setSavedCard(res.paymentMethod as PaymentMethod)
      setStep('done')
    } else if (res.status === 'send_pin' || res.status === 'send_otp') {
      setChallengeType(res.status === 'send_pin' ? 'pin' : 'otp')
      setChallengeRef(res.reference ?? '')
      setChallengeText(res.displayText ?? '')
      setChallengeVal('')
      setStep('challenge')
    } else if (res.status === 'open_url' && res.displayText) {
      window.open(res.displayText, '_blank')
      setError('Complete the 3D-Secure verification in the new tab, then try again.')
      setStep('form')
    }
  }

  function handleClose() {
    if (step === 'processing') return
    if (step === 'done' && savedCard) onCardAdded(savedCard)
    onClose()
  }

  const brand = cardBrand(cardNumber)

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth
      PaperProps={{ sx: { borderRadius: 0, border: '1px solid var(--border-col)' } }}>
      <DialogTitle sx={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'Jost', color: 'var(--heading-color)', pb: 1.5, borderBottom: '1px solid var(--border-col)' }}>
        Add payment card
      </DialogTitle>

      <DialogContent sx={{ pt: 2.5, pb: 1 }}>
        {step === 'done' ? (
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <CheckCircleOutlineRoundedIcon sx={{ fontSize: '3rem', color: '#10b981', mb: 1.5 }} />
            <Typography sx={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost', mb: 0.5 }}>
              Card added!
            </Typography>
            <Typography sx={{ fontSize: '0.875rem', color: '#64748b' }}>
              {savedCard?.displayName ?? 'Your card'} has been saved.<br />
              ₦100 verification charge added to your wallet.
            </Typography>
          </Box>

        ) : step === 'processing' ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 3, gap: 2 }}>
            <CircularProgress size={40} sx={{ color: colorPalette.primary }} />
            <Typography sx={{ fontSize: '0.875rem', color: '#64748b' }}>Verifying card…</Typography>
          </Box>

        ) : step === 'challenge' ? (
          <Stack gap={2.5}>
            <Box sx={{ bgcolor: '#f0f9ff', border: '1px solid #bae6fd', p: 1.75 }}>
              <Typography sx={{ fontSize: '0.8125rem', color: '#0369a1', fontWeight: 500, lineHeight: 1.55 }}>
                {challengeText || (challengeType === 'pin' ? 'Enter your card PIN' : 'Enter the OTP sent to your number')}
              </Typography>
            </Box>
            <Box>
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--on-surface-variant)', mb: 0.75, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {challengeType === 'pin' ? 'Card PIN' : 'One-time password'}
              </Typography>
              <TextField
                fullWidth autoFocus
                type="password"
                inputProps={{ maxLength: challengeType === 'pin' ? 4 : 8, inputMode: 'numeric', style: { letterSpacing: '0.3em', fontFamily: 'SF Mono, Monaco, monospace', fontSize: '1.25rem' } }}
                placeholder={challengeType === 'pin' ? '••••' : '••••••'}
                value={challengeVal}
                onChange={e => setChallengeVal(e.target.value.replace(/\D/g, ''))}
                onKeyDown={e => e.key === 'Enter' && handleChallenge()}
                size="small"
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 0 } }}
              />
            </Box>
            {error && <Typography sx={{ fontSize: '0.8125rem', color: '#dc2626', fontWeight: 500 }}>{error}</Typography>}
          </Stack>

        ) : (
          <Stack gap={2.5}>
            {/* ── Visual card preview ── */}
            <Box sx={{
              width: '100%', aspectRatio: '1.7',
              background: 'linear-gradient(135deg, #00288e 0%, #2563eb 60%, #3b82f6 100%)',
              p: 2.25, color: '#fff', position: 'relative', overflow: 'hidden', userSelect: 'none',
            }}>
              <Box sx={{ position: 'absolute', top: -30, right: -30, width: 130, height: 130, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.06)' }} />
              <Box sx={{ position: 'absolute', bottom: -40, left: -20, width: 160, height: 160, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.04)' }} />
              {/* Network */}
              <Box sx={{ position: 'absolute', top: 16, right: 18, zIndex: 1 }}>
                {brand === 'visa' && (
                  <Typography sx={{ fontSize: '1.125rem', fontWeight: 900, fontStyle: 'italic', letterSpacing: '-0.02em', opacity: 0.9 }}>VISA</Typography>
                )}
                {brand === 'mastercard' && (
                  <Box sx={{ display: 'flex', gap: '-6px' }}>
                    <Box sx={{ width: 22, height: 22, borderRadius: '50%', bgcolor: '#eb001b', opacity: 0.9 }} />
                    <Box sx={{ width: 22, height: 22, borderRadius: '50%', bgcolor: '#f79e1b', ml: '-8px', opacity: 0.9 }} />
                  </Box>
                )}
                {!brand && <CreditCardOutlinedIcon sx={{ fontSize: '1.5rem', opacity: 0.6 }} />}
              </Box>
              {/* Chip */}
              <Box sx={{ width: 32, height: 24, bgcolor: 'rgba(255,215,0,0.7)', borderRadius: '4px', mb: 2, mt: 1, zIndex: 1, position: 'relative' }} />
              {/* Card number */}
              <Typography sx={{ fontSize: '1.0625rem', fontFamily: 'SF Mono, Monaco, monospace', letterSpacing: '0.18em', mb: 1.25, zIndex: 1, position: 'relative', opacity: rawCard.length > 0 ? 1 : 0.4 }}>
                {(cardNumber || '•••• •••• •••• ••••').padEnd(19, ' ')}
              </Typography>
              {/* Expiry */}
              <Box sx={{ display: 'flex', gap: 3, zIndex: 1, position: 'relative' }}>
                <Box>
                  <Typography sx={{ fontSize: '0.5rem', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Expires</Typography>
                  <Typography sx={{ fontSize: '0.8125rem', fontFamily: 'SF Mono, Monaco, monospace', opacity: expiry ? 1 : 0.4 }}>
                    {expiry || 'MM/YY'}
                  </Typography>
                </Box>
                <Box>
                  <Typography sx={{ fontSize: '0.5rem', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.12em' }}>CVV</Typography>
                  <Typography sx={{ fontSize: '0.8125rem', fontFamily: 'SF Mono, Monaco, monospace', opacity: cvv ? 1 : 0.4 }}>
                    {'•'.repeat(cvv.length) || '•••'}
                  </Typography>
                </Box>
              </Box>
            </Box>

            {/* ── Card fields ── */}
            <Box>
              <Typography sx={labelSx}>Card number</Typography>
              <TextField
                fullWidth autoFocus
                placeholder="1234 5678 9012 3456"
                value={cardNumber}
                onChange={e => setCardNumber(fmtCard(e.target.value))}
                size="small"
                inputProps={{ inputMode: 'numeric', maxLength: 19 }}
                sx={fieldSx}
              />
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
              <Box>
                <Typography sx={labelSx}>Expiry date</Typography>
                <TextField
                  fullWidth placeholder="MM/YY"
                  value={expiry}
                  onChange={e => setExpiry(fmtExpiry(e.target.value))}
                  size="small"
                  inputProps={{ inputMode: 'numeric', maxLength: 5 }}
                  sx={fieldSx}
                />
              </Box>
              <Box>
                <Typography sx={labelSx}>CVV</Typography>
                <TextField
                  fullWidth placeholder="•••"
                  value={cvv}
                  onChange={e => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  size="small" type="password"
                  inputProps={{ inputMode: 'numeric', maxLength: 4 }}
                  sx={fieldSx}
                />
              </Box>
            </Box>

            <Box sx={{ bgcolor: 'var(--section-bg)', border: '1px solid var(--border-col)', p: 1.5, display: 'flex', alignItems: 'flex-start', gap: 1 }}>
              <Typography sx={{ fontSize: '0.875rem' }}>🔒</Typography>
              <Typography sx={{ fontSize: '0.75rem', color: '#64748b', lineHeight: 1.55 }}>
                A <strong>₦100</strong> verification charge is added to your wallet balance. Your card details are processed securely by Paystack — we never store raw card data.
              </Typography>
            </Box>

            {error && <Typography sx={{ fontSize: '0.8125rem', color: '#dc2626', fontWeight: 500 }}>{error}</Typography>}
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid var(--border-col)', gap: 1 }}>
        {step === 'done' ? (
          <Button fullWidth onClick={handleClose} sx={primaryBtn}>Done</Button>
        ) : step === 'form' ? (
          <>
            <Button onClick={handleClose} sx={cancelBtn}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!formValid} sx={{ ...primaryBtn, flex: 1 }}>
              Add card
            </Button>
          </>
        ) : step === 'challenge' ? (
          <>
            <Button onClick={() => { setStep('form'); setError(null) }} sx={cancelBtn}>Back</Button>
            <Button onClick={handleChallenge} disabled={!challengeVal.trim()} sx={{ ...primaryBtn, flex: 1 }}>
              Confirm
            </Button>
          </>
        ) : null}
      </DialogActions>
    </Dialog>
  )
}

// ── styles ────────────────────────────────────────────────────────────────────

const labelSx = { fontSize: '0.6875rem', fontWeight: 700, color: 'var(--on-surface-variant)', mb: 0.75, textTransform: 'uppercase' as const, letterSpacing: '0.08em' }
const fieldSx = { '& .MuiOutlinedInput-root': { borderRadius: 0, fontSize: '0.9375rem', fontWeight: 600 } }
const primaryBtn = { borderRadius: 0, fontFamily: 'Jost', fontWeight: 700, textTransform: 'none' as const, bgcolor: colorPalette.primary, color: '#fff', boxShadow: 'none', py: 1.125, '&:hover': { bgcolor: 'var(--on-surface)' }, '&:disabled': { bgcolor: '#e2e8f0', color: '#94a3b8' } }
const cancelBtn  = { borderRadius: 0, fontFamily: 'Jost', fontWeight: 600, textTransform: 'none' as const, color: '#64748b', border: '1px solid #e5e7eb', px: 2.5, py: 1.125, '&:hover': { bgcolor: 'var(--section-bg)' } }
