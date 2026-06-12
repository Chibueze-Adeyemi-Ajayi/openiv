/**
 * LearnMoreDialog.tsx
 *
 * Extracted from ThresholdsPage.tsx — was an inline function component
 * adding ~175 lines of JSX to an already 1,700-line file.
 */

import { Box, Button, Dialog, DialogActions, DialogContent, Stack, Typography } from '@mui/material'
import { colorPalette } from '@/theme'
import { ruleLanguage, plainEnglishDescriptions, fmtThreshold } from '@/data/ruleMetadata'
import type { ThresholdRule } from '@/api/thresholds'

interface Props {
  state: { rule: ThresholdRule } | null
  open: boolean
  onClose: () => void
}

export default function LearnMoreDialog({ state, open, onClose }: Props) {
  if (!state) return null
  const { rule } = state
  const lang = ruleLanguage[rule.ruleId]
  const desc = plainEnglishDescriptions[rule.ruleId]

  const isMonetary = rule.unit === '₦'
  const fmt = (v: number) => isMonetary
    ? (v >= 1_000_000 ? `₦${(v / 1_000_000).toFixed(1)}M` : `₦${(v / 1_000).toFixed(0)}k`)
    : `${v} ${rule.unit || ''}`

  // Use outward threshold for examples, fall back to inward, then base value
  const exampleValue = rule.thresholdOutward ?? rule.thresholdInward ?? rule.thresholdValue

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth slotProps={{ paper: { sx: { borderRadius: 0 } } }}>
      {/* Header */}
      <Box sx={{ px: 3, pt: 3, pb: 2, borderBottom: '1px solid var(--border-col)' }}>
        <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: colorPalette.primary, textTransform: 'uppercase', letterSpacing: '0.12em', mb: 0.5 }}>
          Detection Rule
        </Typography>
        <Typography sx={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--heading-color)', fontFamily: 'Jost', mb: 0.5 }}>
          {lang?.friendlyName ?? rule.name}
        </Typography>
        <Typography sx={{ fontSize: '0.875rem', color: 'var(--on-surface-variant)', lineHeight: 1.6 }}>
          {lang?.tagline ?? desc?.simple ?? rule.description}
        </Typography>

        {/* Per-direction current limits */}
        <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          {[
            { label: 'Outward (money sent)',     value: rule.thresholdOutward },
            { label: 'Inward (money received)',  value: rule.thresholdInward  },
          ].map(({ label, value: v }) => (
            <Box key={label} sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, px: 1.25, py: 0.5, bgcolor: v !== null ? `${colorPalette.primary}0d` : 'var(--section-bg)', border: `1px solid ${v !== null ? colorPalette.primary + '30' : 'var(--border-col)'}` }}>
              <Typography sx={{ fontSize: '0.6875rem', color: '#64748b' }}>{label}:</Typography>
              <Typography sx={{ fontSize: '0.8125rem', fontWeight: 800, color: v !== null ? colorPalette.primary : '#cbd5e1', fontFamily: 'SF Mono, Monaco, monospace' }}>
                {v !== null ? fmt(v) : 'Not monitored'}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>

      <DialogContent sx={{ pt: 3 }}>
        <Stack gap={3}>
          {/* How the rule works */}
          {lang && (
            <Box>
              <Typography sx={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)', lineHeight: 1.8 }}>
                {lang.howItWorksOverride
                  ? lang.howItWorksOverride
                  : <>When your customer transfers any amount above <strong>{fmt(exampleValue)}</strong>, our system receives it based on the rule you set — then we flag it. Your rule is the source of truth for the decision our AML engine makes.</>
                }
              </Typography>
              {!lang.howItWorksOverride && (
                <Box sx={{ mt: 1.5, p: 2, bgcolor: 'var(--section-bg)', border: '1px solid var(--border-col)', borderRadius: '6px' }}>
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.75 }}>
                    Example
                  </Typography>
                  <Typography sx={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)', lineHeight: 1.75 }}>
                    A customer <strong>Adaeze</strong> transfers <strong>{fmt(Math.floor(exampleValue * 1.55))}</strong> which is above your system's limit of <strong>{fmt(exampleValue)}</strong>. Our AML engine would flag the transaction on your behalf.
                  </Typography>
                </Box>
              )}
            </Box>
          )}

          {/* Why it matters */}
          {lang?.whyItMatters && (
            <Box sx={{ p: 2, bgcolor: '#fffbeb', border: '1px solid #fcd34d' }}>
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1 }}>
                Why this rule exists
              </Typography>
              <Typography sx={{ fontSize: '0.8125rem', color: '#78350f', lineHeight: 1.75 }}>
                {lang.whyItMatters}
              </Typography>
            </Box>
          )}

          {/* Real-world scenarios for amount-based rules */}
          {lang && !lang.skipScenarios && (
            <Box>
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1.5 }}>
                Real-world scenarios at your limit of {fmt(exampleValue)}
              </Typography>

              <Box sx={{ p: 2.5, mb: 2, bgcolor: '#f0fdf4', border: '2px solid #bbf7d0', borderRadius: '6px' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <Box sx={{ width: 6, height: 20, bgcolor: '#10b981', borderRadius: '2px' }} />
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 800, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    Transaction A — Approved Instantly
                  </Typography>
                </Box>
                <Box sx={{ fontFamily: 'SF Mono, Monaco, monospace', fontSize: '0.75rem', color: 'var(--on-surface-variant)', lineHeight: 1.8, bgcolor: 'var(--card-bg)', p: 1.5, border: '1px solid #dbeafe', borderRadius: '4px', mb: 1.5 }}>
                  <div><strong>Customer:</strong> Aminu Bakara</div>
                  <div><strong>Transaction Type:</strong> Wire Transfer</div>
                  <div><strong>Amount:</strong> {fmt(Math.floor(exampleValue * 0.65))}</div>
                  <div><strong>Destination:</strong> Kano Agricultural Suppliers Ltd</div>
                  <div><strong>Time:</strong> Tuesday, 9:15 AM</div>
                </Box>
                <Typography sx={{ fontSize: '0.75rem', color: '#166534', lineHeight: 1.7, mb: 1 }}>
                  <strong>What OpenIV checks:</strong> Amount {fmt(Math.floor(exampleValue * 0.65))} is below your limit of {fmt(exampleValue)}. Time is during business hours. Destination is a known vendor.
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: '#166534', lineHeight: 1.7 }}>
                  <strong>Decision:</strong> ✓ APPROVED • Payment processed immediately • No compliance team intervention needed.
                </Typography>
              </Box>

              <Box sx={{ p: 2.5, bgcolor: '#fef2f2', border: '2px solid #fecaca', borderRadius: '6px' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <Box sx={{ width: 6, height: 20, bgcolor: '#dc2626', borderRadius: '2px' }} />
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 800, color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    Transaction B — Flagged for Review
                  </Typography>
                </Box>
                <Box sx={{ fontFamily: 'SF Mono, Monaco, monospace', fontSize: '0.75rem', color: 'var(--on-surface-variant)', lineHeight: 1.8, bgcolor: 'var(--card-bg)', p: 1.5, border: '1px solid #fecaca', borderRadius: '4px', mb: 1.5 }}>
                  <div><strong>Customer:</strong> Chioma Okonkwo</div>
                  <div><strong>Transaction Type:</strong> Wire Transfer</div>
                  <div><strong>Amount:</strong> {fmt(Math.floor(exampleValue * 1.55))}</div>
                  <div><strong>Destination:</strong> Unknown International Account</div>
                  <div><strong>Time:</strong> Tuesday, 11:47 PM</div>
                </Box>
                <Typography sx={{ fontSize: '0.75rem', color: '#991b1b', lineHeight: 1.7, mb: 1 }}>
                  <strong>What OpenIV checks:</strong> Amount {fmt(Math.floor(exampleValue * 1.55))} EXCEEDS your limit of {fmt(exampleValue)}. This triggers an automatic flag.
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: '#991b1b', lineHeight: 1.7, mb: 1 }}>
                  <strong>Decision:</strong> ⚠ FLAGGED • Transaction put on hold • Your compliance team receives an alert.
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: '#991b1b', lineHeight: 1.7 }}>
                  <strong>Next step:</strong> Your team reviews the customer's identity, checks if the account is new, verifies the destination, and may contact the customer for clarification before releasing the funds.
                </Typography>
              </Box>
            </Box>
          )}

          {/* Scenario text for non-amount-based rules (e.g. velocity-spike) */}
          {lang?.skipScenarios && lang.scenarioText && (
            <Box>
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1.5 }}>
                Real-world example
              </Typography>
              <Box sx={{ p: 2.5, bgcolor: '#fef9ee', border: '2px solid #fcd34d', borderRadius: '6px' }}>
                <Typography sx={{ fontSize: '0.8125rem', color: '#78350f', lineHeight: 1.8 }}>
                  {lang.scenarioText}
                </Typography>
              </Box>
            </Box>
          )}

          {/* How to set the right number */}
          {lang?.recommendation && (
            <Box sx={{ p: 2, bgcolor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1 }}>
                How to choose the right number
              </Typography>
              <Typography sx={{ fontSize: '0.8125rem', color: '#166534', lineHeight: 1.75 }}>
                {lang.recommendation}
              </Typography>
            </Box>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ p: 2.5, borderTop: '1px solid var(--border-col)' }}>
        <Button onClick={onClose} sx={{ textTransform: 'none', fontFamily: 'Jost', fontSize: '0.875rem', fontWeight: 600, color: colorPalette.primary, bgcolor: `${colorPalette.primary}10`, px: 2.5, borderRadius: 0, '&:hover': { bgcolor: `${colorPalette.primary}18` } }}>
          Got it
        </Button>
      </DialogActions>
    </Dialog>
  )
}
