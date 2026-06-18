import { Box, Typography, Stack, Grid, Button, Snackbar, Alert, CircularProgress } from '@mui/material'
import { colorPalette } from '@/theme'
import MetricCard from '@/components/dashboard/MetricCard'
import NigeriaRiskMap from '@/components/dashboard/NigeriaRiskMap'
import TransactionFlowChart from '@/components/dashboard/TransactionFlowChart'
import ActivityFeed from '@/components/dashboard/ActivityFeed'
import FileReportDialog from '@/components/dashboard/FileReportDialog'
import { useState, useCallback, useEffect } from 'react'
import { useDashboardData } from '@/hooks/useDashboardData'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { customerApi, type Customer } from '@/api/customers'
import { caseApi, type Case, type CasePriority, type CaseStatus } from '@/api/cases'
import { nfiuApi, type NfiuReport, type ReportType } from '@/api/nfiu'
import { useAiEnabled } from '@/hooks/useAiEnabled'
import { useNavigate } from 'react-router-dom'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined'
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined'
import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'
import ArrowForwardOutlinedIcon from '@mui/icons-material/ArrowForwardOutlined'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'

function pct(a: number, b: number) {
  if (b === 0) return 0
  return Math.round(((a - b) / b) * 100)
}

function fmt(n: number) {
  return n.toLocaleString('en-US')
}

function overallScore(c: Customer) {
  return Math.round(c.riskScore * 0.20 + c.riskProfileScore * 0.55 + c.transactionRiskScore * 0.25)
}

function scoreColor(score: number) {
  if (score > 85) return '#dc2626'
  return '#f59e0b'
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase()
}

const PRIORITY_COLOR: Record<CasePriority, string> = {
  critical: '#dc2626',
  high:     '#f59e0b',
  medium:   '#3b82f6',
  low:      '#94a3b8',
}

const STATUS_LABEL: Record<CaseStatus, string> = {
  open:            'Open',
  investigating:   'Investigating',
  escalated:       'Escalated',
  pending_review:  'Pending Review',
  closed:          'Closed',
}

const STATUS_COLOR: Record<CaseStatus, string> = {
  escalated:       '#dc2626',
  investigating:   '#7c3aed',
  open:            '#2563eb',
  pending_review:  '#f59e0b',
  closed:          '#94a3b8',
}

const REPORT_TYPE_COLOR: Record<ReportType, string> = {
  STR:        '#dc2626',
  SAR:        '#ea580c',
  CTR:        '#2563eb',
  AML_RETURN: '#16a34a',
  PEP:        '#7c3aed',
  ITF:        '#64748b',
}

const REPORT_STATUS: Record<string, { bg: string; text: string }> = {
  draft:            { bg: '#f1f5f9', text: '#64748b' },
  pending_approval: { bg: '#fef3c7', text: '#92400e' },
  filed:            { bg: '#dbeafe', text: '#1e40af' },
  acknowledged:     { bg: '#dcfce7', text: '#166534' },
  rejected:         { bg: '#fee2e2', text: '#991b1b' },
}

function slaChip(deadline: string) {
  const diff = new Date(deadline).getTime() - Date.now()
  const days = diff / (1000 * 60 * 60 * 24)
  if (diff < 0)  return { label: 'Overdue',   color: '#dc2626', warn: true }
  if (days < 1)  return { label: 'Due today', color: '#f59e0b', warn: true }
  if (days < 3)  return { label: `${Math.ceil(days)}d left`, color: '#f59e0b', warn: false }
  return           { label: `${Math.ceil(days)}d left`,  color: '#94a3b8', warn: false }
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function MiniRiskDonut({ score, color }: { score: number; color: string }) {
  const size = 48, sw = 5, r = (size - sw) / 2
  const cx = size / 2, cy = size / 2
  const circ = 2 * Math.PI * r
  const filled = (Math.min(100, Math.max(0, score)) / 100) * circ
  return (
    <svg width={size} height={size} style={{ display: 'block', flexShrink: 0 }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--section-bg)" strokeWidth={sw} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={sw}
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circ - filled}`}
        transform={`rotate(-90 ${cx} ${cy})`} />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
        fill={color} fontWeight="700" fontSize="12" fontFamily="Jost, sans-serif">
        {score}
      </text>
    </svg>
  )
}

function CustomerPhoto({ photo, color, name }: { photo: string | null; color: string; name: string }) {
  return (
    <Box sx={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', bgcolor: color + '18', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {photo
        ? <Box component="img"
            src={photo.startsWith('data:') || photo.startsWith('http') ? photo : `data:image/jpeg;base64,${photo}`}
            sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color, fontFamily: 'Jost' }}>{initials(name)}</Typography>
      }
    </Box>
  )
}

export default function OverviewPage() {
  const navigate = useNavigate()
  const [fileNFIUOpen, setFileNFIUOpen] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)
  const [snack, setSnack] = useState<{ msg: string; sev: 'success' | 'error' } | null>(null)
  const [topHighRisk, setTopHighRisk] = useState<Customer[]>([])
  const [urgentCases, setUrgentCases] = useState<Case[]>([])
  const [recentReports, setRecentReports] = useState<NfiuReport[]>([])
  const { stats, activity, beamEvents, caseEvents, connected } = useDashboardData()
  const currentUser = useCurrentUser()
  const isAiEnabled = useAiEnabled()

  useEffect(() => {
    customerApi.highRisk(1, 15).then(data => setTopHighRisk(data.customers)).catch(() => {})
  }, [])

  useEffect(() => {
    caseApi.list({ pageSize: 20 }).then(data => {
      const priorityOrder: Record<CasePriority, number> = { critical: 0, high: 1, medium: 2, low: 3 }
      const sorted = data.cases
        .filter(c => c.status !== 'closed')
        .sort((a, b) => (priorityOrder[a.priority] - priorityOrder[b.priority]) || (b.riskScore - a.riskScore))
        .slice(0, 5)
      setUrgentCases(sorted)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    nfiuApi.listReports().then(data => {
      const sorted = [...data.reports]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5)
      setRecentReports(sorted)
    }).catch(() => {})
  }, [])

  // Combine all events into unified activity feed (most recent first)
  const allActivity = [
    ...activity,
    ...beamEvents,
    ...caseEvents,
  ].sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()).slice(0, 50)

  const transactionsToday = stats?.totalToday ?? null
  const flaggedToday = stats?.flaggedToday ?? null
  const openCasesToday = stats?.openCasesToday ?? null
  const complianceScore = stats
    ? Math.max(0, 100 - (stats.totalToday > 0 ? (stats.flaggedToday / stats.totalToday) * 100 : 0)).toFixed(1) + '%'
    : null

  const txnTrend = stats ? pct(stats.totalToday, stats.totalYesterday) : 0
  const flaggedTrend = stats ? pct(stats.flaggedToday, stats.flaggedYesterday) : 0

  console.log('[OverviewPage] stats:', stats, 'computed values:', { transactionsToday, flaggedToday, openCasesToday, complianceScore })

  const handleExport = useCallback(async () => {
    setExportLoading(true)
    try {
      const to = new Date().toISOString()
      const from = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const res = await fetch(
        `/api/v1/dashboard/export?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
        { credentials: 'include' }
      )
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `openiv-report-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setSnack({ msg: 'Export failed. Please try again.', sev: 'error' })
    } finally {
      setExportLoading(false)
    }
  }, [])

  return (
    <>
      <Box sx={{ p: 4 }}>
        {/* Page Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
          <Box>
            <Typography
              sx={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                color: colorPalette.primary,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                mb: 0.75,
              }}
            >
              Compliance Operations
            </Typography>
            <Typography sx={{ fontSize: '1.625rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost', letterSpacing: '-0.015em', mb: 0.5 }}>
              Good morning, {currentUser?.firstName ?? '…'}
            </Typography>
            <Typography sx={{ fontSize: '0.9375rem', color: '#64748b' }}>
              Here's what needs your attention today — {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </Typography>
          </Box>

          <Stack direction="row" gap={1.25}>
            {/* <Button
              onClick={handleExport}
              disabled={exportLoading}
              data-ai-analyzable="true"
              data-ai-description="Generates a comprehensive CSV report of the last 24 hours of compliance activity and transaction metrics."
              startIcon={exportLoading
                ? <CircularProgress size={14} thickness={5} sx={{ color: 'inherit' }} />
                : <FileDownloadOutlinedIcon sx={{ fontSize: '1rem !important' }} />}
              sx={{
                bgcolor: 'var(--card-bg)',
                color: 'var(--on-surface-variant)',
                border: '1px solid var(--border-col)',
                px: 2.25,
                py: 1.125,
                fontSize: '0.8125rem',
                fontWeight: 600,
                fontFamily: 'Jost',
                borderRadius: 0,
                textTransform: 'none',
                transition: 'all 0.18s',
                '&:hover:not(:disabled)': { bgcolor: 'var(--section-bg)', borderColor: '#cbd5e1' },
                '&:disabled': { opacity: 0.6 },
              }}
            >
              {exportLoading ? 'Exporting…' : 'Export Report'}
            </Button> */}
            <Button
              onClick={() => setFileNFIUOpen(true)}
              data-ai-analyzable="true"
              data-ai-description="Submits the daily suspicious activity report (SAR) to the Nigerian Financial Intelligence Unit (NFIU) for regulatory compliance."
              sx={{
                bgcolor: colorPalette.primary,
                color: '#ffffff',
                px: 2.25,
                py: 1.125,
                fontSize: '0.8125rem',
                fontWeight: 600,
                fontFamily: 'Jost',
                borderRadius: 0,
                textTransform: 'none',
                boxShadow: 'none',
                transition: 'all 0.18s',
                '&:hover:not(:disabled)': { bgcolor: 'var(--on-surface)', boxShadow: `0 4px 12px ${colorPalette.primary}30` },
                '&:disabled': { opacity: 0.6 },
              }}
            >
              File NFIU Return
            </Button>
          </Stack>
        </Box>

        {/* KPI Row */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <MetricCard
              label="Transactions Today"
              value={transactionsToday !== null ? fmt(transactionsToday) : '—'}
              trend={txnTrend}
              trendLabel="vs yesterday"
              icon={<ReceiptLongOutlinedIcon sx={{ fontSize: '1.125rem' }} />}
              sparkline={[40, 45, 38, 50, 60, 55, 70, 65, 80, 75, 90, 85]}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <MetricCard
              label="Flagged for Review"
              value={flaggedToday !== null ? fmt(flaggedToday) : '—'}
              trend={flaggedTrend}
              trendLabel="vs yesterday"
              invertTrend
              icon={<FlagOutlinedIcon sx={{ fontSize: '1.125rem' }} />}
              sparkline={[20, 25, 30, 28, 35, 40, 45, 50, 48, 55, 60, 58]}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <MetricCard
              label="Cases Opened Today"
              value={openCasesToday !== null ? fmt(openCasesToday) : '—'}
              trend={0}
              trendLabel="opened today"
              invertTrend
              icon={<GavelOutlinedIcon sx={{ fontSize: '1.125rem' }} />}
              sparkline={[50, 48, 45, 42, 40, 38, 36, 35, 34, 34, 34, 34]}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <MetricCard
              label="Compliance Score"
              value={complianceScore ?? '—'}
              trend={0}
              trendLabel="today"
              icon={<VerifiedOutlinedIcon sx={{ fontSize: '1.125rem' }} />}
              sparkline={[92, 93, 94, 95, 96, 96, 97, 97, 97, 98, 98, 98]}
            />
          </Grid>
        </Grid>

        {/* Map + High-Risk Customers */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, lg: 8 }}>
            <NigeriaRiskMap />
          </Grid>
          <Grid size={{ xs: 12, lg: 4 }}>
            {/* High-Risk Customers panel */}
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', border: '1px solid var(--card-border-col)', bgcolor: 'var(--card-bg)' }}>
              <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid var(--border-col)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    Risk Map · Watchlist
                  </Typography>
                  <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--on-surface)', fontFamily: 'Jost' }}>
                    High-Risk Customers
                  </Typography>
                </Box>
                <Button
                  onClick={() => navigate('/dashboard/customers?filter=high-risk')}
                  endIcon={<ArrowForwardOutlinedIcon sx={{ fontSize: '0.75rem !important' }} />}
                  sx={{ fontFamily: 'Jost', fontWeight: 600, fontSize: '0.75rem', textTransform: 'none', color: colorPalette.primary, p: 0 }}
                >
                  View All
                </Button>
              </Box>
              {topHighRisk.length === 0 ? (
                <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', py: 4 }}>
                  <Typography sx={{ fontSize: '0.875rem', color: '#94a3b8' }}>No high-risk customers</Typography>
                </Box>
              ) : (
                <Box sx={{ flex: 1, overflowY: 'auto' }}>
                  {topHighRisk.map((c, i) => {
                    const score = overallScore(c)
                    const color = scoreColor(score)
                    return (
                      <Box
                        key={c.id}
                        onClick={() => navigate(`/dashboard/users/${c.externalId}`)}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.5,
                          px: 2,
                          py: 1.25,
                          bgcolor: i % 2 === 0 ? 'var(--card-bg)' : 'var(--card-bg)',
                          borderBottom: '1px solid var(--border-col)',
                          cursor: 'pointer',
                          '&:hover': { bgcolor: 'var(--section-bg)' },
                        }}
                      >
                        <CustomerPhoto photo={c.photo} color={color} name={c.name} />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--on-surface)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {c.name}
                          </Typography>
                          <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {c.externalId}{c.accountNumber ? ` · ${c.accountNumber}` : ''}
                          </Typography>
                        </Box>
                        <MiniRiskDonut score={score} color={color} />
                      </Box>
                    )
                  })}
                </Box>
              )}
            </Box>
          </Grid>
        </Grid>

        {/* 24h Transaction Flow + Live Activity */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, lg: 8 }} sx={{ height: { xs: 'auto', lg: 420 } }}>
            <TransactionFlowChart />
          </Grid>
          <Grid size={{ xs: 12, lg: 4 }} sx={{ height: { xs: 'auto', lg: 420 } }}>
            <ActivityFeed events={allActivity} connected={connected} />
          </Grid>
        </Grid>

        {/* Urgent Cases + Recent Reports */}
        <Grid container spacing={2} sx={{ mb: 3 }}>

          {/* ── Top 5 Urgent AML Cases ───────────────────────────────────────── */}
          <Grid size={{ xs: 12, lg: 7 }}>
            <Box sx={{ border: '1px solid var(--card-border-col)', bgcolor: 'var(--card-bg)', display: 'flex', flexDirection: 'column' }}>
              {/* Header */}
              <Box sx={{ px: 2.5, py: 1.75, borderBottom: '1px solid var(--border-col)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 0.25 }}>
                    AML Cases · Priority Queue
                  </Typography>
                  <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'var(--on-surface)', fontFamily: 'Jost', lineHeight: 1.2 }}>
                    Top 5 Urgent Cases
                  </Typography>
                </Box>
                <Button
                  onClick={() => navigate('/dashboard/cases')}
                  endIcon={<ArrowForwardOutlinedIcon sx={{ fontSize: '0.75rem !important' }} />}
                  sx={{ fontFamily: 'Jost', fontWeight: 600, fontSize: '0.75rem', textTransform: 'none', color: colorPalette.primary, p: 0, minWidth: 0 }}
                >
                  View All
                </Button>
              </Box>

              {/* Rows */}
              {urgentCases.length === 0 ? (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 5 }}>
                  <Typography sx={{ fontSize: '0.875rem', color: '#cbd5e1' }}>No active cases</Typography>
                </Box>
              ) : urgentCases.map((c, i) => {
                const sla = slaChip(c.slaDeadline)
                const pColor = PRIORITY_COLOR[c.priority]
                const sColor = STATUS_COLOR[c.status]
                return (
                  <Box
                    key={c.id}
                    onClick={() => navigate(`/dashboard/cases/${c.id}`)}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 2,
                      pl: 0, pr: 2.5, py: 1.625,
                      borderLeft: `3px solid ${pColor}`,
                      borderBottom: i < urgentCases.length - 1 ? '1px solid #f8fafc' : 'none',
                      cursor: 'pointer',
                      transition: 'background 0.14s',
                      '&:hover': { bgcolor: 'var(--section-bg)' },
                    }}
                  >
                    {/* Left accent spacer */}
                    <Box sx={{ width: 20, flexShrink: 0 }} />

                    {/* Main content */}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      {/* Badges */}
                      <Box sx={{ display: 'flex', gap: 0.625, mb: 0.5, alignItems: 'center' }}>
                        <Box sx={{ bgcolor: pColor + '15', color: pColor, px: 0.875, py: 0.2, borderRadius: '3px', fontSize: '0.5625rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em', lineHeight: 1.6 }}>
                          {c.priority}
                        </Box>
                        <Box sx={{ color: sColor, fontSize: '0.5625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', lineHeight: 1.6 }}>
                          · {STATUS_LABEL[c.status]}
                        </Box>
                      </Box>
                      {/* Title */}
                      <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--on-surface)', fontFamily: 'Jost', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.35, mb: 0.25 }}>
                        {c.title}
                      </Typography>
                      {/* Customer + typology */}
                      <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.customerName ? `${c.customerName} · ` : ''}{c.typology}
                      </Typography>
                    </Box>

                    {/* Right meta */}
                    <Box sx={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.625 }}>
                      {/* Risk score pill */}
                      <Box sx={{ bgcolor: pColor + '12', border: `1.5px solid ${pColor}40`, borderRadius: '20px', px: 1, py: 0.25, display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 36 }}>
                        <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: pColor, lineHeight: 1 }}>{c.riskScore}</Typography>
                      </Box>
                      {/* SLA */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.375 }}>
                        {sla.warn && <WarningAmberRoundedIcon sx={{ fontSize: '0.75rem', color: sla.color }} />}
                        <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600, color: sla.color, whiteSpace: 'nowrap' }}>{sla.label}</Typography>
                      </Box>
                    </Box>
                  </Box>
                )
              })}
            </Box>
          </Grid>

          {/* ── Recent NFIU Reports ──────────────────────────────────────────── */}
          <Grid size={{ xs: 12, lg: 5 }}>
            <Box sx={{ border: '1px solid var(--card-border-col)', bgcolor: 'var(--card-bg)', display: 'flex', flexDirection: 'column', height: '100%' }}>
              {/* Header */}
              <Box sx={{ px: 2.5, py: 1.75, borderBottom: '1px solid var(--border-col)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 0.25 }}>
                    NFIU · Compliance
                  </Typography>
                  <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'var(--on-surface)', fontFamily: 'Jost', lineHeight: 1.2 }}>
                    Recent Reports
                  </Typography>
                </Box>
                <Button
                  onClick={() => navigate('/dashboard/reports')}
                  endIcon={<ArrowForwardOutlinedIcon sx={{ fontSize: '0.75rem !important' }} />}
                  sx={{ fontFamily: 'Jost', fontWeight: 600, fontSize: '0.75rem', textTransform: 'none', color: colorPalette.primary, p: 0, minWidth: 0 }}
                >
                  View All
                </Button>
              </Box>

              {/* Rows */}
              {recentReports.length === 0 ? (
                <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', py: 5 }}>
                  <Typography sx={{ fontSize: '0.875rem', color: '#cbd5e1' }}>No reports filed</Typography>
                </Box>
              ) : recentReports.map((r, i) => {
                const tColor = REPORT_TYPE_COLOR[r.reportType]
                const sStyle = REPORT_STATUS[r.status] ?? REPORT_STATUS.draft
                return (
                  <Box
                    key={r.id}
                    onClick={() => navigate('/dashboard/reports')}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 1.75,
                      pl: 0, pr: 2.5, py: 1.625,
                      borderLeft: `3px solid ${tColor}`,
                      borderBottom: i < recentReports.length - 1 ? '1px solid #f8fafc' : 'none',
                      cursor: 'pointer',
                      transition: 'background 0.14s',
                      '&:hover': { bgcolor: 'var(--section-bg)' },
                    }}
                  >
                    {/* Left spacer */}
                    <Box sx={{ width: 20, flexShrink: 0 }} />

                    {/* Type badge — square, prominent */}
                    <Box sx={{
                      flexShrink: 0, width: 44, height: 44, borderRadius: '6px',
                      bgcolor: tColor + '12', border: `1px solid ${tColor}30`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Typography sx={{ fontSize: '0.625rem', fontWeight: 800, color: tColor, letterSpacing: '0.06em', lineHeight: 1 }}>
                        {r.reportType === 'AML_RETURN' ? 'AML' : r.reportType}
                      </Typography>
                    </Box>

                    {/* Reference + title */}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--on-surface)', fontFamily: 'Jost', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', mb: 0.25 }}>
                        {r.reference}
                      </Typography>
                      <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.title}
                      </Typography>
                    </Box>

                    {/* Status + date */}
                    <Box sx={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
                      <Box sx={{ bgcolor: sStyle.bg, color: sStyle.text, px: 0.875, py: 0.25, borderRadius: '4px', fontSize: '0.5625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>
                        {r.status.replace('_', ' ')}
                      </Box>
                      <Typography sx={{ fontSize: '0.625rem', color: '#cbd5e1' }}>{fmtDate(r.createdAt)}</Typography>
                    </Box>
                  </Box>
                )
              })}
            </Box>
          </Grid>

        </Grid>

        {/* Eureka Insight Banner */}
        {isAiEnabled && <Box
          data-ai-analyzable="true"
          data-ai-description={`AI Insight Recommendation: Eureka surfaced new transaction patterns matching CBN Circular 2024/14 based on ${flaggedToday} recent flags.`}
          sx={{
            bgcolor: colorPalette.primary,
            color: '#ffffff',
            p: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'relative',
            overflow: 'hidden',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: '-30%',
              right: '-5%',
              width: 280,
              height: 280,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.06)',
            },
          }}
        >
          <Box sx={{ flex: 1, position: 'relative', zIndex: 1 }}>
            <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', opacity: 0.8, mb: 1 }}>
              Eureka recommends
            </Typography>
            <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, mb: 1, fontFamily: 'Jost', letterSpacing: '-0.01em', maxWidth: '70%' }}>
              Three new typology rules detected from this week's flagged activity. Review and deploy in under 5 minutes.
            </Typography>
            <Typography sx={{ fontSize: '0.875rem', opacity: 0.85, maxWidth: '65%' }}>
              Eureka analyzed {flaggedToday !== null ? fmt(flaggedToday) : '—'} flagged transactions and surfaced patterns matching CBN Circular 2024/14 reporting requirements.
            </Typography>
          </Box>
          <Stack direction="row" gap={1.5} sx={{ position: 'relative', zIndex: 1 }}>
            <Button
              sx={{
                bgcolor: 'rgba(255,255,255,0.12)',
                color: '#ffffff',
                px: 2.25,
                py: 1.125,
                fontSize: '0.8125rem',
                fontWeight: 600,
                fontFamily: 'Jost',
                borderRadius: 0,
                textTransform: 'none',
                border: '1px solid rgba(255,255,255,0.2)',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
              }}
            >
              Dismiss
            </Button>
            <Button
              sx={{
                bgcolor: 'var(--card-bg)',
                color: colorPalette.primary,
                px: 2.25,
                py: 1.125,
                fontSize: '0.8125rem',
                fontWeight: 700,
                fontFamily: 'Jost',
                borderRadius: 0,
                textTransform: 'none',
                '&:hover': { bgcolor: 'var(--section-bg)' },
              }}
            >
              Review Rules
            </Button>
          </Stack>
        </Box>}

        <FileReportDialog
          open={fileNFIUOpen}
          onClose={() => setFileNFIUOpen(false)}
          onFiled={r => setSnack({ msg: `NFIU report filed · ${r.reference}`, sev: 'success' })}
          defaultType="STR"
        />

        <Snackbar
          open={!!snack}
          autoHideDuration={6000}
          onClose={() => setSnack(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert
            onClose={() => setSnack(null)}
            severity={snack?.sev ?? 'info'}
            variant="filled"
            sx={{ borderRadius: 0, fontFamily: 'Jost', fontSize: '0.875rem' }}
          >
            {snack?.msg}
          </Alert>
        </Snackbar>
      </Box>
    </>
  )
}
