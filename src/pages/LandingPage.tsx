import { useEffect, useState } from 'react'
import { usePageAnalytics } from '@/hooks/usePageAnalytics'
import { Box, Typography, Stack } from '@mui/material'
import { useSEO } from '@/hooks/useSEO'

const C = {
  ink:     '#0f1929',
  primary: '#00288e',
  lime:    '#d9f99d',
  white:   '#ffffff',
} as const

const MONO = 'JetBrains Mono, monospace'
const FONT = 'Jost, sans-serif'

// ── Confetti particle ────────────────────────────────────────────────────────
const COLORS = ['#d9f99d', '#facc15', '#f472b6', '#38bdf8', '#fb923c', '#a78bfa', '#ffffff']

function Confetti() {
  const particles = Array.from({ length: 72 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 3,
    duration: 3 + Math.random() * 4,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    size: 6 + Math.random() * 8,
    rotate: Math.random() * 360,
    drift: (Math.random() - 0.5) * 120,
    shape: Math.random() > 0.5 ? 'circle' : 'rect',
  }))

  return (
    <Box aria-hidden sx={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 10, overflow: 'hidden' }}>
      {particles.map(p => (
        <Box
          key={p.id}
          sx={{
            position: 'absolute',
            left: `${p.x}%`,
            top: '-20px',
            width: p.size,
            height: p.shape === 'rect' ? p.size * 0.4 : p.size,
            bgcolor: p.color,
            borderRadius: p.shape === 'circle' ? '50%' : '2px',
            opacity: 0,
            animation: `confettiFall ${p.duration}s ${p.delay}s ease-in infinite`,
            '@keyframes confettiFall': {
              '0%':   { opacity: 1, transform: `translateY(0px) translateX(0px) rotate(${p.rotate}deg)` },
              '100%': { opacity: 0, transform: `translateY(110vh) translateX(${p.drift}px) rotate(${p.rotate + 540}deg)` },
            },
          }}
        />
      ))}
    </Box>
  )
}

// ── Floating celebration card ────────────────────────────────────────────────
function CelebCard({ emoji, title, sub, delay }: { emoji: string; title: string; sub: string; delay: number }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay)
    return () => clearTimeout(t)
  }, [delay])

  return (
    <Box sx={{
      bgcolor: 'rgba(255,255,255,0.10)',
      border: '1px solid rgba(255,255,255,0.18)',
      borderRadius: '14px',
      px: 2.5, py: 2,
      backdropFilter: 'blur(12px)',
      textAlign: 'center',
      minWidth: 130,
      flex: '1 1 130px',
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(20px)',
      transition: `opacity 0.55s ease, transform 0.55s ease`,
      animation: visible ? 'cardFloat 4s ease-in-out infinite' : 'none',
      '@keyframes cardFloat': {
        '0%, 100%': { transform: 'translateY(0px)' },
        '50%':      { transform: 'translateY(-6px)' },
      },
    }}>
      <Typography sx={{ fontSize: '1.75rem', lineHeight: 1, mb: 0.75 }}>{emoji}</Typography>
      <Typography sx={{ fontFamily: FONT, fontWeight: 700, fontSize: '0.82rem', color: C.white, letterSpacing: '-0.01em' }}>
        {title}
      </Typography>
      <Typography sx={{ fontFamily: MONO, fontSize: '0.65rem', color: 'rgba(255,255,255,0.55)', mt: 0.25 }}>
        {sub}
      </Typography>
    </Box>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function LandingPage() {
  usePageAnalytics('/')
  useSEO({
    title: 'Jilo Intelligence — We\'ve Rebranded',
    description: 'OpenIV is now Jilo Intelligence. Visit jilointelligence.com.',
    canonical: '/',
  })

  const [show, setShow] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 80)
    return () => clearTimeout(t)
  }, [])

  return (
    <Box sx={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: `radial-gradient(140% 120% at 50% -10%, #0a3bb0 0%, ${C.primary} 45%, #001b5e 100%)`,
      fontFamily: FONT, position: 'relative', overflow: 'hidden', px: 2,
    }}>
      {/* Engineering grid bg */}
      <Box aria-hidden sx={{
        position: 'absolute', inset: 0, zIndex: 0,
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
        backgroundSize: '52px 52px',
        maskImage: 'radial-gradient(100% 100% at 50% 50%, #000 0%, transparent 80%)',
        WebkitMaskImage: 'radial-gradient(100% 100% at 50% 50%, #000 0%, transparent 80%)',
      }} />

      {/* Glow accents */}
      <Box aria-hidden sx={{ position: 'absolute', top: '-15%', left: '-10%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(217,249,157,0.14) 0%, transparent 70%)', zIndex: 0 }} />
      <Box aria-hidden sx={{ position: 'absolute', bottom: '-15%', right: '-10%', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(56,189,248,0.12) 0%, transparent 70%)', zIndex: 0 }} />

      <Confetti />

      {/* Main card */}
      <Box sx={{
        position: 'relative', zIndex: 20,
        maxWidth: 620, width: '100%', textAlign: 'center',
        opacity: show ? 1 : 0,
        transform: show ? 'scale(1) translateY(0)' : 'scale(0.94) translateY(24px)',
        transition: 'opacity 0.65s ease, transform 0.65s ease',
      }}>
        {/* Big celebration emoji */}
        <Typography sx={{
          fontSize: 'clamp(3.5rem, 10vw, 5.5rem)', lineHeight: 1, mb: 2,
          animation: 'bounce 1.4s ease infinite',
          '@keyframes bounce': {
            '0%, 100%': { transform: 'translateY(0)' },
            '50%':      { transform: 'translateY(-12px)' },
          },
        }}>
          🎉
        </Typography>

        {/* "We are now  Jilo Intelligence" — single row */}
        <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', flexWrap: 'wrap', gap: 1.5, mb: 1 }}>
          <Typography sx={{
            fontFamily: MONO, fontSize: 'clamp(0.72rem, 2vw, 0.9rem)', fontWeight: 700,
            color: C.lime, letterSpacing: '0.2em', textTransform: 'uppercase', whiteSpace: 'nowrap',
          }}>
            We are now
          </Typography>
          <Typography component="h1" sx={{
            fontSize: 'clamp(2.8rem, 8vw, 5rem)', fontWeight: 900,
            color: C.white, letterSpacing: '-0.04em', lineHeight: 0.95,
            textShadow: '0 0 60px rgba(217,249,157,0.3)', whiteSpace: 'nowrap',
          }}>
            Jilo Intelligence
          </Typography>
        </Box>

        {/* Domain */}
        <Typography sx={{
          fontFamily: MONO, fontSize: '0.9rem', color: 'rgba(255,255,255,0.5)',
          letterSpacing: '0.04em', mb: 4,
        }}>
          jilointelligence.com
        </Typography>

        {/* CTA button */}
        <Box
          component="a"
          href="https://jilointelligence.com"
          target="_blank"
          rel="noopener noreferrer"
          sx={{
            display: 'inline-block', textDecoration: 'none',
            bgcolor: C.lime, color: C.ink,
            px: 5, py: 1.75, fontWeight: 800, fontSize: '1rem',
            borderRadius: '8px', fontFamily: FONT,
            boxShadow: '0 6px 32px rgba(217,249,157,0.4)',
            letterSpacing: '-0.01em',
            '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 12px 40px rgba(217,249,157,0.55)' },
            transition: 'transform 0.18s, box-shadow 0.18s',
            mb: 5,
          }}
        >
          Visit Site Now →
        </Box>

        {/* Celebration cards */}
        <Stack
          direction="row"
          flexWrap="wrap"
          sx={{ gap: 1.5, justifyContent: 'center', mt: 1 }}
        >
          <CelebCard emoji="🚀" title="New Name"       sub="Same mission"         delay={400} />
          <CelebCard emoji="🌍" title="Global Ready"   sub="Built for scale"      delay={560} />
          <CelebCard emoji="🛡️" title="Compliance AI"  sub="Next-gen detection"   delay={720} />
          <CelebCard emoji="✨" title="New Era"        sub="Jilo Intelligence"    delay={880} />
        </Stack>
      </Box>
    </Box>
  )
}
