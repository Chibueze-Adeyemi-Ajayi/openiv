import { createPortal } from 'react-dom'
import { useRef, useLayoutEffect } from 'react'
import { Box, Chip, Divider, Typography } from '@mui/material'
import type { ReactNode } from 'react'
import type { RuleTemplate } from '@/api/institutionRules'

const PRIORITY_COLOR: Record<string, string> = {
  critical: '#dc2626', high: '#d97706', medium: '#2563eb',
}
const RULE_TYPE_COLOR: Record<string, string> = {
  person: '#7c3aed', location: '#0f766e', timing: '#d97706', series: '#0369a1', composite: '#475569',
}
const RULE_TYPE_LABEL: Record<string, string> = {
  person: 'Customer Profile', location: 'Geographic', timing: 'Time-Based',
  series: 'Velocity / Series', composite: 'Composite',
}
const WHEN_TEXT: Record<string, string> = {
  person:    "Fires on every transaction and evaluates the initiating customer's profile — checking watchlist status, risk score, KYC tier, and account age against defined thresholds in real time.",
  location:  "Triggers when a transaction's geographic indicator (IP country, branch location, or GPS coordinates) matches a flagged zone or restricted jurisdiction.",
  timing:    "Evaluates each transaction's timestamp against defined windows — catching activity at unusual hours or days that statistically deviate from normal banking patterns.",
  series:    "Analyses cumulative patterns across the customer's recent transaction history (typically 7–30 days), not just the single transaction in isolation. Requires history queries.",
  composite: "Combines multiple evaluation axes — customer profile, transaction attributes, location, and/or transaction history — triggering only when several conditions align simultaneously.",
}
const WHY_TEXT: Record<string, string> = {
  critical: 'Non-compliance carries immediate CBN enforcement risk, including licence sanctions.',
  high:     'A material compliance gap — absence increases STR/CTR filing failure probability.',
  medium:   'Strengthens overall AML posture and supports risk-based supervision readiness.',
}

const POPUP_WIDTH = 368

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box sx={{ mb: 1.75 }}>
      <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.5 }}>
        {label}
      </Typography>
      {children}
    </Box>
  )
}

export interface HoveredCard {
  tpl:  RuleTemplate
  rect: DOMRect
}

interface Props {
  hoveredCard:    HoveredCard | null
  selected:       boolean
  onPopupEnter:   () => void
  onPopupLeave:   () => void
  onClose:        () => void
  onToggleSelect: () => void
  onUseTemplate:  (t: RuleTemplate) => void
  primaryColor?:  string
}

export default function TemplateHoverPopup({
  hoveredCard, selected, onPopupEnter, onPopupLeave, onClose,
  onToggleSelect, onUseTemplate, primaryColor = '#2563eb',
}: Props) {
  const popupRef = useRef<HTMLDivElement>(null)

  // After render, measure actual height and clamp so popup never overflows viewport
  useLayoutEffect(() => {
    const el = popupRef.current
    if (!el || !hoveredCard) return
    const popH = el.offsetHeight
    const maxTop = window.innerHeight - popH - 8
    el.style.top = `${Math.max(8, Math.min(hoveredCard.rect.top, maxTop))}px`
  }, [hoveredCard])

  if (!hoveredCard) return null
  const { tpl: t, rect } = hoveredCard

  const margin  = 14
  const toRight = rect.right + margin + POPUP_WIDTH <= window.innerWidth
  const left    = toRight ? rect.right + margin : rect.left - POPUP_WIDTH - margin
  const top     = Math.max(8, rect.top)   // initial paint; useLayoutEffect corrects before browser draws

  const prioColor = t.priority ? PRIORITY_COLOR[t.priority] : undefined
  const rtColor   = RULE_TYPE_COLOR[t.ruleType] || '#475569'
  const rtLabel   = RULE_TYPE_LABEL[t.ruleType] || t.ruleType

  return createPortal(
    <>
      {/* Full-screen blur backdrop */}
      <Box sx={{
        position: 'fixed', inset: 0, zIndex: 1200,
        backdropFilter: 'blur(5px)',
        bgcolor: 'rgba(0,0,0,0.15)',
        pointerEvents: 'none',
      }} />

      {/* Popup card */}
      <Box
        ref={popupRef}
        onMouseEnter={onPopupEnter}
        onMouseLeave={onPopupLeave}
        sx={{
          position: 'fixed',
          top,
          left,
          width: POPUP_WIDTH,
          zIndex: 1302,
          bgcolor: 'var(--card-bg)',
          border: '1px solid var(--border-col)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.22)',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '82vh',
          overflow: 'hidden',
          '@keyframes tplPopIn': {
            from: { opacity: 0, transform: `translateX(${toRight ? '-12px' : '12px'})` },
            to:   { opacity: 1, transform: 'translateX(0)' },
          },
          animation: 'tplPopIn 0.18s cubic-bezier(0.22,1,0.36,1) forwards',
        }}
      >
        {/* Header */}
        <Box sx={{ px: 2, py: 1.125, bgcolor: 'var(--section-bg)', borderBottom: '1px solid var(--border-col)' }}>
          <Typography sx={{ fontSize: '0.5rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            {t.category}
          </Typography>
        </Box>

        {/* Body */}
        <Box sx={{ flex: 1, overflowY: 'auto', px: 2, py: 1.75 }}>
          {/* Badges */}
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1.25 }}>
            {prioColor && (
              <Chip label={t.priority?.toUpperCase()} size="small" sx={{ fontSize: '0.5rem', fontWeight: 800, borderRadius: 0, height: 15, bgcolor: `${prioColor}12`, color: prioColor, border: `1px solid ${prioColor}25`, '& .MuiChip-label': { px: 0.75 } }} />
            )}
            <Chip label={rtLabel} size="small" sx={{ fontSize: '0.5rem', fontWeight: 700, borderRadius: 0, height: 15, bgcolor: `${rtColor}10`, color: rtColor, '& .MuiChip-label': { px: 0.75 } }} />
            <Chip label={t.tag} size="small" sx={{ fontSize: '0.5rem', fontWeight: 700, borderRadius: 0, height: 15, bgcolor: 'var(--section-bg)', color: '#64748b', '& .MuiChip-label': { px: 0.75 } }} />
          </Box>

          {/* Name */}
          <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, fontFamily: 'Jost', color: 'var(--heading-color)', lineHeight: 1.3, mb: 0.375 }}>
            {t.name}
          </Typography>
          {t.cbkRef && (
            <Typography sx={{ fontSize: '0.6875rem', color: '#64748b', mb: 1.5 }}>{t.cbkRef}</Typography>
          )}

          <Divider sx={{ mb: 1.75, borderColor: 'var(--border-col)' }} />

          <Section label="What it flags">
            <Typography sx={{ fontSize: '0.75rem', color: '#334155', lineHeight: 1.65 }}>{t.policy}</Typography>
          </Section>

          <Section label="Why it exists">
            <Typography sx={{ fontSize: '0.75rem', color: '#334155', lineHeight: 1.65 }}>
              {t.cbkRef
                ? `Required under ${t.cbkRef}. ${t.priority ? WHY_TEXT[t.priority] : ''}`
                : 'Addresses patterns associated with money laundering, layering, or fraud — aligned with CBN AML/CFT Regulations 2022 and FATF Recommendations.'}
            </Typography>
          </Section>

          <Section label="When it triggers">
            <Typography sx={{ fontSize: '0.75rem', color: '#334155', lineHeight: 1.65 }}>
              {WHEN_TEXT[t.ruleType] || 'Evaluated on each transaction processed through the pipeline.'}
            </Typography>
          </Section>

          {t.dataGaps && t.dataGaps.length > 0 && (
            <Box sx={{ p: 1.25, bgcolor: '#fffbeb', border: '1px solid #fde68a', mb: 0.5 }}>
              <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.5 }}>
                ⚠ {t.dataGaps.length} missing field{t.dataGaps.length > 1 ? 's' : ''}
              </Typography>
              {t.dataGaps.map(g => (
                <Typography key={g} sx={{ fontSize: '0.6875rem', color: '#92400e', lineHeight: 1.7 }}>· {g}</Typography>
              ))}
            </Box>
          )}
        </Box>

        {/* Footer */}
        <Box sx={{ px: 2, py: 1.125, borderTop: '1px solid var(--border-col)', display: 'flex', gap: 0.75 }}>
          <Box component="button"
            onClick={() => { onToggleSelect(); onClose() }}
            sx={{ flex: 1, py: 0.75, fontSize: '0.6875rem', fontWeight: 600, fontFamily: 'Jost', cursor: 'pointer', border: `1.5px solid ${selected ? '#dc2626' : primaryColor}`, bgcolor: selected ? '#fef2f2' : primaryColor, color: selected ? '#dc2626' : '#fff', transition: 'all 0.15s' }}>
            {selected ? 'Deselect' : 'Select rule'}
          </Box>
          <Box component="button"
            onClick={() => { onUseTemplate(t); onClose() }}
            sx={{ flex: 1, py: 0.75, fontSize: '0.6875rem', fontWeight: 600, fontFamily: 'Jost', cursor: 'pointer', border: '1.5px solid var(--border-col)', bgcolor: 'transparent', color: 'var(--heading-color)', transition: 'background 0.15s', '&:hover': { bgcolor: 'var(--section-bg)' } }}>
            Write this →
          </Box>
        </Box>
      </Box>
    </>,
    document.body,
  )
}
