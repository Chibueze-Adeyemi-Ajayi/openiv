import {
  Box, Typography, Stack, Button, Chip, IconButton,
  Skeleton, Dialog, Collapse, TextField,
} from '@mui/material'
import { colorPalette } from '@/theme'
import TOTPConfirmation from '@/components/dashboard/TOTPConfirmation'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { beamApi, type BeamApiKey, type BeamRecord } from '@/api/beam'
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

// ── Syntax highlighting ───────────────────────────────────────────────────────

type Token = { text: string; color: string; italic?: boolean }

const C = {
  keyword: '#c792ea',
  string: '#c3e88d',
  number: '#f78c6c',
  comment: '#546e7a',
  func: '#82aaff',
  env: '#ffcb6b',
  url: '#80cbc4',
  punct: '#89ddff',
  plain: '#e2e8f0',
  operator: '#89ddff',
}

const KW_RE = new RegExp(
  `^(?:${[
    'curl', 'const', 'let', 'var', 'import', 'from', 'require', 'async', 'await',
    'function', 'return', 'if', 'else', 'try', 'catch', 'throw', 'new', 'class',
    'export', 'default', 'def', 'for', 'in', 'with', 'pass', 'raise', 'as', 'elif',
    'True', 'False', 'None', 'func', 'package', 'type', 'struct', 'interface',
    'public', 'private', 'protected', 'static', 'void', 'final', 'this',
    'print', 'println', 'true', 'false', 'null', 'undefined', 'nil',
    'bytes', 'json', 'http', 'time', 'net', 'os', 'fmt', 'uuid',
    'POST', 'GET', 'PUT', 'DELETE', 'PATCH', 'HEAD',
  ].join('|')})(?=[^a-zA-Z_0-9]|$)`,
)

const PATTERNS: Array<{ re: RegExp; color: string; italic?: boolean }> = [
  { re: /^#[^\n]*/, color: C.comment, italic: true },
  { re: /^\/\/[^\n]*/, color: C.comment, italic: true },
  { re: /^"(?:[^"\\]|\\.)*"/, color: C.string },
  { re: /^'(?:[^'\\]|\\.)*'/, color: C.string },
  { re: /^`(?:[^`\\]|\\.)*`/, color: C.string },
  { re: /^\$\{[^}]+\}/, color: C.env },
  { re: /^\$[A-Z_][A-Z_0-9]*/, color: C.env },
  { re: /^https?:\/\/[^\s'"\\),`]+/, color: C.url },
  { re: KW_RE, color: C.keyword },
  { re: /^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/, color: C.number },
  { re: /^[{}[\]();,]/, color: C.punct },
  { re: /^[:=<>+\-*/|&^~%!]/, color: C.operator },
  { re: /^[\\]/, color: C.punct },
  { re: /^[a-zA-Z_][a-zA-Z_0-9]*(?=\()/, color: C.func },
]

function tokenize(code: string): Token[] {
  const tokens: Token[] = []
  let remaining = code
  while (remaining.length > 0) {
    let matched = false
    for (const { re, color, italic } of PATTERNS) {
      const m = re.exec(remaining)
      if (m) {
        tokens.push({ text: m[0], color, italic })
        remaining = remaining.slice(m[0].length)
        matched = true
        break
      }
    }
    if (!matched) {
      const last = tokens[tokens.length - 1]
      if (last && last.color === C.plain && !last.italic) last.text += remaining[0]
      else tokens.push({ text: remaining[0], color: C.plain })
      remaining = remaining.slice(1)
    }
  }
  return tokens
}

function SyntaxCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const tokens = useMemo(() => tokenize(code), [code])

  const copy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <Box sx={{ position: 'relative' }}>
      <Box sx={{
        bgcolor: '#0d1117', p: 2.5, overflowX: 'auto',
        fontFamily: 'SF Mono, Monaco, Consolas, monospace',
        fontSize: '0.75rem', lineHeight: 1.75,
        maxHeight: 380, overflowY: 'auto',
      }}>
        {tokens.map((t, i) => (
          <Box key={i} component="span" sx={{ color: t.color, fontStyle: t.italic ? 'italic' : 'normal', whiteSpace: 'pre' }}>
            {t.text}
          </Box>
        ))}
      </Box>
      <Button
        size="small"
        startIcon={
          copied
            ? <CheckRoundedIcon sx={{ fontSize: '0.75rem !important', color: '#10b981' }} />
            : <ContentCopyOutlinedIcon sx={{ fontSize: '0.75rem !important' }} />
        }
        onClick={copy}
        sx={{
          position: 'absolute', top: 8, right: 8,
          fontSize: '0.6875rem', fontFamily: 'Jost', fontWeight: 600,
          color: copied ? '#10b981' : '#64748b', textTransform: 'none',
          px: 1, py: 0.375, borderRadius: 0, bgcolor: '#0d1117',
          '&:hover': { bgcolor: '#1e293b' },
          '& .MuiButton-startIcon': { mr: 0.375 },
        }}
      >
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </Box>
  )
}

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
      { field: 'amount', type: 'number', required: true, example: '14250000' },
      { field: 'channel', type: 'string', required: true, example: 'Wire | Transfer | Mobile | ATM | POS' },
      { field: 'counterparty', type: 'string', required: true, example: 'Sokoto BDC Ltd' },
      { field: 'status', type: 'string', required: true, example: 'pending' },
      { field: 'location', type: 'string', required: true, example: 'Sokoto' },
      { field: 'lat', type: 'number', required: true, example: '13.0059' },
      { field: 'lng', type: 'number', required: true, example: '5.2476' },
      { field: 'occurred_at', type: 'ISO 8601', required: true, example: '2026-05-01T17:56:29Z' },
      { field: 'sender_account', type: 'string', required: true, example: '0124567890' },
      { field: 'sender_bank', type: 'string', required: true, example: 'Access Bank' },
      { field: 'recipient_name', type: 'string', required: true, example: 'Sokoto BDC Ltd' },
      { field: 'recipient_account', type: 'string', required: true, example: '0034567891' },
      { field: 'recipient_bank', type: 'string', required: true, example: 'GTBank' },
      { field: 'currency', type: 'string', required: true, example: 'NGN' },
      { field: 'narration', type: 'string', required: true, example: 'FX Settlement — USD Purchase' },
      { field: 'device_id', type: 'string', required: true, example: 'dev_a1b2c3' },
      { field: 'ip_address', type: 'string', required: true, example: '102.89.45.67' },
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
      { field: 'outcome', type: 'enum', required: true, example: 'success | failed | 2fa_required' },
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
      { field: 'source', type: 'enum', required: true, example: 'gps | wifi | ip | cell' },
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
      { field: 'event_type', type: 'enum', required: true, example: 'requested | sent | verified | retry | failed' },
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
      { field: 'name', type: 'string', required: false, example: 'Adamu Ibrahim' },
      { field: 'bvn', type: 'string', required: false, example: '22123456789' },
      { field: 'nin', type: 'string', required: false, example: '12345678901' },
      { field: 'photo', type: 'string (base64)', required: false, example: 'data:image/jpeg;base64,/9j/4AAQ...' },
      { field: 'occurred_at', type: 'ISO 8601', required: true, example: '2026-05-14T10:00:00Z' },
    ],
  },
]

const statusConfig: Record<Stream['status'], { color: string; bg: string; label: string }> = {
  connected: { color: '#10b981', bg: '#f0fdf4', label: 'Connected' },
  partial: { color: '#f59e0b', bg: '#fffbeb', label: 'Partial' },
  disconnected: { color: '#dc2626', bg: '#fef2f2', label: 'Not connected' },
}

// ── Code samples ──────────────────────────────────────────────────────────────

type Lang = 'cURL' | 'Node.js' | 'Python' | 'Go'

function schemaFields(s: Stream) {
  // For KYC, show all fields so developers see every identity field in the sample.
  // For all other streams, only required fields keep samples concise.
  return s.id === 'kyc' ? s.schema : s.schema.filter(f => f.required)
}

function buildCurl(s: Stream) {
  const fields = schemaFields(s)
    .map(f => {
      const val = f.type === 'number' || f.type === 'boolean' ? f.example : `"${f.example}"`
      const comment = !f.required ? '  # optional' : ''
      return `    "${f.field}": ${val}${comment}`
    })
    .join(',\n')
  return `curl -X POST https://api.openiv.io/api/v1/beam/${s.id} \\
  -H "Authorization: Bearer $API_KEY" \\
  -H "X-Idempotency-Key: $(uuidgen)" \\
  -H "Content-Type: application/json" \\
  -d '{
${fields}
  }'`
}

function buildNode(s: Stream) {
  const fields = schemaFields(s)
    .map(f => {
      const val = f.type === 'number' || f.type === 'boolean' ? f.example : `'${f.example}'`
      const comment = !f.required ? '  // optional' : ''
      return `    ${f.field}: ${val},${comment}`
    })
    .join('\n')
  const fn = s.title.replace(/\s+/g, '')
  return `const axios = require('axios')
const { v4: uuid } = require('uuid')

const client = axios.create({
  baseURL: 'https://api.openiv.io/api/v1/beam',
  headers: { 'Authorization': \`Bearer \${process.env.OPENIV_BEAM_KEY}\` },
})

async function beam${fn}(data) {
  const response = await client.post('/${s.id}', {
${fields}
  }, { headers: { 'X-Idempotency-Key': uuid() } })
  return response.data  // { ok: true, record_id: ... }
}`
}

function buildPython(s: Stream) {
  const fields = schemaFields(s)
    .map(f => {
      const val = f.type === 'number' ? f.example : f.type === 'boolean' ? f.example.charAt(0).toUpperCase() + f.example.slice(1) : `'${f.example}'`
      const comment = !f.required ? '  # optional' : ''
      return `        '${f.field}': ${val},${comment}`
    })
    .join('\n')
  return `import httpx, uuid, os

client = httpx.Client(
    base_url='https://api.openiv.io/api/v1/beam',
    headers={'Authorization': f'Bearer {os.environ["OPENIV_BEAM_KEY"]}'},
)

def beam_${s.id}(data: dict) -> dict:
    response = client.post('/${s.id}',
        json={
${fields}
        },
        headers={'X-Idempotency-Key': str(uuid.uuid4())},
    )
    response.raise_for_status()
    return response.json()  # {'ok': True, 'record_id': ...}`
}

function buildGo(s: Stream) {
  const fn = s.title.split(/\s+/).map(w => w[0].toUpperCase() + w.slice(1)).join('')
  const fields = schemaFields(s)
    .map(f => {
      const val = f.type === 'number' ? f.example : `"${f.example}"`
      const comment = !f.required ? ' // optional' : ''
      return `        "${f.field}": ${val},${comment}`
    })
    .join('\n')
  return `package beam

import (
    "bytes"; "encoding/json"; "fmt"
    "net/http"; "os"
    "github.com/google/uuid"
)

func Beam${fn}(data map[string]any) error {
    payload, _ := json.Marshal(map[string]any{
${fields}
    })
    req, _ := http.NewRequest("POST",
        "https://api.openiv.io/api/v1/beam/${s.id}",
        bytes.NewReader(payload))
    req.Header.Set("Authorization", "Bearer "+os.Getenv("OPENIV_BEAM_KEY"))
    req.Header.Set("Content-Type", "application/json")
    req.Header.Set("X-Idempotency-Key", uuid.New().String())
    resp, err := http.DefaultClient.Do(req)
    if err != nil { return fmt.Errorf("beam: %w", err) }
    defer resp.Body.Close()
    if resp.StatusCode != http.StatusOK {
        return fmt.Errorf("rejected: HTTP %d", resp.StatusCode)
    }
    return nil
}`
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
  devices: { bg: '#f8fafc', color: '#475569' },
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
      sx={{ fontSize: '0.6875rem', fontFamily: 'Jost', fontWeight: 600, color: done ? '#10b981' : '#64748b', textTransform: 'none', px: 1, py: 0.375, borderRadius: 0, '&:hover': { bgcolor: '#f8fafc' }, '& .MuiButton-startIcon': { mr: 0.375 } }}>
      {done ? 'Copied' : 'Copy'}
    </Button>
  )
}

function RecordRow({ record }: { record: BeamRecord }) {
  const [expanded, setExpanded] = useState(false)
  const pretty = useMemo(() => prettyJson(record.payload), [record.payload])
  const cfg = STREAM_COLORS[record.stream] ?? { bg: '#f8fafc', color: '#475569' }

  let preview = ''
  try {
    const obj = JSON.parse(record.payload)
    const keys = Object.keys(obj).slice(0, 3)
    preview = keys.map(k => `"${k}": ${JSON.stringify(obj[k])}`).join(', ')
    if (Object.keys(obj).length > 3) preview += ', …'
  } catch { preview = record.payload.slice(0, 80) }

  return (
    <Box sx={{ borderBottom: '1px solid #f4f5f7', '&:last-child': { borderBottom: 'none' } }}>
      <Box
        onClick={() => setExpanded(p => !p)}
        data-ai-analyzable="true"
        data-ai-description={`Live Beam Record: ${record.stream.toUpperCase()}. received: ${fmtRelative(record.receivedAt)}. payload: ${preview}`}
        sx={{ px: 3, py: 1.5, display: 'grid', gridTemplateColumns: '110px 1fr 80px 80px 28px', gap: 1.5, alignItems: 'center', cursor: 'pointer', '&:hover': { bgcolor: '#f8fafc' }, transition: 'background 0.15s' }}
      >
        <Box sx={{ display: 'inline-flex', px: 1, py: 0.375, bgcolor: cfg.bg }}>
          <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', color: cfg.color }}>
            {(STREAM_LABELS[record.stream] ?? record.stream).toUpperCase()}
          </Typography>
        </Box>
        <Typography sx={{ fontSize: '0.75rem', fontFamily: 'SF Mono, Monaco, monospace', color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
        <Box sx={{ bgcolor: '#f8fafc', borderTop: '1px solid #eef0f4', p: 2.5 }}>
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
                <Typography sx={{ fontSize: '0.8125rem', fontFamily: 'SF Mono, Monaco, monospace', color: '#00288e' }}>{value}</Typography>
              </Box>
            ))}
          </Box>
          <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#475569', letterSpacing: '0.1em', mb: 0.75 }}>PAYLOAD</Typography>
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
        <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid #eef0f4', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <VpnKeyOutlinedIcon sx={{ fontSize: '1.125rem', color: colorPalette.primary }} />
            <Box>
              <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost' }}>Beam API Key</Typography>
              <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', mt: 0.125 }}>Authenticate your server when beaming data to OpenIV</Typography>
            </Box>
          </Box>
          <IconButton disableRipple size="small" onClick={onClose} sx={{ borderRadius: 0, color: '#94a3b8', '&:hover': { color: '#475569' } }}>
            <CloseRoundedIcon sx={{ fontSize: '1.125rem' }} />
          </IconButton>
        </Box>

        <Box sx={{ px: 3, py: 3 }}>
          {loading ? (
            <Stack gap={2}><Skeleton height={60} /><Skeleton height={40} /></Stack>
          ) : (
            <Stack gap={2.5}>
              <Box sx={{ p: 2, bgcolor: '#f8fafc', border: '1px solid #eef0f4' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
                  <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: '#00288e', fontFamily: 'Jost' }}>Current key</Typography>
                  <Box sx={{ px: 1, py: 0.375, fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.1em', bgcolor: keyInfo ? '#f0fdf4' : '#f8fafc', color: keyInfo ? '#10b981' : '#94a3b8' }}>
                    {keyInfo ? 'ACTIVE' : 'NOT SET'}
                  </Box>
                </Box>
                {keyInfo ? (
                  <>
                    <Typography sx={{ fontSize: '0.875rem', fontFamily: 'SF Mono, Monaco, monospace', color: '#00288e', mb: 0.5 }}>
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
                    <Typography sx={{ flex: 1, fontFamily: 'SF Mono, Monaco, monospace', fontSize: '0.75rem', color: '#00288e', wordBreak: 'break-all' }}>{newKey}</Typography>
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
                      sx={{ flex: 1, bgcolor: colorPalette.primary, color: '#ffffff', px: 2, py: 1, fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Jost', borderRadius: 0, textTransform: 'none', boxShadow: 'none', '& .MuiButton-startIcon': { color: '#ffffff' }, '&:hover': { bgcolor: '#1e293b' } }}
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
                    sx={{ flex: 1, bgcolor: colorPalette.primary, color: '#ffffff', px: 2, py: 1, fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Jost', borderRadius: 0, textTransform: 'none', boxShadow: 'none', '& .MuiButton-startIcon': { color: '#ffffff' }, '&:hover': { bgcolor: '#1e293b' } }}
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
  const ts1 = new Date(now.getTime() - 5 * 60 * 1000).toISOString()
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
  const [activeLang, setActiveLang] = useState<Lang>('cURL')
  const [apiKeyOpen, setApiKeyOpen] = useState(false)
  const [testResponse, setTestResponse] = useState<any>(null)
  const { sandboxEnabled, setSandboxEnabled } = useSandbox()
  const [sendingTest, setSendingTest] = useState(false)
  const [testSuccess, setTestSuccess] = useState(false)
  const [editablePayload, setEditablePayload] = useState('')
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [expectedStatus, setExpectedStatus] = useState<200 | 400 | 401>(200)

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

      setSendingTest(true)
      const res = await beamApi.sendTestPayload(activeStream, parsed)
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
            'Beam rejected (400) — Micro-Timing Anomaly: occurred_at is within ±5 seconds of server time. ' +
            'A cybersecurity case has been auto-opened. Verify the timestamp is real (not "now") and retry.'
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
  const langs: Lang[] = ['cURL', 'Node.js', 'Python', 'Go']
  const codeByLang: Record<Lang, string> = {
    'cURL': buildCurl(stream),
    'Node.js': buildNode(stream),
    'Python': buildPython(stream),
    'Go': buildGo(stream),
  }

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
            <Typography sx={{ fontSize: '1.625rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost', letterSpacing: '-0.015em', mb: 0.5 }}>Beam to OpenIV</Typography>
            <Typography sx={{ fontSize: '0.9375rem', color: '#64748b', maxWidth: 720 }}>
              Stream the six signals that power real-time fraud defense.
            </Typography>
          </Box>
          <Stack direction="row" gap={1.25} sx={{ mt: 0.75, flexShrink: 0 }}>
            <Button
              startIcon={<VpnKeyOutlinedIcon sx={{ fontSize: '1rem !important' }} />}
              onClick={() => setApiKeyOpen(true)}
              sx={{ border: '1px solid #eef0f4', bgcolor: '#ffffff', color: '#475569', px: 2, py: 1, fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Jost', borderRadius: 0, textTransform: 'none', '&:hover': { bgcolor: '#f8fafc', borderColor: '#cbd5e1' } }}>
              API Key
            </Button>
          </Stack>
        </Box>

        {/* Health KPIs */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, mb: 3 }}>
          {[
            { label: 'Streams connected', value: recordsLoading ? '…' : `${connected}/${streamsWithTimestamps.length}`, sub: recordsLoading ? 'Loading…' : connected === streamsWithTimestamps.length ? 'Full coverage' : `${streamsWithTimestamps.length - connected} pending` },
            { label: 'Records received', value: recordsLoading ? '…' : totalRecords.toLocaleString(), sub: 'last 100 across all streams' },
            { label: 'Median latency', value: recordsLoading ? '…' : healthMetrics.medianLatency, sub: 'from your core to OpenIV' },
            { label: 'Schema validity', value: recordsLoading ? '…' : healthMetrics.validity, sub: healthMetrics.rejected > 0 ? `${healthMetrics.rejected} rejected total` : 'No rejections' },
          ].map(s => (
            <Box
              key={s.label}
              data-ai-analyzable="true"
              data-ai-description={`Ingestion KPI: ${s.label}. current value: ${s.value}. status: ${s.sub}.`}
              sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', p: 2.25 }}>
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 0.625 }}>{s.label}</Typography>
              <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost', lineHeight: 1.1, mb: 0.5 }}>{s.value}</Typography>
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
                  bgcolor: isSoon ? '#f8fafc' : '#ffffff',
                  border: '1px solid',
                  borderColor: isActive ? colorPalette.primary : '#eef0f4',
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
                  <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost', mb: 0.25 }}>{s.title}</Typography>
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
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 3 }}>
          <Stack gap={3}>
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


            {/* Schema */}
            <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', mb: 3 }}>
              <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid #eef0f4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost' }}>Schema · {stream.title}</Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>{stream.schema.filter(f => f.required).length} required · {stream.schema.length} total fields</Typography>
                </Box>
                <Chip label={statusConfig[stream.status].label.toUpperCase()} size="small" sx={{ bgcolor: statusConfig[stream.status].bg, color: statusConfig[stream.status].color, fontWeight: 700, fontSize: '0.625rem', letterSpacing: '0.1em', borderRadius: 0, height: 22 }} />
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 90px 60px', px: 3, py: 1.25, bgcolor: '#fafbfc', borderBottom: '1px solid #eef0f4' }}>
                {['Field & example', 'Type', 'Required'].map(h => (
                  <Typography key={h} sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{h}</Typography>
                ))}
              </Box>
              {stream.schema.map((f, i) => (
                <Box key={f.field} sx={{ display: 'grid', gridTemplateColumns: '1fr 90px 60px', px: 3, py: 1.5, alignItems: 'center', borderBottom: i === stream.schema.length - 1 ? 'none' : '1px solid #f4f5f7', '&:hover': { bgcolor: '#fafbfc' } }}>
                  <Box>
                    <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: colorPalette.primary, fontFamily: 'SF Mono, Monaco, monospace' }}>{f.field}</Typography>
                    <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', fontFamily: 'SF Mono, Monaco, monospace', mt: 0.25 }}>e.g. {f.example}</Typography>
                  </Box>
                  <Typography sx={{ fontSize: '0.6875rem', color: '#f59e0b', fontFamily: 'SF Mono, Monaco, monospace', fontWeight: 600 }}>{f.type}</Typography>
                  {f.required ? <CheckCircleOutlineRoundedIcon sx={{ fontSize: '1rem', color: '#10b981' }} /> : <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>optional</Typography>}
                </Box>
              ))}
            </Box>

            {/* Recent payloads (Moved here) */}
            <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4' }}>
              <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid #eef0f4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost' }}>Recent payloads</Typography>
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
                    <Box key={i} sx={{ px: 3, py: 1.5, borderBottom: '1px solid #f4f5f7', display: 'flex', gap: 2 }}>
                      <Skeleton variant="rectangular" width={90} height={18} />
                      <Skeleton variant="rectangular" width="60%" height={18} />
                      <Skeleton variant="rectangular" width={60} height={18} />
                    </Box>
                  ))
                ) : activeStreamRecords.length === 0 ? (
                  <Box sx={{ p: 4, textAlign: 'center' }}>
                    <ErrorOutlineRoundedIcon sx={{ fontSize: '2rem', color: '#94a3b8', mb: 1 }} />
                    <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#475569', mb: 0.5 }}>No payloads on this stream yet</Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8', maxWidth: 320, mx: 'auto', mb: 2 }}>Generate an API key and instrument your core to start beaming.</Typography>
                    <Button onClick={() => setApiKeyOpen(true)} sx={{ bgcolor: colorPalette.primary, color: '#ffffff', px: 2.25, py: 1.125, fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Jost', borderRadius: 0, textTransform: 'none', boxShadow: 'none', '&:hover': { bgcolor: '#1e293b' } }}>
                      Get API Key
                    </Button>
                  </Box>
                ) : (
                  activeStreamRecords.map(r => <RecordRow key={r.id} record={r} />)
                )}
              </Stack>
            </Box>
          </Stack>

          <Stack gap={3} sx={{ minWidth: 0 }}>
            {/* Code sample */}
            <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4' }}>
              <Box sx={{ px: 3, py: 2, borderBottom: '1px solid #eef0f4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost' }}>How to beam</Typography>
                <Box sx={{ display: 'flex' }}>
                  {langs.map(lang => (
                    <Box key={lang} onClick={() => setActiveLang(lang)} sx={{ px: 1.5, py: 0.75, fontSize: '0.75rem', fontWeight: 600, fontFamily: 'Jost', cursor: 'pointer', transition: 'all 0.15s', color: activeLang === lang ? colorPalette.primary : '#64748b', bgcolor: activeLang === lang ? `${colorPalette.primary}08` : 'transparent', borderBottom: activeLang === lang ? `2px solid ${colorPalette.primary}` : '2px solid transparent', '&:hover': { color: colorPalette.primary } }}>
                      {lang}
                    </Box>
                  ))}
                </Box>
              </Box>
              <SyntaxCode code={codeByLang[activeLang]} />
            </Box>

            {/* Expected Result Documentation */}
            {(() => {
              const expectedResultConfig: Record<StreamId, {
                intro: string
                fields: { label: string; desc: string }[]
                label: string
                json: string
              }> = {
                transactions: {
                  intro: 'OpenIV returns a synchronous risk analysis for every transaction beam. Your backend can act immediately — hold, decline, or allow — without waiting for a webhook.',
                  fields: [
                    { label: 'risk_score', desc: 'A value from 0–100 indicating the probability of fraud. Higher means riskier.' },
                    { label: 'risk_level', desc: 'Categorical threat level: LOW, MEDIUM, HIGH, or CRITICAL.' },
                    { label: 'recommended_action', desc: 'Automated guidance based on your configured thresholds: ALLOW, REVIEW, HOLD, or DECLINE.' },
                    { label: 'case_id', desc: 'ID of the compliance case auto-created for your team to review, if applicable.' },
                  ],
                  label: 'Transaction response body (JSON)',
                  json: `{\n  "ok": true,\n  "record_id": 104829,\n  "analysis": {\n    "risk_score": 74,\n    "risk_level": "HIGH",\n    "recommended_action": "HOLD",\n    "case_id": "CASE-9201"\n  }\n}`,
                },
                logins: {
                  intro: 'Login signals are ingested asynchronously and used to build account-takeover risk profiles. OpenIV returns an acknowledgment, a session-level risk indicator, and a fraud risk score.',
                  fields: [
                    { label: 'ok', desc: 'True if the payload was accepted and validated against the login schema.' },
                    { label: 'record_id', desc: 'Unique ID assigned to this login event in the OpenIV system.' },
                    { label: 'risk_score', desc: 'A value from 0–100 quantifying the account-takeover probability for this login attempt. Used to decide whether to challenge the user.' },
                    { label: 'session_risk', desc: 'Categorical label derived from risk_score: NORMAL, SUSPICIOUS, or BLOCKED.' },
                    { label: 'status', desc: 'Always "received" for successful ingestions.' },
                  ],
                  label: 'Login event response body (JSON)',
                  json: `{\n  "ok": true,\n  "record_id": 204512,\n  "stream": "logins",\n  "risk_score": 57,\n  "session_risk": "SUSPICIOUS",\n  "status": "received"\n}`,
                },
                activity: {
                  intro: 'In-app behaviour is a direct input to the fraud prediction engine. OpenIV processes every session event against the user\'s baseline and returns a behavioural risk score you can act on immediately.',
                  fields: [
                    { label: 'ok', desc: 'True if the payload passed schema validation.' },
                    { label: 'record_id', desc: 'Unique ID of this activity record.' },
                    { label: 'risk_score', desc: 'A value from 0–100 representing the predicted fraud probability derived from behavioural pattern matching. Higher means more anomalous.' },
                    { label: 'recommended_action', desc: 'Automated guidance: ALLOW, MONITOR, HOLD, or FLAG. Use this to decide whether to let the session continue or challenge the user.' },
                    { label: 'profile_updated', desc: 'True if this event updated the user\'s long-term behavioural baseline.' },
                    { label: 'status', desc: 'Always "received" for accepted payloads.' },
                  ],
                  label: 'In-app activity response body (JSON)',
                  json: `{\n  "ok": true,\n  "record_id": 305871,\n  "stream": "activity",\n  "risk_score": 68,\n  "recommended_action": "HOLD",\n  "profile_updated": true,\n  "status": "received"\n}`,
                },
                location: {
                  intro: 'Location signals are matched against the customer\'s recent geo-footprint in real time. OpenIV returns an acknowledgment, a geo-anomaly flag, and a location-derived risk score.',
                  fields: [
                    { label: 'ok', desc: 'True if the payload was accepted.' },
                    { label: 'record_id', desc: 'Unique ID of this location ping.' },
                    { label: 'risk_score', desc: 'A value from 0–100 reflecting the impossibility of the travel path. A score above 70 typically indicates a SIM-swap or account takeover.' },
                    { label: 'geo_anomaly', desc: 'True if this location is impossible given the customer\'s previous ping — potential SIM-swap or account takeover indicator.' },
                    { label: 'status', desc: 'Always "received" on success.' },
                  ],
                  label: 'Location signal response body (JSON)',
                  json: `{\n  "ok": true,\n  "record_id": 406230,\n  "stream": "location",\n  "risk_score": 82,\n  "geo_anomaly": true,\n  "status": "received"\n}`,
                },
                devices: {
                  intro: 'Device fingerprints are checked against the customer\'s device-of-record history. OpenIV returns an acknowledgment, a new-device flag, and a device-context risk score.',
                  fields: [
                    { label: 'ok', desc: 'True if the fingerprint payload was accepted.' },
                    { label: 'record_id', desc: 'Unique ID of this device fingerprint record.' },
                    { label: 'risk_score', desc: 'A value from 0–100 based on device novelty, jailbreak status, and historical device patterns for this account.' },
                    { label: 'new_device', desc: 'True if this device has never been seen on this account — a key SIM-swap and account-takeover signal.' },
                    { label: 'status', desc: 'Always "received" on success.' },
                  ],
                  label: 'Device fingerprint response body (JSON)',
                  json: `{\n  "ok": true,\n  "record_id": 507441,\n  "stream": "devices",\n  "risk_score": 63,\n  "new_device": true,\n  "status": "received"\n}`,
                },
                otps: {
                  intro: 'OTP events are processed in real time to detect SIM-swap patterns. OpenIV returns an acknowledgment, hold status, and an OTP-pattern risk score.',
                  fields: [
                    { label: 'ok', desc: 'True if the OTP event was accepted and processed.' },
                    { label: 'record_id', desc: 'Unique ID of this OTP event record.' },
                    { label: 'risk_score', desc: 'A value from 0–100 reflecting the suspicion level of the OTP pattern — high retry counts and cross-device OTPs score near 100.' },
                    { label: 'transaction_held', desc: 'True if an associated transaction was automatically held pending OTP verification outcome.' },
                    { label: 'retry_alert', desc: 'True if retry count exceeded your configured threshold, triggering a real-time alert.' },
                    { label: 'status', desc: 'Always "received" on success.' },
                  ],
                  label: 'OTP event response body (JSON)',
                  json: `{\n  "ok": true,\n  "record_id": 608992,\n  "stream": "otps",\n  "risk_score": 91,\n  "transaction_held": true,\n  "retry_alert": true,\n  "status": "received"\n}`,
                },
                kyc: {
                  intro: 'KYC records are processed synchronously. OpenIV updates the customer\'s identity profile immediately — the next transaction beam for this customer will reflect the new KYC tier in its risk score. At least one of bvn, nin, or photo must be present for a meaningful verification.',
                  fields: [
                    { label: 'customer_id', desc: 'The external customer ID you passed in the payload — echoed back for confirmation.' },
                    { label: 'kyc_status', desc: '"verified" when both BVN and NIN are on file. "partial" when only one identifier is present. "unverified" if only a name or photo was submitted.' },
                    { label: 'bvn_received', desc: 'True if a BVN (11-digit Bank Verification Number) was included in the payload and stored. A kyc.verified or kyc.partial webhook fires immediately after.' },
                    { label: 'nin_received', desc: 'True if a NIN (11-digit National Identification Number) was included and stored.' },
                    { label: 'photo_received', desc: 'True if a base64-encoded biometric photo was included and stored for future face-match checks.' },
                    { label: 'processed_at', desc: 'ISO 8601 timestamp at which the customer profile was updated. Use this for audit logging on your side.' },
                  ],
                  label: 'KYC beam response body (JSON)',
                  json: `{\n  "ok": true,\n  "record_id": 709123,\n  "customer_id": "CUST-001",\n  "kyc_status": "verified",\n  "bvn_received": true,\n  "nin_received": true,\n  "photo_received": false,\n  "processed_at": "2026-05-14T10:00:01Z"\n}`,
                },
              }

              // Parse risk_score from the example json for the visual bar
              const cfg = expectedResultConfig[activeStream]
              let riskScore: number | null = null
              try {
                const parsed = JSON.parse(cfg.json)
                const score = parsed?.risk_score ?? parsed?.analysis?.risk_score
                if (typeof score === 'number') riskScore = score
              } catch { /* ignore */ }

              const riskColor = riskScore == null ? '#94a3b8'
                : riskScore >= 75 ? '#dc2626'
                : riskScore >= 50 ? '#f59e0b'
                : '#10b981'

              const riskLabel = riskScore == null ? '—'
                : riskScore >= 75 ? 'HIGH RISK'
                : riskScore >= 50 ? 'MODERATE'
                : 'LOW RISK'

              // Error response configs (apply to all streams)
              const errorConfig = {
                400: {
                  title: 'Bad Request',
                  color: '#dc2626',
                  bg: '#fef2f2',
                  border: '#fecaca',
                  intro: 'OpenIV returns 400 when a beam payload is rejected by validation or by a critical security rule. Your client should surface the error and not retry without fixing the cause.',
                  fields: [
                    { label: 'error', desc: 'Machine-readable error code prefixed with the rule name (e.g., "MICRO_TIMING_ANOMALY: ...") or a short reason for malformed payloads.' },
                  ],
                  scenarios: [
                    {
                      name: 'Micro-Timing Anomaly',
                      desc: 'Transaction occurred_at is within ±5s of server time — likely API injection or system clock manipulation. A cybersecurity case is auto-opened, but the request is still rejected with 400. Action: verify the timestamp is real, not "now()".',
                      json: `{\n  "error": "MICRO_TIMING_ANOMALY: transaction occurred_at is within \\u00b15s of server time. Possible API injection or clock manipulation. Case opened: CASE-12384"\n}`,
                    },
                    {
                      name: 'Malformed Payload',
                      desc: 'Required fields missing or wrong type. Action: validate against the stream schema before beaming.',
                      json: `{\n  "error": "amount must be a positive number"\n}`,
                    },
                  ],
                  label: 'Error response body (JSON)',
                },
                401: {
                  title: 'Unauthorized',
                  color: '#f59e0b',
                  bg: '#fffbeb',
                  border: '#fde68a',
                  intro: 'OpenIV returns 401 when the API key is missing, malformed, revoked, or the session cookie is invalid. Your client must regenerate the key from the dashboard or re-authenticate.',
                  fields: [
                    { label: 'error', desc: 'One of: "missing_api_key_or_session", "invalid_api_key_or_session", or "invalid_session_cookie".' },
                  ],
                  scenarios: [
                    {
                      name: 'Missing API Key',
                      desc: 'No Authorization header and no session cookie. Action: include "Authorization: Bearer <key>" or sign in via cookie.',
                      json: `{\n  "error": "missing_api_key_or_session"\n}`,
                    },
                    {
                      name: 'Invalid / Revoked API Key',
                      desc: 'Key was revoked or never existed. Action: regenerate from Data Beaming → API Key.',
                      json: `{\n  "error": "invalid_api_key_or_session"\n}`,
                    },
                    {
                      name: 'Expired Session Cookie',
                      desc: 'Session expired or was logged out. Action: re-authenticate via /auth/login.',
                      json: `{\n  "error": "invalid_session_cookie"\n}`,
                    },
                  ],
                  label: 'Error response body (JSON)',
                },
              }

              const tabs: Array<{ status: 200 | 400 | 401; label: string; color: string }> = [
                { status: 200, label: '200 OK', color: '#10b981' },
                { status: 400, label: '400 Bad Request', color: '#dc2626' },
                { status: 401, label: '401 Unauthorized', color: '#f59e0b' },
              ]

              return (
                <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4' }}>
                  <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid #eef0f4' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                      <Box sx={{ width: 32, height: 32, bgcolor: `${colorPalette.primary}10`, color: colorPalette.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <AutoAwesomeOutlinedIcon sx={{ fontSize: '1rem' }} />
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost' }}>Expected Result</Typography>
                        <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>Response shapes your server should handle for {stream.title.toLowerCase()} beams</Typography>
                      </Box>
                    </Box>
                  </Box>

                  {/* Status tabs */}
                  <Box sx={{ display: 'flex', borderBottom: '1px solid #eef0f4' }}>
                    {tabs.map(({ status, label, color }) => {
                      const active = expectedStatus === status
                      return (
                        <Box
                          key={status}
                          onClick={() => setExpectedStatus(status)}
                          sx={{
                            flex: 1,
                            px: 2.5,
                            py: 1.5,
                            cursor: 'pointer',
                            borderBottom: active ? `2px solid ${color}` : '2px solid transparent',
                            bgcolor: active ? `${color}08` : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 1,
                            transition: 'background 0.15s',
                            '&:hover': { bgcolor: `${color}05` },
                          }}
                        >
                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color }} />
                          <Typography sx={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: active ? color : '#64748b',
                            fontFamily: 'Jost',
                            letterSpacing: '0.02em',
                          }}>
                            {label}
                          </Typography>
                        </Box>
                      )
                    })}
                  </Box>

                  <Box sx={{ p: 3 }}>
                    {expectedStatus === 200 ? (
                      <>
                        <Typography sx={{ fontSize: '0.875rem', color: '#475569', lineHeight: 1.6, mb: 2.5 }}>
                          {cfg.intro}
                        </Typography>

                        {/* Risk score percentage visual */}
                        {riskScore !== null && (
                          <Box sx={{ mb: 3, p: 2, border: `1px solid ${riskColor}22`, bgcolor: `${riskColor}06` }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.25 }}>
                              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                Example risk_score
                              </Typography>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Box sx={{ px: 1, py: 0.25, bgcolor: `${riskColor}14`, border: `1px solid ${riskColor}35` }}>
                                  <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: riskColor, letterSpacing: '0.1em' }}>
                                    {riskLabel}
                                  </Typography>
                                </Box>
                                <Typography sx={{ fontSize: '1.375rem', fontWeight: 800, color: riskColor, fontFamily: 'Jost', lineHeight: 1 }}>
                                  {riskScore}<Typography component="span" sx={{ fontSize: '0.75rem', fontWeight: 600, color: riskColor }}>%</Typography>
                                </Typography>
                              </Box>
                            </Box>
                            <Box sx={{ height: 7, bgcolor: '#e5e7eb', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                              <Box sx={{
                                position: 'absolute', inset: 0, width: `${riskScore}%`,
                                background: riskScore >= 75
                                  ? 'linear-gradient(90deg, #10b981 0%, #f59e0b 50%, #dc2626 100%)'
                                  : riskScore >= 50
                                  ? 'linear-gradient(90deg, #10b981 0%, #f59e0b 100%)'
                                  : '#10b981',
                                borderRadius: '4px',
                                transition: 'width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
                              }} />
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.625 }}>
                              <Typography sx={{ fontSize: '0.5625rem', color: '#94a3b8' }}>0 — Safe</Typography>
                              <Typography sx={{ fontSize: '0.5625rem', color: '#94a3b8' }}>100 — Critical</Typography>
                            </Box>
                          </Box>
                        )}

                        <Stack gap={2}>
                          {cfg.fields.map(item => (
                            <Box key={item.label} sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                              <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: colorPalette.primary, fontFamily: 'SF Mono, Monaco, monospace', minWidth: 140 }}>
                                {item.label}
                              </Typography>
                              <Typography sx={{ fontSize: '0.75rem', color: '#64748b', lineHeight: 1.5 }}>
                                {item.desc}
                              </Typography>
                            </Box>
                          ))}
                        </Stack>
                        <Box sx={{ mt: 3, p: 2, bgcolor: '#f8fafc', border: '1px solid #eef0f4' }}>
                          <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#00288e', mb: 1, fontFamily: 'Jost' }}>
                            {cfg.label}
                          </Typography>
                          <Box sx={{ bgcolor: '#0d1117', p: 1.5, fontFamily: 'SF Mono, Monaco, monospace', fontSize: '0.6875rem', color: '#c3e88d', whiteSpace: 'pre', overflowX: 'auto' }}>
                            {cfg.json}
                          </Box>
                        </Box>
                      </>
                    ) : (
                      <>
                        {(() => {
                          const errCfg = errorConfig[expectedStatus]
                          return (
                            <>
                              <Box sx={{ mb: 2.5, p: 2, bgcolor: errCfg.bg, border: `1px solid ${errCfg.border}` }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                                  <Typography sx={{ fontSize: '0.6875rem', fontWeight: 800, color: errCfg.color, fontFamily: 'SF Mono, Monaco, monospace', letterSpacing: '0.04em' }}>
                                    HTTP {expectedStatus}
                                  </Typography>
                                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: errCfg.color, fontFamily: 'Jost' }}>
                                    {errCfg.title}
                                  </Typography>
                                </Box>
                                <Typography sx={{ fontSize: '0.8125rem', color: '#475569', lineHeight: 1.55 }}>
                                  {errCfg.intro}
                                </Typography>
                              </Box>

                              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 1.25 }}>
                                Response Fields
                              </Typography>
                              <Stack gap={2} sx={{ mb: 3 }}>
                                {errCfg.fields.map(item => (
                                  <Box key={item.label} sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                                    <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: errCfg.color, fontFamily: 'SF Mono, Monaco, monospace', minWidth: 140 }}>
                                      {item.label}
                                    </Typography>
                                    <Typography sx={{ fontSize: '0.75rem', color: '#64748b', lineHeight: 1.5 }}>
                                      {item.desc}
                                    </Typography>
                                  </Box>
                                ))}
                              </Stack>

                              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 1 }}>
                                Common Scenarios
                              </Typography>
                              <Stack gap={1.5}>
                                {errCfg.scenarios.map((sc, idx) => (
                                  <Box key={idx} sx={{ p: 1.5, bgcolor: '#f8fafc', border: '1px solid #eef0f4' }}>
                                    <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost', mb: 0.375 }}>
                                      {sc.name}
                                    </Typography>
                                    <Typography sx={{ fontSize: '0.75rem', color: '#64748b', lineHeight: 1.5, mb: 1 }}>
                                      {sc.desc}
                                    </Typography>
                                    <Box sx={{ bgcolor: '#0d1117', p: 1.25, fontFamily: 'SF Mono, Monaco, monospace', fontSize: '0.6875rem', color: '#ff7b72', whiteSpace: 'pre', overflowX: 'auto', maxWidth: '100%' }}>
                                      {sc.json}
                                    </Box>
                                  </Box>
                                ))}
                              </Stack>
                            </>
                          )
                        })()}
                      </>
                    )}
                  </Box>
                </Box>
              )
            })()}

            {/* Simulation Box - Beam Test Transaction */}
            <Box sx={{ bgcolor: '#ffffff', border: '1px solid #eef0f4', p: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PlayCircleOutlineIcon sx={{ fontSize: '1.125rem', color: colorPalette.primary }} />
                  <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#00288e', fontFamily: 'Jost' }}>Beam Test Transaction</Typography>
                </Box>
                {sandboxEnabled && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1, py: 0.375, bgcolor: '#fff7ed', border: '1px solid #ffedd5' }}>
                    <ScienceOutlinedIcon sx={{ fontSize: '0.85rem', color: '#c2410c' }} />
                    <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#c2410c', letterSpacing: '0.05em' }}>SANDBOX MODE</Typography>
                  </Box>
                )}
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mb: 1 }}>
                  Edit the payload below to simulate a custom {stream.title.toLowerCase()} event:
                </Typography>
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
                      bgcolor: '#f8fafc',
                      borderRadius: 0,
                      '& fieldset': { borderColor: '#e2e8f0' },
                      '&:hover fieldset': { borderColor: '#cbd5e1' },
                    }
                  }}
                />
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

              {testResponse && (
                <Box sx={{ mt: 3, p: 2, bgcolor: '#00288e', border: '1px solid #1e293b' }}>
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
                        Score: <Box component="span" sx={{ color: testResponse.analysis.risk_score >= 60 ? '#ef4444' : '#10b981', fontWeight: 700 }}>{testResponse.analysis.risk_score}</Box> ·
                        Level: <Box component="span" sx={{ color: '#ffffff', fontWeight: 600 }}>{testResponse.analysis.risk_level}</Box> ·
                        Action: <Box component="span" sx={{ color: colorPalette.primary, fontWeight: 700 }}>{testResponse.analysis.recommended_action}</Box>
                      </Typography>
                    </Box>
                  )}
                </Box>
              )}
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
