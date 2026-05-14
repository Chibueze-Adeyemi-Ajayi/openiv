import { Box, Typography, Button } from '@mui/material'
import { colorPalette } from '@/theme'
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

// ── Countdown hook ─────────────────────────────────────────────────────────────

function useCountdown(target: Date) {
  const [ms, setMs] = useState(() => Math.max(0, target.getTime() - Date.now()))
  useEffect(() => {
    const id = setInterval(() => setMs(Math.max(0, target.getTime() - Date.now())), 1000)
    return () => clearInterval(id)
  }, [target])
  const s = Math.floor(ms / 1000)
  return {
    days:    Math.floor(s / 86400),
    hours:   Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  }
}

// ── Flip tile ─────────────────────────────────────────────────────────────────

const TW = 68   // tile width
const TH = 88   // tile height
const TH2 = TH / 2

type FlipPhase = 'idle' | 'out' | 'in'

function FlipTile({ value, label }: { value: number; label: string }) {
  const curr = String(value).padStart(2, '0')
  const [settled, setSettled] = useState(curr)
  const [phase, setPhase]     = useState<FlipPhase>('idle')
  const incoming = useRef(curr)
  const t1 = useRef<ReturnType<typeof setTimeout>>()
  const t2 = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (curr === settled && phase === 'idle') return
    if (curr === settled) return
    incoming.current = curr
    clearTimeout(t1.current)
    clearTimeout(t2.current)
    setPhase('out')
    t1.current = setTimeout(() => setPhase('in'), 230)
    t2.current = setTimeout(() => { setSettled(curr); setPhase('idle') }, 460)
  }, [curr]) // eslint-disable-line react-hooks/exhaustive-deps

  // Number text centered in a ghost box of full TH height.
  // Clipping via overflow:hidden on each half reveals the correct portion.
  const Ghost = ({ val, offset }: { val: string; offset: number }) => (
    <Box sx={{
      position: 'absolute', top: offset, left: 0,
      width: TW, height: TH,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Typography sx={{
        fontSize: '2.75rem', fontWeight: 800, color: '#fff', lineHeight: 1,
        fontFamily: '"SF Mono","JetBrains Mono","Roboto Mono",monospace',
        userSelect: 'none', letterSpacing: '-0.04em',
      }}>
        {val}
      </Typography>
    </Box>
  )

  const next = incoming.current

  return (
    <Box sx={{ textAlign: 'center' }}>
      <Box sx={{ width: TW, height: TH, position: 'relative', perspective: '280px' }}>

        {/* ── Static upper half ── */}
        <Box sx={{
          position: 'absolute', top: 0, left: 0, right: 0, height: TH2,
          bgcolor: '#1c2333', overflow: 'hidden',
        }}>
          <Ghost val={phase === 'idle' ? settled : phase === 'out' ? settled : next} offset={0} />
        </Box>

        {/* ── Static lower half ── */}
        <Box sx={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: TH2,
          bgcolor: '#141926', overflow: 'hidden',
        }}>
          <Ghost val={phase === 'in' || phase === 'idle' ? settled : next} offset={-TH2} />
        </Box>

        {/* ── Divider ── */}
        <Box sx={{
          position: 'absolute', top: TH2 - 1, left: 0, right: 0,
          height: 2, bgcolor: '#0a0e18', zIndex: 5,
        }} />

        {/* ── Flap out: old upper half folds down (0 → -90 deg) ── */}
        {phase === 'out' && (
          <Box sx={{
            position: 'absolute', top: 0, left: 0, right: 0, height: TH2,
            bgcolor: '#1c2333', overflow: 'hidden', zIndex: 10,
            transformOrigin: 'center bottom',
            '@keyframes csoFlapOut': {
              '0%':   { transform: 'rotateX(0deg)',   boxShadow: '0 2px 8px rgba(0,0,0,0.0)' },
              '100%': { transform: 'rotateX(-90deg)', boxShadow: '0 8px 20px rgba(0,0,0,0.5)' },
            },
            animation: 'csoFlapOut 0.22s ease-in forwards',
          }}>
            <Ghost val={settled} offset={0} />
          </Box>
        )}

        {/* ── Flap in: new lower half unfolds up (90 → 0 deg) ── */}
        {phase === 'in' && (
          <Box sx={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: TH2,
            bgcolor: '#141926', overflow: 'hidden', zIndex: 10,
            transformOrigin: 'center top',
            '@keyframes csoFlapIn': {
              '0%':   { transform: 'rotateX(90deg)',  boxShadow: '0 -8px 20px rgba(0,0,0,0.5)' },
              '100%': { transform: 'rotateX(0deg)',   boxShadow: '0 -2px 8px rgba(0,0,0,0.0)' },
            },
            animation: 'csoFlapIn 0.22s ease-out forwards',
          }}>
            <Ghost val={next} offset={-TH2} />
          </Box>
        )}

      </Box>

      {/* Label */}
      <Typography sx={{
        mt: 1.25, fontSize: '0.5rem', fontWeight: 700,
        letterSpacing: '0.18em', textTransform: 'uppercase', color: '#64748b',
      }}>
        {label}
      </Typography>
    </Box>
  )
}

// ── Colon separator ────────────────────────────────────────────────────────────

function Colon() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '10px', pb: '22px', alignSelf: 'flex-end' }}>
      {[0, 1].map(i => (
        <Box key={i} sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: '#cbd5e1' }} />
      ))}
    </Box>
  )
}

// ── Props & component ─────────────────────────────────────────────────────────

interface ComingSoonOverlayProps {
  title: string
  description?: string   // kept for call-site compat but not shown
  targetDate?: Date
  fullPage?: boolean
}

const TARGET = new Date('2026-06-30T00:00:00')

export default function ComingSoonOverlay({
  title,
  targetDate = TARGET,
  fullPage = false,
}: ComingSoonOverlayProps) {
  const navigate = useNavigate()
  const { days, hours, minutes, seconds } = useCountdown(targetDate)

  return (
    <Box sx={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      ...(fullPage ? { minHeight: '100vh' } : { minHeight: '100%' }),
      zIndex: 20,
      backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
      bgcolor: 'rgba(248,250,252,0.82)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'all',
    }}>

      <Box sx={{
        bgcolor: '#ffffff',
        border: '1px solid #e2e8f0',
        boxShadow: '0 12px 56px rgba(15,23,42,0.12), 0 2px 8px rgba(15,23,42,0.06)',
        px: { xs: 3.5, sm: 5.5 }, pt: 4, pb: 4.5,
        textAlign: 'center', width: '100%', maxWidth: 480, mx: 2,
      }}>

        {/* ── Badge ── */}
        <Box sx={{
          display: 'inline-flex', alignItems: 'center', gap: 0.875,
          bgcolor: '#f0f4ff', border: '1px solid #c7d7fd',
          px: 1.5, py: 0.5, mb: 2.5,
        }}>
          <Box sx={{
            width: 6, height: 6, borderRadius: '50%', bgcolor: colorPalette.primary,
            animation: 'csoDot 2.4s ease-in-out infinite',
            '@keyframes csoDot': {
              '0%,100%': { opacity: 1, transform: 'scale(1)' },
              '50%':     { opacity: 0.35, transform: 'scale(0.65)' },
            },
          }} />
          <Typography sx={{
            fontSize: '0.625rem', fontWeight: 800, color: colorPalette.primary,
            letterSpacing: '0.18em', textTransform: 'uppercase',
          }}>
            Coming Soon
          </Typography>
        </Box>

        {/* ── Title ── */}
        <Typography sx={{
          fontSize: '1.25rem', fontWeight: 700, color: '#00288e',
          fontFamily: 'Jost', letterSpacing: '-0.01em', mb: 3.5,
        }}>
          {title}
        </Typography>

        {/* ── Flip clock ── */}
        <Box sx={{
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          gap: { xs: 1, sm: 1.75 }, mb: 3,
        }}>
          <FlipTile value={days}    label="Days" />
          <Colon />
          <FlipTile value={hours}   label="Hours" />
          <Colon />
          <FlipTile value={minutes} label="Mins" />
          <Colon />
          <FlipTile value={seconds} label="Secs" />
        </Box>

        {/* ── Expected release ── */}
        <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8', letterSpacing: '0.01em', mb: 3.5 }}>
          Expected release —{' '}
          <Box component="span" sx={{ color: '#334155', fontWeight: 600 }}>
            30 June 2026
          </Box>
        </Typography>

        <Button
          variant="contained"
          fullWidth
          onClick={() => navigate('/dashboard')}
          sx={{
            bgcolor: colorPalette.primary,
            color: '#ffffff',
            borderRadius: 0,
            textTransform: 'none',
            fontFamily: 'Jost',
            fontSize: '0.875rem',
            fontWeight: 700,
            py: 1.25,
            boxShadow: 'none',
            '&:hover': { bgcolor: '#1e293b', boxShadow: 'none' },
          }}
        >
          Continue to Dashboard
        </Button>

      </Box>
    </Box>
  )
}
