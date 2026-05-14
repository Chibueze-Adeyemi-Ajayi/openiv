import { useEffect, useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Box, Typography, IconButton, InputBase, Stack } from '@mui/material'
import { colorPalette } from '@/theme'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import SendRoundedIcon from '@mui/icons-material/SendRounded'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined'
import { getEurekaResponse, type Message } from '@/utils/eurekaBrain'

// ── Knowledge base ─────────────────────────────────────────────────────────────
const NAV_KNOWLEDGE: Record<string, { explanation: string; suggestions: string[] }> = {
  '/dashboard': {
    explanation:
      "The Overview is your institution's real-time compliance command center. It displays live transaction volumes, flagged activity counts, open AML cases, and your compliance score — all streaming via server-sent events. Use it to monitor your daily operational posture, trigger NFIU returns, and export activity summaries for board reporting.",
    suggestions: [
      "What does my compliance score represent?",
      "How do I file an NFIU return from here?",
      "Why are transactions being flagged today?",
    ],
  },
  '/dashboard/otp-alerts': {
    explanation:
      "OTP Defense monitors one-time password usage for abuse patterns across your customer base. The engine detects velocity abuse (too many OTPs in tight windows), geographic impossibility (requests from distant locations within minutes), and SIM-swap indicators. Alerts are severity-ranked and require analyst acknowledgment before clearing from your compliance queue.",
    suggestions: [
      "What triggers an OTP anomaly alert?",
      "How do I bulk-acknowledge low severity alerts?",
      "What does a SIM-swap attack signature look like?",
    ],
  },
  '/dashboard/transactions': {
    explanation:
      "Transactions is your primary ledger view for all financial movements ingested via Beam or CSV import. Filter by risk score, channel (Wire, PoS, USSD, ATM, Mobile), flagged status, and date. Use bulk actions to flag, block, or clear multiple records simultaneously, and export filtered datasets for offline analysis or regulatory submissions.",
    suggestions: [
      "How do I flag a suspicious transaction?",
      "What does a risk score above 80 indicate?",
      "How do I import transactions in bulk?",
    ],
  },
  '/dashboard/patterns': {
    explanation:
      "Behavioral Patterns uses heatmap matrices to surface unusual activity timing across your user base. The day-of-week × hour grid highlights when transactions and logins cluster outside normal operating hours — a strong indicator of account takeover or coordinated fraud rings. Darker cells signal higher-than-expected density for that time slot.",
    suggestions: [
      "What counts as an abnormal behavioral pattern?",
      "How do I read the heatmap grid?",
      "Can I set alerts for off-hours activity spikes?",
    ],
  },
  '/dashboard/aml': {
    explanation:
      "AML & Cases is your investigation workspace. Cases are opened against suspicious activity and linked to one or more transactions. Each case carries an SLA deadline, priority level, and a full activity audit trail. Cases progress through Open → Escalated → Closed states with mandatory resolution notes. Open and overdue cases directly affect your compliance score.",
    suggestions: [
      "How do I create a new AML case?",
      "What is SLA compliance and how is it measured?",
      "When should I escalate a case to the NFIU?",
    ],
  },
  '/dashboard/kyc': {
    explanation:
      "KYC allows analysts to trigger identity verification lookups against your institution's configured external service. Results log per customer reference with tier (1–4) and verification status. Failed checks can automatically open a new AML case for review. Configure your provider endpoint under the KYC config tab. Each lookup is billed at ₦50 from your wallet.",
    suggestions: [
      "How do I configure my KYC provider endpoint?",
      "What do KYC tiers 1 through 4 mean?",
      "Can KYC failures automatically open AML cases?",
    ],
  },
  '/dashboard/heatmaps': {
    explanation:
      "Heatmaps renders transaction density as a geographic overlay, identifying fraud hotspots across regions. Cross-reference with Behavioral Patterns to determine whether geographic clusters correlate with off-hours activity — a common signature of organized fraud rings operating across multiple branches or agent networks.",
    suggestions: [
      "Which regions show the highest risk concentration?",
      "How do I correlate heatmaps with AML cases?",
      "Can I export the geographic risk map data?",
    ],
  },
  '/dashboard/cbn': {
    explanation:
      "CBN Compliance tracks your institution's adherence to Central Bank of Nigeria regulatory requirements. The countdown shows days until your next mandatory filing. Widgets surface unresolved violations, pending returns, and your aggregate compliance posture score. Falling below the minimum threshold triggers an escalation protocol that may result in regulatory sanctions.",
    suggestions: [
      "What are the current CBN filing deadlines?",
      "How is the compliance score calculated?",
      "What happens if I miss a CBN reporting window?",
    ],
  },
  '/dashboard/reports': {
    explanation:
      "Reports & Filings manages your Suspicious Activity Reports (SARs) submitted to the Nigerian Financial Intelligence Unit (NFIU). Each report captures a subject, transaction period, aggregate amount, and a compliance narrative. Recurring schedules (daily/weekly/monthly) support optional auto-filing. Each filed return is billed at ₦500 from your wallet.",
    suggestions: [
      "How do I write a strong SAR narrative?",
      "Can reports be filed automatically on a schedule?",
      "What is the mandatory NFIU filing timeline?",
    ],
  },
  '/dashboard/thresholds': {
    explanation:
      "Thresholds define the dynamic rules that determine when transactions are automatically flagged for analyst review. Each threshold specifies a category (amount, velocity, geography), comparison operator (gt/lt/eq), and a numeric value. All changes are version-tracked with a full audit history. Well-tuned thresholds minimize false positives without creating risk blind spots.",
    suggestions: [
      "What is a good single-transaction threshold for retail banking?",
      "How do velocity thresholds work?",
      "Can I set different thresholds per transaction channel?",
    ],
  },
  '/dashboard/network': {
    explanation:
      "Network provides a unified audit log of all inbound Beam data streams and outbound webhook deliveries. Diagnose integration failures by inspecting response codes, payload sizes, latency, and full request/response headers. Filter by stream type (transactions, OTPs, devices, location) or by endpoint URL to pinpoint issues quickly.",
    suggestions: [
      "Why are my webhook deliveries failing?",
      "How do I verify Beam is ingesting data correctly?",
      "What does a 422 response on a webhook delivery mean?",
    ],
  },
  '/dashboard/beam': {
    explanation:
      "Beam to OpenIV is your data ingestion API gateway. Generate an institution-scoped API key to authenticate your core banking system or data pipeline when sending transaction streams. The full key is shown only once at creation — store it securely. Revoke and regenerate immediately if you suspect compromise. Ingest events are billed at ₦0.10 per record.",
    suggestions: [
      "How do I integrate Beam with my core banking system?",
      "Which data streams can I send via Beam?",
      "How frequently should I rotate my Beam API key?",
    ],
  },
  '/dashboard/webhooks': {
    explanation:
      "Webhooks deliver real-time event notifications to your configured endpoints when compliance events fire — transaction flagged, case opened, KYC failed, SAR filed. Every payload is signed with HMAC-SHA256 for integrity verification. Secrets auto-rotate hourly if enabled. All delivery attempts are logged with full response metadata for auditing and retry tracking.",
    suggestions: [
      "How do I verify a webhook signature in my system?",
      "Which compliance events can I subscribe to?",
      "How do I safely test my webhook endpoint?",
    ],
  },
  '/dashboard/team': {
    explanation:
      "Team & Roles manages your institution's user roster. Invite members via institutional email with scoped roles: admin (full access), CCO (compliance authority and filing), analyst (investigation and flagging), viewer (read-only). Custom roles allow fine-grained permission matrices for specialized workflows such as external auditor or data-export-only access.",
    suggestions: [
      "What permissions does the CCO role include?",
      "How do I invite a new team member?",
      "Can I create a read-only role for external auditors?",
    ],
  },
  '/dashboard/billing': {
    explanation:
      "Billing & Usage displays your institution's prepaid wallet balance and real-time consumption. Actions are individually metered: Beam ingest (₦0.10/record), KYC lookups (₦50), NFIU filings (₦500), case creation (₦10), document uploads (₦5). Top up via Paystack card payment. The full ledger provides a debit/credit history for internal budget reconciliation.",
    suggestions: [
      "How do I top up my institution's wallet?",
      "Which platform actions are most expensive?",
      "Can I set a low-balance notification?",
    ],
  },
  '/dashboard/settings': {
    explanation:
      "Settings controls platform-wide security configuration for your institution. Configure geofence polygons to restrict analyst logins to approved geographic zones — login attempts outside the perimeter are queued for super-admin approval. Enroll specific users in geofence enforcement selectively. Session timeout and security policy controls are also managed here.",
    suggestions: [
      "How do I configure a geofence for my office locations?",
      "Which users should be enrolled in geofence enforcement?",
      "What happens when a user logs in outside the geofence?",
    ],
  },
}

// ── AI response simulator ──────────────────────────────────────────────────────
function simulateAIResponse(msg: string, history: Message[]): { text: string; followUps: string[] } {
  return getEurekaResponse(msg, history)
}

// ── Types ──────────────────────────────────────────────────────────────────────
type Phase = 'thinking' | 'streaming' | 'ready'

export interface SidebarAIBubbleProps {
  anchorRect: DOMRect
  navItem: { label: string; to: string }
  onClose: () => void
  isClosing?: boolean
}

// ── Layout constants ───────────────────────────────────────────────────────────
const SIDEBAR_W = 244
const GAP = 14
const PANEL_W = 348
const PANEL_MAX_H = 530
const LEFT = SIDEBAR_W + GAP

// ── Component ──────────────────────────────────────────────────────────────────
export default function SidebarAIBubble({ anchorRect, navItem, onClose, isClosing = false }: SidebarAIBubbleProps) {
  const knowledge = NAV_KNOWLEDGE[navItem.to] ?? {
    explanation: `${navItem.label} is a module within the OpenIV compliance platform. Use it to monitor, manage, and act on financial intelligence data relevant to your institution.`,
    suggestions: ['Tell me more about this feature', 'How do I get started here?', 'What are the key actions?'],
  }

  const [phase, setPhase] = useState<Phase>('thinking')
  const [displayedText, setDisplayedText] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [streamingAI, setStreamingAI] = useState('')
  const [aiTyping, setAiTyping] = useState(false)
  const [input, setInput] = useState('')
  const [dynamicSuggestions, setDynamicSuggestions] = useState<string[]>([])

  const allIntervalsRef = useRef<Set<ReturnType<typeof setInterval>>>(new Set())
  const chatEndRef = useRef<HTMLDivElement>(null)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const prevNavToRef = useRef(navItem.to)
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 2 s thinking → start streaming; also re-triggers when phase resets to 'thinking'
  useEffect(() => {
    if (phase !== 'thinking') return
    const t = setTimeout(() => setPhase('streaming'), 2000)
    return () => clearTimeout(t)
  }, [phase])

  // Stream explanation text character-by-character
  useEffect(() => {
    if (phase !== 'streaming') return
    const full = knowledge.explanation
    let index = 0
    const id = setInterval(() => {
      index++
      setDisplayedText(full.slice(0, index))
      if (index >= full.length) {
        clearInterval(id)
        allIntervalsRef.current.delete(id)
        setPhase('ready')
      }
    }, 13)
    allIntervalsRef.current.add(id)
    return () => { clearInterval(id); allIntervalsRef.current.delete(id) }
  }, [phase, knowledge.explanation])

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingAI])

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Nav item changed while bubble is open → collapse current view, reset to thinking
  useEffect(() => {
    if (prevNavToRef.current === navItem.to) return
    prevNavToRef.current = navItem.to

    // Cancel any in-flight streaming or chat intervals
    allIntervalsRef.current.forEach(clearInterval)
    allIntervalsRef.current.clear()
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current)

    // Play collapse animation on the expanded panel (if visible), then reset
    setIsTransitioning(true)
    transitionTimerRef.current = setTimeout(() => {
      setIsTransitioning(false)
      setPhase('thinking')       // triggers the 2 s timer via the phase effect above
      setDisplayedText('')
      setMessages([])
      setStreamingAI('')
      setAiTyping(false)
      setInput('')
    }, 360)
  }, [navItem.to])

  // Cleanup all running intervals + transition timer on unmount
  useEffect(() => () => {
    allIntervalsRef.current.forEach(clearInterval)
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current)
  }, [])

  const handleSend = useCallback(async (forcedText?: string) => {
    const userText = (forcedText ?? input).trim()
    if (!userText || aiTyping) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: userText }])
    setAiTyping(true)
    setStreamingAI('')

    // Simulated thinking delay
    await new Promise<void>(r => setTimeout(r, 650 + Math.random() * 450))

    const { text: response, followUps } = simulateAIResponse(userText, messages)
    let i = 0
    const id = setInterval(() => {
      i++
      setStreamingAI(response.slice(0, i))
      if (i >= response.length) {
        clearInterval(id)
        allIntervalsRef.current.delete(id)
        setAiTyping(false)
        setMessages(prev => [...prev, { role: 'eureka', text: response }])
        setStreamingAI('')
        if (followUps.length > 0) {
          setDynamicSuggestions(followUps)
        }
      }
    }, 13)
    allIntervalsRef.current.add(id)
  }, [input, aiTyping, navItem.label])

  // ── Positioning ────────────────────────────────────────────────────────────
  const itemCenterY = anchorRect.top + anchorRect.height / 2
  const thinkingTop = itemCenterY - 26
  const panelTop = Math.max(16, Math.min(
    window.innerHeight - PANEL_MAX_H - 16,
    itemCenterY - 90,
  ))

  const showSuggestions = phase === 'ready' && messages.length === 0

  // ── JSX ────────────────────────────────────────────────────────────────────
  const content = (
    <>
      {/* ── Thinking bubble ─────────────────────────────────────────────── */}
      {phase === 'thinking' && (
        <Box
          key={navItem.to}
          sx={{
            position: 'fixed',
            left: LEFT,
            top: thinkingTop,
            zIndex: 1150,
            animation: isClosing
              ? 'bubbleClose 0.38s cubic-bezier(0.4, 0, 1, 1) forwards'
              : 'bubblePop 0.48s cubic-bezier(0.34, 1.56, 0.64, 1)',
            transformOrigin: 'left center',
            '@keyframes bubblePop': {
              '0%': { opacity: 0, transform: 'scale(0.3) translateX(-10px)', filter: 'blur(6px)' },
              '60%': { filter: 'blur(0px)' },
              '100%': { opacity: 1, transform: 'scale(1) translateX(0)', filter: 'blur(0px)' },
            },
            '@keyframes bubbleClose': {
              '0%': { opacity: 1, transform: 'scale(1) translateX(0)', filter: 'blur(0px)' },
              '25%': { opacity: 1, transform: 'scale(1.06) translateX(2px)', filter: 'blur(0px)' },
              '100%': { opacity: 0, transform: 'scale(0.08) translateX(-6px)', filter: 'blur(5px)' },
            },
          }}
        >
          <Box
            sx={{
              position: 'relative',
              background: 'linear-gradient(145deg, #ffffff 0%, #eef2ff 100%)',
              border: '1px solid rgba(30, 64, 175, 0.18)',
              borderRadius: '22px',
              px: 2,
              py: 1.375,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              boxShadow: [
                '0 2px 6px rgba(30, 64, 175, 0.07)',
                '0 10px 32px rgba(30, 64, 175, 0.18)',
                'inset 0 1px 0 rgba(255, 255, 255, 1)',
              ].join(', '),
              animation: 'glowPulse 2.8s ease-in-out infinite',
              '@keyframes glowPulse': {
                '0%, 100%': {
                  boxShadow: '0 2px 6px rgba(30,64,175,0.07), 0 10px 32px rgba(30,64,175,0.18), inset 0 1px 0 rgba(255,255,255,1)',
                },
                '50%': {
                  boxShadow: '0 2px 8px rgba(30,64,175,0.11), 0 16px 44px rgba(30,64,175,0.28), inset 0 1px 0 rgba(255,255,255,1)',
                },
              },
              overflow: 'hidden',
            }}
          >
            {/* Ripple close-in ring — contracts to centre when closing */}
            {isClosing && (
              <Box
                sx={{
                  position: 'absolute',
                  inset: -4,
                  borderRadius: '26px',
                  pointerEvents: 'none',
                  border: `2px solid ${colorPalette.primary}55`,
                  animation: 'rippleContract 0.38s cubic-bezier(0.4, 0, 1, 1) forwards',
                  '@keyframes rippleContract': {
                    '0%': { transform: 'scale(1.4)', opacity: 0.7 },
                    '60%': { transform: 'scale(0.6)', opacity: 0.4 },
                    '100%': { transform: 'scale(0)', opacity: 0 },
                  },
                }}
              />
            )}
            {/* Diamond tail — rotated square with bubble gradient */}
            <Box
              sx={{
                position: 'absolute',
                left: -8,
                top: '50%',
                transform: 'translateY(-50%) rotate(45deg)',
                width: 14,
                height: 14,
                background: 'linear-gradient(225deg, #eef2ff 0%, #f4f6ff 100%)',
                borderBottom: '1px solid rgba(30, 64, 175, 0.18)',
                borderLeft: '1px solid rgba(30, 64, 175, 0.18)',
                borderRadius: '0 0 0 3px',
              }}
            />

            {/* Animated sparkle icon */}
            <AutoAwesomeOutlinedIcon
              sx={{
                fontSize: '0.9375rem',
                color: colorPalette.primary,
                flexShrink: 0,
                animation: 'sparkleGlow 2.8s ease-in-out infinite',
                '@keyframes sparkleGlow': {
                  '0%, 100%': { opacity: 0.45, transform: 'scale(1) rotate(0deg)' },
                  '50%': { opacity: 0.95, transform: 'scale(1.2) rotate(18deg)' },
                },
              }}
            />

            {/* Wave dots */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.625 }}>
              {[0, 1, 2].map(i => (
                <Box
                  key={i}
                  sx={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: `linear-gradient(135deg, #93b4ff 0%, ${colorPalette.primary} 100%)`,
                    boxShadow: `0 1px 4px rgba(30, 64, 175, 0.45)`,
                    animation: `dotWave 1.5s ease-in-out ${i * 0.2}s infinite`,
                    '@keyframes dotWave': {
                      '0%, 100%': { transform: 'translateY(0) scale(0.82)', opacity: 0.4 },
                      '45%': { transform: 'translateY(-7px) scale(1.15)', opacity: 1 },
                    },
                  }}
                />
              ))}
            </Box>

            {/* Label */}
            <Typography
              sx={{
                fontSize: '0.625rem',
                fontWeight: 700,
                color: `rgba(30, 64, 175, 0.52)`,
                fontFamily: 'Jost',
                letterSpacing: '0.08em',
                whiteSpace: 'nowrap',
                userSelect: 'none',
                textTransform: 'uppercase',
              }}
            >
              Analysing
            </Typography>
          </Box>
        </Box>
      )}

      {/* ── Expanded panel ──────────────────────────────────────────────── */}
      {phase !== 'thinking' && (
        <Box
          sx={{
            position: 'fixed',
            left: LEFT,
            top: panelTop,
            width: PANEL_W,
            maxHeight: PANEL_MAX_H,
            zIndex: 1150,
            bgcolor: '#ffffff',
            border: '1px solid #eef0f4',
            boxShadow: '0 20px 60px rgba(15, 23, 42, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            // Smooth position slide when switching items
            transition: 'top 0.32s cubic-bezier(0.4, 0, 0.2, 1)',
            transformOrigin: 'left top',
            // isClosing wins; then item-transition collapse; then normal expand
            animation: (isClosing || isTransitioning)
              ? 'panelCollapse 0.35s cubic-bezier(0.4, 0, 0.2, 1) forwards'
              : 'panelExpand 0.42s cubic-bezier(0.34, 1.56, 0.64, 1)',
            pointerEvents: (isClosing || isTransitioning) ? 'none' : 'auto',
            '@keyframes panelExpand': {
              from: { opacity: 0, transform: 'scale(0.7) translateY(-8px)' },
              to: { opacity: 1, transform: 'scale(1) translateY(0)' },
            },
            '@keyframes panelCollapse': {
              from: { opacity: 1, transform: 'scale(1) translateY(0)' },
              to: { opacity: 0, transform: 'scale(0.82) translateY(8px)', filter: 'blur(2px)' },
            },
          }}
        >
          {/* Header */}
          <Box
            sx={{
              px: 2,
              py: 1.5,
              borderBottom: '1px solid #eef0f4',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.125 }}>
              <Box
                sx={{
                  width: 30,
                  height: 30,
                  bgcolor: colorPalette.primary,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  position: 'relative',
                }}
              >
                <AutoAwesomeOutlinedIcon sx={{ color: '#ffffff', fontSize: '0.9375rem' }} />
                {/* live dot */}
                <Box sx={{
                  position: 'absolute', top: 2, right: 2,
                  width: 6, height: 6, borderRadius: '50%',
                  bgcolor: '#10b981', border: '1.5px solid #ffffff',
                }} />
              </Box>
              <Box>
                <Typography sx={{
                  fontSize: '0.8125rem', fontWeight: 700,
                  color: '#00288e', fontFamily: 'Jost', lineHeight: 1.2,
                }}>
                  Eureka
                </Typography>
                <Typography sx={{ fontSize: '0.625rem', color: '#64748b', fontFamily: 'Jost' }}>
                  {navItem.label}
                </Typography>
              </Box>
            </Box>

            <IconButton
              onClick={onClose}
              size="small"
              disableRipple
              sx={{
                color: '#94a3b8',
                borderRadius: 0,
                p: 0.5,
                '&:hover': { color: '#00288e', bgcolor: '#f8fafc' },
              }}
            >
              <CloseRoundedIcon sx={{ fontSize: '1rem' }} />
            </IconButton>
          </Box>

          {/* Scrollable body */}
          <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>

            {/* Streamed explanation */}
            <Box sx={{ p: 2, pb: showSuggestions ? 0 : 2 }}>
              <Typography sx={{
                fontSize: '0.8125rem',
                color: '#334155',
                lineHeight: 1.7,
                fontFamily: 'Jost',
              }}>
                {displayedText}
                {phase === 'streaming' && (
                  <Box
                    component="span"
                    sx={{
                      display: 'inline-block',
                      width: '2px',
                      height: '0.9em',
                      bgcolor: colorPalette.primary,
                      ml: '1px',
                      verticalAlign: 'text-bottom',
                      animation: 'cursorBlink 0.75s step-end infinite',
                      '@keyframes cursorBlink': {
                        '0%, 100%': { opacity: 1 },
                        '50%': { opacity: 0 },
                      },
                    }}
                  />
                )}
              </Typography>
            </Box>

            {/* Initial Suggestions */}
            {showSuggestions && (
              <Box sx={{ px: 2, pt: 1.75, pb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
                  <LightbulbOutlinedIcon sx={{ fontSize: '0.8rem', color: '#94a3b8' }} />
                  <Typography sx={{
                    fontSize: '0.5625rem',
                    fontWeight: 700,
                    color: '#94a3b8',
                    textTransform: 'uppercase',
                    letterSpacing: '0.13em',
                    fontFamily: 'Jost',
                  }}>
                    Ask about this
                  </Typography>
                </Box>
                <Stack sx={{ gap: 0.625 }}>
                  {knowledge.suggestions.map((s, i) => (
                    <Box
                      key={i}
                      onClick={() => handleSend(s)}
                      sx={{
                        px: 1.5,
                        py: 0.875,
                        fontSize: '0.75rem',
                        color: '#475569',
                        border: '1px solid #eef0f4',
                        cursor: 'pointer',
                        fontFamily: 'Jost',
                        lineHeight: 1.5,
                        transition: 'all 0.15s ease',
                        '&:hover': {
                          borderColor: colorPalette.primary,
                          color: colorPalette.primary,
                          bgcolor: `${colorPalette.primary}07`,
                        },
                      }}
                    >
                      {s}
                    </Box>
                  ))}
                </Stack>
              </Box>
            )}

            {/* Chat messages */}
            {messages.length > 0 && (
              <Box sx={{ px: 2, pt: 1.5, pb: 1 }}>
                <Stack sx={{ gap: 1.25 }}>
                  {messages.map((msg, i) => (
                    <Box key={i} sx={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                      <Box
                        sx={{
                          maxWidth: '90%',
                          px: 1.5,
                          py: 1,
                          bgcolor: msg.role === 'user' ? colorPalette.primary : '#f5f3fb',
                          color: msg.role === 'user' ? '#ffffff' : '#334155',
                          fontSize: '0.75rem',
                          lineHeight: 1.65,
                          fontFamily: 'Jost',
                        }}
                      >
                        {msg.text}
                      </Box>
                    </Box>
                  ))}

                  {/* Streaming AI reply */}
                  {(aiTyping || streamingAI) && (
                    <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
                      <Box sx={{
                        maxWidth: '90%',
                        px: 1.5,
                        py: 1,
                        bgcolor: '#f5f3fb',
                        color: '#334155',
                        fontSize: '0.75rem',
                        lineHeight: 1.65,
                        fontFamily: 'Jost',
                        minWidth: 52,
                      }}>
                        {/* Typing dots while waiting for first chars */}
                        {!streamingAI ? (
                          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', py: 0.25 }}>
                            {[0, 1, 2].map(i => (
                              <Box
                                key={i}
                                sx={{
                                  width: 5, height: 5, borderRadius: '50%', bgcolor: '#94a3b8',
                                  animation: `chatDot 1s ease-in-out ${i * 0.15}s infinite`,
                                  '@keyframes chatDot': {
                                    '0%, 60%, 100%': { transform: 'translateY(0)', opacity: 0.4 },
                                    '30%': { transform: 'translateY(-3px)', opacity: 1 },
                                  },
                                }}
                              />
                            ))}
                          </Box>
                        ) : (
                          <>
                            {streamingAI}
                            <Box
                              component="span"
                              sx={{
                                display: 'inline-block',
                                width: '2px', height: '0.85em',
                                bgcolor: '#94a3b8',
                                ml: '1px',
                                verticalAlign: 'text-bottom',
                                animation: 'cursorBlink2 0.75s step-end infinite',
                                '@keyframes cursorBlink2': {
                                  '0%, 100%': { opacity: 1 },
                                  '50%': { opacity: 0 },
                                },
                              }}
                            />
                          </>
                        )}
                      </Box>
                    </Box>
                  )}
                  {/* Dynamic Suggestions */}
                  {messages.length > 0 && !aiTyping && !streamingAI && dynamicSuggestions.length > 0 && (
                    <Box sx={{ mt: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
                        <LightbulbOutlinedIcon sx={{ fontSize: '0.8rem', color: '#94a3b8' }} />
                        <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.13em', fontFamily: 'Jost' }}>
                          Next Steps
                        </Typography>
                      </Box>
                      <Stack sx={{ gap: 0.625 }}>
                        {dynamicSuggestions.map((s, i) => (
                          <Box
                            key={i}
                            onClick={() => handleSend(s)}
                            sx={{
                              px: 1.5, py: 0.875, fontSize: '0.75rem', color: '#475569', border: '1px solid #eef0f4',
                              cursor: 'pointer', fontFamily: 'Jost', lineHeight: 1.5, transition: 'all 0.15s ease',
                              '&:hover': { borderColor: colorPalette.primary, color: colorPalette.primary, bgcolor: `${colorPalette.primary}07` },
                            }}
                          >
                            {s}
                          </Box>
                        ))}
                      </Stack>
                    </Box>
                  )}
                </Stack>
              </Box>
            )}

            <div ref={chatEndRef} />
          </Box>

          {/* Chat input */}
          <Box sx={{ p: 1.5, borderTop: '1px solid #eef0f4', flexShrink: 0 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: 0.875,
                bgcolor: '#f5f3fb',
                p: 1,
                border: '1px solid transparent',
                transition: 'all 0.18s',
                '&:focus-within': {
                  bgcolor: '#ffffff',
                  borderColor: colorPalette.primary,
                  boxShadow: `0 0 0 2px ${colorPalette.primary}18`,
                },
              }}
            >
              <InputBase
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                placeholder={phase === 'streaming' ? 'Eureka is thinking…' : 'Ask Eureka anything…'}
                multiline
                maxRows={3}
                disabled={phase === 'streaming'}
                sx={{
                  flex: 1,
                  fontSize: '0.75rem',
                  fontFamily: 'Jost',
                  color: '#00288e',
                  '& textarea::placeholder': { color: '#94a3b8', opacity: 1 },
                }}
              />
              <IconButton
                onClick={() => handleSend()}
                disabled={!input.trim() || aiTyping || phase === 'streaming'}
                disableRipple
                size="small"
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: 0,
                  flexShrink: 0,
                  bgcolor: input.trim() && !aiTyping && phase !== 'streaming'
                    ? colorPalette.primary
                    : '#e2e8f0',
                  color: input.trim() && !aiTyping && phase !== 'streaming'
                    ? '#ffffff'
                    : '#94a3b8',
                  transition: 'all 0.18s',
                  '&:hover:not(:disabled)': { bgcolor: '#1e293b' },
                }}
              >
                <SendRoundedIcon sx={{ fontSize: '0.875rem' }} />
              </IconButton>
            </Box>
          </Box>
        </Box>
      )}
    </>
  )

  return createPortal(content, document.body)
}
