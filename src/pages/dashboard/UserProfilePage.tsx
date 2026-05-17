import {
  Box, Typography, Stack, Button, Chip, CircularProgress,
  Tabs, Tab, IconButton, Drawer, Tooltip, Popover,
} from '@mui/material'
import { colorPalette } from '@/theme'
import InteractionDetailPanel from '@/components/dashboard/InteractionDetailPanel'
import TransactionDetailPanel from '@/components/dashboard/TransactionDetailPanel'
import CaseIntakeDrawer, { type CaseIntakePayload } from '@/components/dashboard/CaseIntakeDrawer'
import FileReportDialog from '@/components/dashboard/FileReportDialog'
import CustomerRulesPanel from '@/components/dashboard/CustomerRulesPanel'
import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { transactionApi, type Transaction } from '@/api/transactions'
import { beamApi, type BeamRecord } from '@/api/beam'
import { customerApi, type Customer } from '@/api/customers'
import { caseApi, type Case } from '@/api/cases'
import { kycApi, type KycCustomer, streamKycBeam, type KycStepEvent } from '@/api/kyc'
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
import SyncRoundedIcon from '@mui/icons-material/SyncRounded'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'

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
  <Button disabled={disabled} onClick={onClick} sx={{ minWidth: typeof label === 'number' ? 32 : 'auto', px: typeof label === 'number' ? 0 : 1.5, height: 32, bgcolor: active ? '#f1f5f9' : 'transparent', color: active ? '#00288e' : '#64748b', fontSize: '0.8125rem', fontWeight: active ? 700 : 600, fontFamily: 'Jost', borderRadius: 1, textTransform: 'none', '&:hover': { bgcolor: '#f1f5f9', color: '#00288e' } }}>
    {label}
  </Button>
)

function maskId(val: string | null | undefined, keep = 4): string {
  if (!val) return '—'
  if (val.length <= keep) return val
  return val.slice(0, keep) + '****'
}

type PipelineRowState = 'done' | 'running' | 'pending'

function StepRow({ label, status, score, detail, state = 'done' }: {
  label: string; status?: string | null; score?: number | null; detail?: string | null; state?: PipelineRowState
}) {
  if (state === 'running') {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.25, borderBottom: '1px solid #f4f5f7' }}>
        <Box sx={{ flexShrink: 0, display: 'flex' }}><CircularProgress size={14} thickness={4} sx={{ color: colorPalette.primary }} /></Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: '#00288e' }}>{label}</Typography>
          <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8', lineHeight: 1.5 }}>Verifying…</Typography>
        </Box>
      </Box>
    )
  }
  if (state === 'pending') {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.25, borderBottom: '1px solid #f4f5f7', opacity: 0.35 }}>
        <Box sx={{ color: '#94a3b8', flexShrink: 0 }}><HelpOutlineRoundedIcon sx={{ fontSize: '1rem' }} /></Box>
        <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: '#64748b' }}>{label}</Typography>
      </Box>
    )
  }
  const s = status ?? 'unverified'
  const cfg: Record<string, { color: string; bg: string; icon: JSX.Element }> = {
    pass:       { color: '#16a34a', bg: '#f0fdf4', icon: <CheckCircleOutlineRoundedIcon sx={{ fontSize: '1rem' }} /> },
    fail:       { color: '#dc2626', bg: '#fef2f2', icon: <CancelOutlinedIcon sx={{ fontSize: '1rem' }} /> },
    error:      { color: '#f59e0b', bg: '#fffbeb', icon: <WarningAmberRoundedIcon sx={{ fontSize: '1rem' }} /> },
    unverified: { color: '#94a3b8', bg: '#f8fafc', icon: <HelpOutlineRoundedIcon sx={{ fontSize: '1rem' }} /> },
  }
  const c = cfg[s] ?? cfg.unverified
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, py: 1.25, borderBottom: '1px solid #f4f5f7' }}>
      <Box sx={{ color: c.color, mt: 0.125, flexShrink: 0 }}>{c.icon}</Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, mb: 0.25 }}>
          <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: '#00288e' }}>{label}</Typography>
          {score != null && <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: c.color, fontFamily: 'SF Mono, Monaco, monospace', flexShrink: 0 }}>{score}</Typography>}
        </Box>
        {detail && <Typography sx={{ fontSize: '0.75rem', color: '#64748b', lineHeight: 1.5 }}>{detail}</Typography>}
      </Box>
      <Chip label={s.toUpperCase()} size="small" sx={{ bgcolor: c.bg, color: c.color, fontWeight: 700, fontSize: '0.5625rem', height: 18, borderRadius: 0, flexShrink: 0 }} />
    </Box>
  )
}

const PIPELINE_STEPS: { key: 'bvn_nin' | 'phone_match' | 'liveness' | 'pep_check'; label: string }[] = [
  { key: 'bvn_nin',     label: 'Identity (BVN/NIN)' },
  { key: 'phone_match', label: 'Phone Match' },
  { key: 'liveness',    label: 'Liveness Check' },
  { key: 'pep_check',   label: 'PEP Screening' },
]

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
  const [streaming, setStreaming]     = useState(false)
  const [streamSteps, setStreamSteps] = useState<KycStepEvent[]>([])
  const [streamError, setStreamError] = useState<string | null>(null)
  const [riskAnchor, setRiskAnchor]   = useState<HTMLElement | null>(null)

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

  useEffect(() => {
    if (!id) return
    setCasesLoading(true)
    caseApi.list({ q: id, pageSize: 50 })
      .then(res => { setCases(res.cases); setCaseTotal(res.total) })
      .catch(() => {})
      .finally(() => setCasesLoading(false))
  }, [id])

  // ── Run verification stream ───────────────────────────────────────────────
  const handleRunVerification = useCallback(async () => {
    setStreaming(true)
    setStreamSteps([])
    setStreamError(null)

    const payload: Record<string, unknown> = {
      customer_id: id,
      occurred_at: new Date().toISOString(),
    }
    const name = kyc?.firstName || kyc?.lastName
      ? [kyc?.firstName, kyc?.lastName].filter(Boolean).join(' ')
      : customer?.name ?? ''
    if (name) payload.name = name
    if (customer?.bvn)   payload.bvn   = customer.bvn
    if (customer?.nin)   payload.nin   = customer.nin
    if (customer?.phone) payload.phone = customer.phone
    const photo = customer?.photo || kyc?.identityPhoto
    if (photo) payload.photo = photo

    await streamKycBeam(
      payload,
      step => setStreamSteps(prev => [...prev, step]),
      _result => {
        setStreaming(false)
        loadKyc().then(() => {
          setStreamSteps([])
          setStreamError(null)
        })
      },
      err => {
        setStreamError(err)
        setStreaming(false)
      },
    )
  }, [id, customer, kyc, loadKyc])

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
  const overallRisk = customer?.overallRiskScore ?? kyc?.overallRiskScore ?? null

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
      const streamLabel: Record<string, { icon: JSX.Element; label: string }> = {
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

  const photo       = kyc?.identityPhoto || customer?.photo || null
  const initials    = displayName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()
  const txPages     = Math.max(1, Math.ceil(tTotal / PAGE_SIZE))
  const beamPages   = Math.max(1, Math.ceil(bTotal / PAGE_SIZE))
  const tierLabel   = kyc?.kycTier != null ? `TIER ${kyc.kycTier} ${kyc.overallStatus?.toUpperCase() ?? ''}` : null
  const tierColor   = kyc?.overallStatus === 'verified' ? '#10b981' : kyc?.overallStatus === 'flagged' ? '#dc2626' : '#f59e0b'
  const tierBg      = kyc?.overallStatus === 'verified' ? '#f0fdf4'  : kyc?.overallStatus === 'flagged' ? '#fef2f2'  : '#fffbeb'
  const riskColor   = overallRisk == null ? '#64748b' : overallRisk >= 70 ? '#dc2626' : overallRisk >= 40 ? '#f59e0b' : '#10b981'

  const isLiveMode = streaming || streamSteps.length > 0 || streamError != null

  return (
    <>
      <Box sx={{ p: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: kyc && kyc.overallRiskScore >= 70 ? 1.5 : 2 }}>
          <Box onClick={() => navigate(-1)} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: '#64748b', fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Jost', cursor: 'pointer', '&:hover': { color: colorPalette.primary } }}>
            <ArrowBackRoundedIcon sx={{ fontSize: '1rem' }} />
            Back
          </Box>
        </Box>

        {kyc && kyc.overallRiskScore >= 70 && (
          <Box sx={{ bgcolor: '#fef2f2', border: '1px solid #fecaca', px: 2.5, py: 1.5, mb: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <WarningAmberRoundedIcon sx={{ color: '#dc2626', fontSize: '1.25rem', flexShrink: 0 }} />
            <Box>
              <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#991b1b', fontFamily: 'Jost' }}>
                Immediate Action Recommended
              </Typography>
              <Typography sx={{ fontSize: '0.8125rem', color: '#7f1d1d', lineHeight: 1.5 }}>
                KYC risk score is critically high ({kyc.overallRiskScore}/100). Review the pipeline results and consider escalating to a case.
              </Typography>
            </Box>
          </Box>
        )}

        {!loading && !customer && transactions.length === 0 && beams.length === 0 && !kyc ? (
          <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', py: 12, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Box sx={{ width: 80, height: 80, borderRadius: '50%', bgcolor: '#f1f5f9', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 3 }}><SearchOffRoundedIcon sx={{ fontSize: '2.5rem' }} /></Box>
            <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost', mb: 1 }}>Customer Not Found</Typography>
            <Typography sx={{ fontSize: '0.875rem', color: '#64748b', maxWidth: 400, mb: 4 }}>No records found for <Typography component="span" sx={{ fontWeight: 700, color: '#00288e' }}>"{id}"</Typography>.</Typography>
            <Button variant="contained" onClick={() => navigate(-1)} sx={{ bgcolor: colorPalette.primary, borderRadius: 0, px: 4, py: 1.25, fontWeight: 700, fontFamily: 'Jost', '&:hover': { bgcolor: colorPalette.primary, opacity: 0.9 } }}>GO BACK</Button>
          </Box>
        ) : (
          <>
            {/* ── Header ── */}
            <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', mb: 3, p: 3, display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
              <Box sx={{ width: 80, height: 80, borderRadius: '50%', overflow: 'hidden', bgcolor: colorPalette.primary, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {photo
                  ? <Box component="img" src={photo.startsWith('data:') ? photo : `data:image/jpeg;base64,${photo}`} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <Typography sx={{ fontSize: '1.75rem', fontWeight: 700, color: '#ffffff', fontFamily: 'Jost' }}>{initials}</Typography>
                }
              </Box>
              <Box sx={{ flex: 1, minWidth: 280 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1, flexWrap: 'wrap' }}>
                  <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost', letterSpacing: '-0.015em' }}>{displayName}</Typography>
                  {tierLabel && <Chip icon={<VerifiedOutlinedIcon sx={{ fontSize: '0.875rem !important' }} />} label={tierLabel} size="small" sx={{ bgcolor: tierBg, color: tierColor, fontWeight: 700, fontSize: '0.625rem', letterSpacing: '0.1em', borderRadius: 0, height: 22, '& .MuiChip-icon': { color: tierColor, ml: 0.875 } }} />}
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
                      <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#00288e', fontFamily: 'SF Mono, Monaco, monospace' }}>{d.value}</Typography>
                    </Box>
                  ))}
                </Stack>
                <Stack direction="row" gap={1}>
                  <Button
                    onClick={() => setCaseOpen(true)}
                    startIcon={<GavelOutlinedIcon sx={{ fontSize: '0.875rem !important' }} />}
                    sx={{ bgcolor: colorPalette.primary, color: '#ffffff', fontFamily: 'Jost', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'none', borderRadius: 0, px: 2, py: 0.875, '&:hover': { bgcolor: '#1e293b' } }}
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
                <Box sx={{ px: 3, py: 1, borderLeft: '1px solid #eef0f4', textAlign: 'center', minWidth: 120 }}>
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
                    <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost', mb: 1 }}>
                      How is this score calculated?
                    </Typography>
                    <Typography sx={{ fontSize: '0.8125rem', color: '#475569', lineHeight: 1.75, mb: 1.5 }}>
                      This score (0–100) blends three signals to give a complete picture of this customer's risk:
                    </Typography>
                    <Box sx={{ bgcolor: '#f8fafc', border: '1px solid #e2e8f0', p: 1.5, mb: 1.5 }}>
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
                            <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155' }}>
                              {row.label}{' '}
                              <Typography component="span" sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>({row.weight})</Typography>
                            </Typography>
                            <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: riskColor }}>{row.value ?? '—'}</Typography>
                          </Box>
                          <Typography sx={{ fontSize: '0.75rem', color: '#64748b', lineHeight: 1.6 }}>{row.desc}</Typography>
                        </Box>
                      ))}
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pt: 1, borderTop: '1px solid #e2e8f0' }}>
                      <Typography sx={{ fontSize: '0.8125rem', color: '#475569' }}>
                        Combined score <Typography component="span" sx={{ fontSize: '0.6875rem', color: '#94a3b8' }}>(20% + 55% + 25%)</Typography>
                      </Typography>
                      <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: riskColor, fontFamily: 'Jost' }}>{overallRisk}</Typography>
                    </Box>
                  </Popover>
                </Box>
              )}
            </Box>

            {/* ── KYC Identity ── */}
            <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', mb: 3, p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <FilterCenterFocusOutlinedIcon sx={{ color: colorPalette.primary, fontSize: '1.25rem' }} />
                <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost' }}>KYC Identity</Typography>
                {kyc && <Chip label={`Score: ${kyc.overallRiskScore}`} size="small" sx={{ ml: 1, bgcolor: '#f1f5f9', color: riskColor, fontWeight: 700, fontSize: '0.6875rem', borderRadius: 0, height: 22 }} />}
                <Box sx={{ flex: 1 }} />
                <Button
                  onClick={handleRunVerification}
                  disabled={streaming}
                  startIcon={streaming ? <SyncRoundedIcon sx={{ fontSize: '0.875rem !important', animation: 'spin 1s linear infinite', '@keyframes spin': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } } }} /> : <PlayArrowRoundedIcon sx={{ fontSize: '0.875rem !important' }} />}
                  size="small"
                  sx={{ borderRadius: 0, textTransform: 'none', fontFamily: 'Jost', fontWeight: 600, fontSize: '0.8125rem', px: 2, bgcolor: colorPalette.primary, color: '#fff', '&:hover': { bgcolor: '#1e3a8a' }, '&.Mui-disabled': { bgcolor: '#94a3b8', color: '#fff' } }}
                >
                  {streaming ? 'Running…' : 'Run Verification'}
                </Button>
              </Box>
              <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mb: 2 }}>
                {kyc ? `Last verified ${new Date(kyc.runAt).toLocaleString('en-NG', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}` : 'No verification run yet'}
              </Typography>

              {/* Pipeline Results — unified: live during streaming, stored otherwise */}
              {(kyc || isLiveMode) ? (
                <Box sx={{ border: '1px solid #eef0f4', bgcolor: '#f8fafc', p: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: streamError ? 0.75 : 1.5 }}>
                    {streaming
                      ? <CircularProgress size={14} thickness={4} sx={{ color: colorPalette.primary }} />
                      : streamError
                      ? <CancelOutlinedIcon sx={{ fontSize: '1rem', color: '#dc2626' }} />
                      : <AssignmentIndOutlinedIcon sx={{ color: '#10b981', fontSize: '1rem' }} />
                    }
                    <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#00288e', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pipeline Results</Typography>
                    {streamError && (
                      <Button size="small" onClick={() => { setStreamSteps([]); setStreamError(null) }} sx={{ ml: 'auto', fontSize: '0.6875rem', color: '#94a3b8', textTransform: 'none', minWidth: 0, p: 0.5 }}>
                        Clear
                      </Button>
                    )}
                  </Box>
                  {streamError && (
                    <Typography sx={{ fontSize: '0.75rem', color: '#dc2626', mb: 1.5, lineHeight: 1.5 }}>{streamError}</Typography>
                  )}
                  {PIPELINE_STEPS.map(({ key, label }, i) => {
                    if (isLiveMode) {
                      const done = streamSteps.find(s => s.step === key)
                      if (done) return <StepRow key={key} label={label} status={done.status} score={done.stepRiskScore} detail={done.detail} />
                      if (streaming && i === streamSteps.length) return <StepRow key={key} label={label} state="running" />
                      return <StepRow key={key} label={label} state="pending" />
                    }
                    const stored = kyc ? ({
                      bvn_nin:     { status: kyc.bvnNinStatus,   score: kyc.bvnNinScore,   detail: kyc.bvnNinDetail },
                      phone_match: { status: kyc.phoneStatus,    score: kyc.phoneScore,    detail: kyc.phoneDetail },
                      liveness:    { status: kyc.livenessStatus, score: kyc.livenessScore, detail: kyc.livenessDetail },
                      pep_check:   { status: kyc.pepStatus,      score: kyc.pepScore,      detail: kyc.pepDetail },
                    } as Record<string, { status: string | null; score: number | null; detail: string | null }>)[key] : null
                    return <StepRow key={key} label={label} status={stored?.status ?? null} score={stored?.score ?? null} detail={stored?.detail ?? null} />
                  })}
                </Box>
              ) : (
                <Box sx={{ border: '1px solid #eef0f4', bgcolor: '#f8fafc', p: 3, textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>
                  No KYC verification has been run for this customer yet.
                </Box>
              )}
            </Box>


            {/* ── Transaction Heatmap ── */}
            {tHeatmap && (
              <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', mb: 3 }}>
                <Box sx={{ px: 3, py: 2, borderBottom: '1px solid #eef0f4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost' }}>Transaction Heatmap</Typography>
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
                        <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center' }}>{d}</Typography>
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
            <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4' }}>
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
                          <Box key={i} onClick={() => e.type === 'beam' ? setDetailBeam(e.raw) : setDetailTx(e.raw)} sx={{ px: 3, py: 1.75, display: 'flex', gap: 1.5, borderBottom: i === arr.length - 1 ? 'none' : '1px solid #f4f5f7', '&:hover': { bgcolor: '#fafbfc' }, cursor: 'pointer' }}>
                            <Box sx={{ minWidth: 100 }}><Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', fontFamily: 'SF Mono, Monaco, monospace' }}>{new Intl.DateTimeFormat('en-NG', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(e.time)}</Typography></Box>
                            <Box sx={{ width: 32, height: 32, bgcolor: `${e.color}15`, color: e.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, '& > svg': { fontSize: '1rem' } }}>{e.icon}</Box>
                            <Box sx={{ flex: 1 }}>
                              <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#00288e', fontFamily: 'Jost', mb: 0.25, textTransform: 'capitalize' }}>{e.title}</Typography>
                              <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>{e.detail}</Typography>
                            </Box>
                          </Box>
                        ))
                    }
                  </Stack>
                )}
                {activeTab === 1 && (
                  <Box>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '120px 100px 140px 1fr 100px', gap: 2, px: 3, py: 1.5, bgcolor: '#f8fafc', borderBottom: '1px solid #eef0f4' }}>
                      {['Time', 'Risk', 'Amount', 'Counterparty', 'Status'].map(h => <Typography key={h} sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>{h}</Typography>)}
                    </Box>
                    {transactions.map(t => (
                      <Box key={t.id} onClick={() => setDetailTx(t)} sx={{ display: 'grid', gridTemplateColumns: '120px 100px 140px 1fr 100px', gap: 2, px: 3, py: 1.75, borderBottom: '1px solid #f4f5f7', cursor: 'pointer', '&:hover': { bgcolor: '#fafbfc' } }}>
                        <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', fontFamily: 'SF Mono, Monaco, monospace' }}>{new Date(t.occurredAt || new Date()).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</Typography>
                        <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: t.risk >= 70 ? '#dc2626' : t.risk >= 40 ? '#f59e0b' : '#10b981' }}>{t.risk}</Typography>
                        <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: '#00288e' }}>₦{t.amount.toLocaleString()}</Typography>
                        <Typography sx={{ fontSize: '0.8125rem', color: '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.recipientName || t.counterparty}</Typography>
                        <Box><Chip label={t.status.toUpperCase()} size="small" sx={{ bgcolor: t.status === 'successful' ? '#f0fdf4' : t.status === 'failed' ? '#fef2f2' : '#f8fafc', color: t.status === 'successful' ? '#16a34a' : t.status === 'failed' ? '#dc2626' : '#64748b', fontWeight: 700, fontSize: '0.625rem', height: 20, borderRadius: 0 }} /></Box>
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
                    <Box sx={{ display: 'grid', gridTemplateColumns: '130px 110px 130px 1fr 110px', gap: 2, px: 3, py: 1.5, bgcolor: '#f8fafc', borderBottom: '1px solid #eef0f4' }}>
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
                              <Box key={b.id} onClick={() => setDetailBeam(b)} sx={{ display: 'grid', gridTemplateColumns: '130px 110px 130px 1fr 110px', gap: 2, px: 3, py: 1.75, borderBottom: '1px solid #f4f5f7', cursor: 'pointer', alignItems: 'center', '&:hover': { bgcolor: '#fafbfc' } }}>
                                <Box>
                                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', fontFamily: 'SF Mono, Monaco, monospace' }}>{new Date(b.receivedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</Typography>
                                </Box>
                                <Box sx={{ display: 'inline-flex', px: 1, py: 0.375, bgcolor: st.bg }}>
                                  <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: st.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{st.label}</Typography>
                                </Box>
                                <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: '#00288e', textTransform: 'capitalize' }}>{category}</Typography>
                                <Typography sx={{ fontSize: '0.8125rem', color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textTransform: 'capitalize' }}>{action}</Typography>
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
                        <Typography sx={{ fontSize: '0.9375rem', fontWeight: 600, color: '#00288e', mb: 0.5 }}>No Investigation Cases</Typography>
                        <Typography sx={{ fontSize: '0.8125rem', color: '#64748b' }}>No AML/fraud cases have been opened for this customer yet.</Typography>
                      </Box>
                    ) : (
                      <>
                        <Box sx={{ display: 'grid', gridTemplateColumns: '130px 110px 90px 1fr 110px 130px', gap: 2, px: 3, py: 1.5, bgcolor: '#f8fafc', borderBottom: '1px solid #eef0f4' }}>
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
                              sx={{ display: 'grid', gridTemplateColumns: '130px 110px 90px 1fr 110px 130px', gap: 2, px: 3, py: 1.75, borderBottom: i < cases.length - 1 ? '1px solid #f4f5f7' : 'none', cursor: 'pointer', alignItems: 'center', '&:hover': { bgcolor: '#fafbfc' } }}
                            >
                              <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', fontFamily: 'SF Mono, Monaco, monospace' }}>
                                {new Date(c.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </Typography>
                              <Box sx={{ display: 'inline-flex', px: 1, py: 0.375, bgcolor: sc.bg }}>
                                <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: sc.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{sc.label}</Typography>
                              </Box>
                              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: pc.color, textTransform: 'uppercase' }}>{c.priority}</Typography>
                              <Box sx={{ minWidth: 0 }}>
                                <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#00288e', fontFamily: 'Jost', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</Typography>
                                {c.typology && <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textTransform: 'capitalize' }}>{c.typology.replace(/_/g, ' ')}</Typography>}
                              </Box>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                <Box sx={{ flex: 1, height: 4, bgcolor: '#f1f5f9', position: 'relative' }}>
                                  <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${c.riskScore}%`, bgcolor: rc }} />
                                </Box>
                                <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: rc, flexShrink: 0 }}>{c.riskScore}</Typography>
                              </Box>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Typography sx={{ fontSize: '0.75rem', color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.assigneeName ?? 'Unassigned'}</Typography>
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
        <Box sx={{ p: 3, borderBottom: '1px solid #eef0f4', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.14em', mb: 0.25 }}>
              Customer Limits
            </Typography>
            <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost' }}>
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
          subjectName:    customer?.name ?? displayName,
          subjectType:    customer?.subjectType ?? 'individual',
          subjectBvn:     customer?.bvn ?? '',
          subjectAccount: customer?.accountNumber ?? '',
        }}
      />
    </>
  )
}
