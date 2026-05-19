import { useState, useEffect, useCallback } from 'react'
import {
  Box, Typography, Stack, Chip, Button, CircularProgress,
  Pagination, Avatar, Tooltip,
} from '@mui/material'
import { colorPalette } from '@/theme'
import { customerApi, type Customer } from '@/api/customers'
import { caseApi } from '@/api/cases'
import FileReportDialog from '@/components/dashboard/FileReportDialog'
import CaseIntakeDrawer, { type CaseIntakePayload } from '@/components/dashboard/CaseIntakeDrawer'
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined'
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined'
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined'
import { useNavigate } from 'react-router-dom'

const PAGE_SIZE = 20

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

export default function HighRiskCustomersPage() {
  const navigate = useNavigate()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [total, setTotal]         = useState(0)
  const [page, setPage]           = useState(1)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)

  const [caseTarget,   setCaseTarget]   = useState<Customer | null>(null)
  const [reportTarget, setReportTarget] = useState<Customer | null>(null)

  const fetchPage = useCallback(async (p: number) => {
    setLoading(true)
    setError(null)
    try {
      const data = await customerApi.highRisk(p, PAGE_SIZE)
      setCustomers(data.customers)
      setTotal(data.total)
    } catch {
      setError('Failed to load high-risk customers. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchPage(page) }, [fetchPage, page])

  const handleCaseSubmit = useCallback(async (payload: CaseIntakePayload) => {
    await caseApi.create(payload.caseInput)
    setCaseTarget(null)
  }, [])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <Box sx={{ p: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: colorPalette.primary, letterSpacing: '0.14em', textTransform: 'uppercase', mb: 0.75 }}>
          Investigate
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
          <WarningAmberOutlinedIcon sx={{ color: '#dc2626', fontSize: '1.625rem' }} />
          <Typography sx={{ fontSize: '1.625rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost', letterSpacing: '-0.015em' }}>
            High-Risk Customers
          </Typography>
        </Box>
        <Typography sx={{ fontSize: '0.9375rem', color: '#64748b' }}>
          Customers with an overall risk score above 75 — ordered by highest risk first. Review each profile and take action.
        </Typography>
      </Box>


      {/* Loading */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress sx={{ color: colorPalette.primary }} />
        </Box>
      )}

      {/* Error */}
      {!loading && error && (
        <Box sx={{ p: 3, bgcolor: '#fef2f2', border: '1px solid #fecaca' }}>
          <Typography sx={{ color: '#dc2626' }}>{error}</Typography>
          <Button onClick={() => fetchPage(page)} sx={{ mt: 1, fontFamily: 'Jost', textTransform: 'none', color: colorPalette.primary }}>
            Retry
          </Button>
        </Box>
      )}

      {/* Customer list */}
      {!loading && !error && customers.length > 0 && (
        <Box sx={{ border: '1px solid #e5e7eb' }}>
          {/* Table header */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 200px', px: 2, py: 1.25, bgcolor: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
            {['Customer', 'Overall Risk', 'KYC Score', 'Case History', 'Txn Behaviour', 'Actions'].map(col => (
              <Typography key={col} sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {col}
              </Typography>
            ))}
          </Box>

          {customers.map((c, i) => {
            const score = overallScore(c)
            const color = scoreColor(score)
            return (
              <Box
                key={c.id}
                onClick={() => navigate(`/dashboard/users/${c.externalId}`)}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 200px',
                  px: 2,
                  py: 1.75,
                  alignItems: 'center',
                  bgcolor: i % 2 === 0 ? '#ffffff' : '#fafbfc',
                  borderBottom: '1px solid #f1f5f9',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                  '&:last-child': { borderBottom: 'none' },
                  '&:hover': { bgcolor: '#f1f5f9' },
                }}
              >
                {/* Customer identity */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Avatar
                    src={c.photo ?? undefined}
                    sx={{ width: 36, height: 36, bgcolor: color + '20', color, fontSize: '0.8125rem', fontWeight: 700, fontFamily: 'Jost', flexShrink: 0 }}
                  >
                    {initials(c.name)}
                  </Avatar>
                  <Box>
                    <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a' }}>
                      {c.name}
                    </Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                      {c.externalId}{c.accountNumber ? ` · ${c.accountNumber}` : ''}
                    </Typography>
                  </Box>
                  {c.watchlisted && (
                    <Chip label="Watchlisted" size="small" sx={{ bgcolor: '#fef9c3', color: '#854d0e', fontWeight: 700, fontSize: '0.625rem', borderRadius: 0, height: 18 }} />
                  )}
                </Box>

                {/* Overall score */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Typography sx={{ fontSize: '1.125rem', fontWeight: 700, color, fontFamily: 'Jost' }}>{score}</Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>/100</Typography>
                </Box>

                {/* Component scores */}
                <Typography sx={{ fontSize: '0.875rem', color: '#334155' }}>{c.riskScore}</Typography>
                <Typography sx={{ fontSize: '0.875rem', color: '#334155' }}>{c.riskProfileScore}</Typography>
                <Typography sx={{ fontSize: '0.875rem', color: '#334155' }}>{c.transactionRiskScore}</Typography>

                {/* Actions */}
                <Stack direction="row" gap={1}>
                  <Tooltip title="Open an investigation case for this customer">
                    <Button
                      size="small"
                      startIcon={<GavelOutlinedIcon sx={{ fontSize: '0.875rem !important' }} />}
                      onClick={e => { e.stopPropagation(); setCaseTarget(c) }}
                      sx={{
                        bgcolor: colorPalette.primary,
                        color: '#ffffff',
                        fontFamily: 'Jost',
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        textTransform: 'none',
                        borderRadius: 0,
                        px: 1.5,
                        py: 0.75,
                        '&:hover': { bgcolor: '#1e293b' },
                      }}
                    >
                      Open Case
                    </Button>
                  </Tooltip>
                  <Tooltip title="File a Suspicious Activity Report (SAR) for this customer">
                    <Button
                      size="small"
                      startIcon={<AssignmentOutlinedIcon sx={{ fontSize: '0.875rem !important' }} />}
                      onClick={e => { e.stopPropagation(); setReportTarget(c) }}
                      sx={{
                        bgcolor: '#ffffff',
                        color: '#dc2626',
                        border: '1px solid #fecaca',
                        fontFamily: 'Jost',
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        textTransform: 'none',
                        borderRadius: 0,
                        px: 1.5,
                        py: 0.75,
                        '&:hover': { bgcolor: '#fef2f2' },
                      }}
                    >
                      File Report
                    </Button>
                  </Tooltip>
                </Stack>
              </Box>
            )
          })}
        </Box>
      )}

      {/* Empty state */}
      {!loading && !error && customers.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography sx={{ fontSize: '1rem', color: '#64748b' }}>No high-risk customers found.</Typography>
        </Box>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, p) => setPage(p)}
            sx={{ '& .MuiPaginationItem-root': { fontFamily: 'Jost', borderRadius: 0 } }}
          />
        </Box>
      )}

      {/* Open Case drawer */}
      {caseTarget && (
        <CaseIntakeDrawer
          open
          onClose={() => setCaseTarget(null)}
          onSubmit={handleCaseSubmit}
        />
      )}

      {/* File Report dialog */}
      {reportTarget && (
        <FileReportDialog
          open
          onClose={() => setReportTarget(null)}
          onFiled={() => setReportTarget(null)}
          defaultType="STR"
          prefill={{
            subjectName: reportTarget.name,
            subjectType: reportTarget.subjectType ?? 'individual',
            subjectBvn: reportTarget.bvn ?? '',
            subjectAccount: reportTarget.accountNumber ?? '',
          }}
        />
      )}
    </Box>
  )
}
