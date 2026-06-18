import { Box, Chip, Drawer, Typography, Divider, IconButton, Button } from '@mui/material'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import type { RuleTemplate } from '@/api/institutionRules'
import { colorPalette } from '@/theme'

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
  person:    'Fires on every transaction and evaluates the initiating customer\'s profile — checking watchlist status, risk score, KYC tier, and account age against defined thresholds in real time.',
  location:  'Triggers when a transaction\'s geographic indicator (IP country, physical branch location, or GPS coordinates) matches a flagged zone or restricted jurisdiction.',
  timing:    'Evaluates each transaction\'s timestamp against defined windows — catching activity at unusual hours or days that statistically deviate from normal banking patterns for this customer segment.',
  series:    'Analyses cumulative patterns across the customer\'s recent transaction history (typically 7–30 days), not just the single transaction in isolation. Requires history queries.',
  composite: 'Combines multiple evaluation axes — customer profile, transaction attributes, location, and/or transaction history — triggering only when several conditions align simultaneously.',
}
const WHY_PRIORITY: Record<string, string> = {
  critical: 'Non-compliance carries immediate CBN enforcement risk, including licence sanctions.',
  high:     'A material compliance gap — absence increases STR/CTR filing failure probability.',
  medium:   'Strengthens overall AML posture and supports risk-based supervision readiness.',
}

interface Props {
  template:       RuleTemplate | null
  selected:       boolean
  onClose:        () => void
  onToggleSelect: () => void
  onUseTemplate:  (t: RuleTemplate) => void
}

export default function TemplateDetailDrawer({ template: t, selected, onClose, onToggleSelect, onUseTemplate }: Props) {
  if (!t) return null

  const prioColor = t.priority ? PRIORITY_COLOR[t.priority] : undefined
  const rtColor   = RULE_TYPE_COLOR[t.ruleType] || '#475569'
  const rtLabel   = RULE_TYPE_LABEL[t.ruleType] || t.ruleType
  const hasGaps   = !!(t.dataGaps && t.dataGaps.length > 0)

  return (
    <Drawer
      anchor="right"
      open
      onClose={onClose}
      PaperProps={{
        sx: {
          width: 390,
          border: 'none',
          borderLeft: '1px solid var(--border-col)',
          bgcolor: 'var(--card-bg)',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.1)',
        },
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

        {/* ── Header ─────────────────────────────────────── */}
        <Box sx={{
          px: 2.5, py: 1.75,
          bgcolor: 'var(--section-bg)',
          borderBottom: '1px solid var(--border-col)',
          display: 'flex', alignItems: 'center', gap: 1,
        }}>
          <Typography sx={{
            flex: 1, fontSize: '0.6rem', fontWeight: 700, color: '#94a3b8',
            textTransform: 'uppercase', letterSpacing: '0.1em',
          }}>
            {t.category}
          </Typography>
          <IconButton size="small" onClick={onClose}
            sx={{ color: '#94a3b8', p: 0.25, '&:hover': { color: 'var(--heading-color)' } }}>
            <CloseRoundedIcon sx={{ fontSize: '1rem' }} />
          </IconButton>
        </Box>

        {/* ── Body ───────────────────────────────────────── */}
        <Box sx={{ flex: 1, overflowY: 'auto', px: 2.5, py: 2.5 }}>

          {/* Badges */}
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1.5 }}>
            {prioColor && (
              <Chip
                label={t.priority?.toUpperCase()}
                size="small"
                sx={{
                  fontSize: '0.5rem', fontWeight: 800, borderRadius: 0, height: 15,
                  bgcolor: `${prioColor}12`, color: prioColor, border: `1px solid ${prioColor}25`,
                  '& .MuiChip-label': { px: 0.75 },
                }}
              />
            )}
            <Chip
              label={rtLabel}
              size="small"
              sx={{
                fontSize: '0.5rem', fontWeight: 700, borderRadius: 0, height: 15,
                bgcolor: `${rtColor}10`, color: rtColor,
                '& .MuiChip-label': { px: 0.75 },
              }}
            />
            <Chip
              label={t.tag}
              size="small"
              sx={{
                fontSize: '0.5rem', fontWeight: 700, borderRadius: 0, height: 15,
                bgcolor: 'var(--section-bg)', color: '#64748b',
                '& .MuiChip-label': { px: 0.75 },
              }}
            />
          </Box>

          {/* Rule name */}
          <Typography sx={{
            fontSize: '1.0625rem', fontWeight: 700, fontFamily: 'Jost',
            color: 'var(--heading-color)', lineHeight: 1.3, mb: 0.5,
          }}>
            {t.name}
          </Typography>

          {/* CBN reference */}
          {t.cbkRef && (
            <Typography sx={{ fontSize: '0.6875rem', color: '#64748b', mb: 2, lineHeight: 1.5 }}>
              {t.cbkRef}
            </Typography>
          )}

          <Divider sx={{ mb: 2.5, borderColor: 'var(--border-col)' }} />

          {/* What it flags */}
          <Section label="What it flags">
            <Typography sx={{ fontSize: '0.8125rem', color: '#334155', lineHeight: 1.7 }}>
              {t.policy}
            </Typography>
          </Section>

          {/* Why it exists */}
          <Section label="Why it exists">
            <Typography sx={{ fontSize: '0.8125rem', color: '#334155', lineHeight: 1.7 }}>
              {t.cbkRef
                ? `Required under ${t.cbkRef}. ${t.priority ? WHY_PRIORITY[t.priority] : ''}`
                : 'Addresses patterns commonly associated with money laundering, layering, or fraud — aligned with CBN AML/CFT Regulations 2022 and FATF Recommendations.'}
            </Typography>
          </Section>

          {/* When it triggers */}
          <Section label="When it triggers">
            <Typography sx={{ fontSize: '0.8125rem', color: '#334155', lineHeight: 1.7 }}>
              {WHEN_TEXT[t.ruleType] || 'Evaluated on each transaction processed through the pipeline.'}
            </Typography>
          </Section>

          {/* Implementation */}
          <Section label="Implementation details">
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              <MetaRow label="Type" value={rtLabel} color={rtColor} />
              <MetaRow
                label="History"
                value={t.needsHistory
                  ? 'Requires transaction history queries (getTransactionCount, getVolume)'
                  : 'Single-transaction check — no history queries, low overhead'}
                color={t.needsHistory ? '#d97706' : '#15803d'}
              />
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600, color: '#94a3b8', minWidth: 64, pt: 0.1 }}>
                  Data
                </Typography>
                <Box>
                  <Typography sx={{
                    fontSize: '0.6875rem', fontWeight: 700,
                    color: hasGaps ? '#d97706' : '#15803d',
                  }}>
                    {hasGaps
                      ? `⚠ Partial — ${t.dataGaps!.length} field${t.dataGaps!.length > 1 ? 's' : ''} not yet captured`
                      : '✓ Fully implementable with current schema'}
                  </Typography>
                  {hasGaps && (
                    <Box sx={{ mt: 0.75, pl: 1.25, borderLeft: '2px solid #fde68a', display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                      {t.dataGaps!.map(g => (
                        <Typography key={g} sx={{ fontSize: '0.625rem', color: '#92400e', lineHeight: 1.6 }}>
                          · {g}
                        </Typography>
                      ))}
                    </Box>
                  )}
                </Box>
              </Box>
            </Box>
          </Section>

        </Box>

        {/* ── Footer ─────────────────────────────────────── */}
        <Box sx={{
          px: 2.5, py: 2,
          borderTop: '1px solid var(--border-col)',
          display: 'flex', gap: 1,
        }}>
          <Button
            onClick={onToggleSelect}
            variant="contained"
            size="small"
            sx={{
              flex: 1, textTransform: 'none', fontWeight: 700, fontFamily: 'Jost',
              borderRadius: 0, boxShadow: 'none', fontSize: '0.75rem',
              bgcolor: selected ? colorPalette.primary : 'var(--section-bg)',
              color: selected ? '#fff' : '#475569',
              border: `1px solid ${selected ? colorPalette.primary : 'var(--border-col)'}`,
              '&:hover': {
                boxShadow: 'none',
                bgcolor: selected ? '#1d4ed8' : 'var(--border-col)',
              },
              '&.Mui-disabled': { bgcolor: colorPalette.primary, color: '#fff', opacity: 0.45 },
            }}
          >
            {selected ? '✓ Selected' : 'Select rule'}
          </Button>
          <Button
            onClick={() => { onUseTemplate(t); onClose() }}
            variant="outlined"
            size="small"
            sx={{
              flex: 1, textTransform: 'none', fontWeight: 700, fontFamily: 'Jost',
              borderRadius: 0, boxShadow: 'none', fontSize: '0.75rem',
              color: '#475569', borderColor: 'var(--border-col)',
              '&:hover': { bgcolor: 'var(--section-bg)', boxShadow: 'none', borderColor: '#94a3b8' },
            }}
          >
            Write this rule →
          </Button>
        </Box>

      </Box>
    </Drawer>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box sx={{ mb: 2.5 }}>
      <Typography sx={{
        fontSize: '0.5625rem', fontWeight: 700, color: '#94a3b8',
        textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.875,
      }}>
        {label}
      </Typography>
      {children}
    </Box>
  )
}

function MetaRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
      <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600, color: '#94a3b8', minWidth: 64, pt: 0.1 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: '0.6875rem', color, fontWeight: 600, lineHeight: 1.5 }}>
        {value}
      </Typography>
    </Box>
  )
}
