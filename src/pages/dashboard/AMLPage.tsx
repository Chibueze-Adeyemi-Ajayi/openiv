import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Box, Typography, Stack, InputBase } from '@mui/material'
import { colorPalette } from '@/theme'
// import { colorPalette } from '@/theme'
import CaseIntakeDrawer, { type CaseIntakePayload } from '@/components/dashboard/CaseIntakeDrawer'
import InvestigationWorkspace from '@/components/dashboard/InvestigationWorkspace'
import { caseApi, type Case, type CaseMetrics } from '@/api/cases'
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined'
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined'
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded'
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded'
import AssignmentIcon from '@mui/icons-material/Assignment'
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty'

const PAGE_SIZE = 20

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'investigating', label: 'Investigating' },
  { value: 'escalated', label: 'Escalated' },
  { value: 'closed', label: 'Closed' },
]

const STATUS_CFG: Record<string, { color: string; bg: string; label: string }> = {
  open: { color: '#f59e0b', bg: '#fffbeb', label: 'Open' },
  investigating: { color: colorPalette.primary, bg: `${colorPalette.primary}0f`, label: 'Investigating' },
  escalated: { color: '#dc2626', bg: '#fef2f2', label: 'Escalated' },
  closed: { color: '#64748b', bg: '#f8fafc', label: 'Closed' },
}

const PRIORITY_CFG: Record<string, { color: string; bg: string; label: string }> = {
  low: { color: '#64748b', bg: '#f8fafc', label: 'Low' },
  medium: { color: '#f59e0b', bg: '#fffbeb', label: 'Med' },
  high: { color: '#ea580c', bg: '#fff7ed', label: 'High' },
  critical: { color: '#dc2626', bg: '#fef2f2', label: 'Critical' },
}

const AVATAR_COLORS = ['#1e40af', '#0891b2', '#7c3aed', '#be123c', '#b45309', '#065f46']

function slaDisplay(deadline: string, status: string) {
  if (status === 'closed') return { label: 'Closed', color: '#10b981' }
  const diff = new Date(deadline).getTime() - Date.now()
  if (diff <= 0) return { label: 'Overdue', color: '#dc2626' }
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  return { label: h > 0 ? `${h}h ${m}m` : `${m}m`, color: h < 2 ? '#dc2626' : h < 12 ? '#f59e0b' : '#10b981' }
}

function AssigneeAvatar({ name }: { name?: string }) {
  if (!name) return <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>—</Typography>
  const idx = (name.charCodeAt(0) ?? 0) % AVATAR_COLORS.length
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
      <Box sx={{ width: 22, height: 22, borderRadius: '50%', bgcolor: AVATAR_COLORS[idx], display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Typography sx={{ fontSize: '0.5rem', fontWeight: 700, color: '#fff', lineHeight: 1 }}>{initials}</Typography>
      </Box>
      <Typography sx={{ fontSize: '0.75rem', color: '#475569', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {name.split(' ')[0]}
      </Typography>
    </Box>
  )
}

export default function AMLPage() {
  const [searchParams] = useSearchParams()

  const [metrics, setMetrics] = useState<CaseMetrics | null>(null)
  const [metricsLoading, setMetricsLoading] = useState(true)
  const [cases, setCases] = useState<Case[]>([])
  const [total, setTotal] = useState(0)
  const [pendingTotal, setPendingTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [casesLoading, setCasesLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [draftSearch, setDraftSearch] = useState('')
  const [search, setSearch] = useState('')
  const [viewPending, setViewPending] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [intakeOpen, setIntakeOpen] = useState(false)
  const [workspaceOpen, setWorkspaceOpen] = useState(false)
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const loadMetrics = useCallback(async () => {
    setMetricsLoading(true)
    try { setMetrics(await caseApi.metrics()) } finally { setMetricsLoading(false) }
  }, [])

  const loadCases = useCallback(async () => {
    setCasesLoading(true)
    try {
      const api = viewPending ? caseApi.listPendingApproval : caseApi.list
      const res = await api({ status: statusFilter || undefined, q: search || undefined, page, pageSize: PAGE_SIZE })
      setCases(res.cases)
      setTotal(res.total)

      // Load both active and pending counts for the cards
      if (page === 1) {
        const activRes = await caseApi.list({ pageSize: 1 })
        const pendRes = await caseApi.listPendingApproval({ pageSize: 1 })
        setTotal(activRes.total)
        setPendingTotal(pendRes.total)
      }
    } finally { setCasesLoading(false) }
  }, [statusFilter, search, page, viewPending])

  useEffect(() => { loadMetrics() }, [loadMetrics])
  useEffect(() => { loadCases() }, [loadCases])

  // Auto-open workspace if navigated here with ?case= query param
  useEffect(() => {
    const caseParam = searchParams.get('case')
    if (caseParam) { setActiveCaseId(caseParam); setWorkspaceOpen(true) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearchChange = (v: string) => {
    setDraftSearch(v)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => { setSearch(v); setPage(1) }, 300)
  }

  const openWorkspace = (id: string) => { setActiveCaseId(id); setWorkspaceOpen(true) }

  const handleIntakeSubmit = useCallback(async (payload: CaseIntakePayload) => {
    if (creating) return
    setCreating(true)
    try {
      const result = await caseApi.create(payload.caseInput)
      await caseApi.addEvidence(result.case.id, payload.evidence)
      setActiveCaseId(result.case.id)
      setWorkspaceOpen(true)
      loadMetrics()
      loadCases()
    } finally {
      setCreating(false)
    }
  }, [creating, loadMetrics, loadCases])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const metricCards = [
    { label: 'Open Cases', value: metrics?.openCount ?? null, color: '#f59e0b' },
    { label: 'Escalated', value: metrics?.escalatedCount ?? null, color: '#dc2626' },
    { label: 'Closed Today', value: metrics?.closedToday ?? null, color: '#10b981' },
    { label: 'Avg. Resolution', value: metrics ? `${metrics.avgCloseHours.toFixed(1)}h` : null, color: colorPalette.primary },
  ]

  return (
    <>
      <Box sx={{ p: 4 }}>

        {/* Page header */}
        <Box sx={{ mb: 4 }}>
          <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: colorPalette.primary, letterSpacing: '0.14em', textTransform: 'uppercase', mb: 0.75 }}>
            Investigations
          </Typography>
          <Typography sx={{ fontSize: '1.625rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost', letterSpacing: '-0.015em', mb: 0.5 }}>
            AML &amp; Cases
          </Typography>
          <Typography sx={{ fontSize: '0.9375rem', color: '#64748b' }}>
            Active investigations, SLA tracking, and case-management workflow
          </Typography>
        </Box>

        {/* Case View Toggle Cards */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2, mb: 3 }}>
          {/* Active Cases Card */}
          <Box
            onClick={() => { setViewPending(false); setPage(1) }}
            sx={{
              bgcolor: viewPending ? '#ffffff' : '#f0f9ff',
              border: viewPending ? '1px solid #eef0f4' : `2px solid ${colorPalette.primary}`,
              p: 2.5,
              cursor: 'pointer',
              transition: 'all 0.2s',
              '&:hover': { bgcolor: '#f0f9ff', borderColor: colorPalette.primary },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <Box>
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: colorPalette.primary, textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.75 }}>
                  Active Investigations
                </Typography>
                <Typography sx={{ fontSize: '2rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost', mb: 0.5 }}>
                  {metricsLoading ? (
                    <Box sx={{ width: 56, height: 40, bgcolor: '#f1f5f9', borderRadius: 0.5, animation: 'pulse 1.5s ease-in-out infinite', '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } } }} />
                  ) : (
                    total > 0 ? total : '—'
                  )}
                </Typography>
                <Typography sx={{ fontSize: '0.8125rem', color: '#64748b' }}>
                  {!viewPending ? 'Cases ready for investigation' : 'Switch to view active'}
                </Typography>
              </Box>
              <Box sx={{
                width: 44, height: 44, borderRadius: '8px',
                bgcolor: `${colorPalette.primary}12`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <AssignmentIcon sx={{ fontSize: '1.5rem', color: colorPalette.primary }} />
              </Box>
            </Box>
          </Box>

          {/* Pending Approval Card */}
          <Box
            onClick={() => { setViewPending(true); setPage(1) }}
            sx={{
              bgcolor: !viewPending ? '#ffffff' : '#fef3f2',
              border: !viewPending ? '1px solid #eef0f4' : '2px solid #dc2626',
              p: 2.5,
              cursor: 'pointer',
              transition: 'all 0.2s',
              '&:hover': { bgcolor: '#fef3f2', borderColor: '#dc2626' },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <Box>
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.75 }}>
                  Pending Approval
                </Typography>
                <Typography sx={{ fontSize: '2rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost', mb: 0.5 }}>
                  {metricsLoading ? (
                    <Box sx={{ width: 56, height: 40, bgcolor: '#f1f5f9', borderRadius: 0.5, animation: 'pulse 1.5s ease-in-out infinite', '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } } }} />
                  ) : (
                    pendingTotal > 0 ? pendingTotal : '—'
                  )}
                </Typography>
                <Typography sx={{ fontSize: '0.8125rem', color: '#64748b' }}>
                  {viewPending ? 'Cases awaiting your review' : 'Switch to view pending'}
                </Typography>
              </Box>
              <Box sx={{
                width: 44, height: 44, borderRadius: '8px',
                bgcolor: '#fecaca',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <HourglassEmptyIcon sx={{ fontSize: '1.5rem', color: '#dc2626' }} />
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Metric cards */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, mb: 3 }}>
          {metricCards.map(s => (
            <Box
              key={s.label}
              data-ai-analyzable="true"
              data-ai-description={`AML Performance Metric: ${s.label} currently at ${s.value}.`}
              sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', p: 2.25 }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: s.color }} />
                <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                  {s.label}
                </Typography>
              </Box>
              {metricsLoading ? (
                <Box sx={{ height: 28, width: 56, bgcolor: '#f1f5f9', borderRadius: 0.5, animation: 'pulse 1.5s ease-in-out infinite', '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } } }} />
              ) : (
                <Typography sx={{ fontSize: '1.625rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
                  {s.value ?? '—'}
                </Typography>
              )}
            </Box>
          ))}
        </Box>

        {/* Cases table */}
        <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4' }}>

          {/* Table toolbar */}
          <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid #eef0f4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
                {viewPending ? 'Pending Approval Queue' : 'Active Case Queue'}
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
                {casesLoading ? 'Loading…' : `${total} case${total !== 1 ? 's' : ''} · ${viewPending ? 'awaiting your review' : 'sorted by priority & SLA'}`}
              </Typography>
            </Box>
            {!viewPending && (
              <Box onClick={() => setIntakeOpen(true)} sx={{
                display: 'flex', alignItems: 'center', gap: 0.875,
                bgcolor: colorPalette.primary, color: '#ffffff',
                px: 2.25, py: 1.125, cursor: 'pointer',
                fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Jost',
                transition: 'opacity 0.15s', '&:hover': { opacity: 0.88 },
              }}>
                <GavelOutlinedIcon sx={{ fontSize: '1rem' }} />
                New Case
              </Box>
            )}
          </Box>

          {/* Filter bar */}
          <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid #eef0f4', display: 'flex', alignItems: 'center', gap: 2 }}>
            <Stack direction="row" gap={0.5}>
              {STATUS_TABS.map(tab => (
                <Box key={tab.value} onClick={() => { setStatusFilter(tab.value); setPage(1) }} sx={{
                  px: 1.75, py: 0.875,
                  fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'Jost',
                  color: statusFilter === tab.value ? colorPalette.primary : '#64748b',
                  bgcolor: statusFilter === tab.value ? `${colorPalette.primary}0a` : 'transparent',
                  transition: 'all 0.15s',
                  '&:hover': { bgcolor: statusFilter === tab.value ? `${colorPalette.primary}0f` : '#f8fafc' },
                }}>
                  {tab.label}
                </Box>
              ))}
            </Stack>
            <Box sx={{ flex: 1 }} />
            <Box sx={{
              display: 'flex', alignItems: 'center', gap: 1,
              bgcolor: '#f8fafc', px: 1.5, height: 32, minWidth: 240,
              border: '1px solid transparent', transition: 'all 0.18s',
              '&:focus-within': { bgcolor: '#ffffff', borderColor: colorPalette.primary },
            }}>
              <SearchOutlinedIcon sx={{ fontSize: '1rem', color: '#94a3b8' }} />
              <InputBase
                value={draftSearch}
                onChange={e => handleSearchChange(e.target.value)}
                placeholder="Search by case ID or title…"
                sx={{ flex: 1, fontSize: '0.8125rem', fontFamily: 'Jost', color: '#0f172a' }}
              />
            </Box>
          </Box>

          {/* Column headers */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '130px 1fr 78px 82px 90px 100px 110px 82px', gap: 2, px: 3, py: 1.25, borderBottom: '1px solid #eef0f4', bgcolor: '#fafbfc' }}>
            {['Case ID', 'Title / Typology', 'Risk', 'Priority', 'SLA', 'Opened', 'Assignee', 'Status'].map(h => (
              <Typography key={h} sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {h}
              </Typography>
            ))}
          </Box>

          {/* Skeleton rows */}
          {casesLoading && (
            <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {[...Array(6)].map((_, i) => (
                <Box key={i} sx={{ height: 46, bgcolor: '#f8fafc', borderRadius: 0.5, animation: 'pulse 1.5s ease-in-out infinite', '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } }, animationDelay: `${i * 80}ms` }} />
              ))}
            </Box>
          )}

          {/* Empty state */}
          {!casesLoading && cases.length === 0 && (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <GavelOutlinedIcon sx={{ fontSize: '2rem', color: '#e2e8f0', mb: 1.25 }} />
              <Typography sx={{ fontSize: '0.9375rem', fontWeight: 600, color: '#94a3b8', fontFamily: 'Jost', mb: 0.5 }}>
                No cases found
              </Typography>
              <Typography sx={{ fontSize: '0.8125rem', color: '#cbd5e1' }}>
                {search || statusFilter ? 'Try adjusting filters' : 'Create a new case to get started'}
              </Typography>
            </Box>
          )}

          {/* Case rows */}
          {!casesLoading && cases.map((c, i) => {
            const sla = slaDisplay(c.slaDeadline, c.status)
            const sCfg = STATUS_CFG[c.status] ?? STATUS_CFG.open
            const pCfg = PRIORITY_CFG[c.priority] ?? PRIORITY_CFG.medium
            return (
              <Box
                key={c.id}
                onClick={() => openWorkspace(c.id)}
                data-ai-analyzable="true"
                data-ai-description={`AML Investigation: Case ${c.id} for "${c.title}". Priority: ${c.priority}. Risk Score: ${c.riskScore}. SLA: ${sla.label}. Status: ${c.status}. Typology: ${c.typology}.`}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '130px 1fr 78px 82px 90px 100px 110px 82px',
                  gap: 2, px: 3, py: 1.75,
                  borderBottom: i < cases.length - 1 ? '1px solid #f4f5f7' : 'none',
                  cursor: 'pointer', transition: 'background 0.15s',
                  '&:hover': { bgcolor: '#fafbfc' },
                  alignItems: 'center',
                }}
              >
                <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: colorPalette.primary, fontFamily: 'SF Mono, Monaco, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.id}
                </Typography>

                <Box sx={{ overflow: 'hidden', minWidth: 0 }}>
                  <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a', fontFamily: 'Jost', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.title}
                  </Typography>
                  <Typography sx={{ fontSize: '0.6875rem', color: '#64748b', mt: 0.125, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.typology}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.625 }}>
                  <Box sx={{ width: 28, height: 4, bgcolor: '#f1f5f9', position: 'relative', flexShrink: 0 }}>
                    <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${c.riskScore}%`, bgcolor: c.riskScore >= 70 ? '#dc2626' : c.riskScore >= 40 ? '#f59e0b' : '#10b981' }} />
                  </Box>
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#0f172a' }}>{c.riskScore}</Typography>
                </Box>

                <Box sx={{ px: 0.875, py: 0.375, bgcolor: pCfg.bg, border: `1px solid ${pCfg.color}30`, width: 'fit-content' }}>
                  <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: pCfg.color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {pCfg.label}
                  </Typography>
                </Box>

                <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: sla.color }}>
                  {sla.label}
                </Typography>

                <Typography sx={{ fontSize: '0.75rem', color: '#64748b', fontFamily: 'Jost' }}>
                  {new Intl.DateTimeFormat('en-NG', { month: 'short', day: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(c.createdAt))}
                </Typography>

                <AssigneeAvatar name={c.assigneeName} />

                <Box sx={{ px: 0.875, py: 0.375, bgcolor: sCfg.bg, width: 'fit-content' }}>
                  <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: sCfg.color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {sCfg.label}
                  </Typography>
                </Box>
              </Box>
            )
          })}

          {/* Pagination */}
          {!casesLoading && total > PAGE_SIZE && (
            <Box sx={{ px: 3, py: 1.75, borderTop: '1px solid #eef0f4', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>
                Page {page} of {totalPages} · {total} total
              </Typography>
              <Stack direction="row" gap={0.5}>
                {[
                  { icon: <ChevronLeftRoundedIcon sx={{ fontSize: '1.125rem', color: '#475569' }} />, active: page > 1, onClick: () => setPage(p => p - 1) },
                  { icon: <ChevronRightRoundedIcon sx={{ fontSize: '1.125rem', color: '#475569' }} />, active: page < totalPages, onClick: () => setPage(p => p + 1) },
                ].map((btn, i) => (
                  <Box key={i} onClick={btn.active ? btn.onClick : undefined} sx={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 32, height: 32, border: '1px solid #e2e8f0',
                    cursor: btn.active ? 'pointer' : 'not-allowed', opacity: btn.active ? 1 : 0.4,
                    '&:hover': btn.active ? { bgcolor: '#f8fafc' } : {},
                  }}>
                    {btn.icon}
                  </Box>
                ))}
              </Stack>
            </Box>
          )}
        </Box>
      </Box>

      {/* Case intake drawer */}
      <CaseIntakeDrawer
        open={intakeOpen}
        onClose={() => setIntakeOpen(false)}
        onSubmit={handleIntakeSubmit}
      />

      {/* Investigation workspace */}
      <InvestigationWorkspace
        caseId={activeCaseId}
        open={workspaceOpen}
        onClose={() => { setWorkspaceOpen(false); loadMetrics(); loadCases() }}
        onUpdated={() => { loadMetrics(); loadCases() }}
      />
      {/* </Box > */}
    </>
  )
}
