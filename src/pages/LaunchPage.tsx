import { useEffect, useRef, useState } from 'react'
import { Box, Container, Typography, Stack } from '@mui/material'
import { Link } from 'react-router-dom'
import { keyframes } from '@mui/system'
import SharedFooter from '@/components/landing/Footer'

// ── Animations ────────────────────────────────────────────────────────────────
const blink = keyframes`
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.25; }
`

// ── Reveal-on-scroll wrapper ──────────────────────────────────────────────────
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

// ── Section eyebrow ───────────────────────────────────────────────────────────
function Eyebrow({ text }: { text: string }) {
  return (
    <Reveal sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, mb: 1.75 }}>
      <Box sx={{ width: 16, height: '2px', bgcolor: '#00288e' }} />
      <Typography sx={{
        fontSize: '0.7rem', fontWeight: 700, color: '#00288e',
        letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'Jost',
      }}>
        {text}
      </Typography>
    </Reveal>
  )
}

// ── Brand mark (text logo) ────────────────────────────────────────────────────
function BrandMark({ light = false }: { light?: boolean }) {
  return (
    <Box component={Link} to="/" sx={{ textDecoration: 'none', display: 'inline-flex', position: 'relative' }}>
      <Box sx={{
        position: 'absolute', top: -4, left: 0, width: 24, height: '2px',
        bgcolor: light ? '#ffffff' : '#00288e', borderRadius: '1px',
      }} />
      <Typography sx={{
        fontSize: '1.125rem', fontWeight: 700,
        color: light ? '#ffffff' : '#00288e',
        fontFamily: 'Jost', letterSpacing: '0.1em',
      }}>
        OPENIV
      </Typography>
    </Box>
  )
}

// ── NAV ───────────────────────────────────────────────────────────────────────
function Navbar() {
  return (
    <Box component="nav" sx={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      height: 60, display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', px: { xs: '6vw', md: '6vw' },
      bgcolor: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)',
      borderBottom: '1px solid #e2e8f0',
    }}>
      <BrandMark />
      <Stack direction="row" sx={{ gap: { xs: 2, md: 4 }, alignItems: 'center' }}>
        {[
          { to: '#solution', label: 'Product' },
          { to: '#pricing',  label: 'Pricing' },
          { to: '#cbn',      label: 'CBN Compliance' },
        ].map((n) => (
          <Box key={n.to} component="a" href={n.to} sx={{
            textDecoration: 'none',
            fontSize: '0.875rem', fontWeight: 500, color: '#3a4a62',
            fontFamily: 'Jost', display: { xs: 'none', sm: 'inline' },
            '&:hover': { color: '#00288e' }, transition: 'color 0.15s',
          }}>
            {n.label}
          </Box>
        ))}
        <Box component={Link} to="/request-access" sx={{
          textDecoration: 'none', bgcolor: '#00288e', color: '#ffffff',
          px: 2.75, py: 1.125, fontWeight: 700, fontSize: '0.875rem',
          letterSpacing: '0.02em', fontFamily: 'Jost',
          '&:hover': { opacity: 0.85 }, transition: 'opacity 0.15s',
        }}>
          Get a Demo
        </Box>
      </Stack>
    </Box>
  )
}

// ── HERO ──────────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <Box component="section" id="hero" sx={{
      pt: '140px', pb: '100px', px: '6vw',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      textAlign: 'center', bgcolor: '#ffffff',
    }}>
     ÷

      <Typography component="h1" sx={{
        fontSize: 'clamp(2.8rem, 5.5vw, 4.4rem)',
        fontWeight: 900, lineHeight: 0.97, letterSpacing: '-0.035em',
        color: '#0f1929', mb: 2.5, maxWidth: 720, fontFamily: 'Jost',
      }}>
        Fraud doesn't wait for<br />
        your <Box component="span" sx={{ color: '#00288e' }}>morning report.</Box>
      </Typography>

      <Typography sx={{
        fontSize: '1.1rem', fontWeight: 400, color: '#3a4a62',
        lineHeight: 1.65, maxWidth: 500, mx: 'auto', mb: 4.5, fontFamily: 'Jost',
      }}>
        Real-time AML, KYC, and fraud intelligence built natively for Nigerian financial institutions.
      </Typography>

      <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 1.5, mb: 1.75 }}>
        <Box component={Link} to="/request-access" sx={{
          textDecoration: 'none', bgcolor: '#00288e', color: '#ffffff',
          px: 3.75, py: 1.625, fontWeight: 700, fontSize: '0.95rem',
          fontFamily: 'Jost', display: 'inline-block',
          '&:hover': { opacity: 0.85 }, transition: 'opacity 0.15s',
        }}>
          Get a Demo
        </Box>
        <Box component="a" href="#solution" sx={{
          textDecoration: 'none', border: '1.5px solid #e2e8f0', color: '#3a4a62',
          px: 3, py: 1.625, fontWeight: 600, fontSize: '0.95rem',
          fontFamily: 'Jost', display: 'inline-block',
          '&:hover': { borderColor: '#00288e', color: '#00288e' },
          transition: 'border-color 0.15s, color 0.15s',
        }}>
          See how it works
        </Box>
      </Stack>

      <Typography sx={{
        fontSize: '0.8rem', color: '#6b7d96', letterSpacing: '0.03em', fontFamily: 'Jost',
      }}>
        Pay-as-you-go &nbsp;·&nbsp; No contracts &nbsp;·&nbsp; CBN-native
      </Typography>

      <HeroVisual />
    </Box>
  )
}

// ── Dashboard preview card ────────────────────────────────────────────────────
function HeroVisual() {
  return (
    <Reveal sx={{ mt: 7.5, width: '100%', maxWidth: 860 }}>
      <Box sx={{
        bgcolor: '#ffffff', border: '1px solid #e2e8f0',
        boxShadow: '0 4px 40px rgba(0,40,142,0.06)',
      }}>
        {/* Bar */}
        <Box sx={{
          bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0',
          px: 2, py: 1.25, display: 'flex', alignItems: 'center', gap: 1,
        }}>
          {['#ef4444', '#f59e0b', '#22c55e'].map((c) => (
            <Box key={c} sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: c }} />
          ))}
          <Box sx={{
            ml: 1, fontFamily: 'JetBrains Mono, monospace',
            fontSize: '0.7rem', color: '#6b7d96',
            bgcolor: '#ffffff', border: '1px solid #e2e8f0',
            px: 1.5, py: 0.375, flex: 1, maxWidth: 220,
          }}>
            openiv.ng · live dashboard
          </Box>
        </Box>

        {/* 3-col body */}
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' },
          textAlign: 'left',
        }}>
          {/* Col 1 — Flagged */}
          <Box sx={{
            p: 2.5,
            borderRight: { xs: 'none', md: '1px solid #e2e8f0' },
            borderBottom: { xs: '1px solid #e2e8f0', md: 'none' },
          }}>
            <Typography sx={{
              fontSize: '0.65rem', fontWeight: 700, color: '#dc2626',
              letterSpacing: '0.1em', textTransform: 'uppercase', mb: 1.5, fontFamily: 'Jost',
            }}>
              ⚠ Flagged — right now
            </Typography>
            <Typography sx={{
              fontSize: '2.8rem', fontWeight: 900, lineHeight: 1,
              letterSpacing: '-0.03em', color: '#dc2626', mb: 0.5, fontFamily: 'Jost',
            }}>
              94
            </Typography>
            <Typography sx={{
              fontSize: '0.72rem', color: '#6b7d96',
              fontFamily: 'JetBrains Mono, monospace', mb: 1.75, lineHeight: 1.5,
            }}>
              TXN-2847193 · ₦4.7M<br />Geo-velocity · 03:12am
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: 36 }}>
              {[
                { h: '30%', c: '#e2e8f0' },
                { h: '44%', c: '#bfdbfe' },
                { h: '58%', c: '#93c5fd' },
                { h: '36%', c: '#e2e8f0' },
                { h: '50%', c: '#bfdbfe' },
                { h: '96%', c: '#dc2626' },
                { h: '38%', c: '#e2e8f0' },
                { h: '28%', c: '#e2e8f0' },
              ].map((b, i) => (
                <Box key={i} sx={{ flex: 1, bgcolor: b.c, height: b.h, minHeight: '3px' }} />
              ))}
            </Box>
          </Box>

          {/* Col 2 — Live transactions */}
          <Box sx={{
            p: 2.5,
            borderRight: { xs: 'none', md: '1px solid #e2e8f0' },
            borderBottom: { xs: '1px solid #e2e8f0', md: 'none' },
          }}>
            <Typography sx={{
              fontSize: '0.65rem', fontWeight: 700, color: '#00288e',
              letterSpacing: '0.1em', textTransform: 'uppercase', mb: 1.5, fontFamily: 'Jost',
            }}>
              Live Transactions
            </Typography>
            {[
              { id: 'TXN-2847193', score: '94', bg: '#fee2e2', col: '#dc2626' },
              { id: 'TXN-2847180', score: '08', bg: '#dcfce7', col: '#16a34a' },
              { id: 'TXN-2847161', score: '51', bg: '#fef3c7', col: '#d97706' },
              { id: 'TXN-2847144', score: '14', bg: '#dcfce7', col: '#16a34a' },
              { id: 'TXN-2847130', score: '19', bg: '#dcfce7', col: '#16a34a' },
            ].map((tx, i, arr) => (
              <Box key={tx.id} sx={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                py: 0.875,
                borderBottom: i < arr.length - 1 ? '1px solid #e2e8f0' : 'none',
                fontSize: '0.78rem',
              }}>
                <Box sx={{
                  fontFamily: 'JetBrains Mono, monospace',
                  color: '#6b7d96', fontSize: '0.7rem',
                }}>
                  {tx.id}
                </Box>
                <Box sx={{
                  fontSize: '0.65rem', fontWeight: 700, px: 0.875, py: 0.25,
                  letterSpacing: '0.04em', bgcolor: tx.bg, color: tx.col, fontFamily: 'Jost',
                }}>
                  Score {tx.score}
                </Box>
              </Box>
            ))}
          </Box>

          {/* Col 3 — Customer profile */}
          <Box sx={{ p: 2.5 }}>
            <Typography sx={{
              fontSize: '0.65rem', fontWeight: 700, color: '#16a34a',
              letterSpacing: '0.1em', textTransform: 'uppercase', mb: 1.5, fontFamily: 'Jost',
            }}>
              Customer Profile · Live
            </Typography>
            {[
              { lbl: 'Normal behaviour range', w: '68%', c: '#86efac' },
              { lbl: 'Current risk level',     w: '90%', c: '#fca5a5' },
              { lbl: 'KYC completeness',       w: '100%', c: '#86efac' },
            ].map((p) => (
              <Box key={p.lbl} sx={{ mb: 1.25 }}>
                <Typography sx={{ fontSize: '0.7rem', color: '#6b7d96', mb: 0.5, fontFamily: 'Jost' }}>
                  {p.lbl}
                </Typography>
                <Box sx={{ height: 5, bgcolor: '#e2e8f0', overflow: 'hidden' }}>
                  <Box sx={{ height: '100%', width: p.w, bgcolor: p.c }} />
                </Box>
              </Box>
            ))}
            <Typography sx={{ fontSize: '0.7rem', color: '#6b7d96', mt: 1.25, fontFamily: 'Jost' }}>
              Updated continuously · BVN verified ✓
            </Typography>
          </Box>
        </Box>
      </Box>
    </Reveal>
  )
}

// ── TRUST STRIP ───────────────────────────────────────────────────────────────
function TrustStrip() {
  const insts = [
    'Commercial Banks', 'Microfinance Banks', 'Licensed Fintechs',
    'Bureau de Change', 'Payment Service Banks',
  ]
  return (
    <Box id="trust" sx={{
      py: 4, px: '6vw',
      borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0',
      bgcolor: '#f8fafc', textAlign: 'center',
    }}>
      <Typography sx={{
        fontSize: '0.78rem', fontWeight: 600, color: '#6b7d96',
        letterSpacing: '0.1em', textTransform: 'uppercase', mb: 2.5, fontFamily: 'Jost',
      }}>
        Built for every licensed institution in Nigeria
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 1.25 }}>
        {insts.map((i) => (
          <Box key={i} sx={{
            bgcolor: '#ffffff', border: '1px solid #e2e8f0',
            px: 2.25, py: 0.875, fontSize: '0.8rem',
            fontWeight: 600, color: '#3a4a62', fontFamily: 'Jost',
          }}>
            {i}
          </Box>
        ))}
      </Box>
    </Box>
  )
}

// ── STATS ─────────────────────────────────────────────────────────────────────
function Stats() {
  const stats = [
    { n: '₦5B+',        c: '#dc2626', l: 'AML fines paid by Nigerian institutions since 2021' },
    { n: '18 months',   c: '#00288e', l: 'CBN deadline to deploy automated AML — March 2026' },
    { n: 'Real-time',   c: '#16a34a', l: 'every transaction scored as it moves, not overnight' },
  ]
  return (
    <Box sx={{ px: '6vw', bgcolor: '#ffffff' }}>
      <Reveal sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
        maxWidth: 900, mx: 'auto',
        borderLeft: '1px solid #e2e8f0', borderTop: '1px solid #e2e8f0',
        borderBottom: '1px solid #e2e8f0',
      }}>
        {stats.map((s) => (
          <Box key={s.l} sx={{
            p: { xs: 4, md: 5 }, borderRight: '1px solid #e2e8f0', textAlign: 'center',
          }}>
            <Typography sx={{
              fontSize: '2.6rem', fontWeight: 900, color: s.c,
              letterSpacing: '-0.04em', lineHeight: 1, mb: 0.75, fontFamily: 'Jost',
            }}>
              {s.n}
            </Typography>
            <Typography sx={{ fontSize: '0.84rem', color: '#3a4a62', lineHeight: 1.5, fontFamily: 'Jost' }}>
              {s.l}
            </Typography>
          </Box>
        ))}
      </Reveal>
    </Box>
  )
}

// ── Shared section heading bits ───────────────────────────────────────────────
function SectionHead({ eyebrow, title, subtitle }: { eyebrow: string; title: React.ReactNode; subtitle?: string }) {
  return (
    <>
      <Eyebrow text={eyebrow} />
      <Reveal>
        <Typography component="h2" sx={{
          fontSize: 'clamp(1.6rem, 2.8vw, 2.2rem)',
          fontWeight: 800, letterSpacing: '-0.025em',
          lineHeight: 1.1, mb: 1.25, color: '#0f1929', fontFamily: 'Jost',
        }}>
          {title}
        </Typography>
      </Reveal>
      {subtitle && (
        <Reveal>
          <Typography sx={{
            fontSize: '0.95rem', color: '#3a4a62',
            lineHeight: 1.65, maxWidth: 480, mb: 6, fontFamily: 'Jost',
          }}>
            {subtitle}
          </Typography>
        </Reveal>
      )}
    </>
  )
}

// ── PROBLEM ───────────────────────────────────────────────────────────────────
function Problem() {
  const probs = [
    { t: 'STR filings in Microsoft Word',     d: 'Manual, error-prone, and never audit-defensible.' },
    { t: 'Fraud caught the morning after',    d: 'Batch reviews at EOD. The money is already gone.' },
    { t: 'KYC frozen at onboarding',          d: 'No continuous profiling as customer risk evolves.' },
    { t: 'Foreign tools that don\'t fit',     d: 'No BVN, no CBN tiers, no GoAML. ₦500k/year.' },
  ]
  return (
    <Box id="problem" component="section" sx={{ py: 11, px: '6vw', bgcolor: '#f8fafc' }}>
      <Box sx={{ maxWidth: 1060, mx: 'auto' }}>
        <SectionHead
          eyebrow="The Problem"
          title={<>Most institutions are running compliance<br />with the wrong tools.</>}
          subtitle="Foreign platforms don't know what a BVN is. Local alternatives don't have the full stack. The gap gets filled with spreadsheets and Word documents."
        />

        <Reveal sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
          gap: '1px', bgcolor: '#e2e8f0', mb: 4,
        }}>
          {probs.map((p) => (
            <Box key={p.t} sx={{
              bgcolor: '#ffffff', p: 3.5, borderLeft: '3px solid #dc2626',
            }}>
              <Typography sx={{
                fontSize: '0.95rem', fontWeight: 700, mb: 0.75,
                color: '#0f1929', fontFamily: 'Jost',
              }}>
                {p.t}
              </Typography>
              <Typography sx={{ fontSize: '0.85rem', color: '#3a4a62', lineHeight: 1.55, fontFamily: 'Jost' }}>
                {p.d}
              </Typography>
            </Box>
          ))}
        </Reveal>

        <Reveal sx={{
          bgcolor: '#e8f0ff', borderLeft: '3px solid #00288e',
          p: 2.75, display: 'flex', gap: 1.75, alignItems: 'flex-start',
        }}>
          <Box sx={{ fontSize: '1.2rem', flexShrink: 0, mt: '1px' }}>📋</Box>
          <Box>
            <Typography sx={{
              fontSize: '0.7rem', fontWeight: 700, color: '#00288e',
              letterSpacing: '0.1em', textTransform: 'uppercase', mb: 0.625, fontFamily: 'Jost',
            }}>
              CBN Circular · March 2026
            </Typography>
            <Typography sx={{ fontSize: '0.88rem', color: '#00288e', lineHeight: 1.6, fontFamily: 'Jost' }}>
              Every licensed institution must deploy automated AML within 18–24 months. This is a mandate, not a recommendation.
            </Typography>
          </Box>
        </Reveal>
      </Box>
    </Box>
  )
}

// ── SOLUTION ──────────────────────────────────────────────────────────────────
function Solution() {
  const feats = [
    { n: '01', t: 'Real-time transaction scoring', d: 'Every transaction scored as it moves. Flags raised before money settles.' },
    { n: '02', t: '360° customer profiling',       d: 'Living risk profiles built from behaviour — updated with every interaction.' },
    { n: '03', t: 'BVN · NIN · KYC pipeline',      d: 'Full identity verification with CBN tier limits enforced natively.' },
    { n: '04', t: 'NFIU GoAML filing',             d: 'STR and CTR reports as valid GoAML XML. No Word documents.' },
    { n: '05', t: 'Per-institution rule engine',   d: 'Custom AML rules calibrated to your customers — not a generic template.' },
    { n: '06', t: 'Case management',               d: 'Auto-opened cases, analyst workflow, and NFIU filing — all in one place.' },
  ]
  return (
    <Box id="solution" component="section" sx={{ py: 11, px: '6vw', bgcolor: '#ffffff' }}>
      <Box sx={{ maxWidth: 1060, mx: 'auto' }}>
        <SectionHead
          eyebrow="The Platform"
          title={<>One platform. Everything your compliance<br />team actually needs.</>}
          subtitle="Built natively for Nigerian institutions — CBN-native from the schema up."
        />
        <Reveal sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
          gap: '1px', bgcolor: '#e2e8f0',
        }}>
          {feats.map((f) => (
            <Box key={f.n} sx={{
              bgcolor: '#ffffff', p: 3.5,
              transition: 'background 0.2s', '&:hover': { bgcolor: '#f8fafc' },
            }}>
              <Typography sx={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '0.65rem', color: '#6b7d96',
                letterSpacing: '0.08em', mb: 1.5,
              }}>
                {f.n}
              </Typography>
              <Typography sx={{
                fontSize: '0.95rem', fontWeight: 700, mb: 0.875,
                color: '#0f1929', fontFamily: 'Jost',
              }}>
                {f.t}
              </Typography>
              <Typography sx={{ fontSize: '0.84rem', color: '#3a4a62', lineHeight: 1.6, fontFamily: 'Jost' }}>
                {f.d}
              </Typography>
            </Box>
          ))}
        </Reveal>
      </Box>
    </Box>
  )
}

// ── HOW ───────────────────────────────────────────────────────────────────────
function HowItWorks() {
  const steps = [
    { n: '01', t: 'Event ingests',  d: 'Transactions, logins, KYC, location, and device data pushed via API stream.' },
    { n: '02', t: 'Engine fires',   d: '3-phase scoring — institution rules, behavioural patterns, per-customer logic — in parallel.' },
    { n: '03', t: 'Score returned', d: 'Risk score 0–100. Cases auto-opened. Full audit snapshot captured.' },
    { n: '04', t: 'Analyst acts',   d: 'Case with full context — triggered rules, customer profile, plain-language flag reason.' },
  ]
  return (
    <Box id="how" component="section" sx={{ py: 11, px: '6vw', bgcolor: '#f8fafc' }}>
      <Box sx={{ maxWidth: 1060, mx: 'auto' }}>
        <SectionHead
          eyebrow="How It Works"
          title="Transaction to decision in milliseconds."
          subtitle="Every event flows through OpenIV's scoring engine and returns a decision before the next one arrives."
        />
        <Reveal sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
          position: 'relative',
        }}>
          {/* Connector line — desktop only */}
          <Box sx={{
            display: { xs: 'none', md: 'block' },
            position: 'absolute', top: 20, left: '12.5%', right: '12.5%',
            height: '1px', bgcolor: '#e2e8f0',
          }} />
          {steps.map((s) => (
            <Box key={s.n} sx={{ px: 2.25, textAlign: 'center', position: 'relative', zIndex: 1 }}>
              <Box sx={{
                width: 40, height: 40, bgcolor: '#ffffff',
                border: '1px solid #e2e8f0',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.85rem', fontWeight: 800, color: '#00288e',
                mx: 'auto', mb: 2.25, fontFamily: 'Jost',
              }}>
                {s.n}
              </Box>
              <Typography sx={{
                fontSize: '0.9rem', fontWeight: 700, mb: 0.875,
                color: '#0f1929', fontFamily: 'Jost',
              }}>
                {s.t}
              </Typography>
              <Typography sx={{ fontSize: '0.82rem', color: '#3a4a62', lineHeight: 1.6, fontFamily: 'Jost' }}>
                {s.d}
              </Typography>
            </Box>
          ))}
        </Reveal>
      </Box>
    </Box>
  )
}

// ── CBN ───────────────────────────────────────────────────────────────────────
function CbnSection() {
  const checks = [
    'Real-time transaction monitoring',
    'Automated suspicious activity flagging',
    'Continuous customer risk profiling',
    'NFIU STR / CTR — GoAML XML compliant',
    'CBN KYC tier enforcement',
    'BVN and NIN identity verification',
    'PEP and sanctions screening',
    'Full audit trail — every decision defensible',
  ]
  return (
    <Box id="cbn" component="section" sx={{ py: 11, px: '6vw', bgcolor: '#ffffff' }}>
      <Box sx={{ maxWidth: 1060, mx: 'auto' }}>
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gap: { xs: 5, md: 9 }, alignItems: 'center',
        }}>
          <Box>
            <Eyebrow text="CBN Compliance" />
            <Reveal>
              <Typography component="h2" sx={{
                fontSize: 'clamp(1.6rem, 2.8vw, 2.2rem)',
                fontWeight: 800, letterSpacing: '-0.025em',
                lineHeight: 1.1, mb: 1.25, color: '#0f1929', fontFamily: 'Jost',
              }}>
                When the examiner arrives,<br />OpenIV users don't panic.
              </Typography>
            </Reveal>
            <Reveal>
              <Typography sx={{
                fontSize: '0.9rem', color: '#3a4a62', lineHeight: 1.65, mb: 3, fontFamily: 'Jost',
              }}>
                Built to meet all 12 minimum standards of the CBN March 2026 circular — out of the box, not as an add-on.
              </Typography>
            </Reveal>
            <Reveal sx={{ bgcolor: '#e8f0ff', p: 3, mb: 3 }}>
              <Typography sx={{
                fontSize: '0.68rem', fontWeight: 700, color: '#00288e',
                letterSpacing: '0.1em', textTransform: 'uppercase', mb: 1, fontFamily: 'Jost',
              }}>
                CBN Deadline
              </Typography>
              <Typography sx={{
                fontSize: '3.2rem', fontWeight: 900, color: '#00288e',
                lineHeight: 1, letterSpacing: '-0.04em', mb: 0.5, fontFamily: 'Jost',
              }}>
                18 months
              </Typography>
              <Typography sx={{ fontSize: '0.85rem', color: '#00288e', fontFamily: 'Jost' }}>
                from March 2026 · every institution must comply
              </Typography>
            </Reveal>
            <Reveal sx={{ display: 'inline-block' }}>
              <Box component={Link} to="/request-access" sx={{
                textDecoration: 'none', bgcolor: '#00288e', color: '#ffffff',
                px: 3.75, py: 1.625, fontWeight: 700, fontSize: '0.95rem',
                fontFamily: 'Jost', display: 'inline-block',
                '&:hover': { opacity: 0.85 }, transition: 'opacity 0.15s',
              }}>
                Get CBN-ready →
              </Box>
            </Reveal>
          </Box>

          <Reveal as="div">
            <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
              {checks.map((c, i, arr) => (
                <Box key={c} component="li" sx={{
                  display: 'flex', alignItems: 'center', gap: 1.25,
                  py: 1.375, borderBottom: i < arr.length - 1 ? '1px solid #e2e8f0' : 'none',
                  fontSize: '0.88rem', color: '#3a4a62', fontFamily: 'Jost',
                }}>
                  <Box sx={{
                    width: 18, height: 18, bgcolor: '#dcfce7', border: '1px solid #bbf7d0',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.6rem', color: '#16a34a', flexShrink: 0,
                  }}>
                    ✓
                  </Box>
                  {c}
                </Box>
              ))}
            </Box>
          </Reveal>
        </Box>
      </Box>
    </Box>
  )
}

// ── PRICING ───────────────────────────────────────────────────────────────────
type Plan = {
  name: string
  who: string
  price: string
  feats: string[]
  cta: string
  accent: string
  popular?: boolean
}
const PLANS: Plan[] = [
  { name: 'Starter',    who: 'MFBs & early fintechs', price: 'Pay per transaction',     accent: '#3b82f6',
    feats: ['Real-time scoring', 'KYC pipeline', 'Case management', 'NFIU filing'], cta: 'Get started →' },
  { name: 'Growth',     who: 'Fintechs & BDCs',       price: 'Metered + modules',       accent: '#00288e', popular: true,
    feats: ['Everything in Starter', 'Behavioural analytics', 'Webhooks', 'Advanced reports'], cta: 'Talk to us →' },
  { name: 'Scale',      who: 'Mid-size banks',        price: 'Volume pricing + SLA',    accent: '#0ea5e9',
    feats: ['Everything in Growth', 'Custom rule config', 'Dedicated support', 'CBN exam support'], cta: 'Book a call →' },
  { name: 'Enterprise', who: 'Tier-1 banks',          price: 'Custom + dedicated infra', accent: '#7c3aed',
    feats: ['Everything in Scale', 'Dedicated infra', 'Full API access', 'Custom SLA'], cta: 'Contact us →' },
]

function Pricing() {
  return (
    <Box id="pricing" component="section" sx={{ py: 11, px: '6vw', bgcolor: '#f8fafc' }}>
      <Box sx={{ maxWidth: 1060, mx: 'auto' }}>
        <SectionHead
          eyebrow="Pricing"
          title="Pay for what you use."
          subtitle="No six-figure contracts. No procurement cycles. Start today."
        />
        <Reveal sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
          gap: '1px', bgcolor: '#e2e8f0',
        }}>
          {PLANS.map((p) => (
            <Box key={p.name} sx={{
              bgcolor: p.popular ? '#00288e' : '#ffffff',
              p: 3.5, py: 3.5, position: 'relative',
              outline: p.popular ? '2px solid #00288e' : 'none',
            }}>
              {p.popular && (
                <Box sx={{
                  position: 'absolute', top: 0, left: '50%',
                  transform: 'translate(-50%, -50%)',
                  bgcolor: '#d9f99d', color: '#0f1929',
                  fontSize: '0.62rem', fontWeight: 800, fontFamily: 'Jost',
                  px: 1.25, py: 0.375, letterSpacing: '0.08em',
                  textTransform: 'uppercase', whiteSpace: 'nowrap',
                }}>
                  Most Popular
                </Box>
              )}
              <Typography sx={{
                fontSize: '0.95rem', fontWeight: 800, mb: 0.375, fontFamily: 'Jost',
                color: p.popular ? '#ffffff' : p.accent,
              }}>
                {p.name}
              </Typography>
              <Typography sx={{
                fontSize: '0.78rem', mb: 1.75, fontFamily: 'Jost',
                color: p.popular ? 'rgba(255,255,255,0.65)' : '#6b7d96',
              }}>
                {p.who}
              </Typography>
              <Typography sx={{
                fontSize: '0.82rem', pb: 1.75, mb: 1.75,
                borderBottom: `1px solid ${p.popular ? 'rgba(255,255,255,0.15)' : '#e2e8f0'}`,
                color: p.popular ? 'rgba(255,255,255,0.8)' : '#3a4a62',
                fontFamily: 'Jost',
              }}>
                {p.price}
              </Typography>
              <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, mb: 2.75 }}>
                {p.feats.map((f) => (
                  <Box key={f} component="li" sx={{
                    fontSize: '0.8rem', py: 0.375,
                    color: p.popular ? 'rgba(255,255,255,0.8)' : '#3a4a62',
                    display: 'flex', gap: 0.875, fontFamily: 'Jost',
                    '&::before': {
                      content: '"→"', color: p.popular ? '#d9f99d' : '#00288e', flexShrink: 0,
                    },
                  }}>
                    {f}
                  </Box>
                ))}
              </Box>
              <Box component={Link} to="/request-access" sx={{
                display: 'block', textAlign: 'center', textDecoration: 'none',
                py: 1.125, fontSize: '0.82rem', fontWeight: 700, fontFamily: 'Jost',
                border: p.popular ? '1.5px solid #ffffff' : '1.5px solid #e2e8f0',
                color: p.popular ? '#00288e' : '#3a4a62',
                bgcolor: p.popular ? '#ffffff' : 'transparent',
                transition: 'all 0.15s',
                '&:hover': p.popular
                  ? { bgcolor: '#d9f99d', color: '#0f1929', borderColor: '#d9f99d' }
                  : { bgcolor: '#00288e', color: '#ffffff', borderColor: '#00288e' },
              }}>
                {p.cta}
              </Box>
            </Box>
          ))}
        </Reveal>
      </Box>
    </Box>
  )
}

// ── COMPARE ───────────────────────────────────────────────────────────────────
type Cell = { kind: 'yes' } | { kind: 'no' } | { kind: 'partial' }
const COMP_ROWS: { label: string; cells: [Cell, Cell, Cell] }[] = [
  { label: 'BVN / NIN verification',         cells: [{ kind: 'yes' }, { kind: 'no' },      { kind: 'partial' }] },
  { label: 'CBN KYC tier enforcement',       cells: [{ kind: 'yes' }, { kind: 'no' },      { kind: 'partial' }] },
  { label: 'NFIU GoAML XML export',          cells: [{ kind: 'yes' }, { kind: 'no' },      { kind: 'no' }] },
  { label: 'Real-time transaction scoring',  cells: [{ kind: 'yes' }, { kind: 'partial' }, { kind: 'partial' }] },
  { label: '360° continuous profiling',      cells: [{ kind: 'yes' }, { kind: 'no' },      { kind: 'no' }] },
  { label: 'Pay-as-you-go pricing',          cells: [{ kind: 'yes' }, { kind: 'no' },      { kind: 'partial' }] },
  { label: 'MFB-accessible pricing',         cells: [{ kind: 'yes' }, { kind: 'no' },      { kind: 'partial' }] },
]

function CellGlyph({ cell }: { cell: Cell }) {
  if (cell.kind === 'yes')     return <Box component="span" sx={{ color: '#16a34a', fontSize: '1rem' }}>✓</Box>
  if (cell.kind === 'no')      return <Box component="span" sx={{ color: '#dc2626', fontSize: '1rem' }}>✗</Box>
  return <Box component="span" sx={{ color: '#d97706', fontSize: '0.78rem', fontWeight: 600 }}>Partial</Box>
}

function CompareSection() {
  return (
    <Box id="compare" component="section" sx={{ py: 11, px: '6vw', bgcolor: '#ffffff' }}>
      <Box sx={{ maxWidth: 1060, mx: 'auto' }}>
        <SectionHead
          eyebrow="Why OpenIV"
          title="Built here. Not adapted here."
          subtitle="Foreign tools don't understand BVN. Local tools don't have the full stack."
        />
        <Reveal sx={{ overflowX: 'auto' }}>
          <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse' }}>
            <Box component="thead">
              <Box component="tr">
                {[
                  { label: 'Capability', w: '36%', align: 'left' },
                  { label: 'OpenIV',     w: 'auto', align: 'center' },
                  { label: 'Foreign AML', w: 'auto', align: 'center' },
                  { label: 'Local tools', w: 'auto', align: 'center' },
                ].map((h) => (
                  <Box key={h.label} component="th" sx={{
                    py: 1.375, px: 2.25, textAlign: h.align as 'left' | 'center',
                    fontSize: '0.72rem', fontWeight: 700, color: '#6b7d96',
                    letterSpacing: '0.08em', textTransform: 'uppercase',
                    borderBottom: '1px solid #e2e8f0', width: h.w, fontFamily: 'Jost',
                  }}>
                    {h.label}
                  </Box>
                ))}
              </Box>
            </Box>
            <Box component="tbody">
              {COMP_ROWS.map((r, i) => {
                const oi = i % 2 === 0
                return (
                  <Box key={r.label} component="tr">
                    <Box component="td" sx={{
                      py: 1.625, px: 2.25, fontSize: '0.88rem',
                      borderBottom: '1px solid #e2e8f0',
                      bgcolor: oi ? '#f0f4ff' : 'transparent',
                      color: oi ? '#00288e' : '#3a4a62',
                      fontWeight: oi ? 700 : 500,
                      textAlign: 'left', fontFamily: 'Jost',
                    }}>
                      {r.label}
                    </Box>
                    {r.cells.map((c, ci) => (
                      <Box key={ci} component="td" sx={{
                        py: 1.625, px: 2.25, fontSize: '0.88rem',
                        borderBottom: '1px solid #e2e8f0',
                        bgcolor: oi ? '#f0f4ff' : 'transparent',
                        textAlign: 'center',
                      }}>
                        <CellGlyph cell={c} />
                      </Box>
                    ))}
                  </Box>
                )
              })}
            </Box>
          </Box>
        </Reveal>
      </Box>
    </Box>
  )
}

// ── WHO ───────────────────────────────────────────────────────────────────────
function WhoSection() {
  const who = [
    { ico: '🏦', t: 'Commercial Banks',    d: 'Full-stack AML at tier-1 volumes with enterprise SLA.' },
    { ico: '🏪', t: 'Microfinance Banks',  d: 'Same infrastructure as tier-1 banks. Pay-as-you-go pricing.' },
    { ico: '📱', t: 'Licensed Fintechs',   d: 'Compliance that grows with you from day one.' },
    { ico: '💱', t: 'Bureau de Change',    d: 'Cross-border monitoring and NFIU filing — native.' },
  ]
  return (
    <Box id="who" component="section" sx={{ py: 11, px: '6vw', bgcolor: '#f8fafc' }}>
      <Box sx={{ maxWidth: 1060, mx: 'auto' }}>
        <Eyebrow text="Who It's For" />
        <Reveal>
          <Typography component="h2" sx={{
            fontSize: 'clamp(1.6rem, 2.8vw, 2.2rem)',
            fontWeight: 800, letterSpacing: '-0.025em',
            lineHeight: 1.1, mb: 6, color: '#0f1929', fontFamily: 'Jost',
          }}>
            Every licensed institution in Nigeria.
          </Typography>
        </Reveal>
        <Reveal sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
          gap: '1px', bgcolor: '#e2e8f0',
        }}>
          {who.map((w) => (
            <Box key={w.t} sx={{
              bgcolor: '#ffffff', p: 3.5,
              transition: 'background 0.2s', '&:hover': { bgcolor: '#e8f0ff' },
            }}>
              <Typography sx={{ fontSize: '1.6rem', mb: 1.5 }}>{w.ico}</Typography>
              <Typography sx={{
                fontSize: '0.9rem', fontWeight: 700, mb: 0.875,
                color: '#0f1929', fontFamily: 'Jost',
              }}>
                {w.t}
              </Typography>
              <Typography sx={{ fontSize: '0.82rem', color: '#3a4a62', lineHeight: 1.55, fontFamily: 'Jost' }}>
                {w.d}
              </Typography>
            </Box>
          ))}
        </Reveal>
      </Box>
    </Box>
  )
}

// ── FINAL CTA ─────────────────────────────────────────────────────────────────
function FinalCTA() {
  return (
    <Box id="cta" component="section" sx={{
      py: 12.5, px: '6vw', textAlign: 'center', bgcolor: '#00288e',
    }}>
      <Reveal>
        <Typography component="h2" sx={{
          fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)',
          fontWeight: 900, lineHeight: 1.05, letterSpacing: '-0.03em',
          color: '#ffffff', mb: 1.75, fontFamily: 'Jost',
        }}>
          The CBN deadline is<br />
          <Box component="span" sx={{ color: '#d9f99d' }}>18 months away.</Box>
        </Typography>
      </Reveal>
      <Reveal>
        <Typography sx={{
          fontSize: '0.95rem', color: 'rgba(255,255,255,0.75)',
          lineHeight: 1.6, maxWidth: 420, mx: 'auto', mb: 4, fontFamily: 'Jost',
        }}>
          Less than a week to integrate. Your first transactions scored in real time before your next compliance review.
        </Typography>
      </Reveal>
      <Reveal>
        <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 1.5, justifyContent: 'center' }}>
          <Box component={Link} to="/request-access" sx={{
            textDecoration: 'none', bgcolor: '#ffffff', color: '#00288e',
            px: 3.75, py: 1.625, fontWeight: 700, fontSize: '0.95rem',
            fontFamily: 'Jost', display: 'inline-block',
            '&:hover': { opacity: 0.9 }, transition: 'opacity 0.15s',
          }}>
            Book a Demo
          </Box>
          <Box component="a" href="mailto:hello@openiv.ng" sx={{
            textDecoration: 'none', border: '1.5px solid rgba(255,255,255,0.35)',
            color: 'rgba(255,255,255,0.85)', px: 3, py: 1.625,
            fontWeight: 600, fontSize: '0.95rem', fontFamily: 'Jost',
            display: 'inline-block',
            '&:hover': { borderColor: '#ffffff' }, transition: 'border-color 0.15s',
          }}>
            Talk to the team →
          </Box>
        </Stack>
      </Reveal>
      <Reveal>
        <Typography sx={{
          mt: 1.75, fontSize: '0.76rem',
          color: 'rgba(255,255,255,0.5)', fontFamily: 'Jost',
        }}>
          No commitment. Just 30 minutes.
        </Typography>
      </Reveal>
    </Box>
  )
}

// ── PAGE ──────────────────────────────────────────────────────────────────────
export default function LaunchPage() {
  // Enable smooth in-page anchor scrolling
  useEffect(() => {
    const prev = document.documentElement.style.scrollBehavior
    document.documentElement.style.scrollBehavior = 'smooth'
    return () => { document.documentElement.style.scrollBehavior = prev }
  }, [])

  return (
    <Box sx={{ fontFamily: 'Jost, sans-serif', bgcolor: '#ffffff', color: '#0f1929', lineHeight: 1 }}>
      <Navbar />
      <Container disableGutters maxWidth={false}>
        <Hero />
        <TrustStrip />
        <Stats />
        <Problem />
        <Solution />
        <HowItWorks />
        <CbnSection />
        <Pricing />
        <CompareSection />
        <WhoSection />
        <FinalCTA />
        <SharedFooter />
      </Container>
    </Box>
  )
}
