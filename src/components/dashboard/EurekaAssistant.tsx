import {
  Box, IconButton, InputBase, Typography, Stack, Chip, CircularProgress, Tooltip, Collapse, Button,
} from '@mui/material'
import { colorPalette } from '@/theme'
import CloseRoundedIcon              from '@mui/icons-material/CloseRounded'
import AutoAwesomeOutlinedIcon        from '@mui/icons-material/AutoAwesomeOutlined'
import SendRoundedIcon                from '@mui/icons-material/SendRounded'
import AttachFileRoundedIcon          from '@mui/icons-material/AttachFileRounded'
import DeleteOutlineRoundedIcon       from '@mui/icons-material/DeleteOutlineRounded'
import LightbulbOutlinedIcon          from '@mui/icons-material/LightbulbOutlined'
import SearchRoundedIcon              from '@mui/icons-material/SearchRounded'
import ManageSearchRoundedIcon        from '@mui/icons-material/ManageSearchRounded'
import PeopleOutlineRoundedIcon       from '@mui/icons-material/PeopleOutlineRounded'
import ReceiptLongRoundedIcon         from '@mui/icons-material/ReceiptLongRounded'
import FolderOpenRoundedIcon          from '@mui/icons-material/FolderOpenRounded'
import LanguageRoundedIcon            from '@mui/icons-material/LanguageRounded'
import BarChartRoundedIcon            from '@mui/icons-material/BarChartRounded'
import KeyboardArrowDownRoundedIcon   from '@mui/icons-material/KeyboardArrowDownRounded'
import CheckCircleOutlineRoundedIcon  from '@mui/icons-material/CheckCircleOutlineRounded'
import OpenInFullRoundedIcon          from '@mui/icons-material/OpenInFullRounded'
import CloseFullscreenRoundedIcon     from '@mui/icons-material/CloseFullscreenRounded'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useLocation, useNavigate }                 from 'react-router-dom'
import { type EurekaMessage }                       from '@/api/eureka'
import { getBaseUrl }                               from '@/api/client'

interface EurekaAssistantProps {
  open: boolean
  onClose: () => void
}

interface ToolEvent {
  name: string
  label: string
  preview?: string
  done: boolean
}

interface UiMessage {
  role: 'user' | 'eureka'
  text: string
  isDoc?: boolean
  toolEvents?: ToolEvent[]
  navigate?: string
}

const TOOL_ICONS: Record<string, React.ReactNode> = {
  search_all:                  <ManageSearchRoundedIcon sx={{ fontSize: '0.75rem' }} />,
  search_customers:            <PeopleOutlineRoundedIcon  sx={{ fontSize: '0.75rem' }} />,
  get_customer:                <PeopleOutlineRoundedIcon  sx={{ fontSize: '0.75rem' }} />,
  get_customer_transactions:   <ReceiptLongRoundedIcon    sx={{ fontSize: '0.75rem' }} />,
  get_customer_cases:          <FolderOpenRoundedIcon     sx={{ fontSize: '0.75rem' }} />,
  list_transactions:           <ReceiptLongRoundedIcon    sx={{ fontSize: '0.75rem' }} />,
  get_transaction:             <ReceiptLongRoundedIcon    sx={{ fontSize: '0.75rem' }} />,
  list_cases:                  <FolderOpenRoundedIcon     sx={{ fontSize: '0.75rem' }} />,
  get_case:                    <FolderOpenRoundedIcon     sx={{ fontSize: '0.75rem' }} />,
  platform_stats:              <BarChartRoundedIcon       sx={{ fontSize: '0.75rem' }} />,
  web_search:                  <LanguageRoundedIcon       sx={{ fontSize: '0.75rem' }} />,
}
const DEFAULT_TOOL_ICON = <ManageSearchRoundedIcon sx={{ fontSize: '0.75rem' }} />

const INITIAL_PROMPTS = [
  'Show high-risk transactions today',
  'Summarize open investigation cases',
  'CBN AML thresholds for tier-3 accounts?',
  'Find watchlisted customers',
]

const PAGE_LABELS: Record<string, string> = {
  '/dashboard':                        'Overview',
  '/dashboard/transactions':           'Transactions',
  '/dashboard/aml':                    'AML Cases',
  '/dashboard/kyc':                    'KYC Pipeline',
  '/dashboard/customers':              'Customers',
  '/dashboard/reports':                'NFIU Reports',
  '/dashboard/thresholds':             'AML Thresholds',
  '/dashboard/workflows':              'CDD Workflows',
  '/dashboard/heatmaps':               'Heatmaps',
  '/dashboard/cbn':                    'CBN Compliance',
  '/dashboard/nomos':                  'Custom Rules',
  '/dashboard/transaction-monitoring': 'Transaction Monitoring',
  '/dashboard/settings':               'Settings',
  '/dashboard/team':                   'Team',
  '/dashboard/billing':                'Billing',
}

function getPageLabel(pathname: string): string {
  for (const [prefix, label] of Object.entries(PAGE_LABELS)) {
    if (pathname.startsWith(prefix + '/') || pathname === prefix) return label
  }
  return pathname.replace('/dashboard/', '').replace('-', ' ')
}

function renderMarkdown(text: string): React.ReactNode[] {
  return text.split('\n').map((line, i) => {
    if (line.startsWith('## '))
      return <Typography key={i} sx={{ fontWeight: 700, fontSize: '0.85rem', mt: 1, mb: 0.25, color: 'var(--heading-color)' }}>{line.slice(3)}</Typography>
    if (line.startsWith('# '))
      return <Typography key={i} sx={{ fontWeight: 700, fontSize: '0.9rem', mt: 1.25, mb: 0.25, color: 'var(--heading-color)' }}>{line.slice(2)}</Typography>
    if (line.startsWith('- ') || line.startsWith('• ')) {
      return (
        <Box key={i} sx={{ display: 'flex', gap: 0.625, mt: 0.375 }}>
          <Box component="span" sx={{ mt: '5px', width: 4, height: 4, borderRadius: '50%', bgcolor: colorPalette.primary, flexShrink: 0 }} />
          <Typography component="span" sx={{ fontSize: '0.8125rem', lineHeight: 1.55 }}>{renderInline(line.slice(2))}</Typography>
        </Box>
      )
    }
    const nm = line.match(/^(\d+)\.\s+(.+)/)
    if (nm) {
      return (
        <Box key={i} sx={{ display: 'flex', gap: 0.625, mt: 0.375 }}>
          <Typography component="span" sx={{ fontSize: '0.8125rem', fontWeight: 600, color: colorPalette.primary, flexShrink: 0 }}>{nm[1]}.</Typography>
          <Typography component="span" sx={{ fontSize: '0.8125rem', lineHeight: 1.55 }}>{renderInline(nm[2])}</Typography>
        </Box>
      )
    }
    if (line.trim() === '') return <Box key={i} sx={{ height: 4 }} />
    return <Typography key={i} component="p" sx={{ fontSize: '0.8125rem', lineHeight: 1.6, mt: 0.125, mb: 0 }}>{renderInline(line)}</Typography>
  })
}

function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = []
  const regex = /\*\*(.+?)\*\*|`(.+?)`/g
  let last = 0, m: RegExpExecArray | null
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    if (m[1]) parts.push(<strong key={m.index}>{m[1]}</strong>)
    if (m[2]) parts.push(<Box key={m.index} component="code" sx={{ fontFamily: 'monospace', bgcolor: 'rgba(0,0,0,0.07)', px: 0.5, borderRadius: '3px', fontSize: '0.8em' }}>{m[2]}</Box>)
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return <>{parts}</>
}

function ToolPanel({ events, open: panelOpen, onToggle }: { events: ToolEvent[], open: boolean, onToggle: () => void }) {
  if (events.length === 0) return null
  const allDone = events.every(e => e.done)
  return (
    <Box sx={{ mb: 0.75 }}>
      <Box
        onClick={onToggle}
        sx={{
          display: 'flex', alignItems: 'center', gap: 0.625, cursor: 'pointer',
          px: 1, py: 0.5,
          bgcolor: `${colorPalette.primary}0a`,
          border: `1px solid ${colorPalette.primary}1a`,
          borderRadius: '6px',
          '&:hover': { bgcolor: `${colorPalette.primary}14` },
          transition: 'background 0.15s',
        }}
      >
        {allDone
          ? <CheckCircleOutlineRoundedIcon sx={{ fontSize: '0.75rem', color: '#10b981' }} />
          : <CircularProgress size={9} thickness={5} sx={{ color: colorPalette.primary }} />
        }
        <Typography sx={{ flex: 1, fontSize: '0.6875rem', fontWeight: 600, color: colorPalette.primary }}>
          {allDone ? `${events.length} tool${events.length > 1 ? 's' : ''} used` : 'Running tools…'}
        </Typography>
        <KeyboardArrowDownRoundedIcon sx={{ fontSize: '0.75rem', color: colorPalette.primary, transform: panelOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </Box>
      <Collapse in={panelOpen}>
        <Box sx={{ border: `1px solid ${colorPalette.primary}1a`, borderTop: 'none', borderRadius: '0 0 6px 6px', px: 1, py: 0.625 }}>
          <Stack sx={{ gap: 0.5 }}>
            {events.map((ev, i) => (
              <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75 }}>
                <Box sx={{ mt: '2px', color: ev.done ? '#10b981' : colorPalette.primary }}>
                  {ev.done
                    ? <CheckCircleOutlineRoundedIcon sx={{ fontSize: '0.75rem' }} />
                    : <CircularProgress size={9} thickness={5} sx={{ color: colorPalette.primary }} />
                  }
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.375 }}>
                    <Box sx={{ color: '#64748b' }}>{TOOL_ICONS[ev.name] ?? DEFAULT_TOOL_ICON}</Box>
                    <Typography sx={{ fontSize: '0.6875rem', color: 'var(--heading-color)', fontWeight: 500 }}>{ev.label}</Typography>
                  </Box>
                  {ev.preview && (
                    <Typography sx={{ fontSize: '0.625rem', color: '#94a3b8', mt: 0.125 }}>{ev.preview}</Typography>
                  )}
                </Box>
              </Box>
            ))}
          </Stack>
        </Box>
      </Collapse>
    </Box>
  )
}

function NavigationConsentCard({ path, onConfirm, onDismiss }: { path: string; onConfirm: () => void; onDismiss: () => void }) {
  const label = PAGE_LABELS[path] ?? path.replace('/dashboard/', '').replace(/-/g, ' ')
  return (
    <Box sx={{
      mt: 0.75,
      p: 1.25,
      border: `1px solid ${colorPalette.primary}30`,
      borderRadius: '10px',
      bgcolor: `${colorPalette.primary}06`,
    }}>
      <Typography sx={{ fontSize: '0.75rem', color: 'var(--heading-color)', fontWeight: 600, mb: 0.375 }}>
        Navigate to {label}?
      </Typography>
      <Typography sx={{ fontSize: '0.6875rem', color: '#64748b', mb: 1 }}>
        Eureka found relevant records on the <strong>{label}</strong> page. Go there now?
      </Typography>
      <Box sx={{ display: 'flex', gap: 0.75 }}>
        <Button
          size="small" disableRipple onClick={onConfirm}
          sx={{
            fontSize: '0.6875rem', fontWeight: 600, px: 1.25, py: 0.4,
            bgcolor: colorPalette.primary, color: '#fff', borderRadius: '6px',
            textTransform: 'none', minWidth: 0,
            '&:hover': { bgcolor: '#1e293b' },
          }}
        >
          Take me there
        </Button>
        <Button
          size="small" disableRipple onClick={onDismiss}
          sx={{
            fontSize: '0.6875rem', fontWeight: 600, px: 1.25, py: 0.4,
            bgcolor: 'transparent', color: '#64748b', borderRadius: '6px',
            border: '1px solid var(--border-col)', textTransform: 'none', minWidth: 0,
            '&:hover': { bgcolor: 'var(--section-bg)', color: 'var(--heading-color)' },
          }}
        >
          Stay here
        </Button>
      </Box>
    </Box>
  )
}

export default function EurekaAssistant({ open, onClose }: EurekaAssistantProps) {
  const location = useLocation()
  const navigate = useNavigate()

  const [input, setInput]              = useState('')
  const [messages, setMessages]        = useState<UiMessage[]>([])
  const [history, setHistory]          = useState<EurekaMessage[]>([])
  const [isLoading, setIsLoading]      = useState(false)
  const [suggestedPrompts, setPrompts] = useState<string[]>(INITIAL_PROMPTS)
  const [docContent, setDocContent]    = useState<string | null>(null)
  const [docName, setDocName]          = useState<string | null>(null)
  const [docError, setDocError]        = useState<string | null>(null)
  const [expanded, setExpanded]        = useState(false)

  const [streamingTools, setStreamingTools] = useState<ToolEvent[]>([])
  const [toolPanelOpen, setToolPanelOpen]   = useState(true)
  const [streamingText, setStreamingText]   = useState('')
  const streamingReplyRef  = useRef('')
  const animFrameRef       = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef           = useRef<AbortController | null>(null)
  const scrollRef          = useRef<HTMLDivElement>(null)
  const fileInputRef       = useRef<HTMLInputElement>(null)
  const inputRef           = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open && messages.length === 0) {
      const h = new Date().getHours()
      const greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
      setMessages([{
        role: 'eureka',
        text: `${greet}! I'm **Eureka** by Jilo Technologies.\n\nI can analyze transactions, investigate cases, look up customers, search regulations, and navigate the platform. How can I help?`,
      }])
    }
    if (open) setTimeout(() => inputRef.current?.focus(), 150)
  }, [open])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isLoading, streamingText, streamingTools])

  const animateText = useCallback((fullText: string, onDone: () => void) => {
    let idx = 0
    setStreamingText('')
    streamingReplyRef.current = fullText
    function tick() {
      idx++
      if (idx <= fullText.length) {
        setStreamingText(fullText.slice(0, idx))
        animFrameRef.current = setTimeout(tick, 14)
      } else {
        onDone()
      }
    }
    tick()
  }, [])

  const handleSend = useCallback(async (forcedInput?: string) => {
    const text = (forcedInput ?? input).trim()
    if (!text || isLoading) return

    setInput('')
    setMessages(prev => {
      const next = [...prev, { role: 'user' as const, text }]
      if (docContent && docName) next.push({ role: 'user' as const, text: `📎 ${docName}`, isDoc: true })
      return next
    })
    setIsLoading(true)
    setStreamingTools([])
    setStreamingText('')
    setToolPanelOpen(true)

    const capturedDoc  = docContent
    const capturedName = docName
    const capturedHist = history
    const capturedPath = location.pathname
    setDocContent(null)
    setDocName(null)

    abortRef.current = new AbortController()

    try {
      const res = await fetch(`${getBaseUrl()}/api/v1/chat/eureka/stream`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessage:     text,
          history:         capturedHist,
          pageContext:     capturedPath,
          documentContent: capturedDoc ?? undefined,
        }),
        signal: abortRef.current.signal,
      })

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data:')) continue
          const raw = line.slice(5).trim()
          if (!raw) continue
          let evt: { type: string; name?: string; label?: string; preview?: string; reply?: string; navigate?: string; message?: string }
          try { evt = JSON.parse(raw) } catch { continue }

          if (evt.type === 'tool_start' && evt.name && evt.label) {
            setStreamingTools(prev => [...prev, { name: evt.name!, label: evt.label!, done: false }])
          } else if (evt.type === 'tool_end' && evt.name) {
            setStreamingTools(prev => prev.map(t =>
              t.name === evt.name && !t.done ? { ...t, done: true, preview: evt.preview } : t
            ))
          } else if (evt.type === 'done') {
            const reply   = evt.reply ?? ''
            const navPath = evt.navigate
            setStreamingTools(prev => prev.map(t => ({ ...t, done: true })))
            animateText(reply, () => {
              setStreamingText('')
              setStreamingTools([])
              // Attach navigate path to the message — renders a consent card, never auto-navigates
              setMessages(msgs => [...msgs, { role: 'eureka', text: reply, navigate: navPath }])
              setHistory(h => [...h, { role: 'user', content: text }, { role: 'assistant', content: reply }])
              setPrompts(getContextPrompts(capturedPath))
              setIsLoading(false)
            })
            return
          } else if (evt.type === 'error') {
            throw new Error(evt.message ?? 'Unknown error')
          }
        }
      }
      setIsLoading(false)
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') { setIsLoading(false); return }
      setStreamingText('')
      setStreamingTools([])
      setMessages(prev => [...prev, { role: 'eureka', text: 'Sorry, I ran into an error. Please try again.' }])
      setIsLoading(false)
      if (capturedDoc) { setDocContent(capturedDoc); setDocName(capturedName) }
    }
  }, [input, isLoading, history, location.pathname, docContent, docName, navigate, animateText])

  useEffect(() => () => {
    if (animFrameRef.current) clearTimeout(animFrameRef.current)
    abortRef.current?.abort()
  }, [])

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    if (file.size > 2 * 1024 * 1024) { setDocError('Max 2 MB'); return }
    if (!file.name.match(/\.(txt|pdf|doc|docx|md)$/i)) { setDocError('Only .txt .pdf .doc .docx .md'); return }
    setDocError(null)
    setDocContent(await file.text())
    setDocName(file.name)
  }

  const pageLabel   = getPageLabel(location.pathname)
  const chatW       = expanded ? 520 : 380
  const chatH       = expanded ? 680 : 520

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 100,
        right: 24,
        width: chatW,
        height: chatH,
        zIndex: 1200,
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'var(--card-bg)',
        border: '1px solid var(--border-col)',
        borderRadius: '16px',
        boxShadow: '0 24px 64px rgba(15,23,42,0.18), 0 4px 16px rgba(15,23,42,0.08)',
        overflow: 'hidden',
        transform: open ? 'scale(1) translateY(0)' : 'scale(0.92) translateY(16px)',
        opacity: open ? 1 : 0,
        pointerEvents: open ? 'auto' : 'none',
        transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease, width 0.3s ease, height 0.3s ease',
        transformOrigin: 'bottom right',
      }}
    >
      {/* Header */}
      <Box sx={{
        px: 2, py: 1.5,
        background: `linear-gradient(135deg, ${colorPalette.primary}14 0%, ${colorPalette.primary}06 100%)`,
        borderBottom: '1px solid var(--border-col)',
        display: 'flex', alignItems: 'center', gap: 1.25,
        flexShrink: 0,
      }}>
        <Box sx={{
          width: 34, height: 34, borderRadius: '10px',
          bgcolor: colorPalette.primary,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          boxShadow: `0 4px 12px ${colorPalette.primary}40`,
        }}>
          <AutoAwesomeOutlinedIcon sx={{ color: '#fff', fontSize: '1.05rem' }} />
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost' }}>
              Eureka
            </Typography>
            <Chip
              label={pageLabel}
              size="small"
              sx={{ fontSize: '0.6rem', height: 18, bgcolor: `${colorPalette.primary}14`, color: colorPalette.primary, fontWeight: 700, border: 'none', px: 0.25 }}
            />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{
              width: 5, height: 5, borderRadius: '50%',
              bgcolor: isLoading ? colorPalette.primary : '#10b981',
              animation: isLoading ? 'pulse 1s infinite' : 'none',
              '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.3 } },
            }} />
            <Typography sx={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 500 }}>
              {isLoading ? 'Thinking…' : 'Compliance AI · Jilo Technologies'}
            </Typography>
          </Box>
        </Box>

        <Tooltip title={expanded ? 'Compact' : 'Expand'} placement="top">
          <IconButton disableRipple size="small" onClick={() => setExpanded(p => !p)}
            sx={{ color: '#94a3b8', p: 0.5, '&:hover': { color: colorPalette.primary } }}>
            {expanded
              ? <CloseFullscreenRoundedIcon sx={{ fontSize: '0.95rem' }} />
              : <OpenInFullRoundedIcon      sx={{ fontSize: '0.95rem' }} />
            }
          </IconButton>
        </Tooltip>
        <IconButton disableRipple size="small" onClick={onClose}
          sx={{ color: '#94a3b8', p: 0.5, '&:hover': { color: '#ef4444' } }}>
          <CloseRoundedIcon sx={{ fontSize: '1.05rem' }} />
        </IconButton>
      </Box>

      {/* Messages */}
      <Box ref={scrollRef} sx={{ flex: 1, overflowY: 'auto', px: 1.75, py: 1.5, display: 'flex', flexDirection: 'column', gap: 1.25,
        '&::-webkit-scrollbar': { width: 4 },
        '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
        '&::-webkit-scrollbar-thumb': { bgcolor: 'var(--border-col)', borderRadius: 4 },
      }}>

        {messages.map((msg, i) => (
          <Box key={i} sx={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            {msg.role === 'eureka' && (
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, maxWidth: '90%' }}>
                <Box sx={{ width: 24, height: 24, borderRadius: '7px', bgcolor: `${colorPalette.primary}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, mt: 0.125 }}>
                  <AutoAwesomeOutlinedIcon sx={{ color: colorPalette.primary, fontSize: '0.75rem' }} />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{
                    bgcolor: 'var(--section-bg)',
                    border: '1px solid var(--border-col)',
                    borderRadius: '12px 12px 12px 3px',
                    px: 1.5, py: 1.125,
                  }}>
                    {msg.isDoc
                      ? <Typography sx={{ fontSize: '0.75rem', color: colorPalette.primary }}>{msg.text}</Typography>
                      : <Box sx={{ '& p': { mt: 0, mb: 0 } }}>{renderMarkdown(msg.text)}</Box>
                    }
                  </Box>
                  {msg.navigate && (
                    <NavigationConsentCard
                      path={msg.navigate}
                      onConfirm={() => {
                        navigate(msg.navigate!)
                        setMessages(prev => prev.map((m, j) => j === i ? { ...m, navigate: undefined } : m))
                      }}
                      onDismiss={() => setMessages(prev => prev.map((m, j) => j === i ? { ...m, navigate: undefined } : m))}
                    />
                  )}
                </Box>
              </Box>
            )}
            {msg.role === 'user' && (
              <Box sx={{
                maxWidth: '85%',
                bgcolor: colorPalette.primary,
                color: '#fff',
                borderRadius: '12px 12px 3px 12px',
                px: 1.5, py: 1,
                fontSize: '0.8125rem',
                lineHeight: 1.55,
              }}>
                {msg.isDoc
                  ? <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.85)' }}>{msg.text}</Typography>
                  : msg.text
                }
              </Box>
            )}
          </Box>
        ))}

        {/* Live stream */}
        {isLoading && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 0.75, width: '100%' }}>
              <Box sx={{ width: 24, height: 24, borderRadius: '7px', bgcolor: `${colorPalette.primary}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, mb: 0.125 }}>
                <AutoAwesomeOutlinedIcon sx={{ color: colorPalette.primary, fontSize: '0.75rem' }} />
              </Box>
              <Box sx={{ flex: 1, maxWidth: '85%' }}>
                <ToolPanel events={streamingTools} open={toolPanelOpen} onToggle={() => setToolPanelOpen(p => !p)} />

                {streamingText ? (
                  <Box sx={{
                    bgcolor: 'var(--section-bg)', border: '1px solid var(--border-col)',
                    borderRadius: '12px 12px 12px 3px', px: 1.5, py: 1.125,
                  }}>
                    <Box sx={{ '& p': { mt: 0, mb: 0 } }}>{renderMarkdown(streamingText)}</Box>
                    <Box component="span" sx={{
                      display: 'inline-block', width: 2, height: '0.85em',
                      bgcolor: colorPalette.primary, ml: 0.25, verticalAlign: 'text-bottom',
                      animation: 'blink 0.8s step-end infinite',
                      '@keyframes blink': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0 } },
                    }} />
                  </Box>
                ) : streamingTools.length === 0 && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.875, px: 1.5, py: 1,
                    bgcolor: 'var(--section-bg)', border: '1px solid var(--border-col)', borderRadius: '12px 12px 12px 3px' }}>
                    <Box sx={{ display: 'flex', gap: 0.375 }}>
                      {[0, 1, 2].map(j => (
                        <Box key={j} sx={{
                          width: 5, height: 5, borderRadius: '50%', bgcolor: colorPalette.primary,
                          animation: 'bounce 1.2s ease infinite',
                          animationDelay: `${j * 0.2}s`,
                          '@keyframes bounce': { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-4px)' } },
                        }} />
                      ))}
                    </Box>
                    <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>Eureka is thinking…</Typography>
                  </Box>
                )}
              </Box>
            </Box>
          </Box>
        )}

        {/* Suggested prompts — shown below last message when idle */}
        {!isLoading && messages.length > 0 && (
          <Box sx={{ mt: 0.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.75 }}>
              <LightbulbOutlinedIcon sx={{ fontSize: '0.75rem', color: '#94a3b8' }} />
              <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {messages.length <= 1 ? 'Try asking' : 'Next steps'}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {suggestedPrompts.map((p, i) => (
                <Box
                  key={i}
                  onClick={() => handleSend(p)}
                  sx={{
                    px: 1, py: 0.5,
                    fontSize: '0.6875rem',
                    color: 'var(--on-surface-variant)',
                    border: '1px solid var(--border-col)',
                    borderRadius: '20px',
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 0.375,
                    transition: 'all 0.15s',
                    '&:hover': { borderColor: colorPalette.primary, color: colorPalette.primary, bgcolor: `${colorPalette.primary}08` },
                  }}
                >
                  <SearchRoundedIcon sx={{ fontSize: '0.625rem', opacity: 0.5 }} />
                  {p}
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </Box>

      {/* Doc pill */}
      {(docContent || docError) && (
        <Box sx={{ px: 1.75, pt: 0.75, flexShrink: 0 }}>
          {docError && <Typography sx={{ fontSize: '0.7rem', color: '#ef4444', mb: 0.375 }}>{docError}</Typography>}
          {docContent && docName && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1, py: 0.5, bgcolor: `${colorPalette.primary}08`, border: `1px solid ${colorPalette.primary}25`, borderRadius: '8px' }}>
              <AttachFileRoundedIcon sx={{ fontSize: '0.8rem', color: colorPalette.primary }} />
              <Typography sx={{ flex: 1, fontSize: '0.75rem', color: colorPalette.primary, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {docName}
              </Typography>
              <IconButton size="small" disableRipple onClick={() => { setDocContent(null); setDocName(null) }}
                sx={{ color: '#94a3b8', p: 0, '&:hover': { color: '#ef4444' } }}>
                <DeleteOutlineRoundedIcon sx={{ fontSize: '0.875rem' }} />
              </IconButton>
            </Box>
          )}
        </Box>
      )}

      {/* Input */}
      <Box sx={{ px: 1.75, pb: 1.5, pt: 0.875, flexShrink: 0 }}>
        <Box sx={{
          display: 'flex', alignItems: 'flex-end', gap: 0.75,
          bgcolor: 'var(--section-bg)',
          border: '1.5px solid var(--border-col)',
          borderRadius: '12px',
          px: 1.25, py: 0.875,
          transition: 'border-color 0.18s, box-shadow 0.18s',
          '&:focus-within': { borderColor: colorPalette.primary, boxShadow: `0 0 0 3px ${colorPalette.primary}12`, bgcolor: 'var(--card-bg)' },
        }}>
          <Tooltip title="Attach regulatory document" placement="top">
            <IconButton disableRipple size="small" onClick={() => fileInputRef.current?.click()} disabled={isLoading}
              sx={{ color: docContent ? colorPalette.primary : '#94a3b8', p: 0.375, '&:hover': { color: colorPalette.primary } }}>
              <AttachFileRoundedIcon sx={{ fontSize: '1rem' }} />
            </IconButton>
          </Tooltip>
          <input ref={fileInputRef} type="file" accept=".txt,.pdf,.doc,.docx,.md" style={{ display: 'none' }} onChange={handleFile} />

          <InputBase
            inputRef={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            placeholder="Ask Eureka…"
            multiline
            maxRows={3}
            disabled={isLoading}
            sx={{
              flex: 1,
              fontSize: '0.8125rem',
              fontFamily: 'Jost',
              color: 'var(--heading-color)',
              '& textarea::placeholder': { color: '#94a3b8', opacity: 1 },
            }}
          />

          <IconButton
            disableRipple
            disabled={(!input.trim() && !docContent) || isLoading}
            onClick={() => handleSend()}
            sx={{
              bgcolor: (input.trim() || docContent) && !isLoading ? colorPalette.primary : 'transparent',
              color: (input.trim() || docContent) && !isLoading ? '#fff' : '#94a3b8',
              width: 30, height: 30, borderRadius: '8px',
              transition: 'all 0.18s',
              '&:hover': { bgcolor: (input.trim() || docContent) && !isLoading ? '#1e293b' : 'transparent' },
              '&:disabled': { color: '#cbd5e1' },
            }}
          >
            <SendRoundedIcon sx={{ fontSize: '0.9rem' }} />
          </IconButton>
        </Box>
        <Typography sx={{ fontSize: '0.6rem', color: '#cbd5e1', textAlign: 'center', mt: 0.625 }}>
          Eureka · Jilo Technologies · Verify all regulated decisions
        </Typography>
      </Box>
    </Box>
  )
}

function getContextPrompts(pathname: string): string[] {
  if (pathname.includes('/transactions'))    return ['Flag as suspicious', 'Explain risk factors', 'Find similar patterns', 'File an STR']
  if (pathname.includes('/aml'))             return ['Cases past SLA?', 'Unassigned critical cases', 'Summarize by priority', 'Export case summary']
  if (pathname.includes('/kyc'))             return ['Why did KYC fail?', 'Tier-3 KYC requirements', 'Pending CDD list', 'Enhanced due diligence?']
  if (pathname.includes('/customers'))       return ['Risk score above 75', 'Watchlisted customers', 'BVN mismatch list', 'Unverified KYC']
  if (pathname.includes('/thresholds'))      return ['FATF STR thresholds', 'Velocity rule calibration', 'CBN tier-1 daily limit', 'Single transaction limit']
  if (pathname.includes('/reports'))         return ['SAR narrative template', 'Next NFIU deadline', 'STR requirements', 'goAML filing steps']
  if (pathname.includes('/cbn'))             return ['CBN AML/CFT 2023 summary', 'Late STR penalty', 'Correspondent banking risk', 'PEP screening rules']
  return INITIAL_PROMPTS
}
