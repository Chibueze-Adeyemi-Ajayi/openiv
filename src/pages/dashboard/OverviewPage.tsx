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
import { useNavigate } from 'react-router-dom'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined'
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined'
import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'
import ArrowForwardOutlinedIcon from '@mui/icons-material/ArrowForwardOutlined'

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

function MiniRiskDonut({ score, color }: { score: number; color: string }) {
  const size = 48, sw = 5, r = (size - sw) / 2
  const cx = size / 2, cy = size / 2
  const circ = 2 * Math.PI * r
  const filled = (Math.min(100, Math.max(0, score)) / 100) * circ
  return (
    <svg width={size} height={size} style={{ display: 'block', flexShrink: 0 }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth={sw} />
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
            src={photo.startsWith('data:') ? photo : `data:image/jpeg;base64,${photo}`}
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
  const { stats, activity, beamEvents, caseEvents, connected } = useDashboardData()
  const currentUser = useCurrentUser()

  useEffect(() => {
    customerApi.highRisk(1, 15).then(data => setTopHighRisk(data.customers)).catch(() => {})
  }, [])

  // Combine all events into unified activity feed (most recent first)
  const allActivity = [
    ...activity,
    ...beamEvents,
    ...caseEvents,
  ].sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()).slice(0, 50)

  const transactionsToday = stats?.totalToday ?? null
  const flaggedToday = stats?.flaggedToday ?? null
  const openCases = stats?.openCases ?? null
  const complianceScore = stats
    ? Math.max(0, 100 - (stats.totalToday > 0 ? (stats.flaggedToday / stats.totalToday) * 100 : 0)).toFixed(1) + '%'
    : null

  const txnTrend = stats ? pct(stats.totalToday, stats.totalYesterday) : 0
  const flaggedTrend = stats ? pct(stats.flaggedToday, stats.flaggedYesterday) : 0

  console.log('[OverviewPage] stats:', stats, 'computed values:', { transactionsToday, flaggedToday, openCases, complianceScore })

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
            <Typography sx={{ fontSize: '1.625rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost', letterSpacing: '-0.015em', mb: 0.5 }}>
              Good morning, {currentUser?.firstName ?? '…'}
            </Typography>
            <Typography sx={{ fontSize: '0.9375rem', color: '#64748b' }}>
              Here's what needs your attention today — {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </Typography>
          </Box>

          <Stack direction="row" gap={1.25}>
            <Button
              onClick={handleExport}
              disabled={exportLoading}
              data-ai-analyzable="true"
              data-ai-description="Generates a comprehensive CSV report of the last 24 hours of compliance activity and transaction metrics."
              startIcon={exportLoading
                ? <CircularProgress size={14} thickness={5} sx={{ color: 'inherit' }} />
                : <FileDownloadOutlinedIcon sx={{ fontSize: '1rem !important' }} />}
              sx={{
                bgcolor: '#ffffff',
                color: '#475569',
                border: '1px solid #e5e7eb',
                px: 2.25,
                py: 1.125,
                fontSize: '0.8125rem',
                fontWeight: 600,
                fontFamily: 'Jost',
                borderRadius: 0,
                textTransform: 'none',
                transition: 'all 0.18s',
                '&:hover:not(:disabled)': { bgcolor: '#f8fafc', borderColor: '#cbd5e1' },
                '&:disabled': { opacity: 0.6 },
              }}
            >
              {exportLoading ? 'Exporting…' : 'Export Report'}
            </Button>
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
                '&:hover:not(:disabled)': { bgcolor: '#1e293b', boxShadow: `0 4px 12px ${colorPalette.primary}30` },
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
              label="Open Cases"
              value={openCases !== null ? fmt(openCases) : '—'}
              trend={0}
              trendLabel="active now"
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
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', border: '1px solid #e5e7eb', bgcolor: '#ffffff' }}>
              <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    Risk Map · Watchlist
                  </Typography>
                  <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
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
                          bgcolor: i % 2 === 0 ? '#ffffff' : '#fafbfc',
                          borderBottom: '1px solid #f8fafc',
                          cursor: 'pointer',
                          '&:hover': { bgcolor: '#f1f5f9' },
                        }}
                      >
                        <CustomerPhoto photo={c.photo} color={color} name={c.name} />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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

        {/* Eureka Insight Banner */}
        <Box
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
                bgcolor: '#ffffff',
                color: colorPalette.primary,
                px: 2.25,
                py: 1.125,
                fontSize: '0.8125rem',
                fontWeight: 700,
                fontFamily: 'Jost',
                borderRadius: 0,
                textTransform: 'none',
                '&:hover': { bgcolor: '#f8fafc' },
              }}
            >
              Review Rules
            </Button>
          </Stack>
        </Box>

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
