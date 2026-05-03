import { Box, Typography, Stack, Button, Chip, CircularProgress, Tabs, Tab, IconButton, Drawer, Tooltip } from '@mui/material'
import { colorPalette } from '@/theme'
import DashboardLayout from '@/components/dashboard/DashboardLayout'
import TOTPConfirmation from '@/components/dashboard/TOTPConfirmation'
import InteractionDetailPanel from '@/components/dashboard/InteractionDetailPanel'
import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { transactionApi, type Transaction } from '@/api/transactions'
import { beamApi, type BeamRecord } from '@/api/beam'
import { analyticsApi, type UserHeatmapResponse } from '@/api/analytics'
import { customerApi, type Customer } from '@/api/customers'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined'
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined'
import SmartphoneOutlinedIcon from '@mui/icons-material/SmartphoneOutlined'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import LoginRoundedIcon from '@mui/icons-material/LoginRounded'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import PhoneInTalkRoundedIcon from '@mui/icons-material/PhoneInTalkRounded'
import AssignmentIndOutlinedIcon from '@mui/icons-material/AssignmentIndOutlined'
import FilterCenterFocusOutlinedIcon from '@mui/icons-material/FilterCenterFocusOutlined'
import TouchAppOutlinedIcon from '@mui/icons-material/TouchAppOutlined'
// import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded'
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded'
import SearchOffRoundedIcon from '@mui/icons-material/SearchOffRounded'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'

const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const hours = Array.from({ length: 24 }, (_, i) => i)
const PAGE_SIZE = 10

const colorScale = (v: number) => {
  if (v < 0.05) return '#f4f5f7'
  const opacity = Math.max(0.1, Math.min(1, v))
  return `rgba(30, 64, 175, ${opacity})`
}

function RadarChart({ data }: { data: { axis: string; value: number }[] }) {
  const size = 260
  const center = size / 2
  const radius = size / 2.8
  const max = 100
  const ticks = [20, 40, 60, 80, 100]

  const getPoint = (value: number, index: number) => {
    const angle = (Math.PI / 2) - (2 * Math.PI * index / data.length)
    const r = (value / max) * radius
    return { x: center + r * Math.cos(angle), y: center - r * Math.sin(angle) }
  }

  const path = data.map((d, i) => getPoint(d.value, i))
  const pathStr = path.map((p, i) => (i === 0 ? `M ${p.x},${p.y}` : `L ${p.x},${p.y}`)).join(' ') + ' Z'

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
      <svg width={size} height={size} style={{ overflow: 'visible' }}>
        {ticks.map(tick => {
          const tickPath = data.map((_, i) => getPoint(tick, i))
          const tickPathStr = tickPath.map((p, i) => (i === 0 ? `M ${p.x},${p.y}` : `L ${p.x},${p.y}`)).join(' ') + ' Z'
          return <path key={tick} d={tickPathStr} fill="none" stroke="#eef0f4" strokeWidth="1" />
        })}
        {data.map((_, i) => {
          const p = getPoint(max, i)
          return <line key={`axis-${i}`} x1={center} y1={center} x2={p.x} y2={p.y} stroke="#eef0f4" strokeWidth="1" />
        })}
        <path d={pathStr} fill="rgba(30, 64, 175, 0.15)" stroke={colorPalette.primary} strokeWidth="2" />
        {path.map((p, i) => (
          <circle key={`pt-${i}`} cx={p.x} cy={p.y} r="4" fill={colorPalette.primary} />
        ))}
        {data.map((d, i) => {
          const p = getPoint(max + 18, i)
          let anchor: 'start' | 'middle' | 'end' | 'inherit' = 'middle'
          if (p.x < center - 10) anchor = 'end'
          if (p.x > center + 10) anchor = 'start'
          return (
            <text key={`label-${i}`} x={p.x} y={p.y + 4} textAnchor={anchor} fill="#475569" fontSize="9px" fontWeight="700" fontFamily="Jost" letterSpacing="0.05em">
              {d.axis.toUpperCase()}
            </text>
          )
        })}
      </svg>
    </Box>
  )
}

function determineStatus(record: BeamRecord) {
  const hash = record.id * 17
  if (hash % 10 === 0) return { label: 'FRAUDULENT', bg: '#fef2f2', color: '#dc2626', score: 85 + (hash % 15) }
  if (hash % 10 === 1 || hash % 10 === 2) return { label: 'SUSPICIOUS', bg: '#fffbeb', color: '#f59e0b', score: 50 + (hash % 30) }
  return { label: 'NORMAL', bg: '#f0fdf4', color: '#10b981', score: 10 + (hash % 30) }
}

const PageBtn = ({ label, disabled, onClick, active }: { label: string | number, disabled?: boolean, onClick: () => void, active: boolean }) => (
  <Button
    disabled={disabled}
    onClick={onClick}
    sx={{
      minWidth: typeof label === 'number' ? 32 : 'auto',
      px: typeof label === 'number' ? 0 : 1.5,
      height: 32,
      bgcolor: active ? '#f1f5f9' : 'transparent',
      color: active ? '#0f172a' : '#64748b',
      fontSize: '0.8125rem',
      fontWeight: active ? 700 : 600,
      fontFamily: 'Jost',
      borderRadius: 1,
      textTransform: 'none',
      '&:hover': { bgcolor: '#f1f5f9', color: '#0f172a' }
    }}
  >
    {label}
  </Button>
)

export default function UserProfilePage() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [freezeOpen, setFreezeOpen] = useState(false)
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

  const [heatmapData, setHeatmapData] = useState<UserHeatmapResponse | null>(null)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loadingHeatmap, setLoadingHeatmap] = useState(true)
  const [heatmapRange, setHeatmapRange] = useState('90d')

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setLoadingHeatmap(true)
    try {
      const [txnRes, beamRes, heatmapRes, custRes] = await Promise.all([
        transactionApi.list({ q: id, pageSize: 10, page: txPage }),
        beamApi.listRecords({ q: id, pageSize: 10, page: beamPage }),
        analyticsApi.getUserHeatmap(id, heatmapRange),
        customerApi.getCustomer(id).catch(() => null)
      ])
      setTransactions(txnRes.transactions)
      setTTotal(txnRes.total)
      setBeams(beamRes.records)
      setBTotal(beamRes.total)
      setHeatmapData(heatmapRes)
      setCustomer(custRes)
    } catch (e) {
      console.error('Failed to load profile data', e)
    } finally {
      setLoading(false)
      setLoadingHeatmap(false)
    }
  }, [id, txPage, beamPage, heatmapRange])

  useEffect(() => { load() }, [load])

  const userDetails = useMemo(() => {
    let name = customer?.name || 'Unknown User'
    let lastIp = '—'
    let bvn = '22148273920'

    if (name === 'Unknown User') {
      if (transactions.length > 0) name = transactions[0].customer
      else if (beams.length > 0) {
        try {
          const p = JSON.parse(beams[0].payload)
          if (p.user_name) name = p.user_name
        } catch { }
      }
    }
    if (beams.length > 0) lastIp = beams[0].ip || '—'
    return { name, lastIp, bvn }
  }, [customer, transactions, beams])

  const timeline = useMemo(() => {
    const items: any[] = []
    transactions.forEach(t => {
      items.push({
        type: 'tx', time: new Date(t.occurredAt).getTime(),
        icon: <ReceiptLongOutlinedIcon />, color: t.risk >= 70 ? '#dc2626' : colorPalette.primary,
        title: `Transfer to ${t.recipientName || t.counterparty}`,
        detail: `₦${t.amount.toLocaleString()} · ${t.status} · Risk: ${t.risk}`,
        raw: t
      })
    })
    beams.forEach(b => {
      let p: any = {}
      try { p = JSON.parse(b.payload) } catch { }
      const st = determineStatus(b)
      let title = p.activity_name || p.action || p.event || 'Interaction'
      let detail = p.note || `Stream: ${b.stream}`

      let icon = <TouchAppOutlinedIcon />
      if (b.stream === 'logins') icon = <LoginRoundedIcon />
      if (b.stream === 'location') icon = <LocationOnOutlinedIcon />
      if (b.stream === 'devices') icon = <SmartphoneOutlinedIcon />

      items.push({
        type: 'beam', time: new Date(b.receivedAt).getTime(),
        icon, color: st.score >= 70 ? '#dc2626' : '#10b981',
        title: String(title).replace(/_/g, ' '), detail,
        raw: b
      })
    })
    items.sort((a, b) => b.time - a.time)
    return items
  }, [transactions, beams])

  const overallRisk = useMemo(() => {
    if (customer) return customer.riskScore
    const txRisks = transactions.slice(0, 5).map(t => t.risk)
    const bRisks = beams.slice(0, 5).map(b => determineStatus(b).score)
    const combined = [...txRisks, ...bRisks]
    if (combined.length === 0) return 15
    const avg = combined.reduce((a, b) => a + b, 0) / combined.length
    return Math.min(100, Math.round(avg + (id.length % 20)))
  }, [customer, transactions, beams, id])

  const riskAxes = [
    { axis: 'Velocity', value: Math.min(100, overallRisk + 10), desc: 'Frequency of actions within a short time' },
    { axis: 'Geolocation', value: Math.max(10, overallRisk - 20), desc: 'Distance from home base or impossible travel' },
    { axis: 'Device Trust', value: overallRisk, desc: 'Reputation and history of the device used' },
    { axis: 'Network', value: Math.min(100, overallRisk + 5), desc: 'IP reputation (VPN, Tor, suspicious ISPs)' },
    { axis: 'Consistency', value: Math.max(10, 100 - overallRisk), desc: 'Deviation from historical habits (Inverse)' },
  ]

  if (loading && !transactions.length && !beams.length) {
    return (
      <DashboardLayout>
        <Box sx={{ p: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh' }}>
          <CircularProgress sx={{ color: colorPalette.primary }} />
        </Box>
      </DashboardLayout>
    )
  }

  const initials = userDetails.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
  const txPages = Math.max(1, Math.ceil(tTotal / PAGE_SIZE))
  const beamPages = Math.max(1, Math.ceil(bTotal / PAGE_SIZE))
  const bHeatmap = heatmapData?.behavioral || Array(7).fill(0).map(() => Array(24).fill(0))
  const tHeatmap = heatmapData?.transactions || Array(7).fill(0).map(() => Array(24).fill(0))

  return (
    <DashboardLayout>
      <Box sx={{ p: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Box
            onClick={() => navigate(-1)}
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: '#64748b', fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Jost', cursor: 'pointer', transition: 'color 0.15s', '&:hover': { color: colorPalette.primary } }}
          >
            <ArrowBackRoundedIcon sx={{ fontSize: '1rem' }} />
            Back to Monitor
          </Box>
        </Box>

        {!loading && !customer && transactions.length === 0 && beams.length === 0 ? (
          <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', py: 12, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Box sx={{ width: 80, height: 80, borderRadius: '50%', bgcolor: '#f1f5f9', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 3 }}>
              <SearchOffRoundedIcon sx={{ fontSize: '2.5rem' }} />
            </Box>
            <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost', mb: 1 }}>
              Customer Not Found
            </Typography>
            <Typography sx={{ fontSize: '0.875rem', color: '#64748b', maxWidth: 400, mb: 4 }}>
              We couldn't find any transactions or behavioral records associated with the ID <Typography component="span" sx={{ fontWeight: 700, color: '#0f172a' }}>"{id}"</Typography>. Please verify the identifier and try again.
            </Typography>
            <Button
              variant="contained"
              onClick={() => navigate(-1)}
              sx={{ bgcolor: colorPalette.primary, borderRadius: 0, px: 4, py: 1.25, fontWeight: 700, fontFamily: 'Jost', '&:hover': { bgcolor: colorPalette.primary, opacity: 0.9 } }}
            >
              GO BACK
            </Button>
          </Box>
        ) : (
          <>
            <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', mb: 3, p: 3, display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
              <Box sx={{ width: 80, height: 80, borderRadius: '50%', bgcolor: colorPalette.primary, color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.75rem', fontWeight: 700, fontFamily: 'Jost', flexShrink: 0 }}>
                {initials}
              </Box>
              <Box sx={{ flex: 1, minWidth: 280 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1 }}>
                  <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost', letterSpacing: '-0.015em' }}>
                    {userDetails.name}
                  </Typography>
                  <Chip icon={<VerifiedOutlinedIcon sx={{ fontSize: '0.875rem !important' }} />} label="TIER 3 VERIFIED" size="small" sx={{ bgcolor: '#f0fdf4', color: '#10b981', fontWeight: 700, fontSize: '0.625rem', letterSpacing: '0.1em', borderRadius: 0, height: 22, '& .MuiChip-icon': { color: '#10b981', ml: 0.875 } }} />
                </Box>
                <Stack direction="row" gap={3}>
                  {[{ label: 'Customer ID', value: id }, { label: 'BVN', value: userDetails.bvn }, { label: 'Last IP', value: userDetails.lastIp }].map((d) => (
                    <Box key={d.label}>
                      <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.25 }}>{d.label}</Typography>
                      <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a', fontFamily: 'SF Mono, Monaco, monospace' }}>{d.value}</Typography>
                    </Box>
                  ))}
                </Stack>
              </Box>

              <Box sx={{ px: 4, py: 1, borderLeft: '1px solid #eef0f4', textAlign: 'center' }}>
                <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.5 }}>Risk Score</Typography>
                <Typography sx={{ fontSize: '2.5rem', fontWeight: 700, color: overallRisk >= 70 ? '#dc2626' : overallRisk >= 40 ? '#f59e0b' : '#10b981', fontFamily: 'Jost', lineHeight: 1 }}>
                  {overallRisk}
                </Typography>
              </Box>

              <Stack direction="row" gap={1}>
                <Button startIcon={<PhoneInTalkRoundedIcon sx={{ fontSize: '1rem !important' }} />} sx={{ bgcolor: '#ffffff', color: '#475569', border: '1px solid #e5e7eb', px: 2, py: 1, fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Jost', borderRadius: 0, textTransform: 'none', '&:hover': { bgcolor: '#f8fafc' } }}>
                  Call
                </Button>
                <Button onClick={() => setFreezeOpen(true)} startIcon={<LockOutlinedIcon sx={{ fontSize: '1rem !important' }} />} sx={{ bgcolor: '#dc2626', color: '#ffffff', px: 2, py: 1, fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Jost', borderRadius: 0, textTransform: 'none', boxShadow: 'none', '&:hover': { bgcolor: '#b91c1c' } }}>
                  Freeze
                </Button>
              </Stack>
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '2.5fr 1fr' }, gap: 3, mb: 3 }}>
              <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', display: 'flex' }}>
                <Box sx={{ p: 3, borderRight: '1px solid #eef0f4', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: 360, flexShrink: 0 }}>
                  <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost', width: '100%', mb: 2 }}>
                    Behavioral Risk Profile
                  </Typography>
                  <RadarChart data={riskAxes} />
                </Box>
                <Box sx={{ p: 3, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 2 }}>
                    Dimension Breakdown
                  </Typography>
                  <Stack gap={2}>
                    {riskAxes.map(r => (
                      <Box key={r.axis}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: '#0f172a' }}>{r.axis}</Typography>
                          <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: r.value >= 70 ? '#dc2626' : r.value >= 40 ? '#f59e0b' : '#10b981' }}>{r.value}/100</Typography>
                        </Box>
                        <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>{r.desc}</Typography>
                      </Box>
                    ))}
                  </Stack>
                </Box>
              </Box>

              <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <FilterCenterFocusOutlinedIcon sx={{ color: colorPalette.primary, fontSize: '1.25rem' }} />
                  <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>KYC Identity</Typography>
                </Box>
                <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mb: 3 }}>Fetched securely via partner webhook</Typography>

                <Box sx={{ border: '1px solid #eef0f4', bgcolor: '#f8fafc', p: 2, mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                    <AssignmentIndOutlinedIcon sx={{ color: '#10b981' }} />
                    <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>NIMC Verification Match</Typography>
                  </Box>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 1.5 }}>
                    <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>NIN</Typography>
                    <Typography sx={{ fontSize: '0.8125rem', color: '#0f172a', fontFamily: 'SF Mono, Monaco, monospace' }}>819382****</Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>DOB Match</Typography>
                    <Typography sx={{ fontSize: '0.8125rem', color: '#10b981', fontWeight: 600 }}>100% Exact</Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Face Match</Typography>
                    <Typography sx={{ fontSize: '0.8125rem', color: '#10b981', fontWeight: 600 }}>98.4% Confidence</Typography>
                  </Box>
                </Box>
              </Box>
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 3, mb: 3 }}>
              <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4' }}>
                <Box sx={{ px: 3, py: 2, borderBottom: '1px solid #eef0f4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>Behavioral Fingerprint</Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>Time-of-day logins and activity ({heatmapRange})</Typography>
                  </Box>
                  <Stack direction="row" gap={0.5}>
                    {['24h', '7d', '30d', '90d'].map(r => (
                      <Box
                        key={r}
                        onClick={() => setHeatmapRange(r)}
                        sx={{
                          px: 1, py: 0.25, fontSize: '0.625rem', fontWeight: 700, cursor: 'pointer',
                          border: '1px solid',
                          borderColor: heatmapRange === r ? colorPalette.primary : '#e2e8f0',
                          color: heatmapRange === r ? colorPalette.primary : '#64748b',
                          bgcolor: heatmapRange === r ? `${colorPalette.primary}0a` : 'transparent',
                          '&:hover': { borderColor: colorPalette.primary, color: colorPalette.primary }
                        }}
                      >
                        {r.toUpperCase()}
                      </Box>
                    ))}
                  </Stack>
                </Box>
                <Box sx={{ p: 3, overflowX: 'auto', position: 'relative', minHeight: 180 }}>
                  {loadingHeatmap && (
                    <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(255,255,255,0.6)', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8' }}>Analyzing patterns…</Typography>
                    </Box>
                  )}
                  <Box sx={{ minWidth: 400 }}>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '40px repeat(24, 1fr)', gap: 0.375, mb: 0.5 }}>
                      <Box />{hours.map((h) => <Typography key={h} sx={{ fontSize: '0.625rem', fontWeight: 600, color: '#94a3b8', textAlign: 'center' }}>{h % 3 === 0 ? h : ''}</Typography>)}
                    </Box>
                    {days.map((d, di) => (
                      <Box key={d} sx={{ display: 'grid', gridTemplateColumns: '40px repeat(24, 1fr)', gap: 0.375, mb: 0.375 }}>
                        <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center' }}>{d}</Typography>
                        {hours.map((h) => {
                          const val = bHeatmap[di][h]
                          const hourStr = h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`
                          return (
                            <Tooltip key={h} title={`${d} ${hourStr} - Activity: ${Math.round(val * 100)}%`} arrow placement="top">
                              <Box sx={{ aspectRatio: '1', bgcolor: colorScale(val), cursor: 'pointer', '&:hover': { opacity: 0.8 } }} />
                            </Tooltip>
                          )
                        })}
                      </Box>
                    ))}
                  </Box>
                </Box>
              </Box>
              <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4' }}>
                <Box sx={{ px: 3, py: 2, borderBottom: '1px solid #eef0f4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>Transaction Value Heatmap</Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>When does this user move money? ({heatmapRange})</Typography>
                  </Box>
                  <Stack direction="row" gap={0.5}>
                    {['24h', '7d', '30d', '90d'].map(r => (
                      <Box
                        key={r}
                        onClick={() => setHeatmapRange(r)}
                        sx={{
                          px: 1, py: 0.25, fontSize: '0.625rem', fontWeight: 700, cursor: 'pointer',
                          border: '1px solid',
                          borderColor: heatmapRange === r ? colorPalette.primary : '#e2e8f0',
                          color: heatmapRange === r ? colorPalette.primary : '#64748b',
                          bgcolor: heatmapRange === r ? `${colorPalette.primary}0a` : 'transparent',
                          '&:hover': { borderColor: colorPalette.primary, color: colorPalette.primary }
                        }}
                      >
                        {r.toUpperCase()}
                      </Box>
                    ))}
                  </Stack>
                </Box>
                <Box sx={{ p: 3, overflowX: 'auto', position: 'relative', minHeight: 180 }}>
                  {loadingHeatmap && (
                    <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(255,255,255,0.6)', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8' }}>Mapping volume…</Typography>
                    </Box>
                  )}
                  <Box sx={{ minWidth: 400 }}>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '40px repeat(24, 1fr)', gap: 0.375, mb: 0.5 }}>
                      <Box />{hours.map((h) => <Typography key={h} sx={{ fontSize: '0.625rem', fontWeight: 600, color: '#94a3b8', textAlign: 'center' }}>{h % 3 === 0 ? h : ''}</Typography>)}
                    </Box>
                    {days.map((d, di) => (
                      <Box key={d} sx={{ display: 'grid', gridTemplateColumns: '40px repeat(24, 1fr)', gap: 0.375, mb: 0.375 }}>
                        <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center' }}>{d}</Typography>
                        {hours.map((h) => {
                          const val = tHeatmap[di][h]
                          const hourStr = h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`
                          return (
                            <Tooltip key={h} title={`${d} ${hourStr} - Transactions: ${Math.round(val * 100)}%`} arrow placement="top">
                              <Box sx={{ aspectRatio: '1', bgcolor: colorScale(val), cursor: 'pointer', '&:hover': { opacity: 0.8 } }} />
                            </Tooltip>
                          )
                        })}
                      </Box>
                    ))}
                  </Box>
                </Box>
              </Box>
            </Box>

            {overallRisk >= 70 ? (
              <Box sx={{ bgcolor: '#fef2f2', border: '1px solid #fecaca', p: 3, mb: 4, display: 'flex', gap: 2 }}>
                <WarningAmberRoundedIcon sx={{ color: '#dc2626', fontSize: '2rem' }} />
                <Box>
                  <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#991b1b', fontFamily: 'Jost', mb: 0.5 }}>
                    Investigator Insight: Immediate Action Recommended
                  </Typography>
                  <Typography sx={{ fontSize: '0.875rem', color: '#7f1d1d', lineHeight: 1.6 }}>
                    This user's risk score is critically high ({overallRisk}). The <strong>Behavioral Risk Profile</strong> indicates severe anomalies in Velocity and Network consistency. Transactions are occurring outside of normal heatmap hours. <strong>Recommendation:</strong> Freeze account pending direct phone verification with the customer.
                  </Typography>
                </Box>
              </Box>
            ) : (
              <Box sx={{ bgcolor: '#f0fdf4', border: '1px solid #bbf7d0', p: 3, mb: 4, display: 'flex', gap: 2 }}>
                <AutoAwesomeOutlinedIcon sx={{ color: '#10b981', fontSize: '2rem' }} />
                <Box>
                  <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#065f46', fontFamily: 'Jost', mb: 0.5 }}>
                    Investigator Insight: Routine Profile
                  </Typography>
                  <Typography sx={{ fontSize: '0.875rem', color: '#064e3b', lineHeight: 1.6 }}>
                    This user's risk score is low ({overallRisk}). Activity aligns closely with their historical 90-day heatmaps. Device Trust and Geolocation are highly consistent. <strong>Recommendation:</strong> No manual intervention required.
                  </Typography>
                </Box>
              </Box>
            )}

            <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4' }}>
              <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs value={activeTab} onChange={(_e, v) => setActiveTab(v)} sx={{ px: 2, minHeight: 48, '& .MuiTab-root': { minHeight: 48, textTransform: 'none', fontWeight: 600, fontFamily: 'Jost', fontSize: '0.875rem', color: '#64748b' }, '& .Mui-selected': { color: `${colorPalette.primary} !important` }, '& .MuiTabs-indicator': { backgroundColor: colorPalette.primary } }}>
                  <Tab label="Unified Timeline" />
                  <Tab label={`Transactions (${tTotal})`} />
                  <Tab label={`Behavioral Patterns (${bTotal})`} />
                  <Tab label="Cases (0)" disabled />
                </Tabs>
              </Box>

              <Box sx={{ p: 0 }}>
                {activeTab === 0 && (
                  <Stack>
                    {timeline.map((e, i, arr) => (
                      <Box key={i} sx={{ px: 3, py: 1.75, display: 'flex', gap: 1.5, borderBottom: i === arr.length - 1 ? 'none' : '1px solid #f4f5f7', '&:hover': { bgcolor: '#fafbfc' }, cursor: 'pointer' }} onClick={() => e.type === 'beam' ? setDetailBeam(e.raw) : setDetailTx(e.raw)}>
                        <Box sx={{ minWidth: 100 }}>
                          <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', fontFamily: 'SF Mono, Monaco, monospace' }}>
                            {new Intl.DateTimeFormat('en-NG', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(e.time)}
                          </Typography>
                        </Box>
                        <Box sx={{ width: 32, height: 32, bgcolor: `${e.color}15`, color: e.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, '& > svg': { fontSize: '1rem' } }}>
                          {e.icon}
                        </Box>
                        <Box sx={{ flex: 1 }}>
                          <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a', fontFamily: 'Jost', mb: 0.25, textTransform: 'capitalize' }}>
                            {e.title}
                          </Typography>
                          <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>{e.detail}</Typography>
                        </Box>
                      </Box>
                    ))}
                  </Stack>
                )}

                {activeTab === 1 && (
                  <Box>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '120px 100px 140px 1fr 100px', gap: 2, px: 3, py: 1.5, bgcolor: '#f8fafc', borderBottom: '1px solid #eef0f4' }}>
                      <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Time</Typography>
                      <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Risk</Typography>
                      <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Amount</Typography>
                      <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Counterparty</Typography>
                      <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Status</Typography>
                    </Box>
                    {transactions.map(t => (
                      <Box key={t.id} onClick={() => setDetailTx(t)} sx={{ display: 'grid', gridTemplateColumns: '120px 100px 140px 1fr 100px', gap: 2, px: 3, py: 1.75, borderBottom: '1px solid #f4f5f7', cursor: 'pointer', '&:hover': { bgcolor: '#fafbfc' } }}>
                        <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', fontFamily: 'SF Mono, Monaco, monospace' }}>{new Date(t.occurredAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</Typography>
                        <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: t.risk >= 70 ? '#dc2626' : t.risk >= 40 ? '#f59e0b' : '#10b981' }}>{t.risk}</Typography>
                        <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: '#0f172a' }}>₦{t.amount.toLocaleString()}</Typography>
                        <Typography sx={{ fontSize: '0.8125rem', color: '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.recipientName || t.counterparty}</Typography>
                        <Box><Chip label={t.status.toUpperCase()} size="small" sx={{ bgcolor: t.status === 'successful' ? '#f0fdf4' : t.status === 'failed' ? '#fef2f2' : '#f8fafc', color: t.status === 'successful' ? '#16a34a' : t.status === 'failed' ? '#dc2626' : '#64748b', fontWeight: 700, fontSize: '0.625rem', height: 20, borderRadius: 0 }} /></Box>
                      </Box>
                    ))}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, py: 1.5 }}>
                      <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>Showing page {txPage} of {txPages}</Typography>
                      <Stack direction="row" gap={0.5}>
                        <PageBtn label="Prev" disabled={txPage <= 1} onClick={() => setTxPage(p => p - 1)} active={false} />
                        <PageBtn label="Next" disabled={txPage >= txPages} onClick={() => setTxPage(p => p + 1)} active={false} />
                      </Stack>
                    </Box>
                  </Box>
                )}

                {activeTab === 2 && (
                  <Box>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '120px 100px 140px 1fr 100px', gap: 2, px: 3, py: 1.5, bgcolor: '#f8fafc', borderBottom: '1px solid #eef0f4' }}>
                      <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Time</Typography>
                      <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Status</Typography>
                      <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Stream</Typography>
                      <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Action / Context</Typography>
                      <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>IP</Typography>
                    </Box>
                    {beams.length === 0 ? (
                      <Box sx={{ p: 4, textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>No behavioral patterns found for this customer.</Box>
                    ) : (
                      <>
                        {beams.map(b => {
                          const st = determineStatus(b)
                          let p: any = {}
                          try { p = JSON.parse(b.payload) } catch { }
                          return (
                            <Box key={b.id} onClick={() => setDetailBeam(b)} sx={{ display: 'grid', gridTemplateColumns: '120px 100px 140px 1fr 100px', gap: 2, px: 3, py: 1.75, borderBottom: '1px solid #f4f5f7', cursor: 'pointer', '&:hover': { bgcolor: '#fafbfc' } }}>
                              <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', fontFamily: 'SF Mono, Monaco, monospace' }}>{new Date(b.receivedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</Typography>
                              <Box><Chip label={st.label} sx={{ bgcolor: st.bg, color: st.color, fontWeight: 700, fontSize: '0.6rem', height: 20, borderRadius: 0 }} /></Box>
                              <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: '#0f172a', textTransform: 'capitalize' }}>{b.stream}</Typography>
                              <Typography sx={{ fontSize: '0.8125rem', color: '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.activity_name || p.note || 'Interaction'}</Typography>
                              <Typography sx={{ fontSize: '0.75rem', color: '#64748b', fontFamily: 'SF Mono, Monaco, monospace' }}>{b.ip || '—'}</Typography>
                            </Box>
                          )
                        })}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, py: 1.5 }}>
                          <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>Showing {Math.min(beams.length, (beamPage - 1) * PAGE_SIZE + 1)}–{Math.min(beamPage * PAGE_SIZE, beams.length)} of {beams.length}</Typography>
                          <Stack direction="row" gap={0.5}>
                            <PageBtn label="Prev" disabled={beamPage <= 1} onClick={() => setBeamPage(p => p - 1)} active={false} />
                            <PageBtn label="Next" disabled={beamPage >= beamPages} onClick={() => setBeamPage(p => p + 1)} active={false} />
                          </Stack>
                        </Box>
                      </>
                    )}
                  </Box>
                )}
              </Box>
            </Box>
          </>
        )}
      </Box>

      <InteractionDetailPanel
        beam={detailBeam}
        open={Boolean(detailBeam)}
        onClose={() => setDetailBeam(null)}
      />

      <Drawer anchor="right" open={Boolean(detailTx)} onClose={() => setDetailTx(null)} PaperProps={{ sx: { width: 500, bgcolor: '#f8fafc' } }}>
        {detailTx && (
          <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ px: 3, py: 2.5, bgcolor: '#ffffff', borderBottom: '1px solid #eef0f4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography sx={{ fontSize: '1.125rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>Transaction Details</Typography>
              <IconButton onClick={() => setDetailTx(null)} size="small"><ChevronRightRoundedIcon /></IconButton>
            </Box>
            <Box sx={{ p: 3, flex: 1, overflowY: 'auto' }}>
              <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', p: 2, mb: 2 }}>
                <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', mb: 1 }}>Raw Metadata</Typography>
                <Box sx={{ bgcolor: '#0f172a', p: 2, borderRadius: 1, overflowX: 'auto' }}>
                  <Typography component="pre" sx={{ fontSize: '0.75rem', color: '#e2e8f0', fontFamily: 'SF Mono, Monaco, monospace', m: 0 }}>
                    {JSON.stringify(detailTx, null, 2)}
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Box>
        )}
      </Drawer>

      <TOTPConfirmation open={freezeOpen} onClose={() => setFreezeOpen(false)} onConfirm={() => setFreezeOpen(false)} operation="delete" title="Freeze customer account" description="Freezing will immediately block all transactions and login attempts." resourceType="Customer account" resourceName={`${userDetails.name} · ${id}`} itemsAffected={['All inbound/outbound transfers blocked', 'Mobile and web login disabled', 'Customer notified via SMS', 'Audit log entry created']} />
    </DashboardLayout>
  )
}
