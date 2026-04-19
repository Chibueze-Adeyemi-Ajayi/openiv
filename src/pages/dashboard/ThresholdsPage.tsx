import { Box, Typography, Stack, Button, TextField, Slider, Switch, Chip, IconButton } from '@mui/material'
import { colorPalette } from '@/theme'
import DashboardLayout from '@/components/dashboard/DashboardLayout'
import TOTPConfirmation from '@/components/dashboard/TOTPConfirmation'
import { useState } from 'react'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'
import SendRoundedIcon from '@mui/icons-material/SendRounded'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded'
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded'

const useCases = [
  'Retail banking — high volume, low ticket',
  'Wholesale / corporate banking',
  'Microfinance bank operations',
  'Fintech wallet (consumer)',
  'BDC / FX bureau',
]

interface Rule {
  id: string
  name: string
  description: string
  threshold: number
  unit: string
  active: boolean
  tag: string
  fired: number
  recommended?: { value: number; reason: string }
}

const initialRules: Rule[] = [
  {
    id: 'high-value-wire',
    name: 'High-value wire transfer',
    description: 'Single wire transfer exceeding threshold triggers review',
    threshold: 5000000,
    unit: '₦',
    active: true,
    tag: 'AML',
    fired: 84,
    recommended: { value: 7500000, reason: 'Your false-positive rate is 38%. Raising to ₦7.5M reduces noise without missing high-risk patterns.' },
  },
  {
    id: 'velocity-cluster',
    name: 'Velocity — same beneficiary',
    description: 'More than N transactions to same beneficiary in 1 hour',
    threshold: 5,
    unit: 'count',
    active: true,
    tag: 'Fraud',
    fired: 142,
  },
  {
    id: 'cross-border-bdc',
    name: 'Cross-border BDC threshold',
    description: 'Cumulative BDC outflow per customer per day',
    threshold: 10000000,
    unit: '₦',
    active: true,
    tag: 'AML',
    fired: 23,
  },
  {
    id: 'late-night-large',
    name: 'Late-night large transfer',
    description: 'Transactions over ₦1M between 23:00-05:00',
    threshold: 1000000,
    unit: '₦',
    active: true,
    tag: 'Fraud',
    fired: 67,
  },
  {
    id: 'dormant-reactivation',
    name: 'Dormant account reactivation',
    description: 'Account inactive >90 days transacting >₦500k',
    threshold: 500000,
    unit: '₦',
    active: false,
    tag: 'KYC',
    fired: 0,
  },
]

const tagColors: Record<string, string> = {
  AML: colorPalette.primary,
  Fraud: '#dc2626',
  KYC: '#f59e0b',
}

export default function ThresholdsPage() {
  const [rules, setRules] = useState(initialRules)
  const [selectedUseCase, setSelectedUseCase] = useState(0)
  const [eurekaPrompt, setEurekaPrompt] = useState('')
  const [pendingRecommendation, setPendingRecommendation] = useState<string | null>(null)
  const [pendingToggle, setPendingToggle] = useState<string | null>(null)

  const updateThreshold = (id: string, value: number) => {
    // Slider drags update locally only — no TOTP needed for unsaved changes
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, threshold: value } : r)))
  }

  const acceptRecommendation = (id: string) => {
    setRules((prev) =>
      prev.map((r) =>
        r.id === id && r.recommended
          ? { ...r, threshold: r.recommended.value, recommended: undefined }
          : r
      )
    )
    setPendingRecommendation(null)
  }

  const toggleActive = (id: string) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, active: !r.active } : r)))
    setPendingToggle(null)
  }

  const recRule = pendingRecommendation ? rules.find((r) => r.id === pendingRecommendation) : null
  const toggleRule = pendingToggle ? rules.find((r) => r.id === pendingToggle) : null

  return (
    <DashboardLayout>
      <Box sx={{ p: 4 }}>
        <Box sx={{ mb: 4 }}>
          <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: colorPalette.primary, letterSpacing: '0.14em', textTransform: 'uppercase', mb: 0.75 }}>
            Configure
          </Typography>
          <Typography sx={{ fontSize: '1.625rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost', letterSpacing: '-0.015em', mb: 0.5 }}>
            Detection Thresholds
          </Typography>
          <Typography sx={{ fontSize: '0.9375rem', color: '#64748b' }}>
            Tune the rules that flag suspicious activity — manually, or let Eureka recommend optimal values for your business
          </Typography>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 360px' }, gap: 3 }}>
          {/* Rules list */}
          <Stack gap={3}>
            {/* Stats */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
              {[
                { label: 'Active rules', value: '12', sub: '3 paused' },
                { label: 'Alerts this week', value: '316', sub: '+18% vs avg' },
                { label: 'False-positive rate', value: '24%', sub: 'target: <20%' },
              ].map((s) => (
                <Box key={s.label} sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', p: 2 }}>
                  <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 0.75 }}>
                    {s.label}
                  </Typography>
                  <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost', lineHeight: 1.1 }}>
                    {s.value}
                  </Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.5 }}>{s.sub}</Typography>
                </Box>
              ))}
            </Box>

            {/* Rules */}
            <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4' }}>
              <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid #eef0f4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
                    Active rules
                  </Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
                    Drag the slider to adjust, or click to accept Eureka's recommendation
                  </Typography>
                </Box>
                <Button
                  startIcon={<HistoryRoundedIcon sx={{ fontSize: '1rem !important' }} />}
                  sx={{
                    bgcolor: '#ffffff',
                    color: '#475569',
                    border: '1px solid #e5e7eb',
                    px: 1.75,
                    py: 0.875,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    fontFamily: 'Jost',
                    borderRadius: 0,
                    textTransform: 'none',
                    '&:hover': { bgcolor: '#f8fafc' },
                  }}
                >
                  Audit Log
                </Button>
              </Box>

              {rules.map((rule) => (
                <Box
                  key={rule.id}
                  sx={{
                    px: 3,
                    py: 2.5,
                    borderBottom: '1px solid #f4f5f7',
                    opacity: rule.active ? 1 : 0.55,
                    transition: 'opacity 0.18s',
                    '&:last-child': { borderBottom: 'none' },
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.25 }}>
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
                          {rule.name}
                        </Typography>
                        <Chip
                          label={rule.tag}
                          size="small"
                          sx={{
                            bgcolor: `${tagColors[rule.tag]}10`,
                            color: tagColors[rule.tag],
                            fontWeight: 700,
                            fontSize: '0.625rem',
                            letterSpacing: '0.1em',
                            borderRadius: 0,
                            height: 18,
                            '& .MuiChip-label': { px: 0.75 },
                          }}
                        />
                        <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8' }}>
                          · {rule.fired} alerts this week
                        </Typography>
                      </Box>
                      <Typography sx={{ fontSize: '0.8125rem', color: '#64748b' }}>
                        {rule.description}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Switch
                        checked={rule.active}
                        onChange={() => setPendingToggle(rule.id)}
                        size="small"
                        sx={{
                          '& .MuiSwitch-track': { borderRadius: 8 },
                          '& .Mui-checked + .MuiSwitch-track': { bgcolor: `${colorPalette.primary} !important`, opacity: '1 !important' },
                        }}
                      />
                      <IconButton size="small" disableRipple sx={{ borderRadius: 0, color: '#94a3b8' }}>
                        <MoreHorizRoundedIcon sx={{ fontSize: '1.125rem' }} />
                      </IconButton>
                    </Box>
                  </Box>

                  {/* Threshold control */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1.5 }}>
                    <Box sx={{ minWidth: 130 }}>
                      <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.5 }}>
                        Threshold
                      </Typography>
                      <Typography sx={{ fontSize: '1.125rem', fontWeight: 700, color: '#0f172a', fontFamily: 'SF Mono, Monaco, monospace' }}>
                        {rule.unit === '₦' ? `₦${(rule.threshold / 1000000).toFixed(rule.threshold >= 1000000 ? 1 : 2)}M` : rule.threshold}
                      </Typography>
                    </Box>

                    <Box sx={{ flex: 1, px: 2 }}>
                      <Slider
                        value={rule.threshold}
                        onChange={(_, v) => updateThreshold(rule.id, v as number)}
                        min={rule.unit === '₦' ? 100000 : 1}
                        max={rule.unit === '₦' ? 50000000 : 50}
                        step={rule.unit === '₦' ? 100000 : 1}
                        sx={{
                          color: colorPalette.primary,
                          '& .MuiSlider-track': { height: 4, border: 'none' },
                          '& .MuiSlider-rail': { height: 4, color: '#e5e7eb', opacity: 1 },
                          '& .MuiSlider-thumb': {
                            width: 14,
                            height: 14,
                            bgcolor: '#ffffff',
                            border: `2px solid ${colorPalette.primary}`,
                            '&:hover, &.Mui-focusVisible': { boxShadow: `0 0 0 6px ${colorPalette.primary}20` },
                          },
                        }}
                      />
                    </Box>

                    {rule.recommended && (
                      <Box
                        onClick={() => setPendingRecommendation(rule.id)}
                        sx={{
                          bgcolor: `${colorPalette.primary}08`,
                          border: `1px solid ${colorPalette.primary}25`,
                          px: 1.5,
                          py: 1,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          minWidth: 240,
                          transition: 'all 0.18s',
                          '&:hover': { bgcolor: `${colorPalette.primary}10` },
                        }}
                      >
                        <AutoAwesomeOutlinedIcon sx={{ fontSize: '0.875rem', color: colorPalette.primary, flexShrink: 0 }} />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: colorPalette.primary, mb: 0.125 }}>
                            Eureka recommends ₦{(rule.recommended.value / 1000000).toFixed(1)}M
                          </Typography>
                          <Typography sx={{ fontSize: '0.6875rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            Click to apply
                          </Typography>
                        </Box>
                      </Box>
                    )}
                  </Box>

                  {rule.recommended && (
                    <Typography sx={{ fontSize: '0.75rem', color: '#475569', mt: 1, pl: '146px', lineHeight: 1.55 }}>
                      <strong style={{ color: colorPalette.primary }}>Why?</strong> {rule.recommended.reason}
                    </Typography>
                  )}
                </Box>
              ))}
            </Box>
          </Stack>

          {/* Eureka Sidebar */}
          <Stack gap={3}>
            <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4' }}>
              <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid #eef0f4', display: 'flex', alignItems: 'center', gap: 1.25 }}>
                <Box sx={{ width: 32, height: 32, bgcolor: colorPalette.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AutoAwesomeOutlinedIcon sx={{ color: '#ffffff', fontSize: '1rem' }} />
                </Box>
                <Box>
                  <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
                    Eureka Assist
                  </Typography>
                  <Typography sx={{ fontSize: '0.6875rem', color: '#64748b' }}>
                    Tune thresholds for your business
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ p: 2.5 }}>
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', mb: 1.25, fontFamily: 'Jost' }}>
                  Pick your use case
                </Typography>
                <Stack gap={0.5} sx={{ mb: 2.5 }}>
                  {useCases.map((u, i) => (
                    <Box
                      key={u}
                      onClick={() => setSelectedUseCase(i)}
                      sx={{
                        px: 1.5,
                        py: 1.125,
                        fontSize: '0.8125rem',
                        cursor: 'pointer',
                        color: selectedUseCase === i ? colorPalette.primary : '#475569',
                        bgcolor: selectedUseCase === i ? `${colorPalette.primary}0a` : 'transparent',
                        border: '1px solid',
                        borderColor: selectedUseCase === i ? `${colorPalette.primary}30` : '#eef0f4',
                        transition: 'all 0.15s',
                        fontWeight: selectedUseCase === i ? 600 : 500,
                        fontFamily: 'Jost',
                        '&:hover': { borderColor: colorPalette.primary, color: colorPalette.primary },
                      }}
                    >
                      {u}
                    </Box>
                  ))}
                </Stack>

                <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', mb: 1.25, fontFamily: 'Jost' }}>
                  Or describe your scenario
                </Typography>
                <Box
                  sx={{
                    bgcolor: '#f5f3fb',
                    border: '1px solid transparent',
                    p: 1.25,
                    transition: 'all 0.18s',
                    '&:focus-within': { bgcolor: '#ffffff', borderColor: colorPalette.primary, boxShadow: `0 0 0 3px ${colorPalette.primary}14` },
                  }}
                >
                  <TextField
                    multiline
                    rows={3}
                    fullWidth
                    value={eurekaPrompt}
                    onChange={(e) => setEurekaPrompt(e.target.value)}
                    placeholder="e.g. We process B2B salary disbursements at month-end with average ticket size of ₦25M..."
                    variant="standard"
                    InputProps={{ disableUnderline: true }}
                    sx={{
                      '& textarea': { fontSize: '0.8125rem', fontFamily: 'Jost', color: '#0f172a', lineHeight: 1.5 },
                    }}
                  />
                </Box>

                <Button
                  fullWidth
                  endIcon={<SendRoundedIcon sx={{ fontSize: '1rem !important' }} />}
                  sx={{
                    mt: 1.5,
                    bgcolor: colorPalette.primary,
                    color: '#ffffff',
                    py: 1.25,
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    fontFamily: 'Jost',
                    borderRadius: 0,
                    textTransform: 'none',
                    boxShadow: 'none',
                    '&:hover': { bgcolor: '#1a3896' },
                  }}
                >
                  Generate Recommended Thresholds
                </Button>
              </Box>
            </Box>

            {/* Last AI run */}
            <Box sx={{ bgcolor: `${colorPalette.primary}06`, border: `1px solid ${colorPalette.primary}15`, p: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.875, mb: 1.25 }}>
                <CheckRoundedIcon sx={{ fontSize: '1rem', color: '#10b981' }} />
                <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Last analysis
                </Typography>
              </Box>
              <Typography sx={{ fontSize: '0.8125rem', color: '#475569', lineHeight: 1.6 }}>
                Eureka analyzed <strong>2.4M</strong> historical transactions and found <strong>3 thresholds</strong> that could reduce false positives by <strong>34%</strong> without missing high-risk activity.
              </Typography>
              <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', mt: 1 }}>
                Run · 2 hours ago · Adaeze C.
              </Typography>
            </Box>
          </Stack>
        </Box>
      </Box>

      {/* TOTP for accepting Eureka recommendation */}
      <TOTPConfirmation
        open={!!recRule}
        onClose={() => setPendingRecommendation(null)}
        onConfirm={() => recRule && acceptRecommendation(recRule.id)}
        operation="update"
        title="Update detection threshold"
        description="You're updating an active rule that affects how transactions are flagged for review. Confirm with your authenticator code to proceed."
        resourceType="Rule"
        resourceName={recRule?.name || ''}
        changes={
          recRule?.recommended
            ? [
                {
                  field: 'Threshold',
                  from: `₦${(recRule.threshold / 1000000).toFixed(1)}M`,
                  to: `₦${(recRule.recommended.value / 1000000).toFixed(1)}M`,
                },
              ]
            : []
        }
      />

      {/* TOTP for toggling rule active/paused */}
      <TOTPConfirmation
        open={!!toggleRule}
        onClose={() => setPendingToggle(null)}
        onConfirm={() => toggleRule && toggleActive(toggleRule.id)}
        operation="update"
        title={toggleRule?.active ? 'Pause this rule' : 'Activate this rule'}
        description={
          toggleRule?.active
            ? 'Pausing this rule will stop new alerts from firing. Existing cases remain open.'
            : 'Activating this rule will immediately start scoring transactions against it.'
        }
        resourceType="Rule"
        resourceName={toggleRule?.name || ''}
        changes={
          toggleRule
            ? [{ field: 'Status', from: toggleRule.active ? 'Active' : 'Paused', to: toggleRule.active ? 'Paused' : 'Active' }]
            : []
        }
      />
    </DashboardLayout>
  )
}
