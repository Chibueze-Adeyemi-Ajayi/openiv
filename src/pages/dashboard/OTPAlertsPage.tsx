import { Box, Typography, Stack, Button, Chip } from '@mui/material'
import { colorPalette } from '@/theme'
import DashboardLayout from '@/components/dashboard/DashboardLayout'
import TOTPConfirmation from '@/components/dashboard/TOTPConfirmation'
import { useState } from 'react'
import PhoneInTalkRoundedIcon from '@mui/icons-material/PhoneInTalkRounded'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import LockOpenOutlinedIcon from '@mui/icons-material/LockOpenOutlined'
import SmsOutlinedIcon from '@mui/icons-material/SmsOutlined'
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined'
import DevicesOutlinedIcon from '@mui/icons-material/DevicesOutlined'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'

interface OTPAlert {
  id: string
  customer: string
  phone: string
  amount: number
  beneficiary: string
  customerLocation: { city: string; state: string; lat: number; lng: number }
  txnLocation: { city: string; state: string; lat: number; lng: number; ip: string }
  device: string
  distanceKm: number
  riskScore: number
  reasons: string[]
  receivedAt: string
  status: 'held' | 'released' | 'declined' | 'pending'
  ttl: number // seconds until auto-decline
}

const initialAlerts: OTPAlert[] = [
  {
    id: 'OTP-94821',
    customer: 'Adamu Ibrahim',
    phone: '+234 803 ••• 4192',
    amount: 14250000,
    beneficiary: 'Acct ••• 8821 · GT Bank',
    customerLocation: { city: 'Sokoto', state: 'Sokoto', lat: 13.06, lng: 5.24 },
    txnLocation: { city: 'Lagos', state: 'Lagos', lat: 6.45, lng: 3.39, ip: '102.89.32.18' },
    device: 'New device · Samsung A54',
    distanceKm: 1098,
    riskScore: 96,
    reasons: ['1,098 km from registered location', 'New device fingerprint', 'OTP retry × 4 in 90 sec', 'Beneficiary added 12 min ago'],
    receivedAt: '14:22:08',
    status: 'pending',
    ttl: 184,
  },
  {
    id: 'OTP-94820',
    customer: 'Folake Adesanya',
    phone: '+234 805 ••• 7203',
    amount: 2800000,
    beneficiary: 'Acct ••• 4029 · Opay',
    customerLocation: { city: 'Lagos', state: 'Lagos', lat: 6.45, lng: 3.39 },
    txnLocation: { city: 'Abuja', state: 'FCT', lat: 9.06, lng: 7.49, ip: '197.210.84.22' },
    device: 'Known device · iPhone 14',
    distanceKm: 528,
    riskScore: 78,
    reasons: ['528 km from usual location', 'Off-hour (02:14)', 'First-time beneficiary'],
    receivedAt: '14:18:42',
    status: 'pending',
    ttl: 312,
  },
  {
    id: 'OTP-94819',
    customer: 'Chinedu Okeke',
    phone: '+234 802 ••• 1184',
    amount: 980000,
    beneficiary: 'Acct ••• 9912 · Kuda',
    customerLocation: { city: 'Onitsha', state: 'Anambra', lat: 6.14, lng: 6.78 },
    txnLocation: { city: 'Aba', state: 'Abia', lat: 5.10, lng: 7.36, ip: '169.255.59.47' },
    device: 'Known device · Tecno Camon',
    distanceKm: 142,
    riskScore: 64,
    reasons: ['142 km from usual location', 'Velocity above baseline', 'New beneficiary'],
    receivedAt: '14:15:11',
    status: 'pending',
    ttl: 412,
  },
]

function formatTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export default function OTPAlertsPage() {
  const [alerts, setAlerts] = useState(initialAlerts)
  const [selectedId, setSelectedId] = useState<string>(initialAlerts[0].id)
  const [pendingAction, setPendingAction] = useState<{ id: string; status: OTPAlert['status'] } | null>(null)

  const selected = alerts.find((a) => a.id === selectedId)!

  const updateStatus = (id: string, status: OTPAlert['status']) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)))
    setPendingAction(null)
  }

  return (
    <DashboardLayout>
      <Box sx={{ p: 4 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: '#dc2626',
                  animation: 'pulse 1.5s infinite',
                  '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.3 } },
                }}
              />
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#dc2626', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                Live OTP Defense
              </Typography>
            </Box>
            <Typography sx={{ fontSize: '1.625rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost', letterSpacing: '-0.015em', mb: 0.5 }}>
              Real-time OTP Alerts
            </Typography>
            <Typography sx={{ fontSize: '0.9375rem', color: '#64748b' }}>
              Suspicious OTPs that withhold transactions until your team verifies the customer by call
            </Typography>
          </Box>
        </Box>

        {/* KPI strip */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, mb: 3 }}>
          {[
            { label: 'Active holds', value: '3', color: '#dc2626' },
            { label: 'Held today', value: '47', color: '#f59e0b' },
            { label: 'Confirmed fraud', value: '12', color: colorPalette.primary },
            { label: 'Customer release rate', value: '74%', color: '#10b981' },
          ].map((s) => (
            <Box key={s.label} sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.625, mb: 0.625 }}>
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: s.color }} />
                <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                  {s.label}
                </Typography>
              </Box>
              <Typography sx={{ fontSize: '1.625rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
                {s.value}
              </Typography>
            </Box>
          ))}
        </Box>

        {/* Main split */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '380px 1fr' }, gap: 3 }}>
          {/* Alert queue */}
          <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', alignSelf: 'start' }}>
            <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid #eef0f4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
                Alert queue
              </Typography>
              <Chip
                label={`${alerts.filter((a) => a.status === 'pending').length} pending`}
                size="small"
                sx={{
                  bgcolor: '#fef2f2',
                  color: '#dc2626',
                  fontWeight: 700,
                  fontSize: '0.625rem',
                  letterSpacing: '0.08em',
                  borderRadius: 0,
                  height: 20,
                }}
              />
            </Box>

            {alerts.map((a, i) => {
              const isSelected = a.id === selectedId
              return (
                <Box
                  key={a.id}
                  onClick={() => setSelectedId(a.id)}
                  sx={{
                    px: 2.5,
                    py: 2,
                    borderBottom: i === alerts.length - 1 ? 'none' : '1px solid #f4f5f7',
                    cursor: 'pointer',
                    bgcolor: isSelected ? `${colorPalette.primary}06` : 'transparent',
                    borderLeft: isSelected ? `3px solid ${colorPalette.primary}` : '3px solid transparent',
                    transition: 'all 0.15s',
                    '&:hover': { bgcolor: isSelected ? `${colorPalette.primary}0a` : '#fafbfc' },
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.75 }}>
                    <Box>
                      <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
                        {a.customer}
                      </Typography>
                      <Typography sx={{ fontSize: '0.6875rem', color: '#64748b', fontFamily: 'SF Mono, Monaco, monospace' }}>
                        {a.id}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a', fontFamily: 'SF Mono, Monaco, monospace' }}>
                        ₦{(a.amount / 1000000).toFixed(1)}M
                      </Typography>
                      {a.status === 'pending' && (
                        <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: a.ttl < 200 ? '#dc2626' : '#f59e0b' }}>
                          {formatTime(a.ttl)}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                  <Stack direction="row" gap={0.75} alignItems="center">
                    <Box
                      sx={{
                        width: 4,
                        height: 4,
                        borderRadius: '50%',
                        bgcolor: a.riskScore >= 90 ? '#dc2626' : a.riskScore >= 70 ? '#f59e0b' : colorPalette.primary,
                      }}
                    />
                    <Typography sx={{ fontSize: '0.6875rem', color: '#475569', fontWeight: 600 }}>
                      Risk {a.riskScore} · {a.distanceKm}km gap
                    </Typography>
                  </Stack>
                </Box>
              )
            })}
          </Box>

          {/* Detail */}
          <Stack gap={3}>
            {/* Status banner */}
            {selected.status === 'pending' && (
              <Box
                sx={{
                  bgcolor: '#fef2f2',
                  border: '1px solid #fecaca',
                  p: 2.5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                }}
              >
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    bgcolor: '#dc2626',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <LockOutlinedIcon />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost', mb: 0.25 }}>
                    Transaction held — call customer to verify
                  </Typography>
                  <Typography sx={{ fontSize: '0.8125rem', color: '#7f1d1d' }}>
                    Auto-decline in <strong>{formatTime(selected.ttl)}</strong> if no action. Customer will be SMS'd if unreachable.
                  </Typography>
                </Box>
                <Stack direction="row" gap={1}>
                  <Button
                    startIcon={<PhoneInTalkRoundedIcon sx={{ fontSize: '1rem !important' }} />}
                    sx={{
                      bgcolor: '#dc2626',
                      color: '#ffffff',
                      px: 2.25,
                      py: 1.125,
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      fontFamily: 'Jost',
                      borderRadius: 0,
                      textTransform: 'none',
                      boxShadow: 'none',
                      '&:hover': { bgcolor: '#b91c1c' },
                    }}
                  >
                    Call Customer
                  </Button>
                </Stack>
              </Box>
            )}

            {/* Map of locations */}
            <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4' }}>
              <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid #eef0f4' }}>
                <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
                  Location mismatch
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
                  Where the customer usually transacts vs where this OTP was triggered
                </Typography>
              </Box>

              <Box sx={{ p: 3 }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 3, alignItems: 'center', mb: 2.5 }}>
                  {/* Customer location */}
                  <Box sx={{ p: 2, bgcolor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.875, mb: 1 }}>
                      <LocationOnOutlinedIcon sx={{ fontSize: '1rem', color: '#10b981' }} />
                      <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                        Customer's usual location
                      </Typography>
                    </Box>
                    <Typography sx={{ fontSize: '1.125rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
                      {selected.customerLocation.city}
                    </Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: '#475569', mt: 0.25 }}>
                      {selected.customerLocation.state} · {selected.customerLocation.lat.toFixed(2)}°N, {selected.customerLocation.lng.toFixed(2)}°E
                    </Typography>
                  </Box>

                  {/* Connector */}
                  <Box sx={{ textAlign: 'center', px: 2 }}>
                    <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 0.5 }}>
                      Distance gap
                    </Typography>
                    <Typography sx={{ fontSize: '1.875rem', fontWeight: 700, color: '#dc2626', fontFamily: 'Jost', lineHeight: 1 }}>
                      {selected.distanceKm}
                    </Typography>
                    <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#dc2626', letterSpacing: '0.1em' }}>
                      KM
                    </Typography>
                  </Box>

                  {/* Transaction location */}
                  <Box sx={{ p: 2, bgcolor: '#fef2f2', border: '1px solid #fecaca' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.875, mb: 1 }}>
                      <LocationOnOutlinedIcon sx={{ fontSize: '1rem', color: '#dc2626' }} />
                      <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                        OTP Triggered from
                      </Typography>
                    </Box>
                    <Typography sx={{ fontSize: '1.125rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
                      {selected.txnLocation.city}
                    </Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: '#475569', mt: 0.25 }}>
                      {selected.txnLocation.state} · IP {selected.txnLocation.ip}
                    </Typography>
                  </Box>
                </Box>

                {/* Visual line */}
                <Box
                  component="svg"
                  viewBox="0 0 600 80"
                  sx={{ width: '100%', height: 80, display: 'block' }}
                >
                  {/* Customer dot */}
                  <circle cx="60" cy="40" r="8" fill="#10b981" />
                  <circle cx="60" cy="40" r="14" fill="#10b981" opacity="0.2" />
                  <text x="60" y="68" textAnchor="middle" style={{ fontSize: '11px', fill: '#10b981', fontWeight: 700, fontFamily: 'Jost' }}>
                    {selected.customerLocation.city}
                  </text>
                  {/* Connecting dashed line */}
                  <line x1="80" y1="40" x2="520" y2="40" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="6 6" />
                  {/* Mid label */}
                  <rect x="240" y="26" width="120" height="28" fill="#ffffff" stroke="#dc2626" strokeWidth="1" />
                  <text x="300" y="44" textAnchor="middle" style={{ fontSize: '11px', fill: '#dc2626', fontWeight: 700, fontFamily: 'Jost' }}>
                    {selected.distanceKm} km · 18 min
                  </text>
                  {/* Txn dot */}
                  <circle cx="540" cy="40" r="8" fill="#dc2626" />
                  <circle cx="540" cy="40" r="14" fill="#dc2626" opacity="0.2">
                    <animate attributeName="r" values="14;22;14" dur="2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.2;0;0.2" dur="2s" repeatCount="indefinite" />
                  </circle>
                  <text x="540" y="68" textAnchor="middle" style={{ fontSize: '11px', fill: '#dc2626', fontWeight: 700, fontFamily: 'Jost' }}>
                    {selected.txnLocation.city}
                  </text>
                </Box>
              </Box>
            </Box>

            {/* Transaction + risk reasons */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
              <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', p: 2.5 }}>
                <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost', mb: 2 }}>
                  Transaction details
                </Typography>
                <Stack gap={1.5}>
                  {[
                    { label: 'Customer', value: selected.customer },
                    { label: 'Phone', value: selected.phone },
                    { label: 'Amount', value: `₦${selected.amount.toLocaleString()}` },
                    { label: 'Beneficiary', value: selected.beneficiary },
                    { label: 'Device', value: selected.device },
                    { label: 'OTP received', value: selected.receivedAt },
                  ].map((r) => (
                    <Box key={r.label} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.875, borderBottom: '1px solid #f4f5f7' }}>
                      <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>
                        {r.label}
                      </Typography>
                      <Typography sx={{ fontSize: '0.8125rem', color: '#0f172a', fontWeight: 600, fontFamily: r.label === 'Amount' || r.label === 'OTP received' ? 'SF Mono, Monaco, monospace' : 'Jost' }}>
                        {r.value}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </Box>

              <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', p: 2.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
                    Why this was flagged
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: '#dc2626', fontFamily: 'Jost', lineHeight: 1 }}>
                      {selected.riskScore}
                    </Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700 }}>/100</Typography>
                  </Box>
                </Box>
                <Stack gap={1}>
                  {selected.reasons.map((r, i) => (
                    <Box
                      key={i}
                      sx={{
                        display: 'flex',
                        gap: 1,
                        alignItems: 'flex-start',
                        py: 0.875,
                        borderBottom: i === selected.reasons.length - 1 ? 'none' : '1px solid #f4f5f7',
                      }}
                    >
                      <Box sx={{ width: 16, height: 16, bgcolor: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, mt: 0.125 }}>
                        <Typography sx={{ fontSize: '0.625rem', color: '#ffffff', fontWeight: 700 }}>{i + 1}</Typography>
                      </Box>
                      <Typography sx={{ fontSize: '0.8125rem', color: '#475569', lineHeight: 1.5 }}>
                        {r}
                      </Typography>
                    </Box>
                  ))}
                </Stack>

                {/* Eureka recommendation */}
                <Box
                  sx={{
                    mt: 2,
                    bgcolor: `${colorPalette.primary}06`,
                    border: `1px solid ${colorPalette.primary}15`,
                    p: 1.5,
                    display: 'flex',
                    gap: 1,
                  }}
                >
                  <AutoAwesomeOutlinedIcon
                    sx={{ fontSize: '0.9375rem', color: colorPalette.primary, mt: 0.125, flexShrink: 0 }}
                  />
                  <Typography sx={{ fontSize: '0.75rem', color: '#334155', lineHeight: 1.55 }}>
                    <strong style={{ color: colorPalette.primary }}>Eureka:</strong> Pattern matches 14 SIM-swap attempts logged this week in the same IP range. <strong>Strongly recommend</strong> calling the customer on the phone number registered to their BVN — not the device originating the OTP.
                  </Typography>
                </Box>
              </Box>
            </Box>

            {/* Action bar */}
            <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', p: 2.5, display: 'flex', gap: 1.5 }}>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost', mb: 0.5 }}>
                  Verification result
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Once you've spoken with the customer on their registered line, choose an outcome below.
                </Typography>
              </Box>
              <Stack direction="row" gap={1}>
                <Button
                  startIcon={<SmsOutlinedIcon sx={{ fontSize: '1rem !important' }} />}
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
                    '&:hover': { bgcolor: '#f8fafc' },
                  }}
                >
                  SMS Customer
                </Button>
                <Button
                  startIcon={<CloseRoundedIcon sx={{ fontSize: '1rem !important' }} />}
                  onClick={() => setPendingAction({ id: selected.id, status: 'declined' })}
                  sx={{
                    bgcolor: '#fef2f2',
                    color: '#dc2626',
                    px: 2.25,
                    py: 1.125,
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    fontFamily: 'Jost',
                    borderRadius: 0,
                    textTransform: 'none',
                    '&:hover': { bgcolor: '#fee2e2' },
                  }}
                >
                  Decline & File STR
                </Button>
                <Button
                  startIcon={<LockOpenOutlinedIcon sx={{ fontSize: '1rem !important' }} />}
                  onClick={() => setPendingAction({ id: selected.id, status: 'released' })}
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
                    '&:hover': { bgcolor: '#1a3896' },
                  }}
                >
                  Release Transaction
                </Button>
              </Stack>
            </Box>
          </Stack>
        </Box>
      </Box>

      <TOTPConfirmation
        open={!!pendingAction}
        onClose={() => setPendingAction(null)}
        onConfirm={() => pendingAction && updateStatus(pendingAction.id, pendingAction.status)}
        operation={pendingAction?.status === 'released' ? 'update' : 'delete'}
        title={
          pendingAction?.status === 'released'
            ? 'Release held transaction'
            : 'Decline & file STR'
        }
        description={
          pendingAction?.status === 'released'
            ? 'Releasing this transaction sends the funds immediately. You confirm you have spoken with the customer on their registered MSISDN.'
            : 'Declining this transaction will refund the customer and auto-file an NFIU Suspicious Transaction Report. Funds remain frozen pending NFIU review.'
        }
        resourceType={pendingAction?.status === 'released' ? 'Transaction' : 'STR filing'}
        resourceName={
          pendingAction
            ? `${selected.id} · ₦${selected.amount.toLocaleString()} · ${selected.customer}`
            : ''
        }
        changes={
          pendingAction?.status === 'released'
            ? [{ field: 'Status', from: 'Held', to: 'Released' }]
            : undefined
        }
        itemsAffected={
          pendingAction?.status === 'declined'
            ? [
                `Transaction ${selected.id} declined`,
                `STR filed to NFIU (auto-generated)`,
                `Customer ${selected.customer} notified by SMS`,
                `Account ${selected.beneficiary} flagged for monitoring`,
              ]
            : undefined
        }
      />
    </DashboardLayout>
  )
}
