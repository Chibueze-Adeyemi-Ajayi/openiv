import {
  Box, Typography, Stack, Button, Chip, IconButton, CircularProgress, Tooltip,
} from '@mui/material'
import { colorPalette } from '@/theme'
import DashboardLayout from '@/components/dashboard/DashboardLayout'
import FileReportDialog from '@/components/dashboard/FileReportDialog'
import ScheduleReportDialog from '@/components/dashboard/ScheduleReportDialog'
import { useState, useEffect, useCallback } from 'react'
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

const TABS = ['All', 'STR', 'CTR', 'SAR', 'ITF', 'PEP', 'AML_RETURN', 'Draft', 'Scheduled'] as const
type Tab = typeof TABS[number]

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
  const [tab, setTab]           = useState<Tab>('All')
  const [fileOpen, setFileOpen] = useState(false)
  const [schedOpen, setSchedOpen] = useState(false)
  const [reports, setReports]   = useState<NfiuReport[]>([])
  const [schedules, setSchedules] = useState<NfiuSchedule[]>([])
  const [metrics, setMetrics]   = useState<NfiuMetrics | null>(null)
  const [loading, setLoading]   = useState(true)
  const [deletingId, setDeletingId] = useState<number | null>(null)

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

  // Filtered report list
  const visibleReports = reports.filter(r => {
    if (tab === 'All')       return true
    if (tab === 'Draft')     return r.status === 'draft'
    if (tab === 'Scheduled') return false
    return r.reportType === tab
  })

  return (
    <DashboardLayout>
      <Box sx={{ p: 4, maxWidth: 1200 }}>

        {/* ── Header ── */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
          <Box>
            <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: colorPalette.primary, letterSpacing: '0.14em', textTransform: 'uppercase', mb: 0.75 }}>
              Compliance
            </Typography>
            <Typography sx={{ fontSize: '1.625rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost', letterSpacing: '-0.015em', mb: 0.5 }}>
              NFIU Reports &amp; Filings
            </Typography>
            <Typography sx={{ fontSize: '0.9375rem', color: '#64748b' }}>
              STR · CTR · SAR · ITF · PEP · Monthly AML Return — audit-ready regulatory submissions
            </Typography>
          </Box>
          <Stack direction="row" gap={1.25}>
            <Button onClick={() => setSchedOpen(true)}
              startIcon={<ScheduleRoundedIcon sx={{ fontSize: '1rem !important' }} />}
              sx={{ bgcolor: '#fff', color: '#475569', border: '1px solid #e5e7eb', px: 2.25, py: 1.125, fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Jost', borderRadius: 0, textTransform: 'none', '&:hover': { bgcolor: '#f8fafc' } }}>
              Schedule Report
            </Button>
            <Button onClick={() => setFileOpen(true)}
              startIcon={<AddRoundedIcon sx={{ fontSize: '1rem !important' }} />}
              sx={{ bgcolor: colorPalette.primary, color: '#fff', px: 2.25, py: 1.125, fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Jost', borderRadius: 0, textTransform: 'none', boxShadow: 'none', '&:hover': { bgcolor: '#1a3896' } }}>
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
              sx={{ border: `1px solid ${s.alert ? '#fde68a' : '#eef0f4'}`, p: 2, bgcolor: s.alert ? '#fffbeb' : '#fff' }}>
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.5 }}>
                {s.label}
              </Typography>
              {loading ? (
                <CircularProgress size={18} sx={{ color: colorPalette.primary, my: 0.5 }} />
              ) : (
                <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: s.alert ? '#92400e' : '#0f172a', fontFamily: 'Jost', lineHeight: 1, mb: 0.25 }}>
                  {s.value}
                </Typography>
              )}
              <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8' }}>{s.sub}</Typography>
            </Box>
          ))}
        </Box>

        {/* ── Report table ── */}
        <Box sx={{ bgcolor: '#fff', border: '1px solid #eef0f4' }}>
          {/* Tabs + actions */}
          <Box sx={{ px: 3, py: 0, borderBottom: '1px solid #eef0f4', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Stack direction="row" gap={0}>
              {TABS.map(t => (
                <Box 
                  key={t} 
                  onClick={() => setTab(t)} 
                  data-ai-analyzable="true"
                  data-ai-description={`Filter reports by category: ${t === 'AML_RETURN' ? 'AML Return' : t}.`}
                  sx={{
                  px: 1.75, py: 1.75, fontSize: '0.8125rem', fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'Jost',
                  color: tab === t ? colorPalette.primary : '#64748b',
                  borderBottom: tab === t ? `2px solid ${colorPalette.primary}` : '2px solid transparent',
                  transition: 'all 0.15s',
                  '&:hover': { color: colorPalette.primary },
                }}>
                  {t === 'AML_RETURN' ? 'AML Return' : t}
                  {t === 'Draft' && metrics && metrics.totalDraft > 0 && (
                    <Box component="span" sx={{ ml: 0.75, px: 0.75, py: 0.125, bgcolor: '#fef2f2', color: '#dc2626', fontSize: '0.625rem', fontWeight: 700, borderRadius: '10px' }}>
                      {metrics.totalDraft}
                    </Box>
                  )}
                </Box>
              ))}
            </Stack>
          </Box>

          {/* Schedules tab */}
          {tab === 'Scheduled' ? (
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
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px 130px 100px 80px', gap: 2, px: 3, py: 1.25, bgcolor: '#fafbfc', borderBottom: '1px solid #eef0f4' }}>
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
                        sx={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px 130px 100px 80px', gap: 2, px: 3, py: 1.75, alignItems: 'center', borderBottom: i < schedules.length - 1 ? '1px solid #f4f5f7' : 'none', '&:hover': { bgcolor: '#fafbfc' } }}>
                        <Box>
                          <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a' }}>{s.name}</Typography>
                          {s.autoFile && <Typography sx={{ fontSize: '0.625rem', color: colorPalette.primary, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Auto-file</Typography>}
                        </Box>
                        <Chip label={TYPE_META[s.reportType]?.abbr ?? s.reportType} size="small"
                          sx={{ borderRadius: 0, height: 20, fontSize: '0.625rem', fontWeight: 700, bgcolor: `${TYPE_META[s.reportType]?.color}14`, color: TYPE_META[s.reportType]?.color, width: 'fit-content' }} />
                        <Typography sx={{ fontSize: '0.8125rem', color: '#475569', textTransform: 'capitalize' }}>{s.frequency}</Typography>
                        <Box>
                          <Typography sx={{ fontSize: '0.8125rem', color: '#0f172a', fontFamily: 'SF Mono, Monaco, monospace' }}>
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
              <Box sx={{ display: 'grid', gridTemplateColumns: '140px 100px 1fr 130px 140px 120px 36px', gap: 2, px: 3, py: 1.25, bgcolor: '#fafbfc', borderBottom: '1px solid #eef0f4' }}>
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
                    sx={{ display: 'grid', gridTemplateColumns: '140px 100px 1fr 130px 140px 120px 36px', gap: 2, px: 3, py: 1.75, alignItems: 'center', borderBottom: i < visibleReports.length - 1 ? '1px solid #f4f5f7' : 'none', '&:hover': { bgcolor: '#fafbfc' } }}>

                    {/* Reference */}
                    <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#0f172a', fontFamily: 'SF Mono, Monaco, monospace' }}>
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
                      <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
                    <Typography sx={{ fontSize: '0.75rem', color: '#475569', fontFamily: 'SF Mono, Monaco, monospace' }}>
                      {r.filingDate ? fmtDate(r.filingDate) : <span style={{ color: '#94a3b8' }}>Not filed</span>}
                    </Typography>

                    {/* Amount */}
                    <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
                      {r.amountNgn != null ? `₦${r.amountNgn.toLocaleString()}` : '—'}
                    </Typography>

                    {/* Actions */}
                    <Box sx={{ display: 'flex', gap: 0.25 }}>
                      {r.status === 'draft' ? (
                        <Tooltip title="Delete draft">
                          <IconButton size="small" disabled={deletingId === r.id} onClick={() => deleteReport(r.id)}
                            sx={{ borderRadius: 0, color: '#94a3b8', '&:hover': { color: '#dc2626' } }}>
                            {deletingId === r.id ? <CircularProgress size={12} /> : <DeleteOutlineRoundedIcon sx={{ fontSize: '1rem' }} />}
                          </IconButton>
                        </Tooltip>
                      ) : (
                        <Tooltip title="Download">
                          <IconButton size="small" sx={{ borderRadius: 0, color: '#94a3b8', '&:hover': { color: colorPalette.primary } }}>
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
      </Box>

      <FileReportDialog
        open={fileOpen}
        onClose={() => setFileOpen(false)}
        onFiled={report => {
          setReports(prev => [report, ...prev])
          loadData()
        }}
      />

      <ScheduleReportDialog
        open={schedOpen}
        onClose={() => setSchedOpen(false)}
        onCreated={s => setSchedules(prev => [...prev, s])}
      />
    </DashboardLayout>
  )
}
