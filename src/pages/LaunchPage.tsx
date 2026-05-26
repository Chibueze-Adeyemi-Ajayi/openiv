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
  const items = ['CBN AML/CFT Framework', 'NFIU Reporting Standards', 'NDPR Data Privacy', 'FATF Guidelines', 'Basel III Risk Controls']
  return (
    <Box sx={{
      bgcolor: '#001b5e', py: 2.5, overflow: 'hidden', flexShrink: 0, position: 'relative',
      '&::before': {
        content: '""', position: 'absolute', top: 0, left: 0, bottom: 0, width: 60,
        background: 'linear-gradient(to right, #001b5e, transparent)', zIndex: 1, pointerEvents: 'none',
      },
      '&::after': {
        content: '""', position: 'absolute', top: 0, right: 0, bottom: 0, width: 60,
        background: 'linear-gradient(to left, #001b5e, transparent)', zIndex: 1, pointerEvents: 'none',
      },
    }}>
      <Box sx={{
        display: 'flex', gap: 5, alignItems: 'center', width: 'max-content',
        animation: `${scrollLeft} 18s linear infinite`,
        '&:hover': { animationPlayState: 'paused' },
      }}>
        {[...items, ...items].map((item, i) => (
          <Stack key={i} direction="row" sx={{ alignItems: 'center', gap: 2, flexShrink: 0 }}>
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
    detail: 'Dojah-powered · NIBSS · NIMC · NCC',
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
      <FeatureSpotlight />
      <Features />
      <HowItWorks />
      <ApiSection />
      <FinalCTA />
      <SharedFooter />
    </Box>
  )
}
