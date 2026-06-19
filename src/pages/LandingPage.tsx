import { useEffect, useRef, useState } from 'react'
import { Box, Container, Typography, Stack } from '@mui/material'
import { Link } from 'react-router-dom'
import SharedFooter from '@/components/landing/Footer'
import { useSEO } from '@/hooks/useSEO'
import imgOverview        from '@/assets/mockups/overview.png'
import imgTransaction     from '@/assets/mockups/transaction.png'
import imgCddWorkflow     from '@/assets/mockups/cdd_workflow.png'
import imgTxnPipeline     from '@/assets/mockups/transaction_pipeline.png'
import imgNfiuReport      from '@/assets/mockups/nfiu_report.png'
import imgAmlCases        from '@/assets/mockups/aml_cases.png'
import imgTeams           from '@/assets/mockups/teams.png'

// ── Design tokens (mirror LaunchPage) ───────────────────────────────────────────
const C = {
  ink: '#0f1929',
  body: '#3a4a62',
  muted: '#6b7d96',
  line: '#e2e8f0',
  panel: '#f8fafc',
  primary: '#00288e',
  tint: '#e8f0ff',
  tint2: '#f0f4ff',
  green: '#16a34a',
  greenBg: '#dcfce7',
  amber: '#d97706',
  amberBg: '#fef3c7',
  red: '#dc2626',
  redBg: '#fee2e2',
  lime: '#d9f99d',
  white: '#ffffff',
} as const

const MONO = 'JetBrains Mono, monospace'
const FONT = 'Jost, sans-serif'

// ── Reveal-on-scroll wrapper ────────────────────────────────────────────────────
function Reveal({
  children,
  delay = 0,
  as = 'div',
  sx,
}: {
  children: React.ReactNode
  delay?: number
  as?: 'div' | 'section' | 'span'
  sx?: object
}) {
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold: 0.08, rootMargin: '0px 0px -24px 0px' },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return (
    <Box
      ref={ref}
      component={as}
      sx={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'none' : 'translateY(20px)',
        transition: `opacity 0.5s ease ${delay}ms, transform 0.5s ease ${delay}ms`,
        ...sx,
      }}
    >
      {children}
    </Box>
  )
}

// ── Section eyebrow ─────────────────────────────────────────────────────────────
function Eyebrow({ text, light = false }: { text: string; light?: boolean }) {
  const col = light ? '#ffffff' : C.primary
  return (
    <Reveal sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, mb: 1.75 }}>
      <Box sx={{ width: 16, height: '2px', bgcolor: col }} />
      <Typography sx={{
        fontSize: '0.7rem', fontWeight: 700, color: col,
        letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: FONT,
      }}>
        {text}
      </Typography>
    </Reveal>
  )
}

// ── Brand mark ──────────────────────────────────────────────────────────────────
function BrandMark({ light = false }: { light?: boolean }) {
  return (
    <Box component={Link} to="/" sx={{ textDecoration: 'none', display: 'inline-flex', position: 'relative' }}>
      <Box sx={{
        position: 'absolute', top: -4, left: 0, width: 24, height: '2px',
        bgcolor: light ? C.white : C.primary, borderRadius: '1px',
      }} />
      <Typography sx={{
        fontSize: '1.125rem', fontWeight: 700,
        color: light ? C.white : C.primary,
        fontFamily: FONT, letterSpacing: '0.1em',
      }}>
        OPENIV
      </Typography>
    </Box>
  )
}

// ── Reusable desktop application window frame ────────────────────────────────────
function DesktopFrame({
  url,
  children,
  accent = C.primary,
  maxWidth,
}: {
  url: string
  children: React.ReactNode
  accent?: string
  maxWidth?: number | string
}) {
  return (
    <Box sx={{
      bgcolor: C.white,
      border: `1px solid ${C.line}`,
      boxShadow: '0 18px 60px rgba(0,40,142,0.12)',
      borderRadius: '6px',
      overflow: 'hidden',
      width: '100%',
      maxWidth,
    }}>
      {/* Title bar */}
      <Box sx={{
        bgcolor: C.panel, borderBottom: `1px solid ${C.line}`,
        px: 2, py: 1.25, display: 'flex', alignItems: 'center', gap: 1,
      }}>
        {['#ef4444', '#f59e0b', '#22c55e'].map((c) => (
          <Box key={c} sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: c }} />
        ))}
        <Box sx={{
          ml: 1, fontFamily: MONO, fontSize: '0.7rem', color: C.muted,
          bgcolor: C.white, border: `1px solid ${C.line}`, borderRadius: '4px',
          px: 1.5, py: 0.375, flex: 1, maxWidth: 320,
          overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
        }}>
          <Box component="span" sx={{ color: accent }}>● </Box>{url}
        </Box>
      </Box>
      {children}
    </Box>
  )
}

// ── MacBook Pro M5-style laptop frame ────────────────────────────────────────────
function LaptopFrame({ src, alt, notchH = 12 }: { src: string; alt: string; notchH?: number }) {
  return (
    <Box sx={{ position: 'relative', width: '100%', userSelect: 'none' }}>
      {/* Lid — Space Black anodised aluminium */}
      <Box sx={{
        bgcolor: '#1c1c1e',
        borderRadius: '14px 14px 3px 3px',
        p: '9px 9px 3px',
        boxShadow: [
          '0 48px 96px rgba(0,0,0,0.50)',
          '0 0 0 1px rgba(255,255,255,0.09) inset',
          'inset 0 1.5px 0 rgba(255,255,255,0.14)',
        ].join(', '),
      }}>
        {/* Screen glass — full bleed, rounded corners, notch */}
        <Box sx={{ position: 'relative', borderRadius: '7px', overflow: 'hidden', bgcolor: '#000', lineHeight: 0 }}>
          {/* Notch (camera island) */}
          <Box sx={{
            position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
            width: '13%', height: notchH, bgcolor: '#1c1c1e',
            borderRadius: '0 0 8px 8px', zIndex: 2,
          }} />
          <Box component="img" src={src} alt={alt}
            sx={{ width: '100%', display: 'block', objectFit: 'cover', objectPosition: 'top' }}
          />
        </Box>
      </Box>

      {/* Hinge seam */}
      <Box sx={{
        height: 5, bgcolor: '#111113',
        boxShadow: '0 3px 10px rgba(0,0,0,0.6)',
        borderTop: '1px solid rgba(255,255,255,0.05)',
      }} />

      {/* Keyboard deck */}
      <Box sx={{
        bgcolor: '#1c1c1e',
        height: 22,
        borderRadius: '0 0 10px 10px',
        mx: '1%',
        border: '1px solid rgba(255,255,255,0.07)',
        borderTop: 'none',
        boxShadow: '0 18px 56px rgba(0,0,0,0.40)',
        position: 'relative',
        '&::after': {
          content: '""',
          position: 'absolute',
          bottom: 3, left: '42%', right: '42%',
          height: 3, bgcolor: 'rgba(255,255,255,0.10)',
          borderRadius: '2px',
        },
      }} />
    </Box>
  )
}

// ── Tiny UI atoms used inside mockups ────────────────────────────────────────────
function Pill({ label, bg, col }: { label: string; bg: string; col: string }) {
  return (
    <Box sx={{
      fontSize: '0.62rem', fontWeight: 700, px: 0.875, py: 0.25,
      letterSpacing: '0.04em', bgcolor: bg, color: col, fontFamily: FONT,
      borderRadius: '3px', whiteSpace: 'nowrap',
    }}>
      {label}
    </Box>
  )
}

function Meter({ label, w, c }: { label: string; w: string; c: string }) {
  return (
    <Box sx={{ mb: 1.25 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography sx={{ fontSize: '0.7rem', color: C.muted, fontFamily: FONT }}>{label}</Typography>
        <Typography sx={{ fontSize: '0.7rem', color: C.body, fontWeight: 700, fontFamily: FONT }}>{w}</Typography>
      </Box>
      <Box sx={{ height: 5, bgcolor: C.line, borderRadius: '3px', overflow: 'hidden' }}>
        <Box sx={{ height: '100%', width: w, bgcolor: c, borderRadius: '3px' }} />
      </Box>
    </Box>
  )
}

function MockHeading({ title, badge, badgeCol = C.primary }: { title: string; badge?: string; badgeCol?: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
      <Typography sx={{
        fontSize: '0.65rem', fontWeight: 700, color: badgeCol,
        letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: FONT,
      }}>
        {title}
      </Typography>
      {badge && (
        <Typography sx={{ fontSize: '0.6rem', color: C.muted, fontFamily: MONO }}>{badge}</Typography>
      )}
    </Box>
  )
}

// ── NAV ───────────────────────────────────────────────────────────────────────
const NAV_LINKS = [
  { to: '#monitoring', label: 'Detect' },
  { to: '#diligence', label: 'Verify' },
  { to: '#regint', label: 'Enforce' },
  { to: '#cases', label: 'Investigate' },
  { to: '#governance', label: 'Govern' },
]

function Navbar() {
  const [scrollState, setScrollState] = useState<'top' | 'hero' | 'solid'>('top')
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY
      if (y <= 0) setScrollState('top')
      else if (y < window.innerHeight - 80) setScrollState('hero')
      else setScrollState('solid')
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const solid = scrollState === 'solid'
  const dark  = scrollState === 'hero'

  return (
    <Box component="nav" sx={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      height: 64, display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', px: '6vw',
      bgcolor: solid ? 'rgba(255,255,255,0.95)' : dark ? 'rgba(0,0,0,0.45)' : 'transparent',
      backdropFilter: (solid || dark) ? 'blur(10px)' : 'none',
      borderBottom: solid ? `1px solid ${C.line}` : '1px solid transparent',
      boxShadow: solid ? '0 4px 20px rgba(0,40,142,0.06)' : 'none',
      transition: 'background-color 0.3s, box-shadow 0.3s, border-color 0.3s, backdrop-filter 0.3s',
    }}>
      <BrandMark light={!solid} />
      {/* Centre nav links — desktop only */}
      <Stack direction="row" sx={{ gap: 3.5, alignItems: 'center', display: { xs: 'none', md: 'flex' } }}>
        {NAV_LINKS.map((n) => (
          <Box key={n.to} component="a" href={n.to} sx={{
            textDecoration: 'none', fontSize: '0.875rem', fontWeight: 500,
            color: solid ? C.body : 'rgba(255,255,255,0.82)',
            fontFamily: FONT,
            '&:hover': { color: solid ? C.primary : C.white },
            transition: 'color 0.15s',
          }}>
            {n.label}
          </Box>
        ))}
      </Stack>

      {/* Right actions */}
      <Stack direction="row" sx={{ gap: 1.25, alignItems: 'center' }}>
        <Box component={Link} to="/auth/login" sx={{
          textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600,
          color: solid ? C.body : 'rgba(255,255,255,0.88)',
          fontFamily: FONT, px: 1.5, py: 1,
          '&:hover': { color: solid ? C.primary : C.white },
          transition: 'color 0.15s',
        }}>
          Sign in
        </Box>
        <Box component={Link} to="/request-access" sx={{
          textDecoration: 'none',
          bgcolor: solid ? C.primary : C.white,
          color: solid ? C.white : C.primary,
          px: 2.5, py: 1.125, fontWeight: 700, fontSize: '0.875rem', borderRadius: '4px',
          letterSpacing: '0.02em', fontFamily: FONT, whiteSpace: 'nowrap',
          '&:hover': { opacity: 0.88 }, transition: 'opacity 0.15s, background-color 0.3s, color 0.3s',
        }}>
          Request Demo
        </Box>
      </Stack>
    </Box>
  )
}

// ── Narrative spine strip (Detect → Verify → Enforce → Investigate → Govern) ─────
function NarrativeSpine() {
  const steps = ['Detect', 'Verify', 'Enforce', 'Investigate', 'Govern']
  return (
    <Box sx={{
      py: 2.5, px: '6vw', bgcolor: C.primary,
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center',
      gap: { xs: 1, md: 2 },
    }}>
      {steps.map((s, i) => (
        <Box key={s} sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, md: 2 } }}>
          <Typography sx={{
            fontSize: { xs: '0.78rem', md: '0.95rem' }, fontWeight: 700,
            color: C.white, letterSpacing: '0.04em', fontFamily: FONT,
          }}>
            <Box component="span" sx={{ color: C.lime, fontFamily: MONO, fontSize: '0.7rem', mr: 0.75 }}>
              0{i + 1}
            </Box>
            {s}
          </Typography>
          {i < steps.length - 1 && (
            <Box component="span" sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '1rem' }}>→</Box>
          )}
        </Box>
      ))}
    </Box>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
// SECTION 1 — HERO
// ════════════════════════════════════════════════════════════════════════════════
function Hero() {
  const spine = ['Detect', 'Verify', 'Enforce', 'Investigate', 'Govern']
  return (
    <Box component="section" id="hero" sx={{
      position: 'relative', overflow: 'hidden', isolation: 'isolate',
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'flex-start',
      pt: { xs: '96px', md: '120px' }, pb: 0, px: '6vw',
      textAlign: 'center',
      background: `radial-gradient(120% 120% at 50% -10%, #0a3bb0 0%, ${C.primary} 42%, #001b5e 100%)`,
    }}>
      {/* Faint engineering grid */}
      <Box aria-hidden sx={{
        position: 'absolute', inset: 0, zIndex: -1,
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)',
        backgroundSize: '52px 52px',
        maskImage: 'radial-gradient(100% 80% at 50% 0%, #000 0%, transparent 72%)',
        WebkitMaskImage: 'radial-gradient(100% 80% at 50% 0%, #000 0%, transparent 72%)',
      }} />
      {/* Lime glow accents */}
      <Box aria-hidden sx={{
        position: 'absolute', top: -140, left: '-8%', zIndex: -1,
        width: 460, height: 460, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(217,249,157,0.18) 0%, rgba(217,249,157,0) 70%)',
      }} />
      <Box aria-hidden sx={{
        position: 'absolute', bottom: -180, right: '-6%', zIndex: -1,
        width: 520, height: 520, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 70%)',
      }} />

      <Box sx={{ maxWidth: 900, mx: 'auto' }}>
        {/* Narrative spine eyebrow */}
        <Reveal sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 1.25, mb: 3 }}>
          {spine.map((s, i) => (
            <Box key={s} sx={{ display: 'inline-flex', alignItems: 'center', gap: 1.25 }}>
              <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: C.lime, letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: FONT }}>
                {s}
              </Typography>
              {i < spine.length - 1 && <Box component="span" sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.7rem' }}>→</Box>}
            </Box>
          ))}
        </Reveal>

        <Reveal>
          <Typography component="h1" sx={{
            fontSize: 'clamp(2.4rem, 5vw, 3.8rem)', fontWeight: 900,
            lineHeight: 1.05, letterSpacing: '-0.035em', color: C.white, mb: 2.75, fontFamily: FONT,
          }}>
            Protect Your Institution from Fraud, Compliance Risk, and{' '}
            <Box component="span" sx={{ color: C.lime }}>Regulatory Exposure.</Box>
          </Typography>
        </Reveal>
        <Reveal delay={80}>
          <Typography sx={{
            fontSize: '1.1rem', color: 'rgba(255,255,255,0.82)', lineHeight: 1.65,
            maxWidth: 660, mx: 'auto', mb: 4.5, fontFamily: FONT,
          }}>
            Real-time transaction monitoring, AI-enhanced due diligence, regulatory policy
            automation, and NFIU reporting in a single compliance operating platform.
          </Typography>
        </Reveal>
        <Reveal delay={160}>
          <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 1.5, justifyContent: 'center', mb: 3 }}>
            <Box component={Link} to="/request-access" sx={{
              textDecoration: 'none', bgcolor: C.white, color: C.primary,
              px: 4, py: 1.75, fontWeight: 700, fontSize: '0.98rem', borderRadius: '4px',
              fontFamily: FONT, display: 'inline-block', textAlign: 'center',
              boxShadow: '0 14px 40px rgba(0,0,0,0.22)',
              '&:hover': { transform: 'translateY(-1px)', boxShadow: '0 18px 48px rgba(0,0,0,0.28)' },
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}>
              Request Demo
            </Box>
            <Box component="a" href="#platform" sx={{
              textDecoration: 'none', border: '1.5px solid rgba(255,255,255,0.4)', color: C.white,
              px: 3.25, py: 1.75, fontWeight: 600, fontSize: '0.98rem', borderRadius: '4px',
              fontFamily: FONT, display: 'inline-block', textAlign: 'center',
              '&:hover': { borderColor: C.white, bgcolor: 'rgba(255,255,255,0.08)' },
              transition: 'border-color 0.15s, background-color 0.15s',
            }}>
              View Platform Overview
            </Box>
          </Stack>
        </Reveal>
        <Reveal delay={220}>
          <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', letterSpacing: '0.04em', fontFamily: FONT }}>
            CBN-native &nbsp;·&nbsp; NFIU GoAML &nbsp;·&nbsp; Real-time decisioning
          </Typography>
        </Reveal>
      </Box>

      {/* Product screenshot in laptop frame — overlaps into Problem section */}
      <Reveal delay={280} sx={{
        width: '100%', maxWidth: 1040, mx: 'auto',
        mt: { xs: 6, md: 8 },
        mb: { xs: '-60px', md: '-100px' },
        position: 'relative', zIndex: 2,
        px: { xs: 0, md: 2 },
      }}>
        {/* Glow behind laptop */}
        <Box aria-hidden sx={{
          position: 'absolute', inset: '-32px -24px', zIndex: -1, borderRadius: '24px',
          background: 'radial-gradient(ellipse at 50% 0%, rgba(217,249,157,0.20) 0%, rgba(0,40,142,0.0) 68%)',
          filter: 'blur(6px)',
        }} />
        <LaptopFrame src={imgOverview} alt="OpenIV compliance dashboard overview" notchH={16} />
      </Reveal>
    </Box>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
// SECTION 2 — THE PROBLEM
// ════════════════════════════════════════════════════════════════════════════════
function Problem() {
  const metrics = [
    { n: '4', c: C.red, l: 'disconnected tools running compliance today', s: 'monitoring · screening · cases · reporting' },
    { n: '₦5B+', c: C.amber, l: 'AML fines paid by Nigerian institutions since 2021', s: 'and the figure keeps climbing' },
    { n: 'EOD', c: C.primary, l: 'when most fraud is reviewed — the morning after', s: 'the money has already left' },
    { n: '1', c: C.green, l: 'operating system that unifies the entire stack', s: 'OpenIV — detect to govern' },
  ]
  return (
    <Box component="section" sx={{ pt: { xs: '100px', md: '160px' }, pb: 11, px: '6vw', bgcolor: C.panel }}>
      <Box sx={{ maxWidth: 1060, mx: 'auto' }}>
        <Eyebrow text="The Problem" />
        <Reveal>
          <Typography component="h2" sx={{
            fontSize: 'clamp(1.7rem, 3vw, 2.4rem)', fontWeight: 800, letterSpacing: '-0.025em',
            lineHeight: 1.1, mb: 1.25, color: C.ink, fontFamily: FONT,
          }}>
            Financial Crime Never Sleeps.
          </Typography>
        </Reveal>
        <Reveal>
          <Typography sx={{ fontSize: '0.98rem', color: C.body, lineHeight: 1.65, maxWidth: 640, mb: 6, fontFamily: FONT }}>
            Most institutions stitch compliance together from disconnected tools — one for transaction
            monitoring, another for customer screening, a third for investigations, and spreadsheets for
            regulatory reporting. The gaps between them are where risk hides. OpenIV replaces the patchwork
            with a single operating system.
          </Typography>
        </Reveal>
        <Reveal sx={{
          display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
          gap: '1px', bgcolor: C.line, border: `1px solid ${C.line}`,
        }}>
          {metrics.map((m) => (
            <Box key={m.l} sx={{ bgcolor: C.white, p: 3.25 }}>
              <Typography sx={{
                fontSize: '2.6rem', fontWeight: 900, color: m.c, lineHeight: 1,
                letterSpacing: '-0.04em', mb: 1, fontFamily: FONT,
              }}>
                {m.n}
              </Typography>
              <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: C.ink, lineHeight: 1.4, mb: 0.75, fontFamily: FONT }}>
                {m.l}
              </Typography>
              <Typography sx={{ fontSize: '0.74rem', color: C.muted, lineHeight: 1.45, fontFamily: FONT }}>
                {m.s}
              </Typography>
            </Box>
          ))}
        </Reveal>
      </Box>
    </Box>
  )
}

// ── Shared feature section (alternating screenshot + copy) ───────────────────────
function FeatureSection({
  id, eyebrow, title, intro, features, mockup, reverse = false, bg = C.white,
}: {
  id: string
  eyebrow: string
  title: React.ReactNode
  intro: string
  features: { t: string; d: string }[]
  mockup: React.ReactNode
  reverse?: boolean
  bg?: string
}) {
  const copy = (
    <Box>
      <Eyebrow text={eyebrow} />
      <Reveal>
        <Typography component="h2" sx={{
          fontSize: 'clamp(1.6rem, 2.8vw, 2.2rem)', fontWeight: 800, letterSpacing: '-0.025em',
          lineHeight: 1.1, mb: 1.5, color: C.ink, fontFamily: FONT,
        }}>
          {title}
        </Typography>
      </Reveal>
      <Reveal>
        <Typography sx={{ fontSize: '0.95rem', color: C.body, lineHeight: 1.65, mb: 3, fontFamily: FONT }}>
          {intro}
        </Typography>
      </Reveal>
      <Reveal as="div">
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {features.map((f, i, arr) => (
            <Box key={f.t} component="li" sx={{
              display: 'flex', gap: 1.5, py: 1.375,
              borderBottom: i < arr.length - 1 ? `1px solid ${C.line}` : 'none',
            }}>
              <Box sx={{
                width: 20, height: 20, mt: '2px', flexShrink: 0, borderRadius: '4px',
                bgcolor: C.tint, color: C.primary, fontSize: '0.6rem', fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MONO,
              }}>
                0{i + 1}
              </Box>
              <Box>
                <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: C.ink, fontFamily: FONT }}>{f.t}</Typography>
                <Typography sx={{ fontSize: '0.82rem', color: C.body, lineHeight: 1.5, fontFamily: FONT }}>{f.d}</Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </Reveal>
    </Box>
  )
  const visual = <Reveal delay={120}>{mockup}</Reveal>
  return (
    <Box id={id} component="section" sx={{ py: 11, px: '6vw', bgcolor: bg }}>
      <Box sx={{
        maxWidth: 1160, mx: 'auto',
        display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
        gap: { xs: 5, md: 8 }, alignItems: 'center',
      }}>
        {reverse
          ? <>{visual}{copy}</>
          : <>{copy}{visual}</>}
      </Box>
    </Box>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
// SECTION 3 — REAL-TIME TRANSACTION MONITORING
// ════════════════════════════════════════════════════════════════════════════════
function MonitoringMockup() {
  return <LaptopFrame src={imgTransaction} alt="OpenIV transaction monitoring" />
}

// ════════════════════════════════════════════════════════════════════════════════
// SECTION 4 — AI-ENHANCED DUE DILIGENCE
// ════════════════════════════════════════════════════════════════════════════════
function DiligenceMockup() {
  return <LaptopFrame src={imgCddWorkflow} alt="OpenIV CDD workflow" />
}

// ════════════════════════════════════════════════════════════════════════════════
// SECTION 5 — REGULATORY INTELLIGENCE ENGINE (hero capability)
// ════════════════════════════════════════════════════════════════════════════════
function RegIntelligence() {
  const features = [
    { t: 'Monitoring rules', d: 'Machine-readable thresholds wired straight into the live transaction engine.' },
    { t: 'Compliance controls', d: 'Each obligation mapped to an enforceable, testable control.' },
    { t: 'Workflows', d: 'Review, approval, and escalation steps generated per requirement.' },
    { t: 'Implementation guidance', d: 'Plain-language instructions your team can act on immediately.' },
    { t: 'Audit-ready documentation', d: 'Every generated control traces back to its source circular.' },
  ]
  return (
    <Box id="regint" component="section" sx={{ py: 12, px: '6vw', bgcolor: C.primary }}>
      <Box sx={{
        maxWidth: 1160, mx: 'auto',
        display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1.05fr' },
        gap: { xs: 5, md: 8 }, alignItems: 'center',
      }}>
        {/* copy (light, on blue) */}
        <Box>
          <Eyebrow text="Regulatory Intelligence Engine" light />
          <Reveal>
            <Typography component="h2" sx={{
              fontSize: 'clamp(1.7rem, 3vw, 2.5rem)', fontWeight: 800, letterSpacing: '-0.025em',
              lineHeight: 1.08, mb: 1.5, color: C.white, fontFamily: FONT,
            }}>
              Transform Regulations into <Box component="span" sx={{ color: C.lime }}>Operational Controls.</Box>
            </Typography>
          </Reveal>
          <Reveal>
            <Typography sx={{ fontSize: '0.98rem', color: 'rgba(255,255,255,0.8)', lineHeight: 1.65, mb: 3.5, maxWidth: 480, fontFamily: FONT }}>
              Upload a CBN circular and OpenIV reads it, interprets the obligations, and automatically
              generates the controls, rules, workflows, and audit documentation that put it into force —
              in minutes, not quarters.
            </Typography>
          </Reveal>
          <Reveal as="div">
            <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
              {features.map((f, i, arr) => (
                <Box key={f.t} component="li" sx={{
                  display: 'flex', gap: 1.5, py: 1.25,
                  borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.12)' : 'none',
                }}>
                  <Box sx={{ color: C.lime, fontWeight: 800, fontSize: '0.8rem', mt: '2px', fontFamily: MONO }}>→</Box>
                  <Box>
                    <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: C.white, fontFamily: FONT }}>{f.t}</Typography>
                    <Typography sx={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5, fontFamily: FONT }}>{f.d}</Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </Reveal>
        </Box>
        {/* pipeline mockup */}
        <Reveal delay={120}>
          <RegPipelineMockup />
        </Reveal>
      </Box>
    </Box>
  )
}

function RegPipelineMockup() {
  return <LaptopFrame src={imgTxnPipeline} alt="OpenIV regulatory intelligence — CBN threshold rules" />
}

// ════════════════════════════════════════════════════════════════════════════════
// SECTION 6 — NFIU REPORTING & CASE MANAGEMENT
// ════════════════════════════════════════════════════════════════════════════════
function CasesMockup() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <LaptopFrame src={imgAmlCases}   alt="OpenIV AML & Cases investigations" />
      <LaptopFrame src={imgNfiuReport} alt="OpenIV NFIU reports and filings"   />
    </Box>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
// SECTION 7 — TEAM MANAGEMENT
// ════════════════════════════════════════════════════════════════════════════════
function TeamMockup() {
  return <LaptopFrame src={imgTeams} alt="OpenIV team & roles management" />
}

// ════════════════════════════════════════════════════════════════════════════════
// SECTION 8 — PLATFORM ARCHITECTURE
// ════════════════════════════════════════════════════════════════════════════════
function Architecture() {
  const layers = [
    { n: '05', t: 'Governance Layer', d: 'RBAC · approvals · audit trails · policy versioning', col: '#7c3aed' },
    { n: '04', t: 'Investigation Layer', d: 'Cases · evidence · STR/CTR · NFIU GoAML filing', col: '#0ea5e9' },
    { n: '03', t: 'Regulatory Intelligence Layer', d: 'Circular ingestion · control & rule generation', col: C.primary },
    { n: '02', t: 'Transaction Risk Layer', d: 'Real-time scoring · rules engine · anomaly detection', col: C.amber },
    { n: '01', t: 'Customer Risk Layer', d: 'KYC · BVN/NIN · PEP/sanctions · continuous profiling', col: C.green },
  ]
  const props = ['API-first architecture', 'Multi-tenant deployment', 'Audit readiness', 'Security controls', 'Scalability']
  return (
    <Box id="platform" component="section" sx={{ py: 12, px: '6vw', bgcolor: C.panel }}>
      <Box sx={{ maxWidth: 1060, mx: 'auto', textAlign: 'center' }}>
        <Box sx={{ display: 'inline-flex' }}><Eyebrow text="Platform Architecture" /></Box>
        <Reveal>
          <Typography component="h2" sx={{
            fontSize: 'clamp(1.7rem, 3vw, 2.4rem)', fontWeight: 800, letterSpacing: '-0.025em',
            lineHeight: 1.1, mb: 1.25, color: C.ink, fontFamily: FONT,
          }}>
            Enterprise-Ready Compliance Infrastructure.
          </Typography>
        </Reveal>
        <Reveal>
          <Typography sx={{ fontSize: '0.95rem', color: C.body, lineHeight: 1.65, maxWidth: 560, mx: 'auto', mb: 6, fontFamily: FONT }}>
            Five layers working as one system — risk flows up from customer and transaction data,
            through regulatory intelligence, into investigation and governance.
          </Typography>
        </Reveal>

        {/* layered diagram */}
        <Reveal sx={{ maxWidth: 720, mx: 'auto', mb: 5 }}>
          <Stack sx={{ gap: 1.25 }}>
            {layers.map((l) => (
              <Box key={l.n} sx={{
                display: 'flex', alignItems: 'center', gap: 2, textAlign: 'left',
                bgcolor: C.white, border: `1px solid ${C.line}`, borderLeft: `4px solid ${l.col}`,
                borderRadius: '6px', p: 2.25,
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': { transform: 'translateX(6px)', boxShadow: '0 8px 24px rgba(0,40,142,0.08)' },
              }}>
                <Typography sx={{ fontFamily: MONO, fontSize: '0.8rem', fontWeight: 700, color: l.col, flexShrink: 0 }}>{l.n}</Typography>
                <Box>
                  <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: C.ink, fontFamily: FONT }}>{l.t}</Typography>
                  <Typography sx={{ fontSize: '0.78rem', color: C.muted, fontFamily: FONT }}>{l.d}</Typography>
                </Box>
              </Box>
            ))}
          </Stack>
        </Reveal>

        {/* properties */}
        <Reveal sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 1.25 }}>
          {props.map((p) => (
            <Box key={p} sx={{
              bgcolor: C.white, border: `1px solid ${C.line}`, borderRadius: '4px',
              px: 2, py: 0.875, fontSize: '0.8rem', fontWeight: 600, color: C.body, fontFamily: FONT,
            }}>
              {p}
            </Box>
          ))}
        </Reveal>
      </Box>
    </Box>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
// SECTION 9 — TRUST & COMPLIANCE
// ════════════════════════════════════════════════════════════════════════════════
function Trust() {
  const cards = [
    { t: 'CBN Alignment', d: 'Built to the CBN minimum standards from the schema up.' },
    { t: 'AML/CFT Workflows', d: 'Monitoring, screening, and filing that follow FATF practice.' },
    { t: 'Audit Readiness', d: 'Every decision captured with a defensible, timestamped trail.' },
    { t: 'Security Controls', d: 'RBAC, encryption, and 2FA across the platform.' },
    { t: 'Governance', d: 'Policy versioning, approvals, and escalation by design.' },
  ]
  return (
    <Box id="governance" component="section" sx={{ py: 12, px: '6vw', bgcolor: C.white }}>
      <Box sx={{ maxWidth: 1060, mx: 'auto', textAlign: 'center' }}>
        <Box sx={{ display: 'inline-flex' }}><Eyebrow text="Trust & Compliance" /></Box>
        <Reveal>
          <Typography component="h2" sx={{
            fontSize: 'clamp(1.7rem, 3vw, 2.4rem)', fontWeight: 800, letterSpacing: '-0.025em',
            lineHeight: 1.1, mb: 6, color: C.ink, fontFamily: FONT,
          }}>
            Built for Regulated Financial Institutions.
          </Typography>
        </Reveal>
        <Reveal sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(5, 1fr)' },
          gap: '1px', bgcolor: C.line, border: `1px solid ${C.line}`, borderRadius: '6px', overflow: 'hidden',
        }}>
          {cards.map((c) => (
            <Box key={c.t} sx={{ bgcolor: C.white, p: 3, textAlign: 'left' }}>
              <Box sx={{ width: 28, height: 3, bgcolor: C.primary, borderRadius: '2px', mb: 1.75 }} />
              <Typography sx={{ fontSize: '0.88rem', fontWeight: 700, color: C.ink, mb: 0.75, fontFamily: FONT }}>{c.t}</Typography>
              <Typography sx={{ fontSize: '0.78rem', color: C.body, lineHeight: 1.5, fontFamily: FONT }}>{c.d}</Typography>
            </Box>
          ))}
        </Reveal>
      </Box>
    </Box>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
// SECTION 10 — FINAL CTA
// ════════════════════════════════════════════════════════════════════════════════
function FinalCTA() {
  return (
    <Box component="section" sx={{ py: 12.5, px: '6vw', textAlign: 'center', bgcolor: C.primary }}>
      <Reveal>
        <Typography component="h2" sx={{
          fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)', fontWeight: 900, lineHeight: 1.08,
          letterSpacing: '-0.03em', color: C.white, mb: 1.75, maxWidth: 760, mx: 'auto', fontFamily: FONT,
        }}>
          The Compliance Operating System for{' '}
          <Box component="span" sx={{ color: C.lime }}>Modern Financial Institutions.</Box>
        </Typography>
      </Reveal>
      <Reveal>
        <Typography sx={{
          fontSize: '1rem', color: 'rgba(255,255,255,0.78)', lineHeight: 1.6,
          maxWidth: 520, mx: 'auto', mb: 4, fontFamily: FONT,
        }}>
          Detect risk. Verify customers. Enforce compliance. Report confidently.
        </Typography>
      </Reveal>
      <Reveal>
        <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 1.5, justifyContent: 'center' }}>
          <Box component={Link} to="/request-access" sx={{
            textDecoration: 'none', bgcolor: C.white, color: C.primary,
            px: 3.75, py: 1.625, fontWeight: 700, fontSize: '0.95rem', borderRadius: '4px',
            fontFamily: FONT, display: 'inline-block',
            '&:hover': { opacity: 0.9 }, transition: 'opacity 0.15s',
          }}>
            Request Demo
          </Box>
          <Box component="a" href="mailto:hello@openiv.ng" sx={{
            textDecoration: 'none', border: '1.5px solid rgba(255,255,255,0.35)',
            color: 'rgba(255,255,255,0.9)', px: 3, py: 1.625, fontWeight: 600, fontSize: '0.95rem',
            borderRadius: '4px', fontFamily: FONT, display: 'inline-block',
            '&:hover': { borderColor: C.white }, transition: 'border-color 0.15s',
          }}>
            Contact Sales →
          </Box>
        </Stack>
      </Reveal>
    </Box>
  )
}

// ── PAGE ────────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  useSEO({
    title: 'OpenIV — The Compliance Operating System for Financial Institutions',
    description: 'Real-time transaction monitoring, AI-enhanced due diligence, regulatory policy automation, and NFIU reporting in a single compliance operating platform for Nigerian banks and fintechs.',
    canonical: '/',
    ogImage: 'https://openiv.ng/assets/landing/dashboard.png',
  })

  useEffect(() => {
    const prev = document.documentElement.style.scrollBehavior
    document.documentElement.style.scrollBehavior = 'smooth'
    return () => { document.documentElement.style.scrollBehavior = prev }
  }, [])

  return (
    <Box sx={{ fontFamily: FONT, bgcolor: C.white, color: C.ink }}>
      <Navbar />
      <Container disableGutters maxWidth={false}>
        <Hero />
        <Problem />
        <NarrativeSpine />

        <FeatureSection
          id="monitoring"
          eyebrow="Detect · Real-Time Monitoring"
          title="Monitor Every Transaction as It Happens."
          intro="Every transaction is scored the moment it moves — behavioural anomalies surfaced, risk quantified, and the highest-priority alerts pushed to the top of the queue before money settles."
          features={[
            { t: 'Real-time monitoring', d: 'Continuous scoring of every transaction as it streams in.' },
            { t: 'Behavioral anomaly detection', d: 'Velocity, geo, and device patterns flagged automatically.' },
            { t: 'Risk scoring', d: 'A single 0–100 score per transaction, fully explainable.' },
            { t: 'Alert prioritization', d: 'High-risk activity auto-escalated to the right analyst.' },
            { t: 'Rules engine', d: 'Per-institution rules calibrated to your customer base.' },
          ]}
          mockup={<MonitoringMockup />}
        />

        <FeatureSection
          id="diligence"
          eyebrow="Verify · Customer Due Diligence"
          title="Accelerate Customer Due Diligence with AI."
          intro="Onboarding and screening become faster and more consistent. AI assembles a due-diligence summary, runs every screening check, and produces a risk assessment your analysts can act on in seconds."
          features={[
            { t: 'Customer onboarding', d: 'Guided, tiered onboarding aligned to CBN KYC limits.' },
            { t: 'Customer & PEP screening', d: 'Names checked against PEP and watchlist databases.' },
            { t: 'Sanctions screening', d: 'OFAC, UN, and EU lists screened on every profile.' },
            { t: 'Adverse media screening', d: 'Negative-news matches surfaced and triaged by AI.' },
            { t: 'Enhanced due diligence', d: 'Automated EDD summaries with a clear recommendation.' },
          ]}
          mockup={<DiligenceMockup />}
          reverse
          bg={C.panel}
        />

        <RegIntelligence />

        <FeatureSection
          id="cases"
          eyebrow="Investigate · NFIU Reporting & Cases"
          title="Manage Cases and Regulatory Reporting from One Workspace."
          intro="Investigations and filing live in one place. Cases open automatically from alerts, carry their full evidence trail, and turn into valid NFIU GoAML reports without leaving the platform."
          features={[
            { t: 'STR management', d: 'Suspicious transaction reports drafted and tracked end-to-end.' },
            { t: 'Case tracking', d: 'Every case with stage, owner, and SLA at a glance.' },
            { t: 'Investigation workflow', d: 'Structured steps from alert to resolution.' },
            { t: 'Evidence management', d: 'Transactions, profiles, and notes linked to each case.' },
            { t: 'Regulatory reporting', d: 'STR/CTR exported as valid NFIU GoAML XML.' },
          ]}
          mockup={<CasesMockup />}
        />

        <FeatureSection
          id="team"
          eyebrow="Govern · Team Management"
          title="Built for Compliance Teams."
          intro="Operational governance is built in. Define roles, assign work, route approvals and escalations, and capture an immutable audit trail of every action your team takes."
          features={[
            { t: 'Role-based access', d: 'Granular permissions scoped to each compliance role.' },
            { t: 'Team assignments', d: 'Route cases and reviews to the right people.' },
            { t: 'Approval workflows', d: 'Multi-step sign-off on filings and high-risk decisions.' },
            { t: 'Escalation management', d: 'Automatic escalation when thresholds or SLAs are hit.' },
            { t: 'Audit trails', d: 'Every action logged, attributed, and timestamped.' },
          ]}
          mockup={<TeamMockup />}
          reverse
          bg={C.panel}
        />

        <Architecture />
        <Trust />
        <FinalCTA />
        <SharedFooter />
      </Container>
    </Box>
  )
}
