import { Box, Container, Typography, Stack, Grid } from '@mui/material'
import { Link } from 'react-router-dom'
import SharedFooter from '@/components/landing/Footer'
import { keyframes } from '@mui/system'
import { useState, useEffect, useRef } from 'react'
import ElectricBoltIcon from '@mui/icons-material/ElectricBolt'
import FingerprintIcon from '@mui/icons-material/Fingerprint'
import PolicyIcon from '@mui/icons-material/Policy'
import RadarIcon from '@mui/icons-material/Radar'
import ManageSearchIcon from '@mui/icons-material/ManageSearch'
import HubIcon from '@mui/icons-material/Hub'
import BarChartIcon from '@mui/icons-material/BarChart'
import LocationOnIcon from '@mui/icons-material/LocationOn'
import DevicesIcon from '@mui/icons-material/Devices'

// ── Keyframes (mirror of AuthLayout sign-in sidebar) ─────────────────────────
const bounceIn = keyframes`
  0%   { opacity: 0; transform: scale(0.3) translateY(20px); }
  50%  { opacity: 1; transform: scale(1.05) translateY(-5px); }
  70%  { transform: scale(0.9) translateY(2px); }
  100% { transform: scale(1) translateY(0); }
`
const slideInLine = keyframes`
  from { opacity: 0; transform: translateX(-30px); }
  to   { opacity: 1; transform: translateX(0); }
`
const flyOff = keyframes`
  0%   { opacity: 1; transform: translateY(0) scale(1); }
  100% { opacity: 0; transform: translateY(-40px) scale(0.95); }
`
const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(24px); }
  to   { opacity: 1; transform: translateY(0); }
`
const fadeIn = keyframes`
  from { opacity: 0; }
  to   { opacity: 1; }
`
const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.4; }
`
const scrollLeft = keyframes`
  0%   { transform: translateX(0); }
  100% { transform: translateX(-50%); }
`

// ── Animated counter ──────────────────────────────────────────────────────────
function Counter({ to, suffix = '' }: { to: number; suffix?: string }) {
  const [val, setVal] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      observer.disconnect()
      let start = 0
      const step = Math.ceil(to / 60)
      const timer = setInterval(() => {
        start = Math.min(start + step, to)
        setVal(start)
        if (start >= to) clearInterval(timer)
      }, 16)
    }, { threshold: 0.5 })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [to])
  return <span ref={ref}>{val}{suffix}</span>
}

// ── Navbar ────────────────────────────────────────────────────────────────────
function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return (
    <Box sx={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      height: 68, display: 'flex', alignItems: 'center',
      bgcolor: scrolled ? 'rgba(255,255,255,0.95)' : 'transparent',
      backdropFilter: scrolled ? 'blur(12px)' : 'none',
      borderBottom: scrolled ? '1px solid #e2e8f0' : '1px solid transparent',
      transition: 'all 0.3s ease',
    }}>
      <Container maxWidth="lg" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box component={Link} to="/" sx={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
          <Box sx={{ position: 'relative' }}>
            <Box sx={{ position: 'absolute', top: -4, left: 0, width: 24, height: '2px', bgcolor: scrolled ? '#00288e' : '#ffffff', borderRadius: '1px' }} />
            <Typography sx={{ fontSize: '1.125rem', fontWeight: 700, color: scrolled ? '#00288e' : '#ffffff', fontFamily: 'Jost', letterSpacing: '0.1em' }}>
              OPENIV
            </Typography>
          </Box>
        </Box>

        <Stack direction="row" sx={{ gap: 1, alignItems: 'center' }}>
          <Box component={Link} to="/developers" sx={{
            textDecoration: 'none', px: 2, py: 0.875, fontSize: '0.875rem', fontWeight: 500,
            color: scrolled ? '#475569' : 'rgba(255,255,255,0.75)', fontFamily: 'Jost',
            '&:hover': { color: scrolled ? '#00288e' : '#ffffff' },
          }}>Docs</Box>
          <Box component={Link} to="/auth/login" sx={{
            textDecoration: 'none', px: 2, py: 0.875, fontSize: '0.875rem', fontWeight: 500,
            color: scrolled ? '#475569' : 'rgba(255,255,255,0.75)', fontFamily: 'Jost',
            '&:hover': { color: scrolled ? '#00288e' : '#ffffff' },
          }}>Sign in</Box>
          <Box component={Link} to="/request-access" sx={{
            textDecoration: 'none', px: 2.5, py: 0.875, fontSize: '0.875rem', fontWeight: 700,
            bgcolor: '#d9f99d', color: '#00288e', fontFamily: 'Jost',
            '&:hover': { bgcolor: '#bef264' },
          }}>Get access →</Box>
        </Stack>
      </Container>
    </Box>
  )
}

// ── Hero carousel (same motion as sign-in sidebar) ────────────────────────────
const HERO_SLIDES = [
  {
    title: 'Stop Financial Crime\nBefore It Lands.',
    lines: [
      'Real-time AML surveillance scores every transaction',
      'against 29+ rules in sub-14ms — before it settles.',
    ],
  },
  {
    title: 'Behavioral KYC.\nKnow Every Risk Profile.',
    lines: [
      'BVN, NIN, phone verification, liveness check,',
      'and PEP screening wrapped in a single API call.',
    ],
  },
  {
    title: 'Effortless\nRegulatory Compliance.',
    lines: [
      'Generate CBN, NFIU, and NDPR-aligned reports',
      'automatically — without a single manual filing.',
    ],
  },
  {
    title: 'One API.\nFull Fraud Coverage.',
    lines: [
      'Stream transactions and KYC data with one POST.',
      'Risk score, triggered rules, and action in <14ms.',
    ],
  },
]

function HeroCarousel() {
  const [index, setIndex] = useState(0)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const t = setInterval(() => {
      setExiting(true)
      setTimeout(() => {
        setIndex(i => (i + 1) % HERO_SLIDES.length)
        setExiting(false)
      }, 600)
    }, 8000)
    return () => clearInterval(t)
  }, [])

  const go = (i: number) => {
    if (i === index || exiting) return
    setExiting(true)
    setTimeout(() => { setIndex(i); setExiting(false) }, 600)
  }

  const slide = HERO_SLIDES[index]

  return (
    <Box>
      <Box sx={{
        minHeight: { xs: 180, md: 220 },
        animation: exiting ? `${flyOff} 0.6s cubic-bezier(0.4,0,0.2,1) forwards` : 'none',
      }}>
        <Typography sx={{
          fontSize: { xs: '2.625rem', md: '3.5rem', lg: '4rem' },
          fontWeight: 900, color: '#ffffff', lineHeight: 1.1,
          fontFamily: 'Jost', mb: 2.5, whiteSpace: 'pre-line',
          animation: !exiting ? `${bounceIn} 0.8s cubic-bezier(0.34,1.56,0.64,1) both` : 'none',
        }}>
          {slide.title}
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {slide.lines.map((line, i) => (
            <Typography key={`${index}-${i}`} sx={{
              fontSize: { xs: '1rem', md: '1.125rem' },
              color: 'rgba(255,255,255,0.72)', lineHeight: 1.65,
              animation: !exiting
                ? `${slideInLine} 0.8s cubic-bezier(0.34,1.56,0.64,1) ${0.4 + i * 0.15}s both`
                : 'none',
            }}>
              {line}
            </Typography>
          ))}
        </Box>
      </Box>

      {/* Progress dots */}
      <Box sx={{ display: 'flex', gap: 1, mt: 4 }}>
        {HERO_SLIDES.map((_, i) => (
          <Box key={i} onClick={() => go(i)} sx={{
            width: i === index ? 24 : 8, height: 8, borderRadius: '4px',
            bgcolor: i === index ? '#d9f99d' : 'rgba(217,249,157,0.3)',
            cursor: 'pointer',
            transition: 'all 0.4s cubic-bezier(0.4,0,0.2,1)',
            '&:hover': { bgcolor: i === index ? '#d9f99d' : 'rgba(217,249,157,0.5)' },
          }} />
        ))}
      </Box>
    </Box>
  )
}

// ── Hero section ──────────────────────────────────────────────────────────────
function Hero() {
  return (
    <Box sx={{
      bgcolor: '#00288e', minHeight: '100vh', pt: '68px',
      display: 'flex', flexDirection: 'column',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Grid */}
      <Box sx={{
        position: 'absolute', inset: 0, opacity: 0.06,
        backgroundImage: 'linear-gradient(#d9f99d 1px, transparent 1px), linear-gradient(90deg, #d9f99d 1px, transparent 1px)',
        backgroundSize: '48px 48px',
      }} />
      {/* Glow */}
      <Box sx={{
        position: 'absolute', top: '20%', left: '60%', width: 500, height: 500,
        bgcolor: '#d9f99d', opacity: 0.04, borderRadius: '50%',
        filter: 'blur(120px)', pointerEvents: 'none',
      }} />

      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center' }}>
        <Container maxWidth="lg" sx={{ position: 'relative', py: { xs: 10, md: 14 } }}>
          <Grid container spacing={8} sx={{ alignItems: 'center' }}>
            <Grid size={{ xs: 12, lg: 6 }}>
              <HeroCarousel />

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 5, animation: `${fadeUp} 0.7s 0.3s ease both` }}>
                <Box component={Link} to="/dashboard" sx={{
                  textDecoration: 'none', px: 3.5, py: 1.5, bgcolor: '#d9f99d', color: '#00288e',
                  fontSize: '0.9375rem', fontWeight: 800, fontFamily: 'Jost',
                  display: 'inline-flex', alignItems: 'center', gap: 1,
                  '&:hover': { bgcolor: '#bef264' },
                }}>Go to dashboard →</Box>
                <Box component={Link} to="/developers" sx={{
                  textDecoration: 'none', px: 3.5, py: 1.5,
                  border: '1.5px solid rgba(255,255,255,0.3)', color: '#ffffff',
                  fontSize: '0.9375rem', fontWeight: 600, fontFamily: 'Jost',
                  display: 'inline-flex', alignItems: 'center',
                  '&:hover': { border: '1.5px solid rgba(255,255,255,0.6)', bgcolor: 'rgba(255,255,255,0.05)' },
                }}>Read the docs</Box>
              </Stack>
            </Grid>

            {/* Stats grid */}
            <Grid size={{ xs: 12, lg: 6 }}>
              <Grid container spacing={2} sx={{ animation: `${fadeUp} 0.8s 0.3s ease both` }}>
                {[
                  { value: 14, suffix: 'ms', label: 'Average detection latency', accent: true },
                  { value: 29, suffix: '+', label: 'AML rules out of the box', accent: false },
                  { value: 100, suffix: '%', label: 'CBN / NFIU / NDPR aligned', accent: false },
                  { value: 6, suffix: ' APIs', label: 'Verification & ingest endpoints', accent: false },
                ].map((s, i) => (
                  <Grid key={i} size={{ xs: 6 }}>
                    <Box sx={{
                      p: 3, height: '100%',
                      bgcolor: s.accent ? 'rgba(217,249,157,0.1)' : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${s.accent ? 'rgba(217,249,157,0.3)' : 'rgba(255,255,255,0.1)'}`,
                    }}>
                      <Typography sx={{
                        fontSize: { xs: '2rem', md: '2.5rem' }, fontWeight: 900,
                        color: s.accent ? '#d9f99d' : '#ffffff', fontFamily: 'Jost', lineHeight: 1,
                      }}>
                        {i < 3 ? <Counter to={s.value} suffix={s.suffix} /> : <>{s.value}{s.suffix}</>}
                      </Typography>
                      <Typography sx={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.55)', mt: 0.75, lineHeight: 1.4 }}>
                        {s.label}
                      </Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Grid>
          </Grid>
        </Container>
      </Box>

      <ComplianceBar />
    </Box>
  )
}

// ── Compliance ticker (horizontal scroll) ─────────────────────────────────────
function ComplianceBar() {
  const items = [
    'CBN AML/CFT Framework',
    'NFIU Reporting Standards',
    'NDPR Data Privacy',
    'FATF Guidelines',
    'Basel III Risk Controls',
    'KYC Identity Verification',
    'PEP & Sanctions Screening',
    'STR / CTR Reporting',
    'Customer Due Diligence',
    'Suspicious Activity Monitoring',
  ]
  // No gap on the container — padding is symmetric inside each item so -50% lands
  // exactly at the start of the duplicate, giving a truly seamless infinite loop.
  return (
    <Box sx={{
      bgcolor: '#001b5e', py: 2.5, overflow: 'hidden', flexShrink: 0, position: 'relative',
      '&::before': {
        content: '""', position: 'absolute', top: 0, left: 0, bottom: 0, width: 80,
        background: 'linear-gradient(to right, #001b5e, transparent)', zIndex: 1, pointerEvents: 'none',
      },
      '&::after': {
        content: '""', position: 'absolute', top: 0, right: 0, bottom: 0, width: 80,
        background: 'linear-gradient(to left, #001b5e, transparent)', zIndex: 1, pointerEvents: 'none',
      },
    }}>
      <Box sx={{
        display: 'flex', alignItems: 'center', width: 'max-content',
        animation: `${scrollLeft} 32s linear infinite`,
      }}>
        {[...items, ...items].map((item, i) => (
          <Stack key={i} direction="row" sx={{ alignItems: 'center', gap: 2, flexShrink: 0, px: 3.5 }}>
            <Box sx={{ width: 4, height: 4, bgcolor: '#d9f99d', borderRadius: '50%', flexShrink: 0 }} />
            <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap', letterSpacing: '0.04em' }}>
              {item}
            </Typography>
          </Stack>
        ))}
      </Box>
    </Box>
  )
}

// ── 360° Customer Risk Profile ────────────────────────────────────────────────
const RISK_DIMENSIONS = [
  { Icon: FingerprintIcon,  color: '#60a5fa',  label: 'Identity',     desc: 'BVN, NIN, liveness score, document OCR',        status: 'Verified',      ok: true  },
  { Icon: ElectricBoltIcon, color: '#d9f99d',  label: 'Transactions', desc: 'Velocity, amount patterns, channel switching',   status: '3 anomalies',   ok: false },
  { Icon: LocationOnIcon,   color: '#f472b6',  label: 'Location',     desc: 'GPS, IP-geo, impossible travel detection',       status: 'Lagos, NG',     ok: true  },
  { Icon: ManageSearchIcon, color: '#a78bfa',  label: 'Behavior',     desc: 'Login cadence, session timing, OTP patterns',    status: 'OTP spike',     ok: false },
  { Icon: HubIcon,          color: '#34d399',  label: 'Network',      desc: 'Shared devices, account clusters, transfer rings', status: 'No clusters', ok: true  },
  { Icon: PolicyIcon,       color: '#fbbf24',  label: 'Compliance',   desc: 'PEP status, sanctions, STR/CTR history',         status: 'No PEP flags',  ok: true  },
  { Icon: DevicesIcon,      color: '#fb923c',  label: 'Device',       desc: 'Fingerprint, browser, app version, IP reputation', status: 'Known device', ok: true },
  { Icon: RadarIcon,        color: '#f87171',  label: 'Velocity',     desc: '29+ AML rules scored in parallel, sub-14ms',     status: 'Score: 87',    ok: false },
]

function CustomerRiskProfile() {
  const [activeIdx, setActiveIdx] = useState(0)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    const t = setInterval(() => {
      setFading(true)
      setTimeout(() => {
        setActiveIdx(i => (i + 1) % RISK_DIMENSIONS.length)
        setFading(false)
      }, 350)
    }, 2800)
    return () => clearInterval(t)
  }, [])

  const dim = RISK_DIMENSIONS[activeIdx]

  return (
    // Gradient bridges the compliance bar (#001b5e) into the dark section
    <Box sx={{
      background: 'linear-gradient(to bottom, #001b5e 0%, #040e22 28%, #040e22 100%)',
      py: { xs: 10, md: 14 }, position: 'relative', overflow: 'hidden',
    }}>
      {/* Subtle dot grid */}
      <Box sx={{ position: 'absolute', inset: 0, opacity: 0.03,
        backgroundImage: 'radial-gradient(circle, #d9f99d 1px, transparent 1px)',
        backgroundSize: '40px 40px', pointerEvents: 'none' }} />
      {/* Blue glow right */}
      <Box sx={{ position: 'absolute', top: '15%', right: '-5%', width: 520, height: 520,
        bgcolor: '#00288e', opacity: 0.14, borderRadius: '50%', filter: 'blur(110px)', pointerEvents: 'none' }} />
      {/* Accent glow left */}
      <Box sx={{ position: 'absolute', bottom: '5%', left: '-8%', width: 360, height: 360,
        bgcolor: '#d9f99d', opacity: 0.04, borderRadius: '50%', filter: 'blur(90px)', pointerEvents: 'none' }} />

      <Container maxWidth="lg" sx={{ position: 'relative' }}>

        {/* ── Section header (full width) ── */}
        <Box sx={{ mb: { xs: 7, md: 9 }, maxWidth: 640 }}>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 800, color: '#d9f99d',
            textTransform: 'uppercase', letterSpacing: '0.14em', mb: 1.5 }}>
            Customer Intelligence
          </Typography>
          <Typography sx={{ fontSize: { xs: '2.25rem', md: '3rem' }, fontWeight: 900,
            color: '#ffffff', fontFamily: 'Jost', lineHeight: 1.1, mb: 2.5 }}>
            A holistic, continuous<br />360° risk profile.
          </Typography>
          <Typography sx={{ fontSize: '1rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.85, maxWidth: 560 }}>
            OpenIV doesn't score events in isolation. Every transaction, login, OTP request,
            and location ping continuously updates a unified risk model for each customer —
            so your team always knows the full picture, not just the last action.
          </Typography>
        </Box>

        <Grid container spacing={{ xs: 6, lg: 8 }} sx={{ alignItems: 'stretch' }}>

          {/* ── Left: animated dimension spotlight ── */}
          <Grid size={{ xs: 12, lg: 5 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 3 }}>

              {/* Active dimension card */}
              <Box sx={{
                flex: 1, p: { xs: 4, md: 5 },
                border: `1px solid ${dim.color}28`,
                bgcolor: `${dim.color}08`,
                position: 'relative', overflow: 'hidden',
                transition: 'border-color 0.6s ease, background-color 0.6s ease',
              }}>
                {/* Colour wash behind icon */}
                <Box sx={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160,
                  bgcolor: dim.color, opacity: 0.06, borderRadius: '50%', filter: 'blur(40px)',
                  transition: 'background-color 0.6s ease',
                }} />

                <Box sx={{
                  opacity: fading ? 0 : 1,
                  transform: fading ? 'translateY(14px)' : 'translateY(0)',
                  transition: 'opacity 0.35s ease, transform 0.35s ease',
                }}>
                  <Box sx={{ width: 52, height: 52, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', mb: 3, border: `1px solid ${dim.color}40`,
                    bgcolor: `${dim.color}12` }}>
                    <dim.Icon sx={{ fontSize: '1.625rem', color: dim.color }} />
                  </Box>

                  <Typography sx={{ fontSize: { xs: '1.75rem', md: '2.25rem' }, fontWeight: 900,
                    color: '#ffffff', fontFamily: 'Jost', lineHeight: 1.1, mb: 1.5 }}>
                    {dim.label}
                  </Typography>

                  <Typography sx={{ fontSize: '0.9375rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.75 }}>
                    {dim.desc}
                  </Typography>

                  <Box sx={{ display: 'inline-flex', mt: 3, px: 1.5, py: 0.5,
                    border: `1px solid ${dim.color}50`, bgcolor: `${dim.color}10` }}>
                    <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: dim.color,
                      letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'Jost' }}>
                      {`${activeIdx + 1} of ${RISK_DIMENSIONS.length}`}
                    </Typography>
                  </Box>
                </Box>
              </Box>

              {/* Progress dots + all icon chips */}
              <Box>
                {/* Dot bar */}
                <Box sx={{ display: 'flex', gap: 0.75, mb: 2.5 }}>
                  {RISK_DIMENSIONS.map((_, i) => (
                    <Box key={i} onClick={() => { if (!fading) { setFading(true); setTimeout(() => { setActiveIdx(i); setFading(false) }, 350) } }}
                      sx={{
                        height: 3, flex: i === activeIdx ? 2.5 : 1,
                        bgcolor: i === activeIdx ? dim.color : 'rgba(255,255,255,0.18)',
                        cursor: 'pointer', transition: 'all 0.4s ease',
                        '&:hover': { bgcolor: i === activeIdx ? dim.color : 'rgba(255,255,255,0.35)' },
                      }} />
                  ))}
                </Box>

                {/* Mini icon grid */}
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {RISK_DIMENSIONS.map((d, i) => (
                    <Box key={d.label} onClick={() => { if (!fading) { setFading(true); setTimeout(() => { setActiveIdx(i); setFading(false) }, 350) } }}
                      sx={{
                        width: 34, height: 34, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', cursor: 'pointer',
                        border: `1px solid ${i === activeIdx ? d.color + '80' : 'rgba(255,255,255,0.1)'}`,
                        bgcolor: i === activeIdx ? `${d.color}18` : 'rgba(255,255,255,0.03)',
                        transition: 'all 0.3s ease',
                        '&:hover': { borderColor: d.color + '60', bgcolor: `${d.color}12` },
                      }}>
                      <d.Icon sx={{ fontSize: '0.875rem', color: i === activeIdx ? d.color : 'rgba(255,255,255,0.35)',
                        transition: 'color 0.3s ease' }} />
                    </Box>
                  ))}
                </Box>
              </Box>
            </Box>
          </Grid>

          {/* ── Right: profile card visual ── */}
          <Grid size={{ xs: 12, lg: 7 }}>
            <Box sx={{ bgcolor: '#08121f', border: '1px solid rgba(255,255,255,0.09)',
              boxShadow: '0 32px 80px rgba(0,0,0,0.5)', height: '100%', display: 'flex', flexDirection: 'column' }}>

              {/* Card header */}
              <Box sx={{ px: 3, py: 2, borderBottom: '1px solid rgba(255,255,255,0.07)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <Typography sx={{ fontSize: '0.6875rem', fontWeight: 800, color: 'rgba(255,255,255,0.3)',
                  letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: 'Jost' }}>
                  Customer Risk Profile
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#d9f99d',
                    animation: `${pulse} 1.8s ease-in-out infinite` }} />
                  <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#d9f99d',
                    letterSpacing: '0.12em', textTransform: 'uppercase' }}>Live</Typography>
                </Box>
              </Box>

              {/* Customer identity row */}
              <Box sx={{ px: 3, py: 2.5, borderBottom: '1px solid rgba(255,255,255,0.07)',
                display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                <Box sx={{ width: 40, height: 40, bgcolor: '#00288e', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Typography sx={{ fontSize: '0.875rem', fontWeight: 800, color: '#d9f99d', fontFamily: 'Jost' }}>AO</Typography>
                </Box>
                <Box>
                  <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: '#ffffff', fontFamily: 'Jost', lineHeight: 1.2 }}>
                    Adebayo Okonkwo
                  </Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace' }}>
                    CUS-00142 · updated 2s ago
                  </Typography>
                </Box>
              </Box>

              {/* Risk score */}
              <Box sx={{ px: 3, py: 3, borderBottom: '1px solid rgba(255,255,255,0.07)',
                display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                <Box>
                  <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: 'rgba(255,255,255,0.3)',
                    letterSpacing: '0.12em', textTransform: 'uppercase', mb: 0.5 }}>Composite Score</Typography>
                  <Typography sx={{ fontSize: '3.5rem', fontWeight: 900, color: '#f87171',
                    fontFamily: 'Jost', lineHeight: 1 }}>87</Typography>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ mb: 1.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography sx={{ fontSize: '0.6875rem', color: 'rgba(255,255,255,0.35)' }}>Risk Level</Typography>
                      <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#f87171' }}>HIGH</Typography>
                    </Box>
                    <Box sx={{ height: 4, bgcolor: 'rgba(255,255,255,0.08)' }}>
                      <Box sx={{ height: '100%', width: '87%', bgcolor: '#f87171' }} />
                    </Box>
                  </Box>
                  <Box sx={{ display: 'inline-flex', px: 1.5, py: 0.5,
                    bgcolor: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)' }}>
                    <Typography sx={{ fontSize: '0.6875rem', fontWeight: 800, color: '#f87171',
                      letterSpacing: '0.1em', textTransform: 'uppercase' }}>Manual Review</Typography>
                  </Box>
                </Box>
              </Box>

              {/* Dimension rows */}
              <Box sx={{ flex: 1 }}>
                {RISK_DIMENSIONS.map((d, i) => (
                  <Box key={d.label} sx={{
                    px: 3, py: 1.5, display: 'flex', alignItems: 'center', gap: 2,
                    borderBottom: i < RISK_DIMENSIONS.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                    bgcolor: i === activeIdx ? `${d.color}08` : (!d.ok ? 'rgba(248,113,113,0.03)' : 'transparent'),
                    transition: 'background-color 0.4s ease',
                  }}>
                    <d.Icon sx={{ fontSize: '0.875rem',
                      color: i === activeIdx ? d.color : 'rgba(255,255,255,0.3)',
                      flexShrink: 0, transition: 'color 0.4s ease' }} />
                    <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600,
                      color: i === activeIdx ? '#ffffff' : 'rgba(255,255,255,0.5)',
                      fontFamily: 'Jost', flex: 1, transition: 'color 0.4s ease' }}>{d.label}</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 5, height: 5, borderRadius: '50%',
                        bgcolor: d.ok ? '#34d399' : '#f87171', flexShrink: 0 }} />
                      <Typography sx={{ fontSize: '0.75rem', fontWeight: 600,
                        color: d.ok ? '#34d399' : '#f87171', fontFamily: 'Jost' }}>{d.status}</Typography>
                    </Box>
                  </Box>
                ))}
              </Box>

              {/* Footer */}
              <Box sx={{ px: 3, py: 1.75, borderTop: '1px solid rgba(255,255,255,0.07)', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography sx={{ fontSize: '0.6875rem', color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace' }}>
                  29 rules · 13.2ms · CBN aligned
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.75 }}>
                  {['#f87171', '#fbbf24', '#34d399'].map((c, i) => (
                    <Box key={i} sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: c, opacity: 0.5 }} />
                  ))}
                </Box>
              </Box>
            </Box>
          </Grid>

        </Grid>
      </Container>
    </Box>
  )
}

// ── Feature spotlight (new section) ──────────────────────────────────────────
const SPOTLIGHTS = [
  {
    Icon: ElectricBoltIcon,
    iconColor: '#16a34a',
    iconBg: '#dcfce7',
    color: '#d9f99d',
    bg: '#f0fdf4',
    border: '#bbf7d0',
    title: 'Sub-14ms Fraud Scoring',
    body: 'Every transaction is scored synchronously before the response returns. Velocity spikes, impossible travel, late-night patterns, OTP anomalies — all checked in parallel.',
    detail: '29+ rules · real-time · auto case creation',
  },
  {
    Icon: FingerprintIcon,
    iconColor: '#2563eb',
    iconBg: '#dbeafe',
    color: '#60a5fa',
    bg: '#eff6ff',
    border: '#bfdbfe',
    title: 'Behavioral KYC Pipeline',
    body: 'BVN lookup, NIN cross-check, phone registry match, liveness score, and global PEP/sanctions screening — all in a single pipeline, with a blended risk score out.',
    detail: 'NIBSS · NIMC · NCC · Liveness · PEP screening',
  },
  {
    Icon: PolicyIcon,
    iconColor: '#d97706',
    iconBg: '#fef3c7',
    color: '#f59e0b',
    bg: '#fffbeb',
    border: '#fde68a',
    title: 'Regulatory Reporting',
    body: 'STR, CTR, and KYC audit exports pre-formatted for CBN and NFIU submissions. NDPR-safe data handling with full institution-level audit trails.',
    detail: 'CBN · NFIU · NDPR · FATF',
  },
]

function FeatureSpotlight() {
  return (
    <Box sx={{ bgcolor: '#ffffff', py: { xs: 10, md: 14 }, borderBottom: '1px solid #f1f5f9' }}>
      <Container maxWidth="lg">
        <Box sx={{ textAlign: 'center', mb: 8 }}>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 800, color: '#00288e',
            textTransform: 'uppercase', letterSpacing: '0.14em', mb: 1.5 }}>
            What we do
          </Typography>
          <Typography sx={{ fontSize: { xs: '2rem', md: '2.75rem' }, fontWeight: 900,
            color: '#0f172a', fontFamily: 'Jost', lineHeight: 1.12, mb: 2 }}>
            Three pillars. Zero compromise.
          </Typography>
          <Typography sx={{ fontSize: '1.0625rem', color: '#64748b', maxWidth: 540, mx: 'auto', lineHeight: 1.7 }}>
            Fraud detection, identity verification, and compliance reporting — all connected, all real-time.
          </Typography>
        </Box>

        <Grid container spacing={3}>
          {SPOTLIGHTS.map((s) => (
            <Grid key={s.title} size={{ xs: 12, md: 4 }}>
              <Box sx={{
                p: 4, height: '100%', bgcolor: s.bg,
                border: `1px solid ${s.border}`,
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 12px 32px rgba(0,0,0,0.07)' },
              }}>
                <Box sx={{ width: 44, height: 44, bgcolor: s.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2.5 }}>
                  <s.Icon sx={{ fontSize: '1.375rem', color: s.iconColor }} />
                </Box>
                <Typography sx={{ fontSize: '1.1875rem', fontWeight: 800, color: '#0f172a',
                  fontFamily: 'Jost', mb: 1.5 }}>{s.title}</Typography>
                <Typography sx={{ fontSize: '0.9rem', color: '#475569', lineHeight: 1.7, mb: 2.5 }}>{s.body}</Typography>
                <Box sx={{ display: 'inline-flex', px: 1.25, py: 0.5, bgcolor: 'rgba(255,255,255,0.7)',
                  border: `1px solid ${s.border}` }}>
                  <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: s.iconColor,
                    letterSpacing: '0.06em', fontFamily: 'Jost' }}>{s.detail}</Typography>
                </Box>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  )
}

// ── Full feature grid ─────────────────────────────────────────────────────────
const FEATURES = [
  { Icon: ElectricBoltIcon, iconColor: '#16a34a', iconBg: '#dcfce7', title: 'Real-Time Transaction Monitoring', body: 'Scores every transaction against 29+ AML/fraud rules before it settles — velocity, geo-velocity, impossible travel, late-night, OTP anomalies, and more.', tag: 'Real-time' },
  { Icon: FingerprintIcon,  iconColor: '#2563eb', iconBg: '#dbeafe', title: 'Behavioral KYC Pipeline', body: 'BVN, NIN, phone verification, liveness check, and PEP screening in a single API call. Risk score blends identity and behavioral signals.', tag: 'Identity' },
  { Icon: RadarIcon,        iconColor: '#7c3aed', iconBg: '#ede9fe', title: 'AML Surveillance', body: 'Automated case creation when risk crosses your threshold. Pattern matching, customer risk scoring, and escalation workflows — all configurable.', tag: 'Compliance' },
  { Icon: PolicyIcon,       iconColor: '#d97706', iconBg: '#fef3c7', title: 'CBN / NFIU Reporting', body: 'Generate STR and CTR-ready reports aligned to CBN and NFIU formats. NDPR-safe data handling with full audit trails across your institution.', tag: 'Regulatory' },
  { Icon: HubIcon,          iconColor: '#0891b2', iconBg: '#cffafe', title: 'Data Beam API', body: 'Stream transactions, KYC records, logins, device signals, and OTP events via a single authenticated POST. SDKs for Node.js, Python, Go, and Java.', tag: 'Integration' },
  { Icon: BarChartIcon,     iconColor: '#00288e', iconBg: '#e0e7ff', title: 'Intelligence Dashboard', body: 'Real-time case queue, geospatial heatmaps, behavioral pattern explorer, and team-based role management — built for compliance officers and analysts.', tag: 'Analytics' },
]

function Features() {
  return (
    <Box sx={{ bgcolor: '#f8fafc', py: { xs: 10, md: 14 } }}>
      <Container maxWidth="lg">
        <Box sx={{ textAlign: 'center', mb: 8 }}>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 800, color: '#00288e',
            textTransform: 'uppercase', letterSpacing: '0.14em', mb: 1.5 }}>
            Platform capabilities
          </Typography>
          <Typography sx={{ fontSize: { xs: '2rem', md: '2.75rem' }, fontWeight: 900,
            color: '#0f172a', fontFamily: 'Jost', lineHeight: 1.15, mb: 2 }}>
            Everything your compliance team needs.
          </Typography>
          <Typography sx={{ fontSize: '1.0625rem', color: '#64748b', maxWidth: 560, mx: 'auto', lineHeight: 1.7 }}>
            One platform covering fraud detection, AML, KYC, identity verification, and regulatory reporting.
          </Typography>
        </Box>

        <Grid container spacing={2}>
          {FEATURES.map((f) => (
            <Grid key={f.title} size={{ xs: 12, sm: 6, lg: 4 }}>
              <Box sx={{
                p: 3.5, height: '100%', bgcolor: '#ffffff', border: '1px solid #e2e8f0',
                transition: 'border-color 0.2s, box-shadow 0.2s',
                '&:hover': { borderColor: '#00288e', boxShadow: '0 4px 24px rgba(0,40,142,0.08)' },
              }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
                  <Box sx={{ width: 36, height: 36, bgcolor: f.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <f.Icon sx={{ fontSize: '1.125rem', color: f.iconColor }} />
                  </Box>
                  <Box sx={{ px: 1, py: 0.25, bgcolor: '#f0f4ff', color: '#00288e',
                    fontSize: '0.625rem', fontWeight: 800, letterSpacing: '0.08em',
                    textTransform: 'uppercase', fontFamily: 'Jost' }}>{f.tag}</Box>
                </Box>
                <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost', mb: 1 }}>{f.title}</Typography>
                <Typography sx={{ fontSize: '0.875rem', color: '#64748b', lineHeight: 1.65 }}>{f.body}</Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  )
}

// ── How it works ──────────────────────────────────────────────────────────────
const STEPS = [
  { n: '01', title: 'Request access', body: 'Your institution gets a dashboard login and an API key within 24 hours of approval.' },
  { n: '02', title: 'Beam your data', body: 'Stream transactions, KYC records, and identity events to OpenIV with a single authenticated POST.' },
  { n: '03', title: 'Stay compliant', body: 'OpenIV scores risk, opens cases automatically, and generates CBN-ready compliance reports in real time.' },
]

function HowItWorks() {
  return (
    <Box sx={{ bgcolor: '#ffffff', py: { xs: 10, md: 14 } }}>
      <Container maxWidth="lg">
        <Box sx={{ textAlign: 'center', mb: 8 }}>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 800, color: '#00288e',
            textTransform: 'uppercase', letterSpacing: '0.14em', mb: 1.5 }}>
            How it works
          </Typography>
          <Typography sx={{ fontSize: { xs: '2rem', md: '2.75rem' }, fontWeight: 900,
            color: '#0f172a', fontFamily: 'Jost', lineHeight: 1.15 }}>
            Up and running in one day.
          </Typography>
        </Box>
        <Grid container spacing={3}>
          {STEPS.map((s, i) => (
            <Grid key={s.n} size={{ xs: 12, md: 4 }}>
              <Box sx={{ position: 'relative', p: 4, border: '1px solid #e2e8f0', height: '100%' }}>
                {i < STEPS.length - 1 && (
                  <Box sx={{ display: { xs: 'none', md: 'block' }, position: 'absolute',
                    top: '2.5rem', right: -17, width: 34, height: 1, bgcolor: '#e2e8f0', zIndex: 1 }} />
                )}
                <Typography sx={{ fontSize: '2.5rem', fontWeight: 900, color: '#e2e8f0', fontFamily: 'Jost', lineHeight: 1, mb: 2 }}>{s.n}</Typography>
                <Typography sx={{ fontSize: '1.0625rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost', mb: 1.25 }}>{s.title}</Typography>
                <Typography sx={{ fontSize: '0.9rem', color: '#64748b', lineHeight: 1.65 }}>{s.body}</Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  )
}

// ── API section ───────────────────────────────────────────────────────────────
const CODE = `curl -X POST https://api.openiv.ng/api/v1/beam/transactions \\
  -H "Authorization: Bearer $OPENIV_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "customer_id": "CUS-001",
    "amount": 14250000,
    "channel": "wire",
    "occurred_at": "2026-05-26T09:41:00Z"
  }'

# Response — back in <14ms
{
  "ok": true,
  "analysis": {
    "risk_score": 12,
    "risk_level": "LOW",
    "recommended_action": "ACCEPT"
  }
}`

function ApiSection() {
  const [copied, setCopied] = useState(false)
  const copy = () => { navigator.clipboard.writeText(CODE); setCopied(true); setTimeout(() => setCopied(false), 1800) }
  return (
    <Box sx={{ bgcolor: '#f8fafc', py: { xs: 10, md: 14 }, borderTop: '1px solid #e2e8f0' }}>
      <Container maxWidth="lg">
        <Grid container spacing={8} sx={{ alignItems: 'center' }}>
          <Grid size={{ xs: 12, md: 5 }}>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 800, color: '#00288e',
              textTransform: 'uppercase', letterSpacing: '0.14em', mb: 1.5 }}>
              Integration
            </Typography>
            <Typography sx={{ fontSize: { xs: '1.875rem', md: '2.5rem' }, fontWeight: 900,
              color: '#0f172a', fontFamily: 'Jost', lineHeight: 1.15, mb: 2 }}>
              One API call.<br />Full fraud coverage.
            </Typography>
            <Typography sx={{ fontSize: '0.9375rem', color: '#64748b', lineHeight: 1.75, mb: 4 }}>
              Stream a transaction with a single POST and get a risk score, triggered rules, and a recommended action back in under 14 milliseconds. No configuration required.
            </Typography>
            <Stack direction="row" spacing={2}>
              <Box component={Link} to="/developers" sx={{
                textDecoration: 'none', px: 2.5, py: 1, bgcolor: '#00288e', color: '#ffffff',
                fontSize: '0.875rem', fontWeight: 700, fontFamily: 'Jost',
                '&:hover': { bgcolor: '#001f6e' },
              }}>View full docs →</Box>
              <Box component={Link} to="/request-access" sx={{
                textDecoration: 'none', px: 2.5, py: 1,
                border: '1.5px solid #e2e8f0', color: '#475569',
                fontSize: '0.875rem', fontWeight: 600, fontFamily: 'Jost',
                '&:hover': { borderColor: '#00288e', color: '#00288e' },
              }}>Get API key</Box>
            </Stack>
          </Grid>

          <Grid size={{ xs: 12, md: 7 }}>
            <Box sx={{ position: 'relative', bgcolor: '#0d1117', border: '1px solid #1e293b',
              boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
              <Box sx={{ px: 2, py: 1.25, borderBottom: '1px solid #1e293b',
                display: 'flex', alignItems: 'center', gap: 0.75 }}>
                {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
                  <Box key={c} sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: c }} />
                ))}
                <Typography sx={{ ml: 1, fontSize: '0.6875rem', color: '#4b5563', fontFamily: 'monospace' }}>terminal</Typography>
              </Box>
              <Box sx={{ p: 3, overflowX: 'auto', fontFamily: '"Fira Code","SF Mono",monospace', fontSize: '0.8125rem', lineHeight: 1.8 }}>
                {CODE.split('\n').map((line, i) => (
                  <Box key={i} component="div" sx={{ whiteSpace: 'pre', color: line.startsWith('#') ? '#6b7280' : line.includes('curl') ? '#60a5fa' : line.includes('"') ? '#a3e635' : '#d9f99d' }}>
                    {line}
                  </Box>
                ))}
              </Box>
              <Box onClick={copy} sx={{
                position: 'absolute', top: 44, right: 12, cursor: 'pointer',
                px: 1.25, py: 0.375, bgcolor: '#1e293b',
                color: copied ? '#a3e635' : '#6b7280', fontSize: '0.6875rem', fontFamily: 'Jost', fontWeight: 600,
                userSelect: 'none', '&:hover': { color: '#e5e7eb' },
              }}>{copied ? 'Copied ✓' : 'Copy'}</Box>
            </Box>
          </Grid>
        </Grid>
      </Container>
    </Box>
  )
}

// ── Final CTA ─────────────────────────────────────────────────────────────────
function FinalCTA() {
  return (
    <Box sx={{ bgcolor: '#00288e', py: { xs: 12, md: 16 }, position: 'relative', overflow: 'hidden' }}>
      <Box sx={{
        position: 'absolute', inset: 0, opacity: 0.05,
        backgroundImage: 'radial-gradient(circle, #d9f99d 1px, transparent 1px)',
        backgroundSize: '32px 32px',
      }} />
      <Container maxWidth="md" sx={{ position: 'relative', textAlign: 'center' }}>
        <Typography sx={{ fontSize: { xs: '2.25rem', md: '3.25rem' }, fontWeight: 900,
          color: '#ffffff', fontFamily: 'Jost', lineHeight: 1.1, mb: 2.5 }}>
          Protect your institution<br />from day one.
        </Typography>
        <Typography sx={{ fontSize: '1.0625rem', color: 'rgba(255,255,255,0.65)',
          maxWidth: 480, mx: 'auto', lineHeight: 1.75, mb: 5 }}>
          Join the Nigerian financial institutions already using OpenIV to detect fraud in real time and stay ahead of compliance requirements.
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ justifyContent: 'center' }}>
          <Box component={Link} to="/dashboard" sx={{
            textDecoration: 'none', px: 4, py: 1.625, bgcolor: '#d9f99d', color: '#00288e',
            fontSize: '1rem', fontWeight: 800, fontFamily: 'Jost',
            display: 'inline-flex', alignItems: 'center', gap: 1,
            '&:hover': { bgcolor: '#bef264' },
          }}>Go to dashboard →</Box>
          <Box component={Link} to="/request-access" sx={{
            textDecoration: 'none', px: 4, py: 1.625,
            border: '1.5px solid rgba(255,255,255,0.3)', color: '#ffffff',
            fontSize: '1rem', fontWeight: 600, fontFamily: 'Jost',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' },
          }}>Request API access</Box>
        </Stack>
      </Container>
    </Box>
  )
}


// ── Page ──────────────────────────────────────────────────────────────────────
export default function LaunchPage() {
  return (
    <Box sx={{ fontFamily: 'Jost, Inter, sans-serif' }}>
      <Navbar />
      <Hero />
      <CustomerRiskProfile />
      <FeatureSpotlight />
      <Features />
      <HowItWorks />
      <ApiSection />
      <FinalCTA />
      <SharedFooter />
    </Box>
  )
}
