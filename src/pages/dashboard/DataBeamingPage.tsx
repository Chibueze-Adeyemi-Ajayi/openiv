import { Box, Typography, Stack, Button, Chip, IconButton } from '@mui/material'
import { colorPalette } from '@/theme'
import DashboardLayout from '@/components/dashboard/DashboardLayout'
import { useState } from 'react'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import LoginRoundedIcon from '@mui/icons-material/LoginRounded'
import TouchAppOutlinedIcon from '@mui/icons-material/TouchAppOutlined'
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined'
import SmartphoneOutlinedIcon from '@mui/icons-material/SmartphoneOutlined'
import KeyOutlinedIcon from '@mui/icons-material/KeyOutlined'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded'

type StreamId = 'transactions' | 'logins' | 'activity' | 'location' | 'devices' | 'otps'

interface Stream {
  id: StreamId
  icon: React.ReactNode
  title: string
  desc: string
  status: 'connected' | 'partial' | 'disconnected'
  recordsToday: number
  lastSeen: string
  why: string
  schema: { field: string; type: string; required: boolean; example: string }[]
}

const streams: Stream[] = [
  {
    id: 'transactions',
    icon: <ReceiptLongOutlinedIcon />,
    title: 'Transactions',
    desc: 'Every credit, debit, transfer & FX flow as it lands on your core',
    status: 'connected',
    recordsToday: 84219,
    lastSeen: '2 sec ago',
    why: "The foundational stream. Without transactions, no risk score is possible. Beam the moment your core posts — even before settlement — so we can intercept.",
    schema: [
      { field: 'transaction_id', type: 'string', required: true, example: 'TXN-48721' },
      { field: 'timestamp', type: 'ISO 8601', required: true, example: '2026-04-19T14:22:08Z' },
      { field: 'amount', type: 'number', required: true, example: '14250000' },
      { field: 'currency', type: 'ISO 4217', required: true, example: 'NGN' },
      { field: 'channel', type: 'enum', required: true, example: 'wire | mobile | pos | ussd' },
      { field: 'from_account', type: 'string', required: true, example: 'ACC-1729' },
      { field: 'to_account', type: 'string', required: true, example: 'EXT-WIRE' },
      { field: 'merchant_id', type: 'string', required: false, example: 'MCH-2918' },
      { field: 'narration', type: 'string', required: false, example: 'Salary disbursement' },
    ],
  },
  {
    id: 'logins',
    icon: <LoginRoundedIcon />,
    title: 'User Logins',
    desc: 'Every authentication attempt — success, failure, or 2FA',
    status: 'connected',
    recordsToday: 41203,
    lastSeen: '4 sec ago',
    why: 'Login patterns reveal account-takeover precursors. We correlate failed attempts, IP anomalies and device fingerprints to score risk before money moves.',
    schema: [
      { field: 'user_id', type: 'string', required: true, example: 'USR-8472' },
      { field: 'timestamp', type: 'ISO 8601', required: true, example: '2026-04-19T14:21:11Z' },
      { field: 'outcome', type: 'enum', required: true, example: 'success | failed | 2fa_required' },
      { field: 'ip_address', type: 'string', required: true, example: '102.89.32.18' },
      { field: 'user_agent', type: 'string', required: true, example: 'iOS 17.4 / Chrome 124' },
      { field: 'device_id', type: 'string', required: false, example: 'DVC-8b32a1' },
      { field: 'geo_lat', type: 'number', required: false, example: '6.4541' },
      { field: 'geo_lng', type: 'number', required: false, example: '3.3947' },
    ],
  },
  {
    id: 'activity',
    icon: <TouchAppOutlinedIcon />,
    title: 'In-app Activity',
    desc: 'User actions inside your mobile / web app — sessions, taps, screen views',
    status: 'partial',
    recordsToday: 218450,
    lastSeen: '12 sec ago',
    why: 'Behavioral fingerprints — typing cadence, navigation flow, time-on-screen — let us spot when a session no longer "feels" like the legitimate user.',
    schema: [
      { field: 'user_id', type: 'string', required: true, example: 'USR-8472' },
      { field: 'session_id', type: 'string', required: true, example: 'SES-3491f' },
      { field: 'event_name', type: 'string', required: true, example: 'beneficiary_added' },
      { field: 'timestamp', type: 'ISO 8601', required: true, example: '2026-04-19T14:22:00Z' },
      { field: 'screen', type: 'string', required: false, example: 'transfer/confirm' },
      { field: 'metadata', type: 'object', required: false, example: '{ "amount": 14250000 }' },
    ],
  },
  {
    id: 'location',
    icon: <LocationOnOutlinedIcon />,
    title: 'User Location',
    desc: 'GPS/IP-derived location signals on every interaction',
    status: 'connected',
    recordsToday: 41203,
    lastSeen: '8 sec ago',
    why: 'Location is the strongest signal for SIM-swap and account-takeover. We compare every transaction against the customer\'s recent location footprint.',
    schema: [
      { field: 'user_id', type: 'string', required: true, example: 'USR-8472' },
      { field: 'timestamp', type: 'ISO 8601', required: true, example: '2026-04-19T14:22:00Z' },
      { field: 'lat', type: 'number', required: true, example: '6.4541' },
      { field: 'lng', type: 'number', required: true, example: '3.3947' },
      { field: 'accuracy_m', type: 'number', required: false, example: '12' },
      { field: 'source', type: 'enum', required: true, example: 'gps | wifi | ip | cell' },
    ],
  },
  {
    id: 'devices',
    icon: <SmartphoneOutlinedIcon />,
    title: 'Device Fingerprints',
    desc: 'Hardware, OS, and behavioral fingerprints per session',
    status: 'partial',
    recordsToday: 12840,
    lastSeen: '1 min ago',
    why: 'New device detection is a top SIM-swap signal. We track which devices each user has historically used and trigger when an unfamiliar one initiates a high-value action.',
    schema: [
      { field: 'device_id', type: 'string', required: true, example: 'DVC-8b32a1' },
      { field: 'user_id', type: 'string', required: true, example: 'USR-8472' },
      { field: 'os', type: 'string', required: true, example: 'iOS 17.4' },
      { field: 'model', type: 'string', required: false, example: 'iPhone 14 Pro' },
      { field: 'first_seen', type: 'ISO 8601', required: false, example: '2026-01-12T08:30:00Z' },
      { field: 'rooted_or_jailbroken', type: 'boolean', required: false, example: 'false' },
    ],
  },
  {
    id: 'otps',
    icon: <KeyOutlinedIcon />,
    title: 'OTP Events',
    desc: 'Every OTP request, send, retry, and successful verification',
    status: 'disconnected',
    recordsToday: 0,
    lastSeen: 'Never',
    why: 'OTP retry patterns are how we catch SIM-swappers in real time. Without this stream, we cannot hold suspicious transactions for verification.',
    schema: [
      { field: 'user_id', type: 'string', required: true, example: 'USR-8472' },
      { field: 'phone_msisdn', type: 'string', required: true, example: '+2348031234567' },
      { field: 'event_type', type: 'enum', required: true, example: 'requested | sent | verified | retry | failed' },
      { field: 'timestamp', type: 'ISO 8601', required: true, example: '2026-04-19T14:22:00Z' },
      { field: 'transaction_id', type: 'string', required: false, example: 'TXN-48721' },
      { field: 'attempt_count', type: 'number', required: false, example: '4' },
    ],
  },
]

const statusConfig: Record<Stream['status'], { color: string; bg: string; label: string }> = {
  connected: { color: '#10b981', bg: '#f0fdf4', label: 'Connected' },
  partial: { color: '#f59e0b', bg: '#fffbeb', label: 'Partial' },
  disconnected: { color: '#dc2626', bg: '#fef2f2', label: 'Not connected' },
}

export default function DataBeamingPage() {
  const [activeStream, setActiveStream] = useState<StreamId>('transactions')
  const stream = streams.find((s) => s.id === activeStream)!

  const connected = streams.filter((s) => s.status === 'connected').length
  const totalRecords = streams.reduce((sum, s) => sum + s.recordsToday, 0)

  return (
    <DashboardLayout>
      <Box sx={{ p: 4 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
          <Box>
            <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: colorPalette.primary, letterSpacing: '0.14em', textTransform: 'uppercase', mb: 0.75 }}>
              Configure
            </Typography>
            <Typography sx={{ fontSize: '1.625rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost', letterSpacing: '-0.015em', mb: 0.5 }}>
              Beam to OpenIV
            </Typography>
            <Typography sx={{ fontSize: '0.9375rem', color: '#64748b', maxWidth: 720 }}>
              Stream the six signals that power real-time fraud defense. Each one feeds a different layer of behavioral intelligence — Eureka tells you exactly what to send and why.
            </Typography>
          </Box>
        </Box>

        {/* Health KPIs */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, mb: 3 }}>
          {[
            { label: 'Streams connected', value: `${connected}/${streams.length}`, sub: connected === streams.length ? 'Full coverage' : `${streams.length - connected} pending` },
            { label: 'Records today', value: totalRecords.toLocaleString(), sub: 'across all streams' },
            { label: 'Median latency', value: '142ms', sub: 'from your core to OpenIV' },
            { label: 'Schema validity', value: '99.84%', sub: '17 rejected today' },
          ].map((s) => (
            <Box key={s.label} sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', p: 2.25 }}>
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 0.625 }}>
                {s.label}
              </Typography>
              <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost', lineHeight: 1.1, mb: 0.5 }}>
                {s.value}
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>{s.sub}</Typography>
            </Box>
          ))}
        </Box>

        {/* Stream Picker */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 1.5, mb: 3 }}>
          {streams.map((s) => {
            const isActive = s.id === activeStream
            const cfg = statusConfig[s.status]
            return (
              <Box
                key={s.id}
                onClick={() => setActiveStream(s.id)}
                sx={{
                  bgcolor: '#ffffff',
                  border: '1px solid',
                  borderColor: isActive ? colorPalette.primary : '#eef0f4',
                  p: 2,
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'all 0.18s',
                  '&:hover': { borderColor: isActive ? colorPalette.primary : '#cbd5e1' },
                  '&::before': isActive ? {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '2px',
                    bgcolor: colorPalette.primary,
                  } : {},
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      bgcolor: isActive ? colorPalette.primary : `${colorPalette.primary}10`,
                      color: isActive ? '#ffffff' : colorPalette.primary,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.18s',
                    }}
                  >
                    {s.icon}
                  </Box>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: cfg.color }} />
                </Box>
                <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost', mb: 0.25 }}>
                  {s.title}
                </Typography>
                <Typography sx={{ fontSize: '0.6875rem', color: '#64748b', fontFamily: 'SF Mono, Monaco, monospace' }}>
                  {s.recordsToday > 0 ? `${(s.recordsToday / 1000).toFixed(1)}k today` : 'No data'}
                </Typography>
              </Box>
            )
          })}
        </Box>

        {/* Detail panel */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 3 }}>
          {/* Schema + Why */}
          <Stack gap={3}>
            {/* Eureka explainer */}
            <Box
              sx={{
                bgcolor: colorPalette.primary,
                color: '#ffffff',
                p: 2.5,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25 }}>
                <AutoAwesomeOutlinedIcon sx={{ fontSize: '1.125rem' }} />
                <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                  Why beam {stream.title.toLowerCase()}?
                </Typography>
              </Box>
              <Typography sx={{ fontSize: '0.9375rem', fontWeight: 600, lineHeight: 1.55, mb: 1.5, fontFamily: 'Jost' }}>
                {stream.why}
              </Typography>
              <Stack direction="row" gap={2}>
                <Box>
                  <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    Powers
                  </Typography>
                  <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                    {stream.id === 'transactions' && 'Risk scoring · STR/SAR · Velocity rules'}
                    {stream.id === 'logins' && 'Account-takeover · MFA bypass detection'}
                    {stream.id === 'activity' && 'Behavioral fingerprints · Session anomalies'}
                    {stream.id === 'location' && 'OTP holds · Geo-impossibility · SIM-swap'}
                    {stream.id === 'devices' && 'Device-of-record · New-device alerts'}
                    {stream.id === 'otps' && 'Real-time OTP defense · Hold-and-call'}
                  </Typography>
                </Box>
              </Stack>
            </Box>

            {/* Schema spec */}
            <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4' }}>
              <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid #eef0f4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
                    Schema · {stream.title}
                  </Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
                    {stream.schema.filter((f) => f.required).length} required · {stream.schema.length} total fields
                  </Typography>
                </Box>
                <Chip
                  label={statusConfig[stream.status].label.toUpperCase()}
                  size="small"
                  sx={{
                    bgcolor: statusConfig[stream.status].bg,
                    color: statusConfig[stream.status].color,
                    fontWeight: 700,
                    fontSize: '0.625rem',
                    letterSpacing: '0.1em',
                    borderRadius: 0,
                    height: 22,
                  }}
                />
              </Box>

              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 90px 60px', px: 3, py: 1.25, bgcolor: '#fafbfc', borderBottom: '1px solid #eef0f4' }}>
                {['Field & example', 'Type', 'Required'].map((h) => (
                  <Typography key={h} sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    {h}
                  </Typography>
                ))}
              </Box>
              {stream.schema.map((f, i) => (
                <Box
                  key={f.field}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 90px 60px',
                    px: 3,
                    py: 1.5,
                    alignItems: 'center',
                    borderBottom: i === stream.schema.length - 1 ? 'none' : '1px solid #f4f5f7',
                    '&:hover': { bgcolor: '#fafbfc' },
                  }}
                >
                  <Box>
                    <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0f172a', fontFamily: 'SF Mono, Monaco, monospace' }}>
                      {f.field}
                    </Typography>
                    <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', fontFamily: 'SF Mono, Monaco, monospace', mt: 0.25 }}>
                      e.g. {f.example}
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: '0.6875rem', color: '#475569', fontFamily: 'SF Mono, Monaco, monospace' }}>
                    {f.type}
                  </Typography>
                  {f.required ? (
                    <CheckCircleOutlineRoundedIcon sx={{ fontSize: '1rem', color: '#10b981' }} />
                  ) : (
                    <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>optional</Typography>
                  )}
                </Box>
              ))}
            </Box>
          </Stack>

          {/* Code + recent payloads */}
          <Stack gap={3}>
            {/* Code sample */}
            <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4' }}>
              <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid #eef0f4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
                  How to beam
                </Typography>
                <Stack direction="row" gap={0.5}>
                  {['cURL', 'Node', 'Python'].map((lang, i) => (
                    <Box
                      key={lang}
                      sx={{
                        px: 1.25,
                        py: 0.5,
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        color: i === 0 ? colorPalette.primary : '#64748b',
                        bgcolor: i === 0 ? `${colorPalette.primary}0a` : 'transparent',
                        cursor: 'pointer',
                        fontFamily: 'Jost',
                        transition: 'all 0.15s',
                        '&:hover': { color: colorPalette.primary },
                      }}
                    >
                      {lang}
                    </Box>
                  ))}
                </Stack>
              </Box>
              <Box sx={{ p: 0 }}>
                <Box sx={{ bgcolor: '#0f172a', color: '#e2e8f0', p: 2.5, fontFamily: 'SF Mono, Monaco, monospace', fontSize: '0.75rem', lineHeight: 1.7, whiteSpace: 'pre', overflowX: 'auto' }}>
{`curl -X POST https://api.openiv.io/v1/beam/${stream.id} \\
  -H "Authorization: Bearer $OPENIV_API_KEY" \\
  -H "X-Idempotency-Key: $(uuidgen)" \\
  -H "Content-Type: application/json" \\
  -d '{
${stream.schema
  .filter((f) => f.required)
  .map((f) => `    "${f.field}": ${f.type === 'number' || f.type === 'boolean' ? f.example : `"${f.example}"`}`)
  .join(',\n')}
  }'`}
                </Box>
              </Box>
            </Box>

            {/* Recent payloads */}
            <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4' }}>
              <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid #eef0f4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Jost' }}>
                    Recent payloads
                  </Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
                    Last 6 events received on this stream
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.625 }}>
                  <Box
                    sx={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      bgcolor: stream.status === 'disconnected' ? '#94a3b8' : '#10b981',
                      animation: stream.status === 'disconnected' ? 'none' : 'pulse 2s infinite',
                      '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.3 } },
                    }}
                  />
                  <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: stream.status === 'disconnected' ? '#94a3b8' : '#10b981', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    {stream.status === 'disconnected' ? 'idle' : 'live'}
                  </Typography>
                </Box>
              </Box>
              <Stack>
                {stream.status === 'disconnected' ? (
                  <Box sx={{ p: 4, textAlign: 'center' }}>
                    <ErrorOutlineRoundedIcon sx={{ fontSize: '2rem', color: '#94a3b8', mb: 1 }} />
                    <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#475569', mb: 0.5 }}>
                      Stream not connected
                    </Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8', maxWidth: 320, mx: 'auto', mb: 2 }}>
                      Eureka will help you wire this up. Connecting OTP events unlocks real-time SIM-swap defense.
                    </Typography>
                    <Button
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
                      Connect This Stream
                    </Button>
                  </Box>
                ) : (
                  Array.from({ length: 5 }).map((_, i) => (
                    <Box
                      key={i}
                      sx={{
                        px: 3,
                        py: 1.5,
                        borderBottom: i === 4 ? 'none' : '1px solid #f4f5f7',
                        display: 'grid',
                        gridTemplateColumns: '90px 1fr 80px',
                        gap: 2,
                        alignItems: 'center',
                        fontFamily: 'SF Mono, Monaco, monospace',
                        '&:hover': { bgcolor: '#fafbfc' },
                      }}
                    >
                      <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8' }}>
                        {`14:22:${(8 - i).toString().padStart(2, '0')}`}
                      </Typography>
                      <Typography sx={{ fontSize: '0.75rem', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {stream.id === 'transactions' && `{ "transaction_id": "TXN-${48721 - i}", "amount": ${(14250000 - i * 1200000).toLocaleString()} ... }`}
                        {stream.id === 'logins' && `{ "user_id": "USR-${8472 - i}", "outcome": "success", "ip": "102.89.${32 + i}.${18 + i}" }`}
                        {stream.id === 'activity' && `{ "event_name": "${['transfer_initiated', 'beneficiary_added', 'screen_viewed', 'login_attempt', 'biometric_pass'][i]}", "session_id": "SES-${3491 + i}" }`}
                        {stream.id === 'location' && `{ "user_id": "USR-${8472 - i}", "lat": ${(6.45 + i * 0.001).toFixed(4)}, "lng": ${(3.39 + i * 0.001).toFixed(4)} }`}
                        {stream.id === 'devices' && `{ "device_id": "DVC-8b32a1", "os": "iOS 17.4", "model": "iPhone 14 Pro" }`}
                      </Typography>
                      <Chip
                        label="200 OK"
                        size="small"
                        sx={{
                          bgcolor: '#f0fdf4',
                          color: '#10b981',
                          fontWeight: 700,
                          fontSize: '0.625rem',
                          borderRadius: 0,
                          height: 18,
                          width: 'fit-content',
                          '& .MuiChip-label': { px: 0.625 },
                        }}
                      />
                    </Box>
                  ))
                )}
              </Stack>
            </Box>
          </Stack>
        </Box>
      </Box>
    </DashboardLayout>
  )
}
