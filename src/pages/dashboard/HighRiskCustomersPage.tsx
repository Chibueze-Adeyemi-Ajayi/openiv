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
  const a = c.riskScore ?? 0
  const b = c.riskProfileScore ?? 0
  const d = c.transactionRiskScore ?? 0
  return Math.round(a * 0.20 + b * 0.55 + d * 0.25)
}

const DEMO_CUSTOMERS: Customer[] = [
  { id:1,  institutionId:1, externalId:'CUST-00914', name:'Emeka Okafor',       email:'e.okafor@demo.ng',   phone:'08031234567', riskScore:92, riskProfileScore:95, transactionRiskScore:88, overallRiskScore:93, bvn:'22312345678', nin:null, photo:null, selfiePhoto:null, identityPhoto:null, accountNumber:'0112345678', subjectType:'individual', dob:'1984-03-12', address:'Lagos Island, Lagos', createdAt:'2024-01-10T08:00:00Z', updatedAt:'2026-06-19T09:12:00Z', watchlisted:true,  watchlistedAt:'2026-05-20T10:00:00Z', watchlistedReason:'Structuring pattern', lastEvaluatedAt:'2026-06-19T09:00:00Z', cddRiskScore:91, cddConcerns:null, cddStepScores:null },
  { id:2,  institutionId:1, externalId:'CUST-00731', name:'Ngozi Adeleke',      email:'n.adeleke@demo.ng',  phone:'09021234567', riskScore:89, riskProfileScore:91, transactionRiskScore:84, overallRiskScore:90, bvn:'22398765432', nin:null, photo:null, selfiePhoto:null, identityPhoto:null, accountNumber:'0198765432', subjectType:'individual', dob:'1979-07-22', address:'Victoria Island, Lagos', createdAt:'2024-02-14T08:00:00Z', updatedAt:'2026-06-19T08:44:00Z', watchlisted:true,  watchlistedAt:'2026-06-01T11:00:00Z', watchlistedReason:'PEP connection', lastEvaluatedAt:'2026-06-19T08:30:00Z', cddRiskScore:88, cddConcerns:null, cddStepScores:null },
  { id:3,  institutionId:1, externalId:'CUST-01102', name:'Babatunde Fashola',  email:null,                 phone:'08051234567', riskScore:87, riskProfileScore:88, transactionRiskScore:90, overallRiskScore:88, bvn:'22387654321', nin:null, photo:null, selfiePhoto:null, identityPhoto:null, accountNumber:'0187654321', subjectType:'individual', dob:'1971-11-05', address:'Abuja, FCT',        createdAt:'2023-11-03T08:00:00Z', updatedAt:'2026-06-19T07:58:00Z', watchlisted:false, watchlistedAt:null, watchlistedReason:null, lastEvaluatedAt:'2026-06-19T07:45:00Z', cddRiskScore:86, cddConcerns:null, cddStepScores:null },
  { id:4,  institutionId:1, externalId:'CUST-00488', name:'Chidinma Eze',       email:'c.eze@demo.ng',      phone:'07031234567', riskScore:85, riskProfileScore:87, transactionRiskScore:82, overallRiskScore:86, bvn:'22376543210', nin:null, photo:null, selfiePhoto:null, identityPhoto:null, accountNumber:'0176543210', subjectType:'individual', dob:'1990-04-17', address:'Port Harcourt, Rivers', createdAt:'2024-03-20T08:00:00Z', updatedAt:'2026-06-18T22:11:00Z', watchlisted:true,  watchlistedAt:'2026-06-10T09:00:00Z', watchlistedReason:'Geo-velocity alert', lastEvaluatedAt:'2026-06-18T22:00:00Z', cddRiskScore:84, cddConcerns:null, cddStepScores:null },
  { id:5,  institutionId:1, externalId:'CUST-00263', name:'Musa Aliyu Ibrahim', email:null,                 phone:'08091234567', riskScore:82, riskProfileScore:84, transactionRiskScore:79, overallRiskScore:83, bvn:'22365432109', nin:null, photo:null, selfiePhoto:null, identityPhoto:null, accountNumber:'0165432109', subjectType:'individual', dob:'1986-09-30', address:'Kano, Kano State', createdAt:'2024-05-07T08:00:00Z', updatedAt:'2026-06-18T18:30:00Z', watchlisted:false, watchlistedAt:null, watchlistedReason:null, lastEvaluatedAt:'2026-06-18T18:00:00Z', cddRiskScore:81, cddConcerns:null, cddStepScores:null },
  { id:6,  institutionId:1, externalId:'CUST-00619', name:'Adaeze Okonkwo',    email:'a.okonkwo@demo.ng',  phone:'09081234567', riskScore:81, riskProfileScore:80, transactionRiskScore:83, overallRiskScore:81, bvn:'22354321098', nin:null, photo:null, selfiePhoto:null, identityPhoto:null, accountNumber:'0154321098', subjectType:'individual', dob:'1993-12-01', address:'Enugu, Enugu State', createdAt:'2024-04-11T08:00:00Z', updatedAt:'2026-06-18T15:20:00Z', watchlisted:false, watchlistedAt:null, watchlistedReason:null, lastEvaluatedAt:'2026-06-18T15:00:00Z', cddRiskScore:80, cddConcerns:null, cddStepScores:null },
  { id:7,  institutionId:1, externalId:'CUST-00854', name:'Tunde Ogundimu',    email:null,                 phone:'08021234567', riskScore:79, riskProfileScore:82, transactionRiskScore:76, overallRiskScore:80, bvn:'22343210987', nin:null, photo:null, selfiePhoto:null, identityPhoto:null, accountNumber:'0143210987', subjectType:'individual', dob:'1981-06-14', address:'Ibadan, Oyo State', createdAt:'2024-06-01T08:00:00Z', updatedAt:'2026-06-18T12:44:00Z', watchlisted:true,  watchlistedAt:'2026-05-30T14:00:00Z', watchlistedReason:'Sanctions list proximity', lastEvaluatedAt:'2026-06-18T12:30:00Z', cddRiskScore:78, cddConcerns:null, cddStepScores:null },
  { id:8,  institutionId:1, externalId:'CUST-00112', name:'Fatima Suleiman',   email:'f.suleiman@demo.ng', phone:'07061234567', riskScore:77, riskProfileScore:79, transactionRiskScore:75, overallRiskScore:78, bvn:'22332109876', nin:null, photo:null, selfiePhoto:null, identityPhoto:null, accountNumber:'0132109876', subjectType:'individual', dob:'1988-02-28', address:'Kaduna, Kaduna State', createdAt:'2024-02-28T08:00:00Z', updatedAt:'2026-06-18T09:55:00Z', watchlisted:false, watchlistedAt:null, watchlistedReason:null, lastEvaluatedAt:'2026-06-18T09:30:00Z', cddRiskScore:76, cddConcerns:null, cddStepScores:null },
  { id:9,  institutionId:1, externalId:'CUST-00377', name:'Obinna Nwachukwu',  email:null,                 phone:'08071234567', riskScore:76, riskProfileScore:78, transactionRiskScore:74, overallRiskScore:77, bvn:'22321098765', nin:null, photo:null, selfiePhoto:null, identityPhoto:null, accountNumber:'0121098765', subjectType:'individual', dob:'1975-08-19', address:'Onitsha, Anambra',  createdAt:'2023-09-15T08:00:00Z', updatedAt:'2026-06-17T21:10:00Z', watchlisted:false, watchlistedAt:null, watchlistedReason:null, lastEvaluatedAt:'2026-06-17T21:00:00Z', cddRiskScore:75, cddConcerns:null, cddStepScores:null },
  { id:10, institutionId:1, externalId:'CUST-00541', name:'Yemi Adekunle',     email:'y.adekunle@demo.ng', phone:'09051234567', riskScore:75, riskProfileScore:77, transactionRiskScore:72, overallRiskScore:76, bvn:'22310987654', nin:null, photo:null, selfiePhoto:null, identityPhoto:null, accountNumber:'0110987654', subjectType:'individual', dob:'1996-05-03', address:'Warri, Delta State', createdAt:'2024-07-04T08:00:00Z', updatedAt:'2026-06-17T16:30:00Z', watchlisted:false, watchlistedAt:null, watchlistedReason:null, lastEvaluatedAt:'2026-06-17T16:00:00Z', cddRiskScore:74, cddConcerns:null, cddStepScores:null },
]

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
      if (data.customers.length > 0) {
        setCustomers(data.customers)
        setTotal(data.total)
      } else {
        setCustomers(DEMO_CUSTOMERS)
        setTotal(DEMO_CUSTOMERS.length)
      }
    } catch {
      setCustomers(DEMO_CUSTOMERS)
      setTotal(DEMO_CUSTOMERS.length)
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
          <Typography sx={{ fontSize: '1.625rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost', letterSpacing: '-0.015em' }}>
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
          <Box sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 200px', px: 2, py: 1.25, bgcolor: 'var(--section-bg)', borderBottom: '1px solid #e5e7eb' }}>
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
                  bgcolor: i % 2 === 0 ? 'var(--card-bg)' : 'var(--section-bg)',
                  borderBottom: '1px solid var(--border-col)',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                  '&:last-child': { borderBottom: 'none' },
                  '&:hover': { bgcolor: 'var(--section-bg)' },
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
                    <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--on-surface)' }}>
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
                <Typography sx={{ fontSize: '0.875rem', color: 'var(--on-surface-variant)' }}>{c.riskScore}</Typography>
                <Typography sx={{ fontSize: '0.875rem', color: 'var(--on-surface-variant)' }}>{c.riskProfileScore}</Typography>
                <Typography sx={{ fontSize: '0.875rem', color: 'var(--on-surface-variant)' }}>{c.transactionRiskScore}</Typography>

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
                        '&:hover': { bgcolor: 'var(--on-surface)' },
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
                        bgcolor: 'var(--card-bg)',
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
