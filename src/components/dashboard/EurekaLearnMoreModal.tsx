import { useEffect, useRef, useState, useCallback } from 'react'
import {
  Dialog, DialogTitle, DialogContent, Box, Typography,
  IconButton, InputBase, Stack,
} from '@mui/material'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import SendRoundedIcon from '@mui/icons-material/SendRounded'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined'
import { colorPalette } from '@/theme'

const INTRODUCTION = `Eureka is OpenIV's embedded compliance intelligence companion. It monitors everything you do across the platform in real time — from transaction volumes and flagged activity to open AML cases and regulatory deadlines — and surfaces context-aware insights exactly when and where you need them.

When Eureka Realtime Buddy is active, simply hover over any navigation item for two seconds. A thinking bubble will appear, followed by a detailed explanation of that module and smart suggestions tailored to your current compliance posture. You can continue the conversation in the chat panel without ever leaving your workflow.

Eureka is powered by OpenIV's compliance knowledge graph — trained on CBN guidelines, NFIU reporting requirements, FATF standards, and your institution's own behavioral baseline. It learns the patterns that matter to your team and proactively flags emerging risks before they become regulatory findings.

Toggle Eureka Realtime Buddy on or off at any time from Settings. Your preference is saved to your account and persists across sessions and devices.`

const SUGGESTIONS = [
  'How does Eureka detect risk patterns?',
  'Does Eureka have access to my transactions?',
  'Can Eureka file NFIU reports automatically?',
  'What is the difference between Eureka and the main AI assistant?',
]

function simulateResponse(msg: string): string {
  const lower = msg.toLowerCase()

  if (lower.includes('risk') || lower.includes('detect') || lower.includes('pattern')) {
    return `Eureka's risk detection combines three layers: rule-based thresholds you configure (velocity, amount, geography), behavioral baselines built from your institution's 30-day rolling history, and a compliance knowledge graph trained on CBN and NFIU enforcement patterns. When all three signals converge on the same entity or transaction, Eureka surfaces a high-confidence alert.`
  }
  if (lower.includes('transaction') || lower.includes('access') || lower.includes('data')) {
    return `Eureka operates entirely within your institution's data boundary — it never shares your data externally. It analyzes the transaction and case data already ingested into OpenIV via Beam, giving you insights grounded in your own institution's activity rather than generic benchmarks.`
  }
  if (lower.includes('nfiu') || lower.includes('file') || lower.includes('report') || lower.includes('automatic')) {
    return `Yes — when Auto-file STRs is enabled in Settings and a transaction's risk score exceeds 90, Eureka can submit an NFIU Suspicious Activity Report without manual intervention. Each auto-filed report is logged in Reports & Filings with a full audit trail. You retain full override capability at any time.`
  }
  if (lower.includes('difference') || lower.includes('assistant') || lower.includes('main')) {
    return `The Eureka Realtime Buddy (the hover feature you just toggled) provides passive, contextual guidance as you navigate the platform — no interaction required. The main Eureka AI Assistant (the floating button in the bottom-right corner) is a proactive conversational agent you can ask anything about your compliance posture, regulatory obligations, or platform capabilities. Both share the same knowledge graph but serve different workflow moments.`
  }
  if (lower.includes('toggle') || lower.includes('off') || lower.includes('disable') || lower.includes('setting')) {
    return `You can toggle Eureka Realtime Buddy on or off in Settings → Eureka Companion. Your preference is saved to your user account and synced across all your sessions. When disabled, the hover bubble and cursor glow effects are fully hidden — none of the tracking events fire either.`
  }
  if (lower.includes('cbn') || lower.includes('regulation') || lower.includes('compliance')) {
    return `Eureka's compliance knowledge covers CBN AML/CFT regulations, NFIU reporting obligations, FATF Recommendations, and the Nigerian Financial Crimes Commission guidelines. It cross-references these frameworks against your institution's current posture and surfaces the gaps most likely to result in regulatory findings during an examination.`
  }

  const fallbacks = [
    `Eureka is designed to reduce the cognitive load on your compliance team. Rather than switching between regulation documents, platform dashboards, and case notes, Eureka synthesizes all of that context and delivers it inline — so your analysts stay in flow and your CCO always has a clear picture of institutional risk posture.`,
    `That's a great question. Eureka's core principle is that compliance intelligence should be ambient — present when you need it, invisible when you don't. Whether you're reviewing a suspicious transaction or drafting a CBN filing, Eureka's context matches the task you're performing, not a generic response.`,
    `OpenIV's AI is built for regulated environments. Every Eureka interaction is logged with your session identity, the exact suggestion shown, and your response — creating a defensible audit trail that demonstrates your team acted on material compliance intelligence. That traceability matters in examinations.`,
  ]
  return fallbacks[msg.length % fallbacks.length]
}

type Phase = 'streaming' | 'ready'

interface ChatMsg {
  role: 'user' | 'ai'
  text: string
}

interface Props {
  open: boolean
  onClose: () => void
}

export default function EurekaLearnMoreModal({ open, onClose }: Props) {
  const [phase,         setPhase]         = useState<Phase>('streaming')
  const [displayedText, setDisplayedText] = useState('')
  const [messages,      setMessages]      = useState<ChatMsg[]>([])
  const [streamingAI,   setStreamingAI]   = useState('')
  const [aiTyping,      setAiTyping]      = useState(false)
  const [input,         setInput]         = useState('')

  const allIntervalsRef = useRef<Set<ReturnType<typeof setInterval>>>(new Set())
  const chatEndRef      = useRef<HTMLDivElement>(null)

  // Stream the intro when modal opens
  useEffect(() => {
    if (!open) return
    setPhase('streaming')
    setDisplayedText('')
    setMessages([])
    setStreamingAI('')
    setAiTyping(false)
    setInput('')

    let index = 0
    const id = setInterval(() => {
      index++
      setDisplayedText(INTRODUCTION.slice(0, index))
      if (index >= INTRODUCTION.length) {
        clearInterval(id)
        allIntervalsRef.current.delete(id)
        setPhase('ready')
      }
    }, 9)
    allIntervalsRef.current.add(id)
    return () => { clearInterval(id); allIntervalsRef.current.delete(id) }
  }, [open])

  // Cleanup on unmount
  useEffect(() => () => {
    allIntervalsRef.current.forEach(clearInterval)
  }, [])

  // Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingAI, displayedText])

  const handleSend = useCallback(async (forcedText?: string) => {
    const userText = (forcedText ?? input).trim()
    if (!userText || aiTyping) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: userText }])
    setAiTyping(true)
    setStreamingAI('')

    await new Promise<void>(r => setTimeout(r, 600 + Math.random() * 400))

    const response = simulateResponse(userText)
    let i = 0
    const id = setInterval(() => {
      i++
      setStreamingAI(response.slice(0, i))
      if (i >= response.length) {
        clearInterval(id)
        allIntervalsRef.current.delete(id)
        setAiTyping(false)
        setMessages(prev => [...prev, { role: 'ai', text: response }])
        setStreamingAI('')
      }
    }, 12)
    allIntervalsRef.current.add(id)
  }, [input, aiTyping])

  const showSuggestions = phase === 'ready' && messages.length === 0

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 0,
          height: '76vh',
          maxHeight: 640,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        },
      }}
    >
      {/* Header */}
      <DialogTitle
        sx={{
          p: 0,
          borderBottom: '1px solid #eef0f4',
          flexShrink: 0,
        }}
      >
        <Box sx={{ px: 2.5, py: 1.75, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              bgcolor: colorPalette.primary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              flexShrink: 0,
            }}
          >
            <AutoAwesomeOutlinedIcon sx={{ color: '#ffffff', fontSize: '1.1rem' }} />
            <Box sx={{
              position: 'absolute', top: 3, right: 3,
              width: 7, height: 7, borderRadius: '50%',
              bgcolor: '#10b981', border: '1.5px solid #fff',
            }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost', lineHeight: 1.2 }}>
              Eureka Companion
            </Typography>
            <Typography sx={{ fontSize: '0.6875rem', color: '#64748b', fontFamily: 'Jost' }}>
              Your realtime compliance intelligence buddy
            </Typography>
          </Box>
          <IconButton
            onClick={onClose}
            size="small"
            disableRipple
            sx={{ color: '#94a3b8', borderRadius: 0, '&:hover': { color: '#00288e', bgcolor: '#f8fafc' } }}
          >
            <CloseRoundedIcon sx={{ fontSize: '1.1rem' }} />
          </IconButton>
        </Box>
      </DialogTitle>

      {/* Scrollable body */}
      <DialogContent sx={{ flex: 1, overflowY: 'auto', p: 0, minHeight: 0 }}>
        {/* Streamed introduction */}
        <Box sx={{ p: 2.5, pb: showSuggestions ? 0 : 2.5 }}>
          <Typography sx={{ fontSize: '0.875rem', color: '#334155', lineHeight: 1.75, fontFamily: 'Jost', whiteSpace: 'pre-wrap' }}>
            {displayedText}
            {phase === 'streaming' && (
              <Box
                component="span"
                sx={{
                  display: 'inline-block',
                  width: '2px',
                  height: '1em',
                  bgcolor: colorPalette.primary,
                  ml: '1px',
                  verticalAlign: 'text-bottom',
                  animation: 'cursorBlink 0.75s step-end infinite',
                  '@keyframes cursorBlink': {
                    '0%, 100%': { opacity: 1 },
                    '50%':      { opacity: 0 },
                  },
                }}
              />
            )}
          </Typography>
        </Box>

        {/* Suggestions */}
        {showSuggestions && (
          <Box sx={{ px: 2.5, pt: 2, pb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.25 }}>
              <LightbulbOutlinedIcon sx={{ fontSize: '0.875rem', color: '#94a3b8' }} />
              <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.13em', fontFamily: 'Jost' }}>
                Ask Eureka
              </Typography>
            </Box>
            <Stack sx={{ gap: 0.75 }}>
              {SUGGESTIONS.map((s, i) => (
                <Box
                  key={i}
                  onClick={() => handleSend(s)}
                  sx={{
                    px: 1.75,
                    py: 1,
                    fontSize: '0.8125rem',
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
          <Box sx={{ px: 2.5, pt: 1.5, pb: 1 }}>
            <Stack sx={{ gap: 1.5 }}>
              {messages.map((msg, i) => (
                <Box key={i} sx={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <Box
                    sx={{
                      maxWidth: '88%',
                      px: 1.75,
                      py: 1.125,
                      bgcolor: msg.role === 'user' ? colorPalette.primary : '#f5f3fb',
                      color:   msg.role === 'user' ? '#ffffff' : '#334155',
                      fontSize: '0.8125rem',
                      lineHeight: 1.65,
                      fontFamily: 'Jost',
                    }}
                  >
                    {msg.text}
                  </Box>
                </Box>
              ))}

              {(aiTyping || streamingAI) && (
                <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <Box sx={{
                    maxWidth: '88%', px: 1.75, py: 1.125,
                    bgcolor: '#f5f3fb', color: '#334155',
                    fontSize: '0.8125rem', lineHeight: 1.65, fontFamily: 'Jost', minWidth: 60,
                  }}>
                    {!streamingAI ? (
                      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', py: 0.25 }}>
                        {[0, 1, 2].map(i => (
                          <Box
                            key={i}
                            sx={{
                              width: 5, height: 5, borderRadius: '50%', bgcolor: '#94a3b8',
                              animation: `chatDot 1s ease-in-out ${i * 0.15}s infinite`,
                              '@keyframes chatDot': {
                                '0%, 60%, 100%': { transform: 'translateY(0)',    opacity: 0.4 },
                                '30%':           { transform: 'translateY(-4px)', opacity: 1   },
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
                            display: 'inline-block', width: '2px', height: '0.85em',
                            bgcolor: '#94a3b8', ml: '1px', verticalAlign: 'text-bottom',
                            animation: 'cursorBlink2 0.75s step-end infinite',
                            '@keyframes cursorBlink2': {
                              '0%, 100%': { opacity: 1 },
                              '50%':      { opacity: 0 },
                            },
                          }}
                        />
                      </>
                    )}
                  </Box>
                </Box>
              )}
            </Stack>
          </Box>
        )}

        <div ref={chatEndRef} />
      </DialogContent>

      {/* Chat input */}
      <Box sx={{ p: 1.75, borderTop: '1px solid #eef0f4', flexShrink: 0 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 1,
            bgcolor: '#f5f3fb',
            p: 1.25,
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
            maxRows={4}
            disabled={phase === 'streaming'}
            sx={{
              flex: 1,
              fontSize: '0.8125rem',
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
              width: 32,
              height: 32,
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
            <SendRoundedIcon sx={{ fontSize: '1rem' }} />
          </IconButton>
        </Box>
      </Box>
    </Dialog>
  )
}
