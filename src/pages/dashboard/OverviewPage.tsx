import { Box, Typography, Stack, Grid, Button } from '@mui/material'
import { colorPalette } from '@/theme'
import DashboardLayout from '@/components/dashboard/DashboardLayout'
import MetricCard from '@/components/dashboard/MetricCard'
import NigeriaRiskMap from '@/components/dashboard/NigeriaRiskMap'
import TransactionFlowChart from '@/components/dashboard/TransactionFlowChart'
import ActivityFeed from '@/components/dashboard/ActivityFeed'
import TOTPConfirmation from '@/components/dashboard/TOTPConfirmation'
import { useState } from 'react'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined'
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined'
import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'

export default function OverviewPage() {
  const [fileNFIUOpen, setFileNFIUOpen] = useState(false)
  return (
    <DashboardLayout>
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
            <Typography sx={{ fontSize: '1.625rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost', letterSpacing: '-0.015em', mb: 0.5 }}>
              Good morning, Adaeze
            </Typography>
            <Typography sx={{ fontSize: '0.9375rem', color: '#64748b' }}>
              Here's what needs your attention today — Wednesday, 19 April 2026
            </Typography>
          </Box>

          <Stack direction="row" gap={1.25}>
            <Button
              startIcon={<FileDownloadOutlinedIcon sx={{ fontSize: '1rem !important' }} />}
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
                '&:hover': { bgcolor: '#f8fafc', borderColor: '#cbd5e1' },
              }}
            >
              Export Report
            </Button>
            <Button
              onClick={() => setFileNFIUOpen(true)}
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
                '&:hover': { bgcolor: '#1a3896', boxShadow: `0 4px 12px ${colorPalette.primary}30` },
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
              value="84,219"
              trend={12}
              trendLabel="vs yesterday"
              icon={<ReceiptLongOutlinedIcon sx={{ fontSize: '1.125rem' }} />}
              sparkline={[40, 45, 38, 50, 60, 55, 70, 65, 80, 75, 90, 85]}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <MetricCard
              label="Flagged for Review"
              value="847"
              trend={23}
              trendLabel="vs avg"
              invertTrend
              icon={<FlagOutlinedIcon sx={{ fontSize: '1.125rem' }} />}
              sparkline={[20, 25, 30, 28, 35, 40, 45, 50, 48, 55, 60, 58]}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <MetricCard
              label="Open Cases"
              value="34"
              trend={-8}
              trendLabel="closed today"
              invertTrend
              icon={<GavelOutlinedIcon sx={{ fontSize: '1.125rem' }} />}
              sparkline={[50, 48, 45, 42, 40, 38, 36, 35, 34, 34, 34, 34]}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <MetricCard
              label="Compliance Score"
              value="98.4%"
              trend={2}
              trendLabel="this week"
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
            <ActivityFeed />
          </Grid>
        </Grid>

        {/* Transaction Flow Chart */}
        <Box sx={{ mb: 3 }}>
          <TransactionFlowChart />
        </Box>

        {/* Eureka Insight Banner */}
        <Box
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
              Eureka analyzed 847 flagged transactions and surfaced patterns matching CBN Circular 2024/14 reporting requirements.
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
      </Box>

      <TOTPConfirmation
        open={fileNFIUOpen}
        onClose={() => setFileNFIUOpen(false)}
        onConfirm={() => setFileNFIUOpen(false)}
        operation="create"
        title="File NFIU return"
        description="Filing the daily NFIU return submits today's aggregated suspicious activity data to the Nigerian Financial Intelligence Unit. This is a regulated submission and cannot be retracted."
        resourceType="NFIU daily return"
        resourceName="19 April 2026 · 847 flagged transactions"
      />
    </DashboardLayout>
  )
}
