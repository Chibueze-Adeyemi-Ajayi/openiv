import {
  Box, Typography, Stack, Button, Chip, CircularProgress,
  Tabs, Tab, IconButton, Drawer, Tooltip, Popover, InputBase, Dialog,
} from '@mui/material'
import { colorPalette } from '@/theme'
import InteractionDetailPanel from '@/components/dashboard/InteractionDetailPanel'
import TransactionDetailPanel from '@/components/dashboard/TransactionDetailPanel'
import CaseIntakeDrawer, { type CaseIntakePayload } from '@/components/dashboard/CaseIntakeDrawer'
import FileReportDialog from '@/components/dashboard/FileReportDialog'
import CustomerRulesPanel from '@/components/dashboard/CustomerRulesPanel'
import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect, useMemo, useCallback, type ReactElement } from 'react'
import { transactionApi, type Transaction } from '@/api/transactions'
import { beamApi, type BeamRecord } from '@/api/beam'
import { customerApi, type Customer } from '@/api/customers'
import { caseApi, type Case } from '@/api/cases'
import { kycApi, type KycCustomer } from '@/api/kyc'
import { analyticsApi } from '@/api/analytics'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined'
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined'
import TuneRoundedIcon from '@mui/icons-material/TuneRounded'
import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined'
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined'
import SmartphoneOutlinedIcon from '@mui/icons-material/SmartphoneOutlined'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import LoginRoundedIcon from '@mui/icons-material/LoginRounded'
import AssignmentIndOutlinedIcon from '@mui/icons-material/AssignmentIndOutlined'
import FilterCenterFocusOutlinedIcon from '@mui/icons-material/FilterCenterFocusOutlined'
import TouchAppOutlinedIcon from '@mui/icons-material/TouchAppOutlined'
import SearchOffRoundedIcon from '@mui/icons-material/SearchOffRounded'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined'
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded'
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import TOTPConfirmation from '@/components/dashboard/TOTPConfirmation'

const PAGE_SIZE = 10

const days  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const hours = Array.from({ length: 24 }, (_, i) => i)

const colorScale = (v: number) => {
  if (v < 0.05) return '#f4f5f7'
  return `rgba(30, 64, 175, ${Math.max(0.1, Math.min(1, v))})`
}

function RiskDonut({ score, color }: { score: number; color: string }) {
  const size = 96, sw = 9, r = (size - sw) / 2
  const cx = size / 2, cy = size / 2
  const circ = 2 * Math.PI * r
  const filled = (Math.min(100, Math.max(0, score)) / 100) * circ
  return (
    <svg width={size} height={size} style={{ display: 'block' }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth={sw} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={sw}
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circ - filled}`}
        transform={`rotate(-90 ${cx} ${cy})`} />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
        fill={color} fontWeight="700" fontSize="22" fontFamily="Jost, sans-serif">
        {score}
      </text>
    </svg>
  )
}

function determineStatus(record: BeamRecord) {
  let score: number | null = null
  try {
    const p = JSON.parse(record.payload)
    score = p.risk_score ?? p.riskScore ?? p.score ?? p.fraud_score ?? null
  } catch {}
  if (score === null) return { label: 'UNSCORED', bg: '#f8fafc', color: '#94a3b8', score: 0 }
  if (score >= 70) return { label: 'FRAUDULENT', bg: '#fef2f2', color: '#dc2626', score }
  if (score >= 40) return { label: 'SUSPICIOUS', bg: '#fffbeb', color: '#f59e0b', score }
  return { label: 'NORMAL', bg: '#f0fdf4', color: '#10b981', score }
}

const PageBtn = ({ label, disabled, onClick, active }: { label: string | number; disabled?: boolean; onClick: () => void; active: boolean }) => (
  <Button disabled={disabled} onClick={onClick} sx={{ minWidth: typeof label === 'number' ? 32 : 'auto', px: typeof label === 'number' ? 0 : 1.5, height: 32, bgcolor: active ? '#f1f5f9' : 'transparent', color: active ? '#00288e' : '#64748b', fontSize: '0.8125rem', fontWeight: active ? 700 : 600, fontFamily: 'Jost', borderRadius: 1, textTransform: 'none', '&:hover': { bgcolor: 'var(--section-bg)', color: 'var(--heading-color)' } }}>
    {label}
  </Button>
)

function maskId(val: string | null | undefined, keep = 4): string {
  if (!val) return '—'
  if (val.length <= keep) return val
  return val.slice(0, keep) + '****'
}


export default function UserProfilePage() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState(0)
  const [txPage, setTxPage] = useState(1)
  const [beamPage, setBeamPage] = useState(1)

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [beams, setBeams] = useState<BeamRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [detailBeam, setDetailBeam] = useState<BeamRecord | null>(null)
  const [detailTx, setDetailTx] = useState<Transaction | null>(null)
  const [tTotal, setTTotal] = useState(0)
  const [bTotal, setBTotal] = useState(0)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [kyc, setKyc] = useState<KycCustomer | null>(null)
  const [tHeatmap, setTHeatmap] = useState<number[][] | null>(null)
  const [heatmapRange, setHeatmapRange] = useState('90d')

  const [cases,         setCases]         = useState<Case[]>([])
  const [caseTotal,     setCaseTotal]     = useState(0)
  const [casesLoading,  setCasesLoading]  = useState(true)

  const [caseOpen,       setCaseOpen]       = useState(false)
  const [reportOpen,     setReportOpen]     = useState(false)
  const [rulesDrawerOpen, setRulesDrawerOpen] = useState(false)

  const handleCaseSubmit = useCallback(async (payload: CaseIntakePayload) => {
    await caseApi.create(payload.caseInput)
    setCaseOpen(false)
  }, [])

  // ── Streaming state ───────────────────────────────────────────────────────
  const [riskAnchor, setRiskAnchor]       = useState<HTMLElement | null>(null)
  const [rescreening, setRescreening]     = useState(false)
  const [rescreenError, setRescreenError] = useState<string | null>(null)
  const [resolveOpen, setResolveOpen]           = useState(false)
  const [resolveTarget, setResolveTarget]       = useState<{ type: string; detail: string } | null>(null)
  const [resolveNote, setResolveNote]           = useState('')
  const [resolving, setResolving]               = useState(false)
  const [resolveError, setResolveError]         = useState<string | null>(null)
  const [resolveTotpOpen, setResolveTotpOpen]   = useState(false)
  const [photoLightboxOpen, setPhotoLightboxOpen] = useState(false)


  const handleRescreen = useCallback(async () => {
    setRescreening(true)
    setRescreenError(null)
    try {
      await customerApi.rescreen(id)
      const res = await customerApi.getCustomer(id).catch(() => null)
      setCustomer(res)
    } catch (e: any) {
      setRescreenError(e?.message ?? 'Re-evaluation failed')
    } finally {
      setRescreening(false)
    }
  }, [id])

  const handleResolveStep = useCallback(async (resolution: 'pass' | 'fail') => {
    if (!resolveTarget || !id) return
    setResolving(true)
    setResolveError(null)
    try {
      const updated = await customerApi.resolveStep(id, {
        type: resolveTarget.type,
        resolution,
        score: resolution === 'pass' ? 80 : 10,
        note: resolveNote.trim() || 'Manually reviewed and resolved by compliance officer',
      })
      setCustomer(updated)
      setResolveOpen(false)
      setResolveTarget(null)
      setResolveNote('')
    } catch (e: any) {
      setResolveError(e?.message ?? 'Failed to resolve step')
    } finally {
      setResolving(false)
    }
  }, [resolveTarget, resolveNote, id])

  const loadKyc = useCallback(async () => {
    const [custRes, kycRes] = await Promise.all([
      customerApi.getCustomer(id).catch(() => null),
      kycApi.getCustomerKyc(id).catch(() => null),
    ])
    setCustomer(custRes)
    setKyc(kycRes)
  }, [id])

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [txnRes, beamRes, heatRes] = await Promise.all([
        transactionApi.list({ q: id, pageSize: 10, page: txPage }),
        beamApi.listRecords({ q: id, pageSize: 10, page: beamPage }),
        analyticsApi.getUserHeatmap(id, heatmapRange).catch(() => null),
      ])
      setTransactions(txnRes.transactions)
      setTTotal(txnRes.total)
      setBeams(beamRes.records)
      setBTotal(beamRes.total)
      setTHeatmap(heatRes?.transactions ?? null)
      await loadKyc()
    } catch (e) {
      console.error('Failed to load profile data', e)
    } finally {
      setLoading(false)
    }
  }, [id, txPage, beamPage, heatmapRange, loadKyc])

  useEffect(() => { load() }, [load])

  // Auto-refresh while CDD workflow is still processing (no step scores yet)
  useEffect(() => {
    if (!id) return
    const hasCddData = (customer?.cddStepScores?.length ?? 0) > 0 || customer?.cddRiskScore != null
    if (hasCddData) return
    const timer = setInterval(async () => {
      const res = await customerApi.getCustomer(id).catch(() => null)
      if (res && ((res.cddStepScores?.length ?? 0) > 0 || res.cddRiskScore != null)) {
        setCustomer(res)
        clearInterval(timer)
      }
    }, 3000)
    return () => clearInterval(timer)
  }, [id, customer?.cddStepScores?.length, customer?.cddRiskScore])

  useEffect(() => {
    if (!id) return
    setCasesLoading(true)
    caseApi.list({ q: id, pageSize: 50 })
      .then(res => { setCases(res.cases); setCaseTotal(res.total) })
      .catch(() => {})
      .finally(() => setCasesLoading(false))
  }, [id])


  // ── Derived display values ────────────────────────────────────────────────
  const displayName = useMemo(() => {
    if (kyc?.firstName || kyc?.lastName) return [kyc?.firstName, kyc?.lastName].filter(Boolean).join(' ')
    if (customer?.name && customer.name !== 'Unknown') return customer.name
    if (transactions.length > 0) return transactions[0].customer
    if (beams.length > 0) {
      try { const p = JSON.parse(beams[0].payload); if (p.name || p.user_name) return p.name || p.user_name } catch { }
    }
    return id
  }, [kyc, customer, transactions, beams, id])

  const lastIp = useMemo(() => beams.length > 0 ? (beams[0].ip || '—') : '—', [beams])
  const overallRisk = customer?.cddRiskScore ?? null

  const timeline = useMemo(() => {
    const items: any[] = []
    transactions.forEach(t => {
      const statusLabel = t.status === 'successful' ? 'Completed' : t.status === 'failed' ? 'Failed' : 'Pending'
      const riskLabel = t.risk >= 70 ? 'High risk' : t.risk >= 40 ? 'Medium risk' : 'Low risk'
      const recipient = t.recipientName || t.counterparty || 'unknown recipient'
      items.push({
        type: 'tx', time: new Date(t.occurredAt || new Date()).getTime(),
        icon: <ReceiptLongOutlinedIcon />,
        color: t.risk >= 70 ? '#dc2626' : colorPalette.primary,
        title: `₦${t.amount.toLocaleString()} sent to ${recipient}`,
        detail: `${statusLabel} · via ${t.channel || 'transfer'} · ${riskLabel}${t.flaggedStatus ? ` · ${t.flaggedStatus}` : ''}`,
        raw: t,
      })
    })
    beams.forEach(b => {
      let p: any = {}
      try { p = JSON.parse(b.payload) } catch { }
      const st = determineStatus(b)
      const streamLabel: Record<string, { icon: ReactElement; label: string }> = {
        logins:      { icon: <LoginRoundedIcon />,       label: 'Login' },
        location:    { icon: <LocationOnOutlinedIcon />, label: 'Location update' },
        devices:     { icon: <SmartphoneOutlinedIcon />, label: 'Device activity' },
      }
      const sl = streamLabel[b.stream] ?? { icon: <TouchAppOutlinedIcon />, label: b.stream.replace(/_/g, ' ') }
      const action = String(p.activity_name || p.action || p.event || sl.label).replace(/_/g, ' ')
      const note = p.note || p.location || p.device_name || b.ip || null
      items.push({
        type: 'beam', time: new Date(b.receivedAt).getTime(),
        icon: sl.icon,
        color: st.score >= 70 ? '#dc2626' : st.score >= 40 ? '#f59e0b' : '#10b981',
        title: action.charAt(0).toUpperCase() + action.slice(1),
        detail: [sl.label !== action ? sl.label : null, note].filter(Boolean).join(' · ') || 'No additional details',
        raw: b,
      })
    })
    items.sort((a, b) => b.time - a.time)
    return items
  }, [transactions, beams])

  if (loading && !transactions.length && !beams.length && !customer && !kyc) {
    return <Box sx={{ p: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh' }}><CircularProgress sx={{ color: colorPalette.primary }} /></Box>
  }

  const idRecordPhoto = kyc?.identityPhoto || customer?.identityPhoto || null
  const photo         = customer?.selfiePhoto || customer?.photo || null
  const initials    = displayName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()
  const txPages     = Math.max(1, Math.ceil(tTotal / PAGE_SIZE))
  const beamPages   = Math.max(1, Math.ceil(bTotal / PAGE_SIZE))
  const riskColor = overallRisk == null ? '#64748b' : overallRisk >= 70 ? '#dc2626' : overallRisk >= 40 ? '#f59e0b' : '#10b981'

  return (
    <>
      <Box sx={{ p: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Box onClick={() => navigate(-1)} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: '#64748b', fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Jost', cursor: 'pointer', '&:hover': { color: colorPalette.primary } }}>
            <ArrowBackRoundedIcon sx={{ fontSize: '1rem' }} />
            Back
          </Box>
        </Box>


        {!loading && !customer && transactions.length === 0 && beams.length === 0 ? (
          <Box sx={{ bgcolor: 'var(--card-bg)', border: '1px solid var(--border-col)', py: 12, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Box sx={{ width: 80, height: 80, borderRadius: '50%', bgcolor: 'var(--section-bg)', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 3 }}><SearchOffRoundedIcon sx={{ fontSize: '2.5rem' }} /></Box>
            <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost', mb: 1 }}>Customer Not Found</Typography>
            <Typography sx={{ fontSize: '0.875rem', color: '#64748b', maxWidth: 400, mb: 4 }}>No records found for <Typography component="span" sx={{ fontWeight: 700, color: 'var(--heading-color)' }}>"{id}"</Typography>.</Typography>
            <Button variant="contained" onClick={() => navigate(-1)} sx={{ bgcolor: colorPalette.primary, borderRadius: 0, px: 4, py: 1.25, fontWeight: 700, fontFamily: 'Jost', '&:hover': { bgcolor: colorPalette.primary, opacity: 0.9 } }}>GO BACK</Button>
          </Box>
        ) : (
          <>
            {/* ── Header ── */}
            <Box sx={{ bgcolor: 'var(--card-bg)', border: '1px solid var(--border-col)', mb: 3, p: 3, display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
              <Box sx={{ width: 80, height: 80, borderRadius: '50%', overflow: 'hidden', bgcolor: colorPalette.primary, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {photo
                  ? <Box component="img" src={photo.startsWith('data:') || photo.startsWith('http') ? photo : `data:image/jpeg;base64,${photo}`} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <Typography sx={{ fontSize: '1.75rem', fontWeight: 700, color: '#ffffff', fontFamily: 'Jost' }}>{initials}</Typography>
                }
              </Box>
              <Box sx={{ flex: 1, minWidth: 280 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1, flexWrap: 'wrap' }}>
                  <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost', letterSpacing: '-0.015em' }}>{displayName}</Typography>
                </Box>
                <Stack direction="row" gap={3} flexWrap="wrap" sx={{ mb: 2 }}>
                  {[
                    { label: 'Customer ID',   value: id },
                    { label: 'BVN',           value: maskId(customer?.bvn, 6) },
                    { label: 'NIN',           value: maskId(customer?.nin, 4) },
                    { label: 'Phone',         value: kyc?.phone || customer?.phone || '—' },
                    { label: 'Date of Birth', value: kyc?.dateOfBirth || customer?.dob || '—' },
                    { label: 'Last IP',       value: lastIp },
                  ].map(d => (
                    <Box key={d.label}>
                      <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.25 }}>{d.label}</Typography>
                      <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--heading-color)', fontFamily: 'SF Mono, Monaco, monospace' }}>{d.value}</Typography>
                    </Box>
                  ))}
                </Stack>
                <Stack direction="row" gap={1}>
                  <Button
                    onClick={() => setCaseOpen(true)}
                    startIcon={<GavelOutlinedIcon sx={{ fontSize: '0.875rem !important' }} />}
                    sx={{ bgcolor: colorPalette.primary, color: '#ffffff', fontFamily: 'Jost', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'none', borderRadius: 0, px: 2, py: 0.875, '&:hover': { bgcolor: 'var(--on-surface)' } }}
                  >
                    Open Case
                  </Button>
                  <Button
                    onClick={() => setReportOpen(true)}
                    startIcon={<AssignmentOutlinedIcon sx={{ fontSize: '0.875rem !important' }} />}
                    sx={{ bgcolor: '#ffffff', color: '#dc2626', border: '1px solid #fecaca', fontFamily: 'Jost', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'none', borderRadius: 0, px: 2, py: 0.875, '&:hover': { bgcolor: '#fef2f2' } }}
                  >
                    File Report
                  </Button>
                  <Button
                    onClick={() => setRulesDrawerOpen(true)}
                    startIcon={<TuneRoundedIcon sx={{ fontSize: '0.875rem !important' }} />}
                    sx={{ bgcolor: '#ffffff', color: '#7c3aed', border: '1px solid #ddd6fe', fontFamily: 'Jost', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'none', borderRadius: 0, px: 2, py: 0.875, '&:hover': { bgcolor: '#f5f3ff' } }}
                  >
                    Impose Limit
                  </Button>
                </Stack>
              </Box>
              {overallRisk != null && (
                <Box sx={{ px: 3, py: 1, borderLeft: '1px solid var(--border-col)', textAlign: 'center', minWidth: 120 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.75 }}>
                    <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                      Risk Score
                    </Typography>
                    <IconButton size="small" onClick={e => setRiskAnchor(e.currentTarget)}
                      sx={{ p: 0.25, color: '#94a3b8', '&:hover': { color: colorPalette.primary } }}>
                      <HelpOutlineRoundedIcon sx={{ fontSize: '0.875rem' }} />
                    </IconButton>
                  </Box>
                  <RiskDonut score={overallRisk} color={riskColor} />
                  <Popover
                    open={Boolean(riskAnchor)} anchorEl={riskAnchor}
                    onClose={() => setRiskAnchor(null)}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'center' }}
                    PaperProps={{ sx: { p: 2.5, maxWidth: 360, borderRadius: 1, boxShadow: '0 4px 24px rgba(0,0,0,0.10)' } }}
                  >
                    <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost', mb: 1 }}>
                      How is this score calculated?
                    </Typography>
                    <Typography sx={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)', lineHeight: 1.75, mb: 1.5 }}>
                      This score (0–100) blends three signals to give a complete picture of this customer's risk:
                    </Typography>
                    <Box sx={{ bgcolor: 'var(--section-bg)', border: '1px solid var(--border-col)', p: 1.5, mb: 1.5 }}>
                      {[
                        {
                          label: 'KYC Score', weight: '20%', value: customer?.riskScore,
                          desc: 'The result of identity checks — BVN/NIN matching, phone verification, liveness detection, and PEP screening.',
                        },
                        {
                          label: 'Case History Score', weight: '55%', value: customer?.riskProfileScore,
                          desc: 'The average risk level of all investigation cases ever opened for this customer — open cases and closed cases where suspicious activity was confirmed. Cases cleared as innocent are not counted.',
                        },
                        {
                          label: 'Transaction Behaviour Score', weight: '25%', value: customer?.transactionRiskScore,
                          desc: 'How often this customer\'s transactions are flagged, adjusted by how serious those flags are. A customer with many high-risk flagged transactions scores higher than one with occasional minor flags.',
                        },
                      ].map((row, i, arr) => (
                        <Box key={row.label} sx={{ mb: i < arr.length - 1 ? 1.5 : 0 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--on-surface-variant)' }}>
                              {row.label}{' '}
                              <Typography component="span" sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>({row.weight})</Typography>
                            </Typography>
                            <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: riskColor }}>{row.value ?? '—'}</Typography>
                          </Box>
                          <Typography sx={{ fontSize: '0.75rem', color: '#64748b', lineHeight: 1.6 }}>{row.desc}</Typography>
                        </Box>
                      ))}
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pt: 1, borderTop: '1px solid var(--border-col)' }}>
                      <Typography sx={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)' }}>
                        Combined score <Typography component="span" sx={{ fontSize: '0.6875rem', color: '#94a3b8' }}>(20% + 55% + 25%)</Typography>
                      </Typography>
                      <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: riskColor, fontFamily: 'Jost' }}>{overallRisk}</Typography>
                    </Box>
                  </Popover>
                </Box>
              )}
            </Box>

            {/* ── Screening & Verification (merged KYC + CDD card) ── */}
            <Box sx={{ bgcolor: 'var(--card-bg)', border: '1px solid var(--border-col)', mb: 3 }}>

              {/* Card header */}
              <Box sx={{ px: 3, pt: 2.5, pb: 2, borderBottom: '1px solid var(--border-col)', display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <FilterCenterFocusOutlinedIcon sx={{ color: colorPalette.primary, fontSize: '1.25rem' }} />
                <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost' }}>Screening & Verification</Typography>
                {customer?.cddRiskScore != null && (
                  <Chip
                    label={`CDD ${customer.cddRiskScore}`}
                    size="small"
                    sx={{
                      borderRadius: 0, height: 22, fontWeight: 700, fontSize: '0.6875rem',
                      bgcolor: customer.cddRiskScore >= 70 ? '#fef2f2' : customer.cddRiskScore >= 40 ? '#fffbeb' : '#f0fdf4',
                      color:   customer.cddRiskScore >= 70 ? '#dc2626' : customer.cddRiskScore >= 40 ? '#f59e0b' : '#10b981',
                    }}
                  />
                )}
                {/* Verification check chips — merged CDD steps + kyc fallback. Failed/unprocessed → TOTP → resolve */}
                {(customer || kyc) && (() => {
                  const CHIP_DEFS: { type: string; label: string; kycStatus: string | null; kycScore: number | null; kycDetail: string }[] = [
                    { type: 'identity_verify',      label: 'ID',      kycStatus: kyc?.bvnNinStatus ?? null,   kycScore: kyc?.bvnNinScore ?? null,   kycDetail: kyc?.bvnNinDetail ?? 'Not processed' },
                    { type: 'liveness_match',       label: 'FaceRec', kycStatus: kyc?.livenessStatus ?? null, kycScore: kyc?.livenessScore ?? null, kycDetail: kyc?.livenessDetail ?? 'Not processed' },
                    { type: 'phone_basic',          label: 'Phone',   kycStatus: kyc?.phoneStatus ?? null,    kycScore: kyc?.phoneScore ?? null,    kycDetail: kyc?.phoneDetail ?? 'Not processed' },
                    { type: 'phone_fraud',          label: 'Fraud',   kycStatus: null,                         kycScore: null,                        kycDetail: 'Not processed' },
                    { type: 'pep_sanctions_screen', label: 'PEP',     kycStatus: kyc?.pepStatus ?? null,      kycScore: kyc?.pepScore ?? null,      kycDetail: kyc?.pepDetail ?? 'Not processed' },
                    { type: 'flagged_transactions', label: 'Txn',     kycStatus: null,                         kycScore: null,                        kycDetail: 'Not processed' },
                    { type: 'case_history',         label: 'Cases',   kycStatus: null,                         kycScore: null,                        kycDetail: 'Not processed' },
                  ]
                  const cddMap: Record<string, { status: string; score: number | null; detail: string }> = {}
                  for (const s of customer?.cddStepScores ?? []) cddMap[s.type] = { status: s.status, score: s.score, detail: s.detail }

                  const chips = CHIP_DEFS.map(def => {
                    const cdd = cddMap[def.type]
                    if (cdd) return { ...def, status: cdd.status, score: cdd.score, detail: cdd.detail }
                    const ks = def.kycStatus
                    const status = ks === 'pass' ? 'pass' : ks === 'match' ? 'match' : ks === 'not_found' ? 'not_found' : 'skipped'
                    return { ...def, status, score: def.kycScore, detail: def.kycDetail }
                  })

                  return (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, ml: 0.5 }}>
                      {chips.map((chip, i) => {
                        const canResolve = chip.status !== 'pass'
                        const isFail = chip.status === 'match'
                        const isWarn = chip.status === 'not_found'
                        const isPass = chip.status === 'pass'
                        const bg = isFail ? '#fee2e2' : isWarn ? '#fef9c3' : isPass ? '#dcfce7' : '#f1f5f9'
                        const fg = isFail ? '#dc2626' : isWarn ? '#d97706' : isPass ? '#16a34a' : '#94a3b8'
                        const sym = isFail ? '✗' : isWarn ? '!' : isPass ? '✓' : '·'
                        const tipText = `${chip.label}: ${chip.status}${chip.score != null ? ` (${chip.score}/100)` : ''}${chip.detail ? ' — ' + chip.detail : ''}${canResolve ? ' · click to resolve' : ''}`
                        return (
                          <Tooltip key={i} title={tipText} placement="bottom" arrow>
                            <Box
                              onClick={canResolve ? () => { setResolveTarget({ type: chip.type, detail: chip.detail }); setResolveNote(''); setResolveError(null); setResolveOpen(true) } : undefined}
                              sx={{ display: 'flex', alignItems: 'center', gap: 0.375, px: 0.75, py: 0.375, bgcolor: bg, cursor: canResolve ? 'pointer' : 'default', border: `1px solid ${canResolve ? fg + '50' : 'transparent'}`, '&:hover': canResolve ? { bgcolor: fg + '18' } : {} }}
                            >
                              <Typography sx={{ fontSize: '0.5rem', fontWeight: 900, color: fg, lineHeight: 1 }}>{sym}</Typography>
                              <Typography sx={{ fontSize: '0.5rem', fontWeight: 700, color: fg, lineHeight: 1, letterSpacing: '0.02em' }}>{chip.label}</Typography>
                            </Box>
                          </Tooltip>
                        )
                      })}
                    </Box>
                  )
                })()}
              </Box>


              {/* ── Verification Checks ── */}
              {(() => {
                const CHECKS: {
                  type: string
                  label: string
                  description: string
                  kycStatus: string | null
                  kycScore: number | null
                  kycDetail: string | null
                }[] = [
                  { type: 'identity_verify',      label: 'Identity Verification',     description: 'BVN / NIN matching against government records',         kycStatus: kyc?.bvnNinStatus ?? null,   kycScore: kyc?.bvnNinScore ?? null,   kycDetail: kyc?.bvnNinDetail ?? null },
                  { type: 'liveness_match',       label: 'Facial Recognition',        description: 'Biometric selfie-to-ID photo comparison',              kycStatus: kyc?.livenessStatus ?? null, kycScore: kyc?.livenessScore ?? null, kycDetail: kyc?.livenessDetail ?? null },
                  { type: 'phone_basic',          label: 'Phone Number Lookup',       description: 'Carrier-level verification and identity linkage',        kycStatus: kyc?.phoneStatus ?? null,    kycScore: kyc?.phoneScore ?? null,    kycDetail: kyc?.phoneDetail ?? null },
                  { type: 'phone_fraud',          label: 'Phone Fraud Intelligence',  description: 'SIM-swap, fraud signals and telco risk indicators',      kycStatus: null,                         kycScore: null,                        kycDetail: null },
                  { type: 'pep_sanctions_screen', label: 'PEP & Sanctions Screen',    description: 'Global PEP databases and sanctions watchlists (CBN/OFAC)', kycStatus: kyc?.pepStatus ?? null,    kycScore: kyc?.pepScore ?? null,      kycDetail: kyc?.pepDetail ?? null },
                  { type: 'flagged_transactions', label: 'Flagged Transactions',      description: 'AML rule hits and suspicious transaction patterns',      kycStatus: null,                         kycScore: null,                        kycDetail: null },
                  { type: 'case_history',         label: 'Case History',              description: 'Open and historical investigation cases on this customer', kycStatus: null,                       kycScore: null,                        kycDetail: null },
                ]

                const cddMap: Record<string, { status: string; score: number | null; detail: string; manualOverride?: boolean; preserved?: boolean; isConcern?: boolean; dobMismatch?: boolean }> = {}
                for (const s of customer?.cddStepScores ?? []) {
                  if (s.type !== 'case') cddMap[s.type] = { status: s.status, score: s.score, detail: s.detail, manualOverride: (s as any).manualOverride, preserved: (s as any).preserved, isConcern: s.isConcern, dobMismatch: s.dobMismatch }
                }

                const rows = CHECKS.map(c => {
                  const cdd = cddMap[c.type]
                  if (cdd) return { ...c, status: cdd.status, score: cdd.score, detail: cdd.detail, manualOverride: cdd.manualOverride, preserved: cdd.preserved, isConcern: cdd.isConcern, dobMismatch: cdd.dobMismatch, fromCdd: true }
                  const ks = c.kycStatus
                  const status = ks === 'pass' ? 'pass' : ks === 'match' ? 'match' : ks === 'not_found' ? 'not_found' : 'skipped'
                  return { ...c, status, score: c.kycScore, detail: c.kycDetail, manualOverride: false, preserved: false, isConcern: false, dobMismatch: false, fromCdd: false }
                })

                const STATUS_META: Record<string, { color: string; bg: string; border: string; label: string; sym: string }> = {
                  pass:      { color: '#15803d', bg: '#f0fdf4', border: '#16a34a', label: 'PASSED',       sym: '✓' },
                  match:     { color: '#b91c1c', bg: '#fff5f5', border: '#dc2626', label: 'FAILED',       sym: '✗' },
                  not_found: { color: '#92400e', bg: '#fffbeb', border: '#f59e0b', label: 'NOT FOUND',    sym: '?' },
                  skipped:   { color: '#64748b', bg: 'var(--section-bg)', border: '#e2e8f0', label: 'NOT VERIFIED', sym: '–' },
                  error:     { color: '#9a3412', bg: '#fff7ed', border: '#ea580c', label: 'ERROR',        sym: '!' },
                }

                const hasEvaluation = rows.some(r => r.status !== 'skipped')
                const evalDate = customer?.lastEvaluatedAt
                  ? new Date(customer.lastEvaluatedAt).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })
                  : null

                return (
                  <Box>
                    {/* Sub-header */}
                    <Box sx={{ px: 3, pt: 2, pb: 1.5, display: 'flex', alignItems: 'center', gap: 1, borderBottom: '1px solid var(--border-col)' }}>
                      <AssignmentIndOutlinedIcon sx={{ color: colorPalette.primary, fontSize: '0.875rem' }} />
                      <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', flex: 1 }}>
                        Verification Checks
                        {evalDate && <Box component="span" sx={{ fontWeight: 400, ml: 1, textTransform: 'none', letterSpacing: 0, color: '#94a3b8' }}>· {evalDate}</Box>}
                      </Typography>
                      {!hasEvaluation && (
                        <Typography sx={{ fontSize: '0.625rem', fontWeight: 600, color: '#94a3b8', fontStyle: 'italic' }}>Awaiting CDD workflow run</Typography>
                      )}
                    </Box>

                    {rescreenError && (
                      <Box sx={{ mx: 3, mt: 1.5, p: 1.25, bgcolor: '#fef2f2', border: '1px solid #fecaca' }}>
                        <Typography sx={{ fontSize: '0.75rem', color: '#dc2626' }}>{rescreenError}</Typography>
                      </Box>
                    )}

                    {/* Check rows */}
                    {rows.map((row, i) => {
                      const sm = STATUS_META[row.status] ?? STATUS_META.skipped
                      const canResolve = row.status !== 'pass'
                      const isLast = i === rows.length - 1
                      const detailText = row.detail ?? row.description

                      return (
                        <Box
                          key={row.type}
                          sx={{
                            display: 'flex', alignItems: 'stretch', gap: 0,
                            borderBottom: isLast ? 'none' : '1px solid var(--border-col)',
                            borderLeft: `3px solid ${sm.border}`,
                            bgcolor: sm.bg,
                            transition: 'background 0.15s',
                          }}
                        >
                          {/* Status icon column */}
                          <Box sx={{ width: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, py: 1.75 }}>
                            <Box sx={{
                              width: 26, height: 26, borderRadius: '50%',
                              bgcolor: row.status === 'skipped' ? '#f1f5f9' : sm.border + '22',
                              border: `1.5px solid ${row.status === 'skipped' ? '#e2e8f0' : sm.border + '66'}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              <Typography sx={{ fontSize: '0.625rem', fontWeight: 900, color: sm.color, lineHeight: 1 }}>{sm.sym}</Typography>
                            </Box>
                          </Box>

                          {/* Content */}
                          <Box sx={{ flex: 1, minWidth: 0, py: 1.75, pr: 2 }}>
                            {/* Name row */}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.25, flexWrap: 'wrap' }}>
                              <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: row.status === 'skipped' ? '#94a3b8' : 'var(--heading-color)', lineHeight: 1.3 }}>
                                {row.label}
                              </Typography>
                              {row.isConcern && <WarningAmberRoundedIcon sx={{ fontSize: '0.75rem', color: '#f59e0b' }} />}
                              {row.dobMismatch && (
                                <Tooltip title="DOB sent does not match phone record" placement="top" arrow>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, px: 0.5, py: 0.125, bgcolor: '#fff7ed', border: '1px solid #fed7aa' }}>
                                    <WarningAmberRoundedIcon sx={{ fontSize: '0.625rem', color: '#ea580c' }} />
                                    <Typography sx={{ fontSize: '0.4375rem', fontWeight: 700, color: '#ea580c', letterSpacing: '0.04em' }}>DOB MISMATCH</Typography>
                                  </Box>
                                </Tooltip>
                              )}
                              {row.manualOverride && (
                                <Chip label="MANUAL OVERRIDE" size="small" sx={{ bgcolor: '#eff6ff', color: '#1d4ed8', fontSize: '0.4375rem', height: 15, borderRadius: 0, fontWeight: 700, letterSpacing: '0.04em' }} />
                              )}
                              {row.preserved && (
                                <Chip label="PRIOR RUN" size="small" sx={{ bgcolor: '#f5f3ff', color: '#7c3aed', fontSize: '0.4375rem', height: 15, borderRadius: 0, fontWeight: 700 }} />
                              )}
                            </Box>

                            {/* Detail text */}
                            <Typography sx={{ fontSize: '0.75rem', color: row.status === 'skipped' ? '#94a3b8' : '#475569', lineHeight: 1.5, wordBreak: 'break-word' }}>
                              {row.status === 'skipped' ? row.description : detailText}
                            </Typography>

                            {/* Score bar */}
                            {row.score != null && row.status !== 'skipped' && (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.875 }}>
                                <Box sx={{ flex: 1, height: 3, bgcolor: '#e2e8f0', overflow: 'hidden' }}>
                                  <Box sx={{ width: `${row.score}%`, height: '100%', bgcolor: row.score >= 70 ? '#16a34a' : row.score >= 40 ? '#f59e0b' : '#dc2626', transition: 'width 0.5s ease' }} />
                                </Box>
                                <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: row.score >= 70 ? '#16a34a' : row.score >= 40 ? '#f59e0b' : '#dc2626', fontFamily: 'SF Mono, Monaco, monospace', flexShrink: 0, minWidth: 36, textAlign: 'right' }}>
                                  {row.score}/100
                                </Typography>
                              </Box>
                            )}
                          </Box>

                          {/* Right column: badge + resolve */}
                          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', gap: 0.75, pr: 2.5, py: 1.75, flexShrink: 0, minWidth: 120 }}>
                            <Box sx={{ px: 1, py: 0.25, bgcolor: row.status === 'skipped' ? '#f1f5f9' : sm.border + '18', border: `1px solid ${row.status === 'skipped' ? '#e2e8f0' : sm.border + '44'}` }}>
                              <Typography sx={{ fontSize: '0.4375rem', fontWeight: 800, color: sm.color, letterSpacing: '0.07em', lineHeight: 1.6 }}>{sm.label}</Typography>
                            </Box>
                            {canResolve && (
                              <Box
                                component="button"
                                onClick={() => { setResolveTarget({ type: row.type, detail: detailText }); setResolveNote(''); setResolveError(null); setResolveOpen(true) }}
                                sx={{
                                  display: 'flex', alignItems: 'center', gap: 0.5,
                                  px: 1, py: 0.375, border: `1px solid ${colorPalette.primary}55`,
                                  bgcolor: 'transparent', color: colorPalette.primary,
                                  fontSize: '0.5625rem', fontWeight: 700, fontFamily: 'Jost',
                                  cursor: 'pointer', letterSpacing: '0.04em',
                                  '&:hover': { bgcolor: `${colorPalette.primary}10`, borderColor: colorPalette.primary },
                                }}
                              >
                                <PlayArrowRoundedIcon sx={{ fontSize: '0.625rem' }} />
                                Resolve
                              </Box>
                            )}
                          </Box>
                        </Box>
                      )
                    })}

                    {/* Concerns strip */}
                    {customer?.cddConcerns && customer.cddConcerns.length > 0 && (
                      <Box sx={{ borderTop: '1px solid var(--border-col)', px: 3, pt: 1.5, pb: 2 }}>
                        <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1 }}>Compliance Concerns</Typography>
                        {customer.cddConcerns.map((concern, i) => (
                          <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, p: 1.25, mb: 0.75, bgcolor: concern.type === 'not_found' ? '#fffbeb' : '#fef2f2', borderLeft: `3px solid ${concern.type === 'not_found' ? '#f59e0b' : '#dc2626'}` }}>
                            <WarningAmberRoundedIcon sx={{ fontSize: '0.875rem', color: concern.type === 'not_found' ? '#f59e0b' : '#dc2626', mt: 0.125, flexShrink: 0 }} />
                            <Box sx={{ flex: 1 }}>
                              <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--heading-color)', textTransform: 'capitalize' }}>
                                {concern.type.replace(/_/g, ' ')} — {concern.field}
                              </Typography>
                              <Typography sx={{ fontSize: '0.6875rem', color: '#475569', lineHeight: 1.5, mt: 0.25 }}>{concern.message}</Typography>
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    )}
                  </Box>
                )
              })()}
            </Box>

            {/* ── Resolve TOTP gate ── */}
            {resolveTotpOpen && resolveTarget && (
              <TOTPConfirmation
                open
                title="Authenticate to Approve"
                description={
                  `Biometric authentication is required to manually approve this verification check. ` +
                  `This action will be recorded in the compliance audit trail for ${displayName}.`
                }
                operation="update"
                resourceType="Verification Check"
                resourceName={resolveTarget.type.replace(/_/g, ' ')}
                onConfirm={async () => {
                  setResolveTotpOpen(false)
                  await handleResolveStep('pass')
                }}
                onClose={() => setResolveTotpOpen(false)}
              />
            )}

            {/* ── Step resolve drawer ── */}
            <Drawer anchor="right" open={resolveOpen} onClose={() => !resolving && setResolveOpen(false)}
              PaperProps={{ sx: { width: 400, p: 0, bgcolor: 'var(--card-bg)', borderLeft: '1px solid var(--border-col)' } }}>
              <Box sx={{ px: 3, py: 2.5, borderBottom: '1px solid var(--border-col)', display: 'flex', alignItems: 'center', gap: 1 }}>
                <WarningAmberRoundedIcon sx={{ color: '#d97706', fontSize: '1.25rem' }} />
                <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost', flex: 1 }}>
                  {{
                    liveness_match: 'Resolve Facial Recognition Check',
                    phone_basic:    'Resolve Phone Lookup',
                    phone_fraud:    'Resolve Phone Fraud Check',
                  }[resolveTarget?.type ?? ''] ?? 'Resolve Check'}
                </Typography>
                <IconButton size="small" onClick={() => setResolveOpen(false)} disabled={resolving} sx={{ color: '#64748b' }}>
                  <CancelOutlinedIcon sx={{ fontSize: '1.25rem' }} />
                </IconButton>
              </Box>

              <Box sx={{ p: 3, flex: 1, overflowY: 'auto' }}>
                {/* Identity photo comparison for liveness */}
                {resolveTarget?.type === 'liveness_match' && (
                  <Box sx={{ mb: 2.5 }}>
                    <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1 }}>
                      Photo Comparison — Submitted vs NIN/BVN Record
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1.5, mb: 1.5 }}>
                      {/* Submitted selfie — selfiePhoto fields first; customer.photo is the selfie when selfie_photo is unpopulated */}
                      <Box sx={{ flex: 1, border: '1px solid var(--border-col)', overflow: 'hidden', bgcolor: 'var(--section-bg)', cursor: (kyc?.selfiePhoto || customer?.selfiePhoto || customer?.photo) ? 'zoom-in' : 'default' }} onClick={() => (kyc?.selfiePhoto || customer?.selfiePhoto || customer?.photo) && setPhotoLightboxOpen(true)}>
                        {(kyc?.selfiePhoto || customer?.selfiePhoto || customer?.photo) ? (
                          <Box
                            component="img"
                            src={(() => { const s = kyc?.selfiePhoto || customer?.selfiePhoto || customer?.photo || ''; return s.startsWith('data:') || s.startsWith('http') ? s : `data:image/jpeg;base64,${s}` })()}
                            sx={{ width: '100%', display: 'block', objectFit: 'cover', minHeight: 120 }}
                          />
                        ) : (
                          <Box sx={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>No photo uploaded</Typography>
                          </Box>
                        )}
                        <Box sx={{ px: 1, py: 0.5, bgcolor: '#eff6ff', borderTop: '1px solid #bfdbfe' }}>
                          <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Customer Uploaded</Typography>
                        </Box>
                      </Box>
                      {/* NIN / BVN record photo — kyc.identityPhoto (pipeline) or customer.identityPhoto (CDD-only) */}
                      <Box sx={{ flex: 1, border: '1px solid var(--border-col)', overflow: 'hidden', bgcolor: 'var(--section-bg)', cursor: idRecordPhoto ? 'zoom-in' : 'default' }} onClick={() => idRecordPhoto && setPhotoLightboxOpen(true)}>
                        {idRecordPhoto ? (
                          <Box
                            component="img"
                            src={idRecordPhoto.startsWith('data:') || idRecordPhoto.startsWith('http') ? idRecordPhoto : `data:image/jpeg;base64,${idRecordPhoto}`}
                            sx={{ width: '100%', display: 'block', objectFit: 'cover', minHeight: 120 }}
                          />
                        ) : (
                          <Box sx={{ height: 140, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                            <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>No photo from NIN/BVN record</Typography>
                            <Typography sx={{ fontSize: '0.625rem', color: '#cbd5e1' }}>Not returned by identity lookup</Typography>
                          </Box>
                        )}
                        <Box sx={{ px: 1, py: 0.5, bgcolor: 'var(--section-bg)', borderTop: '1px solid var(--border-col)' }}>
                          <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>NIN / BVN Record Photo</Typography>
                        </Box>
                      </Box>
                    </Box>
                    {/* Request Live Call — coming soon */}
                    <Box
                      sx={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        p: 1.25, border: '1px dashed #cbd5e1', bgcolor: '#f8fafc',
                      }}
                    >
                      <Box>
                        <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', fontFamily: 'Jost' }}>
                          Request Live Call
                        </Typography>
                        <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', mt: 0.25 }}>
                          Trigger a 1-on-1 video call with the customer to confirm identity in real time.
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5, flexShrink: 0, ml: 2 }}>
                        <Box sx={{ px: 0.75, py: 0.2, bgcolor: '#fef9c3', border: '1px solid #fde68a' }}>
                          <Typography sx={{ fontSize: '0.4375rem', fontWeight: 800, color: '#854d0e', letterSpacing: '0.1em' }}>COMING SOON</Typography>
                        </Box>
                        <Button
                          disabled
                          size="small"
                          sx={{ borderRadius: 0, textTransform: 'none', fontFamily: 'Jost', fontWeight: 600, fontSize: '0.75rem', px: 1.5, py: 0.5, border: '1px solid #e2e8f0', color: '#94a3b8', bgcolor: 'transparent', '&.Mui-disabled': { color: '#94a3b8', border: '1px solid #e2e8f0' } }}
                        >
                          Request Call
                        </Button>
                      </Box>
                    </Box>
                  </Box>
                )}

                {/* BVN / NIN submitted values for identity check */}
                {resolveTarget?.type === 'identity_verify' && (
                  <Box sx={{ mb: 2.5 }}>
                    <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1 }}>
                      Submitted Identity Data
                    </Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                      {([
                        { label: 'BVN', value: customer?.bvn },
                        { label: 'NIN', value: customer?.nin },
                      ] as const).map(({ label, value }) => (
                        <Box key={label} sx={{ p: 1.25, border: '1px solid var(--border-col)', bgcolor: 'var(--section-bg)' }}>
                          <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.5 }}>{label}</Typography>
                          <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'SF Mono, Monaco, monospace' }}>
                            {value || '—'}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                )}

                {/* Submitted phone for phone checks */}
                {(resolveTarget?.type === 'phone_basic' || resolveTarget?.type === 'phone_fraud') && (
                  <Box sx={{ mb: 2.5 }}>
                    <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1 }}>
                      Submitted Phone Number
                    </Typography>
                    <Box sx={{ p: 1.25, border: '1px solid var(--border-col)', bgcolor: 'var(--section-bg)' }}>
                      <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'SF Mono, Monaco, monospace' }}>
                        {kyc?.phone || customer?.phone || '—'}
                      </Typography>
                    </Box>
                  </Box>
                )}

                {/* Failure detail */}
                <Box sx={{ mb: 2, p: 1.5, bgcolor: '#fef2f2', border: '1px solid #fecaca' }}>
                  <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#dc2626', mb: 0.5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>What Failed</Typography>
                  <Typography sx={{ fontSize: '0.8125rem', color: '#7f1d1d', lineHeight: 1.5 }}>{resolveTarget?.detail}</Typography>
                </Box>

                <Box sx={{ mb: 1.5, p: 1.5, bgcolor: '#fffbeb', border: '1px solid #fde68a' }}>
                  <Typography sx={{ fontSize: '0.75rem', color: '#78350f', lineHeight: 1.5 }}>
                    Only override this check if you have independently verified the customer's identity — for example, by inspecting their original ID document in person or via a video call.
                    This override will be recorded in the audit trail.
                  </Typography>
                </Box>

                <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.75 }}>Reason for Override *</Typography>
                <InputBase
                  multiline
                  minRows={3}
                  placeholder="e.g. Customer presented original NIN slip at branch on 16 Jun 2026 — identity confirmed by compliance officer John Doe."
                  value={resolveNote}
                  onChange={e => setResolveNote(e.target.value)}
                  disabled={resolving}
                  sx={{ width: '100%', p: 1.25, fontSize: '0.8125rem', bgcolor: 'var(--section-bg)', border: '1px solid var(--border-col)', borderRadius: 0, lineHeight: 1.6, '&.Mui-focused': { borderColor: colorPalette.primary }, mb: 2 }}
                />

                {resolveError && (
                  <Box sx={{ mb: 1.5, p: 1.25, bgcolor: '#fef2f2', border: '1px solid #fecaca' }}>
                    <Typography sx={{ fontSize: '0.75rem', color: '#dc2626' }}>{resolveError}</Typography>
                  </Box>
                )}
              </Box>

              <Box sx={{ px: 3, py: 2, borderTop: '1px solid var(--border-col)', display: 'flex', gap: 1 }}>
                <Button
                  onClick={() => setResolveTotpOpen(true)}
                  disabled={resolving || !resolveNote.trim()}
                  fullWidth
                  sx={{ borderRadius: 0, textTransform: 'none', fontFamily: 'Jost', fontWeight: 700, fontSize: '0.8125rem', py: 1, bgcolor: '#16a34a', color: '#fff', '&:hover': { bgcolor: '#15803d' }, '&.Mui-disabled': { bgcolor: '#94a3b8', color: '#fff' } }}
                >
                  {resolving ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : 'Mark as Passed'}
                </Button>
                <Button
                  onClick={() => handleResolveStep('fail')}
                  disabled={resolving || !resolveNote.trim()}
                  fullWidth
                  sx={{ borderRadius: 0, textTransform: 'none', fontFamily: 'Jost', fontWeight: 700, fontSize: '0.8125rem', py: 1, bgcolor: '#dc2626', color: '#fff', '&:hover': { bgcolor: '#b91c1c' }, '&.Mui-disabled': { bgcolor: '#94a3b8', color: '#fff' } }}
                >
                  {resolving ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : 'Confirm Failed'}
                </Button>
              </Box>
            </Drawer>

            {/* ── Transaction Heatmap ── */}
            {tHeatmap && (
              <Box sx={{ bgcolor: 'var(--card-bg)', border: '1px solid var(--border-col)', mb: 3 }}>
                <Box sx={{ px: 3, py: 2, borderBottom: '1px solid var(--border-col)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost' }}>Transaction Heatmap</Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>When does this customer move money? ({heatmapRange})</Typography>
                  </Box>
                  <Stack direction="row" gap={0.5}>
                    {['24h', '7d', '30d', '90d'].map(r => (
                      <Box key={r} onClick={() => setHeatmapRange(r)} sx={{ px: 1, py: 0.25, fontSize: '0.625rem', fontWeight: 700, cursor: 'pointer', border: '1px solid', borderColor: heatmapRange === r ? colorPalette.primary : '#e2e8f0', color: heatmapRange === r ? colorPalette.primary : '#64748b', bgcolor: heatmapRange === r ? `${colorPalette.primary}0a` : 'transparent', '&:hover': { borderColor: colorPalette.primary, color: colorPalette.primary } }}>
                        {r.toUpperCase()}
                      </Box>
                    ))}
                  </Stack>
                </Box>
                <Box sx={{ p: 3, overflowX: 'auto' }}>
                  <Box sx={{ minWidth: 400 }}>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '40px repeat(24, 1fr)', gap: 0.375, mb: 0.5 }}>
                      <Box />{hours.map(h => <Typography key={h} sx={{ fontSize: '0.625rem', fontWeight: 600, color: '#94a3b8', textAlign: 'center' }}>{h % 3 === 0 ? h : ''}</Typography>)}
                    </Box>
                    {days.map((d, di) => (
                      <Box key={d} sx={{ display: 'grid', gridTemplateColumns: '40px repeat(24, 1fr)', gap: 0.375, mb: 0.375 }}>
                        <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--on-surface-variant)', display: 'flex', alignItems: 'center' }}>{d}</Typography>
                        {hours.map(h => {
                          const val = tHeatmap[di]?.[h] ?? 0
                          const hourStr = h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`
                          return (
                            <Tooltip key={h} title={`${d} ${hourStr} — ${Math.round(val * 100)}%`} arrow placement="top">
                              <Box sx={{ aspectRatio: '1', bgcolor: colorScale(val), cursor: 'default' }} />
                            </Tooltip>
                          )
                        })}
                      </Box>
                    ))}
                  </Box>
                </Box>
              </Box>
            )}

            {/* ── Activity tabs ── */}
            <Box sx={{ bgcolor: 'var(--card-bg)', border: '1px solid var(--border-col)' }}>
              <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs value={activeTab} onChange={(_e, v) => setActiveTab(v)} sx={{ px: 2, minHeight: 48, '& .MuiTab-root': { minHeight: 48, textTransform: 'none', fontWeight: 600, fontFamily: 'Jost', fontSize: '0.875rem', color: '#64748b' }, '& .Mui-selected': { color: `${colorPalette.primary} !important` }, '& .MuiTabs-indicator': { backgroundColor: colorPalette.primary } }}>
                  <Tab label="Unified Timeline" />
                  <Tab label={`Transactions (${tTotal})`} />
                  <Tab label={`Behavioral Patterns (${bTotal})`} />
                  <Tab label={`Cases (${caseTotal})`} />
                </Tabs>
              </Box>
              <Box>
                {activeTab === 0 && (
                  <Stack>
                    {timeline.length === 0
                      ? <Box sx={{ p: 4, textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>No activity recorded yet.</Box>
                      : timeline.map((e, i, arr) => (
                          <Box key={i} onClick={() => e.type === 'beam' ? setDetailBeam(e.raw) : setDetailTx(e.raw)} sx={{ px: 3, py: 1.75, display: 'flex', gap: 1.5, borderBottom: i === arr.length - 1 ? 'none' : '1px solid var(--border-col)', '&:hover': { bgcolor: 'var(--section-bg)' }, cursor: 'pointer' }}>
                            <Box sx={{ minWidth: 100 }}><Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--on-surface-variant)', fontFamily: 'SF Mono, Monaco, monospace' }}>{new Intl.DateTimeFormat('en-NG', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(e.time)}</Typography></Box>
                            <Box sx={{ width: 32, height: 32, bgcolor: `${e.color}15`, color: e.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, '& > svg': { fontSize: '1rem' } }}>{e.icon}</Box>
                            <Box sx={{ flex: 1 }}>
                              <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--heading-color)', fontFamily: 'Jost', mb: 0.25, textTransform: 'capitalize' }}>{e.title}</Typography>
                              <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>{e.detail}</Typography>
                            </Box>
                          </Box>
                        ))
                    }
                  </Stack>
                )}
                {activeTab === 1 && (
                  <Box>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '120px 100px 140px 1fr 100px', gap: 2, px: 3, py: 1.5, bgcolor: 'var(--card-bg)', borderBottom: '1px solid var(--border-col)' }}>
                      {['Time', 'Risk', 'Amount', 'Counterparty', 'Status'].map(h => <Typography key={h} sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>{h}</Typography>)}
                    </Box>
                    {transactions.map(t => (
                      <Box key={t.id} onClick={() => setDetailTx(t)} sx={{ display: 'grid', gridTemplateColumns: '120px 100px 140px 1fr 100px', gap: 2, px: 3, py: 1.75, borderBottom: '1px solid var(--border-col)', cursor: 'pointer', '&:hover': { bgcolor: 'var(--section-bg)' } }}>
                        <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--on-surface-variant)', fontFamily: 'SF Mono, Monaco, monospace' }}>{new Date(t.occurredAt || new Date()).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</Typography>
                        <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: t.risk >= 70 ? '#dc2626' : t.risk >= 40 ? '#f59e0b' : '#10b981' }}>{t.risk}</Typography>
                        <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--heading-color)' }}>₦{t.amount.toLocaleString()}</Typography>
                        <Typography sx={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.recipientName || t.counterparty}</Typography>
                        <Box><Chip label={t.status.toUpperCase()} size="small" sx={{ bgcolor: t.status === 'successful' ? '#f0fdf4' : t.status === 'failed' ? '#fef2f2' : 'var(--section-bg)', color: t.status === 'successful' ? '#16a34a' : t.status === 'failed' ? '#dc2626' : '#64748b', fontWeight: 700, fontSize: '0.625rem', height: 20, borderRadius: 0 }} /></Box>
                      </Box>
                    ))}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, py: 1.5 }}>
                      <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>Page {txPage} of {txPages}</Typography>
                      <Stack direction="row" gap={0.5}>
                        <PageBtn label="Prev" disabled={txPage <= 1} onClick={() => setTxPage(p => p - 1)} active={false} />
                        <PageBtn label="Next" disabled={txPage >= txPages} onClick={() => setTxPage(p => p + 1)} active={false} />
                      </Stack>
                    </Box>
                  </Box>
                )}
                {activeTab === 2 && (
                  <Box>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '130px 110px 130px 1fr 110px', gap: 2, px: 3, py: 1.5, bgcolor: 'var(--card-bg)', borderBottom: '1px solid var(--border-col)' }}>
                      {['Date & Time', 'Assessment', 'Category', 'What Happened', 'IP Address'].map(h => <Typography key={h} sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>{h}</Typography>)}
                    </Box>
                    {beams.length === 0
                      ? <Box sx={{ p: 4, textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>No behavioral activity recorded for this customer.</Box>
                      : <>
                          {beams.map(b => {
                            const st = determineStatus(b)
                            let p: any = {}
                            try { p = JSON.parse(b.payload) } catch { }
                            const action = String(p.activity_name || p.action || p.event || p.note || 'Interaction').replace(/_/g, ' ')
                            const streamLabel: Record<string, string> = {
                              logins: 'Login', location: 'Location', devices: 'Device',
                              transactions: 'Transaction', sessions: 'Session',
                            }
                            const category = streamLabel[b.stream] ?? b.stream.replace(/_/g, ' ')
                            return (
                              <Box key={b.id} onClick={() => setDetailBeam(b)} sx={{ display: 'grid', gridTemplateColumns: '130px 110px 130px 1fr 110px', gap: 2, px: 3, py: 1.75, borderBottom: '1px solid var(--border-col)', cursor: 'pointer', alignItems: 'center', '&:hover': { bgcolor: 'var(--section-bg)' } }}>
                                <Box>
                                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--on-surface-variant)', fontFamily: 'SF Mono, Monaco, monospace' }}>{new Date(b.receivedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</Typography>
                                </Box>
                                <Box sx={{ display: 'inline-flex', px: 1, py: 0.375, bgcolor: st.bg }}>
                                  <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: st.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{st.label}</Typography>
                                </Box>
                                <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--heading-color)', textTransform: 'capitalize' }}>{category}</Typography>
                                <Typography sx={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textTransform: 'capitalize' }}>{action}</Typography>
                                <Typography sx={{ fontSize: '0.75rem', color: '#64748b', fontFamily: 'SF Mono, Monaco, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.ip || '—'}</Typography>
                              </Box>
                            )
                          })}
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, py: 1.5 }}>
                            <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>Page {beamPage} of {beamPages}</Typography>
                            <Stack direction="row" gap={0.5}>
                              <PageBtn label="Prev" disabled={beamPage <= 1} onClick={() => setBeamPage(p => p - 1)} active={false} />
                              <PageBtn label="Next" disabled={beamPage >= beamPages} onClick={() => setBeamPage(p => p + 1)} active={false} />
                            </Stack>
                          </Box>
                        </>
                    }
                  </Box>
                )}
                {activeTab === 3 && (
                  <Box>
                    {casesLoading ? (
                      <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress size={24} sx={{ color: colorPalette.primary }} /></Box>
                    ) : cases.length === 0 ? (
                      <Box sx={{ py: 8, textAlign: 'center' }}>
                        <GavelOutlinedIcon sx={{ fontSize: '2.25rem', color: '#cbd5e1', mb: 1.5 }} />
                        <Typography sx={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--heading-color)', mb: 0.5 }}>No Investigation Cases</Typography>
                        <Typography sx={{ fontSize: '0.8125rem', color: '#64748b' }}>No AML/fraud cases have been opened for this customer yet.</Typography>
                      </Box>
                    ) : (
                      <>
                        <Box sx={{ display: 'grid', gridTemplateColumns: '130px 110px 90px 1fr 110px 130px', gap: 2, px: 3, py: 1.5, bgcolor: 'var(--card-bg)', borderBottom: '1px solid var(--border-col)' }}>
                          {['Opened On', 'Status', 'Priority', 'Case Title', 'Risk Score', 'Assigned To'].map(h => (
                            <Typography key={h} sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>{h}</Typography>
                          ))}
                        </Box>
                        {cases.map((c, i) => {
                          const STATUS_CFG: Record<string, { color: string; bg: string; label: string }> = {
                            open:           { color: '#2563eb', bg: '#eff6ff', label: 'Open' },
                            investigating:  { color: '#7c3aed', bg: '#f5f3ff', label: 'Investigating' },
                            escalated:      { color: '#dc2626', bg: '#fef2f2', label: 'Escalated' },
                            pending_review: { color: '#f59e0b', bg: '#fffbeb', label: 'Pending Review' },
                            closed:         { color: '#10b981', bg: '#f0fdf4', label: 'Closed' },
                          }
                          const PRIORITY_CFG: Record<string, { color: string }> = {
                            low:      { color: '#10b981' },
                            medium:   { color: '#f59e0b' },
                            high:     { color: '#ef4444' },
                            critical: { color: '#7c3aed' },
                          }
                          const sc = STATUS_CFG[c.status] ?? STATUS_CFG.open
                          const pc = PRIORITY_CFG[c.priority] ?? PRIORITY_CFG.medium
                          const rc = c.riskScore >= 70 ? '#dc2626' : c.riskScore >= 40 ? '#f59e0b' : '#10b981'
                          return (
                            <Box
                              key={c.id}
                              onClick={() => navigate(`/dashboard/cases/${c.id}`)}
                              sx={{ display: 'grid', gridTemplateColumns: '130px 110px 90px 1fr 110px 130px', gap: 2, px: 3, py: 1.75, borderBottom: i < cases.length - 1 ? '1px solid var(--border-col)' : 'none', cursor: 'pointer', alignItems: 'center', '&:hover': { bgcolor: 'var(--section-bg)' } }}
                            >
                              <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--on-surface-variant)', fontFamily: 'SF Mono, Monaco, monospace' }}>
                                {new Date(c.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </Typography>
                              <Box sx={{ display: 'inline-flex', px: 1, py: 0.375, bgcolor: sc.bg }}>
                                <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: sc.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{sc.label}</Typography>
                              </Box>
                              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: pc.color, textTransform: 'uppercase' }}>{c.priority}</Typography>
                              <Box sx={{ minWidth: 0 }}>
                                <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--heading-color)', fontFamily: 'Jost', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</Typography>
                                {c.typology && <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textTransform: 'capitalize' }}>{c.typology.replace(/_/g, ' ')}</Typography>}
                              </Box>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                <Box sx={{ flex: 1, height: 4, bgcolor: 'var(--section-bg)', position: 'relative' }}>
                                  <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${c.riskScore}%`, bgcolor: rc }} />
                                </Box>
                                <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: rc, flexShrink: 0 }}>{c.riskScore}</Typography>
                              </Box>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Typography sx={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.assigneeName ?? 'Unassigned'}</Typography>
                                <OpenInNewRoundedIcon sx={{ fontSize: '0.75rem', color: '#94a3b8', flexShrink: 0 }} />
                              </Box>
                            </Box>
                          )
                        })}
                      </>
                    )}
                  </Box>
                )}
              </Box>
            </Box>
          </>
        )}
      </Box>

      <InteractionDetailPanel beam={detailBeam} open={Boolean(detailBeam)} onClose={() => setDetailBeam(null)} />

      <TransactionDetailPanel
        transaction={detailTx}
        open={Boolean(detailTx)}
        onClose={() => setDetailTx(null)}
        onStatusChange={load}
      />

      <CaseIntakeDrawer
        open={caseOpen}
        onClose={() => setCaseOpen(false)}
        onSubmit={handleCaseSubmit}
      />

      <Drawer
        anchor="right"
        open={rulesDrawerOpen}
        onClose={() => setRulesDrawerOpen(false)}
        PaperProps={{ sx: { width: { xs: '100%', sm: 540 }, p: 0 } }}
      >
        <Box sx={{ p: 3, borderBottom: '1px solid var(--border-col)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.14em', mb: 0.25 }}>
              Customer Limits
            </Typography>
            <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost' }}>
              Impose Transaction Limits
            </Typography>
          </Box>
          <IconButton onClick={() => setRulesDrawerOpen(false)} size="small" sx={{ color: '#94a3b8' }}>
            <FilterCenterFocusOutlinedIcon sx={{ fontSize: '1.25rem' }} />
          </IconButton>
        </Box>
        <Box sx={{ p: 3, overflowY: 'auto', flex: 1 }}>
          <CustomerRulesPanel customerId={id} />
        </Box>
      </Drawer>

      <FileReportDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        onFiled={() => setReportOpen(false)}
        defaultType="STR"
        prefill={{
          subjectName:       customer?.name ?? displayName,
          subjectExternalId: id,
          subjectType:       customer?.subjectType ?? 'individual',
          subjectBvn:        customer?.bvn ?? '',
          subjectAccount:    customer?.accountNumber ?? '',
        }}
        prefillLocked
      />

      {/* Photo lightbox — enlarged side-by-side comparison */}
      <Dialog
        open={photoLightboxOpen}
        onClose={() => setPhotoLightboxOpen(false)}
        maxWidth={false}
        PaperProps={{ sx: { bgcolor: '#0f172a', m: 2, borderRadius: 0, maxWidth: '90vw', width: '90vw' } }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2.5, py: 1.5, borderBottom: '1px solid #1e293b' }}>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Photo Comparison
          </Typography>
          <IconButton size="small" onClick={() => setPhotoLightboxOpen(false)} sx={{ color: '#64748b', '&:hover': { color: '#f8fafc' } }}>
            <CancelOutlinedIcon fontSize="small" />
          </IconButton>
        </Box>
        <Box sx={{ display: 'flex', gap: 0, minHeight: '60vh' }}>
          {/* Customer selfie */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid #1e293b' }}>
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2, bgcolor: '#0f172a' }}>
              {(kyc?.selfiePhoto || customer?.selfiePhoto || customer?.photo) ? (
                <Box
                  component="img"
                  src={(() => { const s = kyc?.selfiePhoto || customer?.selfiePhoto || customer?.photo || ''; return s.startsWith('data:') || s.startsWith('http') ? s : `data:image/jpeg;base64,${s}` })()}
                  sx={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', display: 'block' }}
                />
              ) : (
                <Typography sx={{ fontSize: '0.875rem', color: '#475569' }}>No photo uploaded</Typography>
              )}
            </Box>
            <Box sx={{ px: 2, py: 1, bgcolor: '#0f172a', borderTop: '1px solid #1e293b' }}>
              <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Customer Uploaded</Typography>
            </Box>
          </Box>
          {/* NIN/BVN record photo */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2, bgcolor: '#0f172a' }}>
              {idRecordPhoto ? (
                <Box
                  component="img"
                  src={idRecordPhoto.startsWith('data:') || idRecordPhoto.startsWith('http') ? idRecordPhoto : `data:image/jpeg;base64,${idRecordPhoto}`}
                  sx={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', display: 'block' }}
                />
              ) : (
                <Box sx={{ textAlign: 'center' }}>
                  <Typography sx={{ fontSize: '0.875rem', color: '#475569' }}>No photo from NIN/BVN record</Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: '#334155', mt: 0.5 }}>Not returned by identity lookup</Typography>
                </Box>
              )}
            </Box>
            <Box sx={{ px: 2, py: 1, bgcolor: '#0f172a', borderTop: '1px solid #1e293b' }}>
              <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>NIN / BVN Record Photo</Typography>
            </Box>
          </Box>
        </Box>
      </Dialog>
    </>
  )
}
