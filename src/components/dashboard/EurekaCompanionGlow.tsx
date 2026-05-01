import { useEffect, useRef, useState, useCallback } from 'react'
import { GlobalStyles, Box, Typography, Paper, IconButton, Stack } from '@mui/material'
import { colorPalette } from '@/theme'
import { useEureka } from '@/contexts/EurekaContext'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded'
import SendRoundedIcon from '@mui/icons-material/SendRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'

const RIPPLE_D = 11
const STOP_MS = 150
const TOTAL_MS = 2000
const JITTER_PX = 3

function getAnalyzableParent(el: HTMLElement | null): HTMLElement | null {
  while (el && el !== document.body) {
    // 1. Explicit AI marker (Cards, Widgets, Table Rows)
    if (el?.getAttribute?.('data-ai-analyzable') === 'true') return el

    // 2. Interactive elements (Buttons, Links, IconButtons)
    const name = el?.nodeName
    const role = el?.getAttribute?.('role')
    if (name === 'BUTTON' || name === 'A' || role === 'button' || role === 'link') return el

    // 3. Material UI IconButton check (usually has MuiIconButton-root class)
    if (el?.classList?.contains('MuiIconButton-root') || el?.classList?.contains('MuiButton-root')) return el

    el = el?.parentElement || null
  }
  return null
}

export default function EurekaCompanionGlow() {
  const { eurekaEnabled, eurekaBuddyOpen } = useEureka()

  const [state, setState] = useState<'idle' | 'rippling' | 'tooltip' | 'chatting'>('idle')
  const [pos, setPos] = useState({ x: -400, y: -400 })
  const [targetLabel, setTargetLabel] = useState<string | null>(null)
  const [rippleKey, setRippleKey] = useState(0)

  const stateRef = useRef(state)
  useEffect(() => { stateRef.current = state }, [state])

  const mousePosRef = useRef({ x: -400, y: -400 })
  const lastAnalyzedRef = useRef<HTMLElement | null>(null)
  const timersRef = useRef<{
    stop?: ReturnType<typeof setTimeout>
    finish?: ReturnType<typeof setTimeout>
    dismiss?: ReturnType<typeof setTimeout>
  }>({})

  const clearTimers = useCallback(() => {
    if (timersRef.current.stop) clearTimeout(timersRef.current.stop)
    if (timersRef.current.finish) clearTimeout(timersRef.current.finish)
    if (timersRef.current.dismiss) clearTimeout(timersRef.current.dismiss)
    timersRef.current = {}
  }, [])

  useEffect(() => {
    if (!eurekaEnabled) return

    const onMove = (e: MouseEvent) => {
      const dx = Math.abs(e.clientX - mousePosRef.current.x)
      const dy = Math.abs(e.clientY - mousePosRef.current.y)
      const moved = dx > JITTER_PX || dy > JITTER_PX

      mousePosRef.current = { x: e.clientX, y: e.clientY }

      if (stateRef.current === 'chatting') return

      const target = e.target as HTMLElement
      const isOverPanel = !!target.closest('.eureka-interactive-panel')

      if (isOverPanel) {
        if (timersRef.current.dismiss) {
          clearTimeout(timersRef.current.dismiss)
          delete timersRef.current.dismiss
        }
        clearTimers()
        return
      }

      if (moved) {
        const analyzable = getAnalyzableParent(target)

        // If we are in tooltip state and moved, check if we've left the "safe zone"
        if (stateRef.current === 'tooltip') {
          // Safe zone = over the tooltip panel OR over the original analyzed element
          const isOverAnalyzed = analyzable === lastAnalyzedRef.current

          if (!isOverPanel && !isOverAnalyzed) {
            if (!timersRef.current.dismiss) {
              timersRef.current.dismiss = setTimeout(() => {
                setState('idle')
                lastAnalyzedRef.current = null
              }, 100) // Shorter dismiss for snappier feel
            }
          } else {
            // Still in safe zone, keep it open
            if (timersRef.current.dismiss) {
              clearTimeout(timersRef.current.dismiss)
              delete timersRef.current.dismiss
            }
          }
        }

        if (!analyzable || analyzable !== lastAnalyzedRef.current) {
          lastAnalyzedRef.current = null
        }

        if (stateRef.current === 'rippling') {
          setState('idle')
          clearTimers()
        }

        if (eurekaBuddyOpen) return
        if (lastAnalyzedRef.current) return;

        clearTimers()
        timersRef.current.stop = setTimeout(() => {
          const elAtStop = document.elementFromPoint(mousePosRef.current.x, mousePosRef.current.y) as HTMLElement
          const currentAnalyzable = getAnalyzableParent(elAtStop)

          if (currentAnalyzable && currentAnalyzable !== lastAnalyzedRef.current) {
            const aiDesc = currentAnalyzable.getAttribute('data-ai-description')
            const ariaLabel = currentAnalyzable.getAttribute('aria-label')
            const textContent = currentAnalyzable.textContent?.trim()

            const label = aiDesc || ariaLabel || (textContent && textContent.length < 30 ? textContent : 'Action')

            setTargetLabel(label)
            setPos(mousePosRef.current)
            setRippleKey(prev => prev + 1)
            setState('rippling')

            timersRef.current.finish = setTimeout(() => {
              setState('tooltip')
              lastAnalyzedRef.current = currentAnalyzable
            }, TOTAL_MS)
          }
        }, STOP_MS)
      }
    }

    const onClick = (e: MouseEvent) => {
      if (stateRef.current !== 'tooltip' && stateRef.current !== 'chatting') return

      const target = e.target as HTMLElement
      const isOverPanel = !!target.closest('.eureka-interactive-panel')

      if (!isOverPanel) {
        setState('idle')
        lastAnalyzedRef.current = null
        clearTimers()
      }
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('click', onClick, true) // Capture phase to ensure we catch it

    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('click', onClick, true)
      clearTimers()
    }
  }, [eurekaEnabled, eurekaBuddyOpen, clearTimers])

  const p = colorPalette.primary

  if (!eurekaEnabled) return null

  return (
    <>
      <GlobalStyles styles={{
        '@keyframes fullRippleCycle': {
          '0%': { transform: 'scale(0.05)', opacity: 0 },
          '5%': { opacity: 0.7 },
          '75%': { transform: 'scale(2.5)', opacity: 0.2 },
          '90%': { transform: 'scale(0.1)', opacity: 0.3 },
          '100%': { transform: 'scale(0)', opacity: 0 },
        },
        '@keyframes tooltipBounceIn': {
          '0%': { transform: 'translate(-50%, calc(-100% - 2px))', opacity: 0 },
          '100%': { transform: 'translate(-50%, calc(-100% - 10px))', opacity: 1 },
        }
      }} />

      {/* Ripple Layer */}
      {state === 'rippling' && (
        <Box
          key={rippleKey}
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            pointerEvents: 'none',
            zIndex: 9999999,
            transform: `translate(${pos.x}px, ${pos.y}px)`,
          }}
        >
          {[0, 1, 2].map((_, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                top: -(RIPPLE_D / 2),
                left: -(RIPPLE_D / 2),
                width: RIPPLE_D,
                height: RIPPLE_D,
                borderRadius: '50%',
                border: `1.2px solid ${p}`,
                opacity: 0,
                animation: `fullRippleCycle ${TOTAL_MS}ms cubic-bezier(0.4, 0, 0.2, 1) ${i * 0.12}s forwards`,
              }}
            />
          ))}
        </Box>
      )}

      {/* Classic Tooltip Layer */}
      {state === 'tooltip' && (
        <Box
          className="eureka-interactive-panel"
          sx={{
            position: 'fixed',
            left: pos.x,
            top: pos.y,
            zIndex: 9999999,
            pointerEvents: 'auto',
            transform: 'translate(-50%, calc(-100% - 10px))',
            animation: 'tooltipBounceIn 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
          }}
        >
          <Box
            onClick={(e) => { e.stopPropagation(); setState('chatting') }}
            sx={{
              position: 'relative',
              background: '#333333',
              color: '#ffffff',
              px: 1.75,
              py: 0.875,
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 1.25,
              maxWidth: 280, // Cap width for long content
              boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
              '&::after': {
                content: '""',
                position: 'absolute',
                bottom: -10,
                left: '50%',
                transform: 'translateX(-50%)',
                borderLeft: '8px solid transparent',
                borderRight: '8px solid transparent',
                borderTop: '10px solid #333333',
              },
              '&:hover': {
                background: '#000000',
                '&::after': { borderTopColor: '#000000' }
              }
            }}
          >
            <Typography sx={{ fontSize: '0.8125rem', fontWeight: 500, fontFamily: 'Jost', lineHeight: 1.4 }}>
              {targetLabel}
            </Typography>
            <ChatBubbleOutlineRoundedIcon sx={{ fontSize: '1rem', opacity: 0.8 }} />
          </Box>
        </Box>
      )}

      {/* Expanded Chat Modal */}
      {state === 'chatting' && (
        <Box
          className="eureka-interactive-panel"
          sx={{
            position: 'fixed',
            left: pos.x,
            top: pos.y,
            zIndex: 10000000,
            pointerEvents: 'auto',
            transform: 'translate(-50%, -50%)',
          }}
        >
          <Paper
            elevation={24}
            sx={{
              borderRadius: 0,
              overflow: 'hidden',
              background: '#ffffff',
              border: '1px solid rgba(15, 23, 42, 0.12)',
              width: 340,
              boxShadow: '0 30px 60px rgba(0,0,0,0.25)',
            }}
          >
            <Box sx={{ p: 1.75, display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: colorPalette.primary, color: '#fff' }}>
              <Stack direction="row" spacing={1.25} alignItems="center">
                <AutoAwesomeIcon sx={{ fontSize: '1rem' }} />
                <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, fontFamily: 'Jost' }}>EUREKA INTELLIGENCE</Typography>
              </Stack>
              <IconButton size="small" onClick={() => { setState('idle'); lastAnalyzedRef.current = null; }} sx={{ color: 'inherit', p: 0.5 }}>
                <CloseRoundedIcon sx={{ fontSize: '1.1rem' }} />
              </IconButton>
            </Box>

            <Box sx={{ height: 380, display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ flex: 1, p: 2, overflowY: 'auto', bgcolor: '#f8fafc', display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ alignSelf: 'flex-start', maxWidth: '90%', bgcolor: '#fff', p: 1.5, border: '1px solid #e2e8f0' }}>
                  <Typography sx={{ fontSize: '0.8125rem', color: '#334155', lineHeight: 1.6 }}>
                    Analyzing <strong>{targetLabel}</strong>. How can I assist you with this?
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ p: 2, borderTop: '1px solid #eef0f4', bgcolor: '#fff' }}>
                <Box sx={{ position: 'relative' }}>
                  <Box
                    component="input"
                    autoFocus
                    placeholder="Ask Eureka..."
                    sx={{ width: '100%', border: '1px solid #e2e8f0', px: 2, py: 1.25, fontSize: '0.875rem', fontFamily: 'Jost', outline: 'none', pr: 6, '&:focus': { borderColor: colorPalette.primary } }}
                  />
                  <IconButton size="small" sx={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', color: colorPalette.primary }}>
                    <SendRoundedIcon sx={{ fontSize: '1.1rem' }} />
                  </IconButton>
                </Box>
              </Box>
            </Box>
          </Paper>
        </Box>
      )}
    </>
  )
}
