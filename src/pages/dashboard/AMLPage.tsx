import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import NavigationBreadcrumb from '@/components/dashboard/NavigationBreadcrumb'
import { Box, Typography, Stack, InputBase, Button, Chip, IconButton, Popover } from '@mui/material'
import { colorPalette } from '@/theme'
import CaseIntakeDrawer, { type CaseIntakePayload } from '@/components/dashboard/CaseIntakeDrawer'
import DateRangeFilter, { type DateRange } from '@/components/dashboard/DateRangeFilter'
import { caseApi, type Case, type CaseMetrics } from '@/api/cases'
import { useActiveCase } from '@/contexts/ActiveCaseContext'
import { teamApi, type TeamMember } from '@/api/team'
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined'
import FilterListRoundedIcon from '@mui/icons-material/FilterListRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined'
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded'
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded'
import AssignmentIcon from '@mui/icons-material/Assignment'
import PanToolOutlinedIcon from '@mui/icons-material/PanToolOutlined'

const PAGE_SIZE = 20

type CaseRiskFilter = 'any' | 'high' | 'medium' | 'low'
type CaseSortOption = 'recent' | 'oldest' | 'priority' | 'risk_desc' | 'risk_asc'
type AssignFilter = 'all' | 'me' | number  // number = specific team member id (admin/CCO)

const PRIORITY_TABS = [
  { value: '', label: 'All' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

const CASE_RISK_OPTIONS: { key: CaseRiskFilter; label: string }[] = [
  { key: 'any',    label: 'Any'       },
  { key: 'high',   label: 'High ≥70'  },
  { key: 'medium', label: 'Med 40–69' },
  { key: 'low',    label: 'Low <40'   },
]

const CASE_RISK_TO_RANGE: Record<CaseRiskFilter, { min?: number; max?: number }> = {
  any:    {},
  high:   { min: 70 },
  medium: { min: 40, max: 69 },
  low:    { max: 39 },
}

const CASE_SORT_OPTIONS: { key: CaseSortOption; label: string }[] = [
  { key: 'recent',   label: 'Newest first'   },
  { key: 'oldest',   label: 'Oldest first'   },
  { key: 'priority', label: 'Priority & SLA' },
  { key: 'risk_desc', label: 'Risk: High → Low' },
  { key: 'risk_asc',  label: 'Risk: Low → High' },
]

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'investigating', label: 'Investigating' },
  { value: 'pending_review', label: 'Pending Review' },
  { value: 'escalated', label: 'Escalated' },
  { value: 'closed', label: 'Closed' },
]

const STATUS_CFG: Record<string, { color: string; bg: string; label: string }> = {
  open:           { color: '#f59e0b',           bg: '#fffbeb',                               label: 'Open'           },
  investigating:  { color: colorPalette.primary, bg: `${colorPalette.primary}0f`,             label: 'Investigating'  },
  pending_review: { color: '#7c3aed',            bg: '#f5f3ff',                               label: 'Pending Review' },
  escalated:      { color: '#dc2626',            bg: '#fef2f2',                               label: 'Escalated'      },
  closed:         { color: '#64748b',            bg: '#f8fafc',                               label: 'Closed'         },
}

const PRIORITY_CFG: Record<string, { color: string; bg: string; label: string }> = {
  low:      { color: '#64748b', bg: '#f8fafc', label: 'Low'      },
  medium:   { color: '#f59e0b', bg: '#fffbeb', label: 'Med'      },
  high:     { color: '#ea580c', bg: '#fff7ed', label: 'High'     },
  critical: { color: '#dc2626', bg: '#fef2f2', label: 'Critical' },
}

const ELEVATED_ROLES = new Set(['admin', 'cco'])

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
      <Typography sx={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {name.split(' ')[0]}
      </Typography>
    </Box>
  )
}

export default function AMLPage() {
  const user = useCurrentUser()
  const [searchParams] = useSearchParams()
  const isElevated = ELEVATED_ROLES.has(user?.role ?? '')

  const [metrics, setMetrics] = useState<CaseMetrics | null>(null)
  const [metricsLoading, setMetricsLoading] = useState(true)
  const [cases, setCases] = useState<Case[]>([])
  const [total, setTotal] = useState(0)
  const [allCasesCount,    setAllCasesCount]    = useState<number | null>(null)
  const [interestCaseCount, setInterestCaseCount] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const [casesLoading, setCasesLoading] = useState(true)
  const [statusFilter,   setStatusFilter]   = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [draftSearch,    setDraftSearch]    = useState('')
  const [search,         setSearch]         = useState('')
  const [range,          setRange]          = useState<DateRange>('30d')
  const [appliedRisk,    setAppliedRisk]    = useState<CaseRiskFilter>('any')
  const [appliedSort,    setAppliedSort]    = useState<CaseSortOption>('recent')
  const [assignFilter,   setAssignFilter]   = useState<AssignFilter>('all')
  const [filterOpen,     setFilterOpen]     = useState(false)
  const [draftPriority,  setDraftPriority]  = useState('')
  const [draftRisk,      setDraftRisk]      = useState<CaseRiskFilter>('any')
  const [draftSort,      setDraftSort]      = useState<CaseSortOption>('recent')
  const [draftAssign,    setDraftAssign]    = useState<AssignFilter>('all')
  const [appliedHasInterest, setAppliedHasInterest] = useState(false)
  const [draftHasInterest,   setDraftHasInterest]   = useState(false)
  const [teamMembers,    setTeamMembers]    = useState<TeamMember[]>([])
  const filterBtnRef = useRef<HTMLButtonElement | null>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const navigate = useNavigate()
  const { openCase } = useActiveCase()
  const [intakeOpen, setIntakeOpen] = useState(false)
  const [creating, setCreating] = useState(false)

  const loadMetrics = useCallback(async () => {
    setMetricsLoading(true)
    try { setMetrics(await caseApi.metrics()) } finally { setMetricsLoading(false) }
  }, [])

  const loadCardCounts = useCallback(() => {
    caseApi.list({ pageSize: 1 }).then(r => setAllCasesCount(r.total)).catch(() => {})
    caseApi.list({ hasInterest: true, pageSize: 1 }).then(r => setInterestCaseCount(r.total)).catch(() => {})
  }, [])

  const loadCases = useCallback(async () => {
    setCasesLoading(true)
    try {
      const riskRange = CASE_RISK_TO_RANGE[appliedRisk]
      const assignedToMe   = assignFilter === 'me' ? true : undefined
      const assignedToUser = typeof assignFilter === 'number' ? assignFilter : undefined
      const res = await caseApi.list({
        status:        statusFilter  || undefined,
        priority:      priorityFilter || undefined,
        q:             search        || undefined,
        page,
        pageSize:      PAGE_SIZE,
        sort:          appliedSort !== 'recent' ? appliedSort : undefined,
        range:         range,
        minRisk:       riskRange.min,
        maxRisk:       riskRange.max,
        assignedToMe,
        assignedToUser,
        hasInterest:   appliedHasInterest || undefined,
      })
      setCases(res.cases)
      setTotal(res.total)
    } finally { setCasesLoading(false) }
  }, [statusFilter, priorityFilter, search, page, appliedSort, range, appliedRisk, assignFilter, appliedHasInterest])

  useEffect(() => { loadMetrics() }, [loadMetrics])
  useEffect(() => { loadCases() }, [loadCases])
  useEffect(() => { loadCardCounts() }, [loadCardCounts])

  // Load team members for admin/CCO assign filter
  useEffect(() => {
    if (isElevated) {
      teamApi.listMembers().then(res => setTeamMembers(res.members.filter(m => m.status === 'active'))).catch(() => {})
    }
  }, [isElevated])

  // Auto-navigate if arrived with ?case= query param
  useEffect(() => {
    const caseParam = searchParams.get('case')
    if (caseParam) navigate(`/dashboard/cases/${caseParam}`)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Reload lists when workspace closes or updates a case
  useEffect(() => {
    const handler = () => { loadMetrics(); loadCases(); loadCardCounts() }
    window.addEventListener('case:updated', handler)
    window.addEventListener('case:closed', handler)
    return () => {
      window.removeEventListener('case:updated', handler)
      window.removeEventListener('case:closed', handler)
    }
  }, [loadMetrics, loadCases, loadCardCounts])

  const handleSearchChange = (v: string) => {
    setDraftSearch(v)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => { setSearch(v); setPage(1) }, 300)
  }

  const openCaseFilter = () => {
    setDraftPriority(priorityFilter)
    setDraftRisk(appliedRisk)
    setDraftSort(appliedSort)
    setDraftAssign(assignFilter)
    setDraftHasInterest(appliedHasInterest)
    setFilterOpen(true)
  }
  const applyCaseFilter = () => {
    setPriorityFilter(draftPriority)
    setAppliedRisk(draftRisk)
    setAppliedSort(draftSort)
    setAssignFilter(draftAssign)
    setAppliedHasInterest(draftHasInterest)
    setPage(1)
    setFilterOpen(false)
  }
  const clearCaseFilter = () => {
    setDraftPriority(''); setDraftRisk('any'); setDraftSort('recent'); setDraftAssign('all'); setDraftHasInterest(false)
  }

  const assignFilterLabel = (af: AssignFilter): string | null => {
    if (af === 'all') return null
    if (af === 'me') return 'Assigned to Me'
    const m = teamMembers.find(tm => tm.id === af)
    return m ? `Assigned: ${m.name.split(' ')[0]}` : null
  }

  const caseFilterCount = (priorityFilter ? 1 : 0)
    + (appliedRisk !== 'any' ? 1 : 0)
    + (appliedSort !== 'recent' ? 1 : 0)
    + (assignFilter !== 'all' ? 1 : 0)
    + (appliedHasInterest ? 1 : 0)

  const openWorkspace = (c: Case) => {
    if (!c.seen) {
      caseApi.markSeen(c.id).catch(() => {})
      setCases(prev => prev.map(r => r.id === c.id ? { ...r, seen: true } : r))
      window.dispatchEvent(new CustomEvent('case:seen'))
    }
    navigate(`/dashboard/cases/${c.id}`)
  }

  const handleIntakeSubmit = useCallback(async (payload: CaseIntakePayload) => {
    if (creating) return
    setCreating(true)
    try {
      const result = await caseApi.create(payload.caseInput)
      await caseApi.addEvidence(result.case.id, payload.evidence)
      openCase(result.case)
      loadMetrics()
      loadCases()
    } finally { setCreating(false) }
  }, [creating, loadMetrics, loadCases, openCase])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const metricCards = [
    { label: 'Open Cases',      value: metrics?.openCount ?? null,                      color: '#f59e0b' },
    { label: 'Escalated',       value: metrics?.escalatedCount ?? null,                 color: '#dc2626' },
    { label: 'Closed Today',    value: metrics?.closedToday ?? null,                    color: '#10b981' },
    { label: 'Avg. Resolution', value: metrics ? `${metrics.avgCloseHours.toFixed(1)}h` : null, color: colorPalette.primary },
  ]

  return (
    <>
      <Box sx={{ p: 4 }}>
        <NavigationBreadcrumb currentLabel="AML Cases" />

        {/* Page header */}
        <Box sx={{ mb: 4 }}>
          <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: colorPalette.primary, letterSpacing: '0.14em', textTransform: 'uppercase', mb: 0.75 }}>
            Investigations
          </Typography>
          <Typography sx={{ fontSize: '1.625rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost', letterSpacing: '-0.015em', mb: 0.5 }}>
            AML &amp; Cases
          </Typography>
          <Typography sx={{ fontSize: '0.9375rem', color: '#64748b' }}>
            Active investigations, SLA tracking, and case-management workflow
          </Typography>
        </Box>

        {/* Case View Toggle Cards */}
        <Box sx={{ display: 'grid', gridTemplateColumns: isElevated ? 'repeat(2, 1fr)' : '1fr', gap: 2, mb: 3 }}>
          {/* Active Investigations */}
          <Box onClick={() => { setAppliedHasInterest(false); setPage(1) }} sx={{
            bgcolor: appliedHasInterest ? 'var(--card-bg)' : '#f0f9ff',
            border: appliedHasInterest ? '1px solid var(--border-col)' : `2px solid ${colorPalette.primary}`,
            p: 2.5, cursor: 'pointer', transition: 'all 0.2s',
            '&:hover': { bgcolor: '#f0f9ff', borderColor: colorPalette.primary },
          }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <Box>
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: colorPalette.primary, textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.75 }}>
                  Active Investigations
                </Typography>
                <Typography component="div" sx={{ fontSize: '2rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost', mb: 0.5 }}>
                  {allCasesCount == null
                    ? <Box sx={{ width: 56, height: 40, bgcolor: 'var(--section-bg)', borderRadius: 0.5, animation: 'pulse 1.5s ease-in-out infinite', '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } } }} />
                    : (allCasesCount > 0 ? allCasesCount : '—')}
                </Typography>
                <Typography sx={{ fontSize: '0.8125rem', color: '#64748b' }}>
                  {appliedHasInterest ? 'Switch to view all cases' : 'All open cases'}
                </Typography>
              </Box>
              <Box sx={{ width: 44, height: 44, borderRadius: '8px', bgcolor: `${colorPalette.primary}12`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AssignmentIcon sx={{ fontSize: '1.5rem', color: colorPalette.primary }} />
              </Box>
            </Box>
          </Box>

          {/* Interest Requests — admin/CCO only */}
          {isElevated && (
            <Box onClick={() => { setAppliedHasInterest(true); setPage(1) }} sx={{
              bgcolor: !appliedHasInterest ? 'var(--card-bg)' : '#fff7ed',
              border: !appliedHasInterest ? '1px solid var(--border-col)' : '2px solid #ea580c',
              p: 2.5, cursor: 'pointer', transition: 'all 0.2s',
              '&:hover': { bgcolor: '#fff7ed', borderColor: '#ea580c' },
            }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <Box>
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#ea580c', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.75 }}>
                    Interest Requests
                  </Typography>
                  <Typography component="div" sx={{ fontSize: '2rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost', mb: 0.5 }}>
                    {interestCaseCount == null
                      ? <Box sx={{ width: 56, height: 40, bgcolor: 'var(--section-bg)', borderRadius: 0.5, animation: 'pulse 1.5s ease-in-out infinite', '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } } }} />
                      : (interestCaseCount > 0 ? interestCaseCount : '—')}
                  </Typography>
                  <Typography sx={{ fontSize: '0.8125rem', color: '#64748b' }}>
                    {appliedHasInterest ? 'Cases with pending member interests' : 'Team members waiting for assignment'}
                  </Typography>
                </Box>
                <Box sx={{ width: 44, height: 44, borderRadius: '8px', bgcolor: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #fdba74' }}>
                  <PanToolOutlinedIcon sx={{ fontSize: '1.5rem', color: '#ea580c' }} />
                </Box>
              </Box>
            </Box>
          )}
        </Box>

        {/* Metric cards */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, mb: 3 }}>
          {metricCards.map(s => (
            <Box key={s.label} data-ai-analyzable="true" data-ai-description={`AML Performance Metric: ${s.label} currently at ${s.value}.`}
              sx={{ bgcolor: 'var(--card-bg)', border: '1px solid var(--border-col)', p: 2.25 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: s.color }} />
                <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em' }}>{s.label}</Typography>
              </Box>
              {metricsLoading ? (
                <Box sx={{ height: 28, width: 56, bgcolor: 'var(--section-bg)', borderRadius: 0.5, animation: 'pulse 1.5s ease-in-out infinite', '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } } }} />
              ) : (
                <Typography sx={{ fontSize: '1.625rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost' }}>{s.value ?? '—'}</Typography>
              )}
            </Box>
          ))}
        </Box>

        {/* Cases table */}
        <Box sx={{ bgcolor: 'var(--card-bg)', border: '1px solid var(--border-col)' }}>

          {/* Table toolbar */}
          <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid var(--border-col)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost' }}>
                {appliedHasInterest ? 'Interest Requests Queue' : 'Active Case Queue'}
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
                {casesLoading ? 'Loading…' : `${total} case${total !== 1 ? 's' : ''} · ${appliedHasInterest ? 'cases with pending member interest' : CASE_SORT_OPTIONS.find(s => s.key === appliedSort)?.label ?? 'Newest first'}`}
              </Typography>
            </Box>
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
          </Box>

          {/* Filter bar */}
          <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid var(--border-col)', display: 'flex', alignItems: 'center', gap: 2 }}>
            <Stack direction="row" gap={0.5}>
              {STATUS_TABS.map(tab => (
                <Box key={tab.value} onClick={() => { setStatusFilter(tab.value); setPage(1) }} sx={{
                  px: 1.75, py: 0.875, fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'Jost',
                  color: statusFilter === tab.value ? colorPalette.primary : '#64748b',
                  bgcolor: statusFilter === tab.value ? `${colorPalette.primary}0a` : 'transparent',
                  transition: 'all 0.15s',
                  '&:hover': { bgcolor: statusFilter === tab.value ? `${colorPalette.primary}0f` : 'var(--section-bg)' },
                }}>
                  {tab.label}
                </Box>
              ))}
            </Stack>
            <Box sx={{ flex: 1 }} />
            <DateRangeFilter value={range} onChange={v => { setRange(v); setPage(1) }} options={['7d', '30d', '90d', 'ytd', 'custom']} compact />
            {/* Search + filter icon grouped so they never wrap apart */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0, flexShrink: 0 }}>
              <Box sx={{
                display: 'flex', alignItems: 'center', gap: 1,
                bgcolor: 'var(--card-bg)', px: 1.5, height: 32, minWidth: 220,
                border: '1px solid transparent', borderRight: 'none', transition: 'all 0.18s',
                '&:focus-within': { bgcolor: 'var(--card-bg)', borderColor: colorPalette.primary },
              }}>
                <SearchOutlinedIcon sx={{ fontSize: '1rem', color: '#94a3b8' }} />
                <InputBase
                  value={draftSearch}
                  onChange={e => handleSearchChange(e.target.value)}
                  placeholder="Search by case ID or title…"
                  sx={{ flex: 1, fontSize: '0.8125rem', fontFamily: 'Jost', color: 'var(--heading-color)' }}
                />
              </Box>
              <Box sx={{ position: 'relative', display: 'inline-flex', flexShrink: 0, height: 32, bgcolor: 'var(--card-bg)', border: '1px solid transparent', alignItems: 'center' }}>
                <IconButton ref={filterBtnRef} disableRipple onClick={openCaseFilter}
                  sx={{ borderRadius: 0, height: 32, width: 36, color: caseFilterCount > 0 ? colorPalette.primary : '#64748b', '&:hover': { color: colorPalette.primary } }}>
                  <FilterListRoundedIcon sx={{ fontSize: '1.125rem' }} />
                </IconButton>
                {caseFilterCount > 0 && (
                  <Box sx={{ position: 'absolute', top: 6, right: 6, width: 7, height: 7, bgcolor: colorPalette.primary, borderRadius: '50%', pointerEvents: 'none' }} />
                )}
              </Box>
            </Box>
          </Box>

          {/* Active filter chips */}
          {caseFilterCount > 0 && (
            <Box sx={{ bgcolor: 'var(--section-bg)', borderBottom: '1px solid var(--border-col)', px: 2, py: 1, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', mr: 0.5 }}>Filters:</Typography>
              {priorityFilter && (
                <Chip label={`Priority: ${priorityFilter}`} size="small" onDelete={() => { setPriorityFilter(''); setPage(1) }} deleteIcon={<CloseRoundedIcon />}
                  sx={{ bgcolor: `${colorPalette.primary}0f`, color: colorPalette.primary, fontWeight: 600, fontSize: '0.6875rem', borderRadius: 0, height: 20, '& .MuiChip-label': { px: 1 }, '& .MuiChip-deleteIcon': { fontSize: '0.75rem', color: colorPalette.primary } }} />
              )}
              {appliedRisk !== 'any' && (
                <Chip label={`Risk: ${CASE_RISK_OPTIONS.find(r => r.key === appliedRisk)?.label}`} size="small" onDelete={() => { setAppliedRisk('any'); setPage(1) }} deleteIcon={<CloseRoundedIcon />}
                  sx={{ bgcolor: `${colorPalette.primary}0f`, color: colorPalette.primary, fontWeight: 600, fontSize: '0.6875rem', borderRadius: 0, height: 20, '& .MuiChip-label': { px: 1 }, '& .MuiChip-deleteIcon': { fontSize: '0.75rem', color: colorPalette.primary } }} />
              )}
              {appliedSort !== 'recent' && (
                <Chip label={`Sort: ${CASE_SORT_OPTIONS.find(s => s.key === appliedSort)?.label}`} size="small" onDelete={() => { setAppliedSort('recent'); setPage(1) }} deleteIcon={<CloseRoundedIcon />}
                  sx={{ bgcolor: `${colorPalette.primary}0f`, color: colorPalette.primary, fontWeight: 600, fontSize: '0.6875rem', borderRadius: 0, height: 20, '& .MuiChip-label': { px: 1 }, '& .MuiChip-deleteIcon': { fontSize: '0.75rem', color: colorPalette.primary } }} />
              )}
              {assignFilter !== 'all' && (
                <Chip label={assignFilterLabel(assignFilter) ?? 'Assigned'} size="small" onDelete={() => { setAssignFilter('all'); setPage(1) }} deleteIcon={<CloseRoundedIcon />}
                  sx={{ bgcolor: `${colorPalette.primary}0f`, color: colorPalette.primary, fontWeight: 600, fontSize: '0.6875rem', borderRadius: 0, height: 20, '& .MuiChip-label': { px: 1 }, '& .MuiChip-deleteIcon': { fontSize: '0.75rem', color: colorPalette.primary } }} />
              )}
              {appliedHasInterest && (
                <Chip label="Has Interest Requests" size="small" onDelete={() => { setAppliedHasInterest(false); setPage(1) }} deleteIcon={<CloseRoundedIcon />}
                  sx={{ bgcolor: '#fff7ed', color: '#ea580c', fontWeight: 600, fontSize: '0.6875rem', borderRadius: 0, height: 20, '& .MuiChip-label': { px: 1 }, '& .MuiChip-deleteIcon': { fontSize: '0.75rem', color: '#ea580c' } }} />
              )}
              <Box sx={{ flex: 1 }} />
              <Box onClick={() => { setPriorityFilter(''); setAppliedRisk('any'); setAppliedSort('recent'); setAssignFilter('all'); setAppliedHasInterest(false); setPage(1) }}
                sx={{ fontSize: '0.6875rem', color: '#94a3b8', cursor: 'pointer', '&:hover': { color: 'var(--on-surface-variant)' } }}>
                Clear all
              </Box>
            </Box>
          )}

          {/* Column headers */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '16px 130px 1fr 78px 82px 90px 100px 110px 82px', gap: 2, px: 3, py: 1.25, borderBottom: '1px solid var(--border-col)', bgcolor: 'var(--card-bg)' }}>
            <Box />
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
              <Typography sx={{ fontSize: '0.9375rem', fontWeight: 600, color: '#94a3b8', fontFamily: 'Jost', mb: 0.5 }}>No cases found</Typography>
              <Typography sx={{ fontSize: '0.8125rem', color: '#cbd5e1' }}>
                {search || statusFilter || priorityFilter || appliedRisk !== 'any' || assignFilter !== 'all'
                  ? 'Try adjusting filters'
                  : 'Create a new case to get started'}
              </Typography>
            </Box>
          )}

          {/* Case rows */}
          {!casesLoading && cases.map((c, i) => {
            const sla  = slaDisplay(c.slaDeadline, c.status)
            const sCfg = STATUS_CFG[c.status] ?? STATUS_CFG.open
            const pCfg = PRIORITY_CFG[c.priority] ?? PRIORITY_CFG.medium
            return (
              <Box
                key={c.id}
                onClick={() => openWorkspace(c)}
                data-ai-analyzable="true"
                data-ai-description={`AML Investigation: Case ${c.id} for "${c.title}". Priority: ${c.priority}. Risk Score: ${c.riskScore}. SLA: ${sla.label}. Status: ${c.status}. Typology: ${c.typology}.`}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '16px 130px 1fr 78px 82px 90px 100px 110px 82px',
                  gap: 2, px: 3, py: 1.75,
                  borderBottom: i < cases.length - 1 ? '1px solid var(--border-col)' : 'none',
                  borderLeft: !c.seen ? `3px solid ${colorPalette.primary}` : '3px solid transparent',
                  bgcolor: !c.seen ? `${colorPalette.primary}03` : 'transparent',
                  cursor: 'pointer', transition: 'background 0.15s',
                  '&:hover': { bgcolor: !c.seen ? `${colorPalette.primary}0a` : 'var(--section-bg)' },
                  alignItems: 'center',
                }}
              >
                {/* Unseen dot */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {!c.seen && <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: colorPalette.primary, flexShrink: 0 }} />}
                </Box>

                <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: colorPalette.primary, fontFamily: 'SF Mono, Monaco, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.id}
                </Typography>

                <Box sx={{ overflow: 'hidden', minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, overflow: 'hidden' }}>
                    <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--heading-color)', fontFamily: 'Jost', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 1 }}>
                      {c.title}
                    </Typography>
                    {isElevated && c.hasPendingInterest && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.375, px: 0.625, py: 0.25, bgcolor: '#fff7ed', border: '1px solid #fdba74', borderRadius: '4px', flexShrink: 0 }}>
                        <PanToolOutlinedIcon sx={{ fontSize: '0.75rem', color: '#ea580c' }} />
                        <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: '#ea580c', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Interest</Typography>
                      </Box>
                    )}
                  </Box>
                  <Typography sx={{ fontSize: '0.6875rem', color: '#64748b', mt: 0.125, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.typology}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.625 }}>
                  <Box sx={{ width: 28, height: 4, bgcolor: 'var(--section-bg)', position: 'relative', flexShrink: 0 }}>
                    <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${c.riskScore}%`, bgcolor: c.riskScore >= 70 ? '#dc2626' : c.riskScore >= 40 ? '#f59e0b' : '#10b981' }} />
                  </Box>
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--heading-color)' }}>{c.riskScore}</Typography>
                </Box>

                <Box sx={{ px: 0.875, py: 0.375, bgcolor: pCfg.bg, border: `1px solid ${pCfg.color}30`, width: 'fit-content' }}>
                  <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: pCfg.color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {pCfg.label}
                  </Typography>
                </Box>

                <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: sla.color }}>{sla.label}</Typography>

                <Typography sx={{ fontSize: '0.75rem', color: '#64748b', fontFamily: 'Jost' }}>
                  {new Intl.DateTimeFormat('en-NG', { month: 'short', day: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: user?.timezone ?? 'Africa/Lagos' }).format(new Date(c.createdAt))}
                </Typography>

                {/* Assignee — shows name if assigned, dash otherwise */}
                <Box>
                  {c.assignedTo ? (
                    <AssigneeAvatar name={c.assigneeName} />
                  ) : (
                    <Typography sx={{ fontSize: '0.6875rem', color: '#cbd5e1', fontStyle: 'italic' }}>Unassigned</Typography>
                  )}
                </Box>

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
            <Box sx={{ px: 3, py: 1.75, borderTop: '1px solid var(--border-col)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>
                Page {page} of {totalPages} · {total} total
              </Typography>
              <Stack direction="row" gap={0.5}>
                {[
                  { icon: <ChevronLeftRoundedIcon sx={{ fontSize: '1.125rem', color: 'var(--on-surface-variant)' }} />, active: page > 1, onClick: () => setPage(p => p - 1) },
                  { icon: <ChevronRightRoundedIcon sx={{ fontSize: '1.125rem', color: 'var(--on-surface-variant)' }} />, active: page < totalPages, onClick: () => setPage(p => p + 1) },
                ].map((btn, i) => (
                  <Box key={i} onClick={btn.active ? btn.onClick : undefined} sx={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 32, height: 32, border: '1px solid var(--border-col)',
                    cursor: btn.active ? 'pointer' : 'not-allowed', opacity: btn.active ? 1 : 0.4,
                    '&:hover': btn.active ? { bgcolor: 'var(--section-bg)' } : {},
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
      <CaseIntakeDrawer open={intakeOpen} onClose={() => setIntakeOpen(false)} onSubmit={handleIntakeSubmit} />

      {/* Case filter popover */}
      <Popover
        open={filterOpen}
        anchorEl={filterBtnRef.current}
        onClose={() => setFilterOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { borderRadius: 0, boxShadow: '0 8px 32px rgba(15,23,42,0.12)', border: '1px solid var(--border-col)', width: 264 } } }}
      >
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost' }}>Filter</Typography>
            <IconButton size="small" disableRipple onClick={() => setFilterOpen(false)} sx={{ borderRadius: 0, color: '#94a3b8', '&:hover': { color: 'var(--on-surface-variant)' }, mr: -0.5 }}>
              <CloseRoundedIcon sx={{ fontSize: '1rem' }} />
            </IconButton>
          </Box>

          {/* Assignment filter */}
          <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 1 }}>Assignment</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.625, mb: 2.5 }}>
            {[
              { key: 'all' as AssignFilter, label: 'All' },
              { key: 'me' as AssignFilter, label: 'Assigned to Me' },
              ...(isElevated ? teamMembers.slice(0, 5).map(m => ({ key: m.id as AssignFilter, label: m.name.split(' ')[0] })) : []),
            ].map(opt => {
              const on = draftAssign === opt.key
              return (
                <Box key={String(opt.key)} onClick={() => setDraftAssign(on && opt.key !== 'all' ? 'all' : opt.key)}
                  sx={{ px: 1.25, py: 0.5, fontSize: '0.75rem', fontWeight: 600, fontFamily: 'Jost', cursor: 'pointer', border: '1px solid', borderColor: on ? colorPalette.primary : '#e2e8f0', color: on ? colorPalette.primary : '#64748b', bgcolor: on ? `${colorPalette.primary}0a` : 'transparent', transition: 'all 0.15s', '&:hover': { borderColor: colorPalette.primary, color: colorPalette.primary } }}>
                  {opt.label}
                </Box>
              )
            })}
          </Box>

          <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 1 }}>Priority</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.625, mb: 2.5 }}>
            {PRIORITY_TABS.map(p => {
              const on = draftPriority === p.value
              return (
                <Box key={p.value} onClick={() => setDraftPriority(on && p.value !== '' ? '' : p.value)}
                  sx={{ px: 1.25, py: 0.5, fontSize: '0.75rem', fontWeight: 600, fontFamily: 'Jost', cursor: 'pointer', border: '1px solid', borderColor: on ? colorPalette.primary : '#e2e8f0', color: on ? colorPalette.primary : '#64748b', bgcolor: on ? `${colorPalette.primary}0a` : 'transparent', transition: 'all 0.15s', '&:hover': { borderColor: colorPalette.primary, color: colorPalette.primary } }}>
                  {p.label}
                </Box>
              )
            })}
          </Box>

          <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 1 }}>Risk Level</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.625, mb: 2.5 }}>
            {CASE_RISK_OPTIONS.map(r => {
              const on = draftRisk === r.key
              return (
                <Box key={r.key} onClick={() => setDraftRisk(r.key)}
                  sx={{ px: 1.25, py: 0.5, fontSize: '0.75rem', fontWeight: 600, fontFamily: 'Jost', cursor: 'pointer', border: '1px solid', borderColor: on ? colorPalette.primary : '#e2e8f0', color: on ? colorPalette.primary : '#64748b', bgcolor: on ? `${colorPalette.primary}0a` : 'transparent', transition: 'all 0.15s', '&:hover': { borderColor: colorPalette.primary, color: colorPalette.primary } }}>
                  {r.label}
                </Box>
              )
            })}
          </Box>

          <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 1 }}>Sort By</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 2.5 }}>
            {CASE_SORT_OPTIONS.map(s => {
              const on = draftSort === s.key
              return (
                <Box key={s.key} onClick={() => setDraftSort(s.key)}
                  sx={{ px: 1.25, py: 0.5, fontSize: '0.75rem', fontWeight: 600, fontFamily: 'Jost', cursor: 'pointer', border: '1px solid', borderColor: on ? colorPalette.primary : '#e2e8f0', color: on ? colorPalette.primary : '#64748b', bgcolor: on ? `${colorPalette.primary}0a` : 'transparent', transition: 'all 0.15s', '&:hover': { borderColor: colorPalette.primary, color: colorPalette.primary } }}>
                  {s.label}
                </Box>
              )
            })}
          </Box>

          {isElevated && (
            <>
              <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 1 }}>Interest Requests</Typography>
              <Box sx={{ mb: 2.5 }}>
                <Box onClick={() => setDraftHasInterest(v => !v)}
                  sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, px: 1.25, py: 0.5, fontSize: '0.75rem', fontWeight: 600, fontFamily: 'Jost', cursor: 'pointer', border: '1px solid', borderColor: draftHasInterest ? '#ea580c' : '#e2e8f0', color: draftHasInterest ? '#ea580c' : '#64748b', bgcolor: draftHasInterest ? '#fff7ed' : 'transparent', transition: 'all 0.15s', '&:hover': { borderColor: '#ea580c', color: '#ea580c' } }}>
                  <PanToolOutlinedIcon sx={{ fontSize: '0.875rem' }} />
                  Has Interest Requests
                </Box>
              </Box>
            </>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, pt: 1.5, borderTop: '1px solid var(--border-col)' }}>
            <Button disableRipple onClick={clearCaseFilter} sx={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600, fontFamily: 'Jost', textTransform: 'none', borderRadius: 0, px: 1.5, minWidth: 0 }}>Clear</Button>
            <Button disableRipple onClick={applyCaseFilter} sx={{ bgcolor: colorPalette.primary, color: '#fff', fontSize: '0.75rem', fontWeight: 600, fontFamily: 'Jost', textTransform: 'none', borderRadius: 0, px: 2, '&:hover': { bgcolor: colorPalette.primary } }}>Apply</Button>
          </Box>
        </Box>
      </Popover>
    </>
  )
}
