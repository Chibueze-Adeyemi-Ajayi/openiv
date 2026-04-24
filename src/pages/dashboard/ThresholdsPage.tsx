import { useState, useEffect, useCallback } from 'react'
import { Box, Typography, Stack, TextField, Slider, Switch, IconButton } from '@mui/material'
import { colorPalette } from '@/theme'
import DashboardLayout from '@/components/dashboard/DashboardLayout'
import TOTPConfirmation from '@/components/dashboard/TOTPConfirmation'
import { thresholdApi, type ThresholdRule, type ThresholdMetrics } from '@/api/thresholds'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'
import SendRoundedIcon from '@mui/icons-material/SendRounded'
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded'

const useCases = [
  'Retail banking — high volume, low ticket',
  'Wholesale / corporate banking',
  'Microfinance bank operations',
  'Fintech wallet (consumer)',
  'BDC / FX bureau',
]

const tagColors: Record<string, string> = {
  AML:   colorPalette.primary,
  Fraud: '#dc2626',
  KYC:   '#f59e0b',
}

function fmtThreshold(rule: ThresholdRule, value: number): string {
  if (rule.unit === '₦') {
    return value >= 1_000_000
      ? `₦${(value / 1_000_000).toFixed(1)}M`
      : `₦${(value / 1_000).toFixed(0)}k`
  }
  return String(value)
}

export default function ThresholdsPage() {
  const [rules,          setRules]          = useState<ThresholdRule[]>([])
  const [loading,        setLoading]        = useState(true)
  const [metrics,        setMetrics]        = useState<ThresholdMetrics | null>(null)
  const [metricsLoading, setMetricsLoading] = useState(true)
  const [drafts,         setDrafts]         = useState<Record<number, number>>({})
  const [saving,         setSaving]         = useState(false)
  const [selectedUseCase, setSelectedUseCase] = useState(0)
  const [eurekaPrompt,   setEurekaPrompt]   = useState('')

  const [pendingSave,   setPendingSave]   = useState<{ rule: ThresholdRule; newValue: number } | null>(null)
  const [pendingToggle, setPendingToggle] = useState<{ rule: ThresholdRule; newActive: boolean } | null>(null)

  const loadRules = useCallback(async () => {
    setLoading(true)
    try {
      const res = await thresholdApi.list()
      setRules(res.rules)
    } finally { setLoading(false) }
  }, [])

  const loadMetrics = useCallback(async () => {
    setMetricsLoading(true)
    try { setMetrics(await thresholdApi.metrics()) }
    finally { setMetricsLoading(false) }
  }, [])

  useEffect(() => { loadRules(); loadMetrics() }, [loadRules, loadMetrics])

  const handleSlider = (id: number, value: number) => {
    setDrafts(prev => ({ ...prev, [id]: value }))
  }

  const handleSaveConfirm = useCallback(async () => {
    if (!pendingSave || saving) return
    setSaving(true)
    try {
      await thresholdApi.update(pendingSave.rule.id, { threshold: pendingSave.newValue })
      setDrafts(prev => { const n = { ...prev }; delete n[pendingSave.rule.id]; return n })
      await Promise.all([loadRules(), loadMetrics()])
    } finally { setSaving(false); setPendingSave(null) }
  }, [pendingSave, saving, loadRules, loadMetrics])

  const handleToggleConfirm = useCallback(async () => {
    if (!pendingToggle || saving) return
    setSaving(true)
    try {
      await thresholdApi.update(pendingToggle.rule.id, { isActive: pendingToggle.newActive })
      await Promise.all([loadRules(), loadMetrics()])
    } finally { setSaving(false); setPendingToggle(null) }
  }, [pendingToggle, saving, loadRules, loadMetrics])

  const metricCards = [
    { label: 'Active rules',  value: metrics?.activeCount ?? null, sub: `${metrics?.pausedCount ?? '—'} paused`   },
    { label: 'Alerts fired',  value: metrics?.totalFired  ?? null, sub: 'cumulative rule hits'                     },
    { label: 'Rules paused',  value: metrics?.pausedCount ?? null, sub: 'not scoring transactions'                 },
  ]

  return (
    <DashboardLayout>
      <Box sx={{ p: 4 }}>

        {/* Page header */}
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

          {/* Left: rules */}
          <Stack gap={3}>

            {/* Metric cards */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
              {metricCards.map(s => (
                <Box key={s.label} sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', p: 2 }}>
                  <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 0.75 }}>
                    {s.label}
                  </Typography>
                  {metricsLoading ? (
                    <Box sx={{ height: 28, width: 56, bgcolor: '#f1f5f9', animation: 'pulse 1.5s ease-in-out infinite', '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } } }} />
                  ) : (
                    <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost', lineHeight: 1.1 }}>
                      {s.value ?? '—'}
                    </Typography>
                  )}
                  <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.5 }}>{s.sub}</Typography>
                </Box>
              ))}
            </Box>

            {/* Rules table */}
            <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4' }}>
              <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid #eef0f4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
                    Detection Rules
                  </Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
                    Drag the slider to adjust a threshold, then save to apply
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1.75, py: 0.875, border: '1px solid #e5e7eb', cursor: 'pointer', '&:hover': { bgcolor: '#f8fafc' } }}>
                  <HistoryRoundedIcon sx={{ fontSize: '1rem', color: '#475569' }} />
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', fontFamily: 'Jost' }}>Audit Log</Typography>
                </Box>
              </Box>

              {/* Skeleton */}
              {loading && (
                <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {[...Array(5)].map((_, i) => (
                    <Box key={i} sx={{ height: 80, bgcolor: '#f8fafc', animation: 'pulse 1.5s ease-in-out infinite', '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } }, animationDelay: `${i * 60}ms` }} />
                  ))}
                </Box>
              )}

              {/* Rule rows */}
              {!loading && rules.map((rule) => {
                const displayValue = drafts[rule.id] ?? rule.thresholdValue
                const hasDraft = drafts[rule.id] !== undefined && drafts[rule.id] !== rule.thresholdValue
                const tagColor = tagColors[rule.tag] ?? '#64748b'
                return (
                  <Box key={rule.id} sx={{ px: 3, py: 2.5, borderBottom: '1px solid #f4f5f7', opacity: rule.isActive ? 1 : 0.55, transition: 'opacity 0.18s', '&:last-child': { borderBottom: 'none' } }}>

                    {/* Row header */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.25 }}>
                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
                            {rule.name}
                          </Typography>
                          <Box sx={{ px: 0.75, py: 0.25, bgcolor: `${tagColor}10` }}>
                            <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: tagColor, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                              {rule.tag}
                            </Typography>
                          </Box>
                          <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8' }}>
                            · {rule.firedCount} alerts fired
                          </Typography>
                        </Box>
                        <Typography sx={{ fontSize: '0.8125rem', color: '#64748b' }}>{rule.description}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Switch
                          checked={rule.isActive}
                          onChange={() => setPendingToggle({ rule, newActive: !rule.isActive })}
                          size="small"
                          sx={{
                            '& .MuiSwitch-track': { borderRadius: 8 },
                            '& .Mui-checked + .MuiSwitch-track': { bgcolor: `${colorPalette.primary} !important`, opacity: '1 !important' },
                          }}
                        />
                        <IconButton size="small" disableRipple sx={{ borderRadius: 0, color: '#94a3b8' }}>
                        </IconButton>
                      </Box>
                    </Box>

                    {/* Threshold control */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1.5 }}>
                      <Box sx={{ minWidth: 100 }}>
                        <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.5 }}>
                          Threshold
                        </Typography>
                        <Typography sx={{ fontSize: '1.125rem', fontWeight: 700, color: '#0f172a', fontFamily: 'SF Mono, Monaco, monospace' }}>
                          {fmtThreshold(rule, displayValue)}
                        </Typography>
                      </Box>

                      <Box sx={{ flex: 1, px: 1 }}>
                        <Slider
                          value={displayValue}
                          onChange={(_, v) => handleSlider(rule.id, v as number)}
                          min={rule.minValue}
                          max={rule.maxValue}
                          step={rule.stepValue}
                          disabled={!rule.isActive}
                          sx={{
                            color: colorPalette.primary,
                            '& .MuiSlider-track': { height: 4, border: 'none' },
                            '& .MuiSlider-rail':  { height: 4, color: '#e5e7eb', opacity: 1 },
                            '& .MuiSlider-thumb': {
                              width: 14, height: 14,
                              bgcolor: '#ffffff', border: `2px solid ${colorPalette.primary}`,
                              '&:hover, &.Mui-focusVisible': { boxShadow: `0 0 0 6px ${colorPalette.primary}20` },
                            },
                          }}
                        />
                      </Box>

                      {/* Save button — visible only when slider differs from saved value */}
                      <Box sx={{ minWidth: 72, display: 'flex', justifyContent: 'flex-end' }}>
                        {hasDraft && (
                          <Box
                            onClick={() => setPendingSave({ rule, newValue: drafts[rule.id] })}
                            sx={{
                              px: 1.5, py: 0.625,
                              bgcolor: colorPalette.primary, color: '#ffffff',
                              fontSize: '0.75rem', fontWeight: 700, fontFamily: 'Jost',
                              cursor: 'pointer', transition: 'opacity 0.15s',
                              '&:hover': { opacity: 0.88 },
                            }}
                          >
                            Save
                          </Box>
                        )}
                      </Box>
                    </Box>
                  </Box>
                )
              })}
            </Box>
          </Stack>

          {/* Right: Eureka sidebar */}
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
                    <Box key={u} onClick={() => setSelectedUseCase(i)} sx={{
                      px: 1.5, py: 1.125, fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'Jost',
                      color:   selectedUseCase === i ? colorPalette.primary : '#475569',
                      bgcolor: selectedUseCase === i ? `${colorPalette.primary}0a` : 'transparent',
                      border: '1px solid', borderColor: selectedUseCase === i ? `${colorPalette.primary}30` : '#eef0f4',
                      fontWeight: selectedUseCase === i ? 600 : 500,
                      transition: 'all 0.15s',
                      '&:hover': { borderColor: colorPalette.primary, color: colorPalette.primary },
                    }}>
                      {u}
                    </Box>
                  ))}
                </Stack>

                <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', mb: 1.25, fontFamily: 'Jost' }}>
                  Or describe your scenario
                </Typography>
                <Box sx={{ bgcolor: '#f5f3fb', border: '1px solid transparent', p: 1.25, transition: 'all 0.18s', '&:focus-within': { bgcolor: '#ffffff', borderColor: colorPalette.primary } }}>
                  <TextField
                    multiline rows={3} fullWidth
                    value={eurekaPrompt}
                    onChange={e => setEurekaPrompt(e.target.value)}
                    placeholder="e.g. We process B2B salary disbursements at month-end with average ticket size of ₦25M..."
                    variant="standard"
                    InputProps={{ disableUnderline: true }}
                    sx={{ '& textarea': { fontSize: '0.8125rem', fontFamily: 'Jost', color: '#0f172a', lineHeight: 1.5 } }}
                  />
                </Box>

                <Box sx={{
                  mt: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  bgcolor: colorPalette.primary, color: '#ffffff',
                  px: 2.25, py: 1.25, cursor: 'pointer', transition: 'opacity 0.15s',
                  '&:hover': { opacity: 0.88 },
                }}>
                  <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Jost' }}>
                    Generate Recommended Thresholds
                  </Typography>
                  <SendRoundedIcon sx={{ fontSize: '1rem' }} />
                </Box>
              </Box>
            </Box>
          </Stack>
        </Box>
      </Box>

      {/* TOTP — save threshold value */}
      <TOTPConfirmation
        open={!!pendingSave}
        onClose={() => setPendingSave(null)}
        onConfirm={handleSaveConfirm}
        operation="update"
        title="Update detection threshold"
        description="You're updating an active rule that affects how transactions are flagged for review. Confirm with your authenticator code to proceed."
        resourceType="Rule"
        resourceName={pendingSave?.rule.name ?? ''}
        changes={pendingSave ? [{
          field: 'Threshold',
          from:  fmtThreshold(pendingSave.rule, pendingSave.rule.thresholdValue),
          to:    fmtThreshold(pendingSave.rule, pendingSave.newValue),
        }] : []}
      />

      {/* TOTP — toggle active/paused */}
      <TOTPConfirmation
        open={!!pendingToggle}
        onClose={() => setPendingToggle(null)}
        onConfirm={handleToggleConfirm}
        operation="update"
        title={pendingToggle?.newActive ? 'Activate this rule' : 'Pause this rule'}
        description={
          pendingToggle?.newActive
            ? 'Activating this rule will immediately start scoring transactions against it.'
            : 'Pausing this rule will stop new alerts from firing. Existing cases remain open.'
        }
        resourceType="Rule"
        resourceName={pendingToggle?.rule.name ?? ''}
        changes={pendingToggle ? [{
          field: 'Status',
          from:  pendingToggle.rule.isActive ? 'Active' : 'Paused',
          to:    pendingToggle.newActive      ? 'Active' : 'Paused',
        }] : []}
      />
    </DashboardLayout>
  )
}
