import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box, Typography, Stack, Chip, CircularProgress, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Button,
} from '@mui/material'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import { institutionAlertsApi, type InstitutionAlert, type SuspectCustomer } from '@/api/institutionAlerts'

const fmtAmount = (n: number) =>
  n >= 1_000_000 ? `₦${(n / 1_000_000).toFixed(1)}M` : `₦${(n / 1_000).toFixed(0)}k`

const riskColor = (score: number) =>
  score >= 70 ? '#dc2626' : score >= 40 ? '#d97706' : '#16a34a'

const riskBg = (score: number) =>
  score >= 70 ? '#fef2f2' : score >= 40 ? '#fffbeb' : '#f0fdf4'

const headSx = {
  fontFamily: 'Jost', fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8',
  textTransform: 'uppercase' as const, letterSpacing: '0.07em',
  borderBottom: '1px solid #e2e8f0', py: 1.25, px: 2, bgcolor: '#fafbfc',
}
const cellSx = {
  fontFamily: 'Jost', fontSize: '0.8125rem', color: '#1e293b',
  borderBottom: '1px solid #f1f5f9', py: 1.5, px: 2,
}

export default function SurgeInvestigationPage() {
  const { alertId } = useParams<{ alertId: string }>()
  const navigate = useNavigate()
  const [alert, setAlert] = useState<InstitutionAlert | null>(null)
  const [suspects, setSuspects] = useState<SuspectCustomer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [resolving, setResolving] = useState(false)

  useEffect(() => {
    if (!alertId) return
    setLoading(true)
    institutionAlertsApi.investigate(Number(alertId))
      .then(res => {
        setAlert(res.alert)
        setSuspects(res.suspects)
      })
      .catch(() => setError('Failed to load investigation data.'))
      .finally(() => setLoading(false))
  }, [alertId])

  const handleResolve = async () => {
    if (!alert || resolving) return
    setResolving(true)
    try {
      const res = await institutionAlertsApi.updateStatus(alert.id, 'resolved')
      setAlert(res.alert)
    } catch {
      // keep state
    } finally {
      setResolving(false)
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <CircularProgress size={28} sx={{ color: '#00288e' }} />
      </Box>
    )
  }

  if (error || !alert) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error" sx={{ borderRadius: 0 }}>{error || 'Alert not found.'}</Alert>
      </Box>
    )
  }

  const { surgePct = 0, todayCount = 0, expectedCount = 0 } = alert.metadata

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1100, mx: 'auto' }}>
      {/* Back */}
      <Box
        onClick={() => navigate('/dashboard/notifications')}
        sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, mb: 3, cursor: 'pointer', color: '#64748b', '&:hover': { color: '#00288e' } }}
      >
        <ArrowBackRoundedIcon sx={{ fontSize: '1rem' }} />
        <Typography sx={{ fontFamily: 'Jost', fontSize: '0.8125rem', fontWeight: 600 }}>Back to Notifications</Typography>
      </Box>

      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.75 }}>
            <Typography sx={{ fontFamily: 'Jost', fontWeight: 700, fontSize: '1.5rem', color: '#00288e', letterSpacing: '-0.02em' }}>
              {alert.title}
            </Typography>
            <Chip
              label={alert.status.toUpperCase()}
              size="small"
              sx={{
                borderRadius: 0.5, height: 22, fontFamily: 'Jost', fontSize: '0.6875rem', fontWeight: 700,
                bgcolor: alert.status === 'resolved' ? '#f0fdf4' : alert.status === 'investigating' ? '#fffbeb' : '#fef2f2',
                color: alert.status === 'resolved' ? '#16a34a' : alert.status === 'investigating' ? '#d97706' : '#dc2626',
              }}
            />
          </Box>
          <Typography sx={{ fontSize: '0.875rem', color: '#64748b', fontFamily: 'Jost' }}>
            Detected {new Date(alert.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </Typography>
        </Box>
        {alert.status !== 'resolved' && (
          <Button
            startIcon={<CheckCircleOutlineRoundedIcon />}
            onClick={handleResolve}
            disabled={resolving}
            sx={{
              textTransform: 'none', fontFamily: 'Jost', fontWeight: 600, fontSize: '0.875rem',
              borderRadius: 0, px: 2.5, py: 1, bgcolor: '#16a34a', color: '#ffffff', boxShadow: 'none',
              '&:hover': { bgcolor: '#15803d', boxShadow: 'none' },
              '&:disabled': { bgcolor: '#e2e8f0', color: '#94a3b8' },
            }}
          >
            {resolving ? 'Resolving…' : 'Mark as Resolved'}
          </Button>
        )}
      </Box>

      {/* Stats */}
      <Stack direction="row" gap={2} sx={{ mb: 4, flexWrap: 'wrap' }}>
        {[
          { label: "Today's Transactions", value: todayCount.toLocaleString(), color: '#dc2626' },
          { label: 'Expected Baseline', value: expectedCount.toLocaleString(), color: '#64748b' },
          { label: 'Surge Above Baseline', value: `+${surgePct}%`, color: '#d97706' },
        ].map(({ label, value, color }) => (
          <Box key={label} sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0', px: 3, py: 2, flex: 1, minWidth: 160 }}>
            <Typography sx={{ fontFamily: 'Jost', fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              {label}
            </Typography>
            <Typography sx={{ fontFamily: 'Jost', fontWeight: 700, fontSize: '1.75rem', color, lineHeight: 1.2, mt: 0.5 }}>
              {value}
            </Typography>
          </Box>
        ))}
      </Stack>

      {/* Context callout */}
      <Box sx={{ p: 2.5, bgcolor: '#fffbeb', border: '1px solid #fcd34d', mb: 4, display: 'flex', gap: 1.5 }}>
        <WarningAmberRoundedIcon sx={{ color: '#d97706', mt: 0.25, flexShrink: 0 }} />
        <Box>
          <Typography sx={{ fontFamily: 'Jost', fontWeight: 700, fontSize: '0.875rem', color: '#92400e', mb: 0.5 }}>
            What to look for during investigation
          </Typography>
          <Typography sx={{ fontSize: '0.8125rem', color: '#78350f', lineHeight: 1.7 }}>
            A transaction surge across your institution can indicate coordinated fraud — money mule networks moving funds simultaneously, mass account takeovers, or a smurfing ring breaking a large payment into many small ones.
            The table below shows customers whose transactions in the last 24 hours are the most suspicious. Start with customers who have the highest number of flagged or cased transactions.
            Check whether they recently opened their accounts, whether their beneficiaries are shared across multiple accounts, and whether their transaction patterns are consistent with their profile.
          </Typography>
        </Box>
      </Box>

      {/* Suspects table */}
      <Box sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0' }}>
        <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid #e2e8f0' }}>
          <Typography sx={{ fontFamily: 'Jost', fontWeight: 700, fontSize: '1rem', color: '#00288e' }}>
            Suspicious Customers — Last 24 Hours
          </Typography>
          <Typography sx={{ fontFamily: 'Jost', fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
            {suspects.length} customer{suspects.length !== 1 ? 's' : ''} flagged for review · ranked by severity
          </Typography>
        </Box>

        {suspects.length === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography sx={{ color: '#94a3b8', fontFamily: 'Jost', fontSize: '0.875rem' }}>
              No suspicious customers found in the last 24 hours.
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={headSx}>Customer</TableCell>
                  <TableCell sx={headSx} align="right">Txns (24h)</TableCell>
                  <TableCell sx={headSx} align="right">Total Volume</TableCell>
                  <TableCell sx={headSx} align="right">Avg Risk</TableCell>
                  <TableCell sx={headSx} align="right">Flagged</TableCell>
                  <TableCell sx={headSx} align="right">Cased</TableCell>
                  <TableCell sx={headSx} align="right">Profile Risk</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {suspects.map((s) => (
                  <TableRow
                    key={s.customerId}
                    hover
                    onClick={() => navigate(`/dashboard/users/${s.customerId}`)}
                    sx={{ cursor: 'pointer', '&:hover': { bgcolor: '#f8fafc' } }}
                  >
                    <TableCell sx={cellSx}>
                      <Typography sx={{ fontWeight: 600, fontFamily: 'Jost', fontSize: '0.8125rem', color: '#0f172a' }}>
                        {s.customerName || `Customer #${s.customerId}`}
                      </Typography>
                      <Typography sx={{ fontFamily: 'monospace', fontSize: '0.6875rem', color: '#94a3b8' }}>
                        ID: {s.customerId}
                      </Typography>
                    </TableCell>
                    <TableCell sx={cellSx} align="right">
                      <Typography sx={{ fontFamily: 'Jost', fontWeight: 600, color: '#1e293b' }}>{s.txnCount}</Typography>
                    </TableCell>
                    <TableCell sx={cellSx} align="right">
                      <Typography sx={{ fontFamily: 'Jost', fontSize: '0.8125rem', color: '#475569' }}>
                        {fmtAmount(s.totalAmount)}
                      </Typography>
                    </TableCell>
                    <TableCell sx={cellSx} align="right">
                      <Box
                        sx={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          px: 1, py: 0.25, bgcolor: riskBg(s.avgRiskScore), borderRadius: 0.5,
                          minWidth: 40,
                        }}
                      >
                        <Typography sx={{ fontFamily: 'Jost', fontWeight: 700, fontSize: '0.8125rem', color: riskColor(s.avgRiskScore) }}>
                          {Math.round(s.avgRiskScore)}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell sx={cellSx} align="right">
                      <Typography sx={{ fontFamily: 'Jost', fontWeight: 600, color: s.flaggedCount > 0 ? '#d97706' : '#94a3b8' }}>
                        {s.flaggedCount}
                      </Typography>
                    </TableCell>
                    <TableCell sx={cellSx} align="right">
                      <Typography sx={{ fontFamily: 'Jost', fontWeight: 600, color: s.casedCount > 0 ? '#dc2626' : '#94a3b8' }}>
                        {s.casedCount}
                      </Typography>
                    </TableCell>
                    <TableCell sx={cellSx} align="right">
                      <Box
                        sx={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          px: 1, py: 0.25, bgcolor: riskBg(s.overallRiskScore), borderRadius: 0.5,
                          minWidth: 40,
                        }}
                      >
                        <Typography sx={{ fontFamily: 'Jost', fontWeight: 700, fontSize: '0.8125rem', color: riskColor(s.overallRiskScore) }}>
                          {s.overallRiskScore}
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
    </Box>
  )
}
