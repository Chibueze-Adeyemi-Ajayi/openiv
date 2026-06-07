import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, TextField, Stack, CircularProgress, Chip, IconButton,
} from '@mui/material'
import { useState, useEffect } from 'react'
import AddCardOutlinedIcon from '@mui/icons-material/AddCardOutlined'
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined'
import { colorPalette } from '@/theme'
import { billingApi, type PaymentMethod } from '@/api/billing'
import { authApi } from '@/api/auth'

// @ts-ignore — @paystack/inline-js ships no TypeScript declarations
import PaystackPop from '@paystack/inline-js'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: (newBalanceNgn: number) => void
  paystackPublicKey: string
}

type Step = 'amount' | 'method' | 'card' | 'challenge' | 'processing' | 'done'

const QUICK_AMOUNTS = [5_000, 10_000, 50_000, 100_000, 500_000]

// ── formatters ─────────────────────────────────────────────────────────────────

function fmtCard(v: string) {
  return v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim()
}
function fmtExpiry(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 4)
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d
}
function fmtAmount(v: string) {
  const d = v.replace(/\D/g, '')
  if (!d) return ''
  return parseInt(d, 10).toLocaleString()
}

export default function FundWalletDialog({ open, onClose, onSuccess, paystackPublicKey }: Props) {
  const [step, setStep]             = useState<Step>('amount')
  const [amountStr, setAmountStr]   = useState('')
  const [payMethod, setPayMethod]   = useState<'card' | 'paystack'>('card')
  const [methods, setMethods]       = useState<PaymentMethod[]>([])
  const [selectedCard, setSelectedCard] = useState<number | 'new'>('new')
  const [saveCard, setSaveCard]     = useState(false)
  const [userEmail, setUserEmail]   = useState('')
  const [error, setError]           = useState<string | null>(null)
  const [loading, setLoading]       = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [doneBalance, setDoneBalance] = useState(0)

  // new card form
  const [cardNumber, setCardNumber] = useState('')
  const [expiry, setExpiry]         = useState('')
  const [cvv, setCvv]               = useState('')

  // challenge
  const [challengeType, setChallengeType] = useState<'pin' | 'otp'>('pin')
  const [challengeRef, setChallengeRef]   = useState('')
  const [challengeText, setChallengeText] = useState('')
  const [challengeVal, setChallengeVal]   = useState('')

  const parsedAmount   = parseInt(amountStr.replace(/,/g, ''), 10)
  const amountValid    = !isNaN(parsedAmount) && parsedAmount >= 100
  const expiryParts    = expiry.replace('/', '').padEnd(4, '0')
  const expiryMonth    = expiryParts.slice(0, 2)
  const expiryYear     = '20' + expiryParts.slice(2, 4)
  const rawCard        = cardNumber.replace(/\s/g, '')
  const cardFormValid  = rawCard.length === 16 && expiry.length === 5 && cvv.length >= 3

  useEffect(() => {
    if (!open) return
    setStep('amount')
    setAmountStr('')
    setError(null)
    setChallengeVal('')
    setCardNumber('')
    setExpiry('')
    setCvv('')
    setSaveCard(false)
    setLoading(true)

    Promise.all([billingApi.listPaymentMethods(), authApi.session()])
      .then(([r, sess]) => {
        const ms = r.paymentMethods
        setMethods(ms)
        setUserEmail(sess.email ?? '')
        const def = ms.find(m => m.isDefault) ?? ms[0]
        setSelectedCard(def ? def.id : 'new')
        setPayMethod(ms.length > 0 ? 'card' : 'paystack')
      })
      .catch(() => { setSelectedCard('new'); setPayMethod('paystack') })
      .finally(() => setLoading(false))
  }, [open])

  // ── navigation ──────────────────────────────────────────────────────────────

  function goToMethod() {
    if (!amountValid) { setError('Enter an amount (min ₦100)'); return }
    setError(null)
    setStep('method')
  }

  function goFromMethod() {
    setError(null)
    if (payMethod === 'paystack') {
      const popup = new PaystackPop()
      popup.newTransaction({
        key: paystackPublicKey,
        email: userEmail,
        amount: parsedAmount * 100,
        currency: 'NGN',
        onSuccess: async (transaction: { reference: string }) => {
          setStep('processing')
          try {
            const result = await billingApi.verifyPayment(transaction.reference, saveCard)
            setDoneBalance(result.balanceNgn)
            setStep('done')
            onSuccess(result.balanceNgn)
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Verification failed')
            setStep('method')
          }
        },
        onCancel: () => {},
      })
    } else {
      setStep('card')
    }
  }

  // ── card actions ────────────────────────────────────────────────────────────

  async function fundWithSavedCard() {
    if (typeof selectedCard !== 'number') return
    setError(null)
    setStep('processing')
    try {
      const result = await billingApi.topup(selectedCard, parsedAmount, userEmail)
      setDoneBalance(result.balanceNgn)
      setStep('done')
      onSuccess(result.balanceNgn)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Charge failed')
      setStep('card')
    }
  }

  async function fundWithNewCard() {
    if (!cardFormValid) { setError('Please fill in all card details'); return }
    setError(null)
    setStep('processing')
    try {
      const res = await billingApi.chargeCard({
        cardNumber, cvv, expiryMonth, expiryYear,
        amountNgn: parsedAmount, email: userEmail, saveCard,
      })
      handleChargeResponse(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Card charge failed')
      setStep('card')
    }
  }

  async function submitChallenge() {
    if (!challengeVal.trim()) return
    setError(null)
    setStep('processing')
    try {
      const res = await billingApi.submitChallenge({
        reference: challengeRef, type: challengeType,
        value: challengeVal, amountNgn: parsedAmount, email: userEmail, saveCard,
      })
      handleChargeResponse(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed')
      setStep('challenge')
    }
  }

  function handleChargeResponse(res: Awaited<ReturnType<typeof billingApi.chargeCard>>) {
    if (res.status === 'success') {
      if (res.balanceNgn != null) { setDoneBalance(res.balanceNgn); onSuccess(res.balanceNgn) }
      setStep('done')
    } else if (res.status === 'send_pin' || res.status === 'send_otp') {
      setChallengeType(res.status === 'send_pin' ? 'pin' : 'otp')
      setChallengeRef(res.reference ?? '')
      setChallengeText(res.displayText ?? '')
      setChallengeVal('')
      setStep('challenge')
    } else if (res.status === 'open_url' && res.displayText) {
      window.open(res.displayText, '_blank')
      setError('Complete 3D-Secure verification in the new tab, then try again.')
      setStep('card')
    }
  }

  async function deleteMethod(id: number, e: React.MouseEvent) {
    e.stopPropagation()
    setDeletingId(id)
    try {
      await billingApi.deletePaymentMethod(id)
      setMethods(prev => prev.filter(m => m.id !== id))
      if (selectedCard === id) setSelectedCard('new')
    } catch { /* ignore */ }
    finally { setDeletingId(null) }
  }

  function handleClose() {
    if (step === 'processing') return
    onClose()
  }

  const titleMap: Record<Step, string> = {
    amount: 'Fund Wallet',
    method: 'Payment method',
    card: 'Fund with card',
    challenge: 'Security check',
    processing: 'Fund Wallet',
    done: 'Fund Wallet',
  }

  const prevStep: Partial<Record<Step, Step>> = {
    method: 'amount',
    card: 'method',
    challenge: 'card',
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth
      PaperProps={{ sx: { borderRadius: 0, border: '1px solid var(--border-col)' } }}>

      <DialogTitle sx={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'Jost', color: 'var(--heading-color)', pb: 1.5, borderBottom: '1px solid var(--border-col)', display: 'flex', alignItems: 'center', gap: 1 }}>
        {prevStep[step] && (
          <Box
            component="span"
            onClick={() => { setError(null); setStep(prevStep[step]!) }}
            sx={{ fontSize: '1rem', color: '#94a3b8', cursor: 'pointer', mr: 0.25, lineHeight: 1, '&:hover': { color: 'var(--on-surface-variant)' } }}
          >
            ←
          </Box>
        )}
        {titleMap[step]}
      </DialogTitle>

      <DialogContent sx={{ pt: 2.5, pb: 1 }}>

        {/* ── DONE ── */}
        {step === 'done' ? (
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <CheckCircleOutlineRoundedIcon sx={{ fontSize: '3rem', color: '#10b981', mb: 1.5 }} />
            <Typography sx={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost', mb: 0.5 }}>
              Wallet funded!
            </Typography>
            <Typography sx={{ fontSize: '0.875rem', color: '#64748b' }}>
              New balance:{' '}
              <strong style={{ color: 'var(--heading-color)' }}>₦{doneBalance.toLocaleString()}</strong>
            </Typography>
          </Box>

        /* ── PROCESSING ── */
        ) : step === 'processing' ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 3, gap: 2 }}>
            <CircularProgress size={40} sx={{ color: colorPalette.primary }} />
            <Typography sx={{ fontSize: '0.875rem', color: '#64748b' }}>Processing payment…</Typography>
          </Box>

        /* ── AMOUNT ── */
        ) : step === 'amount' ? (
          loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={28} sx={{ color: colorPalette.primary }} />
            </Box>
          ) : (
            <Stack gap={2.5}>
              <Box>
                <Typography sx={labelSx}>Amount (₦)</Typography>
                <TextField
                  fullWidth autoFocus
                  placeholder="e.g. 50,000"
                  value={amountStr}
                  onChange={e => setAmountStr(fmtAmount(e.target.value))}
                  onKeyDown={e => e.key === 'Enter' && goToMethod()}
                  size="small"
                  InputProps={{
                    startAdornment: <Typography sx={{ mr: 0.75, color: '#94a3b8', fontWeight: 700 }}>₦</Typography>,
                    sx: { borderRadius: 0, fontSize: '1.375rem', fontWeight: 700 },
                  }}
                />
                <Stack direction="row" gap={0.75} sx={{ mt: 1.25, flexWrap: 'wrap' }}>
                  {QUICK_AMOUNTS.map(a => (
                    <Chip
                      key={a}
                      label={`₦${a.toLocaleString()}`}
                      size="small"
                      onClick={() => setAmountStr(a.toLocaleString())}
                      sx={{
                        borderRadius: 0, fontSize: '0.6875rem', fontWeight: 600, cursor: 'pointer',
                        bgcolor: parsedAmount === a ? colorPalette.primary : '#f1f5f9',
                        color:   parsedAmount === a ? '#fff' : '#475569',
                        '&:hover': { bgcolor: parsedAmount === a ? colorPalette.primary : '#e2e8f0' },
                      }}
                    />
                  ))}
                </Stack>
              </Box>
              {error && <Typography sx={{ fontSize: '0.8125rem', color: '#dc2626', fontWeight: 500 }}>{error}</Typography>}
            </Stack>
          )

        /* ── METHOD ── */
        ) : step === 'method' ? (
          <Stack gap={1.5}>
            <Typography sx={{ fontSize: '0.8125rem', color: '#64748b', mb: 0.5 }}>
              Funding{' '}
              <strong style={{ color: 'var(--heading-color)' }}>₦{parsedAmount.toLocaleString()}</strong>
              {' '}— choose how to pay:
            </Typography>

            <Box onClick={() => setPayMethod('card')} sx={methodOptionSx(payMethod === 'card')}>
              <RadioDot active={payMethod === 'card'} />
              <CreditCardOutlinedIcon sx={{ fontSize: '1.375rem', color: payMethod === 'card' ? colorPalette.primary : '#64748b', flexShrink: 0 }} />
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--heading-color)', lineHeight: 1.3 }}>
                  Debit card
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8', mt: 0.25 }}>
                  {methods.length > 0
                    ? `${methods.length} saved card${methods.length > 1 ? 's' : ''} available`
                    : 'Enter card details for direct charge'}
                </Typography>
              </Box>
            </Box>

            <Box onClick={() => setPayMethod('paystack')} sx={methodOptionSx(payMethod === 'paystack')}>
              <RadioDot active={payMethod === 'paystack'} />
              <PaymentsOutlinedIcon sx={{ fontSize: '1.375rem', color: payMethod === 'paystack' ? colorPalette.primary : '#64748b', flexShrink: 0 }} />
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--heading-color)', lineHeight: 1.3 }}>
                  Paystack checkout
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8', mt: 0.25 }}>
                  Secure popup · card, bank transfer &amp; USSD
                </Typography>
              </Box>
            </Box>

            {error && <Typography sx={{ fontSize: '0.8125rem', color: '#dc2626', fontWeight: 500 }}>{error}</Typography>}
          </Stack>

        /* ── CARD ── */
        ) : step === 'card' ? (
          <Stack gap={2}>
            <Typography sx={{ fontSize: '0.8125rem', color: '#64748b' }}>
              Charging{' '}
              <strong style={{ color: 'var(--heading-color)' }}>₦{parsedAmount.toLocaleString()}</strong>
            </Typography>

            {methods.length > 0 && (
              <Stack gap={0.75}>
                <Typography sx={labelSx}>Saved cards</Typography>
                {methods.map(m => (
                  <Box key={m.id} onClick={() => setSelectedCard(m.id)} sx={cardOptionSx(selectedCard === m.id)}>
                    <RadioDot active={selectedCard === m.id} />
                    <CreditCardOutlinedIcon sx={{ fontSize: '1.125rem', color: selectedCard === m.id ? colorPalette.primary : '#64748b', flexShrink: 0 }} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--heading-color)', lineHeight: 1.3 }}>
                        {m.displayName}
                        {m.isDefault && (
                          <Typography component="span" sx={{ ml: 1, fontSize: '0.625rem', fontWeight: 700, color: colorPalette.primary, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            default
                          </Typography>
                        )}
                      </Typography>
                      {m.last4 && (
                        <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', fontFamily: 'SF Mono, Monaco, monospace' }}>
                          ···· {m.last4}
                        </Typography>
                      )}
                    </Box>
                    <IconButton size="small" disabled={deletingId === m.id} onClick={e => deleteMethod(m.id, e)}
                      sx={{ borderRadius: 0, p: 0.5, color: '#cbd5e1', '&:hover': { color: '#dc2626', bgcolor: 'transparent' } }}>
                      {deletingId === m.id
                        ? <CircularProgress size={12} sx={{ color: '#94a3b8' }} />
                        : <DeleteOutlineRoundedIcon sx={{ fontSize: '1rem' }} />}
                    </IconButton>
                  </Box>
                ))}
              </Stack>
            )}

            {/* New card toggle row */}
            {methods.length > 0 && (
              <Box onClick={() => setSelectedCard('new')} sx={cardOptionSx(selectedCard === 'new')}>
                <RadioDot active={selectedCard === 'new'} />
                <AddCardOutlinedIcon sx={{ fontSize: '1.125rem', color: selectedCard === 'new' ? colorPalette.primary : '#64748b', flexShrink: 0 }} />
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--heading-color)' }}>Enter new card</Typography>
                  <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8' }}>Direct charge</Typography>
                </Box>
              </Box>
            )}

            {/* New card form — visible when new is selected */}
            {selectedCard === 'new' && (
              <Stack gap={2} sx={{ pt: methods.length > 0 ? 0.5 : 0 }}>
                <Box>
                  <Typography sx={labelSx}>Card number</Typography>
                  <TextField fullWidth autoFocus={methods.length === 0}
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
                    <Typography sx={labelSx}>Expiry</Typography>
                    <TextField fullWidth placeholder="MM/YY"
                      value={expiry}
                      onChange={e => setExpiry(fmtExpiry(e.target.value))}
                      size="small"
                      inputProps={{ inputMode: 'numeric', maxLength: 5 }}
                      sx={fieldSx}
                    />
                  </Box>
                  <Box>
                    <Typography sx={labelSx}>CVV</Typography>
                    <TextField fullWidth placeholder="•••"
                      value={cvv}
                      onChange={e => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      size="small" type="password"
                      inputProps={{ inputMode: 'numeric', maxLength: 4 }}
                      sx={fieldSx}
                    />
                  </Box>
                </Box>
                <Box onClick={() => setSaveCard(v => !v)} sx={{ display: 'flex', alignItems: 'center', gap: 1.25, cursor: 'pointer', userSelect: 'none' }}>
                  <Box sx={{ width: 14, height: 14, flexShrink: 0, border: '2px solid', borderColor: saveCard ? colorPalette.primary : '#cbd5e1', bgcolor: saveCard ? colorPalette.primary : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {saveCard && <Box sx={{ width: 6, height: 6, bgcolor: '#fff' }} />}
                  </Box>
                  <Typography sx={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)' }}>Save card for future top-ups</Typography>
                </Box>
              </Stack>
            )}

            {error && <Typography sx={{ fontSize: '0.8125rem', color: '#dc2626', fontWeight: 500 }}>{error}</Typography>}
          </Stack>

        /* ── CHALLENGE ── */
        ) : step === 'challenge' ? (
          <Stack gap={2.5}>
            <Box sx={{ bgcolor: '#f0f9ff', border: '1px solid #bae6fd', p: 1.75 }}>
              <Typography sx={{ fontSize: '0.8125rem', color: '#0369a1', fontWeight: 500, lineHeight: 1.55 }}>
                {challengeText || (challengeType === 'pin' ? 'Enter your card PIN to complete this transaction' : 'Enter the OTP sent to your registered number')}
              </Typography>
            </Box>
            <Box>
              <Typography sx={labelSx}>{challengeType === 'pin' ? 'Card PIN' : 'One-time password'}</Typography>
              <TextField
                fullWidth autoFocus
                type="password"
                inputProps={{ maxLength: challengeType === 'pin' ? 4 : 8, inputMode: 'numeric', style: { letterSpacing: '0.3em', fontFamily: 'SF Mono, Monaco, monospace', fontSize: '1.25rem' } }}
                placeholder={challengeType === 'pin' ? '••••' : '••••••'}
                value={challengeVal}
                onChange={e => setChallengeVal(e.target.value.replace(/\D/g, ''))}
                onKeyDown={e => e.key === 'Enter' && submitChallenge()}
                size="small"
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 0 } }}
              />
            </Box>
            {error && <Typography sx={{ fontSize: '0.8125rem', color: '#dc2626', fontWeight: 500 }}>{error}</Typography>}
          </Stack>

        ) : null}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid var(--border-col)', gap: 1 }}>
        {step === 'done' ? (
          <Button fullWidth onClick={handleClose} sx={primaryBtn}>Done</Button>

        ) : step === 'amount' && !loading ? (
          <>
            <Button onClick={handleClose} sx={cancelBtn}>Cancel</Button>
            <Button onClick={goToMethod} disabled={!amountValid} sx={{ ...primaryBtn, flex: 1 }}>
              Next →
            </Button>
          </>

        ) : step === 'method' ? (
          <>
            <Button onClick={() => { setError(null); setStep('amount') }} sx={cancelBtn}>Back</Button>
            <Button onClick={goFromMethod} sx={{ ...primaryBtn, flex: 1 }}>Continue</Button>
          </>

        ) : step === 'card' ? (
          <>
            <Button onClick={() => { setError(null); setStep('method') }} sx={cancelBtn}>Back</Button>
            <Button
              onClick={selectedCard === 'new' ? fundWithNewCard : fundWithSavedCard}
              disabled={selectedCard === 'new' ? !cardFormValid : false}
              sx={{ ...primaryBtn, flex: 1 }}
            >
              Fund ₦{amountValid ? parsedAmount.toLocaleString() : '—'}
            </Button>
          </>

        ) : step === 'challenge' ? (
          <>
            <Button onClick={() => { setError(null); setStep('card') }} sx={cancelBtn}>Back</Button>
            <Button onClick={submitChallenge} disabled={!challengeVal.trim()} sx={{ ...primaryBtn, flex: 1 }}>
              Confirm
            </Button>
          </>

        ) : null}
      </DialogActions>
    </Dialog>
  )
}

// ── sub-components ────────────────────────────────────────────────────────────

function RadioDot({ active }: { active: boolean }) {
  return (
    <Box sx={{ width: 16, height: 16, borderRadius: '50%', flexShrink: 0, border: '2px solid', borderColor: active ? colorPalette.primary : '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {active && <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: colorPalette.primary }} />}
    </Box>
  )
}

// ── styles ────────────────────────────────────────────────────────────────────

const methodOptionSx = (active: boolean) => ({
  display: 'flex', alignItems: 'center', gap: 1.5, p: 2,
  border: '1.5px solid', borderColor: active ? colorPalette.primary : '#e2e8f0',
  bgcolor: active ? `${colorPalette.primary}06` : '#fff',
  cursor: 'pointer', transition: 'border-color 0.15s, background-color 0.15s',
  '&:hover': { borderColor: active ? colorPalette.primary : '#c7d0e0' },
} as const)

const cardOptionSx = (active: boolean) => ({
  display: 'flex', alignItems: 'center', gap: 1.25, p: 1.5,
  border: '1.5px solid', borderColor: active ? colorPalette.primary : '#e2e8f0',
  bgcolor: active ? `${colorPalette.primary}06` : '#fff',
  cursor: 'pointer', transition: 'border-color 0.15s, background-color 0.15s',
  '&:hover': { borderColor: active ? colorPalette.primary : '#c7d0e0' },
} as const)

const labelSx = { fontSize: '0.6875rem', fontWeight: 700, color: 'var(--on-surface-variant)', mb: 0.75, textTransform: 'uppercase' as const, letterSpacing: '0.08em' }
const fieldSx = { '& .MuiOutlinedInput-root': { borderRadius: 0, fontSize: '0.9375rem', fontWeight: 600 } }
const primaryBtn = { borderRadius: 0, fontFamily: 'Jost', fontWeight: 700, textTransform: 'none' as const, bgcolor: colorPalette.primary, color: '#fff', boxShadow: 'none', py: 1.125, '&:hover': { bgcolor: 'var(--on-surface)' }, '&:disabled': { bgcolor: '#e2e8f0', color: '#94a3b8' } }
const cancelBtn  = { borderRadius: 0, fontFamily: 'Jost', fontWeight: 600, textTransform: 'none' as const, color: '#64748b', border: '1px solid #e5e7eb', px: 2.5, py: 1.125, '&:hover': { bgcolor: 'var(--section-bg)' } }
