import { useState, useEffect, useCallback, useRef } from 'react'
import { isBuildOne } from '@/utils/build'
import { Box, Typography, Stack, TextField, Slider, Switch, Chip, Button, Dialog, DialogContent, DialogTitle, Grid, Tabs, Tab, Tooltip } from '@mui/material'
import { useRbac } from '@/contexts/RbacContext'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded'
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded'
import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined'
import { colorPalette } from '@/theme'
import ComingSoonOverlay from '@/components/dashboard/ComingSoonOverlay'
import TOTPConfirmation from '@/components/dashboard/TOTPConfirmation'
import LearnMoreDialog from '@/components/dashboard/LearnMoreDialog'
import MadLibInput from '@/components/dashboard/MadLibInput'
import RiskSeekbar from '@/components/dashboard/RiskSeekbar'
import { tagColors, fmtThreshold, categoryConfig, severityConfig, patternLanguage, plainEnglishDescriptions, ruleLanguage } from '@/data/ruleMetadata'
import { thresholdApi, type ThresholdRule, type ThresholdMetrics, type KycTierRecord, type ThresholdChange } from '@/api/thresholds'
import { behavioralRuleApi, type BehavioralRule } from '@/api/behavioralRules'
import { amlApi, type AmlSettings } from '@/api/aml'

export default function ThresholdsPage() {
  const { can } = useRbac()
  const canModify = can('rules.modify')

  // ── Threshold rules state ─────────────────────────────────────────────────
  const [rules, setRules] = useState<ThresholdRule[]>([])
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState<ThresholdMetrics | null>(null)
  const [metricsLoading, setMetricsLoading] = useState(true)
  const [outwardDrafts, setOutwardDrafts] = useState<Record<number, number>>({})
  const [inwardDrafts, setInwardDrafts] = useState<Record<number, number>>({})
  const [saving, setSaving] = useState(false)
  const [learnMoreState, setLearnMoreState] = useState<{ rule: ThresholdRule } | null>(null)
  const [pendingSave, setPendingSave] = useState<{ rule: ThresholdRule; direction: 'outward' | 'inward'; newValue: number | null } | null>(null)
  const [pendingToggle, setPendingToggle] = useState<{ rule: ThresholdRule; newActive: boolean } | null>(null)

  // ── Audit log state ───────────────────────────────────────────────────────
  const [auditOpen, setAuditOpen] = useState(false)
  const [auditChanges, setAuditChanges] = useState<ThresholdChange[]>([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditFilterText, setAuditFilterText] = useState('')
  const [auditDateFrom, setAuditDateFrom] = useState('')
  const [auditDateTo, setAuditDateTo] = useState('')
  const [auditPage, setAuditPage] = useState(0)

  // ── Tab + AML settings state ──────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState(0)
  const [amlSettings, setAmlSettings] = useState<AmlSettings | null>(null)
  const [dailyTxnDraft, setDailyTxnDraft] = useState<number>(10)
  const [dailyTxnSaving, setDailyTxnSaving] = useState(false)
  const [expectedTxnDraft, setExpectedTxnDraft] = useState<number>(1000)
  const [expectedTxnSaving, setExpectedTxnSaving] = useState(false)
  const [amlDrafts, setAmlDrafts] = useState<{
    riskScoreFlagThreshold?: number
    riskScoreCaseThreshold?: number
    behRiskScoreFlagThreshold?: number
    behRiskScoreCaseThreshold?: number
    riskScoreNormalThreshold?: number
    behRiskScoreNormalThreshold?: number
    kycRiskNormalThreshold?: number
    kycRiskCaseThreshold?: number
  }>({})
  const [amlPendingSave, setAmlPendingSave] = useState<typeof amlDrafts | null>(null)

  // ── Behavioural rules state ───────────────────────────────────────────────
  const [behRules, setBehRules] = useState<BehavioralRule[]>([])
  const [behLoading, setBehLoading] = useState(true)
  const [behDrafts, setBehDrafts] = useState<Record<number, Record<string, any>>>({})
  const [behPendingSave, setBehPendingSave] = useState<{ rule: BehavioralRule; newParams?: Record<string, any>; newActive?: boolean } | null>(null)

  // ── KYC tiers ─────────────────────────────────────────────────────────────
  const [kycTiers, setKycTiers] = useState<KycTierRecord[]>([])
  const kycRef = useRef<HTMLDivElement>(null)

  // ── Data loading ──────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [r, m, p, t, a] = await Promise.all([
        thresholdApi.list(),
        thresholdApi.metrics(),
        behavioralRuleApi.list(),
        thresholdApi.listKycTiers(),
        amlApi.getSettings(),
      ])
      setRules(r.rules)
      setMetrics(m)
      setBehRules(p.rules)
      setKycTiers(t.tiers)
      setAmlSettings(a.settings)
      setDailyTxnDraft(a.settings?.dailyTxnLimit ?? 10)
      setExpectedTxnDraft(a.settings?.expectedDailyTxnCount ?? 1000)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
      setMetricsLoading(false)
      setBehLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // ── Threshold slider handlers ─────────────────────────────────────────────
  const handleOutwardSlider = (id: number, value: number) => setOutwardDrafts(prev => ({ ...prev, [id]: value }))
  const handleInwardSlider  = (id: number, value: number) => setInwardDrafts(prev => ({ ...prev, [id]: value }))

  const handleSaveConfirm = useCallback(async () => {
    if (!pendingSave || saving) return
    setSaving(true)
    try {
      const payload = pendingSave.direction === 'outward'
        ? { outwardThreshold: pendingSave.newValue }
        : { inwardThreshold: pendingSave.newValue }
      await thresholdApi.update(pendingSave.rule.id, payload)
      if (pendingSave.direction === 'outward') {
        setOutwardDrafts(prev => { const n = { ...prev }; delete n[pendingSave.rule.id]; return n })
      } else {
        setInwardDrafts(prev => { const n = { ...prev }; delete n[pendingSave.rule.id]; return n })
      }
      await loadData()
    } finally { setSaving(false); setPendingSave(null) }
  }, [pendingSave, saving, loadData])

  const handleToggleConfirm = useCallback(async () => {
    if (!pendingToggle || saving) return
    setSaving(true)
    try {
      await thresholdApi.update(pendingToggle.rule.id, { isActive: pendingToggle.newActive })
      await loadData()
    } finally { setSaving(false); setPendingToggle(null) }
  }, [pendingToggle, saving, loadData])

  // ── KYC tier handler ──────────────────────────────────────────────────────
  const handleUpdateTierRule = async (tier: number, field: string, value: number) => {
    try {
      await thresholdApi.updateKycTier(tier, field, value)
      const stateKey = field.replace(/_([a-z])/g, (_, c) => c.toUpperCase()) as keyof KycTierRecord
      setKycTiers(prev => prev.map(t => t.kycTier === tier ? { ...t, [stateKey]: value } : t))
    } catch (e) {
      console.error('Tier update failed', e)
    }
  }

  // ── AML settings handler ──────────────────────────────────────────────────
  const handleAmlSaveConfirm = async () => {
    if (!amlPendingSave || saving || !amlSettings) return
    setSaving(true)
    try {
      const payload = {
        autoOpenCase:                 amlSettings.autoOpenCase ?? false,
        riskScoreNormalThreshold:     amlPendingSave.riskScoreNormalThreshold     ?? amlSettings.riskScoreNormalThreshold     ?? 45,
        riskScoreFlagThreshold:       amlPendingSave.riskScoreFlagThreshold       ?? amlSettings.riskScoreFlagThreshold       ?? 45,
        riskScoreCaseThreshold:       amlPendingSave.riskScoreCaseThreshold       ?? amlSettings.riskScoreCaseThreshold       ?? 85,
        behRiskScoreNormalThreshold:  amlPendingSave.behRiskScoreNormalThreshold  ?? amlSettings.behRiskScoreNormalThreshold  ?? 45,
        behRiskScoreFlagThreshold:    amlPendingSave.behRiskScoreFlagThreshold    ?? amlSettings.behRiskScoreFlagThreshold    ?? 45,
        behRiskScoreCaseThreshold:    amlPendingSave.behRiskScoreCaseThreshold    ?? amlSettings.behRiskScoreCaseThreshold    ?? 85,
        kycRiskNormalThreshold:       amlPendingSave.kycRiskNormalThreshold       ?? amlSettings.kycRiskNormalThreshold       ?? 40,
        kycRiskCaseThreshold:         amlPendingSave.kycRiskCaseThreshold         ?? amlSettings.kycRiskCaseThreshold         ?? 75,
      }
      const res = await amlApi.updateSettings(payload)
      setAmlDrafts({})
      setAmlSettings(res.settings)
    } catch (err) {
      console.error('[AML] settings save failed:', err)
      alert('Failed to save risk thresholds. Check console for details.')
    } finally {
      setSaving(false)
      setAmlPendingSave(null)
    }
  }

  // ── Behavioural rule handlers ─────────────────────────────────────────────
  const handleBehParamChange = (id: number, paramKey: string, val: any) => {
    setBehDrafts(prev => ({ ...prev, [id]: { ...(prev[id] || {}), [paramKey]: val } }))
  }

  const handleBehSaveConfirm = async () => {
    if (!behPendingSave || saving) return
    setSaving(true)
    try {
      const { rule, newParams, newActive } = behPendingSave
      await behavioralRuleApi.update(rule.id, { params: newParams, isActive: newActive })
      if (newParams) {
        setBehDrafts(prev => { const n = { ...prev }; delete n[rule.id]; return n })
      }
      await loadData()
    } finally {
      setSaving(false)
      setBehPendingSave(null)
    }
  }

  // ── Mad-libs sentence builder for behavioural rules ───────────────────────
  const renderMadLibs = (rule: BehavioralRule) => {
    const params = behDrafts[rule.id] ? { ...rule.params, ...behDrafts[rule.id] } : rule.params
    const ro = !canModify

    switch (rule.ruleId) {
      case 'pat-1': return (
        <Typography sx={{ fontSize: '0.9375rem', color: 'var(--on-surface-variant)', lineHeight: 2 }}>
          Flag when <MadLibInput value={params.ip_count} readOnly={ro} onChange={v => handleBehParamChange(rule.id, 'ip_count', v)} /> customer accounts — none with prior relationship — all initiate wire transfers from the same IP block within <MadLibInput value={params.timeframe_minutes} readOnly={ro} onChange={v => handleBehParamChange(rule.id, 'timeframe_minutes', v)} /> minutes of each other.
        </Typography>
      )
      case 'pat-2': return (
        <Typography sx={{ fontSize: '0.9375rem', color: 'var(--on-surface-variant)', lineHeight: 2 }}>
          Flag when a customer logs in from distant locations physically impossible without supersonic travel, separated by at least <MadLibInput value={params.distance_km} width={80} readOnly={ro} onChange={v => handleBehParamChange(rule.id, 'distance_km', v)} /> km within <MadLibInput value={params.timeframe_hours} readOnly={ro} onChange={v => handleBehParamChange(rule.id, 'timeframe_hours', v)} /> hours.
        </Typography>
      )
      case 'pat-3': return (
        <Typography sx={{ fontSize: '0.9375rem', color: 'var(--on-surface-variant)', lineHeight: 2 }}>
          Flag when a single device fingerprint is authenticated as <MadLibInput value={params.user_count} readOnly={ro} onChange={v => handleBehParamChange(rule.id, 'user_count', v)} /> different customers in the past <MadLibInput value={params.timeframe_hours} readOnly={ro} onChange={v => handleBehParamChange(rule.id, 'timeframe_hours', v)} /> hours.
        </Typography>
      )
      case 'pat-4': return (
        <Typography sx={{ fontSize: '0.9375rem', color: 'var(--on-surface-variant)', lineHeight: 2 }}>
          Flag when more than <MadLibInput value={params.min_customers} readOnly={ro} onChange={v => handleBehParamChange(rule.id, 'min_customers', v)} /> customers transact outside their personal baseline of activity between <MadLibInput type="text" width={80} value={params.time_start} readOnly={ro} onChange={v => handleBehParamChange(rule.id, 'time_start', v)} /> and <MadLibInput type="text" width={80} value={params.time_end} readOnly={ro} onChange={v => handleBehParamChange(rule.id, 'time_end', v)} />.
        </Typography>
      )
      case 'pat-5': return (
        <Typography sx={{ fontSize: '0.9375rem', color: 'var(--on-surface-variant)', lineHeight: 2 }}>
          Flag when <MadLibInput value={params.customer_count} readOnly={ro} onChange={v => handleBehParamChange(rule.id, 'customer_count', v)} /> different customers send funds to the same wallet within <MadLibInput value={params.timeframe_hours} readOnly={ro} onChange={v => handleBehParamChange(rule.id, 'timeframe_hours', v)} /> hours.
        </Typography>
      )
      default:
        return <Typography sx={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)', lineHeight: 1.6 }}>{rule.description}</Typography>
    }
  }

  // ── Audit log helpers ─────────────────────────────────────────────────────
  const AUDIT_PAGE_SIZE = 20

  const openAuditLog = async () => {
    setAuditOpen(true)
    setAuditLoading(true)
    setAuditFilterText('')
    setAuditDateFrom('')
    setAuditDateTo('')
    setAuditPage(0)
    try {
      const res = await thresholdApi.allHistory()
      setAuditChanges(res.changes)
    } finally {
      setAuditLoading(false)
    }
  }

  const filteredAuditChanges = auditChanges.filter(c => {
    const matchesFilter = !auditFilterText ||
      (c.ruleName ?? '').toLowerCase().includes(auditFilterText.toLowerCase()) ||
      c.field.toLowerCase().includes(auditFilterText.toLowerCase())
    const matchesFrom = !auditDateFrom || new Date(c.createdAt) >= new Date(auditDateFrom)
    const matchesTo   = !auditDateTo   || new Date(c.createdAt) <= new Date(auditDateTo + 'T23:59:59')
    return matchesFilter && matchesFrom && matchesTo
  })
  const pagedAuditChanges = filteredAuditChanges.slice(auditPage * AUDIT_PAGE_SIZE, (auditPage + 1) * AUDIT_PAGE_SIZE)

  // ── Metric summary cards ──────────────────────────────────────────────────
  const metricCards = [
    { label: 'Active rules',  value: metrics?.activeCount  ?? null, sub: `${metrics?.pausedCount ?? '—'} paused` },
    { label: 'Alerts fired',  value: metrics?.totalFired   ?? null, sub: 'cumulative rule hits' },
    { label: 'Rules paused',  value: metrics?.pausedCount  ?? null, sub: 'not scoring transactions' },
  ]

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ p: 4 }}>
      {/* Page header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
        <Box>
          <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: colorPalette.primary, letterSpacing: '0.14em', textTransform: 'uppercase', mb: 0.75 }}>
            Configure
          </Typography>
          <Typography sx={{ fontSize: '1.625rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost', letterSpacing: '-0.015em', mb: 0.5 }}>
            Detection Thresholds
          </Typography>
          <Typography sx={{ fontSize: '0.9375rem', color: '#64748b' }}>
            Tune the rules that flag suspicious activity across transaction detection, behavioral patterns, and risk scoring
          </Typography>
        </Box>
      </Box>

      {/* Tab bar */}
      <Tabs
        value={activeTab}
        onChange={(_, v) => setActiveTab(v)}
        sx={{
          borderBottom: '1px solid var(--border-col)', mb: 3, minHeight: 36,
          '& .MuiTabs-indicator': { bgcolor: colorPalette.primary, height: 2 },
          '& .MuiTab-root': {
            fontFamily: 'Jost', fontSize: '0.75rem', fontWeight: 600,
            textTransform: 'none', minHeight: 36, py: 0, px: 2.5,
            color: '#94a3b8',
            '&.Mui-selected': { color: colorPalette.primary },
          },
        }}
      >
        <Tab label="Transaction Rules" />
        {!isBuildOne && <Tab label="Behavioural Pattern Rules" />}
        <Tab label="Risk Score Configuration" />
      </Tabs>

      {/* View-only notice */}
      {!canModify && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2.5, py: 1.5, mb: 2, bgcolor: 'var(--section-bg)', border: '1px solid var(--border-col)' }}>
          <LockOutlinedIcon sx={{ fontSize: '1rem', color: '#94a3b8' }} />
          <Typography sx={{ fontSize: '0.8125rem', color: '#64748b', fontWeight: 500 }}>
            You have <strong>view-only</strong> access to this page. Contact an admin or CCO to modify detection rules.
          </Typography>
        </Box>
      )}

      <Stack gap={3}>

        {/* ── Tab 0: Transaction Rules ────────────────────────────────────── */}
        {activeTab === 0 && (
          <>
            {/* Metric summary */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
              {metricCards.map(s => (
                <Box
                  key={s.label}
                  data-ai-analyzable="true"
                  data-ai-description={`Rule Performance Metric: ${s.label}. value: ${s.value ?? 'N/A'}. status: ${s.sub}.`}
                  sx={{ bgcolor: 'var(--card-bg)', border: '1px solid var(--border-col)', p: 2 }}
                >
                  <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 0.75 }}>
                    {s.label}
                  </Typography>
                  {metricsLoading ? (
                    <Box sx={{ height: 28, width: 56, bgcolor: 'var(--section-bg)', animation: 'pulse 1.5s ease-in-out infinite', '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } } }} />
                  ) : (
                    <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost', lineHeight: 1.1 }}>
                      {s.value ?? '—'}
                    </Typography>
                  )}
                  <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.5 }}>{s.sub}</Typography>
                </Box>
              ))}
            </Box>

            {/* Section header + audit log button */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost' }}>
                  Transaction Detection Rules
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
                  Drag the slider to adjust a threshold, then save to apply
                </Typography>
              </Box>
              <Box onClick={openAuditLog} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1.75, py: 0.875, border: '1px solid var(--border-col)', cursor: 'pointer', '&:hover': { bgcolor: 'var(--section-bg)' } }}>
                <HistoryRoundedIcon sx={{ fontSize: '1rem', color: 'var(--on-surface-variant)' }} />
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--on-surface-variant)', fontFamily: 'Jost' }}>Audit Log</Typography>
              </Box>
            </Box>

            {/* Skeleton */}
            {loading && (
              <Stack gap={2}>
                {[...Array(5)].map((_, i) => (
                  <Box key={i} sx={{ height: 160, bgcolor: 'var(--section-bg)', animation: 'pulse 1.5s ease-in-out infinite', '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } }, animationDelay: `${i * 60}ms` }} />
                ))}
              </Stack>
            )}

            {/* Rule cards */}
            {!loading && rules.map((rule) => {
              const tagColor = tagColors[rule.tag] ?? '#64748b'
              const desc = plainEnglishDescriptions[rule.ruleId]
              const lang = ruleLanguage[rule.ruleId]
              return (
                <Box
                  key={rule.id}
                  data-ai-analyzable="true"
                  data-ai-description={`Detection Rule: ${rule.name}. category: ${rule.tag}. current threshold: ${fmtThreshold(rule, rule.thresholdValue)}. fired: ${rule.firedCount} times. status: ${rule.isActive ? 'Active' : 'Paused'}.`}
                  sx={{ bgcolor: 'var(--card-bg)', border: '1px solid var(--border-col)', borderRadius: 0, opacity: rule.isActive ? 1 : 0.55, transition: 'opacity 0.18s' }}
                >
                  {/* Card header */}
                  <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid var(--border-col)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.625 }}>
                        <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost' }}>
                          {lang?.friendlyName ?? rule.name}
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
                      <Typography sx={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)', mb: 1.125, lineHeight: 1.65 }}>
                        {lang?.tagline ?? desc?.simple ?? rule.description}
                      </Typography>
                      <Button
                        startIcon={<HelpOutlineRoundedIcon sx={{ fontSize: '0.875rem' }} />}
                        onClick={() => setLearnMoreState({ rule })}
                        sx={{ fontSize: '0.75rem', fontWeight: 600, color: colorPalette.primary, textTransform: 'none', fontFamily: 'Jost', p: 0, '&:hover': { bgcolor: 'transparent', opacity: 0.75 } }}
                      >
                        Learn more
                      </Button>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Tooltip title={!canModify ? 'Requires rules.modify permission' : ''} placement="left">
                        <span>
                          <Switch
                            checked={rule.isActive}
                            disabled={!canModify}
                            onChange={() => canModify && setPendingToggle({ rule, newActive: !rule.isActive })}
                            size="small"
                            sx={{
                              '& .MuiSwitch-track': { borderRadius: 8 },
                              '& .Mui-checked + .MuiSwitch-track': { bgcolor: `${colorPalette.primary} !important`, opacity: '1 !important' },
                            }}
                          />
                        </span>
                      </Tooltip>
                    </Box>
                  </Box>

                  {/* Card body — sliders */}
                  <Box sx={{ px: 3, py: 2.5 }}>
                    {(
                      rule.ruleId === 'velocity-spike'
                        ? [{ dir: 'outward' as const, label: 'Surge threshold', sub: 'today vs yesterday', threshold: rule.thresholdOutward, draft: outwardDrafts[rule.id], setDraft: handleOutwardSlider }]
                        : [
                            { dir: 'outward' as const, label: 'Outward', sub: 'money sent',     threshold: rule.thresholdOutward, draft: outwardDrafts[rule.id], setDraft: handleOutwardSlider },
                            { dir: 'inward'  as const, label: 'Inward',  sub: 'money received', threshold: rule.thresholdInward,  draft: inwardDrafts[rule.id],  setDraft: handleInwardSlider  },
                          ]
                    ).map(({ dir, label, sub, threshold, draft, setDraft }) => {
                      const displayVal = draft ?? (threshold ?? rule.minValue)
                      const hasDraft   = draft !== undefined && draft !== threshold
                      const disabled   = threshold === null
                      return (
                        <Box key={dir} sx={{ mt: dir === 'outward' ? 0 : 1.5, display: 'flex', alignItems: 'center', gap: 2 }}>
                          {/* Direction label */}
                          <Box sx={{ minWidth: 120 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
                              <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: disabled ? '#cbd5e1' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                {label}
                              </Typography>
                              <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>· {sub}</Typography>
                            </Box>
                            {disabled ? (
                              <Typography sx={{ fontSize: '0.75rem', color: '#cbd5e1', fontStyle: 'italic' }}>Not monitored</Typography>
                            ) : (
                              <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'SF Mono, Monaco, monospace' }}>
                                {fmtThreshold(rule, displayVal)}
                              </Typography>
                            )}
                          </Box>

                          {/* Slider */}
                          <Box sx={{ flex: 1, px: 1, opacity: disabled ? 0.3 : 1 }}>
                            <Slider
                              value={displayVal}
                              onChange={(_, v) => { if (!disabled && canModify) setDraft(rule.id, v as number) }}
                              min={rule.minValue}
                              max={rule.maxValue}
                              step={rule.stepValue}
                              disabled={!rule.isActive || disabled || !canModify}
                              sx={{
                                color: colorPalette.primary,
                                '& .MuiSlider-track': { height: 4, border: 'none' },
                                '& .MuiSlider-rail': { height: 4, color: '#e5e7eb', opacity: 1 },
                                '& .MuiSlider-thumb': {
                                  width: 14, height: 14,
                                  bgcolor: 'var(--card-bg)', border: `2px solid ${colorPalette.primary}`,
                                  '&:hover, &.Mui-focusVisible': { boxShadow: `0 0 0 6px ${colorPalette.primary}20` },
                                },
                              }}
                            />
                          </Box>

                          {/* Save / Enable / Disable buttons */}
                          {canModify && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 120, justifyContent: 'flex-end' }}>
                              {hasDraft && !disabled && (
                                <Box
                                  onClick={() => setPendingSave({ rule, direction: dir, newValue: displayVal })}
                                  sx={{ px: 1.5, py: 0.5, bgcolor: colorPalette.primary, color: '#ffffff', fontSize: '0.6875rem', fontWeight: 700, fontFamily: 'Jost', cursor: 'pointer', borderRadius: 0, '&:hover': { opacity: 0.88 } }}
                                >
                                  Save
                                </Box>
                              )}
                              {disabled ? (
                                <Box
                                  onClick={() => setPendingSave({ rule, direction: dir, newValue: rule.thresholdValue })}
                                  sx={{ px: 1.5, py: 0.5, border: `1px solid ${colorPalette.primary}`, color: colorPalette.primary, fontSize: '0.6875rem', fontWeight: 700, fontFamily: 'Jost', cursor: 'pointer', borderRadius: 0, '&:hover': { bgcolor: `${colorPalette.primary}08` } }}
                                >
                                  Enable
                                </Box>
                              ) : (
                                <Box
                                  onClick={() => setPendingSave({ rule, direction: dir, newValue: null })}
                                  sx={{ px: 1.5, py: 0.5, border: '1px solid var(--border-col)', color: '#94a3b8', fontSize: '0.6875rem', fontWeight: 600, fontFamily: 'Jost', cursor: 'pointer', borderRadius: 0, '&:hover': { borderColor: '#fca5a5', color: '#dc2626' } }}
                                >
                                  Disable
                                </Box>
                              )}
                            </Box>
                          )}
                        </Box>
                      )
                    })}

                    {/* Recommendation box */}
                    {desc && (
                      <Box sx={{ mt: 2, p: 1.5, bgcolor: '#f0f9ff', border: '1px solid #bfdbfe', borderRadius: 0 }}>
                        <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#0369a1', textTransform: 'uppercase', mb: 0.5 }}>
                          💡 Recommendation
                        </Typography>
                        <Typography sx={{ fontSize: '0.8125rem', color: '#0c4a6e', lineHeight: 1.5 }}>
                          {desc.recommendation}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </Box>
              )
            })}

            {/* Learn More Dialog */}
            <LearnMoreDialog state={learnMoreState} open={!!learnMoreState} onClose={() => setLearnMoreState(null)} />

            {/* Daily Transaction Limit */}
            <Box sx={{ bgcolor: 'var(--card-bg)', border: '1px solid var(--border-col)', borderRadius: 0 }}>
              <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid var(--border-col)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost' }}>
                    Daily Transaction Limit
                  </Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
                    Maximum number of transactions a customer may perform in 24 hours before a frequency alert fires
                  </Typography>
                </Box>
                {amlSettings && dailyTxnDraft !== amlSettings.dailyTxnLimit && (
                  <Button size="small" variant="text" onClick={() => setDailyTxnDraft(amlSettings.dailyTxnLimit)} sx={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'none', fontWeight: 600 }}>
                    Reset
                  </Button>
                )}
              </Box>
              <Box sx={{ px: 3, py: 3, display: 'flex', alignItems: 'flex-start', gap: 4, flexWrap: 'wrap' }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Transactions per day
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <TextField
                      type="number"
                      size="small"
                      value={dailyTxnDraft}
                      disabled={!canModify}
                      onChange={e => canModify && setDailyTxnDraft(Math.max(1, Math.min(10000, Number(e.target.value) || 1)))}
                      slotProps={{ htmlInput: { min: 1, max: 10000 } }}
                      sx={{
                        width: 110,
                        '& .MuiOutlinedInput-root': { bgcolor: 'var(--input-bg)', borderRadius: 0, '& fieldset': { borderColor: 'var(--border-col)' }, '&:hover fieldset': { borderColor: colorPalette.primary }, '&.Mui-focused fieldset': { borderColor: colorPalette.primary, borderWidth: '1px' } },
                        '& .MuiOutlinedInput-input': { fontSize: '0.875rem', fontFamily: 'Jost', py: '10px', px: '12px', color: 'var(--heading-color)' },
                      }}
                    />
                    <Chip
                      label={dailyTxnDraft === 10 ? 'Default' : dailyTxnDraft < 10 ? 'Stricter' : 'Permissive'}
                      size="small"
                      sx={{
                        borderRadius: 0, fontSize: '0.625rem', fontWeight: 700,
                        bgcolor: dailyTxnDraft === 10 ? '#f0fdf4' : dailyTxnDraft < 10 ? '#fef2f2' : '#fffbeb',
                        color:   dailyTxnDraft === 10 ? '#10b981' : dailyTxnDraft < 10 ? '#dc2626' : '#d97706',
                      }}
                    />
                  </Box>
                </Box>
                <Box sx={{ flex: 1, minWidth: 220, bgcolor: 'var(--section-bg)', border: '1px solid var(--border-col)', px: 2.5, py: 2 }}>
                  <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.5 }}>
                    How this rule works
                  </Typography>
                  <Typography sx={{ fontSize: '0.78rem', color: '#64748b', lineHeight: 1.6 }}>
                    When a customer exceeds <strong>{dailyTxnDraft}</strong> transaction{dailyTxnDraft !== 1 ? 's' : ''} within 24 hours, the engine raises a <strong>pat-5</strong> frequency alert and adds it to the transaction risk score. Raise this for high-frequency customers (merchants, agents); lower it for stricter monitoring.
                  </Typography>
                </Box>
                {canModify && amlSettings && dailyTxnDraft !== amlSettings.dailyTxnLimit && (
                  <Box sx={{ display: 'flex', alignItems: 'flex-end', pb: 0.25 }}>
                    <Button
                      variant="contained"
                      size="small"
                      disabled={dailyTxnSaving}
                      onClick={async () => {
                        setDailyTxnSaving(true)
                        try {
                          const res = await amlApi.updateDailyTxnLimit(dailyTxnDraft)
                          setAmlSettings(res.settings)
                          setDailyTxnDraft(res.settings.dailyTxnLimit)
                        } catch { /* keep draft */ }
                        finally { setDailyTxnSaving(false) }
                      }}
                      sx={{ bgcolor: colorPalette.primary, color: '#fff', fontWeight: 700, fontSize: '0.8rem', px: 3, borderRadius: 0, textTransform: 'none', '&:hover': { bgcolor: '#1539a8' } }}
                    >
                      {dailyTxnSaving ? 'Saving…' : 'Save'}
                    </Button>
                  </Box>
                )}
              </Box>
            </Box>

            {/* Expected Daily Transaction Volume */}
            <Box sx={{ bgcolor: 'var(--card-bg)', border: '1px solid var(--border-col)', borderRadius: 0 }}>
              <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid var(--border-col)' }}>
                <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost' }}>
                  Expected Daily Transaction Volume
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
                  Your institution's normal number of transactions per day — used as the baseline for the Sudden Transaction Surge Alert
                </Typography>
              </Box>
              <Box sx={{ px: 3, py: 3, display: 'flex', alignItems: 'flex-start', gap: 4, flexWrap: 'wrap' }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Transactions per day
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <TextField
                      type="number"
                      size="small"
                      value={expectedTxnDraft}
                      disabled={!canModify}
                      onChange={e => canModify && setExpectedTxnDraft(Math.max(1, Math.min(10_000_000, Number(e.target.value) || 1)))}
                      slotProps={{ htmlInput: { min: 1, max: 10000000 } }}
                      sx={{
                        width: 130,
                        '& .MuiOutlinedInput-root': { bgcolor: 'var(--input-bg)', borderRadius: 0, '& fieldset': { borderColor: 'var(--border-col)' }, '&:hover fieldset': { borderColor: colorPalette.primary }, '&.Mui-focused fieldset': { borderColor: colorPalette.primary, borderWidth: '1px' } },
                        '& .MuiOutlinedInput-input': { fontSize: '0.875rem', fontFamily: 'Jost', py: '10px', px: '12px', color: 'var(--heading-color)' },
                      }}
                    />
                    {canModify && amlSettings && expectedTxnDraft !== amlSettings.expectedDailyTxnCount && (
                      <Button
                        variant="contained"
                        size="small"
                        disabled={expectedTxnSaving}
                        onClick={async () => {
                          setExpectedTxnSaving(true)
                          try {
                            const res = await amlApi.updateExpectedDailyTxnCount(expectedTxnDraft)
                            setAmlSettings(res.settings)
                            setExpectedTxnDraft(res.settings.expectedDailyTxnCount)
                          } catch { /* keep draft */ }
                          finally { setExpectedTxnSaving(false) }
                        }}
                        sx={{ bgcolor: colorPalette.primary, color: '#fff', fontWeight: 700, fontSize: '0.8rem', px: 3, borderRadius: 0, textTransform: 'none', '&:hover': { bgcolor: '#1539a8' } }}
                      >
                        {expectedTxnSaving ? 'Saving…' : 'Save'}
                      </Button>
                    )}
                  </Box>
                </Box>
                <Box sx={{ flex: 1, minWidth: 220, bgcolor: 'var(--section-bg)', border: '1px solid var(--border-col)', px: 2.5, py: 2 }}>
                  <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.5 }}>
                    How this is used
                  </Typography>
                  <Typography sx={{ fontSize: '0.78rem', color: '#64748b', lineHeight: 1.6 }}>
                    When today's transaction count exceeds <strong>{expectedTxnDraft.toLocaleString()}</strong> by your configured surge threshold (e.g. +30%), the system creates a platform-wide alert and notifies your compliance team to investigate. Set this to your typical busiest-day volume so the alert only fires on genuine anomalies.
                  </Typography>
                </Box>
              </Box>
            </Box>
          </>
        )}

        {/* ── Tab 1: Behavioural Pattern Rules (non-Build-One only) ───────── */}
        {(activeTab === 1 && !isBuildOne) && (
          <Box sx={{ position: 'relative' }}>
            <ComingSoonOverlay title="Behavioral Pattern Rules" />
            <Box sx={{ bgcolor: 'var(--card-bg)', border: '1px solid var(--border-col)', borderRadius: 0 }}>
              <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid var(--border-col)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost' }}>
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
                    <Box key={i} sx={{ height: 100, bgcolor: 'var(--section-bg)', animation: 'pulse 1.5s ease-in-out infinite', '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } }, animationDelay: `${i * 60}ms` }} />
                  ))}
                </Box>
              )}

              <Stack gap={0}>
                {!behLoading && behRules.map((p) => {
                  const cat = categoryConfig[p.category] || categoryConfig['Temporal']
                  const sev = severityConfig[p.severity]  || severityConfig['medium']
                  const hasDraft = behDrafts[p.id] !== undefined && Object.keys(behDrafts[p.id]).length > 0
                  const plang = patternLanguage[p.ruleId]
                  return (
                    <Box
                      key={p.id}
                      data-ai-analyzable="true"
                      data-ai-description={`Behavioral Pattern Config: "${p.name}". Severity: ${p.severity}. Matched Typology: ${p.matchedTypology}. Active: ${p.isActive}.`}
                      sx={{ borderBottom: '1px solid var(--border-col)', overflow: 'hidden', opacity: p.isActive ? 1 : 0.6, '&:last-child': { borderBottom: 'none' } }}
                    >
                      {/* Header */}
                      <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid var(--border-col)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, flex: 1, mr: 2 }}>
                          <Box sx={{ width: 36, height: 36, borderRadius: 0, bgcolor: `${cat.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: cat.color, flexShrink: 0, mt: 0.25 }}>
                            {cat.icon}
                          </Box>
                          <Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.375 }}>
                              <Typography sx={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost' }}>
                                {p.name}
                              </Typography>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: cat.color, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                                  {p.category}
                                </Typography>
                                <Box sx={{ width: 3, height: 3, bgcolor: '#cbd5e1' }} />
                                <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', fontWeight: 500 }}>
                                  {p.matchedTypology}
                                </Typography>
                              </Box>
                            </Box>
                            {plang && (
                              <Typography sx={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)', lineHeight: 1.65, maxWidth: 560 }}>
                                {plang.tagline}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0 }}>
                          <Chip
                            label={p.severity.toUpperCase()}
                            size="small"
                            sx={{ bgcolor: sev.bg, color: sev.color, fontWeight: 700, fontSize: '0.6875rem', letterSpacing: '0.1em', borderRadius: 0, height: 24 }}
                          />
                          <Tooltip title={!canModify ? 'Requires rules.modify permission' : ''} placement="left">
                            <span>
                              <Switch
                                checked={p.isActive}
                                disabled={!canModify}
                                onChange={(e) => canModify && setBehPendingSave({ rule: p, newActive: e.target.checked })}
                                sx={{ '& .MuiSwitch-track': { borderRadius: 8 }, '& .Mui-checked + .MuiSwitch-track': { bgcolor: `${colorPalette.primary} !important`, opacity: '1 !important' } }}
                              />
                            </span>
                          </Tooltip>
                        </Box>
                      </Box>

                      {/* Why this pattern exists */}
                      {plang && (
                        <Box sx={{ px: 3, py: 2, borderBottom: '1px solid var(--border-col)', bgcolor: '#fffbeb', display: 'flex', gap: 1.5 }}>
                          <Box sx={{ width: 3, flexShrink: 0, bgcolor: '#f59e0b', borderRadius: '2px', alignSelf: 'stretch' }} />
                          <Box>
                            <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.625 }}>
                              Why this rule exists
                            </Typography>
                            <Typography sx={{ fontSize: '0.8125rem', color: '#78350f', lineHeight: 1.75 }}>
                              {plang.whyItMatters}
                            </Typography>
                          </Box>
                        </Box>
                      )}

                      {/* Mad Libs builder */}
                      <Box sx={{ px: 3, pt: 2.5, pb: 2, bgcolor: '#fbfcfd' }}>
                        <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 1.25 }}>
                          Configure trigger conditions
                        </Typography>
                        {renderMadLibs(p)}
                        {hasDraft && canModify && (
                          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 1.5 }}>
                            <Button
                              variant="outlined"
                              onClick={() => setBehDrafts(prev => { const n = { ...prev }; delete n[p.id]; return n })}
                              sx={{ color: 'var(--on-surface-variant)', borderColor: '#cbd5e1', textTransform: 'none', fontWeight: 600, fontFamily: 'Jost', borderRadius: 0 }}
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

                      {/* Example + Recommendation */}
                      <Box sx={{ borderTop: '1px solid var(--border-col)' }}>
                        <Box sx={{ px: 3, py: 2, display: 'flex', gap: 1.5, borderBottom: plang ? '1px solid var(--border-col)' : 'none' }}>
                          <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', mt: 0.25, width: 70, flexShrink: 0 }}>
                            Example
                          </Typography>
                          <Typography sx={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)', fontFamily: 'SF Mono, Monaco, monospace', lineHeight: 1.65 }}>
                            {p.example}
                          </Typography>
                        </Box>
                        {plang && (
                          <Box sx={{ px: 3, py: 2, bgcolor: '#f0fdf4', display: 'flex', gap: 1.5 }}>
                            <Box sx={{ width: 3, flexShrink: 0, bgcolor: '#10b981', borderRadius: '2px', alignSelf: 'stretch' }} />
                            <Box>
                              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.625 }}>
                                💡 How to tune this rule
                              </Typography>
                              <Typography sx={{ fontSize: '0.8125rem', color: '#166534', lineHeight: 1.75 }}>
                                {plang.recommendation}
                              </Typography>
                            </Box>
                          </Box>
                        )}
                      </Box>
                    </Box>
                  )
                })}
              </Stack>
            </Box>
          </Box>
        )}

        {/* ── Tab 2 (or Tab 1 on Build One): Risk Score Configuration ────── */}
        {((activeTab === 1 && isBuildOne) || (activeTab === 2 && !isBuildOne)) && (
          <Box sx={{ mt: 3 }}>
            {!amlSettings ? (
              <Box sx={{ height: 200, bgcolor: 'var(--section-bg)', animation: 'pulse 1.5s ease-in-out infinite', borderRadius: '8px' }} />
            ) : (
              <Stack gap={5}>

                {/* Transaction Scoring */}
                <Box>
                  <Typography sx={{ fontSize: '1.125rem', fontWeight: 500, color: 'var(--heading-color)', fontFamily: 'Jost', mb: 3, pb: 1, borderBottom: '1px solid var(--border-col)' }}>
                    Transaction Scoring
                  </Typography>
                  <Stack gap={3}>
                    <Typography sx={{ fontSize: '0.875rem', color: '#64748b', lineHeight: 1.6 }}>
                      Drag the boundary handles to set risk zones. Transactions are scored 0–100 — configure exactly where automated flagging and case creation activate.
                    </Typography>
                    <RiskSeekbar
                      values={[
                        amlDrafts.riskScoreNormalThreshold ?? amlSettings.riskScoreNormalThreshold ?? 45,
                        amlDrafts.riskScoreCaseThreshold   ?? amlSettings.riskScoreCaseThreshold   ?? 85,
                      ]}
                      onChange={canModify ? ([v0, v1]) =>
                        setAmlDrafts(prev => ({ ...prev, riskScoreNormalThreshold: v0, riskScoreFlagThreshold: v0, riskScoreCaseThreshold: v1 }))
                        : () => {}}
                    />
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5 }}>
                      {[
                        { label: 'Normal',  range: `0 – ${(amlDrafts.riskScoreNormalThreshold ?? amlSettings.riskScoreNormalThreshold ?? 45) - 1}`,   note: 'Processed automatically without scrutiny.',    bg: '#f0fdf4', border: '#bbf7d0', title: '#15803d', sub: '#166534' },
                        { label: 'Flagged', range: `${amlDrafts.riskScoreNormalThreshold ?? amlSettings.riskScoreNormalThreshold ?? 45} – ${(amlDrafts.riskScoreCaseThreshold ?? amlSettings.riskScoreCaseThreshold ?? 85) - 1}`, note: 'Queued for analyst review.',                 bg: '#fffbeb', border: '#fde68a', title: '#d97706', sub: '#92400e' },
                        { label: 'Case',    range: `${amlDrafts.riskScoreCaseThreshold   ?? amlSettings.riskScoreCaseThreshold   ?? 85} – 100`,         note: 'Investigation case auto-opened.',             bg: '#fff1f2', border: '#fecdd3', title: '#b91c1c', sub: '#7f1d1d' },
                      ].map(({ label, range, note, bg, border, title, sub }) => (
                        <Box key={label} sx={{ p: 2, bgcolor: bg, borderRadius: 0, border: `1px solid ${border}` }}>
                          <Typography sx={{ fontSize: '0.6875rem', fontWeight: 800, color: title, fontFamily: 'Jost', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.5 }}>{label}</Typography>
                          <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: title, fontFamily: 'SF Mono, Monaco, monospace', mb: 0.25 }}>{range}</Typography>
                          <Typography sx={{ fontSize: '0.75rem', color: sub, lineHeight: 1.45 }}>{note}</Typography>
                        </Box>
                      ))}
                    </Box>
                  </Stack>
                </Box>

                {/* Behavioral Scoring (non-Build-One) */}
                {!isBuildOne && (
                  <Box sx={{ mt: 2 }}>
                    <Typography sx={{ fontSize: '1.125rem', fontWeight: 500, color: 'var(--heading-color)', fontFamily: 'Jost', mb: 3, pb: 1, borderBottom: '1px solid var(--border-col)' }}>
                      Behavioral Analysis Scoring
                    </Typography>
                    <Stack gap={3}>
                      <Typography sx={{ fontSize: '0.875rem', color: '#64748b', lineHeight: 1.6 }}>
                        Behavioral pattern scores are generated by the topology engine. Set zone boundaries to control when a pattern match triggers a review flag or opens an investigation case.
                      </Typography>
                      <RiskSeekbar
                        values={[
                          amlDrafts.behRiskScoreNormalThreshold ?? amlSettings.behRiskScoreNormalThreshold ?? 45,
                          amlDrafts.behRiskScoreCaseThreshold   ?? amlSettings.behRiskScoreCaseThreshold   ?? 85,
                        ]}
                        zoneLabels={['Normal', 'Suspicious', 'Case']}
                        onChange={canModify ? ([v0, v1]) =>
                          setAmlDrafts(prev => ({ ...prev, behRiskScoreNormalThreshold: v0, behRiskScoreFlagThreshold: v0, behRiskScoreCaseThreshold: v1 }))
                          : () => {}}
                      />
                      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5 }}>
                        {[
                          { label: 'Normal',     range: `0 – ${(amlDrafts.behRiskScoreNormalThreshold ?? amlSettings.behRiskScoreNormalThreshold ?? 45) - 1}`,   note: 'Pattern within expected bounds.',           bg: '#f0fdf4', border: '#bbf7d0', title: '#15803d', sub: '#166534' },
                          { label: 'Suspicious', range: `${amlDrafts.behRiskScoreNormalThreshold ?? amlSettings.behRiskScoreNormalThreshold ?? 45} – ${(amlDrafts.behRiskScoreCaseThreshold ?? amlSettings.behRiskScoreCaseThreshold ?? 85) - 1}`, note: 'Anomalous pattern flagged for review.',     bg: '#fffbeb', border: '#fde68a', title: '#d97706', sub: '#92400e' },
                          { label: 'Case',       range: `${amlDrafts.behRiskScoreCaseThreshold   ?? amlSettings.behRiskScoreCaseThreshold   ?? 85} – 100`,         note: 'Severe anomaly — case auto-opened.',        bg: '#fff1f2', border: '#fecdd3', title: '#b91c1c', sub: '#7f1d1d' },
                        ].map(({ label, range, note, bg, border, title, sub }) => (
                          <Box key={label} sx={{ p: 2, bgcolor: bg, borderRadius: 0, border: `1px solid ${border}` }}>
                            <Typography sx={{ fontSize: '0.6875rem', fontWeight: 800, color: title, fontFamily: 'Jost', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.5 }}>{label}</Typography>
                            <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: title, fontFamily: 'SF Mono, Monaco, monospace', mb: 0.25 }}>{range}</Typography>
                            <Typography sx={{ fontSize: '0.75rem', color: sub, lineHeight: 1.45 }}>{note}</Typography>
                          </Box>
                        ))}
                      </Box>
                    </Stack>
                  </Box>
                )}

                {/* KYC Risk Profile Score */}
                <Box>
                  <Typography sx={{ fontSize: '1.125rem', fontWeight: 500, color: 'var(--heading-color)', fontFamily: 'Jost', mb: 3, pb: 1, borderBottom: '1px solid var(--border-col)' }}>
                    Risk Profile Score
                  </Typography>
                  <Stack gap={3}>
                    <Typography sx={{ fontSize: '0.875rem', color: '#64748b', lineHeight: 1.6 }}>
                      KYC pipeline results are scored 0–100 and mapped to a customer risk profile. Configure the boundaries that determine whether a customer is cleared, flagged for review, or escalated to an open case.
                    </Typography>
                    <RiskSeekbar
                      values={[
                        amlDrafts.kycRiskNormalThreshold ?? amlSettings!.kycRiskNormalThreshold ?? 40,
                        amlDrafts.kycRiskCaseThreshold   ?? amlSettings!.kycRiskCaseThreshold   ?? 75,
                      ]}
                      zoneLabels={['Normal', 'Flagged', 'Open Case']}
                      onChange={canModify ? ([v0, v1]) =>
                        setAmlDrafts(prev => ({ ...prev, kycRiskNormalThreshold: v0, kycRiskCaseThreshold: v1 }))
                        : () => {}}
                    />
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5 }}>
                      {[
                        { label: 'Normal',    range: `0 – ${(amlDrafts.kycRiskNormalThreshold ?? amlSettings!.kycRiskNormalThreshold ?? 40) - 1}`,   note: 'Customer KYC cleared — no action required.',            bg: '#f0fdf4', border: '#bbf7d0', title: '#15803d', sub: '#166534' },
                        { label: 'Flagged',   range: `${amlDrafts.kycRiskNormalThreshold ?? amlSettings!.kycRiskNormalThreshold ?? 40} – ${(amlDrafts.kycRiskCaseThreshold ?? amlSettings!.kycRiskCaseThreshold ?? 75) - 1}`, note: 'KYC incomplete or mismatched — queued for review.',        bg: '#fffbeb', border: '#fde68a', title: '#d97706', sub: '#92400e' },
                        { label: 'Open Case', range: `${amlDrafts.kycRiskCaseThreshold   ?? amlSettings!.kycRiskCaseThreshold   ?? 75} – 100`,         note: 'High-risk profile — investigation case opened.',         bg: '#fff1f2', border: '#fecdd3', title: '#b91c1c', sub: '#7f1d1d' },
                      ].map(({ label, range, note, bg, border, title, sub }) => (
                        <Box key={label} sx={{ p: 2, bgcolor: bg, borderRadius: 0, border: `1px solid ${border}` }}>
                          <Typography sx={{ fontSize: '0.6875rem', fontWeight: 800, color: title, fontFamily: 'Jost', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.5 }}>{label}</Typography>
                          <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: title, fontFamily: 'SF Mono, Monaco, monospace', mb: 0.25 }}>{range}</Typography>
                          <Typography sx={{ fontSize: '0.75rem', color: sub, lineHeight: 1.45 }}>{note}</Typography>
                        </Box>
                      ))}
                    </Box>
                  </Stack>
                </Box>

                {/* Save bar */}
                {Object.keys(amlDrafts).length > 0 && canModify && (
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, pt: 4, mt: 2, borderTop: '1px solid var(--border-col)' }}>
                    <Button onClick={() => setAmlDrafts({})} sx={{ textTransform: 'none', color: 'var(--on-surface-variant)', fontSize: '0.9375rem', fontWeight: 600 }}>
                      Discard Changes
                    </Button>
                    <Button
                      variant="contained"
                      onClick={() => setAmlPendingSave(amlDrafts)}
                      sx={{ textTransform: 'none', bgcolor: 'var(--heading-color)', color: '#ffffff', fontSize: '0.9375rem', fontWeight: 600, px: 4, py: 1, borderRadius: 0, boxShadow: 'none', '&:hover': { bgcolor: 'var(--on-surface)' } }}
                    >
                      Apply Thresholds
                    </Button>
                  </Box>
                )}
              </Stack>
            )}
          </Box>
        )}
      </Stack>

      {/* ── KYC Tier Rules (shown below Tab 0 only) ─────────────────────── */}
      {activeTab === 0 && (
        <Box ref={kycRef} sx={{ mt: 8, mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
            <VerifiedOutlinedIcon sx={{ color: colorPalette.primary, fontSize: '1.5rem' }} />
            <Typography sx={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--heading-color)', fontFamily: 'Jost' }}>
              KYC Tier-Based Limits
            </Typography>
          </Box>
          <Typography sx={{ fontSize: '0.875rem', color: '#64748b', mb: 4 }}>
            Define different transaction thresholds based on your customer's verification level.
          </Typography>

          <Grid container spacing={3}>
            {kycTiers.map((tier) => (
              <Grid key={tier.kycTier} size={{ xs: 12, md: 6 }}>
                <Box sx={{ p: 2.5, border: '1px solid var(--border-col)', bgcolor: 'var(--card-bg)', height: '100%' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Box>
                      <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: colorPalette.primary, textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.25 }}>
                        Tier {tier.kycTier}
                      </Typography>
                      <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost' }}>
                        {tier.kycTier === 0 ? 'Unverified' : tier.kycTier === 1 ? 'Basic' : tier.kycTier === 2 ? 'Intermediate' : 'Full KYC'}
                      </Typography>
                    </Box>
                    <Chip
                      label={tier.riskScoreBoost > 0 ? `+${tier.riskScoreBoost} Risk Boost` : 'Standard Risk'}
                      size="small"
                      sx={{ borderRadius: 0, fontSize: '0.625rem', fontWeight: 700, bgcolor: tier.riskScoreBoost > 0 ? '#fef2f2' : '#f0fdf4', color: tier.riskScoreBoost > 0 ? '#dc2626' : '#10b981' }}
                    />
                  </Box>

                  <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.07em', mb: 0.75 }}>
                    Daily Limits (₦)
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '72px 1fr 1fr', gap: 0.5, mb: 0.5 }}>
                    <Box />
                    <Typography sx={{ fontSize: '0.5625rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center' }}>Inward ↓</Typography>
                    <Typography sx={{ fontSize: '0.5625rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center' }}>Outward ↑</Typography>
                  </Box>
                  <Stack gap={0.5}>
                    {([
                      { label: 'Wire',   inField: 'daily_limit_wire_inward',   outField: 'daily_limit_wire_outward',   inVal: tier.dailyLimitWireInward   ?? tier.dailyLimitWire,   outVal: tier.dailyLimitWireOutward   ?? 0 },
                      { label: 'Mobile', inField: 'daily_limit_mobile_inward', outField: 'daily_limit_mobile_outward', inVal: tier.dailyLimitMobileInward  ?? tier.dailyLimitMobile, outVal: tier.dailyLimitMobileOutward ?? 0 },
                      { label: 'USSD',   inField: 'daily_limit_ussd_inward',   outField: 'daily_limit_ussd_outward',   inVal: tier.dailyLimitUssdInward    ?? tier.dailyLimitUssd,   outVal: tier.dailyLimitUssdOutward   ?? 0 },
                      { label: 'BDC',    inField: 'daily_limit_bdc_inward',    outField: 'daily_limit_bdc_outward',    inVal: tier.dailyLimitBdcInward     ?? tier.dailyLimitBdc,    outVal: tier.dailyLimitBdcOutward    ?? 0 },
                      { label: 'Other',  inField: 'daily_limit_other_inward',  outField: 'daily_limit_other_outward',  inVal: tier.dailyLimitOtherInward   ?? tier.dailyLimitOther,  outVal: tier.dailyLimitOtherOutward  ?? 0 },
                    ] as const).map(({ label, inField, outField, inVal, outVal }) => (
                      <Box key={label} sx={{ display: 'grid', gridTemplateColumns: '72px 1fr 1fr', gap: 0.5, alignItems: 'center' }}>
                        <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--on-surface-variant)' }}>{label}</Typography>
                        {([{ field: inField, val: inVal }, { field: outField, val: outVal }] as const).map(({ field, val }) => (
                          <Box key={field} sx={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border-col)', bgcolor: 'var(--input-bg)', '&:focus-within': { borderColor: colorPalette.primary, bgcolor: 'var(--card-bg)' } }}>
                            <Typography sx={{ px: 0.75, fontSize: '0.625rem', color: '#94a3b8', borderRight: '1px solid var(--border-col)', flexShrink: 0, lineHeight: '26px' }}>₦</Typography>
                            <Box
                              component="input"
                              type="number"
                              value={val}
                              disabled={!canModify}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                canModify && handleUpdateTierRule(tier.kycTier, field, parseInt(e.target.value) || 0)
                              }
                              sx={{
                                flex: 1, border: 'none', outline: 'none', px: 0.75, py: 0.375,
                                fontSize: '0.6875rem', fontFamily: 'SF Mono, Monaco, monospace',
                                color: 'var(--heading-color)', bgcolor: 'transparent', width: 0,
                                opacity: canModify ? 1 : 0.6,
                                '&::-webkit-inner-spin-button, &::-webkit-outer-spin-button': { WebkitAppearance: 'none' },
                              }}
                            />
                          </Box>
                        ))}
                      </Box>
                    ))}
                  </Stack>

                  <Box sx={{ mt: 2 }}>
                    <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.07em', mb: 0.75 }}>Risk Score Boost</Typography>
                    <Slider
                      value={tier.riskScoreBoost}
                      disabled={!canModify}
                      onChange={(_, v) => canModify && handleUpdateTierRule(tier.kycTier, 'risk_score_boost', v as number)}
                      min={0} max={50} step={5}
                      valueLabelDisplay="auto"
                      sx={{ color: colorPalette.primary, py: 0.75 }}
                    />
                    <Typography sx={{ fontSize: '0.625rem', color: '#94a3b8' }}>
                      Adds {tier.riskScoreBoost} points to risk score for every transaction from this tier.
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* ── TOTP confirmation dialogs ────────────────────────────────────── */}
      <TOTPConfirmation
        open={!!pendingSave}
        onClose={() => setPendingSave(null)}
        onConfirm={handleSaveConfirm}
        operation="update"
        title={pendingSave?.newValue === null ? `Disable ${pendingSave?.direction} threshold` : 'Update detection threshold'}
        description={
          pendingSave?.newValue === null
            ? `This rule will no longer fire for ${pendingSave?.direction} transactions.`
            : "You're updating an active rule that affects how transactions are flagged for review. Confirm with your authenticator code to proceed."
        }
        resourceType="Rule"
        resourceName={pendingSave?.rule.name ?? ''}
        changes={pendingSave ? [{
          field: pendingSave.direction === 'outward' ? 'Outward threshold' : 'Inward threshold',
          from: (() => {
            const cur = pendingSave.direction === 'outward' ? pendingSave.rule.thresholdOutward : pendingSave.rule.thresholdInward
            return cur !== null ? fmtThreshold(pendingSave.rule, cur!) : 'Disabled'
          })(),
          to: pendingSave.newValue !== null ? fmtThreshold(pendingSave.rule, pendingSave.newValue) : 'Disabled',
        }] : []}
      />

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
          from: pendingToggle.rule.isActive ? 'Active' : 'Paused',
          to:   pendingToggle.newActive      ? 'Active' : 'Paused',
        }] : []}
      />

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
        changes={behPendingSave?.newParams
          ? Object.entries(behPendingSave.newParams).map(([k, v]) => ({ field: k, from: String(behPendingSave.rule.params[k]), to: String(v) }))
          : behPendingSave?.newActive !== undefined
            ? [{ field: 'Status', from: behPendingSave.rule.isActive ? 'Active' : 'Paused', to: behPendingSave.newActive ? 'Active' : 'Paused' }]
            : []
        }
      />

      <TOTPConfirmation
        open={!!amlPendingSave}
        onClose={() => setAmlPendingSave(null)}
        onConfirm={handleAmlSaveConfirm}
        operation="update"
        title="Update Risk Score Configuration"
        description="You are modifying the risk score thresholds for automatic flagging and case creation. Confirm with your authenticator code to apply."
        resourceType="Risk Score Thresholds"
        resourceName="Global Settings"
        changes={amlPendingSave ? [
          ...(amlPendingSave.riskScoreNormalThreshold !== undefined ? [{ field: 'Transaction Flag Boundary',  from: String(amlSettings?.riskScoreNormalThreshold ?? '—'), to: String(amlPendingSave.riskScoreNormalThreshold) }] : []),
          ...(amlPendingSave.riskScoreCaseThreshold   !== undefined ? [{ field: 'Transaction Case Threshold', from: String(amlSettings?.riskScoreCaseThreshold   ?? '—'), to: String(amlPendingSave.riskScoreCaseThreshold)   }] : []),
          ...(amlPendingSave.behRiskScoreNormalThreshold !== undefined ? [{ field: 'Behavioral Flag Boundary',  from: String(amlSettings?.behRiskScoreNormalThreshold ?? '—'), to: String(amlPendingSave.behRiskScoreNormalThreshold) }] : []),
          ...(amlPendingSave.behRiskScoreCaseThreshold   !== undefined ? [{ field: 'Behavioral Case Threshold', from: String(amlSettings?.behRiskScoreCaseThreshold   ?? '—'), to: String(amlPendingSave.behRiskScoreCaseThreshold)   }] : []),
        ] : []}
      />

      {/* ── Audit Log Dialog ─────────────────────────────────────────────── */}
      <Dialog open={auditOpen} onClose={() => setAuditOpen(false)} maxWidth="lg" fullWidth slotProps={{ paper: { sx: { borderRadius: 0, height: '80vh', display: 'flex', flexDirection: 'column' } } }}>
        <DialogTitle sx={{ fontFamily: 'Jost', fontWeight: 800, fontSize: '1.125rem', color: 'var(--heading-color)', borderBottom: '1px solid var(--border-col)', pb: 2, flexShrink: 0 }}>
          Threshold Change Log
        </DialogTitle>

        {/* Filter toolbar */}
        <Box sx={{ px: 3, py: 1.75, borderBottom: '1px solid var(--border-col)', display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', bgcolor: 'var(--card-bg)', flexShrink: 0 }}>
          <TextField
            size="small"
            placeholder="Filter by rule or field…"
            value={auditFilterText}
            onChange={e => { setAuditFilterText(e.target.value); setAuditPage(0) }}
            sx={{ flex: 1, minWidth: 200, '& .MuiOutlinedInput-root': { borderRadius: 0, fontSize: '0.8125rem' } }}
          />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontSize: '0.75rem', color: '#64748b', flexShrink: 0 }}>From</Typography>
            <TextField type="date" size="small" value={auditDateFrom} onChange={e => { setAuditDateFrom(e.target.value); setAuditPage(0) }} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 0, fontSize: '0.8125rem' } }} />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontSize: '0.75rem', color: '#64748b', flexShrink: 0 }}>To</Typography>
            <TextField type="date" size="small" value={auditDateTo} onChange={e => { setAuditDateTo(e.target.value); setAuditPage(0) }} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 0, fontSize: '0.8125rem' } }} />
          </Box>
          <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8', flexShrink: 0 }}>
            {filteredAuditChanges.length} result{filteredAuditChanges.length !== 1 ? 's' : ''}
          </Typography>
        </Box>

        <DialogContent sx={{ p: 0, overflow: 'auto', flex: 1 }}>
          {auditLoading ? (
            <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {[...Array(5)].map((_, i) => (
                <Box key={i} sx={{ height: 48, bgcolor: 'var(--section-bg)', animation: 'pulse 1.5s ease-in-out infinite', '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } } }} />
              ))}
            </Box>
          ) : filteredAuditChanges.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography sx={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                {auditChanges.length === 0 ? 'No changes recorded yet.' : 'No changes match your filters.'}
              </Typography>
            </Box>
          ) : (
            <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <Box component="thead" sx={{ position: 'sticky', top: 0, zIndex: 1 }}>
                <Box component="tr" sx={{ bgcolor: 'var(--card-bg)' }}>
                  {['Rule', 'Field', 'From', 'To', 'Changed by', 'When'].map(h => (
                    <Box component="th" key={h} sx={{ px: 2, py: 1.25, textAlign: 'left', fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--border-col)' }}>
                      {h}
                    </Box>
                  ))}
                </Box>
              </Box>
              <Box component="tbody">
                {pagedAuditChanges.map(c => (
                  <Box component="tr" key={c.id} sx={{ borderBottom: '1px solid var(--border-col)', '&:last-child': { borderBottom: 'none' }, '&:hover': { bgcolor: 'var(--section-bg)' } }}>
                    <Box component="td" sx={{ px: 2, py: 1.25, fontWeight: 600, color: 'var(--heading-color)' }}>{c.ruleName ?? '—'}</Box>
                    <Box component="td" sx={{ px: 2, py: 1.25, color: 'var(--on-surface-variant)', fontFamily: 'SF Mono, Monaco, monospace', fontSize: '0.75rem' }}>{c.field}</Box>
                    <Box component="td" sx={{ px: 2, py: 1.25, color: '#64748b' }}>{c.oldValue ?? '—'}</Box>
                    <Box component="td" sx={{ px: 2, py: 1.25, color: '#10b981', fontWeight: 600 }}>{c.newValue}</Box>
                    <Box component="td" sx={{ px: 2, py: 1.25, color: 'var(--on-surface-variant)' }}>{c.changedByName}</Box>
                    <Box component="td" sx={{ px: 2, py: 1.25, color: '#94a3b8', whiteSpace: 'nowrap' }}>{new Date(c.createdAt).toLocaleString()}</Box>
                  </Box>
                ))}
              </Box>
            </Box>
          )}
        </DialogContent>

        {/* Pagination */}
        {!auditLoading && filteredAuditChanges.length > AUDIT_PAGE_SIZE && (
          <Box sx={{ px: 3, py: 1.5, borderTop: '1px solid var(--border-col)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>
              Showing {auditPage * AUDIT_PAGE_SIZE + 1}–{Math.min((auditPage + 1) * AUDIT_PAGE_SIZE, filteredAuditChanges.length)} of {filteredAuditChanges.length}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Box onClick={() => { if (auditPage > 0) setAuditPage(p => p - 1) }} sx={{ px: 1.5, py: 0.5, border: '1px solid var(--border-col)', fontSize: '0.75rem', fontWeight: 600, color: auditPage === 0 ? '#cbd5e1' : '#475569', cursor: auditPage === 0 ? 'default' : 'pointer', borderRadius: 0, '&:hover': auditPage === 0 ? {} : { bgcolor: 'var(--section-bg)' } }}>
                Previous
              </Box>
              <Box onClick={() => { if ((auditPage + 1) * AUDIT_PAGE_SIZE < filteredAuditChanges.length) setAuditPage(p => p + 1) }} sx={{ px: 1.5, py: 0.5, border: '1px solid var(--border-col)', fontSize: '0.75rem', fontWeight: 600, color: (auditPage + 1) * AUDIT_PAGE_SIZE >= filteredAuditChanges.length ? '#cbd5e1' : '#475569', cursor: (auditPage + 1) * AUDIT_PAGE_SIZE >= filteredAuditChanges.length ? 'default' : 'pointer', borderRadius: 0, '&:hover': (auditPage + 1) * AUDIT_PAGE_SIZE >= filteredAuditChanges.length ? {} : { bgcolor: 'var(--section-bg)' } }}>
                Next
              </Box>
            </Box>
          </Box>
        )}
      </Dialog>
    </Box>
  )
}
