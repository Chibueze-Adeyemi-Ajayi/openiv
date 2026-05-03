import { useState, useEffect, useCallback } from 'react'
import { Box, Typography, Stack, TextField, Slider, Switch, IconButton, Chip, Button } from '@mui/material'
import { colorPalette } from '@/theme'
import DashboardLayout from '@/components/dashboard/DashboardLayout'
import TOTPConfirmation from '@/components/dashboard/TOTPConfirmation'
import { thresholdApi, type ThresholdRule, type ThresholdMetrics } from '@/api/thresholds'
import { behavioralRuleApi, type BehavioralRule } from '@/api/behavioralRules'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'
import SendRoundedIcon from '@mui/icons-material/SendRounded'
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded'
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined'
import SmartphoneOutlinedIcon from '@mui/icons-material/SmartphoneOutlined'
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'

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

const categoryConfig: Record<string, { color: string; icon: React.ReactNode }> = {
  Geo: { color: '#7c3aed', icon: <LocationOnOutlinedIcon sx={{ fontSize: '1rem' }} /> },
  Device: { color: '#0891b2', icon: <SmartphoneOutlinedIcon sx={{ fontSize: '1rem' }} /> },
  Velocity: { color: '#ea580c', icon: <ScheduleRoundedIcon sx={{ fontSize: '1rem' }} /> },
  Network: { color: '#dc2626', icon: <GroupsOutlinedIcon sx={{ fontSize: '1rem' }} /> },
  Temporal: { color: colorPalette.primary, icon: <ScheduleRoundedIcon sx={{ fontSize: '1rem' }} /> },
}

const severityConfig: Record<string, { bg: string; color: string }> = {
  critical: { bg: '#fef2f2', color: '#dc2626' },
  high: { bg: '#fffbeb', color: '#f59e0b' },
  medium: { bg: `${colorPalette.primary}10`, color: colorPalette.primary },
}

function MadLibInput({ value, onChange, width = 60, type = 'number' }: { value: any, onChange: (val: any) => void, width?: number, type?: string }) {
  return (
    <Box sx={{ display: 'inline-block', mx: 0.75, verticalAlign: 'middle' }}>
      <TextField
        value={value}
        onChange={(e) => onChange(type === 'number' ? Number(e.target.value) : e.target.value)}
        type={type}
        variant="standard"
        InputProps={{ disableUnderline: true }}
        sx={{
          bgcolor: `${colorPalette.primary}15`,
          border: `1px solid ${colorPalette.primary}30`,
          borderRadius: 0,
          width,
          '& input': {
            textAlign: 'center',
            p: 0.5,
            fontSize: '0.875rem',
            fontWeight: 700,
            color: colorPalette.primary,
            fontFamily: 'SF Mono, Monaco, monospace',
          },
          '&:hover': { bgcolor: `${colorPalette.primary}20` },
          '&:focus-within': { borderColor: colorPalette.primary, bgcolor: '#ffffff', boxShadow: `0 0 0 2px ${colorPalette.primary}20` },
        }}
      />
    </Box>
  )
}

export default function ThresholdsPage() {
  // Thresholds state
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

  // Behavioral Rules state
  const [behRules, setBehRules] = useState<BehavioralRule[]>([])
  const [behLoading, setBehLoading] = useState(true)
  const [behDrafts, setBehDrafts] = useState<Record<number, Record<string, any>>>({})
  const [behPendingSave, setBehPendingSave] = useState<{ rule: BehavioralRule; newParams?: Record<string, any>, newActive?: boolean } | null>(null)

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

  const loadBehRules = useCallback(async () => {
    setBehLoading(true)
    try {
      const res = await behavioralRuleApi.list()
      setBehRules(res.rules)
    } catch (err) {
      console.error(err)
    } finally {
      setBehLoading(false)
    }
  }, [])

  useEffect(() => { loadRules(); loadMetrics(); loadBehRules() }, [loadRules, loadMetrics, loadBehRules])

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

  const handleBehParamChange = (id: number, paramKey: string, val: any) => {
    setBehDrafts(prev => {
      const currentDraft = prev[id] || {}
      return { ...prev, [id]: { ...currentDraft, [paramKey]: val } }
    })
  }

  const handleBehSaveConfirm = async () => {
    if (!behPendingSave || saving) return
    setSaving(true)
    try {
      const { rule, newParams, newActive } = behPendingSave
      await behavioralRuleApi.update(rule.id, {
        params: newParams,
        isActive: newActive
      })
      if (newParams) {
        setBehDrafts(prev => {
          const n = { ...prev }
          delete n[rule.id]
          return n
        })
      }
      await loadBehRules()
    } finally {
      setSaving(false)
      setBehPendingSave(null)
    }
  }

  const renderMadLibs = (rule: BehavioralRule) => {
    const params = behDrafts[rule.id] ? { ...rule.params, ...behDrafts[rule.id] } : rule.params

    switch (rule.ruleId) {
      case 'pat-1':
        return (
          <Typography sx={{ fontSize: '0.9375rem', color: '#334155', lineHeight: 2 }}>
            Flag when <MadLibInput value={params.ip_count} onChange={v => handleBehParamChange(rule.id, 'ip_count', v)} /> customer accounts — none with prior relationship — all initiate wire transfers from the same IP block within <MadLibInput value={params.timeframe_minutes} onChange={v => handleBehParamChange(rule.id, 'timeframe_minutes', v)} /> minutes of each other.
          </Typography>
        )
      case 'pat-2':
        return (
          <Typography sx={{ fontSize: '0.9375rem', color: '#334155', lineHeight: 2 }}>
            Flag when a customer logs in from distant locations physically impossible without supersonic travel, separated by at least <MadLibInput value={params.distance_km} width={80} onChange={v => handleBehParamChange(rule.id, 'distance_km', v)} /> km within <MadLibInput value={params.timeframe_hours} onChange={v => handleBehParamChange(rule.id, 'timeframe_hours', v)} /> hours.
          </Typography>
        )
      case 'pat-3':
        return (
          <Typography sx={{ fontSize: '0.9375rem', color: '#334155', lineHeight: 2 }}>
            Flag when a single device fingerprint is authenticated as <MadLibInput value={params.user_count} onChange={v => handleBehParamChange(rule.id, 'user_count', v)} /> different customers in the past <MadLibInput value={params.timeframe_hours} onChange={v => handleBehParamChange(rule.id, 'timeframe_hours', v)} /> hours.
          </Typography>
        )
      case 'pat-4':
        return (
          <Typography sx={{ fontSize: '0.9375rem', color: '#334155', lineHeight: 2 }}>
            Flag when more than <MadLibInput value={params.min_customers} onChange={v => handleBehParamChange(rule.id, 'min_customers', v)} /> customers transact outside their personal baseline of activity between <MadLibInput type="text" width={80} value={params.time_start} onChange={v => handleBehParamChange(rule.id, 'time_start', v)} /> and <MadLibInput type="text" width={80} value={params.time_end} onChange={v => handleBehParamChange(rule.id, 'time_end', v)} />.
          </Typography>
        )
      case 'pat-5':
        return (
          <Typography sx={{ fontSize: '0.9375rem', color: '#334155', lineHeight: 2 }}>
            Flag when <MadLibInput value={params.customer_count} onChange={v => handleBehParamChange(rule.id, 'customer_count', v)} /> different customers send funds to the same wallet within <MadLibInput value={params.timeframe_hours} onChange={v => handleBehParamChange(rule.id, 'timeframe_hours', v)} /> hours.
          </Typography>
        )
      default:
        return <Typography sx={{ fontSize: '0.8125rem', color: '#475569', lineHeight: 1.6 }}>{rule.description}</Typography>
    }
  }

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
                <Box 
                  key={s.label} 
                  data-ai-analyzable="true"
                  data-ai-description={`Rule Performance Metric: ${s.label}. value: ${s.value ?? 'N/A'}. status: ${s.sub}.`}
                  sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', p: 2 }}>
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
            <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', borderRadius: 0 }}>
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
                  <Box 
                    key={rule.id} 
                    data-ai-analyzable="true"
                    data-ai-description={`Detection Rule: ${rule.name}. category: ${rule.tag}. current threshold: ${fmtThreshold(rule, rule.thresholdValue)}. fired: ${rule.firedCount} times. status: ${rule.isActive ? 'Active' : 'Paused'}.`}
                    sx={{ px: 3, py: 2.5, borderBottom: '1px solid #f4f5f7', opacity: rule.isActive ? 1 : 0.55, transition: 'opacity 0.18s', '&:last-child': { borderBottom: 'none' } }}>

                    {/* Row header */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.25 }}>
                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
                            {rule.name}
                          </Typography>
                          <Box sx={{ px: 0.75, py: 0.25, bgcolor: `${tagColor}10`, borderRadius: 0 }}>
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
                              borderRadius: 0,
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

            {/* Behavioral Pattern Rules Config Card */}
            <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', borderRadius: 0 }}>
              <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid #eef0f4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
                    Behavioral Pattern Rules
                  </Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
                    Configure parameters for detecting complex fraud topologies
                  </Typography>
                </Box>
              </Box>

              {behLoading && (
                <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {[...Array(3)].map((_, i) => (
                    <Box key={i} sx={{ height: 100, bgcolor: '#f8fafc', animation: 'pulse 1.5s ease-in-out infinite', '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } }, animationDelay: `${i * 60}ms` }} />
                  ))}
                </Box>
              )}

              <Stack gap={0}>
                {!behLoading && behRules.map((p) => {
                  const cat = categoryConfig[p.category] || categoryConfig['Temporal']
                  const sev = severityConfig[p.severity] || severityConfig['medium']
                  const hasDraft = behDrafts[p.id] !== undefined && Object.keys(behDrafts[p.id]).length > 0
                  
                  return (
                    <Box
                      key={p.id}
                      data-ai-analyzable="true"
                      data-ai-description={`Behavioral Pattern Config: "${p.name}". Severity: ${p.severity}. Matched Typology: ${p.matchedTypology}. Active: ${p.isActive}.`}
                      sx={{ 
                        borderBottom: '1px solid #eef0f4', 
                        overflow: 'hidden',
                        opacity: p.isActive ? 1 : 0.6,
                        '&:last-child': { borderBottom: 'none' }
                      }}
                    >
                      {/* Header */}
                      <Box sx={{ px: 3, py: 2, borderBottom: '1px solid #f4f5f7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Box sx={{ width: 36, height: 36, borderRadius: 0, bgcolor: `${cat.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: cat.color }}>
                            {cat.icon}
                          </Box>
                          <Box>
                            <Typography sx={{ fontSize: '1.0625rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
                              {p.name}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.25 }}>
                              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: cat.color, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                                {p.category}
                              </Typography>
                              <Box sx={{ width: 3, height: 3, bgcolor: '#cbd5e1' }} />
                              <Typography sx={{ fontSize: '0.6875rem', color: '#64748b', fontWeight: 600 }}>
                                Typology: {p.matchedTypology}
                              </Typography>
                            </Box>
                          </Box>
                        </Box>
                        
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Chip
                            label={p.severity.toUpperCase()}
                            size="small"
                            sx={{
                              bgcolor: sev.bg,
                              color: sev.color,
                              fontWeight: 700,
                              fontSize: '0.6875rem',
                              letterSpacing: '0.1em',
                              borderRadius: 0,
                              height: 24,
                            }}
                          />
                          <Switch
                            checked={p.isActive}
                            onChange={(e) => setBehPendingSave({ rule: p, newActive: e.target.checked })}
                            sx={{
                              '& .MuiSwitch-track': { borderRadius: 8 },
                              '& .Mui-checked + .MuiSwitch-track': { bgcolor: `${colorPalette.primary} !important`, opacity: '1 !important' },
                            }}
                          />
                        </Box>
                      </Box>

                      {/* Mad Libs Builder */}
                      <Box sx={{ p: 3, bgcolor: '#fbfcfd' }}>
                        {renderMadLibs(p)}
                        
                        {hasDraft && (
                          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 1.5 }}>
                            <Button
                              variant="outlined"
                              onClick={() => {
                                setBehDrafts(prev => {
                                  const n = { ...prev }
                                  delete n[p.id]
                                  return n
                                })
                              }}
                              sx={{ color: '#475569', borderColor: '#cbd5e1', textTransform: 'none', fontWeight: 600, fontFamily: 'Jost', borderRadius: 0 }}
                            >
                              Discard
                            </Button>
                            <Button
                              variant="contained"
                              onClick={() => setBehPendingSave({ rule: p, newParams: { ...p.params, ...behDrafts[p.id] } })}
                              sx={{ bgcolor: colorPalette.primary, color: '#ffffff', textTransform: 'none', fontWeight: 600, fontFamily: 'Jost', boxShadow: 'none', borderRadius: 0 }}
                            >
                              Save Configuration
                            </Button>
                          </Box>
                        )}
                      </Box>

                      {/* Example Output */}
                      <Box sx={{ px: 3, py: 2, borderTop: '1px solid #f4f5f7', display: 'flex', gap: 1.5 }}>
                        <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', mt: 0.25, width: 70 }}>
                          Example
                        </Typography>
                        <Typography sx={{ fontSize: '0.8125rem', color: '#475569', fontFamily: 'SF Mono, Monaco, monospace' }}>
                          {p.example}
                        </Typography>
                      </Box>
                    </Box>
                  )
                })}
              </Stack>
            </Box>
          </Stack>

          {/* Right: Eureka sidebar */}
          <Stack gap={3}>
            <Box 
              data-ai-analyzable="true"
              data-ai-description="Eureka Assist: AI-powered threshold tuning. Describe your business scenario or pick a preset use-case to generate optimal detection parameters."
              sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', borderRadius: 0 }}>
              <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid #eef0f4', display: 'flex', alignItems: 'center', gap: 1.25 }}>
                <Box sx={{ width: 32, height: 32, bgcolor: colorPalette.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 0 }}>
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
                      data-ai-analyzable="true"
                      data-ai-description={`Tuning Preset: ${u}. selected: ${selectedUseCase === i}.`}
                      sx={{
                      px: 1.5, py: 1.125, fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'Jost',
                      color:   selectedUseCase === i ? colorPalette.primary : '#475569',
                      bgcolor: selectedUseCase === i ? `${colorPalette.primary}0a` : 'transparent',
                      border: '1px solid', borderColor: selectedUseCase === i ? `${colorPalette.primary}30` : '#eef0f4',
                      fontWeight: selectedUseCase === i ? 600 : 500,
                      transition: 'all 0.15s',
                      borderRadius: 0,
                      '&:hover': { borderColor: colorPalette.primary, color: colorPalette.primary },
                    }}>
                      {u}
                    </Box>
                  ))}
                </Stack>

                <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', mb: 1.25, fontFamily: 'Jost' }}>
                  Or describe your scenario
                </Typography>
                <Box sx={{ bgcolor: '#f5f3fb', border: '1px solid transparent', p: 1.25, transition: 'all 0.18s', borderRadius: 0, '&:focus-within': { bgcolor: '#ffffff', borderColor: colorPalette.primary } }}>
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
                  borderRadius: 0,
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

      {/* TOTP — behavioral rules */}
      <TOTPConfirmation
        open={!!behPendingSave}
        onClose={() => setBehPendingSave(null)}
        onConfirm={handleBehSaveConfirm}
        operation="update"
        title={behPendingSave?.newActive !== undefined ? (behPendingSave.newActive ? 'Activate this rule' : 'Pause this rule') : 'Update Rule Configuration'}
        description={
          behPendingSave?.newActive !== undefined
            ? (behPendingSave.newActive ? 'Activating this rule will immediately start hunting for this pattern.' : 'Pausing this rule will stop new alerts from firing.')
            : 'You are modifying the detection thresholds for this pattern. Confirm with your authenticator code to apply the new rules.'
        }
        resourceType="Pattern"
        resourceName={behPendingSave?.rule.name ?? ''}
        changes={behPendingSave?.newParams ? Object.entries(behPendingSave.newParams).map(([k, v]) => ({
          field: k,
          from: String(behPendingSave.rule.params[k]),
          to: String(v)
        })) : behPendingSave?.newActive !== undefined ? [{
          field: 'Status',
          from: behPendingSave.rule.isActive ? 'Active' : 'Paused',
          to: behPendingSave.newActive ? 'Active' : 'Paused'
        }] : []}
      />
    </DashboardLayout>
  )
}
