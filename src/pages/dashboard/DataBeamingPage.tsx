import {
  Box, Typography, Stack, Button, Chip, IconButton,
  Skeleton, Dialog, Collapse, TextField,
  FormControl, Select, MenuItem,
} from '@mui/material'
import { colorPalette } from '@/theme'
import TOTPConfirmation from '@/components/dashboard/TOTPConfirmation'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { beamApi, type BeamApiKey, type BeamRecord } from '@/api/beam'
import { streamKycBeam, type KycStepEvent, type KycStreamResult } from '@/api/kyc'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import LoginRoundedIcon from '@mui/icons-material/LoginRounded'
import TouchAppOutlinedIcon from '@mui/icons-material/TouchAppOutlined'
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined'
import SmartphoneOutlinedIcon from '@mui/icons-material/SmartphoneOutlined'
import KeyOutlinedIcon from '@mui/icons-material/KeyOutlined'
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded'
import VpnKeyOutlinedIcon from '@mui/icons-material/VpnKeyOutlined'
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import ExpandLessRoundedIcon from '@mui/icons-material/ExpandLessRounded'
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined'
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline'
import { useSandbox } from '@/contexts/SandboxContext'

// ── Stream data ────────────────────────────────────────────────────────────────

type StreamId = 'transactions' | 'logins' | 'activity' | 'location' | 'devices' | 'otps' | 'kyc'

interface StreamField { field: string; type: string; required: boolean; example: string }
interface Stream {
  id: StreamId; icon: React.ReactNode; title: string; desc: string
  status: 'connected' | 'partial' | 'disconnected'
  recordsToday: number; lastSeen: string; why: string; powers: string
  schema: StreamField[]
}

const streams: Stream[] = [
  {
    id: 'transactions', icon: <ReceiptLongOutlinedIcon />, title: 'Transactions',
    desc: 'Every credit, debit, transfer & FX flow as it lands on your core',
    status: 'connected', recordsToday: 84219, lastSeen: '2 sec ago',
    why: "The foundational stream. Without transactions, no risk score is possible. Beam the moment your core posts — even before settlement — so we can intercept.",
    powers: 'Risk scoring · STR/SAR · Velocity rules',
    schema: [
      { field: 'customer_id', type: 'string', required: true, example: 'CUS-001' },
      { field: 'customer_name', type: 'string', required: true, example: 'Adamu Ibrahim' },
      { field: 'amount', type: 'number (kobo)', required: true, example: '14250000' },
      { field: 'channel', type: 'wire | mobile | transfer | atm | pos | ussd | bdc | other', required: true, example: 'wire' },
      { field: 'counterparty', type: 'string', required: true, example: 'Sokoto BDC Ltd' },
      { field: 'status', type: 'pending | completed | failed | declined', required: true, example: 'pending' },
      { field: 'location', type: 'string', required: true, example: 'Sokoto' },
      { field: 'lat', type: 'number', required: true, example: '13.0059' },
      { field: 'lng', type: 'number', required: true, example: '5.2476' },
      { field: 'occurred_at', type: 'ISO 8601 UTC', required: true, example: '2026-05-01T17:56:29Z' },
      { field: 'sender_account', type: 'string', required: true, example: '0124567890' },
      { field: 'sender_bank', type: 'string', required: true, example: 'Access Bank' },
      { field: 'recipient_name', type: 'string', required: true, example: 'Sokoto BDC Ltd' },
      { field: 'recipient_account', type: 'string', required: true, example: '0034567891' },
      { field: 'recipient_bank', type: 'string', required: true, example: 'GTBank' },
      { field: 'currency', type: 'string', required: true, example: 'NGN' },
      { field: 'narration', type: 'string', required: true, example: 'FX Settlement — USD Purchase' },
      { field: 'device_id', type: 'string', required: true, example: 'dev_a1b2c3' },
      { field: 'ip_address', type: 'string', required: true, example: '102.89.45.67' },
      { field: 'direction', type: 'outward | inward', required: false, example: 'outward' },
      { field: 'category', type: 'string', required: false, example: 'salary' },
    ],
  },
  {
    id: 'logins', icon: <LoginRoundedIcon />, title: 'User Logins',
    desc: 'Every authentication attempt — success, failure, or 2FA',
    status: 'connected', recordsToday: 41203, lastSeen: '4 sec ago',
    why: 'Login patterns reveal account-takeover precursors. We correlate failed attempts, IP anomalies and device fingerprints to score risk before money moves.',
    powers: 'Account-takeover · MFA bypass detection',
    schema: [
      { field: 'user_id', type: 'string', required: true, example: 'USR-8472' },
      { field: 'user_name', type: 'string', required: true, example: 'Adamu Ibrahim' },
      { field: 'activity_name', type: 'string', required: true, example: 'user login' },
      { field: 'note', type: 'string', required: true, example: 'User successfully logged into mobile app' },
      { field: 'occurred_at', type: 'ISO 8601', required: true, example: '2026-05-01T14:21:11Z' },
      { field: 'outcome', type: 'success | failed | 2fa_required', required: true, example: 'success' },
      { field: 'location', type: 'string', required: true, example: 'Lagos, NG' },
      { field: 'lat', type: 'number', required: true, example: '6.4541' },
      { field: 'lng', type: 'number', required: true, example: '3.3947' },
      { field: 'ip_address', type: 'string', required: true, example: '102.89.32.18' },
      { field: 'user_agent', type: 'string', required: true, example: 'iOS 17.4 / Chrome 124' },
      { field: 'device_id', type: 'string', required: false, example: 'DVC-8b32a1' },
    ],
  },
  {
    id: 'activity', icon: <TouchAppOutlinedIcon />, title: 'In-app Activity',
    desc: 'User actions inside your mobile / web app — sessions, taps, screen views',
    status: 'partial', recordsToday: 218450, lastSeen: '12 sec ago',
    why: 'Behavioral fingerprints — typing cadence, navigation flow, time-on-screen — let us spot when a session no longer "feels" like the legitimate user.',
    powers: 'Behavioral fingerprints · Session anomalies',
    schema: [
      { field: 'user_id', type: 'string', required: true, example: 'USR-8472' },
      { field: 'user_name', type: 'string', required: true, example: 'Adamu Ibrahim' },
      { field: 'activity_name', type: 'string', required: true, example: 'in-app activity' },
      { field: 'note', type: 'string', required: true, example: 'User viewed transfer confirmation screen' },
      { field: 'session_id', type: 'string', required: true, example: 'SES-3491f' },
      { field: 'event_name', type: 'string', required: true, example: 'beneficiary_added' },
      { field: 'occurred_at', type: 'ISO 8601', required: true, example: '2026-05-01T14:22:00Z' },
      { field: 'location', type: 'string', required: true, example: 'Abuja, NG' },
      { field: 'lat', type: 'number', required: true, example: '9.0765' },
      { field: 'lng', type: 'number', required: true, example: '7.3986' },
      { field: 'ip_address', type: 'string', required: true, example: '105.112.34.12' },
      { field: 'screen', type: 'string', required: false, example: 'transfer/confirm' },
      { field: 'metadata', type: 'object', required: false, example: '{ "amount": 14250000 }' },
    ],
  },
  {
    id: 'location', icon: <LocationOnOutlinedIcon />, title: 'User Location',
    desc: 'GPS/IP-derived location signals on every interaction',
    status: 'connected', recordsToday: 41203, lastSeen: '8 sec ago',
    why: "Location is the strongest signal for SIM-swap and account-takeover. We compare every transaction against the customer's recent location footprint.",
    powers: 'OTP holds · Geo-impossibility · SIM-swap',
    schema: [
      { field: 'user_id', type: 'string', required: true, example: 'USR-8472' },
      { field: 'user_name', type: 'string', required: true, example: 'Adamu Ibrahim' },
      { field: 'activity_name', type: 'string', required: true, example: 'user location update' },
      { field: 'note', type: 'string', required: true, example: 'Location ping derived from GPS' },
      { field: 'occurred_at', type: 'ISO 8601', required: true, example: '2026-05-01T14:22:00Z' },
      { field: 'location', type: 'string', required: true, example: 'Ikeja, Lagos' },
      { field: 'lat', type: 'number', required: true, example: '6.5244' },
      { field: 'lng', type: 'number', required: true, example: '3.3792' },
      { field: 'ip_address', type: 'string', required: true, example: '102.89.32.18' },
      { field: 'accuracy_m', type: 'number', required: false, example: '12' },
      { field: 'source', type: 'gps | wifi | ip | cell', required: true, example: 'gps' },
    ],
  },
  {
    id: 'devices', icon: <SmartphoneOutlinedIcon />, title: 'Device Fingerprints',
    desc: 'Hardware, OS, and behavioral fingerprints per session',
    status: 'partial', recordsToday: 12840, lastSeen: '1 min ago',
    why: 'New device detection is a top SIM-swap signal. We track which devices each user has historically used and trigger when an unfamiliar one initiates a high-value action.',
    powers: 'Device-of-record · New-device alerts',
    schema: [
      { field: 'device_id', type: 'string', required: true, example: 'DVC-8b32a1' },
      { field: 'user_id', type: 'string', required: true, example: 'USR-8472' },
      { field: 'user_name', type: 'string', required: true, example: 'Adamu Ibrahim' },
      { field: 'activity_name', type: 'string', required: true, example: 'device registration' },
      { field: 'note', type: 'string', required: true, example: 'New device hardware footprint established' },
      { field: 'occurred_at', type: 'ISO 8601', required: true, example: '2026-05-01T08:30:00Z' },
      { field: 'location', type: 'string', required: true, example: 'Port Harcourt, NG' },
      { field: 'lat', type: 'number', required: true, example: '4.8156' },
      { field: 'lng', type: 'number', required: true, example: '7.0498' },
      { field: 'ip_address', type: 'string', required: true, example: '197.210.64.12' },
      { field: 'os', type: 'string', required: true, example: 'iOS 17.4' },
      { field: 'model', type: 'string', required: false, example: 'iPhone 14 Pro' },
      { field: 'rooted_or_jailbroken', type: 'boolean', required: false, example: 'false' },
    ],
  },
  {
    id: 'otps', icon: <KeyOutlinedIcon />, title: 'OTP Events',
    desc: 'Every OTP request, send, retry, and successful verification',
    status: 'disconnected', recordsToday: 0, lastSeen: 'Never',
    why: 'OTP retry patterns are how we catch SIM-swappers in real time. Without this stream, we cannot hold suspicious transactions for verification.',
    powers: 'Real-time OTP defense · Hold-and-call',
    schema: [
      { field: 'user_id', type: 'string', required: true, example: 'USR-8472' },
      { field: 'user_name', type: 'string', required: true, example: 'Adamu Ibrahim' },
      { field: 'activity_name', type: 'string', required: true, example: 'otp verification' },
      { field: 'note', type: 'string', required: true, example: 'User completed OTP challenge for transfer' },
      { field: 'occurred_at', type: 'ISO 8601', required: true, example: '2026-05-01T14:22:00Z' },
      { field: 'event_type', type: 'requested | sent | verified | retry | failed', required: true, example: 'requested' },
      { field: 'location', type: 'string', required: true, example: 'Enugu, NG' },
      { field: 'lat', type: 'number', required: true, example: '6.4413' },
      { field: 'lng', type: 'number', required: true, example: '7.4988' },
      { field: 'ip_address', type: 'string', required: true, example: '102.89.32.18' },
      { field: 'phone_msisdn', type: 'string', required: true, example: '+2348031234567' },
      { field: 'transaction_id', type: 'string', required: false, example: 'TXN-48721' },
      { field: 'attempt_count', type: 'number', required: false, example: '4' },
      { field: 'amount', type: 'number', required: false, example: '150000' },
      { field: 'beneficiary_account', type: 'string', required: false, example: '0123456789' },
    ],
  },
  {
    id: 'kyc', icon: <BadgeOutlinedIcon />, title: 'Customer KYC',
    desc: 'Customer identity records — BVN, NIN, and biometric photo for risk profiling and tier assignment',
    status: 'disconnected', recordsToday: 0, lastSeen: 'Never',
    why: "The identity layer. Beaming BVN, NIN, and a customer photo lets OpenIV assign a KYC tier, adjust risk scores for every future transaction, and auto-escalate cases where identity cannot be confirmed. Without this stream, all customers default to Tier 0 — unverified — and transaction limits are minimal.",
    powers: 'KYC tier assignment · Transaction limit gating · Risk score adjustment · PEP cross-check',
    schema: [
      { field: 'customer_id', type: 'string', required: true, example: 'CUST-001' },
      { field: 'customer_kyc_tier', type: 'integer (1–3)', required: true, example: '2' },
      { field: 'name', type: 'string', required: false, example: 'Adamu Ibrahim' },
      { field: 'bvn', type: 'string', required: false, example: '22123456789' },
      { field: 'nin', type: 'string', required: false, example: '12345678901' },
      { field: 'photo', type: 'string (base64)', required: false, example: '/9j/4AAQSkZJRgAB...' },
      { field: 'monthly_inflow', type: 'integer (kobo)', required: false, example: '5000000' },
      { field: 'monthly_outflow', type: 'integer (kobo)', required: false, example: '3200000' },
      { field: 'occurred_at', type: 'ISO 8601', required: true, example: '2026-05-14T10:00:00Z' },
    ],
  },
]

const statusConfig: Record<Stream['status'], { color: string; bg: string; label: string }> = {
  connected: { color: '#10b981', bg: '#f0fdf4', label: 'Connected' },
  partial: { color: '#f59e0b', bg: '#fffbeb', label: 'Partial' },
  disconnected: { color: '#dc2626', bg: '#fef2f2', label: 'Not connected' },
}

// ── Beam log helpers ──────────────────────────────────────────────────────────

const STREAM_LABELS: Record<string, string> = {
  transactions: 'Transactions', logins: 'User Logins', activity: 'In-app Activity',
  location: 'User Location', devices: 'Device FP', otps: 'OTP Events', kyc: 'Customer KYC',
}
const STREAM_COLORS: Record<string, { bg: string; color: string }> = {
  transactions: { bg: '#eff6ff', color: '#2563eb' },
  logins: { bg: '#f0fdf4', color: '#16a34a' },
  activity: { bg: '#fdf4ff', color: '#9333ea' },
  location: { bg: '#fff7ed', color: '#ea580c' },
  devices: { bg: '#f8fafc', color: 'var(--on-surface-variant)' },
  otps: { bg: '#fef2f2', color: '#dc2626' },
  kyc: { bg: '#f0f9ff', color: '#0284c7' },
}

function fmtRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`
}

function prettyJson(raw: string): string {
  try { return JSON.stringify(JSON.parse(raw), null, 2) } catch { return raw }
}

function CopyText({ text }: { text: string }) {
  const [done, setDone] = useState(false)
  const go = () => { navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1600) }
  return (
    <Button size="small" onClick={go}
      startIcon={done
        ? <CheckRoundedIcon sx={{ fontSize: '0.75rem !important', color: '#10b981' }} />
        : <ContentCopyOutlinedIcon sx={{ fontSize: '0.75rem !important' }} />}
      sx={{ fontSize: '0.6875rem', fontFamily: 'Jost', fontWeight: 600, color: done ? '#10b981' : '#64748b', textTransform: 'none', px: 1, py: 0.375, borderRadius: 0, '&:hover': { bgcolor: 'var(--section-bg)' }, '& .MuiButton-startIcon': { mr: 0.375 } }}>
      {done ? 'Copied' : 'Copy'}
    </Button>
  )
}

function RecordRow({ record }: { record: BeamRecord }) {
  const [expanded, setExpanded] = useState(false)
  const pretty = useMemo(() => prettyJson(record.payload), [record.payload])
  const cfg = STREAM_COLORS[record.stream] ?? { bg: '#f8fafc', color: 'var(--on-surface-variant)' }

  let preview = ''
  try {
    const obj = JSON.parse(record.payload)
    const keys = Object.keys(obj).slice(0, 3)
    preview = keys.map(k => `"${k}": ${JSON.stringify(obj[k])}`).join(', ')
    if (Object.keys(obj).length > 3) preview += ', …'
  } catch { preview = record.payload.slice(0, 80) }

  return (
    <Box sx={{ borderBottom: '1px solid var(--border-col)', '&:last-child': { borderBottom: 'none' } }}>
      <Box
        onClick={() => setExpanded(p => !p)}
        data-ai-analyzable="true"
        data-ai-description={`Live Beam Record: ${record.stream.toUpperCase()}. received: ${fmtRelative(record.receivedAt)}. payload: ${preview}`}
        sx={{ px: 3, py: 1.5, display: 'grid', gridTemplateColumns: '110px 1fr 80px 80px 28px', gap: 1.5, alignItems: 'center', cursor: 'pointer', '&:hover': { bgcolor: 'var(--section-bg)' }, transition: 'background 0.15s' }}
      >
        <Box sx={{ display: 'inline-flex', px: 1, py: 0.375, bgcolor: cfg.bg }}>
          <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', color: cfg.color }}>
            {(STREAM_LABELS[record.stream] ?? record.stream).toUpperCase()}
          </Typography>
        </Box>
        <Typography sx={{ fontSize: '0.75rem', fontFamily: 'SF Mono, Monaco, monospace', color: 'var(--on-surface-variant)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {'{ ' + preview + ' }'}
        </Typography>
        <Box sx={{ display: 'inline-flex', px: 1, py: 0.375, bgcolor: '#f0fdf4' }}>
          <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', color: '#10b981' }}>RECEIVED</Typography>
        </Box>
        <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>{fmtRelative(record.receivedAt)}</Typography>
        <Box sx={{ color: '#94a3b8', display: 'flex', alignItems: 'center' }}>
          {expanded ? <ExpandLessRoundedIcon sx={{ fontSize: '1rem' }} /> : <ExpandMoreRoundedIcon sx={{ fontSize: '1rem' }} />}
        </Box>
      </Box>

      <Collapse in={expanded}>
        <Box sx={{ bgcolor: 'var(--section-bg)', borderTop: '1px solid var(--border-col)', p: 2.5 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2 }}>
            {[
              ['Record ID', String(record.id)],
              ['Stream', record.stream],
              ['Status', record.status],
              ['Idempotency key', record.idempotencyKey ?? '—'],
              ['Received at', new Date(record.receivedAt).toLocaleString()],
            ].map(([label, value]) => (
              <Box key={label}>
                <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600, color: '#94a3b8', letterSpacing: '0.08em', mb: 0.25 }}>{label}</Typography>
                <Typography sx={{ fontSize: '0.8125rem', fontFamily: 'SF Mono, Monaco, monospace', color: 'var(--heading-color)' }}>{value}</Typography>
              </Box>
            ))}
          </Box>
          <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--on-surface-variant)', letterSpacing: '0.1em', mb: 0.75 }}>PAYLOAD</Typography>
          <Box sx={{ position: 'relative' }}>
            <Box sx={{ bgcolor: '#0d1117', color: '#e2e8f0', p: 2, fontFamily: 'SF Mono, Monaco, monospace', fontSize: '0.6875rem', lineHeight: 1.7, whiteSpace: 'pre', overflowX: 'auto', maxHeight: 280, overflowY: 'auto' }}>
              {pretty}
            </Box>
            <Box sx={{ position: 'absolute', top: 6, right: 6 }}><CopyText text={pretty} /></Box>
          </Box>
        </Box>
      </Collapse>
    </Box>
  )
}

// ── API key modal ─────────────────────────────────────────────────────────────

interface ApiKeyModalProps {
  open: boolean;
  onClose: () => void;
  keyInfo: BeamApiKey | null;
  onKeyUpdated: () => void;
}

function ApiKeyModal({ open, onClose, keyInfo, onKeyUpdated }: ApiKeyModalProps) {
  const [loading, setLoading] = useState(false)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [keyCopied, setKeyCopied] = useState(false)

  const [genTotpOpen, setGenTotpOpen] = useState(false)
  const [revokeTotpOpen, setRevokeTotpOpen] = useState(false)

  useEffect(() => { if (open) { setNewKey(null) } }, [open])

  const handleGenerate = async () => {
    try {
      const res = await beamApi.generateApiKey()
      setNewKey(res.apiKey)
      onKeyUpdated()
    } finally { setGenTotpOpen(false) }
  }

  const handleRevoke = async () => {
    try { await beamApi.revokeApiKey(); setNewKey(null); onKeyUpdated() }
    finally { setRevokeTotpOpen(false) }
  }

  const copyKey = () => {
    if (!newKey) return
    navigator.clipboard.writeText(newKey)
    setKeyCopied(true)
    setTimeout(() => setKeyCopied(false), 2000)
  }

  const anyTotpOpen = genTotpOpen || revokeTotpOpen

  return (
    <>
      {/* disableEnforceFocus lets the TOTP overlay steal focus from this Dialog */}
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth disableEnforceFocus={anyTotpOpen}
        PaperProps={{ sx: { borderRadius: 0, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' } }}>
        <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid var(--border-col)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <VpnKeyOutlinedIcon sx={{ fontSize: '1.125rem', color: colorPalette.primary }} />
            <Box>
              <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost' }}>Beam API Key</Typography>
              <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', mt: 0.125 }}>Authenticate your server when beaming data to OpenIV</Typography>
            </Box>
          </Box>
          <IconButton disableRipple size="small" onClick={onClose} sx={{ borderRadius: 0, color: '#94a3b8', '&:hover': { color: 'var(--on-surface-variant)' } }}>
            <CloseRoundedIcon sx={{ fontSize: '1.125rem' }} />
          </IconButton>
        </Box>

        <Box sx={{ px: 3, py: 3 }}>
          {loading ? (
            <Stack gap={2}><Skeleton height={60} /><Skeleton height={40} /></Stack>
          ) : (
            <Stack gap={2.5}>
              <Box sx={{ p: 2, bgcolor: 'var(--section-bg)', border: '1px solid var(--border-col)' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
                  <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--heading-color)', fontFamily: 'Jost' }}>Current key</Typography>
                  <Box sx={{ px: 1, py: 0.375, fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.1em', bgcolor: keyInfo ? '#f0fdf4' : '#f8fafc', color: keyInfo ? '#10b981' : '#94a3b8' }}>
                    {keyInfo ? 'ACTIVE' : 'NOT SET'}
                  </Box>
                </Box>
                {keyInfo ? (
                  <>
                    <Typography sx={{ fontSize: '0.875rem', fontFamily: 'SF Mono, Monaco, monospace', color: 'var(--heading-color)', mb: 0.5 }}>
                      {keyInfo.prefix}••••••••••••••••••
                    </Typography>
                    <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8' }}>
                      Created {new Date(keyInfo.createdAt).toLocaleDateString()}{keyInfo.lastUsedAt ? ` · Last used ${new Date(keyInfo.lastUsedAt).toLocaleDateString()}` : ' · Never used'}
                    </Typography>
                  </>
                ) : (
                  <Typography sx={{ fontSize: '0.8125rem', color: '#64748b', fontStyle: 'italic' }}>
                    No API key set. You can still use the "Beam Test" tool below via your dashboard session, or generate a key to integrate your server.
                  </Typography>
                )}
              </Box>

              {newKey && (
                <Box sx={{ p: 2, bgcolor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                  <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#10b981', mb: 1, letterSpacing: '0.08em' }}>
                    YOUR KEY — COPY NOW, SHOWN ONLY ONCE
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography sx={{ flex: 1, fontFamily: 'SF Mono, Monaco, monospace', fontSize: '0.75rem', color: 'var(--heading-color)', wordBreak: 'break-all' }}>{newKey}</Typography>
                    <Button
                      onClick={copyKey}
                      startIcon={keyCopied
                        ? <CheckRoundedIcon sx={{ fontSize: '0.875rem !important', color: '#ffffff' }} />
                        : <ContentCopyOutlinedIcon sx={{ fontSize: '0.875rem !important', color: '#ffffff' }} />}
                      sx={{ flexShrink: 0, bgcolor: keyCopied ? '#10b981' : colorPalette.primary, color: '#ffffff', px: 1.5, py: 0.75, fontSize: '0.75rem', fontWeight: 600, fontFamily: 'Jost', borderRadius: 0, textTransform: 'none', boxShadow: 'none', '& .MuiButton-startIcon': { color: '#ffffff', mr: 0.5 }, '&:hover': { bgcolor: keyCopied ? '#10b981' : '#1e293b' } }}>
                      <Box component="span" sx={{ color: '#ffffff' }}>{keyCopied ? 'Copied' : 'Copy'}</Box>
                    </Button>
                  </Box>
                </Box>
              )}

              <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>
                Pass this key in the <Box component="span" sx={{ fontFamily: 'SF Mono, Monaco, monospace', fontSize: '0.7rem', color: colorPalette.primary }}>Authorization: Bearer</Box> header of every beam request. Store it in your secrets manager — OpenIV never shows it again.
              </Typography>

              <Box sx={{ display: 'flex', gap: 1 }}>
                {newKey ? (
                  /* Just generated — copy it, then close */
                  <Button
                    onClick={onClose}
                    startIcon={<CheckRoundedIcon sx={{ fontSize: '0.875rem !important', color: '#ffffff' }} />}
                    sx={{ flex: 1, bgcolor: '#10b981', color: '#ffffff', px: 2, py: 1, fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Jost', borderRadius: 0, textTransform: 'none', boxShadow: 'none', '& .MuiButton-startIcon': { color: '#ffffff' }, '&:hover': { bgcolor: '#059669' } }}
                  >
                    <Box component="span" sx={{ color: '#ffffff' }}>Done</Box>
                  </Button>
                ) : keyInfo ? (
                  /* Pre-existing key — offer management actions */
                  <>
                    <Button
                      onClick={() => setGenTotpOpen(true)}
                      startIcon={<VpnKeyOutlinedIcon sx={{ fontSize: '0.875rem !important', color: '#ffffff' }} />}
                      sx={{ flex: 1, bgcolor: colorPalette.primary, color: '#ffffff', px: 2, py: 1, fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Jost', borderRadius: 0, textTransform: 'none', boxShadow: 'none', '& .MuiButton-startIcon': { color: '#ffffff' }, '&:hover': { bgcolor: 'var(--on-surface)' } }}
                    >
                      <Box component="span" sx={{ color: '#ffffff' }}>Regenerate key</Box>
                    </Button>
                    <Button
                      onClick={() => setRevokeTotpOpen(true)}
                      startIcon={<DeleteOutlineRoundedIcon sx={{ fontSize: '0.875rem !important' }} />}
                      sx={{ border: '1px solid #fecaca', color: '#dc2626', px: 2, py: 1, fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Jost', borderRadius: 0, textTransform: 'none', '&:hover': { bgcolor: '#fef2f2' } }}
                    >
                      Revoke
                    </Button>
                  </>
                ) : (
                  /* No key yet — generate first time */
                  <Button
                    onClick={() => setGenTotpOpen(true)}
                    startIcon={<VpnKeyOutlinedIcon sx={{ fontSize: '0.875rem !important', color: '#ffffff' }} />}
                    sx={{ flex: 1, bgcolor: colorPalette.primary, color: '#ffffff', px: 2, py: 1, fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Jost', borderRadius: 0, textTransform: 'none', boxShadow: 'none', '& .MuiButton-startIcon': { color: '#ffffff' }, '&:hover': { bgcolor: 'var(--on-surface)' } }}
                  >
                    <Box component="span" sx={{ color: '#ffffff' }}>Generate key</Box>
                  </Button>
                )}
              </Box>
            </Stack>
          )}
        </Box>
      </Dialog>

      <TOTPConfirmation
        open={genTotpOpen}
        onClose={() => setGenTotpOpen(false)}
        onConfirm={handleGenerate}
        operation={keyInfo ? 'update' : 'create'}
        title={keyInfo ? 'Regenerate beam API key' : 'Generate beam API key'}
        description={keyInfo ? 'Regenerating immediately invalidates the existing key. Update your servers before deploying.' : 'Generating an API key allows your server to authenticate when beaming data to OpenIV.'}
        resourceType="Beam API key"
        resourceName="Institution beam API key"
        changes={keyInfo ? [{ field: 'API Key', from: 'Current key', to: 'New generated key' }] : undefined}
      />
      <TOTPConfirmation
        open={revokeTotpOpen}
        onClose={() => setRevokeTotpOpen(false)}
        onConfirm={handleRevoke}
        operation="delete"
        title="Revoke beam API key"
        description="Revoking the key immediately stops all beam ingestion. Beams will be rejected with 401 until a new key is generated."
        resourceType="Beam API key"
        resourceName="Institution beam API key"
      />
    </>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

function generateStreamsWithCurrentTimestamps() {
  const now = new Date()
  const ts1 = new Date(now.getTime() - 2 * 60 * 1000).toISOString()
  const ts2 = new Date(now.getTime() - 2 * 60 * 1000).toISOString()
  const ts3 = new Date(now.getTime() - 1 * 60 * 1000).toISOString()
  const ts4 = new Date(now.getTime() - 8 * 60 * 60 * 1000).toISOString()

  return streams.map(stream => ({
    ...stream,
    schema: stream.schema.map(field =>
      field.field === 'occurred_at'
        ? { ...field, example: stream.id === 'transactions' ? ts1 : stream.id === 'logins' ? ts2 : stream.id === 'activity' ? ts3 : stream.id === 'location' ? ts3 : stream.id === 'devices' ? ts4 : ts3 }
        : field
    ),
  }))
}

export default function DataBeamingPage() {
  const [keyInfo, setKeyInfo] = useState<BeamApiKey | null>(null)
  const [loadingKey, setLoadingKey] = useState(true)

  const loadKey = useCallback(async () => {
    try {
      const res = await beamApi.getApiKeyInfo()
      setKeyInfo(res.key)
    } finally {
      setLoadingKey(false)
    }
  }, [])

  useEffect(() => { loadKey() }, [loadKey])

  const streamsWithTimestamps = useMemo(() => generateStreamsWithCurrentTimestamps(), [])
  const [activeStream, setActiveStream] = useState<StreamId>('transactions')
  const [apiKeyOpen, setApiKeyOpen] = useState(false)
  const [testResponse, setTestResponse] = useState<any>(null)
  const { sandboxEnabled, setSandboxEnabled } = useSandbox()
  const [sendingTest, setSendingTest] = useState(false)
  const [testSuccess, setTestSuccess] = useState(false)
  const [editablePayload, setEditablePayload] = useState('')
  const [jsonError, setJsonError] = useState<string | null>(null)

  // KYC SSE streaming state
  const [kycStreaming, setKycStreaming] = useState(false)
  const [kycSteps, setKycSteps] = useState<KycStepEvent[]>([])
  const [kycResult, setKycResult] = useState<KycStreamResult | null>(null)
  const [kycStreamError, setKycStreamError] = useState<string | null>(null)

  // Transaction stream — optional customer_kyc_tier
  const [txnKycTier, setTxnKycTier] = useState<'' | '1' | '2' | '3'>('')

  // KYC stream — required customer_kyc_tier (institution's assigned tier)
  const [kycTierForm, setKycTierForm] = useState<'1' | '2' | '3'>('1')

  // KYC structured form state
  const [kycForm, setKycForm] = useState({ customer_id: 'CUST-001', name: 'Adamu Ibrahim', bvn: '22123456789', nin: '12345678901', occurred_at: new Date().toISOString(), monthly_inflow: '', monthly_outflow: '' })
  const [kycPhotoFile, setKycPhotoFile] = useState<File | null>(null)
  const [kycPhotoPreview, setKycPhotoPreview] = useState<string | null>(null)
  const kycPhotoInputRef = useRef<HTMLInputElement>(null)

  // Initialize payload when stream changes
  useEffect(() => {
    const streamObj = streamsWithTimestamps.find(s => s.id === activeStream)!
    const payload: any = {}
    streamObj.schema.forEach(f => {
      payload[f.field] = f.type === 'number' ? Number(f.example) : f.example === 'true' ? true : f.example === 'false' ? false : f.example
    })
    setEditablePayload(JSON.stringify(payload, null, 2))
    setJsonError(null)
  }, [activeStream, streamsWithTimestamps])

  const handleSendTest = async () => {
    if (!sandboxEnabled) {
      setSandboxEnabled(true)
      return
    }

    if (!keyInfo) {
      setApiKeyOpen(true)
      return
    }

    try {
      const parsed = JSON.parse(editablePayload)
      setJsonError(null)

      // KYC stream uses SSE streaming with structured form payload
      if (activeStream === 'kyc') {
        const kycPayload: Record<string, unknown> = {
          customer_id: kycForm.customer_id,
          customer_kyc_tier: Number(kycTierForm),
          occurred_at: kycForm.occurred_at || new Date().toISOString(),
        }
        if (kycForm.name.trim())           kycPayload.name           = kycForm.name
        if (kycForm.bvn.trim())            kycPayload.bvn            = kycForm.bvn
        if (kycForm.nin.trim())            kycPayload.nin            = kycForm.nin
        if (kycForm.monthly_inflow.trim()) kycPayload.monthly_inflow  = Number(kycForm.monthly_inflow)
        if (kycForm.monthly_outflow.trim()) kycPayload.monthly_outflow = Number(kycForm.monthly_outflow)
        if (kycPhotoFile) {
          const b64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload  = () => resolve(reader.result as string)
            reader.onerror = () => reject(new Error('Failed to read photo'))
            reader.readAsDataURL(kycPhotoFile)
          })
          kycPayload.photo = b64
        }
        setKycStreaming(true)
        setKycSteps([])
        setKycResult(null)
        setKycStreamError(null)
        await streamKycBeam(
          kycPayload,
          step   => setKycSteps(prev => [...prev, step]),
          result => { setKycResult(result); setKycStreaming(false); loadRecords() },
          err    => { setKycStreamError(err); setKycStreaming(false) },
        )
        return
      }

      setSendingTest(true)
      // For transactions, inject customer_kyc_tier if selected
      const beamPayload = (activeStream === 'transactions' && txnKycTier !== '')
        ? { ...parsed, customer_kyc_tier: Number(txnKycTier) }
        : parsed
      const res = await beamApi.sendTestPayload(activeStream, beamPayload)
      setTestResponse(res)
      setTestSuccess(true)
      setTimeout(() => setTestSuccess(false), 3000)
      loadRecords() // refresh list
    } catch (err) {
      if (err instanceof SyntaxError) {
        setJsonError('Invalid JSON format')
      } else {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        if (msg.includes('MICRO_TIMING_ANOMALY')) {
          setJsonError(
            'Beam rejected — Micro-Timing Anomaly: occurred_at is within ±5 seconds of institution time. ' +
            'A cybersecurity case has been auto-opened. Use a timestamp at least 6 seconds in the past (e.g. 2 minutes ago) and retry.'
          )
        } else {
          setJsonError(`Test beam failed: ${msg}`)
        }
        console.error('Test beam failed', err)
      }
    } finally {
      setSendingTest(false)
    }
  }

  // ── Live beam records ─────────────────────────────────────────────────────
  const [allRecords, setAllRecords] = useState<import('@/api/beam').BeamRecord[]>([])
  const [recordsLoading, setRecordsLoading] = useState(true)
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadRecords = useCallback(async () => {
    try {
      const res = await beamApi.listRecords()
      setAllRecords(res.records)
    } catch {
      // silent — keep showing whatever we had before
    } finally {
      setRecordsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadRecords()
    refreshTimerRef.current = setInterval(loadRecords, 30_000)
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current)
    }
  }, [loadRecords])



  // ── Derived per-stream stats from real data ───────────────────────────────
  const liveStreamStats = useMemo(() => {
    const map: Record<string, { count: number; lastSeen: string | null }> = {}
    const streamIds: StreamId[] = ['transactions', 'logins', 'activity', 'location', 'devices', 'otps', 'kyc']
    streamIds.forEach(id => { map[id] = { count: 0, lastSeen: null } })
    allRecords.forEach(r => {
      if (map[r.stream]) {
        map[r.stream].count++
        if (!map[r.stream].lastSeen || r.receivedAt > map[r.stream].lastSeen!) {
          map[r.stream].lastSeen = r.receivedAt
        }
      }
    })
    return map
  }, [allRecords])

  const activeStreamRecords = useMemo(
    () => allRecords.filter(r => r.stream === activeStream).slice(0, 8),
    [allRecords, activeStream],
  )

  const stream = streamsWithTimestamps.find(s => s.id === activeStream)!

  const connected = streamsWithTimestamps.filter(s => (liveStreamStats[s.id]?.count ?? 0) > 0).length
  const totalRecords = allRecords.length

  const healthMetrics = useMemo(() => {
    const durations = allRecords.map(r => r.durationMs).filter((d): d is number => d != null && d > 0).sort((a, b) => a - b)
    const medianLatency = durations.length > 0
      ? `${durations[Math.floor(durations.length / 2)]}ms`
      : '—'

    const rejected = allRecords.filter(r => r.status === 'rejected' || r.status === 'error').length
    const validity = totalRecords > 0
      ? `${((1 - rejected / totalRecords) * 100).toFixed(1)}%`
      : '—'

    return { medianLatency, validity, rejected }
  }, [allRecords, totalRecords])

  return (
    <>
      <Box sx={{ p: 4 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, gap: 2, flexWrap: 'wrap' }}>
          <Box>
            <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: colorPalette.primary, letterSpacing: '0.14em', textTransform: 'uppercase', mb: 0.75 }}>Configure</Typography>
            <Typography sx={{ fontSize: '1.625rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost', letterSpacing: '-0.015em', mb: 0.5 }}>Beam to OpenIV</Typography>
            <Typography sx={{ fontSize: '0.9375rem', color: '#64748b', maxWidth: 720 }}>
              Stream the signals that power real-time fraud defense.
            </Typography>
          </Box>
          <Stack direction="row" gap={1.25} sx={{ mt: 0.75, flexShrink: 0 }}>
            <Button
              component={Link}
              to="/developers"
              target="_blank"
              rel="noopener noreferrer"
              sx={{ border: '1px solid var(--border-col)', bgcolor: 'var(--card-bg)', color: 'var(--on-surface-variant)', px: 2, py: 1, fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Jost', borderRadius: 0, textTransform: 'none', '&:hover': { bgcolor: 'var(--section-bg)', borderColor: '#cbd5e1' } }}>
              Read docs
            </Button>
            <Button
              startIcon={<VpnKeyOutlinedIcon sx={{ fontSize: '1rem !important' }} />}
              onClick={() => setApiKeyOpen(true)}
              sx={{ border: '1px solid var(--border-col)', bgcolor: 'var(--card-bg)', color: 'var(--on-surface-variant)', px: 2, py: 1, fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Jost', borderRadius: 0, textTransform: 'none', '&:hover': { bgcolor: 'var(--section-bg)', borderColor: '#cbd5e1' } }}>
              API Key
            </Button>
          </Stack>
        </Box>

        {/* Health KPIs */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, mb: 3 }}>
          {[
            { label: 'Streams connected', value: recordsLoading ? '…' : `${connected}/${streamsWithTimestamps.length - 5}`, sub: recordsLoading ? 'Loading…' : connected === streamsWithTimestamps.length ? 'Full coverage' : `${streamsWithTimestamps.length - 5 - connected} pending` },
            { label: 'Records received', value: recordsLoading ? '…' : totalRecords.toLocaleString(), sub: 'last 100 across all streams' },
            { label: 'Median latency', value: recordsLoading ? '…' : healthMetrics.medianLatency, sub: 'from your core to OpenIV' },
            { label: 'Schema validity', value: recordsLoading ? '…' : healthMetrics.validity, sub: healthMetrics.rejected > 0 ? `${healthMetrics.rejected} rejected total` : 'No rejections' },
          ].map(s => (
            <Box
              key={s.label}
              data-ai-analyzable="true"
              data-ai-description={`Ingestion KPI: ${s.label}. current value: ${s.value}. status: ${s.sub}.`}
              sx={{ bgcolor: 'var(--card-bg)', border: '1px solid var(--border-col)', p: 2.25 }}>
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 0.625 }}>{s.label}</Typography>
              <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost', lineHeight: 1.1, mb: 0.5 }}>{s.value}</Typography>
              <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>{s.sub}</Typography>
            </Box>
          ))}
        </Box>

        {/* Stream picker */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.5, mb: 3 }}>
          {streamsWithTimestamps
            .filter(s => s.id === 'transactions' || s.id === 'kyc')
            .map(s => {
              const isActive = s.id === activeStream
              const isSoon = false
              const live = liveStreamStats[s.id]
              const liveCount = live?.count ?? 0
              const hasData = liveCount > 0
              const dotColor = recordsLoading ? '#94a3b8' : hasData ? '#10b981' : '#dc2626'
              const countLabel = recordsLoading ? '…' : hasData ? `${liveCount.toLocaleString()} recv'd` : 'No data'
              return (
                <Box
                  key={s.id}
                  onClick={isSoon ? undefined : () => setActiveStream(s.id)}
                  data-ai-analyzable="true"
                  data-ai-description={`Data Stream: ${s.title}. status: ${isSoon ? 'COMING SOON' : statusConfig[s.status].label.toUpperCase()}. records today: ${liveCount.toLocaleString()}. description: ${s.desc}.`}
                  sx={{
                    bgcolor: isSoon ? 'var(--section-bg)' : 'var(--card-bg)',
                    border: '1px solid',
                    borderColor: isActive ? colorPalette.primary : 'var(--border-col)',
                    p: 2, position: 'relative', transition: 'all 0.18s',
                    cursor: isSoon ? 'default' : 'pointer',
                    overflow: 'hidden',
                    '&:hover': isSoon ? {} : { borderColor: isActive ? colorPalette.primary : '#cbd5e1' },
                    '&::before': isActive ? { content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: '2px', bgcolor: colorPalette.primary } : {},
                  }}>

                  {/* Card content — dimmed for coming-soon */}
                  <Box sx={{ opacity: isSoon ? 0.38 : 1, transition: 'opacity 0.18s' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                      <Box sx={{ width: 32, height: 32, bgcolor: `${colorPalette.primary}10`, color: colorPalette.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{s.icon}</Box>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: dotColor }} />
                    </Box>
                    <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost', mb: 0.25 }}>{s.title}</Typography>
                    <Typography sx={{ fontSize: '0.6875rem', color: '#64748b', fontFamily: 'SF Mono, Monaco, monospace' }}>
                      {countLabel}
                    </Typography>
                  </Box>

                  {/* Diagonal watermark for coming-soon streams */}
                  {isSoon && (
                    <Box sx={{
                      position: 'absolute', inset: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      pointerEvents: 'none',
                    }}>
                      <Typography sx={{
                        fontSize: '0.4375rem', fontWeight: 900,
                        color: '#94a3b8', letterSpacing: '0.2em',
                        textTransform: 'uppercase',
                        transform: 'rotate(-28deg)',
                        userSelect: 'none',
                        border: '1px solid #cbd5e1',
                        px: 0.75, py: 0.375,
                        bgcolor: 'rgba(255,255,255,0.85)',
                        backdropFilter: 'blur(2px)',
                      }}>
                        Coming Soon
                      </Typography>
                    </Box>
                  )}
                </Box>
              )
            })}
        </Box>

        {/* Detail panel */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: 3, minWidth: 0 }}>
          <Stack gap={3} sx={{ minWidth: 0, overflow: 'hidden' }}>
            {/* Why box */}
            <Box
              data-ai-analyzable="true"
              data-ai-description={`Eureka Insight: Importance of the ${stream.title} stream. powers: ${stream.powers}. reason: ${stream.why}`}
              sx={{ bgcolor: colorPalette.primary, color: '#ffffff', p: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25 }}>
                <AutoAwesomeOutlinedIcon sx={{ fontSize: '1.125rem' }} />
                <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' }}>Why beam {stream.title.toLowerCase()}?</Typography>
              </Box>
              <Typography sx={{ fontSize: '0.9375rem', fontWeight: 600, lineHeight: 1.55, mb: 1.5, fontFamily: 'Jost' }}>{stream.why}</Typography>
              <Box>
                <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.25 }}>Powers</Typography>
                <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600 }}>{stream.powers}</Typography>
              </Box>
            </Box>


            {/* Simulation Box - Beam Test Transaction */}
            <Box sx={{ bgcolor: 'var(--card-bg)', border: '1px solid var(--border-col)', p: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PlayCircleOutlineIcon sx={{ fontSize: '1.125rem', color: colorPalette.primary }} />
                  <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost' }}>Beam Test Transaction</Typography>
                </Box>
                {sandboxEnabled && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1, py: 0.375, bgcolor: '#fff7ed', border: '1px solid #ffedd5' }}>
                    <ScienceOutlinedIcon sx={{ fontSize: '0.85rem', color: '#c2410c' }} />
                    <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#c2410c', letterSpacing: '0.05em' }}>SANDBOX MODE</Typography>
                  </Box>
                )}
              </Box>

              <Box sx={{ mb: 2 }}>
                {activeStream === 'kyc' ? (
                  /* ── Compact KYC form ──────────────────────────────── */
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.875 }}>
                    <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mb: 0.25 }}>
                      Fill in the identity fields — <strong>customer_id</strong> and <strong>customer_kyc_tier</strong> are required:
                    </Typography>

                    {/* Row 1: customer_id · name · occurred_at */}
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0.875 }}>
                      {([
                        { key: 'customer_id', label: 'customer_id *', placeholder: 'CUST-001' },
                        { key: 'name',        label: 'name',           placeholder: 'Adamu Ibrahim' },
                        { key: 'occurred_at', label: 'occurred_at *',  placeholder: '2026-05-14T10:00:00Z' },
                      ] as const).map(({ key, label, placeholder }) => (
                        <Box key={key}>
                          <Typography sx={{ fontSize: '0.625rem', fontWeight: 600, color: '#94a3b8', mb: 0.375, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</Typography>
                          <Box
                            component="input"
                            placeholder={placeholder}
                            value={kycForm[key]}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setKycForm(f => ({ ...f, [key]: e.target.value }))}
                            sx={{ width: '100%', px: 1, py: 0.625, fontSize: '0.75rem', fontFamily: 'SF Mono, Monaco, monospace',
                              bgcolor: 'var(--input-bg)', border: '1px solid var(--border-col)', outline: 'none', boxSizing: 'border-box',
                              '&:focus': { borderColor: colorPalette.primary } }}
                          />
                        </Box>
                      ))}
                    </Box>

                    {/* Row 2: bvn · nin · photo picker */}
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0.875 }}>
                      {([
                        { key: 'bvn', label: 'bvn', placeholder: '22123456789' },
                        { key: 'nin', label: 'nin', placeholder: '12345678901' },
                      ] as const).map(({ key, label, placeholder }) => (
                        <Box key={key}>
                          <Typography sx={{ fontSize: '0.625rem', fontWeight: 600, color: '#94a3b8', mb: 0.375, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</Typography>
                          <Box
                            component="input"
                            placeholder={placeholder}
                            value={kycForm[key]}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setKycForm(f => ({ ...f, [key]: e.target.value }))}
                            sx={{ width: '100%', px: 1, py: 0.625, fontSize: '0.75rem', fontFamily: 'SF Mono, Monaco, monospace',
                              bgcolor: 'var(--input-bg)', border: '1px solid var(--border-col)', outline: 'none', boxSizing: 'border-box',
                              '&:focus': { borderColor: colorPalette.primary } }}
                          />
                        </Box>
                      ))}

                      {/* Photo picker — lives in the third column of row 2 */}
                      <Box>
                        <Typography sx={{ fontSize: '0.625rem', fontWeight: 600, color: '#94a3b8', mb: 0.375, textTransform: 'uppercase', letterSpacing: '0.06em' }}>photo</Typography>
                        <Box
                          onClick={() => kycPhotoInputRef.current?.click()}
                          sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1, py: 0.625,
                            border: '1px dashed #cbd5e1', cursor: 'pointer', bgcolor: 'var(--input-bg)',
                            '&:hover': { borderColor: colorPalette.primary, bgcolor: '#f0f4ff' } }}>
                          {kycPhotoPreview ? (
                            <Box component="img" src={kycPhotoPreview}
                              sx={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                          ) : null}
                          <Typography sx={{ fontSize: '0.75rem', color: kycPhotoFile ? '#1e293b' : '#94a3b8',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                            {kycPhotoFile ? kycPhotoFile.name : 'Select…'}
                          </Typography>
                          {kycPhotoFile && (
                            <Box component="span"
                              onClick={(e: React.MouseEvent) => { e.stopPropagation(); setKycPhotoFile(null); setKycPhotoPreview(null) }}
                              sx={{ fontSize: '0.625rem', color: '#94a3b8', cursor: 'pointer', flexShrink: 0, '&:hover': { color: '#dc2626' } }}>
                              ✕
                            </Box>
                          )}
                        </Box>
                        <input
                          ref={kycPhotoInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            const file = e.target.files?.[0] ?? null
                            setKycPhotoFile(file)
                            setKycPhotoPreview(file ? URL.createObjectURL(file) : null)
                            e.target.value = ''
                          }}
                        />
                      </Box>
                    </Box>

                    {/* Row 3: monthly_inflow · monthly_outflow · customer_kyc_tier */}
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0.875 }}>
                      {([
                        { key: 'monthly_inflow',  label: 'monthly_inflow (kobo)',  placeholder: '5000000' },
                        { key: 'monthly_outflow', label: 'monthly_outflow (kobo)', placeholder: '3200000' },
                      ] as const).map(({ key, label, placeholder }) => (
                        <Box key={key}>
                          <Typography sx={{ fontSize: '0.625rem', fontWeight: 600, color: '#94a3b8', mb: 0.375, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</Typography>
                          <Box
                            component="input"
                            type="number"
                            placeholder={placeholder}
                            value={kycForm[key]}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setKycForm(f => ({ ...f, [key]: e.target.value }))}
                            sx={{ width: '100%', px: 1, py: 0.625, fontSize: '0.75rem', fontFamily: 'SF Mono, Monaco, monospace',
                              bgcolor: 'var(--input-bg)', border: '1px solid var(--border-col)', outline: 'none', boxSizing: 'border-box',
                              '&:focus': { borderColor: colorPalette.primary } }}
                          />
                        </Box>
                      ))}
                      {/* customer_kyc_tier — institution's assigned tier (required) */}
                      <Box>
                        <Typography sx={{ fontSize: '0.625rem', fontWeight: 600, color: '#94a3b8', mb: 0.375, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          customer_kyc_tier <Box component="span" sx={{ color: '#ef4444' }}>*</Box>
                        </Typography>
                        <FormControl size="small" fullWidth>
                          <Select
                            value={kycTierForm}
                            onChange={e => setKycTierForm(e.target.value as '1' | '2' | '3')}
                            sx={{
                              fontSize: '0.75rem', fontFamily: 'SF Mono, Monaco, monospace',
                              bgcolor: 'var(--input-bg)', borderRadius: 0, height: 30,
                              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--border-col)' },
                              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#cbd5e1' },
                              '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: colorPalette.primary },
                            }}
                          >
                            <MenuItem value="1" sx={{ fontSize: '0.75rem' }}>Tier 1 — Basic</MenuItem>
                            <MenuItem value="2" sx={{ fontSize: '0.75rem' }}>Tier 2 — Intermediate</MenuItem>
                            <MenuItem value="3" sx={{ fontSize: '0.75rem' }}>Tier 3 — Full KYC</MenuItem>
                          </Select>
                        </FormControl>
                      </Box>
                    </Box>

                    {jsonError && (
                      <Typography sx={{ fontSize: '0.75rem', color: '#dc2626', mt: 0.25 }}>{jsonError}</Typography>
                    )}
                  </Box>
                ) : (
                  /* ── JSON textarea for all other streams ────────────── */
                  <>
                    <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mb: 1 }}>
                      Edit the payload below to simulate a custom {stream.title.toLowerCase()} event:
                    </Typography>

                    {/* Customer KYC Tier — transactions only */}
                    {activeStream === 'transactions' && (
                      <Box sx={{ mb: 1.25 }}>
                        <Typography sx={{ fontSize: '0.625rem', fontWeight: 600, color: '#94a3b8', mb: 0.5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          Customer KYC Tier <Box component="span" sx={{ color: '#cbd5e1', fontWeight: 400 }}>— optional</Box>
                        </Typography>
                        <FormControl size="small" fullWidth>
                          <Select
                            value={txnKycTier}
                            onChange={e => setTxnKycTier(e.target.value as '' | '1' | '2' | '3')}
                            displayEmpty
                            sx={{
                              fontSize: '0.75rem',
                              fontFamily: 'SF Mono, Monaco, monospace',
                              bgcolor: 'var(--input-bg)',
                              borderRadius: 0,
                              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--border-col)' },
                              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#cbd5e1' },
                              '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: colorPalette.primary },
                            }}
                          >
                            <MenuItem value="" sx={{ fontSize: '0.75rem' }}>Not specified</MenuItem>
                            <MenuItem value="1" sx={{ fontSize: '0.75rem' }}>Tier 1 — Basic</MenuItem>
                            <MenuItem value="2" sx={{ fontSize: '0.75rem' }}>Tier 2 — Intermediate</MenuItem>
                            <MenuItem value="3" sx={{ fontSize: '0.75rem' }}>Tier 3 — Full KYC</MenuItem>
                          </Select>
                        </FormControl>
                        {txnKycTier !== '' && (
                          <Typography sx={{ fontSize: '0.6875rem', color: '#64748b', mt: 0.5 }}>
                            <Box component="span" sx={{ fontFamily: 'SF Mono, Monaco, monospace', color: colorPalette.primary }}>customer_kyc_tier: {txnKycTier}</Box> will be appended to the payload before beaming.
                          </Typography>
                        )}
                      </Box>
                    )}

                    <TextField
                      multiline
                      rows={8}
                      fullWidth
                      value={editablePayload}
                      onChange={(e) => setEditablePayload(e.target.value)}
                      error={!!jsonError}
                      helperText={jsonError}
                      sx={{
                        '& .MuiInputBase-root': {
                          fontSize: '0.75rem',
                          fontFamily: 'SF Mono, Monaco, monospace',
                          bgcolor: 'var(--input-bg)',
                          borderRadius: 0,
                          '& fieldset': { borderColor: 'var(--border-col)' },
                          '&:hover fieldset': { borderColor: '#cbd5e1' },
                        }
                      }}
                    />
                  </>
                )}
              </Box>

              <Button
                fullWidth
                disabled={sendingTest}
                onClick={handleSendTest}
                startIcon={
                  !sandboxEnabled
                    ? <ScienceOutlinedIcon />
                    : !keyInfo
                      ? <VpnKeyOutlinedIcon />
                      : testSuccess
                        ? <CheckCircleOutlineRoundedIcon />
                        : <PlayCircleOutlineIcon />
                }
                sx={{
                  bgcolor: (!sandboxEnabled || !keyInfo) ? '#fff7ed' : testSuccess ? '#10b981' : colorPalette.primary,
                  color: (!sandboxEnabled || !keyInfo) ? '#c2410c' : '#ffffff',
                  border: (!sandboxEnabled || !keyInfo) ? '1px solid #ffedd5' : 'none',
                  py: 1.25,
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  fontFamily: 'Jost',
                  textTransform: 'none',
                  borderRadius: 0,
                  boxShadow: 'none',
                  '&:hover': { bgcolor: (!sandboxEnabled || !keyInfo) ? '#ffedd5' : testSuccess ? '#10b981' : '#1e293b' },
                  '&.Mui-disabled': { bgcolor: '#f1f5f9', color: '#94a3b8' }
                }}
              >
                {!sandboxEnabled
                  ? 'Switch to Sandbox to Test'
                  : !keyInfo
                    ? 'Get API Key to Get Started'
                    : sendingTest
                      ? 'Beaming...'
                      : testSuccess
                        ? 'Success! Check Logs'
                        : `Beam Test ${stream.title} Record`}
              </Button>

              {/* KYC SSE pipeline live viewer */}
              {activeStream === 'kyc' && (kycStreaming || kycSteps.length > 0 || kycResult !== null || kycStreamError !== null) && (
                <Box sx={{ mt: 3, border: '1px solid var(--border-col)', bgcolor: 'var(--card-bg)' }}>
                  <Box sx={{ px: 2, py: 1.25, borderBottom: '1px solid var(--border-col)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      KYC Pipeline
                    </Typography>
                    {kycStreaming && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#10b981', '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.3 } }, animation: 'pulse 1s infinite' }} />
                        <Typography sx={{ fontSize: '0.625rem', fontWeight: 600, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Live</Typography>
                      </Box>
                    )}
                  </Box>

                  <Stack gap={0}>
                    {(['bvn_nin', 'phone_match', 'liveness', 'pep_check'] as const).map((stepId, idx) => {
                      const step = kycSteps.find(s => s.step === stepId)
                      const isRunning = kycStreaming && !step && kycSteps.length === idx
                      const isPending = !step && !isRunning
                      const label = ({ bvn_nin: 'Identity (BVN/NIN)', phone_match: 'Phone Match', liveness: 'Liveness Check', pep_check: 'PEP Screening' } as Record<string, string>)[stepId]

                      const dotBg = isPending ? '#f1f5f9'
                        : isRunning ? '#dbeafe'
                        : step!.status === 'pass' ? '#dcfce7'
                        : step!.status === 'fail' ? '#fee2e2'
                        : '#fef9c3'
                      const dotColor = isPending ? '' : isRunning ? '#3b82f6'
                        : step!.status === 'pass' ? '#16a34a'
                        : step!.status === 'fail' ? '#dc2626' : '#d97706'

                      return (
                        <Box key={stepId} sx={{ px: 2, py: 1.25, display: 'flex', alignItems: 'center', gap: 1.5, borderBottom: '1px solid var(--border-col)' }}>
                          <Box sx={{ width: 22, height: 22, borderRadius: '50%', bgcolor: dotBg, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {isRunning
                              ? <Box sx={{ width: 8, height: 8, borderRadius: '50%', border: `2px solid ${dotColor}`, borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite', '@keyframes spin': { to: { transform: 'rotate(360deg)' } } }} />
                              : !isPending && (
                                <Typography sx={{ fontSize: '0.625rem', fontWeight: 900, color: dotColor, lineHeight: 1 }}>
                                  {step!.status === 'pass' ? '✓' : step!.status === 'fail' ? '✗' : '~'}
                                </Typography>
                              )}
                          </Box>

                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: isPending ? '#94a3b8' : '#334155' }}>
                              {label}
                            </Typography>
                            {step && (
                              <Typography sx={{ fontSize: '0.6875rem', color: '#64748b', mt: 0.125, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {step.detail}
                              </Typography>
                            )}
                          </Box>

                          {step && (
                            <Box sx={{ flexShrink: 0, px: 1, py: 0.25, border: '1px solid',
                              bgcolor: step.stepRiskScore < 30 ? '#dcfce7' : step.stepRiskScore < 65 ? '#fffbeb' : '#fee2e2',
                              borderColor: step.stepRiskScore < 30 ? '#bbf7d0' : step.stepRiskScore < 65 ? '#fde68a' : '#fecdd3' }}>
                              <Typography sx={{ fontSize: '0.625rem', fontWeight: 800, fontFamily: 'monospace',
                                color: step.stepRiskScore < 30 ? '#15803d' : step.stepRiskScore < 65 ? '#d97706' : '#dc2626' }}>
                                {step.stepRiskScore}
                              </Typography>
                            </Box>
                          )}
                        </Box>
                      )
                    })}
                  </Stack>

                  {kycResult && (
                    <Box sx={{ px: 2, py: 1.75, borderTop: '2px solid var(--border-col)' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: (kycResult.institutionKycTier != null || kycResult.knowledgeLevel) ? 1.5 : 0 }}>
                        <Box>
                          <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.25 }}>
                            Risk Score
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                            <Typography sx={{ fontSize: '1.625rem', fontWeight: 800, fontFamily: 'Jost', lineHeight: 1,
                              color: kycResult.overallRiskScore < 35 ? '#16a34a' : kycResult.overallRiskScore < 75 ? '#d97706' : '#dc2626' }}>
                              {kycResult.overallRiskScore}
                            </Typography>
                            <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>/100</Typography>
                          </Box>
                        </Box>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.25 }}>
                            Action
                          </Typography>
                          <Typography sx={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)' }}>{kycResult.actionDetail}</Typography>
                        </Box>
                        <Box sx={{ flexShrink: 0, px: 1.5, py: 0.625, border: '1px solid',
                          bgcolor: kycResult.action === 'clear' ? '#dcfce7' : kycResult.action === 'flagged' ? '#fffbeb' : '#fee2e2',
                          borderColor: kycResult.action === 'clear' ? '#bbf7d0' : kycResult.action === 'flagged' ? '#fde68a' : '#fecdd3' }}>
                          <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'Jost',
                            color: kycResult.action === 'clear' ? '#15803d' : kycResult.action === 'flagged' ? '#d97706' : '#dc2626' }}>
                            {kycResult.action === 'clear' ? 'Cleared' : kycResult.action === 'flagged' ? 'Flagged' : 'Case Opened'}
                          </Typography>
                        </Box>
                      </Box>
                      {/* Institution KYC Tier + Knowledge Level */}
                      {(kycResult.institutionKycTier != null || kycResult.knowledgeLevel) && (
                        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                          {kycResult.institutionKycTier != null && (
                            <Box>
                              <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.25 }}>
                                Institution KYC Tier
                              </Typography>
                              <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0284c7', fontFamily: 'Jost' }}>
                                Tier {kycResult.institutionKycTier}
                              </Typography>
                            </Box>
                          )}
                          {kycResult.knowledgeLevel && (
                            <Box>
                              <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.25 }}>
                                Knowledge Level
                              </Typography>
                              <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: '#7c3aed', fontFamily: 'Jost' }}>
                                {kycResult.knowledgeLevel === 't1' ? 'T1 — Basic' : kycResult.knowledgeLevel === 't2' ? 'T2 — Intermediate' : 'T3 — Full KYC'}
                              </Typography>
                            </Box>
                          )}
                        </Box>
                      )}
                    </Box>
                  )}

                  {kycStreamError && (
                    <Box sx={{ px: 2, py: 1.25, bgcolor: '#fee2e2' }}>
                      <Typography sx={{ fontSize: '0.75rem', color: '#dc2626' }}>{kycStreamError}</Typography>
                    </Box>
                  )}
                </Box>
              )}

              {testResponse && activeStream !== 'kyc' && (
                <Box sx={{ mt: 3, p: 2, bgcolor: 'var(--heading-color)', border: '1px solid #1e293b' }}>
                  <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.1em', mb: 1.5, textTransform: 'uppercase' }}>
                    Standard Response (developer insight)
                  </Typography>
                  <Box sx={{
                    fontFamily: 'SF Mono, Monaco, monospace',
                    fontSize: '0.75rem',
                    color: '#e2e8f0',
                    lineHeight: 1.6,
                    maxHeight: 240,
                    overflowY: 'auto'
                  }}>
                    <Box component="pre" sx={{ m: 0 }}>
                      {JSON.stringify(testResponse, null, 2)}
                    </Box>
                  </Box>
                  {testResponse.analysis && (
                    <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #1e293b' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <AutoAwesomeOutlinedIcon sx={{ fontSize: '0.875rem', color: colorPalette.primary }} />
                        <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#ffffff', fontFamily: 'Jost' }}>
                          Risk Analysis Applied
                        </Typography>
                      </Box>
                      <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8', lineHeight: 1.5 }}>
                        Score: <Box component="span" sx={{ color: (testResponse.analysis.risk_score ?? 0) >= 60 ? '#ef4444' : '#10b981', fontWeight: 700 }}>{testResponse.analysis.risk_score}</Box>
                        {testResponse.analysis.kyc_risk_score != null && (
                          <> · KYC Risk: <Box component="span" sx={{ color: (testResponse.analysis.kyc_risk_score ?? 0) >= 60 ? '#f59e0b' : '#94a3b8', fontWeight: 700 }}>{testResponse.analysis.kyc_risk_score}</Box></>
                        )}
                        {testResponse.analysis.risk_level && (
                          <> · Level: <Box component="span" sx={{ color: '#ffffff', fontWeight: 600 }}>{testResponse.analysis.risk_level}</Box></>
                        )}
                        {testResponse.analysis.recommended_action && (
                          <> · Action: <Box component="span" sx={{ color: colorPalette.primary, fontWeight: 700 }}>{testResponse.analysis.recommended_action}</Box></>
                        )}
                        {testResponse.analysis.institution_kyc_tier != null && (
                          <> · Institution KYC Tier: <Box component="span" sx={{ color: '#a5b4fc', fontWeight: 700 }}>{testResponse.analysis.institution_kyc_tier}</Box></>
                        )}
                      </Typography>
                      {(testResponse.analysis.kyc_required || testResponse.analysis.account_conflict) && (
                        <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          {testResponse.analysis.kyc_required && (
                            <Box sx={{ px: 1, py: 0.25, borderRadius: '4px', bgcolor: '#7c3aed22', border: '1px solid #7c3aed66', fontSize: '0.65rem', color: '#a78bfa', fontWeight: 700 }}>
                              KYC REQUIRED
                            </Box>
                          )}
                          {testResponse.analysis.account_conflict && (
                            <Box sx={{ px: 1, py: 0.25, borderRadius: '4px', bgcolor: '#dc262622', border: '1px solid #dc262666', fontSize: '0.65rem', color: '#f87171', fontWeight: 700 }}>
                              ACCOUNT CONFLICT
                            </Box>
                          )}
                        </Box>
                      )}
                    </Box>
                  )}
                </Box>
              )}
            </Box>

            {/* Recent payloads (Moved here) */}
            <Box sx={{ bgcolor: 'var(--card-bg)', border: '1px solid var(--border-col)' }}>
              <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid var(--border-col)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost' }}>Recent payloads</Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>Last events received on this stream</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.625 }}>
                  <Box sx={{
                    width: 6, height: 6, borderRadius: '50%',
                    bgcolor: recordsLoading ? '#94a3b8' : activeStreamRecords.length > 0 ? '#10b981' : '#94a3b8',
                    animation: !recordsLoading && activeStreamRecords.length > 0 ? 'pulse 2s infinite' : 'none',
                    '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.3 } },
                  }} />
                  <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: !recordsLoading && activeStreamRecords.length > 0 ? '#10b981' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    {recordsLoading ? 'loading' : activeStreamRecords.length > 0 ? 'live' : 'idle'}
                  </Typography>
                  <IconButton
                    size="small" onClick={loadRecords} disabled={recordsLoading}
                    sx={{ ml: 0.5, borderRadius: 0, color: '#94a3b8', '&:hover': { color: colorPalette.primary, bgcolor: `${colorPalette.primary}08` } }}
                  >
                    <RefreshRoundedIcon sx={{ fontSize: '0.875rem' }} />
                  </IconButton>
                </Box>
              </Box>
              <Stack>
                {recordsLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <Box key={i} sx={{ px: 3, py: 1.5, borderBottom: '1px solid var(--border-col)', display: 'flex', gap: 2 }}>
                      <Skeleton variant="rectangular" width={90} height={18} />
                      <Skeleton variant="rectangular" width="60%" height={18} />
                      <Skeleton variant="rectangular" width={60} height={18} />
                    </Box>
                  ))
                ) : activeStreamRecords.length === 0 ? (
                  <Box sx={{ p: 4, textAlign: 'center' }}>
                    <ErrorOutlineRoundedIcon sx={{ fontSize: '2rem', color: '#94a3b8', mb: 1 }} />
                    <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--on-surface-variant)', mb: 0.5 }}>No payloads on this stream yet</Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8', maxWidth: 320, mx: 'auto', mb: 2 }}>Generate an API key and instrument your core to start beaming.</Typography>
                    <Button onClick={() => setApiKeyOpen(true)} sx={{ bgcolor: colorPalette.primary, color: '#ffffff', px: 2.25, py: 1.125, fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Jost', borderRadius: 0, textTransform: 'none', boxShadow: 'none', '&:hover': { bgcolor: 'var(--on-surface)' } }}>
                      Get API Key
                    </Button>
                  </Box>
                ) : (
                  activeStreamRecords.map(r => <RecordRow key={r.id} record={r} />)
                )}
              </Stack>
            </Box>
          </Stack>
        </Box>
      </Box>



      <ApiKeyModal
        open={apiKeyOpen}
        onClose={() => setApiKeyOpen(false)}
        keyInfo={keyInfo}
        onKeyUpdated={loadKey}
      />
    </>
  )
}
