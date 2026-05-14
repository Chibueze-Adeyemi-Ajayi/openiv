import { Box, Typography, Stack, Grid, Button, Snackbar, Alert, CircularProgress } from '@mui/material'
import { colorPalette } from '@/theme'
import MetricCard from '@/components/dashboard/MetricCard'
import NigeriaRiskMap from '@/components/dashboard/NigeriaRiskMap'
import TransactionFlowChart from '@/components/dashboard/TransactionFlowChart'
import ActivityFeed from '@/components/dashboard/ActivityFeed'
import FileReportDialog from '@/components/dashboard/FileReportDialog'
import OtpAlertsPanel from '@/components/dashboard/OtpAlertsPanel'
import { useState, useCallback } from 'react'
import { useDashboardData } from '@/hooks/useDashboardData'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined'
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined'
import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'

function pct(a: number, b: number) {
  if (b === 0) return 0
  return Math.round(((a - b) / b) * 100)
}

function fmt(n: number) {
  return n.toLocaleString('en-US')
}

export default function OverviewPage() {
  const [fileNFIUOpen, setFileNFIUOpen] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)
  const [snack, setSnack] = useState<{ msg: string; sev: 'success' | 'error' } | null>(null)
  const { stats, activity, beamEvents, caseEvents, connected } = useDashboardData()
  const currentUser = useCurrentUser()

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

        {/* Map + Activity */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, lg: 8 }}>
            <NigeriaRiskMap />
          </Grid>
          <Grid size={{ xs: 12, lg: 4 }}>
            <ActivityFeed events={allActivity} connected={connected} />
          </Grid>
        </Grid>

        {/* Transaction Flow + OTP Alerts */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, lg: 8 }}>
            <TransactionFlowChart />
          </Grid>
          <Grid size={{ xs: 12, lg: 4 }}>
            <OtpAlertsPanel />
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
