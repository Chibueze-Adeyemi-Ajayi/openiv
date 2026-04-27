import {
  Dialog, Box, Typography, Button, CircularProgress, Alert, TextField,
} from '@mui/material'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import { useCallback, useEffect, useRef, useState } from 'react'
import { colorPalette } from '@/theme'
import { authApi } from '@/api/auth'
import { clearOnboardingState } from '@/onboarding/state'

// ── Config ────────────────────────────────────────────────────────────────────
const IDLE_MS      = 15 * 60 * 1000   // 15 min idle → show dialog
const WARNING_S    = 2 * 60           // 2 min countdown before auto-logout
const MAX_ATTEMPTS = 3

// ── Persistence keys ──────────────────────────────────────────────────────────
const STORAGE_KEY  = 'openiv_guard'     // { state, since }
const CHANNEL_NAME = 'openiv_session'   // BroadcastChannel

type GuardState = 'active' | 'warning' | 'totp'

interface StoredGuard { state: 'warning' | 'totp'; since: number }

type ChannelMsg =
  | { type: 'warning'; since: number }
  | { type: 'resumed' }
  | { type: 'logout' }

function fmt(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function readStorage(): StoredGuard | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function writeStorage(state: 'warning' | 'totp', since: number) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ state, since })) } catch { /* ignore */ }
}

function clearStorage() {
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
}

// ── TOTP digit inputs ─────────────────────────────────────────────────────────
function TotpInput({
  value, onChange, disabled,
}: {
  value: string[]
  onChange: (v: string[]) => void
  disabled?: boolean
}) {
  const handleChange = (i: number, raw: string) => {
    if (!/^\d*$/.test(raw)) return
    const next = [...value]
    next[i] = raw.slice(-1)
    onChange(next)
    if (raw && i < 5) {
      setTimeout(() => {
        const els = document.querySelectorAll<HTMLInputElement>('[data-ig-totp]')
        els[i + 1]?.focus()
      }, 0)
    }
  }
  const handleKey = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !value[i] && i > 0) {
      const els = document.querySelectorAll<HTMLInputElement>('[data-ig-totp]')
      els[i - 1]?.focus()
    }
  }
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!pasted) return
    const next = ['', '', '', '', '', '']
    pasted.split('').forEach((d, i) => (next[i] = d))
    onChange(next)
  }

  return (
    <Box sx={{ display: 'flex', gap: 1 }}>
      {value.map((digit, i) => (
        <TextField
          key={i}
          inputRef={(el) => el && el.setAttribute('data-ig-totp', 'true')}
          value={digit}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKey(i, e)}
          onPaste={handlePaste}
          disabled={disabled}
          autoFocus={i === 0}
          inputProps={{ maxLength: 1, inputMode: 'numeric' as const,
            style: { textAlign: 'center', fontSize: '1.375rem', fontWeight: 600,
              padding: '16px 0', color: '#0f172a' } }}
          sx={{
            flex: 1,
            '& .MuiOutlinedInput-root': {
              bgcolor: digit ? '#ffffff' : '#f5f3fb',
              borderRadius: 0,
              '& fieldset': {
                border: digit ? `1px solid ${colorPalette.primary}` : '1px solid transparent',
              },
              '&.Mui-focused fieldset': { borderColor: colorPalette.primary, borderWidth: '1px' },
              '&.Mui-focused': { bgcolor: '#ffffff' },
            },
          }}
        />
      ))}
    </Box>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function InactivityGuard() {
  const [guardState, setGuardState] = useState<GuardState>('active')
  const [countdown, setCountdown]   = useState(WARNING_S)
  const [digits, setDigits]         = useState(['', '', '', '', '', ''])
  const [totpError, setTotpError]   = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [attempts, setAttempts]     = useState(0)

  const idleTimer      = useRef<ReturnType<typeof setTimeout>>()
  const countdownTimer = useRef<ReturnType<typeof setInterval>>()
  const guardStateRef  = useRef<GuardState>('active')
  const channelRef     = useRef<BroadcastChannel | null>(null)

  useEffect(() => { guardStateRef.current = guardState }, [guardState])

  const doLogout = useCallback(async () => {
    clearInterval(countdownTimer.current)
    clearTimeout(idleTimer.current)
    clearStorage()
    try { await authApi.logout() } catch { /* ignore */ }
    clearOnboardingState()
    channelRef.current?.postMessage({ type: 'logout' } as ChannelMsg)
    window.location.replace('/auth/login?expired=1')
  }, [])

  // Start or restart the countdown from `remaining` seconds.
  const startCountdown = useCallback((remaining: number) => {
    clearInterval(countdownTimer.current)
    setCountdown(remaining)
    countdownTimer.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownTimer.current)
          doLogout()
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [doLogout])

  const enterWarning = useCallback((since: number) => {
    const elapsed   = Math.floor((Date.now() - since) / 1000)
    const remaining = Math.max(WARNING_S - elapsed, 1)
    writeStorage('warning', since)
    setGuardState('warning')
    startCountdown(remaining)
    channelRef.current?.postMessage({ type: 'warning', since } as ChannelMsg)
  }, [startCountdown])

  const resetIdle = useCallback(() => {
    clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(() => {
      enterWarning(Date.now())
    }, IDLE_MS)
  }, [enterWarning])

  // ── BroadcastChannel setup ─────────────────────────────────────────────────
  useEffect(() => {
    const ch = new BroadcastChannel(CHANNEL_NAME)
    channelRef.current = ch
    ch.onmessage = (evt: MessageEvent<ChannelMsg>) => {
      const msg = evt.data
      if (msg.type === 'warning' && guardStateRef.current === 'active') {
        // Another tab went into warning — mirror it here.
        const elapsed   = Math.floor((Date.now() - msg.since) / 1000)
        const remaining = Math.max(WARNING_S - elapsed, 1)
        writeStorage('warning', msg.since)
        setGuardState('warning')
        startCountdown(remaining)
      } else if (msg.type === 'resumed') {
        // Another tab verified — dismiss here too.
        clearInterval(countdownTimer.current)
        clearStorage()
        setGuardState('active')
        setDigits(['', '', '', '', '', ''])
        resetIdle()
      } else if (msg.type === 'logout') {
        window.location.replace('/auth/login?expired=1')
      }
    }
    return () => { ch.close(); channelRef.current = null }
  }, [startCountdown, resetIdle])

  // ── Restore persisted warning state on mount (survives refresh) ────────────
  useEffect(() => {
    const stored = readStorage()
    if (stored) {
      const elapsed   = Math.floor((Date.now() - stored.since) / 1000)
      const remaining = WARNING_S - elapsed
      if (remaining <= 0) {
        // Time already expired — log out immediately.
        doLogout()
      } else {
        setGuardState(stored.state)
        startCountdown(remaining)
        return // don't start idle timer — we're already in warning state
      }
    }
    // Normal boot — start idle timer.
    resetIdle()
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart']
    const handler = () => { if (guardStateRef.current === 'active') resetIdle() }
    events.forEach((e) => window.addEventListener(e, handler, { passive: true }))
    return () => {
      events.forEach((e) => window.removeEventListener(e, handler))
      clearTimeout(idleTimer.current)
      clearInterval(countdownTimer.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Activity listeners (only registered when no stored warning) ────────────
  useEffect(() => {
    if (readStorage()) return // already in warning — no activity reset
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart']
    const handler = () => { if (guardStateRef.current === 'active') resetIdle() }
    events.forEach((e) => window.addEventListener(e, handler, { passive: true }))
    return () => events.forEach((e) => window.removeEventListener(e, handler))
  }, [resetIdle])

  const handleImHere = () => {
    writeStorage('totp', (() => {
      try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}').since ?? Date.now() } catch { return Date.now() }
    })())
    setGuardState('totp')
    setDigits(['', '', '', '', '', ''])
    setTotpError(null)
  }

  const handleVerify = async () => {
    const code = digits.join('')
    if (code.length < 6) return
    setSubmitting(true)
    setTotpError(null)
    try {
      await authApi.stepUpTotp(code)
      clearInterval(countdownTimer.current)
      clearStorage()
      setGuardState('active')
      setDigits(['', '', '', '', '', ''])
      setAttempts(0)
      channelRef.current?.postMessage({ type: 'resumed' } as ChannelMsg)
      resetIdle()
    } catch {
      const next = attempts + 1
      setAttempts(next)
      if (next >= MAX_ATTEMPTS) {
        try { await authApi.stepUpLockout() } catch { /* ignore */ }
        doLogout()
      } else {
        setTotpError(
          `Invalid code — ${MAX_ATTEMPTS - next} attempt${MAX_ATTEMPTS - next === 1 ? '' : 's'} remaining.`
        )
        setDigits(['', '', '', '', '', ''])
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (guardState === 'active') return null

  return (
    <Dialog
      open
      disableEscapeKeyDown
      PaperProps={{ sx: { borderRadius: 0, width: '100%', maxWidth: 400 } }}
    >
      {/* Header */}
      <Box sx={{ px: 3, pt: 3, pb: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box sx={{ width: 36, height: 36, bgcolor: `${colorPalette.primary}0f`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <LockOutlinedIcon sx={{ fontSize: '1.125rem', color: colorPalette.primary }} />
        </Box>
        <Box>
          <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
            {guardState === 'warning' ? 'Are you still there?' : 'Confirm it\'s you'}
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>
            {guardState === 'warning'
              ? 'You\'ve been inactive for 15 minutes.'
              : 'Enter your authenticator code to resume.'}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ px: 3, pb: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {guardState === 'warning' && (
          <>
            <Typography sx={{ fontSize: '0.9375rem', color: '#475569', lineHeight: 1.6 }}>
              For security, your session will end in{' '}
              <Box component="span" sx={{ fontWeight: 700, color: '#dc2626', fontFamily: 'Jost' }}>
                {fmt(countdown)}
              </Box>
              {' '}unless you confirm your identity.
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Button
                onClick={handleImHere}
                fullWidth
                sx={{ bgcolor: colorPalette.primary, color: '#ffffff', py: 1.25,
                  fontSize: '0.875rem', fontWeight: 600, fontFamily: 'Jost', borderRadius: 0,
                  textTransform: 'none', boxShadow: 'none',
                  '&:hover': { bgcolor: '#1a3896' } }}
              >
                I'm still here
              </Button>
              <Button
                onClick={doLogout}
                sx={{ color: '#64748b', py: 1.25, fontSize: '0.875rem', fontWeight: 600,
                  fontFamily: 'Jost', borderRadius: 0, textTransform: 'none',
                  '&:hover': { bgcolor: '#f8fafc', color: '#0f172a' } }}
              >
                Sign out
              </Button>
            </Box>
          </>
        )}

        {guardState === 'totp' && (
          <>
            <TotpInput value={digits} onChange={setDigits} disabled={submitting} />
            {totpError && (
              <Alert severity="error" sx={{ borderRadius: 0, fontSize: '0.8125rem', py: 0.5 }}>
                {totpError}
              </Alert>
            )}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                Session ends in{' '}
                <Box component="span" sx={{ fontWeight: 700, color: countdown <= 30 ? '#dc2626' : '#f59e0b' }}>
                  {fmt(countdown)}
                </Box>
              </Typography>
            </Box>
            <Button
              onClick={handleVerify}
              disabled={digits.join('').length < 6 || submitting}
              fullWidth
              sx={{ bgcolor: colorPalette.primary, color: '#ffffff', py: 1.25,
                fontSize: '0.875rem', fontWeight: 600, fontFamily: 'Jost', borderRadius: 0,
                textTransform: 'none', boxShadow: 'none',
                '&:hover': { bgcolor: '#1a3896' }, '&:disabled': { bgcolor: '#94a3b8' } }}
            >
              {submitting
                ? <CircularProgress size={16} sx={{ color: '#ffffff' }} />
                : 'Verify & Continue'}
            </Button>
          </>
        )}
      </Box>
    </Dialog>
  )
}
