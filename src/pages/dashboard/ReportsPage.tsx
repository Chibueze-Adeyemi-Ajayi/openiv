import {
  Box, Typography, Stack, Button, Chip, IconButton, CircularProgress, Tooltip,
} from '@mui/material'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { colorPalette } from '@/theme'
import FileReportDialog from '@/components/dashboard/FileReportDialog'
import ScheduleReportDialog from '@/components/dashboard/ScheduleReportDialog'
import TOTPConfirmation from '@/components/dashboard/TOTPConfirmation'
import GoAmlFilingGuide from '@/components/dashboard/GoAmlFilingGuide'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'
import ToggleOnOutlinedIcon from '@mui/icons-material/ToggleOnOutlined'
import ToggleOffOutlinedIcon from '@mui/icons-material/ToggleOffOutlined'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined'
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined'
import SwapHorizOutlinedIcon from '@mui/icons-material/SwapHorizOutlined'
import PersonSearchOutlinedIcon from '@mui/icons-material/PersonSearchOutlined'
import AssignmentTurnedInOutlinedIcon from '@mui/icons-material/AssignmentTurnedInOutlined'
import { nfiuApi, type NfiuReport, type NfiuSchedule, type NfiuMetrics, type ReportType } from '@/api/nfiu'

// ── constants ─────────────────────────────────────────────────────────────────

const TYPE_META: Record<ReportType, { label: string; abbr: string; color: string; icon: React.ReactNode }> = {
  STR:        { label: 'Suspicious Transaction',  abbr: 'STR',  color: '#dc2626', icon: <DescriptionOutlinedIcon sx={{ fontSize: '0.9rem' }} /> },
  CTR:        { label: 'Currency Transaction',    abbr: 'CTR',  color: '#d97706', icon: <AccountBalanceOutlinedIcon sx={{ fontSize: '0.9rem' }} /> },
  SAR:        { label: 'Suspicious Activity',     abbr: 'SAR',  color: '#7c3aed', icon: <GavelOutlinedIcon sx={{ fontSize: '0.9rem' }} /> },
  ITF:        { label: 'Intl. Transfer Filing',   abbr: 'ITF',  color: '#0891b2', icon: <SwapHorizOutlinedIcon sx={{ fontSize: '0.9rem' }} /> },
  PEP:        { label: 'PEP Disclosure',          abbr: 'PEP',  color: '#be185d', icon: <PersonSearchOutlinedIcon sx={{ fontSize: '0.9rem' }} /> },
  AML_RETURN: { label: 'Monthly AML Return',      abbr: 'AMLR', color: '#15803d', icon: <AssignmentTurnedInOutlinedIcon sx={{ fontSize: '0.9rem' }} /> },
}

const STATUS_CFG: Record<string, { label: string; bg: string; color: string }> = {
  draft:        { label: 'Draft',        bg: '#f8fafc',  color: '#64748b' },
  filed:        { label: 'Filed',        bg: `${colorPalette.primary}12`, color: colorPalette.primary },
  acknowledged: { label: 'Acknowledged', bg: '#f0fdf4',  color: '#10b981' },
  rejected:     { label: 'Rejected',     bg: '#fef2f2',  color: '#dc2626' },
}

const PRIORITY_CFG: Record<string, { color: string }> = {
  high:   { color: '#dc2626' },
  medium: { color: '#d97706' },
  low:    { color: '#10b981' },
}

const TYPE_PILLS: Array<{ key: ReportType | 'all'; label: string; abbr: string; color: string; icon?: React.ReactNode }> = [
  { key: 'all',        label: 'All Reports',          abbr: 'All',  color: colorPalette.primary },
  { key: 'STR',        label: 'Suspicious Transaction', abbr: 'STR',  color: '#dc2626', icon: <DescriptionOutlinedIcon sx={{ fontSize: '0.75rem' }} /> },
  { key: 'CTR',        label: 'Currency Transaction',   abbr: 'CTR',  color: '#d97706', icon: <AccountBalanceOutlinedIcon sx={{ fontSize: '0.75rem' }} /> },
  { key: 'SAR',        label: 'Suspicious Activity',    abbr: 'SAR',  color: '#7c3aed', icon: <GavelOutlinedIcon sx={{ fontSize: '0.75rem' }} /> },
  { key: 'ITF',        label: 'Intl. Transfer Filing',  abbr: 'ITF',  color: '#0891b2', icon: <SwapHorizOutlinedIcon sx={{ fontSize: '0.75rem' }} /> },
  { key: 'PEP',        label: 'PEP Disclosure',         abbr: 'PEP',  color: '#be185d', icon: <PersonSearchOutlinedIcon sx={{ fontSize: '0.75rem' }} /> },
  { key: 'AML_RETURN', label: 'Monthly AML Return',     abbr: 'AML',  color: '#15803d', icon: <AssignmentTurnedInOutlinedIcon sx={{ fontSize: '0.75rem' }} /> },
]

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function daysUntil(iso: string) {
  const diff = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)
  if (diff < 0) return { label: 'Overdue', color: '#dc2626' }
  if (diff === 0) return { label: 'Due today', color: '#dc2626' }
  if (diff <= 7)  return { label: `${diff}d`, color: '#f59e0b' }
  return { label: `${diff}d`, color: '#64748b' }
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [typeFilter, setTypeFilter]     = useState<ReportType | 'all'>('all')
  const [showScheduled, setShowScheduled] = useState(false)
  const [fileOpen, setFileOpen]         = useState(false)
  const [schedOpen, setSchedOpen]   = useState(false)
  const [reports, setReports]       = useState<NfiuReport[]>([])
  const [schedules, setSchedules]   = useState<NfiuSchedule[]>([])
  const [metrics, setMetrics]       = useState<NfiuMetrics | null>(null)
  const [loading, setLoading]       = useState(true)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [viewReport, setViewReport] = useState<NfiuReport | null>(null)
  const [viewReadOnly, setViewReadOnly] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<NfiuReport | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'filed'>('all')
  const [goAmlTarget,  setGoAmlTarget]  = useState<NfiuReport | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [r, s, m] = await Promise.all([
        nfiuApi.listReports(),
        nfiuApi.listSchedules(),
        nfiuApi.getMetrics(),
      ])
      setReports(r.reports)
      setSchedules(s.schedules)
      setMetrics(m)
    } catch { /* ignore — backend may not be running in dev */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  async function deleteReport(id: number) {
    setDeletingId(id)
    try {
      await nfiuApi.deleteReport(id)
      setReports(prev => prev.filter(r => r.id !== id))
    } catch { /* ignore */ }
    finally { setDeletingId(null) }
  }

  function openReport(r: NfiuReport) {
    setViewReport(r)
    setViewReadOnly(r.status !== 'draft')
    setFileOpen(true)
  }

  async function toggleSchedule(s: NfiuSchedule) {
    try {
      const updated = await nfiuApi.updateSchedule(s.id, { isActive: !s.isActive })
      setSchedules(prev => prev.map(x => x.id === updated.id ? updated : x))
    } catch { /* ignore */ }
  }

  async function deleteSchedule(id: number) {
    try {
      await nfiuApi.deleteSchedule(id)
      setSchedules(prev => prev.filter(s => s.id !== id))
    } catch { /* ignore */ }
  }

  // Per-type counts (all reports, ignoring filters)
  const typeCounts = useMemo(() => {
    const c: Record<string, number> = { all: reports.length }
    reports.forEach(r => { c[r.reportType] = (c[r.reportType] ?? 0) + 1 })
    return c
  }, [reports])

  // Type-filtered subset
  const typeFiltered = useMemo(() =>
    typeFilter === 'all' ? reports : reports.filter(r => r.reportType === typeFilter),
  [reports, typeFilter])

  // Status counts within the type-filtered subset
  const statusCounts = useMemo(() => ({
    all:   typeFiltered.length,
    draft: typeFiltered.filter(r => r.status === 'draft').length,
    filed: typeFiltered.filter(r => r.status === 'filed' || r.status === 'acknowledged').length,
  }), [typeFiltered])

  // Final visible rows
  const visibleReports = useMemo(() => typeFiltered.filter(r => {
    if (statusFilter === 'draft') return r.status === 'draft'
    if (statusFilter === 'filed') return r.status === 'filed' || r.status === 'acknowledged'
    return true
  }), [typeFiltered, statusFilter])

  return (
    <>
      <Box sx={{ p: 4, maxWidth: 1200 }}>

        {/* ── Header ── */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
          <Box>
            <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: colorPalette.primary, letterSpacing: '0.14em', textTransform: 'uppercase', mb: 0.75 }}>
              Compliance
            </Typography>
            <Typography sx={{ fontSize: '1.625rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost', letterSpacing: '-0.015em', mb: 0.5 }}>
              NFIU Reports &amp; Filings
            </Typography>
            <Typography sx={{ fontSize: '0.9375rem', color: '#64748b' }}>
              STR · CTR · SAR · ITF · PEP · Monthly AML Return — audit-ready regulatory submissions
            </Typography>
          </Box>
          <Stack direction="row" gap={1.25}>
            {/* <Button onClick={() => setSchedOpen(true)}
              startIcon={<ScheduleRoundedIcon sx={{ fontSize: '1rem !important' }} />}
              sx={{ bgcolor: 'var(--card-bg)', color: 'var(--on-surface-variant)', border: '1px solid var(--border-col)', px: 2.25, py: 1.125, fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Jost', borderRadius: 0, textTransform: 'none', '&:hover': { bgcolor: 'var(--section-bg)' } }}>
              Schedule Report
            </Button> */}
            <Button onClick={() => { setViewReport(null); setViewReadOnly(false); setFileOpen(true) }}
              startIcon={<AddRoundedIcon sx={{ fontSize: '1rem !important' }} />}
              sx={{ bgcolor: colorPalette.primary, color: '#fff', px: 2.25, py: 1.125, fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Jost', borderRadius: 0, textTransform: 'none', boxShadow: 'none', '&:hover': { bgcolor: 'var(--on-surface)' } }}>
              File New Report
            </Button>
          </Stack>
        </Box>

        {/* ── KPI metrics ── */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 2, mb: 3 }}>
          {[
            { label: 'Filed (total)', value: metrics?.totalFiled ?? '—', sub: 'Filed + acknowledged' },
            { label: 'Acknowledged', value: metrics?.totalAcknowledged ?? '—', sub: 'NFIU accepted' },
            { label: 'Drafts',       value: metrics?.totalDraft ?? '—',       sub: 'Pending submission' },
            { label: 'Rejected',     value: metrics?.totalRejected ?? '—',    sub: 'Require re-filing' },
            { label: 'Filed this month', value: metrics?.filedThisMonth ?? '—', sub: 'Current period' },
            { label: 'Schedules due', value: metrics?.dueThisWeek ?? '—',    sub: 'Within 7 days', alert: (metrics?.dueThisWeek ?? 0) > 0 },
          ].map(s => (
            <Box
              key={s.label}
              data-ai-analyzable="true"
              data-ai-description={`Regulatory Reporting KPI: ${s.label}. current value: ${s.value}. status: ${s.sub}.`}
              sx={{ border: `1px solid ${s.alert ? '#fde68a' : 'var(--border-col)'}`, p: 2, bgcolor: s.alert ? '#fffbeb' : 'var(--card-bg)' }}>
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.5 }}>
                {s.label}
              </Typography>
              {loading ? (
                <CircularProgress size={18} sx={{ color: colorPalette.primary, my: 0.5 }} />
              ) : (
                <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: s.alert ? '#92400e' : '#00288e', fontFamily: 'Jost', lineHeight: 1, mb: 0.25 }}>
                  {s.value}
                </Typography>
              )}
              <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8' }}>{s.sub}</Typography>
            </Box>
          ))}
        </Box>

        {/* ── Report table ── */}
        <Box sx={{ bgcolor: 'var(--card-bg)', border: '1px solid var(--border-col)' }}>

          {/* ── Filter bar ── */}
          <Box sx={{ borderBottom: '1px solid var(--border-col)' }}>

            {/* Row 1: Type filter */}
            <Box sx={{ px: 2.5, pt: 1.25, pb: 0, display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'nowrap', overflowX: 'auto' }}>
              {TYPE_PILLS.map(p => {
                const count = typeCounts[p.key] ?? 0
                const active = !showScheduled && typeFilter === p.key
                return (
                  <Tooltip key={p.key} title={p.label}>
                    <Box
                      onClick={() => { setTypeFilter(p.key); setShowScheduled(false) }}
                      sx={{
                        display: 'flex', alignItems: 'center', gap: 0.625, flexShrink: 0,
                        px: 1.25, py: 0.625, cursor: 'pointer', userSelect: 'none',
                        border: `1px solid ${active ? p.color : '#e5e7eb'}`,
                        bgcolor: active ? `${p.color}10` : 'transparent',
                        transition: 'all 0.15s',
                        '&:hover': { borderColor: p.color, bgcolor: `${p.color}08` },
                      }}
                    >
                      {p.icon && (
                        <Box sx={{ color: active ? p.color : '#94a3b8', display: 'flex', '& svg': { fontSize: '0.75rem !important' } }}>
                          {p.icon}
                        </Box>
                      )}
                      <Typography sx={{ fontSize: '0.75rem', fontWeight: active ? 700 : 500, color: active ? p.color : '#64748b', fontFamily: 'Jost', letterSpacing: '0.02em' }}>
                        {p.abbr}
                      </Typography>
                      <Box sx={{ px: 0.625, minWidth: 18, textAlign: 'center', bgcolor: active ? p.color : 'var(--section-bg)', borderRadius: '10px' }}>
                        <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: active ? '#fff' : '#94a3b8', lineHeight: '16px' }}>
                          {count}
                        </Typography>
                      </Box>
                    </Box>
                  </Tooltip>
                )
              })}

              {/* Separator */}
              <Box sx={{ mx: 0.5, height: 20, width: '1px', bgcolor: '#e5e7eb', flexShrink: 0 }} />

              {/* Schedules pill */}
              <Tooltip title="Recurring schedules">
                <Box
                  onClick={() => setShowScheduled(true)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 0.625, flexShrink: 0,
                    px: 1.25, py: 0.625, cursor: 'pointer', userSelect: 'none',
                    border: `1px solid ${showScheduled ? '#64748b' : '#e5e7eb'}`,
                    bgcolor: showScheduled ? 'var(--section-bg)' : 'transparent',
                    transition: 'all 0.15s',
                    '&:hover': { borderColor: '#64748b', bgcolor: 'var(--section-bg)' },
                  }}
                >
                  <ScheduleRoundedIcon sx={{ fontSize: '0.75rem', color: showScheduled ? '#475569' : '#94a3b8' }} />
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: showScheduled ? 700 : 500, color: showScheduled ? '#475569' : '#64748b', fontFamily: 'Jost' }}>
                    Schedules
                  </Typography>
                  <Box sx={{ px: 0.625, minWidth: 18, textAlign: 'center', bgcolor: showScheduled ? '#475569' : 'var(--section-bg)', borderRadius: '10px' }}>
                    <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: showScheduled ? '#fff' : '#94a3b8', lineHeight: '16px' }}>
                      {schedules.length}
                    </Typography>
                  </Box>
                </Box>
              </Tooltip>
            </Box>

            {/* Row 2: Status segmented control (hidden on Schedules view) */}
            {!showScheduled && (
              <Box sx={{ px: 2.5, py: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em', flexShrink: 0 }}>
                  Status
                </Typography>
                <Box sx={{ display: 'flex', border: '1px solid #e5e7eb' }}>
                  {([
                    { value: 'all',   label: 'All',   count: statusCounts.all,   activeColor: colorPalette.primary, activeBg: `${colorPalette.primary}10` },
                    { value: 'draft', label: 'Draft', count: statusCounts.draft, activeColor: '#64748b',            activeBg: '#f1f5f9' },
                    { value: 'filed', label: 'Filed', count: statusCounts.filed, activeColor: colorPalette.primary, activeBg: `${colorPalette.primary}10` },
                  ] as const).map((opt, i) => {
                    const active = statusFilter === opt.value
                    return (
                      <Box
                        key={opt.value}
                        onClick={() => setStatusFilter(opt.value)}
                        sx={{
                          display: 'flex', alignItems: 'center', gap: 0.75,
                          px: 1.5, py: 0.5, cursor: 'pointer', userSelect: 'none',
                          borderRight: i < 2 ? '1px solid #e5e7eb' : 'none',
                          bgcolor: active ? opt.activeBg : 'var(--card-bg)',
                          transition: 'background 0.12s',
                          '&:hover': { bgcolor: active ? opt.activeBg : 'var(--section-bg)' },
                        }}
                      >
                        <Typography sx={{ fontSize: '0.75rem', fontWeight: active ? 700 : 500, color: active ? opt.activeColor : '#94a3b8', fontFamily: 'Jost', whiteSpace: 'nowrap' }}>
                          {opt.label}
                        </Typography>
                        <Box sx={{ px: 0.625, minWidth: 18, textAlign: 'center', bgcolor: active ? opt.activeColor : 'var(--section-bg)', borderRadius: '10px' }}>
                          <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: active ? '#fff' : '#94a3b8', lineHeight: '16px' }}>
                            {opt.count}
                          </Typography>
                        </Box>
                      </Box>
                    )
                  })}
                </Box>
              </Box>
            )}
          </Box>

          {/* Schedules view */}
          {showScheduled ? (
            <Box>
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress size={28} sx={{ color: colorPalette.primary }} />
                </Box>
              ) : schedules.length === 0 ? (
                <Box sx={{ px: 3, py: 4, textAlign: 'center' }}>
                  <ScheduleRoundedIcon sx={{ fontSize: '2rem', color: '#cbd5e1', mb: 1 }} />
                  <Typography sx={{ fontSize: '0.875rem', color: '#94a3b8' }}>No scheduled reports yet</Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: '#cbd5e1', mt: 0.25 }}>
                    Use "Schedule Report" to set up recurring filings
                  </Typography>
                </Box>
              ) : (
                <Box>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px 130px 100px 80px', gap: 2, px: 3, py: 1.25, bgcolor: 'var(--card-bg)', borderBottom: '1px solid var(--border-col)' }}>
                    {['Schedule name', 'Type', 'Frequency', 'Next due', 'Status', ''].map(h => (
                      <Typography key={h} sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{h}</Typography>
                    ))}
                  </Box>
                  {schedules.map((s, i) => {
                    const due = daysUntil(s.nextDue)
                    return (
                      <Box 
                        key={s.id} 
                        data-ai-analyzable="true"
                        data-ai-description={`Scheduled Report: ${s.name}. type: ${s.reportType}. frequency: ${s.frequency}. next due: ${new Date(s.nextDue).toLocaleDateString('en-GB')}. auto-file enabled: ${s.autoFile}.`}
                        sx={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px 130px 100px 80px', gap: 2, px: 3, py: 1.75, alignItems: 'center', borderBottom: i < schedules.length - 1 ? '1px solid var(--border-col)' : 'none', '&:hover': { bgcolor: 'var(--section-bg)' } }}>
                        <Box>
                          <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--heading-color)' }}>{s.name}</Typography>
                          {s.autoFile && <Typography sx={{ fontSize: '0.625rem', color: colorPalette.primary, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Auto-file</Typography>}
                        </Box>
                        <Chip label={TYPE_META[s.reportType]?.abbr ?? s.reportType} size="small"
                          sx={{ borderRadius: 0, height: 20, fontSize: '0.625rem', fontWeight: 700, bgcolor: `${TYPE_META[s.reportType]?.color}14`, color: TYPE_META[s.reportType]?.color, width: 'fit-content' }} />
                        <Typography sx={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)', textTransform: 'capitalize' }}>{s.frequency}</Typography>
                        <Box>
                          <Typography sx={{ fontSize: '0.8125rem', color: 'var(--heading-color)', fontFamily: 'SF Mono, Monaco, monospace' }}>
                            {new Date(s.nextDue).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </Typography>
                          <Typography sx={{ fontSize: '0.6875rem', color: due.color, fontWeight: 600 }}>{due.label}</Typography>
                        </Box>
                        <Chip label={s.isActive ? 'Active' : 'Paused'} size="small"
                          sx={{ borderRadius: 0, height: 20, fontSize: '0.625rem', fontWeight: 700, bgcolor: s.isActive ? '#f0fdf4' : '#f8fafc', color: s.isActive ? '#10b981' : '#94a3b8', width: 'fit-content' }} />
                        <Stack direction="row" gap={0.5}>
                          <Tooltip title={s.isActive ? 'Pause' : 'Activate'}>
                            <IconButton size="small" onClick={() => toggleSchedule(s)} sx={{ borderRadius: 0, color: s.isActive ? colorPalette.primary : '#94a3b8', '&:hover': { color: colorPalette.primary } }}>
                              {s.isActive ? <ToggleOnOutlinedIcon sx={{ fontSize: '1.125rem' }} /> : <ToggleOffOutlinedIcon sx={{ fontSize: '1.125rem' }} />}
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton size="small" onClick={() => deleteSchedule(s.id)} sx={{ borderRadius: 0, color: '#94a3b8', '&:hover': { color: '#dc2626' } }}>
                              <DeleteOutlineRoundedIcon sx={{ fontSize: '1rem' }} />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </Box>
                    )
                  })}
                </Box>
              )}
            </Box>

          /* Reports list */
          ) : (
            <Box>
              {/* Table header */}
              <Box sx={{ display: 'grid', gridTemplateColumns: '140px 100px 1fr 130px 140px 120px 36px', gap: 2, px: 3, py: 1.25, bgcolor: 'var(--card-bg)', borderBottom: '1px solid var(--border-col)' }}>
                {['Reference', 'Type', 'Title / Subject', 'Status', 'Filed', 'Amount', ''].map(h => (
                  <Typography key={h} sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{h}</Typography>
                ))}
              </Box>

              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress size={28} sx={{ color: colorPalette.primary }} />
                </Box>
              ) : visibleReports.length === 0 ? (
                <Box sx={{ px: 3, py: 4, textAlign: 'center' }}>
                  <DescriptionOutlinedIcon sx={{ fontSize: '2rem', color: '#cbd5e1', mb: 1 }} />
                  <Typography sx={{ fontSize: '0.875rem', color: '#94a3b8' }}>No reports found</Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: '#cbd5e1', mt: 0.25 }}>
                    Use "File New Report" to submit a report to NFIU
                  </Typography>
                </Box>
              ) : visibleReports.map((r, i) => {
                const typeMeta   = TYPE_META[r.reportType]
                const statusCfg  = STATUS_CFG[r.status] ?? STATUS_CFG.draft
                const priorColor = PRIORITY_CFG[r.priority]?.color ?? '#64748b'
                return (
                  <Box
                    key={r.id}
                    data-ai-analyzable="true"
                    data-ai-description={`NFIU Report Filing: ${r.reference}. type: ${r.reportType}. status: ${r.status.toUpperCase()}. priority: ${r.priority.toUpperCase()}. title: ${r.title}.${r.subjectName ? ' subject: ' + r.subjectName : ''}.${r.filingDate ? ' filed on: ' + fmtDate(r.filingDate) : ' not yet filed.'}`}
                    onClick={() => openReport(r)}
                    sx={{ display: 'grid', gridTemplateColumns: '140px 100px 1fr 130px 140px 120px 36px', gap: 2, px: 3, py: 1.75, alignItems: 'center', borderBottom: i < visibleReports.length - 1 ? '1px solid var(--border-col)' : 'none', cursor: 'pointer', '&:hover': { bgcolor: '#f0f4ff' } }}>

                    {/* Reference */}
                    <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'SF Mono, Monaco, monospace' }}>
                      {r.reference}
                    </Typography>

                    {/* Type */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Box sx={{ color: typeMeta.color }}>{typeMeta.icon}</Box>
                      <Chip label={typeMeta.abbr} size="small"
                        sx={{ borderRadius: 0, height: 20, fontSize: '0.625rem', fontWeight: 700, bgcolor: `${typeMeta.color}14`, color: typeMeta.color, width: 'fit-content' }} />
                    </Box>

                    {/* Title / subject */}
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--heading-color)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.title}
                      </Typography>
                      {r.subjectName && (
                        <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.subjectName}{r.subjectAccount ? ` · ${r.subjectAccount}` : ''}
                        </Typography>
                      )}
                    </Box>

                    {/* Status + priority */}
                    <Box>
                      <Chip label={statusCfg.label} size="small"
                        sx={{ borderRadius: 0, height: 20, fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase', bgcolor: statusCfg.bg, color: statusCfg.color, width: 'fit-content' }} />
                      <Typography sx={{ fontSize: '0.625rem', color: priorColor, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', mt: 0.375 }}>
                        {r.priority}
                      </Typography>
                    </Box>

                    {/* Filed date */}
                    <Typography sx={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', fontFamily: 'SF Mono, Monaco, monospace' }}>
                      {r.filingDate ? fmtDate(r.filingDate) : <span style={{ color: '#94a3b8' }}>Not filed</span>}
                    </Typography>

                    {/* Amount */}
                    <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost' }}>
                      {r.amountNgn != null ? `₦${r.amountNgn.toLocaleString()}` : '—'}
                    </Typography>

                    {/* Actions */}
                    <Box sx={{ display: 'flex', gap: 0.25 }} onClick={e => e.stopPropagation()}>
                      {r.status === 'draft' ? (
                        <Tooltip title="Delete draft (requires TOTP)">
                          <IconButton size="small" disabled={deletingId === r.id} onClick={() => setDeleteTarget(r)}
                            sx={{ borderRadius: 0, color: '#94a3b8', '&:hover': { color: '#dc2626' } }}>
                            {deletingId === r.id ? <CircularProgress size={12} /> : <DeleteOutlineRoundedIcon sx={{ fontSize: '1rem' }} />}
                          </IconButton>
                        </Tooltip>
                      ) : (
                        <Tooltip title="Download goAML XML for NFIU portal">
                          <IconButton size="small" onClick={() => setGoAmlTarget(r)}
                            sx={{ borderRadius: 0, color: '#94a3b8', '&:hover': { color: colorPalette.primary } }}>
                            <FileDownloadOutlinedIcon sx={{ fontSize: '1rem' }} />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </Box>
                )
              })}
            </Box>
          )}
        </Box>

      <FileReportDialog
        open={fileOpen}
        onClose={() => { setFileOpen(false); setViewReport(null) }}
        onFiled={report => {
          setReports(prev => {
            const idx = prev.findIndex(r => r.id === report.id)
            return idx >= 0 ? prev.map(r => r.id === report.id ? report : r) : [report, ...prev]
          })
          loadData()
        }}
        initialReport={viewReport ?? undefined}
        readOnly={viewReadOnly}
      />

      <ScheduleReportDialog
        open={schedOpen}
        onClose={() => setSchedOpen(false)}
        onCreated={s => setSchedules(prev => [...prev, s])}
      />

      <TOTPConfirmation
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          const r = deleteTarget!
          setDeleteTarget(null)
          deleteReport(r.id)
        }}
        operation="delete"
        title="Delete Draft Report"
        description="This will permanently delete the draft. This action cannot be undone and is audit-logged."
        resourceType="NFIU Draft Report"
        resourceName={deleteTarget?.title ?? ''}
        itemsAffected={deleteTarget ? [`Ref: ${deleteTarget.reference}`, `Type: ${deleteTarget.reportType}`, `Created: ${fmtDate(deleteTarget.createdAt)}`] : []}
      />

      <GoAmlFilingGuide
        open={goAmlTarget !== null}
        report={goAmlTarget}
        onClose={() => setGoAmlTarget(null)}
      />
      </Box>
    </>
  )
}
