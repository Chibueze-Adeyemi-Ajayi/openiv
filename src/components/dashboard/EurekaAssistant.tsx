import { Box, IconButton, InputBase, Typography, Stack } from '@mui/material'
import { colorPalette } from '@/theme'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'
import SendRoundedIcon from '@mui/icons-material/SendRounded'
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined'
import { useEffect, useRef, useState } from 'react'
import { getEurekaResponse, getGreeting, type Message } from '@/utils/eurekaBrain'

interface EurekaAssistantProps {
  open: boolean
  onClose: () => void
  context?: string
}

const initialPrompts = [
  'Recommend optimal AML thresholds for retail banking',
  'Why did fraud spike in Lagos this week?',
  'Explain transaction #TXN-4827 risk score',
  'Generate weekly compliance summary for the board',
]



export default function EurekaAssistant({ open, onClose }: EurekaAssistantProps) {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([
    { role: 'eureka', text: getGreeting() }
  ])
  const [isTyping, setIsTyping] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>(initialPrompts)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, streamingText])

  const handleSend = async (forcedInput?: string) => {
    const text = (forcedInput ?? input).trim()
    if (!text || isTyping) return

    setInput('')
    setMessages(prev => [...prev, { role: 'user', text }])
    setIsTyping(true)
    setStreamingText('')

    // Artificial "thinking" delay
    await new Promise(r => setTimeout(r, 600 + Math.random() * 800))

    const { text: response, followUps } = getEurekaResponse(text, messages)
    let index = 0

    const interval = setInterval(() => {
      setStreamingText(response.slice(0, index + 1))
      index++
      if (index >= response.length) {
        clearInterval(interval)
        setMessages(prev => [...prev, { role: 'eureka', text: response }])
        setStreamingText('')
        setIsTyping(false)
        if (followUps.length > 0) {
          setSuggestedPrompts(followUps)
        }
      }
    }, 15)
  }

  return (
    <>
      {open && (
        <Box
          onClick={onClose}
          sx={{
            position: 'fixed',
            inset: 0,
            bgcolor: 'rgba(15, 23, 42, 0.4)',
            zIndex: 1199,
            animation: 'fadeIn 0.2s ease',
            '@keyframes fadeIn': { from: { opacity: 0 }, to: { opacity: 1 } },
          }}
        />
      )}
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: { xs: '100%', sm: 440 },
          bgcolor: '#ffffff',
          borderLeft: '1px solid #eef0f4',
          boxShadow: '-12px 0 40px rgba(15,23,42,0.08)',
          zIndex: 1200,
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <Box
          sx={{
            px: 3,
            py: 2.5,
            borderBottom: '1px solid #eef0f4',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                bgcolor: colorPalette.primary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AutoAwesomeOutlinedIcon sx={{ color: '#ffffff', fontSize: '1.125rem' }} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost' }}>
                Eureka
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Box
                  sx={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    bgcolor: '#10b981',
                  }}
                />
                <Typography sx={{ fontSize: '0.6875rem', color: '#64748b', fontWeight: 600 }}>
                  Compliance copilot · Online
                </Typography>
              </Box>
            </Box>
          </Box>
          <IconButton
            onClick={onClose}
            disableRipple
            sx={{
              color: '#64748b',
              borderRadius: 0,
              '&:hover': { bgcolor: '#f8fafc', color: colorPalette.primary },
            }}
          >
            <CloseRoundedIcon sx={{ fontSize: '1.25rem' }} />
          </IconButton>
        </Box>

        {/* Conversation */}
        <Box ref={scrollRef} sx={{ flex: 1, overflowY: 'auto', p: 3 }}>
          <Stack sx={{ gap: 2 }}>
            {messages.map((msg, i) => (
              <Box
                key={i}
                sx={{
                  alignSelf: msg.role === 'eureka' ? 'flex-start' : 'flex-end',
                  maxWidth: '92%',
                  display: 'flex',
                  gap: 1.25,
                  alignItems: 'flex-start',
                }}
              >
                {msg.role === 'eureka' && (
                  <Box
                    sx={{
                      width: 28,
                      height: 28,
                      bgcolor: `${colorPalette.primary}10`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      mt: 0.25,
                    }}
                  >
                    <AutoAwesomeOutlinedIcon sx={{ color: colorPalette.primary, fontSize: '0.875rem' }} />
                  </Box>
                )}
                <Box
                  sx={{
                    bgcolor: msg.role === 'eureka' ? '#f5f3fb' : colorPalette.primary,
                    color: msg.role === 'eureka' ? '#00288e' : '#ffffff',
                    px: 1.75,
                    py: 1.5,
                    fontSize: '0.875rem',
                    lineHeight: 1.55,
                    borderRadius: 0,
                  }}
                >
                  {msg.text}
                </Box>
              </Box>
            ))}

            {/* Streaming Reply */}
            {streamingText && (
              <Box
                sx={{
                  alignSelf: 'flex-start',
                  maxWidth: '92%',
                  display: 'flex',
                  gap: 1.25,
                  alignItems: 'flex-start',
                }}
              >
                <Box
                  sx={{
                    width: 28,
                    height: 28,
                    bgcolor: `${colorPalette.primary}10`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    mt: 0.25,
                  }}
                >
                  <AutoAwesomeOutlinedIcon sx={{ color: colorPalette.primary, fontSize: '0.875rem' }} />
                </Box>
                <Box
                  sx={{
                    bgcolor: '#f5f3fb',
                    color: '#00288e',
                    px: 1.75,
                    py: 1.5,
                    fontSize: '0.875rem',
                    lineHeight: 1.55,
                    borderRadius: 0,
                  }}
                >
                  {streamingText}
                  <Box component="span" sx={{ display: 'inline-block', width: 2, height: '1em', bgcolor: colorPalette.primary, ml: 0.5, verticalAlign: 'middle', animation: 'blink 1s step-end infinite', '@keyframes blink': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0 } } }} />
                </Box>
              </Box>
            )}

            {/* Typing Indicator */}
            {isTyping && !streamingText && (
              <Box sx={{ alignSelf: 'flex-start', display: 'flex', gap: 1, p: 2, bgcolor: '#f5f3fb' }}>
                {[0, 1, 2].map(i => (
                  <Box key={i} sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: colorPalette.primary, animation: 'typing 1.4s infinite', animationDelay: `${i * 0.2}s`, '@keyframes typing': { '0%, 100%': { transform: 'translateY(0)', opacity: 0.3 }, '50%': { transform: 'translateY(-4px)', opacity: 1 } } }} />
                ))}
              </Box>
            )}
          </Stack>

          {/* Suggested Prompts */}
          <Box sx={{ mt: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.5 }}>
              <LightbulbOutlinedIcon sx={{ fontSize: '1rem', color: '#94a3b8' }} />
              <Typography
                sx={{
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  color: '#94a3b8',
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                }}
              >
                {messages.length === 1 ? 'Try Asking' : 'Next Steps'}
              </Typography>
            </Box>
            <Stack sx={{ gap: 0.75 }}>
              {suggestedPrompts.map((prompt, i) => (
                <Box
                  key={i}
                  onClick={() => handleSend(prompt)}
                  sx={{
                    px: 1.75,
                    py: 1.25,
                    fontSize: '0.8125rem',
                    color: '#475569',
                    border: '1px solid #eef0f4',
                    cursor: 'pointer',
                    transition: 'all 0.18s',
                    '&:hover': {
                      borderColor: colorPalette.primary,
                      color: colorPalette.primary,
                      bgcolor: `${colorPalette.primary}06`,
                    },
                  }}
                >
                  {prompt}
                </Box>
              ))}
            </Stack>
          </Box>
        </Box>

        {/* Input */}
        <Box sx={{ p: 2, borderTop: '1px solid #eef0f4' }}>
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
                boxShadow: `0 0 0 3px ${colorPalette.primary}14`,
              },
            }}
          >
            <InputBase
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder="Ask Eureka anything…"
              multiline
              maxRows={4}
              disabled={isTyping}
              sx={{
                flex: 1,
                fontSize: '0.875rem',
                fontFamily: 'Jost',
                color: '#00288e',
                '& textarea::placeholder': { color: '#94a3b8', opacity: 1 },
              }}
            />
            <IconButton
              disableRipple
              disabled={!input || isTyping}
              onClick={() => handleSend()}
              sx={{
                bgcolor: input ? colorPalette.primary : '#e2e8f0',
                color: '#ffffff',
                width: 32,
                height: 32,
                borderRadius: 0,
                transition: 'all 0.18s',
                '&:hover': {
                  bgcolor: input ? '#1e293b' : '#e2e8f0',
                },
                '&:disabled': { color: '#94a3b8' },
              }}
            >
              <SendRoundedIcon sx={{ fontSize: '1rem' }} />
            </IconButton>
          </Box>
          <Typography
            sx={{
              fontSize: '0.6875rem',
              color: '#94a3b8',
              textAlign: 'center',
              mt: 1,
            }}
          >
            Eureka can make mistakes. Verify before acting on regulated decisions.
          </Typography>
        </Box>
      </Box>
    </>
  )
}
